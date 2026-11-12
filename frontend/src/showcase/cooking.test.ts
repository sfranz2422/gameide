/**
 * The cooking showcase game, Order Up!, played headless in the real Pyodide: the
 * kitchen's rules on their own (cooking and burning, building dishes, serving,
 * tips, combos, stars), customers losing patience, upgrades, saving, every day of
 * both restaurants played by a bot with the game's own taps, and a day played from
 * the keyboard alone. Runs when the game has been built (python3 showcase/cooking/build.py).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/cooking/out/project.json");
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

/**
 * A quick, careful player, tapping only through the game's own tap() (what a click
 * does) and seeing only what a player sees: the orders of those at the counter. It
 * bins what's burnt, serves what's ready, takes what's done to where it's wanted,
 * keeps the cookers going for the orders it can see, and builds each customer's
 * dish on a plate of its own, the most impatient first. One tap every `every` steps:
 * 15 is quick (four a second), 25 more like a person.
 */
const BOT = `
def bot_spot(name, **kw):
    for s in instances(name):
        if all(getattr(s, a) == v for a, v in kw.items()):
            return s
    return None


def bot_next_part(order, parts, dish):
    """The next part this plate needs for this order, in the order it can go on."""
    want = order["parts"]
    if dish == "burger":
        for p in ["bun", "patty"] + [x for x in want if x in BURGER_TOPPINGS] + ["top"]:
            if p not in parts:
                return p
        return None
    for p in ["noodles", "broth"] + [x for x in want if x in BOWL_TOPPINGS]:
        if p not in parts:
            return p
    return None


def bot_fits(plate, order, dish):
    if not plate:
        return True
    parts = plate["parts"]
    if any(p not in order["parts"] for p in parts):
        return False
    if dish == "burger" and parts[-1] == "top":
        return sorted(parts) == sorted(order["parts"])
    return True


def bot_pick():
    """What the bot would tap next (None: nothing to do)."""
    k = global_vars.k
    if k is None or k["over"]:
        return None
    dish = RESTAURANTS[k["rest"]]["dish"]
    custs = sorted([c for c in instances("Customer") if c.phase == "wait"], key=lambda c: c.wait)
    # 1. burnt food off the cookers
    for ci, c in enumerate(k["cookers"]):
        for si, sl in enumerate(c["slots"]):
            if slot_state(k, sl) == "burnt":
                return bot_spot("Cooker", c=ci, s=si)
    # 2. serve anyone something is ready for
    for c in custs:
        want = needs(c)
        if ("dish" in want and any(plate_matches(p, c.order, dish) for p in k["plates"])) or \\
                any(e in k["shelf"] for e in want if e != "dish"):
            return c
    # plates: one for each customer still wanting their dish
    assign = getattr(global_vars, "bot_assign", None) or [None] * PLATES
    for i in range(PLATES):
        c = assign[i]
        if c is not None and (c not in custs or c.got_dish or not bot_fits(k["plates"][i], c.order, dish)):
            assign[i] = None
    for c in custs:
        if c.got_dish or c in assign:
            continue
        # a plate already part-built that fits, else an empty one
        free = [i for i in range(PLATES) if assign[i] is None]
        fit = [i for i in free if k["plates"][i] and bot_fits(k["plates"][i], c.order, dish)]
        empty = [i for i in free if not k["plates"][i]]
        if fit:
            assign[fit[0]] = c
        elif empty:
            assign[empty[0]] = c
    global_vars.bot_assign = assign
    # a plate nobody can use: bin it
    for i in range(PLATES):
        if assign[i] is None and k["plates"][i] and not any(bot_fits(k["plates"][i], c.order, dish) for c in custs if not c.got_dish):
            if k["sel"] != i:
                return bot_spot("Plate", i=i)
            return bot_spot("Bin")
    # what's needed: cooked parts for plates, extras for customers
    plate_needs = []
    for i in range(PLATES):
        if assign[i] is not None:
            nxt = bot_next_part(assign[i].order, (k["plates"][i] or {"parts": []})["parts"], dish)
            if nxt:
                plate_needs.append((i, nxt))
    extras = {}
    for c in custs:
        for e in needs(c):
            if e != "dish":
                extras[e] = extras.get(e, 0) + 1
    for e in list(extras):
        extras[e] -= k["shelf"].count(e)
    main = "patty" if dish == "burger" else "noodles"
    # 3. take what's ready: a cooked main onto the plate waiting for it; a side or drink someone wants
    for ci, c in enumerate(k["cookers"]):
        for si, sl in enumerate(c["slots"]):
            if slot_state(k, sl) != "ready":
                continue
            it = sl["item"]
            if it == main:
                waiting = [i for i, p in plate_needs if p == main]
                if waiting:
                    if k["sel"] != waiting[0]:
                        return bot_spot("Plate", i=waiting[0])
                    return bot_spot("Cooker", c=ci, s=si)
            elif extras.get(it, 0) > 0 and None in k["shelf"]:
                return bot_spot("Cooker", c=ci, s=si)
    # a full shelf of things nobody wants
    if None not in k["shelf"]:
        for i, it in enumerate(k["shelf"]):
            if extras.get(it, 0) < 0:
                # Picked up, then binned: a shelf tap holds it now, it doesn't bin it.
                if k["held"] == i:
                    return bot_spot("Bin")
                return bot_spot("Shelf", i=i)
    # 4. start cooking what's wanted and not already on its way
    on_way = {}
    for c in k["cookers"]:
        for sl in c["slots"]:
            if slot_state(k, sl) in ("cooking", "ready"):
                on_way[sl["item"]] = on_way.get(sl["item"], 0) + 1
    want = dict(extras)
    want[main] = len([1 for i, p in plate_needs if p == main]) + len([c for c in custs if not c.got_dish and c not in assign])
    # a main also for plates not yet at that part (they'll want one soon)
    want[main] = max(want[main], len([c for c in custs if not c.got_dish]))
    for ci, c in enumerate(k["cookers"]):
        for si, sl in enumerate(c["slots"]):
            it = sl["item"]
            if slot_state(k, sl) == "empty" and want.get(it, 0) > on_way.get(it, 0):
                on_way[it] = on_way.get(it, 0) + 1
                return bot_spot("Cooker", c=ci, s=si)
    # 5. build: a part from a tray that can go on now, on the most urgent plate
    order_of = sorted([i for i in range(PLATES) if assign[i] is not None], key=lambda i: assign[i].wait)
    for i in order_of:
        have_parts = (k["plates"][i] or {"parts": []})["parts"]
        missing = [p for p in assign[i].order["parts"] if p not in have_parts]
        # the top bun last: it closes the burger
        cands = [p for p in RESTAURANTS[k["rest"]]["sources"] if p in missing and (p != "top" or missing == ["top"])]
        part = next((p for p in cands if plate_takes(k["plates"][i], p, dish)), None)
        if part is None:
            continue
        if k["sel"] != i:
            return bot_spot("Plate", i=i)
        return bot_spot("Source", part=part)
    return None


def bot_act():
    o = bot_pick()
    return tap(o) if o is not None else None
`;
const ALL_UPS = ["fast", "slot_main", "slot_side", "auto", "decor1", "decor2", "tips"];
const OPEN = { coins: 0, stars: [Array(10).fill(3), Array(10).fill(0)], ups: [[], []] };

/** A game in the kitchen: day d of restaurant r, with these upgrades. */
async function kitchen(r: number, d: number, ups: string[] = []) {
  const save = { progress: { ...OPEN, ups: [r === 0 ? ups : [], r === 1 ? ups : []] } };
  const g = await start(save);
  py(g, BOT);
  py(g, `start_day(${r}, ${d})`);
  step(g, 2);
  return g;
}

/** Plays day d of restaurant r to the end, the bot tapping every `every` steps; the day's results. */
async function botDay(r: number, d: number, ups: string[] = [], every = 15) {
  const g = await kitchen(r, d, ups);
  for (let t = 0; t < 7000 && room(g) === "Kitchen"; t++) {
    if (t % every === 0) py(g, "bot_act()");
    step(g);
  }
  return py<Record<string, number>>(g, "{x: global_vars.k[x] for x in ('coins', 'served', 'lost', 'tips', 'burnt', 'stars', 'goal', 'best_combo')}");
}

/** A kitchen with nobody coming (one customer due long after closing, so the day stays open), to try things in. */
async function quiet(r = 0, d = 9, ups: string[] = []) {
  const g = await kitchen(r, d, ups);
  py(g, 'global_vars.k["arrivals"] = [(10 ** 9, 0, {"parts": [], "extras": []})]');
  return g;
}
const slotT = (g: PythonGame, c: number, s: number) => py<number | null>(g, `global_vars.k["cookers"][${c}]["slots"][${s}]["t"]`);
const state = (g: PythonGame, c: number, s: number) => py<string>(g, `slot_state(global_vars.k, global_vars.k["cookers"][${c}]["slots"][${s}])`);
const tapCooker = (g: PythonGame, c: number, s: number) => py<string>(g, `tap(bot_spot("Cooker", c=${c}, s=${s}))`);
const tapSource = (g: PythonGame, part: string) => py<string>(g, `tap(bot_spot("Source", part="${part}"))`);
const plates = (g: PythonGame) => py<({ parts: string[] } | null)[]>(g, 'global_vars.k["plates"]');
/** A customer seated now with this order, `share` of their patience left. */
function seat(g: PythonGame, parts: string[], extras: string[] = [], share = 1, seatN = 0) {
  py(g, `c = instance_create(SEAT_X[${seatN}], COUNTER_Y, "Customer")
c.seat, c.kind, c.order = ${seatN}, 0, {"parts": ${JSON.stringify(parts)}, "extras": ${JSON.stringify(extras)}}
c.full = patience_full(global_vars.k, 0)
c.wait = c.full * ${share}
c.phase = "wait"
global_vars.test_c = c`);
}

describe.skipIf(!have)("Order Up!: the kitchen", () => {
  it("a patty cooks, is ready for a while, then burns; a burnt one goes in the bin", async () => {
    const g = await quiet();
    const cook = py<number>(g, 'ITEMS["patty"]["cook"]');
    const keep = py<number>(g, 'ITEMS["patty"]["keep"]');
    expect(state(g, 0, 0)).toBe("empty");
    expect(tapCooker(g, 0, 0)).toBe("start");
    step(g, cook - 2);
    expect(state(g, 0, 0)).toBe("cooking");
    expect(tapCooker(g, 0, 0)).toBe("wait");
    step(g, 3);
    expect(state(g, 0, 0)).toBe("ready");
    step(g, keep);
    expect(state(g, 0, 0)).toBe("burnt");
    expect(tapCooker(g, 0, 0)).toBe("bin");
    expect(slotT(g, 0, 0)).toBeUndefined();     // None in Python
    expect(py(g, 'global_vars.k["burnt"]')).toBe(1);
  }, 60_000);

  it("a drink pours, then waits for ever; fries go to the shelf, four at most", async () => {
    const g = await quiet();
    // Day 10 at the burger shack: grill (0), fryer (1), fountain (2) with cola and orange.
    tapCooker(g, 2, 0);
    step(g, 60 * 60);
    expect(state(g, 2, 0)).toBe("ready");
    expect(tapCooker(g, 2, 0)).toBe("take");
    expect(py(g, 'global_vars.k["shelf"]')).toEqual(["cola", undefined, undefined, undefined]);
    py(g, 'global_vars.k["shelf"] = ["cola", "cola", "orange", "fries"]');
    tapCooker(g, 1, 0);
    step(g, py<number>(g, 'ITEMS["fries"]["cook"]') + 1);
    expect(tapCooker(g, 1, 0)).toBe("nope");
    expect(state(g, 1, 0)).toBe("ready");
  }, 60_000);

  it("a burger is built from the bottom bun up, and the top bun closes it", async () => {
    const g = await quiet();
    expect(tapSource(g, "top")).toBe("nope");
    expect(tapSource(g, "cheese")).toBe("nope");
    expect(tapSource(g, "bun")).toBe("add");
    expect(tapSource(g, "top")).toBe("nope");        // no patty yet
    expect(tapSource(g, "cheese")).toBe("add");
    expect(tapSource(g, "cheese")).toBe("nope");     // once
    py(g, 'global_vars.k["cookers"][0]["slots"][0]["t"] = ITEMS["patty"]["cook"] + 1');
    expect(tapCooker(g, 0, 0)).toBe("take");
    expect(tapSource(g, "top")).toBe("add");
    expect(plates(g)[0]).toEqual({ parts: ["bun", "cheese", "patty", "top"] });
    // Closed: the next bun starts a new plate.
    expect(tapSource(g, "bun")).toBe("add");
    expect(plates(g)[1]).toEqual({ parts: ["bun"] });
    // The selected plate gets the next part first; the bin empties it.
    click(g, py<number>(g, 'bot_spot("Plate", i=0).x') + 30, py<number>(g, 'bot_spot("Plate", i=0).y') + 30);
    expect(py(g, 'global_vars.k["sel"]')).toBe(0);
    expect(py(g, 'tap(bot_spot("Bin"))')).toBe("bin");
    expect(plates(g)[0]).toBeUndefined();
  }, 60_000);

  it("a bowl takes noodles and broth in either order, toppings once there are noodles", async () => {
    const g = await quiet(1, 9);
    expect(tapSource(g, "egg")).toBe("nope");
    expect(tapSource(g, "broth")).toBe("add");
    expect(tapSource(g, "egg")).toBe("nope");
    py(g, 'global_vars.k["cookers"][0]["slots"][0]["t"] = ITEMS["noodles"]["cook"] + 1');
    expect(tapCooker(g, 0, 0)).toBe("take");
    expect(tapSource(g, "egg")).toBe("add");
    expect(py(g, 'plate_done(global_vars.k["plates"][0], "bowl")')).toBe(true);
    // Left in the pot too long, noodles go soggy, and are binned like burnt food.
    tapCooker(g, 0, 1);
    step(g, py<number>(g, 'ITEMS["noodles"]["cook"] + ITEMS["noodles"]["keep"]') + 2);
    expect(state(g, 0, 1)).toBe("burnt");
  }, 60_000);

  it("serving: the right dish and the extras; a wrong burger isn't taken; paid in full with a tip", async () => {
    const g = await quiet();
    seat(g, ["bun", "patty", "cheese", "top"], ["cola"]);
    py(g, 'global_vars.k["plates"] = [{"parts": ["bun", "patty", "top"]}, None, None]');
    expect(py(g, "tap(global_vars.test_c)")).toBe("nope");     // no cheese: not theirs
    py(g, 'global_vars.k["plates"][1] = {"parts": ["bun", "cheese", "patty", "top"]}');
    expect(py(g, "tap(global_vars.test_c)")).toBe("part");     // the burger, but no cola yet
    expect(plates(g)[1]).toBeUndefined();
    expect(plates(g)[0]).toEqual({ parts: ["bun", "patty", "top"] });
    py(g, 'global_vars.k["shelf"][2] = "cola"');
    expect(py(g, "tap(global_vars.test_c)")).toBe("paid");
    // 5 (burger) + 1 (cheese) + 2 (cola) and the biggest tip: served with all their patience left.
    expect(py(g, 'global_vars.k["coins"]')).toBe(8 + 3);
    expect(py(g, 'global_vars.k["served"]')).toBe(1);
  }, 60_000);

  describe("with the mouse (or a finger): tap, or drag", () => {
    /** Where a spot is on the screen: its middle, or `dy` (Python) from its top. */
    const at = (g: PythonGame, spot: string, dy?: string) =>
      py<[number, number]>(g, `[(s.x + s.wide / 2, s.y + ${dy ?? "s.high / 2"}) for s in [${spot}]][0]`) as unknown as [number, number];
    function drag(g: PythonGame, [x0, y0]: [number, number], [x1, y1]: [number, number]) {
      g.engine.input.mouseMove(x0, y0);
      step(g);
      g.engine.input.mouseDown(0);
      step(g);
      for (let i = 1; i <= 6; i++) {
        g.engine.input.mouseMove(x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6);
        step(g);
      }
      g.engine.input.mouseUp(0);
      step(g);
    }
    const SHELF0 = 'bot_spot("Shelf", i=0)';
    const CUST = "global_vars.test_c";

    it("tap the pop, then the customer: they get it (it used to go in the bin)", async () => {
      const g = await quiet();
      seat(g, ["bun", "patty", "top"], ["cola"]);
      step(g);
      py(g, 'global_vars.k["shelf"][0] = "cola"');
      py(g, 'global_vars.k["plates"][0] = {"parts": ["bun", "patty", "top"]}');
      click(g, ...at(g, SHELF0));
      expect(py(g, 'global_vars.k["shelf"][0]')).toBe("cola");     // picked up, not binned
      expect(py(g, 'global_vars.k["held"]')).toBe(0);
      click(g, ...at(g, CUST, "COUNTER_Y - 214 - s.y"));              // on their order bubble, above them
      expect(py(g, `${CUST}.phase`)).toBe("eat");
      expect(py(g, 'global_vars.k["burnt"]')).toBe(0);
    }, 60_000);

    it("a drink picked up and then the bin: thrown away; tapped twice: put back", async () => {
      const g = await quiet();
      step(g);
      py(g, 'global_vars.k["shelf"][0] = "orange"');
      click(g, ...at(g, SHELF0));
      click(g, ...at(g, SHELF0));
      expect(py(g, 'global_vars.k["held"]')).toBeUndefined();
      click(g, ...at(g, SHELF0));
      click(g, ...at(g, 'bot_spot("Bin")'));
      expect(py(g, 'global_vars.k["shelf"][0]')).toBeUndefined();
      expect(py(g, 'global_vars.k["burnt"]')).toBe(1);
    }, 60_000);

    it("drag the pop to the customer, a patty to a plate, the burger to the customer", async () => {
      const g = await quiet();
      seat(g, ["bun", "patty", "top"], ["cola"]);
      step(g);
      py(g, 'global_vars.k["shelf"][0] = "cola"');
      drag(g, at(g, SHELF0), at(g, CUST));
      expect(py(g, `${CUST}.got`)).toEqual(["cola"]);
      expect(py(g, 'global_vars.k["shelf"][0]')).toBeUndefined();
      // A bun on plate 1 (plate 0 is chosen, so the drag decides), then the patty dragged on.
      drag(g, at(g, 'bot_spot("Source", part="bun")'), at(g, 'bot_spot("Plate", i=1)'));
      expect(plates(g)[1]).toEqual({ parts: ["bun"] });
      py(g, 'global_vars.k["cookers"][0]["slots"][0]["t"] = ITEMS["patty"]["cook"] + 1');
      drag(g, at(g, 'bot_spot("Cooker", c=0, s=0)'), at(g, 'bot_spot("Plate", i=1)'));
      expect(plates(g)[1]).toEqual({ parts: ["bun", "patty"] });
      drag(g, at(g, 'bot_spot("Source", part="top")'), at(g, 'bot_spot("Plate", i=1)'));
      drag(g, at(g, 'bot_spot("Plate", i=1)'), at(g, CUST));
      expect(py(g, `${CUST}.phase`)).toBe("eat");
      expect(plates(g)[1]).toBeUndefined();
    }, 60_000);

    it("a drink dragged straight from the fountain to the customer; burnt food dragged to the bin", async () => {
      const g = await quiet();
      seat(g, ["bun", "patty", "top"], ["cola"]);
      step(g);
      py(g, 'global_vars.k["cookers"][2]["slots"][0]["t"] = ITEMS["cola"]["cook"] + 1');
      drag(g, at(g, 'bot_spot("Cooker", c=2, s=0)'), at(g, CUST));
      expect(py(g, `${CUST}.got`)).toEqual(["cola"]);
      expect(state(g, 2, 0)).toBe("empty");
      py(g, 'global_vars.k["cookers"][0]["slots"][0]["t"] = 10 ** 6');
      drag(g, at(g, 'bot_spot("Cooker", c=0, s=0)'), at(g, 'bot_spot("Bin")'));
      expect(state(g, 0, 0)).toBe("empty");
      // Something they didn't order, dragged to them: not taken, and still on the shelf.
      py(g, 'global_vars.k["shelf"][1] = "orange"');
      drag(g, at(g, 'bot_spot("Shelf", i=1)'), at(g, CUST));
      expect(py(g, 'global_vars.k["shelf"][1]')).toBe("orange");
    }, 60_000);
  });

  it("the longer they wait, the smaller the tip; out of patience, they go home hungry", async () => {
    const g = await quiet();
    seat(g, ["bun", "patty", "top"], [], 0.3);
    py(g, 'global_vars.k["plates"][0] = {"parts": ["bun", "patty", "top"]}');
    py(g, "tap(global_vars.test_c)");
    expect(py(g, 'global_vars.k["tips"]')).toBe(1);      // 3 × 0.3, rounded
    seat(g, ["bun", "patty", "top"], [], 0.002, 1);
    step(g, 5);
    expect(py(g, "global_vars.test_c.phase")).toBe("angry");
    expect(py(g, 'global_vars.k["lost"]')).toBe(1);
    expect(py(g, 'global_vars.k["combo"]')).toBe(0);
  }, 60_000);

  it("a combo: quick serves in a row make the tips bigger, up to double", async () => {
    const g = await quiet();
    const tips: number[] = [];
    for (let i = 0; i < 6; i++) {
      seat(g, ["bun", "patty", "top"], [], 1, i % 4);
      py(g, 'global_vars.k["plates"][0] = {"parts": ["bun", "patty", "top"]}');
      const before = py<number>(g, 'global_vars.k["tips"]');
      py(g, "tap(global_vars.test_c)");
      tips.push(py<number>(g, 'global_vars.k["tips"]') - before);
      py(g, "global_vars.test_c.destroy()");
      step(g);
    }
    // 3, then ×1.25, ×1.5, ×1.75, ×2, ×2 (halves rounded up).
    expect(tips).toEqual([3, 4, 5, 5, 6, 6]);
    expect(py(g, 'global_vars.k["best_combo"]')).toBe(6);
  }, 60_000);

  it("stars from the coins: the three goals are shares of the most the day could make", async () => {
    const g = await quiet();
    expect(py(g, "star_goals(100)")).toEqual([40, 58, 85]);
    expect(py(g, "[stars_for(c, 100) for c in (39, 40, 57, 58, 84, 85, 300)]")).toEqual([0, 1, 1, 2, 2, 3, 3]);
  }, 60_000);

  it("upgrades: faster cooking, another slot, drinks that pour by themselves, patience, bigger tips", async () => {
    const plain = await quiet(0, 9);
    const up = await quiet(0, 9, ALL_UPS);
    expect(py(up, 'cook_steps(global_vars.k, "patty")')).toBeCloseTo(py<number>(plain, 'cook_steps(global_vars.k, "patty")') * 0.7);
    expect(py(up, 'cook_steps(global_vars.k, "cola")')).toBe(py(plain, 'cook_steps(global_vars.k, "cola")'));
    expect(py(up, 'len(global_vars.k["cookers"][0]["slots"])')).toBe(3);
    expect(py(up, 'len(global_vars.k["cookers"][1]["slots"])')).toBe(2);
    expect(py(plain, 'len(global_vars.k["cookers"][0]["slots"])')).toBe(2);
    expect(py(up, "patience_full(global_vars.k, 0) / " + py<number>(plain, "patience_full(global_vars.k, 0)"))).toBeCloseTo(1.15 * 1.15);
    // The fountain pours again as soon as a drink is taken.
    step(up, 2);
    expect(state(up, 2, 0)).toBe("cooking");
    step(up, 200);
    tapCooker(up, 2, 0);
    step(up, 2);
    expect(state(up, 2, 0)).toBe("cooking");
    expect(state(plain, 2, 0)).toBe("empty");
    // The tip jar: half as big again.
    seat(up, ["bun", "patty", "top"], [], 1);
    py(up, 'global_vars.k["plates"][0] = {"parts": ["bun", "patty", "top"]}');
    py(up, "tap(global_vars.test_c)");
    expect(py(up, 'global_vars.k["tips"]')).toBe(Math.round(3 * 1.5));
  }, 60_000);

  it("buying an upgrade takes its coins, once; not enough coins, no upgrade", async () => {
    const g = await start({ progress: { ...OPEN, coins: 100 } });
    expect(py(g, 'buy_upgrade(0, "fast")')).toBe(true);
    expect(py(g, 'progress()["coins"]')).toBe(40);
    expect(py(g, 'buy_upgrade(0, "fast")')).toBe(false);
    expect(py(g, 'buy_upgrade(0, "decor2")')).toBe(false);
    expect(py(g, 'progress()["ups"]')).toEqual([["fast"], []]);
  }, 60_000);
});

describe.skipIf(!have)("Order Up!: days, saving and the board", () => {
  it("day 1 opens the next once it has a star; the noodle bar opens with the shack's tenth day", async () => {
    const g = await start();
    expect(py(g, "[day_open(progress(), 0, d) for d in range(3)]")).toEqual([true, false, false]);
    expect(py(g, "restaurant_open(progress(), 1)")).toBe(false);
    py(g, 'p = progress()\np["stars"][0] = [1] * 9 + [0]\nkeep_progress(p)');
    expect(py(g, "[day_open(progress(), 0, d) for d in (1, 9)]")).toEqual([true, true]);
    expect(py(g, "restaurant_open(progress(), 1)")).toBe(false);
    py(g, 'p = progress()\np["stars"][0][9] = 1\nkeep_progress(p)');
    expect(py(g, "restaurant_open(progress(), 1)")).toBe(true);
    // On the map, a closed day's button is off.
    py(g, 'do_act("play", None)');
    step(g, 2);
    expect(py(g, "[b.off for b in instances('Map')[0].days][:3]")).toEqual([false, false, false]);
  }, 60_000);

  it("a day played: its stars and coins are kept, the board has every star, and Continue finds them", async () => {
    const g = await start();
    py(g, BOT);
    py(g, "start_day(0, 0)");
    step(g, 2);
    for (let t = 0; t < 7000 && room(g) === "Kitchen"; t++) {
      if (t % 15 === 0) py(g, "bot_act()");
      step(g);
    }
    expect(room(g)).toBe("Summary");
    const kept = g.saved().progress as { coins: number; stars: number[][] };
    expect(kept.stars[0]![0]).toBe(3);
    expect(kept.coins).toBe(py(g, 'global_vars.k["coins"]'));
    expect(g.scores).toEqual([3]);
    // Played again no better: nothing new for the board.
    py(g, 'do_act("retry", None)');
    step(g, 2);
    py(g, 'global_vars.k["arrivals"] = []');
    step(g, 70);
    expect(room(g)).toBe("Summary");
    expect(g.scores).toEqual([3]);
    expect((g.saved().progress as { stars: number[][] }).stars[0]![0]).toBe(3);
    // A new visit with that save: day 2 is open.
    const again = await start(g.saved());
    expect(py(again, "day_open(progress(), 0, 1)")).toBe(true);
    expect(py(again, "total_stars(progress())")).toBe(3);
  }, 120_000);

  it("questions come between days, never in the kitchen", async () => {
    const g = await start();
    py(g, BOT);
    expect(g.questionOk).not.toContain(false);
    py(g, "start_day(0, 0)");
    step(g, 5);
    expect(g.questionOk.at(-1)).toBe(false);
    py(g, 'global_vars.k["t"] = DAY_STEPS')
    step(g, 80);
    expect(room(g)).toBe("Summary");
    expect(g.questionOk.at(-1)).toBe(true);
  }, 60_000);

  it("every day of both restaurants can be won: a star a day without upgrades, three with them", async () => {
    const results: string[] = [];
    for (const r of [0, 1]) {
      for (let d = 0; d < 10; d++) {
        const plain = await botDay(r, d);
        const ups = await botDay(r, d, ALL_UPS);
        results.push(`${r}/${d + 1}: ${plain.stars} ${ups.stars}`);
        expect(plain.stars, `restaurant ${r} day ${d + 1}`).toBeGreaterThanOrEqual(1);
        expect(ups.stars, `restaurant ${r} day ${d + 1}, upgraded`).toBe(3);
      }
    }
  }, 900_000);

  it("a little easier, as the teacher asked: patience, how long food keeps, the star goals, day 10's crowd", async () => {
    const g = await quiet(0, 0);
    // An ordinary customer on day 1 waits 37.5 s (it was 30).
    expect(py(g, "patience_full(global_vars.k, 0) / FPS")).toBeCloseTo(37.5);
    // Done food stays good 2 s longer than it did: 7 s for a patty (it was 5).
    expect(py(g, 'ITEMS["patty"]["keep"] / FPS')).toBe(7);
    expect(py(g, "STAR_SHARES")).toEqual([0.4, 0.58, 0.85]);
    // Day 10 brings 16 customers (it was 19).
    expect(py(g, 'day_plan(9)["customers"]')).toBe(16);
    expect(py(g, "len(day_arrivals(1, 9))")).toBe(16);
  }, 60_000);

  it("at a person's pace with no upgrades: three stars to day 8, at least two on every day of both", async () => {
    // The teacher asked for "a little easier" (2026-11-12): at 2.4 taps a second, three
    // stars on days 1-8 of both and at least two on the last days, where the rush is real.
    for (const r of [0, 1]) {
      for (let d = 0; d < 10; d++) {
        const day = await botDay(r, d, [], 25);
        expect(day.stars, `restaurant ${r} day ${d + 1}`).toBeGreaterThanOrEqual(d < 8 ? 3 : 2);
      }
    }
  }, 900_000);

  it("a day from the keyboard alone: arrows to each thing, Space to tap it", async () => {
    const g = await kitchen(0, 1);
    const target = () => py<[number, number] | null>(g, "(lambda o: None if o is None else [o.x + o.wide / 2, o.y + o.high / 2])(bot_pick())");
    const focus = () => py<[number, number] | null>(g, "(lambda o: None if o is None else [o.x + o.wide / 2, o.y + o.high / 2])(getattr(global_vars, 'focus', None))");
    let presses = 0;
    for (let t = 0; t < 8000 && room(g) === "Kitchen"; t++) {
      const want = target();
      if (!want) {
        step(g);
        continue;
      }
      let at = focus();
      if (!at) {
        press(g, "right");
        at = focus();
      }
      if (at && Math.abs(at[0] - want[0]) < 1 && Math.abs(at[1] - want[1]) < 1) {
        press(g, "space");
      } else if (at) {
        const dx = want[0] - at[0], dy = want[1] - at[1];
        press(g, Math.abs(dy) > 40 ? (dy > 0 ? "down" : "up") : (dx > 0 ? "right" : "left"));
      }
      presses++;
      step(g, 6);
    }
    expect(presses).toBeGreaterThan(20);
    expect(room(g)).toBe("Summary");
    console.log("keys:", presses, py(g, '{x: global_vars.k[x] for x in ("served", "lost", "coins", "stars")}'));
    // Day 2 has six customers. Steering the box with the arrows takes a few presses
    // between the counter's two rows, so a keys-only day serves most, not all (4 of 6).
    expect(py(g, 'global_vars.k["served"]')).toBeGreaterThanOrEqual(4);
    expect(py(g, 'global_vars.k["stars"]')).toBeGreaterThanOrEqual(2);
  }, 180_000);

  it("the menus from the keyboard: Play, a day, the shop and back", async () => {
    const g = await start({ progress: { ...OPEN, coins: 500 } });
    press(g, "space");
    expect(room(g)).toBe("Map");
    // The box starts on the latest day open (all ten, with this save).
    expect(py(g, "global_vars.focus.words")).toBe("Day 10");
    press(g, "left");
    expect(py(g, "global_vars.focus.words")).toBe("Day 9");
    press(g, "space");
    expect(room(g)).toBe("Kitchen");
    expect(py(g, 'global_vars.k["day"]')).toBe(8);
    py(g, 'do_act("map", None)');
    step(g, 2);
    // Tab goes round everything; on to Upgrades, and buy the first.
    for (let i = 0; i < 20 && py(g, "global_vars.focus.words") !== "Upgrades"; i++) press(g, "tab");
    expect(py(g, "global_vars.focus.words")).toBe("Upgrades");
    press(g, "space");
    expect(room(g)).toBe("Shop");
    press(g, "space");
    expect(py(g, 'progress()["ups"][0]')).toEqual(["fast"]);
  }, 60_000);
});
