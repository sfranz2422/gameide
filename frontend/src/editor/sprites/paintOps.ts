/**
 * Drawing on a sprite's pixels: the pencil, the eraser, the fill and the
 * colour picker. Pure — a picture here is plain RGBA bytes, as ImageData
 * holds them — so it runs in Vitest without a canvas, and the editor only
 * copies the bytes onto its canvas.
 */

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes a pixel, rows top to bottom. */
  data: Uint8ClampedArray;
}

export type RGBA = readonly [number, number, number, number];
export const CLEAR: RGBA = [0, 0, 0, 0];

export function blank(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function copyPixels(p: Pixels): Pixels {
  return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) };
}

/** The colour at x, y; null off the picture. */
export function getPixel(p: Pixels, x: number, y: number): RGBA | null {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return null;
  const i = (y * p.width + x) * 4;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!, p.data[i + 3]!];
}

/** Sets one pixel (off the picture does nothing). True if it changed. */
export function setPixel(p: Pixels, x: number, y: number, c: RGBA): boolean {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return false;
  const i = (y * p.width + x) * 4;
  const d = p.data;
  if (d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2] && d[i + 3] === c[3]) return false;
  d[i] = c[0];
  d[i + 1] = c[1];
  d[i + 2] = c[2];
  d[i + 3] = c[3];
  return true;
}

/**
 * A square brush `size` pixels across, its top-left corner nearest the
 * pointer moving with it: size 1 is the pixel under the pointer, size 2
 * that one and the ones right and below, and so on — the pixel clicked is
 * always painted.
 */
export function dab(p: Pixels, x: number, y: number, c: RGBA, size = 1): boolean {
  const from = -Math.floor((size - 1) / 2);
  let changed = false;
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) changed = setPixel(p, x + from + dx, y + from + dy, c) || changed;
  return changed;
}

/**
 * A line of dabs from one pixel to another, every pixel between them
 * (Bresenham). A pointer moving fast reports points far apart: painting only
 * those left a dotted trail.
 */
export function line(p: Pixels, x0: number, y0: number, x1: number, y1: number, c: RGBA, size = 1): boolean {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let changed = false;
  for (;;) {
    changed = dab(p, x0, y0, c, size) || changed;
    if (x0 === x1 && y0 === y1) return changed;
    const e2 = 2 * err;
    if (e2 >= dy) (err += dy), (x0 += sx);
    if (e2 <= dx) (err += dx), (y0 += sy);
  }
}

/**
 * Fills the area of one colour around x, y (up, down, left and right; not
 * corner to corner, so a diagonal line is a wall). Returns how many pixels
 * changed: 0 when the area is already that colour.
 */
export function fill(p: Pixels, x: number, y: number, c: RGBA): number {
  const start = getPixel(p, x, y);
  if (!start || same(start, c)) return 0;
  const { width, height, data } = p;
  const matches = (i: number) =>
    // Every fully clear pixel is the same "nothing", whatever colour bytes
    // it carries: a picture from elsewhere can hide colours in clear pixels,
    // and a fill would stop at an invisible edge.
    start[3] === 0 ? data[i + 3] === 0 : data[i] === start[0] && data[i + 1] === start[1] && data[i + 2] === start[2] && data[i + 3] === start[3];
  const stack = [y * width + x];
  let n = 0;
  while (stack.length) {
    const at = stack.pop()!;
    const i = at * 4;
    if (!matches(i)) continue;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = c[3];
    n++;
    const px = at % width, py = (at - px) / width;
    if (px > 0) stack.push(at - 1);
    if (px < width - 1) stack.push(at + 1);
    if (py > 0) stack.push(at - width);
    if (py < height - 1) stack.push(at + width);
  }
  return n;
}

function same(a: RGBA, b: RGBA): boolean {
  if (a[3] === 0 && b[3] === 0) return true;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/** "#rrggbb" (or "#rgb") as an opaque colour. */
export function fromHex(hex: string): RGBA {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((ch) => ch + ch).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function toHex(c: RGBA): string {
  return "#" + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * The colours a picture uses most, most used first, at most `max`: the
 * palette for touching up a picture someone else drew. Faint pixels (the
 * soft edges of a painted picture) are left out.
 */
export function colorsIn(p: Pixels, max = 16): string[] {
  const count = new Map<string, number>();
  for (let i = 0; i < p.data.length; i += 4) {
    if (p.data[i + 3]! < 128) continue;
    const hex = toHex([p.data[i]!, p.data[i + 1]!, p.data[i + 2]!, 255]);
    count.set(hex, (count.get(hex) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, max).map(([h]) => h);
}

/**
 * GameIDE's own starting colours: greys, then a light, a middle and a dark
 * of each hue, in the order a colour wheel goes, so shading a thing is
 * picking the swatch beside it.
 */
export const PALETTE: string[] = [
  "#000000", "#3b4252", "#7a8496", "#c3cad6", "#ffffff",
  "#ffb3b8", "#e8414f", "#8c1c2b",
  "#ffd0a1", "#f5832a", "#8f4515",
  "#fff2a1", "#f7cf2a", "#9c7a12",
  "#c9f29b", "#5cc23a", "#2b6b26",
  "#a8f0e6", "#2bb8a6", "#156158",
  "#b0dcff", "#3a8ee8", "#1c3f8c",
  "#dcc4ff", "#8f5ae0", "#4a2a85",
  "#ffc4ec", "#e05ab4", "#7a2463",
  "#e8c9a8", "#a8714a", "#5c3a24",
];

// ---------------------------------------------------------------- shapes

/** The box two pixels span, either corner first; with `square`, cut to a square from the first corner (Shift). */
export function spanOf(x0: number, y0: number, x1: number, y1: number, square = false): Box {
  if (square) {
    const side = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0));
    x1 = x0 + Math.sign(x1 - x0 || 1) * side;
    y1 = y0 + Math.sign(y1 - y0 || 1) * side;
  }
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 };
}

/** A box: its edge `size` pixels thick, or filled. */
export function box(p: Pixels, b: Box, c: RGBA, filled: boolean, size = 1): void {
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      const edge = x - b.x < size || b.x + b.w - 1 - x < size || y - b.y < size || b.y + b.h - 1 - y < size;
      if (filled || edge) setPixel(p, x, y, c);
    }
}

/**
 * The ellipse that fits a box, edge or filled. Each row is filled between
 * the ellipse's edges at that row's middle; an edge pixel is a filled one
 * with a clear neighbour, so the outline is unbroken at any size.
 */
export function ellipse(p: Pixels, b: Box, c: RGBA, filled: boolean): void {
  const inside = (x: number, y: number) => {
    if (x < b.x || y < b.y || x >= b.x + b.w || y >= b.y + b.h) return false;
    const rx = b.w / 2, ry = b.h / 2;
    const dx = (x + 0.5 - (b.x + rx)) / rx, dy = (y + 0.5 - (b.y + ry)) / ry;
    return dx * dx + dy * dy <= 1.0001;
  };
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++) {
      if (!inside(x, y)) continue;
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) setPixel(p, x, y, c);
    }
}

// ---------------------------------------------------------------- selections

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box cut to the picture; null if none of it is on the picture. */
export function clip(b: Box, width: number, height: number): Box | null {
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y);
  const x1 = Math.min(width, b.x + b.w), y1 = Math.min(height, b.y + b.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** A copy of the pixels in a box (off the picture is clear). */
export function crop(p: Pixels, b: Box): Pixels {
  const out = blank(b.w, b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const c = getPixel(p, b.x + x, b.y + y);
      if (c) setPixel(out, x, y, c);
    }
  return out;
}

/** Clears a box. */
export function clearBox(p: Pixels, b: Box): void {
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) setPixel(p, x, y, CLEAR);
}

/**
 * Puts `src` down with its top-left at x, y. Its clear pixels let what's
 * under them show (a moved piece's empty corners don't cut holes in the
 * picture); `replace` copies them too.
 */
export function stamp(dst: Pixels, src: Pixels, x: number, y: number, replace = false): void {
  for (let sy = 0; sy < src.height; sy++)
    for (let sx = 0; sx < src.width; sx++) {
      const c = getPixel(src, sx, sy)!;
      if (replace || c[3] > 0) setPixel(dst, x + sx, y + sy, c);
    }
}

/** Mirrored left to right. */
export function flipH(p: Pixels): Pixels {
  const out = blank(p.width, p.height);
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) setPixel(out, p.width - 1 - x, y, getPixel(p, x, y)!);
  return out;
}

/** Mirrored top to bottom. */
export function flipV(p: Pixels): Pixels {
  const out = blank(p.width, p.height);
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) setPixel(out, x, p.height - 1 - y, getPixel(p, x, y)!);
  return out;
}

/**
 * Turned a quarter: `clockwise` as a clock's hands go. Width and height
 * swap. Only quarter turns: any other angle would have to smudge pixels
 * (in a game, image_angle turns a sprite any amount).
 */
export function rotate(p: Pixels, clockwise: boolean): Pixels {
  const out = blank(p.height, p.width);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const c = getPixel(p, x, y)!;
      if (clockwise) setPixel(out, p.height - 1 - y, x, c);
      else setPixel(out, y, p.width - 1 - x, c);
    }
  return out;
}

/**
 * A whole frame turned or flipped, kept the frame's size: a turned frame
 * that isn't square is centred on the old one, and what falls off its edges
 * is lost (said in the editor's hint, not silently).
 */
export function transformFrame(p: Pixels, how: Transform): Pixels {
  const t = transformed(p, how);
  if (t.width === p.width && t.height === p.height) return t;
  const out = blank(p.width, p.height);
  stamp(out, t, Math.floor((p.width - t.width) / 2), Math.floor((p.height - t.height) / 2), true);
  return out;
}

export type Transform = "flipH" | "flipV" | "rotateCW" | "rotateCCW";

export function transformed(p: Pixels, how: Transform): Pixels {
  return how === "flipH" ? flipH(p) : how === "flipV" ? flipV(p) : rotate(p, how === "rotateCW");
}

/** Frames side by side, left to right: the strip an importer cuts back into the same frames. */
export function strip(frames: Pixels[]): Pixels {
  const w = frames[0]?.width ?? 0, h = frames[0]?.height ?? 0;
  const out = blank(w * frames.length, h);
  frames.forEach((f, i) => stamp(out, f, i * w, 0, true));
  return out;
}
