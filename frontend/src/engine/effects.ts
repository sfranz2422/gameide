/**
 * Game feel: particles, weather, lighting, screen effects and hit-pause —
 * the things that make a game feel alive rather than merely work (Phase 9½).
 *
 * Python asks for them (runtime.py: particles(), effect(), weather(),
 * lighting(), light(), screen_effect(), hit_pause()) and the engine keeps
 * them, because they are per-particle and per-frame work: thousands of
 * particles moving every step would cost far more in Python than the game's
 * own logic, and crossing the bridge per particle more still. Python sends
 * orders with each step's commands (`fx`, `lights`); this moves the
 * particles, and the renderer draws what is here.
 *
 * Particles live in flat typed arrays, a fixed number at most: a game that
 * asks for more than MAX_PARTICLES quietly drops the oldest's room — never
 * slows to a crawl, which a classroom laptop would.
 */

export const MAX_PARTICLES = 4000;

/** A particle burst, as Python's particles() describes it. Every field has a default. */
export interface Burst {
  x: number;
  y: number;
  count?: number;
  color?: number | number[];
  speed?: number;
  /** speed varies up to ± this fraction (0.5 = half to one and a half times). */
  speedVar?: number;
  size?: number;
  life?: number;
  gravity?: number;
  /** Degrees each side of `direction` the particles fly in; 360 is every way. */
  spread?: number;
  direction?: number;
  shape?: "square" | "circle";
  depth?: number;
  /** Slows each step by this fraction (0.05 = 5%). */
  drag?: number;
  /** Grows (>1) or shrinks (<1) by this much over its life. */
  grow?: number;
  /** Spins, in degrees a step. */
  spin?: number;
  /** Drawn this many times taller than wide (rain). */
  stretch?: number;
}

/** The ready-made effects effect() offers: each a burst, or a few. */
export const EFFECTS: Record<string, (x: number, y: number, color: number | null, scale: number) => Burst[]> = {
  explosion: (x, y, c, k) => [
    { x, y, count: Math.round(28 * k), color: c ?? [0xffd166, 0xff8c42, 0xff4d4d, 0xfff3c4], speed: 3.2 * k, speedVar: 0.7, size: 4 * k, life: 32, drag: 0.06, grow: 0.2, shape: "circle" },
    { x, y, count: Math.round(10 * k), color: [0x6b6b6b, 0x8a8a8a], speed: 0.9 * k, speedVar: 0.6, size: 6 * k, life: 55, gravity: -0.03, drag: 0.03, grow: 1.8, shape: "circle", depth: -999 },
  ],
  sparkle: (x, y, c, k) => [{ x, y, count: Math.round(14 * k), color: c ?? [0xffffff, 0xfff3c4, 0xffd166], speed: 1.6 * k, speedVar: 0.8, size: 2.5 * k, life: 28, drag: 0.05, gravity: -0.02, grow: 0.1, spin: 8 }],
  dust: (x, y, c, k) => [{ x, y, count: Math.round(9 * k), color: c ?? [0xc8b89a, 0xa89a80], speed: 1.1 * k, speedVar: 0.6, size: 3 * k, life: 22, direction: 90, spread: 80, gravity: 0.04, drag: 0.08, grow: 0.3, shape: "circle" }],
  smoke: (x, y, c, k) => [{ x, y, count: Math.round(10 * k), color: c ?? [0x6b6b6b, 0x8a8a8a, 0x9f9f9f], speed: 0.6 * k, speedVar: 0.6, size: 5 * k, life: 60, direction: 90, spread: 50, gravity: -0.02, drag: 0.02, grow: 2.2, shape: "circle" }],
  confetti: (x, y, c, k) => [{ x, y, count: Math.round(45 * k), color: c ?? [0xff4d6d, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xb388eb], speed: 4.5 * k, speedVar: 0.5, size: 3.5 * k, life: 80, direction: 90, spread: 60, gravity: 0.14, drag: 0.02, spin: 12, stretch: 1.6 }],
  hit: (x, y, c, k) => [{ x, y, count: Math.round(9 * k), color: c ?? 0xffffff, speed: 3.5 * k, speedVar: 0.5, size: 2 * k, life: 10, drag: 0.12, grow: 0.2, stretch: 2.5 }],
};

export const WEATHER = ["rain", "snow"] as const;

/** What the view is, for weather to fall across it. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One order from Python's step (runtime.py, _fx). */
export type FxOrder =
  | ["burst", Burst]
  | ["effect", string, number, number, number | null, number]
  | ["weather", string | null, number]
  | ["clear"]
  | ["lighting", number, number]
  | ["screen", string | null];

/** One light for this step: x, y, radius, colour, strength (light()). */
export type Light = [number, number, number, number, number];

export const SCREEN_EFFECTS = ["crt", "vignette", "grayscale", "pixelate", "sepia"] as const;

export class Effects {
  // ---------------------------------------------------------------- particles
  readonly x = new Float32Array(MAX_PARTICLES);
  readonly y = new Float32Array(MAX_PARTICLES);
  readonly vx = new Float32Array(MAX_PARTICLES);
  readonly vy = new Float32Array(MAX_PARTICLES);
  readonly life = new Float32Array(MAX_PARTICLES);
  readonly maxLife = new Float32Array(MAX_PARTICLES);
  readonly size = new Float32Array(MAX_PARTICLES);
  readonly grow = new Float32Array(MAX_PARTICLES);
  readonly gravity = new Float32Array(MAX_PARTICLES);
  readonly drag = new Float32Array(MAX_PARTICLES);
  readonly angle = new Float32Array(MAX_PARTICLES);
  readonly spin = new Float32Array(MAX_PARTICLES);
  readonly stretch = new Float32Array(MAX_PARTICLES);
  readonly color = new Uint32Array(MAX_PARTICLES);
  readonly circle = new Uint8Array(MAX_PARTICLES);
  readonly depth = new Int32Array(MAX_PARTICLES);
  /** Particles alive: they are always the first `count`. */
  count = 0;

  /** "rain", "snow" or null, and how much (1 = some, 3 = a storm). */
  weather: string | null = null;
  weatherAmount = 1;
  /** 0 is daylight; 1 is pitch dark except where light() shines. */
  darkness = 0;
  darkColor = 0x000000;
  lights: Light[] = [];
  /** A whole-screen look (SCREEN_EFFECTS), or null. */
  screen: string | null = null;
  /** Steps the game stays frozen for (hit_pause). */
  pauseLeft = 0;

  constructor(private readonly random: () => number = Math.random) {}

  /** Makes a burst. Past MAX_PARTICLES, the oldest particles make room. */
  burst(b: Burst) {
    const count = Math.max(0, Math.min(500, Math.round(b.count ?? 12)));
    const colors = Array.isArray(b.color) ? b.color : [b.color ?? 0xffffff];
    const speed = b.speed ?? 3, sv = b.speedVar ?? 0.5;
    const spread = b.spread ?? 360, dir = b.direction ?? 90;
    const size = b.size ?? 3, life = Math.max(1, b.life ?? 30);
    for (let i = 0; i < count; i++) {
      if (this.count >= MAX_PARTICLES) this.remove(0);
      const p = this.count++;
      // GameMaker's directions: 0 is right, 90 is up — and the room's y grows downwards.
      const a = ((dir + (this.random() - 0.5) * spread) * Math.PI) / 180;
      const s = speed * (1 + (this.random() * 2 - 1) * sv);
      this.x[p] = b.x;
      this.y[p] = b.y;
      this.vx[p] = Math.cos(a) * s;
      this.vy[p] = -Math.sin(a) * s;
      this.maxLife[p] = this.life[p] = Math.round(life * (0.75 + this.random() * 0.5));
      this.size[p] = Math.max(0.5, size * (0.7 + this.random() * 0.6));
      this.grow[p] = b.grow ?? 0.3;
      this.gravity[p] = b.gravity ?? 0;
      this.drag[p] = b.drag ?? 0.02;
      this.angle[p] = this.random() * 360;
      this.spin[p] = (b.spin ?? 0) * (this.random() < 0.5 ? -1 : 1);
      this.stretch[p] = b.stretch ?? 1;
      this.color[p] = colors[Math.floor(this.random() * colors.length)]! & 0xffffff;
      this.circle[p] = b.shape === "circle" ? 1 : 0;
      this.depth[p] = Math.round(b.depth ?? -1000);
    }
  }

  /** A ready-made effect (EFFECTS); false for a name it doesn't know. */
  effect(kind: string, x: number, y: number, color: number | null = null, scale = 1): boolean {
    const make = EFFECTS[kind];
    if (!make) return false;
    for (const b of make(x, y, color, Math.max(0.1, scale))) this.burst(b);
    return true;
  }

  /** Swaps the last particle into `p`'s place: the live ones stay packed at the front. */
  private remove(p: number) {
    const last = --this.count;
    if (p === last) return;
    for (const arr of [this.x, this.y, this.vx, this.vy, this.life, this.maxLife, this.size, this.grow, this.gravity, this.drag, this.angle, this.spin, this.stretch])
      arr[p] = arr[last]!;
    this.color[p] = this.color[last]!;
    this.circle[p] = this.circle[last]!;
    this.depth[p] = this.depth[last]!;
  }

  clear() {
    this.count = 0;
  }

  /** One step: particles move and fade, and the weather falls. */
  step(view: ViewBox) {
    for (let p = 0; p < this.count; p++) {
      if (--this.life[p]! <= 0) {
        this.remove(p);
        p--;
        continue;
      }
      const k = 1 - this.drag[p]!;
      this.vx[p] = this.vx[p]! * k;
      this.vy[p] = this.vy[p]! * k + this.gravity[p]!;
      this.x[p] = this.x[p]! + this.vx[p]!;
      this.y[p] = this.y[p]! + this.vy[p]!;
      this.angle[p] = this.angle[p]! + this.spin[p]!;
    }
    if (this.weather === "rain") {
      const n = Math.round(4 * this.weatherAmount);
      for (let i = 0; i < n; i++)
        this.burst({
          x: view.x + this.random() * (view.w + 80) - 40, y: view.y - 10, count: 1, color: [0x9fc6ff, 0xc8dcff], speed: 9, speedVar: 0.15,
          direction: 262, spread: 4, size: 1.3, life: Math.ceil((view.h + 20) / 8.5), drag: 0, grow: 0, stretch: 6, depth: -1500,
        });
    } else if (this.weather === "snow") {
      const n = this.random() < 0.6 * this.weatherAmount ? Math.max(1, Math.round(this.weatherAmount)) : 0;
      for (let i = 0; i < n; i++)
        this.burst({
          x: view.x + this.random() * (view.w + 40) - 20, y: view.y - 6, count: 1, color: 0xffffff, speed: 0.9, speedVar: 0.4,
          direction: 270, spread: 40, size: 2.2, life: Math.ceil((view.h + 20) / 0.8), drag: 0, grow: 0, shape: "circle", depth: -1500,
        });
    }
  }

  /** Python's orders for this step. Unknown names were refused in Python, with a message. */
  apply(orders: FxOrder[] | undefined) {
    for (const o of orders ?? []) {
      switch (o[0]) {
        case "burst":
          this.burst(o[1]);
          break;
        case "effect":
          this.effect(o[1], o[2], o[3], o[4], o[5]);
          break;
        case "weather":
          this.weather = o[1];
          this.weatherAmount = Math.max(0, o[2]);
          break;
        case "clear":
          this.clear();
          break;
        case "lighting":
          this.darkness = Math.max(0, Math.min(1, o[1]));
          this.darkColor = o[2] & 0xffffff;
          break;
        case "screen":
          this.screen = o[1];
          break;
      }
    }
  }

  /** A new room: its own particles, sky and darkness. (A screen effect is the whole game's look, so it stays.) */
  roomChanged() {
    this.clear();
    this.weather = null;
    this.darkness = 0;
    this.lights = [];
  }
}
