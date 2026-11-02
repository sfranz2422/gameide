/**
 * The eighth showcase game, Zoomtown Cup (a kart racer on draw_floor), played
 * headless in the real Pyodide. A bot drives a whole race through the game's
 * own keys, from the title to the results; then the rules one at a time:
 * laps can't be cheated, the grass and the hedges, drifting and its boosts,
 * the computer's drivers, and the build refusing a track that can't be raced.
 * Runs when the game has been built (python3 showcase/kart/build.py).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/kart/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  py(game, `g = instances('Game')[0]\n${BOT}`);
  return Object.assign(game, { saved: () => saved });
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
function hold(g: PythonGame, key: string, down: boolean) {
  if (down) g.engine.input.keyDown(KEY_CODE.get(key)!);
  else g.engine.input.keyUp(KEY_CODE.get(key)!);
}
function press(g: PythonGame, key: string) {
  hold(g, key, true);
  step(g);
  hold(g, key, false);
  step(g);
}
/** Into a race, through the title, and past the countdown. */
async function racing(save: Record<string, unknown> = {}) {
  const g = await start(save);
  press(g, "space");
  expect(py(g, "g.mode")).toBe("race");
  step(g, 182);
  return g;
}

/** The bot, in Python: looks along the road and answers which keys it would hold. */
const BOT = `
import math
def bot_keys(look=7):
    you, line = RACE["karts"][0], RACE["line"]
    n = len(line)
    tx, ty = line[(you.i + look + int(you.v)) % n]
    want = math.degrees(math.atan2(-(ty - you.y), tx - you.x))
    d = angle_diff(want, you.a)
    return ("right" if d < -3 else "left" if d > 3 else "")
`;

/** Drives by holding keys, a person's way, until the game says so. */
function driveBot(g: PythonGame, until: () => boolean, most = 20000) {
  let held = "";
  hold(g, "up", true);
  for (let i = 0; i < most && !until(); i++) {
    const want = py(g, "bot_keys()") as string;
    if (want !== held) {
      if (held) hold(g, held, false);
      if (want) hold(g, want, true);
      held = want;
    }
    step(g);
  }
  if (held) hold(g, held, false);
  hold(g, "up", false);
}

describe.runIf(have)("Zoomtown Cup", () => {
  it("is driven through a whole race, from the title to the results", async () => {
    const g = await racing();
    driveBot(g, () => py(g, "g.mode") === "results");
    expect(py(g, "g.mode")).toBe("results");
    expect(py(g, "RACE['karts'][0].lap")).toBe(3 + 1);
    expect(py(g, "1 <= RACE['karts'][0].place <= 8")).toBe(true);
    // Three laps of about 6500 pixels at about 4 a step: it took a real race's time.
    const steps = py(g, "RACE['karts'][0].done") as number;
    expect(steps).toBeGreaterThan(3 * 1200);
    expect(steps).toBeLessThan(3 * 3000);
    expect(py(g, "len(RACE['lap_times'])")).toBe(3);
    // Kept between visits, and only a better time replaces it.
    expect(g.saved()).toMatchObject({ "best_Sunny Meadow": steps });
    expect(py(g, `keep_best("Sunny Meadow", ${steps + 10})`)).toBe(false);
    expect(g.saved()).toMatchObject({ "best_Sunny Meadow": steps });
    expect(py(g, `keep_best("Sunny Meadow", ${steps - 10})`)).toBe(true);
    step(g, 45);
    press(g, "space");
    expect(py(g, "g.mode")).toBe("title");
  }, 120_000);

  it("the computer's drivers finish the race on their own, faster ones first", async () => {
    const g = await start();
    py(g, "start_race(0, player=False)\nRACE['count'] = 0");
    for (let i = 0; i < 12000 && !py(g, "all(c.done for c in RACE['karts'])"); i++) {
      py(g, "race_step(False, False, 0, False)");
    }
    expect(py(g, "all(c.done for c in RACE['karts'])")).toBe(true);
    // Nobody stuck in a hedge: each lap took about what the fastest took.
    expect(py(g, "max(c.done for c in RACE['karts']) < 1.25 * min(c.done for c in RACE['karts'])")).toBe(true);
    // Skill decides it: best beats worst, over three laps.
    expect(py(g, "RACE['karts'][1].done < RACE['karts'][7].done")).toBe(true);
  }, 120_000);

  it("a computer driver lifts for a sharp bend coming, not on a straight", async () => {
    const g = await start();
    py(g, `bend_line = [(i * STEP, 0.0) for i in range(40)] + [(39 * STEP, (i + 1) * STEP) for i in range(40)]
def lifts(i):
    k = Kart(bend_line[i][0], bend_line[i][1], 0, 1)
    k.i = i
    k.v = 3.5
    return computer_keys(k, bend_line, RACE["track"], 0.97)[0]`);
    expect(py(g, "lifts(10)")).toBe(true);
    expect(py(g, "lifts(28)")).toBe(false);
  }, 60_000);

  it("a lap is the whole road: backing over the line pays nothing", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
n = len(RACE['line'])
you.i = 2
you.progress = 2.0
x, y = RACE['line'][2]
you.x, you.y = x, y
race_step(False, False, 0, False)
first = you.lap
x, y = RACE['line'][n - 3]
you.x, you.y = x, y
race_step(False, False, 0, False)
back = you.lap
x, y = RACE['line'][4]
you.x, you.y = x, y
race_step(False, False, 0, False)
again = you.lap`);
    expect(py(g, "first")).toBe(1);
    expect(py(g, "back")).toBe(0);
    expect(py(g, "again")).toBe(1);
    expect(py(g, "len(RACE['lap_times'])")).toBe(0);
  }, 60_000);

  it("can't jump to another stretch of the road", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
p = you.progress
x, y = RACE['line'][(you.i + 200) % len(RACE['line'])]
you.x, you.y = x, y
race_step(False, False, 0, False)
gained = you.progress - p`);
    expect(py(g, "gained")).toBeLessThanOrEqual(14);
  }, 60_000);

  it("the grass slows you, and the hedge stops you where the picture draws it", async () => {
    const g = await racing();
    const offRoad = (k: number) => `you = RACE['karts'][0]
line = RACE['line']
ax, ay = line[you.i]
bx, by = line[(you.i + 1) % len(line)]
tx, ty = (bx - ax) / STEP, (by - ay) / STEP
you.x, you.y = ax - ty * ${k}, ay + tx * ${k}
you.v = 4.0
you.a = you.move_a = math.degrees(math.atan2(-ty, tx))
race_step(True, False, 0, False)`;
    py(g, offRoad(30));
    expect(py(g, "you.on_grass")).toBe(false);
    py(g, offRoad(60));
    expect(py(g, "you.on_grass")).toBe(true);
    for (let i = 0; i < 60; i++) py(g, "race_step(True, False, 0, False)");
    expect(py(g, "you.v")).toBeLessThan(2.1);
    py(g, offRoad(200));
    expect(py(g, "you.off")).toBeLessThanOrEqual(84.01);
    expect(py(g, "you.v")).toBeLessThan(3);
  }, 60_000);

  it("drifting earns a boost for how long it lasted, paid only on letting go", async () => {
    const g = await racing();
    const drift = (steps: number) => {
      py(g, `you = RACE['karts'][0]
you.v = 4.0
you.boost = 0
you.drift = 0
you.on_grass = False
RACE['track'] = dict(RACE['track'], half=10**6, verge=10)
what = []`);
      for (let i = 0; i < steps; i++) py(g, "what += drive(you, True, False, -1, True, RACE['track'], RACE['line'])\nyou.v = max(you.v, 3.5)");
      py(g, "what += drive(you, True, False, -1, False, RACE['track'], RACE['line'])");
    };
    drift(10);
    expect(py(g, "'drift' in what")).toBe(true);
    expect(py(g, "you.boost")).toBe(0);
    drift(60);
    expect(py(g, "'boost' in what")).toBe(true);
    const small = py(g, "you.boost") as number;
    expect(small).toBeGreaterThan(0);
    drift(120);
    expect(py(g, "you.boost")).toBeGreaterThan(small);
    // A boost goes faster than the kart's top speed; afterwards, back down to it.
    py(g, "you.v = 4.0\nyou.boost = 60\nfor _ in range(59): drive(you, True, False, 0, False, RACE['track'], RACE['line'])");
    expect(py(g, "you.v")).toBeGreaterThan(py(g, "STATS['top']"));
    expect(py(g, "you.v")).toBeLessThanOrEqual(py(g, "STATS['boost_top']"));
    py(g, "for _ in range(200): drive(you, True, False, 0, False, RACE['track'], RACE['line'])");
    expect(py(g, "you.v")).toBeLessThanOrEqual(py(g, "STATS['top'] + 0.001"));
  }, 60_000);

  it("nothing moves before the lights: the countdown holds the karts", async () => {
    const g = await start();
    press(g, "space");
    hold(g, "up", true);
    const x = py(g, "RACE['karts'][0].x") as number;
    step(g, 170);
    expect(py(g, "RACE['karts'][0].x")).toBe(x);
    step(g, 40);
    expect(py(g, "RACE['karts'][0].v")).toBeGreaterThan(0);
    hold(g, "up", false);
  }, 60_000);

  it("the views of a kart: from behind when it faces away, the side when across", async () => {
    const g = await start();
    py(g, "you = RACE['karts'][0]\nyou.x, you.y, you.a = 500, 500, 90");
    expect(py(g, "kart_frame(you, 500, 600)")).toBe(0);     // camera below it, nose up: from behind
    py(g, "you.a = 180");
    expect(py(g, "kart_frame(you, 500, 600)")).toBe(4);     // nose to the left
    py(g, "you.a = 0");
    expect(py(g, "kart_frame(you, 500, 600)")).toBe(12);    // nose to the right
    py(g, "you.a = 270");
    expect(py(g, "kart_frame(you, 500, 600)")).toBe(8);     // coming towards you
  }, 60_000);

  it("the picture is the road: road, kerb, grass and hedge are where the karts find them", () => {
    const out = execFileSync("python3", [resolve(__dirname, "../../../showcase/kart/check_paint.py")], { encoding: "utf8" });
    expect(out.trim()).toBe("ok");
  }, 60_000);

  it("the build refuses a track that can't be raced", () => {
    const check = (body: string) => execFileSync("python3", ["-c", `
exec(open(${JSON.stringify(resolve(__dirname, "../../../showcase/kart/game/_1tracks.py"))}).read())
t = dict(TRACKS[0])
${body}
print(track_problems(t))`], { encoding: "utf8" });
    expect(check("")).toBe("[]\n");
    expect(check("t['points'] = [(10, y) if x < 400 else (x, y) for x, y in t['points']]")).toMatch(/picture's edge/);
    // A figure of eight, well inside the picture.
    expect(check("t['points'] = [(500, 500), (1000, 300), (1500, 500), (1500, 1000), (1000, 1000), (500, 1000), (500, 1500), (1000, 1700), (1500, 1500), (1000, 1000)]")).toMatch(/passes itself/);
    // A square corner in open country: nothing near it but the corner.
    expect(check("t['points'] = [(x, 300) for x in range(300, 1660, 120)] + [(1620, y) for y in range(420, 1700, 120)] + [(300, 1620)]")).toMatch(/too sharp/);
  });
});
