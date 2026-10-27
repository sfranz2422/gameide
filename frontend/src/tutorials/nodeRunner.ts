/**
 * A GameRunner (checks/checks.ts) for the tutorial walkthrough tests: the
 * project built exactly as Play builds it, run in node's Pyodide. steps()
 * runs the game ten steps each time it's asked, which is how a check's
 * "after 1 second" moves on without a clock.
 */
import type { GameRunner } from "../checks/checks";
import { KEY_CODE } from "../engine/input";
import { PythonGame } from "../python/bridge";
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
      for (let i = 0; i < 10 && !game.isStopped; i++) {
        const e = game.step();
        if (e) errors.push(e.message);
      }
      return Number(game.evalPython("__import__('gameide')._step_count"));
    },
    async start() {
      errors = [];
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

