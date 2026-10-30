/**
 * The Art and Tiles lessons (public/tutorials/art-*.md), each done the way a
 * student does it: the lesson's picture downloaded from its link and
 * imported, a sprite sheet cut on a grid with spacing, a tileset cut 16 × 16
 * with its gaps and its solid tiles marked, an autotile set taken in order
 * and painted with, and a town painted in layers and walked. Every step's
 * checks are pressed and must pass, so a lesson can't ask for something its
 * own checks don't accept.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { placeInRoom, playAndWait, py, screenAt, setCode, SHOTS, treeItem } from "./helpers";

const ART = resolve("public/tutorials/art"); // tests run from frontend/

async function startLesson(page: Page, title: string) {
  await page.goto("/#/tutorials");
  // By its exact title: "A Tileset" is inside "2. Slicing a Tileset" too.
  await page.getByTestId("tutorial-card").filter({ has: page.getByText(title, { exact: true }) }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  await expect(page.getByTestId("tutorial-pane")).toBeVisible();
  const next = page.getByTestId("tutorial-next");
  const pass = async (lines: number, timeout = 60_000) => {
    await page.getByTestId("check-my-work").click();
    await expect(next, (await page.getByTestId("tutorial-pane").getByTestId("test-line").allInnerTexts().catch(() => [])).join(" | ")).toBeEnabled({ timeout });
    await expect(page.getByTestId("tutorial-pane").getByTestId("test-line").filter({ hasText: "✓" })).toHaveCount(lines);
  };
  return { next, pass };
}

/** The step's download link: it saves the file (not a tab to save it from), and the file is the lesson's picture. */
async function download(page: Page, file: string) {
  const link = page.getByTestId("tutorial-pane").getByRole("link", { name: file });
  await expect(link).toHaveAttribute("download", "");
  const got = page.waitForEvent("download");
  await link.click();
  const d = await got;
  expect(d.suggestedFilename()).toBe(file);
  expect(readFileSync((await d.path())!)).toEqual(readFileSync(resolve(ART, file)));
  return resolve(ART, file);
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await screenAt(page, from[0], from[1]), b = await screenAt(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

/** Tile n of a tileset shown on a canvas `columns` tiles across (each tile `size` plus `gap` in the picture). */
async function tileAt(page: Page, testId: string, n: number, columns: number, size: number, gap = 0) {
  const c = page.getByTestId(testId);
  const b = (await c.boundingBox())!;
  const pictureWidth = columns * size + (columns - 1) * gap;
  const k = b.width / pictureWidth;
  return { x: ((n % columns) * (size + gap) + size / 2) * k, y: (Math.floor(n / columns) * (size + gap) + size / 2) * k };
}

test("Your Own Sprite Sheet: the robot downloaded, cut on a grid with spacing, and walking", async ({ page }) => {
  test.setTimeout(180_000);
  const { next, pass } = await startLesson(page, "1. Your Own Sprite Sheet");
  await next.click();
  const file = await download(page, "robot-walk.png");
  await next.click();
  await page.getByTestId("add-sprites").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("import-picture").click();
  await (await chooser).setFiles(file);
  await page.getByTestId("slice-grid").click();
  const field = (label: string) => page.getByRole("dialog", { name: "Import a picture" }).getByLabel(label, { exact: true });
  await field("Frame width").fill("96");
  await field("Frame height").fill("128");
  await field("Spacing x").fill("2");
  await field("Spacing y").fill("2");
  await expect(page.getByTestId("slice-summary")).toHaveText("8 frames, 96 × 128");
  await page.getByTestId("import-name").fill("robot");
  await page.getByLabel("Origin").selectOption("bottom-center");
  await page.getByLabel("Frames per second").fill("10");
  await page.getByTestId("import-done").click();
  await expect(treeItem(page, "robot")).toBeVisible();
  // Cut where the lesson says, every frame is a whole robot: nothing of the next one creeps in at its right edge.
  const edges = await page.getByTestId("sprite-frames").locator("img").evaluateAll(async (imgs: HTMLImageElement[]) => {
    const out: number[] = [];
    for (const img of imgs) {
      await img.decode();
      const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const x = c.getContext("2d")!;
      x.drawImage(img, 0, 0);
      const d = x.getImageData(c.width - 1, 0, 1, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
      out.push(n);
    }
    return out;
  });
  expect(edges).toHaveLength(8);
  expect(edges.every((n) => n === 0)).toBe(true);
  await pass(2);
  await next.click();
  // A robot that walks.
  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Robot");
  await page.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "robot" });
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, [
    'move = keyboard_check("right") - keyboard_check("left")',
    "self.x += move * 3",
    "if move != 0:",
    "    self.image_xscale = move",
    "    self.image_speed = 1",
    "else:",
    "    self.image_speed = 0",
    "    self.image_index = 0",
    "",
  ].join("\n"));
  await placeInRoom(page, "Room1 start", "Robot", 320, 400);
  await pass(5);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("Slicing a Tileset: Kenney's town, cut 16 × 16 with 1 between, and its trees and water solid", async ({ page }) => {
  test.setTimeout(120_000);
  const { next, pass } = await startLesson(page, "2. Slicing a Tileset");
  await next.click();
  const file = await download(page, "town.png");
  await page.getByTestId("add-tilesets").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("town");
  await page.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("tileset-image").click();
  await (await chooser).setFiles(file);
  await expect(page.getByTestId("tileset-count")).toContainText("tiles");
  await pass(1);
  await next.click();
  // The lesson's numbers, and what it says the editor then shows.
  await page.getByTestId("tileset-tileWidth").fill("16");
  await page.getByTestId("tileset-tileHeight").fill("16");
  await page.getByTestId("tileset-spacingX").fill("1");
  await page.getByTestId("tileset-spacingY").fill("1");
  await expect(page.getByTestId("tileset-count")).toHaveText("57 × 31 = 1767 tiles, 0 solid");
  await pass(1);
  await next.click();
  // A round tree, a pine and a bush (583, 586, 533 in Kenney's sheet: row × 57 + column).
  for (const n of [583, 586, 533]) await page.getByTestId("tileset-canvas").click({ position: await tileAt(page, "tileset-canvas", n, 57, 16, 1) });
  await expect(page.getByTestId("tileset-count")).toHaveText("57 × 31 = 1767 tiles, 3 solid");
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("Autotiling: an autotile set taken in order, and paths painted that join up", async ({ page }) => {
  test.setTimeout(120_000);
  const { next, pass } = await startLesson(page, "3. Autotiling");
  await next.click();
  await treeItem(page, "garden").click();
  await next.click();
  await page.getByTestId("new-autotile").click();
  await page.getByLabel("Autotile set name").fill("path");
  await page.getByTestId("autotile-in-order").click();
  await pass(1);
  await next.click();
  // A Paths layer over the grass, and the path brush.
  await treeItem(page, "Room1 start").click();
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("room-panel-layers").click();
  await page.getByTestId("add-tile-layer").click();
  await page.getByRole("textbox", { name: "Layer name" }).fill("Paths");
  await page.getByTestId("room-panel-tiles").click();
  await page.getByTestId("autotile-path").click();
  await expect(page.getByTestId("stamp-size")).toHaveText("Brush: path (autotile)");
  const mid = (c: number, r: number): [number, number] => [c * 16 + 8, r * 16 + 8];
  await drag(page, mid(4, 10), mid(30, 10)); // across: 27 squares
  await drag(page, mid(17, 3), mid(17, 9)); // a path coming down to join it, a T
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/art-paths.png` });
  // One path, joined all along: the ends (2 joins right, 8 left), straights (10), the T where the
  // path down meets it (11: up 1 + right 2 + left 8), and the top of the path down (4: down only).
  // A fast drag once painted only where the pointer landed: a dotted line of islands (0).
  await playAndWait(page);
  const across = (await py(page, "[tile_at(c * 16 + 1, 10 * 16 + 1, 'Paths') for c in range(4, 31)]")) as number[];
  expect(across).toEqual([2, ...new Array(12).fill(10), 11, ...new Array(12).fill(10), 8]);
  expect(await py(page, "[tile_at(17 * 16 + 1, r * 16 + 1, 'Paths') for r in range(3, 10)]")).toEqual([4, 5, 5, 5, 5, 5, 5]);
  await page.getByTestId("stop").click();
  await pass(2);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("A Town from Tiles: grass, a road and a pond, trees on their own layer, solid, walked, and a camera", async ({ page }) => {
  test.setTimeout(240_000);
  const { next, pass } = await startLesson(page, "4. A Town from Tiles");
  await expect(treeItem(page, "town")).toBeVisible();
  await next.click();
  await treeItem(page, "Room1 start").click();
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("room-panel-layers").click();
  await page.getByTestId("add-tile-layer").click();
  await page.getByRole("textbox", { name: "Layer name" }).fill("Ground");
  await page.getByTestId("room-panel-tiles").click();
  const pick = async (n: number) => {
    await page.getByTestId("tile-palette").click({ position: await tileAt(page, "tile-palette", n, 57, 16, 1) });
    await expect(page.getByTestId("stamp-size")).toContainText(`(tile ${n})`);
  };
  await pick(5); // grass: the top row, sixth from the left
  await page.getByTestId("tool-rect").click();
  await drag(page, [4, 4], [636, 476]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/art-grass.png` });
  await pass(2);
  await next.click();
  await pick(6); // a road
  await drag(page, [4, 200], [636, 200]);
  await pick(0); // water
  await drag(page, [40, 40], [100, 80]);
  await next.click();
  await page.getByTestId("room-panel-layers").click();
  await page.getByTestId("add-tile-layer").click();
  await page.getByRole("textbox", { name: "Layer name" }).fill("Things");
  await page.getByTestId("room-panel-tiles").click();
  await page.getByTestId("tool-paint").click();
  // Ten things in ten different squares, clear of where the player stands (320, 240).
  const things = [[583, 40, 160], [586, 120, 160], [533, 200, 160], [583, 440, 160], [586, 520, 160],
                  [533, 600, 160], [583, 600, 440], [586, 40, 440], [533, 120, 440], [583, 280, 440]] as const;
  for (const [n, x, y] of things) {
    await pick(n);
    const p = await screenAt(page, x + 8, y + 8);
    await page.mouse.click(p.x, p.y);
  }
  await pass(2);
  await next.click();
  await treeItem(page, "Player").click();
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, [
    "speed = 2",
    'dx = (keyboard_check("right") - keyboard_check("left")) * speed',
    'dy = (keyboard_check("down") - keyboard_check("up")) * speed',
    "move_and_collide(dx, 0)",
    "move_and_collide(0, dy)",
    "",
  ].join("\n"));
  await treeItem(page, "town").click();
  for (const n of [583, 586, 533, 0]) await page.getByTestId("tileset-canvas").click({ position: await tileAt(page, "tileset-canvas", n, 57, 16, 1) });
  await expect(page.getByTestId("tileset-count")).toHaveText("57 × 31 = 1767 tiles, 4 solid");
  if (SHOTS) {
    await treeItem(page, "Room1 start").click();
    await page.screenshot({ path: `${SHOTS}/art-town.png` });
  }
  await pass(3);
  await next.click();
  // A bigger room, and a camera on the player.
  await treeItem(page, "Room1 start").click();
  await page.getByTestId("room-panel-room").click();
  await page.getByTestId("room-width").fill("1280");
  await page.getByTestId("room-height").fill("960");
  await page.getByTestId("camera-enabled").check();
  await page.getByTestId("camera-follow").selectOption({ label: "Player" });
  await pass(2);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});
