/**
 * The lemonade showcase game, Squeeze, played headless in the real Pyodide: the
 * business rules on their own (stock, spoiling, melting, taste, who buys, the
 * ledger), whole days on the street, upgrades and events, saving, a bot playing a
 * whole summer sensibly (and one playing it badly), and a day played from the
 * keyboard alone. Runs when the game has been built (python3 showcase/lemon/build.py).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/lemon/out/project.json");
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
const room = (g: PythonGame) => py<string>(g, "room_name()");

/**
 * A sensible player: sets up at the best place it has, prices by the forecast's
 * heat, mixes a middling recipe, buys about what the day should sell (no more:
 * lemons go soft), and spends spare money on upgrades and new places.
 */
const BOT = `
import math
def bot_morning():
    s = global_vars.s
    day = today(s)
    plan = s["plan"]
    plan["place"] = max(s["places"])
    hot = day["forecast"]
    rain = day["rain_pct"] >= 60
    if rain and PLACES[plan["place"]]["rain"] < 0.5:
        plan["place"] = max(i for i in s["places"] if PLACES[i]["rain"] >= 0.4)
    price = 100 + (hot - 78) * 4
    if rain:
        price -= 20
    price = max(60, min(200, round(price / 5) * 5))
    if day["rival"] is not None:
        price = min(price, day["rival"] + 10)
    plan["price"] = price
    plan["lemons"], plan["sugar"] = 4, 4
    plan["ice"] = 3 if hot < 75 else 4 if hot < 88 else 5
    plan["pink"] = has(s, "pink")
    guess = {**day, "temp": hot, "sky": "rain" if rain else "sunny"}
    # A second stand, once there's one and somewhere to put it: the busiest other place.
    sec = plan["second"]
    sec["open"] = has(s, "second") and len(second_places(s)) > 0
    bot_buy(s, guess)
    # Can't pay for it all: no second stand today, then the park (no rent), planned again each time.
    if open_cost(s) > s["money"] and sec["open"]:
        sec["open"] = False
        bot_buy(s, guess)
    if open_cost(s) > s["money"] and plan["place"] != 0:
        plan["place"] = 0
        bot_buy(s, guess)
    while open_cost(s) > s["money"]:
        k = max(SUPPLY_KEYS, key=lambda k: plan["buy"][k])
        if plan["buy"][k] == 0:
            break
        plan["buy"][k] -= 1
    if sec["open"] and second_problem(s):
        sec["open"] = False

def bot_buy(s, guess):
    plan = s["plan"]
    sec = plan["second"]
    cups = math.ceil(crowd_size(s, guess) * 0.45)
    pitchers = math.ceil(cups / CUPS_PER_PITCHER)
    need = {"lemons": pitchers * lemons_a_pitcher(s) - lemon_count(s), "sugar": pitchers * plan["sugar"] - s["sugar"],
            "ice": cups * plan["ice"] - int(s["ice"]) + 10, "cups": cups - s["cups"]}
    if sec["open"]:
        sec["place"] = max(second_places(s), key=lambda i: crowd_size(s, guess, i))
        sec["price"] = plan["price"]
        sec["cups"] = min(SECOND_MOST, math.ceil(crowd_size(s, guess, sec["place"]) * 0.4 / SECOND_STEP) * SECOND_STEP)
        for k, n in second_needs(s).items():
            need[k] += n + (10 if k == "ice" else 0)
    packs = dict((k, p) for k, _, p, _, _, _ in SUPPLIES)
    plan["buy"] = {k: max(0, min(BUY_MOST, math.ceil(need[k] / packs[k]))) for k in SUPPLY_KEYS}

def open_cost(s):
    sec = second_open(s)
    return shopping_cost(s) + place_now(s)["rent"] + (PLACES[sec["place"]]["rent"] + SECOND_WAGE if sec else 0)

def bot_evening():
    s = global_vars.s
    for kind, what in (("upgrade", "cooler"), ("upgrade", "sign"), ("unlock", 1), ("upgrade", "juicer"), ("upgrade", "pink"),
                       ("unlock", 2), ("upgrade", "second"), ("upgrade", "helper"), ("unlock", 3)):
        cost = next(u[2] for u in UPGRADES if u[0] == what) if kind == "upgrade" else PLACES[what]["unlock"]
        if s["money"] >= cost + 2500:
            do_act(kind, what)

def silly_morning():
    s = global_vars.s
    plan = s["plan"]
    plan["price"], plan["sugar"], plan["lemons"], plan["ice"] = 300, 0, 6, 1
    plan["buy"] = {"lemons": 1, "sugar": 0, "ice": 1, "cups": 1}
    while shopping_cost(s) > s["money"]:
        plan["buy"] = {k: 0 for k in SUPPLY_KEYS}
`;
/** Plays a month with the bot (or the silly one); the money each evening. */
function wholeSummer(g: PythonGame, silly = false, days = 30) {
  py(g, BOT);
  const money: number[] = [];
  for (let d = 0; d < days; d++) {
    py(g, silly ? "silly_morning()" : "bot_morning()");
    openAndPlay(g);
    money.push(py<number>(g, "global_vars.s['money']"));
    if (d === days - 1) break;
    if (!silly) py(g, "bot_evening()");
    py(g, 'do_act("next", None)');
    step(g, 2);
    expect(room(g)).toBe("Morning");
  }
  return money;
}

/** A new summer (seed fixed), on its first morning. */
async function summer(seed = 7, save: Record<string, unknown> = {}) {
  const g = await start(save);
  py(g, `global_vars.s = new_summer(${seed})\nroom_goto("Morning")`);
  step(g, 2);
  expect(room(g)).toBe("Morning");
  return g;
}
/** Plays out the day on the street (fast), until the evening. */
function playDay(g: PythonGame, speed = 4) {
  py(g, `global_vars.speed = ${speed}`);
  for (let k = 0; k < 12000 && room(g) === "Street"; k++) step(g);
  expect(room(g)).toBe("Evening");
}
/** Opens the stand with the plan as it is, and plays the day. */
function openAndPlay(g: PythonGame, speed = 4) {
  py(g, 'do_act("open", None)');
  step(g, 2);
  expect(py(g, "global_vars.problem")).toBe("");
  expect(room(g)).toBe("Street");
  playDay(g, speed);
}

describe.skipIf(!have)("Squeeze", () => {
  it("a day: open the stand, people walk by, some buy, and the evening's ledger adds up", async () => {
    const g = await summer();
    py(g, 'global_vars.s["plan"]["buy"] = {"lemons": 2, "sugar": 1, "ice": 2, "cups": 2}');
    openAndPlay(g);
    const t = py<{ passers: number; cups: number; money_start: number; money_end: number; supplies: number; rent: number; income: number; profit: number }>(
      g, "{k: v for k, v in global_vars.s['history'][-1].items() if isinstance(v, (int, float))}");
    expect(t.passers).toBeGreaterThan(10);
    expect(t.cups).toBeGreaterThan(0);
    expect(t.money_end).toBe(t.money_start - t.supplies - t.rent + t.income);
    expect(t.profit).toBe(t.income - t.supplies - t.rent);
    expect(t.income).toBe(t.cups * py<number>(g, "global_vars.s['history'][-1]['price']"));
  }, 120_000);

  it("a whole month, played sensibly, makes money (a second stand too); priced at $3 with no sugar, it loses", async () => {
    const g = await summer(11);
    const money = wholeSummer(g, false, 40);
    // From $20 to well over $300 in a month, with upgrades bought along the way; and on past day 30.
    expect(money[29]!).toBeGreaterThan(30_000);
    expect(py<string[]>(g, "global_vars.s['upgrades']").length).toBeGreaterThanOrEqual(3);
    expect(py(g, "[global_vars.s['day'], len(global_vars.s['history'])]")).toEqual([39, 40]);
    expect(money[39]!).toBeGreaterThan(money[29]!);
    // The second stand sold for it, and its money is in the ledger.
    expect(py<number>(g, "sum(h['second']['cups'] for h in global_vars.s['history'] if h.get('second'))")).toBeGreaterThan(50);
    const h = await summer(11);
    const lost = wholeSummer(h, true);
    expect(lost.at(-1)!).toBeLessThan(2000);
    expect(py<number>(h, "sum(t['cups'] for t in global_vars.s['history'])")).toBe(0);
  }, 600_000);

  it("the morning's shopping: packs into stock, paid as the stand opens; too dear, nothing changes", async () => {
    const g = await summer();
    py(g, 'global_vars.s["plan"]["buy"] = {"lemons": 2, "sugar": 1, "ice": 3, "cups": 1}');
    const cost = py<number>(g, "shopping_cost(global_vars.s)");
    const prices = py<Record<string, number>>(g, "today(global_vars.s)['prices']");
    expect(cost).toBe(2 * prices.lemons! + prices.sugar! + 3 * prices.ice! + prices.cups!);
    expect(py(g, "t = open_stand(global_vars.s)\n[lemon_count(global_vars.s), global_vars.s['sugar'], int(global_vars.s['ice']), global_vars.s['cups'], global_vars.s['money'], t['supplies']]")).toEqual([24, 20, 180, 25, 2000 - cost, cost]);
    const h = await summer();
    py(h, 'global_vars.s["plan"]["buy"] = {"lemons": 9, "sugar": 9, "ice": 9, "cups": 9}');
    expect(py(h, "open_stand(global_vars.s)")).toMatch(/^That costs \$\d+\.\d\d with the rent, and you have \$20\.00\.$/);
    expect(py(h, "[global_vars.s['money'], lemon_count(global_vars.s), global_vars.s['phase']]")).toEqual([2000, 0, "morning"]);
    // From the screen: the words, and still the morning.
    py(h, 'do_act("open", None)');
    step(h, 2);
    expect(room(h)).toBe("Morning");
    expect(py<string>(h, "global_vars.problem")).toMatch(/^That costs/);
  });

  it("lemons go soft on their fourth day, the oldest used first; ice melts by morning unless there's a cooler", async () => {
    const g = await summer();
    py(g, "s = global_vars.s\ns['lemons'] = [[0, 12]]\ns['ice'] = 100.0");
    py(g, "next_day(global_vars.s)");      // day 1
    expect(py(g, "[lemon_count(global_vars.s), int(global_vars.s['ice']), global_vars.s['news']]")).toEqual([12, 0, { melted: 100, soft: 0, made_ice: 0 }]);
    py(g, "s = global_vars.s\ns['lemons'].append([1, 12])\nuse_lemons(s, 5)");
    expect(py(g, "global_vars.s['lemons']")).toEqual([[0, 7], [1, 12]]);
    py(g, "next_day(global_vars.s)\nnext_day(global_vars.s)");     // day 3: day 0's are soft
    expect(py(g, "[global_vars.s['news']['soft'], global_vars.s['lemons']]")).toEqual([7, [[1, 12]]]);
    // A cooler keeps half the ice overnight.
    py(g, "s = global_vars.s\ns['upgrades'].append('cooler')\ns['ice'] = 100.0\nnext_day(s)");
    expect(py(g, "[int(global_vars.s['ice']), global_vars.s['news']['melted']]")).toEqual([50, 50]);
    // And in the day's sun, more melts the hotter it is; a cooler halves it.
    const melt = (temp: number, cooler: boolean) =>
      py<number>(g, `s = dict(global_vars.s, ice=100.0, upgrades=${cooler ? "['cooler']" : "[]"})\nmelt_ice(s, ${temp}, DAY_STEPS)\n100 - s['ice']`);
    expect(melt(95, false)).toBeGreaterThan(melt(70, false));
    expect(melt(95, true)).toBeCloseTo(melt(95, false) / 2, 5);
  });

  it("what they think: too few lemons is watery, too many sour, too much sugar sweet, too little ice warm, else perfect (pink fans love pink)", async () => {
    const g = await summer();
    const who = '{"lemons": 4, "sugar": 4, "ice": 4, "fan": True}';
    const v = (l: number, s: number, i: number, pink = false) => py<string>(g, `verdict([${l}, ${s}, ${i}], ${who}, ${pink ? "True" : "False"})`);
    expect(v(4, 4, 4)).toBe("perfect");
    expect(v(5, 3, 3)).toBe("perfect");
    expect(v(2, 4, 4)).toBe("watery");
    expect(v(6, 4, 4)).toBe("sour");
    expect(v(4, 2, 4)).toBe("sour");
    expect(v(4, 6, 4)).toBe("sweet");
    expect(v(4, 4, 2)).toBe("warm");
    expect(v(4, 4, 4, true)).toBe("love");
  });

  it("who buys: the thirsty who notice you, at a price they'd pay; a cheaper rival takes some; a full queue turns them away", async () => {
    const g = await summer();
    py(g, `
class Always:
    def random(self): return 0.0
    def uniform(self, a, b): return a
    def choice(self, xs): return xs[0]
global_vars.R = Always()
global_vars.T = {"price": 100, "pink": False}
def who(thirst, budget):
    return {"thirst": thirst, "budget": budget, "fan": False}`);
    const d = (thirst: number, budget: number, price = 100, queue = 0, rival = "None") =>
      py<string>(g, `global_vars.T["price"] = ${price}\ndecide(global_vars.s, who(${thirst}, ${budget}), global_vars.T, ${queue}, ${rival}, global_vars.R)`);
    expect(d(0.05, 300)).toBe("pass");
    expect(d(0.8, 300)).toBe("buy");
    expect(d(0.8, 100)).toBe("pricey");
    expect(d(0.8, 300, 295)).toBe("pricey");
    expect(d(0.8, 300, 100, 0, "60")).toBe("rival");
    expect(d(0.8, 300, 100, 0, "120")).toBe("buy");
    expect(d(0.8, 300, 100, 6)).toBe("full");
    // A helper: a longer queue is fine.
    py(g, "global_vars.s['upgrades'].append('helper')");
    expect(d(0.8, 300, 100, 6)).toBe("buy");
    // Hotter days: thirstier people, more of them.
    expect(py<number>(g, "thirst_for(95, global_vars.R)")).toBeGreaterThan(py<number>(g, "thirst_for(70, global_vars.R)"));
    expect(py<number>(g, "crowd_size(global_vars.s, dict(today(global_vars.s), temp=95, sky='sunny'))")).toBeGreaterThan(py<number>(g, "crowd_size(global_vars.s, dict(today(global_vars.s), temp=70, sky='sunny'))"));
    expect(py<number>(g, "crowd_size(global_vars.s, dict(today(global_vars.s), temp=80, sky='rain'))")).toBeLessThan(py<number>(g, "crowd_size(global_vars.s, dict(today(global_vars.s), temp=80, sky='sunny'))"));
  });

  it("running out stops the selling: the stand says what's gone, and the thirsty walk away", async () => {
    const g = await summer();
    py(g, 'global_vars.s["plan"]["buy"] = {"lemons": 2, "sugar": 1, "ice": 2, "cups": 0}');
    py(g, 'do_act("open", None)');
    step(g, 3);
    expect(room(g)).toBe("Street");
    expect(py(g, "instances('Stand')[0].out")).toBe("No cups left!");
    playDay(g);
    const t = py<{ cups: number; said: Record<string, number> }>(g, "global_vars.s['history'][-1]");
    expect(t.cups).toBe(0);
    expect(t.said.thirsty).toBeGreaterThan(0);
    // Each one checked in turn: ice, then lemons and sugar for a new pitcher.
    expect(py(g, "s = dict(global_vars.s, cups=5, ice=0.0, pitcher=0)\nwhy_not(s)")).toBe("No ice left!");
    expect(py(g, "s = dict(global_vars.s, cups=5, ice=50.0, pitcher=0, lemons=[])\nwhy_not(s)")).toBe("No lemons left!");
    expect(py(g, "s = dict(global_vars.s, cups=5, ice=50.0, pitcher=0, lemons=[[0, 12]], sugar=0)\nwhy_not(s)")).toBe("No sugar left!");
    expect(py(g, "s = dict(global_vars.s, cups=5, ice=50.0, pitcher=3, lemons=[], sugar=0)\nwhy_not(s) is None")).toBe(true);
  });

  it("upgrades: paid for once; the juicer saves lemons, the sign brings more, the helper pours faster, pink fans pay more", async () => {
    const g = await summer();
    py(g, "global_vars.s['money'] = 20000");
    expect(py(g, "[buy_upgrade(global_vars.s, 'juicer'), buy_upgrade(global_vars.s, 'juicer'), global_vars.s['money']]")).toEqual([true, false, 17500]);
    expect(py(g, "global_vars.s['plan']['lemons'] = 4\nlemons_a_pitcher(global_vars.s)")).toBe(3);
    const crowd = py<number>(g, "crowd_size(global_vars.s)");
    py(g, "buy_upgrade(global_vars.s, 'sign')");
    expect(py<number>(g, "crowd_size(global_vars.s)")).toBeGreaterThan(crowd);
    expect(py(g, "serve_steps(global_vars.s)")).toBe(py(g, "SERVE_STEPS"));
    py(g, "buy_upgrade(global_vars.s, 'second')");
    expect(py(g, "serve_steps(global_vars.s)")).toBe(py(g, "SERVE_STEPS"));
    py(g, "buy_upgrade(global_vars.s, 'helper')");
    expect(py(g, "serve_steps(global_vars.s)")).toBe(py<number>(g, "SERVE_STEPS") / 2);
    const fan = '{"thirst": 0.5, "budget": 200, "fan": True}';
    expect(py<number>(g, `would_pay(global_vars.s, ${fan}, True)`)).toBeGreaterThan(py<number>(g, `would_pay(global_vars.s, ${fan}, False)`));
    // Too dear: nothing bought.
    py(g, "global_vars.s['money'] = 100");
    expect(py(g, "[buy_upgrade(global_vars.s, 'cooler'), unlock_place(global_vars.s, 1), global_vars.s['money']]")).toEqual([false, false, 100]);
    // A new place, from the evening's button: yours, and where tomorrow's stand goes.
    py(g, "global_vars.s['money'] = 5000\ndo_act('unlock', 1)");
    expect(py(g, "[global_vars.s['places'], global_vars.s['plan']['place'], global_vars.s['money']]")).toEqual([[0, 1], 1, 3000]);
  });

  it("the summer's events, every month for ever: a heat wave, a rainy spell, a parade downtown, and rival days", async () => {
    const g = await summer();
    for (const [seed, start] of [[1, 0], [2, 0], [3, 30], [4, 60], [5, 300]]) {
      const [n, heat, hotter, rainy, allRain, parades, earlyRival] = py<[number, number, boolean, number, boolean, number, boolean]>(g, `p = summer_plan(${seed}, ${start})
avg = sum(d["temp"] for d in p) / len(p)
[len(p), sum(d["heat"] for d in p), all(d["temp"] > avg for d in p if d["heat"]),
 sum(d["rainy_week"] for d in p), all(d["sky"] == "rain" for d in p if d["rainy_week"]),
 sum(d["parade"] for d in p), ${start} == 0 and any(d["rival"] is not None for d in p[:3])]`);
      expect([n, heat, hotter, rainy, allRain, parades, earlyRival]).toEqual([30, 3, true, 4, true, 1, false]);
    }
    // Each month its own events, not the first month's again (each day's noise differs anyway).
    expect(py(g, "any([d['heat'] for d in summer_plan(sd, 30)] != [d['heat'] for d in summer_plan(sd, 0)] for sd in range(1, 6))")).toBe(true);
    // The same seed, the same summer: a reload can't bring better weather, whichever day's asked for first.
    expect(py(g, "a = day_plan(9, 45)\n_plans.clear()\nb = summer_plan(9, 40)[5]\na == b")).toBe(true);
    // The parade fills downtown, and only downtown.
    py(g, "s = global_vars.s\ns['places'] = [0, 1, 2, 3]");
    const crowd = (place: number, parade: boolean) => py<number>(g, `global_vars.s['plan']['place'] = ${place}\ncrowd_size(global_vars.s, dict(today(global_vars.s), parade=${parade ? "True" : "False"}))`);
    expect(crowd(3, true)).toBeGreaterThan(2 * crowd(3, false));
    expect(crowd(0, true)).toBe(crowd(0, false));
  });

  it("saved each evening: Continue picks up where the summer was, the morning after", async () => {
    const g = await summer(5);
    openAndPlay(g);
    const money = py<number>(g, "global_vars.s['money']");
    py(g, 'do_act("next", None)');
    step(g, 2);
    const saved = g.saved();
    expect((saved.summer as { day: number }).day).toBe(1);
    const h = await start(saved);
    expect(room(h)).toBe("Title");
    expect(py(h, "instances('Title')[0].cont.off")).toBe(false);
    press(h, "space");      // the keys start on Continue when there's a summer to continue
    step(h, 2);
    expect(room(h)).toBe("Morning");
    expect(py(h, "[global_vars.s['day'], global_vars.s['money'], len(global_vars.s['history'])]")).toEqual([1, money, 1]);
  });

  it("from the keyboard alone: New summer, raise the price, open the stand, a day at 4x, and on to the next morning", async () => {
    const g = await start();
    expect(room(g)).toBe("Title");
    press(g, "space");
    step(g, 2);
    expect(room(g)).toBe("Morning");
    const before = py<number>(g, "global_vars.s['plan']['price']");
    // Tab goes round the controls in order: the four packs, the recipe, the price.
    for (let k = 0; k < 8; k++) press(g, "tab");
    expect(py(g, "global_vars.focus.key")).toBe("price");
    press(g, "right");
    press(g, "right");
    expect(py(g, "global_vars.s['plan']['price']")).toBe(before + 10);
    // Down to Open the stand, and Space.
    press(g, "down");
    press(g, "down");
    expect(py(g, "global_vars.focus.words")).toBe("Open the stand");
    press(g, "space");
    step(g, 2);
    expect(room(g)).toBe("Street");
    press(g, "4");
    expect(py(g, "global_vars.speed")).toBe(4);
    for (let k = 0; k < 4000 && room(g) === "Street"; k++) step(g);
    expect(room(g)).toBe("Evening");
    expect(py(g, "global_vars.s['history'][-1]['price']")).toBe(before + 10);
    press(g, "space");
    step(g, 2);
    expect(room(g)).toBe("Morning");
    expect(py(g, "global_vars.s['day']")).toBe(1);
  }, 120_000);

  it("the mouse: a click on + raises a number, a click on Open the stand opens it", async () => {
    const g = await summer();
    const [x, y, w] = py<[number, number, number]>(g, "st = next(o for o in instances('Stepper') if o.key == 'lemons')\n[st.x, st.y, st.wide]");
    click(g, x + w - 19, y + 23);
    expect(py(g, "global_vars.s['plan']['lemons']")).toBe(5);
    click(g, x + w - 119, y + 23);
    click(g, x + w - 119, y + 23);
    expect(py(g, "global_vars.s['plan']['lemons']")).toBe(3);
    const [bx, by] = py<[number, number]>(g, "b = instances('Morning')[0].open\n[b.x + 20, b.y + 20]");
    click(g, bx, by);
    step(g, 2);
    expect(room(g)).toBe("Street");
  });

  it("questions wait while the street is busy, and come in the morning or the evening", async () => {
    const g = await summer();
    step(g, 2);
    // Only changes are sent; the page starts out thinking a question is fine.
    py(g, 'do_act("open", None)');
    step(g, 3);
    expect(g.questionOk.at(-1)).toBe(false);
    playDay(g);
    step(g, 2);
    expect(g.questionOk.at(-1)).toBe(true);
  }, 120_000);

  it("no last day: day 30 goes on to day 31, on the board in dollars every evening; a summer that ended carries on", async () => {
    const g = await summer(3);
    py(g, "s = global_vars.s\ns['day'] = 29\ns['money'] = 41234");
    py(g, 'global_vars.s["plan"]["buy"] = {"lemons": 0, "sugar": 0, "ice": 0, "cups": 0}');
    openAndPlay(g);
    expect(g.scores).toEqual([412]);
    expect(py(g, "rank_of(41234)")).toBe("Lemonade Tycoon");
    py(g, 'do_act("next", None)');
    step(g, 2);
    expect([room(g), py(g, "global_vars.s['day']")]).toEqual(["Morning", 30]);
    // A summer saved when summers ended on day 30, with the old Second stand: it carries on,
    // and keeps the faster pouring it paid for (the Helper now).
    const old = py<Record<string, unknown>>(g, "o = dict(global_vars.s, day=29, finished=True, phase='evening', upgrades=['second'])\no['plan'] = dict(o['plan'])\ndel o['plan']['second']\no");
    const h = await start({ summer: old });
    expect(py(h, "instances('Title')[0].cont.off")).toBe(false);
    py(h, 'do_act("continue", None)');
    step(h, 2);
    expect(room(h)).toBe("Evening");
    expect(py(h, "['finished' in global_vars.s, sorted(global_vars.s['upgrades']), global_vars.s['plan']['second']['open']]")).toEqual([false, ["helper", "second"], false]);
    py(h, 'do_act("next", None)');
    step(h, 2);
    expect([room(h), py(h, "global_vars.s['day']")]).toEqual(["Morning", 30]);
  }, 120_000);

  it("buy as much as you like: no most of nine packs, and holding + (or Right) keeps adding, ten at a time after a while", async () => {
    const g = await summer();
    py(g, "global_vars.s['plan']['buy']['ice'] = 0\nfor _ in range(25):\n    stepper_set('buy_ice', 1)");
    expect(py(g, "global_vars.s['plan']['buy']['ice']")).toBe(25);
    py(g, "global_vars.s['plan']['buy']['ice'] = 0\nglobal_vars.s['money'] = 100000");
    // The mouse held on the ice's +.
    const [x, y, w] = py<[number, number, number]>(g, "st = next(o for o in instances('Stepper') if o.key == 'buy_ice')\n[st.x, st.y, st.wide]");
    g.engine.input.mouseMove(x + w - 19, y + 23);
    step(g);
    g.engine.input.mouseDown(0);
    step(g, 150);
    g.engine.input.mouseUp(0);
    step(g);
    const held = py<number>(g, "global_vars.s['plan']['buy']['ice']");
    expect(held).toBeGreaterThan(40);
    // A number that isn't packs goes on one at a time.
    py(g, "global_vars.focus = next(o for o in instances('Stepper') if o.key == 'ice')\nglobal_vars.s['plan']['ice'] = 0");
    g.engine.input.keyDown(KEY_CODE.get("right")!);
    step(g, 150);
    g.engine.input.keyUp(KEY_CODE.get("right")!);
    step(g);
    expect(py(g, "global_vars.s['plan']['ice']")).toBe(py(g, "RECIPE_MAX"));
    // All of it bought: the shelf has it, and the morning says how many cups it makes.
    py(g, "global_vars.s['plan']['buy'] = {'lemons': 3, 'sugar': 2, 'ice': 30, 'cups': 4}\nglobal_vars.s['plan']['ice'] = 4");
    expect(py(g, "cups_from(global_vars.s, shelf_after_shopping(global_vars.s))")).toBe(72);     // 36 lemons: 9 pitchers
    // Whatever runs out first: here the ice (40 cubes, 4 a cup).
    expect(py(g, "cups_from(global_vars.s, {'lemons': 36, 'sugar': 40, 'ice': 40, 'cups': 100})")).toBe(10);
    py(g, 'do_act("open", None)');
    expect(py(g, "int(global_vars.s['ice'])")).toBe(1800);     // as it opens: the sun hasn't got to it yet
    step(g, 2);
    expect(room(g)).toBe("Street");
  });

  it("the second stand: a helper sells at another place, with what you send from your shelf; its money and what's left come back in the evening", async () => {
    const g = await summer(4);
    py(g, "s = global_vars.s\ns['money'] = 20000\nbuy_upgrade(s, 'second')\ns['plan']['second']['open'] = True");
    // Only the park so far: nowhere for it.
    expect(py(g, "second_places(global_vars.s)")).toEqual([]);
    expect(py<string>(g, "open_stand(global_vars.s)")).toMatch(/^Choose where your second stand goes/);
    py(g, "s = global_vars.s\ns['places'] = [0, 1]\ns['plan']['place'] = 1");
    expect(py(g, "second_places(global_vars.s)")).toEqual([0]);
    // From the morning, its own screen: where, its price, how many cups.
    step(g, 2);
    expect(py(g, "instances('Morning')[0].second.shown")).toBe(true);
    py(g, 'do_act("second", None)');
    step(g, 2);
    expect(room(g)).toBe("Second");
    expect(py(g, "global_vars.s['plan']['second']['place']")).toBe(0);
    py(g, "for _ in range(4):\n    stepper_set('s_cups', 1)\nstepper_set('s_price', 1)");
    expect(py(g, "[global_vars.s['plan']['second']['cups'], global_vars.s['plan']['second']['price']]")).toEqual([60, 105]);
    // Not enough on the shelf for 60 cups: it says what's short, and nothing changes.
    py(g, "s = global_vars.s\ns['plan']['buy'] = {'lemons': 1, 'sugar': 1, 'ice': 1, 'cups': 1}");
    expect(py<string>(g, "open_stand(global_vars.s)")).toMatch(/^Your second stand needs \d+ more lemons/);
    expect(py(g, "[global_vars.s['money'], global_vars.s['phase']]")).toEqual([15000, "morning"]);
    py(g, 'do_act("done_second", None)');
    step(g, 2);
    expect(room(g)).toBe("Morning");
    // Enough: it takes its share as the stand opens, and pays rent and the helper.
    py(g, "s = global_vars.s\ns['plan']['buy'] = {'lemons': 6, 'sugar': 4, 'ice': 12, 'cups': 6}");
    const shelf = py<Record<string, number>>(g, "shelf_after_shopping(global_vars.s)");
    const need = py<Record<string, number>>(g, "second_needs(global_vars.s)");
    const cost = py<number>(g, "shopping_cost(global_vars.s) + PLACES[1]['rent'] + PLACES[0]['rent'] + SECOND_WAGE");
    py(g, 'do_act("open", None)');
    expect(py(g, "s = global_vars.s\n{'lemons': lemon_count(s), 'sugar': s['sugar'], 'ice': int(s['ice']), 'cups': s['cups']}"))
      .toEqual({ lemons: shelf.lemons! - need.lemons!, sugar: shelf.sugar! - need.sugar!, ice: shelf.ice! - need.ice!, cups: shelf.cups! - need.cups! });
    expect(py(g, "global_vars.s['money']")).toBe(15000 - cost);
    step(g, 2);
    expect(room(g)).toBe("Street");
    playDay(g);
    const t = py<{ money_start: number; money_end: number; supplies: number; rent: number; income: number; profit: number;
      second: { cups: number; income: number; rent: number; wage: number; price: number; passers: number; sent: Record<string, number>; back: Record<string, number> } }>(g, "global_vars.s['history'][-1]");
    expect(t.second.passers).toBeGreaterThan(10);
    expect(t.second.cups).toBeGreaterThan(0);
    expect(t.second.income).toBe(t.second.cups * 105);
    expect(t.money_end).toBe(t.money_start - t.supplies - t.rent - t.second.rent - t.second.wage + t.income + t.second.income);
    expect(t.profit).toBe(t.income + t.second.income - t.supplies - t.rent - t.second.rent - t.second.wage);
    // What it didn't use came back: the cups it didn't sell, the lemons of pitchers it didn't make.
    expect(t.second.back.cups).toBe(60 - t.second.cups);
    expect(t.second.back.lemons).toBe(t.second.sent.lemons! - Math.ceil(t.second.cups / 8) * py<number>(g, "lemons_a_pitcher(global_vars.s)"));
    // Its day is the day's own random numbers: worked out twice from the same start, the same
    // (so a reload can't sell more).
    expect(py(g, `s = global_vars.s
def again():
    st = dict(s, money=0, lemons=[], sugar=0, ice=0.0, cups=0)
    tt = dict(s['history'][-1], second=dict(s['history'][-1]['second'], cups=0, income=0, passers=0, said={v: 0 for v in VERDICTS}))
    run_second(st, tt)
    return [tt['second']['cups'], tt['second']['said'], st['rep']]
again() == again()`)).toBe(true);
    // What it reports coming back is on the shelf (here an empty one).
    expect(py(g, `st = dict(s, money=0, lemons=[], sugar=0, ice=0.0, cups=0)
tt = dict(s['history'][-1], second=dict(s['history'][-1]['second'], cups=0, income=0, passers=0, said={v: 0 for v in VERDICTS}))
run_second(st, tt)
b = tt['second']['back']
[lemon_count(st), st['sugar'], int(st['ice']), st['cups']] == [b['lemons'], b['sugar'], b['ice'], b['cups']] and b['cups'] > 0`)).toBe(true);
  }, 120_000);


  // ---- 2026-11-19: what you buy shows at the stand; the kitchen; popcorn

  it("everything bought shows at the stand: on the ground beside it, on the counter, the helper behind it, the sign on top", async () => {
    const g = await summer();
    const drawn = () => {
      py(g, 'do_act("open", None)');
      step(g, 3);
      return py<string[]>(g, 'sorted(set(c["sprite"] for c in _draw_log if c["sprite"] in STAND_SPOTS or c["sprite"] in ("helper", "stand")))');
    };
    py(g, "_draw_log = []\n_real = draw_sprite\ndef draw_sprite(spr, frame, x, y):\n    _draw_log.append({'sprite': spr, 'x': x, 'y': y})\n    _real(spr, frame, x, y)");
    // The Stand's draw runs in the engine's draw event: count what it draws through a wrapper.
    py(g, "global_vars.s['money'] = 10**7");
    expect(drawn()).toEqual(["pitcher"]);
    py(g, 'do_act("next", None)' );
    for (const k of ["register", "cooler", "fridge", "sign", "juicer", "icemaker", "blender", "helper", "popcorn"]) py(g, `buy_upgrade(global_vars.s, "${k}")`);
    py(g, '_draw_log.clear()\nroom_goto("Morning")');
    step(g, 2);
    py(g, '_draw_log.clear()');
    expect(drawn()).toEqual(["blender", "cooler", "fridge", "helper", "icemaker", "juicer", "pitcher", "popcorn", "register", "sign"]);
    // Each in its own place: ground things on the ground, to the stand's right (clear of the queue).
    const at = py<Record<string, [number, number]>>(g, '{c["sprite"]: [c["x"] - STAND_X, instances("Day")[0].ground - c["y"]] for c in _draw_log}');
    const spot = (k: string): [number, number] => at[k] ?? [Number.NaN, Number.NaN];
    for (const k of ["cooler", "fridge", "icemaker", "popcorn"]) {
      expect(spot(k)[1]).toBe(0);
      expect(spot(k)[0]).toBeGreaterThan(60);
    }
    expect(spot("register")[1]).toBe(py(g, "COUNTER_Y"));
    expect(spot("sign")[1]).toBeGreaterThan(150);
  });

  it("the kitchen: a fridge keeps lemons 5 days, the ice maker makes a pack a night, a register serves a third quicker", async () => {
    const g = await summer();
    py(g, "s = global_vars.s\ns['money'] = 10**6\ns['lemons'] = [[0, 12]]\ns['day'] = 0");
    py(g, "for _ in range(3):\n    next_day(s)");
    expect(py(g, "lemon_count(s)")).toBe(0);
    py(g, "s['day'] = 0\ns['lemons'] = [[0, 12]]\nbuy_upgrade(s, 'fridge')\nfor _ in range(4):\n    next_day(s)");
    expect(py(g, "lemon_count(s)")).toBe(12);
    py(g, "next_day(s)");
    expect(py(g, "lemon_count(s)")).toBe(0);
    py(g, "s['ice'] = 0.0\nbuy_upgrade(s, 'icemaker')\nnext_day(s)");
    expect(py(g, "[int(s['ice']), s['news']['made_ice']]")).toEqual([60, 60]);
    const plain = py<number>(g, "serve_steps(s)");
    py(g, "buy_upgrade(s, 'register')");
    expect(py(g, "serve_steps(s)")).toBe(Math.round(plain * 2 / 3));
  });

  it("the blender: frozen lemonade pays more at 85°F or hotter, never tastes too warm; chosen with pink as the lemonade's style", async () => {
    const g = await summer();
    py(g, "s = global_vars.s\ns['money'] = 10**6\nwho = {'thirst': 0.6, 'budget': 200, 'fan': False, 'lemons': 4, 'sugar': 4, 'ice': 5}");
    py(g, "_temp = today(s)['temp']\ntoday(s)['temp'] = 95");
    expect(py<number>(g, "would_pay(s, who, False, True)")).toBeGreaterThan(py<number>(g, "would_pay(s, who, False, False)"));
    py(g, "today(s)['temp'] = 80");
    expect(py<number>(g, "would_pay(s, who, False, True)")).toBe(py<number>(g, "would_pay(s, who, False, False)"));
    py(g, "today(s)['temp'] = _temp");
    expect(py(g, "[verdict([4, 4, 1], who), verdict([4, 4, 1], who, False, True)]")).toEqual(["warm", "perfect"]);
    // The style stepper: plain only; with pink and a blender, all four, setting both.
    expect(py(g, "len(styles(s))")).toBe(1);
    py(g, "buy_upgrade(s, 'pink')\nbuy_upgrade(s, 'blender')");
    expect(py(g, "[stepper_set('style', 1), stepper_set('style', 1), stepper_set('style', 1), s['plan']['pink'], s['plan']['frozen']]"))
      .toEqual([1, 2, 3, true, true]);
    expect(py(g, "open_stand(s)['frozen']")).toBe(true);
  });

  it("popcorn: bought in the morning, popped in batches, sold at its own price; it goes stale overnight, kernels and bags keep", async () => {
    const g = await summer();
    py(g, "s = global_vars.s\ns['money'] = 10**6\nbuy_upgrade(s, 'popcorn')\ns['plan']['buy'] = {'kernels': 1, 'bags': 1}");
    const before = py<number>(g, "s['money']");
    py(g, "t = open_stand(s)");
    expect(py(g, "[s['kernels'], s['bags'], t['popcorn']]")).toEqual([30, 30, true]);
    expect(before - py<number>(g, "s['money']")).toBe(py(g, "t['supplies'] + t['rent']"));
    expect(py(g, "t['supplies']")).toBe(py(g, "sum(pop_prices(s).values())"));
    expect(py(g, "[sell_bag(s, t), sell_bag(s, t), s['kernels'], s['popped'], s['bags'], t['pop_bags'], t['pop_income']]"))
      .toEqual([true, false, 20, 8, 28, 2, 200]);
    py(g, "end_day(s, t)\nnext_day(s)");
    expect(py(g, "[s['popped'], s['kernels'], s['bags']]")).toEqual([0, 20, 28]);
    expect(py(g, "s['history'][-1]['profit']")).toBe(py<number>(g, "s['history'][-1]['income'] + 200 - s['history'][-1]['supplies'] - s['history'][-1]['rent']"));
    // Run out: no bags, or no kernels for a new batch.
    expect(py(g, "pop_why_not(dict(s, bags=0))")).toBe("No popcorn bags left!");
    expect(py(g, "pop_why_not(dict(s, kernels=0, popped=0))")).toBe("No popcorn kernels left!");
    expect(py(g, "pop_why_not(dict(s, kernels=0, popped=3)) is None")).toBe(true);
    // A batch is what kernels there are, if fewer than a whole one.
    expect(py(g, "s2 = dict(s, kernels=3, popped=0)\n[sell_bag(s2, t), s2['kernels'], s2['popped']]")).toEqual([true, 0, 2]);
  });

  it("popcorn's salt: buyers get thirsty, so more stop for lemonade; kids want it more; too dear, nobody", async () => {
    const g = await summer();
    py(g, "import random\ns = global_vars.s\ns['money'] = 10**6\nbuy_upgrade(s, 'popcorn')\nt = {'popcorn': True, 'pop_price': 100, 'pink': False, 'price': 100}");
    py(g, "who = {'thirst': 0.1, 'kind': 0}\nsalted(who)");
    expect(py<number>(g, "who['thirst']")).toBeCloseTo(0.4);
    const share = (kind: number, price = 100) =>
      py<number>(g, `rng = random.Random(5)\nt['pop_price'] = ${price}\nsum(wants_popcorn(s, {'kind': ${kind}, 'budget': 200}, t, rng) for _ in range(4000)) / 4000`);
    const adult = share(0), kid = share(3);
    expect(kid).toBeGreaterThan(adult + 0.08);
    expect(share(3, 300)).toBe(0);
    expect(py(g, "t['popcorn'] = False\nwants_popcorn(s, {'kind': 3, 'budget': 200}, t)")).toBe(false);
  });

  it("a day selling popcorn too: popcorn and lemonade both sold, and the salt makes the same passers-by buy more lemonade", async () => {
    const g = await summer();
    py(g, BOT);
    // The day's own random numbers fixed: who walks by (and so how much sells) changed run to run.
    py(g, "s = global_vars.s\ns['money'] = 10**6\nbuy_upgrade(s, 'popcorn')\nbot_morning()\ns['plan']['buy'].update({'kernels': 4, 'bags': 4})\nimport random\nrandom.seed(11)");
    openAndPlay(g);
    const t = py<{ cups: number; pop_bags: number }>(g, "global_vars.s['history'][-1]");
    expect(t.cups).toBeGreaterThan(5);
    expect(t.pop_bags).toBeGreaterThan(0);
    // The same 3000 people, deciding with the same random numbers, with popcorn's salt and without.
    const buyers = (salt: boolean) => py<number>(g, `import random
people = [new_customer(s, today(s), random.Random(i)) for i in range(3000)]
t2 = {"pink": False, "price": 120}
n = 0
for i, who in enumerate(people):
    if ${salt ? "True" : "False"}:
        salted(who)
    n += decide(s, who, t2, 0, None, random.Random(10**6 + i)) == "buy"
n`);
    expect(buyers(true)).toBeGreaterThan(buyers(false) * 1.15);
  });

  it("the shop: every upgrade and place fits on the evening, and the popcorn screen opens from the morning", async () => {
    const g = await summer();
    py(g, 'global_vars.s["money"] = 10**6\nbuy_upgrade(global_vars.s, "popcorn")\ndo_act("open", None)');
    step(g, 2);
    playDay(g);
    const boxes = py<number[][]>(g, '[[b.x, b.y, b.x + b.wide, b.y + b.high] for b in instances("Button") if b.act in ("upgrade", "unlock")]');
    expect(boxes.length).toBe(py<number>(g, "len(UPGRADES) + 3"));
    for (const [x1, , x2, y2] of boxes) {
      expect(x1).toBeGreaterThanOrEqual(688);
      expect(x2).toBeLessThanOrEqual(1010);
      expect(y2).toBeLessThanOrEqual(450);
    }
    py(g, 'do_act("next", None)');
    step(g, 2);
    py(g, 'press(next(b for b in instances("Button") if b.act == "popcorn"))');
    step(g, 2);
    expect(room(g)).toBe("Popcorn");
    py(g, 'stepper_set("buy_kernels", 1)\nstepper_set("pop_price", 1)');
    expect(py(g, '[global_vars.s["plan"]["buy"]["kernels"], global_vars.s["plan"]["pop_price"]]')).toEqual([1, 105]);
  });
});
