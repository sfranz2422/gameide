import { describe, expect, it } from "vitest";
import { F, STRIDE } from "./layout";
import { boxOf, overlaps, spriteInfo, type Box } from "./sprites";

const sprites = [spriteInfo({ name: "s", width: 20, height: 10, originX: 10, originY: 10, frameCount: 1,
  mask: { left: 2, top: 0, right: 18, bottom: 10 } })];

function inst(sprite: number, xs = 1, ys = 1) {
  const st = new Float64Array(STRIDE);
  st[F.SPRITE] = sprite;
  st[F.XSCALE] = xs;
  st[F.YSCALE] = ys;
  return st;
}

describe("collision boxes", () => {
  const box: Box = { left: 0, top: 0, right: 0, bottom: 0 };

  it("are the mask, measured from the origin, at the position asked", () => {
    expect(boxOf(inst(0), 0, 100, 50, sprites, box)).toBe(true);
    expect(box).toEqual({ left: 92, top: 40, right: 108, bottom: 50 });
  });

  it("scale, and mirror when the scale is negative", () => {
    boxOf(inst(0, -2, 1), 0, 100, 50, sprites, box);
    // Mask x from -8..8 around the origin; mirrored and doubled: -16..16.
    expect(box).toEqual({ left: 84, top: 40, right: 116, bottom: 50 });
  });

  it("do not exist for an instance without a sprite", () => {
    expect(boxOf(inst(-1), 0, 0, 0, sprites, box)).toBe(false);
  });

  it("touch only when they overlap, not when they share an edge", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(overlaps(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(overlaps(a, { left: 9.5, top: 0, right: 20, bottom: 10 })).toBe(true);
  });
});
