/**
 * The engine core: motion, animation, collisions, alarms and the per-step
 * bookkeeping around the one Python call each frame makes.
 *
 * Nothing in here knows about PixiJS or Pyodide. It reads and writes the
 * shared arrays (layout.ts) and answers the queries Python sends it, so the
 * Vitest suites can run whole games in node with no canvas at all.
 *
 * One step, in GameMaker's order:
 *
 *   beginStep()        engine   xprevious/yprevious, alarms count down,
 *                               input latched, mouse-on-instance events found
 *   frame()            Python   Begin Step → Alarm → Keyboard → Mouse → Step
 *     motion()         engine     ← called back from inside frame(): speeds,
 *                                   gravity, friction, animation, collisions,
 *                                   leaving the room
 *                      Python   → Collision → End Step → Draw
 *   endStep(commands)  engine   draw list, debug text, room changes
 *
 * motion() is a call from Python back into JavaScript in the middle of the
 * frame, rather than a second top-level call, so collision events still run
 * after movement and before End Step exactly as GameMaker orders them, and
 * the frame still crosses the bridge only once from the JavaScript side.
 */
import { EV, EVENTS_HEADER, F, G, HANDLES, STRIDE } from "./layout";
import type { GameDefinition, SoundOrder } from "./game";
import { InputState } from "./input";
import { Effects, type FxOrder, type Light } from "./effects";
import { SpatialHash } from "./spatialHash";
import { boxOf, containsPoint, maskOverlapsBox, masksOverlap, overlaps, spriteInfo, type Box, type SpriteInfo } from "./sprites";
import type { TileLayerDef, TilesetDef } from "./game";

/**
 * A tile layer as it is now — tile_set() changes it — rebuilt from the room's
 * definition each time the room starts, as GameMaker's rooms are.
 */
export interface LiveTiles {
  def: TileLayerDef;
  tileset: TilesetDef;
  cells: Int32Array;
  solid: Uint8Array;
  /** One-way platforms (TilesetDef.oneWay); never also solid. */
  oneWay: Uint8Array;
}

/**
 * The answer from a query that can hit a tile: a slot (≥ 0), nothing (-1),
 * or tile layer L as -2 - L. Python turns the last into the layer's name.
 */
export const tileCode = (layer: number) => -2 - layer;

/**
 * How far along the segment (0 its start, 1 its end) it first enters `box`,
 * or null if it never does: the Liang–Barsky clip. A start inside the box is 0.
 */
export function segmentEntersBox(x1: number, y1: number, x2: number, y2: number, box: Box): number | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const edges: [number, number][] = [[-dx, x1 - box.left], [dx, box.right - x1], [-dy, y1 - box.top], [dy, box.bottom - y1]];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return null;
    }
  }
  return t0;
}

/** The shared arrays, as JavaScript sees them. See layout.ts. */
export interface SharedViews {
  st: Float64Array;
  dirty: Int32Array;
  events: Int32Array;
  result: Int32Array;
  keys: Uint8Array;
  g: Float64Array;
}

/** What Python returns from a frame, after JSON.parse. */
export interface FrameCommands {
  draw?: DrawCommand[];
  /** Draw GUI: in screen coordinates, over everything, not moved by the camera. */
  gui?: DrawCommand[];
  debug?: string | null;
  room?: number;
  error?: PythonGameError;
  warnings?: string[];
  /** Sounds to play or stop (the page does it: workers have no audio). */
  sounds?: SoundOrder[];
  /** The game's whole save data, when it changed this frame. */
  save?: Record<string, unknown>;
  /** Particles, weather, lighting and screen-effect orders (effects.ts). */
  fx?: FxOrder[];
  /** This step's lights (light()); none sent is none shining. */
  lights?: Light[];
  /** A persistent room's tiles as it was left (tiles_get), put back after the room change. */
  tiles?: number[][];
}

/**
 * A drawing call made in a Draw event. The first two items are always the
 * kind and the depth it was drawn at (the depth of the instance whose Draw
 * event made it), so the renderer can put it in the right layer.
 */
export type DrawCommand =
  | ["text", number, number, number, string, number, number, number, number?, Halign?, Valign?] // depth, x, y, text, color, font (-1 built-in), size, alpha, halign, valign
  | ["rect", number, number, number, number, number, number, number, number?] // depth, x1, y1, x2, y2, color, outline, alpha
  // depth, sprite, frame, x, y, alpha — and from draw_sprite_ext: xscale, yscale, angle (degrees, anticlockwise), tint
  | ["sprite", number, number, number, number, number, number?, number?, number?, number?, number?]
  | ["line", number, number, number, number, number, number, number, number] // depth, x1, y1, x2, y2, color, width, alpha
  | ["circle", number, number, number, number, number, number, number] // depth, x, y, r, color, outline, alpha
  | ["ellipse", number, number, number, number, number, number, number, number] // depth, x1, y1, x2, y2, color, outline, alpha
  | ["tri", number, number, number, number, number, number, number, number, number, number] // depth, 3 points, color, outline, alpha
  | ["grad", number, number, number, number, number, number, number, number, number]; // depth, x1, y1, x2, y2, color1, color2, vertical, alpha

export type Halign = "left" | "center" | "right";
export type Valign = "top" | "middle" | "bottom";

/** A Python exception, already traced back to the student's code. */
export interface PythonGameError {
  /** Whose code: an object's, a script's (the Scripts folder), or neither. */
  kind: "object" | "script" | "instance" | null;
  object: string | null; // "Player" (or the script's name), null when in neither
  event: string | null; // "on_step"
  line: number | null; // line in that object's code
  message: string; // "NameError: name 'spead' is not defined"
  traceback: string; // only the student's own frames
  /** The game stopped responding and was interrupted (an endless loop, usually). */
  hang?: boolean;
}

/**
 * The view: what part of the room the game window shows. With no camera
 * set for the room it is the whole room and never moves. `x`/`y` are where
 * the camera is; `offX`/`offY` are this frame's shake, which moves only the
 * picture — view_x, the mouse and collisions never see it.
 */
export interface CameraState {
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  followType: number; // follow the first instance of this type, or -1
  followSlot: number; // or this instance (camera_follow), or -1
  followGen: number;
  smoothing: number;
  shake: number;
  shakeLeft: number;
  shakeTotal: number;
  offX: number;
  offY: number;
  /** Just entered the room: jump to the target rather than glide from 0, 0. */
  fresh: boolean;
  /**
   * camera_zoom(): 2 shows half as much, twice as big. `w`/`h` stay the
   * window's size; the part of the room seen is w / zoom by h / zoom
   * (viewW / viewH), and that is what view_width and collisions see.
   */
  zoom: number;
  zoomFrom: number;
  zoomTo: number;
  zoomSteps: number;
  zoomLeft: number;
}

const scratch: Box = { left: 0, top: 0, right: 0, bottom: 0 };
const scratch2: Box = { left: 0, top: 0, right: 0, bottom: 0 };
const tileBox: Box = { left: 0, top: 0, right: 0, bottom: 0 };
const scratch3: Box = { left: 0, top: 0, right: 0, bottom: 0 };

export class Engine {
  readonly sprites: SpriteInfo[];
  readonly spriteIndex = new Map<string, number>();
  readonly typeNames: string[];
  readonly typeIndex = new Map<string, number>();
  /** isA[t * n + u] = 1 when type t is u or inherits from it. */
  readonly isA: Uint8Array;
  /** collides[t * n + u] = 1 when type t has a collision event that fires for u. */
  collides: Uint8Array;
  /** Per type, HANDLES bits. Sent by Python in configure(). */
  flags: Int32Array;

  readonly hash = new SpatialHash(64);
  readonly input = new InputState();
  views!: SharedViews;

  /** Last frame's drawing, for the renderer. */
  drawList: DrawCommand[] = [];
  /** Particles, weather, lighting, screen effects, hit-pause (effects.ts). */
  readonly effects = new Effects();
  guiList: DrawCommand[] = [];
  tiles: LiveTiles[] = [];
  /** Cells tile_set() changed since the renderer last looked: [layer, cell]. */
  tileChanges: [number, number][] = [];
  debugText: string | null = null;
  camera: CameraState = {
    enabled: false, x: 0, y: 0, w: 0, h: 0, followType: -1, followSlot: -1, followGen: 0, smoothing: 1,
    shake: 0, shakeLeft: 0, shakeTotal: 0, offX: 0, offY: 0, fresh: true,
    zoom: 1, zoomFrom: 1, zoomTo: 1, zoomSteps: 0, zoomLeft: 0,
  };

  /** How much of the room the view shows, after zoom. */
  get viewW() {
    return this.camera.w / this.camera.zoom;
  }
  get viewH() {
    return this.camera.h / this.camera.zoom;
  }

  /** Is the game paused (game_pause) and this slot not one that ignores it? */
  private frozen(st: Float64Array, g: Float64Array, b: number): boolean {
    return g[G.PAUSED] === 1 && !st[b + F.UNPAUSED];
  }
  roomIndex = 0;
  /** Set when there were more events than the events array holds. */
  overflowed = false;

  constructor(
    readonly def: GameDefinition,
    /**
     * Re-acquires the views. They go stale ("detached", length 0) whenever
     * the WebAssembly memory grows — which any Python allocation can cause —
     * and when Python replaces the arrays with bigger ones. Every entry point
     * from Python checks, because a stale view reads as all zeros and every
     * collision query would quietly answer "nothing here".
     */
    private readonly acquire: () => SharedViews,
  ) {
    this.sprites = def.sprites.map((s) => spriteInfo(s, def.stepsPerSecond ?? 60));
    def.sprites.forEach((s, i) => this.spriteIndex.set(s.name, i));
    this.typeNames = def.objects.map((o) => o.name);
    this.typeNames.forEach((n, i) => this.typeIndex.set(n, i));
    const n = this.typeNames.length;
    this.isA = new Uint8Array(n * n);
    for (let t = 0; t < n; t++) {
      // Walk up the parent chain. The seen-set stops a parent loop (A's
      // parent is B, B's parent is A) from hanging the page; Python reports it.
      let cur: number | undefined = t;
      const seen = new Set<number>();
      while (cur !== undefined && !seen.has(cur)) {
        seen.add(cur);
        this.isA[t * n + cur] = 1;
        const p: string | undefined = def.objects[cur]!.parent;
        cur = p === undefined ? undefined : this.typeIndex.get(p);
      }
    }
    this.collides = new Uint8Array(n * n);
    this.flags = new Int32Array(n);
    this.views = acquire();
  }

  /** Called from Python whenever it has replaced the arrays. */
  rebind() {
    this.views = this.acquire();
  }

  /** The views, re-taken first if they have gone stale. Use this, not `views`, outside a step. */
  fresh(): SharedViews {
    if (this.views.st.length === 0) this.views = this.acquire();
    return this.views;
  }

  /** Python's one-time description of which events each type handles. */
  configure(collides: ArrayLike<number>, flags: ArrayLike<number>) {
    this.collides = Uint8Array.from(collides);
    this.flags = Int32Array.from(flags);
  }

  // ---------------------------------------------------------------- spatial hash

  /** Re-files every slot Python marked dirty since the last drain. */
  flushDirty() {
    const { st, dirty } = this.fresh();
    const n = dirty[0]!;
    for (let i = 1; i <= n; i++) {
      const s = dirty[i]!;
      st[s * STRIDE + F.DIRTY] = 0;
      this.refile(st, s);
    }
    dirty[0] = 0;
  }

  private refile(st: Float64Array, s: number) {
    const b = s * STRIDE;
    if (st[b + F.ALIVE] && boxOf(st, s, st[b + F.X]!, st[b + F.Y]!, this.sprites, scratch)) {
      this.hash.update(s, scratch.left, scratch.top, scratch.right, scratch.bottom);
    } else {
      this.hash.remove(s);
    }
  }

  /** Is slot `c` alive and of type `t` (or a child of it)? t < 0 means any type. */
  private matches(st: Float64Array, c: number, t: number): boolean {
    const b = c * STRIDE;
    if (!st[b + F.ALIVE]) return false;
    if (t < 0) return true;
    return this.isA[st[b + F.TYPE]! * this.typeNames.length + t] === 1;
  }

  /**
   * The first instance of type t (other than `self`) overlapping self's box
   * placed at (x, y), or -1. `solidOnly` restricts it to solid instances.
   */
  /**
   * The first tile layer (or just layer `only`) with a solid tile under
   * self's mask at (x, y), or -1. `scratch` must already be self's box there.
   */
  private tileHit(st: Float64Array, self: number, x: number, y: number, only: number): number {
    // Where self is now, for one-way tiles: one blocks only what is above it
    // now and would sink into it. Worked out once, the first time it's needed.
    let nowBottom = NaN;
    const sb = self * STRIDE;
    const dropping = st[sb + F.DROP]! > 0;
    for (let L = 0; L < this.tiles.length; L++) {
      if (only >= 0 && L !== only) continue;
      const { def, tileset, cells, solid, oneWay } = this.tiles[L]!;
      const tw = tileset.tileWidth, th = tileset.tileHeight;
      const c0 = Math.max(0, Math.floor(scratch.left / tw)), c1 = Math.min(def.columns - 1, Math.ceil(scratch.right / tw) - 1);
      const r0 = Math.max(0, Math.floor(scratch.top / th)), r1 = Math.min(def.rows - 1, Math.ceil(scratch.bottom / th) - 1);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const tile = cells[r * def.columns + c]!;
          if (tile < 0 || !(solid[tile] || oneWay[tile])) continue;
          if (oneWay[tile]) {
            // A platform: only from above, onto its top, and not while dropping through.
            if (dropping) continue;
            if (Number.isNaN(nowBottom)) nowBottom = boxOf(st, self, st[sb + F.X]!, st[sb + F.Y]!, this.sprites, scratch3) ? scratch3.bottom : Infinity;
            const top = r * th;
            if (nowBottom > top + 0.001 || scratch.bottom <= top) continue;
          }
          tileBox.left = c * tw;
          tileBox.top = r * th;
          tileBox.right = tileBox.left + tw;
          tileBox.bottom = tileBox.top + th;
          if (maskOverlapsBox(st, self, x, y, this.sprites, scratch, tileBox)) return L;
        }
      }
    }
    return -1;
  }

  /**
   * What self would touch at (x, y): t ≥ 0 an object type (and its
   * children); t = -1 anything (with solidOnly: solid instances and solid
   * tiles); t ≤ -2 the solid tiles of tile layer -2 - t. Answers as tileCode.
   */
  private firstHit(self: number, x: number, y: number, t: number, solidOnly: boolean): number {
    const { st } = this.fresh();
    this.flushDirty();
    if (!boxOf(st, self, x, y, this.sprites, scratch)) return -1;
    if (t <= -2) {
      const L = this.tileHit(st, self, x, y, -2 - t);
      return L >= 0 ? tileCode(L) : -1;
    }
    let found = -1;
    this.hash.query(scratch.left, scratch.top, scratch.right, scratch.bottom, (c) => {
      if (c === self || !this.matches(st, c, t)) return false;
      if (solidOnly && !st[c * STRIDE + F.SOLID]) return false;
      const cb = c * STRIDE;
      const cx = st[cb + F.X]!, cy = st[cb + F.Y]!;
      if (!boxOf(st, c, cx, cy, this.sprites, scratch2)) return false;
      if (!overlaps(scratch, scratch2)) return false;
      if (!masksOverlap(st, self, x, y, c, cx, cy, this.sprites, scratch, scratch2)) return false;
      found = c;
      return true;
    });
    if (found < 0 && t === -1 && solidOnly) {
      const L = this.tileHit(st, self, x, y, -1);
      if (L >= 0) return tileCode(L);
    }
    return found;
  }

  // ---------------------------------------------------------------- queries Python calls

  place_meeting(self: number, x: number, y: number, t: number): boolean {
    return this.firstHit(self, x, y, t, false) !== -1;
  }

  /** An instance (a tile is not an instance, so a tile layer answers -1). */
  instance_place(self: number, x: number, y: number, t: number): number {
    const hit = this.firstHit(self, x, y, t, false);
    return hit >= 0 ? hit : -1;
  }

  /** No solid instance and no solid tile overlaps self at (x, y). */
  place_free(self: number, x: number, y: number): boolean {
    return this.firstHit(self, x, y, -1, true) === -1;
  }

  /** The tile number at a room point on layer L (or the topmost layer with one there), or -1. */
  tile_at(x: number, y: number, layer: number): number {
    const order = layer >= 0 ? [layer] : this.tiles.map((_, i) => i).sort((a, b) => this.tiles[a]!.def.depth - this.tiles[b]!.def.depth);
    for (const L of order) {
      const t = this.tiles[L];
      if (!t) continue;
      const c = Math.floor(x / t.tileset.tileWidth), r = Math.floor(y / t.tileset.tileHeight);
      if (c < 0 || r < 0 || c >= t.def.columns || r >= t.def.rows) continue;
      const tile = t.cells[r * t.def.columns + c]!;
      if (tile >= 0) return tile;
    }
    return -1;
  }

  /** Changes one tile (-1 clears it). False when the point is outside the layer. */
  tile_set(x: number, y: number, tile: number, layer: number): boolean {
    const t = this.tiles[layer];
    if (!t) return false;
    const c = Math.floor(x / t.tileset.tileWidth), r = Math.floor(y / t.tileset.tileHeight);
    if (c < 0 || r < 0 || c >= t.def.columns || r >= t.def.rows) return false;
    const cell = r * t.def.columns + c;
    t.cells[cell] = tile >= 0 && tile < t.tileset.count ? tile : -1;
    this.tileChanges.push([layer, cell]);
    return true;
  }

  collision_point(x: number, y: number, t: number): number {
    const { st } = this.fresh();
    this.flushDirty();
    let found = -1;
    // A one-pixel query rectangle; the exact test is the point inside the box.
    this.hash.query(x, y, x + 1, y + 1, (c) => {
      if (!this.matches(st, c, t)) return false;
      const cb = c * STRIDE;
      if (!containsPoint(st, c, st[cb + F.X]!, st[cb + F.Y]!, this.sprites, x, y)) return false;
      found = c;
      return true;
    });
    return found;
  }

  /** Nearest instance of type t to (x, y), never `exclude` (the caller). */
  instance_nearest(x: number, y: number, t: number, exclude: number): number {
    const { st, g } = this.fresh();
    const n = g[G.SLOTS]!;
    let best = -1;
    let bestD = Infinity;
    for (let s = 0; s < n; s++) {
      if (s === exclude || !this.matches(st, s, t)) continue;
      const b = s * STRIDE;
      const dx = st[b + F.X]! - x;
      const dy = st[b + F.Y]! - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /**
   * Moves self by (dx, dy), one axis at a time, stopping flush against the
   * first instance of type t in the way (t < 0: any solid instance). Puts the
   * instances it was stopped by in `result` and returns how many.
   *
   * It moves whole pixels at a time once blocked, so a fast mover stops at
   * the wall's edge instead of short of it, and never tunnels through a thin
   * wall the way `x += hspeed` does.
   */
  move_and_collide(self: number, dx: number, dy: number, t: number): number {
    const { st, result } = this.fresh();
    const b = self * STRIDE;
    const solidOnly = t < 0;
    let hits = 0;
    const record = (c: number) => {
      for (let i = 1; i <= hits; i++) if (result[i] === c) return;
      if (hits + 1 < result.length) result[++hits] = c;
    };
    for (const axis of [F.X, F.Y] as const) {
      const d = axis === F.X ? dx : dy;
      if (d === 0) continue;
      const at = (pos: number) =>
        axis === F.X
          ? this.firstHit(self, pos, st[b + F.Y]!, t, solidOnly)
          : this.firstHit(self, st[b + F.X]!, pos, t, solidOnly);
      const start = st[b + axis]!;
      const whole = at(start + d);
      if (whole === -1) {
        st[b + axis] = start + d;
        continue;
      }
      const sign = Math.sign(d);
      let remaining = Math.abs(d);
      let pos = start;
      while (remaining > 0) {
        // Whole pixels — but from a fractional position (402.6, after a
        // jump), first the step to the next whole one. Stepping a full pixel
        // from 402.6 stopped at 415.6, short of a floor at 416, and the
        // player hovered 0.4 px over the ground it was meant to stand on.
        const toWhole = sign > 0 ? Math.ceil(pos) - pos : pos - Math.floor(pos);
        const stepSize = Math.min(toWhole > 1e-9 ? toWhole : 1, remaining);
        const c = at(pos + sign * stepSize);
        if (c !== -1) {
          record(c); // an instance, or a tile layer's code
          break;
        }
        pos += sign * stepSize;
        remaining -= stepSize;
      }
      st[b + axis] = pos;
    }
    this.refile(st, self);
    result[0] = hits;
    return hits;
  }

  /**
   * The first thing the segment from (x1, y1) to (x2, y2) touches, nearest
   * the start: t ≥ 0 an instance of that type (or its children); t = -1
   * anything solid (solid instances and solid tiles); t ≤ -2 the solid tiles
   * of that tile layer. Never `self`. Instances are tested by their boxes;
   * tiles cell by cell along the line. One-way tiles don't stop a line.
   */
  collision_line(x1: number, y1: number, x2: number, y2: number, t: number, self: number): number {
    const { st } = this.fresh();
    this.flushDirty();
    let best = Infinity;
    let found = -1;
    if (t >= -1) {
      this.hash.query(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2) + 1, Math.max(y1, y2) + 1, (c) => {
        if (c === self || !this.matches(st, c, t)) return false;
        if (t === -1 && !st[c * STRIDE + F.SOLID]) return false;
        if (!boxOf(st, c, st[c * STRIDE + F.X]!, st[c * STRIDE + F.Y]!, this.sprites, scratch2)) return false;
        const hit = segmentEntersBox(x1, y1, x2, y2, scratch2);
        if (hit !== null && hit < best) {
          best = hit;
          found = c;
        }
        return false;
      });
    }
    if (t === -1 || t <= -2) {
      const only = t <= -2 ? -2 - t : -1;
      const length = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(length / 2)); // every 2 px: thinner than any tile
      for (let L = 0; L < this.tiles.length; L++) {
        if (only >= 0 && L !== only) continue;
        const { def, tileset, cells, solid } = this.tiles[L]!;
        for (let i = 0; i <= steps; i++) {
          const k = i / steps;
          if (k >= best) break;
          const c = Math.floor((x1 + (x2 - x1) * k) / tileset.tileWidth), r = Math.floor((y1 + (y2 - y1) * k) / tileset.tileHeight);
          if (c < 0 || r < 0 || c >= def.columns || r >= def.rows) continue;
          const tile = cells[r * def.columns + c]!;
          if (tile >= 0 && solid[tile]) {
            best = k;
            found = tileCode(L);
            break;
          }
        }
      }
    }
    return found;
  }

  /**
   * A way from (x1, y1) to (x2, y2) round everything solid — solid tiles and
   * solid instances — on a grid of `cell` pixels, as JSON: [[x, y], …], the
   * middles of the cells from the start's to the goal's, or [] when there is
   * no way (or either end is inside a wall). A* with diagonal steps that
   * never cut a corner. For games seen from above; a platformer's enemy
   * can't fly along the answer.
   */
  path_find(x1: number, y1: number, x2: number, y2: number, cell: number, self: number): string {
    const { st, g } = this.fresh();
    this.flushDirty();
    const roomW = g[G.ROOM_WIDTH]!, roomH = g[G.ROOM_HEIGHT]!;
    const cols = Math.max(1, Math.ceil(roomW / cell)), rows = Math.max(1, Math.ceil(roomH / cell));
    if (cols * rows > 250_000) return "[]"; // a cell that small in a room that big: refuse rather than freeze
    const blocked = new Uint8Array(cols * rows);
    const mark = (left: number, top: number, right: number, bottom: number) => {
      const c0 = Math.max(0, Math.floor(left / cell)), c1 = Math.min(cols - 1, Math.ceil(right / cell) - 1);
      const r0 = Math.max(0, Math.floor(top / cell)), r1 = Math.min(rows - 1, Math.ceil(bottom / cell) - 1);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1;
    };
    for (const { def, tileset, cells, solid } of this.tiles) {
      for (let i = 0; i < cells.length; i++) {
        const tile = cells[i]!;
        if (tile < 0 || !solid[tile]) continue;
        const tc = i % def.columns, tr = Math.floor(i / def.columns);
        mark(tc * tileset.tileWidth + 0.01, tr * tileset.tileHeight + 0.01, (tc + 1) * tileset.tileWidth - 0.01, (tr + 1) * tileset.tileHeight - 0.01);
      }
    }
    const n = g[G.SLOTS]!;
    for (let s = 0; s < n; s++) {
      const b = s * STRIDE;
      if (s === self || !st[b + F.ALIVE] || !st[b + F.SOLID]) continue;
      if (boxOf(st, s, st[b + F.X]!, st[b + F.Y]!, this.sprites, scratch2)) mark(scratch2.left + 0.01, scratch2.top + 0.01, scratch2.right - 0.01, scratch2.bottom - 0.01);
    }
    const at = (x: number, y: number) => Math.min(rows - 1, Math.max(0, Math.floor(y / cell))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x / cell)));
    const start = at(x1, y1), goal = at(x2, y2);
    if (blocked[start] || blocked[goal]) return "[]";
    const cost = new Float64Array(cols * rows).fill(Infinity);
    const from = new Int32Array(cols * rows).fill(-1);
    const done = new Uint8Array(cols * rows);
    const gx = goal % cols, gy = Math.floor(goal / cols);
    const guess = (i: number) => {
      const dx = Math.abs((i % cols) - gx), dy = Math.abs(Math.floor(i / cols) - gy);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    // A binary heap of [priority, cell].
    const heap: [number, number][] = [];
    const push = (p: number, i: number) => {
      heap.push([p, i]);
      for (let k = heap.length - 1; k > 0; ) {
        const up = (k - 1) >> 1;
        if (heap[up]![0] <= heap[k]![0]) break;
        [heap[up], heap[k]] = [heap[k]!, heap[up]!];
        k = up;
      }
    };
    const pop = () => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ; ) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
          if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k]!, heap[m]!];
          k = m;
        }
      }
      return top[1];
    };
    cost[start] = 0;
    push(guess(start), start);
    while (heap.length) {
      const i = pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === goal) break;
      const cx = i % cols, cy = Math.floor(i / cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          if (blocked[j] || done[j]) continue;
          // A diagonal step needs both cells beside it open: no squeezing through a corner.
          if (dx && dy && (blocked[cy * cols + nx] || blocked[ny * cols + cx])) continue;
          const c = cost[i]! + (dx && dy ? Math.SQRT2 : 1);
          if (c < cost[j]!) {
            cost[j] = c;
            from[j] = i;
            push(c + guess(j), j);
          }
        }
      }
    }
    if (!done[goal]) return "[]";
    const out: [number, number][] = [];
    for (let i = goal; i !== -1; i = from[i]!) out.push([(i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell / 2]);
    return JSON.stringify(out.reverse());
  }

  // ---------------------------------------------------------------- the step

  private pushEvent(events: Int32Array, kind: number, a: number, b: number) {
    const n = events[0]!;
    const at = EVENTS_HEADER + n * 3;
    if (at + 3 > events.length) {
      events[1] = 1;
      this.overflowed = true;
      return;
    }
    events[at] = kind;
    events[at + 1] = a;
    events[at + 2] = b;
    events[0] = n + 1;
  }

  // ---------------------------------------------------------------- the camera

  /** A new room: its camera settings, and a view that starts where it should, not glides there. */
  setRoom(index: number) {
    this.roomIndex = index;
    this.effects.roomChanged();
    const room = this.def.rooms[index];
    if (!room) return;
    this.tiles = (room.tileLayers ?? []).flatMap((l) => {
      const tileset = this.def.tilesets?.find((t) => t.name === l.tileset);
      if (!tileset) return [];
      const solid = new Uint8Array(tileset.count);
      for (const n of tileset.solid) if (n >= 0 && n < tileset.count) solid[n] = 1;
      const oneWay = new Uint8Array(tileset.count);
      for (const n of tileset.oneWay ?? []) if (n >= 0 && n < tileset.count && !solid[n]) oneWay[n] = 1;
      return [{ def: l, tileset, cells: Int32Array.from(l.cells), solid, oneWay }];
    });
    this.tileChanges = [];
    const cam = room.camera;
    const c = this.camera;
    c.enabled = !!cam;
    c.w = cam?.width ?? room.width;
    c.h = cam?.height ?? room.height;
    c.followType = cam?.follow ? (this.typeIndex.get(cam.follow) ?? -1) : -1;
    c.followSlot = -1;
    c.smoothing = cam?.smoothing ?? 1;
    c.x = c.y = 0;
    c.shakeLeft = 0;
    c.offX = c.offY = 0;
    c.fresh = true;
    c.zoom = c.zoomFrom = c.zoomTo = 1;
    c.zoomLeft = 0;
    this.updateCamera();
  }

  camera_follow(slot: number, smoothing: number) {
    const { st } = this.fresh();
    this.camera.followSlot = slot;
    this.camera.followGen = slot >= 0 ? st[slot * STRIDE + F.GEN]! : 0;
    if (slot < 0) this.camera.followType = -1;
    if (smoothing >= 0) this.camera.smoothing = smoothing;
  }

  camera_set(x: number, y: number) {
    const c = this.camera;
    c.followSlot = c.followType = -1;
    c.x = x;
    c.y = y;
    this.clampCamera();
    this.publishView();
  }

  /** hit_pause(): the whole game stands still for `steps` steps (the bridge skips them), still drawn. */
  hit_pause(steps: number) {
    this.effects.pauseLeft = Math.max(this.effects.pauseLeft, Math.min(120, Math.round(steps)));
  }

  /** camera_zoom(): to `zoom` over `steps` steps (0: at once), about the middle of the view. */
  camera_zoom(zoom: number, steps: number) {
    const c = this.camera;
    c.zoomFrom = c.zoom;
    c.zoomTo = Math.max(0.1, Math.min(10, zoom));
    c.zoomSteps = c.zoomLeft = Math.max(1, Math.round(steps));
    if (steps <= 0) {
      c.zoomLeft = 1;
      c.zoomSteps = 1;
    }
  }

  camera_shake(strength: number, steps: number) {
    const c = this.camera;
    c.shake = Math.max(0, strength);
    c.shakeLeft = c.shakeTotal = Math.max(0, Math.round(steps));
  }

  private clampCamera() {
    const c = this.camera;
    const room = this.def.rooms[this.roomIndex];
    if (!room) return;
    // Keep the view inside the room; a room smaller than the view sits at its top-left.
    c.x = Math.max(0, Math.min(c.x, room.width - this.viewW));
    c.y = Math.max(0, Math.min(c.y, room.height - this.viewH));
  }

  private publishView() {
    const { g } = this.fresh();
    g[G.VIEW_X] = this.camera.x;
    g[G.VIEW_Y] = this.camera.y;
    g[G.VIEW_W] = this.viewW;
    g[G.VIEW_H] = this.viewH;
    g[G.ZOOM] = this.camera.zoom;
  }

  /** Moves the view for this step, after the game's own code has run. */
  updateCamera() {
    const { st, g } = this.fresh();
    const c = this.camera;
    if (c.zoomLeft > 0) {
      // Zooming about the middle of the view: what is in the middle stays there.
      c.zoomLeft--;
      const k = 1 - c.zoomLeft / c.zoomSteps;
      const ease = k * k * (3 - 2 * k);
      const midX = c.x + this.viewW / 2, midY = c.y + this.viewH / 2;
      c.zoom = c.zoomFrom + (c.zoomTo - c.zoomFrom) * ease;
      c.x = midX - this.viewW / 2;
      c.y = midY - this.viewH / 2;
      if (!c.enabled) this.clampCamera();
    }
    if (c.enabled) {
      let target = -1;
      if (c.followSlot >= 0) {
        const b = c.followSlot * STRIDE;
        // The followed instance was destroyed (or its slot handed to another): stop.
        if (st[b + F.ALIVE] && st[b + F.GEN] === c.followGen) target = c.followSlot;
        else c.followSlot = -1;
      } else if (c.followType >= 0) {
        const n = g[G.SLOTS]!;
        for (let s = 0; s < n && target < 0; s++) if (this.matches(st, s, c.followType)) target = s;
      }
      if (target >= 0) {
        const b = target * STRIDE;
        const tx = st[b + F.X]! - this.viewW / 2, ty = st[b + F.Y]! - this.viewH / 2;
        const k = c.fresh ? 1 : c.smoothing;
        c.x += (tx - c.x) * k;
        c.y += (ty - c.y) * k;
      }
      this.clampCamera();
    }
    c.fresh = false;
    if (c.shakeLeft > 0) {
      const amp = (c.shake * c.shakeLeft) / c.shakeTotal;
      c.offX = (Math.random() * 2 - 1) * amp;
      c.offY = (Math.random() * 2 - 1) * amp;
      c.shakeLeft--;
    } else {
      c.offX = c.offY = 0;
    }
    this.publishView();
  }

  /** Everything that happens before Python's frame. */
  beginStep() {
    const { st, events, keys, g } = this.fresh();
    events[0] = 0;
    events[1] = 0;
    this.input.commit(keys, g);
    // The input knows where the pointer is on the canvas; the game wants
    // where that is in the room.
    g[G.MOUSE_X] = g[G.MOUSE_X]! / this.camera.zoom + this.camera.x;
    g[G.MOUSE_Y] = g[G.MOUSE_Y]! / this.camera.zoom + this.camera.y;
    g[G.FRAME] = g[G.FRAME]! + 1;
    const n = g[G.SLOTS]!;
    for (let s = 0; s < n; s++) {
      const b = s * STRIDE;
      if (!st[b + F.ALIVE]) continue;
      st[b + F.XPREV] = st[b + F.X]!;
      st[b + F.YPREV] = st[b + F.Y]!;
      st[b + F.DRAWN] = 0;
      // Paused: its flash and alarms wait (game_pause), unless it ignores the pause.
      if (this.frozen(st, g, b)) continue;
      if (st[b + F.FLASH]! > 0) st[b + F.FLASH] = st[b + F.FLASH]! - 1;
      // GameMaker's alarms: a positive number counts down one per step and
      // fires on reaching zero, then rests at -1. Zero or below never fires,
      // so `self.alarm[0] = 0` does not trigger anything.
      for (let a = 0; a < 12; a++) {
        const i = b + F.ALARM0 + a;
        const v = st[i]!;
        if (v > 0) {
          if (v <= 1) {
            st[i] = -1;
            this.pushEvent(events, EV.ALARM, s, a);
          } else {
            st[i] = v - 1;
          }
        }
      }
    }
    if (this.input.mouseEdges.length) {
      this.flushDirty();
      const mx = g[G.MOUSE_X]!, my = g[G.MOUSE_Y]!;
      for (const edge of this.input.mouseEdges) {
        this.hash.query(mx, my, mx + 1, my + 1, (c) => {
          const cb = c * STRIDE;
          if (!st[cb + F.ALIVE] || !(this.flags[st[cb + F.TYPE]!]! & HANDLES.MOUSE) || this.frozen(st, g, cb)) return false;
          if (!containsPoint(st, c, st[cb + F.X]!, st[cb + F.Y]!, this.sprites, mx, my)) return false;
          this.pushEvent(events, EV.MOUSE, c, edge.button * 2 + (edge.released ? 1 : 0));
          return false;
        });
      }
    }
  }

  /**
   * Built-in motion, animation and collision detection, called back from
   * Python between Step and Collision. Returns the number of events written.
   */
  motion(): number {
    const { st, events, g } = this.fresh();
    this.flushDirty();
    events[0] = 0;
    events[1] = 0;
    const n = g[G.SLOTS]!;
    const nt = this.typeNames.length;
    const roomW = g[G.ROOM_WIDTH]!, roomH = g[G.ROOM_HEIGHT]!;
    const DEG = Math.PI / 180;

    for (let s = 0; s < n; s++) {
      const b = s * STRIDE;
      if (!st[b + F.ALIVE] || this.frozen(st, g, b)) continue; // paused: no moving, no animating
      let h = st[b + F.HSPEED]!;
      let v = st[b + F.VSPEED]!;
      const fr = st[b + F.FRICTION]!;
      const grav = st[b + F.GRAVITY]!;
      if (fr !== 0 || grav !== 0) {
        if (fr !== 0) {
          // Friction slows the speed toward zero along the direction of
          // travel, and never past zero into reverse.
          const sp = Math.hypot(h, v);
          if (sp > 0) {
            const k = Math.max(0, sp - fr) / sp;
            h *= k;
            v *= k;
          }
        }
        if (grav !== 0) {
          const gd = st[b + F.GRAVITY_DIR]! * DEG;
          h += Math.cos(gd) * grav;
          v -= Math.sin(gd) * grav; // y grows downward, so "up" is minus
        }
        st[b + F.HSPEED] = h;
        st[b + F.VSPEED] = v;
        st[b + F.SPEED] = Math.hypot(h, v);
        if (h !== 0 || v !== 0) st[b + F.DIRECTION] = ((Math.atan2(-v, h) / DEG) % 360 + 360) % 360;
      }
      if (h !== 0 || v !== 0) {
        st[b + F.X] = st[b + F.X]! + h;
        st[b + F.Y] = st[b + F.Y]! + v;
        this.refile(st, s);
      }

      if (st[b + F.DROP]! > 0) st[b + F.DROP] = st[b + F.DROP]! - 1;

      const spr = this.sprites[st[b + F.SPRITE]!];
      const speed = st[b + F.IMAGE_SPEED]!;
      if (spr && speed !== 0) {
        const count = spr.frameCount;
        let idx = st[b + F.IMAGE_INDEX]! + speed * spr.framesPerStep;
        if (idx >= count || idx < 0) {
          idx = ((idx % count) + count) % count;
          if (this.flags[st[b + F.TYPE]!]! & HANDLES.ANIMATION_END) this.pushEvent(events, EV.ANIMATION_END, s, 0);
        }
        st[b + F.IMAGE_INDEX] = idx;
      }
    }

    // Collisions, after everything has moved. A pair that overlaps fires
    // every step it overlaps, as in GameMaker, not only on first contact.
    for (let s = 0; s < n; s++) {
      const b = s * STRIDE;
      if (!st[b + F.ALIVE] || this.frozen(st, g, b)) continue; // paused: its collision events wait
      const t = st[b + F.TYPE]!;
      const fl = this.flags[t]!;
      if (fl & HANDLES.COLLISION) {
        if (boxOf(st, s, st[b + F.X]!, st[b + F.Y]!, this.sprites, scratch)) {
          this.hash.query(scratch.left, scratch.top, scratch.right, scratch.bottom, (c) => {
            if (c === s) return false;
            const cb = c * STRIDE;
            if (!st[cb + F.ALIVE] || !this.collides[t * nt + st[cb + F.TYPE]!]) return false;
            const cx = st[cb + F.X]!, cy = st[cb + F.Y]!;
            if (!boxOf(st, c, cx, cy, this.sprites, scratch2) || !overlaps(scratch, scratch2)) return false;
            if (masksOverlap(st, s, st[b + F.X]!, st[b + F.Y]!, c, cx, cy, this.sprites, scratch, scratch2))
              this.pushEvent(events, EV.COLLISION, s, c);
            return false;
          });
        }
      }
      if (fl & (HANDLES.OUTSIDE_ROOM | HANDLES.INTERSECT_BOUNDARY)) {
        const x = st[b + F.X]!, y = st[b + F.Y]!;
        // An instance with no sprite is treated as a point at (x, y).
        if (!boxOf(st, s, x, y, this.sprites, scratch)) {
          scratch.left = scratch.right = x;
          scratch.top = scratch.bottom = y;
        }
        const outside =
          scratch.right <= 0 || scratch.left >= roomW || scratch.bottom <= 0 || scratch.top >= roomH;
        const boundary =
          !outside && (scratch.left < 0 || scratch.right > roomW || scratch.top < 0 || scratch.bottom > roomH);
        // Both fire on the change, not every step: "outside room" means the
        // step it went out, so a bullet's destroy() is not called sixty times.
        if (fl & HANDLES.OUTSIDE_ROOM && outside && !st[b + F.OUTSIDE]) this.pushEvent(events, EV.OUTSIDE_ROOM, s, 0);
        if (fl & HANDLES.INTERSECT_BOUNDARY && boundary && !st[b + F.BOUNDARY])
          this.pushEvent(events, EV.INTERSECT_BOUNDARY, s, 0);
        st[b + F.OUTSIDE] = outside ? 1 : 0;
        st[b + F.BOUNDARY] = boundary ? 1 : 0;
      }
    }
    return events[0]!;
  }

  /** Everything after Python's frame. Returns the error, if the frame raised one. */
  endStep(commands: FrameCommands | null): PythonGameError | null {
    this.flushDirty();
    this.drawList = commands?.draw ?? [];
    this.guiList = commands?.gui ?? [];
    if (commands?.debug !== undefined) this.debugText = commands.debug;
    // The room change first: it clears the old room's particles and darkness,
    // and the new room's Create events — whose orders come in this same
    // step — may have just asked for some. The other way round, a torch lit
    // or a burst made in a room's first step was wiped out at once.
    if (commands?.room !== undefined) this.setRoom(commands.room);
    else this.updateCamera();
    // A remembered room (persistent) coming back: its tiles as they were left, after setRoom laid the room's own.
    if (commands?.tiles) this.restoreTiles(commands.tiles);
    this.effects.apply(commands?.fx);
    this.effects.lights = commands?.lights ?? [];
    const c = this.camera;
    // Paused, particles hang where they are (and weather stops falling).
    if (this.fresh().g[G.PAUSED] !== 1)
      this.effects.step({ x: c.x, y: c.y, w: this.viewW || this.def.rooms[this.roomIndex]!.width, h: this.viewH || this.def.rooms[this.roomIndex]!.height });
    return commands?.error ?? null;
  }

  /** Every tile layer's cells now, as JSON, for a persistent room being left (Python keeps it). */
  tiles_get(): string {
    return JSON.stringify(this.tiles.map((t) => Array.from(t.cells)));
  }

  /** Puts a remembered room's tiles back, layer by layer, and tells the renderer every cell changed. */
  restoreTiles(saved: number[][]) {
    saved.forEach((cells, L) => {
      const t = this.tiles[L];
      if (!t || cells.length !== t.cells.length) return;
      for (let i = 0; i < cells.length; i++) {
        if (t.cells[i] !== cells[i]) {
          t.cells[i] = cells[i]!;
          this.tileChanges.push([L, i]);
        }
      }
    });
  }

  /** Live instances, for the FPS readout and tests. */
  instanceCount(): number {
    const { st, g } = this.fresh();
    const n = g[G.SLOTS]!;
    let c = 0;
    for (let s = 0; s < n; s++) if (st[s * STRIDE + F.ALIVE]) c++;
    return c;
  }
}
