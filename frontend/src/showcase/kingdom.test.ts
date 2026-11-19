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
import type { RaidOrder } from "../engine/game";

const BUILT = resolve(__dirname, "../../../showcase/kingdom/out/project.json");
const have = existsSync(BUILT);

type Game = PythonGame & { saved: () => Record<string, unknown>; scores: number[]; project: Project; questionOk: boolean[]; orders: RaidOrder[] };

async function start(save: Record<string, unknown> = {}): Promise<Game> {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const scores: number[] = [];
  const questionOk: boolean[] = [];
  const raids: RaidOrder[] = [];
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    raid: (o) => raids.push(...o),
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    score: (n) => scores.push(n),
    questionOk: (ok) => questionOk.push(ok),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  // `orders`, not `raids`: the game keeps its own `raids` (what's come from the server).
  return Object.assign(game, { saved: () => saved, scores, project, questionOk, orders: raids });
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
      .toEqual([1, 2, 2, 1, 1, py<number>(g, "START_OBSTACLES"), 1000, 1000]);
    // Nothing overlaps, and everything's on the map.
    expect(py(g, `tiles = [t for b in r["buildings"] for t in footprint(b["kind"], b["gx"], b["gy"])] + [(o[1], o[2]) for o in r["obstacles"]]
len(tiles) == len(set(tiles)) and all(on_map(*t) for t in tiles)`)).toBe(true);
    step(g, 62);
    expect(py<number>(g, 'len(instances("Building"))')).toBe(5);
    expect(py<number>(g, 'len(instances("Prop"))')).toBe(py<number>(g, "START_OBSTACLES"));
  });
  it("building: the keep allows it, a builder builds it on the real clock, renown when it's done; nothing overlaps", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'global_vars.realm["obstacles"] = []');     // nothing in the way of where this test builds
    py(g, 'r = global_vars.realm\nr["gold"] = r["food"] = 2000');
    // A treasury from the Build window: picked, then a tap on the map where it goes.
    py(g, 'do_act("buy", "treasury")');
    expect(py(g, 'spot = next((x, y) for x in range(MAP_W) for y in range(MAP_H) if fits(r, "treasury", x, y))\nplace_building("treasury", spot)')).toBe("built");
    expect(py(g, 'b = r["buildings"][-1]\n[b["kind"], b["level"], b["job"]["to"], r["food"], free_builders(r)]')).toEqual(["treasury", 0, 1, 1700, 1]);
    // Not on top of something.
    expect(py(g, 'build(r, "granary", spot[0] + 1, spot[1] + 1)[0]')).toBe("taken");
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
    expect(py(g, '[len(r["obstacles"]) == START_OBSTACLES - 1, before - r[pays] == price, r["xp"] > 0]')).toEqual([true, true, true]);
    later(g, py<number>(g, "OBSTACLE_EVERY * 3 + 5"));
    py(g, 'grow_obstacles(r)');
    expect(py<number>(g, 'len(r["obstacles"])')).toBe(py<number>(g, "START_OBSTACLES") + 2);
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

  it("a kingdom saved on the old 40-tile map comes back in the middle of the bigger one, as it was laid out", async () => {
    const g = await start();
    await realmOf(g);
    // As text, as a save is kept (an empty job, None, would be lost on the way to JavaScript).
    const old = JSON.parse(py<string>(g, `import json
o = new_realm(3)
del o["map"]
for b in o["buildings"]:
    b["gx"] -= 15
    b["gy"] -= 15
o["obstacles"] = [[k, x - 15, y - 15] for k, x, y in o["obstacles"] if 15 <= x < 55 and 15 <= y < 55]
json.dumps(o)`)) as Record<string, unknown>;
    const h = await start({ realm: old });
    py(h, 'room_goto("Realm")');
    step(h, 3);
    expect(py(h, `r = global_vars.realm
k = next(b for b in r["buildings"] if b["kind"] == "keep")
[r["map"], (k["gx"], k["gy"]) == (MID - 2, MID - 2), all(on_map(o[1], o[2]) for o in r["obstacles"])]`)).toEqual([py(h, "MAP_W"), true, true]);
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
    py(g, 'k = next(b for b in global_vars.realm["buildings"] if b["kind"] == "keep")\nglobal_vars.cursor = (k["gx"] + 1, k["gy"] + 1)');
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
  it("zoom: as far out as it goes to start; the - and + buttons (and Q and E) step out and in, about the middle, and a tap still lands on its tile", async () => {
    const g = await start();
    await realmOf(g);
    step(g, 2);
    expect(py(g, "zoom()")).toBeCloseTo(py<number>(g, "ZOOM_START"), 2);     // (the engine shows whole pixels)
    const mid = () => py<number[]>(g, "w, h = shown()\n[global_vars.cam[0] + w / 2, global_vars.cam[1] + h / 2]");
    const before = mid();
    expect([py(g, "ZOOM_START == ZOOMS[0]"), py(g, 'next(b for b in instances("Button") if b.act == "zoom" and b.arg == -1).off')]).toEqual([true, true]);
    py(g, 'press(next(b for b in instances("Button") if b.act == "zoom" and b.arg == 1))');
    step(g, 2);
    expect(py(g, "zoom()")).toBeCloseTo(py<number>(g, "ZOOMS[1]"), 2);     // (the engine shows whole pixels)
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
    expect(py<number>(g, "global_vars.zoom")).toBe(z);         // back out, and no further than the furthest
  });

  // ---- phase 2: the army and the campaign

  it("phase 2: troops open with the barracks level, train on the real clock (two barracks, twice as fast), wait in the camps; off the queue, food back", async () => {
    const g = await start();
    await realmOf(g);
    py(g, `r = global_vars.realm
r["obstacles"] = []
r["food"] = r["gold"] = 2500
def place(kind, level):
    spot = next((x, y) for x in range(MAP_W) for y in range(MAP_H) if fits(r, kind, x, y))
    b = new_building(kind, *spot, level)
    r["buildings"].append(b)
    return b
camp = place("army_camp", 1)
bar = place("barracks", 1)`);
    expect(py(g, '[army_room(r), can_train(r, "archer"), train(r, "footman"), r["food"]]'))
      .toEqual([20, "Upgrade a barracks to level 2 first.", "queued", 2475]);
    later(g, 21);
    expect(py(g, '[train_tick(r), r["army"], r["training"]]')).toEqual([1, { footman: 1 }, []]);
    // Two barracks: twice as fast (a footman in 10 s, not 20).
    py(g, 'place("barracks", 1)\ntrain(r, "footman")\ntrain(r, "footman")');
    later(g, 21);
    expect(py(g, '[train_tick(r), r["army"]["footman"]]')).toEqual([2, 3]);
    // No more than the camps' room, queue and all.
    py(g, 'r["food"] = 10000\nfor _ in range(30):\n    train(r, "footman")');
    expect(py(g, '[army_used(r), can_train(r, "footman")]')).toEqual([20, "No room in the army camps: build or upgrade one."]);
    // Taken off the queue: its food back.
    const food = py<number>(g, 'r["food"]');
    expect(py(g, 'untrain(r, "footman")')).toBe(true);
    expect(py<number>(g, 'r["food"]')).toBe(food + 25);
  });

  it("phase 2: every village's layout is the same each time, on the map, nothing overlapping; each opens once the one before has a star", async () => {
    const g = await start();
    await realmOf(g);
    expect(py(g, `ok = []
for i in range(len(CAMPAIGN)):
    a, b = village_layout(i), village_layout(i)
    cells = [t for d in a for t in footprint(d["kind"], d["gx"], d["gy"])]
    keep_ = [d for d in a if d["kind"] == "keep"]
    defenses = sum(1 for d in a if d["kind"] in DEFENSES)
    want = CAMPAIGN[i]["towers"] + CAMPAIGN[i]["ballistas"] + CAMPAIGN[i]["trebuchets"]
    ok.append(a == b and len(cells) == len(set(cells)) and all(on_map(*t) for t in cells) and len(keep_) == 1 and defenses == want)
ok`)).toEqual(py<boolean[]>(g, "[True] * len(CAMPAIGN)"));
    py(g, 'r = global_vars.realm');
    expect(py(g, '[village_open(r, 0), village_open(r, 1)]')).toEqual([true, false]);
    py(g, 'r["campaign"]["0"] = 1');
    expect(py(g, 'village_open(r, 1)')).toBe(true);
  });

  it("phase 2: a battle: troops go for what they want, defenses shoot back, walls are broken through; stars for half, the keep and everything", async () => {
    const g = await start();
    await realmOf(g);
    py(g, `def fight(i, army, at):
    b = new_battle(village_layout(i), army, village_loot(global_vars.realm, i))
    n = 0
    for k, c in army.items():
        for j in range(c):
            deploy(b, k, *at(n))
            n += 1
    while not b["over"]:
        tick(b)
    return b`);
    // Twenty footmen take the first village: all three stars, and all its loot.
    expect(py(g, 'b = fight(0, {"footman": 20}, lambda n: (MID - 14 + n % 5, MID - 14))\n[b["stars"], destroyed_pct(b), b["loot"]]'))
      .toEqual([3, 100, [500, 500]]);
    expect(py<number>(g, 'sum(1 for u in b["units"] if u["dead"])')).toBeGreaterThan(0);      // the tower fought back
    // Three can't take a walled village: no stars.
    expect(py(g, 'fight(6, {"footman": 3}, lambda n: (MID - 26, MID))["stars"]')).toBe(0);
    // A man-at-arms walks past the rest to a defense first; a raider to the gold and food.
    py(g, `def first_hit(kind):
    b = new_battle(village_layout(2), {kind: 1}, [0, 0])
    deploy(b, kind, MID - 16, MID)
    for _ in range(3000):
        tick(b)
        u = b["units"][0]
        if u["hit"] is not None and b["bs"][u["hit"]]["kind"] != "wall":
            return b["bs"][u["hit"]]["kind"]
        if u["dead"]:
            return None`);
    expect(py(g, 'first_hit("brute") in DEFENSES')).toBe(true);
    expect(py(g, 'first_hit("raider") in LOOT_KINDS')).toBe(true);
    // A sapper bursts a wall open.
    expect(py(g, `b = new_battle(village_layout(2), {"sapper": 1}, [0, 0])
deploy(b, "sapper", MID - 16, MID)
for _ in range(3000):
    tick(b)
sum(1 for x in b["bs"] if x["kind"] == "wall" and x["dead"]) > 0 and b["units"][0]["dead"]`)).toBe(true);
    // The stars: half the buildings down is one, the keep another, everything the third.
    expect(py(g, `b = new_battle(village_layout(3), {}, [0, 0])
live = [x for x in b["bs"] if x["kind"] != "wall"]
for x in live[1:len(live) // 2 + 1]:
    x["dead"] = True
a = stars_now(b)
live[0]["dead"] = True
[live[0]["kind"], a, stars_now(b)]`)).toEqual(["keep", 1, 2]);
  });

  it("phase 2: troops go down only outside the village, and only the troops you brought", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'b = new_battle(village_layout(0), {"footman": 1}, [0, 0])');
    expect(py(g, 'deploy(b, "footman", MID, MID)')).toBe("Too close: put troops down outside the village.");
    expect(py(g, 'deploy(b, "archer", MID - 15, MID - 15)')).toBe("No more archers to send.");
    expect(py(g, '[deploy(b, "footman", MID - 15, MID - 15), deploy(b, "footman", MID - 15, MID - 15)]')).toEqual(["sent", "No more footmans to send."]);
  });

  it("phase 2: after a battle the troops sent are gone, the loot goes into storage as far as it fits, the village keeps the rest; stars kept, renown for new ones", async () => {
    const g = await start();
    await realmOf(g);
    py(g, `r = global_vars.realm
r["army"] = {"footman": 25, "archer": 3}
r["gold"], r["food"] = 0, capacity(r, "food") - 100
b = start_raid(r, 0)
for n in range(20):
    deploy(b, "footman", MID - 14 + n % 5, MID - 14)
while not b["over"]:
    tick(b)
xp = r["xp"]
res = finish_raid(r, 0, b)`);
    expect(py(g, '[r["army"], res["stars"], res["new_stars"], res["gold"], res["food"], res["lost"], r["campaign"]["0"], village_loot(r, 0)]'))
      .toEqual([{ footman: 5, archer: 3 }, 3, 3, 500, 100, 400, 3, [0, 0]]);
    expect(py<number>(g, 'r["xp"] - xp')).toBe(py<number>(g, "3 * CAMPAIGN_XP * 1"));
    // Again: no new stars, no renown, nothing left to take.
    py(g, 'r["army"] = {"footman": 20}\nb = start_raid(r, 0)\nfor n in range(20):\n    deploy(b, "footman", MID - 14 + n % 5, MID - 14)\nwhile not b["over"]:\n    tick(b)\nxp = r["xp"]\nres = finish_raid(r, 0, b)');
    expect(py(g, '[res["new_stars"], r["xp"] - xp, res["gold"] + res["food"]]')).toEqual([0, 0, 0]);
    // No army, no battle.
    py(g, 'r["army"] = {}');
    expect(py(g, 'start_raid(r, 0)')).toBe("Train an army first: tap a barracks, or the Army button.");
  });

  it("phase 2: on screen: the Attack window, into a battle, taps put troops down, it plays out, and back home with the loot", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nr["army"] = {"footman": 20, "archer": 5}');
    py(g, 'do_act("campaign", None)');
    step(g, 2);
    expect(py<string[]>(g, '[str(b.arg) for b in instances("Button") if b.act == "attack" and not b.off]')).toEqual(["0"]);
    py(g, 'press(next(b for b in instances("Button") if b.act == "attack" and b.arg == 0))');
    step(g, 3);
    expect(room(g)).toBe("Battle");
    // Too close: a tap on the keep says so, and sends nobody.
    py(g, 'x, y = to_screen(*tile_xy(MID, MID))');
    click(g, ...py<[number, number]>(g, "[x, y]"));
    expect(py(g, '[len(global_vars.battle["units"]), global_vars.said[0]]')).toEqual([0, "Too close: put troops down outside the village."]);
    // Taps on the grass outside: a footman each (the view on them, clear of the buttons along the bottom).
    py(g, 'x, y = tile_xy(MID - 12, MID - 14)\nw, h = shown()\nmove_camera(x - w / 2, y - h / 2)');
    step(g, 2);
    for (let k = 0; k < 20; k++) {
      click(g, ...py<[number, number]>(g, `list(to_screen(*tile_xy(MID - 14 + ${k % 5}, MID - 14)))`));
    }
    expect(py<number>(g, 'len(global_vars.battle["units"])')).toBe(20);
    expect(py(g, 'len(instances("Prop")) > len(global_vars.battle["bs"])')).toBe(true);      // a Prop each
    for (let k = 0; k < 12000 && !py<boolean>(g, 'global_vars.battle["over"]'); k++) step(g);
    step(g, 2);
    expect(py(g, '[global_vars.battle["stars"], r["campaign"]["0"], r["gold"] > 1000]')).toEqual([3, 3, true]);
    py(g, 'press(next(b for b in instances("Button") if b.act == "go_home"))');
    step(g, 3);
    expect([room(g), py(g, 'r["army"]')]).toEqual(["Realm", { archer: 5 }]);
  }, 120_000);

  it("phase 2: the Army and Attack windows draw, and fit the screen", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nr["food"] = 99999\nfor b in r["buildings"]:\n    b["level"] = levels(b["kind"]) if b["kind"] != "builder_hut" else 1\nr["buildings"].append(new_building("barracks", 2, 2, 10))\nr["buildings"].append(new_building("army_camp", 8, 2, 8))\ntrain(r, "knight")');
    for (const w of ["army", "campaign"]) {
      py(g, `open_panel("${w}")`);
      step(g, 3);
      expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
    }
  });

  // ---- phase 3: raiding classmates (the server's answers played in with raidArrive)

  /** A kingdom with an army, online (as the published game is, signed in). */
  async function online() {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nr["army"] = {"footman": 25, "archer": 5}\nr["gold"] = 2000');
    g.raidArrive({ online: true, news: { trophies: 120, shield: 0, defenses: [] } });
    step(g, 2);
    return g;
  }
  /** A classmate's kingdom as the server would send it: a computer village's layout. */
  const FOUND = (g: Game) => ({ id: 41, name: "Ben", trophies: 130, gold: 3000, food: 2000, win: 22, lose: 13,
    buildings: py<unknown[]>(g, 'village_layout(1)') });

  it("phase 3: offline (the editor, signed out) there are no raids: the Classmates tab says so and a search does nothing", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'global_vars.realm["army"] = {"footman": 5}\nglobal_vars.attack_tab = "classmates"\nopen_panel("campaign")');
    step(g, 3);
    expect(py(g, 'next(b for b in instances("Button") if b.act == "search").off')).toBe(true);
    expect(py(g, 'search(global_vars.realm)')).toBe("Raiding classmates works in the published game, signed in.");
    expect(g.orders).toEqual([]);
  });

  it("phase 3: online, the kingdom is shared: buildings standing, gold, food and keep level (only a change goes)", async () => {
    const g = await online();
    py(g, 'r["buildings"].append(new_building("granary", 2, 2, 0))\nshare_kingdom(r)\nshare_kingdom(r)');
    step(g);
    const shares = g.orders.filter((o) => o.op === "share");
    expect(shares.length).toBe(1);
    const base = (shares[0] as Extract<RaidOrder, { op: "share" }>).base;
    expect([base.gold, base.food, base.power, base.buildings.some((b) => b.kind === "granary")]).toEqual([2000, 1000, 1, false]);
    expect(base.buildings.length).toBe(py(g, 'len(r["buildings"]) - 1'));
    expect(py(g, 'r["trophies"]')).toBe(120);
  });

  it("phase 3: a search costs gold, the kingdom found is raided like a village, and the result goes to the server, loot and replay", async () => {
    const g = await online();
    py(g, 'global_vars.attack_tab = "classmates"\nopen_panel("campaign")');
    step(g, 2);
    py(g, 'press(next(b for b in instances("Button") if b.act == "search"))');
    step(g);
    expect(py(g, 'r["gold"]')).toBe(2000 - 50);
    expect(g.orders.at(-1)).toEqual({ op: "find" });
    g.raidArrive({ found: FOUND(g) });
    step(g, 3);
    expect(room(g)).toBe("Battle");
    expect(py(g, '[global_vars.raid["kind"], global_vars.raid["name"], len(global_vars.battle["bs"]) == len(village_layout(1))]')).toEqual(["player", "Ben", true]);
    // Before any troop, the clock doesn't run.
    step(g, 60);
    expect(py(g, 'global_vars.battle["time"]')).toBe(0);
    py(g, 'for n in range(20):\n    deploy(global_vars.battle, "footman", MID - 14 + n % 5, MID - 14)');
    for (let k = 0; k < 12000 && !py<boolean>(g, 'global_vars.battle["over"]'); k++) step(g);
    step(g, 2);
    const fin = g.orders.find((o) => o.op === "finish") as Extract<RaidOrder, { op: "finish" }>;
    expect([fin.id, fin.stars, fin.percent, fin.replay.length]).toEqual([41, 3, 100, 20]);
    expect(fin.gold <= 3000 && fin.food <= 2000 && fin.gold > 0).toBe(true);
    expect(py(g, 'r["army"]')).toEqual({ footman: 5, archer: 5 });
    // The trophies: what they should be at once, the server's when it answers.
    expect(py(g, 'instances("Battlefield")[0].result["trophies"]')).toBe(22);
    g.raidArrive({ result: { trophies: 22, mine: 142 } });
    step(g, 2);
    expect(py(g, 'raid_result()')).toEqual({ trophies: 22, mine: 142 });
  }, 120_000);

  it("phase 3: nobody to raid: the search's gold comes back; Next before the first troop looks again", async () => {
    const g = await online();
    py(g, 'do_act("search", None)');
    step(g);
    g.raidArrive({ found: { id: null, why: "Nobody to raid right now." } });
    step(g, 2);
    expect(py(g, '[r["gold"], global_vars.searching, global_vars.said[0]]')).toEqual([2000, false, "Nobody to raid right now."]);
    py(g, 'do_act("search", None)');
    step(g);
    g.raidArrive({ found: FOUND(g) });
    step(g, 3);
    expect(room(g)).toBe("Battle");
    py(g, 'press(instances("Battlefield")[0].next)');
    step(g, 3);
    expect([room(g), py(g, 'global_vars.searching'), py(g, 'r["gold"]')]).toEqual(["Realm", true, 2000 - 100]);
    expect(g.orders.filter((o) => o.op === "find").length).toBe(3);
    expect(g.orders.some((o) => o.op === "finish")).toBe(false);      // no troop sent: no result, no trophies lost
  });

  it("phase 3: raids on you: their gold and food come off once, the server's told, and a replay plays the raid out as it went", async () => {
    const g = await online();
    // A raid, played here first: what the raider's game would have sent.
    // Troops in two waves, ten seconds apart: a replay has to send each when it went.
    py(g, `b = new_battle(village_layout(1), {"footman": 12}, [1000, 600])
for n in range(12):
    if n == 6:
        for _ in range(300):
            tick(b)
    deploy(b, "footman", MID - 14 + n % 4, MID - 14 - n // 4)
while not b["over"]:
    tick(b)
done = [b["stars"], destroyed_pct(b)]`);
    const defense = { id: 77, name: "Ben", stars: py<number>(g, 'b["stars"]'), percent: 0, gold: 500, food: 300, trophies: -20, at: 0, new: true,
      buildings: py<unknown[]>(g, 'village_layout(1)'), replay: py<unknown[]>(g, 'b["replay"]') };
    py(g, 'r["food"] = 1000');
    g.raidArrive({ news: { trophies: 100, shield: 4 * 3600, defenses: [defense] } });
    step(g, 70);
    expect(py(g, '[r["gold"], r["food"], r["trophies"], r["raids_applied"]]')).toEqual([1500, 700, 100, [77]]);
    expect(g.orders).toContainEqual({ op: "seen", ids: [77] });
    expect(py<string>(g, 'global_vars.said[0]')).toContain("Ben raided you!");
    // The same news again (before the server's next): nothing taken twice.
    step(g, 70);
    expect(py(g, '[r["gold"], r["food"]]')).toEqual([1500, 700]);
    // Watched: the same battle, the same end.
    py(g, 'do_act("watch", 0)');
    step(g, 3);
    expect([room(g), py(g, 'global_vars.raid["kind"]')]).toEqual(["Battle", "replay"]);
    for (let k = 0; k < 12000 && !py<boolean>(g, 'global_vars.battle["over"]'); k++) step(g);
    expect(py(g, '[global_vars.battle["stars"], destroyed_pct(global_vars.battle)]')).toEqual(py(g, "done"));
    expect(py(g, 'r["army"]')).toEqual({ footman: 25, archer: 5 });      // watching costs nothing
  }, 120_000);

  it("phase 3: the Classmates tab draws, with raids on you to watch", async () => {
    const g = await online();
    g.raidArrive({ news: { trophies: 100, shield: 3600, defenses: [{ id: 1, name: "Ben", stars: 2, percent: 60, gold: 10, food: 5, trophies: -12, at: 0, new: false, buildings: [], replay: [] }] } });
    step(g, 2);
    py(g, 'global_vars.attack_tab = "classmates"\nopen_panel("campaign")');
    step(g, 3);
    expect(py<number>(g, 'len([b for b in instances("Button") if b.act == "watch"])')).toBe(1);
    expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
  });

  // ---- phase 4: champions and spells

  /** A kingdom with both altars, a mage tower and an army. */
  async function mighty() {
    const g = await start();
    await realmOf(g);
    py(g, `r = global_vars.realm
r["obstacles"] = []
next(b for b in r["buildings"] if b["kind"] == "keep")["level"] = 9
r["gold"] = r["food"] = 50000
def place(kind, level):
    spot = next((x, y) for x in range(MAP_W) for y in range(MAP_H) if fits(r, kind, x, y))
    b = new_building(kind, *spot, level)
    r["buildings"].append(b)
    return b
wa = place("warlord_altar", 3)
ha = place("huntress_altar", 1)
mt = place("mage_tower", 4)
r["army"] = {"footman": 20}`);
    return g;
  }

  it("phase 4: champions: their altar's level, well or resting on the real clock, busy while it's upgraded", async () => {
    const g = await mighty();
    expect(py(g, '[champ_level(r, "warlord"), champ_hp(r, "warlord"), sorted(champs_for_battle(r))]')).toEqual([3, 1110, ["huntress", "warlord"]]);
    // Hurt in a battle: half healed after half the rest.
    py(g, 'r["champions"]["warlord"] = {"hurt": 1000, "t": now()}');
    later(g, py<number>(g, "CHAMP_REST / 2"));
    expect(py(g, 'champ_hp(r, "warlord")')).toBe(1110 - 1000 + 555);
    later(g, py<number>(g, "CHAMP_REST"));
    expect(py(g, 'champ_hp(r, "warlord")')).toBe(1110);
    // Upgrading the altar: he stays home.
    py(g, 'upgrade(r, wa)');
    expect(py(g, 'champ_ready(r, "warlord")')).toBe("The Warlord is busy while the altar is upgraded.");
    expect(py(g, 'sorted(champs_for_battle(r))')).toEqual(["huntress"]);
    expect(py(g, 'champ_ready(r, "huntress") is None and new_realm(1)["champions"] == {}')).toBe(true);
  });

  it("phase 4: in battle, a champion fights, and uses their ability once: Battle Cry enrages and heals, Volley strikes the buildings near her", async () => {
    const g = await mighty();
    py(g, `b = new_battle(village_layout(3), {"footman": 6}, [0, 0], {"warlord": [3, 600], "huntress": [1, 420]}, {}, 1)
def near_spot(b, reach):
    """A tile troops may go down on, within reach of a building (not a wall)."""
    return next((x, y) for x in range(MAP_W) for y in range(MAP_H) if (x, y) not in b["no_deploy"]
                and any(s["kind"] != "wall" and rect_dist(x, y, s) <= reach for s in b["bs"]))
sx, sy = near_spot(b, 3)
deploy(b, "warlord", sx, sy)
for n in range(6):
    deploy(b, "footman", sx, sy)
w = champ_unit(b, "warlord")`);
    expect(py(g, '[w["hp"], w["max"], w["stats"]["damage"], can_ability(b, "huntress")]')).toEqual([600, 1110, 73, "The Huntress isn't on the field."]);
    expect(py(g, 'ability(b, "warlord")')).toBe("used");
    expect(py(g, '[w["hp"] > 600, sum(1 for u in b["units"] if u.get("rage", 0) > 0), ability(b, "warlord")]')).toEqual([true, 7, "Battle Cry is used: once a battle."]);
    // Volley: every building near her loses health at once.
    py(g, `deploy(b, "huntress", *near_spot(b, 3))
h = champ_unit(b, "huntress")
near = [i for i, x in enumerate(b["bs"]) if x["kind"] != "wall" and rect_dist(h["x"], h["y"], x) <= VOLLEY_RADIUS]
before = [b["bs"][i]["hp"] for i in near]
ability(b, "huntress")`);
    expect(py(g, 'len(near) > 0 and all(b["bs"][i]["hp"] < hp or b["bs"][i]["dead"] for i, hp in zip(near, before))')).toBe(true);
    // Wounds come home.
    py(g, 'h["hp"] = 100\nw["dead"] = True\nchamps_home(r, b)');
    expect(py(g, '[r["champions"]["huntress"]["hurt"], r["champions"]["warlord"]["hurt"]]')).toEqual([320, 1110]);
  });

  it("phase 4: spells: brewed in the mage tower for gold on the real clock, room for so many; open by the tower's level", async () => {
    const g = await mighty();
    expect(py(g, '[spell_room(r), brew(r, "heal"), r["gold"]]')).toEqual([5, "queued", 48500]);
    expect(py(g, 'can_brew(r, "freeze") is None and can_brew(new_realm(1), "heal") is not None')).toBe(true);
    py(g, 'for _ in range(6):\n    brew(r, "rage")');
    expect(py(g, '[spells_used(r), can_brew(r, "heal")]')).toEqual([5, "No room in the mage tower: upgrade it."]);
    expect(py(g, 'unbrew(r, "rage")')).toBe(true);
    later(g, 361);
    expect(py(g, '[brew_tick(r), r["spells"]]')).toEqual([1, { heal: 1 }]);
    py(g, 'mt["level"] = 2');
    expect(py(g, 'can_brew(r, "lightning")')).toBe("Upgrade the mage tower to level 3 first.");
  });

  it("phase 4: spells in battle: Lightning strikes, Freeze stops defenses, Heal heals, Rage speeds; cast ones are gone after", async () => {
    const g = await mighty();
    py(g, `b = new_battle(village_layout(1), {"footman": 2}, [0, 0], {}, {"lightning": 1, "freeze": 1, "heal": 1, "rage": 1}, 3)
keep_ = next(x for x in b["bs"] if x["kind"] == "keep")
kx, ky = middle(keep_)
hp = keep_["hp"]`);
    expect(py(g, 'cast(b, "lightning", kx, ky)')).toBe("cast");
    expect(py(g, 'hp - keep_["hp"]')).toBe(py(g, 'round(400 * (1 + SPELL_GROW * 2))'));
    expect(py(g, 'cast(b, "lightning", kx, ky)')).toBe("No Lightning spells left.");
    // Freeze over the tower: a footman in its reach is safe while it lasts.
    py(g, `tw = next(x for x in b["bs"] if x["kind"] == "archer_tower")
tx, ty = middle(tw)
cast(b, "freeze", tx, ty)
deploy(b, "footman", MID - 12, MID - 12)
u = b["units"][0]
u["x"], u["y"] = tx + 3, ty
for _ in range(60):
    tick(b)
frozen_hp = u["hp"]`);
    expect(py(g, 'frozen_hp')).toBe(py(g, 'TROOPS["footman"]["hp"]'));
    // Heal: health back; Rage: faster.
    py(g, 'u["hp"] = 10\ncast(b, "heal", u["x"], u["y"])\nfor _ in range(30):\n    zones_tick(b, BATTLE_TICK)');
    expect(py<number>(g, 'u["hp"]')).toBeGreaterThan(10);
    // Rage: the same walk goes further.
    py(g, `def walk(rage):
    t = new_battle(village_layout(1), {"footman": 1}, [0, 0], {}, {"rage": 1}, 3)
    deploy(t, "footman", MID - 14, MID - 14)
    v = t["units"][0]
    if rage:
        cast(t, "rage", v["x"], v["y"])
    for _ in range(20):
        tick(t)
    return math.hypot(v["x"] - (MID - 14), v["y"] - (MID - 14))`);
    expect(py<number>(g, 'walk(True) / walk(False)')).toBeGreaterThan(1.4);
    py(g, 'r["spells"] = {"lightning": 2, "heal": 1, "rage": 1}\nspells_home(r, b)');
    expect(py(g, 'r["spells"]')).toEqual({ lightning: 1, rage: 1 });      // lightning and heal were cast here
  });

  it("phase 4: a raid with champions, spells and an ability replays exactly", async () => {
    const g = await mighty();
    py(g, `b = new_battle(village_layout(2), {"footman": 10}, [0, 0], {"warlord": [3, 900]}, {"rage": 1, "lightning": 1}, 4)
deploy(b, "warlord", MID - 16, MID - 16)
for n in range(10):
    deploy(b, "footman", MID - 14 + n % 5, MID - 13)
for _ in range(200):
    tick(b)
cast(b, "rage", MID - 8, MID - 8)
ability(b, "warlord")
for _ in range(100):
    tick(b)
cast(b, "lightning", MID, MID)
while not b["over"]:
    tick(b)
want = [b["stars"], destroyed_pct(b), round(champ_unit(b, "warlord")["hp"], 3)]
steps = list(b["replay"])
again = new_battle(village_layout(2), replay_army(steps), [0, 0])
queue = list(steps)
while not again["over"]:
    while queue and queue[0][0] <= again["time"] + BATTLE_TICK / 2:
        s = queue.pop(0)
        battle_act(again, s[1], s[2], s[3])
    tick(again)
got = [again["stars"], destroyed_pct(again), round(champ_unit(again, "warlord")["hp"], 3)]`);
    expect(py(g, "got")).toEqual(py(g, "want"));
    expect(py<string[]>(g, '[s[1] for s in steps if not s[1] in TROOPS]')).toEqual(["warlord_3_900", "rage_4", "cry", "lightning_4"]);
    // The champion comes back with the health he went in with, not all of it.
    expect(py(g, 'one = new_battle(village_layout(2), {}, [0, 0])\nbattle_act(one, "warlord_3_900", MID - 16, MID - 16)\nchamp_unit(one, "warlord")["hp"]')).toBe(900);
  }, 120_000);

  it("phase 4: on screen: the Army window's tabs fit; in battle, a champion's button sends them, then uses their ability; a spell is cast with a tap", async () => {
    const g = await mighty();
    py(g, 'r["spells"] = {"lightning": 1}');
    for (const t of ["troops", "spells", "champions"]) {
      py(g, `global_vars.army_tab = "${t}"\nopen_panel("army")`);
      step(g, 3);
      expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
    }
    py(g, 'close_panel()\ndo_act("attack", 0)');
    step(g, 3);
    expect(room(g)).toBe("Battle");
    py(g, 'f = instances("Battlefield")[0]\nx, y = tile_xy(MID - 12, MID - 14)\nw, h = shown()\nmove_camera(x - w / 2, y - h / 2)');
    step(g, 2);
    py(g, 'press(next(bt for bt in f.tray if bt.arg == "warlord"))');
    step(g);
    click(g, ...py<[number, number]>(g, 'list(to_screen(*tile_xy(MID - 12, MID - 14)))'));
    expect(py(g, 'champ_unit(global_vars.battle, "warlord") is not None')).toBe(true);
    step(g, 2);
    expect(py(g, 'next(bt for bt in f.tray if bt.arg == "warlord").act')).toBe("ability");
    py(g, 'press(next(bt for bt in f.tray if bt.arg == "warlord"))');
    expect(py(g, 'champ_unit(global_vars.battle, "warlord")["used"]')).toBe(true);
    py(g, 'press(f.spell_buttons[0])');
    click(g, ...py<[number, number]>(g, 'list(to_screen(*tile_xy(MID, MID)))'));
    expect(py(g, 'global_vars.battle["cast"]')).toEqual({ lightning: 1 });
  });

  // ---- phase 5: traps and the forge

  it("phase 5: traps are hidden: no stars for them, nobody goes for them or walks round them, troops may go down on them", async () => {
    const g = await start();
    await realmOf(g);
    py(g, `lay = village_layout(0) + [{"kind": "spike_pit", "gx": MID - 8, "gy": MID - 8, "level": 1}]
b = new_battle(lay, {"footman": 1}, [0, 0])`);
    expect(py(g, '[len(b["traps"]), any(x["kind"] in TRAPS for x in b["bs"]), (MID - 8, MID - 8) in b["cells"]]')).toEqual([1, false, false]);
    expect(py(g, 'stars_now(b) == stars_now(new_battle(village_layout(0), {}, [0, 0]))')).toBe(true);
  });

  it("phase 5: a trap goes off once when a troop comes near: the spike pit hits one, the keg everyone round it, the snare flings out its room", async () => {
    const g = await start();
    await realmOf(g);
    py(g, `def trap_test(kind, level, army):
    lay = village_layout(0) + [{"kind": kind, "gx": MID - 25, "gy": MID - 25, "level": level}]
    b = new_battle(lay, army, [0, 0])
    for k, n in army.items():
        for _ in range(n):
            deploy(b, k, MID - 25.3, MID - 25.3)
    tick(b)
    return b`);
    // Spike pit: one footman, hit hard (120 kills a 45-health footman); the rest untouched.
    expect(py(g, 'b = trap_test("spike_pit", 1, {"footman": 3})\n[sum(u["dead"] for u in b["units"]), b["traps"][0]["armed"]]')).toEqual([1, false]);
    // Keg: everyone round it.
    expect(py(g, 'b = trap_test("powder_keg", 2, {"archer": 4})\nsum(u["dead"] for u in b["units"])')).toBe(4);
    // Snare: as many as its room (6 at level 1: six footmen of seven).
    expect(py(g, 'b = trap_test("catapult_snare", 1, {"footman": 7})\nsum(u["dead"] for u in b["units"])')).toBe(6);
    // Once only.
    expect(py(g, 'b = trap_test("spike_pit", 1, {"footman": 3})\nfor _ in range(30):\n    tick(b)\nsum(u["dead"] for u in b["units"])')).toBe(1);
  });

  it("phase 5: villages from the fifth hide traps; a kingdom's traps go to raiders as they are", async () => {
    const g = await start();
    await realmOf(g);
    expect(py(g, '[sum(1 for d in village_layout(i) if d["kind"] in TRAPS) for i in (0, 3, 4, 9, 15)]')).toEqual([0, 0, 1, 2, 4]);
    py(g, 'r = global_vars.realm\nr["buildings"].append(new_building("powder_keg", 3, 3, 2))');
    expect(py(g, '[d for d in kingdom_for_raids(r) if d["kind"] in TRAPS] == [{"kind": "powder_keg", "gx": 3, "gy": 3, "level": 2}]')).toBe(true);
    expect(py(g, 'len(new_battle(found_layout({"buildings": kingdom_for_raids(r)}), {}, [0, 0])["traps"])')).toBe(1);
  });

  it("phase 5: the forge researches a troop's level for gold on the real clock, one at a time, as high as its level allows; leveled troops are stronger", async () => {
    const g = await start();
    await realmOf(g);
    py(g, `r = global_vars.realm
r["obstacles"] = []
r["gold"] = 100000
next(b for b in r["buildings"] if b["kind"] == "keep")["level"] = 6
r["buildings"].append(new_building("barracks", 2, 2, 4))`);
    expect(py(g, 'can_research(r, "footman")')).toBe("Build a forge first.");
    py(g, 'fg = new_building("forge", 8, 2, 1)\nr["buildings"].append(fg)');
    expect(py(g, '[research(r, "footman"), r["gold"], can_research(r, "archer")]')).toEqual(["started", 96000, "The forge is busy: one at a time."]);
    later(g, 3601);
    expect(py(g, '[research_tick(r), troop_level(r, "footman")]')).toEqual([true, 2]);
    expect(py(g, 'can_research(r, "footman")')).toBe("Upgrade the forge to level 2 first.");
    expect(py(g, 'can_research(r, "knight")')).toBe("Upgrade a barracks to level 6 first.");
    // A level-3 footman in battle: health and damage up; its replay step says so, and plays back the same.
    py(g, `b = new_battle(village_layout(0), {"footman": 1}, [0, 0], levels={"footman": 3})
deploy(b, "footman", MID - 14, MID - 14)
u = b["units"][0]`);
    expect(py(g, '[u["max"], round(troop_stats(u)["damage"], 2), b["replay"][0][1]]')).toEqual([56, 9.6, "footman_3"]);
    expect(py(g, `again = new_battle(village_layout(0), replay_army(b["replay"]), [0, 0])
battle_act(again, "footman_3", MID - 14, MID - 14)
again["units"][0]["max"]`)).toBe(56);
  });

  it("phase 5: the Build window's Traps tab and the Forge window fit the screen", async () => {
    const g = await start();
    await realmOf(g);
    py(g, 'r = global_vars.realm\nnext(b for b in r["buildings"] if b["kind"] == "keep")["level"] = 9\nr["buildings"].append(new_building("forge", 2, 2, 3))\nr["gold"] = 10 ** 6');
    py(g, 'open_panel("shop")\ndo_act("shop_tab", "traps")');
    step(g, 3);
    expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
    expect(py<string[]>(g, '[k for k, *_ in shop_rows(r, "traps")]')).toEqual(["spike_pit", "powder_keg", "catapult_snare"]);
    py(g, 'research(r, "footman")\nopen_panel("forge")');
    step(g, 3);
    expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
  });
});
