/**
 * Exporting and publishing. The HTML5 export is served from somewhere that
 * isn't GameIDE — a made-up site, under a folder, as itch.io does — and
 * must play there with nothing but its own files.
 */
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fromTemplate, watchErrors } from "./helpers";

const TYPES: Record<string, string> = {
  html: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  wasm: "application/wasm",
  zip: "application/zip",
  png: "image/png",
  wav: "audio/wav",
};

test("an HTML5 export plays from another site, in a folder of its own", async ({ page, context }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "coins");
  await page.getByTestId("export").click();
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-html5").click();
  const file = await (await download).path();
  const files = unzipSync(new Uint8Array(readFileSync(file)));
  expect(Object.keys(files)).toEqual(expect.arrayContaining(["index.html", "favicon.svg", "README.txt", "game/project.json", "game/index.json", "pyodide/pyodide.asm.wasm"]));

  // Served at http://elsewhere.test/my-games/coins/, from the zip alone.
  await context.route("http://elsewhere.test/**", (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/my-games\/coins\//, ""));
    const name = path || "index.html";
    const body = files[name];
    if (!body) return route.fulfill({ status: 404, body: "not in the zip" });
    return route.fulfill({ status: 200, body: Buffer.from(body), contentType: TYPES[name.split(".").pop()!] ?? "application/octet-stream" });
  });
  const game = await context.newPage();
  const gameErrors = watchErrors(game);
  // The game's own files (its pictures, its sound) are asked for, and all are there.
  const fetched: [string, number][] = [];
  game.on("response", (r) => r.url().includes("/game/assets/") && fetched.push([r.url(), r.status()]));
  await game.goto("http://elsewhere.test/my-games/coins/");
  await game.getByTestId("player-start").click({ timeout: 60_000 });
  await expect(game.locator("canvas[data-testid=game-canvas]")).toBeVisible();
  await expect
    .poll(() => game.evaluate(() => (window as any).__gameide.host.evalPython("global_vars.total")), { timeout: 30_000 })
    .toBe(15);
  // ?autostart (as the Steam app opens it): playing with no click at all.
  const auto = await context.newPage();
  await auto.goto("http://elsewhere.test/my-games/coins/?autostart");
  await expect
    .poll(() => auto.evaluate(() => (window as any).__gameide?.host?.evalPython("global_vars.total")), { timeout: 30_000 })
    .toBe(15);
  await expect(auto.getByTestId("player-start")).toHaveCount(0);
  expect(fetched.length).toBeGreaterThan(3);
  expect(fetched.filter(([, status]) => status !== 200)).toEqual([]);
  expect(gameErrors).toEqual([]);
  expect(errors).toEqual([]);
});
