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
import { KEY_NAMES, MOUSE_BUTTONS, type KeyName } from "../engine/layout";

/** Bump when the format changes, and teach `migrate` the old shape. */
export const SCHEMA_VERSION = 1;

export interface Project {
  format: "gameide-project";
  schemaVersion: number;
  id: string;
  name: string;
  created: string; // ISO time
  modified: string;
  settings: ProjectSettings;
  sprites: SpriteResource[];
  objects: ObjectResource[];
  /** The first room is where the game starts. */
  rooms: RoomResource[];
  /** Shared Python, run before any object's code, in this order. */
  scripts: ScriptResource[];
}

export interface ProjectSettings {
  stepsPerSecond: number;
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
  /** Collision box in image pixels; absent means the whole image. */
  mask?: { left: number; top: number; right: number; bottom: number };
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
   * How the event is written. Only "python" exists yet; "blocks" (Phase 7)
   * and "sheet" (Phase 8) will keep their own data here and generate `code`.
   */
  mode: "python";
  /** The body of the method: what the student typed, without the def line. */
  code: string;
}

export interface RoomResource {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string; // "#rrggbb"
  instances: RoomInstance[];
}

export interface RoomInstance {
  id: string;
  object: string; // object id
  x: number;
  y: number;
}

export interface ScriptResource {
  id: string;
  name: string;
  code: string;
}

export type ResourceKind = "sprites" | "objects" | "rooms" | "scripts";
export type Resource = SpriteResource | ObjectResource | RoomResource | ScriptResource;

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
    objects: [],
    rooms: [newRoom("Room1")],
    scripts: [],
  };
}

export function newObject(name: string): ObjectResource {
  return { id: newId(), name, sprite: null, visible: true, solid: false, persistent: false, depth: 0, parent: null, events: [] };
}

export function newRoom(name: string): RoomResource {
  return { id: newId(), name, width: 640, height: 480, background: "#1e293b", instances: [] };
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
  return out;
}

export function replaceQuoted(project: Project, from: string, to: string) {
  const re = new RegExp(`(["'])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "g");
  const sub = (code: string) => code.replace(re, (_m, q: string) => `${q}${to}${q}`);
  for (const o of project.objects) for (const e of o.events) e.code = sub(e.code);
  for (const s of project.scripts) s.code = sub(s.code);
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
    "draw", "room_start", "room_end", "game_start", "animation_end", "outside_room", "intersect_boundary"];
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
  // schemaVersion 1 is the first; future upgrades go here.
  return p as Project;
}
