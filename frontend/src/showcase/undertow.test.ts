/**
 * The thirteenth showcase game, Undertow (a hidden-impostor game on a deep-sea
 * station), played headless in the real Pyodide. Runs when the game has been
 * built (python3 showcase/undertow/build.py, which needs only the repo).
 * Phase 2: the station with one player, its lamp and its jobs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";
import type { NetJoined, NetMessageIn, NetOut, NetPlayerState } from "../engine/game";

const BUILT = resolve(__dirname, "../../../showcase/undertow/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}, net?: NetJoined) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const oks: boolean[] = [];
  const sent: NetOut[] = [];
  const { game, error } = await PythonGame.load({ ...def, save, ...(net ? { net } : {}) } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    questionOk: (ok) => oks.push(ok),
    net: (o) => sent.push(o),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { saved: () => saved, oks, sent });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
const key = (g: PythonGame, name: string, down: boolean) => (down ? g.engine.input.keyDown(KEY_CODE.get(name)!) : g.engine.input.keyUp(KEY_CODE.get(name)!));
function tap(g: PythonGame, name: string, times = 1) {
  for (let i = 0; i < times; i++) {
    key(g, name, true);
    step(g);
    key(g, name, false);
    step(g);
  }
}
async function onStation(suit?: string) {
  const g = await start(suit ? { suit } : {});
  tap(g, "space");
  step(g, 2);
  expect(py(g, "room_name()")).toBe("Station");
  return g;
}
const pos = (g: PythonGame) => py(g, "(global_vars.player.x, global_vars.player.y)") as unknown as [number, number];
/** Stands the player at a tile (its middle) and lets the camera arrive. */
function standAt(g: PythonGame, c: number, r: number) {
  py(g, `global_vars.player.x, global_vars.player.y = tile_middle(${c}, ${r})`);
  step(g, 2);
}
/** Walks up to station `i` of STATIONS, gives it to the player as a job, and opens it with E. */
function openJob(g: PythonGame, i: number) {
  py(g, `global_vars.jobs = sorted(set(global_vars.jobs) | {${i}})\ns = [o for o in instances('Station') if o.i == ${i}][0]\nglobal_vars.player.x, global_vars.player.y = s.x, s.y + 20`);
  step(g, 2);
  expect(py(g, "global_vars.near[1].i if global_vars.near else None")).toBe(i);
  tap(g, "e");
  expect(py(g, "global_vars.job is not None")).toBe(true);
}
const stationOf = (g: PythonGame, kind: string) => py(g, `[i for i, s in enumerate(STATIONS) if s[0] == '${kind}'][0]`) as unknown as number;
const isDone = (g: PythonGame, i: number) => py(g, `${i} in global_vars.done and global_vars.job is None`) as unknown as boolean;

/** Wires with the keys: for each wire, Up/Down to it, Enter, Up/Down to its socket, Enter. */
function solveWires(g: PythonGame, wrongFirst = false) {
  const [left, right] = py(g, "j = global_vars.job\n(j.left, j.right)") as unknown as [number[], number[]];
  const goTo = (row: number) => {
    const at = py(g, "global_vars.job.cursor") as unknown as number;
    tap(g, row > at ? "down" : "up", Math.abs(row - at));
  };
  for (let r = 0; r < 4; r++) {
    goTo(r);
    tap(g, "enter");
    const socket = right.indexOf(left[r]!);
    if (wrongFirst && r === 0) {
      goTo((socket + 1) % 4);
      tap(g, "enter");
      expect(py(g, "len(global_vars.job.joined)")).toBe(0);
      goTo(r);
      tap(g, "enter");
    }
    goTo(socket);
    tap(g, "enter");
  }
}
/** Crystals with the keys: Enter on the first left, Right to its tray, Enter. */
function solveCrystals(g: PythonGame) {
  for (let k = 0; k < 6; k++) {
    const colour = py(g, "j = global_vars.job\n[c for c in j.crystals if c is not None][0]") as unknown as number;
    tap(g, "enter");
    tap(g, "right", colour);
    tap(g, "enter");
  }
}

describe.skipIf(!have)("Undertow: the station", () => {
  it("the map: every floor tile can be walked to from the start, and every panel stands on floor", async () => {
    const g = await start();
    const [unreached, offFloor, floors] = py(g, `
grid = station_grid()
seen = {START}
todo = [START]
while todo:
    c, r = todo.pop()
    for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n = (c + dc, r + dr)
        if 0 <= n[0] < COLS and 0 <= n[1] < ROWS and n not in seen and grid[n[1]][n[0]] not in (None, 'wall'):
            seen.add(n)
            todo.append(n)
floor = [(c, r) for r in range(ROWS) for c in range(COLS) if grid[r][c] not in (None, 'wall')]
(len([f for f in floor if f not in seen]), [s for s in STATIONS if grid[s[2]][s[1]] in (None, 'wall')], len(floor))`) as unknown as [number, unknown[], number];
    expect(floors).toBeGreaterThan(800);
    expect(unreached).toBe(0);
    expect(offFloor).toEqual([]);
  });

  it("the title: pick a suit with the arrows, Space dives, and the suit is kept", async () => {
    const g = await start();
    expect(py(g, "room_name()")).toBe("Title");
    tap(g, "right", 2);
    tap(g, "space");
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Station");
    expect(py(g, "global_vars.player.sprite")).toBe("crew_sun");
    expect(g.saved().suit).toBe("sun");
    const again = await onStation("violet");
    expect(py(again, "global_vars.player.sprite")).toBe("crew_violet");
  });

  it("walks, and walls stop you: the Meeting Hub's left wall, away from its corridors", async () => {
    const g = await onStation();
    standAt(g, 26, 22);
    const [x0, y0] = pos(g);
    key(g, "left", true);
    step(g, 30);
    const [x1] = pos(g);
    expect(x1).toBeLessThan(x0 - 30);
    step(g, 60);
    key(g, "left", false);
    const [x2, y2] = pos(g);
    // The hub starts at column 24; the feet's box is 8 pixels each side of x.
    expect(x2).toBeGreaterThanOrEqual(24 * 32 + 8 - 0.01);
    expect(x2).toBeLessThan(24 * 32 + 12);
    expect(y2).toBe(y0);
    // And through a corridor, out of the hub to the left: Observation.
    standAt(g, 25, 18);
    key(g, "left", true);
    step(g, 260);
    key(g, "left", false);
    expect(py(g, "room_at(global_vars.player.x, global_vars.player.y)")).toBe("Observation");
  });

  it("it's dark but for your lamp, which goes where you go", async () => {
    const g = await onStation();
    expect(g.engine.effects.darkness).toBeGreaterThan(0.8);
    standAt(g, 50, 20);
    step(g);
    const [x, y] = pos(g);
    const near = g.engine.effects.lights.filter((l) => Math.hypot(l[0] - x, l[1] - y) < 30);
    expect(near.length).toBeGreaterThan(0);
    expect(Math.max(...near.map((l) => l[2]))).toBeGreaterThanOrEqual(140);
  });

  it("five jobs are dealt, all different, and the list names where they are", async () => {
    const g = await onStation();
    const jobs = py(g, "global_vars.jobs") as unknown as number[];
    expect(jobs.length).toBe(5);
    expect(new Set(jobs).size).toBe(5);
    // The Hud lists each with its room.
    const names = py(g, "[room_at(*tile_middle(STATIONS[i][1], STATIONS[i][2])) for i in global_vars.jobs]") as unknown as string[];
    expect(names.every((n) => n !== "a corridor")).toBe(true);
  });

  it("only your own jobs open: a panel that isn't yours does nothing", async () => {
    const g = await onStation();
    const notMine = py(g, "[i for i in range(len(STATIONS)) if i not in global_vars.jobs][0]") as unknown as number;
    py(g, `s = [o for o in instances('Station') if o.i == ${notMine}][0]\nglobal_vars.player.x, global_vars.player.y = s.x, s.y + 20`);
    step(g, 2);
    tap(g, "e");
    expect(py(g, "global_vars.job")).toBe(undefined);
  });

  it("Fix the wires: a wrong socket lets go, the right ones finish it", async () => {
    const g = await onStation();
    const i = stationOf(g, "wires");
    openJob(g, i);
    expect(py(g, "type(global_vars.job).__name__")).toBe("WiresJob");
    solveWires(g, true);
    step(g);
    expect(isDone(g, i)).toBe(true);
  });

  it("Sort the crystals: a wrong tray buzzes and keeps it out", async () => {
    const g = await onStation();
    const i = stationOf(g, "crystals");
    openJob(g, i);
    const first = py(g, "global_vars.job.crystals[0]") as unknown as number;
    tap(g, "enter");
    tap(g, "right", (first + 1) % 3);
    tap(g, "enter");
    expect(py(g, "global_vars.job.crystals[0]")).toBe(first);
    solveCrystals(g);
    step(g);
    expect(isDone(g, i)).toBe(true);
  });

  it("Set the pressure: held in the green for a moment and a half; too far blows it off", async () => {
    const g = await onStation();
    const i = stationOf(g, "valve");
    openJob(g, i);
    // Holding on and on: over the top, back to the start.
    key(g, "space", true);
    let top = 0, blown = false;
    for (let t = 0; t < 80; t++) {
      step(g);
      const p = py(g, "global_vars.job.pressure") as unknown as number;
      if (p < top - 30) blown = true;
      top = Math.max(top, p);
    }
    key(g, "space", false);
    expect(top).toBeGreaterThan(90);
    expect(blown).toBe(true);
    expect(isDone(g, i)).toBe(false);
    // Now as a player would: hold while it's low, let go once it's in the green.
    let held = false;
    for (let t = 0; t < 600 && !isDone(g, i); t++) {
      const p = py(g, "global_vars.job.pressure if global_vars.job else 0") as unknown as number;
      const want = p < 66;
      if (want !== held) (key(g, "space", want), (held = want));
      step(g);
    }
    if (held) key(g, "space", false);
    expect(isDone(g, i)).toBe(true);
  });

  it("Take a body scan: moving starts it again, holding still finishes it", async () => {
    const g = await onStation();
    const i = stationOf(g, "scan");
    openJob(g, i);
    step(g, 120);
    tap(g, "left");
    expect(py(g, "global_vars.job.scanned")).toBeLessThan(5);
    step(g, 150);
    expect(isDone(g, i)).toBe(false);
    step(g, 40);
    expect(isDone(g, i)).toBe(true);
  });

  it("a job holds you still and holds questions back; Esc walks away with nothing kept", async () => {
    const g = await onStation();
    const i = stationOf(g, "scan");
    openJob(g, i);
    step(g);
    expect(g.oks.at(-1)).toBe(false);
    const [x0, y0] = pos(g);
    key(g, "right", true);
    step(g, 20);
    key(g, "right", false);
    expect(pos(g)).toEqual([x0, y0]);
    tap(g, "escape");
    step(g);
    expect(py(g, "global_vars.job")).toBe(undefined);
    expect(isDone(g, i)).toBe(false);
    expect(g.oks.at(-1)).toBe(true);
    // Back again: it starts afresh.
    tap(g, "e");
    expect(py(g, "global_vars.job.scanned")).toBeLessThan(3);
  });

  it("all five done: every one ticked off, and the station says so", async () => {
    const g = await onStation();
    const jobs = py(g, "global_vars.jobs") as unknown as number[];
    for (const i of jobs) {
      const kind = py(g, `STATIONS[${i}][0]`) as unknown as string;
      openJob(g, i);
      if (kind === "wires") solveWires(g);
      else if (kind === "crystals") solveCrystals(g);
      else if (kind === "scan") step(g, 190);
      else py(g, "global_vars.job.held = 89\nglobal_vars.job.pressure = 70");
      step(g, 2);
      expect(isDone(g, i)).toBe(true);
    }
    expect(py(g, "global_vars.all_done")).toBeGreaterThan(200);
    // Your panels glow green now, not yellow.
    expect(py(g, "len([o for o in instances('Station') if o.i in global_vars.done])")).toBe(5);
  });
});

type Game = Awaited<ReturnType<typeof start>>;
interface Seat { g: Game; number: number; name: string; here: boolean; state: Record<string, unknown>; inbox: NetMessageIn[]; read: number }

/**
 * A room, as the server keeps one, for real games side by side: each step every
 * game is handed the others' newest states, the shouts and private words sent
 * to it, and who the host is (the lowest number here); then it steps, and what
 * it sent is passed on. Everything any game sends is kept in `traffic`, to
 * check what a player with browser tools could read.
 */
class Room {
  seats: Seat[] = [];
  traffic: string[] = [];
  async join(number: number, name: string, suit = "coral") {
    const g = await start({ suit }, { code: "KXTD", number, name, state: {} });
    tap(g, "space");
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Station");
    const seat: Seat = { g, number, name, here: true, state: {}, inbox: [], read: g.sent.length };
    this.seats.push(seat);
    return seat;
  }
  seat(n: number) {
    return this.seats.find((s) => s.number === n)!;
  }
  host() {
    return Math.min(...this.seats.filter((s) => s.here).map((s) => s.number));
  }
  step(n = 1) {
    for (let i = 0; i < n; i++) {
      const host = this.host();
      for (const s of this.seats.filter((s) => s.here)) {
        const others: NetPlayerState[] = this.seats
          .filter((o) => o.here && o !== s && Object.keys(o.state).length)
          .map((o) => ({ number: o.number, name: o.name, state: o.state }));
        s.g.netArrive(others, s.inbox, host);
        s.inbox = [];
        step(s.g);
      }
      for (const s of this.seats.filter((s) => s.here)) {
        for (const out of s.g.sent.slice(s.read)) {
          this.traffic.push(JSON.stringify(out.state ?? {}), JSON.stringify(out.msgs ?? []));
          if (out.state) s.state = out.state;
          for (const m of out.msgs ?? []) for (const o of this.seats) if (o !== s && o.here) o.inbox.push({ from: s.number, data: m, age: 0 });
          for (const [to, m] of out.tells ?? []) {
            const o = this.seats.find((x) => x.number === to && x.here);
            if (o) o.inbox.push({ from: s.number, data: m, age: 0, private: true } as NetMessageIn);
          }
        }
        s.read = s.g.sent.length;
      }
    }
  }
  /** Every game's own view: true if `code` (Python) is true in all of them. */
  all(code: string) {
    return this.seats.filter((s) => s.here).every((s) => py(s.g, code) === true);
  }
}
const G = (s: Seat, key: string) => py(s.g, `global_vars.g[${JSON.stringify(key)}]`) as unknown;
const roleOf = (s: Seat) => py(s.g, "global_vars.role") as unknown as string | undefined;

/** A room of `count`, and a round started by the host (#1) with `mimic` as the one Mimic. */
async function round(count: number, mimic: number) {
  const room = new Room();
  for (let n = 1; n <= count; n++) await room.join(n, ["Ana", "Ben", "Cai", "Dee", "Eli", "Fay", "Gus"][n - 1]!, ["coral", "sea", "sun", "violet", "orange", "white", "pink"][n - 1]);
  room.step(40);
  const host = room.seat(1);
  // The deal is random.sample(here, k): a seed that makes it pick `mimic`.
  const seed = py(host.g, `next(s for s in range(1000) if random.Random(s).sample(list(range(1, ${count + 1})), mimic_count(${count})) == [${mimic}])`) as unknown as number;
  py(host.g, `random.seed(${seed})`);
  key(host.g, "enter", true);
  room.step(1);
  key(host.g, "enter", false);
  room.step(5);
  expect(G(host, "ph")).toBe("play");
  return room;
}
/** Puts a player at (x, y) in their own game, and lets the room hear of it. */
function put(room: Room, n: number, x: number, y: number) {
  py(room.seat(n).g, `global_vars.player.x, global_vars.player.y = ${x}, ${y}`);
  room.step(3);
}
const hub = (dx = 0, dy = 0): [number, number] => [30 * 32 + 16 + dx, 19 * 32 + 16 + dy];

describe.skipIf(!have)("Undertow: a round in a room", () => {
  it("the host starts a round: each player is told their role alone, and nobody else can read it", async () => {
    const room = await round(4, 3);
    room.step(10);
    expect(room.seats.map(roleOf)).toEqual(["crew", "crew", "mimic", "crew"]);
    expect(room.all("global_vars.g['in'] == [1, 2, 3, 4] and global_vars.g['ph'] == 'play'")).toBe(true);
    // Nothing anyone sent for all to see says who the Mimic is.
    expect(room.traffic.some((t) => t.includes("mimic") || t.includes("role"))).toBe(false);
    // Everyone was given five jobs, and stands round the hub's table.
    expect(room.all("len(global_vars.jobs) == 5")).toBe(true);
    const spots = room.seats.map((s) => pos(s.g).map(Math.round).join());
    expect(new Set(spots).size).toBe(4);
    expect(room.all("room_at(global_vars.player.x, global_vars.player.y) == 'Meeting Hub'")).toBe(true);
  });

  it("seats round the table: on the hub's floor, apart, and out of the beacon's reach, for 3 to 25 players", async () => {
    const g = await start();
    const bad = py(g, `
grid = station_grid()
bx, by = tile_middle(*BEACON)
bad = []
for count in range(3, 26):
    spots = [seat(k, count) for k in range(count)]
    for x, y in spots:
        if room_at(x, y) != 'Meeting Hub' or grid[int(y // TILE)][int(x // TILE)] in (None, 'wall') or point_distance(x, y, bx, by) <= REACH:
            bad.append((count, round(x), round(y)))
    if min(point_distance(*a, *b) for a in spots for b in spots if a != b) < 24:
        bad.append((count, 'crowded'))
bad`) as unknown as unknown[];
    expect(bad).toEqual([]);
  });

  it("rooms of up to 25: the game asks the server for 25, and 25 faces fit the meeting screen", async () => {
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    expect(project.settings.netPlayers).toBe(25);
    const g = await start();
    // Every face clear of the next and above the room buttons (y 234), for 3 to 25.
    const bad = py(g, `
bad = []
for count in range(3, 26):
    for k in range(count):
        x, y, h = tile_xy(k, count)
        if y + h > 230 or h < 30:
            bad.append((count, k, y, h))
bad`) as unknown as unknown[];
    expect(bad).toEqual([]);
    expect(py(g, "tile_xy(19, 20)[2]")).toBe(44);
  });

  it("waiting: two can't start a round; others see who will start it", async () => {
    const room = new Room();
    await room.join(1, "Ana");
    await room.join(2, "Ben");
    room.step(40);
    key(room.seat(1).g, "enter", true);
    room.step(2);
    key(room.seat(1).g, "enter", false);
    room.step(5);
    expect(G(room.seat(1), "ph")).toBe("lobby");
    // Only the host's Enter counts.
    await room.join(3, "Cai");
    room.step(40);
    key(room.seat(2).g, "enter", true);
    room.step(2);
    key(room.seat(2).g, "enter", false);
    room.step(5);
    expect(G(room.seat(2), "ph")).toBe("lobby");
  });

  it("a Mimic freezes crew in reach with F, never from afar, and must wait between", async () => {
    const room = await round(4, 3);
    const m = room.seat(3);
    // Not yet: a Mimic's cold takes a moment to come at the start.
    put(room, 2, ...hub(-200, 0));
    put(room, 3, ...hub(-170, 0));
    tap(m.g, "f");
    room.step(5);
    expect(G(m, "fz")).toEqual([]);
    py(m.g, "global_vars.cool = 0");
    py(room.seat(1).g, "global_vars.director.coolness[3] = 0");
    room.step(2);
    expect(py(m.g, "global_vars.target.number if global_vars.target else None")).toBe(2);
    tap(m.g, "f");
    room.step(5);
    expect(room.all("global_vars.g['fz'] == [2]")).toBe(true);
    // #2 is a ghost now, and a frozen block stands where they were, in everyone's station.
    expect(py(room.seat(2).g, "am_ghost()")).toBe(true);
    expect(room.all("len(instances('Body')) == 1")).toBe(true);
    // In reach, but too soon after the last: no.
    put(room, 4, ...hub(-150, 0));
    put(room, 3, ...hub(-140, 0));
    py(m.g, "global_vars.cool = 0");
    py(m.g, "to_host({'freeze': 4, 'r': global_vars.g['r']})");
    room.step(5);
    expect(G(m, "fz")).toEqual([2]);
    // A changed game asking from across the station: the host says no.
    put(room, 4, ...hub(300, 0));
    py(m.g, "global_vars.cool = 0");
    py(room.seat(1).g, "global_vars.director.coolness[3] = 0");
    py(m.g, "to_host({'freeze': 4, 'r': global_vars.g['r']})");
    room.step(5);
    expect(G(m, "fz")).toEqual([2]);
    // And crew can't freeze anyone, however they ask, even right beside them.
    put(room, 4, ...hub(-150, 0));
    put(room, 1, ...hub(-160, 0));
    py(room.seat(1).g, "to_host({'freeze': 4, 'r': global_vars.g['r']})");
    room.step(5);
    expect(G(m, "fz")).toEqual([2]);
  });

  it("ghosts: the frozen walk through walls and see each other; the living don't see them", async () => {
    const room = await round(5, 3);
    py(room.seat(3).g, "global_vars.cool = 0");
    py(room.seat(1).g, "global_vars.director.coolness[3] = 0");
    put(room, 2, ...hub(-200, 0));
    put(room, 3, ...hub(-180, 0));
    py(room.seat(3).g, "try_freeze(2)");
    room.step(10);
    expect(G(room.seat(1), "fz")).toEqual([2]);
    put(room, 2, ...hub(0, 0));
    put(room, 4, ...hub(20, 0));
    const seen = (from: number, of: number) => py(room.seat(from).g, `[o.visible for o in instances('Other') if o.number == ${of}]`) as unknown as boolean[];
    expect(seen(4, 2)).toEqual([false]);
    expect(seen(2, 4)).toEqual([true]);
    // Through the hub's left wall, where a living player stops.
    put(room, 2, 24 * 32 + 12, 22 * 32);
    key(room.seat(2).g, "left", true);
    room.step(40);
    key(room.seat(2).g, "left", false);
    expect(pos(room.seat(2).g)[0]).toBeLessThan(24 * 32 - 40);
    // A ghost can't vote, speak, report or call.
    expect(py(room.seat(2).g, "try_call()")).toBe(false);
  });

  it("a report: everyone to the table, phrases said, a vote, and the Mimic sent up: the crew win", async () => {
    const room = await round(4, 3);
    py(room.seat(3).g, "global_vars.cool = 0");
    py(room.seat(1).g, "global_vars.director.coolness[3] = 0");
    put(room, 2, ...hub(-200, 0));
    put(room, 3, ...hub(-180, 0));
    py(room.seat(3).g, "try_freeze(2)");
    room.step(10);
    // A changed game reporting from across the station: refused.
    put(room, 1, ...hub(250, 0));
    py(room.seat(1).g, "to_host({'report': 2, 'r': global_vars.g['r']})");
    room.step(5);
    expect(G(room.seat(1), "ph")).toBe("play");
    // #4 comes across the block and presses E.
    put(room, 3, ...hub(200, 0));
    put(room, 4, ...hub(-200, 30));
    expect(py(room.seat(4).g, "global_vars.near[0] if global_vars.near else None")).toBe("body");
    tap(room.seat(4).g, "e");
    room.step(5);
    expect(room.all("global_vars.g['ph'] == 'meeting' and len(instances('Meeting')) == 1")).toBe(true);
    expect(G(room.seat(1), "found")).toBe(2);
    expect(G(room.seat(1), "call")).toBe(4);
    expect(room.all("len(instances('Body')) == 0")).toBe(true);
    expect(room.all("(global_vars.player.x, global_vars.player.y) == seat(net_me().number - 1, 4)")).toBe(true);
    // Phrases reach everyone; a ghost's don't; too fast and the second waits.
    expect(py(room.seat(4).g, "say('found', None, 'Meeting Hub')")).toBe(true);
    expect(py(room.seat(4).g, "say('sus', 3)")).toBe(false);
    expect(py(room.seat(2).g, "say('who')")).toBe(false);
    room.step(3);
    expect(room.all("global_vars.chat == [(4, 'They were in Meeting Hub.')]")).toBe(true);
    // The vote: three for #3. Ghost #2's vote doesn't count.
    expect(py(room.seat(2).g, "vote(4)")).toBe(false);
    for (const n of [1, 4]) expect(py(room.seat(n).g, "vote(3)")).toBe(true);
    room.step(5);
    expect(G(room.seat(1), "voted")).toEqual([1, 4]);
    expect(G(room.seat(1), "ph")).toBe("meeting");
    py(room.seat(3).g, "vote(1)");
    room.step(5);
    expect(room.all("global_vars.g['ph'] == 'result' and global_vars.g['ej'] == 3 and global_vars.g['em'] == True")).toBe(true);
    room.step(6 * 60 + 5);
    expect(room.all("global_vars.g['ph'] == 'over' and global_vars.g['win'] == 'crew' and global_vars.g['mm'] == [3]")).toBe(true);
    // Then back to waiting, roles forgotten.
    room.step(10 * 60 + 5);
    expect(room.all("global_vars.g['ph'] == 'lobby' and global_vars.role is None")).toBe(true);
  });

  it("a tie, or more skips, sends nobody up", async () => {
    const room = await round(4, 3);
    py(room.seat(1).g, "global_vars.player.x, global_vars.player.y = tile_middle(*BEACON)");
    room.step(3);
    expect(py(room.seat(1).g, "global_vars.near[0]")).toBe("beacon");
    tap(room.seat(1).g, "e");
    room.step(5);
    expect(G(room.seat(1), "ph")).toBe("meeting");
    // Two for #4, two for #1: a tie.
    py(room.seat(1).g, "vote(4)");
    py(room.seat(2).g, "vote(4)");
    py(room.seat(3).g, "vote(1)");
    py(room.seat(4).g, "vote(1)");
    room.step(5);
    expect(G(room.seat(2), "ej")).toBe(undefined);
    expect(G(room.seat(2), "out")).toEqual([]);
    // The beacon was #1's one call this round.
    room.step(6 * 60 + 5);
    expect(G(room.seat(1), "ph")).toBe("play");
    expect(py(room.seat(1).g, "try_call()")).toBe(false);
    // ...and a changed game asking again is refused by the host.
    py(room.seat(1).g, "to_host({'call': 1, 'r': global_vars.g['r']})");
    room.step(5);
    expect(G(room.seat(1), "ph")).toBe("play");
  });

  it("time runs out: the votes in are counted, and not voting is skipping", async () => {
    const room = await round(4, 3);
    py(room.seat(2).g, "global_vars.player.x, global_vars.player.y = tile_middle(*BEACON)");
    room.step(3);
    py(room.seat(2).g, "try_call()");
    room.step(5);
    for (const n of [1, 2, 3]) py(room.seat(n).g, "vote(4)");
    room.step(60 * 60 + 10);
    expect(G(room.seat(1), "ej")).toBe(4);
    expect(G(room.seat(1), "em")).toBe(false);
    // Next meeting, one vote of three: the two who said nothing outweigh it.
    room.step(6 * 60 + 5);
    py(room.seat(1).g, "global_vars.player.x, global_vars.player.y = tile_middle(*BEACON)");
    room.step(3);
    py(room.seat(1).g, "try_call()");
    room.step(5);
    expect(G(room.seat(1), "ph")).toBe("meeting");
    py(room.seat(1).g, "vote(2)");
    room.step(60 * 60 + 10);
    expect(G(room.seat(1), "ej")).toBe(undefined);
  });

  it("the Mimics win when they're as many as the crew", async () => {
    const room = await round(3, 2);
    py(room.seat(2).g, "global_vars.cool = 0");
    py(room.seat(1).g, "global_vars.director.coolness[2] = 0");
    put(room, 3, ...hub(-200, 0));
    put(room, 2, ...hub(-180, 0));
    py(room.seat(2).g, "try_freeze(3)");
    room.step(10);
    expect(room.all("global_vars.g['ph'] == 'over' and global_vars.g['win'] == 'mimics'")).toBe(true);
  });

  it("the crew win by doing every job, ghosts' jobs too; a Mimic's pretend jobs don't count", async () => {
    const room = await round(4, 3);
    expect(G(room.seat(1), "jobs")).toEqual([0, 15]);
    py(room.seat(3).g, "global_vars.done = set(global_vars.jobs)");
    for (const n of [1, 2]) py(room.seat(n).g, "global_vars.done = set(global_vars.jobs)");
    room.step(70);
    expect(G(room.seat(4), "jobs")).toEqual([10, 15]);
    // A Mimic's changed game claiming jobs done: not counted. (Just after its game's own
    // once-a-second word, which says 0 and would otherwise cover up the claim.)
    while ((py(room.seat(3).g, "global_vars.director.t % 60") as unknown as number) !== 5) room.step(1);
    py(room.seat(3).g, "to_host({'me': 'mimic', 'done': 5, 'r': global_vars.g['r']})");
    room.step(3);
    expect(G(room.seat(4), "jobs")).toEqual([10, 15]);
    expect(G(room.seat(4), "ph")).toBe("play");
    py(room.seat(4).g, "global_vars.done = set(global_vars.jobs)");
    room.step(70);
    expect(room.all("global_vars.g['ph'] == 'over' and global_vars.g['win'] == 'crew'")).toBe(true);
  });

  it("the host leaves mid-round: the next player's game carries on, and knows the roles", async () => {
    const room = await round(5, 3);
    room.step(60);
    const v = G(room.seat(2), "v") as number;
    room.seat(1).here = false;
    room.step(200);
    expect(G(room.seat(2), "v") as number).toBeGreaterThan(v + 100);
    expect(G(room.seat(2), "ph")).toBe("play");
    // #2's game now checks freezes: it learned #3 is the Mimic from #3 itself.
    py(room.seat(3).g, "global_vars.cool = 0");
    py(room.seat(2).g, "global_vars.director.coolness[3] = 0");
    put(room, 4, ...hub(-200, 0));
    put(room, 3, ...hub(-180, 0));
    py(room.seat(3).g, "try_freeze(4)");
    room.step(10);
    expect(room.all("global_vars.g['fz'] == [4]")).toBe(true);
    // And #1, gone a minute and a half, has left the round.
    room.step(90 * 60 + 10);
    expect(G(room.seat(2), "left")).toEqual([1]);
  });

  it("a player who reloads mid-round is told their role again", async () => {
    const room = await round(4, 3);
    room.step(200);
    py(room.seat(4).g, "global_vars.role = None\nglobal_vars.jobs = []");
    room.step(70);
    expect(roleOf(room.seat(4))).toBe("crew");
    expect(py(room.seat(4).g, "len(global_vars.jobs)")).toBe(5);
  });

  it("a meeting holds questions back, and so does the result", async () => {
    const room = await round(4, 3);
    py(room.seat(1).g, "global_vars.player.x, global_vars.player.y = tile_middle(*BEACON)");
    room.step(3);
    py(room.seat(1).g, "try_call()");
    room.step(5);
    expect(room.seat(2).g.oks.at(-1)).toBe(false);
  });
});
