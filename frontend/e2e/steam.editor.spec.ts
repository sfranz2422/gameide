/**
 * Export → Steam: the build kit. Its contents are always checked; whether
 * it really becomes a desktop app that plays is checked when asked, since
 * that installs Electron (~100 MB) and builds for real:
 *
 *     RUN_STEAM_KIT=1 npx playwright test steam          # npm install, then play it in Electron
 *     RUN_STEAM_KIT=1 RUN_STEAM_BUILD=1 npx playwright test steam   # …and npm run steam
 */
import { strFromU8, unzipSync } from "fflate";
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { fromTemplate } from "./helpers";

async function exportKit(page: Page) {
  await fromTemplate(page, "coins");
  await page.getByTestId("export").click();
  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByTestId("export-steam").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Collect-the-coins-steam-kit.zip");
  return unzipSync(new Uint8Array(readFileSync((await file.path())!)));
}

test("Export → Steam gives a build kit: the game, an Electron app, and a README", async ({ page }) => {
  const files = await exportKit(page);
  const names = Object.keys(files);
  expect(names).toEqual(expect.arrayContaining(["README.md", "main.js", "build.js", "game.json", "package.json", "web/index.html", "web/game/project.json", "web/pyodide/pyodide.asm.wasm"]));
  const pkg = JSON.parse(strFromU8(files["package.json"]!));
  // Pinned, so a kit builds the same way later.
  expect(pkg.devDependencies).toEqual({ electron: "44.7.0", "@electron/packager": "20.3.0" });
  expect(pkg.scripts).toEqual({ start: "electron .", steam: "node build.js" });
  const game = JSON.parse(strFromU8(files["game.json"]!));
  expect(game).toMatchObject({ name: "Collect the coins", fullscreen: true });
  const main = strFromU8(files["main.js"]!);
  // Served as app://, with the headers that let a stuck loop be stopped, and starting without a click.
  expect(main).toContain('"Cross-Origin-Embedder-Policy": "require-corp"');
  expect(main).toContain('win.loadURL("app://game/index.html?autostart")');
  expect(strFromU8(files["README.md"]!)).toContain("npm run steam");
});

test("the kit really becomes a desktop app that plays the game (when asked)", async ({ page }) => {
  test.skip(!process.env["RUN_STEAM_KIT"], "installs Electron: RUN_STEAM_KIT=1 to run");
  test.setTimeout(15 * 60_000);
  const files = await exportKit(page);
  const dir = mkdtempSync(join(tmpdir(), "gameide-steam-"));
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith("/")) continue;
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  execSync("npm install --no-audit --no-fund", { cwd: dir, stdio: "inherit" });
  // The kit's own Electron (its package's main export is the binary's path),
  // started with Chrome's debugging port and joined over it: Playwright's
  // own Electron launcher never finished connecting to Electron 44.
  const electronPath = createRequire(import.meta.url)(join(dir, "node_modules/electron")) as string;
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(electronPath, [dir, `--remote-debugging-port=${port}`], { stdio: "ignore" });
  try {
    let browser = null;
    for (let i = 0; i < 60 && !browser; i++) {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
      if (!browser) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(browser, "the desktop app opened").not.toBeNull();
    const findGame = () => browser!.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith("app://game/"));
    await expect.poll(() => !!findGame(), { timeout: 30_000 }).toBe(true);
    const win = findGame()!;
    // No Play button to press: it starts by itself, with no click.
    await expect.poll(() => win.evaluate(() => (window as any).__gameide?.host?.evalPython("global_vars.total")), { timeout: 60_000 }).toBe(15);
    expect(await win.evaluate(() => crossOriginIsolated)).toBe(true);
    expect(await win.title()).toBe("Collect the coins");
    await browser!.close();
  } finally {
    proc.kill();
  }

  if (process.env["RUN_STEAM_BUILD"]) {
    execSync("npm run steam", { cwd: dir, stdio: "inherit" });
    for (const folder of ["windows", "linux", ...(process.platform === "darwin" ? ["mac"] : [])]) expect(existsSync(join(dir, "steam", folder))).toBe(true);
    expect(existsSync(join(dir, "steam", "windows", "Collect the coins.exe"))).toBe(true);
    console.log(`Steam folders made in ${join(dir, "steam")}`);
  }
});
