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
  expect(py(g, "g.mode")).toBe("menu");
  step(g, 12);
  press(g, "down");
  press(g, "down");
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

/** Drives by holding keys, a person's way, until the game says so, using any item it holds. */
function driveBot(g: PythonGame, until: () => boolean, most = 30000) {
  let held = "";
  hold(g, "up", true);
  for (let i = 0; i < most && !until(); i++) {
    if (i % 50 === 0 && py(g, "bool(RACE['karts'][0].item or RACE['karts'][0].turbos)")) press(g, "space");
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
    expect(py(g, "instance_number('ItemBox')")).toBe(16);   // four rows of four
    expect(py(g, "instance_number('BoostPad')")).toBe(2);
    expect(py(g, "instance_number('Scenery') == instance_number('Hedge') + instance_number('Tree') + instance_number('ItemBox')")).toBe(true);
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
    expect(py(g, "g.mode")).toBe("standings");
    // One race of a cup paid its points, by place.
    expect(py(g, "sum(g.cup_points)")).toBe(39);
    expect(py(g, "g.cup_race")).toBe(1);
    step(g, 45);
    press(g, "space");
    expect(py(g, "g.mode")).toBe("race");
    expect(py(g, "RACE['track']['name']")).toBe("Cactus Canyon");
  }, 240_000);

  it("the computer's drivers finish the race on their own, faster ones first", async () => {
    const g = await start();
    // Off the title, whose demo starts again as soon as anyone finishes.
    // With no items or pads: this is about their skill, and a bolt in the back isn't.
    py(g, "g.mode = 'watching'\nnew_race(0)\nRACE['count'] = 0\nfor b in instances('ItemBox') + instances('BoostPad'):\n    b.destroy()");
    for (let i = 0; i < 12000 && !py(g, "all(c.done for c in RACE['karts'])"); i++) step(g);
    expect(py(g, "all(c.done for c in RACE['karts'])")).toBe(true);
    // Nobody stuck in a hedge: each took about what the fastest took.
    expect(py(g, "max(c.done for c in RACE['karts']) < 1.25 * min(c.done for c in RACE['karts'])")).toBe(true);
    // Skill decides it: best beats worst, over three laps.
    // Rosie and Gus have the same top speed, and Gus starts in front: only skill can do it.
    expect(py(g, "next(c for c in RACE['karts'] if c.who == 0).done < next(c for c in RACE['karts'] if c.who == 7).done")).toBe(true);
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

  it.each([0, 1, 2, 3])("the hedges hold all the way round track %i: no kart gets through, on either side", async (t) => {
    const g = await racing();
    py(g, `g.mode = 'watching'
new_race(${t}, 0)
RACE['count'] = 0
you = RACE['karts'][0]
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
    you.spin = 0
for b in instances('BoostPad') + instances('ItemBox'):
    b.destroy()
worst = 0`);
    hold(g, "up", true);
    const points = py(g, "n") as number;
    for (let i = 0; i < points; i += 5) {
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

  it("every track can be raced: the computer's drivers finish each, items and all", async () => {
    const g = await start();
    py(g, "g.mode = 'watching'");
    for (let t = 0; t < 4; t++) {
      py(g, `new_race(${t})\nRACE['count'] = 0`);
      for (let i = 0; i < 16000 && !py(g, "all(c.done for c in RACE['karts'])"); i++) step(g);
      expect(py(g, "RACE['track']['name']")).toBe(py(g, `TRACKS[${t}]['name']`));
      expect(py(g, "all(c.done for c in RACE['karts'])")).toBe(true);
      // An item can cost a driver a few seconds; a driver stuck somewhere costs far more.
      expect(py(g, "max(c.done for c in RACE['karts']) < 1.35 * min(c.done for c in RACE['karts'])")).toBe(true);
    }
  }, 400_000);

  it("a cup is four races, and its result is kept", async () => {
    const g = await start();
    py(g, "g.cup_points = [0] * 8\ng.racer = 2\ng.cup_race = 0\nnew_race(0, 2)\ng.mode = 'race'");
    for (let t = 0; t < 4; t++) {
      expect(py(g, "RACE['track_i']")).toBe(t);
      expect(py(g, "g.mode")).toBe("race");
      py(g, "RACE['count'] = 0\nRACE['karts'][0].progress = RACE['track']['laps'] * len(RACE['line'])");
      step(g, 2);
      expect(py(g, "g.mode")).toBe("results");
      step(g, 45);
      press(g, "space");
      expect(py(g, "g.mode")).toBe("standings");
      step(g, 45);
      if (t < 3) press(g, "space");
    }
    // Finished first in every one, by the shortcut above.
    expect(py(g, "g.cup_points[2]")).toBe(40);
    expect(g.saved()).toMatchObject({ cup_best: 1 });
    expect(py(g, "cup_table(g)[0]")).toBe(2);
    press(g, "space");
    expect(py(g, "g.mode")).toBe("title");
    expect(py(g, "instance_number('PlayerKart')")).toBe(0);
  }, 120_000);

  it("the menu picks the racer, the mode and a time trial's track", async () => {
    const g = await start();
    press(g, "space");
    step(g, 12);
    expect(py(g, "menu_rows(g)")).toEqual(["mode", "racer", "go"]);
    press(g, "right");                // Time trial
    expect(py(g, "MODES[g.mode_i]")).toBe("Time trial");
    expect(py(g, "menu_rows(g)")).toEqual(["mode", "racer", "track", "go"]);
    press(g, "down");
    press(g, "right");
    press(g, "right");
    expect(py(g, "RACERS[g.racer]['name']")).toBe("Juniper");
    press(g, "down");
    press(g, "right");
    expect(py(g, "TRACKS[g.track_i]['name']")).toBe("Cactus Canyon");
    press(g, "down");
    press(g, "space");
    expect(py(g, "g.mode")).toBe("race");
    expect(py(g, "RACE['track']['name']")).toBe("Cactus Canyon");
    expect(py(g, "RACE['karts'][0].who")).toBe(2);
    expect(py(g, "RACE['karts'][0].sprite")).toBe("kart_2");
    expect(py(g, "instance_number('Kart')")).toBe(1);      // alone
    expect(py(g, "RACE['karts'][0].turbos")).toBe(3);
    // Each track's scenery is its own.
    expect(py(g, "instances('Hedge')[0].sprite")).toBe("bush_1");
  }, 60_000);

  it("racers drive differently: their numbers reach the kart", async () => {
    const g = await start();
    const run = (who: number) => {
      py(g, `new_race(0, ${who}, False)\nRACE['count'] = 0\ny = RACE['karts'][0]\ny.gas, y.steer, y.drifting = True, 0, False\ny.x, y.y = RACE['line'][20]\ny.i = 20\ny.a = y.move_a = 90\nfor _ in range(60):\n    y.x, y.y = RACE['line'][20]\n    y.on_step()`);
      return py(g, "y.v") as number;
    };
    expect(run(6)).toBeGreaterThan(run(1));          // Pepper picks up quicker than Otto
    const turn = (who: number) => {
      py(g, `new_race(0, ${who}, False)\nRACE['count'] = 0\ny = RACE['karts'][0]\ny.v = 4.0\ny.gas, y.steer, y.drifting = True, 1, False\nb = y.a\ny.x, y.y = RACE['line'][20]\ny.on_step()`);
      return Math.abs(py(g, "angle_diff(y.a, b)") as number);
    };
    expect(turn(4)).toBeGreaterThan(turn(3));        // Wren turns tighter than Mack
    expect(py(g, "RACE['karts'][0].top_k")).toBe(py(g, "RACERS[3]['top']"));
  }, 60_000);

  it("ice slides: on Frostbite Pass a kart takes longer to go where it points", async () => {
    const g = await start();
    const lag = (t: number) => {
      py(g, `new_race(${t}, 0, False)\nRACE['count'] = 0\ny = RACE['karts'][0]\ny.gas, y.steer, y.drifting = True, 0, False\ny.v = 4.0\ny.x, y.y = RACE['line'][20]\ny.a = 90\ny.move_a = 60\ny.on_step()`);
      return Math.abs(py(g, "angle_diff(y.a, y.move_a)") as number);
    };
    expect(lag(2)).toBeGreaterThan(lag(0));
  }, 60_000);

  it("an item box gives one item, only to a hand that's empty, and comes back", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
box = instances('ItemBox')[0]
for c in RACE['karts'][1:]:
    c.x, c.y = 10, 10`);
    const onBox = () => {
      // Told where it is on the road too: a kart far from where it thinks it is gets put back.
      py(g, "you.x, you.y = box.x, box.y\nyou.i = min(range(len(RACE['line'])), key=lambda i: math.hypot(RACE['line'][i][0] - box.x, RACE['line'][i][1] - box.y))");
      step(g);
    };
    onBox();
    expect(py(g, "you.item in ITEMS")).toBe(true);
    expect(py(g, "box.ready")).toBe(false);
    const had = py(g, "you.item");
    // Away from it, and everyone else too, or the box goes again the moment it's back.
    py(g, "far = (you.i + 60) % len(RACE['line'])");
    for (let i = 0; i < 250; i++) {
      py(g, "for c in RACE['karts']:\n    c.i = (far + c.who * 2) % len(RACE['line'])\n    c.x, c.y = RACE['line'][c.i]\n    c.v = 0");
      step(g);
    }
    expect(py(g, "box.ready")).toBe(true);
    onBox();
    expect(py(g, "you.item")).toBe(had);     // a full hand keeps what it has
    expect(py(g, "box.ready")).toBe(false);  // and the box is still used up
  }, 60_000);

  it("what you get depends on where you are", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
def picks(place):
    you.place = place
    return set(pick_item(you) for _ in range(200))`);
    expect(py(g, "'bolt' in picks(1)")).toBe(false);
    expect(py(g, "'bolt' in picks(8)")).toBe(true);
    expect(py(g, "'oil' in picks(8)")).toBe(false);
    expect(py(g, "'oil' in picks(1)")).toBe(true);
  }, 60_000);

  it("each item does its job: a turbo, a shield, a slick and a bolt", async () => {
    const g = await racing();
    py(g, `you = RACE['karts'][0]
them = RACE['karts'][1]
for c in RACE['karts'][2:]:
    c.x, c.y = 10, 10
def open_road():
    you.x, you.y = RACE['line'][60]
    you.i = 60
    you.spin = you.boost = you.shield = 0
    them.spin = them.boost = them.shield = 0
    them.x, them.y = RACE['line'][66]
    them.i = 66
    you.v = them.v = 0`);
    py(g, "open_road()\nyou.item = 'turbo'");
    press(g, "space");
    expect(py(g, "you.boost")).toBeGreaterThan(0);
    expect(py(g, "you.item is None")).toBe(true);
    py(g, "open_road()\nyou.item = 'shield'");
    press(g, "space");
    expect(py(g, "you.shield")).toBeGreaterThan(0);
    // A shield takes the hit, once.
    expect(py(g, "spin_out(you)")).toBe(false);
    expect(py(g, "you.spin")).toBe(0);
    expect(py(g, "spin_out(you)")).toBe(true);
    expect(py(g, "you.spin")).toBeGreaterThan(0);
    // Spun out, the keys do nothing and it slows.
    py(g, "open_road()\nyou.v = 4.0\nspin_out(you)");
    py(g, "you.spin, you.v, you.gas = 30, 1.0, True\nyou.on_step()");
    expect(py(g, "you.v")).toBeLessThan(1);          // the gas would speed it up
    expect(py(g, "you.gas")).toBe(false);
    // A slick spares the kart that dropped it, for a moment, and stops whoever's next.
    py(g, "open_road()\nyou.item = 'oil'");
    press(g, "space");
    expect(py(g, "instance_number('OilSlick')")).toBe(1);
    expect(py(g, "you.spin")).toBe(0);
    py(g, "slick = instances('OilSlick')[0]\nyou.x, you.y = slick.x, slick.y");
    step(g);
    expect(py(g, "you.spin")).toBe(0);
    py(g, "them.x, them.y = slick.x, slick.y");
    step(g, 2);
    expect(py(g, "them.spin")).toBeGreaterThan(0);
    expect(py(g, "instance_number('OilSlick')")).toBe(0);
    // A bolt spares the kart that fired it, even right on top of it.
    py(g, "open_road()\nown = instance_create(you.x, you.y, 'Bolt')\nown.owner = you\nown.i = you.i");
    step(g);
    expect(py(g, "you.spin")).toBe(0);
    expect(py(g, "instance_number('Bolt')")).toBe(1);
    py(g, "own.destroy()");
    step(g);
    // A bolt goes for the kart ahead, not the kart that fired it.
    py(g, "open_road()\nyou.progress, them.progress = 60.0, 66.0\nyou.place, them.place = 2, 1\nfor c in RACE['karts'][2:]:\n    c.place = 8\nyou.item = 'bolt'");
    hold(g, "space", true);
    step(g);
    hold(g, "space", false);
    expect(py(g, "instance_number('Bolt')")).toBe(1);
    expect(py(g, "instances('Bolt')[0].target is them")).toBe(true);
    for (let i = 0; i < 80 && py(g, "instance_number('Bolt')"); i++) {
      py(g, "them.x, them.y = RACE['line'][66]\nthem.v = 0\nthem.i = 66\nyou.x, you.y = RACE['line'][60]\nyou.v = 0\nyou.i = 60");
      step(g);
    }
    expect(py(g, "instance_number('Bolt')")).toBe(0);
    expect(py(g, "them.spin")).toBeGreaterThan(0);
    expect(py(g, "you.spin")).toBe(0);
  }, 60_000);

  it("a computer driver uses what it picks up", async () => {
    const g = await racing();
    py(g, "them = RACE['karts'][3]\nthem.item = 'turbo'\nthem.item_wait = 5");
    step(g, 10);
    expect(py(g, "them.item is None")).toBe(true);
    expect(py(g, "them.boost")).toBeGreaterThan(0);
  }, 60_000);

  it("a boost pad boosts whoever drives over it, where the picture shows it", async () => {
    const g = await racing();
    py(g, "you = RACE['karts'][0]\npad = instances('BoostPad')[0]\nx, y, a = pad_places(RACE['track'])[0]");
    expect(py(g, "(round(pad.x), round(pad.y))")).toEqual(py(g, "(round(x), round(y))"));
    py(g, "you.x, you.y = pad.x, pad.y\nyou.i = min(range(len(RACE['line'])), key=lambda i: math.hypot(RACE['line'][i][0] - pad.x, RACE['line'][i][1] - pad.y))\nyou.boost = 0\nyou.spin = 0");
    step(g);
    expect(py(g, "you.boost")).toBeGreaterThan(0);
  }, 60_000);

  it("a time trial keeps your best run, and it drives beside you next time", async () => {
    const g = await start();
    py(g, "g.mode, g.mode_i = 'race', 1\nnew_race(0, 0, False)\nRACE['count'] = 0");
    expect(py(g, "instance_number('Ghost')")).toBe(0);
    hold(g, "up", true);
    step(g, 200);
    hold(g, "up", false);
    py(g, "RACE['karts'][0].progress = 3.0 * len(RACE['line'])");
    step(g, 2);
    expect(py(g, "g.mode")).toBe("results");
    const saved = g.saved() as Record<string, [number, number, number][]>;
    const path = saved["ghost_Sunny Meadow"]!;
    expect(path.length).toBeGreaterThan(40);
    // A second run: the ghost is there, and goes where the first run went.
    py(g, "g.mode = 'race'\nnew_race(0, 0, False)\nRACE['count'] = 0");
    expect(py(g, "instance_number('Ghost')")).toBe(1);
    step(g, 60);
    const at = (py(g, "RACE['steps'] // PATH_EVERY") as number);
    expect(py(g, "instances('Ghost')[0].x")).toBeCloseTo(path[at]![0], 1);
    expect(py(g, "instances('Ghost')[0].y")).toBeCloseTo(path[at]![1], 1);
    // A slower run leaves the ghost alone.
    py(g, "g.best = None");
    step(g, 400);
    py(g, "RACE['karts'][0].progress = 3.0 * len(RACE['line'])");
    step(g, 2);
    expect((g.saved() as Record<string, unknown[]>)["ghost_Sunny Meadow"]!.length).toBe(path.length);
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
