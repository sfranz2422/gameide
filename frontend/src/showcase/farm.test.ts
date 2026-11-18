/**
 * The farm showcase game, Cloverbrook (phase 1: the farm), played headless in the
 * real Pyodide: planting and growing on the real clock (moved on by the tests),
 * harvesting into the barn, tapping and dragging on the isometric map, the barn,
 * levels and what they open, the orders, buying fields, saving (and growing while
 * away), the board, and a field farmed from the keyboard alone. Phase 2: building
 * animal homes and factories, feeding and collecting, making goods in a queue, and
 * orders for goods.
 * Runs when the game has been built (python3 showcase/farm/build.py).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/farm/out/project.json");
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
/** Where a tile's middle is on the screen now. */
const onScreen = (g: PythonGame, gx: number, gy: number) =>
  py<[number, number]>(g, `[tile_xy(${gx}, ${gy})[0] - view_x, tile_xy(${gx}, ${gy})[1] - view_y]`);
/** Into the farm, a new one (seeded), with the view on the fields. */
async function farmOf(g: PythonGame, seed = 7) {
  py(g, `global_vars.farm = new_farm(${seed})\nsave_set("farm", global_vars.farm)\nroom_goto("Farm")`);
  step(g, 3);
  expect(room(g)).toBe("Farm");
  py(g, "global_vars.farm = new_farm(7)\nx, y = tile_xy(8, 6)\nmove_camera(x - VIEW_W / 2, y - VIEW_H / 2)");
  step(g, 3);
}
const later = (g: PythonGame, seconds: number) => py(g, `global_vars.time_shift = getattr(global_vars, "time_shift", 0) + ${seconds}`);
/** What's in each field, in order: a crop, or "" for bare soil. */
const fieldsNow = (g: PythonGame) => py<string[]>(g, '[fl["crop"] or "" for fl in global_vars.farm["fields"]]');

describe.runIf(have)("Cloverbrook", () => {
  it("the map: every tile is found again where it's drawn", async () => {
    const g = await start();
    const bad = py<number[][]>(g, `[[gx, gy] for gx in range(MAP_W) for gy in range(MAP_H)
        if tile_at(*tile_xy(gx, gy)) != (gx, gy) or tile_at(tile_xy(gx, gy)[0] + TILE_W * 0.4, tile_xy(gx, gy)[1]) != (gx, gy)]`);
    expect(bad).toEqual([]);
    expect(py(g, "tile_at(-500, -500) is None")).toBe(true);
    // Nothing on the starting farm sits on anything else, or off the map.
    const clash = py<string[]>(g, `
seen, out = {}, []
for kind, gx, gy in START_FARM:
    for t in footprint_tiles(kind, gx, gy):
        out += [f"{kind} on {seen[t]}"] if t in seen else []
        seen[t] = kind
for kind, gx, gy in DECOR:
    out += [f"{kind} on {seen[(gx, gy)]}"] if (gx, gy) in seen else []
    seen[(gx, gy)] = kind
for t in ROAD:
    out += [f"road on {seen[t]}"] if t in seen else []
for t in START_FIELDS:
    out += [f"field on {seen.get(t, 'road' if t in ROAD else None)}"] if t in seen or t in ROAD else []
out += [f"off the map: {t}" for t in list(seen) + ROAD + START_FIELDS if not on_map(*t)]
out`);
    expect(clash).toEqual([]);
  });

  it("tap bare soil, tap a seed: planted; it grows on the clock, and a tap harvests it into the barn", async () => {
    const g = await start();
    await farmOf(g);
    click(g, ...onScreen(g, 7, 6));
    expect(py(g, "global_vars.sel")).toEqual([7, 6]);
    expect(py(g, "seed_bar_open()")).toBe(true);
    const wheat = py<[string, number, number]>(g, "seed_chips()[0]");
    click(g, wheat[1] + 40, wheat[2] + 40);
    expect(fieldsNow(g)[0]).toBe("wheat");
    expect(py(g, 'stage(global_vars.farm["fields"][0])')).toBe(0);
    later(g, py<number>(g, 'CROPS["wheat"]["grow"]') * 0.7);
    expect(py(g, 'stage(global_vars.farm["fields"][0])')).toBe(2);
    // Tapped while growing: chosen, its clock shown; not harvested.
    click(g, ...onScreen(g, 7, 6));
    expect(fieldsNow(g)[0]).toBe("wheat");
    later(g, py<number>(g, 'CROPS["wheat"]["grow"]'));
    expect(py(g, 'ready(global_vars.farm["fields"][0])')).toBe(true);
    click(g, ...onScreen(g, 7, 6));
    expect(py(g, 'global_vars.farm["fields"][0]["crop"] is None')).toBe(true);
    expect(py(g, 'global_vars.farm["barn"]')).toEqual({ wheat: 2 });
    expect(py(g, 'global_vars.farm["xp"]')).toBe(1);
  });

  it("seeds cost coins, and a crop waits for its level", async () => {
    const g = await start();
    await farmOf(g);
    expect(py(g, 'f = global_vars.farm\nplant(f, f["fields"][0], "corn")')).toBe("locked");
    py(g, 'f["level"] = 2\nf["coins"] = 1');
    expect(py(g, 'plant(f, f["fields"][0], "corn")')).toBe("coins");
    py(g, 'f["coins"] = 10');
    expect(py(g, 'plant(f, f["fields"][0], "corn")')).toBe("planted");
    expect(py(g, 'f["coins"]')).toBe(8);
    expect(py(g, 'plant(f, f["fields"][0], "wheat")')).toBe("busy");
  });

  it("drag a seed across bare fields to plant them all; drag across ripe ones to harvest them all", async () => {
    const g = await start();
    await farmOf(g);
    click(g, ...onScreen(g, 7, 6));
    const wheat = py<[string, number, number]>(g, "seed_chips()[0]");
    drag(g, [wheat[1] + 40, wheat[2] + 40], [onScreen(g, 7, 6), onScreen(g, 8, 6), onScreen(g, 9, 6), onScreen(g, 9, 7), onScreen(g, 8, 7)]);
    // Fields are (7,6) (8,6) (9,6) (7,7) (8,7) (9,7): every one crossed but (7,7).
    expect(fieldsNow(g)).toEqual(["wheat", "wheat", "wheat", "", "wheat", "wheat"]);
    later(g, 61);
    drag(g, onScreen(g, 7, 6), [onScreen(g, 8, 6), onScreen(g, 9, 6), onScreen(g, 9, 7)]);
    expect(fieldsNow(g)).toEqual(["", "", "", "", "wheat", ""]);
    expect(py(g, 'global_vars.farm["barn"]["wheat"]')).toBe(8);
    // A drag that starts on grass moves the view instead.
    const before = py<number[]>(g, "list(global_vars.cam)");
    drag(g, [500, 300], [[450, 280], [400, 260]]);
    expect(py<number[]>(g, "list(global_vars.cam)")).toEqual([before[0]! + 100, before[1]! + 40]);
    expect(fieldsNow(g)).toEqual(["", "", "", "", "wheat", ""]);
  });

  it("the barn holds so much, a full barn stops a harvest, and selling pays", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["barn"] = {"wheat": BARN_SPACE - 1}\nplant(f, f["fields"][0], "wheat")');
    later(g, 61);
    click(g, ...onScreen(g, 7, 6));
    expect(py(g, 'f["fields"][0]["crop"]')).toBe("wheat");
    expect(py(g, "global_vars.said[0]")).toContain("barn is full");
    py(g, 'do_act("barn", None)');
    step(g);
    expect(py(g, "global_vars.panel")).toBe("barn");
    const coins = py<number>(g, 'f["coins"]');
    py(g, 'do_act("sell", ("wheat", 10))');
    expect(py(g, 'f["coins"]')).toBe(coins + 10 * py<number>(g, 'CROPS["wheat"]["sell"]'));
    expect(py(g, 'f["barn"]["wheat"]')).toBe(py<number>(g, "BARN_SPACE") - 11);
    py(g, 'do_act("close", None)');
    click(g, ...onScreen(g, 7, 6));
    expect(py(g, 'f["fields"][0]["crop"] is None')).toBe(true);
  });

  it("XP makes levels: a present of coins, what each opens, and the board hears it", async () => {
    const g = await start();
    await farmOf(g);
    expect(py(g, "[level_of(0), level_of(9), level_of(10), level_of(25), level_of(899), level_of(900), level_of(1200)]")).toEqual([1, 1, 2, 3, 10, 11, 12]);
    const coins = py<number>(g, 'global_vars.farm["coins"]');
    expect(py(g, 'add_xp(global_vars.farm, 26)')).toEqual([2, 3]);
    expect(py(g, 'global_vars.farm["coins"]')).toBe(coins + 2 * py<number>(g, "LEVEL_COINS"));
    expect(py(g, "crops_open(global_vars.farm)")).toEqual(["wheat", "corn", "carrot"]);
    expect(py(g, "opened_at(5)")).toEqual(["Pumpkins", "Cottage", "Fountain", "roads", "land: Pine Wood"]);
    step(g);
    expect(g.scores.at(-1)).toBe(3);
    expect(g.project.settings.scoreboard).toEqual({ unit: "level" });
  });

  it("orders: delivered from the barn for coins and XP; the slot waits, then fills; one can be skipped", async () => {
    const g = await start();
    await farmOf(g);
    const orders = py<{ want: Record<string, number>; coins: number; xp: number }[]>(g, 'global_vars.farm["orders"]');
    expect(orders.length).toBe(py<number>(g, "ORDER_SLOTS"));
    for (const o of orders) expect(Object.keys(o.want)).toEqual(["wheat"]);     // level 1: wheat is all there is
    expect(py(g, 'deliver(global_vars.farm, 0)[0]')).toBe("short");
    py(g, `global_vars.farm["barn"] = {"wheat": ${orders[0]!.want.wheat}}`);
    py(g, 'do_act("orders", None)');
    step(g);
    const coins = py<number>(g, 'global_vars.farm["coins"]');
    py(g, 'do_act("deliver", 0)');
    expect(py(g, 'global_vars.farm["coins"]')).toBe(coins + orders[0]!.coins);
    expect(py(g, 'global_vars.farm["barn"]')).toEqual({});
    expect(py(g, '"wait" in global_vars.farm["orders"][0]')).toBe(true);
    later(g, py<number>(g, "ORDER_WAIT") - 5);
    step(g, 61);
    expect(py(g, '"wait" in global_vars.farm["orders"][0]')).toBe(true);
    later(g, 6);
    step(g, 61);
    expect(py(g, '"want" in global_vars.farm["orders"][0]')).toBe(true);
    py(g, 'do_act("discard", 1)');
    expect(py(g, '"wait" in global_vars.farm["orders"][1]')).toBe(true);
    // More slots as the farm grows.
    py(g, 'global_vars.farm["level"] = 5\nfill_orders(global_vars.farm)');
    expect(py(g, 'len(global_vars.farm["orders"])')).toBe(5);
  });

  it("a field bought goes where it's tapped, on free grass only, and there's a most for each level", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'global_vars.farm["coins"] = 1000\ndo_act("shop", None)');
    step(g);
    py(g, 'do_act("buy_field", None)');
    expect(py(g, "global_vars.placing")).toBe("field");
    click(g, ...onScreen(g, 8, 6));                     // a field already
    expect(py(g, 'len(global_vars.farm["fields"])')).toBe(6);
    click(g, ...onScreen(g, 6, 8));                     // the road
    expect(py(g, 'len(global_vars.farm["fields"])')).toBe(6);
    click(g, ...onScreen(g, 10, 6));
    expect(py(g, 'global_vars.farm["fields"][-1]')).toMatchObject({ gx: 10, gy: 6 });
    expect(py(g, 'global_vars.farm["coins"]')).toBe(1000 - py<number>(g, "FIELD_COST"));
    step(g, 2);
    expect(py(g, 'len(instances("Field"))')).toBe(7);
    click(g, ...onScreen(g, 10, 7));
    expect(py(g, 'global_vars.farm["coins"]')).toBe(1000 - 2 * py<number>(g, "FIELD_COST") - py<number>(g, "FIELD_COST_STEP"));
    // Level 1 allows 8: that was the last, so placing stops.
    expect(py(g, "global_vars.placing")).toBe(false);
    expect(py(g, 'buy_field(global_vars.farm, 11, 6)')).toBe("most");
  });

  it("it's saved, and comes back with everything, grown while the game was closed", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nplant(f, f["fields"][2], "wheat")\nf["barn"] = {"wheat": 4}\nkeep(f)');
    step(g);
    const saved = g.saved();
    expect((saved.farm as { fields: { crop: string | null }[] }).fields[2]!.crop).toBe("wheat");
    const again = await start(saved);
    py(again, "global_vars.time_shift = 3600");
    py(again, 'room_goto("Farm")');
    step(again, 3);
    expect(py(again, 'ready(global_vars.farm["fields"][2])')).toBe(true);
    expect(py(again, 'global_vars.farm["barn"]')).toEqual({ wheat: 4 });
    expect(py(again, 'len(instances("Field"))')).toBe(6);
  });

  it("a field farmed from the keyboard alone, and the barn opened with B", async () => {
    const g = await start();
    expect(room(g)).toBe("Title");
    py(g, 'save_set("farm", new_farm(3))');
    press(g, "space");
    step(g, 3);
    expect(room(g)).toBe("Farm");
    // The cursor starts at (8, 5); down onto the fields' row, a step down-right at a time.
    press(g, "down");
    expect(py(g, "global_vars.cursor")).toEqual([9, 6]);
    press(g, "space");
    expect(py(g, "global_vars.sel")).toEqual([9, 6]);
    press(g, "1");
    expect(py(g, 'field_at(global_vars.farm, 9, 6)["crop"]')).toBe("wheat");
    later(g, 61);
    press(g, "space");
    expect(py(g, 'global_vars.farm["barn"]')).toEqual({ wheat: 2 });
    press(g, "b");
    expect(py(g, "global_vars.panel")).toBe("barn");
    // In a window the keys move among its buttons: Space presses the first, Sell 1.
    press(g, "space");
    expect(py(g, 'global_vars.farm["barn"]')).toEqual({ wheat: 1 });
    press(g, "escape");
    expect(py(g, "global_vars.panel")).toBeNull;
    expect(py(g, "global_vars.panel is None")).toBe(true);
  });

  it("questions may come any time but mid-drag; every window draws", async () => {
    const g = await start();
    await farmOf(g);
    g.engine.input.mouseMove(500, 300);
    step(g);
    g.engine.input.mouseDown(0);
    step(g);
    g.engine.input.mouseMove(450, 280);
    step(g, 2);
    expect(g.questionOk.at(-1)).toBe(false);
    g.engine.input.mouseUp(0);
    step(g, 2);
    expect(g.questionOk.at(-1)).toBe(true);
    py(g, 'f = global_vars.farm\nf["barn"] = {"wheat": 5, "corn": 3}\nf["level"] = 6\nplant(f, f["fields"][1], "pumpkin")\nfill_orders(f)');
    for (const w of ["barn", "orders", "shop"]) {
      py(g, `do_act("${w}", None)`);
      step(g, 5);
      expect(py(g, "global_vars.panel")).toBe(w);
    }
    py(g, 'do_act("close", None)\nglobal_vars.sel = (8, 6)');
    step(g, 5);
    py(g, 'global_vars.levelup = [6, 100]\nsay("hello")');
    step(g, 30);
    py(g, 'room_goto("Title")');
    step(g, 5);
  });

  it("phase 2: a farm saved before it comes back with no homes or factories, and plays on", async () => {
    const g = await start({ farm: { coins: 90, xp: 12, level: 2, barn: { wheat: 4 }, orders: [], made: 3, bought: 0, seed: 5,
      fields: [{ gx: 7, gy: 6, crop: "wheat", t: 0 }] } });
    py(g, 'room_goto("Farm")');
    step(g, 3);
    expect(py(g, '[global_vars.farm["homes"], global_vars.farm["mills"], global_vars.farm["coins"]]')).toEqual([[], [], 90]);
    expect(py(g, 'len(global_vars.farm["orders"])')).toBe(3);
  });

  it("phase 2: a building opens at its level, costs coins, is one of each, and goes where it's tapped on 2 x 2 free tiles", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["coins"] = 1000');
    expect(py(g, 'build(f, "feed_mill", 11, 7)')).toBe("level");
    py(g, 'f["level"] = 3');
    py(g, 'do_act("shop", None)');
    step(g);
    // The Farm tab: fields, fruit trees and animal homes; the Factories tab has its own.
    expect(py<string[][]>(g, "shop_rows(f)").map((r) => r[0])).toEqual(["field", "coop", "cowshed", "apple_tree", "sheep_pen", "cherry_tree"]);
    const rows = py<[string, string, number, string][]>(g, 'shop_rows(f, "factories")');
    expect(rows.map((r) => r[0])).toEqual(["feed_mill", "bakery", "dairy", "sugar_mill", "juice_press", "weaving_mill", "jam_kitchen"]);
    expect(rows[0]![3]).toBe("");
    expect(rows[1]![3]).toBe("Level 4");
    py(g, 'do_act("build", "feed_mill")');
    expect(py(g, "global_vars.placing")).toBe("feed_mill");
    click(g, ...onScreen(g, 9, 6));                     // on the fields: no room
    expect(py(g, 'f["mills"]')).toEqual([]);
    expect(py(g, "global_vars.placing")).toBe("feed_mill");
    click(g, ...onScreen(g, 11, 7));
    expect(py(g, 'f["mills"]')).toEqual([{ kind: "feed_mill", gx: 11, gy: 7, queue: [] }]);
    expect(py(g, 'f["coins"]')).toBe(1000 - py<number>(g, 'FACTORIES["feed_mill"]["cost"]'));
    expect(py(g, "global_vars.placing")).toBe(false);
    step(g, 2);
    expect(py(g, 'len([o for o in instances("Thing") if o.kind == "feed_mill"])')).toBe(1);
    expect(py(g, 'build(f, "feed_mill", 13, 7)')).toBe("owned");
    // Its tiles are taken now: no field on them.
    expect(py(g, "can_place(f, 12, 8)")).toBe(false);
  });

  it("phase 2: a factory makes one thing at a time from the barn, queues up to three, and a tap collects what's done", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 4\nf["coins"] = 1000\nbuild(f, "feed_mill", 11, 7)\nm = f["mills"][0]\nf["barn"] = {"wheat": 9, "corn": 4}');
    expect(py(g, 'make_in(f, m, "cow_feed")')).toBe("short");
    expect(py(g, '[make_in(f, m, "chicken_feed") for _ in range(4)]')).toEqual(["queued", "queued", "queued", "full"]);
    expect(py(g, 'f["barn"]')).toEqual({ wheat: 3, corn: 1 });
    // One after another: each ends a minute after the one before.
    expect(py(g, 'round(m["queue"][2]["end"] - m["queue"][0]["end"])')).toBe(120);
    step(g, 2);
    const at = onScreen(g, 11.5, 7.5);
    later(g, 61);
    click(g, ...at);
    expect(py(g, 'f["barn"].get("chicken_feed")')).toBe(1);
    expect(py(g, 'len(m["queue"])')).toBe(2);
    expect(py(g, "global_vars.panel")).toBeNull;
    // Nothing finished: a tap opens its window, where Make queues another.
    click(g, ...at);
    expect(py(g, "[global_vars.panel, global_vars.panel_of]")).toEqual(["mill", 0]);
    later(g, 200);
    py(g, 'do_act("collect_mill", 0)');
    expect(py(g, 'f["barn"].get("chicken_feed")')).toBe(3);
    py(g, 'f["barn"]["wheat"] = 2\nf["barn"]["corn"] = 1\ndo_act("make", (0, "chicken_feed"))');
    expect(py(g, 'len(m["queue"])')).toBe(1);
  });

  it("phase 2: animals eat feed, make their good on the clock, and a tap collects it and feeds them again", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 4\nf["coins"] = 1000\nbuild(f, "coop", 11, 7)\nh = f["homes"][0]\nf["barn"] = {"chicken_feed": 2}');
    step(g, 2);
    const at = onScreen(g, 11.5, 7.5);
    click(g, ...at);                                    // fed: two of three, there being two feed
    expect(py(g, "[animal_state(h, i) for i in range(3)]")).toEqual(["eating", "eating", "hungry"]);
    expect(py(g, 'f["barn"]')).toEqual({});
    click(g, ...at);                                    // nothing to do: its window
    expect(py(g, "global_vars.panel")).toBe("home");
    py(g, 'do_act("close", None)');
    later(g, py<number>(g, 'HOMES["coop"]["time"]') + 1);
    expect(py(g, "[animal_state(h, i) for i in range(3)]")).toEqual(["ready", "ready", "hungry"]);
    const xp = py<number>(g, 'f["xp"]');
    py(g, 'f["barn"]["chicken_feed"] = 5');
    click(g, ...at);
    expect(py(g, 'f["barn"]')).toEqual({ egg: 2, chicken_feed: 2 });
    expect(py(g, 'f["xp"]')).toBe(xp + 2 * py<number>(g, 'GOODS["egg"]["xp"]'));
    expect(py(g, "[animal_state(h, i) for i in range(3)]")).toEqual(["eating", "eating", "eating"]);
  });

  it("phase 2: orders ask for goods only once the farm can make them, and pay for them", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 6');
    expect(py<string[]>(g, "sorted(orderable(f))")).toEqual(["carrot", "corn", "pumpkin", "wheat"]);
    py(g, 'f["coins"] = 2000\nbuild(f, "bakery", 11, 7)\nbuild(f, "coop", 13, 7)\nbuild(f, "feed_mill", 11, 9)');
    expect(py<string[]>(g, "sorted(orderable(f))")).toEqual(["bread", "carrot", "cookies", "corn", "corn_bread", "egg", "pie", "pumpkin", "wheat"]);
    const goods = py<number>(g, `sum(1 for _ in range(40) for k in make_order(f)["want"] if k in GOODS)`);
    expect(goods).toBeGreaterThan(0);
    const o = py<{ want: Record<string, number> }>(g, 'next(o for o in (make_order(f) for _ in range(200)) if "egg" in o["want"])');
    expect(o.want.egg).toBeLessThanOrEqual(py<number>(g, "ORDER_GOODS_MOST"));
  });

  it("phase 2: every new window and building draws, with stand-ins where Gemini's pictures haven't come yet", async () => {
    const g = await start();
    await farmOf(g);
    py(g, `f = global_vars.farm
f["level"] = 12
f["coins"] = 5000
spots = [(11, 7), (13, 7), (15, 7), (13, 9), (15, 9), (8, 9), (8, 11), (11, 13), (8, 13)]
for kind, (gx, gy) in zip(list(HOMES) + list(FACTORIES), spots):
    assert build(f, kind, gx, gy) == "built", kind
f["barn"] = {"wheat": 9, "corn": 9, "carrot": 3, "chicken_feed": 3, "milk": 4, "egg": 2, "sugarcane": 4, "strawberry": 6, "wool": 2}
for m in f["mills"]:
    for item in FACTORIES[m["kind"]]["makes"]:
        make_in(f, m, item)
for h in f["homes"]:
    feed_home(f, h)`);
    step(g, 30);
    py(g, 'do_act("barn", None)');
    step(g, 5);
    for (let i = 0; i < 3; i++) {
      py(g, `open_panel("home", ${i})`);
      step(g, 70);
    }
    for (let i = 0; i < 6; i++) {
      py(g, `open_panel("mill", ${i})`);
      step(g, 5);
    }
    py(g, 'do_act("shop", None)');
    step(g, 5);
    later(g, 2000);
    py(g, 'do_act("close", None)');
    step(g, 30);
  });

  it("phase 3: a farm saved before the town comes back with an empty town, and plays on", async () => {
    const old = { coins: 300, xp: 200, level: 6, barn: { wheat: 4 }, orders: [], made: 2, bought: 0, seed: 3,
      fields: [{ gx: 7, gy: 6, crop: null, t: 0 }], homes: [], mills: [] };
    const g = await start({ farm: old });
    py(g, 'room_goto("Farm")');
    step(g, 5);
    expect(py(g, '[global_vars.farm[k] for k in ("town", "roads", "visitors", "met")]')).toEqual([[], [], [], 0]);
    expect(py(g, "population(global_vars.farm)")).toBe(0);
    step(g, 70);
    expect(py(g, 'global_vars.farm["coins"]')).toBe(300);
  });

  it("phase 3: houses bring people as far as there's room in town; a community building makes room; a house that doesn't fit stands empty", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 4\nf["coins"] = 3000');
    // The Houses tab: the cottage waits for level 5.
    py(g, 'do_act("shop", None)\ndo_act("shop_tab", "houses")');
    step(g);
    expect(py(g, 'shop_rows(f, "houses")[1][3]')).toBe("Level 5");
    py(g, 'f["level"] = 5\ndo_act("shop_tab", "houses")');
    step(g);
    py(g, 'do_act("build", "cottage")');
    expect(py(g, "global_vars.placing")).toBe("cottage");
    click(g, ...onScreen(g, 11, 7));
    expect(py(g, '[(b["kind"], b["gx"], b["gy"]) for b in f["town"]]')).toEqual([["cottage", 11, 7]]);
    expect(py(g, 'f["coins"]')).toBe(3000 - 120);
    expect(py(g, "population(f)")).toBe(6);
    // Each cottage costs more than the last; three fit in the 20 the town starts with (18), a fourth doesn't.
    expect(py(g, 'town_cost(f, "cottage")')).toBe(160);
    py(g, 'for gx, gy in ((13, 7), (15, 7), (13, 9)):\n    assert build_town(f, "cottage", gx, gy)[0] == "built"');
    expect(py(g, "population(f)")).toBe(18);
    expect(py(g, "sorted(lived_in(f))")).toEqual([0, 1, 2]);
    expect(py(g, "housing(f)")).toBe(24);
    // A fountain makes room for 20 more: the fourth moves in. One of each, though.
    expect(py(g, 'build_town(f, "fountain", 15, 9)[0]')).toBe("built");
    expect(py(g, "room_in_town(f)")).toBe(40);
    expect(py(g, "population(f)")).toBe(24);
    expect(py(g, 'build_town(f, "fountain", 8, 9)[0]')).toBe("owned");
    py(g, 'f["level"] = 6');
    expect(py(g, 'build_town(f, "park", 8, 9)[0]')).toBe("built");
    expect(py(g, 'build_town(f, "school", 8, 11)[0]')).toBe("level");
    expect(py(g, 'build_town(f, "cottage", 15, 9)[0]')).toBe("taken");
    // The town shows in the bar, and building gave XP.
    expect(py<number>(g, 'f["xp"]')).toBeGreaterThan(0);
    step(g, 5);
  });

  it("phase 3: rent: only a lived-in house pays, on the clock, and a tap collects it", async () => {
    const g = await start();
    await farmOf(g);
    py(g, `f = global_vars.farm
f["level"] = 13
f["coins"] = 5000
assert build_town(f, "manor", 11, 7)[0] == "built"
assert build_town(f, "cottage", 13, 7)[0] == "built"`);
    // The manor's 32 don't fit in 20: it stands empty, and its rent doesn't count.
    expect(py(g, "sorted(lived_in(f))")).toEqual([1]);
    // Longer than even the manor's rent takes: the cottage's is ready, the empty manor's isn't.
    later(g, py<number>(g, 'HOUSES["manor"]["every"]') + 5);
    expect(py(g, "rent_ready(f, 1)")).toBe(true);
    expect(py(g, "rent_ready(f, 0)")).toBe(false);
    step(g, 62);
    const coins = py<number>(g, 'f["coins"]');
    click(g, ...onScreen(g, 13.5, 7.5));
    expect(py(g, 'f["coins"]')).toBe(coins + py<number>(g, 'HOUSES["cottage"]["rent"]'));
    expect(py(g, "rent_ready(f, 1)")).toBe(false);
    // Tapped again, not ready: its window, with its clock.
    click(g, ...onScreen(g, 13.5, 7.5));
    expect(py(g, "global_vars.panel")).toBe("house");
    py(g, 'do_act("close", None)');
    // A school makes room: the manor's people move in, and its rent starts counting from then.
    py(g, 'f["town"].append({"kind": "school", "gx": 15, "gy": 7, "t": now()})');
    step(g, 62);
    expect(py(g, "sorted(lived_in(f))")).toEqual([0, 1]);
    expect(py(g, "rent_ready(f, 0)")).toBe(false);
    later(g, py<number>(g, 'HOUSES["manor"]["every"]'));
    expect(py(g, "rent_ready(f, 0)")).toBe(true);
  });

  it("phase 3: roads are laid by a drag, cost coins, and townspeople walk along them", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 5\nf["coins"] = 5000');
    py(g, 'do_act("build", "road")');
    expect(py(g, "global_vars.placing")).toBe("road");
    drag(g, onScreen(g, 11, 8), [onScreen(g, 12, 8), onScreen(g, 13, 8), onScreen(g, 14, 8)]);
    expect(py(g, 'sorted(tuple(r) for r in f["roads"])')).toEqual([[11, 8], [12, 8], [13, 8], [14, 8]]);
    expect(py(g, 'f["coins"]')).toBe(5000 - 4 * py<number>(g, "ROAD_COST"));
    // Not on something else: a tap on a field lays nothing.
    click(g, ...onScreen(g, 7, 6));
    expect(py<number>(g, 'len(f["roads"])')).toBe(4);
    py(g, 'do_act("stop_placing", None)');
    // People in town: some go walking, always on a road, a tile at a time.
    py(g, 'f["level"] = 7\nfor gx, gy in ((11, 10), (13, 10), (9, 12)):\n    assert build_town(f, "family_house", gx, gy)[0] == "built"\nassert build_town(f, "fountain", 8, 9)[0] == "built"');
    expect(py(g, "population(f)")).toBe(36);
    step(g, 5);
    expect(py(g, 'len([o for o in instances("Person") if o.visitor is None])')).toBe(py<number>(g, "walkers(f)"));
    expect(py<number>(g, "walkers(f)")).toBe(6);
    const off: string[] = [];
    for (let i = 0; i < 12; i++) {
      step(g, 20);
      off.push(...py<string[]>(g, `[f"{o.at}->{o.to}" for o in instances("Person") if o.visitor is None and
          (o.at not in all_roads(f) or o.to not in all_roads(f) or abs(o.at[0] - o.to[0]) + abs(o.at[1] - o.to[1]) > 1)]`));
    }
    expect(off).toEqual([]);
    const moved = py<number>(g, 'len({o.at for o in instances("Person") if o.visitor is None})');
    expect(moved).toBeGreaterThan(1);
  });

  it("phase 3: visitors come to the farm stand once people live in town, buy from the barn, and pay well", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 5\nf["coins"] = 1000');
    step(g, 62);
    expect(py(g, 'f["visitors"]')).toEqual([]);
    py(g, 'assert build_town(f, "cottage", 11, 7)[0] == "built"');
    step(g, 62);
    expect(py<number>(g, 'len(f["visitors"])')).toBe(1);
    later(g, py<number>(g, "VISITOR_WAIT") + 1);
    step(g, 62);
    const v = py<{ want: Record<string, number>; coins: number; xp: number }>(g, 'f["visitors"][0]');
    const [item, n] = Object.entries(v.want)[0]!;
    expect(py<number>(g, `item_info("${item}")["sell"] * ${n} * VISITOR_PAY`)).toBeLessThanOrEqual(v.coins);
    // The stand opens their window; short, it can't be given.
    click(g, ...onScreen(g, 10, 4));
    expect(py(g, "global_vars.panel")).toBe("visitors");
    expect(py(g, 'serve(f, 0)[0]')).toBe("short");
    py(g, `f["barn"] = {"${item}": ${n}}`);
    const coins = py<number>(g, 'f["coins"]');
    py(g, 'do_act("serve", 0)');
    expect(py(g, 'f["coins"]')).toBe(coins + v.coins);
    expect(py(g, 'f["barn"]')).toEqual({});
    expect(py(g, '"wait" in f["visitors"][0]')).toBe(true);
    // More people, more places at the stand.
    py(g, 'f["level"] = 10\nf["coins"] = 9000\nfor kind, gx, gy in (("park", 13, 7), ("school", 15, 7), ("townhouse", 13, 9), ("townhouse", 15, 9), ("townhouse", 8, 9)):\n    assert build_town(f, kind, gx, gy)[0] == "built", kind');
    step(g, 62);
    expect(py<number>(g, 'len(f["visitors"])')).toBe(py<number>(g, "visitor_slots(f)"));
    expect(py<number>(g, "visitor_slots(f)")).toBeGreaterThan(1);
  });

  it("the keys' cursor reaches every tile, the farm stand among them", async () => {
    const g = await start();
    await farmOf(g);
    const missed = py<number>(g, `
seen, todo = {(8, 5)}, [(8, 5)]
while todo:
    c = todo.pop()
    for name in ("left", "right", "up", "down"):
        n = cursor_step(c, name)
        if n not in seen:
            seen.add(n)
            todo.append(n)
MAP_W * MAP_H - len(seen)`);
    expect(missed).toBe(0);
    // Left undoes right, and up undoes down, away from the edges.
    expect(py(g, 'all(cursor_step(cursor_step((x, y), "right"), "left") == (x, y) for x in range(2, 17) for y in range(2, 17))')).toBe(true);
    // From the start, to the farm stand and Space: its window (once anyone has visited).
    py(g, 'f = global_vars.farm\nf["visitors"] = [{"wait": now() + 60}]\nglobal_vars.cursor = (8, 5)');
    for (const k of ["right", "right", "right", "down"]) press(g, k);
    expect(py(g, "global_vars.cursor")).toEqual([10, 4]);
    press(g, "space");
    expect(py(g, "global_vars.panel")).toBe("visitors");
  });

  it("phase 3: Move things: a field (its crop growing on), a factory and a road go where they're put, never onto something", async () => {
    const g = await start();
    await farmOf(g);
    py(g, `f = global_vars.farm
f["level"] = 6
f["coins"] = 2000
assert build(f, "bakery", 11, 7) == "built"
assert buy_road(f, 11, 9) == "built"
plant(f, f["fields"][0], "wheat")`);
    step(g, 3);
    py(g, 'do_act("move", None)');
    expect(py(g, "global_vars.placing")).toBe("move");
    // The field at (7, 6): picked up, put on grass at (12, 12).
    click(g, ...onScreen(g, 7, 6));
    expect(py(g, "global_vars.moving")).toEqual(["fields", 0]);
    click(g, ...onScreen(g, 12, 12));
    expect(py(g, '(f["fields"][0]["gx"], f["fields"][0]["gy"], f["fields"][0]["crop"])')).toEqual([12, 12, "wheat"]);
    expect(py(g, "global_vars.moving is None")).toBe(true);
    // The bakery, picked up by its lower tile, keeps that grip: put down so that tile is where it's tapped.
    click(g, ...onScreen(g, 12, 8));
    expect(py(g, "global_vars.moving")).toEqual(["mills", 0]);
    click(g, ...onScreen(g, 7, 6));        // onto the fields: it stays where it was
    expect(py(g, '(f["mills"][0]["gx"], f["mills"][0]["gy"])')).toEqual([11, 7]);
    click(g, ...onScreen(g, 17, 15));
    expect(py(g, '(f["mills"][0]["gx"], f["mills"][0]["gy"])')).toEqual([16, 14]);
    step(g, 2);
    expect(py(g, 'next(o.gx for o in instances("Thing") if o.of == ("mills", 0))')).toBe(16);
    // A road.
    click(g, ...onScreen(g, 11, 9));
    click(g, ...onScreen(g, 10, 9));
    expect(py(g, 'f["roads"]')).toEqual([[10, 9]]);
    // The farmhouse stays put: nothing is picked up.
    click(g, ...onScreen(g, 4, 4));
    expect(py(g, "global_vars.moving is None")).toBe(true);
    py(g, 'do_act("stop_placing", None)');
    expect(py(g, "taken(f) >= {(12, 12), (16, 14), (17, 15), (10, 9)}")).toBe(true);
  });

  it("phase 3: every town window and ghost draws, with stand-ins where Gemini's pictures haven't come yet", async () => {
    const g = await start();
    await farmOf(g);
    py(g, `f = global_vars.farm
f["level"] = 14
f["coins"] = 9000
spots = [(11, 7), (13, 7), (15, 7), (13, 9), (15, 9), (8, 9), (8, 11), (11, 13), (8, 13), (13, 15), (15, 11)]
for kind, (gx, gy) in zip(list(HOUSES) + list(COMMUNITY), spots[:10]):
    assert build_town(f, kind, gx, gy)[0] == "built", kind
for gx in range(11, 17):
    buy_road(f, gx, 12) if can_place(f, gx, 12) else None`);
    step(g, 70);
    later(g, 4000);
    step(g, 62);
    for (const tab of ["farm", "houses", "town"]) {
      py(g, `do_act("shop", None) if global_vars.panel != "shop" else None\ndo_act("shop_tab", "${tab}")`);
      step(g, 3);
    }
    py(g, 'open_panel("house", 0)');
    step(g, 62);
    py(g, 'f["town"].append({"kind": "manor", "gx": 1, "gy": 17, "t": now()})\nopen_panel("house", len(f["town"]) - 1)');
    step(g, 3);
    py(g, 'open_panel("visitors")');
    step(g, 3);
    py(g, 'do_act("move", None)\nplace_move((11, 7))');
    step(g, 3);
    py(g, 'do_act("build", "road")');
    step(g, 3);
    py(g, 'do_act("stop_placing", None)');
    step(g, 30);
    expect(py<number>(g, 'len(instances("Person"))')).toBeGreaterThan(3);
  });

  it("phase 4: a farm saved before the valley comes back with the starting tools and no land, and plays on", async () => {
    const g = await start({ farm: { coins: 300, xp: 160, level: 6, barn: { wheat: 4 }, orders: [], made: 3, bought: 0, seed: 5,
      fields: [{ gx: 7, gy: 6, crop: null, t: 0 }], homes: [], mills: [], town: [], roads: [], visitors: [], met: 0 } });
    py(g, 'room_goto("Farm")');
    step(g, 3);
    expect(py(g, 'f = global_vars.farm\n[f["land"], f["cleared"], f["trees"], f["barn_level"], f["kit"] == START_KIT, f["train"]["wagons"]]'))
      .toEqual([[], [], [], 0, true, []]);
    expect(py(g, 'barn_space(f)')).toBe(py<number>(g, "BARN_SPACE"));
    step(g, 62);
    expect(py<number>(g, 'len(f["train"]["wagons"])')).toBe(py<number>(g, "TRAIN_WAGONS"));
  });

  it("phase 4: the valley: wild things leave the road, railway, lake and places clear; land not bought can't be built on; buying it opens it", async () => {
    const g = await start();
    await farmOf(g);
    // Named one by one, not through kept_clear(): a check through it can't see it go wrong.
    const clash = py<number[][]>(g, `not_wild = set(ROAD) | set(RAIL) | set(LAKE) | set(footprint_tiles("station", *STATION))
for k, site in SITES.items():
    not_wild |= set(footprint_tiles(k, site["gx"], site["gy"]))
not_wild |= {sign_tile(i) for i in range(len(LAND))}
[list(t) for t in wilds() if t in not_wild]`);
    expect(clash).toEqual([]);
    // Every plot is on the map, outside the farm, and no two overlap; the station's yard is no plot's.
    expect(py(g, `tiles = [t for i in range(len(LAND)) for t in plot_tiles(i)]
len(tiles) == len(set(tiles)) and all(on_map(*t) and not (t[0] < HOME and t[1] < HOME) for t in tiles) and land_at(*STATION) is None`)).toBe(true);
    py(g, 'f = global_vars.farm\nf["coins"] = 5000\nf["level"] = 4\nx, y = tile_xy(23, 6)\nmove_camera(x - VIEW_W / 2, y - VIEW_H / 2)');
    step(g, 2);
    const free = py<[number, number]>(g, "next(t for t in plot_tiles(0) if t not in wilds() and t != sign_tile(0))");
    expect(py(g, `can_place(f, ${free[0]}, ${free[1]})`)).toBe(false);
    expect(py(g, `buy_field(f, ${free[0]}, ${free[1]})`)).toBe("taken");
    // A tap on it: its window. Too early a level: not yet.
    click(g, ...onScreen(g, 23, 6));
    expect(py(g, "[global_vars.panel, global_vars.panel_of]")).toEqual(["land", 0]);
    expect(py(g, "buy_land(f, 0)[0]")).toBe("level");
    py(g, 'f["level"] = 5\nopen_panel("land", 0)');
    step(g);
    expect(py(g, 'next(b.off for b in instances("Button") if b.act == "buy_land")')).toBe(false);
    const xp = py<number>(g, 'f["xp"]');
    py(g, 'do_act("buy_land", 0)');
    step(g, 2);
    expect(py(g, '[f["land"], f["coins"]]')).toEqual([[0], 5000 - py<number>(g, 'LAND[0]["cost"]')]);
    expect(py<number>(g, 'f["xp"]')).toBeGreaterThanOrEqual(xp + py<number>(g, "LAND_XP"));
    expect(py(g, `can_place(f, ${free[0]}, ${free[1]})`)).toBe(true);
    expect(py(g, "buy_land(f, 0)[0]")).toBe("owned");
    // Its sign is gone, and what grows on it isn't drawn darker any more.
    expect(py(g, 'sum(1 for o in instances("Prop") if o.sprite == "sign")')).toBe(py<number>(g, "len(LAND) - 1"));
    const wild = py<[number, number]>(g, "next(t for t in plot_tiles(0) if t in wilds())");
    expect(py(g, `next(o.image_blend for o in instances("Prop") if (o.gx, o.gy) == (${wild[0]}, ${wild[1]}))`)).toBe(py(g, 'next(o.image_blend for o in instances("Prop") if (o.gx, o.gy) == (12, 9))'));
    expect(py(g, `next(o.image_blend for o in instances("Prop") if (o.gx, o.gy) == next(t for t in plot_tiles(1) if t in wilds()))`)).not.toBe(
      py(g, 'next(o.image_blend for o in instances("Prop") if (o.gx, o.gy) == (12, 9))'));
  });

  it("phase 4: a tap clears a tree or a rock with its tool from the kit, for coins and XP; with none, it says which tool", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["kit"] = {"axe": 0, "pickaxe": 1, "shovel": 0}\nx, y = tile_xy(12, 9)\nmove_camera(x - VIEW_W / 2, y - VIEW_H / 2)');
    step(g, 2);
    expect(py(g, "can_place(f, 12, 9)")).toBe(false);
    const coins = py<number>(g, 'f["coins"]');
    click(g, ...onScreen(g, 12, 9));                     // the farm's boulder
    expect(py(g, '[f["cleared"], f["kit"]["pickaxe"], f["coins"], f["xp"]]')).toEqual([[[12, 9]], 0, coins + py<number>(g, "CLEAR_COINS"), py<number>(g, "CLEAR_XP")]);
    step(g);                                             // its Prop goes the step after
    expect(py(g, 'any((o.gx, o.gy) == (12, 9) for o in instances("Prop"))')).toBe(false);
    expect(py(g, "can_place(f, 12, 9)")).toBe(true);
    // The bush at (11, 12) needs a shovel, and there isn't one.
    click(g, ...onScreen(g, 11, 12));
    expect(py(g, "wild_at(f, 11, 12)")).toBe("bush");
    expect(py(g, "global_vars.said[0]")).toContain("a shovel");
    // The pond stays.
    expect(py(g, "[wild_at(f, 14, 13) is None, clear_wild(f, 14, 13)[0], can_place(f, 14, 13)]")).toEqual([true, "nothing", false]);
    // Saved: cleared stays cleared.
    expect(py(g, 'save_get("farm", None)["cleared"]')).toEqual([[12, 9]]);
  });

  it("phase 4: now and then a harvest finds a tool; a bigger barn takes nails, planks and paint", async () => {
    const g = await start();
    await farmOf(g);
    const finds = py<number>(g, 'f = global_vars.farm\nf["kit"] = {}\nsum(1 for _ in range(1000) if lucky(f))');
    expect(finds).toBeGreaterThan(40);
    expect(finds).toBeLessThan(130);
    expect(py(g, 'sum(f["kit"].values())')).toBe(finds);
    // The same farm finds the same things (a reload can't buy luck).
    expect(py(g, 'f["drops"] = 0\na = [lucky(f) for _ in range(300)]\nf["drops"] = 0\na == [lucky(f) for _ in range(300)] and len(set(a)) > 3')).toBe(true);
    py(g, 'f["kit"] = {"nails": 2, "planks": 2, "paint": 1}\nopen_panel("barn")');
    step(g);
    expect(py(g, 'next(b.off for b in instances("Button") if b.act == "grow_barn")')).toBe(true);
    expect(py(g, "grow_barn(f)[0]")).toBe("short");
    py(g, 'f["kit"]["paint"] = 2\nopen_panel("barn")');
    step(g);
    py(g, 'press(next(b for b in instances("Button") if b.act == "grow_barn"))');
    step(g);
    expect(py(g, '[barn_space(f), f["kit"], barn_needs(f)]')).toEqual([
      py<number>(g, "BARN_SPACE + BARN_STEP"), { nails: 0, planks: 0, paint: 0 }, { nails: 3, planks: 3, paint: 3 }]);
    expect(py(g, "barn_free(f)")).toBe(py<number>(g, "BARN_SPACE + BARN_STEP"));
  });

  it("phase 4: the train: wagons from its level, loaded from the barn for tools; away once all are, back on the clock with new ones", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 5\nx, y = building_xy("station", *STATION)\nmove_camera(x - VIEW_W / 2, y - VIEW_H / 2)');
    step(g, 62);
    expect(py(g, 'f["train"]["wagons"]')).toEqual([]);
    click(g, ...onScreen(g, 22, 2));
    expect(py(g, "global_vars.said[0]")).toContain("level 6");
    py(g, 'f["level"] = 6');
    step(g, 62);
    expect(py<number>(g, 'len(f["train"]["wagons"])')).toBe(3);
    expect(py(g, '[o.shown for o in instances("Car")]')).toEqual([true, true, true, true]);
    // Parked on the railway, along the station's front row: Gemini's station has its own
    // track there, so a train anywhere else stops beside a track it isn't on.
    expect(py(g, `front = max(t[1] for t in footprint_tiles("station", *STATION))
[tuple(tile_at(o.wx, o.wy)) in RAIL and tile_at(o.wx, o.wy)[1] == front for o in instances("Car")]`)).toEqual([true, true, true, true]);
    click(g, ...onScreen(g, 22, 2));
    expect(py(g, "global_vars.panel")).toBe("train");
    // Nothing in the barn: no wagon can be loaded.
    expect(py(g, "load_wagon(f, 0)[0]")).toBe("short");
    py(g, `kit = dict(f["kit"])
prizes = [w["prize"] for w in f["train"]["wagons"]]
f["barn"] = {}
for w in f["train"]["wagons"]:
    for k, n in w["want"].items():
        f["barn"][k] = f["barn"].get(k, 0) + n`);
    for (let i = 0; i < 3; i++) {
      py(g, `open_panel("train")\npress(next(b for b in instances("Button") if b.act == "load_wagon" and b.arg == ${i}))`);
      step(g);
    }
    expect(py(g, 'f["barn"]')).toEqual({});
    expect(py(g, 'all(f["kit"].get(k, 0) == kit.get(k, 0) + prizes.count(k) for k in KIT)')).toBe(true);
    expect(py(g, "[train_here(f), f['train']['trips'], f['train']['wagons']]")).toEqual([false, 1, []]);
    expect(py(g, "load_wagon(f, 0)[0]")).toBe("away");
    later(g, 10);
    step(g, 2);
    expect(py(g, '[o.shown for o in instances("Car")]')).toEqual([false, false, false, false]);
    later(g, py<number>(g, "TRAIN_AWAY") - 12);
    step(g, 2);
    expect(py<number>(g, "train_engine(f)")).toBeGreaterThan(py<number>(g, "TRAIN_PARK"));
    later(g, 3);
    step(g, 62);
    expect(py(g, "train_here(f)")).toBe(true);
    expect(py<number>(g, 'len(f["train"]["wagons"])')).toBe(3);
    // Sent off early, with nothing loaded: away all the same.
    py(g, 'open_panel("train")\npress(next(b for b in instances("Button") if b.act == "send_train"))');
    expect(py(g, "[train_here(f), f['train']['trips']]")).toEqual([false, 2]);
  });

  it("phase 4: a fruit tree planted on grass fruits on the clock, again and again, and moves with Move things", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 7\nf["coins"] = 200');
    expect(py(g, 'buy_tree(f, "cherry_tree", 11, 8)')).toBe("level");
    py(g, 'do_act("build", "apple_tree")');
    click(g, ...onScreen(g, 8, 6));                      // a field: no room
    expect(py(g, 'f["trees"]')).toEqual([]);
    click(g, ...onScreen(g, 11, 8));
    click(g, ...onScreen(g, 12, 8));
    expect(py(g, '[(t["kind"], t["gx"], t["gy"]) for t in f["trees"]]')).toEqual([["apple_tree", 11, 8], ["apple_tree", 12, 8]]);
    expect(py(g, 'f["coins"]')).toBe(200 - 50 - 60);
    py(g, 'do_act("stop_placing", None)');
    step(g, 2);
    expect(py(g, "can_place(f, 11, 8)")).toBe(false);
    click(g, ...onScreen(g, 11, 8));
    expect(py(g, "global_vars.said[0]")).toContain("fruit in");
    expect(py(g, 'f["barn"]')).toEqual({});
    later(g, py<number>(g, 'TREES["apple_tree"]["grow"]'));
    click(g, ...onScreen(g, 11, 8));
    expect(py(g, 'f["barn"]')).toEqual({ apple: 3 });
    expect(py(g, 'fruit_ready(f["trees"][0])')).toBe(false);
    click(g, ...onScreen(g, 11, 8));
    expect(py(g, 'f["barn"]')).toEqual({ apple: 3 });
    expect(py(g, '"apple" in orderable(f)')).toBe(true);
    py(g, 'do_act("move", None)');
    click(g, ...onScreen(g, 12, 8));
    click(g, ...onScreen(g, 13, 10));
    expect(py(g, '(f["trees"][1]["gx"], f["trees"][1]["gy"])')).toEqual([13, 10]);
  });

  it("phase 4: the fishing dock and the mine come with their land: fish bite on corn, and the mine digs with lunch, its nails into the kit", async () => {
    const g = await start();
    await farmOf(g);
    py(g, 'f = global_vars.farm\nf["level"] = 10\nf["coins"] = 5000');
    expect(py(g, "[buy_land(f, 3)[0], buy_land(f, 5)[0]]")).toEqual(["bought", "bought"]);
    step(g, 2);
    expect(py(g, '[(b["kind"], b["gx"], b["gy"]) for b in f["homes"] + f["mills"]]')).toEqual([["dock", 11, 21], ["mine", 24, 16]]);
    expect(py(g, 'sorted(o.kind for o in instances("Thing") if o.of is not None)')).toEqual(["dock", "mine"]);
    // They stay where they came: nothing to pick up.
    expect(py(g, "[thing_at(f, 11, 21) is None, thing_at(f, 25, 17) is None]")).toEqual([true, true]);
    py(g, 'f["barn"] = {"corn": 2, "bread": 2}\ndock = f["homes"][0]\nmine = f["mills"][0]');
    expect(py(g, "feed_home(f, dock)")).toBe(2);
    expect(py(g, 'make_in(f, mine, "nails")')).toBe("queued");
    expect(py(g, 'f["barn"]')).toEqual({});
    later(g, 601);
    expect(py(g, "collect_home(f, dock)[0]")).toBe(2);
    py(g, 'f["kit"] = {}');
    expect(py(g, "collect_mill(f, mine)[0]")).toBe(1);
    expect(py(g, '[f["barn"], f["kit"]]')).toEqual([{ fish: 2 }, { nails: 1 }]);
    expect(py(g, '["fish" in orderable(f), "nails" in orderable(f), "gold" in orderable(f)]')).toEqual([true, false, false]);
  });

  it("phase 4: every new window, the train and the valley draw, with stand-ins where Gemini's pictures haven't come yet", async () => {
    const g = await start();
    await farmOf(g);
    py(g, `f = global_vars.farm
f["level"] = 14
f["coins"] = 9999
f["barn"] = {k: 1 for k in list(CROPS) + list(GOODS)}
f["kit"] = {k: 2 for k in KIT}`);
    py(g, 'open_panel("land", 2)');
    step(g, 3);
    py(g, 'do_act("barn", None)');
    step(g, 3);
    expect(py(g, "barn_grid(f)[0]")).toBe(4);
    expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
    for (let i = 0; i < 9; i++) py(g, `buy_land(f, ${i})`);
    py(g, 'f["level"] = 14\nf["coins"] = 9999');
    step(g, 62);
    for (const tab of ["farm", "factories", "houses", "town"]) {
      py(g, `do_act("shop", None) if global_vars.panel != "shop" else None\ndo_act("shop_tab", "${tab}")`);
      step(g, 3);
      expect(py<number>(g, "global_vars.panel_box[3]")).toBeLessThanOrEqual(py<number>(g, "VIEW_H"));
    }
    py(g, 'open_panel("train")');
    step(g, 3);
    py(g, 'open_panel("home", 0)');
    step(g, 3);
    py(g, 'open_panel("mill", 0)');
    step(g, 3);
    py(g, 'do_act("build", "cherry_tree")');
    step(g, 3);
    py(g, 'place_tree("cherry_tree", (11, 8))\ndo_act("stop_placing", None)\nsend_train(f)\nopen_panel("train")');
    step(g, 62);
    later(g, 3000);
    py(g, 'global_vars.levelup = [9, 100]');
    step(g, 62);
    expect(py<number>(g, 'len(instances("Prop"))')).toBeGreaterThan(100);
  });
});
