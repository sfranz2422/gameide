/**
 * The page's side of the game worker: starts it (once, so Pyodide loads
 * once), hands it a canvas for each Play, forwards keys and the mouse, and
 * watches that it keeps answering.
 *
 * The watchdog. The worker posts stats every 250 ms from a timer, which can
 * only fire while it is not busy running Python. If nothing arrives for
 * HANG_MS while a game is loading or running, the game is stuck — nearly
 * always a loop that never ends — and:
 *
 *   1. with a SharedArrayBuffer (the page is cross-origin isolated, which
 *      the COOP/COEP headers in vite.config.ts and the server arrange), we
 *      set Pyodide's interrupt flag. Python raises KeyboardInterrupt at the
 *      line it was on, and the student is told which line that was;
 *   2. if that doesn't free it within KILL_MS, or there is no shared
 *      memory, the worker is terminated and a new one started. The student
 *      is still told the game stopped responding, just not where.
 *
 * A hidden tab throttles timers, so the watchdog only counts time while the
 * page is visible, and starts counting afresh when it becomes visible again.
 * Without that, switching tabs for a minute would "rescue" a healthy game.
 */
import type { PythonGameError } from "../engine/engine";
import type { GameDefinition } from "../engine/game";
import { attachInput, readPads, type InputSink } from "../engine/input";
import { SoundPlayer } from "./sound";
import type { FromWorker, GameState, InputMessage, ToWorker, WorkerStats } from "../python/protocol";

export const HANG_MS = 2000;
export const KILL_MS = 1500;

export interface HostEvents {
  state: (s: GameState) => void;
  output: (lines: { text: string; kind: "out" | "err" | "warn" }[]) => void;
  error: (e: PythonGameError) => void;
  stats: (s: WorkerStats | null) => void;
  /** Python is loaded and Play will be quick. */
  ready: (ready: boolean) => void;
}

/** Where a game keeps what it saves (save_set), in this browser. */
export const saveKey = (gameId: string) => `gameide-save:${gameId}`;

export function readSave(gameId: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(saveKey(gameId));
    const data = raw ? (JSON.parse(raw) as unknown) : null;
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {}; // storage blocked (a private window) or not JSON: start fresh
  }
}

export class GameHost {
  /** Plays the game's sounds: the worker can't. */
  readonly sound = new SoundPlayer();
  private saveId: string | null = null;
  private padTimer = 0;
  private lastPads = "";
  private worker!: Worker;
  private readyPromise!: Promise<void>;
  private interrupt: Int32Array | null = null;
  private state: GameState = "stopped";
  private lastBeat = performance.now();
  private interruptedAt = 0;
  // The watchdog sleeps while Pyodide itself is starting: that is the
  // worker's own work, can take a few seconds, and isn't a student's loop.
  private isReady = false;
  private canvas: HTMLCanvasElement | null = null;
  /** The game window's size in game pixels (the room, or its camera's view). */
  private room = { width: 640, height: 480 };
  private pixelScaling = true;
  private resizer: ResizeObserver | null = null;
  private detachInput: (() => void) | null = null;
  private evals = new Map<number, (v: unknown) => void>();
  private nextEval = 1;
  private debug = false;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly onVisible = () => {
    if (document.visibilityState === "visible") this.lastBeat = performance.now();
  };

  constructor(private readonly events: HostEvents) {
    this.start();
    this.timer = setInterval(() => this.watch(), 250);
    document.addEventListener("visibilitychange", this.onVisible);
  }

  /** Whether a stuck game can be interrupted (and told where), or only killed. */
  get canInterrupt() {
    return this.interrupt !== null;
  }

  private start() {
    this.isReady = false;
    this.events.ready(false);
    this.worker = new Worker(new URL("../python/gameWorker.ts", import.meta.url), { type: "module" });
    // SharedArrayBuffer only exists on a cross-origin-isolated page. The
    // query string can turn it off, so the fallback path can be tested.
    const useShared = typeof SharedArrayBuffer !== "undefined" && crossOriginIsolated && !location.search.includes("nointerrupt");
    const sab = useShared ? new SharedArrayBuffer(4) : null;
    this.interrupt = sab ? new Int32Array(sab) : null;
    this.readyPromise = new Promise((resolve) => {
      const onReady = (ev: MessageEvent<FromWorker>) => {
        if (ev.data.type === "ready") {
          this.worker.removeEventListener("message", onReady);
          this.isReady = true;
          this.lastBeat = performance.now();
          this.events.ready(true);
          resolve();
        }
      };
      this.worker.addEventListener("message", onReady);
    });
    this.worker.addEventListener("message", (ev: MessageEvent<FromWorker>) => this.receive(ev.data));
    this.worker.addEventListener("error", (ev) => {
      this.events.output([{ text: `The game engine failed: ${ev.message}`, kind: "err" }]);
      this.setState("crashed");
    });
    const indexURL = new URL(`${import.meta.env.BASE_URL}pyodide/`, location.href).href;
    this.send({ type: "init", indexURL, interrupt: sab });
  }

  private send(msg: ToWorker, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer);
  }

  private setState(s: GameState) {
    this.state = s;
    this.events.state(s);
    if (s === "running") this.pollPads();
    else {
      cancelAnimationFrame(this.padTimer);
      if (s !== "loading") this.sound.stopAll();
    }
  }

  /**
   * Gamepads can't be listened to, only asked about, so while a game runs
   * they are read every animation frame and sent on when something changed.
   */
  private pollPads() {
    cancelAnimationFrame(this.padTimer);
    const tick = () => {
      const pads = readPads(navigator.getGamepads?.() ?? []);
      const key = JSON.stringify(pads);
      if (key !== this.lastPads) {
        this.lastPads = key;
        this.send({ type: "input", events: [{ k: "pads", pads }] });
      }
      this.padTimer = requestAnimationFrame(tick);
    };
    this.lastPads = "";
    this.padTimer = requestAnimationFrame(tick);
  }

  private receive(m: FromWorker) {
    this.lastBeat = performance.now();
    // The worker answered after we raised the interrupt flag, and the flag
    // is still up: Python never ran to see it (the worker was busy with
    // something else, a slow WebGL start, say). Lower it, or it would stop
    // the next healthy frame with "stopped responding".
    if (this.interruptedAt && this.interrupt && this.interrupt[0] === 2) this.interrupt[0] = 0;
    this.interruptedAt = 0;
    switch (m.type) {
      case "state":
        this.setState(m.state);
        break;
      case "output":
        this.events.output(m.lines);
        break;
      case "error":
        this.events.error(m.error);
        break;
      case "stats":
        this.events.stats(m.stats);
        break;
      case "room":
        this.room = { width: m.width, height: m.height };
        this.layout();
        break;
      case "eval":
        this.evals.get(m.id)?.(m.error ? { error: m.error } : m.value);
        this.evals.delete(m.id);
        break;
      case "fatal":
        this.events.output([{ text: `The game engine failed: ${m.message}`, kind: "err" }]);
        this.setState("crashed");
        break;
      case "sounds":
        this.sound.run(m.orders);
        break;
      case "save":
        if (this.saveId)
          try {
            localStorage.setItem(saveKey(this.saveId), JSON.stringify(m.data));
          } catch {
            this.events.output([{ text: "This browser wouldn't keep the game's save data (it may be full, or in a private window).", kind: "warn" }]);
          }
        break;
    }
  }

  private watch() {
    if (!this.isReady || (this.state !== "loading" && this.state !== "running")) return;
    if (document.visibilityState !== "visible") return;
    const now = performance.now();
    if (now - this.lastBeat < HANG_MS) {
      this.interruptedAt = 0;
      return;
    }
    if (this.interrupt && !this.interruptedAt) {
      this.interrupt[0] = 2; // SIGINT: Pyodide raises KeyboardInterrupt
      this.interruptedAt = now;
      return;
    }
    if (!this.interrupt || now - this.interruptedAt > KILL_MS) this.kill();
  }

  /** The last resort: the worker would not stop, so it goes, and a fresh one starts. */
  private kill() {
    this.worker.terminate();
    this.interruptedAt = 0;
    this.detachInput?.();
    this.detachInput = null;
    this.events.error({
      kind: null,
      object: null,
      event: null,
      line: null,
      message:
        "This game stopped responding, so GameIDE stopped it. Is there a loop that never ends? " +
        "(This browser can't say which line it was on.)",
      traceback: "",
      hang: true,
    });
    this.setState("crashed");
    this.start();
  }

  /**
   * Runs a game in `container`. Each run gets a new canvas: a canvas can only
   * be handed to a worker once.
   */
  /**
   * `gameId` names where the game's save data lives (save_set): the
   * project's id in the editor, the published game's on its play page.
   */
  async play(def: GameDefinition, gameId: string | null = null) {
    this.setState("loading");
    this.sound.stopAll();
    this.saveId = gameId;
    const warn = (text: string) => this.events.output([{ text, kind: "warn" }]);
    // The worker gets the sounds' names and lengths, not their files.
    def = { ...def, sounds: await this.sound.prepare(def.sounds ?? [], warn), save: gameId ? readSave(gameId) : {} };
    this.lastBeat = performance.now();
    await this.readyPromise;
    this.lastBeat = performance.now();
    const container = this.container;
    if (!container) return;
    this.detachInput?.();
    this.canvas?.remove();
    const room = def.rooms[0]!;
    this.room = { width: room.camera?.width ?? room.width, height: room.camera?.height ?? room.height };
    this.pixelScaling = def.pixelScaling !== false;
    const canvas = document.createElement("canvas");
    canvas.width = room.width;
    canvas.height = room.height;
    canvas.tabIndex = 0;
    canvas.dataset.tutorial = "game-canvas";
    canvas.dataset.testid = "game-canvas";
    container.appendChild(canvas);
    this.canvas = canvas;
    this.layout();
    const offscreen = canvas.transferControlToOffscreen();
    // Blobs in the definition are posted as references, not copied.
    this.send({ type: "play", def, canvas: offscreen, debug: this.debug }, [offscreen]);

    this.detachInput = attachInput(
      this.sink(),
      canvas,
      () => document.activeElement === canvas,
      (e) => this.toRoom(e),
    );
    canvas.addEventListener("pointerdown", () => canvas.focus());
    canvas.focus();
  }

  private box: HTMLElement | null = null;

  /** Where the game's canvas goes. Set by the game pane. */
  get container(): HTMLElement | null {
    return this.box;
  }
  set container(el: HTMLElement | null) {
    this.resizer?.disconnect();
    this.box = el;
    if (el) {
      this.resizer = new ResizeObserver(() => this.layout());
      this.resizer.observe(el);
    }
  }

  /**
   * Sizes the canvas in its pane. With pixel scaling it grows only by whole
   * numbers, so every game pixel is the same number of screen pixels — at
   * 2.4× some pixels would be two wide and some three, and pixel art goes
   * lumpy. Smaller than the room, it shrinks smoothly (better than cropping).
   */
  private layout() {
    const canvas = this.canvas, box = this.box;
    if (!canvas || !box) return;
    const { width: w, height: h } = this.room;
    const fit = Math.min(box.clientWidth / w, box.clientHeight / h);
    const scale = this.pixelScaling && fit >= 1 ? Math.floor(fit) : fit;
    canvas.style.width = `${Math.max(1, Math.floor(w * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.floor(h * scale))}px`;
  }

  /** The game pane fills the screen; Esc (the browser's own) brings it back. */
  fullscreen() {
    void this.box?.requestFullscreen?.().catch(() => undefined);
  }

  stop() {
    // A stuck game can't read "stop"; interrupt it straight away rather
    // than making the student wait for the watchdog.
    if (performance.now() - this.lastBeat > 500 && this.interrupt) this.interrupt[0] = 2;
    this.send({ type: "stop" });
    this.sound.stopAll();
    cancelAnimationFrame(this.padTimer);
    this.detachInput?.();
    this.detachInput = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  setDebug(on: boolean) {
    this.debug = on;
    this.send({ type: "debug", on });
  }

  /** For tests: evaluate Python in the running game's namespace. */
  evalPython(code: string): Promise<unknown> {
    const id = this.nextEval++;
    return new Promise((resolve) => {
      this.evals.set(id, resolve);
      this.send({ type: "eval", id, code });
    });
  }

  dispose() {
    clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onVisible);
    this.detachInput?.();
    this.worker.terminate();
  }

  /** Input goes to the worker; events from one task are sent as one message. */
  private sink(): InputSink {
    let queue: InputMessage[] = [];
    let scheduled = false;
    const push = (m: InputMessage) => {
      // Only the latest mouse position in a batch matters.
      if (m.k === "move" && queue.length && queue[queue.length - 1]!.k === "move") queue[queue.length - 1] = m;
      else queue.push(m);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          const events = queue;
          queue = [];
          this.send({ type: "input", events });
        });
      }
    };
    return {
      keyDown: (code) => push({ k: "down", code }),
      keyUp: (code) => push({ k: "up", code }),
      mouseDown: (button) => push({ k: "mdown", button }),
      mouseUp: (button) => push({ k: "mup", button }),
      mouseMove: (x, y) => push({ k: "move", x, y }),
      releaseAll: () => push({ k: "blur" }),
      pads: (pads) => push({ k: "pads", pads }),
    };
  }

  /**
   * A pointer position in game-window pixels (the engine adds the camera's
   * position to make it a room position). The canvas is sized exactly to
   * the picture (layout), so this is just a rescale.
   */
  private toRoom(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas!.getBoundingClientRect();
    const { width: W, height: H } = this.room;
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
}
