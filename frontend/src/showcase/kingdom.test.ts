/**
 * The kingdom showcase game, Highmoor, played headless in the real Pyodide. Phase 1:
 * the kingdom: building and upgrading on the real clock (moved on by the tests), the
 * builders, mines and farms filling and collected into storage, walls, trees and rocks,
 * renown, saving, and the map from the keys alone.
 * Runs when the game has been built (python3 showcase/kingdom/build.py).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/kingdom/out/project.json");
const have = existsSync(BUILT);

type Game = PythonGame & { saved: () => Record<string, unknown>; scores: number[]; project: Project; questionOk: boolean[] };

async function start(save: Record<string, unknown> = {}): Promise<Game> {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const scores: number[] = [];
  const questionOk: boolean[] = [];
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    score: (n) => scores.push(n),
    questionOk: (ok) => questionOk.push(ok),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { saved: () => saved, scores, project, questionOk });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = <T = never>(g: PythonGame, code: string) => g.evalPython(code) as T;
const room = (g: PythonGame) => py<string>(g, "room_name()");
function press(g: PythonGame, key: string) {
  g.engine.input.keyDown(KEY_CODE.get(key)!);
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
  step(g);
}
/** A click at a point on the SCREEN (the game window), as a player's would be. */
function click(g: PythonGame, x: number, y: number) {
  g.engine.input.mouseMove(x, y);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  g.engine.input.mouseUp(0);
  step(g);
}
function drag(g: PythonGame, from: [number, number], via: [number, number][]) {
  g.engine.input.mouseMove(...from);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  for (const p of via) {
    g.engine.input.mouseMove(...p);
    step(g, 2);
  }
  g.engine.input.mouseUp(0);
  step(g);
}
/** Into a new kingdom (seeded). */
async function realmOf(g: PythonGame, seed = 7) {
  py(g, `global_vars.realm = new_realm(${seed})\nsave_set("realm", global_vars.realm)\nroom_goto("Realm")`);
  step(g, 3);
  expect(room(g)).toBe("Realm");
}
const later = (g: PythonGame, seconds: number) => py(g, `global_vars.time_shift = getattr(global_vars, "time_shift", 0) + ${seconds}`);

describe.runIf(have)("Highmoor", () => {
  it("the title: a click on Play goes in (the title isn't zoomed: the pointer mustn't be scaled there)", async () => {
    const g = await start();
    expect(room(g)).toBe("Title");
    const [x, y] = py<[number, number]>(g, 'b = instances("Title")[0].play\n[b.x + b.wide / 2, b.y + b.high / 2]');
    click(g, x, y);
    step(g, 2);
    expect(room(g)).toBe("Realm");
  });

  it("a new kingdom: the keep in the middle, two builders, a mine and a farm, trees and rocks; it all draws", async () => {
    const g = await start();
    expect(room(g)).toBe("Title");
    await realmOf(g);
    expect(py(g, `r = global_vars.realm
[keep_level(r), builders(r), free_builders(r), how_many(r, "gold_mine"), how_many(r, "farm"), len(r["obstacles"]), r["gold"], r["food"]]`))
      .toEqual([1, 2, 2, 1, 1, 34, 1000, 1000]);
    // Nothing overlaps, and everything's on the map.
    expect(py(g, `tiles = [t for b in r["buildings"] for t in footprint(b["kind"], b["gx"], b["gy"])] + [(o[1], o[2]) for o in r["obstacles"]]
len(tiles) == len(set(tiles)) and all(on_map(*t) for t in tiles)`)).toBe(true);
    step(g, 62);
    expect(py<number>(g, 'len(instances("Building"))')).toBe(5);
    expect(py<number>(g, 'len(instances("Prop"))')).toBe(34);
  });
  it("building: the keep allows it, a builder builds it on the real clock, renown when it's done; nothing overlaps", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'global_vars.realm["obstacles"] = []');     // nothing in the way of where this test builds
    py(g, 'r = global_vars.realm\nr["gold"] = r["food"] = 2000');
    // A treasury from the Build window: picked, then a tap on the map where it goes.
    py(g, 'do_act("buy", "treasury")');
    expect(py(g, 'place_building("treasury", (30, 30))')).toBe("built");
    expect(py(g, 'b = r["buildings"][-1]\n[b["kind"], b["level"], b["job"]["to"], r["food"], free_builders(r)]')).toEqual(["treasury", 0, 1, 1700, 1]);
    // Not on top of something.
    expect(py(g, 'build(r, "granary", 31, 31)[0]')).toBe("taken");
    // The keep allows one treasury now: a second must wait for keep level 3.
    expect(py(g, 'can_build(r, "treasury")')).toBe("Upgrade your keep to level 3 for another.");
    // A trebuchet needs keep level 3 before the first.
    expect(py(g, 'can_build(r, "trebuchet")')).toBe("Upgrade your keep to level 3 first.");
    // Ten seconds later it's built: level 1, the builder free, renown in.
    later(g, 11);
    step(g, 31);
    expect(py(g, '[b["level"], b["job"] is None, free_builders(r), r["xp"] > 0]')).toEqual([1, true, 2, true]);
    expect(py<number>(g, 'capacity(r, "gold")')).toBe(py<number>(g, 'BUILDINGS["keep"]["store"][0] + BUILDINGS["treasury"]["store"][0]'));
  });

  it("upgrading: paid for, one builder each, the keep first; two builders, two jobs; cancelled, half back", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'global_vars.realm["obstacles"] = []');     // nothing in the way of where this test builds
    py(g, 'r = global_vars.realm\nr["gold"] = r["food"] = 2500\nmine = next(b for b in r["buildings"] if b["kind"] == "gold_mine")\nfarm_ = next(b for b in r["buildings"] if b["kind"] == "farm")\nkeep_ = next(b for b in r["buildings"] if b["kind"] == "keep")');
    // The mine's level 3 needs keep level 2.
    expect(py(g, 'upgrade(r, mine)[0]')).toBe("started");
    // Both builders busy: nothing more is upgraded until one's free.
    py(g, 'upgrade(r, farm_)');
    expect(py(g, 'can_upgrade(r, keep_)')).toBe("Every builder is busy.");
    py(g, 'cancel(r, farm_)');
    later(g, 61);
    py(g, "finish_jobs(r)");
    expect(py(g, 'can_upgrade(r, mine)')).toBe("Upgrade your keep to level 2 first.");
    // Two builders: the keep and the farm at once; a third job must wait.
    expect(py(g, '[upgrade(r, keep_)[0], upgrade(r, farm_)[0], free_builders(r)]')).toEqual(["started", "started", 0]);
    expect(py(g, 'can_build(r, "granary")')).toBe("Every builder is busy.");
    // Cancelled: half of what it cost comes back, and the farm's still level 1.
    const gold = py<number>(g, 'r["gold"]');      // a farm is paid for in gold
    py(g, 'cancel(r, farm_)');
    expect(py(g, '[farm_["level"], farm_["job"] is None, free_builders(r)]')).toEqual([1, true, 1]);
    expect(py<number>(g, 'r["gold"]')).toBe(gold + py<number>(g, 'BUILDINGS["farm"]["cost"][1] // 2'));
    // A new building cancelled goes altogether.
    py(g, 'build(r, "granary", 30, 30)\nnew = r["buildings"][-1]');
    later(g, 61);
    py(g, 'finish_jobs(r)');
    py(g, 'r["food"] = 3000\nbuild(r, "gold_mine", 33, 30)\nn = len(r["buildings"])\ncancel(r, r["buildings"][-1])');
    expect(py<number>(g, 'n - len(r["buildings"])')).toBe(1);
    // The keep's done: level 2, and the mine may go on.
    expect(py(g, '[keep_level(r), can_upgrade(r, mine) is None or can_upgrade(r, mine).startswith("That needs")]')).toEqual([2, true]);
  });

  it("mines and farms fill on the real clock (not while upgrading), up to what they hold; collected into storage, as much as fits", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nmine = next(b for b in r["buildings"] if b["kind"] == "gold_mine")\nr["gold"] = 0');
    expect(py(g, 'waiting(mine)')).toBe(0);
    later(g, 600);          // ten minutes at 600 an hour
    expect(py(g, 'waiting(mine)')).toBe(100);
    later(g, 36000);        // ten hours: full, at what it holds
    expect(py(g, 'waiting(mine)')).toBe(py(g, 'BUILDINGS["gold_mine"]["hold"][0]'));
    // A tap on it collects (the first tap on a ready mine).
    py(g, 'bx, by = building_xy("gold_mine", mine["gx"], mine["gy"])\nmove_camera(bx - VIEW_W / 2, by - VIEW_H / 2)');
    step(g, 2);         // the view is where the camera was a step ago
    click(g, ...py<[number, number]>(g, 'list(to_screen(*building_xy("gold_mine", mine["gx"], mine["gy"])))'));
    expect(py(g, '[r["gold"], waiting(mine)]')).toEqual([1000, 0]);
    // More than there's room for: what doesn't fit waits.
    py(g, 'r["gold"] = capacity(r, "gold") - 300');
    later(g, 36000);
    expect(py(g, 'collect(r, mine)')).toBe(300);
    expect(py<number>(g, 'waiting(mine)')).toBe(700);
    // While it's upgrading it makes nothing (and what was waiting was collected first).
    py(g, 'r["gold"] = 0\nr["food"] = 5000\nupgrade(r, mine)');
    later(g, 30);
    expect(py(g, 'waiting(mine)')).toBe(0);
    later(g, 40);
    py(g, 'finish_jobs(r)');
    expect(py(g, '[mine["level"], waiting(mine) < 5]')).toEqual([2, true]);     // only what it's made since
  });

  it("walls: laid by a drag, one a tile, as many as the keep allows; upgraded at once, every one of a level together", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'global_vars.realm["obstacles"] = []');     // nothing in the way of where this test builds
    py(g, 'r = global_vars.realm\nr["gold"] = 100000');
    expect(py(g, 'can_build(r, "wall")')).toBe("Upgrade your keep to level 2 first.");
    py(g, 'keep_ = next(b for b in r["buildings"] if b["kind"] == "keep")\nkeep_["level"] = 2\nmove_camera(*[c - v for c, v in zip(tile_xy(8, 8), (VIEW_W / 2, VIEW_H / 2))])');
    py(g, 'do_act("buy", "wall")');
    step(g, 2);
    // A drag across six tiles of grass along one row.
    const pts = py<[number, number][]>(g, '[list(to_screen(*tile_xy(gx, 6))) for gx in range(4, 10)]');
    drag(g, pts[0]!, pts.slice(1));
    const free = py<number>(g, 'sum(1 for gx in range(4, 10) if not obstacle_at(r, gx, 6))');
    expect(py<number>(g, 'how_many(r, "wall")')).toBe(free);
    expect(py(g, '[w["level"] for w in r["buildings"] if w["kind"] == "wall"][:1]')).toEqual([1]);
    // Walls are Props (no events: there can be hundreds).
    step(g);
    expect(py<number>(g, 'sum(1 for p in instances("Prop") if p.sprite.startswith("wall_"))')).toBe(free);
    // Every level 1 wall to level 2, at once, no builder needed.
    const gold = py<number>(g, 'r["gold"]');
    expect(py(g, 'wall_upgrade_all(r, 1)')).toBe(free);
    expect(py<number>(g, 'r["gold"]')).toBe(gold - free * py<number>(g, 'BUILDINGS["wall"]["cost"][1]'));
    expect(py(g, 'sorted({w["level"] for w in r["buildings"] if w["kind"] == "wall"})')).toEqual([2]);
    // No more than the keep allows.
    py(g, 'for gx in range(40):\n    for gy in range(0, 2):\n        build(r, "wall", gx, gy)');
    expect(py(g, 'how_many(r, "wall")')).toBe(py(g, 'BUILDINGS["wall"]["count"][1]'));
  });

  it("trees and rocks: cleared for a little, with renown; more grow back on the clock, never more than the most", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\no = r["obstacles"][0]\nprice = OBSTACLES[o[0]]["cost"]\npays = OBSTACLES[o[0]]["pays"]\nbefore = r[pays]');
    py(g, 'open_panel("obstacle", 0)\npress(next(b for b in instances("Button") if b.act == "clear"))');
    expect(py(g, '[len(r["obstacles"]), before - r[pays] == price, r["xp"] > 0]')).toEqual([33, true, true]);
    later(g, py<number>(g, "OBSTACLE_EVERY * 3 + 5"));
    py(g, 'grow_obstacles(r)');
    expect(py<number>(g, 'len(r["obstacles"])')).toBe(36);
    later(g, py<number>(g, "OBSTACLE_EVERY * 20"));
    py(g, 'grow_obstacles(r)');
    expect(py(g, 'len(r["obstacles"])')).toBe(py(g, "OBSTACLES_MOST"));
    // The same seed grows the same: a reload can't choose where.
    expect(py(g, `a = new_realm(5)
b = new_realm(5)
a["grow_t"] = b["grow_t"] = now() - OBSTACLE_EVERY * 2
grow_obstacles(a)
grow_obstacles(b)
a["obstacles"] == b["obstacles"]`)).toBe(true);
  });

  it("builders: two to start, three more to buy, each dearer; renown levels go on the board", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nr["gold"] = 100000');
    expect(py(g, 'spot = next((x, y) for x in range(38) for y in range(38) if fits(r, "builder_hut", x, y))\n[builder_cost(r), build(r, "builder_hut", *spot)[0], builders(r), r["gold"]]')).toEqual([2500, "built", 3, 97500]);
    py(g, 'for gx, gy in [(x, y) for x in range(0, 38, 2) for y in range(0, 38, 2)]:\n    if builders(r) < 5 and fits(r, "builder_hut", gx, gy):\n        build(r, "builder_hut", gx, gy)');
    expect(py(g, '[builders(r), builder_cost(r) is None, can_build(r, "builder_hut")]')).toEqual([5, true, "You have every builder there is."]);
    py(g, 'gained = add_xp(r, 200)');
    expect(py<number[]>(g, "gained").length).toBeGreaterThan(1);
    step(g);            // the score goes out with the step's commands
    expect(g.scores.at(-1)).toBe(py(g, 'r["level"]'));
  });

  it("saved: a job keeps going while the game's closed, and is done when it's opened again", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nr["gold"] = 5000\nkeep_ = next(b for b in r["buildings"] if b["kind"] == "keep")\nupgrade(r, keep_)\nkeep_save(r)');
    step(g);            // the save goes out with the step's commands
    const saved = g.saved();
    const h = await start(saved);
    py(h, 'global_vars.time_shift = 120\nroom_goto("Realm")');
    step(h, 3);
    expect(py(h, 'keep_level(global_vars.realm)')).toBe(2);
  });

  it("from the keys alone: the cursor to the keep, Space opens it, Upgrade with Space; B builds", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'global_vars.realm["gold"] = 5000');
    press(g, "right");
    py(g, 'global_vars.cursor = (19, 19)');
    press(g, "space");
    expect(py(g, "global_vars.panel")).toBe("building");
    expect(py(g, 'global_vars.realm["buildings"][global_vars.panel_of]["kind"]')).toBe("keep");
    // The keys start on Upgrade (the green one).
    press(g, "space");
    expect(py(g, 'next(b for b in global_vars.realm["buildings"] if b["kind"] == "keep")["job"]["to"]')).toBe(2);
    press(g, "b");
    expect(py(g, "global_vars.panel")).toBe("shop");
    press(g, "escape");
    expect(py(g, "global_vars.panel is None")).toBe(true);
  });

  it("every window draws, every tab of the Build window fits the screen", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nr["gold"] = r["food"] = 10 ** 7\nnext(b for b in r["buildings"] if b["kind"] == "keep")["level"] = 10');
    for (const tab of ["economy", "defense", "army", "walls"]) {
      py(g, `open_panel("shop")\ndo_act("shop_tab", "${tab}")`);
      step(g, 2);
      expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
    }
    for (const kind of ["archer_tower", "ballista", "trebuchet", "barracks", "army_camp", "wall", "treasury"]) {
      py(g, `build(r, "${kind}", *next((x, y) for x in range(38) for y in range(38) if fits(r, "${kind}", x, y)))`);
      py(g, `global_vars.chosen = r["buildings"][-1]\nopen_panel("building", len(r["buildings"]) - 1)`);
      step(g, 3);
      py(g, `cancel(r, r["buildings"][-1]) if r["buildings"][-1]["job"] else r["buildings"].pop()`);
    }
    py(g, 'open_panel("obstacle", 0)');
    step(g, 3);
    py(g, 'global_vars.levelup = [4, 100]\nsay("Hello")');
    step(g, 3);
  });
  it("zoom: a little out to start; the - and + buttons (and Q and E) step out and in, about the middle, and a tap still lands on its tile", async () => {
    const g = await start();
    await realmOf(g);
    step(g, 2);
    expect(py(g, "zoom()")).toBeCloseTo(py<number>(g, "ZOOM_START"), 2);     // (the engine shows whole pixels)
    const mid = () => py<number[]>(g, "w, h = shown()\n[global_vars.cam[0] + w / 2, global_vars.cam[1] + h / 2]");
    const before = mid();
    py(g, 'press(next(b for b in instances("Button") if b.act == "zoom" and b.arg == -1))');
    step(g, 2);
    expect(py(g, "zoom()")).toBeCloseTo(py<number>(g, "ZOOMS[ZOOMS.index(ZOOM_START) - 1]"), 2);     // (the engine shows whole pixels)
    const after = mid();
    expect(Math.abs(after[0]! - before[0]!) + Math.abs(after[1]! - before[1]!)).toBeLessThan(2);
    press(g, "q");
    press(g, "q");
    press(g, "q");
    expect(py(g, "zoom()")).toBeCloseTo(py<number>(g, "ZOOMS[0]"), 2);     // (the engine shows whole pixels)
    expect(py(g, 'next(b for b in instances("Button") if b.act == "zoom" and b.arg == -1).off')).toBe(true);
    press(g, "e");
    expect(py(g, "zoom()")).toBeCloseTo(py<number>(g, "ZOOMS[1]"), 2);     // (the engine shows whole pixels)
    // Zoomed out, a tap on the keep still opens the keep.
    py(g, 'k = next(b for b in global_vars.realm["buildings"] if b["kind"] == "keep")\nx, y = building_xy("keep", k["gx"], k["gy"])\nw, h = shown()\nmove_camera(x - w / 2, y - h / 2)');
    step(g, 2);
    click(g, ...py<[number, number]>(g, 'list(to_screen(*building_xy("keep", k["gx"], k["gy"])))'));
    expect(py(g, 'global_vars.realm["buildings"][global_vars.panel_of]["kind"] if global_vars.panel == "building" else None')).toBe("keep");
  });
  it("the mouse wheel zooms in (up) and out (down) about the pointer, which stays over the same spot", async () => {
    const g = await start();
    await realmOf(g);
    step(g, 2);
    g.engine.input.mouseMove(300, 300);
    step(g, 2);
    const under = () => py<number[]>(g, "[global_vars.cam[0] + 300 / zoom(), global_vars.cam[1] + 300 / zoom()]");
    const before = under();
    const z = py<number>(g, "global_vars.zoom");
    g.engine.input.wheel(1);
    step(g, 3);
    expect(py<number>(g, "global_vars.zoom")).toBeGreaterThan(z);
    const after = under();
    expect(Math.abs(after[0]! - before[0]!) + Math.abs(after[1]! - before[1]!)).toBeLessThan(4);
    g.engine.input.wheel(-1);
    step(g, 3);
    g.engine.input.wheel(-1);
    step(g, 3);
    expect(py<number>(g, "global_vars.zoom")).toBeLessThan(z);
  });
});
