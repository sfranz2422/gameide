/**
 * The Building Levels lessons (public/tutorials/lv-*.md), each done the way
 * a student does it, in the editor on its own: art from the library, a
 * tileset and its solid tiles, painting two tile layers, a player who
 * stands on them, and a wider room with a camera. Every step's checks are
 * pressed and must pass — so a lesson can't tell a student to do something
 * its own checks don't accept, and each starter (store/templates.ts,
 * levelsStart) really opens with the lessons before it done.
 */
import { expect, test, type Page } from "@playwright/test";
import { screenAt, setCode, SHOTS, treeItem } from "./helpers";

const TILE = 18;
const STEP_CODE = [
  'move = keyboard_check("right") - keyboard_check("left")',
  "move_and_collide(move * 3, 0)",
  "",
  "self.vy = min(self.vy + 0.5, 10)",
  "on_ground = not place_free(self.x, self.y + 1)",
  'if on_ground and keyboard_check_pressed("space"):',
  "    self.vy = -9",
  "if move_and_collide(0, self.vy):",
  "    self.vy = 0",
  "",
].join("\n");

async function startLesson(page: Page, title: string) {
  await page.goto("/#/tutorials");
  await page.getByTestId("tutorial-card").filter({ hasText: title }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  await expect(page.getByTestId("tutorial-pane")).toBeVisible();
  const next = page.getByTestId("tutorial-next");
  const check = page.getByTestId("check-my-work");
  /** Check my work: every line passes, and Next opens. */
  const pass = async (lines: number, timeout = 60_000) => {
    await check.click();
    await expect(next).toBeEnabled({ timeout });
    await expect(page.getByTestId("tutorial-pane").getByTestId("test-line").filter({ hasText: "✓" })).toHaveCount(lines);
  };
  const spot = (target: string) => expect(page.getByTestId("spotlight")).toHaveAttribute("data-target", target);
  return { next, check, pass, spot };
}

/** Renames a resource as a student does: a double-click on it in the tree. */
async function rename(page: Page, from: string, to: string) {
  await treeItem(page, from).dblclick();
  const box = page.getByRole("textbox", { name: "Name", exact: true });
  await box.fill(to);
  await box.press("Enter");
  await expect(treeItem(page, to)).toBeVisible();
}

/** A cell of a canvas showing a sheet `columns` wide, whatever size it's drawn at. */
async function cell(page: Page, testId: string, n: number, columns: number, size: number) {
  const c = page.getByTestId(testId);
  const b = (await c.boundingBox())!;
  const k = b.width / (columns * size);
  return { x: ((n % columns) + 0.5) * size * k, y: (Math.floor(n / columns) + 0.5) * size * k };
}

/** Drags in the room from one room point to another. */
async function drag(page: Page, from: [number, number], to: [number, number], button: "left" | "right" = "left") {
  const a = await screenAt(page, from[0], from[1]), b = await screenAt(page, to[0], to[1]);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down({ button });
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up({ button });
}

/** Picks tile n in the room's Tiles palette (the Pixel Platformer tiles: 20 across). */
async function pickTile(page: Page, n: number) {
  await page.getByTestId("tile-palette").click({ position: await cell(page, "tile-palette", n, 20, TILE) });
  await expect(page.getByTestId("stamp-size")).toContainText(`(tile ${n})`);
}

const rowY = (row: number) => row * TILE + TILE / 2;

async function openRoom(page: Page) {
  await treeItem(page, "Room1 start").click();
  await page.getByRole("button", { name: "Fit" }).click();
}

test("Art from the Library: a two-frame hero from Kenney's characters", async ({ page }) => {
  test.setTimeout(120_000);
  const { next, pass, spot } = await startLesson(page, "Art from the Library");
  await next.click();
  // Pick a character: open the library, and the green astronaut and the one beside it.
  await spot("add-sprites");
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await page.getByTestId("library-pixel-platformer").click();
  const sheet = page.getByTestId("sheet-canvas-Characters");
  await expect(sheet).toHaveAttribute("data-ready", "1");
  await sheet.click({ position: await cell(page, "sheet-canvas-Characters", 0, 9, 24) });
  await sheet.click({ position: await cell(page, "sheet-canvas-Characters", 1, 9, 24), modifiers: ["Shift"] });
  await expect(page.getByTestId("sheet-sprite-Characters")).toHaveText("Add as a sprite (2 frames)");
  await page.getByTestId("sheet-sprite-Characters").click();
  await next.click();
  // Name it hero.
  await rename(page, "pixel-platformer-characters-0", "hero");
  await pass(2);
  await next.click();
  // A Player wearing it.
  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Player");
  await page.keyboard.press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "hero" });
  await pass(2);
  await next.click();
  // Into the room.
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  await page.getByTestId("place-object").selectOption({ label: "Player" });
  const at = await screenAt(page, 96, 352);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("tool-select").click();
  await pass(1);
  await next.click();
  // Play it.
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("A Tileset: the whole Tiles sheet, named ground, its grass and dirt solid", async ({ page }) => {
  test.setTimeout(120_000);
  const { next, pass, spot } = await startLesson(page, "A Tileset");
  await expect(treeItem(page, "hero")).toBeVisible(); // lesson 1, done
  await next.click();
  // Add the sheet.
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("open-library").click();
  await page.getByTestId("library-pixel-platformer").click();
  await page.getByTestId("sheet-tileset-Tiles").click();
  await expect(page.getByTestId("tileset-count")).toHaveText("20 × 9 = 180 tiles, 0 solid");
  await next.click();
  // Name it ground.
  await rename(page, "pixel-platformer-tiles", "ground");
  await pass(1);
  await next.click();
  // How it's cut: what the lesson says is what the editor shows.
  await expect(page.getByTestId("tileset-count")).toHaveText("20 × 9 = 180 tiles, 0 solid");
  await next.click();
  // Solid tiles: the four grass blocks and the four plain dirt squares.
  await spot("tileset-solid");
  for (const n of [0, 1, 2, 3, 4, 5, 24, 25]) {
    await page.getByTestId("tileset-canvas").click({ position: await cell(page, "tileset-canvas", n, 20, TILE) });
  }
  await expect(page.getByTestId("tileset-count")).toHaveText("20 × 9 = 180 tiles, 8 solid");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/levels-tileset.png` });
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("Painting a Room: a Ground layer with a floor and a platform, and a Decor layer", async ({ page }) => {
  test.setTimeout(120_000);
  const { next, pass, spot } = await startLesson(page, "Painting a Room");
  await expect(treeItem(page, "ground")).toBeVisible(); // lessons 1 and 2, done
  await next.click();
  // A tile layer.
  await spot("folder-rooms");
  await openRoom(page);
  await page.getByTestId("room-panel-layers").click();
  await page.getByTestId("add-tile-layer").click();
  await expect(page.getByTestId("current-layer").locator("option:checked")).toHaveText(/^Ground/);
  await pass(1);
  await next.click();
  // Pick a tile: the middle grass.
  await page.getByTestId("room-panel-tiles").click();
  await pickTile(page, 2);
  await next.click();
  // Paint the ground: grass two rows up from the bottom, dirt under it (the room is 480 tall: 26 rows).
  await page.getByTestId("tool-rect").click();
  await drag(page, [4, rowY(24)], [636, rowY(24)]);
  await pickTile(page, 4);
  await drag(page, [4, rowY(25)], [636, rowY(25)]);
  await pass(1);
  await next.click();
  // A platform.
  await pickTile(page, 2);
  await drag(page, [12 * TILE + 4, rowY(19)], [16 * TILE + 4, rowY(19)]);
  await pass(1);
  await next.click();
  // Scenery on its own layer.
  await spot("room-tab-layers");
  await page.getByTestId("room-panel-layers").click();
  await page.getByTestId("add-tile-layer").click();
  // Its settings are open already, as the lesson says.
  await page.getByRole("textbox", { name: "Layer name" }).fill("Decor");
  await page.getByTestId("room-panel-tiles").click();
  await pickTile(page, 124);
  await page.getByTestId("tool-paint").click();
  for (const c of [3, 8, 22]) {
    const p = await screenAt(page, c * TILE + 9, rowY(23));
    await page.mouse.click(p.x, p.y);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/levels-painted.png` });
  await pass(1);
  await next.click();
  // Play it.
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("Walking on Tiles: gravity, landing on the painted ground, running and jumping", async ({ page }) => {
  test.setTimeout(240_000);
  const { next, pass } = await startLesson(page, "Walking on Tiles");
  await next.click();
  // Falling: it lands on the grass, and stays landed.
  await treeItem(page, "Player").click();
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-create").click();
  await setCode(page, "self.vy = 0\n");
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, "self.vy = min(self.vy + 0.5, 10)\nif move_and_collide(0, self.vy):\n    self.vy = 0\n");
  await page.getByTestId("notes-tab").click();
  await pass(3, 90_000);
  await next.click();
  // Running.
  await setCode(page, 'move = keyboard_check("right") - keyboard_check("left")\nmove_and_collide(move * 3, 0)\n\nself.vy = min(self.vy + 0.5, 10)\nif move_and_collide(0, self.vy):\n    self.vy = 0\n');
  await pass(2, 90_000);
  await next.click();
  // Jumping: the code the lesson ends with.
  await setCode(page, STEP_CODE);
  await pass(3, 90_000);
  await next.click();
  // Try your level.
  await pass(1, 90_000);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("A Bigger World: a wider room, more ground, a gap that restarts, a camera that follows", async ({ page }) => {
  test.setTimeout(240_000);
  const { next, pass, spot } = await startLesson(page, "A Bigger World");
  await next.click();
  // A wider room.
  await spot("folder-rooms");
  await openRoom(page);
  await page.getByTestId("room-panel-room").click();
  await page.getByTestId("room-width").fill("1920");
  await pass(1);
  await next.click();
  // More ground, across the new part.
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("current-layer").selectOption({ label: "Ground" });
  await page.getByTestId("room-panel-tiles").click();
  await page.getByTestId("tool-rect").click();
  await pickTile(page, 2);
  await drag(page, [644, rowY(24)], [1916, rowY(24)]);
  await pickTile(page, 4);
  await drag(page, [644, rowY(25)], [1916, rowY(25)]);
  await pass(1);
  await next.click();
  // A gap, and the code that brings the hero back.
  await drag(page, [50 * TILE + 4, rowY(24)], [53 * TILE + 4, rowY(24)], "right");
  await drag(page, [50 * TILE + 4, rowY(25)], [53 * TILE + 4, rowY(25)], "right");
  await treeItem(page, "Player").click();
  await page.getByRole("button", { name: /^Step/ }).first().click();
  await setCode(page, STEP_CODE + "if self.y > room_height:\n    room_restart()\n");
  await pass(1);
  await next.click();
  // The camera.
  await spot("folder-rooms");
  await openRoom(page);
  await page.getByTestId("room-panel-room").click();
  await page.getByTestId("camera-enabled").check();
  await page.getByTestId("camera-follow").selectOption({ label: "Player" });
  await pass(1);
  await next.click();
  // Play it.
  await pass(2, 90_000);
  if (SHOTS) {
    await page.getByTestId("play").click();
    await page.getByTestId("game-canvas").click();
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(2500);
    await page.keyboard.up("ArrowRight");
    await page.screenshot({ path: `${SHOTS}/levels-camera.png` });
    await page.getByTestId("stop").click();
  }
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});
