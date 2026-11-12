/**
 * The sand-sorting showcase game, Pour Decisions, played headless in the real
 * Pyodide with real taps. A bot written in Python (below) finds the fewest pours
 * with the game's own pouring rule and taps them in. Runs when the game has been
 * built (python3 showcase/sand/build.py, which needs only the repo).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import { PAD_BUTTONS } from "../engine/layout";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/sand/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const scores: number[] = [];
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    score: (n) => scores.push(n),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  game.evalPython(BOT);
  return Object.assign(game, { saved: () => saved, scores });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = <T = never>(g: PythonGame, code: string) => g.evalPython(code) as T;
function click(g: PythonGame, x: number, y: number) {
  g.engine.input.mouseMove(x, y);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  g.engine.input.mouseUp(0);
  step(g);
}
function press(g: PythonGame, key: string) {
  g.engine.input.keyDown(KEY_CODE.get(key)!);
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
  step(g);
}
/** Taps tube i where a player would: on its glass, below the mouth. */
function tapTube(g: PythonGame, i: number) {
  const [x, y] = py<[number, number]>(g, `[global_vars.director.tubes[${i}].home_x, global_vars.director.tubes[${i}].home_y + 90]`);
  click(g, x, y);
}
/** Until no sand is falling. */
function settle(g: PythonGame) {
  for (let k = 0; k < 600 && py(g, 'instance_exists("Pour")'); k++) step(g);
  step(g, 2);
}
/** Where level i's card is on its page (24 a page). */
const cardAt = (i: number): [number, number] => [512 - 3 * 168 + 6 + ((i % 24) % 6) * 168 + 78, 156 + Math.floor((i % 24) / 6) * 72 + 29];
/** The button that shows levels 25-48. */
const PAGE_2: [number, number] = [512 - 75 + 170 + 75, 470 + 22];
async function level(i: number, save: Record<string, unknown> = {}) {
  const g = await start({ ...(i ? { [`stars_${i - 1}`]: 1 } : {}), ...save });
  if (i >= 24) click(g, ...PAGE_2);
  click(g, ...cardAt(i));
  step(g, 2);
  expect(py(g, "room_name()")).toBe("Play");
  expect(py(g, "global_vars.director.level")).toBe(i);
  return g;
}
const sand = (g: PythonGame) => py<string[]>(g, '["".join(t.sand) for t in global_vars.director.tubes]');

/** The fewest pours from here, breadth first, by the game's own can_pour and pour. */
const BOT = `
def bot_plan():
    from collections import deque
    tubes = global_vars.director.tubes
    start = tuple(tuple(t.sand) for t in tubes)
    def done(s):
        return all(not t or (len(t) == CAP and len(set(t)) == 1) for t in s)
    seen, q = {start: None}, deque([start])
    while q:
        s = q.popleft()
        if done(s):
            path = []
            while seen[s]:
                s, mv = seen[s]
                path.append(mv)
            return path[::-1]
        for i in range(len(s)):
            for j in range(len(s)):
                a, b = list(s[i]), list(s[j])
                if i != j and can_pour(a, b):
                    pour(a, b)
                    n = list(s)
                    n[i], n[j] = tuple(a), tuple(b)
                    n = tuple(n)
                    if n not in seen:
                        seen[n] = (s, (i, j))
                        q.append(n)
`;
function solveByTapping(g: PythonGame) {
  const plan = py<[number, number][]>(g, "bot_plan()");
  for (const [a, b] of plan) {
    tapTube(g, a);
    tapTube(g, b);
    settle(g);
  }
  return plan.length;
}

describe.runIf(have)("Pour Decisions", () => {
  it("the built game is today's source: the build refuses a level or a rule it can't check", () => {
    // build.py won't write a game whose levels can't be finished, whose par is
    // wrong, or whose pouring rule the checker disagrees with. Refused, it leaves
    // the last game in out/, so a stale game here means the build said no.
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    const dir = resolve(__dirname, "../../../showcase/sand/game");
    for (const f of readdirSync(dir).filter((f) => f.startsWith("_") && f.endsWith(".py"))) {
      const src = readFileSync(resolve(dir, f), "utf8");
      expect(project.scripts.some((s) => s.code === src), f).toBe(true);
    }
  });

  it("a pour moves the whole run of one colour, as much as fits", async () => {
    const g = await start();
    expect(py(g, 'a = list("RGG"); b = list("BG"); [pour(a, b), "".join(a), "".join(b)]')).toEqual([2, "R", "BGGG"]);
    expect(py(g, 'a = list("RGGG"); b = list("BBG"); [pour(a, b), "".join(a), "".join(b)]')).toEqual([1, "RGG", "BBGG"]);
    expect(py(g, 'a = list("RG"); b = []; [pour(a, b), "".join(a), "".join(b)]')).toEqual([1, "R", "G"]);
  }, 60_000);

  it("sand only goes onto its own colour or into an empty tube", async () => {
    const g = await start();
    expect(py(g, 'can_pour(list("RG"), list("BR"))')).toBe(false);
    expect(py(g, 'can_pour(list("RG"), list("BBBG"))')).toBe(false); // full
    expect(py(g, 'can_pour(list("RG"), list("BG"))')).toBe(true);
    expect(py(g, 'can_pour(list("RG"), [])')).toBe(true);
    expect(py(g, "can_pour([], list(\"RG\"))")).toBe(false);
  }, 60_000);

  it("tapping: pick up, pour, and a wrong pour does nothing but shake", async () => {
    const g = await level(0);
    // A wrong colour with room on top, as well as a full tube.
    py(g, 'for t, s in zip(global_vars.director.tubes, ["RRO", "ORRR", "O"]): t.sand = list(s)');
    const before = sand(g);
    // Find a pair that can't pour and one that can, from this level's own tubes.
    const [bad, good] = py<[[number, number] | null, [number, number]]>(g, `[
        next(([i, j] for i, a in enumerate(global_vars.director.tubes) for j, b in enumerate(global_vars.director.tubes)
              if i != j and a.sand and len(b.sand) < CAP and not can_pour(a.sand, b.sand)), None),
        next([i, j] for i, a in enumerate(global_vars.director.tubes) for j, b in enumerate(global_vars.director.tubes)
             if i != j and can_pour(a.sand, b.sand))]`);
    expect(bad).not.toBeNull();
    if (bad) {
      tapTube(g, bad[0]);
      expect(py(g, `global_vars.director.picked is global_vars.director.tubes[${bad[0]}]`)).toBe(true);
      tapTube(g, bad[1]);
      expect(py(g, "global_vars.director.picked is None")).toBe(true);
      expect(py(g, `global_vars.director.tubes[${bad[1]}].shake > 0`)).toBe(true);
      settle(g);
      expect(sand(g)).toEqual(before);
      expect(py(g, "global_vars.director.pours")).toBe(0);
    }
    tapTube(g, good[0]);
    tapTube(g, good[1]);
    settle(g);
    expect(sand(g)).not.toEqual(before);
    expect(py(g, "global_vars.director.pours")).toBe(1);
    // Tapping the same tube twice puts it back down.
    const any = py<number>(g, "next(i for i, t in enumerate(global_vars.director.tubes) if t.sand and not tube_done(t.sand))");
    tapTube(g, any);
    tapTube(g, any);
    expect(py(g, "global_vars.director.picked is None")).toBe(true);
    step(g, 12);
    expect(py(g, `global_vars.director.tubes[${any}].y`)).toBe(py(g, `global_vars.director.tubes[${any}].home_y`));
  }, 60_000);

  for (const i of [0, 1, 2, 9, 16]) {
    it(`the bot finishes level ${i + 1} in par pours, for three stars`, async () => {
      const g = await level(i);
      const n = solveByTapping(g);
      expect(n).toBe(py(g, `LEVELS[${i}]["par"]`));
      step(g, 3);
      expect(py(g, "global_vars.director.won")).toBe(true);
      expect(py(g, "global_vars.director.pours")).toBe(n);
      expect(py(g, "global_vars.director.stars")).toBe(3);
      expect(g.saved()[`stars_${i}`]).toBe(3);
      expect(g.scores.at(-1)).toBe(py(g, `points_for(LEVELS[${i}]["par"], 3)`));
    }, 120_000);
  }

  it("no sand appears or vanishes mid-pour", async () => {
    const g = await level(3);
    const total = "sum(k for t in global_vars.director.tubes for c, k in shown_layers(t.sand, t.drain, t.drain_colour, t.pending))";
    const [a, b] = py<[number, number]>(g, "bot_plan()[0]");
    tapTube(g, a);
    tapTube(g, b);
    let flowing = 0;
    for (let k = 0; k < 200 && py(g, 'instance_exists("Pour")'); k++) {
      expect(py<number>(g, total)).toBeCloseTo(16, 6);
      if (py(g, 'instance_exists("Pour") and instances("Pour")[0].phase == "flow"')) flowing++;
      step(g);
    }
    expect(flowing).toBeGreaterThan(5);
    expect(py<number>(g, total)).toBeCloseTo(16, 6);
  }, 60_000);

  it("the falling sand is drawn, from the tipped tube's mouth down to the sand", async () => {
    const g = await level(0);
    const [a, b] = py<[number, number]>(g, "bot_plan()[0]");
    tapTube(g, a);
    tapTube(g, b);
    for (let k = 0; k < 100 && !py(g, 'instances("Pour")[0].phase == "flow"'); k++) step(g);
    step(g, 3);
    const [colour, mouth, surface, x] = py<[number, number, number, number]>(g,
      'p = instances("Pour")[0]; [int(COLOURS[p.colour][1:], 16), p.src.y, surface_y(p.dst), p.dst.x]');
    const stream = g.engine.drawList.find((c) => c[0] === "rect" && c[6] === colour && (c[5] as number) - (c[3] as number) > 20);
    expect(stream).toBeDefined();
    expect(stream![1]).toBeLessThan(py(g, "p.src.depth")); // over the tubes
    expect(stream![3]).toBeCloseTo(mouth, 3);
    expect(stream![5]).toBeCloseTo(surface, 3);
    expect(((stream![2] as number) + (stream![4] as number)) / 2).toBeCloseTo(x, 3);
  }, 60_000);

  it("a tipped tube pours from its mouth, leans back the way it came, and stays on the screen", async () => {
    const g = await start();
    // For every level, every pair of tubes: where the tipped tube's mouth and bottom are.
    const bad = py<string[]>(g, `[
        f"{n}: {i}->{j}" for n, l in enumerate(LEVELS)
        for here in [spots(len(l["tubes"]) + 1)]
        for i, (sx, sy) in enumerate(here) for j, (dx, dy) in enumerate(here) if i != j
        for (mx, my, a) in [pour_place(type("T", (), {"home_x": sx, "home_y": sy})(), type("T", (), {"home_x": dx, "home_y": dy})())]
        for bx, by in [(mx + 150 * math.sin(math.radians(a)), my + 150 * math.cos(math.radians(a)))]
        if not (0 <= bx <= VIEW_W and 0 <= by <= VIEW_H and abs(mx - dx) < 20 and my < dy and (bx - dx) * (sx - dx) >= 0)]`);
    expect(bad).toEqual([]);
  }, 60_000);

  it("many tubes go in two rows, every one on the screen and none overlapping", async () => {
    const g = await start();
    const bad = py<string[]>(g, `[
        f"{n} tubes" for n in range(3, 14) for s in [spots(n)]
        if len(s) != n or any(not (40 <= x <= VIEW_W - 40) or y + 150 > 510 for x, y in s)
        or any(abs(a[0] - b[0]) < 70 and abs(a[1] - b[1]) < 160 for k, a in enumerate(s) for b in s[k + 1:])]`);
    expect(bad).toEqual([]);
    expect(py(g, "len(set(y for x, y in spots(5)))")).toBe(1);
    expect(py(g, "len(set(y for x, y in spots(11)))")).toBe(2);
  }, 60_000);

  it("undo takes back a pour, and Z does too", async () => {
    const g = await level(4);
    const before = sand(g);
    const plan = py<[number, number][]>(g, "bot_plan()");
    for (const [a, b] of plan.slice(0, 2)) {
      tapTube(g, a);
      tapTube(g, b);
      settle(g);
    }
    const afterOne = py<string[]>(g, '["".join(s) for s, h in global_vars.director.history[1]]');
    press(g, "z");
    expect(sand(g)).toEqual(afterOne);
    py(g, "undo(global_vars.director)");
    expect(sand(g)).toEqual(before);
    expect(py(g, "global_vars.director.pours")).toBe(2); // undone pours still count
    py(g, "undo(global_vars.director)"); // nothing left: no harm
    expect(sand(g)).toEqual(before);
  }, 60_000);

  it("hidden layers show as they reach the top, and stay shown after an undo", async () => {
    const g = await level(16);
    expect(py(g, "all(t.hidden == max(0, len(t.sand) - 1) for t in global_vars.director.tubes)")).toBe(true);
    const [a, b] = py<[number, number]>(g, "bot_plan()[0]");
    const was = py<number>(g, `global_vars.director.tubes[${a}].hidden`);
    tapTube(g, a);
    tapTube(g, b);
    settle(g);
    const left = py<number>(g, `len(global_vars.director.tubes[${a}].sand)`);
    expect(py(g, `global_vars.director.tubes[${a}].hidden`)).toBe(Math.max(0, left - 1));
    expect(py<number>(g, `global_vars.director.tubes[${a}].hidden`)).toBeLessThan(was);
    py(g, "undo(global_vars.director)");
    expect(py<number>(g, `global_vars.director.tubes[${a}].hidden`)).toBeLessThan(was);
  }, 60_000);

  it("an extra tube once a level, and it costs the third star", async () => {
    const g = await level(1);
    const n = py<number>(g, "len(global_vars.director.tubes)");
    py(g, "add_tube(global_vars.director)");
    py(g, "add_tube(global_vars.director)");
    expect(py(g, "len(global_vars.director.tubes)")).toBe(n + 1);
    step(g, 30);
    expect(py(g, "global_vars.director.tubes[-1].x")).toBeCloseTo(py(g, "global_vars.director.tubes[-1].home_x"), 3);
    solveByTapping(g);
    step(g, 3);
    expect(py(g, "global_vars.director.won")).toBe(true);
    expect(py(g, "global_vars.director.stars")).toBe(2);
    expect(py(g, "stars_for(1, 10, False)")).toBe(3);
    expect(py(g, "stars_for(1, 10, True)")).toBe(2);
    expect(py(g, "stars_for(100, 10, False)")).toBe(1);
  }, 120_000);

  it("says so when there are no pours left", async () => {
    const g = await level(0);
    py(g, 'd = global_vars.director\nfor t, s in zip(d.tubes, ["RG", "GR", "RGRG"]): t.sand = list(s)');
    expect(py(g, "stuck(global_vars.director)")).toBe(false); // RGRG's G can still go onto RG
    py(g, 'for t, s in zip(global_vars.director.tubes, ["GRGR", "RGRG", "GRGR"]): t.sand = list(s)');
    expect(py(g, "stuck(global_vars.director)")).toBe(true);
    // Pouring a tube of one colour into an empty one changes nothing: it isn't a way out.
    py(g, 'for t, s in zip(global_vars.director.tubes, ["RR", "GG", ""]): t.sand = list(s)');
    expect(py(g, "stuck(global_vars.director)")).toBe(true);
  }, 60_000);

  it("the next level unlocks when one is done, and the best stars are kept", async () => {
    const g = await start({ stars_0: 3 });
    expect(py(g, "[c.off for c in sorted(instances('LevelCard'), key=lambda c: c.i)][:3]")).toEqual([false, false, true]);
    click(g, ...cardAt(1));
    step(g, 2);
    py(g, "global_vars.director.pours = 999; finish(global_vars.director)");
    step(g);
    expect(g.saved().stars_1).toBe(1);
    press(g, "r");
    step(g, 2);
    py(g, "finish(global_vars.director)");
    step(g);
    expect(g.saved().stars_1).toBe(3);
    press(g, "r");
    step(g, 2);
    py(g, "global_vars.director.pours = 999; finish(global_vars.director)");
    step(g);
    expect(g.saved().stars_1).toBe(3);
    // Next level goes on to the next.
    const next = py<number>(g, "next(b for b in instances('GoButton') if b.does == 'next').x");
    click(g, next + 70, 380);
    step(g, 2);
    expect(py(g, "global_vars.director.level")).toBe(2);
    press(g, "escape");
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Title");
    expect(py(g, "[c.off for c in sorted(instances('LevelCard'), key=lambda c: c.i)][:3]")).toEqual([false, false, false]);
  }, 60_000);

  it("the shapes are kept in the save", async () => {
    const g = await start();
    expect(py(g, "global_vars.shapes")).toBe(false);
    click(g, 512, 490);
    expect(py(g, "global_vars.shapes")).toBe(true);
    expect(g.saved().shapes).toBe(true);
    const h = await start({ shapes: true });
    expect(py(h, "global_vars.shapes")).toBe(true);
  }, 60_000);

  it("every level's tubes are dealt as written, all the same height of sand", async () => {
    for (const i of [0, 12, 23, 24, 47]) {
      const g = await level(i);
      expect(sand(g)).toEqual(py(g, `LEVELS[${i}]["tubes"]`));
      step(g, 30);
      expect(py(g, 'all(t.image_angle == 0 and t.y == t.home_y for t in global_vars.director.tubes)')).toBe(true);
    }
  }, 120_000);
  describe("from the keyboard and a gamepad", () => {
    /** The key that moves the tube cursor one step nearer tube i: up or down to its row, then along it. */
    const towards = (g: PythonGame, i: number) => py<string | null>(g, `(lambda d, t: None if d.cursor is t else
        ("up" if t.home_y < d.cursor.home_y else "down") if t.home_y != d.cursor.home_y else
        ("left" if t.home_x < d.cursor.home_x else "right"))(global_vars.director, global_vars.director.tubes[${i}])`);
    function cursorTo(g: PythonGame, i: number) {
      for (let k = 0; k < 20; k++) {
        const key = towards(g, i);
        if (!key) return;
        press(g, key);
      }
      throw new Error(`the cursor never reached tube ${i}`);
    }
    const focused = (g: PythonGame) => py<string | number | null>(g,
      "(lambda f: None if f is None else f.i if hasattr(f, 'i') else f.words)(global_vars.focus)");

    it("a level chosen and solved in par with keys alone, across two rows of tubes", async () => {
      const g = await start(Object.fromEntries(Array.from({ length: 9 }, (_, k) => [`stars_${k}`, 1])));
      // Cards 0..9 are open; the cursor starts on the first, and arrows walk the grid.
      expect(focused(g)).toBe(0);
      press(g, "right");
      press(g, "right");
      press(g, "down");
      expect(focused(g)).toBe(8);
      press(g, "right");
      expect(focused(g)).toBe(9);
      press(g, "space");
      step(g, 2);
      expect(py(g, "room_name()")).toBe("Play");
      expect(py(g, "global_vars.director.level")).toBe(9);
      expect(py(g, "len(set(t.home_y for t in global_vars.director.tubes))")).toBe(2);
      const plan = py<[number, number][]>(g, "bot_plan()");
      for (const [a, b] of plan) {
        cursorTo(g, a);
        press(g, "space");
        cursorTo(g, b);
        press(g, "enter");
        settle(g);
      }
      step(g, 3);
      expect(py(g, "global_vars.director.won")).toBe(true);
      expect(py(g, "global_vars.director.pours")).toBe(py(g, "LEVELS[9]['par']"));
      expect(g.saved().stars_9).toBe(3);
      // On the Sorted! panel, Next level is chosen, and Space takes it.
      step(g, 2);
      expect(focused(g)).toBe("Next level");
      press(g, "space");
      step(g, 2);
      expect(py(g, "global_vars.director.level")).toBe(10);
    }, 180_000);

    it("left and right go round a row; up and down move between the rows", async () => {
      const g = await level(9);
      const d = "global_vars.director";
      const row = (y: string) => py<number[]>(g, `sorted([i for i, t in enumerate(${d}.tubes) if t.home_y == ${y}], key=lambda i: ${d}.tubes[i].home_x)`);
      const top = row(`min(t.home_y for t in ${d}.tubes)`);
      const bottom = row(`max(t.home_y for t in ${d}.tubes)`);
      const at = () => py<number>(g, `${d}.tubes.index(${d}.cursor)`);
      step(g);
      py(g, `${d}.cursor = ${d}.tubes[${top[0]}]`);
      press(g, "left");
      expect(at()).toBe(top.at(-1));
      press(g, "right");
      expect(at()).toBe(top[0]);
      press(g, "d");
      expect(at()).toBe(top[1]);
      press(g, "down");
      expect(bottom).toContain(at());
      press(g, "down"); // the bottom edge: stays
      expect(bottom).toContain(at());
      press(g, "w");
      expect(top).toContain(at());
    }, 60_000);

    it("Esc puts a picked tube down, then goes back to the levels; Z undoes, R restarts, X adds a tube", async () => {
      const g = await level(1);
      const d = "global_vars.director";
      const [a, b] = py<[number, number]>(g, "bot_plan()[0]");
      cursorTo(g, a);
      press(g, "space");
      expect(py(g, `${d}.picked is ${d}.tubes[${a}]`)).toBe(true);
      press(g, "escape");
      expect(py(g, `${d}.picked is None`)).toBe(true);
      expect(py(g, "room_name()")).toBe("Play");
      press(g, "space");
      cursorTo(g, b);
      press(g, "space");
      settle(g);
      expect(py(g, `${d}.pours`)).toBe(1);
      const before = py<string[]>(g, `["".join(s) for s, h in ${d}.history[0]]`);
      press(g, "u");
      expect(sand(g)).toEqual(before);
      const n = py<number>(g, `len(${d}.tubes)`);
      press(g, "x");
      expect(py(g, `len(${d}.tubes)`)).toBe(n + 1);
      press(g, "r");
      step(g, 2);
      expect(py(g, `[${d}.pours, len(${d}.tubes)]`)).toEqual([0, n]);
      press(g, "backspace");
      step(g, 2);
      expect(py(g, "room_name()")).toBe("Title");
    }, 60_000);

    it("a gamepad's d-pad and A do what the arrows and Space do", async () => {
      const g = await start({ stars_0: 1 });
      const pad = (button: string) => {
        const buttons = PAD_BUTTONS.map((b) => b === button);
        g.engine.input.pads([{ connected: true, axes: [0, 0, 0, 0], buttons } as never]);
        step(g);
        g.engine.input.pads([{ connected: true, axes: [0, 0, 0, 0], buttons: PAD_BUTTONS.map(() => false) } as never]);
        step(g);
      };
      pad("right");
      expect(focused(g)).toBe(1);
      pad("a");
      step(g, 2);
      expect(py(g, "global_vars.director.level")).toBe(1);
      expect(py(g, "global_vars.director.cursor is not None")).toBe(true);
      const c = py<number>(g, "global_vars.director.tubes.index(global_vars.director.cursor)");
      pad("right");
      expect(py<number>(g, "global_vars.director.tubes.index(global_vars.director.cursor)")).toBe(c + 1);
      pad("b");
      step(g, 2);
      expect(py(g, "room_name()")).toBe("Title");
    }, 60_000);

    it("the levels come two pages of 24: arrows reach the page button, and Esc from level 30 comes back to its page", async () => {
      const g = await start({ stars_28: 1, stars_23: 1 });
      expect(py(g, "len(LEVELS)")).toBe(48);
      expect(py(g, "global_vars.page")).toBe(0);
      expect(py(g, "sum(1 for c in instances('LevelCard') if c.shown)")).toBe(24);
      // Only level 1 is open on this page: down goes to the buttons below, right along them.
      press(g, "down");
      expect(focused(g)).toBe("Shapes: off");
      press(g, "right");
      expect(focused(g)).toBe("Levels 25-48 >");
      press(g, "space");
      expect(py(g, "global_vars.page")).toBe(1);
      expect(py(g, "sorted(c.i for c in instances('LevelCard') if c.shown)")).toEqual(Array.from({ length: 24 }, (_, k) => k + 24));
      // Level 30 (index 29) is open: its card is where level 6's was.
      click(g, ...cardAt(29));
      step(g, 2);
      expect(py(g, "global_vars.director.level")).toBe(29);
      press(g, "escape");
      step(g, 2);
      expect(py(g, "[room_name(), global_vars.page]")).toEqual(["Title", 1]);
      expect(focused(g)).toBe(29);
      // Back to the first page with the mouse too.
      click(g, 512 - 75 - 170 + 75, 470 + 22);
      expect(py(g, "global_vars.page")).toBe(0);
    }, 60_000);

    it("the cursor shows once a key is used, and hides when the mouse moves", async () => {
      const g = await level(2);
      step(g);
      expect(py(g, "keyed()")).toBe(false);
      press(g, "right");
      expect(py(g, "keyed()")).toBe(true);
      const box = () => g.engine.drawList.filter((c) => c[0] === "rect" && c[6] === 0xffd23f).length;
      expect(box()).toBeGreaterThan(0);
      g.engine.input.mouseMove(300, 300);
      step(g, 2);
      expect(py(g, "keyed()")).toBe(false);
      expect(box()).toBe(0);
    }, 60_000);

    it("the new levels get harder: fewer empty tubes, more covered, and a higher par than the first 24", async () => {
      const g = await start();
      const [early, late] = py<[number, number]>(g,
        "[sum(l['par'] for l in LEVELS[:24]) / 24, sum(l['par'] for l in LEVELS[24:]) / 24]");
      expect(late).toBeGreaterThan(early + 5);
      expect(py(g, "sum(1 for l in LEVELS[24:] if l['tubes'].count('') == 1)")).toBeGreaterThan(10);
      expect(py(g, "sum(1 for l in LEVELS[24:] if l['hidden'])")).toBeGreaterThan(10);
    }, 60_000);

    it("the bot finishes level 25 in par", async () => {
      const g = await level(24);
      const n = solveByTapping(g);
      expect(n).toBe(py(g, "LEVELS[24]['par']"));
      step(g, 3);
      expect(py(g, "global_vars.director.won")).toBe(true);
    }, 120_000);
  });
});
