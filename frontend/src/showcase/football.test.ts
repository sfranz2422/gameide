/**
 * The fourth showcase game, Under the Lights, played headless in the real
 * Pyodide: whole games of the computer against itself, a play called and
 * thrown from the keyboard, the rules of downs and scoring, and each thing
 * that once went wrong in a play (a runner leaving his route, passes thrown
 * where a receiver would have been if he'd run straight, pursuers blocked
 * from behind). Runs when the game has been built (python3
 * showcase/football/build.py, which draws stand-ins for any picture the
 * teacher hasn't made yet).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/football/out/project.json");
const have = existsSync(BUILT);

async function start(seed = 1) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const { game, error } = await PythonGame.load(def, { stdout: () => undefined, stderr: () => undefined, warning: () => undefined });
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

/** A play lined up at the Comets' own `yards` and snapped; `home` is who plays the Comets (None: the computer). */
function setUp(g: PythonGame, call: string, dcall = "Cover", yards = 50, home = "None") {
  py(g, `new_match({'home': ${home}, 'away': None})
MATCH['los'] = at_yards('home', 100 - ${yards}); MATCH['ball_y'] = MID; set_first_down()
line_up('home', 'away', [p['name'] for p in OFFENSE].index(${JSON.stringify(call)}),
        [p['name'] for p in DEFENSE].index(${JSON.stringify(dcall)}), MATCH['los'], MID)
snap()`);
}

/** The rules alone: a play ended `how` at (yards from the Comets' own goal line, across). */
function finish(g: PythonGame, how: string, ownYards: number, y = 184) {
  return py(g, `finish({'how': ${JSON.stringify(how)}, 'x': at_yards('home', 100 - ${ownYards}), 'y': ${y}, 'who': None, 'team': 'home'})`) as string;
}

const state = (g: PythonGame) =>
  py(g, "{'off': MATCH['off'], 'down': MATCH['down'], 'own': round(100 - to_goal(MATCH['off'], MATCH['los'])), 'togo': to_go(), 'score': dict(MATCH['score']), 'words': down_words()}") as {
    off: string; down: number; own: number; togo: number; score: { home: number; away: number }; words: string;
  };

describe.skipIf(!have)("Under the Lights", () => {
  let g: PythonGame;
  beforeAll(async () => {
    g = await start();
  });

  it("plays whole games, the computer against itself, to a final score", async () => {
    let points = 0;
    for (const seed of [1, 2]) {
      const game = await start(seed);
      py(game, "new_match({'home': None, 'away': None})\nMATCH['demo'] = True\nstart_call(g)");
      const outcomes = new Set<string>();
      const teams = new Set<string>();
      let plays = 0;
      let was = "";
      for (let i = 0; i < 60 * 60 * 15 && py(game, "g.mode") !== "final"; i++) {
        step(game, 1);
        const mode = py(game, "g.mode") as string;
        if (mode === "whistle" && was !== "whistle") {
          plays++;
          outcomes.add(py(game, "PLAY['result']['how']"));
          teams.add(py(game, "PLAY['off']"));
        }
        was = mode;
      }
      expect(py(game, "g.mode")).toBe("final");
      expect(py(game, "MATCH['quarter']")).toBe(4);
      step(game, 120); // the final screen draws
      expect(plays).toBeGreaterThan(30);
      expect(plays).toBeLessThan(70);
      expect(teams.size).toBe(2);
      expect(outcomes.size).toBeGreaterThanOrEqual(3);
      const s = state(game).score;
      points += s.home + s.away;
    }
    expect(points).toBeGreaterThan(0);
  }, 300_000);

  it("is played from the keyboard: the chalkboard, the snap, a throw to receiver 3", () => {
    py(g, "go_title(g)");
    press(g, "z"); // 1 Player
    expect(py(g, "g.mode")).toBe("call");
    expect(py(g, "MATCH['humans'] == {'home': 0, 'away': None}")).toBe(true);
    step(g, 12);
    press(g, "down");
    press(g, "down");
    press(g, "z"); // Slants
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

  it("scores a touchdown as seven, and kicks the ball to the other team", () => {
    py(g, "new_match({'home': None, 'away': None})");
    setUp(g, "Dive");
    py(g, "rb = by_role('home', 'RB'); give(rb); rb.x = GOAL_R + 2\ncheck_lines()");
    expect(py(g, "PLAY['result']['how']")).toBe("touchdown");
    expect(py(g, "finish(PLAY['result'])")).toBe("touchdown");
    const s = state(g);
    expect(s.score).toEqual({ home: 7, away: 0 });
    expect(s.off).toBe("away");
    expect([s.own, s.down, s.togo]).toEqual([25, 1, 10]);
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
    expect(state(g)).toMatchObject({ score: { home: 0, away: 2 }, off: "away" });
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
    py(g, "new_match({'home': None, 'away': None})\nMATCH['quarter'] = 2")
    expect(py(g, "next_quarter()")).toBe("HALFTIME");
    expect(state(g)).toMatchObject({ off: "away", own: 25 });
    py(g, "MATCH['quarter'] = 4");
    expect(py(g, "next_quarter()")).toMatch(/^FINAL/);
    expect(py(g, "MATCH['over']")).toBe(true);
  });
});
