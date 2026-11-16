/**
 * The sandwich showcase game, Stack Shack, played headless in the real Pyodide: the
 * stack's rules on their own (where a layer lands, when a pile slides off, heavy
 * piles holding less), tapping and dragging layers on, a sauce drawn by dragging,
 * the top slice and the meal, eating it bite by bite, every secret recipe found by a
 * sandwich made for it, unlocks, the board, the questions only in the book, and a
 * whole sandwich made and eaten from the keyboard alone.
 * Runs when the game has been built (python3 showcase/sandwich/build.py).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/sandwich/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
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
function click(g: PythonGame, x: number, y: number) {
  g.engine.input.mouseMove(x, y);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  g.engine.input.mouseUp(0);
  step(g);
}
/** A press at (x1, y1) dragged through `via` points and let go at the last one. */
function drag(g: PythonGame, x1: number, y1: number, via: [number, number][]) {
  g.engine.input.mouseMove(x1, y1);
  step(g);
  g.engine.input.mouseDown(0);
  step(g);
  for (const [x, y] of via) {
    g.engine.input.mouseMove(x, y);
    step(g);
  }
  g.engine.input.mouseUp(0);
  step(g);
}

/** Straight to the kitchen with a fresh sandwich on this bread. */
async function kitchen(g: PythonGame & { questionOk: boolean[] }, bread = "white") {
  py(g, `global_vars.s = new_sandwich("${bread}")\nglobal_vars.tab = "meat"\nroom_goto("Kitchen")`);
  step(g, 2);
  expect(room(g)).toBe("Kitchen");
}
/** The middle of the shelf's plate for this layer (opening its tab first). */
function plate(g: PythonGame, key: string): [number, number] {
  py(g, `do_act("tab", LAYERS["${key}"]["kind"])`);
  step(g);
  return py<[number, number]>(g, `[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.key == "${key}"][0]`);
}
const layers = (g: PythonGame) => py<string[]>(g, '[l["k"] for l in global_vars.s["layers"]]');
const settle = (g: PythonGame) => step(g, py<number>(g, "DROP_STEPS") + 2);

/** One sandwich for each secret recipe, as a player would build it (the bread, then what goes on). */
const MADE_FOR: Record<string, [string, string[]]> = {
  "Just Bread": ["white", []],
  "The BLT": ["white", ["bacon", "lettuce", "tomato", "mayo"]],
  "PB&J": ["white", ["pb", "jelly"]],
  "Sunrise Stack": ["brioche", ["egg", "bacon", "cheddar"]],
  "Plain Ham and Cheese": ["brown", ["ham", "swiss", "ham"]],
  "The Club": ["white", ["turkey", "bacon", "lettuce", "tomato", "mayo"]],
  "Fish Friday": ["baguette", ["fish", "lettuce", "mayo"]],
  "Burger in Disguise": ["brioche", ["patty", "cheddar", "pickles", "ketchup", "mustard"]],
  "Garden Party": ["brown", ["lettuce", "tomato", "cucumber", "onion", "pepper"]],
  "Dragon's Breath": ["white", ["chicken", "jalapeno", "pepper", "hot"]],
  "Cheese Tower": ["white", ["cheddar", "swiss", "mozzarella", "cheddar", "swiss", "mozzarella"]],
  "Rye Reuben-ish": ["rye", ["beef", "swiss", "mustard"]],
  "Green Machine": ["sourdough", ["turkey", "avocado", "lettuce"]],
  "Mushroom Melt": ["sourdough", ["beef", "mushroom", "swiss"]],
  "Tofu Garden": ["brown", ["tofu", "avocado", "cucumber"]],
  "Salami Stack": ["baguette", ["salami", "salami", "salami", "mozzarella"]],
  "Meat Mountain": ["white", ["chicken", "beef", "ham", "turkey", "salami"]],
  "Caprese": ["sourdough", ["mozzarella", "tomato", "pesto"]],
  "Crunch Time": ["white", ["ham", "cheddar", "chips"]],
  "The King's Breakfast": ["white", ["pb", "banana", "bacon"]],
  "Fishy Business": ["white", ["fish", "pb"]],
  "Rainbow": ["white", ["tomato", "cheddar", "mustard", "lettuce", "onion"]],
  "Sauce Boss": ["white", ["ham", "ketchup", "mustard", "mayo", "bbq", "hot"]],
  "Brunch Stack": ["white", ["pancake", "bacon", "egg"]],
  "Fluffernutter": ["white", ["pb", "marshmallow"]],
  "Sweet Tooth": ["white", ["pb", "jelly", "banana", "marshmallow"]],
  "Worm Burger": ["brioche", ["patty", "gummy"]],
  "Skyscraper": ["white", Array.from({ length: 20 }, (_, i) => ["lettuce", "ham", "cheddar", "tomato"][i % 4]!)],
};

/** Puts these on dead centre by the stack's own rules (no wobble), tops it. */
function build(g: PythonGame, bread: string, fill: string[]) {
  py(g, `s = new_sandwich("${bread}")
for k in ${JSON.stringify(fill)}:
    add_layer(s, k, 0, auto_squiggle() if LAYERS[k]["kind"] == "sauce" else None)
add_layer(s, "top", 0)
global_vars.s = s`);
}

describe.runIf(have)("Stack Shack", () => {
  it("a pile holds while each layer's load sits over it, and slides off from where it doesn't", async () => {
    const g = await start();
    // Straight up: fine, however tall.
    py(g, 's = new_sandwich("white")\nfor i in range(12):\n    add_layer(s, "ham", 0)\nglobal_vars.t1 = s');
    expect(py(g, "falls_from(global_vars.t1) is None")).toBe(true);
    expect(py(g, "len(global_vars.t1['layers'])")).toBe(13);
    // A layer far off the middle slides off, alone.
    const fell = py<string[]>(g, 's = global_vars.t1\nfell = add_layer(s, "cheddar", 140)\n[l["k"] for l in fell]');
    expect(fell).toEqual(["cheddar"]);
    expect(py(g, "len(global_vars.t1['layers'])")).toBe(13);
    // Four patties straight, then ham leaning further each time: each slice is fine on the
    // one below, but the hams' weight together ends up past the top patty's edge, and
    // every ham goes, while the patties under them stay.
    py(g, 's = new_sandwich("white")\nfor i in range(4):\n    add_layer(s, "patty", 0)\nfor i in range(1, 12):\n    fell = add_layer(s, "ham", i * 25)\n    if fell:\n        break\nglobal_vars.t2 = (s, [l["dx"] for l in fell])');
    const [kept, gone] = py<[number, number[]]>(g, '[len(global_vars.t2[0]["layers"]), global_vars.t2[1]]');
    expect(gone.length).toBeGreaterThan(1);
    expect(kept).toBe(5);
    expect(py(g, "falls_from(global_vars.t2[0]) is None")).toBe(true);
    expect(py(g, "global_vars.t2[0]['lost']")).toBe(gone.length);
  });

  it("a heavy pile holds less off-centre than a light one", async () => {
    const g = await start();
    expect(py<number>(g, "margin(300)")).toBeLessThan(py<number>(g, "margin(20)") * 0.6);
    // The same small lean on every layer: a short sandwich holds it, a tall one doesn't,
    // as the whole lean piles up over a bottom slice holding more and more.
    const stairs = (n: number) => py<number>(g, `s = new_sandwich("white")\nlost = 0\nfor i in range(1, ${n + 1}):\n    lost += len(add_layer(s, "ham", i * 6))\nlost`);
    expect(stairs(5)).toBe(0);
    expect(stairs(20)).toBeGreaterThan(0);
  });

  it("a tapped layer drops on near the middle, lands, and wobbles more the more it leans", async () => {
    const g = await start();
    await kitchen(g);
    const [x, y] = plate(g, "ham");
    click(g, x, y);
    expect(py(g, 'instance_number("Faller")')).toBe(1);
    expect(layers(g)).toEqual(["bottom"]);       // still falling
    settle(g);
    expect(layers(g)).toEqual(["bottom", "ham"]);
    expect(Math.abs(py<number>(g, 'global_vars.s["layers"][1]["dx"]'))).toBeLessThanOrEqual(py<number>(g, "JITTER"));
    // A second tap before the first lands lands it at once: nothing is lost to quick taps.
    click(g, x, y);
    click(g, x, y);
    settle(g);
    expect(layers(g)).toEqual(["bottom", "ham", "ham", "ham"]);
    expect(py<number>(g, "danger(global_vars.s)")).toBeLessThan(0.3);
    py(g, 'global_vars.s["layers"][-1]["dx"] = global_vars.s["layers"][-2]["dx"] + margin(10) * 0.95');
    expect(py<number>(g, "danger(global_vars.s)")).toBeGreaterThan(0.9);
  });

  it("a layer dragged off to the side and let go there slides off the pile", async () => {
    const g = await start();
    await kitchen(g);
    const [x, y] = plate(g, "cheddar");
    const px = py<number>(g, "PLATE_X");
    // Dragged onto the middle: it stays.
    drag(g, x, y, [[x + 100, y], [px, 300]]);
    settle(g);
    expect(layers(g)).toEqual(["bottom", "cheddar"]);
    // Dragged out past the edge: it falls off, tumbling away, and the kitchen says so. (Not
    // so far that the two together are off the bread, or the first goes with it.)
    drag(g, x, y, [[x + 100, y], [px + 150, 300]]);
    settle(g);
    expect(layers(g)).toEqual(["bottom", "cheddar"]);
    expect(py(g, "global_vars.s['lost']")).toBe(1);
    expect(py(g, 'instance_number("Tumble")')).toBe(1);
    expect(py<[string, number]>(g, "global_vars.said")[0]).toBe("Oops!");
    step(g, py<number>(g, "TUMBLE_STEPS") + 2);
    expect(py(g, 'instance_number("Tumble")')).toBe(0);
    // Dragged somewhere else entirely: nothing happens.
    drag(g, x, y, [[x + 30, y + 200]]);
    settle(g);
    expect(layers(g)).toEqual(["bottom", "cheddar"]);
  });

  it("a sauce dragged over the top draws your own squiggle there; tapped, it zigzags", async () => {
    const g = await start();
    await kitchen(g);
    py(g, 'add_layer(global_vars.s, "ham", 0)');
    const [x, y] = plate(g, "ketchup");
    const px = py<number>(g, "PLATE_X");
    const ty = py<number>(g, "top_y(global_vars.s)");
    drag(g, x, y, [[x + 80, y], [px - 90, ty], [px - 40, ty + 2], [px, ty - 4], [px + 50, ty], [px + 90, ty + 3]]);
    expect(layers(g)).toEqual(["bottom", "ham", "ketchup"]);
    const dots = py<[number, number][]>(g, 'global_vars.s["layers"][-1]["dots"]');
    expect(dots.length).toBeGreaterThanOrEqual(4);
    expect(dots[0]![0]).toBeLessThan(-60);
    expect(dots.at(-1)![0]).toBeGreaterThan(60);
    // Dragged but never over the sandwich: no sauce at all.
    drag(g, x, y, [[x + 80, y + 150]]);
    expect(layers(g)).toEqual(["bottom", "ham", "ketchup"]);
    const [mx, my] = plate(g, "mustard");
    click(g, mx, my);
    expect(layers(g)).toEqual(["bottom", "ham", "ketchup", "mustard"]);
    expect(py<number>(g, 'len(global_vars.s["layers"][-1]["dots"])')).toBeGreaterThan(8);
  });

  it("Undo takes the last layer off; the top slice makes it a meal, and a side and a drink go beside it", async () => {
    const g = await start();
    await kitchen(g);
    py(g, 'add_layer(global_vars.s, "ham", 0)\nadd_layer(global_vars.s, "lettuce", 0)');
    py(g, 'do_act("undo", None)');
    expect(layers(g)).toEqual(["bottom", "ham"]);
    py(g, 'do_act("top", None)');
    settle(g);
    expect(layers(g)).toEqual(["bottom", "ham", "top"]);
    expect(py(g, "global_vars.s['topped']")).toBe(true);
    expect(py(g, "global_vars.tab")).toBe("sides");
    expect(py(g, '[o.key for o in instances("Spot")]')).toEqual(["fries", "soup", "pickle_spear", "chips_side"]);
    const fries = py<[number, number]>(g, '[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.key == "fries"][0]');
    click(g, ...fries);
    py(g, 'do_act("tab", "drinks")');
    step(g);
    const milk = py<[number, number]>(g, '[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.key == "milk"][0]');
    click(g, ...milk);
    expect(py(g, '[global_vars.s["side"], global_vars.s["drink"]]')).toEqual(["fries", "milk"]);
    // Nothing more goes on a topped sandwich.
    expect(py(g, 'len(add_layer(global_vars.s, "ham", 0))')).toBe(0);
    expect(layers(g)).toEqual(["bottom", "ham", "top"]);
    // Undo takes the top off again, back to building.
    py(g, 'do_act("undo", None)');
    step(g);
    expect(py(g, "[global_vars.s['topped'], global_vars.tab]")).toEqual([false, "meat"]);
  });

  it("eating it: a bite a tap, right to left, then the book, the tallest, and the board", async () => {
    const g = await start();
    build(g, "white", ["bacon", "lettuce", "tomato", "ham", "cheddar"]);
    py(g, 'global_vars.s["side"] = "fries"\nglobal_vars.s["drink"] = "lemonade"\nroom_goto("Eat")');
    step(g, 2);
    expect(room(g)).toBe("Eat");
    const box = py<[number, number]>(g, '[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.what == "eat_sandwich"][0]');
    const bites = py<number>(g, "BITES");
    for (let i = 1; i < bites; i++) {
      click(g, ...box);
      expect(py(g, "global_vars.s['bites']")).toBe(i);
      expect(py(g, "bite_edge(global_vars.s)")).toBeCloseTo(1 - i / bites);
    }
    expect(py<string[][]>(g, "[w[0] for w in global_vars.eat['words']]")).toContain("Crunch!");
    expect(g.scores).toEqual([]);
    click(g, ...box);
    expect(py(g, "eaten(global_vars.s)")).toBe(true);
    expect(py(g, 'global_vars.eat["result"]["new"]')).toEqual(["The BLT"]);
    expect(Object.keys(g.saved().book as object)).toEqual(["The BLT"]);
    expect(g.saved().best).toBe(5);
    expect(g.scores).toEqual([5]);
    // The first recipe unlocks the chips.
    expect(py(g, 'global_vars.eat["result"]["opened"]')).toEqual(["Chips"]);
    // A side and a drink are eaten too.
    const side = py<[number, number]>(g, '[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.what == "eat_side"][0]');
    click(g, ...side);
    expect(py(g, "global_vars.s['side_bites']")).toBe(1);
    step(g, 60);
    expect(py(g, 'len(instances("Button"))')).toBe(2);
    // A shorter one later doesn't lower the tallest, or the board.
    build(g, "white", ["ham"]);
    py(g, 'room_goto("Eat")');
    step(g, 2);
    for (let i = 0; i < bites; i++) click(g, ...box);
    expect(g.saved().best).toBe(5);
    expect(g.scores).toEqual([5]);
    expect(g.project.settings.scoreboard).toEqual({ unit: "layers" });
  });

  it("finds every secret recipe with a sandwich made for it, and no recipe in a plain one", async () => {
    const g = await start();
    const names = py<string[]>(g, '[r["name"] for r in RECIPES]');
    expect(Object.keys(MADE_FOR).sort()).toEqual([...names].sort());
    for (const [name, [bread, fill]] of Object.entries(MADE_FOR)) {
      build(g, bread, fill);
      expect(py<number>(g, "len(global_vars.s['layers'])"), name).toBe(fill.length + 2);
      expect(py<string[]>(g, "recipes_in(global_vars.s)"), name).toContain(name);
    }
    build(g, "white", ["chicken", "lettuce"]);
    expect(py(g, "recipes_in(global_vars.s)")).toEqual([]);
    // Every hint is there to read, and no two recipes share a name.
    expect(new Set(names).size).toBe(names.length);
    expect(py(g, 'all(len(r["hint"]) > 10 for r in RECIPES)')).toBe(true);
  });

  it("the silly things stay locked until enough recipes are found", async () => {
    const g = await start();
    await kitchen(g);
    py(g, 'do_act("tab", "more")');
    step(g);
    expect(py(g, '{o.key: o.off for o in instances("Spot")}')).toMatchObject({ pb: false, chips: true, gummy: true });
    // A locked plate does nothing.
    const [x, y] = py<[number, number]>(g, '[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.key == "chips"][0]');
    click(g, x, y);
    settle(g);
    expect(layers(g)).toEqual(["bottom"]);
    py(g, 'save_set("book", {n: {"bread": "white", "layers": [["bottom", 0], ["top", 0]]} for n in ["The BLT", "PB&J", "Caprese", "Fish Friday"]})\ndo_act("tab", "more")');
    step(g);
    expect(py(g, '{o.key: o.off for o in instances("Spot")}')).toMatchObject({ chips: false, banana: false, pancake: false, marshmallow: true, gummy: true });
    expect(py(g, "next_unlock()")).toEqual(["Marshmallows", 2]);
  });

  it("the recipe book shows found ones and hints, and is the one place questions may come", async () => {
    const g = await start({ book: { "The BLT": { bread: "white", layers: [["bottom", 0], ["bacon", 2], ["lettuce", -1], ["tomato", 0], ["top", 1]] } } });
    expect(g.questionOk.at(-1)).toBe(false);     // the title
    press(g, "space");
    step(g, 2);
    expect(room(g)).toBe("Breads");
    expect(g.questionOk.at(-1)).toBe(false);
    py(g, 'do_act("book", None)');
    step(g, 2);
    expect(room(g)).toBe("Book");
    expect(g.questionOk.at(-1)).toBe(true);
    py(g, 'do_act("page", 1)');
    step(g, 2);
    expect(py(g, "global_vars.page")).toBe(1);
    py(g, 'do_act("page", 99)');
    expect(py(g, "global_vars.page")).toBe(py<number>(g, "pages() - 1"));
    await kitchen(g);
    step(g, 2);
    expect(g.questionOk.at(-1)).toBe(false);
  });

  it("a whole sandwich made and eaten from the keyboard alone", async () => {
    const g = await start();
    expect(room(g)).toBe("Title");
    press(g, "space");                 // Make a Sandwich
    step(g, 2);
    expect(room(g)).toBe("Breads");
    press(g, "space");                 // the first bread
    expect(py(g, "global_vars.picked")).toBe("white");
    press(g, "space");                 // cut it
    step(g, py<number>(g, "SLICED_STEPS") + 3);
    expect(room(g)).toBe("Kitchen");
    // The first plate on the shelf, three times; then right, once.
    for (let i = 0; i < 3; i++) {
      press(g, "space");
      settle(g);
    }
    press(g, "right");
    press(g, "space");
    settle(g);
    expect(layers(g)).toEqual(["bottom", "chicken", "chicken", "chicken", "beef"]);
    // Tab round to Top it!
    for (let i = 0; i < 40 && py(g, "global_vars.focus.object_name == 'Button' and global_vars.focus.act == 'top'") !== true; i++) press(g, "tab");
    press(g, "space");
    settle(g);
    expect(py(g, "global_vars.s['topped']")).toBe(true);
    for (let i = 0; i < 40 && py(g, "global_vars.focus is not None and global_vars.focus.object_name == 'Button' and global_vars.focus.act == 'eat'") !== true; i++) press(g, "tab");
    press(g, "space");
    step(g, 2);
    expect(room(g)).toBe("Eat");
    for (let i = 0; i < py<number>(g, "BITES"); i++) press(g, "space");
    expect(py(g, "eaten(global_vars.s)")).toBe(true);
    expect(g.saved().best).toBe(4);
    step(g, 60);
    press(g, "space");                 // Make Another
    step(g, 2);
    expect(room(g)).toBe("Breads");
  });

  it("every screen draws, with a tall wobbly sandwich and a sauce on it", async () => {
    const g = await start();
    for (const r of ["Title", "Breads", "Book"]) {
      py(g, `room_goto("${r}")`);
      step(g, 30);
      expect(room(g)).toBe(r);
    }
    await kitchen(g, "rye");
    py(g, 's = global_vars.s\nfor i in range(45):\n    add_layer(s, ["ham", "lettuce", "tomato"][i % 3], (i % 5) * 3)\nadd_layer(s, "ketchup", 12, auto_squiggle())');
    step(g, 120);
    expect(py<number>(g, "kitchen_scale(global_vars.s)")).toBeLessThan(1);
    py(g, 'do_act("top", None)');
    settle(g);
    py(g, 'room_goto("Eat")');
    step(g, 10);
    for (let i = 0; i < py<number>(g, "BITES"); i++) py(g, "eat_bite()");
    step(g, 80);
    py(g, 'room_goto("Book")');
    step(g, 10);
  });
});
