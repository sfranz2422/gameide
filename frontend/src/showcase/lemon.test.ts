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
    cups = math.ceil(crowd_size(s, guess) * 0.45)
    pitchers = math.ceil(cups / CUPS_PER_PITCHER)
    need = {"lemons": pitchers * lemons_a_pitcher(s) - lemon_count(s), "sugar": pitchers * plan["sugar"] - s["sugar"],
            "ice": cups * plan["ice"] - int(s["ice"]) + 10, "cups": cups - s["cups"]}
    packs = dict((k, p) for k, _, p, _, _, _ in SUPPLIES)
    plan["buy"] = {k: max(0, min(MAX_PACKS, math.ceil(need[k] / packs[k]))) for k in SUPPLY_KEYS}
    while shopping_cost(s) + place_now(s)["rent"] > s["money"]:
        k = max(SUPPLY_KEYS, key=lambda k: plan["buy"][k])
        if plan["buy"][k] == 0:
            plan["place"] = 0
            break
        plan["buy"][k] -= 1

def bot_evening():
    s = global_vars.s
    for kind, what in (("upgrade", "cooler"), ("upgrade", "sign"), ("unlock", 1), ("upgrade", "juicer"), ("upgrade", "pink"),
                       ("unlock", 2), ("upgrade", "second"), ("unlock", 3)):
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
/** Plays the whole summer with the bot (or the silly one); the money each evening. */
function wholeSummer(g: PythonGame, silly = false) {
  py(g, BOT);
  const money: number[] = [];
  for (let d = 0; d < 30; d++) {
    py(g, silly ? "silly_morning()" : "bot_morning()");
    openAndPlay(g);
    money.push(py<number>(g, "global_vars.s['money']"));
    if (d === 29) break;
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

  it("a whole summer, played sensibly, makes money; priced at $3 with no sugar, it loses", async () => {
    const g = await summer(11);
    const money = wholeSummer(g);
    // From $20 to well over $300, with upgrades bought along the way.
    expect(money.at(-1)!).toBeGreaterThan(30_000);
    expect(py<string[]>(g, "global_vars.s['upgrades']").length).toBeGreaterThanOrEqual(3);
    expect(py(g, "global_vars.s['finished']")).toBe(true);
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
    expect(py(g, "[lemon_count(global_vars.s), int(global_vars.s['ice']), global_vars.s['news']]")).toEqual([12, 0, { melted: 100, soft: 0 }]);
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
    // A second stand: a longer queue is fine.
    py(g, "global_vars.s['upgrades'].append('second')");
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

  it("upgrades: paid for once; the juicer saves lemons, the sign brings more, the second stand pours faster, pink fans pay more", async () => {
    const g = await summer();
    py(g, "global_vars.s['money'] = 20000");
    expect(py(g, "[buy_upgrade(global_vars.s, 'juicer'), buy_upgrade(global_vars.s, 'juicer'), global_vars.s['money']]")).toEqual([true, false, 17500]);
    expect(py(g, "global_vars.s['plan']['lemons'] = 4\nlemons_a_pitcher(global_vars.s)")).toBe(3);
    const crowd = py<number>(g, "crowd_size(global_vars.s)");
    py(g, "buy_upgrade(global_vars.s, 'sign')");
    expect(py<number>(g, "crowd_size(global_vars.s)")).toBeGreaterThan(crowd);
    expect(py(g, "serve_steps(global_vars.s)")).toBe(py(g, "SERVE_STEPS"));
    py(g, "buy_upgrade(global_vars.s, 'second')");
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

  it("the summer's events: a heat wave, a rainy spell, a parade downtown, and rival days", async () => {
    const g = await summer();
    for (const seed of [1, 2, 3, 4, 5]) {
      const [n, heat, hotter, rainy, allRain, parades, earlyRival] = py<[number, number, boolean, number, boolean, number, boolean]>(g, `p = summer_plan(${seed})
avg = sum(d["temp"] for d in p) / len(p)
[len(p), sum(d["heat"] for d in p), all(d["temp"] > avg for d in p if d["heat"]),
 sum(d["rainy_week"] for d in p), all(d["sky"] == "rain" for d in p if d["rainy_week"]),
 sum(d["parade"] for d in p), any(d["rival"] is not None for d in p[:3])]`);
      expect([n, heat, hotter, rainy, allRain, parades, earlyRival]).toEqual([30, 3, true, 4, true, 1, false]);
    }
    // The same seed, the same summer: a reload can't bring better weather.
    expect(py(g, "summer_plan(9) == summer_plan(9)")).toBe(true);
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

  it("the end of the summer: the money and a name for it, on the board in dollars, and no Continue", async () => {
    const g = await summer(3);
    py(g, "s = global_vars.s\ns['day'] = DAYS - 1\ns['money'] = 41234");
    py(g, 'global_vars.s["plan"]["buy"] = {"lemons": 0, "sugar": 0, "ice": 0, "cups": 0}');
    openAndPlay(g);
    expect(py(g, "global_vars.s['finished']")).toBe(true);
    expect(g.scores).toEqual([412]);
    expect(py(g, "rank_of(41234)")).toBe("Lemonade Tycoon");
    const h = await start(g.saved());
    expect(py(h, "instances('Title')[0].cont.off")).toBe(true);
  }, 120_000);
});
