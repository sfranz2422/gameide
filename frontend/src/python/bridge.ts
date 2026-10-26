/**
 * The JavaScript half of the bridge: starts Pyodide (once per page), loads
 * runtime.py as a fresh `gameide` module for each run, hands it the engine's
 * query functions, and takes views of the arrays it allocates.
 *
 * Per frame there is exactly one call from JavaScript into Python —
 * `_frame()` — plus one call back (`motion()`), plus whatever collision
 * queries the student's events make. See runtime.py's docstring for the
 * other side.
 *
 * Views and memory growth: the views taken here point into the WebAssembly
 * heap. When Python needs more memory the heap grows, the old ArrayBuffer is
 * detached, and every view on it silently becomes length 0. Engine.fresh()
 * checks for that on every entry and calls `acquire` again. If you add a new
 * view, it must be re-taken there too, or it will read zeros after the first
 * time a game allocates a lot (a few hundred bullets is enough).
 */
import type { PyodideInterface } from "pyodide";
import type { PyBuffer, PyProxy } from "pyodide/ffi";
import { Engine, type FrameCommands, type PythonGameError, type SharedViews } from "../engine/engine";
import type { GameDefinition, SoundOrder } from "../engine/game";
import { layoutForPython } from "../engine/layout";
import runtimeSource from "./runtime.py?raw";

let pyodidePromise: Promise<PyodideInterface> | null = null;

export interface LoadOptions {
  /** Where pyodide.asm.wasm and friends are served. Omit in node. */
  indexURL?: string;
}

/**
 * The page's one Pyodide. Loading it takes a few seconds the first time and
 * it is kept for every later run, which is how Play starts quickly the second
 * time. Each run gets a clean `gameide` module and a clean namespace instead.
 */
export function getPyodide(options: LoadOptions = {}): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = import("pyodide").then(({ loadPyodide }) =>
      loadPyodide(options.indexURL ? { indexURL: options.indexURL } : {}),
    );
    // A failed load (offline on first visit) must not be cached forever.
    pyodidePromise.catch(() => (pyodidePromise = null));
  }
  return pyodidePromise;
}

export interface GameCallbacks {
  /** print() output and Python's own messages. */
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  /** A problem worth showing once (a misspelt event name, say). */
  warning?: (text: string) => void;
  /** Sounds to play or stop: the page plays them (editor/sound.ts). */
  sounds?: (orders: SoundOrder[]) => void;
  /** The game's whole save data, after it changed. */
  save?: (data: Record<string, unknown>) => void;
}

/** Timings of the last step, for the FPS readout. */
export interface StepTiming {
  pythonMs: number; // the whole _frame() call, motion included
  motionMs: number; // just the engine's motion() inside it
}

const FRESH_MODULE = `
import sys, types
def _fresh_module(source):
    for name in ("gameide", "_engine"):
        sys.modules.pop(name, None)
    m = types.ModuleType("gameide")
    m.__file__ = "gameide.py"
    sys.modules["gameide"] = m
    exec(compile(source, "gameide.py", "exec"), m.__dict__)
    return m
_fresh_module
`;

/** A running game: one Engine plus its Python side. */
/**
 * The game as Python is given it: without the pictures, pixel masks, tile
 * grids, and sound and font files, which Python never needs (and a pixel
 * mask stringified is a key per pixel). Taken out of the places they live,
 * NOT by key name: a JSON replacer that dropped every key called "font" or
 * "sound" also dropped a script called "font", an object called "sound"
 * and save_set("image", …) — silently, so the game ran without them.
 */
export function definitionForPython(def: GameDefinition): string {
  return JSON.stringify({
    ...def,
    sprites: def.sprites.map(({ images, pixelMasks, ...rest }) => rest),
    tilesets: def.tilesets?.map(({ image, ...rest }) => rest),
    rooms: def.rooms.map((r) => (r.tileLayers ? { ...r, tileLayers: r.tileLayers.map(({ cells, ...rest }) => rest) } : r)),
    sounds: def.sounds?.map(({ sound, ...rest }) => rest),
    fonts: def.fonts?.map(({ font, ...rest }) => rest),
  });
}

export class PythonGame {
  readonly engine: Engine;
  readonly timing: StepTiming = { pythonMs: 0, motionMs: 0 };
  private buffers: PyBuffer[] = [];
  private stopped = false;

  private constructor(
    private readonly py: PyodideInterface,
    private readonly module: PyProxy,
    private readonly frameFn: () => string | undefined,
    def: GameDefinition,
    private readonly callbacks: GameCallbacks,
    bindEngine: (e: Engine) => void,
  ) {
    this.engine = new Engine(def, () => this.acquire());
    bindEngine(this.engine);
  }

  /**
   * Loads a game. Resolves with the game, or with the error that stopped it
   * loading (a syntax error in an object's code, usually).
   */
  static async load(
    def: GameDefinition,
    callbacks: GameCallbacks = {},
    options: LoadOptions = {},
  ): Promise<{ game: PythonGame; error: PythonGameError | null }> {
    const py = await getPyodide(options);
    py.setStdout({ batched: (s) => callbacks.stdout?.(s) });
    py.setStderr({ batched: (s) => callbacks.stderr?.(s) });

    // The engine does not exist until the module does (it reads the module's
    // arrays), but the module imports the engine's functions at load. So the
    // functions registered here forward to an engine bound a moment later.
    let engine: Engine | null = null;
    let motionMs = 0;
    const e = () => engine!;
    const api = {
      rebind: () => engine?.rebind(),
      configure: (json: string) => {
        const c = JSON.parse(json) as { collides: number[]; flags: number[] };
        e().configure(c.collides, c.flags);
      },
      motion: () => {
        const t0 = performance.now();
        const n = e().motion();
        motionMs = performance.now() - t0;
        return n;
      },
      place_meeting: (s: number, x: number, y: number, t: number) => e().place_meeting(s, x, y, t),
      place_free: (s: number, x: number, y: number) => e().place_free(s, x, y),
      instance_place: (s: number, x: number, y: number, t: number) => e().instance_place(s, x, y, t),
      collision_point: (x: number, y: number, t: number) => e().collision_point(x, y, t),
      instance_nearest: (x: number, y: number, t: number, ex: number) => e().instance_nearest(x, y, t, ex),
      move_and_collide: (s: number, dx: number, dy: number, t: number) => e().move_and_collide(s, dx, dy, t),
      camera_follow: (s: number, smooth: number) => e().camera_follow(s, smooth),
      camera_set: (x: number, y: number) => e().camera_set(x, y),
      camera_shake: (strength: number, steps: number) => e().camera_shake(strength, steps),
      hit_pause: (steps: number) => e().hit_pause(steps),
      tile_at: (x: number, y: number, layer: number) => e().tile_at(x, y, layer),
      tile_set: (x: number, y: number, tile: number, layer: number) => e().tile_set(x, y, tile, layer),
    };
    py.registerJsModule("_engine", api);
    const fresh = py.runPython(FRESH_MODULE) as PyProxy & ((src: string) => PyProxy);
    const module = fresh(runtimeSource);
    fresh.destroy();

    const frameFn = module._frame as (() => string | undefined) & PyProxy;
    const game = new PythonGame(py, module, frameFn, def, callbacks, (en) => (engine = en));
    game.readMotionMs = () => motionMs;

    // JSON both ways at load: one crossing each, and no proxies to leak.
    const setup = module._setup as ((a: string, b: string) => string | undefined) & PyProxy;
    const loadOut = setup(JSON.stringify(layoutForPython()), definitionForPython(def));
    setup.destroy();
    let error = game.handle(loadOut);
    if (!error) {
      const start = module._start as (() => string | undefined) & PyProxy;
      error = game.handle(start());
      start.destroy();
      game.engine.flushDirty();
    }
    if (error) game.stopped = true;
    return { game, error };
  }

  private readMotionMs: () => number = () => 0;

  /** Takes (or re-takes) the views of Python's arrays. See the file comment. */
  private acquire(): SharedViews {
    for (const b of this.buffers) b.release();
    const arrays = (this.module._arrays as () => PyProxy)();
    const kinds = ["f64", "i32", "i32", "i32", "u8", "f64"] as const;
    this.buffers = kinds.map((k, i) => {
      const item = arrays.get(i) as PyProxy & { getBuffer(type: string): PyBuffer };
      const buf = item.getBuffer(k);
      item.destroy();
      return buf;
    });
    arrays.destroy();
    const d = this.buffers.map((b) => b.data);
    return {
      st: d[0] as Float64Array,
      dirty: d[1] as Int32Array,
      events: d[2] as Int32Array,
      result: d[3] as Int32Array,
      keys: d[4] as Uint8Array,
      g: d[5] as Float64Array,
    };
  }

  /** Applies a frame's (or the load's) JSON output; returns its error if any. */
  private handle(out: string | undefined): PythonGameError | null {
    const cmds: FrameCommands | null = out ? (JSON.parse(out) as FrameCommands) : null;
    for (const w of cmds?.warnings ?? []) this.callbacks.warning?.(w);
    if (cmds?.sounds) this.callbacks.sounds?.(cmds.sounds);
    if (cmds?.save) this.callbacks.save?.(cmds.save);
    return this.engine.endStep(cmds);
  }

  get isStopped() {
    return this.stopped;
  }

  /**
   * One fixed step of the game. Returns the error that stopped it, if this
   * step raised one; after that the game stays stopped.
   */
  step(): PythonGameError | null {
    if (this.stopped) return null;
    // hit_pause(): a few steps of nothing happening at all — no events, no
    // motion, particles still — while the last frame stays on screen. Keys
    // pressed meanwhile stay latched (beginStep isn't run), so none is lost.
    if (this.engine.effects.pauseLeft > 0) {
      this.engine.effects.pauseLeft--;
      return null;
    }
    this.engine.beginStep();
    const t0 = performance.now();
    let out: string | undefined;
    try {
      out = this.frameFn();
    } catch (err) {
      // _frame catches every student error itself, so this is the runtime
      // failing — still shown, never swallowed.
      this.stopped = true;
      return { kind: null, object: null, event: null, line: null, message: String(err), traceback: "" };
    }
    this.timing.pythonMs = performance.now() - t0;
    this.timing.motionMs = this.readMotionMs();
    const error = this.handle(out);
    if (error) this.stopped = true;
    return error;
  }

  /** Reads a module-level value from the runtime, for tests and the debug overlay. */
  evalPython(code: string): unknown {
    const ns = this.module._ns as PyProxy;
    const r = this.py.runPython(code, { globals: ns });
    ns.destroy();
    if (r && typeof r === "object" && "toJs" in r) {
      const proxy = r as PyProxy & { toJs(o?: object): unknown };
      const v = proxy.toJs({ dict_converter: Object.fromEntries });
      proxy.destroy();
      return v;
    }
    return r;
  }

  dispose() {
    this.stopped = true;
    for (const b of this.buffers) b.release();
    this.buffers = [];
    (this.frameFn as unknown as PyProxy).destroy();
    this.module.destroy();
  }
}
