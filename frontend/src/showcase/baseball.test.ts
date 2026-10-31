/**
 * The sixth showcase game, Moonshot (baseball), played headless in the real
 * Pyodide. Bots play it through the game's own keys: a whole Home Run Derby,
 * and a whole three-inning game against the computer, batting and pitching.
 * The batting bot reads where a pitch will cross once it's thrown (what a
 * good batter's eye does), holds up or down until its swing is there, and
 * presses Z in time; so if it hits home runs, the swing, the flight and
 * the fence all work as drawn. The computer plays itself through whole
 * games too. Then each rule on its own: the strike zone, the count, walks,
 * outs, runners and runs, how innings and the game end, a pitch's path, a
 * swing's timing, the ball's flight and who fields it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/baseball/out/project.json");
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
const down = (g: PythonGame, key: string) => g.engine.input.keyDown(KEY_CODE.get(key)!);
const up = (g: PythonGame, key: string) => g.engine.input.keyUp(KEY_CODE.get(key)!);
function press(g: PythonGame, key: string) {
  down(g, key);
  step(g);
  up(g, key);
  step(g);
}

/** The same "random" numbers every run, from -1 to 1: the bot's human error. */
let seed = 12345;
function wobble() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return (seed / 2147483648) * 2 - 1;
}

/**
 * One pitch, batted by the bot through the keys (`swing`: up, down, Z) and,
 * if `swingAt` says so, swung at in time — a person's time: up to `late`
 * steps early or late, and up to `off` feet high or low. Steps until the
 * pitch is settled and its words are on screen. Returns those words.
 */
function batPitch(
  g: PythonGame,
  keys: { up: string; down: string; swing: string },
  swingAt: (x: number, z: number) => boolean,
  late = 4,
  off = 0.3,
) {
  for (let i = 0; i < 400 && py(g, "g.mode") !== "pitch"; i++) step(g);
  const [x, z, steps] = py(g, "(AB['pitch']['x'], AB['pitch']['z'], AB['pitch']['steps'])") as [number, number, number];
  const swing = swingAt(x, z);
  const want = z - 0.22 + wobble() * off; // a little under the ball's middle: it lifts
  const when = steps - (py(g, "SWING_STEPS") as number) - 1 + Math.round(wobble() * late);
  for (let i = 0; i < 400 && py(g, "g.mode") === "pitch"; i++) {
    const aim = py(g, "MATCH['aim']") as number;
    up(g, keys.up);
    up(g, keys.down);
    if (aim < want - 0.04) down(g, keys.up);
    else if (aim > want + 0.04) down(g, keys.down);
    if (swing && py(g, "AB['t']") === when) {
      // Up and down really moved the swing to where the bot wanted it.
      expect(Math.abs(aim - Math.min(4, Math.max(1.1, want)))).toBeLessThan(0.1);
      down(g, keys.swing);
    }
    step(g);
    up(g, keys.swing);
  }
  up(g, keys.up);
  up(g, keys.down);
  for (let i = 0; i < 2000 && py(g, "g.mode") !== "result"; i++) step(g);
  expect(py(g, "g.mode")).toBe("result");
  return py(g, "AB['words']") as string;
}

/** Plays one result screen off: waits it out. */
function nextPitch(g: PythonGame) {
  for (let i = 0; i < 400 && ["result", "half"].includes(py(g, "g.mode")); i++) step(g);
}

const STRIKE = (x: number, z: number) => Math.abs(x) <= 0.83 && z >= 1.5 && z <= 3.5;

/** The rules alone: a fresh game with this many balls, strikes, outs and runners. */
function setCount(g: PythonGame, balls: number, strikes: number, outs = 0, bases = "[False, False, False]", half = "top", inning = 1) {
  py(g, `new_game()
GAME.update(balls=${balls}, strikes=${strikes}, outs=${outs}, bases=${bases}, half="${half}", inning=${inning})
if "${half}" == "bottom": GAME["line"]["home"] = [0] * ${inning}
GAME["line"]["away"] = [0] * ${inning}`);
}
const pitchAt = (x: number, z: number) => `{'kind': 0, 'x': ${x}, 'z': ${z}, 'steps': 57}`;

describe.skipIf(!have)("Moonshot", () => {
  it("is played through a whole Home Run Derby by a bot, through the keys: home runs, ten outs, the records kept", async () => {
    const g = await start(4);
    expect(py(g, "g.mode")).toBe("title");
    step(g, 12);
    press(g, "z"); // Home Run Derby is first on the menu
    expect(py(g, "MATCH['kind']")).toBe("derby");
    const words: string[] = [];
    for (let n = 0; n < 60 && py(g, "g.mode") !== "final"; n++) {
      words.push(batPitch(g, { up: "up", down: "down", swing: "z" }, STRIKE));
      nextPitch(g);
    }
    expect(py(g, "g.mode")).toBe("final");
    expect(py(g, "DERBY['outs']")).toBe(10);
    const homers = py(g, "DERBY['homers']") as number;
    const longest = py(g, "DERBY['longest']") as number;
    expect(homers, words.join(" | ")).toBeGreaterThanOrEqual(5);
    expect(words.filter((w) => w.startsWith("HOME RUN")).length).toBe(homers);
    expect(longest).toBeGreaterThan(400);
    expect(py(g, "save_get('derby_homers')")).toBe(homers);
    expect(py(g, "save_get('derby_longest')")).toBe(longest);
    expect(py(g, "DERBY['record']")).toBe(true);
    // A worse round leaves the records as they were.
    py(g, "new_derby()\nDERBY['homers'] = 1\nDERBY['longest'] = 350\nderby_save()");
    expect(py(g, "(save_get('derby_homers'), save_get('derby_longest'), DERBY['record'])")).toEqual([homers, longest, false]);
    step(g, 95);
    press(g, "z");
    expect(py(g, "g.mode")).toBe("title");
  }, 600_000);

  it("is played through a whole game against the computer, batting and pitching, through the keys", async () => {
    const g = await start(7);
    step(g, 12);
    press(g, "down");
    expect(py(g, "g.menu")).toBe(1); // one press, one step down the menu
    press(g, "z");
    expect(py(g, "(MATCH['kind'], MATCH['humans'])")).toEqual(["game", { away: 0, home: undefined }]);
    let pitched = 0;
    let batted = 0;
    const kinds = new Set<number>();
    for (let n = 0; n < 600 && py(g, "g.mode") !== "final"; n++) {
      for (let i = 0; i < 400 && ["result", "half", "hit", "field"].includes(py(g, "g.mode")); i++) step(g);
      if (py(g, "g.mode") === "final") break;
      if (py(g, "batting()") === "away") {
        batPitch(g, { up: "up", down: "down", swing: "z" }, STRIKE);
        batted++;
      } else {
        // Pitching: a different pitch each time (X), aimed low and away with the arrows, then Z.
        step(g, 12);
        for (let k = 0; k < pitched % 4; k++) press(g, "x");
        const want = py(g, "AB['kind']") as number;
        down(g, "right");
        down(g, "down");
        step(g, 10);
        up(g, "right");
        up(g, "down");
        expect(py(g, "AB['target'][0]")).toBeGreaterThan(0.4);
        expect(py(g, "AB['target'][1]")).toBeLessThan(2.1);
        press(g, "z");
        for (let i = 0; i < 100 && py(g, "g.mode") !== "pitch"; i++) step(g);
        expect(py(g, "AB['pitch']['kind']")).toBe(want);
        kinds.add(want);
        pitched++;
        for (let i = 0; i < 2000 && py(g, "g.mode") !== "result"; i++) step(g);
      }
    }
    expect(py(g, "g.mode")).toBe("final");
    expect(py(g, "GAME['inning']")).toBeGreaterThanOrEqual(3);
    expect(kinds.size).toBe(4);
    expect(batted).toBeGreaterThan(5);
    expect(pitched).toBeGreaterThan(5);
    const [score, line] = py(g, "(GAME['score'], GAME['line'])") as [Record<string, number>, Record<string, number[]>];
    for (const t of ["away", "home"]) expect(line[t]!.reduce((a, b) => a + b, 0)).toBe(score[t]);
    expect(score.away! + score.home!).toBeGreaterThan(0);
  }, 600_000);

  it("plays whole games, the computer against itself, to a final score like baseball's", async () => {
    let runs = 0;
    for (const seed of [1, 2, 3]) {
      const g = await start(seed);
      py(g, "start(g, 'game', {'away': None, 'home': None}, demo=True)");
      const words = new Set<string>();
      let was = "";
      for (let i = 0; i < 60 * 60 * 30 && py(g, "g.mode") !== "final"; i++) {
        step(g);
        const mode = py(g, "g.mode") as string;
        if (mode === "result" && was !== "result") words.add((py(g, "AB['words']") as string).split(/[.!]/)[0]!.split(" to ")[0]!);
        was = mode;
      }
      expect(py(g, "g.mode")).toBe("final");
      const s = py(g, "GAME['score']") as Record<string, number>;
      expect(py(g, "GAME['over']")).toBe(true);
      expect(py(g, "GAME['inning']")).toBeGreaterThanOrEqual(3);
      expect(s.away! + s.home!).toBeLessThan(30);
      runs += s.away! + s.home!;
      for (const w of ["Strike", "Ball", "Swing and a miss", "Single"]) expect(words, [...words].join(" | ")).toContain(w);
      expect([...words].some((w) => w.endsWith("out"))).toBe(true);
    }
    expect(runs).toBeGreaterThan(2);
  }, 600_000);

  it("knows the strike zone: over the plate, knees to letters", async () => {
    const g = await start();
    const zone = (x: number, z: number) => py(g, `is_strike(${x}, ${z})`) as boolean;
    expect(zone(0, 2.5)).toBe(true);
    expect(zone(0.83, 1.5)).toBe(true); // a corner, just touched
    expect(zone(-0.83, 3.5)).toBe(true);
    expect(zone(0.9, 2.5)).toBe(false); // outside
    expect(zone(-0.9, 2.5)).toBe(false);
    expect(zone(0, 3.6)).toBe(false); // high
    expect(zone(0, 1.4)).toBe(false); // in the dirt
  });

  it("counts balls and strikes: a foul is a strike but never the third, three strikes is an out", async () => {
    const g = await start();
    setCount(g, 0, 0);
    expect(py(g, `call_pitch(${pitchAt(0, 2.5)}, False, None)`)).toBe("Strike!");
    expect(py(g, `call_pitch(${pitchAt(1.5, 2.5)}, False, None)`)).toBe("Ball.");
    expect(py(g, `call_pitch(${pitchAt(0, 2.5)}, False, {'result': 'foul', 'words': 'Foul ball'})`)).toBe("Foul ball.");
    expect(py(g, "(GAME['balls'], GAME['strikes'])")).toEqual([1, 2]);
    py(g, `call_pitch(${pitchAt(0, 2.5)}, False, {'result': 'foul', 'words': 'Foul ball'})`);
    expect(py(g, "GAME['strikes']")).toBe(2); // fouled off with two strikes: still two
    expect(py(g, `call_pitch(${pitchAt(1.5, 0.8)}, True, None)`)).toContain("Struck him out"); // chased one in the dirt
    expect(py(g, "(GAME['outs'], GAME['balls'], GAME['strikes'])")).toEqual([1, 0, 0]);
    setCount(g, 0, 2);
    expect(py(g, `call_pitch(${pitchAt(0.2, 2.0)}, False, None)`)).toContain("Strike three");
    expect(py(g, "GAME['outs']")).toBe(1);
  });

  it("walks on ball four, and moves up only the runners the batter pushes", async () => {
    const g = await start();
    setCount(g, 3, 1, 0, "[False, True, False]");
    expect(py(g, `call_pitch(${pitchAt(1.4, 2.5)}, False, None)`)).toContain("Ball four");
    expect(py(g, "GAME['bases']")).toEqual([true, true, false]); // the runner on second stays: nobody pushed him
    expect(py(g, "(GAME['balls'], GAME['strikes'])")).toEqual([0, 0]);
    setCount(g, 3, 0, 0, "[True, True, True]");
    expect(py(g, `call_pitch(${pitchAt(0, 4.2)}, False, None)`)).toContain("A run scores");
    expect(py(g, "(GAME['bases'], GAME['score']['away'])")).toEqual([[true, true, true], 1]);
    setCount(g, 3, 0, 0, "[True, False, True]");
    py(g, `call_pitch(${pitchAt(0, 4.2)}, False, None)`);
    expect(py(g, "(GAME['bases'], GAME['score']['away'])")).toEqual([[true, true, true], 0]);
  });

  it("moves runners on hits, scores runs, and counts a grand slam as four", async () => {
    const g = await start();
    setCount(g, 1, 1, 0, "[True, False, True]");
    expect(py(g, `call_pitch(${pitchAt(0, 2.5)}, True, {'result': 'hit', 'bases': 2, 'words': 'Double!'})`)).toBe("Double!  A run scores!");
    expect(py(g, "(GAME['bases'], GAME['score']['away'], GAME['hits']['away'])")).toEqual([[false, true, true], 1, 1]);
    setCount(g, 0, 0, 0, "[True, True, True]");
    expect(py(g, `call_pitch(${pitchAt(0, 2.5)}, True, {'result': 'homer', 'bases': 4, 'words': 'HOME RUN!'})`)).toContain("4 runs score");
    expect(py(g, "(GAME['bases'], GAME['score']['away'], GAME['line']['away'])")).toEqual([[false, false, false], 4, [4]]);
    setCount(g, 0, 0, 0, "[False, True, False]");
    py(g, `call_pitch(${pitchAt(0, 2.5)}, True, {'result': 'hit', 'bases': 1, 'words': 'Single!'})`);
    expect(py(g, "GAME['bases']")).toEqual([true, false, true]);
  });

  it("counts outs: a ground out moves runners up, three outs end the half, and no run scores on the third", async () => {
    const g = await start();
    setCount(g, 0, 0, 1, "[True, False, True]");
    expect(py(g, `call_pitch(${pitchAt(0, 2.5)}, True, {'result': 'out', 'words': 'Ground out to SS'})`)).toContain("A run scores");
    expect(py(g, "(GAME['outs'], GAME['bases'], GAME['score']['away'])")).toEqual([2, [false, true, false], 1]);
    setCount(g, 0, 0, 1, "[False, False, True]");
    py(g, `call_pitch(${pitchAt(0, 2.5)}, True, {'result': 'out', 'words': 'Fly out to CF'})`);
    expect(py(g, "(GAME['outs'], GAME['bases'])")).toEqual([2, [false, false, true]]); // a fly out: the runner holds
    setCount(g, 0, 0, 2, "[False, False, True]");
    expect(py(g, `call_pitch(${pitchAt(0, 2.5)}, True, {'result': 'out', 'words': 'Ground out to 2B'})`)).toContain("three outs");
    expect(py(g, "(GAME['half_over'], GAME['score']['away'])")).toEqual([true, 0]);
    py(g, "end_half()");
    expect(py(g, "(GAME['half'], GAME['outs'], GAME['bases'], GAME['line']['home'])")).toEqual(["bottom", 0, [false, false, false], [0]]);
    py(g, "GAME['half_over'] = False\nfor _ in range(3): out('x')\nend_half()");
    expect(py(g, "(GAME['inning'], GAME['half'], GAME['line']['away'])")).toEqual([2, "top", [0, 0]]);
  });

  it("ends the game after three innings, skips the home team's last turn when they lead, and walks off", async () => {
    const g = await start();
    // After the top of the 3rd, the home team ahead: over, no bottom half.
    setCount(g, 0, 0, 0, "[False, False, False]", "top", 3);
    py(g, "GAME['score'] = {'away': 1, 'home': 2}\nend_half()");
    expect(py(g, "(GAME['over'], GAME['half'])")).toEqual([true, "top"]);
    // Behind after the top of the 3rd: they bat.
    setCount(g, 0, 0, 0, "[False, False, False]", "top", 3);
    py(g, "GAME['score'] = {'away': 2, 'home': 1}\nend_half()");
    expect(py(g, "(GAME['over'], GAME['half'])")).toEqual([false, "bottom"]);
    // Tied after three: a 4th inning.
    setCount(g, 0, 0, 0, "[False, False, False]", "bottom", 3);
    py(g, "GAME['score'] = {'away': 2, 'home': 2}\nend_half()");
    expect(py(g, "(GAME['over'], GAME['inning'], GAME['half'])")).toEqual([false, 4, "top"]);
    // Bottom of the 2nd, the home team goes ahead: nothing ends.
    setCount(g, 0, 0, 0, "[True, False, False]", "bottom", 2);
    py(g, `GAME['score'] = {'away': 1, 'home': 0}\ncall_pitch(${pitchAt(0, 2.5)}, True, {'result': 'homer', 'bases': 4, 'words': 'HOME RUN!'})`);
    expect(py(g, "GAME['over']")).toBe(false);
    // Bottom of the 3rd, tied, a runner on third, a single: the home team wins at once.
    setCount(g, 0, 0, 1, "[False, False, True]", "bottom", 3);
    py(g, `GAME['score'] = {'away': 3, 'home': 3}\ncall_pitch(${pitchAt(0, 2.5)}, True, {'result': 'hit', 'bases': 1, 'words': 'Single!'})`);
    expect(py(g, "(GAME['over'], winner())")).toEqual([true, "home"]);
    // Still tied after the most innings there can be: a tie.
    setCount(g, 0, 0, 0, "[False, False, False]", "bottom", 9);
    py(g, "GAME['score'] = {'away': 0, 'home': 0}\nend_half()");
    expect(py(g, "(GAME['over'], winner())")).toEqual([true, undefined]); // None comes to JavaScript as undefined
  });

  it("throws pitches that end where they were aimed, bend on the way, and come at different speeds", async () => {
    const g = await start();
    const [x, y, z] = py(g, "ball_at({'kind': 1, 'x': 0.3, 'z': 2.2, 'steps': 60}, 1)") as number[];
    expect(x).toBeCloseTo(0.3, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(2.2, 6);
    // Halfway, a curveball is well above the straight line from the hand to where it ends: it drops in late.
    const curveMid = py(g, "ball_at({'kind': 1, 'x': 0, 'z': 2.2, 'steps': 60}, 0.5)[2]") as number;
    const straight = (py(g, "RELEASE[2]") as number) * 0.5 + 2.2 * 0.5;
    expect(curveMid - straight).toBeGreaterThan(0.3);
    const steps = py(g, "[steps_to_plate(k) for k in range(len(PITCHES))]") as number[];
    expect(steps[0]).toBeLessThan(steps[2]!); // a fastball beats a changeup...
    expect(steps[2]).toBeLessThan(steps[1]!); // ...which beats a curveball
    expect(steps[0]).toBeGreaterThan(40); // and none is too quick to hit
  });

  it("hits a ball by the swing's timing and height: square and on time goes far, early pulls, late pushes, too far misses", async () => {
    const g = await start();
    const hit = (x: number, z: number, aim: number, late: number) =>
      py(g, `h = contact(${x}, ${z}, ${aim}, ${late})\nNone if h is None else (h['mph'], h['launch'], h['spray'])`) as [number, number, number] | null;
    const square = hit(0, 2.5, 2.25, 0)!;
    expect(square[0]).toBeGreaterThan(105);
    expect(square[1]).toBeGreaterThan(20);
    expect(square[1]).toBeLessThan(40);
    expect(hit(0, 2.5, 2.5, -5)![2]).toBeLessThan(-20); // early: pulled to left field
    expect(hit(0, 2.5, 2.5, 5)![2]).toBeGreaterThan(20); // late: pushed to right
    expect(hit(0, 2.5, 2.5, 3)![0]).toBeLessThan(square[0]); // a little late: less off the bat
    // A miss is None, which comes to JavaScript as undefined.
    expect(hit(0, 2.5, 2.5, 9)).toBeUndefined(); // far too late
    expect(hit(0, 2.5, 2.5, -9)).toBeUndefined(); // far too early
    expect(hit(0, 2.5, 3.2, 0)).toBeUndefined(); // swung over it
    expect(hit(0, 2.5, 1.8, 0)).toBeUndefined(); // swung under it
    expect(hit(1.4, 2.5, 2.5, 0)).toBeUndefined(); // out of reach
    expect(hit(0, 2.5, 2.1, 0)![1]).toBeGreaterThan(hit(0, 2.5, 2.7, 0)![1]); // under the ball lifts it; over it chops it down
    expect(py(g, "is_foul({'spray': 50}), is_foul({'spray': -44})")).toEqual([true, false]);
  });

  it("flies a hit: far enough and high enough is a home run, short of the fence or off the wall isn't", async () => {
    const g = await start();
    const flight = (mph: number, launch: number, spray = 0) =>
      py(g, `f = fly({'mph': ${mph}, 'launch': ${launch}, 'spray': ${spray}})\n(f['homer'], f['feet'], f['landed'] is not None)`) as [boolean, number, boolean];
    const [gone, far] = flight(112, 30);
    expect(gone).toBe(true);
    expect(far).toBeGreaterThan(420);
    expect(flight(95, 30)[0]).toBe(false); // a fly ball that comes down short of 400
    expect(flight(95, 30)[1]).toBeLessThan(400);
    expect(flight(105, 28, 40)[0]).toBe(true); // down the line it's only 330ish
    expect(flight(105, 12)[0]).toBe(false); // a line drive that hits the wall
    expect(py(g, "[round(fence_at(a)) for a in (0, 45, -45)]")).toEqual([400, 330, 330]);
  });

  it("fields a hit: a fly to an outfielder is caught, a grounder at the shortstop is an out at first, a ball in the gap is a hit", async () => {
    const g = await start();
    const play = (mph: number, launch: number, spray: number) =>
      py(g, `h = {'mph': ${mph}, 'launch': ${launch}, 'spray': ${spray}}\nj = judge(h, fly(h))\n(j['result'], j['words'], j.get('bases', 0))`) as [string, string, number];
    expect(play(90, 35, 0)).toEqual(["out", "Fly out to CF", 0]);
    expect(play(85, -8, -14)[1]).toBe("Ground out to SS");
    expect(play(70, 70, 5)[0]).toBe("out"); // a pop-up
    expect(play(70, 70, 5)[1]).toContain("Pop out");
    const gap = play(102, 19, -17); // a line drive between left and centre
    expect(gap[0]).toBe("hit");
    expect(gap[2]).toBeGreaterThanOrEqual(2);
    const through = play(100, -4, -28); // a hard grounder through the hole between short and third
    expect(through).toEqual(["hit", "Single!", 1]);
    expect(play(100, -4, -10)[1]).toBe("Ground out to SS"); // the same grounder at the shortstop
    expect(play(100, 25, 60)[0]).toBe("foul");
  });

  it("lets a person pitch: X changes the pitch, the arrows move the target, Z throws it there", async () => {
    const g = await start(2);
    py(g, "start(g, 'game', {'away': None, 'home': 0})"); // you're the Rattlers: you pitch first
    expect(py(g, "(g.mode, pitcher_is(), batter_is())")).toEqual(["ready", 0, undefined]);
    step(g, 12);
    press(g, "x");
    press(g, "x");
    expect(py(g, "AB['kind']")).toBe(2);
    const before = py(g, "AB['target']") as [number, number];
    down(g, "left");
    down(g, "up");
    step(g, 10);
    up(g, "left");
    up(g, "up");
    const after = py(g, "AB['target']") as [number, number];
    expect(after[0]).toBeLessThan(before[0] - 0.4);
    expect(after[1]).toBeGreaterThan(before[1] + 0.4);
    press(g, "z");
    expect(py(g, "g.mode")).toBe("windup");
    for (let i = 0; i < 100 && py(g, "g.mode") !== "pitch"; i++) step(g);
    expect(py(g, "AB['pitch']['kind']")).toBe(2);
    const [x, z] = py(g, "(AB['pitch']['x'], AB['pitch']['z'])") as [number, number];
    expect(Math.abs(x - after[0])).toBeLessThan(1.2);
    expect(Math.abs(z - after[1])).toBeLessThan(1.2);
  });

  it("gives two players a side of the keyboard each, and switches who bats after three outs", async () => {
    const g = await start();
    step(g, 12);
    press(g, "down");
    press(g, "down");
    expect(py(g, "g.menu")).toBe(2);
    press(g, "z");
    expect(py(g, "(MATCH['two'], MATCH['humans'])")).toEqual([true, { away: 0, home: 1 }]);
    expect(py(g, "(batter_is(), pitcher_is())")).toEqual([0, 1]); // the Bluebirds (WASD) bat first; arrows pitch
    step(g, 12);
    press(g, "o"); // player 2 changes the pitch with O...
    expect(py(g, "AB['kind']")).toBe(1);
    press(g, "x"); // ...and player 1's keys don't pitch
    expect(py(g, "AB['kind']")).toBe(1);
    press(g, "z");
    expect(py(g, "g.mode")).toBe("ready");
    press(g, "i");
    expect(py(g, "g.mode")).toBe("windup");
    for (let i = 0; i < 100 && py(g, "g.mode") !== "pitch"; i++) step(g);
    batPitch(g, { up: "w", down: "s", swing: "c" }, () => true);
    py(g, "GAME['half_over'] = True");
    nextPitch(g);
    expect(py(g, "(GAME['half'], batter_is(), pitcher_is())")).toEqual(["bottom", 1, 0]);
  });

  it("counts a Derby: a home run is a home run, any other swing an out, and a pitch taken costs nothing", async () => {
    const g = await start();
    py(g, "new_derby()");
    expect(py(g, "derby_swing({'result': 'homer', 'feet': 431, 'words': 'HOME RUN!  431 ft'})")).toContain("HOME RUN");
    expect(py(g, "derby_swing({'result': 'hit', 'bases': 2, 'feet': 380, 'words': 'Double!'})")).toContain("Out");
    expect(py(g, "derby_swing({'result': 'foul', 'feet': 200, 'words': 'Foul ball'})")).toContain("Out");
    expect(py(g, "derby_swing(None)")).toContain("Out");
    expect(py(g, "(DERBY['homers'], DERBY['outs'], DERBY['longest'])")).toEqual([1, 3, 431]);
    // Through the game: a pitch let go by is no out.
    py(g, "start(g, 'derby', {})");
    batPitch(g, { up: "up", down: "down", swing: "z" }, () => false);
    expect(py(g, "(DERBY['outs'], AB['words'])")).toEqual([0, "Taken.  No out."]);
    py(g, "DERBY['outs'] = DERBY_OUTS - 1");
    nextPitch(g);
    batPitch(g, { up: "up", down: "down", swing: "z" }, () => false);
    nextPitch(g);
    expect(py(g, "g.mode")).toBe("ready"); // still not over: taking pitches can't end a round
  });

  it("paints the ballpark from the rules: home plate where the camera sees it, the fence on the map where a ball meets it", () => {
    const BUILD = resolve(__dirname, "../../../showcase/baseball/build.py");
    const script = `import importlib.util, json, math
spec = importlib.util.spec_from_file_location("baseball_build", ${JSON.stringify(BUILD)})
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
R = b.R
def project(x, y, z):
    k = R["CAM_FOCAL"] / (y + R["CAM_BACK"])
    return round(R["CAM_MIDDLE"] + x * k), round(R["CAM_HORIZON"] + (R["CAM_HIGH"] - z) * k)
plate = b.plate_view().convert("RGB")
field = b.field_map().convert("RGB")
to_map = lambda x, y: (round(R["MAP_X"] + x * R["MAP_K"]), round(R["MAP_Y"] - y * R["MAP_K"]))
out = {
    "plate": plate.getpixel(project(0, 0.3, 0)),
    "beside_plate": plate.getpixel(project(0.7, 0.3, 0)) != plate.getpixel(project(0, 0.3, 0)),
    "mound_rubber": plate.getpixel(project(0, 60.5, 0)),
    # Beside the "400" painted on it, the wall a ball meets 3 degrees right of centre.
    "wall_centre": plate.getpixel(project(*(float(b.fence_at(3)) * f for f in (math.sin(math.radians(3)), math.cos(math.radians(3)))), 4)),
    "first_base": field.getpixel(to_map(*R["BASES"][1])),
    "fence_centre": field.getpixel(to_map(0, R["FENCE_CENTRE"] + 2)),
    "short_of_fence": field.getpixel(to_map(0, R["FENCE_CENTRE"] - 20)),
    "fence_line": field.getpixel(to_map(*((float(b.fence_at(44)) + 2) * f for f in (math.sin(math.radians(44)), math.cos(math.radians(44)))))),
}
print(json.dumps(out))`;
    const got = JSON.parse(execFileSync("python3", ["-c", script], { encoding: "utf8" })) as Record<string, unknown>;
    const chalk = [246, 246, 240];
    const wall = [30, 92, 64];
    expect(got.plate).toEqual(chalk);
    expect(got.beside_plate).toBe(true);
    // The rubber is far enough off to be a touch hazy at dusk, but chalk white still.
    for (const c of got.mound_rubber as number[]) expect(c).toBeGreaterThan(215);
    expect(got.wall_centre).toEqual(wall);
    expect(got.first_base).toEqual(chalk);
    expect(got.fence_centre).toEqual(wall);
    expect(got.short_of_fence).not.toEqual(wall); // the warning track
    expect(got.fence_line).toEqual(wall);
  });

  it("shows touch buttons for one player, and none for two", async () => {
    const g = await start();
    // touch_controls() hands its order to the next frame and forgets it, so it's watched here.
    py(g, "TOUCH = []\ndef touch_controls(show=True, buttons=('space', 'x'), always=False):\n    TOUCH.append(list(buttons) if show else None)");
    py(g, "start(g, 'derby', {})");
    expect(py(g, "TOUCH[-1]")).toEqual(["z", "x"]);
    py(g, "start(g, 'game', {'away': 0, 'home': None})");
    expect(py(g, "TOUCH[-1]")).toEqual(["z", "x"]);
    py(g, "start(g, 'game', {'away': 0, 'home': 1}, two=True)");
    expect(py(g, "TOUCH[-1]")).toBeUndefined();
    py(g, "go_title(g)");
    expect(py(g, "TOUCH[-1]")).toEqual(["z"]); // a phone can start a game from the title
  });
});
