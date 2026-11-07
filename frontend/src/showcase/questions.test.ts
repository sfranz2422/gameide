/**
 * Each showcase game says when a Python check question would be fair
 * (question_ok): never mid-race, mid-shot, mid-play or mid-jump. Played
 * headless: each game is put in the moment and this reads what reached the page.
 * A game not built here is skipped.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import type { Project } from "../store/project";
import { KEY_CODE } from "../engine/input";

const built = (folder: string) => resolve(__dirname, "../../../showcase", folder, "out", "project.json");

async function start(folder: string) {
  const project = JSON.parse(readFileSync(built(folder), "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const oks: boolean[] = [];
  const { game, error } = await PythonGame.load(def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined, questionOk: (ok) => oks.push(ok),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const e = game.step();
      if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
    }
  };
  step(2);
  return {
    step,
    py: (code: string) => game.evalPython(code) as never,
    press: (k: string) => {
      game.engine.input.keyDown(KEY_CODE.get(k)!);
      step();
      game.engine.input.keyUp(KEY_CODE.get(k)!);
      step();
    },
    /** Is now fair, as the page last heard? (A game that's said nothing is.) */
    fair: () => oks.at(-1) ?? true,
  };
}

const on = (folder: string) => describe.runIf(existsSync(built(folder)));

on("kart")("Zoomtown Cup", () => {
  it("never mid-race: the countdown, the finish and the screens between are fine", async () => {
    const g = await start("kart");
    expect(g.fair()).toBe(true);
    g.py('g = instances("Game")[0]\nnew_race(0, 0)\ng.mode = "race"\nRACE["count"] = 0');
    g.step(2);
    expect(g.fair()).toBe(false);
    g.py('RACE["count"] = 100');
    g.step();
    expect(g.fair()).toBe(true);
    g.py('RACE["count"] = 0\nRACE["karts"][0].done = RACE["steps"]');
    g.step();
    expect(g.fair()).toBe(true);
  });
});

on("hillclimb")("Ridgeline Rally", () => {
  it("never while the car's moving; standing still on its wheels is fine", async () => {
    const g = await start("hillclimb");
    g.py('g = instances("Game")[0]\nstart_run(STAGES[0]["name"], "Jeep", levels_of("Jeep"))\ng.mode, g.ended = "race", None');
    // Dropped onto the track: still settling.
    g.step(240);
    expect(g.fair(), "settled, standing still").toBe(true);
    g.py('RUN["car"].vx = 6');
    g.step();
    expect(g.fair()).toBe(false);
  });
});

on("golf")("Greenside", () => {
  it("never mid-swing or while the ball rolls", async () => {
    const g = await start("golf");
    const checked: string[] = [];
    for (const [mode, fair] of [["swing", false], ["aim", true], ["rolling", false], ["after", true]] as const) {
      g.py(`instances("Game")[0].mode = "${mode}"`);
      g.step();
      // Some moments end by themselves at once (an empty swing goes back to aiming): check only those still on.
      if (g.py('instances("Game")[0].mode') === mode) {
        expect(g.fair(), mode).toBe(fair);
        checked.push(mode);
      }
    }
    expect(checked, "a fair moment and an unfair one were both checked").toEqual(expect.arrayContaining(["aim"]));
    expect(checked.some((m) => m === "swing" || m === "rolling")).toBe(true);
  });
});

on("football")("Under the Lights", () => {
  it("never during a live play", async () => {
    const g = await start("football");
    g.py('instances("Game")[0].mode = "live"');
    g.step();
    expect(g.fair()).toBe(false);
    g.py('instances("Game")[0].mode = "whistle"');
    g.step();
    expect(g.fair()).toBe(true);
  });
});

on("baseball")("Moonshot", () => {
  it("never from the windup to the end of the play", async () => {
    const g = await start("baseball");
    g.py("g = instances('Game')[0]\nstart(g, 'game', {'away': None, 'home': 0})");   // you pitch first
    g.step(12);
    expect(g.py("g.mode")).toBe("ready");
    expect(g.fair()).toBe(true);
    g.press("z");
    expect(g.py("g.mode")).toBe("windup");
    expect(g.fair()).toBe(false);
    for (let i = 0; i < 3000 && g.py("g.mode") !== "result"; i++) {
      g.step();
      if (["pitch", "hit", "field"].includes(g.py("g.mode"))) expect(g.fair()).toBe(false);
    }
    g.step();
    expect(g.fair()).toBe(true);
  });
});

on("smash")("Jelly Jailbreak", () => {
  it("never while a shot flies", async () => {
    const g = await start("smash");
    g.py('room_goto(LEVELS[0]["name"])');
    g.step(3);
    expect(g.fair()).toBe(true);
    g.py('global_vars.mode = "flying"');
    g.step();
    expect(g.fair()).toBe(false);
    g.py('global_vars.mode = "aim"');
    g.step();
    expect(g.fair()).toBe(true);
  });
});

on("towers")("Fort Bramble", () => {
  it("between waves, never while one's on its way", async () => {
    const g = await start("towers");
    g.py('room_goto(LEVELS[0]["name"])');
    g.step(3);
    expect(g.fair()).toBe(true);
    g.py("send_wave(global_vars.director)");
    g.step(3);
    expect(g.fair()).toBe(false);
    g.py('instances("Gate")[0].queue.clear()\nfor e in instances("Enemy"):\n    e.destroy()');
    g.step(3);
    expect(g.fair()).toBe(true);
  });
});

on(".")("Thornwood", () => {
  it("standing on the ground, never mid-jump", async () => {
    const g = await start(".");
    g.py("new_game()\nglobal_vars.level = 0\nroom_goto('Thornwood')");
    g.step(60);
    expect(g.fair()).toBe(true);
    g.py("p = player()\np.y -= 120\np.on_ground = False");
    g.step(3);
    expect(g.fair()).toBe(false);
    g.step(120);
    expect(g.fair()).toBe(true);
  });
});
