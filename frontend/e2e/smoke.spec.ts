import { expect, test, type Page } from "@playwright/test";

/** Every console error and uncaught exception the page produces. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const py = (page: Page, code: string) =>
  page.evaluate((c) => (window as any).__gameide.session.evalPython(c), code);

test("the IDE loads, runs the coins demo, and the player moves and collects", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });

  const startX = (await py(page, "instances('Player')[0].x")) as number;
  await page.locator("canvas").click({ position: { x: 5, y: 5 } }); // focus, out of the way
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1200);
  await page.keyboard.up("ArrowRight");
  const endX = (await py(page, "instances('Player')[0].x")) as number;
  expect(endX).toBeGreaterThan(startX + 100);
  // The first coin is on the player's row, so walking right collects it.
  expect(await py(page, "global_vars.score")).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("console")).not.toContainText("Error");
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/coins.png` : undefined });

  // The debug overlay draws masks and figures without disturbing the game.
  await page.getByLabel("Debug overlay").check();
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/debug.png` : undefined });

  // Pyodide stays loaded, so a second Play starts fast (the spec asks
  // for about 2 seconds; headless Chromium is given a little more).
  await page.getByRole("button", { name: "Stop" }).click();
  const t0 = Date.now();
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible();
  const restartMs = Date.now() - t0;
  console.log(`second Play started in ${restartMs} ms`);
  expect(restartMs).toBeLessThan(3000);
  expect(errors).toEqual([]);
});

test("the stress test runs 300+ instances without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await page.getByLabel("Demo").selectOption("stress");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  expect((await py(page, "instance_number('Ball')")) as number).toBeGreaterThanOrEqual(300);
  const fps = Number(await page.getByTestId("fps").textContent());
  console.log(`stress test: ${fps} steps per second in headless Chromium`);
  // Headless Chromium draws with a software GPU, so this is a floor that
  // catches a broken loop, not the 60 fps target (see PROGRESS.md).
  expect(fps).toBeGreaterThan(20);
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/stress.png` : undefined });
  expect(errors).toEqual([]);
});
