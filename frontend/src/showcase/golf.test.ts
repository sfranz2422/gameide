/**
 * The fifth showcase game, Greenside (nine holes of golf), played headless
 * in the real Pyodide. A bot golfer plays the whole course: before each
 * shot it tries aims, clubs and powers with the game's own flight and roll
 * (on a stand-in ball, so nothing in the game moves), then plays the best
 * through the game's keys. If the bot gets round near par, every hole is
 * playable as drawn. Then the rules one at a time: sand, water, the cup and
 * its lip, trees, whose turn it is, and the scores.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/golf/out/project.json");
const have = existsSync(BUILT);

async function start(seed = 1) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const { game, error } = await PythonGame.load(def, { stdout: () => undefined, stderr: () => undefined, warning: () => undefined });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  py(game, `random.seed(${seed})\ng = instances('Game')[0]\n${BOT}`);
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
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
  step(g);
}

/**
 * The bot, in Python: `plan(i)` is the best (club, power, aim) for player
 * i's ball, found by flying a stand-in ball with the game's own hit() and
 * roll() — so the bot can only do what a player could.
 */
const BOT = `
from types import SimpleNamespace

def try_shot(x, y, club, power, aim):
    b = SimpleNamespace(x=x, y=y, z=0, vx=0, vy=0, vz=0, moving=False, flying=False, last=(x, y), club=0, wind=(0, 0))
    hit(b, club, power, aim, ROUND["wind"])
    for _ in range(900):
        r = roll(b, hole_now())
        if r:
            return r, b.x, b.y
    return "stopped", b.x, b.y

def plan(i):
    ball = BALLS[i]
    h = hole_now()
    cx, cy = h["cup"]
    straight = point_direction(ball.x, ball.y, cx, cy)
    best, best_score = None, 1e9
    clubs = [len(CLUBS) - 1] if ground(h, ball.x, ball.y) == "green" else range(len(CLUBS))
    for club in clubs:
        for da in range(-40, 41, 5):
            for k in range(2, 21):
                power = k / 20
                r, x, y = try_shot(ball.x, ball.y, club, power, straight + da)
                score = 0 if r == "holed" else point_distance(x, y, cx, cy) + (2000 if r == "water" else 0)
                if ground(h, x, y) == "sand":
                    score += 60
                if score < best_score:
                    best, best_score = (club, power, straight + da), score
    return best
`;

/** Plays the shot the bot planned for whoever's turn it is, through the keys, then waits for the ball to stop. */
function botShot(g: PythonGame) {
  const [club, power, aim] = py(g, "plan(ROUND['turn'])") as [number, number, number];
  py(g, `g.club = ${club}\ng.aim = ${aim}`);
  press(g, "space"); // start the meter
  // The meter fills over 45 steps: wait until it shows the power wanted, then press again.
  for (let i = 0; i < 100 && (py(g, "g.power") as number) < power - 0.011; i++) step(g);
  press(g, "space");
  expect(py(g, "g.mode")).toBe("rolling");
  for (let i = 0; i < 2000 && py(g, "g.mode") === "rolling"; i++) step(g);
}

describe.skipIf(!have)("Greenside", () => {
  it("is played round all nine holes by a bot, near par: every hole can be played as it's drawn", async () => {
    const g = await start(3);
    press(g, "space"); // 1 player, tee off
    const scores: number[] = [];
    for (let hole = 0; hole < 9; hole++) {
      expect(py(g, "g.mode")).toBe("card");
      expect(py(g, "ROUND['hole']")).toBe(hole);
      step(g, 12);
      press(g, "space");
      for (let shots = 0; shots < 12 && py(g, "g.mode") !== "scores"; shots++) {
        if (py(g, "g.mode") === "after") for (let i = 0; i < 200 && py(g, "g.mode") === "after"; i++) step(g);
        if (py(g, "g.mode") === "aim") botShot(g);
      }
      for (let i = 0; i < 200 && py(g, "g.mode") === "after"; i++) step(g);
      expect(py(g, "g.mode"), `hole ${hole + 1} finished`).toBe("scores");
      scores.push(py(g, `ROUND['cards'][0][${hole}]`));
      step(g, 45);
      press(g, "space");
    }
    const pars = py(g, "[h['par'] for h in HOLES]") as number[];
    scores.forEach((s, k) => expect(s, `hole ${k + 1}: ${s} on a par ${pars[k]}`).toBeLessThanOrEqual(pars[k]! + 1));
    expect(py(g, "g.mode")).toBe("final");
    expect(py(g, "save_get('best', None)")).toBe(scores.reduce((a, b) => a + b, 0));
  }, 600_000);

  it("stops a ball dead in sand, and rolls it far on the fairway", async () => {
    const g = await start();
    // The same iron shot, landing in sand on hole 6 and on its fairway.
    const rolled = (x: number, y: number) =>
      py(g, `ROUND['hole'] = 5\nb = SimpleNamespace(x=${x}, y=${y}, z=0, vx=0, vy=0, vz=0, moving=False, flying=False, last=(0, 0), club=0, wind=(0, 0))
hit(b, 1, 0.5, 0, (0, 0))
while not roll(b, hole_now()): pass
(round(b.x - ${x}), ground(hole_now(), b.x, b.y))`) as [number, string];
    // Half an iron flies about 130 (a little more: a flight is whole steps). From 130 left of
    // the sand at (480, 240), it lands in it and goes no further; on the fairway it rolls on.
    const [inSand, where] = rolled(480 - 130, 240);
    expect(where).toBe("sand");
    expect(inSand).toBeLessThan(140);
    const [onGrass, there] = rolled(240, 250);
    expect(there).toBe("fairway");
    expect(onGrass).toBeGreaterThan(inSand + 8);
  });

  it("lands dead in sand, and a ball rolling into sand stops in it", async () => {
    const g = await start();
    // Flown into the sand: no speed left the moment it comes down.
    const landed = py(g, `ROUND['hole'] = 5\nb = SimpleNamespace(x=350, y=240, z=0, vx=0, vy=0, vz=0, moving=False, flying=False, last=(0, 0), club=0, wind=(0, 0))
hit(b, 1, 0.5, 0, (0, 0))
while b.flying: roll(b, hole_now())
(ground(hole_now(), b.x, b.y), b.vx, b.vy)`);
    expect(landed).toEqual(["sand", 0, 0]);
    // Rolled in at 4 pixels a step, from the sand's left edge: it stops a few pixels in. On the fairway it runs on.
    const run = (x: number, y: number) =>
      py(g, `b = SimpleNamespace(x=${x}, y=${y}, z=0, vx=4, vy=0, vz=0, moving=True, flying=False, last=(0, 0), club=3, wind=(0, 0))
while not roll(b, hole_now()): pass
round(b.x - ${x})`) as number;
    expect(run(431, 240)).toBeLessThan(20);
    expect(run(260, 245)).toBeGreaterThan(60);
  });

  it("takes a stroke for water, and plays again from where the shot was", async () => {
    const g = await start();
    press(g, "space");
    step(g, 12);
    py(g, "ROUND['hole'] = 4\nstart_hole()\naim_at_pin(g)"); // the island green
    press(g, "space");
    py(g, "g.club = 1\ng.aim = point_direction(*hole_now()['tee'], *hole_now()['cup'])");
    const tee = py(g, "(BALLS[0].x, BALLS[0].y)") as [number, number];
    press(g, "space");
    for (let i = 0; i < 100 && (py(g, "g.power") as number) < 0.9; i++) step(g);
    press(g, "space"); // an iron, nearly full: into the lake in front of the green
    for (let i = 0; i < 2000 && py(g, "g.mode") === "rolling"; i++) step(g);
    expect(py(g, "g.words")).toContain("water");
    expect(py(g, "ROUND['strokes'][0]")).toBe(2);
    expect(py(g, "(BALLS[0].x, BALLS[0].y)")).toEqual(tee);
  });

  it("drops a gentle putt in the cup, and lips out one hit too hard", async () => {
    const g = await start();
    const putt = (speed: number) =>
      py(g, `ROUND['hole'] = 0\ncx, cy = hole_now()['cup']\nb = SimpleNamespace(x=cx - 60, y=cy, z=0, vx=${speed}, vy=0, vz=0, moving=True, flying=False, last=(0, 0), club=3, wind=(0, 0))
r = None
while not r: r = roll(b, hole_now())
r`) as string;
    expect(putt(1.9)).toBe("holed");
    expect(putt(7)).toBe("stopped");
  });

  it("bounces a ball back off a tree", async () => {
    const g = await start();
    const back = py(g, `ROUND['hole'] = 0\ntx, ty, r = hole_now()['trees'][0]
b = SimpleNamespace(x=tx - r - 20, y=ty, z=0, vx=4, vy=0, vz=0, moving=True, flying=False, last=(0, 0), club=1, wind=(0, 0))
for _ in range(30): roll(b, hole_now())
(b.x < tx - r * 0.5, b.vx <= 0)`);
    expect(back).toEqual([true, true]);
  });

  it("lets whoever is furthest from the pin play next, with two players", async () => {
    const g = await start();
    press(g, "right"); // 2 players
    expect(py(g, "g.players")).toBe(2);
    press(g, "space");
    expect(py(g, "ROUND['players']")).toBe(2);
    py(g, "cx, cy = hole_now()['cup']\nBALLS[0].x, BALLS[0].y = cx - 300, cy\nBALLS[1].x, BALLS[1].y = cx - 100, cy");
    expect(py(g, "next_player()")).toBe(0);
    py(g, "BALLS[0].x = cx - 50");
    expect(py(g, "next_player()")).toBe(1);
    py(g, "ROUND['holed'][1] = True");
    expect(py(g, "next_player()")).toBe(0);
    py(g, "ROUND['holed'][0] = True");
    expect(py(g, "next_player() is None")).toBe(true);
  });

  it("won't build a course with a cup off its green, a tee in the water, or a hole too short for its par", () => {
    const BUILD = resolve(__dirname, "../../../showcase/golf/build.py");
    const refuses = (change: string) => {
      const script = `import importlib.util, sys
spec = importlib.util.spec_from_file_location("golf_build", ${JSON.stringify(BUILD)})
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
h = b.HOLES[0]
${change}
try:
    b.check_course()
    print("built")
except SystemExit as e:
    print(e)`;
      return execFileSync("python3", ["-c", script], { encoding: "utf8" }).trim();
    };
    expect(refuses("pass")).toBe("built");
    expect(refuses('h["cup"] = (h["cup"][0] + 120, h["cup"][1])')).toContain("the cup isn't on the green");
    expect(refuses('h["water"] = [(h["tee"][0], h["tee"][1], 40, 40)]')).toContain("the tee is in the water");
    expect(refuses('h["tee"] = (h["cup"][0] - 200, h["cup"][1])')).toContain("par 4 wants");
  });

  it("names the scores, and keeps the card against par", async () => {
    const g = await start();
    expect(py(g, "[score_words(s, 4) for s in (1, 2, 3, 4, 5, 6, 8)]")).toEqual([
      "HOLE IN ONE!", "Eagle!", "Birdie!", "Par.", "Bogey.", "Double bogey.", "4 over par.",
    ]);
    py(g, "new_round(1)\nROUND['cards'][0][0] = 3\nROUND['cards'][0][1] = 4");
    expect(py(g, "against_par(0)")).toBe("E"); // 3 on a par 4, 4 on a par 3
  });
});
