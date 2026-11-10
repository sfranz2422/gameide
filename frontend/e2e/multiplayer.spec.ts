/**
 * Multiplayer rooms against the real server (backend/multiplayer.py), with
 * real browsers: one student makes a room, another joins it by its code, each
 * sees the other's game state and hears their shouts, and a wrong code is
 * refused. (Rooms aren't tied to classes: anyone signed in may make or join one.) A player held for a Python check is away:
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

test("a room: made by one student, joined by another's code, a wrong code refused", async ({ browser }) => {
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

  // A wrong code is told so. (Rooms aren't tied to classes: anyone signed in may join one.)
  const ola = await signedIn(browser, "otis@example.com");
  await ola.page.goto(url);
  const wrong = CODE === "ZZZZ" ? "BBBB" : "ZZZZ";
  await ola.page.getByTestId("net-code").fill(wrong.toLowerCase());
  await ola.page.getByTestId("net-join").click({ timeout: 60_000 });
  await expect(ola.page.getByTestId("net-error")).toContainText(`no room ${wrong}`);

  // Noe joins by the code, and each sees the other.
  const noe = await signedIn(browser, "noel@example.com");
  await noe.page.goto(url);
  await noe.page.getByTestId("net-code").fill(CODE);
  await noe.page.getByTestId("net-join").click({ timeout: 60_000 });
  await noe.page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 30_000 });
  await expect(noe.page.getByTestId("net-here")).toHaveText("2 players", { timeout: 10_000 });
  // Both on WebSockets: the server keeps rooms in memory (one process, as on Render).
  expect(await mia.page.evaluate(() => (window as any).__gameide.net.via)).toBe("ws");
  expect(await noe.page.evaluate(() => (window as any).__gameide.net.via)).toBe("ws");
  // How long a word to the room takes, there and back: shown, so a slow room can be seen.
  await expect(noe.page.getByTestId("net-ping")).toHaveText(/^\d+ ms$/, { timeout: 10_000 });
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

// A school network may block WebSockets: that page polls instead, in the same room.
test("one player on a WebSocket and one polling still see each other, and hear each other's shouts", async ({ browser }) => {
  test.setTimeout(180_000);
  const teacher = await signedIn(browser, "teach5@example.com");
  await teacher.page.goto("/#/games");
  const zip = Buffer.from(zipSync({ "project.json": strToU8(JSON.stringify({ ...project, id: "mixzip", name: "Mixed" })), "assets/index.json": strToU8("{}") }));
  await teacher.page.getByTestId("import-file").setInputFiles({ name: "m.zip", mimeType: "application/zip", buffer: zip });
  await teacher.page.waitForURL(/#\/p\//, { timeout: 30_000 });
  await expect(teacher.page.getByTestId("save-status")).toHaveText("Saved", { timeout: 30_000 });
  await teacher.page.getByTestId("publish").click();
  await teacher.page.getByTestId("publish-title").fill("Mixed");
  await teacher.page.getByTestId("publish-unlisted").check();
  await teacher.page.getByTestId("publish-go").click();
  await expect(teacher.page.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/);
  const url = new URL(await teacher.page.getByTestId("publish-link").inputValue()).pathname;

  const ws = await signedIn(browser, "wendy@example.com");
  await ws.page.goto(url);
  await ws.page.getByTestId("net-create").click({ timeout: 60_000 });
  const code = (await ws.page.getByTestId("net-room-code").textContent({ timeout: 30_000 }))!;
  await ws.page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 30_000 });
  const poller = await signedIn(browser, "paulo@example.com");
  await poller.page.goto(url + "?nows");
  await poller.page.getByTestId("net-code").fill(code);
  await poller.page.getByTestId("net-join").click({ timeout: 60_000 });
  await poller.page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 30_000 });
  await expect.poll(() => ws.page.evaluate(() => (window as any).__gameide.net.via)).toBe("ws");
  expect(await poller.page.evaluate(() => (window as any).__gameide.net.via)).toBe("poll");
  await py(ws.page, "global_vars.x = 11");
  await py(poller.page, "global_vars.x = 22");
  await expect.poll(() => py(poller.page, "[(p.number, p.x) for p in net_players()]"), { timeout: 10_000 }).toEqual([[1, 11]]);
  await expect.poll(() => py(ws.page, "[(p.number, p.x) for p in net_players()]"), { timeout: 10_000 }).toEqual([[2, 22]]);
  await py(ws.page, 'net_shout("from the socket")');
  await py(poller.page, 'net_shout("from polling")');
  await expect.poll(() => py(poller.page, "getattr(global_vars, 'heard', [])"), { timeout: 10_000 }).toEqual(["from the socket"]);
  await expect.poll(() => py(ws.page, "getattr(global_vars, 'heard', [])"), { timeout: 10_000 }).toEqual(["from polling"]);
  // net_tell and net_host, both ways: the host is the room's maker, and a told message is private.
  await py(ws.page, 'net_tell(2, "for poller only")');
  await py(poller.page, 'net_tell(1, "for socket only")');
  await expect.poll(async () => JSON.stringify(await py(poller.page, "getattr(global_vars, 'heard', [])")), { timeout: 10_000 }).toContain("for poller only");
  await expect.poll(async () => JSON.stringify(await py(ws.page, "getattr(global_vars, 'heard', [])")), { timeout: 10_000 }).toContain("for socket only");
  expect(await py(ws.page, "net_host()")).toBe(1);
  await expect.poll(() => py(poller.page, "net_host()"), { timeout: 10_000 }).toBe(1);

  // The WebSocket drops (a server restart, a network blip): the page polls at once, then gets a
  // new WebSocket by itself, still in the room, without a reload.
  await ws.page.evaluate(() => {
    const net = (window as any).__gameide.net;
    net.retryMs = 300;
    net.ws.close();
  });
  await expect.poll(() => ws.page.evaluate(() => (window as any).__gameide.net.via), { timeout: 5000 }).toBe("poll");
  await expect.poll(() => ws.page.evaluate(() => (window as any).__gameide.net.via), { timeout: 10_000 }).toBe("ws");
  // …and stops polling: back on the WebSocket, no more syncs go.
  let syncs = 0;
  ws.page.on("request", (r) => r.url().includes("/api/net/sync") && syncs++);
  await ws.page.waitForTimeout(1500);
  expect(syncs).toBe(0);
  await py(poller.page, "global_vars.x = 33");
  await expect.poll(() => py(ws.page, "[(p.number, p.x) for p in net_players()]"), { timeout: 10_000 }).toEqual([[2, 33]]);
  await Promise.all([teacher.ctx, ws.ctx, poller.ctx].map((c) => c.close()));
});

// Undertow, built (python3 showcase/undertow/build.py), published and played by
// three at once through the real server: the host deals, each learns their role
// alone, the beacon calls a meeting, and the vote is counted. Skipped if unbuilt.
const UNDERTOW = new URL("../../showcase/undertow/out/Undertow.zip", import.meta.url).pathname;

test("Undertow in a room: roles dealt privately, a meeting at the beacon, a vote", async ({ browser }) => {
  test.skip(!existsSync(UNDERTOW), "Undertow isn't built here");
  test.setTimeout(400_000);
  const teacher = await signedIn(browser, "teach6@example.com");
  await teacher.page.goto("/#/games");
  await teacher.page.getByTestId("import-file").setInputFiles(UNDERTOW);
  await teacher.page.waitForURL(/#\/p\//, { timeout: 60_000 });
  await expect(teacher.page.getByTestId("save-status")).toHaveText("Saved", { timeout: 60_000 });
  await teacher.page.getByTestId("publish").click();
  await teacher.page.getByTestId("publish-title").fill("Undertow");
  await teacher.page.getByTestId("publish-unlisted").check();
  await teacher.page.getByTestId("publish-go").click();
  await expect(teacher.page.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/, { timeout: 60_000 });
  const url = new URL(await teacher.page.getByTestId("publish-link").inputValue()).pathname;
  // Its rooms hold 25 (only Undertow asks): the setting came through import, saving and publishing.
  const published = await teacher.page.request.get(`/api${url}`);
  expect(JSON.stringify(await published.json())).toContain('"netPlayers":25');

  const dive = async (page: Page) => {
    await page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 120_000 });
    await page.locator("canvas[data-testid=game-canvas]").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Space");
    await expect.poll(() => py(page, "room_name()"), { timeout: 30_000 }).toBe("Station");
  };
  const uma = await signedIn(browser, "uma@example.com");
  await uma.page.goto(url);
  await uma.page.getByTestId("net-create").click({ timeout: 60_000 });
  const code = (await uma.page.getByTestId("net-room-code").textContent({ timeout: 30_000 }))!;
  await dive(uma.page);
  const others: { ctx: import("@playwright/test").BrowserContext; page: Page }[] = [];
  for (const email of ["ivo@example.com", "kit@example.com"]) {
    const p = await signedIn(browser, email);
    await p.page.goto(url);
    await p.page.getByTestId("net-code").fill(code);
    await p.page.getByTestId("net-join").click({ timeout: 60_000 });
    await dive(p.page);
    others.push(p);
  }
  const pages = [uma.page, ...others.map((o) => o.page)];
  await expect.poll(() => py(uma.page, "len(net_players())"), { timeout: 30_000 }).toBe(2);

  // Uma's game is the host: Enter deals.
  await uma.page.keyboard.press("Enter");
  for (const p of pages) await expect.poll(() => py(p, "global_vars.role"), { timeout: 30_000 }).toMatch(/^(crew|mimic)$/);
  const roles = await Promise.all(pages.map((p) => py(p, "global_vars.role")));
  expect(roles.filter((r) => r === "mimic")).toHaveLength(1);
  if (process.env.UNDERTOW_SHOTS) {
    for (const [k, p] of pages.entries()) {
      await py(p, `global_vars.player.x += ${k * 30 - 30}`);
    }
    await uma.page.waitForTimeout(800);
    for (const [k, p] of pages.entries()) await p.locator("canvas[data-testid=game-canvas]").screenshot({ path: `${process.env.UNDERTOW_SHOTS}/play-${roles[k]}-${k + 1}.png` });
  }
  // Each knows only their own: the others' games hold no role for anyone else.
  expect(await py(others[0]!.page, "global_vars.mates")).toEqual([]);

  // Ivo goes to the beacon and calls a meeting; everyone's game shows it.
  await py(others[0]!.page, "global_vars.player.x, global_vars.player.y = tile_middle(*BEACON)");
  await expect.poll(() => py(others[0]!.page, "global_vars.near[0] if global_vars.near else None"), { timeout: 30_000 }).toBe("beacon");
  await others[0]!.page.keyboard.press("e");
  for (const p of pages) await expect.poll(() => py(p, "global_vars.g['ph']"), { timeout: 30_000 }).toBe("meeting");
  if (process.env.UNDERTOW_SHOTS) await uma.page.locator("canvas[data-testid=game-canvas]").screenshot({ path: `${process.env.UNDERTOW_SHOTS}/meeting.png` });
  // A phrase from Kit reaches Uma.
  await py(others[1]!.page, "say('who')");
  await expect.poll(() => py(uma.page, "global_vars.chat"), { timeout: 30_000 }).toEqual([[3, "Who did it?"]]);
  // All skip: nobody sent up.
  for (const p of pages) await py(p, "vote(0)");
  for (const p of pages) await expect.poll(() => py(p, "global_vars.g['ph']"), { timeout: 30_000 }).toBe("result");
  expect(await py(uma.page, "global_vars.g['ej']")).toBe(undefined);
  if (process.env.UNDERTOW_SHOTS) await uma.page.locator("canvas[data-testid=game-canvas]").screenshot({ path: `${process.env.UNDERTOW_SHOTS}/result.png` });
  await Promise.all([teacher.ctx, uma.ctx, ...others.map((o) => o.ctx)].map((c) => c.close()));
});

// Tabletop Siege, built (python3 showcase/siege/build.py), published and played one
// against one: both press "Find me a match", the server pairs them, each plays a
// card, and each sees the other's troops on the far side. Skipped if unbuilt.
const SIEGE = new URL("../../showcase/siege/out/Siege.zip", import.meta.url).pathname;

test("Tabletop Siege: Find me a match pairs two players, and each sees the other's cards", async ({ browser }) => {
  test.skip(!existsSync(SIEGE), "Tabletop Siege isn't built here");
  test.setTimeout(400_000);
  const teacher = await signedIn(browser, "teach5@example.com");
  await teacher.page.goto("/#/games");
  await teacher.page.getByTestId("import-file").setInputFiles(SIEGE);
  await teacher.page.waitForURL(/#\/p\//, { timeout: 60_000 });
  await expect(teacher.page.getByTestId("save-status")).toHaveText("Saved", { timeout: 60_000 });
  await teacher.page.getByTestId("publish").click();
  await teacher.page.getByTestId("publish-title").fill("Tabletop Siege");
  await teacher.page.getByTestId("publish-unlisted").check();
  await teacher.page.getByTestId("publish-go").click();
  await expect(teacher.page.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/, { timeout: 60_000 });
  const url = new URL(await teacher.page.getByTestId("publish-link").inputValue()).pathname;

  const players: { ctx: import("@playwright/test").BrowserContext; page: Page }[] = [];
  for (const email of ["siena@example.com", "tomas@example.com"]) {
    const p = await signedIn(browser, email);
    await p.page.goto(url);
    await p.page.getByTestId("net-match").click({ timeout: 120_000 });
    await p.page.waitForFunction(() => (window as any).__gameide.host.state === "running", null, { timeout: 120_000 });
    players.push(p);
  }
  const [one, two] = players.map((p) => p.page) as [Page, Page];
  // Paired into the same room.
  await expect(two.getByTestId("net-room-code")).toHaveText((await one.getByTestId("net-room-code").textContent())!);
  for (const p of [one, two]) await expect.poll(() => py(p, "room_name()"), { timeout: 30_000 }).toBe("Field");
  expect(await py(one, "runs_battle()")).toBe(true);
  expect(await py(two, "runs_battle()")).toBe(false);
  // Each plays a card on their own left: each then sees one of their own (blue, left) and one of theirs (red, right).
  await py(one, "global_vars.energy = [10, 10]");
  await expect.poll(() => py(two, "round(global_vars.energy[0])"), { timeout: 15_000 }).toBe(10);
  await py(one, "play(0, 200, 96)");
  await py(two, "play(0, 200, 200)");
  const deploys = (p: Page) => py(p, "sorted((d.side, round(d.x) < 320) for d in instances('Deploy'))");
  for (const p of [one, two]) await expect.poll(() => deploys(p), { timeout: 15_000 }).toEqual([[0, true], [1, false]]);
  if (process.env.SIEGE_SHOTS) {
    await one.waitForTimeout(3000);
    await one.locator("canvas[data-testid=game-canvas]").screenshot({ path: `${process.env.SIEGE_SHOTS}/duel-1.png` });
    await two.locator("canvas[data-testid=game-canvas]").screenshot({ path: `${process.env.SIEGE_SHOTS}/duel-2.png` });
  }
  await Promise.all([teacher.ctx, ...players.map((p) => p.ctx)].map((c) => c.close()));
});
