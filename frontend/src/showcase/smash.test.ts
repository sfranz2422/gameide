/**
 * The tenth showcase game, Jelly Jailbreak (fling things at wobbly towers), played
 * headless in the real Pyodide with the real physics. Runs when the game has been
 * built (python3 showcase/smash/build.py, which needs only the repo).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/smash/out/project.json");
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
  return Object.assign(game, { saved: () => saved, scores });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
function click(g: PythonGame, x: number, y: number) {
  g.engine.input.mouseMove(x, y);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  g.engine.input.mouseUp(0);
  step(g);
}
const cardAt = (i: number): [number, number] => [24 + (i % 4) * 246 + 100, 140 + Math.floor(i / 4) * 62 + 28];
async function level(i: number) {
  const g = await start(i ? { [`stars_${i - 1}`]: 1 } : {});
  click(g, ...cardAt(i));
  step(g, 2);
  expect(py(g, "room_name()")).toBe(py(g, `LEVELS[${i}]['name']`));
  return g;
}
/** A real drag: press, pull, let go. */
function fling(g: PythonGame, dx: number, dy: number) {
  g.engine.input.mouseMove(500, 300);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  g.engine.input.mouseMove(500 + dx, 300 + dy);
  step(g, 3);
  g.engine.input.mouseUp(0);
  step(g);
}

/**
 * The bot, in Python: the pull that lands a shot on a point, by trying them with
 * the same flight_path the game draws its dots from. Low or high arc.
 */
const BOT = `
def bot_aim(tx, ty, high):
    best, at = 1e9, None
    for pull in range(40, MAX_PULL + 1, 5):
        for a in range(5, 85, 2):
            dx, dy = -pull * math.cos(math.radians(a)), pull * math.sin(math.radians(a))
            h, v = -dx * POWER, -dy * POWER
            x, y = shot_start(dx, dy)
            miss = 1e9
            for k in range(200):
                v += GRAVITY
                x += h
                y += v
                miss = min(miss, point_distance(x, y, tx, ty))
                if x > tx + 40:
                    break
            if miss < 14 and (a > 45) == high and -pull < best:
                best, at = -pull, [dx, dy]
    return at

def bot_target():
    jars = sorted(instances("Jar"), key=lambda j: (j.x, -j.y))
    return [jars[0].x, jars[0].y] if jars else None
`;

/** Plays a level with drags; a tap when a bomb or Trio is near. Answers with the shots used. */
function play(g: PythonGame, high: boolean) {
  py(g, BOT);
  for (let guard = 0; guard < 40; guard++) {
    if (py(g, "global_vars.mode") === "aim" && py(g, "instance_exists('Jar')")) {
      const t = py(g, "bot_target()") as unknown as number[];
      const at = py(g, `bot_aim(${t[0]}, ${t[1]}, ${high ? "True" : "False"})`) as unknown as number[] | null;
      if (!at) throw new Error("no way to aim at a jar");
      fling(g, at[0]!, at[1]!);
      const special = py(g, "len(instances('Trio')) + len(instances('Bomb'))") as number;
      if (special) {
        for (let k = 0; k < 300; k++) {
          const near = py(g, `any(point_distance(s.x, s.y, ${t[0]}, ${t[1]}) < 110 for s in instances("Shot"))`);
          if (near) { click(g, 500, 300); break; }
          step(g);
        }
      }
    }
    step(g, 30);
    const mode = py(g, "global_vars.mode");
    if (mode === "won" || mode === "lost") break;
  }
  return py(g, "global_vars.director.used") as number;
}

/**
 * A winning run at par for each level the plain bot can't manage: [pull x, pull y,
 * steps until the tap or null]. Physics is deterministic, so a run replays exactly.
 * Changing a level or a rule can break a run: then find new ones by playing each
 * level many times with sloppy aim, and pick a par from how often it's won.
 */
const RUNS: Record<number, [number, number, number | null][]> = {
  9: [[-39, 91, null], [-30, 99, 157]],
  10: [[-43, 98, null]],
  11: [[-104, 26, null]],
  12: [[-38, 86, null]],
  13: [[-67, 85, 26], [-84, 69, null]],
  14: [[-21, 111, null]],
  15: [[-102, 29, null]],
  16: [[-32, 99, null]],
  17: [[-35, 102, null], [-22, 94, 121]],
};

describe.runIf(have)("Jelly Jailbreak", () => {
  const N = have ? (JSON.parse(readFileSync(BUILT, "utf8")) as Project).rooms.length - 1 : 0;
  const all = Array.from({ length: N }, (_, i) => i);

  it.each(all)("level %i stands still until something hits it", async (i) => {
    const g = await level(i);
    const before = py(g, "[(b.x, b.y) for b in instances('Block')]") as unknown as number[][];
    step(g, 900);
    const after = py(g, "[(b.x, b.y, b.hp) for b in instances('Block')]") as unknown as number[][];
    expect(after.length).toBe(before.length);
    after.forEach((b, k) => {
      expect(Math.abs(b[0]! - before[k]![0]!)).toBeLessThan(3);
      expect(Math.abs(b[1]! - before[k]![1]!)).toBeLessThan(3);
      expect(b[2]).toBe(1);
    });
  }, 120_000);

  it.each(all.filter((i) => !(i in RUNS)))("a bot frees level %i, with three stars", async (i) => {
    let res = "";
    for (const high of [false, true]) {
      const g = await level(i);
      play(g, high);
      res = `${high ? "high" : "low"}: ${py(g, "global_vars.mode")}, ${py(g, "global_vars.director.used")} used, ${py(g, "instance_number('Jar')")} left`;
      if (py(g, "global_vars.mode") === "won" && py(g, "global_vars.director.stars") === 3) {
        step(g, 2);
        expect((g.saved() as Record<string, number>)[`stars_${i}`]).toBe(3);
        expect(py(g, "instance_number('Jelly')")).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error(res);
  }, 400_000);

  it.each(Object.keys(RUNS).map(Number))("level %i has a winning run at par", async (i) => {
    const g = await level(i);
    for (const [dx, dy, tap] of RUNS[i]!) {
      expect(py(g, "global_vars.mode")).toBe("aim");
      fling(g, dx, dy);
      if (tap !== null) {
        step(g, tap);
        click(g, 500, 300);
      }
      for (let k = 0; k < 900 && py(g, "global_vars.mode") === "flying"; k++) step(g);
      if (py(g, "not instance_exists('Jar')")) step(g, 60);
    }
    expect(py(g, "global_vars.mode")).toBe("won");
    expect(py(g, "global_vars.director.stars")).toBe(3);
  }, 60_000);

  it("the dots are where the shot goes", async () => {
    const g = await level(0);
    g.engine.input.mouseMove(500, 300);
    step(g);
    g.engine.input.mouseDown(0);
    step(g);
    g.engine.input.mouseMove(430, 360);
    step(g, 3);
    const path = py(g, "flight_path(global_vars.shot.x, global_vars.shot.y, -global_vars.sling.pull_x * POWER, -global_vars.sling.pull_y * POWER, 30)") as unknown as number[][];
    py(g, "s = global_vars.shot");
    g.engine.input.mouseUp(0);
    step(g);
    // The step that lets go is the shot's first step of flight.
    for (let k = 0; k < 30; k++) {
      expect(py(g, "s.x") as number).toBeCloseTo(path[k]![0]!, 0);
      expect(py(g, "s.y") as number).toBeCloseTo(path[k]![1]!, 0);
      step(g);
    }
  }, 60_000);

  it("the sling: a little pull isn't a shot, and a big one only goes so far", async () => {
    const g = await level(0);
    fling(g, -5, 5);
    expect(py(g, "global_vars.mode")).toBe("aim");
    expect(py(g, "global_vars.director.used")).toBe(0);
    expect(py(g, "global_vars.shot.x")).toBe(py(g, "SLING_X"));
    py(g, "s = global_vars.shot");
    fling(g, -400, 0);
    expect(py(g, "global_vars.director.used")).toBe(1);
    expect(py(g, "s.hspeed") as number).toBeCloseTo(py(g, "MAX_PULL * POWER"), 0);
    expect(py(g, "len(global_vars.director.left)")).toBe(2);
  }, 60_000);

  it("pressing a button isn't pulling the sling", async () => {
    const g = await level(0);
    g.engine.input.mouseMove(1024 - 268 + 60, 28);
    step(g);
    py(g, "global_vars.sling.visible = True");
    g.engine.input.mouseDown(0);
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Title");
  }, 60_000);

  it("a shot thrown over the top of the screen comes back down", async () => {
    const g = await level(0);
    py(g, "s = global_vars.shot");
    fling(g, -30, 104);
    let high = false;
    for (let k = 0; k < 150; k++) {
      step(g);
      if ((py(g, "s.y") as number) < -20) high = true;
    }
    expect(high).toBe(true);
    expect(py(g, "s._alive")).toBe(true);
    expect(py(g, "s.y") as number).toBeGreaterThan(0);
  }, 60_000);

  it("a shot pulled down isn't in the ground", async () => {
    const g = await level(5);
    py(g, "s = global_vars.shot");
    fling(g, -30, 104);
    expect(py(g, "s.y + 16 < GROUND_Y")).toBe(true);
    step(g, 5);
    expect(py(g, "s.touched")).toBe(false);
  }, 60_000);

  it("past either side is gone, and a jar that gets there has escaped", async () => {
    const g = await level(0);
    py(g, "j = instances('Jar')[0]; j.x = 1200; j.y = 400; r = global_vars.shot; r.x = -100");
    step(g, 2);
    expect(py(g, "j._alive")).toBe(false);
    expect(py(g, "r._alive")).toBe(false);
    expect(py(g, "instance_number('Jelly')")).toBe(1);
  }, 60_000);

  /** A material hit by a thrown rock at the same speed. Returns what's left of it. */
  async function rockInto(block: string, shot = "Rock", speed = 15, gap = 110) {
    const g = await level(0);
    py(g, `
b = instance_create(760, GROUND_Y - 150, "${block}")
b.fixed = True
s = instance_create(760 - ${gap}, GROUND_Y - 150, "${shot}")
launch(s, ${speed}, 0)
`);
    // Up to it, and a few steps more to see what the hit did.
    step(g, Math.ceil(gap / speed) + 3);
    return { g, alive: py(g, "b._alive") as boolean, hp: py(g, "b.hp") as number };
  }

  it("materials: glass breaks, wood is hurt, stone is chipped, metal hardly notices", async () => {
    const glass = await rockInto("GlassSmall");
    expect(glass.alive).toBe(false);
    const wood = await rockInto("WoodBig");
    expect(wood.alive).toBe(true);
    expect(wood.hp).toBeLessThan(0.9);
    const stone = await rockInto("StoneBig");
    expect(stone.alive).toBe(true);
    expect(stone.hp).toBeGreaterThan(wood.hp);
    const metal = await rockInto("MetalBig");
    expect(metal.hp).toBeGreaterThan(stone.hp);
    expect(metal.hp).toBeLessThan(1);
  }, 60_000);

  it("a bump shows: the picture cracks as it weakens", async () => {
    const g = await level(0);
    py(g, 'b = instance_create(760, 200, "WoodSmall")');
    py(g, "hurt(b, 0.4)");
    expect(py(g, "int(b.image_index)")).toBe(1);
    py(g, "hurt(b, 0.4)");
    expect(py(g, "int(b.image_index)")).toBe(2);
    expect(py(g, "b._alive")).toBe(true);
    py(g, "hurt(b, 0.4)");
    expect(py(g, "b._alive")).toBe(false);
  }, 60_000);

  it("a gentle touch does nothing, and a slow shove breaks nothing", async () => {
    const { hp } = await rockInto("GlassBig", "Rock", 2, 54);
    expect(hp).toBe(1);
  }, 60_000);

  it("a jar breaks if it falls far, not if it drops a little", async () => {
    const g = await level(0);
    py(g, 'far = instance_create(800, GROUND_Y - 200, "JarBlue"); near = instance_create(900, GROUND_Y - 24, "JarGreen")');
    step(g, 90);
    expect(py(g, "far._alive")).toBe(false);
    expect(py(g, "near._alive")).toBe(true);
    expect(py(g, "near.hp")).toBe(1);
    expect(py(g, "instance_number('Jelly')")).toBe(1);
    expect(py(g, "instances('Jelly')[0].sprite")).toBe("jelly_blue");
  }, 60_000);

  it("a freed jelly hops home to the sling", async () => {
    const g = await level(0);
    py(g, "j = instances('Jar')[0]; j.destroy(); y = instances('Jelly')[0]");
    step(g, 400);
    expect(py(g, "y.x <= y.home")).toBe(true);
    expect(py(g, "y.x > SLING_X")).toBe(true);
    expect(py(g, "y.y <= GROUND_Y - 18")).toBe(true);
  }, 60_000);

  it("a cannonball goes on through what it breaks; a rock stops", async () => {
    const speedAfter = async (shot: string) => {
      const { g } = await rockInto("GlassWide", shot, 12);
      return py(g, "s.hspeed") as number;
    };
    expect(await speedAfter("Cannonball")).toBeGreaterThan(7);
    expect(await speedAfter("Rock")).toBeLessThan(7);
  }, 60_000);

  it("a crate goes bang, sets off the crate beside it, and throws what's near", async () => {
    const g = await level(4);
    py(g, "crates = instances('Crate'); woods = instance_create(690, GROUND_Y - 120, 'WoodSmall'); before = instance_number('Stone')");
    expect(py(g, "len(crates)")).toBe(2);
    py(g, "hurt(crates[0], 2)");
    expect(py(g, "instance_number('Crate')")).toBe(0);
    expect(py(g, "woods.vspeed") as number).toBeLessThan(-1);
    step(g, 2);
  }, 60_000);

  it("a bomb goes off when clicked in the air, not before; a Bit isn't a bomb", async () => {
    const g = await level(5);
    py(g, "b = global_vars.shot; b.x = SLING_X");
    click(g, 500, 300);
    expect(py(g, "b._alive")).toBe(true);
    fling(g, -100, 40);
    step(g, 10);
    py(g, "w = instance_create(b.x + 60, b.y, 'GlassSmall')");
    click(g, 500, 300);
    expect(py(g, "b._alive")).toBe(false);
    expect(py(g, "w._alive")).toBe(false);
  }, 60_000);

  it("a bomb nobody clicks goes off soon after it lands", async () => {
    const g = await level(5);
    py(g, "b = global_vars.shot");
    fling(g, -40, -10);
    for (let k = 0; k < 40; k++) step(g);
    py(g, "w = instance_create(b.x + 50, b.y - 10, 'GlassSmall')");
    expect(py(g, "b._alive")).toBe(true);
    step(g, 200);
    expect(py(g, "b._alive")).toBe(false);
    expect(py(g, "w._alive")).toBe(false);
  }, 60_000);

  it("a Trio splits into three when clicked, going different ways, and only in the air", async () => {
    const g = await level(6);
    py(g, "t = global_vars.shot");
    fling(g, -100, 40);
    step(g, 10);
    click(g, 500, 300);
    expect(py(g, "t._alive")).toBe(false);
    expect(py(g, "instance_number('Bit')")).toBe(3);
    const ways = py(g, "[b.vspeed for b in instances('Bit')]") as unknown as number[];
    expect(new Set(ways.map((v) => v.toFixed(1))).size).toBe(3);
    expect(Math.max(...ways) - Math.min(...ways)).toBeGreaterThan(2);
    click(g, 500, 300);
    expect(py(g, "instance_number('Bit')")).toBe(3);
  }, 60_000);

  it("shots come one at a time, in order, each after the last has settled", async () => {
    const g = await level(7);
    expect(py(g, "global_vars.shot.object_name")).toBe("Rock");
    // A short throw: it lands and stops on the field, so nothing but its own time can end it.
    fling(g, -40, -10);
    expect(py(g, "global_vars.shot is None")).toBe(true);
    expect(py(g, "global_vars.mode")).toBe("flying");
    let k = 0;
    while (py(g, "global_vars.mode") === "flying" && k++ < 800) step(g);
    // Well inside the Director's 8-second limit, which would otherwise hide a shot that never goes.
    expect(k).toBeLessThan(420);
    expect(py(g, "global_vars.shot.object_name")).toBe("Trio");
    expect(py(g, "instance_number('Shot')")).toBe(1);
  }, 60_000);

  it("out of shots with jars left is lost; Try again starts over", async () => {
    const g = await level(1);
    py(g, "global_vars.director.left.clear()");
    fling(g, -40, -30);
    for (let k = 0; k < 700 && py(g, "global_vars.mode") === "flying"; k++) step(g);
    expect(py(g, "global_vars.mode")).toBe("lost");
    expect((g.saved() as Record<string, number>).stars_1).toBeUndefined();
    // The panel's second button.
    click(g, 1024 / 2 - 150 + 170 + 60, 340);
    step(g, 2);
    expect(py(g, "global_vars.mode")).toBe("aim");
    expect(py(g, "instance_number('Jar')")).toBe(2);
    expect(py(g, "global_vars.score")).toBe(0);
  }, 60_000);

  it("the Retry button and R start over; Esc goes to the levels", async () => {
    const g = await level(1);
    py(g, "instances('Jar')[0].destroy()");
    click(g, 1024 - 134 + 60, 28);
    step(g, 2);
    expect(py(g, "instance_number('Jar')")).toBe(2);
    py(g, "instances('Jar')[0].destroy()");
    g.engine.input.keyDown(KEY_CODE.get("r")!);
    step(g, 2);
    g.engine.input.keyUp(KEY_CODE.get("r")!);
    step(g);
    expect(py(g, "instance_number('Jar')")).toBe(2);
    g.engine.input.keyDown(KEY_CODE.get("escape")!);
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Title");
  }, 60_000);

  it("winning: stars by shots, spare shots score, a worse result never replaces a better", async () => {
    const g = await level(1);
    expect(py(g, "[stars_for(n, 2) for n in (1, 2, 3, 4)]")).toEqual([3, 3, 2, 1]);
    py(g, "global_vars.director.used = 3; global_vars.director.left = ['Rock']; global_vars.shot.destroy(); global_vars.mode = 'flying'; s0 = global_vars.score");
    py(g, "[j.destroy() for j in instances('Jar')]");
    const before = py(g, "global_vars.score") as number;
    expect(before).toBe(1000);
    step(g, 60);
    expect(py(g, "global_vars.mode")).toBe("won");
    expect(py(g, "global_vars.director.stars")).toBe(2);
    expect(py(g, "global_vars.score")).toBe(before + 1000);
    expect((g.saved() as Record<string, number>).stars_1).toBe(2);
    expect(py(g, "instance_number('GoButton')")).toBe(4);
    const again = await start({ stars_0: 1, stars_1: 3 });
    click(again, ...cardAt(1));
    step(again, 2);
    py(again, "global_vars.director.used = 9; global_vars.shot.destroy(); [j.destroy() for j in instances('Jar')]");
    step(again, 60);
    expect((again.saved() as Record<string, number>).stars_1).toBe(3);
  }, 60_000);

  it("the school's board gets your best of every level added up", async () => {
    const win = (g: Awaited<ReturnType<typeof start>>, score: number) => {
      py(g, `global_vars.score = ${score}; global_vars.shot.destroy(); [j.destroy() for j in instances('Jar')]`);
      step(g, 60);
    };
    const g = await start({ stars_0: 1, score_0: 5000 });
    click(g, ...cardAt(1));
    step(g, 2);
    win(g, 1000);
    // 1000 for the level + its jars + its spare shots, on top of level 0's 5000.
    const total = 5000 + (py(g, "save_get('score_1')") as number);
    expect(total).toBeGreaterThan(6000);
    expect(g.scores).toEqual([total]);
  }, 60_000);

  it("the title's levels open one at a time", async () => {
    const g = await start();
    expect(py(g, "room_name()")).toBe("Title");
    click(g, ...cardAt(1));
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Title");
    click(g, ...cardAt(0));
    step(g, 2);
    expect(py(g, "room_name()")).toBe("First Fling");
    const opened = await start({ stars_0: 1 });
    click(opened, ...cardAt(1));
    step(opened, 2);
    expect(py(opened, "room_name()")).toBe("Two Huts");
  }, 60_000);

  it("is objects in rooms: blocks are placed instances, shapes are only a picture and a parent", () => {
    const p = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    const byName = new Map(p.objects.map((o) => [o.name, o]));
    const up = (name: string) => {
      const out: string[] = [];
      for (let o = byName.get(name); o?.parent; ) {
        o = p.objects.find((x) => x.id === o!.parent);
        out.push(o!.name);
      }
      return out;
    };
    expect(up("WoodLong")).toEqual(["Wood", "Block", "Thing"]);
    expect(up("JarPink")).toEqual(["Jar", "Block", "Thing"]);
    expect(up("Cannonball")).toEqual(["Shot", "Thing"]);
    expect(up("Ledge")).toEqual(["Ground", "Thing"]);
    expect(byName.get("WoodLong")!.events.length).toBe(0);
    expect(byName.get("WoodLong")!.sprite).not.toBe(null);
    const first = p.rooms.find((r) => r.name === "First Fling")!;
    const placed = first.instances.map((i) => p.objects.find((o) => o.id === i.object)!.name);
    expect(placed.filter((n) => n === "WoodSmall").length).toBe(3);
    expect(placed).toContain("Sling");
    expect(placed).toContain("Director");
    expect(placed.some((n) => n.startsWith("Jar"))).toBe(true);
  });

  it("the build refuses a level that couldn't stand up", async () => {
    const g = await start();
    const problems = (blocks: string, extra = "") => py(g, `level_problems({"name": "x", "shots": ["Rock"], "par": 1, "blocks": ${blocks}${extra}})`) as unknown as string[];
    expect(problems('[("Jar", 600, 0)]')).toEqual([]);
    expect(problems("[]")[0]).toContain("no jars");
    expect(problems('[("Jar", 600, 0), ("Jar", 610, 0)]')[0]).toContain("inside");
    expect(problems('[("Jar", 600, 100)]')[0]).toContain("nothing holding it up");
    expect(problems('[("WoodLong", 600, 0), ("Jar", 660, 35)]')[0]).toContain("nothing holding it up");
    expect(problems('[("Jar", 200, 0)]')[0]).toContain("too near the sling");
    expect(problems('[("Jar", 1020, 0)]')[0]).toContain("off the field");
    expect(problems('[("Ledge", 600, 480), ("Jar", 600, 515)]').join()).toContain("out of the sky");
    expect(problems('[("Gold", 600, 0)]').join()).toContain("no block called Gold");
    const whole = (level: string) => (py(g, `level_problems(${level})`) as unknown as string[]).join();
    expect(whole('{"shots": ["Rock"], "par": 3, "blocks": [("Jar", 600, 0)]}')).toContain("par");
    expect(whole('{"shots": ["Banana"], "par": 1, "blocks": [("Jar", 600, 0)]}')).toContain("Banana");
    expect(whole('{"shots": [], "par": 1, "blocks": [("Jar", 600, 0)]}')).toContain("no shots");
  }, 60_000);

  it("the biggest level is cheap enough to run every step", async () => {
    const g = await level(8);
    step(g, 60);
    const t = performance.now();
    step(g, 300);
    const ms = (performance.now() - t) / 300;
    console.log(`Jelly Jailbreak's biggest level: ${ms.toFixed(2)} ms a step`);
    expect(ms).toBeLessThan(8);
  }, 60_000);
});
