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
import type { GameDefinition } from "./game";
import { InputState } from "./input";
import { SpatialHash } from "./spatialHash";
import { boxOf, overlaps, spriteInfo, type Box, type SpriteInfo } from "./sprites";

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
  debug?: string | null;
  room?: number;
  error?: PythonGameError;
  warnings?: string[];
}

/**
 * A drawing call made in a Draw event. The first two items are always the
 * kind and the depth it was drawn at (the depth of the instance whose Draw
 * event made it), so the renderer can put it in the right layer.
 */
export type DrawCommand =
  | ["text", number, number, number, string, number] // depth, x, y, text, color
  | ["rect", number, number, number, number, number, number, number] // depth, x1, y1, x2, y2, color, outline
  | ["sprite", number, number, number, number, number]; // depth, sprite, frame, x, y

/** A Python exception, already traced back to the student's code. */
export interface PythonGameError {
  /** Whose code: an object's, a script's (the Scripts folder), or neither. */
  kind: "object" | "script" | null;
  object: string | null; // "Player" (or the script's name), null when in neither
  event: string | null; // "on_step"
  line: number | null; // line in that object's code
  message: string; // "NameError: name 'spead' is not defined"
  traceback: string; // only the student's own frames
}

const scratch: Box = { left: 0, top: 0, right: 0, bottom: 0 };
const scratch2: Box = { left: 0, top: 0, right: 0, bottom: 0 };

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
  debugText: string | null = null;
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
    this.sprites = def.sprites.map(spriteInfo);
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
  private firstHit(self: number, x: number, y: number, t: number, solidOnly: boolean): number {
    const { st } = this.fresh();
    this.flushDirty();
    if (!boxOf(st, self, x, y, this.sprites, scratch)) return -1;
    let found = -1;
    this.hash.query(scratch.left, scratch.top, scratch.right, scratch.bottom, (c) => {
      if (c === self || !this.matches(st, c, t)) return false;
      if (solidOnly && !st[c * STRIDE + F.SOLID]) return false;
      const cb = c * STRIDE;
      if (!boxOf(st, c, st[cb + F.X]!, st[cb + F.Y]!, this.sprites, scratch2)) return false;
      if (!overlaps(scratch, scratch2)) return false;
      found = c;
      return true;
    });
    return found;
  }

  // ---------------------------------------------------------------- queries Python calls

  place_meeting(self: number, x: number, y: number, t: number): boolean {
    return this.firstHit(self, x, y, t, false) >= 0;
  }

  instance_place(self: number, x: number, y: number, t: number): number {
    return this.firstHit(self, x, y, t, false);
  }

  /** No solid instance of any type overlaps self at (x, y). */
  place_free(self: number, x: number, y: number): boolean {
    return this.firstHit(self, x, y, -1, true) < 0;
  }

  collision_point(x: number, y: number, t: number): number {
    const { st } = this.fresh();
    this.flushDirty();
    let found = -1;
    // A one-pixel query rectangle; the exact test is the point inside the box.
    this.hash.query(x, y, x + 1, y + 1, (c) => {
      if (!this.matches(st, c, t)) return false;
      const cb = c * STRIDE;
      if (!boxOf(st, c, st[cb + F.X]!, st[cb + F.Y]!, this.sprites, scratch2)) return false;
      if (x < scratch2.left || x >= scratch2.right || y < scratch2.top || y >= scratch2.bottom) return false;
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
      if (whole < 0) {
        st[b + axis] = start + d;
        continue;
      }
      const sign = Math.sign(d);
      let remaining = Math.abs(d);
      let pos = start;
      while (remaining > 0) {
        const stepSize = Math.min(1, remaining);
        const c = at(pos + sign * stepSize);
        if (c >= 0) {
          record(c);
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

  /** Everything that happens before Python's frame. */
  beginStep() {
    const { st, events, keys, g } = this.fresh();
    events[0] = 0;
    events[1] = 0;
    this.input.commit(keys, g);
    g[G.FRAME] = g[G.FRAME]! + 1;
    const n = g[G.SLOTS]!;
    for (let s = 0; s < n; s++) {
      const b = s * STRIDE;
      if (!st[b + F.ALIVE]) continue;
      st[b + F.XPREV] = st[b + F.X]!;
      st[b + F.YPREV] = st[b + F.Y]!;
      st[b + F.DRAWN] = 0;
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
          if (!st[cb + F.ALIVE] || !(this.flags[st[cb + F.TYPE]!]! & HANDLES.MOUSE)) return false;
          if (!boxOf(st, c, st[cb + F.X]!, st[cb + F.Y]!, this.sprites, scratch2)) return false;
          if (mx < scratch2.left || mx >= scratch2.right || my < scratch2.top || my >= scratch2.bottom) return false;
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
      if (!st[b + F.ALIVE]) continue;
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

      const spr = this.sprites[st[b + F.SPRITE]!];
      const speed = st[b + F.IMAGE_SPEED]!;
      if (spr && speed !== 0) {
        const count = spr.frameCount;
        let idx = st[b + F.IMAGE_INDEX]! + speed;
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
      if (!st[b + F.ALIVE]) continue;
      const t = st[b + F.TYPE]!;
      const fl = this.flags[t]!;
      if (fl & HANDLES.COLLISION) {
        if (boxOf(st, s, st[b + F.X]!, st[b + F.Y]!, this.sprites, scratch)) {
          this.hash.query(scratch.left, scratch.top, scratch.right, scratch.bottom, (c) => {
            if (c === s) return false;
            const cb = c * STRIDE;
            if (!st[cb + F.ALIVE] || !this.collides[t * nt + st[cb + F.TYPE]!]) return false;
            if (!boxOf(st, c, st[cb + F.X]!, st[cb + F.Y]!, this.sprites, scratch2)) return false;
            if (overlaps(scratch, scratch2)) this.pushEvent(events, EV.COLLISION, s, c);
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
    if (!commands) {
      this.drawList = [];
      return null;
    }
    this.drawList = commands.draw ?? [];
    if (commands.debug !== undefined) this.debugText = commands.debug;
    if (commands.room !== undefined) this.roomIndex = commands.room;
    return commands.error ?? null;
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
