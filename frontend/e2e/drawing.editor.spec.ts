/**
 * Phase 12a's drawing, drawn: shapes, a scaled and tinted sprite, a
 * gradient and centred text, read back from the game's own picture. The
 * unit tests (src/python/drawing.test.ts) check the renderer is told; this
 * checks it draws — a shape the renderer quietly skipped would pass those.
 *
 * The coins game's Hud has a Draw GUI event; it is replaced with the drawing.
 * The view is 640 × 480 and GUI drawing is in its pixels.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, setCode, SHOTS, treeItem } from "./helpers";

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

const near = (a: number[], b: number[], tol = 40) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);

test("shapes, draw_sprite_ext, gradients and centred text are drawn", async ({ page }) => {
  test.setTimeout(120_000);
  await fromTemplate(page, "coins");
  await treeItem(page, "Hud").click();
  await page.getByTestId("event-Draw GUI").click();
  await setCode(page, `draw_set_color("black")
draw_rect(0, 0, 640, 480)
draw_set_color("red")
draw_circle(100, 100, 20)
draw_set_color("lime")
draw_line(200, 50, 300, 50, 6)
draw_set_color("blue")
draw_triangle(400, 100, 460, 100, 430, 150)
draw_set_color("yellow")
draw_ellipse(500, 300, 600, 340)
draw_rect_gradient(0, 300, 200, 320, "black", "white", False)
draw_sprite_ext("coin", 0, 300, 200, 4, 4, 0, "red")
draw_set_color("white")
draw_set_halign("center")
draw_text(320, 420, "WWWWWWWW")
`);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => near((await pixels(page, [[100, 100]]))[0]!, [255, 0, 0]), { timeout: 10_000 }).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/drawing.png` });

  const [circle, line, tri, ellipse, gradLeft, gradRight, outside] = await pixels(page, [
    [100, 100], [250, 50], [430, 115], [550, 320], [8, 310], [192, 310], [150, 150],
  ]);
  expect(near(circle!, [255, 0, 0])).toBe(true);
  expect(near(line!, [0, 255, 0])).toBe(true);
  expect(near(tri!, [0, 0, 255])).toBe(true);
  expect(near(ellipse!, [255, 255, 0])).toBe(true);
  expect(gradLeft!.reduce((a, b) => a + b)).toBeLessThan(120);
  expect(gradRight!.reduce((a, b) => a + b)).toBeGreaterThan(600);
  expect(outside).toEqual([0, 0, 0]);

  // The coin, four times its size and tinted red: somewhere in where it now covers is red, none of it yellow.
  // Sampled every 8 px over 80 × 80 round it: at its own size the coin would cover a handful of samples.
  const coin = await pixels(page, Array.from({ length: 100 }, (_, i) => [260 + (i % 10) * 8, 160 + Math.floor(i / 10) * 8] as [number, number]));
  expect(coin.filter((p) => p[0]! > 120 && p[1]! < 40 && p[2]! < 40).length).toBeGreaterThan(15);
  expect(coin.some((p) => p[0]! > 150 && p[1]! > 150 && p[2]! < 80)).toBe(false);

  // Centred on x = 320: there is white on both sides of it (left-aligned, all of it would be right of 320).
  const row = await pixels(page, Array.from({ length: 120 }, (_, i) => [260 + i, 428] as [number, number]));
  const white = (p: number[]) => p.every((v) => v > 200);
  expect(row.slice(0, 50).some(white)).toBe(true);
  expect(row.slice(70).some(white)).toBe(true);
});
