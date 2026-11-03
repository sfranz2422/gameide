/**
 * The eighth showcase game, Zoomtown Cup (a kart racer on draw_floor), played
 * headless in the real Pyodide. A bot drives a whole race through the game's
 * own keys, from the title to the results; then the rules one at a time:
 * the objects are there, laps can't be cheated, the grass, the hedges all the
 * way round, karts bumping, drifting and its boosts, the computer's drivers,
 * and the build refusing a track that can't be raced.
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
  it("is objects: a player, seven computer drivers, and hedges and trees along the road", async () => {
    const g = await racing();
    expect(py(g, "instance_number('Kart')")).toBe(8);
    expect(py(g, "instance_number('PlayerKart')")).toBe(1);
    expect(py(g, "instance_number('ComputerKart')")).toBe(7);
    expect(py(g, "instance_number('Hedge')")).toBeGreaterThan(150);
    expect(py(g, "instance_number('Tree')")).toBeGreaterThan(10);
    expect(py(g, "instance_number('Scenery') == instance_number('Hedge') + instance_number('Tree')")).toBe(true);
  }, 60_000);

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
    expect(py(g, "instance_number('PlayerKart')")).toBe(0);
  }, 240_000);

  it("the computer's drivers finish the race on their own, faster ones first", async () => {
    const g = await start();
    // Off the title, whose demo starts again as soon as anyone finishes.
    py(g, "g.mode = 'watching'\nnew_race(g, False)\nRACE['count'] = 0");
    for (let i = 0; i < 12000 && !py(g, "all(c.done for c in RACE['karts'])"); i++) step(g);
    expect(py(g, "all(c.done for c in RACE['karts'])")).toBe(true);
    // Nobody stuck in a hedge: each took about what the fastest took.
    expect(py(g, "max(c.done for c in RACE['karts']) < 1.25 * min(c.done for c in RACE['karts'])")).toBe(true);
    // Skill decides it: best beats worst, over three laps.
    expect(py(g, "RACE['karts'][1].done < RACE['karts'][7].done")).toBe(true);
  }, 240_000);

  it("a computer driver lifts for a sharp bend coming, not on a straight", async () => {
    const g = await start();
    py(g, `bend_line = [(i * STEP, 0.0) for i in range(40)] + [(39 * STEP, (i + 1) * STEP) for i in range(40)]
def lifts(i):
    keep = RACE["line"]
    RACE["line"] = bend_line
    k = RACE["karts"][1]
    k.x, k.y = bend_line[i]
    k.a, k.i, k.v = 0, i, 3.5
    gas = computer_keys(k, 0.97)[0]
    RACE["line"] = keep
    return gas`);
    expect(py(g, "lifts(10)")).toBe(true);
    expect(py(g, "lifts(28)")).toBe(false);
  }, 60_000);

  it("a lap is the whole road: backing over the line pays nothing", async () => {
    const g = await racing();
    const to = (i: string) => {
      py(g, `you.x, you.y = RACE['line'][${i}]`);
      step(g);
    };
    py(g, "you = RACE['karts'][0]\nn = len(RACE['line'])\nyou.i = 2\nyou.progress = 2.0");
    to("2");
    expect(py(g, "you.lap")).toBe(1);
    to("n - 3");
    expect(py(g, "you.lap")).toBe(0);
    to("4");
    expect(py(g, "you.lap")).toBe(1);
    expect(py(g, "len(RACE['lap_times'])")).toBe(0);
  }, 60_000);

  it("can't jump to another stretch of the road", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
p = you.progress
you.x, you.y = RACE['line'][(you.i + 200) % len(RACE['line'])]`);
    step(g);
    expect(py(g, "you.progress - p")).toBeLessThanOrEqual(14);
  }, 60_000);

  it("the grass slows you, not the road", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
line = RACE['line']
def beside(k):
    ax, ay = line[you.i]
    bx, by = line[(you.i + 1) % len(line)]
    tx, ty = (bx - ax) / STEP, (by - ay) / STEP
    you.x, you.y = ax - ty * k, ay + tx * k
    you.a = you.move_a = math.degrees(math.atan2(-ty, tx))`);
    hold(g, "up", true);
    py(g, "beside(30)\nyou.v = 4.0");
    step(g);
    expect(py(g, "you.on_grass")).toBe(false);
    py(g, "beside(60)\nyou.v = 4.0");
    step(g);
    expect(py(g, "you.on_grass")).toBe(true);
    for (let i = 0; i < 50; i++) {
      py(g, "beside(60)");
      step(g);
    }
    expect(py(g, "you.v")).toBeLessThan(2.1);
    py(g, "beside(0)");
    for (let i = 0; i < 90; i++) {
      py(g, "beside(0)");
      step(g);
    }
    expect(py(g, "you.v")).toBeGreaterThan(3.5);
    hold(g, "up", false);
  }, 60_000);

  it("the hedges hold all the way round: no kart gets through, on either side", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
line = RACE['line']
n = len(line)
wall = RACE['track']['half'] + RACE['track']['verge']
def aim(i, side):
    ax, ay = line[i]
    bx, by = line[(i + 1) % n]
    tx, ty = (bx - ax) / STEP, (by - ay) / STEP
    nx, ny = -ty * side, tx * side
    # From the road's edge, as a kart really gets there: put down right at a hedge
    # it can land inside one's corner on a bend, and a kart inside a box isn't stopped.
    you.x, you.y = ax + nx * (wall - 44), ay + ny * (wall - 44)
    you.i = i
    you.a = you.move_a = math.degrees(math.atan2(-ny, nx))
    you.v = 4.0
    you.boost = 0
worst = 0`);
    hold(g, "up", true);
    const points = py(g, "n") as number;
    for (let i = 0; i < points; i += 3) {
      for (const side of [-1, 1]) {
        py(g, `aim(${i}, ${side})`);
        for (let k = 0; k < 40; k++) {
          // Others might shove it: this asks only about the hedge, so they stay out of it.
          py(g, "for c in RACE['karts'][1:]:\n    c.x, c.y = 10, 10");
          step(g);
          py(g, "worst = max(worst, you.off)");
        }
      }
    }
    hold(g, "up", false);
    // Short of the middle of the hedge's box. Not short of the wall: at a sharp corner a
    // kart can stop in the pocket where two hedges meet, a little past the wall's line.
    expect(py(g, "worst")).toBeLessThan(py(g, "wall + 22"));
    expect(py(g, "worst")).toBeGreaterThan(py(g, "wall - 20"));   // it did reach them
  }, 300_000);

  it("a hedge takes your speed; a kart that gets out anyway is put back", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
line = RACE['line']
ax, ay = line[you.i]
bx, by = line[(you.i + 1) % len(line)]
tx, ty = (bx - ax) / STEP, (by - ay) / STEP
wall = RACE['track']['half'] + RACE['track']['verge']
you.x, you.y = ax - ty * (wall - 14), ay + tx * (wall - 14)
you.a = you.move_a = math.degrees(math.atan2(-tx, -ty))
you.v = 4.0
you.gas = True
slowest = 4.0
for _ in range(4):
    you.on_grass = False      # only the hedge can be what slows it
    you.on_step()
    slowest = min(slowest, you.v)`);
    expect(py(g, "slowest")).toBeLessThan(3);
    py(g, "you.x, you.y = ax - ty * (wall + LOST + 40), ay + tx * (wall + LOST + 40)");
    step(g, 2);
    expect(py(g, "you.off")).toBeLessThan(py(g, "RACE['track']['half']"));
  }, 60_000);

  it("two karts can't share a place: the engine's collision moves them apart", async () => {
    const g = await racing();
    py(g, `a, b = RACE['karts'][2], RACE['karts'][3]
x, y = RACE['line'][40]
a.x, a.y, b.x, b.y = x, y, x + 6, y
a.i = b.i = 40`);
    step(g, 2);
    expect(py(g, "math.hypot(a.x - b.x, a.y - b.y)")).toBeGreaterThan(14);
  }, 60_000);

  it("drifting earns a boost for how long it lasted, paid only on letting go", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
def drift_for(steps):
    you.boost, you.drift, you.charge = 0, 0, 0
    you.on_grass = False
    you.gas, you.steer, you.drifting = True, -1, True
    for _ in range(steps):
        you.x, you.y = RACE['line'][50]
        you.i = 50
        you.v = max(you.v, 3.5)
        you.on_grass = False
        you.on_step()
    was = you.drift
    you.drifting = False
    you.x, you.y = RACE['line'][50]
    you.on_step()
    return was`);
    expect(py(g, "drift_for(10)")).toBe(-1);
    expect(py(g, "you.boost")).toBe(0);
    py(g, "drift_for(60)");
    const small = py(g, "you.boost") as number;
    expect(small).toBeGreaterThan(0);
    py(g, "drift_for(120)");
    expect(py(g, "you.boost")).toBeGreaterThan(small);
    // A boost goes faster than the kart's top speed; afterwards, back down to it.
    py(g, `def run(k):
    for _ in range(k):
        you.x, you.y = RACE['line'][50]
        you.on_grass = False
        you.on_step()
you.gas, you.steer, you.drifting = True, 0, False
you.v = 4.0
you.boost = 60
run(59)`);
    expect(py(g, "you.v")).toBeGreaterThan(py(g, "STATS['top']"));
    expect(py(g, "you.v")).toBeLessThanOrEqual(py(g, "STATS['boost_top']"));
    py(g, "run(200)");
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
