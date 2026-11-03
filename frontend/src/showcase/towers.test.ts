/**
 * The ninth showcase game, Fort Bramble (a tower defense), played headless in
 * the real Pyodide. A bot plays every level with the mouse, as a person would:
 * buy, place, upgrade, send the waves. Then the rules one at a time, and the
 * build refusing a level that can't be played. Runs when the game has been
 * built (python3 showcase/towers/build.py, which needs only the repo).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/towers/out/project.json");
const have = existsSync(BUILT);
const BAR_Y = 8 * 64 + 28;

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
  return Object.assign(game, { saved: () => saved });
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
const buy = (g: PythonGame, k: number) => click(g, 6 + k * 126 + 60, BAR_Y);
const cell = (g: PythonGame, c: number, r: number) => click(g, c * 64 + 32, r * 64 + 32);
const sendWave = (g: PythonGame) => click(g, 896 + 60, BAR_Y);
const upgrade = (g: PythonGame) => click(g, 520 + 60, BAR_Y);
const sell = (g: PythonGame) => click(g, 646 + 60, BAR_Y);
/** From the title, by clicking its card, into level i. */
async function level(i: number, save: Record<string, unknown> = {}) {
  const g = await start(i ? { ...save, [`stars_${i - 1}`]: 1 } : save);
  click(g, 44 + i * 322 + 100, 270);
  step(g, 2);
  expect(py(g, "room_name()")).toBe(py(g, `LEVELS[${i}]['name']`));
  return g;
}

/**
 * The bot, in Python: what a sensible player would do next. The empty cell that
 * covers most road goes first; a mix of towers, rockets for the planes; then
 * upgrades with what's left.
 */
const BOT = `
def covering(radius, flying=False):
    level = LEVELS[global_vars.director.level]
    road = [cell_middle(c, r) for c, r in road_cells(level)]
    if flying:
        # Rockets go where they can also reach the planes' straight line to the fort.
        a, b = road[0], road[-1]
        road = road + [(a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8) for k in range(1, 8)] * 3
    best, at = -1, None
    for r in range(ROWS):
        for c in range(COLS):
            x, y = cell_middle(c, r)
            if can_build(x, y):
                n = sum(1 for p in road if point_distance(x, y, p[0], p[1]) <= radius)
                if n > best:
                    best, at = n, (c, r)
    return at

ORDER = ["Gunner", "Gunner", "Cannon", "Freezer", "Rocket", "Gunner", "Cannon", "Rocket", "Freezer", "Gunner", "Rocket", "Cannon", "Rocket"]
bought = [0]

def bot_next():
    gold = global_vars.gold
    if bought[0] < len(ORDER):
        want = ORDER[bought[0]]
        if gold >= PRICES[want]:
            at = covering(BUILD_RANGE[want], want == "Rocket")
            if at:
                return ["buy", ["Gunner", "Cannon", "Rocket", "Freezer"].index(want), at[0], at[1]]
            bought[0] += 1
        elif bought[0] < 5:
            return ["wait"]
    towers = sorted(instances("Tower"), key=lambda t: (t.level, t.x))
    for t in towers:
        if t.level < MAX_LEVEL and gold >= upgrade_price(t):
            return ["upgrade", t.x, t.y]
    return ["wait"]
`;

/** Plays a level through with clicks. Answers when it's over. */
function playLevel(g: PythonGame, most = 60000) {
  py(g, BOT);
  let steps = 0;
  while (py(g, "global_vars.mode") === "playing" && steps < most) {
    const act = py(g, "bot_next()") as unknown as (string | number)[];
    if (act[0] === "buy") {
      buy(g, act[1] as number);
      cell(g, act[2] as number, act[3] as number);
      py(g, "bought[0] += 1");
    } else if (act[0] === "upgrade") {
      click(g, act[1] as number, act[2] as number);
      upgrade(g);
    } else if (!py(g, "wave_busy()") && (py(g, "bought[0] >= 2 or global_vars.gold < 60") as boolean)) {
      sendWave(g);
    }
    step(g, 20);
    steps += 26;
  }
  return steps;
}

/** Into a level, with an enemy of a kind standing somewhere, and nothing else coming. */
function put(g: PythonGame, kind: string, x: number, y: number, name = "e") {
  py(g, `${name} = instance_create(${x}, ${y}, "${kind}")`);
}

describe.runIf(have)("Fort Bramble", () => {
  it.each([0, 1, 2])("a bot plays level %i with the mouse, and the fort holds", async (i) => {
    const g = await level(i);
    playLevel(g);
    expect(py(g, "global_vars.mode")).toBe("won");
    expect(py(g, "global_vars.lives")).toBeGreaterThan(0);
    expect(py(g, "global_vars.wave")).toBe(py(g, `len(LEVELS[${i}]["waves"])`));
    // Kept between visits, which opens the next level.
    expect((g.saved() as Record<string, number>)[`stars_${i}`]).toBeGreaterThan(0);
  }, 400_000);

  it("with no towers the fort falls: every wave sent, and nothing to stop them", async () => {
    const g = await level(0);
    for (let i = 0; i < 40000 && py(g, "global_vars.mode") === "playing"; i += 60) {
      if (!py(g, "wave_busy()")) sendWave(g);
      step(g, 60);
    }
    expect(py(g, "global_vars.mode")).toBe("lost");
    expect(py(g, "instance_number('GoButton')")).toBe(2);
    // Try again: a clean level.
    click(g, 286 + 260 + 100, 350);
    step(g, 2);
    expect(py(g, "global_vars.mode")).toBe("playing");
    expect(py(g, "global_vars.lives")).toBe(20);
    expect(py(g, "global_vars.wave")).toBe(0);
    expect(py(g, "instance_number('Enemy')")).toBe(0);
  }, 200_000);

  it("is objects in rooms: a Gate and Fort at the road's ends, the road in tiles, buttons placed", async () => {
    const g = await level(0);
    expect(py(g, "instance_number('Director')")).toBe(1);
    expect(py(g, "instance_number('BuyButton')")).toBe(4);
    expect(py(g, "instance_number('Decor')")).toBe(py(g, "len(LEVELS[0]['decor'])"));
    const end = (py(g, "cell_middle(*LEVELS[0]['path'][-1])") as unknown as number[]);
    expect(py(g, "instances('Fort')[0].x")).toBe(end[0]);
    expect(py(g, "instances('Fort')[0].y")).toBe(end[1]);
    const begin = (py(g, "cell_middle(*LEVELS[0]['path'][0])") as unknown as number[]);
    expect(py(g, "instances('Gate')[0].x")).toBe(begin[0]);
    // Every road cell has a tile on the Road layer, and nothing else does.
    expect(py(g, "all(tile_at(*cell_middle(c, r), 'Road') is not None for c, r in road_cells(LEVELS[0]))")).toBe(true);
    expect(py(g, "sum(1 for c in range(COLS) for r in range(ROWS) if tile_at(*cell_middle(c, r), 'Road') is not None)")).toBe(py(g, "len(road_cells(LEVELS[0]))"));
    // Each child of Tower and Enemy really is one.
    expect(py(g, "issubclass(type(instance_create(0, 0, 'Cannon')), type(instance_create(0, 0, 'Tower')))")).toBe(true);
  }, 60_000);

  it("the title's levels open one at a time", async () => {
    const g = await start();
    click(g, 44 + 322 + 100, 270);       // the second: locked
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Title");
    const opened = await start({ stars_0: 2 });
    click(opened, 44 + 322 + 100, 270);
    step(opened, 2);
    expect(py(opened, "room_name()")).toBe("Dusty Pass");
  }, 60_000);

  it("building: a click buys, on an empty cell, if you can pay", async () => {
    const g = await level(0);
    const gold = py(g, "global_vars.gold") as number;
    buy(g, 0);
    expect(py(g, "global_vars.buying")).toBe("Gunner");
    cell(g, 4, 3);                       // the road
    expect(py(g, "instance_number('Tower')")).toBe(0);
    expect(py(g, "global_vars.gold")).toBe(gold);
    buy(g, 0);
    cell(g, 1, 4);                       // a tree
    expect(py(g, "instance_number('Tower')")).toBe(0);
    buy(g, 0);
    cell(g, 6, 3);
    expect(py(g, "instance_number('Gunner')")).toBe(1);
    expect(py(g, "global_vars.gold")).toBe(gold - 60);
    expect(py(g, "global_vars.buying is None")).toBe(true);
    buy(g, 0);
    cell(g, 6, 3);                       // already taken
    expect(py(g, "instance_number('Tower')")).toBe(1);
    // Clicking the button twice changes your mind.
    buy(g, 1);
    buy(g, 1);
    expect(py(g, "global_vars.buying is None")).toBe(true);
    // Too poor: the button won't take.
    py(g, "global_vars.gold = 10");
    step(g);
    buy(g, 2);
    expect(py(g, "global_vars.buying is None")).toBe(true);
  }, 60_000);

  it("upgrading and selling, on the tower you click", async () => {
    const g = await level(0);
    buy(g, 0);
    cell(g, 6, 3);
    py(g, "global_vars.gold = 1000\nt = instances('Tower')[0]\nd0, r0 = t.damage, t.range");
    cell(g, 6, 3);
    expect(py(g, "global_vars.selected is t")).toBe(true);
    step(g);
    upgrade(g);
    expect(py(g, "t.level")).toBe(2);
    expect(py(g, "t.damage > d0 and t.range > r0")).toBe(true);
    expect(py(g, "global_vars.gold")).toBe(1000 - 60);
    upgrade(g);
    expect(py(g, "t.level")).toBe(3);
    const before = py(g, "global_vars.gold") as number;
    upgrade(g);                          // that's the top
    expect(py(g, "t.level")).toBe(3);
    expect(py(g, "global_vars.gold")).toBe(before);
    const back = py(g, "sell_price(t)") as number;
    expect(back).toBe(Math.floor((60 + 60 + 120) * 0.7));
    sell(g);
    expect(py(g, "instance_number('Tower')")).toBe(0);
    expect(py(g, "global_vars.gold")).toBe(before + back);
    expect(py(g, "global_vars.selected is None")).toBe(true);
    // Clicking away lets go.
    buy(g, 0);
    cell(g, 6, 3);
    cell(g, 6, 3);
    cell(g, 11, 4);
    expect(py(g, "global_vars.selected is None")).toBe(true);
  }, 60_000);

  it("towers shoot the enemy that has got furthest, if they can reach it", async () => {
    const g = await level(0);
    py(g, "global_vars.gold = 1000\nt = build('Gunner', 400, 224)");
    put(g, "Soldier", 420, 224, "near_one");
    put(g, "Soldier", 440, 224, "far_one");
    py(g, "near_one.walk = far_one.walk = 0\nnear_one.travelled, far_one.travelled = 10, 500");
    step(g, 10);
    expect(py(g, "t.target is far_one")).toBe(true);
    // Out of range: not a target.
    py(g, "far_one.x = 800\nnear_one.x = 800\nt.look = 0");
    step(g, 2);
    expect(py(g, "t.target is None")).toBe(true);
    // The price and the range the build screen shows are the tower's own.
    expect(py(g, "all(BUILD_RANGE[k] == build(k, 64 * c + 32, 224).range for k, c in (('Gunner', 2), ('Cannon', 3), ('Freezer', 5), ('Rocket', 7)))")).toBe(true);
  }, 60_000);

  it("planes: Cannons and Freezers can't touch them, Gunners and Rockets can", async () => {
    const g = await level(0);
    put(g, "Plane", 400, 200, "p");
    py(g, "p.walk = 0\ng_ = {}\nfor k, c in (('Gunner', 5), ('Cannon', 6), ('Rocket', 7), ('Freezer', 8)):\n    global_vars.gold = 500\n    g_[k] = instance_create(64 * c + 32, 224, k)");
    step(g, 12);
    expect(py(g, "g_['Gunner'].target is p")).toBe(true);
    expect(py(g, "g_['Rocket'].target is p")).toBe(true);
    expect(py(g, "g_['Cannon'].target is None")).toBe(true);
    expect(py(g, "g_['Freezer'].target is None")).toBe(true);
    // Shots too: a shell's burst passes under it.
    py(g, "hp = p.hp\nblast(p.x, p.y, 70, 50, False)");
    expect(py(g, "p.hp")).toBe(py(g, "hp"));
    py(g, "blast(p.x, p.y, 70, 50, True)");
    expect(py(g, "p.hp")).toBeLessThan(py(g, "hp"));
  }, 60_000);

  it("what shots do: a hit, a burst all round, a chase and a freeze", async () => {
    const g = await level(0);
    put(g, "Soldier", 400, 300, "a");
    put(g, "Soldier", 440, 300, "b");
    put(g, "Soldier", 700, 300, "c");
    py(g, "a.walk = b.walk = c.walk = 0\nhp = a.hp");
    py(g, "s = instance_create(390, 300, 'Pellet')\naim_shot(s, a, 5)");
    step(g, 6);
    expect(py(g, "a.hp")).toBe(py(g, "hp - 5"));
    expect(py(g, "instance_number('Pellet')")).toBe(0);
    py(g, "a.hp = b.hp = c.hp = hp\nblast(400, 300, 70, 20, False)");
    expect(py(g, "a.hp")).toBe(py(g, "hp - 20"));
    expect(py(g, "hp - 20 < b.hp < hp")).toBe(true);       // less at the edge
    expect(py(g, "c.hp")).toBe(py(g, "hp"));               // out of it altogether
    // A missile turns after what it's chasing.
    py(g, "m = instance_create(100, 100, 'Missile')\naim_shot(m, c, 5)\nc.x, c.y = 100, 400");
    step(g, 3);
    expect(py(g, "abs(m.direction - 270) < 1")).toBe(true);
    // A snowball slows it, to half speed, for a while.
    py(g, "m.destroy()\nb.walk = 2.0\ns = instance_create(b.x, b.y, 'Snowball')\naim_shot(s, b, 1)");
    step(g, 2);
    expect(py(g, "b.slow")).toBeGreaterThan(0);
    expect(py(g, "abs(b.speed - 1.0) < 0.01")).toBe(true);
    // It wears off by itself.
    py(g, "b.slow = 3");
    step(g, 5);
    expect(py(g, "b.slow")).toBe(0);
    expect(py(g, "abs(b.speed - 2.0) < 0.01")).toBe(true);
  }, 60_000);

  it("an enemy walks the road corner by corner, and takes lives at the fort", async () => {
    const g = await level(0);
    py(g, "route = global_vars.road_route");
    expect(py(g, "len(route)")).toBe(py(g, "len(LEVELS[0]['path']) - 1"));
    py(g, "x, y = cell_middle(*LEVELS[0]['path'][0])\ne = instance_create(x, y, 'Scout')");
    for (let i = 0; i < 300 && (py(g, "e.leg") as number) === 0; i++) step(g);
    expect(py(g, "e.leg")).toBe(1);
    expect(py(g, "abs(e.x - route[0][0]) < 3 and abs(e.y - route[0][1]) < 3")).toBe(true);
    // Off the road it never goes: every step on a road cell.
    let off = 0;
    for (let i = 0; i < 2500 && py(g, "e._alive"); i++) {
      if (py(g, "e._alive and tile_at(e.x, e.y, 'Road') is None and e.x > 0")) off++;
      step(g);
    }
    expect(off).toBe(0);
    expect(py(g, "e._alive")).toBe(false);
    expect(py(g, "global_vars.lives")).toBe(20 - 1);
    // A tank takes two; a plane goes straight there, not by the road.
    put(g, "Tank", 900, 400, "t");
    py(g, "t.leg = len(route) - 1");
    step(g, 200);
    expect(py(g, "global_vars.lives")).toBe(17);
    py(g, "x, y = cell_middle(*LEVELS[0]['path'][0])\np = instance_create(x, y, 'Plane')\nend = route[-1]");
    step(g, 2);
    expect(py(g, "abs(p.direction - point_direction(p.x, p.y, end[0], end[1])) < 1")).toBe(true);
  }, 120_000);

  it("gold: stopping an enemy pays, a cleared wave pays, an early wave pays more", async () => {
    const g = await level(0);
    put(g, "Soldier", 400, 300);
    py(g, "gold = global_vars.gold\nhurt(e, 10000)");
    expect(py(g, "global_vars.gold")).toBe(py(g, "gold + 9"));
    expect(py(g, "instance_number('Enemy')")).toBe(0);
    // A wave cleared.
    py(g, "gold = global_vars.gold\ne = instance_create(400, 300, 'Soldier')");
    step(g, 2);
    py(g, "e.destroy()");
    step(g, 3);
    expect(py(g, "global_vars.gold")).toBe(py(g, "gold + WAVE_BONUS"));
    // Sent while there's still something on the field.
    py(g, "e = instance_create(400, 300, 'Soldier')\ne.walk = 0\ngold = global_vars.gold");
    sendWave(g);
    expect(py(g, "global_vars.gold")).toBe(py(g, "gold + EARLY_BONUS"));
    // Later waves are tougher.
    py(g, "e.destroy()\nglobal_vars.wave = 1\nq = instances('Gate')[0]\nq.queue[:] = [['Soldier', 1, 1]]\nq.wait = 0");
    step(g);
    const low = py(g, "instances('Enemy')[-1].hp_max") as number;
    py(g, "global_vars.wave = 6\nq.queue[:] = [['Soldier', 1, 1]]\nq.wait = 0");
    step(g, 2);
    expect(py(g, "instances('Enemy')[-1].hp_max")).toBeGreaterThan(low);
  }, 60_000);

  it("a Gate sends a wave's groups in order, and the right number", async () => {
    const g = await level(0);
    py(g, "global_vars.director.was_busy = False\ngate = instances('Gate')[0]\ngate.queue[:] = [['Scout', 3, 5], ['Tank', 1, 5]]\nmade = []");
    for (let i = 0; i < 40; i++) {
      step(g);
      py(g, "made = [o.object_name for o in instances('Enemy')]");
    }
    expect(py(g, "made")).toEqual(["Scout", "Scout", "Scout", "Tank"]);
    expect(py(g, "gate.queue")).toEqual([]);
  }, 60_000);

  it("winning: stars for lives kept, and only a better result replaces the old one", async () => {
    const g = await level(0, { stars_0: 3 });
    expect(py(g, "stars_for(20, 20)")).toBe(3);
    expect(py(g, "stars_for(18, 20)")).toBe(3);
    expect(py(g, "stars_for(17, 20)")).toBe(2);
    expect(py(g, "stars_for(10, 20)")).toBe(2);
    expect(py(g, "stars_for(9, 20)")).toBe(1);
    py(g, "global_vars.wave = len(LEVELS[0]['waves'])\nglobal_vars.lives = 1");
    step(g, 2);
    expect(py(g, "global_vars.mode")).toBe("won");
    expect(py(g, "global_vars.director.stars")).toBe(1);
    expect(g.saved()).toMatchObject({ stars_0: 3 });
    expect(py(g, "instance_number('GoButton')")).toBe(2);
    click(g, 286 + 260 + 100, 350);      // Next level
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Dusty Pass");
  }, 60_000);

  it("the build refuses a level that can't be played", () => {
    const check = (body: string) => execFileSync("python3", ["-c", `
exec(open(${JSON.stringify(resolve(__dirname, "../../../showcase/towers/game/_1levels.py"))}).read())
l = dict(LEVELS[0])
${body}
print(level_problems(l))`], { encoding: "utf8" });
    expect(check("")).toBe("[]\n");
    expect(check("l['path'] = [(0, 1), (4, 3)]")).toMatch(/isn't straight/);
    expect(check("l['path'] = [(0, 1), (20, 1)]")).toMatch(/off the field/);
    expect(check("l['path'] = [(4, 4), (8, 4)]")).toMatch(/not at the edge/);
    expect(check("l['path'] = [(0, 2), (6, 2), (6, 5), (3, 5), (3, 1), (9, 1)]")).toMatch(/crosses itself/);
    expect(check("l['decor'] = [('tree', 2, 1)]")).toMatch(/on the road/);
    expect(check("l['decor'] = [('statue', 7, 7)]")).toMatch(/no decoration/);
    expect(check("l['waves'] = [[('Dragon', 1, 10)]]")).toMatch(/no such enemy/);
  });
});
