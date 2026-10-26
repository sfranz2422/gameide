/**
 * A GameRunner (checks.ts) on a real GameHost: the editor's own, so a
 * student's Check my work plays in their game pane where they can watch it,
 * or a hidden one for the teacher's Check all.
 *
 * The host reports its state and errors through the callbacks it was made
 * with, which belong to whoever made it; `watch` is how they're passed on.
 */
import type { GameHost } from "../editor/gameHost";
import type { GameDefinition } from "../engine/game";
import type { GameState } from "../python/protocol";
import type { GameRunner } from "./checks";

export interface HostWatch {
  state(): GameState;
  /** Errors since the last clear(), as one line each. */
  errors: string[];
}

/** Long enough for Python to load the first time on a slow Chromebook. */
const START_TIMEOUT_MS = 60_000;

export function hostRunner(host: GameHost, def: () => GameDefinition, watch: HostWatch, play?: () => void): GameRunner {
  return {
    get stepsPerSecond() {
      return def().stepsPerSecond ?? 60;
    },
    async steps() {
      // The runtime's own count of steps run: game time, whatever the clock says.
      const n = await host.evalPython("__import__('gameide')._step_count");
      return typeof n === "number" ? n : 0;
    },
    async start() {
      watch.errors.length = 0;
      if (play) play();
      else void host.play(def(), null);
      const until = performance.now() + START_TIMEOUT_MS;
      // "loading" first, then "running" once the room is up — or an error.
      await new Promise((r) => setTimeout(r, 50));
      while (watch.state() !== "running") {
        if (watch.errors.length) throw new Error(`The game stopped with an error: ${watch.errors[0]}`);
        if (watch.state() === "crashed") throw new Error("The game crashed before it started.");
        if (performance.now() > until) throw new Error("The game didn't start.");
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    stop() {
      host.stop();
    },
    hold(key, down) {
      host.press(key, down);
    },
    py(expr) {
      return host.evalPython(expr);
    },
    errors() {
      return [...watch.errors];
    },
  };
}
