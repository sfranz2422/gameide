/**
 * From a project to a runnable game: each object's events become methods of
 * a generated Python class, and every line of the generated source is mapped
 * back to the event and line the student typed, so an error in line 9 of
 * `class Player` is reported as "Player → Step, line 3".
 *
 * What students see. The object editor shows each event's body on its own;
 * the "Python class" view shows exactly the text built here, read-only, so
 * they can see the real Python their events make:
 *
 *     class Player(GameObject):
 *         def on_step(self):
 *             if keyboard_check("left"):
 *                 self.x -= 4
 *
 * The rules that keep the mapping exact:
 *   - each body line becomes exactly one generated line, indented 8 spaces
 *     (leading tabs become 4 spaces first, or a body mixing them would be a
 *     TabError the student can't see the cause of);
 *   - a body with no code in it (empty, or only comments) gets `pass` after
 *     it, which is mapped to the event's last line;
 *   - classes come out parents first, because `class Goblin(Enemy)` fails if
 *     Enemy doesn't exist yet — and every object gets a class, even one with
 *     no events, so a child always has its parent to inherit from.
 */
import type { PythonGameError } from "../engine/engine";
import type { BackgroundDef, GameDefinition, MaskShape, RoomDef, SpriteDef, TileLayerDef } from "../engine/game";
import { eventLabel, find, tilesetGrid, type EventKey, type ObjectResource, type Project, type RoomResource, type SpriteResource } from "../store/project";

/** One event's lines in the generated source. Lines are 1-based. */
export interface EventSpan {
  eventId: string;
  label: string;
  defLine: number; // the `def on_step(self):` line
  firstLine: number; // the body's line 1
  lineCount: number; // lines the student wrote
}

export interface ObjectSource {
  objectId: string;
  source: string;
  spans: EventSpan[];
}

export function methodName(project: Project, key: EventKey): string | null {
  switch (key.type) {
    case "collision": {
      const target = find(project, "objects", key.object);
      return target ? `on_collision_${target.name.toLowerCase()}` : null;
    }
    case "key":
      return `on_key_${key.kind}_${key.key}`;
    case "mouse":
      return `on_${key.global ? "global_" : ""}mouse_${key.button}_${key.edge}`;
    case "alarm":
      return `on_alarm_${key.n}`;
    default:
      return `on_${key.type}`;
  }
}

/** `def on_collision_coin(self, other):` — shown above the code box. */
export function methodSignature(project: Project, key: EventKey): string {
  const name = methodName(project, key) ?? "on_collision_(deleted)";
  return `def ${name}(self${key.type === "collision" ? ", other" : ""}):`;
}

function hasCode(lines: string[]): boolean {
  return lines.some((l) => {
    const t = l.trim();
    return t !== "" && !t.startsWith("#");
  });
}

const detab = (line: string) => line.replace(/^\t+/, (tabs) => "    ".repeat(tabs.length));

/** Objects ordered so that every parent comes before its children. */
export function parentsFirst(project: Project): ObjectResource[] {
  const out: ObjectResource[] = [];
  const placed = new Set<string>();
  const visit = (o: ObjectResource, path: Set<string>) => {
    if (placed.has(o.id) || path.has(o.id)) return; // a loop is reported by the runtime
    path.add(o.id);
    const parent = find(project, "objects", o.parent);
    if (parent) visit(parent, path);
    placed.add(o.id);
    out.push(o);
  };
  for (const o of project.objects) visit(o, new Set());
  return out;
}

export function generateObject(project: Project, obj: ObjectResource): ObjectSource {
  const parent = find(project, "objects", obj.parent);
  const lines = [`class ${obj.name}(${parent ? parent.name : "GameObject"}):`];
  const spans: EventSpan[] = [];
  const seen = new Set<string>();
  for (const ev of obj.events) {
    const name = methodName(project, ev.key);
    // A collision event aimed at a deleted object, or a duplicate the editor
    // should never have allowed: leave it out rather than generate code that
    // can never run, or that silently replaces the first copy.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (spans.length) lines.push("");
    lines.push(`    ${methodSignature(project, ev.key)}`);
    const defLine = lines.length;
    // An empty event has no lines at all (its `pass` then counts as line 1).
    const body = ev.code.trim() === "" ? [] : ev.code.replace(/\r\n?/g, "\n").split("\n");
    if (body.length > 1 && body[body.length - 1] === "") body.pop(); // a trailing newline isn't a line
    for (const l of body) lines.push(l.trim() === "" ? "" : `        ${detab(l)}`);
    if (!hasCode(body)) lines.push("        pass");
    spans.push({ eventId: ev.id, label: eventLabel(project, ev.key), defLine, firstLine: defLine + 1, lineCount: body.length });
  }
  if (!spans.length) lines.push("    pass");
  return { objectId: obj.id, source: lines.join("\n") + "\n", spans };
}

/** The editor's mask as the engine's: "auto" is just a box by the time a game runs. */
function engineMask(m: NonNullable<SpriteResource["mask"]>): MaskShape {
  if (m.kind === "circle") return m;
  const { left, top, right, bottom } = m;
  return { kind: m.kind === "precise" ? "precise" : "rect", left, top, right, bottom };
}

export interface BuiltGame {
  def: GameDefinition;
  /** Object name → its generated source and line map, for errors. */
  sources: Record<string, ObjectSource>;
}

/**
 * The project as a GameDefinition. `images` holds each asset's bytes; a
 * sprite whose frames are missing still gets its size, so collisions work
 * even when a picture failed to load.
 */
export function buildGame(project: Project, images: Map<string, Blob>): BuiltGame {
  const sprites: SpriteDef[] = project.sprites.map((s) => {
    const frames = s.frames.map((id) => images.get(id)).filter((b): b is Blob => !!b);
    return {
      name: s.name,
      width: s.width,
      height: s.height,
      originX: s.originX,
      originY: s.originY,
      frameCount: Math.max(1, s.frames.length),
      images: frames,
      ...(s.mask ? { mask: engineMask(s.mask) } : {}),
      ...(s.fps !== undefined ? { fps: s.fps } : {}),
    };
  });
  const sources: Record<string, ObjectSource> = {};
  const code: Record<string, string> = {};
  for (const o of parentsFirst(project)) {
    const src = generateObject(project, o);
    sources[o.name] = src;
    code[o.name] = src.source;
  }
  const hex = (c: string) => parseInt(c.replace("#", ""), 16) || 0;
  const def: GameDefinition = {
    sprites,
    objects: project.objects.map((o) => ({
      name: o.name,
      ...(find(project, "sprites", o.sprite) ? { sprite: find(project, "sprites", o.sprite)!.name } : {}),
      visible: o.visible,
      solid: o.solid,
      persistent: o.persistent,
      depth: o.depth,
      ...(find(project, "objects", o.parent) ? { parent: find(project, "objects", o.parent)!.name } : {}),
    })),
    tilesets: project.tilesets
      .filter((t) => t.image)
      .map((t) => {
        const { columns, rows } = tilesetGrid(t);
        const image = images.get(t.image!);
        return {
          name: t.name,
          ...(image ? { image } : {}),
          tileWidth: t.tileWidth,
          tileHeight: t.tileHeight,
          offsetX: t.offsetX,
          offsetY: t.offsetY,
          spacingX: t.spacingX,
          spacingY: t.spacingY,
          columns,
          count: columns * rows,
          solid: t.solid,
        };
      }),
    rooms: project.rooms.map((r) => buildRoom(project, r, hex)),
    code,
    stepsPerSecond: project.settings.stepsPerSecond,
    pixelScaling: project.settings.pixelScaling !== false,
    scripts: Object.fromEntries(project.scripts.map((s) => [s.name, s.code])),
    // Every sound and font is listed, even without a file yet, so its name
    // works in the game (silent, or the built-in font) instead of "no sound
    // called…" for one the student can see in the tree.
    sounds: (project.sounds ?? []).map((s) => {
      const blob = s.asset ? images.get(s.asset) : undefined;
      return { name: s.name, volume: s.volume, ...(blob ? { sound: blob } : {}) };
    }),
    fonts: (project.fonts ?? []).map((f) => {
      const blob = f.asset ? images.get(f.asset) : undefined;
      return { name: f.name, ...(blob ? { font: blob } : {}) };
    }),
  };
  return { def, sources };
}

/**
 * A room as the engine wants it. Instances keep their order (the engine
 * creates them in it, and creation-code errors name them by it). Background
 * layers hidden in the editor are left out; instance layers only organise
 * the editor, so their instances are always in the game.
 */
function buildRoom(project: Project, r: RoomResource, hex: (c: string) => number): RoomDef {
  const instances: RoomDef["instances"] = [];
  for (const i of r.instances) {
    const object = find(project, "objects", i.object)?.name;
    if (!object) continue;
    instances.push({
      object,
      x: i.x,
      y: i.y,
      ...(i.scaleX !== 1 ? { scaleX: i.scaleX } : {}),
      ...(i.scaleY !== 1 ? { scaleY: i.scaleY } : {}),
      ...(i.angle ? { angle: i.angle } : {}),
      ...(i.code.trim() ? { code: i.code } : {}),
    });
  }
  const backgrounds: BackgroundDef[] = [];
  for (const l of r.layers) {
    if (l.kind !== "background" || !l.visible || (!l.color && !l.sprite)) continue;
    const sprite = find(project, "sprites", l.sprite)?.name;
    backgrounds.push({
      depth: l.depth,
      ...(l.color ? { color: hex(l.color) } : {}),
      ...(sprite ? { sprite } : {}),
      mode: l.mode,
      hspeed: l.hspeed,
      vspeed: l.vspeed,
      parallax: l.parallax,
    });
  }
  // Tile layers as dense grids (what the engine reads fastest), from the
  // sparse "column,row" map the editor keeps. Tiles beyond the room's edge
  // (it was made smaller) are left out, not lost from the project.
  const tileLayers: TileLayerDef[] = [];
  for (const l of r.layers) {
    if (l.kind !== "tiles") continue;
    const ts = find(project, "tilesets", l.tileset);
    if (!ts || !ts.image) continue;
    const columns = Math.ceil(r.width / ts.tileWidth), rows = Math.ceil(r.height / ts.tileHeight);
    const cells = new Array<number>(columns * rows).fill(-1);
    for (const [key, tile] of Object.entries(l.tiles)) {
      const [c, row] = key.split(",").map(Number) as [number, number];
      if (c >= 0 && row >= 0 && c < columns && row < rows) cells[row * columns + c] = tile;
    }
    tileLayers.push({ name: l.name, depth: l.depth, visible: l.visible, tileset: ts.name, columns, rows, cells });
  }
  const follow = find(project, "objects", r.camera.follow)?.name;
  return {
    name: r.name,
    width: r.width,
    height: r.height,
    background: hex(r.background),
    instances,
    ...(backgrounds.length ? { backgrounds } : {}),
    ...(tileLayers.length ? { tileLayers } : {}),
    ...(r.camera.enabled
      ? { camera: { width: r.camera.width, height: r.camera.height, smoothing: r.camera.smoothing, ...(follow ? { follow } : {}) } }
      : {}),
  };
}

/** Which room instance a creation-code error came from: "<instance 0:3>" is room 0's 4th instance in the game. */
function placedInstance(project: Project, where: string) {
  const [ri, ii] = where.split(":").map(Number);
  const room = project.rooms[ri ?? -1];
  if (!room) return null;
  // The game skips instances whose object was deleted; count the same way.
  const placed = room.instances.filter((i) => find(project, "objects", i.object));
  const inst = placed[ii ?? -1];
  return inst ? { room, inst, object: find(project, "objects", inst.object)!.name } : null;
}

/** A Python error, pointed at what the student wrote. */
export interface MappedError {
  /** "Player → Step, line 3", or "script helpers, line 2", or null. */
  where: string | null;
  message: string;
  traceback: string;
  /** Where to jump to when the student clicks it. */
  target:
    | { kind: "event"; objectId: string; eventId: string; line: number }
    | { kind: "script"; scriptId: string; line: number }
    | { kind: "instance"; roomId: string; instanceId: string; line: number }
    | null;
  hang: boolean;
}

function locate(
  sources: Record<string, ObjectSource>,
  objectName: string,
  line: number,
): { span: EventSpan | null; bodyLine: number } {
  const src = sources[objectName];
  if (!src) return { span: null, bodyLine: line };
  for (const s of src.spans) {
    if (line === s.defLine) return { span: s, bodyLine: 1 };
    // The `pass` added after a body without code counts as its last line.
    const last = s.firstLine + Math.max(s.lineCount, 1) - 1;
    if (line >= s.firstLine && line <= last + 1) return { span: s, bodyLine: Math.min(line - s.firstLine + 1, Math.max(s.lineCount, 1)) };
  }
  return { span: null, bodyLine: line };
}

export function mapError(project: Project, sources: Record<string, ObjectSource>, e: PythonGameError): MappedError {
  let where: string | null = null;
  let target: MappedError["target"] = null;
  if (e.kind === "object" && e.object && e.line != null) {
    const { span, bodyLine } = locate(sources, e.object, e.line);
    const objectId = sources[e.object]?.objectId;
    if (span && objectId) {
      where = `${e.object} → ${span.label}, line ${bodyLine}`;
      target = { kind: "event", objectId, eventId: span.eventId, line: bodyLine };
    } else {
      where = e.object;
    }
  } else if (e.kind === "instance" && e.object) {
    // Line 1 of the generated function is its `def`; the student's line 1 is line 2.
    const found = placedInstance(project, e.object);
    const line = Math.max(1, (e.line ?? 2) - 1);
    if (found) {
      where = `${found.room.name} → ${found.object} at (${found.inst.x}, ${found.inst.y}), creation code line ${line}`;
      target = { kind: "instance", roomId: found.room.id, instanceId: found.inst.id, line };
    }
  } else if (e.kind === "script" && e.object) {
    where = `script ${e.object}${e.line != null ? `, line ${e.line}` : ""}`;
    const script = project.scripts.find((s) => s.name === e.object);
    if (script) target = { kind: "script", scriptId: script.id, line: e.line ?? 1 };
  }
  // Rewrite each `File "<object Player>", line 9, in on_step` the same way.
  const traceback = e.traceback.replace(/File "<(object|script|instance) ([^>]+)>", line (\d+), in (\S+)/g, (_m, kind, name, ln) => {
    if (kind === "script") return `script ${name}, line ${ln}`;
    if (kind === "instance") {
      const found = placedInstance(project, name);
      return found ? `${found.room.name} → ${found.object}'s creation code, line ${Math.max(1, Number(ln) - 1)}` : `creation code, line ${ln}`;
    }
    const { span, bodyLine } = locate(sources, name, Number(ln));
    return span ? `${name} → ${span.label}, line ${bodyLine}` : `${name}, line ${ln}`;
  });
  return { where, message: e.message, traceback, target, hang: !!e.hang };
}
