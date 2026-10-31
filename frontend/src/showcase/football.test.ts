/**
 * The fourth showcase game, Under the Lights, played headless in the real
 * Pyodide: whole games of the computer against itself, a bot playing a whole
 * game and a whole season through the keyboard, the rules of downs,
 * kickoffs, the try and scoring, every play in the playbook doing what its
 * chalkboard says, the ball carrier's moves, diving catches, the replay, the
 * computer's coaching, and each thing that once went wrong in a play (a
 * runner leaving his route, passes thrown where a receiver would have been
 * if he'd run straight, pursuers blocked from behind). Runs when the game
 * has been built (python3 showcase/football/build.py, which draws stand-ins
 * for any picture the teacher hasn't made yet).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/football/out/project.json");
const GAME_DIR = resolve(__dirname, "../../../showcase/football/game");
const have = existsSync(BUILT);

async function start(seed = 1, save?: Record<string, unknown>, onSave?: (d: Record<string, unknown>) => void) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  if (save) def.save = save;
  const { game, error } = await PythonGame.load(def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined, save: onSave,
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  py(game, `random.seed(${seed})\ng = instances('Game')[0]`);
  return game;
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}

const py = (g: PythonGame, code: string) => g.evalPython(code) as never;

function press(g: PythonGame, key: string) {
  g.engine.input.keyDown(KEY_CODE.get(key)!);
  step(g, 1);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
  step(g, 1);
}

/** A play lined up at the home team's own `yards` and snapped; `home` is who plays the home team (None: the computer). */
function setUp(g: PythonGame, call: string, dcall = "Cover", yards = 50, home = "None") {
  py(g, `new_match({'home': ${home}, 'away': None})
MATCH['los'] = at_yards('home', 100 - ${yards}); MATCH['ball_y'] = MID; set_first_down()
line_up('home', 'away', [p['name'] for p in OFFENSE].index(${JSON.stringify(call)}),
        [p['name'] for p in DEFENSE].index(${JSON.stringify(dcall)}), MATCH['los'], MID)
snap()`);
}

/** A kickoff lined up: `kicker` kicks to the other team; `home` is who plays the home team. */
function kickoff(g: PythonGame, kicker = "away", home = "None", onside = false) {
  py(g, `new_match({'home': ${home}, 'away': None})
set_kickoff(${JSON.stringify(kicker)})
line_up(MATCH['off'], MATCH['kickoff'], None, None, MATCH['los'], MATCH['ball_y'], play=KICKOFF)
snap(onside=${onside ? "True" : "False"})`);
}

/** Runs live_step until the play ends (or `max` steps). */
function playOut(g: PythonGame, max = 600) {
  for (let t = 0; t < max && py(g, "PLAY['result'] is None"); t++) py(g, "live_step()");
}

/** The rules alone: a play ended `how` at (yards from the home team's own goal line, across). */
function finish(g: PythonGame, how: string, ownYards: number, y = 184, extra = "") {
  return py(g, `finish({'how': ${JSON.stringify(how)}, 'x': at_yards('home', 100 - ${ownYards}), 'y': ${y}, 'who': None, 'team': 'home'${extra}})`) as string;
}

type State = {
  off: string; down: number; own: number; togo: number; score: { home: number; away: number }; words: string;
  kickoff: string | null; try: string | null;
};
const state = (g: PythonGame): State => {
  const s = py(g, "{'off': MATCH['off'], 'down': MATCH['down'], 'own': round(100 - to_goal(MATCH['off'], MATCH['los'])), 'togo': to_go(), 'score': dict(MATCH['score']), 'words': down_words(), 'kickoff': MATCH['kickoff'], 'try': MATCH['try']}") as State;
  return { ...s, kickoff: s.kickoff ?? null, try: s.try ?? null }; // Python's None arrives as undefined
};

/** random.random() answers these, in turn, then the real thing again. */
function rigRandom(g: PythonGame, values: number[]) {
  py(g, `import random as _random_mod
REAL_RANDOM = getattr(_random_mod, '_real', _random_mod.random)
_random_mod._real = REAL_RANDOM
_rig = ${JSON.stringify(values)}
_random_mod.random = lambda: _rig.pop(0) if _rig else REAL_RANDOM()`);
}

// ---------------------------------------------------------------- the bot
// It plays the home team through the keyboard: it reads the game (as a
// player reads the screen) and holds and taps keys. Written in Python so it
// can look at the game the way the game's own code does.
const BOT = `
_BOT = {"mode": None, "queue": [], "last_tap": -9, "rng": random.Random(11), "two": 0}

def _bot_keys():
    """(keys to hold, key to tap) for this step."""
    b = _BOT
    mode, waited = g.mode, g.t - g.since
    hold, tap = [], None
    if mode != b["mode"]:
        b["mode"], b["queue"] = mode, []
        if mode == "call" and MATCH["humans"].get("home") is not None:
            n = len(plays_for("home")) if MATCH["off"] == "home" else len(DEFENSE)
            b["queue"] = ["down"] * b["rng"].randrange(n) + ["z"]
        if mode == "try" and MATCH["try"] == "home":
            b["queue"] = (["down"] if b["rng"].random() < 0.4 else []) + ["z"]
    if b["queue"]:
        if waited > 12 and g.t - b["last_tap"] >= 3:
            tap = b["queue"].pop(0)
        return hold, tap
    if mode == "toss" and waited % 20 == 19:
        tap = "z"
    elif mode == "set" and waited > 32:
        kick = PLAY["play"]["kind"] == "kickoff"
        if kick and PLAY["deff"] == "home":
            tap = "x" if b["rng"].random() < 0.2 else "z"
        elif not kick and PLAY["off"] == "home":
            tap = "z"
    elif mode == "live":
        hold, tap = _bot_live()
    elif mode in ("whistle", "replay") and waited > 45:
        tap = "z"
    return hold, tap

def _toward(x0, y0, x1, y1):
    keys = []
    if x1 > x0 + 4: keys.append("right")
    if x1 < x0 - 4: keys.append("left")
    if y1 > y0 + 4: keys.append("down")
    if y1 < y0 - 4: keys.append("up")
    return keys

def _bot_live():
    hold, tap = [], None
    car, play, k = PLAY["carrier"], PLAY["play"], PLAY["kick"]
    d = fwd("home")
    if PLAY["off"] == "home":
        if k is not None and k["good"] is None:
            if PLAY["t"] > 10 and abs(k["phase"]) < k["allowed"] * 0.6:
                tap = "z"
        elif holding_to_throw():
            rs = receivers()[:3]
            best = max(range(3), key=lambda i: openness(rs[i]) + 0.1 * (rs[i].x - PLAY["los"]) * d)
            if PLAY["t"] >= 30 and (openness(rs[best]) >= 20 or PLAY["t"] >= 70):
                tap = "zxc"[best]
                _BOT["threw"] = _BOT.get("threw", 0) + 1
        elif PLAY["ball"] == "air" and not PLAY.get("toss"):
            f, r = PLAY["flight"], PLAY["target"]
            if f["steps"] - f["t"] == 8 and point_distance(r.x, r.y, f["x1"], f["y1"]) > 16:
                tap = "z"
        elif car is not None and car.human == 0:
            foes = [p for p in team_of("away") if p.down_t == 0 and p.held_by is None]
            near = min(foes, key=lambda p: dist(p, car)) if foes else None
            if play.get("pitch") and car.role == play["carrier"] and not PLAY["second_done"]:
                if near is not None and dist(near, car) < 26:
                    tap = "z"
            elif near is not None and dist(near, car) < 18 and (near.x - car.x) * d > -4:
                left = [m for m in MOVES if m not in PLAY["moves"]]
                if left:
                    tap = "zxc"[MOVES[_BOT["rng"].choice(left)]["button"]]
            hold = ["right" if d > 0 else "left"]
            if near is not None and dist(near, car) < 40 and (near.x - car.x) * d > 0:
                hold.append("up" if near.y > car.y else "down")
        elif car is None and play["kind"] == "kickoff" and PLAY["target"].human == 0 and PLAY["flight"]:
            f, r = PLAY["flight"], PLAY["target"]
            hold = _toward(r.x, r.y, f["x1"], f["y1"])
    else:
        mine = next((p for p in team_of("home") if p.human == 0), None)
        aim = car or PLAY["target"] or BALL[0]
        if mine is not None and aim is not None:
            hold = _toward(mine.x, mine.y, aim.x, aim.y)
            if car is not None and dist(mine, car) < 20 and mine.dive_t == 0:
                tap = "z"
            elif dist(mine, aim) > 140 and PLAY["t"] % 50 == 0:
                tap = "x"
    return hold, tap
`;

/** One step of the bot: holds and taps its keys, then steps the game. */
function botStep(g: PythonGame, held: Set<string>) {
  const [hold, tap] = py(g, "_bot_keys()") as [string[], string | null];
  const want = new Set(hold);
  for (const k of held) if (!want.has(k)) { g.engine.input.keyUp(KEY_CODE.get(k)!); held.delete(k); }
  for (const k of want) if (!held.has(k)) { g.engine.input.keyDown(KEY_CODE.get(k)!); held.add(k); }
  if (tap) {
    g.engine.input.keyUp(KEY_CODE.get(tap)!);
    g.engine.input.keyDown(KEY_CODE.get(tap)!);
    py(g, "_BOT['last_tap'] = g.t");
  }
  step(g, 1);
  if (tap && !want.has(tap)) g.engine.input.keyUp(KEY_CODE.get(tap)!);
}

type PlaySeen = { off: string; how: string; kind: string; moves: string[]; called: string[]; thrown: boolean; name: string };

/** What the play just over was, read at its whistle. */
const seen = (g: PythonGame) =>
  py(g, "{'off': PLAY['off'], 'how': PLAY['result']['how'], 'kind': PLAY['play']['kind'], 'moves': PLAY['moves'], 'called': PLAY['called'], 'thrown': PLAY['thrown'], 'name': PLAY['play']['name']}") as PlaySeen;

/** The bot plays from the current mode until the final score (or `max` steps); the plays it saw. */
function botPlays(g: PythonGame, max: number) {
  const held = new Set<string>();
  const plays: PlaySeen[] = [];
  let was = "";
  for (let i = 0; i < max && py(g, "g.mode") !== "final"; i++) {
    botStep(g, held);
    const mode = py(g, "g.mode") as string;
    if (mode === "whistle" && was !== "whistle") plays.push(seen(g));
    was = mode;
  }
  for (const k of held) g.engine.input.keyUp(KEY_CODE.get(k)!);
  return plays;
}

describe.skipIf(!have)("Under the Lights", () => {
  let g: PythonGame;
  beforeAll(async () => {
    g = await start();
  });

  it("plays whole games, the computer against itself, to a final score", async () => {
    let points = 0;
    const names = new Set<string>();
    const calls = new Set<string>();
    const kinds = new Set<string>();
    for (const seed of [1, 2]) {
      const game = await start(seed);
      py(game, "begin_match(g, {'home': None, 'away': None})\nMATCH['demo'] = True");
      const outcomes = new Set<string>();
      const teams = new Set<string>();
      let plays = 0;
      let was = "";
      let replays = 0;
      for (let i = 0; i < 60 * 60 * 20 && py(game, "g.mode") !== "final"; i++) {
        step(game, 1);
        const mode = py(game, "g.mode") as string;
        if (mode === "whistle" && was !== "whistle") {
          plays++;
          const p = seen(game);
          outcomes.add(p.how);
          teams.add(p.off);
          names.add(p.name);
          kinds.add(p.kind);
          p.called.forEach((c) => calls.add(c));
        }
        if (mode === "replay" && was !== "replay") replays++;
        was = mode;
      }
      expect(py(game, "g.mode")).toBe("final");
      expect(py(game, "MATCH['quarter']")).toBe(4);
      step(game, 120); // the final screen draws
      expect(plays).toBeGreaterThan(30);
      expect(plays).toBeLessThan(110);
      expect(teams.size).toBe(2);
      expect(outcomes.size).toBeGreaterThanOrEqual(3);
      const s = state(game).score;
      points += s.home + s.away;
      if (outcomes.has("touchdown")) expect(replays).toBeGreaterThan(0);
    }
    expect(points).toBeGreaterThan(0);
    expect(kinds).toContain("kickoff"); // a coin toss, then real kickoffs
    expect(names.size).toBeGreaterThanOrEqual(7); // the coaches call more than a few plays
    expect(calls.size).toBeGreaterThanOrEqual(2); // and the announcer has things to say
  }, 300_000);

  it("a bot plays a whole game from the keyboard, as 1 Player", async () => {
    const game = await start(5);
    py(game, BOT);
    py(game, "go_title(g)");
    step(game, 2);
    press(game, "z"); // 1 Player
    expect(py(game, "g.mode")).toBe("toss");
    // Every sentence on screen fits it.
    py(game, `_too_wide = []
_db, _dh = draw_banner, draw_hint
def draw_banner(y, text, color="#ffffff", big=True):
    if words_width(text, big) > VIEW_W: _too_wide.append(text)
    _db(y, text, color, big)
def draw_hint(text):
    if words_width(text) > VIEW_W: _too_wide.append(text)
    _dh(text)`);
    const plays = botPlays(game, 60 * 60 * 25);
    expect(py(game, "g.mode")).toBe("final");
    const ours = plays.filter((p) => p.off === "home" && p.kind !== "kickoff");
    expect(ours.length).toBeGreaterThan(10);
    expect(plays.some((p) => p.off === "away" && p.kind !== "kickoff")).toBe(true); // it defended too
    expect(ours.some((p) => p.thrown)).toBe(true); // it threw
    expect(ours.some((p) => p.moves.length > 0)).toBe(true); // it juked, spun or stiff-armed
    expect(plays.filter((p) => p.kind === "kickoff").length).toBeGreaterThanOrEqual(2);
    expect(py(game, "_too_wide")).toEqual([]);
    const s = state(game).score;
    expect(s.home + s.away).toBeGreaterThan(0);
  }, 300_000);

  it("a bot plays a season: every team plays every other, the standings add up, a championship, and it's saved", async () => {
    let saved: Record<string, unknown> | undefined;
    const game = await start(9, undefined, (d) => { saved = d; });
    py(game, BOT + "\nglobals()['QUARTER_SECONDS'] = 30");
    py(game, "go_title(g)");
    step(game, 2);
    press(game, "down");
    press(game, "down");
    press(game, "z"); // Season
    expect(py(game, "g.mode")).toBe("pick");
    step(game, 12);
    press(game, "down");
    press(game, "down");
    press(game, "z"); // the Gators
    expect(py(game, "(g.mode, SEASON['team'], SEASON['week'])")).toEqual(["season", "gators", 0]);
    expect(saved?.season).toBeTruthy(); // saved the moment it starts
    let games = 0;
    for (let week = 0; week < 7 && py(game, "opponent() is not None"); week++) {
      step(game, 12);
      const foe = py(game, "opponent()") as string;
      press(game, "z"); // Play week …
      expect(py(game, "(g.mode, TEAMS['home']['id'], TEAMS['away']['id'])")).toEqual(["toss", "gators", foe]);
      botPlays(game, 60 * 60 * 15);
      expect(py(game, "g.mode")).toBe("final");
      games++;
      // Our game goes in as it was played: our score first, theirs second.
      const score = py(game, "[MATCH['score']['home'], MATCH['score']['away']]") as number[];
      expect(py(game, `[g[1:] for g in SEASON['games'] if g[1] == 'gators' and g[2] == ${JSON.stringify(foe)}]`)).toEqual([["gators", foe, ...score]]);
      step(game, 95);
      press(game, "z");
      expect(py(game, "g.mode")).toBe("season");
      if (week === 0) {
        // Saved after every game: a new visit picks it up where it was.
        const again = await start(10, saved);
        py(again, "go_title(g)");
        step(again, 2);
        press(again, "down");
        press(again, "down");
        press(again, "z");
        expect(py(again, "(g.mode, SEASON['team'], SEASON['week'])")).toEqual(["season", "gators", 1]);
      }
    }
    const table = py(game, "SEASON['table']") as Record<string, { w: number; l: number; t: number; pf: number; pa: number }>;
    const rows = Object.values(table);
    expect(rows.length).toBe(6);
    for (const r of rows) expect(r.w + r.l + r.t).toBe(5); // each played the other five once
    expect(rows.reduce((a, r) => a + r.w, 0)).toBe(rows.reduce((a, r) => a + r.l, 0));
    expect(rows.reduce((a, r) => a + r.pf, 0)).toBe(rows.reduce((a, r) => a + r.pa, 0));
    const order = (py(game, "[2 * SEASON['table'][t]['w'] + SEASON['table'][t]['t'] for t in standings()]") as number[]);
    expect(order).toEqual([...order].sort((a, b) => b - a)); // best record first
    const final = py(game, "SEASON['final']") as string[];
    expect(final).toEqual((py(game, "standings()[:2]") as string[]));
    expect(py(game, "SEASON['champion']")).toBeTruthy();
    expect(final).toContain(py(game, "SEASON['champion']"));
    expect(games).toBe(final.includes("gators") ? 6 : 5); // the championship too, if they made it
    expect(py(game, "season_words()")).toEqual(["New season", "Back to the title"]);
    expect((saved?.season as { champion: string }).champion).toBe(py(game, "SEASON['champion']"));
  }, 600_000);

  it("is played from the keyboard: the coin toss, the kickoff, the chalkboard, the snap, a throw to receiver 3", () => {
    py(g, "go_title(g)");
    press(g, "z"); // 1 Player
    expect(py(g, "g.mode")).toBe("toss");
    expect(py(g, "MATCH['humans'] == {'home': 0, 'away': None}")).toBe(true);
    expect(py(g, "MATCH['toss']['caller']")).toBe("home"); // the one person playing calls it
    step(g, 12);
    press(g, "down");
    press(g, "z");
    expect(py(g, "MATCH['toss']['call']")).toBe("TAILS");
    step(g, 72);
    const winner = py(g, "MATCH['toss']['winner']") as string;
    if (winner === "home") {
      step(g, 12);
      press(g, "z"); // receive
      expect(py(g, "MATCH['toss']['choice']")).toBe("RECEIVE");
    }
    for (let t = 0; t < 200 && py(g, "g.mode") === "toss"; t++) step(g, 1);
    expect(py(g, "(g.mode, PLAY['play']['kind'])")).toEqual(["set", "kickoff"]);
    expect(py(g, "MATCH['first_kicker']")).toBe(winner === "home" ? "away" : "home"); // the winner receives
    py(g, "start_drive('home', 25)\nstart_call(g)");
    step(g, 12);
    for (let i = 0; i < 5; i++) press(g, "down");
    press(g, "z"); // Slants, five down the list
    expect(py(g, "g.mode")).toBe("set");
    expect(py(g, "OFFENSE[PLAY['call']]['name']")).toBe("Slants");
    expect(py(g, "PLAY['carrier'].human")).toBe(0); // the quarterback is ours on a pass
    step(g, 31);
    press(g, "z"); // hike
    expect(py(g, "PLAY['snapped']")).toBe(true);
    step(g, 20);
    expect(py(g, "holding_to_throw()")).toBe(true);
    press(g, "c"); // receiver 3
    expect(py(g, "PLAY['ball']")).toBe("air");
    expect(py(g, "PLAY['target'].role")).toBe("WR3");
  });

  it("picks 2 Players on the title with one press of down, and starts a two-player match", () => {
    py(g, "go_title(g)");
    step(g, 2);
    press(g, "down");
    expect(py(g, "g.menu")).toBe(1); // one press, one step: it was read twice, back to 1 Player
    press(g, "z");
    expect(py(g, "g.mode")).toBe("toss");
    expect(py(g, "MATCH['two'] and MATCH['humans'] == {'home': 0, 'away': 1}")).toBe(true);
    expect(py(g, "MATCH['toss']['caller']")).toBe("away"); // the visitors call it
    // The Badgers' coach picks with the arrows and P, the Comets' with W, S and C.
    py(g, "start_call(g)");
    step(g, 12);
    press(g, "s");
    expect(py(g, "MATCH['cursor']['home']")).toBe(1);
    expect(py(g, "MATCH['cursor']['away']")).toBe(0);
    press(g, "down");
    expect(py(g, "MATCH['cursor']['away']")).toBe(1);
  });

  it("follows the ball with the camera", () => {
    setUp(g, "Deep");
    py(g, "g.mode = 'live'");
    step(g, 90);
    const off = py(g, "abs(view_x + VIEW_W / 2 - BALL[0].x)") as number;
    expect(off).toBeLessThan(60);
    expect(py(g, "BALL[0].x")).toBeGreaterThan(400); // not the left end zone, where the view starts
  });

  it("runs the running back along his route to the handoff", () => {
    setUp(g, "Dive", "Cover");
    for (let t = 0; t < 14; t++) py(g, "live_step()");
    const rb = py(g, "rb = by_role('home', 'RB')\n(rb.x - rb.home_x, rb.y - MID, PLAY['handed'])") as [number, number, boolean];
    expect(rb[0]).toBeGreaterThan(14); // moving up the field, on his line
    expect(Math.abs(rb[1])).toBeLessThan(3);
    for (let t = 0; t < 20 && !py(g, "PLAY['handed']"); t++) py(g, "live_step()");
    expect(py(g, "PLAY['carrier'].role")).toBe("RB");
  });

  it("leads a pass along the receiver's route, so a free man catches it", () => {
    setUp(g, "Slants", "Cover", 50, "0"); // ours, so the computer doesn't throw first
    // Nobody to stop it, and a perfect arm: only the leading is tested.
    py(g, "THROW_ERROR_WAS = THROW_ERROR\nglobals()['THROW_ERROR'] = 0\nfor d in team_of('away'): d.down_t = 9999");
    // Thrown while he's still running straight, before he cuts in: the ball
    // must go where the cut takes him, not where straight on would.
    for (let t = 0; t < 25; t++) py(g, "live_step()");
    expect(py(g, "len(by_role('home', 'WR3').route)")).toBe(2);
    py(g, "throw_to(by_role('home', 'WR3'))");
    for (let t = 0; t < 80 && py(g, "PLAY['ball']") === "air"; t++) py(g, "live_step()");
    py(g, "globals()['THROW_ERROR'] = THROW_ERROR_WAS");
    expect(py(g, "PLAY['result'] and PLAY['result']['how']")).not.toBe("incomplete");
    expect(py(g, "PLAY['carrier'] and PLAY['carrier'].role")).toBe("WR3");
  });

  it("never blocks a defender who is chasing the runner from behind", () => {
    setUp(g, "Dive", "Cover");
    py(g, `rb = by_role('home', 'RB'); give(rb)
rb.x = PLAY['los'] + 60
b, d = by_role('home', 'WR3'), by_role('away', 'LB1')
d.x, d.y = rb.x - 30, rb.y + 30        # behind the runner
b.x, b.y = d.x + 4, d.y
b.blocking = None; d.held_by = None; d.shed = 0; b.job = 'block'
blocks()`);
    expect(py(g, "d.held_by is None")).toBe(true);
    py(g, "d.x = rb.x + 30; b.x = d.x - 4\nblocks()"); // in front of him: blocked
    expect(py(g, "d.held_by is b")).toBe(true);
  });

  it("misses some tackles, and a sure one brings him down", () => {
    setUp(g, "Dive", "Cover");
    py(g, `rb = by_role('home', 'RB'); give(rb)
d = by_role('away', 'S'); d.x, d.y = rb.x + 5, rb.y
real = random.random
random.random = lambda: 0.99
check_tackle()
random.random = real`);
    expect(py(g, "PLAY['result'] is None")).toBe(true);
    expect(py(g, "d.down_t")).toBeGreaterThan(0); // he stumbled
    py(g, "d2 = by_role('away', 'CB1'); d2.x, d2.y = rb.x + 5, rb.y\nrandom.random = lambda: 0.0\ncheck_tackle()\nrandom.random = real");
    expect(py(g, "PLAY['result']['how']")).toBe("tackle");
  });

  it("gives the ball carrier a spin, a juke and a stiff-arm, each once a play, each with its own chance to break a tackle", () => {
    for (const [key, move] of [["z", "spin"], ["x", "juke"], ["c", "stiff"]] as const) {
      setUp(g, "Dive", "Cover", 50, "0");
      py(g, "g.mode = 'live'\nrb = by_role('home', 'RB'); give(rb)\nfor d in team_of('away'): d.down_t = 9999");
      expect(py(g, "rb.human")).toBe(0);
      press(g, key);
      expect(py(g, "(rb.move, PLAY['moves'])")).toEqual([move, [move]]);
      if (move === "juke") expect(Math.abs(py(g, "rb.vy") as number)).toBeGreaterThan(1); // he cut sideways
      // A tackler: the move breaks it (a roll under its chance)...
      py(g, `d = by_role('away', 'S'); d.down_t = 0; d.x, d.y = rb.x + 5, rb.y; d.held_by = None`);
      const chance = py(g, `MOVES[${JSON.stringify(move)}]['break']`) as number;
      rigRandom(g, [chance - 0.01]);
      py(g, "check_tackle()");
      expect(py(g, "PLAY['result'] is None")).toBe(true);
      expect(py(g, `d.down_t == MOVES[${JSON.stringify(move)}]['floors']`)).toBe(true);
      expect(py(g, "ANNOUNCE['text']")).toBe(py(g, `CALLS[${JSON.stringify(move)}]`));
      // ...or doesn't (a roll just over it), and a sure tackle brings him down.
      py(g, "d2 = by_role('away', 'CB1'); d2.down_t = 0; d2.held_by = None; d2.x, d2.y = rb.x + 5, rb.y");
      rigRandom(g, [chance + 0.01, 0.0]);
      py(g, "check_tackle()");
      expect(py(g, "PLAY['result'] and PLAY['result']['how']")).toBe("tackle");
    }
    // Once a play: a second juke does nothing.
    setUp(g, "Dive", "Cover", 50, "0");
    py(g, "g.mode = 'live'\nrb = by_role('home', 'RB'); give(rb)\nfor d in team_of('away'): d.down_t = 9999");
    press(g, "x");
    py(g, "rb.move, rb.move_t = None, 0");
    press(g, "x");
    expect(py(g, "(rb.move is None, PLAY['moves'])")).toEqual([true, ["juke"]]);
  });

  it("lets a receiver dive for a ball just out of reach, and catch it on the grass", () => {
    const throwWide = () => {
      setUp(g, "Slants", "Cover", 50, "0");
      py(g, `globals()['THROW_ERROR_WAS'] = THROW_ERROR
globals()['THROW_ERROR'] = 0
for d in team_of('away'): d.down_t = 9999
for _ in range(25): live_step()
for r in ('WR1', 'WR2', 'RB'): by_role('home', r).down_t = 9999     # only he is there to catch it
throw_to(by_role('home', 'WR3'))
globals()['THROW_ERROR'] = THROW_ERROR_WAS
PLAY['flight']['y1'] += 26          # out of his reach, not out of a dive's
g.mode = 'live'`);
    };
    throwWide();
    playOut(g, 120);
    expect(py(g, "PLAY['result']['how']")).toBe("incomplete"); // no dive: on the grass
    throwWide();
    // Late, so the dive can't close the gap: only a dive's longer reach gets there.
    for (let t = 0; t < 80 && (py(g, "PLAY['flight']['steps'] - PLAY['flight']['t']") as number) > 3; t++) py(g, "live_step()");
    rigRandom(g, [0.0]);
    press(g, "z"); // dive for it
    expect(py(g, "PLAY['diver'] is by_role('home', 'WR3')")).toBe(true);
    playOut(g, 120);
    expect(py(g, "(PLAY['result']['how'], PLAY['carrier'].role, PLAY.get('dove_catch'))")).toEqual(["tackle", "WR3", true]);
    expect(py(g, "ANNOUNCE['text']")).toBe(py(g, "CALLS['dive']"));
    step(g, 1);
    expect(py(g, "(g.mode, MATCH['says'][0])")).toEqual(["whistle", "Gain of " + py(g, "round((PLAY['result']['x'] - PLAY['los']) / YD)")]);
  });

  it("runs every new play as its chalkboard draws it: sneak, option, screen, play-action, reverse", () => {
    // QB Sneak: the quarterback keeps it, and he's yours.
    setUp(g, "QB Sneak", "Cover", 50, "0");
    for (let t = 0; t < 4; t++) py(g, "live_step()");
    expect(py(g, "(PLAY['carrier'].role, PLAY['carrier'].human, runner_free())")).toEqual(["QB", 0, true]);
    // Option: the computer's quarterback runs wide and pitches as a tackler closes in.
    setUp(g, "Option", "Cover");
    py(g, "for d in team_of('away'): d.down_t = 9999");
    for (let t = 0; t < 20; t++) py(g, "live_step()");
    expect(py(g, "(PLAY['carrier'].role, PLAY['second_done'])")).toEqual(["QB", false]);
    expect(py(g, "PLAY['carrier'].y - MID")).toBeGreaterThan(15); // running wide
    py(g, "qb = PLAY['carrier']; d = by_role('away', 'LB2'); d.down_t = 0; d.held_by = None; d.x, d.y = qb.x + fwd('home') * 20, qb.y");
    py(g, "live_step()");
    expect(py(g, "(PLAY['second_done'], PLAY['target'].role)")).toEqual([true, "RB"]);
    for (let t = 0; t < 40 && py(g, "PLAY['carrier'] is None"); t++) py(g, "live_step()");
    expect(py(g, "PLAY['carrier'].role")).toBe("RB");
    // Screen: the back is receiver 1, and the computer looks to him first.
    setUp(g, "Screen", "Blitz");
    expect(py(g, "[r.role for r in receivers()[:3]]")).toEqual(["RB", "WR1", "WR2"]);
    py(g, "for d in team_of('away'): d.down_t = 9999");
    for (let t = 0; t < 40 && !py(g, "PLAY['thrown']"); t++) py(g, "live_step()");
    expect(py(g, "PLAY['target'].role")).toBe("RB");
    expect(py(g, "(PLAY['target'].x - PLAY['los']) * fwd('home')")).toBeLessThan(0); // behind the line
    // Play-action: the safety bites on the fake; on a plain deep pass he doesn't.
    const safetyCame = (call: string) => {
      setUp(g, call, "Cover");
      py(g, "s = by_role('away', 'S'); s0 = abs(s.x - PLAY['los'])");
      for (let t = 0; t < 25; t++) py(g, "live_step()");
      return py(g, "s0 - abs(s.x - PLAY['los'])") as number;
    };
    expect(safetyCame("Play-Action")).toBeGreaterThan(15);
    expect(safetyCame("Deep")).toBeLessThan(5);
    // Reverse: the back takes it up, then hands it on to the receiver coming down.
    setUp(g, "Reverse", "Cover");
    py(g, "for d in team_of('away'): d.down_t = 9999");
    for (let t = 0; t < 30; t++) py(g, "live_step()");
    expect(py(g, "PLAY['carrier'].role")).toBe("RB");
    for (let t = 0; t < 80 && !py(g, "PLAY['second_done'] and PLAY['carrier'] is not None and PLAY['carrier'].role == 'WR1'"); t++) py(g, "live_step()");
    expect(py(g, "PLAY['carrier'].role")).toBe("WR1");
    expect(py(g, "PLAY['t']")).toBeLessThan(60); // handed on as they cross, not the late lateral
    for (let t = 0; t < 20; t++) py(g, "live_step()");
    expect(py(g, "PLAY['carrier'].vy")).toBeGreaterThan(0); // going down the screen, the other way
  });

  it("draws every play and every defense on the chalkboard from its own data", () => {
    py(g, `_drawn = {'line': 0, 'tri': 0, 'circle': 0, 'words': []}
_dl, _dt, _dc, _dw = draw_line, draw_triangle, draw_circle, draw_words
def draw_line(*a, **k): _drawn['line'] += 1
def draw_triangle(*a, **k): _drawn['tri'] += 1
def draw_circle(*a, **k): _drawn['circle'] += 1
def draw_words(x, y, text, *a, **k): _drawn['words'].append(str(text))
def _count(fn, play):
    _drawn.update(line=0, tri=0, circle=0, words=[])
    fn(0, 0, play)
    return dict(_drawn)`);
    const offense = py(g, `[(p['name'], _count(draw_play_diagram, p)) for p in OFFENSE]`) as [string, { line: number; tri: number; circle: number; words: string[] }][];
    const want = py(g, `[(sum(len(r) for r in p.get('routes', {}).values()), len(p.get('routes', {})),
  p.get('targets', ['WR1', 'WR2', 'WR3']) if p['kind'] == 'pass' else []) for p in OFFENSE]`) as [number, number, string[]][];
    offense.forEach(([name, d], i) => {
      if (name === "Punt" || name === "Field Goal") return;
      const [segments, routes, targets] = want[i]!;
      expect([name, d.line]).toEqual([name, 1 + segments]); // the line of scrimmage, and every leg of every route
      expect([name, d.tri]).toEqual([name, routes]); // an arrowhead on each
      expect([name, d.circle]).toEqual([name, 7]); // an O for every player
      const withRoute = targets.filter((r) => py(g, `${JSON.stringify(r)} in OFFENSE[${i}]['routes']`));
      expect([name, d.words.filter((w) => /^[123]$/.test(w)).length]).toEqual([name, withRoute.length]);
    });
    const defense = py(g, `[(p['name'], _count(draw_defense_diagram, p),
  sum(1 for j in p['jobs'].values() if j.split()[0] in ('rush', 'man', 'spy')),
  sum(1 for j in p['jobs'].values() if j.startswith('zone'))) for p in DEFENSE]`) as [string, { line: number; circle: number }, number, number][];
    for (const [name, d, arrows, zones] of defense) {
      expect([name, d.line]).toEqual([name, 1 + 7 * 2 + arrows]); // the line, an X each, a line for each rush, man or spy
      expect([name, d.circle]).toEqual([name, 7 + zones]); // an O for each of theirs, a ring for each zone
    }
    py(g, "draw_line, draw_triangle, draw_circle, draw_words = _dl, _dt, _dc, _dw");
    expect(offense.length).toBeGreaterThanOrEqual(11);
    expect(defense.length).toBeGreaterThanOrEqual(6);
  });

  it("coaches by the down, the distance, the field, the score and the clock", () => {
    const call = (setup: string, n = 120, side = "cpu_offense") => {
      py(g, `new_match({'home': None, 'away': None})\n${setup}`);
      const picks = py(g, `[(OFFENSE if ${JSON.stringify(side)} == 'cpu_offense' else DEFENSE)[${side}()]['name'] for _ in range(${n})]`) as string[];
      const count = (names: string[]) => picks.filter((p) => names.includes(p)).length / picks.length;
      return { picks, count };
    };
    const spot = (own: number, down: number, togo: number) =>
      `MATCH['los'] = at_yards('home', 100 - ${own}); MATCH['down'] = ${down}; MATCH['first'] = MATCH['los'] + ${togo} * YD`;
    const passes = ["Screen", "Slants", "Play-Action", "Deep"];
    const runs = ["Dive", "Sweep", "QB Sneak", "Option", "Reverse"];
    expect(new Set(call(spot(20, 4, 10), 30).picks)).toEqual(new Set(["Punt"])); // 4th and long, deep in his own end
    expect(new Set(call(spot(72, 4, 2), 30).picks)).toEqual(new Set(["Field Goal"])); // in range
    const inches = call(spot(97, 4, 1));
    expect(inches.count(["Punt", "Field Goal"])).toBe(0); // 4th and a yard at the 3: go for it
    expect(inches.count(["QB Sneak", "Dive"])).toBeGreaterThan(0.6);
    const desperate = call(`${spot(40, 4, 8)}; MATCH['quarter'] = 4; MATCH['clock'] = 40; MATCH['score']['away'] = 7`);
    expect(desperate.count(["Punt", "Field Goal"])).toBe(0); // behind late: a punt can't win it
    expect(desperate.count(passes)).toBeGreaterThan(0.75);
    expect(call(spot(30, 3, 15)).count(passes)).toBeGreaterThan(0.7); // 3rd and 15
    expect(call(`${spot(30, 1, 10)}; MATCH['quarter'] = 4; MATCH['score']['home'] = 10`).count(runs)).toBeGreaterThan(0.6); // ahead late: run the clock
    // Defense.
    const goalLine = call(spot(98, 3, 1), 120, "cpu_defense");
    expect(goalLine.count(["Goal Line"])).toBeGreaterThan(0.5);
    const prevent = call(`${spot(40, 1, 10)}; MATCH['quarter'] = 4; MATCH['clock'] = 40; MATCH['score']['away'] = 7`, 120, "cpu_defense");
    expect(prevent.count(["Prevent"])).toBeGreaterThan(0.5);
    expect(call(spot(30, 3, 15), 120, "cpu_defense").count(["Goal Line", "Run Stop"])).toBeLessThan(0.1);
  });

  it("decides the try and the onside kick by the score and the clock", () => {
    const two = (q: number, home: number, away: number) =>
      py(g, `new_match({'home': None, 'away': None}); MATCH['quarter'] = ${q}; MATCH['score'].update(home=${home}, away=${away})\ncpu_go_for_two('home')`);
    expect(two(4, 12, 14)).toBe(true); // down 2 after the touchdown: two ties it
    expect(two(3, 13, 18)).toBe(true); // down 5: two makes it a field goal game
    expect(two(4, 13, 6)).toBe(false); // up 7: kick for 8
    expect(two(1, 6, 8)).toBe(false); // the first half: always kick
    const onside = (q: number, clock: number, home: number, away: number) =>
      py(g, `new_match({'home': None, 'away': None}); MATCH['quarter'] = ${q}; MATCH['clock'] = ${clock}; MATCH['score'].update(home=${home}, away=${away})\ncpu_onside('home')`);
    expect(onside(4, 60, 14, 21)).toBe(true);
    expect(onside(4, 60, 0, 28)).toBe(false); // too far behind for it to matter
    expect(onside(4, 60, 21, 14)).toBe(false); // ahead: kick it deep
    expect(onside(2, 60, 14, 21)).toBe(false); // too early
  });

  it("changes how a team plays by its strengths: speed, tackling, the arm", () => {
    // Speed: the same run, the Rockets' back covers more ground than the Pirates'.
    const ran = (home: string) => {
      py(g, `set_teams(${JSON.stringify(home)}, 'badgers')`);
      setUp(g, "Dive", "Cover");
      py(g, "for d in team_of('away'): d.down_t = 9999\nfor p in PLAYERS: p.pace = 1");
      for (let t = 0; t < 60; t++) py(g, "live_step()");
      return py(g, "PLAY['carrier'].x - PLAY['los']") as number;
    };
    expect(ran("rockets")).toBeGreaterThan(ran("pirates") * 1.08);
    // Tackling: one roll brings a runner down for the hard-hitting Badgers and not for the Gators.
    const tackled = (away: string) => {
      py(g, `set_teams('comets', ${JSON.stringify(away)})`);
      setUp(g, "Dive", "Cover");
      py(g, "rb = by_role('home', 'RB'); give(rb)\nd = by_role('away', 'DL1'); d.x, d.y = rb.x + 5, rb.y; d.held_by = None");
      rigRandom(g, [0.6]);
      py(g, "check_tackle()");
      return py(g, "PLAY['result'] is not None") as boolean;
    };
    expect(tackled("badgers")).toBe(true);
    expect(tackled("gators")).toBe(false);
    // The arm: a strong one throws closer to where it means to.
    const spread = (home: string) => {
      py(g, `set_teams(${JSON.stringify(home)}, 'badgers')\nrandom.seed(3)`);
      let total = 0;
      for (let i = 0; i < 30; i++) {
        setUp(g, "Deep", "Cover", 50, "0");
        py(g, "for d in team_of('away'): d.x += 400\nr = by_role('home', 'WR1')\nPLAY['toss'] = False\nqb = PLAY['carrier']; qb.x -= 30");
        total += py(g, `aim = (r.x, r.y)
throw_to(r)
f = PLAY['flight']
where_x, where_y = where_after(r, f['steps'])
point_distance(f['x1'], f['y1'], where_x, where_y)`) as number;
      }
      return total;
    };
    expect(spread("pirates")).toBeLessThan(spread("rockets"));
    py(g, "set_teams()");
  });

  it("scores a touchdown as six, then the try: kick for one (the default), or a play for two", () => {
    py(g, "new_match({'home': None, 'away': None})");
    setUp(g, "Dive");
    py(g, "rb = by_role('home', 'RB'); give(rb); rb.x = GOAL_R + 2\ncheck_lines()");
    expect(py(g, "PLAY['result']['how']")).toBe("touchdown");
    expect(py(g, "finish(PLAY['result'])")).toBe("touchdown");
    let s = state(g);
    expect(s.score).toEqual({ home: 6, away: 0 });
    expect([s.off, s.try, s.words]).toEqual(["home", "home", "The try"]);
    // The kick is what a press picks, and it's one point; then the scorers kick off.
    py(g, "g.mode, g.since, g.try_cursor = 'try', g.t - 20, 0\nMATCH['humans']['home'] = 0");
    press(g, "z");
    expect(py(g, "(g.mode, OFFENSE[PLAY['call']]['name'], round(to_goal('home', PLAY['los'])))")).toEqual(["set", "Field Goal", 15]);
    py(g, "snap()\nPLAY['kick']['phase'] = 0");
    expect(py(g, "PLAY['kick']['allowed']")).toBeGreaterThanOrEqual(0.8); // an extra point's green is wide
    expect(finish(g, "field goal", 95, 184, ", 'kind': 'kick'")).toBe("touchdown");
    s = state(g);
    expect([s.score.home, s.kickoff, s.off]).toEqual([7, "home", "away"]);
    // Going for two: a play from the 3, on the chalkboard (no kicks there).
    const goForTwo = (how: string) => {
      py(g, "new_match({'home': None, 'away': None})");
      finish(g, "touchdown", 100, 184, ", 'kind': 'run'");
      py(g, "g.mode, g.since, g.try_cursor = 'try', g.t - 20, 0\nMATCH['humans']['home'] = 0");
      press(g, "down");
      press(g, "z");
      expect(py(g, "(g.mode, round(to_goal('home', MATCH['los'])))")).toEqual(["call", 3]);
      expect(py(g, "[OFFENSE[i]['kind'] for i in plays_for('home')]")).not.toContain("kick");
      expect(py(g, "[OFFENSE[i]['kind'] for i in plays_for('home')]")).not.toContain("punt");
      return finish(g, how, 100, 184, ", 'kind': 'pass'");
    };
    expect(goForTwo("touchdown")).toBe("touchdown");
    expect(state(g).score.home).toBe(8);
    goForTwo("tackle");
    s = state(g);
    expect([s.score.home, s.kickoff, s.try]).toEqual([6, "home", null]); // stopped: no points, and kick off
  });

  it("kicks off: fielded and returned by your returner, or a touchback from the end zone", () => {
    kickoff(g, "away", "0");
    expect(py(g, "(PLAY['off'], PLAY['target'].role, PLAY['target'].human)")).toEqual(["home", "RB", 0]);
    expect(py(g, "(PLAY['flight']['x1'] - PLAY['los']) * fwd('home')")).toBeLessThan(-50 * 12); // deep, back toward our goal
    py(g, "PLAY['flight']['x1'] = at_yards('home', 92)"); // lands at our 8
    for (let t = 0; t < 100 && py(g, "PLAY['carrier'] is None"); t++) py(g, "live_step()");
    expect(py(g, "(PLAY['carrier'].team, PLAY['carrier'].human, PLAY['result'] is None)")).toEqual(["home", 0, true]);
    expect(py(g, "ANNOUNCE['text']")).toBe(py(g, "CALLS['return']"));
    py(g, "PLAY['carrier'].x = at_yards('home', 70)\nend_play('tackle', PLAY['carrier'].x, MID)");
    expect(py(g, "finish(PLAY['result'])")).toBe("whistle");
    let s = state(g);
    expect([s.off, s.own, s.words, s.kickoff]).toEqual(["home", 30, "1st & 10", null]); // ours where he was stopped
    // Into the end zone: the ball on the 25.
    kickoff(g, "away");
    py(g, "PLAY['flight']['x1'] = GOAL_L - 4 * YD");
    playOut(g, 200);
    expect(py(g, "PLAY['result']['how']")).toBe("touchback");
    py(g, "finish(PLAY['result'])");
    s = state(g);
    expect([s.off, s.own]).toEqual(["home", 25]);
    // A returner downed in his own end zone is a touchback too, not a safety.
    py(g, "new_match({'home': None, 'away': None}); set_kickoff('away')");
    py(g, `finish({'how': 'tackle', 'x': GOAL_L - 2 * YD, 'y': MID, 'who': None, 'team': 'home', 'kind': 'kickoff'})`);
    s = state(g);
    expect([s.off, s.own, s.score.away]).toEqual(["home", 25, 0]);
  });

  it("kicks onside: the kicking team sometimes gets it back", () => {
    kickoff(g, "home", "None", true);
    expect(py(g, "abs(PLAY['flight']['x1'] - PLAY['los']) / YD")).toBeLessThan(15);
    rigRandom(g, [0.0]); // the kicking team comes up with it
    playOut(g, 100);
    expect(py(g, "(PLAY['result']['how'], PLAY['result']['team'])")).toEqual(["recovered", "home"]);
    py(g, "finish(PLAY['result'])");
    expect(state(g).off).toBe("home");
    kickoff(g, "home", "None", true);
    rigRandom(g, [0.99]); // the other team does
    playOut(g, 100);
    py(g, "finish(PLAY['result'])");
    expect(state(g).off).toBe("away");
  });

  it("tosses a coin: the winner receives, and the other team gets the ball after halftime", () => {
    py(g, "begin_match(g, {'home': None, 'away': None})");
    expect(py(g, "(g.mode, MATCH['toss']['caller'])")).toEqual(["toss", "away"]);
    for (let t = 0; t < 400 && py(g, "g.mode") === "toss"; t++) step(g, 1);
    const toss = py(g, "MATCH['toss']") as { call: string; result: string; winner: string; choice: string };
    expect(["HEADS", "TAILS"]).toContain(toss.call);
    expect(toss.winner).toBe(toss.result === toss.call ? "away" : "home");
    expect(toss.choice).toBe("RECEIVE");
    expect(py(g, "(g.mode, PLAY['play']['kind'], PLAY['off'], MATCH['first_kicker'])")).toEqual(["set", "kickoff", toss.winner, toss.winner === "home" ? "away" : "home"]);
    py(g, "MATCH['quarter'] = 2");
    expect(py(g, "next_quarter()")).toBe("HALFTIME");
    expect(py(g, "(MATCH['kickoff'], MATCH['off'])")).toEqual([toss.winner, toss.winner === "home" ? "away" : "home"]);
  });

  it("replays a touchdown in slow motion, celebrates, then goes to the try", () => {
    setUp(g, "Dive", "Cover", 90);
    py(g, "g.mode = 'live'\nfor d in team_of('away'): d.down_t = 9999");
    const xs: number[] = [];
    for (let t = 0; t < 400 && py(g, "g.mode") === "live"; t++) {
      step(g, 1);
      xs.push(py(g, "BALL[0].x") as number);
    }
    expect(py(g, "(g.mode, PLAY['result']['how'])")).toEqual(["whistle", "touchdown"]);
    expect(py(g, "all(p.cheer for p in team_of('home')) and g.mascot > 0")).toBe(true);
    step(g, 151);
    expect(py(g, "g.mode")).toBe("replay");
    const rx: number[] = [];
    for (let t = 0; t < 1000 && py(g, "g.mode") === "replay"; t++) {
      rx.push(py(g, "BALL[0].x") as number);
      step(g, 1);
    }
    const pace = (v: number[]) => Math.abs(v[v.length - 1]! - v[0]!) / v.length;
    expect(rx.length).toBeGreaterThan(100);
    expect(pace(rx)).toBeLessThan(pace(xs.slice(-150)) * 0.6); // slower than it happened
    expect(Math.max(...rx)).toBeGreaterThan(Math.min(...rx) + 30); // and it really moves
    expect(py(g, "g.mode")).toBe("try");
  });

  it("counts downs: ten yards is a first down, four tries and it's theirs", () => {
    py(g, "new_match({'home': None, 'away': None})");
    expect(state(g).words).toBe("1st & 10");
    finish(g, "tackle", 29);
    expect(state(g).words).toBe("2nd & 6");
    finish(g, "tackle", 35);
    expect(state(g)).toMatchObject({ words: "1st & 10", own: 35 });
    finish(g, "incomplete", 35);
    finish(g, "tackle", 37);
    finish(g, "tackle", 38);
    expect(state(g).words).toBe("4th & 7");
    finish(g, "tackle", 39);
    // Turned over where he was stopped: the Badgers' ball at the Comets' 39, their 61.
    expect(state(g)).toMatchObject({ off: "away", down: 1, own: 61, togo: 10 });
  });

  it("puts the first-down marker ten yards from where a turnover was spotted", () => {
    py(g, "new_match({'home': None, 'away': None})");
    py(g, "PLAY.update(los=MATCH['los'])");
    finish(g, "interception", 60);
    // Caught at the Comets' 60 is the Badgers' own 40: first and ten from there.
    expect(state(g)).toMatchObject({ off: "away", own: 40, togo: 10, words: "1st & 10" });
  });

  it("knows goal to go, a safety, and a touchback", () => {
    py(g, "new_match({'home': None, 'away': None})");
    finish(g, "tackle", 94);
    expect(state(g).words).toBe("1st & Goal");
    py(g, "new_match({'home': None, 'away': None})");
    finish(g, "tackle", -2); // down in his own end zone
    // Two points, and the team that gave them up kicks off to them from its 20.
    expect(state(g)).toMatchObject({ score: { home: 0, away: 2 }, off: "away", kickoff: "home" });
    expect(py(g, "round(100 - to_goal('home', MATCH['los']))")).toBe(20);
    py(g, "new_match({'home': None, 'away': None})");
    finish(g, "interception", 104); // picked off in the Badgers' own end zone
    expect(state(g)).toMatchObject({ off: "away", own: 25 });
    py(g, "new_match({'home': None, 'away': None})");
    finish(g, "punt", 105);
    expect(state(g)).toMatchObject({ off: "away", own: 20 });
    py(g, "new_match({'home': None, 'away': None})");
    finish(g, "punt", 70);
    expect(state(g)).toMatchObject({ off: "away", own: 30 });
  });

  it("kicks a field goal in the green, and misses one out of it", () => {
    for (const [t, good] of [[35, true], [17, false]] as const) {
      setUp(g, "Field Goal", "Cover", 80, "0");
      expect(py(g, "can_kick()")).toBe(true);
      py(g, `g.mode = 'live'\nPLAY['t'] = ${t}`);
      press(g, "z");
      expect(py(g, "PLAY['kick']['good']")).toBe(good);
      step(g, 70);
      expect(py(g, "g.mode")).toBe("whistle");
      expect(state(g).score.home).toBe(good ? 3 : 0);
    }
    py(g, "new_match({'home': None, 'away': None})");
    expect(py(g, "can_kick()")).toBe(false); // from their own 25: no field goal on the board
    expect(py(g, "[OFFENSE[i]['name'] for i in plays_for('home')]")).not.toContain("Field Goal");
  });

  it("gives the Badgers the ball after halftime, and ends after the fourth", () => {
    py(g, "new_match({'home': None, 'away': None})\nMATCH['quarter'] = 2");
    expect(py(g, "next_quarter()")).toBe("HALFTIME");
    // The Badgers kicked first (the default toss), so the Comets kick to them now.
    expect(state(g)).toMatchObject({ off: "away", kickoff: "home" });
    py(g, "MATCH['quarter'] = 4");
    expect(py(g, "next_quarter()")).toMatch(/^FINAL/);
    expect(py(g, "MATCH['over']")).toBe(true);
  });

  it("plays sudden-death overtime when a championship is tied", () => {
    py(g, "new_match({'home': None, 'away': None})\nMATCH['no_ties'] = True\nMATCH['quarter'] = 4\nMATCH['score'].update(home=14, away=14)");
    expect(py(g, "next_quarter()")).toMatch(/^OVERTIME/);
    expect(py(g, "(MATCH['over'], MATCH['quarter'], MATCH['kickoff'])")).toEqual([false, 5, "home"]);
    py(g, "start_drive('away', 60)");
    finish(g, "field goal", 70);
    expect(py(g, "MATCH['over']")).toBe(true); // the next score wins it
    py(g, "new_match({'home': None, 'away': None})\nMATCH['quarter'] = 4\nMATCH['score'].update(home=14, away=14)");
    expect(py(g, "next_quarter()")).toMatch(/^FINAL/); // a season game can end tied
  });

  it("schedules a season in which every team plays every other once a week", () => {
    const weeks = py(g, "round_robin([t['id'] for t in LEAGUE])") as string[][][];
    expect(weeks.length).toBe(5);
    const pairs = new Set<string>();
    for (const week of weeks) {
      expect(new Set(week.flat()).size).toBe(6); // everybody plays once a week
      for (const [a, b] of week) pairs.add([a, b].sort().join("-"));
    }
    expect(pairs.size).toBe(15); // every pair, once
  });

  it("shows the controls on the title, a page at a time, every line fitting the screen", () => {
    py(g, `_tips = []
_db = draw_banner
def draw_banner(y, text, color="#ffffff", big=True): _tips.append(text)`);
    const all: string[] = [];
    const pages: string[] = [];
    for (let menu = 0; menu < 3; menu++) {
      const lines: string[] = [];
      for (let t = 0; t < 1000; t += 200) {
        py(g, `_tips.clear()\ndraw_title(${menu}, ${t})`);
        lines.push(...(py(g, "list(_tips)") as string[]));
      }
      pages.push(lines.join(" "));
      all.push(...lines);
    }
    py(g, "draw_banner = _db");
    // 1 Player's pages name every control; 2 Players' the two sets of keys; Season's that it's saved.
    for (const words of ["Z X C", "spin", "juke", "stiff-arm", "dive", "switch", "onside", "go for 2", "pitch", "1 2 3"]) {
      expect([words, pages[0]!.includes(words)]).toEqual([words, true]);
    }
    for (const words of ["C V B", "I O P"]) expect(pages[1]).toContain(words);
    expect(pages[2]).toContain("saved");
    for (const line of all) expect(line.length * 6).toBeLessThanOrEqual(384);
    const calls = py(g, "list(CALLS.values())") as string[];
    for (const line of calls) expect(line.length * 6).toBeLessThanOrEqual(384 - 16);
  });

  it("has every sound the game plays, and every team's pictures", () => {
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    const sounds = new Set(project.sounds.map((s) => s.name));
    const sprites = new Set(project.sprites.map((s) => s.name));
    const code = ["_2play.py", "_3match.py", "_6flow.py", "Game.py"].map((f) => readFileSync(resolve(GAME_DIR, f), "utf8")).join("\n");
    const played = new Set([...code.matchAll(/sound_play\("(\w+)"/g)].map((m) => m[1]!));
    for (const m of py(g, "list(MOVES)") as string[]) played.add(m); // do_move plays the move's own
    for (const name of played) expect([name, sounds.has(name)]).toEqual([name, true]);
    for (const id of py(g, "[t['id'] for t in LEAGUE]") as string[]) {
      for (const kind of ["run", "ball", "poses", "moves"]) expect(sprites.has(`${id}_${kind}`)).toBe(true);
      expect(sprites.has(`endzone_${id}`) && sprites.has(`badge_${id}`)).toBe(true);
    }
  });
});
