/**
 * Play, Stop and Restart: puts a PythonGame, a PixiRenderer, the input
 * listeners and the loop together, and takes them apart again. The editor
 * talks to this and nothing below it.
 */
import type { PythonGameError } from "../engine/engine";
import type { GameDefinition } from "../engine/game";
import { attachInput } from "../engine/input";
import { GameLoop } from "../engine/loop";
import { PixiRenderer } from "../engine/render/pixiRenderer";
import { PythonGame } from "../python/bridge";

export interface SessionEvents {
  output: (text: string, kind: "out" | "err" | "warn") => void;
  error: (e: PythonGameError) => void;
  /**
   * "crashed" is stopped by an error: the last frame stays on screen, so the
   * student can see where things were when it happened.
   */
  state: (s: SessionState) => void;
}

export type SessionState = "loading" | "running" | "stopped" | "crashed";

export interface SessionStats {
  fps: number;
  drawFps: number;
  instances: number;
  pythonMs: number;
  motionMs: number;
}

export class GameSession {
  private game: PythonGame | null = null;
  private renderer: PixiRenderer | null = null;
  private loop: GameLoop | null = null;
  private detachInput: (() => void) | null = null;
  private generation = 0;
  private showDebug = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly events: SessionEvents,
  ) {}

  async play(def: GameDefinition) {
    this.stop();
    const mine = ++this.generation;
    this.events.state("loading");
    const indexURL = `${import.meta.env.BASE_URL}pyodide/`;
    const { game, error } = await PythonGame.load(
      def,
      {
        stdout: (t) => this.events.output(t, "out"),
        stderr: (t) => this.events.output(t, "err"),
        warning: (t) => this.events.output(t, "warn"),
      },
      { indexURL },
    );
    // Stop (or another Play) was pressed while Python was loading.
    if (mine !== this.generation) {
      game.dispose();
      return;
    }
    this.game = game;
    if (error) {
      this.events.error(error);
      this.events.state("crashed");
      return;
    }
    const renderer = await PixiRenderer.create(this.host, def, game.engine);
    if (mine !== this.generation) {
      renderer.destroy();
      game.dispose();
      return;
    }
    renderer.showDebug = this.showDebug;
    this.renderer = renderer;
    this.detachInput = attachInput(
      game.engine.input,
      renderer.canvas,
      () => document.activeElement === renderer.canvas,
      (e) => renderer.toRoom(e),
    );
    renderer.canvas.addEventListener("pointerdown", () => renderer.canvas.focus());
    renderer.canvas.focus();

    this.loop = new GameLoop(
      () => {
        const err = game.step();
        if (err) {
          this.events.error(err);
          this.events.state("crashed");
          return false;
        }
        return true;
      },
      () => {
        const s = this.stats();
        if (s) renderer.statsLine = `${s.fps} fps · ${s.instances} instances · Python ${s.pythonMs.toFixed(2)} ms`;
        renderer.render();
      },
    );
    this.loop.start();
    this.events.state("running");
  }

  stop() {
    this.generation++;
    this.loop?.stop();
    this.loop = null;
    this.detachInput?.();
    this.detachInput = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.game?.dispose();
    this.game = null;
    this.events.state("stopped");
  }

  setDebug(on: boolean) {
    this.showDebug = on;
    if (this.renderer) this.renderer.showDebug = on;
  }

  stats(): SessionStats | null {
    if (!this.game || !this.loop) return null;
    return {
      fps: this.loop.stats.stepsPerSecond,
      drawFps: this.loop.stats.fps,
      instances: this.game.engine.instanceCount(),
      pythonMs: this.game.timing.pythonMs,
      motionMs: this.game.timing.motionMs,
    };
  }

  /** For the Playwright smoke test: evaluate Python in the running game. */
  evalPython(code: string): unknown {
    return this.game?.evalPython(code);
  }

  /** For tests: the engine's input, to press keys without a real keyboard. */
  get input() {
    return this.game?.engine.input ?? null;
  }
}
