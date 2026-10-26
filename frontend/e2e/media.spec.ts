/**
 * Sounds, gamepads, save files and fonts in the browser: the parts unit
 * tests can't reach — Web Audio on the page, a gamepad the page polls,
 * localStorage, and a font loaded in the game's worker.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { nameBox, placeInRoom, playAndWait, py, setCode, treeItem, watchErrors, fromTemplate } from "./helpers";

async function emptyGame(page: Page) {
  await fromTemplate(page, "empty");
}

async function add(page: Page, kind: string, name: string) {
  await page.getByTestId(`add-${kind}`).click();
  await nameBox(page).fill(name);
  await nameBox(page).press("Enter");
  await expect(treeItem(page, name)).toBeVisible();
}

async function objectWithCode(page: Page, name: string, event: string, code: string) {
  await add(page, "objects", name);
  await page.getByTestId("add-event").click();
  await page.getByTestId(`pick-${event}`).click();
  await setCode(page, code);
}

const host = (page: Page, expr: string) => page.evaluate((e) => new Function("host", `return ${e}`)((window as any).__gameide.host), expr);

test("a starter sound plays when the game says so", async ({ page }) => {
  const errors = watchErrors(page);
  await emptyGame(page);
  await add(page, "sounds", "ding");
  await page.getByTestId("starter-sound-coin").click();
  await expect(page.getByTestId("sound-info")).toContainText("WAV");
  await objectWithCode(page, "Bell", "create", 'sound_play("ding")\nself.was_playing = sound_playing("ding")\n');
  await placeInRoom(page, "Room1 start", "Bell", 50, 50);
  await playAndWait(page);
  expect(await py(page, "instances('Bell')[0].was_playing")).toBe(true);
  await expect.poll(() => host(page, "host.sound.log")).toContain("play ding");
  // Decoded and really started through Web Audio, not just asked for.
  expect(await host(page, "host.sound.started")).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("a sheet's sound_play starts with one of the game's own sounds", async ({ page }) => {
  await fromTemplate(page, "platformer");
  await add(page, "objects", "Bell");
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-create").click();
  await page.getByTestId("tab-sheet").click();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-sound_play").click();
  await expect(page.getByTestId("sheet-code").locator(".cm-content")).toHaveText('sound_play("coin")');
});

test("a file that isn't a sound is turned away, saying what is wanted", async ({ page }) => {
  await emptyGame(page);
  await add(page, "sounds", "song");
  const upload = async (name: string, buffer: Buffer) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("sound-file").click();
    await (await chooser).setFiles({ name, mimeType: "audio/mpeg", buffer });
  };
  // A real file of the wrong kind — a picture renamed .mp3 — first, so the
  // message can only have come from refusing it.
  await upload("photo.mp3", Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"));
  await expect(page.getByRole("alert")).toHaveText("That file isn't a sound (MP3, OGG or WAV).");
  await expect(page.getByTestId("sound-info")).toHaveCount(0);
  // And something that isn't any kind of file GameIDE knows.
  await page.reload();
  await treeItem(page, "song").click();
  await upload("song.mp3", Buffer.from("not really a song"));
  await expect(page.getByRole("alert")).toHaveText("That file isn't a sound (MP3, OGG or WAV).");
});

test("a gamepad moves the player", async ({ page }) => {
  // A pretend pad the test can press: navigator.getGamepads is all the page asks.
  await page.addInitScript(() => {
    const w = window as any;
    w.__pad = { connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [w.__pad, null, null, null];
  });
  await emptyGame(page);
  await objectWithCode(page, "Hero", "step", 'if gamepad_check("a"):\n    self.x += 4\nself.y += gamepad_axis("left_y") * 2\n');
  await placeInRoom(page, "Room1 start", "Hero", 100, 100);
  await playAndWait(page);
  const x0 = (await py(page, "instances('Hero')[0].x")) as number;
  await page.waitForTimeout(200);
  expect(await py(page, "instances('Hero')[0].x")).toBe(x0);
  await page.evaluate(() => {
    const w = window as any;
    w.__pad.buttons[0] = { pressed: true, value: 1 };
    w.__pad.axes[1] = 1;
  });
  await page.waitForTimeout(300);
  expect((await py(page, "instances('Hero')[0].x")) as number).toBeGreaterThan(x0 + 20);
  expect((await py(page, "instances('Hero')[0].y")) as number).toBeGreaterThan(110);
  expect(await py(page, "gamepad_connected(0)")).toBe(true);
});

test("save files keep values between plays, and can be cleared", async ({ page }) => {
  await emptyGame(page);
  await objectWithCode(page, "Counter", "create", 'save_set("plays", save_get("plays", 0) + 1)\n');
  await placeInRoom(page, "Room1 start", "Counter", 50, 50);
  await playAndWait(page);
  await expect.poll(() => py(page, 'save_get("plays")')).toBe(1);
  await page.getByTestId("stop").click();
  await playAndWait(page);
  expect(await py(page, 'save_get("plays")')).toBe(2);
  await page.getByTestId("stop").click();
  // And after a reload: it's in the browser, not the page.
  await page.reload();
  await page.getByRole("button", { name: "Game settings" }).click();
  await expect(page.getByTestId("saved-data")).toContainText("plays");
  page.on("dialog", (d) => void d.accept());
  await page.getByTestId("clear-save").click();
  await expect(page.getByTestId("saved-data")).toContainText("Nothing saved yet");
  await playAndWait(page);
  expect(await py(page, 'save_get("plays")')).toBe(1);
});

test("a font from the Fonts folder previews, and the game draws with it", async ({ page }) => {
  const errors = watchErrors(page);
  // Any real font will do: Playwright ships one (an icon font) with itself.
  const base = join(process.cwd(), "node_modules/playwright-core/lib");
  const ttf = (readdirSync(base, { recursive: true }) as string[]).find((f) => f.endsWith(".ttf"))!;
  await emptyGame(page);
  await add(page, "fonts", "icons");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("font-file").click();
  await (await chooser).setFiles(join(base, ttf));
  await expect(page.getByTestId("font-preview")).toHaveAttribute("data-ready", "yes");
  await objectWithCode(page, "Hud", "draw_gui", 'draw_set_font("icons", 24)\ndraw_text(10, 10, "hello")\n');
  await placeInRoom(page, "Room1 start", "Hud", 0, 0);
  const canvas = page.locator("canvas[data-testid=game-canvas]");
  const shot = async () => {
    await playAndWait(page);
    await page.waitForTimeout(400);
    const png = await canvas.screenshot();
    await page.getByTestId("stop").click();
    return png;
  };
  const withFont = await shot();
  await expect(page.getByTestId("console")).not.toContainText("couldn't be read");
  // The same text in the built-in font must look different — or the font
  // never reached the game's worker and the text quietly fell back.
  await treeItem(page, "Hud").click();
  await page.getByTestId("event-Draw GUI").click();
  await setCode(page, 'draw_set_font(None, 24)\ndraw_text(10, 10, "hello")\n');
  const builtIn = await shot();
  expect(withFont.equals(builtIn)).toBe(false);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});
