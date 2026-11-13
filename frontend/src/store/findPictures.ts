/**
 * "Find the pictures": the drawings on a sheet that isn't a grid — a page of
 * poses on a coloured background, say, as an image generator draws them —
 * found and put in order, so each becomes a frame.
 *
 *  1. The background: clear, if the picture has see-through corners; else the
 *     colour of its corners, which is made clear. Near that colour is clear,
 *     a band past it is part clear (with the background's colour taken back
 *     out, or every outline keeps a coloured rim), and the rest is drawing.
 *     JPEG and generated pictures never have one exact background colour,
 *     hence a band rather than an exact match.
 *  2. Islands: the solid pixels that touch, corners included.
 *  3. Specks of a few pixels are noise and go. Islands close together are one
 *     drawing (a sword apart from its hand, sparks, a shadow), joined
 *     until none are closer than `join`. What's left that is tiny next to the
 *     biggest is noise too.
 *  4. Reading order: rows from the top, each left to right.
 *
 * Pure (RGBA bytes in, boxes out), so it runs in Vitest; the importer draws.
 */
import { SOLID_ALPHA, type Rect } from "./imageTools";

export type Background = { kind: "clear" } | { kind: "colour"; rgb: [number, number, number] };

export interface Found extends Rect {
  /** How many solid pixels the drawing has. */
  solid: number;
}

/** Islands this small are JPEG specks, not drawing. */
const SPECK = 4;
/** A drawing with fewer solid pixels than this share of the biggest is a leftover, not a frame. */
const LEFTOVER = 0.01;

/** Clear when two or more corners are see-through; otherwise the corners' colour (the middle value of each channel, so one odd corner doesn't count). */
export function backgroundOf(data: Uint8ClampedArray, width: number, height: number): Background {
  const inset = Math.min(2, Math.floor(Math.min(width, height) / 4));
  const corners = [
    [inset, inset],
    [width - 1 - inset, inset],
    [inset, height - 1 - inset],
    [width - 1 - inset, height - 1 - inset],
  ].map(([x, y]) => (y! * width + x!) * 4);
  if (corners.filter((i) => data[i + 3]! < SOLID_ALPHA).length >= 2) return { kind: "clear" };
  const mid = (c: number) => {
    const v = corners.map((i) => data[i + c]!).sort((a, b) => a - b);
    return Math.round((v[1]! + v[2]!) / 2);
  };
  return { kind: "colour", rgb: [mid(0), mid(1), mid(2)] };
}

/**
 * The picture with its background made clear. `tolerance` is how far from
 * the background colour still counts as background; the next 65 steps fade
 * from clear to solid. A clear background changes nothing.
 */
export function keyOut(data: Uint8ClampedArray, bg: Background, tolerance = 45): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  if (bg.kind === "clear") return out;
  const [br, bgG, bb] = bg.rgb;
  const inner = tolerance, outer = tolerance + 65;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]!, g = out[i + 1]!, b = out[i + 2]!;
    const d = Math.sqrt((r - br) ** 2 + (g - bgG) ** 2 + (b - bb) ** 2);
    if (d >= outer) continue;
    if (d <= inner) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      continue;
    }
    const a = (d - inner) / (outer - inner);
    out[i] = (r - (1 - a) * br) / a;
    out[i + 1] = (g - (1 - a) * bgG) / a;
    out[i + 2] = (b - (1 - a) * bb) / a;
    out[i + 3] = Math.round(a * 255) * (out[i + 3]! / 255);
  }
  return out;
}

/** The islands of solid pixels (touching corner to corner counts), each as its box and size. */
export function islands(data: Uint8ClampedArray, width: number, height: number): Found[] {
  const seen = new Uint8Array(width * height);
  const out: Found[] = [];
  const stack: number[] = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3]! < SOLID_ALPHA) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const at = stack.pop()!;
      const x = at % width, y = (at - x) / width;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (seen[j] || data[j * 4 + 3]! < SOLID_ALPHA) continue;
          seen[j] = 1;
          stack.push(j);
        }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, solid: n });
  }
  return out;
}

/** The empty space between two boxes, across or down, whichever is more (0 when they overlap). */
export function gapBetween(a: Rect, b: Rect): number {
  const gx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const gy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.max(gx, gy);
}

export function union(a: Found, b: Found): Found {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, solid: a.solid + b.solid };
}

/** Joins boxes no further apart than `join` pixels, again and again until none are (a join can bring a third one close). */
export function joinClose(boxes: Found[], join: number): Found[] {
  const out = [...boxes];
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < out.length && !again; i++)
      for (let j = i + 1; j < out.length; j++)
        if (gapBetween(out[i]!, out[j]!) <= join) {
          out[i] = union(out[i]!, out[j]!);
          out.splice(j, 1);
          again = true;
          break;
        }
  }
  return out;
}

/**
 * Rows from the top, each left to right. A drawing joins the row whose
 * middle line runs through it; a drawing below every row's middle starts a
 * new row. (Sorting by top alone mixed rows when a tall pose stood beside
 * short ones.)
 */
export function readingOrder<T extends Rect>(boxes: T[]): T[] {
  const rows: { mid: number; items: T[] }[] = [];
  for (const b of [...boxes].sort((p, q) => p.y + p.h / 2 - (q.y + q.h / 2))) {
    const row = rows.find((r) => r.mid >= b.y && r.mid < b.y + b.h);
    if (row) row.items.push(b);
    else rows.push({ mid: b.y + b.h / 2, items: [b] });
  }
  return rows.sort((p, q) => p.mid - q.mid).flatMap((r) => r.items.sort((p, q) => p.x - q.x));
}

/** The drawings on a picture whose background is already clear (keyOut), in reading order. */
export function findPictures(keyed: Uint8ClampedArray, width: number, height: number, join: number): Found[] {
  const found = joinClose(
    islands(keyed, width, height).filter((b) => b.solid >= SPECK),
    join,
  );
  const biggest = Math.max(0, ...found.map((b) => b.solid));
  return readingOrder(found.filter((b) => b.solid >= biggest * LEFTOVER));
}

/**
 * A first guess at how close pieces must be to be one drawing: a 300th of
 * the picture's shorter side, at least 2 pixels. Tried on the showcase
 * games' Gemini sheets: 1% (15 px on those) joined two poses drawn close
 * together; this found every drawing on every sheet tried.
 */
export function defaultJoin(width: number, height: number): number {
  return Math.max(2, Math.round(Math.min(width, height) / 300));
}

/**
 * Where a drawing goes in a frame `fw` × `fh` (all the frames are the size
 * of the biggest, so the animation doesn't jump): across, in the middle;
 * down, standing on the bottom ("bottom", so feet stay on the ground) or in
 * the middle. Whole pixels.
 */
export function placeIn(b: { w: number; h: number }, fw: number, fh: number, align: "bottom" | "middle"): { x: number; y: number } {
  return { x: Math.floor((fw - b.w) / 2), y: align === "bottom" ? fh - b.h : Math.floor((fh - b.h) / 2) };
}
