/**
 * The project format: everything a student makes, as plain JSON.
 *
 * Kept deliberately easy to read from code — tutorial step checks (Phase 11)
 * will ask things like "does Player have a step event that uses
 * keyboard_check?" by looking straight at this — so no classes, no derived
 * fields, nothing that only makes sense after processing.
 *
 * Resources refer to each other by `id`, never by name, so renaming an
 * object does not break the rooms it is placed in or the collision events
 * aimed at it. Names appear only where a student types them (inside their
 * Python), and codegen.ts turns ids into names when the game is built.
 *
 * Images are not in here: a sprite lists asset ids, and the store keeps the
 * image bytes separately (IndexedDB now, the server in Phase 3), so saving a
 * keystroke does not rewrite every picture.
 */
import { renameInBlocks, type BlocksState } from "../blocks/blockState";
import { renameInSheet, type Sheet } from "../eventsheets/sheet";
import { KEY_NAMES, MOUSE_BUTTONS, type KeyName } from "../engine/layout";

/** Bump when the format changes, and teach `migrate` the old shape. */
export const SCHEMA_VERSION = 8; // 2: room layers, grid, camera, instance overrides. 3: tilesets and tile layers. 4: autotile sets. 5: blocks in events. 6: blocks in scripts and creation code. 7: event sheets. 8: sounds and fonts

export interface Project {
  format: "gameide-project";
  schemaVersion: number;
  id: string;
  name: string;
  created: string; // ISO time
  modified: string;
  settings: ProjectSettings;
  sprites: SpriteResource[];
  tilesets: TilesetResource[];
  objects: ObjectResource[];
  /** The first room is where the game starts. */
  rooms: RoomResource[];
  /** Shared Python, run before any object's code, in this order. */
  scripts: ScriptResource[];
  /** For sound_play and music_play. */
  sounds: SoundResource[];
  /** For draw_set_font. */
  fonts: FontResource[];
  /**
   * The tutorial this game follows, and how far it has got: kept in the
   * game, so it saves offline and signed out like any change, and My Games
   * and the library can read progress from the games themselves. Absent on
   * games that aren't a tutorial. (No schema change: older GameIDE ignores it.)
   */
  tutorial?: TutorialProgress;
}

export interface TutorialProgress {
  /** builtin:<name>, t:<slug> (a teacher's) or a:<slug> (an assignment made from one) — backend/tutorials.py. */
  key: string;
  title: string;
  /** Steps done: the step to go on from. Equal to `steps` when finished. */
  step: number;
  steps: number;
}

/** A sound from the Sounds folder: an MP3, OGG or WAV file, and how loud it plays. */
export interface SoundResource {
  id: string;
  name: string;
  /** Asset id of the file; null until one is chosen. */
  asset: string | null;
  /** 0–1, multiplied with the volume sound_play is given. */
  volume: number;
}

/** A font from the Fonts folder: a TTF, OTF or WOFF file. */
export interface FontResource {
  id: string;
  name: string;
  asset: string | null;
}

export interface ProjectSettings {
  stepsPerSecond: number;
  /** Whole-number scaling of the game window (crisp pixel art). Absent = on. */
  pixelScaling?: boolean;
}

export interface SpriteResource {
  id: string;
  name: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  /** Asset ids, one per animation frame. */
  frames: string[];
  /** The collision mask; absent means a box around the whole image. */
  mask?: SpriteMask;
  /**
   * Animation speed, frames per second, at image_speed 1. Absent means one
   * frame per step — sprites made before sprites had a speed.
   */
  fps?: number;
}

/**
 * A collision mask, in the sprite's own pixels. "auto" is a box the editor
 * keeps fitted to the opaque pixels of all frames; "precise" stores the box
 * around them too (the engine uses it to find candidates fast) and takes the
 * pixels themselves from the pictures when the game starts. A mask saved
 * before masks had kinds has no `kind` and is a box.
 */
export type SpriteMask =
  | { kind: "auto" | "rect" | "precise"; left: number; top: number; right: number; bottom: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

/**
 * A picture cut into equal tiles for painting levels. Tiles are numbered
 * from 0, left to right then down — the number tile_at() gives back.
 */
export interface TilesetResource {
  id: string;
  name: string;
  /** Asset id of the picture. */
  image: string | null;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  offsetX: number;
  offsetY: number;
  spacingX: number;
  spacingY: number;
  /** Tile numbers that are solid: walls and floors, for collisions. */
  solid: number[];
  /** Tile numbers that are one-way platforms (game.ts TilesetDef.oneWay). Absent in older projects: none. */
  oneWay?: number[];
  /**
   * Autotile sets: 16 tiles each, one per way a cell joins its neighbours
   * (editor/tiles/tileOps.ts), so painting "grass" picks edges and corners
   * by itself.
   */
  autotiles: { id: string; name: string; tiles: number[] }[];
}

export interface ObjectResource {
  id: string;
  name: string;
  sprite: string | null; // sprite id
  visible: boolean;
  solid: boolean;
  persistent: boolean;
  depth: number;
  parent: string | null; // object id
  events: ObjectEvent[];
}

/** Which event, as data. codegen.ts turns this into a method name. */
export type EventKey =
  | { type: SimpleEventType }
  | { type: "collision"; object: string } // object id
  | { type: "key"; kind: "down" | "pressed" | "released"; key: KeyName }
  | { type: "mouse"; button: (typeof MOUSE_BUTTONS)[number]; edge: "pressed" | "released"; global: boolean }
  | { type: "alarm"; n: number };

export const SIMPLE_EVENTS = [
  "create",
  "destroy",
  "cleanup",
  "begin_step",
  "step",
  "end_step",
  "draw",
  "draw_gui",
  "room_start",
  "room_end",
  "game_start",
  "animation_end",
  "outside_room",
  "intersect_boundary",
] as const;
export type SimpleEventType = (typeof SIMPLE_EVENTS)[number];

export interface ObjectEvent {
  id: string;
  key: EventKey;
  /**
   * How the event is written. "python" is typed; "blocks" keeps its blocks
   * in `blocks`, "sheet" its rows in `sheet`, and both write the Python they
   * make into `code` on every change, so the game, error mapping and export
   * only ever read `code`. Python never turns into blocks or a sheet.
   */
  mode: "python" | "blocks" | "sheet";
  /** The body of the method, without the def line: typed, or made by the blocks. */
  code: string;
  /** Blockly's saved workspace, when mode is "blocks" (blocks/blockState.ts). */
  blocks?: BlocksState;
  /** The event sheet's rows, when mode is "sheet" (eventsheets/sheet.ts). */
  sheet?: Sheet;
}

export interface RoomResource {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string; // "#rrggbb", behind everything
  /** The editor's grid; instances snap to it when `snap` is on. */
  gridWidth: number;
  gridHeight: number;
  snap: boolean;
  /**
   * Drawn back to front by depth (highest first), like everything else.
   * Instance layers only organise the editor — show, hide, lock — and an
   * instance still draws at its object's depth; background layers draw a
   * colour or picture at their own depth. Tile layers arrive in Phase 6.
   */
  layers: RoomLayer[];
  /** The view: what part of the room the game window shows. */
  camera: RoomCamera;
  instances: RoomInstance[];
}

export type RoomLayer =
  | { id: string; name: string; kind: "instances"; depth: number; visible: boolean; locked: boolean }
  | {
      id: string;
      name: string;
      kind: "tiles";
      depth: number;
      visible: boolean;
      locked: boolean;
      tileset: string | null; // tileset id
      /**
       * Painted tiles, "column,row" → tile number, on the tileset's own
       * grid from the room's top-left. Sparse, so an empty level is small,
       * resizing the room loses nothing, and a check can ask for one cell.
       */
      tiles: Record<string, number>;
    }
  | {
      id: string;
      name: string;
      kind: "background";
      depth: number;
      visible: boolean;
      locked: boolean;
      color: string | null; // "#rrggbb" or none
      sprite: string | null; // sprite id
      /** "tile" repeats the picture, "stretch" fills the room with it, "once" draws it at the top-left. */
      mode: "tile" | "stretch" | "once";
      /** Pixels per step it scrolls by itself (a moving sky). */
      hspeed: number;
      vspeed: number;
      /** 0 = fixed to the room, 1 = fixed to the screen; between is parallax. */
      parallax: number;
    };

export interface RoomCamera {
  /** Off: the window shows the whole room. */
  enabled: boolean;
  width: number;
  height: number;
  /** Follow the first instance of this object (id), keeping it in the middle. */
  follow: string | null;
  /** 1 = snap to the target every step; smaller = glide (0.1 is gentle). */
  smoothing: number;
}

export interface RoomInstance {
  id: string;
  object: string; // object id
  layer: string; // layer id (an instance layer)
  x: number;
  y: number;
  /** Overrides, applied before its Create event. */
  scaleX: number;
  scaleY: number;
  angle: number;
  /** Creation code: Python run for this one instance, after its Create event. */
  code: string;
  /** Absent means "python". As for an event: blocks or a sheet write their Python into `code`. */
  mode?: "python" | "blocks" | "sheet";
  blocks?: BlocksState;
  sheet?: Sheet;
}

export interface ScriptResource {
  id: string;
  name: string;
  /** Python run before any object: its functions are for every object to call. */
  code: string;
  /** Absent means "python". Blocks scripts hold function definitions, and write them into `code`. */
  mode?: "python" | "blocks";
  blocks?: BlocksState;
}

export type ResourceKind = "sprites" | "tilesets" | "objects" | "rooms" | "scripts" | "sounds" | "fonts";
export type Resource = SpriteResource | TilesetResource | ObjectResource | RoomResource | ScriptResource | SoundResource | FontResource;

/**
 * Every asset a project uses: sprite frames, tileset pictures, sound and
 * font files. The one list saving, loading and the zip export all go by — a
 * kind of asset missing here would be quietly left behind by all three.
 */
export function assetIds(project: Project): string[] {
  return [
    ...new Set([
      ...project.sprites.flatMap((s) => s.frames),
      ...project.tilesets.flatMap((t) => (t.image ? [t.image] : [])),
      ...(project.sounds ?? []).flatMap((s) => (s.asset ? [s.asset] : [])),
      ...(project.fonts ?? []).flatMap((f) => (f.asset ? [f.asset] : [])),
    ]),
  ];
}

// ---------------------------------------------------------------- ids

const ID_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/** A short random id; collisions are as unlikely as they need to be inside one project. */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

// ---------------------------------------------------------------- making things

export function blankProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    format: "gameide-project",
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    created: now,
    modified: now,
    settings: { stepsPerSecond: 60 },
    sprites: [],
    tilesets: [],
    objects: [],
    rooms: [newRoom("Room1")],
    scripts: [],
    sounds: [],
    fonts: [],
  };
}

/**
 * A game's picture on "My games": the first frame of its sprite named
 * "icon", as in microStudio — or null, for the default picture. The server
 * has the same rule (gamestore.icon_asset).
 */
export function projectIcon(project: Project): string | null {
  return project.sprites.find((s) => s.name.toLowerCase() === "icon")?.frames[0] ?? null;
}

export function newSound(name: string): SoundResource {
  return { id: newId(), name, asset: null, volume: 1 };
}

export function newFont(name: string): FontResource {
  return { id: newId(), name, asset: null };
}

export function newObject(name: string): ObjectResource {
  return { id: newId(), name, sprite: null, visible: true, solid: false, persistent: false, depth: 0, parent: null, events: [] };
}

export function newRoom(name: string): RoomResource {
  const layers = defaultLayers();
  return {
    id: newId(),
    name,
    width: 640,
    height: 480,
    background: "#1e293b",
    gridWidth: 32,
    gridHeight: 32,
    snap: true,
    layers,
    camera: { enabled: false, width: 640, height: 480, follow: null, smoothing: 1 },
    instances: [],
  };
}

export function defaultLayers(): RoomLayer[] {
  return [
    { id: newId(), name: "Instances", kind: "instances", depth: 0, visible: true, locked: false },
    { id: newId(), name: "Background", kind: "background", depth: 1000, visible: true, locked: false, color: null, sprite: null, mode: "tile", hspeed: 0, vspeed: 0, parallax: 0 },
  ];
}

/** A room instance with nothing overridden, on the room's first instance layer. */
export function newInstance(room: RoomResource, object: string, x: number, y: number, layer?: string): RoomInstance {
  const target = layer ?? room.layers.find((l) => l.kind === "instances")?.id ?? "";
  return { id: newId(), object, layer: target, x, y, scaleX: 1, scaleY: 1, angle: 0, code: "" };
}

export function newTileset(name: string): TilesetResource {
  return { id: newId(), name, image: null, imageWidth: 0, imageHeight: 0, tileWidth: 32, tileHeight: 32, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0, solid: [], autotiles: [] };
}

/** How many tiles across and down a tileset's picture holds. */
export function tilesetGrid(t: TilesetResource): { columns: number; rows: number } {
  const across = (t.imageWidth - t.offsetX + t.spacingX) / (t.tileWidth + t.spacingX);
  const down = (t.imageHeight - t.offsetY + t.spacingY) / (t.tileHeight + t.spacingY);
  return { columns: Math.max(0, Math.floor(across)), rows: Math.max(0, Math.floor(down)) };
}

/**
 * After a tileset's grid changed (a new picture, or a different tile size,
 * offset or spacing), keeps every painted tile on the same picture tile —
 * the same column and row of the sheet — rather than the same number.
 * Tile n is row * columns + column, so a picture one tile wider would
 * otherwise shift every tile below the first row to a different picture.
 * Solid flags move with their tiles. Returns how many painted tiles pointed
 * at a column or row the new grid no longer has; those are removed.
 */
export function remapTileset(project: Project, tilesetId: string, before: TilesetResource): number {
  const after = find(project, "tilesets", tilesetId);
  if (!after) return 0;
  const was = tilesetGrid(before), now = tilesetGrid(after);
  if (was.columns === now.columns && was.rows === now.rows) return 0;
  const move = (n: number): number | null => {
    const c = n % Math.max(1, was.columns), r = Math.floor(n / Math.max(1, was.columns));
    return c < now.columns && r < now.rows ? r * now.columns + c : null;
  };
  let lost = 0;
  for (const room of project.rooms)
    for (const l of room.layers) {
      if (l.kind !== "tiles" || l.tileset !== tilesetId) continue;
      const out: Record<string, number> = {};
      for (const [k, t] of Object.entries(l.tiles)) {
        const m = move(t);
        if (m === null) lost++;
        else out[k] = m;
      }
      l.tiles = out;
    }
  after.solid = after.solid.flatMap((n) => {
    const m = move(n);
    return m === null ? [] : [m];
  });
  if (after.oneWay)
    after.oneWay = after.oneWay.flatMap((n) => {
      const m = move(n);
      return m === null ? [] : [m];
    });
  for (const set of after.autotiles) set.tiles = set.tiles.map((n) => (n < 0 ? n : move(n) ?? -1));
  return lost;
}

export function newScript(name: string): ScriptResource {
  return { id: newId(), name, code: "# Functions here can be used by every object.\n" };
}

export function newEvent(key: EventKey): ObjectEvent {
  return { id: newId(), key, mode: "python", code: "" };
}

// ---------------------------------------------------------------- names

/**
 * Words an object can't be called: Python's keywords, and the names of the
 * engine's own functions, which a class of that name would hide.
 */
const PYTHON_KEYWORDS = new Set(
  ("False None True and as assert async await break class continue def del elif else except finally for from " +
    "global if import in is lambda nonlocal not or pass raise return try while with yield self").split(" "),
);
const RESERVED = new Set(["GameObject", "global_vars", "print", "range", "len", "int", "str", "list", "random", "math"]);

/**
 * Why `name` can't be used for a new or renamed resource, or null if it can.
 * Objects become Python classes, so their names must be identifiers — and
 * unique ignoring case, because collision events are named in lower case
 * (`on_collision_coin`), so Coin and coin could not be told apart.
 */
export function nameProblem(project: Project, kind: ResourceKind, name: string, renaming?: string): string | null {
  if (!name.trim()) return "A name can't be empty.";
  if (kind === "objects" || kind === "scripts") {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      return "Use letters, digits and _ only, starting with a letter — it becomes a Python name.";
    if (PYTHON_KEYWORDS.has(name)) return `"${name}" is a Python word and can't be a name.`;
    if (RESERVED.has(name)) return `"${name}" is already used by GameIDE.`;
  } else if (!/^[A-Za-z0-9_][A-Za-z0-9_ -]*$/.test(name)) {
    return "Use letters, digits, spaces, - and _ only.";
  }
  const list = project[kind] as Resource[];
  const lower = name.toLowerCase();
  const clash = list.find((r) => r.id !== renaming && r.name.toLowerCase() === lower);
  if (clash) return `There is already one called "${clash.name}".`;
  return null;
}

/** "Object1", "Object2", ... — the first free one. */
export function freeName(project: Project, kind: ResourceKind, base: string): string {
  for (let i = 1; ; i++) {
    const name = `${base}${i}`;
    if (!nameProblem(project, kind, name)) return name;
  }
}

// ---------------------------------------------------------------- lookups

export function find<K extends ResourceKind>(project: Project, kind: K, id: string | null | undefined): Project[K][number] | undefined {
  if (!id) return undefined;
  return (project[kind] as Resource[]).find((r) => r.id === id) as Project[K][number] | undefined;
}

export function findByName<K extends ResourceKind>(project: Project, kind: K, name: string): Project[K][number] | undefined {
  return (project[kind] as Resource[]).find((r) => r.name === name) as Project[K][number] | undefined;
}

/** Would making `parent` the parent of `child` create a loop? */
export function wouldLoop(project: Project, child: string, parent: string | null): boolean {
  const seen = new Set<string>();
  for (let cur = parent; cur; cur = find(project, "objects", cur)?.parent ?? null) {
    if (cur === child || seen.has(cur)) return true;
    seen.add(cur);
  }
  return false;
}

// ---------------------------------------------------------------- changes with knock-on effects

/**
 * Deletes a resource and everything that pointed at it: an object's room
 * instances, the collision events aimed at it, and its children's parent
 * link; a sprite's use by objects. Returns what was cleaned up, in words,
 * so the confirmation can say so before anything goes.
 */
export function deleteResource(project: Project, kind: ResourceKind, id: string): string[] {
  const effects: string[] = [];
  if (kind === "objects") {
    for (const room of project.rooms) {
      const before = room.instances.length;
      room.instances = room.instances.filter((i) => i.object !== id);
      const n = before - room.instances.length;
      if (n) effects.push(`${n} instance${n === 1 ? "" : "s"} in ${room.name}`);
    }
    for (const o of project.objects) {
      if (o.parent === id) {
        o.parent = null;
        effects.push(`${o.name}'s parent`);
      }
      const before = o.events.length;
      o.events = o.events.filter((e) => !(e.key.type === "collision" && e.key.object === id));
      if (o.events.length < before) effects.push(`${o.name}'s collision event with it`);
    }
  }
  if (kind === "tilesets") {
    for (const room of project.rooms) {
      for (const l of room.layers) {
        if (l.kind === "tiles" && l.tileset === id) {
          const n = Object.keys(l.tiles).length;
          l.tileset = null;
          l.tiles = {};
          effects.push(`the ${n} tile${n === 1 ? "" : "s"} painted on ${room.name}'s ${l.name}`);
        }
      }
    }
  }
  if (kind === "sprites") {
    for (const o of project.objects) {
      if (o.sprite === id) {
        o.sprite = null;
        effects.push(`${o.name}'s sprite`);
      }
    }
  }
  (project[kind] as Resource[]).splice(
    (project[kind] as Resource[]).findIndex((r) => r.id === id),
    1,
  );
  return effects;
}

/**
 * Places in students' Python where an old name appears as a string —
 * `"Coin"` or `'Coin'` — so a rename can offer to update them. Names inside
 * code that aren't in quotes are left alone: that's a variable or a class
 * reference, which renaming the object already takes care of through the
 * generated class, or the student's own name for something else.
 */
export function quotedUses(project: Project, name: string): { where: string; count: number }[] {
  const re = new RegExp(`(["'])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "g");
  const out: { where: string; count: number }[] = [];
  for (const o of project.objects)
    for (const e of o.events) {
      const n = (e.code.match(re) ?? []).length;
      if (n) out.push({ where: `${o.name} → ${eventLabel(project, e.key)}`, count: n });
    }
  for (const s of project.scripts) {
    const n = (s.code.match(re) ?? []).length;
    if (n) out.push({ where: `script ${s.name}`, count: n });
  }
  for (const r of project.rooms)
    for (const i of r.instances) {
      const n = (i.code.match(re) ?? []).length;
      if (n) out.push({ where: `${r.name} → ${find(project, "objects", i.object)?.name ?? "an instance"}'s creation code`, count: n });
    }
  return out;
}

export function replaceQuoted(project: Project, from: string, to: string) {
  const re = new RegExp(`(["'])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "g");
  const sub = (code: string) => code.replace(re, (_m, q: string) => `${q}${to}${q}`);
  for (const o of project.objects)
    for (const e of o.events) {
      e.code = sub(e.code);
      if (e.blocks) renameInBlocks(e.blocks, from, to);
      if (e.sheet) renameInSheet(e.sheet, from, sub, to);
    }
  for (const s of project.scripts) {
    s.code = sub(s.code);
    if (s.blocks) renameInBlocks(s.blocks, from, to);
  }
  for (const r of project.rooms)
    for (const i of r.instances) {
      i.code = sub(i.code);
      if (i.blocks) renameInBlocks(i.blocks, from, to);
      if (i.sheet) renameInSheet(i.sheet, from, sub, to);
    }
}

// ---------------------------------------------------------------- events in words

const SIMPLE_LABELS: Record<SimpleEventType, string> = {
  create: "Create",
  destroy: "Destroy",
  cleanup: "Clean Up",
  begin_step: "Begin Step",
  step: "Step",
  end_step: "End Step",
  draw: "Draw",
  draw_gui: "Draw GUI",
  room_start: "Room Start",
  room_end: "Room End",
  game_start: "Game Start",
  animation_end: "Animation End",
  outside_room: "Outside Room",
  intersect_boundary: "Intersect Boundary",
};

const KEY_LABEL: Record<string, string> = { any: "any key", space: "Space", enter: "Enter" };
const keyLabel = (k: string) => KEY_LABEL[k] ?? (k.length === 1 ? k.toUpperCase() : k[0]!.toUpperCase() + k.slice(1));

/** "Collision with Coin", "Key Pressed: Space", "Alarm 0". */
export function eventLabel(project: Project, key: EventKey): string {
  switch (key.type) {
    case "collision":
      return `Collision with ${find(project, "objects", key.object)?.name ?? "(deleted object)"}`;
    case "key":
      return `Key ${key.kind === "down" ? "Down" : key.kind === "pressed" ? "Pressed" : "Released"}: ${keyLabel(key.key)}`;
    case "mouse": {
      const b = key.button[0]!.toUpperCase() + key.button.slice(1);
      return `${key.global ? "Global " : ""}${b} ${key.edge === "pressed" ? "Pressed" : "Released"}`;
    }
    case "alarm":
      return `Alarm ${key.n}`;
    default:
      return SIMPLE_LABELS[key.type];
  }
}

/** The order events are listed in, roughly GameMaker's. */
export function eventSortKey(key: EventKey): number {
  const order = ["create", "destroy", "cleanup", "begin_step", "step", "end_step", "alarm", "key", "mouse", "collision",
    "draw", "draw_gui", "room_start", "room_end", "game_start", "animation_end", "outside_room", "intersect_boundary"];
  const i = order.indexOf(key.type);
  return i * 1000 + (key.type === "alarm" ? key.n : 0);
}

/** Two keys name the same event (an object can't have the same event twice). */
export function sameEvent(a: EventKey, b: EventKey): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export { KEY_NAMES, MOUSE_BUTTONS };

// ---------------------------------------------------------------- loading

/**
 * Turns whatever was stored into a current Project, or throws with a
 * sentence a student can read. Older schema versions are upgraded here, one
 * step at a time, as the format grows.
 */
export function migrate(data: unknown): Project {
  const p = data as Partial<Project> | null;
  if (!p || p.format !== "gameide-project") throw new Error("This isn't a GameIDE project.");
  if (typeof p.schemaVersion !== "number" || p.schemaVersion > SCHEMA_VERSION)
    throw new Error("This project was made by a newer GameIDE. Reload the page to update.");
  if (p.schemaVersion < 2) upgradeTo2(p as Project);
  if (p.schemaVersion < 3) upgradeTo3(p as Project);
  if (p.schemaVersion < 4) upgradeTo4(p as Project);
  // 4 → 5: events may be blocks; 5 → 6: scripts and creation code too;
  // 6 → 7: events and creation code may be sheets. Everything older is
  // Python, as it says (a missing mode means Python).
  if (p.schemaVersion < 7) p.schemaVersion = 7;
  // 7 → 8: the Sounds and Fonts folders arrived; older projects have none.
  if (p.schemaVersion < 8) {
    p.sounds ??= [];
    p.fonts ??= [];
    p.schemaVersion = 8;
  }
  return p as Project;
}

/** 3 → 4: tilesets gained autotile sets; older ones have none. */
function upgradeTo4(p: Project) {
  for (const t of p.tilesets) t.autotiles ??= [];
  p.schemaVersion = 4;
}

/** 2 → 3: tilesets arrived; a project from before has none, and no tile layers. */
function upgradeTo3(p: Project) {
  p.tilesets ??= [];
  p.schemaVersion = 3;
}

/**
 * 1 → 2: rooms got layers, a grid and a camera, and room instances got
 * scale, angle and creation code. Every room keeps exactly what it showed:
 * its instances go on a new Instances layer, the camera is off (the whole
 * room, as before), and nothing is scaled or turned.
 */
function upgradeTo2(p: Project) {
  for (const room of p.rooms as (RoomResource & Partial<RoomResource>)[]) {
    room.gridWidth ??= 32;
    room.gridHeight ??= 32;
    room.snap ??= true;
    room.layers ??= defaultLayers();
    room.camera ??= { enabled: false, width: room.width, height: room.height, follow: null, smoothing: 1 };
    const layer = room.layers.find((l) => l.kind === "instances")!.id;
    room.instances = room.instances.map((i) => ({ ...i, layer: i.layer ?? layer, scaleX: i.scaleX ?? 1, scaleY: i.scaleY ?? 1, angle: i.angle ?? 0, code: i.code ?? "" }));
  }
  p.schemaVersion = 2;
}
