/**
 * Game feel, drawn: each effect is turned on in the coins game's Player and
 * the game's own picture is read back, pixel by pixel. The unit tests
 * (src/python/feel.test.ts) check that the engine is told; this checks the
 * renderer actually draws it — a shader that compiles to nothing, or a
 * filter that never gets attached, would pass those and fail here.
 *
 * The coins maze: the Player starts at (36, 36), 24 pixels square, in a room
 * 640 × 480 with a dark blue floor.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, setCode, SHOTS, treeItem } from "./helpers";

const STEP = `dx = (keyboard_check("right") - keyboard_check("left")) * self.move_speed
dy = (keyboard_check("down") - keyboard_check("up")) * self.move_speed
move_and_collide(dx, dy, "Wall")
`;

/** The game's picture, as [r, g, b] at each point. */
async function pixels(page: Page, points: [number, number][]): Promise<number[][]> {
  return page.evaluate(async (pts) => {
    const blob = await (window as any).__gameide.host.snapshot();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return pts.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]);
  }, points);
}

/** Every pixel in a box, for "is there any of this colour round it". */
async function area(page: Page, x: number, y: number, w: number, h: number) {
  const pts: [number, number][] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pts.push([x + i, y + j]);
  return pixels(page, pts);
}

/** Sets Player's Create (and Step) code, plays, and lets a few frames draw. */
async function playWith(page: Page, create: string, step = STEP) {
  const stop = page.getByTestId("stop");
  if (await stop.isEnabled()) await stop.click();
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, `self.move_speed = 4\n${create}`);
  await page.getByTestId("event-Step").click();
  await setCode(page, step);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(400);
}

const near = (a: number[], b: number[], tol = 40) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

test("game feel is drawn: flash, outline, tint, particles, lighting, a screen effect, dialogue", async ({ page }) => {
  test.setTimeout(240_000);
  await fromTemplate(page, "coins");

  // Before anything: the player, and the floor far from it.
  await playWith(page, "");
  const [plain] = await pixels(page, [[48, 48]]);

  await playWith(page, 'self.flash("red", 100000)');
  expect(near((await pixels(page, [[48, 48]]))[0]!, [255, 0, 0])).toBe(true);

  await playWith(page, 'self.outline = "magenta"');
  const ring = await area(page, 30, 30, 36, 36);
  expect(ring.some((p) => near(p, [255, 0, 255], 30))).toBe(true);

  await playWith(page, 'self.image_blend = "#0000ff"');
  const [tinted] = await pixels(page, [[48, 48]]);
  expect(tinted![0]!).toBeLessThan(25);
  expect(tinted![1]!).toBeLessThan(25);
  expect(tinted).not.toEqual(plain);

  await playWith(page, 'particles(320, 240, count=300, color="lime", speed=0.05, life=100000, size=8)');
  const [green] = await pixels(page, [[320, 240]]);
  expect(green![1]!).toBeGreaterThan(200);
  expect(green![0]!).toBeLessThan(100);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feel-particles.png` });

  await playWith(page, "lighting(1)", STEP + "light(self.x + 12, self.y + 12, 90)\n");
  // Polled: under a full parallel run the first frames with the light can
  // come after playWith's short wait, and a single read then saw black.
  await expect.poll(async () => (await pixels(page, [[48, 48]]))[0]!.reduce((a, b) => a + b), { timeout: 10_000 }).toBeGreaterThan(120);
  const [far] = await pixels(page, [[600, 420]]);
  expect(far).toEqual([0, 0, 0]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feel-lighting.png` });

  await playWith(page, 'self.flash("red", 100000)\nscreen_effect("grayscale")');
  const [gray] = await pixels(page, [[48, 48]]);
  expect(Math.max(...gray!) - Math.min(...gray!)).toBeLessThan(12);

  await playWith(page, 'say("Hello! This box is the dialogue.", name="Owl")');
  const [box] = await pixels(page, [[320, 462]]);
  expect(near(box!, [16, 20, 31], 30)).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feel-dialogue.png` });
});

test("touch controls hold the arrow keys, so a keyboard game plays by touch", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, "self.move_speed = 4\ntouch_controls(always=True)\n");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });
  const right = page.getByTestId("touch-right");
  await expect(right).toBeVisible();
  await expect(page.getByTestId("touch-space")).toBeVisible();
  const x0 = (await page.evaluate(() => (window as any).__gameide.host.evalPython("instances('Player')[0].x"))) as number;
  await right.dispatchEvent("pointerdown", { pointerId: 7, button: 0 });
  await expect.poll(() => page.evaluate(() => (window as any).__gameide.host.evalPython("instances('Player')[0].x")), { timeout: 10_000 }).toBeGreaterThan(x0 + 8);
  await right.dispatchEvent("pointerup", { pointerId: 7, button: 0 });
  await page.waitForTimeout(300);
  const x1 = await page.evaluate(() => (window as any).__gameide.host.evalPython("instances('Player')[0].x"));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__gameide.host.evalPython("instances('Player')[0].x"))).toBe(x1); // let go, it stops
  await page.evaluate(() => (window as any).__gameide.host.evalPython("touch_controls(False)"));
  await expect(page.getByTestId("touch-controls")).toHaveCount(0);
});

test("the debugger: click an instance to see inside it; freeze the game and step it", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, "self.move_speed = 4\nself.hp = 3\n");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });
  await page.getByLabel("Debug").check();
  const py = (code: string) => page.evaluate((c) => (window as any).__gameide.host.evalPython(c), code);
  // Where the Player is on the page: its room point, scaled like the canvas.
  const [px, py_] = (await py("[instances('Player')[0].x + 12, instances('Player')[0].y + 12]")) as [number, number];
  const canvas = page.locator(".game-box canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + (px * box.width) / 640, box.y + (py_ * box.height) / 480);
  await expect(page.getByTestId("inspector-object")).toHaveText("Player");
  await expect(page.getByTestId("inspector-vars")).toContainText("hp");
  await expect(page.getByTestId("inspector-vars")).toContainText("3");
  await py("instances('Player')[0].hp = 7");
  await expect(page.getByTestId("inspector-vars")).toContainText("7"); // kept up to date

  // Frozen, holding right moves nothing; each Step moves it once.
  await page.getByTestId("debug-freeze").click();
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  const x0 = await py("instances('Player')[0].x");
  await page.waitForTimeout(400);
  expect(await py("instances('Player')[0].x")).toBe(x0);
  await page.getByTestId("debug-step").click();
  await expect.poll(() => py("instances('Player')[0].x")).toBe((x0 as number) + 4);
  await page.keyboard.up("ArrowRight");
  await page.getByTestId("debug-freeze").click(); // go on
  await expect(page.getByTestId("debug-step")).toBeDisabled();
});
