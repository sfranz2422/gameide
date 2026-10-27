/**
 * A GameRunner (checks/checks.ts) for the tutorial walkthrough tests: the
 * project built exactly as Play builds it, run in node's Pyodide. Each
 * time steps() is asked it says how far the game has got and then runs it a
 * little further, which is how a check's "after 1 second" moves on without
 * a clock.
 */
import type { GameRunner } from "../checks/checks";
import { KEY_CODE } from "../engine/input";
import { getPyodide, PythonGame } from "../python/bridge";
import { buildGame } from "../python/codegen";
import type { Project } from "../store/project";

/** A GameRunner on a PythonGame in node: steps() runs the game a few steps each time it's asked. */
export function nodeRunner(project: () => Project): GameRunner {
  let game: PythonGame | null = null;
  let errors: string[] = [];
  return {
    stepsPerSecond: 60,
    async steps() {
      if (!game) return 0;
      const count = Number(game.evalPython("__import__('gameide')._step_count"));
      // One step at a time at first, so "after 0.1 seconds" is 6 steps and
      // not 20 (a check's first call only asks where the count starts, and
      // ten steps a call put a short-lived slash out of existence before it
      // was looked at); ten at a time after that, so a 10-second check
      // doesn't take a minute.
      for (let i = 0; i < (count < 30 ? 1 : 10) && !game.isStopped; i++) {
        const e = game.step();
        if (e) errors.push(e.message);
      }
      return count;
    },
    async start() {
      errors = [];
      // The same random numbers every run: a lesson's checks must pass for
      // every student, and a test that passed by luck would hide one that doesn't.
      (await getPyodide()).runPython("import random; random.seed(7)");
      const { game: g, error } = await PythonGame.load(buildGame(project(), new Map()).def);
      if (error) throw new Error(`The game stopped with an error: ${error.message}`);
      game = g;
    },
    stop() {
      game?.dispose();
      game = null;
    },
    hold(key, down) {
      const code = KEY_CODE.get(key)!;
      if (down) game!.engine.input.keyDown(code);
      else game!.engine.input.keyUp(code);
    },
    async py(expr) {
      try {
        return game!.evalPython(expr);
      } catch (e) {
        return { error: String(e) };
      }
    },
    errors: () => [...errors],
  };
}

