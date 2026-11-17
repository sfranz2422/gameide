/**
 * The farm showcase game, Cloverbrook (phase 1: the farm), played headless in the
 * real Pyodide: planting and growing on the real clock (moved on by the tests),
 * harvesting into the barn, tapping and dragging on the isometric map, the barn,
 * levels and what they open, the orders, buying fields, saving (and growing while
 * away), the board, and a field farmed from the keyboard alone.
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
    expect(py(g, "opened_at(5)")).toEqual(["Pumpkins"]);
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
    expect(py(g, "global_vars.placing")).toBe(true);
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
});
