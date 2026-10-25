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
