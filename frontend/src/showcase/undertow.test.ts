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

const BUILT = resolve(__dirname, "../../../showcase/undertow/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const oks: boolean[] = [];
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    questionOk: (ok) => oks.push(ok),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { saved: () => saved, oks });
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
  expect(py(g, "global_vars.near.i if global_vars.near else None")).toBe(i);
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
