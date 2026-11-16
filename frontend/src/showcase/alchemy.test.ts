/**
 * The combining showcase game, Mix Lab, played headless in the real Pyodide: the
 * list of things (everything can be made from the four you start with, no pair
 * makes two things), mixing by dragging and by tapping, hints, how a thing was made,
 * every achievement earned by a bot that finds all 144 things through the game's own
 * taps, saving, the board, questions never mid-drag, and mixing from the keyboard alone.
 * Runs when the game has been built (python3 showcase/alchemy/build.py).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/alchemy/out/project.json");
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

/** Into the lab. */
async function lab(g: PythonGame) {
  py(g, 'room_goto("Lab")');
  step(g, 2);
  expect(room(g)).toBe("Lab");
}
const pieceKeys = (g: PythonGame) => py<string[]>(g, "sorted(o.key for o in pieces())");
const centreOf = (g: PythonGame, what: string, key: string) =>
  py<[number, number]>(g, `[[o.x + o.wide / 2, o.y + o.high / 2] for o in instances("Spot") if o.what == "${what}" and o.key == "${key}"][0]`);
const foundKeys = (g: PythonGame) => py<string[]>(g, 'progress()["found"]');

describe.runIf(have)("Mix Lab", () => {
  it("everything can be made from the four you start with, and no pair makes two things", async () => {
    const g = await start();
    expect(py(g, "len(THINGS)")).toBe(144);
    const bad = py<string[]>(g, `
pairs, out = set(), []
for a, b, c in RECIPES:
    for k in (a, b, c):
        if k not in THINGS:
            out.append(f"unknown {k}")
    pair = tuple(sorted((a, b)))
    if pair in pairs:
        out.append(f"{a} + {b} twice")
    pairs.add(pair)
have = set(START)
grew = True
while grew:
    grew = False
    for a, b, c in RECIPES:
        if a in have and b in have and c not in have:
            have.add(c)
            grew = True
out += [f"can't make {k}" for k in THINGS if k not in have]
out += [f"world: {k}" for k in WORLD if k not in THINGS]
out += [f"group: {k}" for k in THINGS if THINGS[k][1] not in [g for g, _, _ in GROUPS]]
out`);
    expect(bad).toEqual([]);
  });

  it("two things make what the recipe says, either way round; once new, then not; a wrong pair is counted", async () => {
    const g = await start();
    expect(py(g, 'p = progress()\nlist(try_mix(p, "water", "fire"))')).toEqual(["steam", true]);
    expect(py(g, 'list(try_mix(p, "fire", "water"))')).toEqual(["steam", false]);
    expect(py(g, 'list(try_mix(p, "water", "steam"))')).toEqual([undefined, false]);
    expect(py(g, 'p["fails"]')).toBe(1);
    expect(py(g, 'p["how"]["steam"]')).toEqual(["water", "fire"]);
    step(g);                          // the board hears with the step's commands
    expect(g.scores).toEqual([5]);
    expect((g.saved().progress as { found: string[] }).found).toEqual(["water", "fire", "earth", "air", "steam"]);
  });

  it("dragging: a card onto the bench, a piece onto another mixes them, onto the panel puts it away", async () => {
    const g = await start();
    await lab(g);
    expect(pieceKeys(g)).toEqual(["air", "earth", "fire", "water"]);
    const [fx, fy] = centreOf(g, "piece", "fire");
    const [wx, wy] = centreOf(g, "piece", "water");
    drag(g, fx, fy, [[fx + 30, fy + 20], [wx + 4, wy + 3]]);
    expect(pieceKeys(g)).toEqual(["air", "earth", "steam"]);
    expect(foundKeys(g)).toContain("steam");
    expect(py(g, "global_vars.news[0]")).toBe("steam");
    // Steam is where the water was.
    const [sx, sy] = centreOf(g, "piece", "steam");
    expect(Math.abs(sx - wx) + Math.abs(sy - wy)).toBeLessThan(2);
    // A card dragged onto a piece: a copy goes there and they mix.
    const [cx, cy] = centreOf(g, "card", "earth");
    const [ax, ay] = centreOf(g, "piece", "air");
    drag(g, cx, cy, [[cx - 100, cy], [ax, ay]]);
    expect(pieceKeys(g)).toEqual(["dust", "earth", "steam"]);
    // A pair that makes nothing: both stay, and the one moved is pushed off the other.
    const [ex, ey] = centreOf(g, "piece", "earth");
    const [dx, dy] = centreOf(g, "piece", "dust");
    drag(g, ex, ey, [[ex + 20, ey], [dx, dy]]);
    expect(pieceKeys(g)).toEqual(["dust", "earth", "steam"]);
    expect(py(g, 'progress()["fails"]')).toBe(1);
    expect(py(g, "piece_on([o for o in pieces() if o.key == 'earth'][0]) is None")).toBe(true);
    // Dragged back to the collection: gone.
    const [px, py2] = centreOf(g, "piece", "dust");
    drag(g, px, py2, [[px + 200, py2], [800, 300]]);
    expect(pieceKeys(g)).toEqual(["earth", "steam"]);
    // A card let go off the bench (over the world): nothing.
    const [cx2, cy2] = centreOf(g, "card", "fire");
    drag(g, cx2, cy2, [[cx2 - 300, 100]]);
    expect(pieceKeys(g)).toEqual(["earth", "steam"]);
    py(g, 'do_act("clear", None)');
    expect(pieceKeys(g)).toEqual([]);
  });

  it("tapping: a card, then another card mixes their copies; a piece, then another; the same one twice unpicks", async () => {
    const g = await start();
    await lab(g);
    py(g, 'do_act("clear", None)');
    click(g, ...centreOf(g, "card", "water"));
    expect(pieceKeys(g)).toEqual(["water"]);
    expect(py(g, "picked().key")).toBe("water");
    click(g, ...centreOf(g, "card", "earth"));
    expect(pieceKeys(g)).toEqual(["mud"]);
    expect(py(g, "picked() is None")).toBe(true);
    click(g, ...centreOf(g, "card", "fire"));
    click(g, ...centreOf(g, "piece", "fire"));            // the same one again: unpicked
    expect(py(g, "picked() is None")).toBe(true);
    click(g, ...centreOf(g, "piece", "mud"));
    click(g, ...centreOf(g, "piece", "fire"));
    expect(pieceKeys(g)).toEqual(["brick"]);
  });

  it("a hint names something you can make now and one of its ingredients, then charges up again", async () => {
    const g = await start();
    await lab(g);
    py(g, 'do_act("hint", None)');
    const [a, c] = py<[string, string]>(g, "list(global_vars.hinted)");
    expect(py(g, `mix_of("${a}", [b for b in progress()["found"] if mix_of("${a}", b) == "${c}"][0])`)).toBe(c);
    expect(py(g, `"${c}" in progress()["found"]`)).toBe(false);
    expect(py(g, 'progress()["hints"]')).toBe(1);
    py(g, 'do_act("hint", None)');
    expect(py(g, 'progress()["hints"]')).toBe(1);        // not ready yet
    step(g, py<number>(g, "HINT_STEPS") + 1);
    py(g, 'do_act("hint", None)');
    expect(py(g, 'progress()["hints"]')).toBe(2);
    // A hint resets the run of finds without one.
    expect(py(g, 'progress()["streak"]')).toBe(0);
    // Further on, where the first recipe not yet made needs something not yet found
    // (Wood needs a Tool, and the Tool's recipe comes later in the list), the hint is
    // still something both of whose ingredients are found.
    const later = py<[string, string]>(g, `p = progress()
p["found"] = [k for k in THINGS if k not in ("tool", "wood")]
list(hint(p))`);
    expect(later).toEqual(["metal", "tool"]);
  });

  it("how you made a thing lists every mix in an order you could do them", async () => {
    const g = await start();
    await lab(g);
    py(g, `p = progress()
for a, b in [("water", "fire"), ("steam", "air"), ("cloud", "wind")]:
    pass
for a, b in [("air", "air"), ("water", "fire"), ("steam", "air"), ("cloud", "wind"), ("fire", "air"), ("storm", "energy")]:
    try_mix(p, a, b)`);
    const steps = py<[string, string, string][]>(g, 'steps_to(progress(), "lightning")');
    expect(steps.at(-1)).toEqual(["storm", "energy", "lightning"]);
    const have = new Set(["water", "fire", "earth", "air"]);
    for (const [a, b, c] of steps) {
      expect(have.has(a) && have.has(b)).toBe(true);
      have.add(c);
    }
    expect(steps.length).toBe(6);
    py(g, 'do_act("how", None)');
    py(g, 'do_act("group", "weather")');
    click(g, ...centreOf(g, "card", "lightning"));
    expect(py(g, "global_vars.how")).toBe("lightning");
    expect(pieceKeys(g)).toEqual(["air", "earth", "fire", "water"]);   // looking, not mixing
    step(g, 5);
    click(g, 300, 300);
    expect(py(g, "global_vars.how is None")).toBe(true);
  });

  it("a bot finds all 144 through the game's own taps and earns every award; the save and the board keep up", async () => {
    const g = await start();
    await lab(g);
    // 25 tries that make nothing first (the Mad Scientist), by the same taps.
    py(g, `for i in range(25):
    do_act("clear", None)
    tap([o for o in instances("Spot") if o.what == "card" and o.key == "fire"][0])
    tap([o for o in instances("Spot") if o.what == "card" and o.key == "fire"][0])
`);
    // Then every recipe whose two things it has, until there's nothing left.
    const rounds = py<number>(g, `
def card(k):
    if global_vars.group != group_of(k):
        do_act("group", group_of(k))
    return [o for o in instances("Spot") if o.what == "card" and o.key == k][0]
rounds = 0
while True:
    rounds += 1
    todo = [(a, b) for a, b, c in RECIPES if c not in progress()["found"] and found(progress(), a) and found(progress(), b)]
    if not todo or rounds > 200:
        break
    for a, b in todo:
        do_act("clear", None)
        tap(card(a))
        tap(card(b))
rounds`);
    expect(rounds).toBeLessThan(200);
    expect(py(g, 'len(progress()["found"])')).toBe(144);
    expect(py(g, 'progress()["fails"]')).toBeGreaterThanOrEqual(25);
    expect(py<string[]>(g, 'sorted(progress()["awards"])')).toEqual(py<string[]>(g, "sorted(a[0] for a in ACHIEVEMENTS)"));
    // The world, the awards and the title draw with everything found.
    step(g, 200);
    expect(g.scores.at(-1)).toBe(144);
    const saved = g.saved().progress as { found: string[]; awards: string[] };
    expect(saved.found.length).toBe(144);
    py(g, 'do_act("awards", None)');
    step(g, 10);
    py(g, 'do_act("title", None)');
    step(g, 10);
    // Played again with that save: all still there.
    const again = await start({ progress: saved });
    expect(py(again, 'len(progress()["found"])')).toBe(144);
  }, 120_000);

  it("questions may come any time except while something is being dragged", async () => {
    const g = await start();
    // Only a change is sent, and a game starts ready: nothing sent yet means ready.
    expect(g.questionOk.at(-1) ?? true).toBe(true);
    await lab(g);
    expect(g.questionOk.at(-1) ?? true).toBe(true);
    const [fx, fy] = centreOf(g, "piece", "fire");
    g.engine.input.mouseMove(fx, fy);
    step(g);
    g.engine.input.mouseDown(0);
    step(g);
    g.engine.input.mouseMove(fx + 40, fy + 30);
    step(g, 2);
    expect(g.questionOk.at(-1)).toBe(false);
    g.engine.input.mouseUp(0);
    step(g, 2);
    expect(g.questionOk.at(-1)).toBe(true);
  });

  it("mixing from the keyboard alone", async () => {
    const g = await start();
    expect(room(g)).toBe("Title");
    press(g, "space");
    step(g, 2);
    expect(room(g)).toBe("Lab");
    // The keys start on the bench's first piece, water; Space picks it, right moves to fire, Space mixes.
    press(g, "space");
    expect(py(g, "picked().key")).toBe("water");
    press(g, "right");
    press(g, "space");
    expect(foundKeys(g)).toContain("steam");
    expect(pieceKeys(g)).toContain("steam");
  });
});
