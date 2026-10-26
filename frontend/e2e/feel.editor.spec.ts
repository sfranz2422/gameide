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
  const [lit, far] = await pixels(page, [[48, 48], [600, 420]]);
  expect(far).toEqual([0, 0, 0]);
  expect(lit!.reduce((a, b) => a + b)).toBeGreaterThan(120);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feel-lighting.png` });

  await playWith(page, 'self.flash("red", 100000)\nscreen_effect("grayscale")');
  const [gray] = await pixels(page, [[48, 48]]);
  expect(Math.max(...gray!) - Math.min(...gray!)).toBeLessThan(12);

  await playWith(page, 'say("Hello! This box is the dialogue.", name="Owl")');
  const [box] = await pixels(page, [[320, 462]]);
  expect(near(box!, [16, 20, 31], 30)).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/feel-dialogue.png` });
});
