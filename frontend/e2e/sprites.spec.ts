/**
 * Students' own pictures: dropped or chosen, cut into frames, given a mask
 * — and the masks then decide collisions in a running game.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, placeInRoom, playAndWait, py, SHOTS, treeItem, watchErrors } from "./helpers";

/** Rectangles to paint, then the picture as a PNG: [x, y, w, h, colour]. */
type Paint = { width: number; height: number; rects: [number, number, number, number, string][]; clear?: [number, number, number, number][] };

async function pngIn(page: Page, p: Paint): Promise<string> {
  return page.evaluate(async (p) => {
    const c = new OffscreenCanvas(p.width, p.height);
    const x = c.getContext("2d")!;
    for (const [rx, ry, w, h, col] of p.rects) (x.fillStyle = col), x.fillRect(rx, ry, w, h);
    for (const [rx, ry, w, h] of p.clear ?? []) x.clearRect(rx, ry, w, h);
    const bytes = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, p);
}

/** Drops a painted picture onto the editor, as dragging a file from the desktop does. */
async function drop(page: Page, name: string, p: Paint) {
  const b64 = await pngIn(page, p);
  await page.evaluate(
    ({ b64, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: "image/png" }));
      window.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, cancelable: true }));
      window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, cancelable: true }));
    },
    { b64, name },
  );
}

/** The sprite editor's canvas: [width, height, how many pixels aren't clear]. */
async function litPixels(page: Page): Promise<number[]> {
  // Once the frame shown has loaded: just after choosing a frame, the canvas still has the last one's pixels.
  await expect(page.getByTestId("sprite-pixels")).toHaveAttribute("data-loaded", "1");
  return page.getByTestId("sprite-pixels").evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext("2d")!.getImageData(0, 0, el.width, el.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return [el.width, el.height, n];
  });
}

/** The colour of pixels on the sprite editor's canvas, as [r, g, b, a]. */
async function canvasAt(page: Page, points: [number, number][]): Promise<number[][]> {
  await expect(page.getByTestId("sprite-pixels")).toHaveAttribute("data-loaded", "1");
  return page.getByTestId("sprite-pixels").evaluate((el: HTMLCanvasElement, pts) => {
    const x = el.getContext("2d")!;
    return pts.map(([px, py]) => [...x.getImageData(px, py, 1, 1).data]);
  }, points);
}

/** Drags across the sprite canvas from one sprite pixel to another, through the middles of pixels. */
async function stroke(page: Page, size: number, from: [number, number], to: [number, number]) {
  const b = (await page.getByTestId("sprite-canvas").boundingBox())!;
  const px = b.width / size;
  await page.mouse.move(b.x + (from[0] + 0.5) * px, b.y + (from[1] + 0.5) * px);
  await page.mouse.down();
  await page.mouse.move(b.x + (to[0] + 0.5) * px, b.y + (to[1] + 0.5) * px, { steps: 3 });
  await page.mouse.up();
}

/** Add a sprite → Draw your own, `size` square. */
async function drawNew(page: Page, size: number) {
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("draw-width").fill(String(size));
  await page.getByTestId("draw-height").fill(String(size));
  await page.getByTestId("draw-new").click();
  await expect(treeItem(page, "drawing")).toBeVisible();
  await expect(page.getByTestId("paint-pencil")).toHaveAttribute("aria-checked", "true");
}

const STRIP: Paint = {
  width: 64,
  height: 16,
  rects: ["#f00", "#0f0", "#00f", "#ff0"].map((c, i) => [i * 16 + 4, 2, 8, 12, c] as [number, number, number, number, string]),
};

test("a sprite sheet dropped on the editor becomes an animated sprite", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await drop(page, "hero_run.png", STRIP);
  await expect(page.getByTestId("slice-summary")).toHaveText("4 frames, 16 × 16");
  // Leave out frame 1 by clicking it on the sheet.
  const sheet = page.getByTestId("slice-sheet");
  const box = (await sheet.boundingBox())!;
  await sheet.click({ position: { x: box.width * (1.5 / 4), y: box.height / 2 } });
  await expect(page.getByTestId("slice-summary")).toHaveText("3 frames, 16 × 16");
  await page.getByTestId("import-done").click();

  await expect(treeItem(page, "hero_run")).toBeVisible();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(3);
  // The automatic mask is fitted to the drawn part, not the whole 16 × 16.
  await expect(page.getByText("Box: 4, 2 to 12, 14")).toBeVisible();
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("a grid with spacing is cut where the frames really are", async ({ page }) => {
  await fromTemplate(page, "empty");
  // Four 16 px frames in a 2 × 2 grid with 2 px between them.
  await drop(page, "grid.png", {
    width: 34,
    height: 34,
    rects: [[0, 0, 16, 16, "#f00"], [18, 0, 16, 16, "#0f0"], [0, 18, 16, 16, "#00f"], [18, 18, 16, 16, "#ff0"]],
  });
  await page.getByTestId("slice-grid").click();
  await page.getByLabel("Frame width").fill("16");
  await page.getByLabel("Frame height").fill("16");
  await page.getByLabel("Spacing x").fill("2");
  await page.getByLabel("Spacing y").fill("2");
  await expect(page.getByTestId("slice-summary")).toHaveText("4 frames, 16 × 16");
});

test("frames added to a sprite must be its size", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drop(page, "hero_run.png", STRIP);
  await page.getByTestId("import-done").click();
  await expect(treeItem(page, "hero_run")).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("add-frames").click();
  const big = Buffer.from(await pngIn(page, { width: 32, height: 32, rects: [[0, 0, 32, 32, "#fff"]] }), "base64");
  await (await chooser).setFiles({ name: "big.png", mimeType: "image/png", buffer: big });
  await expect(page.getByRole("dialog")).toContainText("hero_run's frames are 16 × 16; these are 32 × 32.");
  await expect(page.getByTestId("import-done")).toBeDisabled();
  await page.getByTestId("slice-strip").click();
  await page.getByTestId("strip-count").fill("2"); // two 16 × 32 frames: still wrong
  await expect(page.getByTestId("import-done")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();

  const chooser2 = page.waitForEvent("filechooser");
  await page.getByTestId("add-frames").click();
  const two = Buffer.from(await pngIn(page, { width: 32, height: 16, rects: [[0, 0, 32, 16, "#fff"]] }), "base64");
  await (await chooser2).setFiles({ name: "more.png", mimeType: "image/png", buffer: two });
  await page.getByTestId("import-done").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(6);
  // The new frames fill their whole 16 × 16, so the fitted mask grows to match.
  await expect(page.getByText("Box: 0, 0 to 16, 16")).toBeVisible();
});

test("a mask drawn by hand is the box dragged", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drop(page, "hero_run.png", STRIP);
  await page.getByTestId("import-done").click();
  await page.getByTestId("mask-kind").selectOption("rect");
  await page.getByRole("radio", { name: "Mask" }).click();
  const canvas = page.getByTestId("sprite-canvas");
  const b = (await canvas.boundingBox())!;
  const px = b.width / 16; // one sprite pixel on screen
  await page.mouse.move(b.x + 2 * px, b.y + 3 * px);
  await page.mouse.down();
  await page.mouse.move(b.x + 10 * px, b.y + 12 * px, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByLabel("left")).toHaveValue("2");
  await expect(page.getByLabel("bottom")).toHaveValue("12");
});

test("an exact-pixel mask: the hole in a ring is not part of it", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  // A 40 × 40 ring, 4 px thick.
  await drop(page, "ring.png", { width: 40, height: 40, rects: [[0, 0, 40, 40, "#fa0"]], clear: [[4, 4, 32, 32]] });
  await page.getByTestId("slice-whole").click();
  await page.getByLabel("Origin").selectOption("top-left");
  await page.getByTestId("import-done").click();
  await page.getByTestId("mask-kind").selectOption("precise");

  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ring");
  await page.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "ring" });
  await placeInRoom(page, "Room1 start", "Ring", 320, 224);

  await playAndWait(page);
  // In the hole, on the rim, and (for contrast) what a plain box would say.
  const hits = await py(page, `
r = instances("Ring")[0]
(collision_point(r.x + 20, r.y + 20, "Ring") is None, collision_point(r.x + 1, r.y + 20, "Ring") is r)`);
  expect(hits).toEqual([true, true]);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("the free art library: cells of a sheet become a sprite's frames, and a whole sheet a tileset", async ({ page }) => {
  await fromTemplate(page, "empty");
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await page.getByTestId("library-pixel-platformer").click();
  const sheet = page.getByTestId("sheet-canvas-Characters");
  // Drawn, not just there: measured before the picture arrived it was the
  // blank 300 × 150 canvas, and the clicks missed (failed under load).
  await expect(sheet).toHaveAttribute("data-ready", "1");
  const box = (await sheet.boundingBox())!;
  const cell = box.width / 9; // 9 characters across
  await sheet.click({ position: { x: cell / 2, y: cell / 2 } }); // the first
  await sheet.click({ position: { x: cell * 3.5, y: cell / 2 }, modifiers: ["Shift"] }); // and on to the fourth, as a run
  await expect(page.getByTestId("sheet-sprite-Characters")).toHaveText("Add as a sprite (4 frames)");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/library.png` });
  await page.getByTestId("sheet-sprite-Characters").click();
  await expect(treeItem(page, "pixel-platformer-characters-0")).toBeVisible();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(4);

  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await page.getByTestId("library-tiny-dungeon").click();
  await page.getByTestId("sheet-tileset-Tiles and characters").click();
  await expect(page.getByTestId("tileset-count")).toHaveText("12 × 11 = 132 tiles, 0 solid");
});

test("the free art library's Sports pack: the golf ball as a sprite, the pitch as a tileset", async ({ page }) => {
  await fromTemplate(page, "empty");
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await page.getByTestId("library-sports").click();
  const sheet = page.getByTestId("sheet-canvas-Balls and equipment");
  await expect(sheet).toHaveAttribute("data-ready", "1");
  const box = (await sheet.boundingBox())!;
  const cell = box.width / 8; // 8 across: the golf ball is the 11th, row 2 column 3
  await sheet.click({ position: { x: cell * 2.5, y: cell * 1.5 } });
  await expect(page.getByTestId("sheet-sprite-Balls and equipment")).toHaveText("Add as a sprite (1 frame)");
  await page.getByTestId("sheet-sprite-Balls and equipment").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(1);
  // The golf ball, 8 pixels across, in the middle of its 32-pixel cell: drawn there, and nothing round it.
  // Read once the picture has loaded onto the editor's canvas.
  let lit: number[] = [];
  await expect.poll(async () => (lit = await litPixels(page))[2]).toBeGreaterThan(0);
  expect(lit.slice(0, 2)).toEqual([32, 32]);
  expect(lit[2]).toBeGreaterThan(30);
  expect(lit[2]).toBeLessThan(80);

  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await page.getByTestId("library-sports").click();
  await page.getByTestId("sheet-tileset-Grass pitch").click();
  await expect(page.getByTestId("tileset-count")).toHaveText("13 × 16 = 208 tiles, 0 solid");
});

test("the free art library: every pack opens, with its preview, and every sheet in it is drawn", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  const packs = await page.locator('[data-testid^="library-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!));
  expect(packs.length).toBeGreaterThanOrEqual(16);
  for (const id of packs) {
    // Its preview is a real picture, not a broken one.
    const shown = await page.getByTestId(id).locator("img").evaluate(async (img: HTMLImageElement) => (await img.decode().then(() => true, () => false)) && img.naturalWidth > 0);
    expect(shown, `${id}'s preview`).toBe(true);
    await page.getByTestId(id).click();
    const sheets = page.locator('[data-testid^="sheet-canvas-"]');
    expect(await sheets.count(), id).toBeGreaterThan(0);
    for (const s of await sheets.all()) await expect(s, `${id}: ${await s.getAttribute("data-testid")}`).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
    // Gemini's packs ask for credit, in words a student can copy into their game; Kenney's don't need it.
    if (id.startsWith("library-gemini-")) await expect(page.getByTestId("library-credit"), id).toContainText("Art made with Google Gemini");
    else await expect(page.getByTestId("library-credit"), id).toHaveCount(0);
    await page.getByRole("button", { name: "← All packs" }).click();
  }
  expect(packs.filter((id) => id.startsWith("library-gemini-")).length).toBeGreaterThanOrEqual(8);
  expect(errors).toEqual([]);
});

test("the free art library: a Gemini character's frames become a sprite named for the pack", async ({ page }) => {
  await fromTemplate(page, "empty");
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await expect(page.getByTestId("library-gemini-climber")).toContainText("Made with Google Gemini");
  await page.getByTestId("library-gemini-climber").click();
  const sheet = page.getByTestId("sheet-canvas-Characters");
  await expect(sheet).toHaveAttribute("data-ready", "1");
  const box = (await sheet.boundingBox())!;
  const cell = box.width / 9; // nine 112-pixel cells across: a climber's six poses, then the next one's
  await sheet.click({ position: { x: cell / 2, y: cell / 2 } });
  await sheet.click({ position: { x: cell * 5.5, y: cell / 2 }, modifiers: ["Shift"] });
  await page.getByTestId("sheet-sprite-Characters").click();
  await expect(treeItem(page, "gemini-climber-characters-0")).toBeVisible();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(6);
});

test("a sprite drawn in the editor is the picture the game plays", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await drawNew(page, 16);
  // A line across the middle, drawn in three moves: every pixel between them is painted.
  await stroke(page, 16, [2, 8], [13, 8]);
  // Saved: the automatic mask is refitted to the line.
  await expect(page.getByText("Box: 2, 8 to 14, 9")).toBeVisible();
  expect((await litPixels(page))[2]).toBe(12);
  await page.getByTestId("mask-kind").selectOption("precise");

  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Bar");
  await page.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "drawing" });
  await placeInRoom(page, "Room1 start", "Bar", 320, 224);

  await playAndWait(page);
  // Exact-pixel masks are read from the picture as the game starts: the
  // line collides and the clear corner doesn't, so the game has the drawing.
  const hits = await py(page, `
b = instances("Bar")[0]
(collision_point(b.x - 3 + 0.5, b.y + 0.5, "Bar") is b, collision_point(b.x - 6 + 0.5, b.y - 6 + 0.5, "Bar") is None)`);
  expect(hits).toEqual([true, true]);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("drawing: undo takes back one stroke, fill stops at lines, and the eraser and picker work", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await drawNew(page, 8);
  // A wall down the middle, then a second stroke along the top.
  await stroke(page, 8, [4, 0], [4, 7]);
  await expect(page.getByText("Box: 4, 0 to 5, 8")).toBeVisible();
  await stroke(page, 8, [0, 0], [3, 0]);
  await expect(page.getByText("Box: 0, 0 to 5, 8")).toBeVisible();
  // One Undo is one stroke: the top line goes, the wall stays.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText("Box: 4, 0 to 5, 8")).toBeVisible();
  await expect.poll(async () => (await canvasAt(page, [[1, 0]]))[0]![3]).toBe(0);
  expect((await canvasAt(page, [[4, 3]]))[0]![3]).toBe(255);

  // Fill left of the wall in blue: the right of it stays clear.
  await page.getByTestId("paint-color").fill("#0000ff");
  await page.getByTestId("paint-fill").click();
  await stroke(page, 8, [1, 3], [1, 3]);
  await expect(page.getByText("Box: 0, 0 to 5, 8")).toBeVisible();
  const [left, right, wall] = await canvasAt(page, [[0, 7], [6, 3], [4, 3]]);
  expect(left).toEqual([0, 0, 255, 255]);
  expect(right![3]).toBe(0);
  // The picker takes the wall's colour (the red it was drawn in) and goes back to the pencil.
  await page.getByTestId("paint-picker").click();
  await stroke(page, 8, [4, 3], [4, 3]);
  await expect(page.getByTestId("paint-pencil")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("paint-color")).toHaveValue("#" + wall!.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join(""));
  // The eraser clears the wall's bottom pixel.
  await page.getByTestId("paint-eraser").click();
  await stroke(page, 8, [4, 7], [4, 7]);
  await expect.poll(async () => (await canvasAt(page, [[4, 7]]))[0]![3]).toBe(0);

  // Copy frame: a second frame, the same picture, ready to change.
  await page.getByTestId("copy-frame").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(2);
  await expect.poll(async () => (await canvasAt(page, [[0, 7]]))[0]).toEqual([0, 0, 255, 255]);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("drawing: lines and boxes, a selection moved and pasted, flips, every frame turned, onion skin and a strip", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await drawNew(page, 8);
  const lit = async () => (await litPixels(page))[2];
  const alpha = async (x: number, y: number) => (await canvasAt(page, [[x, y]]))[0]![3];

  // A line along the bottom, then a box's edge in the corner: one undo step each.
  await page.getByTestId("paint-line").click();
  await stroke(page, 8, [0, 7], [7, 7]);
  await expect(page.getByText("Box: 0, 7 to 8, 8")).toBeVisible();
  await page.getByTestId("paint-rect").click();
  await stroke(page, 8, [2, 2], [0, 0]);
  await expect(page.getByText("Box: 0, 0 to 8, 8")).toBeVisible();
  expect(await lit()).toBe(16);
  expect(await alpha(1, 1)).toBe(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText("Box: 0, 7 to 8, 8")).toBeVisible();
  // Filled this time.
  await page.getByTestId("paint-filled").check();
  await stroke(page, 8, [0, 0], [2, 2]);
  await expect(page.getByText("Box: 0, 0 to 8, 8")).toBeVisible();
  await expect.poll(lit).toBe(17);

  // Select the square, copy it, drag it four pixels right and put it down.
  await page.getByTestId("paint-select").click();
  await stroke(page, 8, [0, 0], [2, 2]);
  await expect(page.getByTestId("selection")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+c");
  await stroke(page, 8, [1, 1], [5, 1]);
  await page.keyboard.press("Enter");
  await expect.poll(() => alpha(0, 0)).toBe(0);
  expect(await alpha(4, 0)).toBe(255);
  expect(await lit()).toBe(17);
  // Paste: the copy comes back where it was copied from, ready to drag; Enter puts it down.
  await page.keyboard.press("ControlOrMeta+v");
  await page.keyboard.press("Enter");
  await expect.poll(lit).toBe(26);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("selection")).toHaveCount(0);

  // Nothing selected: Flip ↕ flips the whole frame, the line now along the top.
  await expect(page.getByTestId("paint-target")).toHaveText("Acts on this frame.");
  await page.getByTestId("paint-flipV").click();
  await expect.poll(() => alpha(3, 0)).toBe(255);
  expect(await alpha(3, 7)).toBe(0);

  // A second frame, then a quarter turn of every frame: the top row becomes the right column in both.
  await page.getByTestId("copy-frame").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(2);
  await page.getByTestId("paint-every-frame").check();
  await expect(page.getByTestId("paint-target")).toHaveText("Acts on every frame.");
  await page.getByTestId("paint-rotateCW").click();
  await expect.poll(() => alpha(7, 3)).toBe(255);
  expect(await alpha(3, 0)).toBe(0);
  // The last frame, faintly, under this one.
  await page.getByTestId("paint-onion").check();
  await expect(page.getByTestId("onion")).toBeVisible();
  await page.getByRole("button", { name: "Frame 0" }).click();
  await expect.poll(() => alpha(7, 3)).toBe(255);
  expect(await alpha(3, 0)).toBe(0);

  // The frames as one strip: two 8 × 8 frames side by side.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("save-strip").click()]);
  expect(download.suggestedFilename()).toBe("drawing_strip2.png");
  const png = await (await import("node:fs/promises")).readFile(await download.path());
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([16, 8]);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("a picture pasted while drawing goes into the drawing, not into a new sprite", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drawNew(page, 8);
  const b64 = await pngIn(page, { width: 2, height: 2, rects: [[0, 0, 2, 2, "#0f0"]] });
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "bit.png", { type: "image/png" }));
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, b64);
  await expect(page.getByTestId("selection")).toBeVisible();
  await expect(page.getByTestId("paint-select")).toHaveAttribute("aria-checked", "true");
  // Dragged one pixel over before it's put down.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Box: 1, 0 to 3, 2")).toBeVisible();
  expect((await litPixels(page))[2]).toBe(4);
  // No import dialog, no second sprite.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-tutorial="folder-sprites"]').getByRole("button", { name: /^drawing/ })).toHaveCount(1);
});

test("drawn frames animate when Play is pressed, with the pencil still chosen; a click stops on a frame", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drawNew(page, 8);
  await stroke(page, 8, [0, 0], [0, 0]);
  await page.getByTestId("new-frame").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(2);
  await stroke(page, 8, [7, 7], [7, 7]);
  await expect(page.getByTestId("paint-pencil")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("frames-play").click();
  // Both frames come round (8 a second), the canvas showing each.
  const seen = new Set<string>();
  await expect
    .poll(async () => {
      seen.add(await page.locator(".frame.on span").innerText());
      return seen.size;
    })
    .toBe(2);
  // A click on the picture stops the animation rather than drawing on a moving frame.
  const lit = (await litPixels(page))[2];
  const b = (await page.getByTestId("sprite-canvas").boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.getByTestId("frames-play")).toHaveText("Play");
  expect((await litPixels(page))[2]).toBe(lit);
});

test("a frame button pressed the moment a stroke ends keeps the stroke", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drawNew(page, 8);
  // Stroke and click in one go, from the page, so the click comes while the stroke is still saving.
  await page.getByTestId("sprite-canvas").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = (x: number) => ({ clientX: r.left + (x + 0.5) * (r.width / 8), clientY: r.top + 0.5 * (r.height / 8), bubbles: true, pointerId: 1, button: 0 });
    el.dispatchEvent(new PointerEvent("pointerdown", at(0)));
    el.dispatchEvent(new PointerEvent("pointermove", at(5)));
    el.dispatchEvent(new PointerEvent("pointerup", at(5)));
    (document.querySelector('[data-testid="copy-frame"]') as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(2);
  await page.getByRole("button", { name: "Frame 0" }).click();
  await expect(page.getByText("Box: 0, 0 to 6, 1")).toBeVisible();
  await expect.poll(async () => (await litPixels(page))[2]).toBe(6);
});

test("Find the pictures: drawings on a coloured sheet become frames standing on the bottom, sparks joined, a drag joins more", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  // A pink sheet, as a picture generator draws one: a tall pose and a short one
  // with a spark beside it on the first row, a squat one on the second.
  const pink = "#c13a94", green = "#20c840";
  await drop(page, "poses.png", {
    width: 60,
    height: 40,
    rects: [
      [0, 0, 60, 40, pink],
      [4, 4, 8, 12, green],
      [20, 6, 8, 8, green],
      [29, 8, 2, 2, green], // the spark, a pixel away: part of that pose
      [4, 28, 8, 6, green],
    ],
  });
  await page.getByTestId("slice-find").click();
  await expect(page.getByTestId("find-params")).toContainText("the corners' colour");
  // Every frame the biggest drawing's size: 11 across (pose and spark), 12 down.
  await expect(page.getByTestId("slice-summary")).toHaveText("3 frames, 11 × 12");

  const sheet = page.getByTestId("slice-sheet");
  const box = (await sheet.boundingBox())!;
  const k = box.width / 60;
  // Dragging across the first two makes them one drawing; Undo joins splits them again.
  await page.mouse.move(box.x + 6 * k, box.y + 10 * k);
  await page.mouse.down();
  await page.mouse.move(box.x + 24 * k, box.y + 10 * k, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("slice-summary")).toHaveText("2 frames, 27 × 12");
  await page.getByRole("button", { name: "Undo joins" }).click();
  await expect(page.getByTestId("slice-summary")).toHaveText("3 frames, 11 × 12");
  // A click leaves one out, and another puts it back.
  await sheet.click({ position: { x: 6 * k, y: 30 * k } });
  await expect(page.getByTestId("slice-summary")).toHaveText("2 frames, 11 × 12");
  await sheet.click({ position: { x: 6 * k, y: 30 * k } });
  await expect(page.getByTestId("slice-summary")).toHaveText("3 frames, 11 × 12");
  await expect(page.getByLabel("Origin")).toHaveValue("bottom-center");
  await page.getByTestId("import-done").click();

  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(3);
  // The squat pose, frame 2: in the middle across, standing on the bottom, and the pink gone.
  await page.getByRole("button", { name: "Frame 2" }).click();
  const [foot, head, side, corner] = await canvasAt(page, [[1, 11], [1, 5], [0, 11], [10, 0]]);
  expect(foot).toEqual([0x20, 0xc8, 0x40, 255]);
  expect(head![3]).toBe(0);
  expect(side![3]).toBe(0);
  expect(corner![3]).toBe(0);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});
