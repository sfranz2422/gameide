/**
 * Sprites as the engine needs them for collisions and animation, and the
 * collision tests themselves.
 *
 * A collision mask is one of three shapes, all in the sprite's own pixels:
 *
 *   rect      a box (the default: the opaque part of the picture)
 *   circle    a circle — an ellipse once the instance is scaled unevenly
 *   precise   the picture's own opaque pixels, frame by frame
 *
 * Every shape turns with image_angle and scales with image_xscale/yscale,
 * exactly as the sprite is drawn. The transform is the renderer's: Pixi
 * draws a sprite rotated by -image_angle (GameMaker's angles turn
 * counter-clockwise, Pixi's clockwise), so a world point is taken back into
 * the sprite's pixels by rotating it +image_angle and dividing by the scale
 * (`toLocal`). If the two ever disagreed, things would collide where they
 * aren't drawn — the test "a rotated mask is where the sprite is drawn" pins
 * it.
 *
 * Cost. The common case — two unrotated boxes — is the plain box test it
 * always was. Two boxes at any angle use the separating-axis test. Anything
 * with a circle or pixels is checked by sampling the area where the two
 * bounding boxes overlap, one point per pixel (coarser for huge overlaps,
 * never more than MAX_SAMPLES points), stopping at the first point inside
 * both.
 */
import { F, STRIDE } from "./layout";
import type { MaskShape, SpriteDef } from "./game";

const DEG = Math.PI / 180;
const MAX_SAMPLES = 4096;

export const SHAPE = { RECT: 0, CIRCLE: 1, PRECISE: 2 } as const;

export interface SpriteInfo {
  name: string;
  frameCount: number;
  /** Frames advanced per step at image_speed 1: the sprite's fps / steps per second. */
  framesPerStep: number;
  kind: number; // SHAPE
  /** Bounding box of the mask, measured from the origin, unscaled. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Circle, measured from the origin. */
  cx: number;
  cy: number;
  r: number;
  /** For precise masks: image size, origin, and one 0/1 byte per pixel per frame. */
  width: number;
  height: number;
  originX: number;
  originY: number;
  pixels: Uint8Array[] | null;
}

/** A mask in the old shape ({left, top, right, bottom} with no kind) is a box. */
function normalise(def: SpriteDef): MaskShape {
  const m = def.mask as (MaskShape & { kind?: string }) | undefined;
  if (!m) return { kind: "rect", left: 0, top: 0, right: def.width, bottom: def.height };
  if (!m.kind) return { ...(m as object), kind: "rect" } as MaskShape;
  return m;
}

export function spriteInfo(def: SpriteDef, stepsPerSecond = 60): SpriteInfo {
  const m = normalise(def);
  const ox = def.originX, oy = def.originY;
  const info: SpriteInfo = {
    name: def.name,
    frameCount: Math.max(1, def.frameCount),
    // No fps given: one frame per step, which is what image_speed meant
    // before sprites had a speed of their own.
    framesPerStep: (def.fps ?? stepsPerSecond) / stepsPerSecond,
    kind: SHAPE.RECT,
    left: 0, top: 0, right: 0, bottom: 0,
    cx: 0, cy: 0, r: 0,
    width: def.width, height: def.height, originX: ox, originY: oy,
    pixels: null,
  };
  if (m.kind === "circle") {
    info.kind = SHAPE.CIRCLE;
    info.cx = m.cx - ox;
    info.cy = m.cy - oy;
    info.r = Math.max(0, m.r);
    info.left = info.cx - info.r;
    info.right = info.cx + info.r;
    info.top = info.cy - info.r;
    info.bottom = info.cy + info.r;
  } else {
    info.left = m.left - ox;
    info.top = m.top - oy;
    info.right = m.right - ox;
    info.bottom = m.bottom - oy;
    // Precise without its pixels (a headless test, a picture that failed to
    // load) falls back to the box around them, rather than to nothing.
    if (m.kind === "precise" && def.pixelMasks?.length) {
      info.kind = SHAPE.PRECISE;
      info.pixels = def.pixelMasks;
    }
  }
  return info;
}

/** Out-parameter for `boxOf`, reused so the hot paths allocate nothing. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The axis-aligned bounding box of the instance in `slot`'s mask, as if it
 * stood at (x, y). Exact for an unrotated box; for anything turned, the box
 * around the turned shape. Returns false for an instance with no sprite:
 * like GameMaker, an instance without a mask never collides.
 */
export function boxOf(st: Float64Array, slot: number, x: number, y: number, sprites: SpriteInfo[], out: Box): boolean {
  const b = slot * STRIDE;
  const s = sprites[st[b + F.SPRITE]!];
  if (!s) return false;
  const sx = st[b + F.XSCALE]!;
  const sy = st[b + F.YSCALE]!;
  const angle = st[b + F.ANGLE]!;
  const l = s.left * sx, r = s.right * sx, t = s.top * sy, bo = s.bottom * sy;
  if (angle % 360 === 0) {
    // A negative scale mirrors the sprite, which swaps its edges.
    out.left = x + Math.min(l, r);
    out.right = x + Math.max(l, r);
    out.top = y + Math.min(t, bo);
    out.bottom = y + Math.max(t, bo);
    return true;
  }
  // Pixi's rotation, -angle: (px, py) → (px·c − py·s, px·s + py·c).
  const c = Math.cos(-angle * DEG), sn = Math.sin(-angle * DEG);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const px of [l, r]) {
    for (const py of [t, bo]) {
      const wx = px * c - py * sn;
      const wy = px * sn + py * c;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }
  }
  out.left = x + minX;
  out.right = x + maxX;
  out.top = y + minY;
  out.bottom = y + maxY;
  return true;
}

/** Strict overlap: boxes that only share an edge do not touch. */
export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Does the instance in `slot`, standing at (x, y), cover the world point
 * (wx, wy)? The point is taken into the sprite's own pixels (the inverse of
 * how the renderer draws it) and tested against the mask there — so a
 * circle under uneven scale is an exact ellipse, and a precise mask uses
 * the frame being shown.
 */
export function containsPoint(st: Float64Array, slot: number, x: number, y: number, sprites: SpriteInfo[], wx: number, wy: number): boolean {
  const b = slot * STRIDE;
  const s = sprites[st[b + F.SPRITE]!];
  if (!s) return false;
  const sx = st[b + F.XSCALE]!;
  const sy = st[b + F.YSCALE]!;
  if (sx === 0 || sy === 0) return false;
  let dx = wx - x, dy = wy - y;
  const angle = st[b + F.ANGLE]!;
  if (angle % 360 !== 0) {
    const c = Math.cos(angle * DEG), sn = Math.sin(angle * DEG);
    const rx = dx * c - dy * sn;
    dy = dx * sn + dy * c;
    dx = rx;
  }
  const px = dx / sx, py = dy / sy;
  if (s.kind === SHAPE.CIRCLE) {
    const ex = px - s.cx, ey = py - s.cy;
    return ex * ex + ey * ey < s.r * s.r;
  }
  if (px < s.left || px >= s.right || py < s.top || py >= s.bottom) return false;
  if (s.kind === SHAPE.RECT) return true;
  const ix = Math.floor(px + s.originX), iy = Math.floor(py + s.originY);
  if (ix < 0 || iy < 0 || ix >= s.width || iy >= s.height) return false;
  const frames = s.pixels!;
  const f = ((Math.floor(st[b + F.IMAGE_INDEX]!) % frames.length) + frames.length) % frames.length;
  return frames[f]![iy * s.width + ix] === 1;
}

/** The four corners of a box mask in the world, for the separating-axis test. */
function corners(st: Float64Array, slot: number, x: number, y: number, s: SpriteInfo, out: number[]) {
  const b = slot * STRIDE;
  const sx = st[b + F.XSCALE]!, sy = st[b + F.YSCALE]!;
  const c = Math.cos(-st[b + F.ANGLE]! * DEG), sn = Math.sin(-st[b + F.ANGLE]! * DEG);
  const pts = [s.left * sx, s.top * sy, s.right * sx, s.top * sy, s.right * sx, s.bottom * sy, s.left * sx, s.bottom * sy];
  for (let i = 0; i < 8; i += 2) {
    out[i] = x + pts[i]! * c - pts[i + 1]! * sn;
    out[i + 1] = y + pts[i]! * sn + pts[i + 1]! * c;
  }
}

const ca: number[] = new Array(8).fill(0);
const cb: number[] = new Array(8).fill(0);

function separatedOn(ax: number, ay: number): boolean {
  let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
  for (let i = 0; i < 8; i += 2) {
    const pa = ca[i]! * ax + ca[i + 1]! * ay;
    const pb = cb[i]! * ax + cb[i + 1]! * ay;
    if (pa < minA) minA = pa;
    if (pa > maxA) maxA = pa;
    if (pb < minB) minB = pb;
    if (pb > maxB) maxB = pb;
  }
  // Touching (equal) counts as apart, as for unrotated boxes. The small
  // allowance absorbs cos(90°) being 6e-17 rather than 0.
  return maxA <= minB + 1e-9 || maxB <= minA + 1e-9;
}

/**
 * Do the masks of instances a (at ax, ay) and b (at bx, by) overlap? Their
 * bounding boxes, `boxA` and `boxB`, must already be known to overlap.
 */
export function masksOverlap(
  st: Float64Array,
  a: number,
  ax: number,
  ay: number,
  b: number,
  bx: number,
  by: number,
  sprites: SpriteInfo[],
  boxA: Box,
  boxB: Box,
): boolean {
  const ba = a * STRIDE, bb = b * STRIDE;
  const sa = sprites[st[ba + F.SPRITE]!]!, sb = sprites[st[bb + F.SPRITE]!]!;
  const turnedA = st[ba + F.ANGLE]! % 360 !== 0, turnedB = st[bb + F.ANGLE]! % 360 !== 0;

  if (sa.kind === SHAPE.RECT && sb.kind === SHAPE.RECT) {
    if (!turnedA && !turnedB) return true; // the boxes are the masks
    corners(st, a, ax, ay, sa, ca);
    corners(st, b, bx, by, sb, cb);
    for (const src of [ca, cb]) {
      for (let i = 0; i < 4; i += 2) {
        const ex = src[i + 2]! - src[i]!, ey = src[i + 3]! - src[i + 1]!;
        if (separatedOn(-ey, ex)) return false;
      }
    }
    return true;
  }

  // Circles, and anything with pixels: sample where the boxes overlap.
  const left = Math.max(boxA.left, boxB.left), right = Math.min(boxA.right, boxB.right);
  const top = Math.max(boxA.top, boxB.top), bottom = Math.min(boxA.bottom, boxB.bottom);
  const w = right - left, h = bottom - top;
  const step = Math.max(1, Math.sqrt((w * h) / MAX_SAMPLES));
  // At least one sample each way, so a sliver of overlap thinner than a
  // pixel is still looked at rather than skipped.
  const nx = Math.max(1, Math.ceil(w / step)), ny = Math.max(1, Math.ceil(h / step));
  for (let j = 0; j < ny; j++) {
    const y = top + ((j + 0.5) * h) / ny;
    for (let i = 0; i < nx; i++) {
      const x = left + ((i + 0.5) * w) / nx;
      if (containsPoint(st, a, ax, ay, sprites, x, y) && containsPoint(st, b, bx, by, sprites, x, y)) return true;
    }
  }
  return false;
}
