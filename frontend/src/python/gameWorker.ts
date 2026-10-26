/// <reference lib="webworker" />
/**
 * The game worker: Pyodide, the engine, the renderer and the loop, off the
 * page's main thread. One worker lives as long as the editor page does, so
 * Pyodide loads once; each Play gets a fresh game in it.
 */
import { DOMAdapter, WebWorkerAdapter } from "pixi.js";
import { GameLoop } from "../engine/loop";
import { PixiRenderer } from "../engine/render/pixiRenderer";
import { getPyodide, PythonGame } from "./bridge";
import { prepareSprites } from "./spritePrep";
import type { GameDefinition } from "../engine/game";
import type { FromWorker, InputMessage, ToWorker } from "./protocol";

// Pixi looks for `document` unless told it is in a worker.
DOMAdapter.set(WebWorkerAdapter);

const post = (m: FromWorker, transfer: Transferable[] = []) => self.postMessage(m, transfer);

let interrupt: Int32Array | null = null;
let game: PythonGame | null = null;
let renderer: PixiRenderer | null = null;
let loop: GameLoop | null = null;
let debug = false;
let run = 0;

// Output is collected and sent a few times a second, not line by line: a
// game that prints every step would otherwise post 60 messages a second
// and one that prints in a loop would flood the page.
const MAX_LINES_PER_FLUSH = 200;
let pending: { text: string; kind: "out" | "err" | "warn" }[] = [];
let dropped = 0;
function emit(text: string, kind: "out" | "err" | "warn") {
  if (pending.length < MAX_LINES_PER_FLUSH) pending.push({ text, kind });
  else dropped++;
}
function flush() {
  if (dropped) pending.push({ text: `… ${dropped} more lines not shown`, kind: "warn" });
  if (pending.length) post({ type: "output", lines: pending });
  pending = [];
  dropped = 0;
}

// Stats double as the heartbeat the page's watchdog listens for. They come
// from a timer, not the draw loop, so a hidden tab (no animation frames)
// still answers — the beat means "the worker is free", not "it is drawing".
setInterval(() => {
  flush();
  if (!game || !loop) {
    post({ type: "stats", stats: null });
    return;
  }
  post({
    type: "stats",
    stats: {
      fps: loop.stats.stepsPerSecond,
      drawFps: loop.stats.fps,
      instances: game.engine.instanceCount(),
      pythonMs: game.timing.pythonMs,
      motionMs: game.timing.motionMs,
      tiles: renderer?.tilesShown ?? 0,
    },
  });
}, 250);

function stop(state: "stopped" | "crashed" = "stopped") {
  run++;
  loop?.stop();
  loop = null;
  renderer?.destroy();
  renderer = null;
  game?.dispose();
  game = null;
  flush();
  post({ type: "state", state });
}

/**
 * The game's fonts, added to the worker's own font list (workers have one,
 * separate from the page's) under names the renderer asks for:
 * "gameide-font-0", "gameide-font-1"… in the order draw_set_font counts them.
 * A file that isn't a font is skipped with a warning: the text falls back to
 * the built-in font rather than the game failing to start. Returns the
 * places of the fonts that loaded, for the renderer.
 */
const loadedFonts = new Map<Blob, FontFace>();
async function loadFonts(def: GameDefinition): Promise<Set<number>> {
  const loaded = new Set<number>();
  const fonts = (self as unknown as { fonts: FontFaceSet }).fonts;
  for (const [i, f] of (def.fonts ?? []).entries()) {
    if (!f.font) continue;
    const family = `gameide-font-${i}`;
    try {
      // Kept between plays; made again only if the font moved in the list
      // (a face keeps the family it was made with).
      let face = loadedFonts.get(f.font);
      if (!face || face.family !== family) {
        face = new FontFace(family, await f.font.arrayBuffer());
        await face.load();
        loadedFonts.set(f.font, face);
      }
      fonts.add(face);
      loaded.add(i);
    } catch {
      emit(`The font ${f.name} couldn't be read, so its text uses the built-in font.\n`, "warn");
    }
  }
  return loaded;
}

async function play(msg: Extract<ToWorker, { type: "play" }>) {
  stop();
  const mine = run;
  post({ type: "state", state: "loading" });
  // An interrupt left over from a previous run must not hit this one.
  if (interrupt) interrupt[0] = 0;
  await prepareSprites(msg.def);
  const fonts = await loadFonts(msg.def);
  if (mine !== run) return;
  const { game: g, error } = await PythonGame.load(msg.def, {
    stdout: (t) => emit(t, "out"),
    stderr: (t) => emit(t, "err"),
    warning: (t) => emit(t, "warn"),
    sounds: (orders) => post({ type: "sounds", orders }),
    save: (data) => post({ type: "save", data }),
  });
  if (mine !== run) return g.dispose();
  game = g;
  if (error) {
    flush();
    post({ type: "error", error });
    return stop("crashed");
  }
  const r = await PixiRenderer.create(msg.canvas, msg.def, g.engine, fonts);
  if (mine !== run) return r.destroy();
  renderer = r;
  r.showDebug = debug;
  r.onRoomSize = (width, height) => post({ type: "room", width, height });
  loop = new GameLoop(
    () => {
      const err = g.step();
      if (err) {
        flush();
        post({ type: "error", error: err });
        // Leave the last frame on screen: where things were when it broke
        // is part of the clue. The renderer is kept; only the loop stops.
        loop = null;
        game = null;
        g.dispose();
        post({ type: "state", state: "crashed" });
        return false;
      }
      return true;
    },
    () => {
      if (loop && game) {
        const s = loop.stats;
        r.statsLine = `${s.stepsPerSecond} fps · ${game.engine.instanceCount()} instances · ${r.tilesShown} tiles drawn · Python ${game.timing.pythonMs.toFixed(2)} ms`;
      }
      r.render();
    },
    msg.def.stepsPerSecond ?? 60,
  );
  loop.start();
  post({ type: "state", state: "running" });
}

function input(events: InputMessage[]) {
  const inp = game?.engine.input;
  if (!inp) return;
  for (const e of events) {
    if (e.k === "down") inp.keyDown(e.code);
    else if (e.k === "up") inp.keyUp(e.code);
    else if (e.k === "mdown") inp.mouseDown(e.button);
    else if (e.k === "mup") inp.mouseUp(e.button);
    else if (e.k === "move") inp.mouseMove(e.x, e.y);
    else if (e.k === "pads") inp.pads(e.pads);
    else inp.releaseAll();
  }
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case "init": {
        const py = await getPyodide({ indexURL: msg.indexURL });
        if (msg.interrupt) {
          interrupt = new Int32Array(msg.interrupt);
          py.setInterruptBuffer(interrupt);
        }
        post({ type: "ready" });
        break;
      }
      case "play":
        await play(msg);
        break;
      case "stop":
        stop();
        break;
      case "input":
        input(msg.events);
        break;
      case "debug":
        debug = msg.on;
        if (renderer) renderer.showDebug = msg.on;
        break;
      case "eval": {
        try {
          post({ type: "eval", id: msg.id, value: game ? game.evalPython(msg.code) : undefined });
        } catch (e) {
          post({ type: "eval", id: msg.id, error: String(e) });
        }
        break;
      }
    }
  } catch (e) {
    post({ type: "fatal", message: e instanceof Error ? `${e.message}` : String(e) });
  }
};
