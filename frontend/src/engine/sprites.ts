import { F, STRIDE } from "./layout";
import type { SpriteDef } from "./game";

/**
 * A sprite as the engine needs it for collisions: the mask measured from the
 * origin, so an instance's box is just `x + left * xscale` and so on.
 */
export interface SpriteInfo {
  name: string;
  frameCount: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function spriteInfo(def: SpriteDef): SpriteInfo {
  const m = def.mask ?? { left: 0, top: 0, right: def.width, bottom: def.height };
  return {
    name: def.name,
    frameCount: Math.max(1, def.frameCount),
    left: m.left - def.originX,
    top: m.top - def.originY,
    right: m.right - def.originX,
    bottom: m.bottom - def.originY,
  };
}

/** Out-parameter for `boxOf`, reused so the hot paths allocate nothing. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The collision box of the instance in `slot`, as if it stood at (x, y).
 * Returns false for an instance with no sprite: like GameMaker, an instance
 * without a sprite (and so without a mask) never collides with anything.
 *
 * image_angle is not applied — boxes stay axis-aligned. Rotated masks are a
 * known gap (PROGRESS.md); a spinning sprite collides as its unrotated box.
 */
export function boxOf(st: Float64Array, slot: number, x: number, y: number, sprites: SpriteInfo[], out: Box): boolean {
  const b = slot * STRIDE;
  const s = sprites[st[b + F.SPRITE]!];
  if (!s) return false;
  const sx = st[b + F.XSCALE]!;
  const sy = st[b + F.YSCALE]!;
  const l = x + s.left * sx;
  const r = x + s.right * sx;
  const t = y + s.top * sy;
  const bo = y + s.bottom * sy;
  // A negative scale mirrors the sprite, which swaps its edges.
  out.left = l < r ? l : r;
  out.right = l < r ? r : l;
  out.top = t < bo ? t : bo;
  out.bottom = t < bo ? bo : t;
  return true;
}

/** Strict overlap: boxes that only share an edge do not touch. */
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
