/**
 * Physics: `self.physics = True` hands an instance to planck.js (Box2D's
 * port), which makes it fall, bounce, stack, roll and swing on joints.
 *
 * The idea is that a student never meets the physics engine itself. There is
 * no fixture to make, no body to define, no world to step: the instance's
 * own sprite mask is its shape, its own x, y, image_angle, hspeed and vspeed
 * are where it is and how it moves, and its code can keep setting them.
 * (microStudio and GameMaker expose the bodies and fixtures, which is where
 * students got lost.) So every step, in motion():
 *
 *   1. sync()   Each instance with physics gets a body, or loses it when it
 *               dies or turns physics off. If its code moved it, turned it
 *               or changed its speed since the engine last wrote those, the
 *               body is put there / given that speed: "since the engine last
 *               wrote them" is how a push from Python and a fall from planck
 *               tell themselves apart. Solid instances WITHOUT physics are
 *               kinematic bodies — immovable things that still carry what
 *               rests on them, so a moving platform carries a crate.
 *   2. step()   The world moves one step (not while the game is paused).
 *   3. back     Every moving body's place, angle and speeds are written into
 *               the instance, and the engine remembers what it wrote.
 *
 * Solid tiles are one static body of rectangles merged as large as they go
 * (a floor of separate 16 px boxes snags a sliding crate on every seam);
 * one-way tiles are fixtures that let a body through unless it was above
 * them and isn't rising — the same rule tileHit() uses for move_and_collide.
 *
 * Units: planck wants metres and seconds and works best with things 0.1–10 m
 * across, so PPM pixels are a metre. A speed in pixels per step is
 * × stepsPerSecond / PPM in m/s. y grows downward in both, so a positive
 * planck angle turns clockwise on screen, and image_angle (anticlockwise, as
 * in GameMaker) is minus it.
 *
 * The world belongs to the room: a room change throws it away (joints and
 * all), and the next step rebuilds the bodies from the instances, whose
 * speeds were kept in hspeed, vspeed and spin.
 */
import { AABB, Box as BoxShape, Circle, DistanceJoint, RevoluteJoint, RopeJoint, Settings, Vec2, WeldJoint, World, type Body, type Contact, type Fixture, type Joint } from "planck";
import { F, G, STRIDE } from "./layout";
import { tileNumber } from "./game";
import { SHAPE, type SpriteInfo } from "./sprites";
import type { LiveTiles } from "./engine";

export const PPM = 32;
const DEG = Math.PI / 180;
/** Default surface friction of tiles and of solid (kinematic) instances, mixed with the body's own by planck. */
const WALL_FRICTION = 0.5;
/** A kinematic body further than this from its instance jumps there instead of sweeping everything aside on the way. */
const TELEPORT_PX = 64;
/** One-way tiles: how far into one (px) a body's bottom may already be and still land on it. */
const ONE_WAY_SLACK = 2;

interface Entry {
  body: Body;
  fixture: Fixture | null;
  /** The slot's GEN when the body was made: a new instance in the same slot needs a new body. */
  gen: number;
  kind: "dynamic" | "static" | "kinematic";
  /** Sprite and scale the fixture was made for. */
  shape: string;
  /** Mass the density was worked out for, and the fixture's area in m². */
  weight: number;
  area: number;
  // What the engine last wrote (or read), to notice when the game's code changes them.
  x: number;
  y: number;
  angle: number;
  h: number;
  v: number;
  spin: number;
}

interface OneWay {
  oneWay: true;
  /** The tile's top, in pixels. */
  top: number;
}

/** What the engine needs to hand over: the shared state and the live room. */
export interface PhysicsHost {
  st: Float64Array;
  g: Float64Array;
  sprites: SpriteInfo[];
  tiles: LiveTiles[];
  /** Bumped whenever any tile changes, so the walls are rebuilt. */
  tilesVersion: number;
  stepsPerSecond: number;
}

export class Physics {
  world: World | null = null;
  /** physics_gravity(), in pixels per step² — kept across rooms, unlike the world. */
  gravityX = 0;
  gravityY = 0.3;
  private entries: (Entry | undefined)[] = [];
  private walls: Body | null = null;
  /** A body with nothing on it, at the room's origin: what a joint to "the world" is tied to. */
  private ground: Body | null = null;
  private wallsFor = -1;
  private joints = new Map<number, Joint>();
  /** Joint numbers go on rising across rooms, so an old number never ends a new joint. */
  private nextJoint = 1;
  private host: PhysicsHost | null = null;

  /** A room change: the world, its bodies and joints go. */
  reset() {
    this.world = null;
    this.entries = [];
    this.walls = this.ground = null;
    this.wallsFor = -1;
    this.joints.clear();
  }

  setGravity(x: number, y: number) {
    this.gravityX = x;
    this.gravityY = y;
    this.world?.setGravity(this.gravityInMetres());
  }

  private gravityInMetres() {
    const sps = this.host?.stepsPerSecond ?? 60;
    return new Vec2((this.gravityX * sps * sps) / PPM, (this.gravityY * sps * sps) / PPM);
  }

  /** Is there any instance with physics on? Until there is, nothing here costs anything. */
  private anyPhysics(st: Float64Array, n: number): boolean {
    for (let s = 0; s < n; s++) if (st[s * STRIDE + F.ALIVE] && st[s * STRIDE + F.PHYSICS]) return true;
    return false;
  }

  private makeWorld(host: PhysicsHost) {
    this.host = host;
    const world = new World({ gravity: this.gravityInMetres() });
    world.on("pre-solve", (contact) => this.oneWay(contact));
    this.world = world;
    this.ground = world.createBody();
  }

  /**
   * One step of it all (see the file comment). Returns false when there is
   * no world, so motion() can skip the contact events.
   */
  step(host: PhysicsHost, paused: boolean): boolean {
    this.host = host;
    const { st, g } = host;
    const n = g[G.SLOTS]!;
    if (!this.world) {
      if (!this.anyPhysics(st, n)) return false;
      this.makeWorld(host);
    }
    if (this.wallsFor !== host.tilesVersion) this.buildWalls(host);
    for (let s = 0; s < Math.max(n, this.entries.length); s++) this.syncSlot(s);
    if (paused) return true;
    this.world!.step(1 / host.stepsPerSecond);
    this.writeBack();
    return true;
  }

  /** Brings slot s's body in line with the instance: made, unmade, moved, reshaped. */
  private syncSlot(s: number) {
    const { st, sprites, stepsPerSecond: sps } = this.host!;
    const b = s * STRIDE;
    const alive = s * STRIDE < st.length && st[b + F.ALIVE] === 1;
    const sprite = alive ? sprites[st[b + F.SPRITE]!] : undefined;
    const want: Entry["kind"] | null = !alive || !sprite
      ? null
      : st[b + F.PHYSICS] ? (st[b + F.FIXED] ? "static" : "dynamic") : st[b + F.SOLID] ? "kinematic" : null;
    let e = this.entries[s];
    if (e && (!want || e.gen !== st[b + F.GEN])) {
      this.unmake(s);
      e = undefined;
    }
    if (!want) return;
    const x = st[b + F.X]!, y = st[b + F.Y]!, angle = st[b + F.ANGLE]!;
    if (!e) {
      const body = this.world!.createBody({ type: want, position: new Vec2(x / PPM, y / PPM), angle: -angle * DEG });
      body.setUserData(s);
      e = { body, fixture: null, gen: st[b + F.GEN]!, kind: want, shape: "", weight: NaN, area: 0, x, y, angle, h: NaN, v: NaN, spin: NaN };
      this.entries[s] = e;
    }
    const body = e.body;
    if (e.kind !== want) {
      body.setType(want);
      e.kind = want;
    }
    const shape = `${st[b + F.SPRITE]}|${st[b + F.XSCALE]}|${st[b + F.YSCALE]}`;
    if (shape !== e.shape) {
      if (e.fixture) body.destroyFixture(e.fixture);
      [e.fixture, e.area] = this.makeFixture(body, sprite!, st[b + F.XSCALE]!, st[b + F.YSCALE]!);
      e.shape = shape;
      e.weight = NaN;
    }
    const f = e.fixture!;
    if (want === "kinematic") {
      // Driven toward where the instance is, by velocity, so it carries and
      // shoves what touches it — or straight there, after a jump across the room.
      f.setFriction(WALL_FRICTION);
      const p = body.getPosition();
      const dx = x - p.x * PPM, dy = y - p.y * PPM;
      if (Math.hypot(dx, dy) > TELEPORT_PX) {
        body.setTransform(new Vec2(x / PPM, y / PPM), -angle * DEG);
        body.setLinearVelocity(new Vec2(0, 0));
        body.setAngularVelocity(0);
      } else {
        body.setLinearVelocity(new Vec2((dx * sps) / PPM, (dy * sps) / PPM));
        body.setAngularVelocity((-angle * DEG - body.getAngle()) * sps);
      }
      return;
    }
    f.setFriction(Math.max(0, st[b + F.FRICTION]!));
    f.setRestitution(Math.max(0, st[b + F.BOUNCE]!));
    const weight = st[b + F.WEIGHT]! > 0 ? st[b + F.WEIGHT]! : 1;
    if (weight !== e.weight) {
      // weight is the body's mass, whatever its size: density is what planck takes.
      f.setDensity(weight / Math.max(e.area, 1e-6));
      body.resetMassData();
      e.weight = weight;
    }
    if (x !== e.x || y !== e.y || angle !== e.angle) {
      body.setTransform(new Vec2(x / PPM, y / PPM), -angle * DEG);
      body.setAwake(true);
    }
    const h = st[b + F.HSPEED]!, v = st[b + F.VSPEED]!, spin = st[b + F.SPIN]!;
    if (want === "dynamic") {
      // A body at rest goes to sleep, and a sleeping body isn't asked about
      // its contacts — so drop_through on a crate resting on a platform did nothing.
      if (st[b + F.DROP]! > 0) body.setAwake(true);
      if (h !== e.h || v !== e.v) {
        body.setLinearVelocity(new Vec2((h * sps) / PPM, (v * sps) / PPM));
        body.setAwake(true);
      }
      if (spin !== e.spin) {
        body.setAngularVelocity((-spin * DEG * sps));
        body.setAwake(true);
      }
    }
    e.x = x;
    e.y = y;
    e.angle = angle;
    e.h = h;
    e.v = v;
    e.spin = spin;
  }

  private unmake(s: number) {
    const e = this.entries[s];
    if (!e) return;
    // planck ends a body's joints with it; forget their numbers too.
    for (const [id, j] of this.joints) if (j.getBodyA() === e.body || j.getBodyB() === e.body) this.joints.delete(id);
    this.world!.destroyBody(e.body);
    this.entries[s] = undefined;
  }

  /**
   * The sprite's mask as a planck shape — a circle mask a circle, anything
   * else (precise masks too) its box — and its area in m².
   */
  private makeFixture(body: Body, s: SpriteInfo, sx: number, sy: number): [Fixture, number] {
    if (s.kind === SHAPE.CIRCLE) {
      const r = Math.max((s.r * (Math.abs(sx) + Math.abs(sy))) / 2, 0.5) / PPM;
      return [body.createFixture(new Circle(new Vec2((s.cx * sx) / PPM, (s.cy * sy) / PPM), r), { density: 1 }), Math.PI * r * r];
    }
    const l = s.left * sx, r = s.right * sx, t = s.top * sy, bo = s.bottom * sy;
    const hw = Math.max(Math.abs(r - l) / 2, 0.5) / PPM, hh = Math.max(Math.abs(bo - t) / 2, 0.5) / PPM;
    return [body.createFixture(box(hw, hh, (l + r) / 2 / PPM, (t + bo) / 2 / PPM), { density: 1 }), 4 * hw * hh];
  }

  /** Every moving body's place and speeds, back into its instance. */
  private writeBack() {
    const { st, stepsPerSecond: sps } = this.host!;
    for (let s = 0; s < this.entries.length; s++) {
      const e = this.entries[s];
      if (!e || e.kind !== "dynamic") continue;
      const b = s * STRIDE;
      const p = e.body.getPosition(), vel = e.body.getLinearVelocity();
      const x = p.x * PPM, y = p.y * PPM;
      const angle = -e.body.getAngle() / DEG;
      const h = (vel.x * PPM) / sps, v = (vel.y * PPM) / sps;
      const spin = -e.body.getAngularVelocity() / DEG / sps;
      st[b + F.X] = e.x = x;
      st[b + F.Y] = e.y = y;
      st[b + F.ANGLE] = e.angle = angle;
      st[b + F.HSPEED] = e.h = h;
      st[b + F.VSPEED] = e.v = v;
      st[b + F.SPIN] = e.spin = spin;
      st[b + F.SPEED] = Math.hypot(h, v);
      if (h !== 0 || v !== 0) st[b + F.DIRECTION] = ((Math.atan2(-v, h) / DEG) % 360 + 360) % 360;
    }
  }

  /** Slots of the moving bodies, for the engine to refile in the spatial hash. */
  *moved(): Generator<number> {
    for (let s = 0; s < this.entries.length; s++) if (this.entries[s]?.kind === "dynamic") yield s;
  }

  /** Touching pairs of instances, each once: [a, b, a, b, …]. Tiles and the ground aren't instances. */
  touching(out: number[]) {
    out.length = 0;
    for (let c: Contact | null = this.world?.getContactList() ?? null; c; c = c.getNext()) {
      if (!c.isTouching() || !c.isEnabled()) continue;
      const a = c.getFixtureA().getBody().getUserData(), b = c.getFixtureB().getBody().getUserData();
      if (typeof a === "number" && typeof b === "number") out.push(a, b);
    }
  }

  // ------------------------------------------------------------ tiles

  /** Solid tiles as rectangles merged as big as they go; one-way tiles as runs along each row. */
  private buildWalls(host: PhysicsHost) {
    if (this.walls) this.world!.destroyBody(this.walls);
    const walls = this.world!.createBody();
    for (const layer of host.tiles) {
      const { def, tileset, cells, solid, oneWay } = layer;
      const tw = tileset.tileWidth, th = tileset.tileHeight;
      const cols = def.columns, rows = def.rows;
      const tileAt = (c: number, r: number) => tileNumber(cells[r * cols + c]!);
      const isSolid = (c: number, r: number) => {
        const t = tileAt(c, r);
        return t >= 0 && solid[t] === 1;
      };
      const used = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (used[r * cols + c] || !isSolid(c, r)) continue;
          let w = 1;
          while (c + w < cols && !used[r * cols + c + w] && isSolid(c + w, r)) w++;
          let h = 1;
          grow: while (r + h < rows) {
            for (let i = 0; i < w; i++) if (used[(r + h) * cols + c + i] || !isSolid(c + i, r + h)) break grow;
            h++;
          }
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[(r + j) * cols + c + i] = 1;
          walls.createFixture(rect(c * tw, r * th, w * tw, h * th), { friction: WALL_FRICTION });
        }
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const t = tileAt(c, r);
          if (t < 0 || !oneWay[t]) continue;
          let w = 1;
          while (c + w < cols && tileAt(c + w, r) >= 0 && oneWay[tileAt(c + w, r)]) w++;
          const f = walls.createFixture(rect(c * tw, r * th, w * tw, th), { friction: WALL_FRICTION });
          f.setUserData({ oneWay: true, top: r * th } satisfies OneWay);
          c += w - 1;
        }
      }
    }
    this.walls = walls;
    this.wallsFor = host.tilesVersion;
  }

  /**
   * planck asks before every contact is solved. A one-way tile holds a body
   * only when the body's bottom was at (or barely into) its top as the step
   * began, and it isn't dropping through (drop_through). One rising past the
   * top is above it already, so the contact can only lift it the last bit.
   */
  private oneWay(contact: Contact) {
    const fa = contact.getFixtureA(), fb = contact.getFixtureB();
    const ua = fa.getUserData() as OneWay | null, ub = fb.getUserData() as OneWay | null;
    const tile = ua?.oneWay ? ua : ub?.oneWay ? ub : null;
    if (!tile) return;
    const other = tile === ua ? fb : fa;
    const body = other.getBody();
    const s = body.getUserData();
    const st = this.host!.st;
    const dropping = typeof s === "number" && st[s * STRIDE + F.DROP]! > 0;
    // Not other.getAABB(): that's padded, and swept over the last step, so
    // a crate falling onto a platform looked already below it and fell through.
    other.getShape().computeAABB(shapeBox, body.getTransform(), 0);
    const bottom = shapeBox.upperBound.y * PPM;
    if (dropping || bottom > tile.top + ONE_WAY_SLACK) contact.setEnabled(false);
  }

  // ------------------------------------------------------------ joints

  /**
   * Joins two instances' bodies (b = -1: to the room itself, at (x, y)).
   * hinge and weld pin them at (x, y), by default a's origin; rope and
   * spring tie a's origin to (x, y) on b, by default b's origin, at the
   * distance they are apart now. Returns the joint's number, or 0 when a
   * body isn't there (no physics, or no sprite).
   */
  join(host: PhysicsHost, a: number, b: number, kind: string, x: number, y: number, hasPoint: boolean): number {
    this.host = host;
    if (!this.world) this.makeWorld(host);
    if (this.wallsFor !== host.tilesVersion) this.buildWalls(host);
    this.syncSlot(a);
    if (b >= 0) this.syncSlot(b);
    const ea = this.entries[a], eb = b >= 0 ? this.entries[b] : undefined;
    if (!ea || ea.kind === "kinematic" || (b >= 0 && (!eb || eb.kind === "kinematic"))) return 0;
    const A = ea.body, B = eb ? eb.body : this.ground!;
    const st = host.st;
    const ax = st[a * STRIDE + F.X]!, ay = st[a * STRIDE + F.Y]!;
    let joint: Joint;
    if (kind === "hinge" || kind === "weld") {
      const at = hasPoint ? new Vec2(x / PPM, y / PPM) : new Vec2(ax / PPM, ay / PPM);
      joint = kind === "hinge" ? new RevoluteJoint({}, A, B, at) : new WeldJoint({}, A, B, at);
    } else {
      const to = hasPoint ? new Vec2(x / PPM, y / PPM) : b >= 0 ? new Vec2(st[b * STRIDE + F.X]! / PPM, st[b * STRIDE + F.Y]! / PPM) : new Vec2(ax / PPM, ay / PPM);
      const length = Math.max(Vec2.distance(A.getPosition(), to), 0.05);
      const anchors = { bodyA: A, bodyB: B, localAnchorA: new Vec2(0, 0), localAnchorB: B.getLocalPoint(to), collideConnected: true };
      joint = kind === "rope"
        ? new RopeJoint({ ...anchors, maxLength: length })
        : new DistanceJoint({ ...anchors, length, frequencyHz: 2, dampingRatio: 0.3 });
    }
    this.world!.createJoint(joint);
    A.setAwake(true);
    const id = this.nextJoint++;
    this.joints.set(id, joint);
    return id;
  }

  /** Ends a joint. An unknown number, or one already ended, is no matter. */
  unjoin(id: number) {
    const j = this.joints.get(id);
    if (!j || !this.world) return;
    this.world.destroyJoint(j);
    this.joints.delete(id);
  }

  get jointCount() {
    return this.joints.size;
  }
}

/**
 * A box of half-size (hw, hh) about (cx, cy), in metres. planck puts a skin
 * of polygonRadius round every polygon and rests things skin to skin, so a
 * box made the sprite's own size floats a third of a pixel over the floor —
 * half a pixel per crate in a stack, plainly visible zoomed in. Made smaller
 * by the skin (less the slop planck lets touching shapes sink into each
 * other), a resting box's edge is the sprite's.
 */
function box(hw: number, hh: number, cx: number, cy: number) {
  const skin = Settings.polygonRadius - Settings.linearSlop;
  return new BoxShape(Math.max(hw - skin, skin), Math.max(hh - skin, skin), new Vec2(cx, cy), 0);
}

/** A rectangle in pixels as a planck box. */
function rect(x: number, y: number, w: number, h: number) {
  return box(w / 2 / PPM, h / 2 / PPM, (x + w / 2) / PPM, (y + h / 2) / PPM);
}

const shapeBox = new AABB();
