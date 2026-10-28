/**
 * The third showcase game, Mystery Meat from Outer Space, played headless in
 * the real Pyodide: the whole adventure from the title to the front page,
 * the doors that must stay shut until they shouldn't, and every room drawn.
 * Runs when the game has been built (python3 showcase/mystery/build.py,
 * which makes stand-in pictures for any the teacher hasn't made yet).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/mystery/out/project.json");
const have = existsSync(BUILT);

async function start() {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const warnings: string[] = [];
  const { game, error } = await PythonGame.load(def, { stdout: () => undefined, stderr: () => undefined, warning: (s) => warnings.push(s) });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  game.engine.input.keyDown(KEY_CODE.get("enter")!); // New game
  step(game, 1);
  game.engine.input.keyUp(KEY_CODE.get("enter")!);
  step(game, 1);
  play(game);
  return { game, warnings };
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}

const py = (g: PythonGame, expr: string) => g.evalPython(expr) as never;

/** Plays whatever is queued, clicking through the talking, until the game waits for the player. */
function play(g: PythonGame) {
  for (let i = 0; i < 4000 && py(g, "bool(QUEUE)"); i++) {
    g.engine.input.mouseDown(0);
    step(g, 1);
    g.engine.input.mouseUp(0);
    step(g, 1);
  }
  step(g, 2);
  expect(py(g, "bool(QUEUE)")).toBe(false);
}

/** A verb and a thing (and a second, for Use and Give), played out. */
function act(g: PythonGame, verb: string, a: string, b?: string) {
  py(g, `STATE['verb'] = ${JSON.stringify(verb)}; click_thing(${JSON.stringify(a)})` + (b ? `; click_thing(${JSON.stringify(b)})` : ""));
  play(g);
}
const say = (g: PythonGame, i: number) => {
  py(g, `choose_option(${i})`);
  play(g);
};
/** A Python puzzle on screen: picks the answer marked right. */
function solve(g: PythonGame) {
  const pid = py(g, "STATE['code']") as string;
  expect(pid).toBeTruthy();
  say(g, py(g, `[a[1] for a in PUZZLES[${JSON.stringify(pid)}]['answers']].index(True)`) as number);
  expect(py(g, "STATE['code'] is None")).toBe(true);
}
const room = (g: PythonGame) => py(g, "STATE['room']") as string;
const has = (g: PythonGame, item: string) => py(g, `has(${JSON.stringify(item)})`) as boolean;
const options = (g: PythonGame) => py(g, "[o[0] for o in STATE['menu'] or []]") as string[];

describe.skipIf(!have)("Mystery Meat from Outer Space", () => {
  it("plays from the newsroom to the front page", async () => {
    const { game: g, warnings } = await start();
    expect(room(g)).toBe("newsroom");
    act(g, "pick", "shelf_camera");
    expect(has(g, "camera")).toBe(true);
    act(g, "walk", "door");
    expect(room(g)).toBe("hallway");

    act(g, "walk", "door_office");
    act(g, "open", "radio");
    act(g, "use", "batteries", "camera");
    expect(py(g, "flag('camera_loaded') and not has('batteries')")).toBe(true);
    act(g, "use", "intercom");
    solve(g);
    expect(options(g)[0]).toContain("Ms. Glorbin");
    say(g, 0);
    expect(py(g, "flag('glorbin_away')")).toBe(true);

    act(g, "walk", "door_hall");
    act(g, "walk", "door_cafe");
    act(g, "pick", "cartons");
    act(g, "use", "carton", "food");
    expect(has(g, "sample")).toBe(true);
    act(g, "walk", "door_kitchen");
    expect(room(g)).toBe("kitchen");
    act(g, "open", "freezer");
    expect(has(g, "ice")).toBe(false); // a keypad first
    solve(g);
    expect(has(g, "ice")).toBe(true);

    act(g, "walk", "door_cafe");
    act(g, "walk", "door_hall");
    act(g, "walk", "door_base");
    expect(room(g)).toBe("basement");
    act(g, "talk", "gus");
    expect(options(g)).toContain("Can you test this?");
    say(g, options(g).indexOf("Can you test this?"));
    expect(has(g, "hotsauce")).toBe(false); // the Analyzer crashes
    solve(g);
    expect(has(g, "hotsauce") && !has(g, "sample")).toBe(true);
    act(g, "pick", "foilshelf");
    act(g, "use", "ice", "boiler");
    expect(has(g, "keycard")).toBe(true);
    act(g, "use", "tinfoil");
    expect(py(g, "flag('hat_on')")).toBe(true);

    act(g, "walk", "stairs_up");
    act(g, "walk", "door_cafe");
    act(g, "use", "hotsauce", "dot");
    say(g, options(g).indexOf("Can I borrow the roof key?"));
    expect(has(g, "roofkey")).toBe(true);
    say(g, options(g).indexOf("Bye."));

    act(g, "walk", "door_hall");
    act(g, "use", "roofkey", "stairs");
    expect(room(g)).toBe("roof");
    act(g, "use", "telescope");
    act(g, "use", "keycard", "antenna");
    solve(g);
    expect(room(g)).toBe("mothership");
    act(g, "use", "camera", "commander");
    expect(has(g, "photo")).toBe(true);
    act(g, "use", "hotsauce", "machine");
    solve(g);
    expect(py(g, "STATE.get('ended')")).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("keeps doors shut until they shouldn't be", async () => {
    const { game: g } = await start();
    act(g, "walk", "door");
    act(g, "walk", "stairs");
    expect(room(g)).toBe("hallway"); // chained
    act(g, "walk", "door_cafe");
    act(g, "walk", "door_kitchen");
    expect(room(g)).toBe("cafeteria"); // Ms. Glorbin won't let you
    // The antenna without a tin hat: back on the roof, asleep.
    py(g, "STATE.update(room='roof', items=['keycard'])");
    act(g, "use", "keycard", "antenna");
    solve(g);
    expect(room(g)).toBe("roof");
    // The finale without a photo: not yet.
    py(g, "STATE.update(room='mothership', items=['hotsauce'])");
    act(g, "use", "hotsauce", "machine");
    expect(py(g, "STATE.get('ended')")).toBeFalsy();
  });

  it("a wrong answer to a Python puzzle says why and asks again; Never mind leaves it locked", async () => {
    const { game: g } = await start();
    const pids = py(g, "list(PUZZLES)") as string[];
    expect(pids.length).toBe(5);
    py(g, "STATE.update(room='kitchen')");
    act(g, "open", "freezer");
    expect(py(g, "STATE['code']")).toBe("freezer");
    const answers = py(g, "[a[1] for a in PUZZLES['freezer']['answers']]") as boolean[];
    for (let i = 0; i < answers.length; i++) {
      if (answers[i]) continue;
      say(g, i);
      expect(py(g, "STATE['code']")).toBe("freezer");
      expect(options(g)).toContain("Never mind.");
      expect(has(g, "ice")).toBe(false);
    }
    // Picked by the mouse, which in a browser is never on a whole pixel.
    py(g, `choose_option(option_at(30.4, SENTENCE_Y + 10 + 11 * ${options(g).indexOf("Never mind.")} + 3.7))`);
    play(g);
    expect(py(g, "STATE['code'] is None")).toBe(true);
    expect(py(g, "flag('freezer_open')")).toBe(false);
    // Solved once, it stays solved: the second time there's no puzzle.
    act(g, "open", "freezer");
    solve(g);
    act(g, "open", "freezer");
    expect(py(g, "STATE['code'] is None")).toBe(true);
    expect(py(g, "STATE['menu'] is None")).toBe(true);
  });

  it("a click on a wall walks to the foot of it; one click finishes one line, not the whole talk", async () => {
    const { game: g } = await start();
    py(g, "click_floor(100, 20)");
    play(g);
    expect(py(g, "inside(STATE['x'], STATE['y'], ROOMS[STATE['room']]['walk'])")).toBe(true);
    py(g, 'say_line("robin", "One."); say_line("robin", "Two.")');
    step(g, 3);
    expect(py(g, "SPEECH.get('text')")).toBe("One.");
    g.engine.input.mouseDown(0);
    step(g, 1);
    g.engine.input.mouseUp(0);
    step(g, 1);
    expect(py(g, "SPEECH.get('text')")).toBe("Two.");
  });

  it("answers everything with something: no click anywhere goes unanswered or breaks", async () => {
    const { game: g } = await start();
    const rooms = py(g, "list(ROOMS)") as string[];
    for (const r of rooms) {
      py(g, `STATE.update(room=${JSON.stringify(r)}, x=150, y=124)`);
      step(g, 2);
      const ids = py(g, "[s['id'] for s in spots()]") as string[];
      for (const id of ids) {
        for (const v of ["look", "pick", "open", "push", "talk"]) {
          py(g, `STATE.update(room=${JSON.stringify(r)}, menu=None)`);
          act(g, v, id);
          if (py(g, "STATE['menu']")) py(g, "STATE.update(menu=None, code=None)");
        }
      }
    }
    // The notepad always has a next step.
    expect((py(g, "next_step()") as string).length).toBeGreaterThan(10);
  });
});
