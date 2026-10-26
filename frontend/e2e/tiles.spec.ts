/**
 * Tilesets and tile maps — and the spec's acceptance demo, done the way a
 * student would: import a sprite sheet, slice it, make a tileset with solid
 * ground, paint a level, make Player, Coin and Enemy, write gravity and
 * jumping in Python, drag instances in, and play a platformer.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, nameBox, playAndWait, py, screenAt, setCode, treeItem, watchErrors } from "./helpers";

type Paint = { width: number; height: number; rects: [number, number, number, number, string][] };

async function png(page: Page, p: Paint): Promise<Buffer> {
  const b64 = await page.evaluate(async (p) => {
    const c = new OffscreenCanvas(p.width, p.height);
    const x = c.getContext("2d")!;
    for (const [rx, ry, w, h, col] of p.rects) (x.fillStyle = col), x.fillRect(rx, ry, w, h);
    const bytes = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, p);
  return Buffer.from(b64, "base64");
}

/** Two 32 px tiles: 0 is grass (to be solid), 1 is a flower (scenery). */
const TILES: Paint = { width: 64, height: 32, rects: [[0, 0, 32, 32, "#4caf50"], [44, 8, 8, 16, "#e91e63"]] };

async function makeTileset(page: Page) {
  await page.getByTestId("add-tilesets").click();
  await nameBox(page).press("Enter");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("tileset-image").click();
  await (await chooser).setFiles({ name: "tiles.png", mimeType: "image/png", buffer: await png(page, TILES) });
  await expect(page.getByTestId("tileset-count")).toHaveText("2 × 1 = 2 tiles, 0 solid");
  await page.getByTestId("tileset-canvas").click({ position: { x: 10, y: 10 } }); // tile 0
  await expect(page.getByTestId("tileset-count")).toHaveText("2 × 1 = 2 tiles, 1 solid");
}

async function addTileLayer(page: Page) {
  await treeItem(page, "Room1 start").click();
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("room-panel-layers").click();
  await page.getByTestId("add-tile-layer").click();
  await page.getByTestId("room-panel-tiles").click();
}

// By the button's whole name: "Ground" is also inside "Background".
const tileCount = (page: Page) => page.getByTestId("layer-list").getByRole("button", { name: /^Ground \d+ tiles$/ }).locator(".muted");

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, button: "left" | "right" = "left") {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up({ button });
}

test("a tileset is cut from a picture and its solid tiles chosen", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeTileset(page);
});

test("a tile can be marked a one-way platform instead, and a tile is never both", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeTileset(page); // tile 0 solid
  await page.getByTestId("mark-oneway").click();
  await page.getByTestId("tileset-canvas").click({ position: { x: 150, y: 10 } }); // tile 1 (the picture is shown 4× its size)
  await expect(page.getByTestId("tileset-count")).toHaveText("2 × 1 = 2 tiles, 1 solid, 1 one-way");
  await page.getByTestId("tileset-canvas").click({ position: { x: 10, y: 10 } }); // tile 0: from solid to one-way
  await expect(page.getByTestId("tileset-count")).toHaveText("2 × 1 = 2 tiles, 0 solid, 2 one-way");
  await page.getByTestId("mark-solid").click();
  await page.getByTestId("tileset-canvas").click({ position: { x: 10, y: 10 } }); // and back
  await expect(page.getByTestId("tileset-count")).toHaveText("2 × 1 = 2 tiles, 1 solid, 1 one-way");
});

test("painting a level: brush, rectangle, bucket, eyedropper, erase, undo", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeTileset(page);
  await addTileLayer(page);
  // Dragging across the palette picks a block; a click picks one tile.
  const palette = page.getByTestId("tile-palette");
  const pb = (await palette.boundingBox())!;
  await drag(page, { x: pb.x + 4, y: pb.y + 4 }, { x: pb.x + pb.width - 4, y: pb.y + 4 });
  await expect(page.getByTestId("stamp-size")).toHaveText("Brush: 2 × 1 tiles");
  await palette.click({ position: { x: 4, y: 4 } }); // tile 0
  await expect(page.getByTestId("stamp-size")).toHaveText("Brush: 1 × 1 (tile 0)");
  const count = async () => {
    await page.getByTestId("room-panel-layers").click();
    const t = await tileCount(page).textContent();
    await page.getByTestId("room-panel-tiles").click();
    return t;
  };

  const cell = (c: number, r: number) => screenAt(page, c * 32 + 16, r * 32 + 16);
  await drag(page, await cell(1, 1), await cell(3, 1)); // a painted stroke of three
  expect(await count()).toBe("3 tiles");
  await page.getByTestId("room-undo").click(); // the whole stroke, not its last tile
  expect(await count()).toBe("0 tiles");
  await page.getByTestId("room-redo").click();
  expect(await count()).toBe("3 tiles");

  await page.getByTestId("tool-rect").click();
  await drag(page, await cell(0, 13), await cell(19, 14)); // the floor: 20 × 2
  expect(await count()).toBe("43 tiles");

  await page.getByTestId("room-undo").click(); // the whole rectangle goes in one step
  expect(await count()).toBe("3 tiles");
  await page.getByTestId("room-redo").click();
  expect(await count()).toBe("43 tiles");

  await page.getByTestId("tool-erase").click();
  await drag(page, await cell(1, 1), await cell(2, 1));
  expect(await count()).toBe("41 tiles");

  await page.getByTestId("tool-pick").click();
  await page.mouse.click((await cell(3, 1)).x, (await cell(3, 1)).y);
  await expect(page.getByTestId("tool-paint")).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("tool-fill").click();
  await page.mouse.click((await cell(10, 5)).x, (await cell(10, 5)).y); // every empty cell joined to it
  expect(await count()).toBe(`${20 * 15} tiles`);
});

test("the acceptance demo: a platformer built from scratch plays", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");

  // 1. A character sprite sheet: four 24 × 24 frames, imported and sliced.
  const sheet = await png(page, {
    width: 96,
    height: 24,
    rects: ["#3b82f6", "#2563eb", "#3b82f6", "#1d4ed8"].map((c, i) => [i * 24 + 2, 0, 20, 24, c] as [number, number, number, number, string]),
  });
  await page.evaluate(
    ({ b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "hero.png", { type: "image/png" }));
      window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, cancelable: true }));
    },
    { b64: sheet.toString("base64") },
  );
  await expect(page.getByTestId("slice-summary")).toHaveText("4 frames, 24 × 24");
  await page.getByLabel("Origin").selectOption("bottom-center");
  await page.getByTestId("import-done").click();
  await expect(treeItem(page, "hero")).toBeVisible();

  // 2. A tileset with solid ground, and a level painted with it.
  await makeTileset(page);
  await addTileLayer(page);
  await page.getByTestId("tile-palette").click({ position: { x: 4, y: 4 } });
  await page.getByTestId("tool-rect").click();
  await drag(page, await screenAt(page, 16, 13 * 32 + 16), await screenAt(page, 19 * 32 + 16, 14 * 32 + 16));

  // 3. Player, Coin and Enemy.
  for (const [name, sprite] of [["Player", "hero"], ["Coin", null], ["Enemy", null]] as const) {
    if (!sprite) {
      await page.getByTestId("add-sprites").click();
      await page.getByTestId(`starter-${name.toLowerCase()}`).click();
      // It arrives a moment later (painted, then saved) and opens its own tab.
      await expect(treeItem(page, name.toLowerCase())).toBeVisible();
    }
    await page.getByTestId("add-objects").click();
    await nameBox(page).fill(name);
    await nameBox(page).press("Enter");
    await page.getByTestId("object-sprite").selectOption({ label: sprite ?? name.toLowerCase() });
  }

  // 4. Gravity and jumping, in Python, on the Player.
  await treeItem(page, "Player").click();
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-create").click();
  await setCode(page, "self.vy = 0\n");
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, `move = keyboard_check("right") - keyboard_check("left")
move_and_collide(move * 4, 0)
self.vy = min(self.vy + 0.6, 12)
if keyboard_check_pressed("space") and not place_free(self.x, self.y + 1):
    self.vy = -10
if move_and_collide(0, self.vy):
    self.vy = 0
`);

  // 5. Instances dragged into the room.
  await treeItem(page, "Room1 start").click();
  await page.getByTestId("current-layer").selectOption({ label: "Instances" });
  const canvas = page.getByTestId("room-canvas");
  const box = (await canvas.boundingBox())!;
  for (const [name, x, y] of [["Player", 96, 200], ["Coin", 300, 380], ["Enemy", 450, 400]] as const) {
    const at = await screenAt(page, x, y);
    await treeItem(page, name).dragTo(canvas, { targetPosition: { x: at.x - box.x, y: at.y - box.y } });
  }

  // 6. Play: the player falls, lands on the ground, and jumps.
  await playAndWait(page);
  await page.waitForTimeout(1500);
  const landed = (await py(page, "instances('Player')[0].y")) as number;
  expect(landed).toBe(13 * 32); // feet on the top of the ground tiles
  await page.locator("canvas[data-testid=game-canvas]").click();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  expect((await py(page, "instances('Player')[0].y")) as number).toBeLessThan(landed - 30);
  await page.waitForTimeout(1500);
  expect(await py(page, "instances('Player')[0].y")).toBe(landed); // and back down
  const fps = Number(await page.getByTestId("fps").textContent());
  console.log(`acceptance demo: ${fps} fps`);
  expect(fps).toBeGreaterThanOrEqual(50);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("the platformer template: stands on its tiles, and the camera follows", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "platformer");
  await playAndWait(page);
  await page.waitForTimeout(800);
  expect(await py(page, "instances('Player')[0].y")).toBe(12 * 32);
  await page.locator("canvas[data-testid=game-canvas]").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1500);
  await page.keyboard.up("ArrowRight");
  expect((await py(page, "view_x")) as number).toBeGreaterThan(0);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("the platformer template: enemies walk their floor and turn at its ends", async ({ page }) => {
  // They once stood a row above the ground: with nothing under them, the
  // edge check turned them round every step and they shook in place.
  const errors = watchErrors(page);
  await fromTemplate(page, "platformer");
  await playAndWait(page);
  type Sample = [number, number][]; // [x, hspeed] per enemy
  const sample = async () => (await py(page, "[[e.x, e.hspeed] for e in instances('Enemy')]")) as Sample;
  // Distance walked, added up every half second: shaking in place adds up to
  // a step or two, walking to hundreds — even if an enemy turns round between
  // two looks and ends near where it began.
  let prev = await sample();
  expect(prev.length).toBe(2);
  const walked = [0, 0];
  const seen = new Set<number>();
  for (let n = 0; n < 16; n++) {
    await page.waitForTimeout(500);
    const now = await sample();
    now.forEach(([x, v], i) => {
      walked[i]! += Math.abs(x - prev[i]![0]);
      seen.add(Math.sign(v));
    });
    prev = now;
  }
  for (const w of walked) expect(w).toBeGreaterThan(200);
  // Long enough to reach an end of the floor and come back: both directions seen.
  expect([...seen].sort()).toEqual([-1, 1]);
  // Never over the gap: the floor they share runs from column 15 to 31.
  for (const [x] of prev) expect(x > 15 * 32 && x < 32 * 32).toBe(true);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("a huge level — 86 000 tiles — still plays at full speed", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "platformer");
  await treeItem(page, "Level1 start").click();
  await page.getByTestId("room-panel-room").click();
  await page.getByTestId("room-width").fill("9600"); // 300 tiles
  await page.getByTestId("room-height").fill("9600");
  await page.getByRole("button", { name: "Fit" }).click();
  // Fit really fits: the whole 9600 px room is on the canvas.
  const fitZoom = Number(await page.getByTestId("room-canvas").getAttribute("data-zoom"));
  const canvasBox = (await page.getByTestId("room-canvas").boundingBox())!;
  expect(9600 * fitZoom).toBeLessThanOrEqual(Math.min(canvasBox.width, canvasBox.height));
  await page.getByTestId("current-layer").selectOption({ label: "Ground" });
  await page.getByTestId("room-panel-tiles").click();
  await page.getByTestId("tile-palette").click({ position: { x: 40, y: 4 } }); // dirt
  await page.getByTestId("tool-rect").click();
  // Rows 13 to 299, every column: a floor 287 deep under the whole level.
  await drag(page, await screenAt(page, 4, 13 * 32 + 4), await screenAt(page, 9600 - 4, 9600 - 4));
  await page.getByTestId("room-panel-layers").click();
  await expect(page.getByTestId("layer-list").getByRole("button", { name: /^Ground \d+ tiles$/ })).toContainText("86");
  await playAndWait(page);
  await page.locator("canvas[data-testid=game-canvas]").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(3000);
  await page.keyboard.up("ArrowRight");
  const fps = Number(await page.getByTestId("fps").textContent());
  const drawn = Number(await page.getByTestId("tiles-drawn").textContent());
  console.log(`huge level: ${fps} fps, ${drawn} of 86 000 tiles drawn`);
  expect(fps).toBeGreaterThanOrEqual(40); // a moment of chunk-building while scrolling can dip it
  // Only the chunks near the 640 × 480 view: at most 5 × 4 chunks of 256.
  // (Drawing all 86 000 held 60 fps on a fast laptop too — this is about
  // memory and slower machines, so it checks what is drawn, not the speed.)
  expect(drawn).toBeGreaterThan(0);
  expect(drawn).toBeLessThanOrEqual(5 * 4 * 256);
  expect((await py(page, "view_x")) as number).toBeGreaterThan(0);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("the autotile brush picks ends and middles, and erasing grows new edges", async ({ page }) => {
  await fromTemplate(page, "platformer");
  await treeItem(page, "Level1 start").click();
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("current-layer").selectOption({ label: "Ground" });
  await page.getByTestId("room-panel-tiles").click();
  await page.getByTestId("autotile-grass").click();
  await expect(page.getByTestId("stamp-size")).toHaveText("Brush: grass (autotile)");
  const cell = (c: number, r: number) => screenAt(page, c * 32 + 16, r * 32 + 16);
  await drag(page, await cell(2, 2), await cell(4, 2)); // three in a row, up in the sky
  await page.getByTestId("tool-erase").click();
  await page.mouse.click((await cell(6, 2)).x, (await cell(6, 2)).y); // nothing there: nothing changes
  await playAndWait(page);
  // Tile 8 + mask: right = 2, left = 8.
  expect(await py(page, "[tile_at(c * 32 + 1, 2 * 32 + 1) for c in (2, 3, 4)]")).toEqual([10, 18, 16]);
  await page.getByTestId("stop").click();
  await page.mouse.click((await cell(3, 2)).x, (await cell(3, 2)).y); // erase the middle
  await playAndWait(page);
  expect(await py(page, "[tile_at(c * 32 + 1, 2 * 32 + 1) for c in (2, 3, 4)]")).toEqual([8, undefined, 8]); // None arrives as undefined
});

test("a new autotile set can be filled in order and then painted with", async ({ page }) => {
  await fromTemplate(page, "platformer");
  await treeItem(page, "terrain").click();
  await page.getByTestId("new-autotile").click();
  await page.getByLabel("First tile").fill("8");
  await page.getByTestId("autotile-in-order").click();
  await treeItem(page, "Level1 start").click();
  await page.getByTestId("current-layer").selectOption({ label: "Ground" });
  await page.getByTestId("room-panel-tiles").click();
  await page.getByTestId("autotile-set2").click();
  await page.getByRole("button", { name: "Fit" }).click();
  const at = await screenAt(page, 2 * 32 + 16, 2 * 32 + 16);
  await page.mouse.click(at.x, at.y); // one cell alone: the island piece, slot 0
  await playAndWait(page);
  expect(await py(page, "tile_at(2 * 32 + 1, 2 * 32 + 1)")).toBe(8); // "from tile 8": slot 0 is tile 8
});

test("a wider replacement picture keeps painted tiles on the same part of the picture", async ({ page }) => {
  await fromTemplate(page, "empty");
  await page.getByTestId("add-tilesets").click();
  await nameBox(page).press("Enter");
  const pick = async (width: number) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("tileset-image").click();
    await (await chooser).setFiles({ name: "t.png", mimeType: "image/png", buffer: await png(page, { width, height: 64, rects: [[0, 0, width, 64, "#888"]] }) });
  };
  await pick(64); // 2 × 2 tiles: column 0, row 1 is tile 2
  await addTileLayer(page);
  const pal = (await page.getByTestId("tile-palette").boundingBox())!; // drawn zoomed: aim by its size
  await page.getByTestId("tile-palette").click({ position: { x: 4, y: pal.height * 0.75 } });
  await expect(page.getByTestId("stamp-size")).toHaveText("Brush: 1 × 1 (tile 2)");
  const at = await screenAt(page, 16, 16);
  await page.mouse.click(at.x, at.y);
  await treeItem(page, "tileset1").click();
  await pick(96); // 3 × 2 tiles: column 0, row 1 is now tile 3
  await expect(page.getByTestId("tileset-count")).toContainText("3 × 2");
  await playAndWait(page);
  expect(await py(page, "tile_at(1, 1)")).toBe(3);
});

test("a tile changed while playing changes on screen", async ({ page }) => {
  await fromTemplate(page, "platformer");
  await playAndWait(page);
  await page.waitForTimeout(600);
  const before = Number(await page.getByTestId("tiles-drawn").textContent());
  await py(page, "tile_set(5 * 32, 12 * 32, None, 'Ground')"); // a grass tile in view
  await expect.poll(async () => Number(await page.getByTestId("tiles-drawn").textContent())).toBe(before - 1);
});

test("a brush flipped upside down paints a flipped tile, and an animated tile cycles its frames", async ({ page }) => {
  await fromTemplate(page, "empty");
  // Tile 0 green; tile 1 dark blue with a red corner at its top-left — so a flip shows.
  const picture: Paint = { width: 64, height: 32, rects: [[0, 0, 32, 32, "#4caf50"], [32, 0, 32, 32, "#123456"], [32, 0, 8, 8, "#ff0000"]] };
  await page.getByTestId("add-tilesets").click();
  await nameBox(page).press("Enter");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("tileset-image").click();
  await (await chooser).setFiles({ name: "tiles.png", mimeType: "image/png", buffer: await png(page, picture) });
  await expect(page.getByTestId("tileset-count")).toHaveText("2 × 1 = 2 tiles, 0 solid");
  // Tile 1 animates: 1, 0, 1, 0…
  await page.getByTestId("new-animation").click();
  await page.getByTestId("tileset-canvas").click({ position: { x: 150, y: 10 } }); // tile 1
  await page.getByTestId("tileset-canvas").click({ position: { x: 10, y: 10 } }); // tile 0
  await page.getByTestId("animation-0-frames").click(); // Done
  await expect(page.getByTestId("animation-0")).toContainText("Tiles 1, 0");

  await addTileLayer(page);
  const pal = (await page.getByTestId("tile-palette").boundingBox())!;
  await page.getByTestId("tile-palette").click({ position: { x: pal.width * 0.75, y: 4 } }); // tile 1
  await page.getByTestId("stamp-flip-y").click();
  await expect(page.getByTestId("stamp-size")).toHaveText("Brush: 1 × 1 (tile 1), flipped or turned");
  const at = await screenAt(page, 16, 16);
  await page.mouse.click(at.x, at.y);
  await playAndWait(page);
  expect(await py(page, "tile_at(1, 1)")).toBe(1); // tile_at says what the tile is, not how it's drawn

  const sample = () =>
    page.evaluate(async () => {
      const bmp = await createImageBitmap(await (window as any).__gameide.host.snapshot());
      const c = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!;
      c.drawImage(bmp, 0, 0);
      return [[...c.getImageData(4, 4, 1, 1).data.slice(0, 3)], [...c.getImageData(4, 28, 1, 1).data.slice(0, 3)]];
    });
  const red = (p: number[]) => p[0]! > 200 && p[1]! < 60 && p[2]! < 60;
  const green = (p: number[]) => p[1]! > 140 && p[0]! < 120;
  const seen = { redBottom: false, green: false, redTop: false };
  for (let i = 0; i < 14; i++) {
    const [top, bottom] = await sample();
    if (red(bottom!)) seen.redBottom = true; // tile 1, upside down: the red corner at the bottom
    if (green(bottom!)) seen.green = true; // tile 0's frame
    if (red(top!)) seen.redTop = true; // never: that would be tile 1 the right way up
    await page.waitForTimeout(110);
  }
  expect(seen).toEqual({ redBottom: true, green: true, redTop: false });
});
