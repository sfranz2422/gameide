/**
 * The room editor: placing by dragging from the tree and by painting,
 * selecting, moving, copying, layers, creation code, and the camera —
 * then playing the room to see the game agrees.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, nameBox, playAndWait, py, screenAt, setCode, treeItem, watchErrors } from "./helpers";

/** An object with a starter sprite, made through the editor. */
async function makeObject(page: Page, name: string, starter: string) {
  await page.getByTestId("add-sprites").click();
  await page.getByTestId(`starter-${starter}`).click();
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill(name);
  await nameBox(page).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: starter });
}

async function openRoom(page: Page) {
  await treeItem(page, "Room1 start").click();
  await page.getByRole("button", { name: "Fit" }).click();
}

const layerCount = (page: Page) => page.getByTestId("layer-list").locator("li").first().locator(".layer-name .muted");

test("an object dragged from the tree lands on the grid where it's dropped", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Wall", "wall");
  await openRoom(page);
  const at = await screenAt(page, 100, 70);
  const canvas = page.getByTestId("room-canvas");
  const b = (await canvas.boundingBox())!;
  await treeItem(page, "Wall").dragTo(canvas, { targetPosition: { x: at.x - b.x, y: at.y - b.y } });
  await expect(page.getByTestId("inst-x")).toHaveValue("96");
  await expect(page.getByTestId("inst-y")).toHaveValue("64");
  await playAndWait(page);
  expect(await py(page, "[(w.x, w.y) for w in instances('Wall')]")).toEqual([[96, 64]]);
});

test("painting a row with the Place tool, without stacking copies; right click erases", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Wall", "wall");
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  const from = await screenAt(page, 40, 40), to = await screenAt(page, 200, 40);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
  await page.getByTestId("room-panel-layers").click();
  await expect(layerCount(page)).toHaveText("6"); // cells at x = 32, 64 … 192
  // Painting over the same cells adds nothing.
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
  await expect(layerCount(page)).toHaveText("6");
  const one = await screenAt(page, 70, 40);
  await page.mouse.click(one.x, one.y, { button: "right" });
  await expect(layerCount(page)).toHaveText("5");
});

test("select with a box, move with the keys, copy, paste and delete", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Wall", "wall");
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  for (const x of [64, 96, 128]) {
    const p = await screenAt(page, x + 4, 68);
    await page.mouse.click(p.x, p.y);
  }
  await page.getByTestId("tool-select").click();
  const a = await screenAt(page, 50, 50), b = await screenAt(page, 170, 110);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("room-panel-instance")).toHaveText("3 selected");
  await page.keyboard.press("ArrowRight"); // one grid square
  await page.keyboard.press("ControlOrMeta+c");
  const there = await screenAt(page, 300, 300);
  await page.mouse.move(there.x, there.y);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.getByTestId("room-panel-instance")).toHaveText("3 selected");
  await playAndWait(page);
  expect(await py(page, "sorted((w.x, w.y) for w in instances('Wall'))")).toEqual([
    [96, 64], [128, 64], [160, 64], [288, 288], [320, 288], [352, 288],
  ]);
  await page.getByTestId("room-canvas").focus();
  await page.keyboard.press("Delete");
  await page.getByTestId("room-panel-layers").click();
  await expect(layerCount(page)).toHaveText("3");
});

test("a locked layer can't be clicked or painted on", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Wall", "wall");
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  const p = await screenAt(page, 68, 68);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId("room-panel-layers").click();
  await page.getByRole("button", { name: "Lock Instances" }).click();
  await page.mouse.click((await screenAt(page, 132, 68)).x, p.y); // try to paint
  await expect(layerCount(page)).toHaveText("1");
  await page.getByTestId("tool-select").click();
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("room-panel-instance")).toHaveText("Instance");
  await expect(page.getByTestId("instance-panel")).toHaveCount(0);
});

test("creation code runs for that one instance", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await makeObject(page, "Ball", "ball");
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  for (const x of [64, 192]) {
    const p = await screenAt(page, x, 64);
    await page.mouse.click(p.x, p.y);
  }
  await page.getByTestId("tool-select").click();
  // The ball's origin is its middle, so the place clicked is its centre.
  const second = await screenAt(page, 192, 64);
  await page.mouse.click(second.x, second.y);
  await setCode(page, "self.hspeed = 3\nself.label = 'fast'\n", "creation-code");
  await playAndWait(page);
  await page.waitForTimeout(300);
  const balls = (await py(page, "sorted((getattr(b, 'label', ''), b.hspeed) for b in instances('Ball'))")) as [string, number][];
  expect(balls).toEqual([["", 0], ["fast", 3]]);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("an error in creation code is found, and clicking it opens that instance's code", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Ball", "ball");
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  const p = await screenAt(page, 128, 96);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId("tool-select").click();
  await page.mouse.click(p.x, p.y);
  await setCode(page, "self.speed = 2\nself.speed += oops\n", "creation-code");
  await page.getByTestId("room-panel-room").click();
  await page.getByTestId("play").click();
  await expect(page.getByTestId("error-where")).toHaveText("Room1 → Ball at (128, 96), creation code line 2");
  await page.getByTestId("error-where").click();
  await expect(page.locator(".cm-error-line")).toHaveText("self.speed += oops");
});

test("a camera follows the player, sized as set, and scales by whole numbers", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Hero", "player");
  await openRoom(page);
  await page.getByTestId("tool-place").click();
  const p = await screenAt(page, 300, 200);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId("room-panel-room").click();
  await page.getByTestId("room-width").fill("2000");
  await page.getByTestId("camera-enabled").check();
  await page.getByTestId("camera-width").fill("200");
  await page.getByTestId("camera-height").fill("150");
  await page.getByTestId("camera-follow").selectOption({ label: "Hero" });
  await playAndWait(page);
  // Polled, not a fixed wait: on a busy computer the first steps come later.
  // The player's origin is its top-left, snapped to 288: centred, the view starts 100 to its left.
  await expect.poll(() => py(page, "(view_width, view_height, view_x)")).toEqual([200, 150, 288 - 100]);
  await py(page, "h = instances('Hero')[0]; h.x = 1500");
  await expect.poll(() => py(page, "view_x")).toBe(1500 - 100);
  // The 200 × 150 view grows by a whole number to fit the pane.
  const width = await page.getByTestId("game-canvas").evaluate((c) => parseFloat((c as HTMLElement).style.width));
  expect(width % 200).toBe(0);
  expect(width).toBeGreaterThanOrEqual(400);
});

test("a background layer with a picture draws behind the game, scrolling", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await makeObject(page, "Hero", "player");
  await openRoom(page);
  await page.getByTestId("room-panel-layers").click();
  await page.getByRole("button", { name: "Settings for Background" }).click();
  await page.getByTestId("bg-sprite").selectOption({ label: "player" });
  await page.getByLabel("Scroll x").fill("2");
  await playAndWait(page);
  await page.waitForTimeout(500);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

/** The game's own picture at some points, as [r, g, b]. */
async function gamePixels(page: Page, points: [number, number][]): Promise<number[][]> {
  return page.evaluate(async (pts) => {
    const blob = await (window as any).__gameide.host.snapshot();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return pts.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]);
  }, points);
}

test("a background repeated across only is one strip at its offset, and camera_zoom draws the room bigger", async ({ page }) => {
  await fromTemplate(page, "empty");
  await makeObject(page, "Hero", "player"); // only for its sprite: the room has no instances
  await openRoom(page);
  await page.getByTestId("room-panel-layers").click();
  await page.getByRole("button", { name: "Settings for Background" }).click();
  await page.getByTestId("bg-sprite").selectOption({ label: "player" });
  await page.getByLabel("Background fill").selectOption("tile_x");
  await page.getByTestId("bg-offset-y").fill("200");
  await playAndWait(page);
  const row = (y: number) => Array.from({ length: 160 }, (_, i) => [i * 4, y] as [number, number]);
  const room = [0x1e, 0x29, 0x3b]; // the room's own colour, behind everything
  const bare = (px: number[][]) => px.every((p) => p.every((v, i) => Math.abs(v - room[i]!) < 6));
  await expect.poll(async () => bare(await gamePixels(page, row(210))), { timeout: 10_000 }).toBe(false); // the strip
  expect(bare(await gamePixels(page, row(100)))).toBe(true); // nothing above it…
  expect(bare(await gamePixels(page, row(300)))).toBe(true); // …or below: it doesn't repeat down
  // Zoomed 2× about the middle (the view is 320 × 240 at 160, 120): room y 200 is now screen y 160.
  await py(page, "camera_zoom(2)");
  await expect.poll(async () => bare(await gamePixels(page, row(170))), { timeout: 10_000 }).toBe(false);
  expect(bare(await gamePixels(page, row(100)))).toBe(true);
});

test("a room can remember how it was left, and says what that means", async ({ page }) => {
  await fromTemplate(page, "empty");
  await openRoom(page);
  await page.getByTestId("room-panel-room").click();
  await expect(page.getByText("Each visit starts the room afresh")).toBeVisible();
  await page.getByTestId("room-persistent").check();
  await expect(page.getByText("everything is where it was")).toBeVisible();
  // That it reaches the game is codegen.test.ts's; what the game does with it, rooms12.test.ts's.
});
