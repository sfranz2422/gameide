/**
 * Built-in sprites, drawn in code, so a student can make a game before
 * Phase 4 lets them import their own art. Each is painted once into PNGs
 * when it is added to a project; from then on it is an ordinary sprite.
 */

export interface StarterSprite {
  key: string;
  name: string; // the sprite's name when added
  width: number;
  height: number;
  originX: number;
  originY: number;
  frames: number;
  /** Frames per second, for the animated ones. */
  fps?: number;
  /** A round thing collides as a circle; everything else as its fitted box. */
  circle?: boolean;
  paint: (ctx: OffscreenCanvasRenderingContext2D, frame: number) => void;
}

const T = 32;

export const STARTER_SPRITES: StarterSprite[] = [
  {
    key: "player",
    name: "player",
    width: 24,
    height: 24,
    originX: 0,
    originY: 0,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(0, 0, 24, 24, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(6, 7, 4, 5);
      ctx.fillRect(14, 7, 4, 5);
    },
  },
  {
    key: "wall",
    name: "wall",
    width: T,
    height: T,
    originX: 0,
    originY: 0,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#475569";
      ctx.fillRect(0, 0, T, T);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(1, 1, T - 2, T - 2);
      ctx.fillStyle = "#475569";
      ctx.fillRect(0, T / 2, T, 1);
      ctx.fillRect(T / 2, 0, 1, T / 2);
    },
  },
  {
    key: "coin",
    name: "coin",
    width: 16,
    height: 16,
    originX: 8,
    originY: 8,
    frames: 4,
    fps: 9,
    circle: true,
    paint(ctx, frame) {
      const w = [8, 5, 2, 5][frame]!;
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.ellipse(8, 8, w, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a16207";
      ctx.fillRect(8 - Math.max(1, w / 3), 4, Math.max(1, (2 * w) / 3), 8);
    },
  },
  {
    key: "enemy",
    name: "enemy",
    width: 24,
    height: 24,
    originX: 12,
    originY: 12,
    frames: 2,
    fps: 4,
    paint(ctx, frame) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(12, 13, 11, Math.PI, 0);
      ctx.lineTo(23, 24);
      for (let i = 0; i < 4; i++) ctx.lineTo(23 - i * 6 - 3, frame ? 20 : 22), ctx.lineTo(23 - (i + 1) * 6, 24);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(6, 9, 5, 5);
      ctx.fillRect(14, 9, 5, 5);
      ctx.fillStyle = "#111";
      ctx.fillRect(frame ? 9 : 7, 11, 2, 2);
      ctx.fillRect(frame ? 17 : 15, 11, 2, 2);
    },
  },
  {
    key: "ground",
    name: "ground",
    width: T,
    height: T,
    originX: 0,
    originY: 0,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#92400e";
      ctx.fillRect(0, 0, T, T);
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(0, 0, T, 8);
      ctx.fillStyle = "#78350f";
      for (const [x, y] of [[6, 16], [20, 22], [12, 27]]) ctx.fillRect(x!, y!, 3, 3);
    },
  },
  {
    key: "ball",
    name: "ball",
    width: 12,
    height: 12,
    originX: 6,
    originY: 6,
    frames: 1,
    circle: true,
    paint(ctx) {
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(6, 6, 6, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    key: "block",
    name: "block",
    width: 64,
    height: 64,
    originX: 0,
    originY: 0,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, 64, 64);
    },
  },
  {
    key: "bullet",
    name: "bullet",
    width: 8,
    height: 4,
    originX: 4,
    originY: 2,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#fde047";
      ctx.fillRect(0, 0, 8, 4);
    },
  },
  {
    key: "ship",
    name: "ship",
    width: 24,
    height: 24,
    originX: 12,
    originY: 12,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(24, 12);
      ctx.lineTo(2, 2);
      ctx.lineTo(7, 12);
      ctx.lineTo(2, 22);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    key: "heart",
    name: "heart",
    width: 16,
    height: 16,
    originX: 8,
    originY: 8,
    frames: 1,
    paint(ctx) {
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.moveTo(8, 15);
      ctx.bezierCurveTo(-4, 6, 3, -2, 8, 4);
      ctx.bezierCurveTo(13, -2, 20, 6, 8, 15);
      ctx.fill();
    },
  },
];

/** Paints every frame of a starter sprite into PNG blobs. Browser only. */
export async function paintStarter(s: StarterSprite): Promise<Blob[]> {
  const out: Blob[] = [];
  for (let i = 0; i < s.frames; i++) {
    const canvas = new OffscreenCanvas(s.width, s.height);
    s.paint(canvas.getContext("2d")!, i);
    out.push(await canvas.convertToBlob({ type: "image/png" }));
  }
  return out;
}

/**
 * A starter tileset, drawn in code like the starter sprites: 32 px tiles,
 * four across and six down.
 *   0 grass top   1 dirt     2 brick    3 stone
 *   4 platform ◀  5 platform  6 platform ▶  7 bush (not solid: scenery)
 *   8–23  grass as an autotile set: tile 8 + mask, where the mask adds up
 *         the sides joined to more grass (up 1, right 2, down 4, left 8)
 */
export const STARTER_TILESET = {
  name: "terrain",
  tileWidth: 32,
  tileHeight: 32,
  columns: 4,
  rows: 6,
  solid: [0, 1, 2, 3, 4, 5, 6, ...Array.from({ length: 16 }, (_, m) => 8 + m)],
  autotiles: [{ name: "grass", tiles: Array.from({ length: 16 }, (_, m) => 8 + m) }],
  paint(ctx: OffscreenCanvasRenderingContext2D) {
    const T = 32;
    const at = (n: number) => [(n % 4) * T, Math.floor(n / 4) * T] as const;
    // 0 grass on dirt
    let [x, y] = at(0);
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(x, y, T, 10);
    ctx.fillStyle = "#66bb6a";
    for (let i = 0; i < T; i += 6) ctx.fillRect(x + i, y + 8, 3, 4);
    // 1 dirt
    [x, y] = at(1);
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#6d4421";
    for (const [dx, dy] of [[5, 6], [20, 12], [12, 22], [26, 26]]) ctx.fillRect(x + dx!, y + dy!, 3, 3);
    // 2 brick
    [x, y] = at(2);
    ctx.fillStyle = "#b5523b";
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#7f3626";
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(x, y + r * 8 + 7, T, 1);
      const off = r % 2 ? 8 : 0;
      for (let c = off; c < T; c += 16) ctx.fillRect(x + c, y + r * 8, 1, 8);
    }
    // 3 stone
    [x, y] = at(3);
    ctx.fillStyle = "#78828f";
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = "#5c6470";
    ctx.fillRect(x, y + T - 4, T, 4);
    ctx.fillRect(x + T - 4, y, 4, T);
    ctx.fillStyle = "#98a2ad";
    ctx.fillRect(x, y, T, 3);
    // 4–6 a wooden platform: left end, middle, right end
    for (const n of [4, 5, 6]) {
      [x, y] = at(n);
      ctx.fillStyle = "#c58b4a";
      ctx.fillRect(x + (n === 4 ? 4 : 0), y, T - (n === 4 || n === 6 ? 4 : 0), 12);
      ctx.fillStyle = "#9a6631";
      ctx.fillRect(x + (n === 4 ? 4 : 0), y + 10, T - (n === 4 || n === 6 ? 4 : 0), 2);
    }
    // 7 a bush
    [x, y] = at(7);
    ctx.fillStyle = "#2e7d32";
    ctx.beginPath();
    ctx.arc(x + 10, y + 22, 9, 0, Math.PI * 2);
    ctx.arc(x + 22, y + 22, 9, 0, Math.PI * 2);
    ctx.arc(x + 16, y + 15, 9, 0, Math.PI * 2);
    ctx.fill();
    // 8–23 the grass autotile set: dirt, with grass where nothing is above,
    // and a dark rim on every side that isn't joined to more ground.
    for (let mask = 0; mask < 16; mask++) {
      [x, y] = at(8 + mask);
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#6d4421";
      for (const [dx, dy] of [[6, 14], [20, 20], [12, 26]]) ctx.fillRect(x + dx!, y + dy!, 3, 3);
      ctx.fillStyle = "#5a3818";
      if (!(mask & 2)) ctx.fillRect(x + T - 3, y, 3, T);
      if (!(mask & 8)) ctx.fillRect(x, y, 3, T);
      if (!(mask & 4)) ctx.fillRect(x, y + T - 3, T, 3);
      if (!(mask & 1)) {
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(x, y, T, 9);
        ctx.fillStyle = "#66bb6a";
        for (let i = 2; i < T - 2; i += 6) ctx.fillRect(x + i, y + 7, 3, 4);
      }
    }
  },
};

export async function paintStarterTileset(): Promise<Blob> {
  const t = STARTER_TILESET;
  const canvas = new OffscreenCanvas(t.columns * t.tileWidth, t.rows * t.tileHeight);
  t.paint(canvas.getContext("2d")!);
  return canvas.convertToBlob({ type: "image/png" });
}
