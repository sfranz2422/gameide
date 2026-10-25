import { describe, expect, it } from "vitest";
import type { SpriteDef } from "./game";
import { F, STRIDE } from "./layout";
import { boxOf, containsPoint, masksOverlap, overlaps, spriteInfo, type Box } from "./sprites";

const base: SpriteDef = { name: "s", width: 20, height: 10, originX: 10, originY: 10, frameCount: 1 };

/** A state array with instances: [spriteIndex, x, y, xscale, yscale, angle, imageIndex]. */
function world(...insts: [number, number, number, number?, number?, number?, number?][]) {
  const st = new Float64Array(STRIDE * insts.length);
  insts.forEach(([spr, x, y, sx = 1, sy = 1, angle = 0, frame = 0], i) => {
    const b = i * STRIDE;
    st[b + F.ALIVE] = 1;
    st[b + F.SPRITE] = spr;
    st[b + F.X] = x;
    st[b + F.Y] = y;
    st[b + F.XSCALE] = sx;
    st[b + F.YSCALE] = sy;
    st[b + F.ANGLE] = angle;
    st[b + F.IMAGE_INDEX] = frame;
  });
  return st;
}

const box = (): Box => ({ left: 0, top: 0, right: 0, bottom: 0 });

/** The two instances' masks overlap, going through the bounding boxes first as the engine does. */
function hit(st: Float64Array, sprites: ReturnType<typeof spriteInfo>[], a = 0, b = 1) {
  const A = box(), B = box();
  const xa = st[a * STRIDE + F.X]!, ya = st[a * STRIDE + F.Y]!, xb = st[b * STRIDE + F.X]!, yb = st[b * STRIDE + F.Y]!;
  if (!boxOf(st, a, xa, ya, sprites, A) || !boxOf(st, b, xb, yb, sprites, B) || !overlaps(A, B)) return false;
  return masksOverlap(st, a, xa, ya, b, xb, yb, sprites, A, B);
}

describe("collision boxes", () => {
  const sprites = [spriteInfo({ ...base, mask: { left: 2, top: 0, right: 18, bottom: 10 } })];

  it("are the mask, measured from the origin, at the position asked", () => {
    const b = box();
    expect(boxOf(world([0, 0, 0]), 0, 100, 50, sprites, b)).toBe(true);
    expect(b).toEqual({ left: 92, top: 40, right: 108, bottom: 50 });
  });

  it("scale, and mirror when the scale is negative", () => {
    const b = box();
    boxOf(world([0, 0, 0, -2, 1]), 0, 100, 50, sprites, b);
    // Mask x from -8..8 around the origin; mirrored and doubled: -16..16.
    expect(b).toEqual({ left: 84, top: 40, right: 116, bottom: 50 });
  });

  it("do not exist for an instance without a sprite", () => {
    expect(boxOf(world([-1, 0, 0]), 0, 0, 0, sprites, box())).toBe(false);
  });

  it("touch only when they overlap, not when they share an edge", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(overlaps(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(overlaps(a, { left: 9.5, top: 0, right: 20, bottom: 10 })).toBe(true);
  });

  it("turn with the instance: a 32×8 bar turned 90° stands 8 wide and 32 tall", () => {
    const bar = [spriteInfo({ name: "bar", width: 32, height: 8, originX: 0, originY: 4, frameCount: 1 })];
    const b = box();
    boxOf(world([0, 0, 0, 1, 1, 90]), 0, 100, 100, bar, b);
    expect(b.right - b.left).toBeCloseTo(8);
    expect(b.bottom - b.top).toBeCloseTo(32);
    expect(b.top).toBeCloseTo(68); // 90° counter-clockwise points it up
  });
});

describe("masks", () => {
  // The renderer draws a sprite with Pixi rotation -image_angle; this is
  // that transform, written out. Every point inside the mask, carried to
  // the world the way the renderer would, must be inside the instance.
  it("a rotated mask is where the sprite is drawn", () => {
    const def: SpriteDef = { name: "p", width: 30, height: 12, originX: 7, originY: 3, frameCount: 1 };
    const sprites = [spriteInfo(def)];
    for (const [angle, sx, sy] of [[30, 1, 1], [135, 2, 0.5], [-70, -1, 1.5], [200, 1, -1]] as const) {
      const st = world([0, 0, 0, sx, sy, angle]);
      const r = (-angle * Math.PI) / 180;
      for (const [px, py] of [[1, 1], [28, 2], [15, 10], [3, 11]]) {
        const lx = (px! - def.originX) * sx, ly = (py! - def.originY) * sy;
        const wx = 50 + lx * Math.cos(r) - ly * Math.sin(r);
        const wy = 60 + lx * Math.sin(r) + ly * Math.cos(r);
        expect(containsPoint(st, 0, 50, 60, sprites, wx, wy), `angle ${angle}, pixel ${px},${py}`).toBe(true);
      }
      // And a point well outside the picture is not.
      expect(containsPoint(st, 0, 50, 60, sprites, 50 + 80, 60)).toBe(false);
    }
  });

  it("rotated boxes collide by their shapes, not their bounding boxes", () => {
    const bar = [spriteInfo({ name: "bar", width: 40, height: 4, originX: 20, originY: 2, frameCount: 1 })];
    // An X: two bars crossing at their middles.
    expect(hit(world([0, 0, 0, 1, 1, 45], [0, 0, 0, 1, 1, -45]), bar)).toBe(true);
    // Two parallel diagonal bars 10 px apart: their bounding boxes overlap
    // almost entirely, the bars themselves don't touch.
    expect(hit(world([0, 0, 0, 1, 1, 45], [0, 10, 0, 1, 1, 45]), bar)).toBe(false);
  });

  it("turned boxes that only touch along an edge don't collide", () => {
    const sq = [spriteInfo({ name: "sq", width: 10, height: 10, originX: 5, originY: 5, frameCount: 1 })];
    // Squares turned 45°, side by side along a diagonal: their bounding boxes
    // overlap a lot, so only the shape test can tell touching from overlapping.
    const d = 10 / Math.SQRT2;
    expect(hit(world([0, 0, 0, 1, 1, 45], [0, d, d, 1, 1, 45]), sq)).toBe(false);
    expect(hit(world([0, 0, 0, 1, 1, 45], [0, d - 0.3, d - 0.3, 1, 1, 45]), sq)).toBe(true);
    // At exactly 90°, where cos is 6e-17 rather than 0, touching is still apart.
    expect(hit(world([0, 0, 0, 1, 1, 90], [0, 10, 0, 1, 1, 90]), sq)).toBe(false);
  });

  it("a circle misses a box's corner its bounding box would have hit", () => {
    const sprites = [
      spriteInfo({ name: "ball", width: 20, height: 20, originX: 10, originY: 10, frameCount: 1, mask: { kind: "circle", cx: 10, cy: 10, r: 10 } }),
      spriteInfo({ name: "wall", width: 20, height: 20, originX: 0, originY: 0, frameCount: 1 }),
    ];
    // The ball's centre 8 px diagonally off the wall's corner: boxes overlap, shapes don't.
    expect(hit(world([0, -8, -8], [1, 0, 0]), sprites)).toBe(false);
    expect(hit(world([0, -8, 5], [1, 0, 0]), sprites)).toBe(true);
  });

  it("a circle stretched by uneven scale is an ellipse", () => {
    const sprites = [spriteInfo({ name: "o", width: 16, height: 16, originX: 8, originY: 8, frameCount: 1, mask: { kind: "circle", cx: 8, cy: 8, r: 8 } })];
    const st = world([0, 0, 0, 2, 1]);
    expect(containsPoint(st, 0, 0, 0, sprites, 14, 0)).toBe(true);
    expect(containsPoint(st, 0, 0, 0, sprites, 0, 14)).toBe(false);
  });

  it("a precise mask uses the opaque pixels of the frame being shown", () => {
    // 4×4, frame 0 an L (left column and bottom row), frame 1 all solid.
    const L = new Uint8Array(16);
    for (let i = 0; i < 4; i++) L[i * 4] = L[12 + i] = 1;
    const full = new Uint8Array(16).fill(1);
    const sprites = [
      spriteInfo({ name: "L", width: 4, height: 4, originX: 0, originY: 0, frameCount: 2, mask: { kind: "precise", left: 0, top: 0, right: 4, bottom: 4 }, pixelMasks: [L, full] }),
    ];
    expect(containsPoint(world([0, 0, 0]), 0, 0, 0, sprites, 0.5, 0.5)).toBe(true);
    expect(containsPoint(world([0, 0, 0]), 0, 0, 0, sprites, 2.5, 1.5)).toBe(false); // the hollow of the L
    expect(containsPoint(world([0, 0, 0, 1, 1, 0, 1]), 0, 0, 0, sprites, 2.5, 1.5)).toBe(true); // frame 1
  });

  it("a sliver of overlap thinner than a pixel still counts", () => {
    const sprites = [spriteInfo({ name: "o", width: 10, height: 10, originX: 0, originY: 0, frameCount: 1, mask: { kind: "circle", cx: 5, cy: 5, r: 5 } })];
    expect(hit(world([0, 0, 0], [0, 9.7, 0]), sprites)).toBe(true);
  });

  it("a mask with no kind, saved before masks had kinds, is a box", () => {
    const s = spriteInfo({ ...base, mask: { left: 1, top: 2, right: 3, bottom: 4 } });
    expect([s.kind, s.left, s.top, s.right, s.bottom]).toEqual([0, -9, -8, -7, -6]);
  });
});

describe("animation speed", () => {
  it("is the sprite's fps over the steps per second, and one frame per step without one", () => {
    expect(spriteInfo({ ...base, fps: 15 }, 60).framesPerStep).toBe(0.25);
    expect(spriteInfo(base, 60).framesPerStep).toBe(1);
  });
});
