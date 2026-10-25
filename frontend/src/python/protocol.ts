/**
 * Messages between the editor (main thread) and the game worker.
 *
 * Why a worker: a student's `while True:` with no way out would otherwise
 * freeze the whole page, editor included, with no way to stop it but closing
 * the tab. In the worker, the page stays responsive, notices the game has
 * gone quiet, and interrupts it (see gameHost.ts).
 *
 * The game draws in the worker too, on an OffscreenCanvas, so the shared
 * state array never has to be copied to the page. All that crosses per frame
 * is input going in; stats and output come out a few times a second.
 */
import type { PythonGameError } from "../engine/engine";
import type { GameDefinition } from "../engine/game";

export type InputMessage =
  | { k: "down"; code: number }
  | { k: "up"; code: number }
  | { k: "mdown"; button: number }
  | { k: "mup"; button: number }
  | { k: "move"; x: number; y: number }
  | { k: "blur" };

export type ToWorker =
  | { type: "init"; indexURL: string; interrupt: SharedArrayBuffer | null }
  | { type: "play"; def: GameDefinition; canvas: OffscreenCanvas; debug: boolean }
  | { type: "stop" }
  | { type: "input"; events: InputMessage[] }
  | { type: "debug"; on: boolean }
  | { type: "eval"; id: number; code: string };

export interface WorkerStats {
  fps: number;
  drawFps: number;
  instances: number;
  pythonMs: number;
  motionMs: number;
}

export type GameState = "loading" | "running" | "stopped" | "crashed";

export type FromWorker =
  | { type: "ready" }
  | { type: "state"; state: GameState }
  | { type: "output"; lines: { text: string; kind: "out" | "err" | "warn" }[] }
  | { type: "error"; error: PythonGameError }
  | { type: "stats"; stats: WorkerStats | null }
  | { type: "room"; width: number; height: number }
  | { type: "eval"; id: number; value?: unknown; error?: string }
  | { type: "fatal"; message: string };
