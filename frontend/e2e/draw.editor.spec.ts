/**
 * The Draw Your Own lessons (public/tutorials/draw-*.md), each done the way a
 * student does it: a sprite drawn with the mouse, animated with Copy frame,
 * a coin drawn with the circle tool and an enemy pasted and flipped from the
 * hero, and a Gemini sheet downloaded and cut with Find the pictures. Every
 * step's checks are pressed and must pass, so a lesson can't ask for
 * something its own checks don't accept.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { placeInRoom, setCode, treeItem } from "./helpers";
import { DRAW_ANIMATE, DRAW_MOVE } from "../src/store/templates";

const ART = resolve("public/tutorials/art"); // tests run from frontend/

async function startLesson(page: Page, title: string) {
  await page.goto("/#/tutorials");
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

/** Drags across the open sprite from one pixel to another (`size` pixels across). */
async function stroke(page: Page, size: number, from: [number, number], to: [number, number]) {
  const b = (await page.getByTestId("sprite-canvas").boundingBox())!;
  const px = b.width / size;
  await page.mouse.move(b.x + (from[0] + 0.5) * px, b.y + (from[1] + 0.5) * px);
  await page.mouse.down();
  await page.mouse.move(b.x + (to[0] + 0.5) * px, b.y + (to[1] + 0.5) * px, { steps: 4 });
  await page.mouse.up();
}

/** Add a sprite → Draw your own, named and sized as a lesson says. */
async function drawNew(page: Page, name: string, size: number) {
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("draw-name").fill(name);
  await page.getByTestId("draw-width").fill(String(size));
  await page.getByTestId("draw-height").fill(String(size));
  await page.getByTestId("draw-new").click();
  await expect(treeItem(page, name, "sprites")).toBeVisible();
  await expect(page.getByTestId("sprite-pixels")).toHaveAttribute("data-loaded", "1");
}

async function newObject(page: Page, name: string, sprite: string | null) {
  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
  if (sprite) await page.getByTestId("object-sprite").selectOption({ label: sprite });
}

async function collisionWith(page: Page, object: string, code: string) {
  await treeItem(page, "Hero", "objects").click();
  await page.getByTestId("add-event").click();
  await page.getByTestId("collision-target").selectOption({ label: object });
  await page.getByTestId("pick-collision").click();
  await setCode(page, code);
}

test("1. Draw a Sprite: drawn with the mouse, put in a game, walked with the arrow keys", async ({ page }) => {
  test.setTimeout(180_000);
  const { next, pass } = await startLesson(page, "1. Draw a Sprite");
  await next.click();
  await drawNew(page, "hero", 32);
  await pass(2);
  await next.click();
  // A body and a head; Fill and the right button too, as the step offers.
  await stroke(page, 32, [16, 4], [16, 28]);
  await page.getByTestId("paint-rect").click();
  await stroke(page, 32, [10, 12], [22, 22]);
  await page.getByTestId("paint-fill").click();
  await stroke(page, 32, [16, 18], [16, 18]);
  await pass(1);
  await next.click();
  await newObject(page, "Hero", "hero");
  await pass(2);
  await next.click();
  await placeInRoom(page, "Room1 start", "Hero", 320, 240);
  await pass(1);
  await next.click();
  await treeItem(page, "Hero", "objects").click();
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, DRAW_MOVE);
  await pass(3);
  await next.click();
  await treeItem(page, "hero", "sprites").click();
  await page.getByTestId("paint-pencil").click();
  await stroke(page, 32, [8, 2], [24, 2]); // a hat
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("2. Animate It: Copy frame, legs moved, and a hero that walks only while it moves", async ({ page }) => {
  test.setTimeout(180_000);
  const { next, pass } = await startLesson(page, "2. Animate It");
  await next.click();
  await treeItem(page, "hero", "sprites").click();
  await page.getByTestId("paint-pencil").click();
  await page.getByTestId("copy-frame").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(2);
  await page.getByTestId("paint-eraser").click();
  await stroke(page, 32, [11, 27], [20, 31]);
  await page.getByTestId("paint-pencil").click();
  await stroke(page, 32, [9, 26], [9, 30]);
  await stroke(page, 32, [22, 26], [22, 30]);
  await page.getByTestId("paint-onion").check();
  await expect(page.getByTestId("onion")).toBeVisible();
  await pass(2);
  await next.click();
  await page.getByTestId("frames-play").click();
  await expect(page.getByTestId("frames-play")).toHaveText("Pause");
  await next.click();
  await treeItem(page, "Hero", "objects").click();
  await page.getByTestId("event-Step").click();
  await setCode(page, DRAW_ANIMATE);
  await pass(4);
  await next.click();
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("3. Shapes and Flips: a circle coin collected, and an enemy pasted from the hero and flipped", async ({ page }) => {
  test.setTimeout(240_000);
  const { next, pass } = await startLesson(page, "3. Shapes and Flips");
  await next.click();
  await drawNew(page, "coin", 16);
  await page.getByTestId("paint-ellipse").click();
  await page.getByTestId("paint-filled").check();
  await stroke(page, 16, [0, 0], [15, 15]);
  await page.getByTestId("paint-filled").uncheck();
  await page.getByRole("button", { name: "#9c7a12" }).first().click(); // a darker yellow: back to the pencil, as a swatch does
  await page.getByTestId("paint-ellipse").click();
  await stroke(page, 16, [0, 0], [15, 15]);
  await pass(2);
  await next.click();
  await newObject(page, "Coin", "coin");
  for (const x of [120, 200, 280]) await placeInRoom(page, "Room1 start", "Coin", x, 120);
  await pass(3);
  await next.click();
  await collisionWith(page, "Coin", "other.destroy()\n");
  await pass(2);
  await next.click();
  // The enemy: the hero's frame taken, pasted into a new sprite, flipped, repainted.
  await treeItem(page, "hero", "sprites").click();
  await page.getByTestId("paint-select").click();
  await page.getByTestId("paint-copy").click();
  await drawNew(page, "enemy", 32);
  await page.getByTestId("paint-paste").click();
  await page.keyboard.press("Enter");
  await page.getByTestId("paint-flipH").click();
  await page.getByRole("button", { name: "#5cc23a" }).first().click();
  await page.getByTestId("paint-fill").click();
  await stroke(page, 32, [16, 18], [16, 18]);
  await pass(1);
  await next.click();
  await newObject(page, "Enemy", "enemy");
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, "self.x -= 2\nif self.x < -16:\n    self.x = room_width + 16\n");
  await placeInRoom(page, "Room1 start", "Enemy", 560, 240);
  await collisionWith(page, "Enemy", "room_restart()\n");
  await pass(6);
  await next.click();
  await pass(1);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});

test("4. Pictures from a Sheet: Gemini's climbers cut with Find the pictures, walked, and credited", async ({ page }) => {
  test.setTimeout(240_000);
  const { next, pass } = await startLesson(page, "4. Pictures from a Sheet");
  await next.click();
  // The step's link saves the lesson's sheet, made with Gemini, credited beside it.
  const link = page.getByTestId("tutorial-pane").getByRole("link", { name: "snow-climbers.jpg" });
  const got = page.waitForEvent("download");
  await link.click();
  const d = await got;
  expect(readFileSync((await d.path())!)).toEqual(readFileSync(resolve(ART, "snow-climbers.jpg")));
  expect(readFileSync(resolve(ART, "License-gemini.txt"), "utf8")).toContain("Art made with Google Gemini");
  await expect(page.getByTestId("tutorial-pane")).toContainText("made with Google Gemini");
  await next.click();
  await page.getByTestId("add-sprites").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("import-picture").click();
  await (await chooser).setFiles(resolve(ART, "snow-climbers.jpg"));
  await page.getByTestId("slice-find").click();
  await expect(page.getByTestId("find-params")).toBeVisible();
  await page.getByTestId("slice-none").click();
  await expect(page.getByTestId("slice-summary")).toContainText("0 frames");
  // The red climber's first three, on the 1376-wide sheet: standing, then running twice.
  const sheet = page.getByTestId("slice-sheet");
  const box = (await sheet.boundingBox())!;
  const k = box.width / 1376;
  for (const [x, y] of [[113, 115], [327, 115], [550, 115]] as const) await sheet.click({ position: { x: x * k, y: y * k } });
  await expect(page.getByTestId("slice-summary")).toContainText("3 frames");
  await page.getByTestId("import-name").fill("climber");
  await expect(page.getByLabel("Origin")).toHaveValue("bottom-center");
  await page.getByTestId("import-done").click();
  await expect(treeItem(page, "climber", "sprites")).toBeVisible();
  await pass(2);
  await next.click();
  await treeItem(page, "Hero", "objects").click();
  await page.getByTestId("object-sprite").selectOption({ label: "climber" });
  await pass(2);
  await next.click();
  await newObject(page, "Credits", null);
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-draw_gui").click();
  await setCode(page, 'draw_set_color("white")\ndraw_text(8, 456, "Art made with Google Gemini")\n');
  await placeInRoom(page, "Room1 start", "Credits", 20, 20);
  await pass(4);
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toContainText("finished ✓");
});
