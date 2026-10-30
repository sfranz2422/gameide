/**
 * GameIDE's check language: the tests in an assignment's notes (```tests)
 * and the checks in a tutorial's steps (```check), one per line —
 *
 *   object Player exists                    also sprite, room, sound, font, script, tileset
 *   Player has sprite
 *   Player has event step                   the event's name as the editor shows it
 *   Player.step uses keyboard_check         or "Player uses …", or "uses …" anywhere; "avoids …"
 *   Player.step is written in blocks        or in python, or in an event sheet
 *   room Level1 has 3 Coin                  or "has at least 3 Coin"
 *   sprite hero has at least 2 frames       or "has 2 frames"
 *   tileset ground has at least 4 solid tiles
 *   tileset town is cut 16 × 16 with spacing 1   (x or ×; "with spacing" may be left off)
 *   tileset garden has an autotile set      or "has at least 2 autotile sets"
 *   sprite robot is 96 × 128                its frames' size
 *   room Level1 has at least 30 tiles       painted, on any tile layer ("tiles" isn't an object here)
 *   room Level1 has at least 2 tile layers  or "has a tile layer using ground"
 *   room Level1 is at least 1600 wide       or "tall"
 *   room Level1 camera follows Player
 *   game runs 2 seconds without errors
 *   after 1 second holding right, Player.x increased     (decreased, changed, stayed the same)
 *   after 2 seconds, instance_number("Coin") < 15        any Python that should come out true
 *   prints Hello, world!                    the console shows it, a second in (any case and spacing)
 *
 * "(2 points)" at the end of a line makes it worth 2; every line is 1 otherwise.
 *
 * `parseTests` reads a block exactly as backend/checks.py does (the server
 * keeps each line's label and points, and pays a student's check only for a
 * line really there); check-cases.json holds the two together.
 *
 * Checks about the project are read from the project. Checks about the game
 * RUNNING play it, through a GameRunner: in the student's own game pane for
 * Check my work, in a hidden one in the teacher's browser for Check all.
 * The server never runs a game.
 */
import { KEY_NAMES } from "../engine/layout";
import { eventLabel, type Project } from "../store/project";

export interface TestLine {
  label: string;
  points: number;
}

export interface TestResult extends TestLine {
  ok: boolean;
  /** Why it failed, in a student's words; "" when it passed. */
  detail: string;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const POINTS = /\s*\((\d{1,4}(?:\.\d{1,2})?)\s*points?\)\s*$/i;

/** The text of every ```<kind> block in some markdown, in order. */
export function testBlocks(md: string, kind = "tests"): string[] {
  const out: string[] = [];
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const f = FENCE.exec(lines[i]!);
    if (!f || f[2]!.trim().toLowerCase() !== kind) continue;
    const fence = f[1]!;
    const body: string[] = [];
    for (i++; i < lines.length; i++) {
      const g = FENCE.exec(lines[i]!);
      if (g && g[1]![0] === fence[0] && g[1]!.length >= fence.length && !g[2]!.trim()) break;
      body.push(lines[i]!);
    }
    out.push(body.join("\n"));
  }
  return out;
}

/** One block's lines: every line that isn't blank or a comment (checks.py, parse). */
export function parseTests(body: string): TestLine[] {
  const out: TestLine[] = [];
  for (const raw of String(body ?? "").split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let points = 1;
    const m = POINTS.exec(line);
    if (m) {
      points = parseFloat(m[1]!);
      line = line.slice(0, m.index).trimEnd();
    }
    line = line.split(/\s+/).join(" ");
    if (line) out.push({ label: line, points });
  }
  return out;
}

/** Every test in some markdown, each label once (the first wins) — checks.py, tests. */
export function allTests(md: string, kind = "tests"): TestLine[] {
  const seen = new Set<string>();
  const out: TestLine[] = [];
  for (const body of testBlocks(md, kind))
    for (const t of parseTests(body))
      if (!seen.has(t.label)) {
        seen.add(t.label);
        out.push(t);
      }
  return out;
}

// ---------------------------------------------------------------- reading a line

type Change = "increased" | "decreased" | "changed" | "stayed the same";

export type Check =
  | { kind: "exists"; what: "object" | "sprite" | "room" | "sound" | "font" | "script" | "tileset"; name: string }
  | { kind: "has-sprite"; object: string }
  | { kind: "has-event"; object: string; event: string }
  | { kind: "mode"; object: string; event: string; mode: "python" | "blocks" | "sheet" }
  | { kind: "uses"; avoid: boolean; word: string; object: string | null; event: string | null }
  | { kind: "count"; room: string; atLeast: boolean; n: number; object: string }
  | { kind: "frames"; sprite: string; atLeast: boolean; n: number }
  | { kind: "solid"; tileset: string; atLeast: boolean; n: number }
  | { kind: "cut"; tileset: string; w: number; h: number; spacing: number | null }
  | { kind: "autotiles"; tileset: string; atLeast: boolean; n: number }
  | { kind: "sprite-size"; sprite: string; w: number; h: number }
  | { kind: "tiles"; room: string; atLeast: boolean; n: number }
  | { kind: "tile-layers"; room: string; atLeast: boolean; n: number }
  | { kind: "tile-layer-using"; room: string; tileset: string }
  | { kind: "room-size"; room: string; side: "wide" | "tall"; n: number }
  | { kind: "camera-follows"; room: string; object: string }
  | { kind: "runs"; seconds: number }
  | { kind: "after"; seconds: number; hold: string[]; object: string; prop: string; change: Change }
  | { kind: "after-expr"; seconds: number; hold: string[]; expr: string }
  | { kind: "prints"; text: string }
  | { kind: "unknown"; why: string };

const NAME = String.raw`([A-Za-z_][A-Za-z0-9_]*)`;
const SECONDS = String.raw`(\d+(?:\.\d+)?)\s+seconds?`;

/** What a line asks, or "unknown" with why — shown to the teacher writing it, and the student. */
export function readCheck(line: string): Check {
  let m: RegExpExecArray | null;
  const s = line.trim();
  if ((m = new RegExp(String.raw`^(object|sprite|room|sound|font|script|tileset)\s+${NAME}\s+exists$`, "i").exec(s)))
    return { kind: "exists", what: m[1]!.toLowerCase() as "object", name: m[2]! };
  if ((m = new RegExp(String.raw`^${NAME}\s+has\s+(?:a\s+)?sprite$`, "i").exec(s))) return { kind: "has-sprite", object: m[1]! };
  if ((m = new RegExp(String.raw`^${NAME}\s+has\s+(?:an?\s+)?event\s+(.+)$`, "i").exec(s))) return { kind: "has-event", object: m[1]!, event: m[2]! };
  if ((m = new RegExp(String.raw`^${NAME}\.(.+?)\s+is\s+(?:written\s+)?in\s+(python|blocks|code blocks|an event sheet|event sheets?|a sheet)$`, "i").exec(s))) {
    const how = m[3]!.toLowerCase();
    return { kind: "mode", object: m[1]!, event: m[2]!, mode: how === "python" ? "python" : how.includes("block") ? "blocks" : "sheet" };
  }
  if ((m = new RegExp(String.raw`^${NAME}\.(.+?)\s+(uses|avoids)\s+(\S+)$`, "i").exec(s)))
    return { kind: "uses", avoid: m[3]!.toLowerCase() === "avoids", word: m[4]!, object: m[1]!, event: m[2]! };
  if ((m = new RegExp(String.raw`^${NAME}\s+(uses|avoids)\s+(\S+)$`, "i").exec(s)) && !/^(uses|avoids)$/i.test(m[1]!))
    return { kind: "uses", avoid: m[2]!.toLowerCase() === "avoids", word: m[3]!, object: m[1]!, event: null };
  if ((m = /^(uses|avoids)\s+(\S+)$/i.exec(s))) return { kind: "uses", avoid: m[1]!.toLowerCase() === "avoids", word: m[2]!, object: null, event: null };
  // What the editor makes, not code: frames, solid tiles, painted tiles, layers, the room and its camera.
  if ((m = new RegExp(String.raw`^sprite\s+${NAME}\s+has\s+(at least\s+)?(\d+)\s+frames?$`, "i").exec(s)))
    return { kind: "frames", sprite: m[1]!, atLeast: !!m[2], n: Number(m[3]) };
  if ((m = new RegExp(String.raw`^tileset\s+${NAME}\s+has\s+(at least\s+)?(\d+)\s+solid\s+tiles?$`, "i").exec(s)))
    return { kind: "solid", tileset: m[1]!, atLeast: !!m[2], n: Number(m[3]) };
  if ((m = new RegExp(String.raw`^tileset\s+${NAME}\s+is\s+cut\s+(\d+)\s*[x×]\s*(\d+)(?:\s+with\s+spacing\s+(\d+))?$`, "i").exec(s)))
    return { kind: "cut", tileset: m[1]!, w: Number(m[2]), h: Number(m[3]), spacing: m[4] === undefined ? null : Number(m[4]) };
  if ((m = new RegExp(String.raw`^tileset\s+${NAME}\s+has\s+(?:an|(at least\s+)?(\d+))\s+autotile\s+sets?$`, "i").exec(s)))
    return { kind: "autotiles", tileset: m[1]!, atLeast: m[3] === undefined || !!m[2], n: m[3] === undefined ? 1 : Number(m[3]) };
  if ((m = new RegExp(String.raw`^sprite\s+${NAME}\s+is\s+(\d+)\s*[x×]\s*(\d+)$`, "i").exec(s)))
    return { kind: "sprite-size", sprite: m[1]!, w: Number(m[2]), h: Number(m[3]) };
  if ((m = new RegExp(String.raw`^room\s+${NAME}\s+has\s+(at least\s+)?(\d+)\s+tiles?$`, "i").exec(s)))
    return { kind: "tiles", room: m[1]!, atLeast: !!m[2], n: Number(m[3]) };
  if ((m = new RegExp(String.raw`^room\s+${NAME}\s+has\s+(at least\s+)?(\d+)\s+tile\s+layers?$`, "i").exec(s)))
    return { kind: "tile-layers", room: m[1]!, atLeast: !!m[2], n: Number(m[3]) };
  if ((m = new RegExp(String.raw`^room\s+${NAME}\s+has\s+a\s+tile\s+layer\s+using\s+${NAME}$`, "i").exec(s)))
    return { kind: "tile-layer-using", room: m[1]!, tileset: m[2]! };
  if ((m = new RegExp(String.raw`^room\s+${NAME}\s+is\s+at least\s+(\d+)\s+(wide|tall)$`, "i").exec(s)))
    return { kind: "room-size", room: m[1]!, n: Number(m[2]), side: m[3]!.toLowerCase() as "wide" };
  if ((m = new RegExp(String.raw`^room\s+${NAME}(?:'s)?\s+camera\s+follows\s+${NAME}$`, "i").exec(s)))
    return { kind: "camera-follows", room: m[1]!, object: m[2]! };
  if ((m = new RegExp(String.raw`^room\s+${NAME}\s+has\s+(at least\s+)?(\d+)\s+${NAME}$`, "i").exec(s)))
    return { kind: "count", room: m[1]!, atLeast: !!m[2], n: Number(m[3]), object: m[4]! };
  if ((m = /^prints?\s+(.+)$/i.exec(s))) return { kind: "prints", text: m[1]!.trim() };
  if ((m = new RegExp(String.raw`^game\s+runs\s+${SECONDS}\s+without\s+errors?$`, "i").exec(s))) return { kind: "runs", seconds: Number(m[1]) };
  if ((m = new RegExp(String.raw`^after\s+${SECONDS}(?:\s+holding\s+(.+?))?\s*,\s*(.+)$`, "i").exec(s))) {
    const seconds = Number(m[1]);
    const hold = (m[2] ?? "").split(/\s*(?:\+|,|\band\b)\s*/i).map((k) => k.trim().toLowerCase()).filter(Boolean);
    const bad = hold.find((k) => !(KEY_NAMES as readonly string[]).includes(k));
    if (bad) return { kind: "unknown", why: `"${bad}" isn't a key name (left, right, up, down, space, a…z, 0…9).` };
    if (seconds > 10) return { kind: "unknown", why: "A check can run the game for 10 seconds at most." };
    const rest = m[3]!.trim();
    const c = new RegExp(String.raw`^${NAME}\.${NAME}\s+(increased|decreased|changed|stayed the same)$`, "i").exec(rest);
    if (c) return { kind: "after", seconds, hold, object: c[1]!, prop: c[2]!, change: c[3]!.toLowerCase() as Change };
    return { kind: "after-expr", seconds, hold, expr: rest };
  }
  return { kind: "unknown", why: "GameIDE doesn't know this kind of check." };
}

export const needsGame = (c: Check) => c.kind === "runs" || c.kind === "after" || c.kind === "after-expr" || c.kind === "prints";

// ---------------------------------------------------------------- checks of the project

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** "Key Pressed: Space", "key pressed space" and "Key_Pressed space" are one name. */
const eventName = (s: string) => s.toLowerCase().replace(/[_:]/g, " ").replace(/\s+/g, " ").trim();
/**
 * The word in the code, not inside a longer name: "for" isn't in "format".
 * The edge rule only applies where the word itself starts or ends with a
 * letter or digit — `uses +` checked `3+4` with it, and the 3 beside the +
 * made a student's right answer fail (a Python Basics lesson, 2026-10-27).
 */
const wordIn = (code: string, word: string) => {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const before = /^[A-Za-z0-9_]/.test(word) ? "(?<![A-Za-z0-9_])" : "";
  const after = /[A-Za-z0-9_]$/.test(word) ? "(?![A-Za-z0-9_])" : "";
  return new RegExp(before + esc + after).test(code);
};

function codeOf(p: Project, object: string | null, event: string | null): { code: string; missing: string | null } {
  if (!object) {
    const parts = [...p.objects.flatMap((o) => o.events.map((e) => e.code)), ...p.scripts.map((s) => s.code), ...p.rooms.flatMap((r) => r.instances.map((i) => i.code))];
    return { code: parts.join("\n"), missing: null };
  }
  const o = p.objects.find((x) => same(x.name, object));
  if (!o) return { code: "", missing: `There's no object called ${object}.` };
  if (!event) return { code: o.events.map((e) => e.code).join("\n"), missing: null };
  const ev = o.events.find((e) => eventName(eventLabel(p, e.key)) === eventName(event));
  if (!ev) return { code: "", missing: `${o.name} doesn't have a ${event} event yet.` };
  return { code: ev.code, missing: null };
}

/** A check that only reads the project; null for one that needs the game run. */
export function checkProject(p: Project, c: Check): { ok: boolean; detail: string } | null {
  switch (c.kind) {
    case "unknown":
      return { ok: false, detail: c.why };
    case "exists": {
      const list = { object: p.objects, sprite: p.sprites, room: p.rooms, sound: p.sounds, font: p.fonts, script: p.scripts, tileset: p.tilesets }[c.what];
      return list.some((r) => same(r.name, c.name)) ? { ok: true, detail: "" } : { ok: false, detail: `There's no ${c.what} called ${c.name} yet.` };
    }
    case "has-sprite": {
      const o = p.objects.find((x) => same(x.name, c.object));
      if (!o) return { ok: false, detail: `There's no object called ${c.object}.` };
      return o.sprite && p.sprites.some((s) => s.id === o.sprite) ? { ok: true, detail: "" } : { ok: false, detail: `${o.name} doesn't have a sprite yet.` };
    }
    case "has-event": {
      const o = p.objects.find((x) => same(x.name, c.object));
      if (!o) return { ok: false, detail: `There's no object called ${c.object}.` };
      return o.events.some((e) => eventName(eventLabel(p, e.key)) === eventName(c.event))
        ? { ok: true, detail: "" }
        : { ok: false, detail: `${o.name} doesn't have a ${c.event} event yet.` };
    }
    case "mode": {
      const o = p.objects.find((x) => same(x.name, c.object));
      if (!o) return { ok: false, detail: `There's no object called ${c.object}.` };
      const ev = o.events.find((e) => eventName(eventLabel(p, e.key)) === eventName(c.event));
      if (!ev) return { ok: false, detail: `${o.name} doesn't have a ${c.event} event yet.` };
      const say = { python: "Python", blocks: "blocks", sheet: "an event sheet" };
      const is = ev.mode ?? "python";
      return is === c.mode ? { ok: true, detail: "" } : { ok: false, detail: `${o.name}'s ${c.event} event is written in ${say[is]}, not ${say[c.mode]}.` };
    }
    case "uses": {
      const { code, missing } = codeOf(p, c.object, c.event);
      if (missing) return { ok: false, detail: missing };
      const where = c.object ? (c.event ? `${c.object}'s ${c.event} event` : c.object) : "the game";
      const found = wordIn(code, c.word);
      if (c.avoid) return found ? { ok: false, detail: `${where} uses ${c.word}, and shouldn't.` } : { ok: true, detail: "" };
      return found ? { ok: true, detail: "" } : { ok: false, detail: `${where} doesn't use ${c.word} yet.` };
    }
    case "count": {
      const room = p.rooms.find((r) => same(r.name, c.room));
      if (!room) return { ok: false, detail: `There's no room called ${c.room}.` };
      const o = p.objects.find((x) => same(x.name, c.object));
      if (!o) return { ok: false, detail: `There's no object called ${c.object}.` };
      const n = room.instances.filter((i) => i.object === o.id).length;
      const ok = c.atLeast ? n >= c.n : n === c.n;
      return ok ? { ok: true, detail: "" } : { ok: false, detail: `${room.name} has ${n} ${o.name}${n === 1 ? "" : "s"}, not ${c.atLeast ? "at least " : ""}${c.n}.` };
    }
    case "frames": {
      const sp = p.sprites.find((x) => same(x.name, c.sprite));
      if (!sp) return { ok: false, detail: `There's no sprite called ${c.sprite} yet.` };
      const n = sp.frames.length;
      return (c.atLeast ? n >= c.n : n === c.n)
        ? { ok: true, detail: "" }
        : { ok: false, detail: `${sp.name} has ${n} frame${n === 1 ? "" : "s"}, not ${c.atLeast ? "at least " : ""}${c.n}.` };
    }
    case "solid": {
      const ts = p.tilesets.find((x) => same(x.name, c.tileset));
      if (!ts) return { ok: false, detail: `There's no tileset called ${c.tileset} yet.` };
      const n = ts.solid.length;
      return (c.atLeast ? n >= c.n : n === c.n)
        ? { ok: true, detail: "" }
        : { ok: false, detail: `${ts.name} has ${n} solid tile${n === 1 ? "" : "s"}, not ${c.atLeast ? "at least " : ""}${c.n}. Click tiles in its picture to make them solid (red).` };
    }
    case "cut": {
      const ts = p.tilesets.find((x) => same(x.name, c.tileset));
      if (!ts) return { ok: false, detail: `There's no tileset called ${c.tileset} yet.` };
      const size = ts.tileWidth === c.w && ts.tileHeight === c.h;
      const gaps = c.spacing === null || (ts.spacingX === c.spacing && ts.spacingY === c.spacing);
      if (size && gaps) return { ok: true, detail: "" };
      return {
        ok: false,
        detail: `${ts.name}'s tiles are ${ts.tileWidth} × ${ts.tileHeight} with spacing ${ts.spacingX} across and ${ts.spacingY} down, not ${c.w} × ${c.h}${c.spacing === null ? "" : ` with spacing ${c.spacing}`}. Set them in the tileset's Tiles box.`,
      };
    }
    case "autotiles": {
      const ts = p.tilesets.find((x) => same(x.name, c.tileset));
      if (!ts) return { ok: false, detail: `There's no tileset called ${c.tileset} yet.` };
      // A set with a slot still empty can't draw every join: it doesn't count yet.
      const n = ts.autotiles.filter((a) => a.tiles.every((t) => t >= 0)).length;
      return (c.atLeast ? n >= c.n : n === c.n)
        ? { ok: true, detail: "" }
        : { ok: false, detail: `${ts.name} has ${n} autotile set${n === 1 ? "" : "s"} with all 16 slots filled, not ${c.atLeast ? "at least " : ""}${c.n}. Make one under Autotile sets, and fill its slots.` };
    }
    case "sprite-size": {
      const sp = p.sprites.find((x) => same(x.name, c.sprite));
      if (!sp) return { ok: false, detail: `There's no sprite called ${c.sprite} yet.` };
      return sp.width === c.w && sp.height === c.h
        ? { ok: true, detail: "" }
        : { ok: false, detail: `${sp.name}'s frames are ${sp.width} × ${sp.height}, not ${c.w} × ${c.h}.` };
    }
    case "tiles":
    case "tile-layers":
    case "tile-layer-using":
    case "room-size":
    case "camera-follows": {
      const room = p.rooms.find((r) => same(r.name, c.room));
      if (!room) return { ok: false, detail: `There's no room called ${c.room}.` };
      const layers = room.layers.flatMap((l) => (l.kind === "tiles" ? [l] : []));
      const yes = { ok: true, detail: "" };
      if (c.kind === "tiles") {
        const n = layers.reduce((sum, l) => sum + Object.keys(l.tiles).length, 0);
        return (c.atLeast ? n >= c.n : n === c.n) ? yes : { ok: false, detail: `${room.name} has ${n} tile${n === 1 ? "" : "s"} painted, not ${c.atLeast ? "at least " : ""}${c.n}.` };
      }
      if (c.kind === "tile-layers") {
        const n = layers.length;
        return (c.atLeast ? n >= c.n : n === c.n) ? yes : { ok: false, detail: `${room.name} has ${n} tile layer${n === 1 ? "" : "s"}, not ${c.atLeast ? "at least " : ""}${c.n}.` };
      }
      if (c.kind === "tile-layer-using") {
        const ts = p.tilesets.find((x) => same(x.name, c.tileset));
        if (!ts) return { ok: false, detail: `There's no tileset called ${c.tileset} yet.` };
        if (!layers.length) return { ok: false, detail: `${room.name} has no tile layer yet. Add one in Layers.` };
        return layers.some((l) => l.tileset === ts.id) ? yes : { ok: false, detail: `No tile layer in ${room.name} uses ${ts.name}. Choose it in the layer's settings (⚙).` };
      }
      if (c.kind === "room-size") {
        const n = c.side === "wide" ? room.width : room.height;
        return n >= c.n ? yes : { ok: false, detail: `${room.name} is ${n} ${c.side}, not at least ${c.n}.` };
      }
      const o = p.objects.find((x) => same(x.name, c.object));
      if (!o) return { ok: false, detail: `There's no object called ${c.object}.` };
      if (!room.camera.enabled) return { ok: false, detail: `${room.name}'s camera is off. Turn on "Show part of the room" under Camera.` };
      return room.camera.follow === o.id ? yes : { ok: false, detail: `${room.name}'s camera doesn't follow ${o.name} yet.` };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------- checks of the game running

/**
 * A game the checks can play: fresh each start(), keys held and let go,
 * Python asked about its state, and the errors it raised since it started.
 *
 * "After 1 second" is GAME time — a second's worth of steps — not the
 * clock's. On a busy or slow computer the game runs fewer steps a second,
 * and a check timed by the clock failed there for a player who simply
 * hadn't got as far yet (it did, five browsers at once in the tests).
 */
export interface GameRunner {
  /** Steps the game has run since start(). */
  steps(): Promise<number>;
  /** The game's steps per second (its setting; 60 unless changed). */
  readonly stepsPerSecond: number;
  /** Plays the game from the start; resolves once it's running, or rejects with why not. */
  start(): Promise<void>;
  stop(): void;
  hold(key: string, down: boolean): void;
  py(expr: string): Promise<unknown>;
  errors(): string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** However slow the computer, a check gives up rather than wait for ever. */
const SLOWEST = 10;

/** Waits until the game has run `seconds` of game time. False if it never did (stuck, or far too slow). */
async function runFor(run: GameRunner, seconds: number): Promise<boolean> {
  const from = await run.steps();
  const want = Math.round(seconds * run.stepsPerSecond);
  const until = performance.now() + Math.max(2000, seconds * 1000 * SLOWEST);
  for (;;) {
    if ((await run.steps()) - from >= want) return true;
    if (run.errors().length || performance.now() > until) return false;
    await sleep(Math.min(50, (seconds * 1000) / 4));
  }
}

/** The first instance's property, from Python; null when there's no instance. */
const propExpr = (object: string, prop: string) =>
  `(lambda l: getattr(l[0], ${JSON.stringify(prop)}, None) if l else None)(instances(${JSON.stringify(object)}))`;

function failedEval(v: unknown): string | null {
  return v && typeof v === "object" && "error" in v ? String((v as { error: unknown }).error).split("\n").filter(Boolean).pop() ?? "error" : null;
}

export async function checkGame(run: GameRunner, c: Check): Promise<{ ok: boolean; detail: string }> {
  if (!needsGame(c)) return { ok: false, detail: "Not a check of the running game." };
  try {
    await run.start();
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
  try {
    if (c.kind === "runs") {
      const ran = await runFor(run, c.seconds);
      const errs = run.errors();
      if (!errs.length && !ran) return { ok: false, detail: "The game didn't keep running long enough to check." };
      return errs.length ? { ok: false, detail: `The game stopped with an error: ${errs[0]}` } : { ok: true, detail: "" };
    }
    if (c.kind === "prints") {
      // A second in: long enough for the Create events and a few steps.
      const ran = await runFor(run, 1);
      const errs = run.errors();
      if (errs.length) return { ok: false, detail: `The game stopped with an error: ${errs[0]}` };
      if (!ran) return { ok: false, detail: "The game didn't keep running long enough to check." };
      const out = await run.py("__import__('gameide')._printed()");
      const bad = failedEval(out);
      if (bad) return { ok: false, detail: bad };
      return printedOk(String(out ?? ""), c.text);
    }
    const before = c.kind === "after" ? await run.py(propExpr(c.object, c.prop)) : null;
    for (const k of c.hold) run.hold(k, true);
    const ran = await runFor(run, c.seconds);
    for (const k of c.hold) run.hold(k, false);
    if (!ran && !run.errors().length) return { ok: false, detail: "The game didn't keep running long enough to check." };
    const errs = run.errors();
    if (errs.length) return { ok: false, detail: `The game stopped with an error: ${errs[0]}` };
    if (c.kind === "after-expr") {
      const v = await run.py(`bool(${c.expr})`);
      const bad = failedEval(v);
      if (bad) return { ok: false, detail: `Checking "${c.expr}" gave an error: ${bad}` };
      return v === true ? { ok: true, detail: "" } : { ok: false, detail: `"${c.expr}" isn't true yet.` };
    }
    const after = await run.py(propExpr(c.object, c.prop));
    const bad = failedEval(before) ?? failedEval(after);
    if (bad) return { ok: false, detail: bad };
    if (before === null || after === null || before === undefined || after === undefined)
      return { ok: false, detail: `There's no ${c.object} in the game when it starts.` };
    if (typeof before !== "number" || typeof after !== "number") {
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      const ok = c.change === "changed" ? changed : c.change === "stayed the same" ? !changed : false;
      return ok ? { ok: true, detail: "" } : { ok: false, detail: `${c.object}.${c.prop} went from ${String(before)} to ${String(after)}.` };
    }
    const d = after - before;
    const ok = c.change === "increased" ? d > 0 : c.change === "decreased" ? d < 0 : c.change === "changed" ? d !== 0 : d === 0;
    return ok ? { ok: true, detail: "" } : { ok: false, detail: `${c.object}.${c.prop} went from ${round(before)} to ${round(after)}.` };
  } finally {
    run.stop();
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Did the console show `want`? Capitals and spacing don't count — a
 * beginner's "hello,  World" is the lesson learned, not a mistake to be
 * failed on. Otherwise the detail says what it did print, which is what
 * shows a student their typo.
 */
export function printedOk(printed: string, want: string): { ok: boolean; detail: string } {
  const squash = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  if (squash(printed).includes(squash(want))) return { ok: true, detail: "" };
  const shown = printed.trim().split("\n").slice(0, 3).join(" / ");
  if (!shown) return { ok: false, detail: `Nothing was printed yet. It should print "${want}".` };
  return { ok: false, detail: `It printed "${shown.length > 80 ? shown.slice(0, 80) + "…" : shown}", not "${want}".` };
}

/**
 * Every test in a block, run: the project's checks first (instant), then
 * the ones that play the game, one at a time, each from a fresh start.
 * `progress` says which is being run, for the page.
 */
export async function runTests(tests: TestLine[], project: Project, run: GameRunner | null, progress: (i: number) => void = () => {}): Promise<TestResult[]> {
  const out: TestResult[] = [];
  for (const [i, t] of tests.entries()) {
    progress(i);
    const c = readCheck(t.label);
    const quick = checkProject(project, c);
    if (quick) {
      out.push({ ...t, ...quick });
      continue;
    }
    if (!run) {
      out.push({ ...t, ok: false, detail: "This check plays the game, which can't run here." });
      continue;
    }
    out.push({ ...t, ...(await checkGame(run, c)) });
  }
  return out;
}
