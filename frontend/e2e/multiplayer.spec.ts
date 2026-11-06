/**
 * Multiplayer rooms against the real server (backend/multiplayer.py), with
 * real browsers: one student makes a room, a classmate joins it by its code,
 * each sees the other's game state and hears their shouts — and a student in
 * another class can't get in. A player held for a Python check is away:
 * hidden from the others, and deaf to them until let go.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { existsSync } from "node:fs";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

const py = (page: Page, code: string) => page.evaluate((c) => (window as any).__gameide.host.evalPython(c), code);

// The whole game: sends where it is, and keeps what it hears.
const STEP = `net_send({"x": global_vars.x if hasattr(global_vars, "x") else 0})
for m in net_messages():
    global_vars.heard = getattr(global_vars, "heard", []) + [m.data]
`;
const project = {
  format: "gameide-project", schemaVersion: 8, id: "netzip", name: "Room game", created: "2026-01-01T00:00:00Z", modified: "2026-01-01T00:00:00Z",
  settings: { stepsPerSecond: 60 }, sprites: [], tilesets: [], scripts: [], sounds: [], fonts: [],
  objects: [{ id: "o1", name: "Player", sprite: null, visible: true, solid: false, persistent: false, depth: 0, parent: null,
    events: [{ id: "e1", key: { type: "step" }, mode: "python", code: STEP }] }],
  rooms: [{ id: "r1", name: "Room1", width: 320, height: 180, background: "#223344", gridWidth: 16, gridHeight: 16, snap: true,
    layers: [{ id: "L", name: "Instances", kind: "instances", depth: 0, visible: true, locked: false }],
    camera: { enabled: false, width: 320, height: 180, follow: null, smoothing: 1 },
    instances: [{ id: "i1", object: "o1", layer: "L", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" }] }],
};

test("a room: made by one student, joined by a classmate's code, closed to other classes", async ({ browser }) => {
  test.setTimeout(180_000);
  const teacher = await signedIn(browser, "teach5@example.com");
  const make = async (name: string, emails: string) => {
    const r = await teacher.page.request.post("/api/classes", { data: { name } });
    const id = (await r.json()).id as number;
    await teacher.page.request.post(`/api/classes/${id}/students`, { data: { emails } });
  };
  await make("Climbers", "mira@example.com, noel@example.com");
  await make("Other period", "otis@example.com");

  await teacher.page.goto("/#/games");
  const zip = Buffer.from(zipSync({ "project.json": strToU8(JSON.stringify(project)), "assets/index.json": strToU8("{}") }));
  await teacher.page.getByTestId("import-file").setInputFiles({ name: "n.zip", mimeType: "application/zip", buffer: zip });
  await teacher.page.waitForURL(/#\/p\//, { timeout: 30_000 });
  await expect(teacher.page.getByTestId("save-status")).toHaveText("Saved", { timeout: 30_000 });
  await teacher.page.getByTestId("publish").click();
  await teacher.page.getByTestId("publish-title").fill("Room game");
  await teacher.page.getByTestId("publish-unlisted").check();
  await teacher.page.getByTestId("publish-go").click();
  await expect(teacher.page.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/);
  const url = new URL(await teacher.page.getByTestId("publish-link").inputValue()).pathname;

  // Mia makes the room: the game starts, and the bar says its code.
  const mia = await signedIn(browser, "mira@example.com");
  await mia.page.goto(url);
  await expect(mia.page.getByTestId("player-start")).toHaveCount(0);
  await mia.page.getByTestId("net-create").click({ timeout: 60_000 });
  const code = mia.page.getByTestId("net-room-code");
  await expect(code).toHaveText(/^[A-Z]{4}$/, { timeout: 30_000 });
  const CODE = (await code.textContent())!;
  await mia.page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 30_000 });
  expect(await py(mia.page, "[net_room(), net_me().number]")).toEqual([CODE, 1]);

  // Ola, in another class, is told there's no such room.
  const ola = await signedIn(browser, "otis@example.com");
  await ola.page.goto(url);
  await ola.page.getByTestId("net-code").fill(CODE.toLowerCase());
  await ola.page.getByTestId("net-join").click({ timeout: 60_000 });
  await expect(ola.page.getByTestId("net-error")).toContainText(`no room ${CODE} for your class`);

  // Noe joins by the code, and each sees the other.
  const noe = await signedIn(browser, "noel@example.com");
  await noe.page.goto(url);
  await noe.page.getByTestId("net-code").fill(CODE);
  await noe.page.getByTestId("net-join").click({ timeout: 60_000 });
  await noe.page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 30_000 });
  await expect(noe.page.getByTestId("net-here")).toHaveText("2 players", { timeout: 10_000 });
  await py(mia.page, "global_vars.x = 42");
  await expect.poll(() => py(noe.page, "[(p.number, p.name, p.x) for p in net_players()]"), { timeout: 10_000 }).toEqual([[1, "Mira", 42]]);
  await expect.poll(() => py(mia.page, "[(p.number, p.name) for p in net_players()]"), { timeout: 10_000 }).toEqual([[2, "Noel"]]);

  // A shout arrives, once.
  await py(mia.page, 'net_shout({"snowball": [3, 4]})');
  await expect.poll(() => py(noe.page, "getattr(global_vars, 'heard', [])"), { timeout: 10_000 }).toEqual([{ snowball: [3, 4] }]);

  // Held for a question: gone from Mia's game, and her shouts meanwhile never reach Noe.
  await noe.page.evaluate(() => (window as any).__gameide.host.holdForQuestion(true));
  await expect.poll(() => py(mia.page, "len(net_players())"), { timeout: 10_000 }).toBe(0);
  await py(mia.page, 'net_shout("while you were out")');
  await mia.page.waitForTimeout(1500);
  await noe.page.evaluate(() => (window as any).__gameide.host.holdForQuestion(false));
  await expect.poll(() => py(mia.page, "len(net_players())"), { timeout: 10_000 }).toBe(1);
  await py(mia.page, 'net_shout("welcome back")');
  await expect.poll(() => py(noe.page, "global_vars.heard"), { timeout: 10_000 }).toEqual([{ snowball: [3, 4] }, "welcome back"]);

  // Closing the tab is leaving.
  await noe.page.close();
  await expect.poll(() => py(mia.page, "len(net_players())"), { timeout: 5_000 }).toBe(0);
  await expect(mia.page.getByTestId("net-here")).toHaveText("1 player");
  await Promise.all([teacher.ctx, mia.ctx, ola.ctx, noe.ctx].map((c) => c.close()));
});

test("a game with no net_ calls just has its Play button", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "solo@example.com");
  const solo = { ...project, id: "solozip", objects: [{ ...project.objects[0]!, events: [{ id: "e1", key: { type: "step" }, mode: "python", code: "pass\n" }] }] };
  await page.goto("/#/games");
  const zip = Buffer.from(zipSync({ "project.json": strToU8(JSON.stringify(solo)), "assets/index.json": strToU8("{}") }));
  await page.getByTestId("import-file").setInputFiles({ name: "s.zip", mimeType: "application/zip", buffer: zip });
  await page.waitForURL(/#\/p\//, { timeout: 30_000 });
  await expect(page.getByTestId("save-status")).toHaveText("Saved", { timeout: 30_000 });
  await page.getByTestId("publish").click();
  await page.getByTestId("publish-title").fill("Solo");
  await page.getByTestId("publish-unlisted").check();
  await page.getByTestId("publish-go").click();
  await expect(page.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/);
  await page.goto(new URL(await page.getByTestId("publish-link").inputValue()).pathname);
  await expect(page.getByTestId("player-start")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("net-lobby")).toHaveCount(0);
  await ctx.close();
});

// Snowcap Scramble itself, built (python3 showcase/climber/build.py), published and
// climbed by two classmates at once. Skipped if it hasn't been built here.
const CLIMBER = new URL("../../showcase/climber/out/Climber.zip", import.meta.url).pathname;

test("Snowcap Scramble in a room: each sees the other, a snowball knocks, a question hides", async ({ browser }) => {
  test.skip(!existsSync(CLIMBER), "Snowcap Scramble isn't built here");
  test.setTimeout(240_000);
  const teacher = await signedIn(browser, "teach6@example.com");
  const r = await teacher.page.request.post("/api/classes", { data: { name: "Climbing club" } });
  await teacher.page.request.post(`/api/classes/${(await r.json()).id}/students`, { data: { emails: "rosa@example.com, sami@example.com" } });
  await teacher.page.goto("/#/games");
  await teacher.page.getByTestId("import-file").setInputFiles(CLIMBER);
  await teacher.page.waitForURL(/#\/p\//, { timeout: 60_000 });
  await expect(teacher.page.getByTestId("save-status")).toHaveText("Saved", { timeout: 60_000 });
  await teacher.page.getByTestId("publish").click();
  await teacher.page.getByTestId("publish-title").fill("Snowcap Scramble");
  await teacher.page.getByTestId("publish-unlisted").check();
  await teacher.page.getByTestId("publish-go").click();
  await expect(teacher.page.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/, { timeout: 60_000 });
  const url = new URL(await teacher.page.getByTestId("publish-link").inputValue()).pathname;

  const climb = async (page: Page) => {
    await page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 60_000 });
    await page.locator("canvas[data-testid=game-canvas]").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Space");
    await expect.poll(() => py(page, "room_name()"), { timeout: 15_000 }).toBe("Mountain");
  };
  const rosa = await signedIn(browser, "rosa@example.com");
  await rosa.page.goto(url);
  await rosa.page.getByTestId("net-create").click({ timeout: 60_000 });
  const code = (await rosa.page.getByTestId("net-room-code").textContent({ timeout: 30_000 }))!;
  await climb(rosa.page);
  const sami = await signedIn(browser, "sami@example.com");
  await sami.page.goto(url);
  await sami.page.getByTestId("net-code").fill(code);
  await sami.page.getByTestId("net-join").click({ timeout: 60_000 });
  await climb(sami.page);

  // Each has the other as a numbered ghost.
  expect(await py(rosa.page, "global_vars.player.number")).toBe(1);
  expect(await py(sami.page, "global_vars.player.number")).toBe(2);
  await expect.poll(() => py(rosa.page, "[g.number for g in instances('Ghost')]"), { timeout: 15_000 }).toEqual([2]);
  await expect.poll(() => py(sami.page, "[g.number for g in instances('Ghost')]"), { timeout: 15_000 }).toEqual([1]);

  // Sami steps a little to the right of Rosa; Rosa clicks on his ghost to throw at him.
  await py(sami.page, "global_vars.player.x += 90");
  await expect.poll(() => py(rosa.page, "round(instances('Ghost')[0].x - global_vars.player.x)"), { timeout: 15_000 }).toBe(90);
  const [gx, gy, vx, vy] = (await py(rosa.page, "g = instances('Ghost')[0]\n(g.x, g.y, view_x, view_y)")) as number[];
  const canvas = rosa.page.locator("canvas[data-testid=game-canvas]");
  const box = (await canvas.boundingBox())!;
  await rosa.page.mouse.click(box.x + ((gx! - vx!) / 640) * box.width, box.y + ((gy! - 30 - vy!) / 360) * box.height);
  await expect.poll(() => py(sami.page, "global_vars.player.dizzy > 0"), { timeout: 15_000 }).toBe(true);

  // Held for a Python check question: gone from Rosa's game until he's back.
  await sami.page.evaluate(() => (window as any).__gameide.host.holdForQuestion(true));
  await expect.poll(() => py(rosa.page, "instance_number('Ghost')"), { timeout: 15_000 }).toBe(0);
  await sami.page.evaluate(() => (window as any).__gameide.host.holdForQuestion(false));
  await expect.poll(() => py(rosa.page, "instance_number('Ghost')"), { timeout: 15_000 }).toBe(1);
  await Promise.all([teacher.ctx, rosa.ctx, sami.ctx].map((c) => c.close()));
});
