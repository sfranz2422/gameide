/**
 * Painting tiles, as plain functions over a layer's sparse map
 * ("column,row" → tile number). Each returns a new map, so the room
 * editor's undo can keep the old one.
 *
 * A stamp is what the brush paints: one tile, or a block of tiles chosen
 * from the tileset (a whole tree, a platform with its ends). Painting puts
 * the stamp's top-left on the cell clicked; a rectangle repeats the stamp to
 * fill itself; the bucket fills with the stamp's pattern too.
 */
export type TileMap = Record<string, number>;

export interface Stamp {
  columns: number;
  rows: number;
  tiles: number[]; // row by row
}

export const single = (tile: number): Stamp => ({ columns: 1, rows: 1, tiles: [tile] });

const key = (c: number, r: number) => `${c},${r}`;

export interface Bounds {
  columns: number;
  rows: number;
}

const inside = (c: number, r: number, b: Bounds) => c >= 0 && r >= 0 && c < b.columns && r < b.rows;

/** The stamp's tile for cell (c, r) when its pattern starts at (c0, r0). */
function patternAt(stamp: Stamp, c: number, r: number, c0: number, r0: number): number {
  const sc = (((c - c0) % stamp.columns) + stamp.columns) % stamp.columns;
  const sr = (((r - r0) % stamp.rows) + stamp.rows) % stamp.rows;
  return stamp.tiles[sr * stamp.columns + sc]!;
}

export function paint(tiles: TileMap, c: number, r: number, stamp: Stamp, b: Bounds): TileMap {
  const out = { ...tiles };
  for (let y = 0; y < stamp.rows; y++)
    for (let x = 0; x < stamp.columns; x++) if (inside(c + x, r + y, b)) out[key(c + x, r + y)] = stamp.tiles[y * stamp.columns + x]!;
  return out;
}

/** Clears a block the stamp's size (the brush erases what it would paint over). */
export function erase(tiles: TileMap, c: number, r: number, columns = 1, rows = 1): TileMap {
  const out = { ...tiles };
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) delete out[key(c + x, r + y)];
  return out;
}

/** Fills the rectangle between two cells (either order) with the stamp's pattern; null stamp erases it. */
export function fillRect(tiles: TileMap, c0: number, r0: number, c1: number, r1: number, stamp: Stamp | null, b: Bounds): TileMap {
  const out = { ...tiles };
  const left = Math.min(c0, c1), right = Math.max(c0, c1), top = Math.min(r0, r1), bottom = Math.max(r0, r1);
  for (let r = top; r <= bottom; r++)
    for (let c = left; c <= right; c++) {
      if (!inside(c, r, b)) continue;
      if (stamp) out[key(c, r)] = patternAt(stamp, c, r, left, top);
      else delete out[key(c, r)];
    }
  return out;
}

/**
 * The bucket: every cell joined to (c, r) — up, down, left, right — that
 * holds what (c, r) holds (an empty cell counts as "nothing"), changed to
 * the stamp's pattern. Stays inside the room, and stops after `limit`
 * cells so a click on a huge empty room can't hang the page.
 */
export function floodFill(tiles: TileMap, c: number, r: number, stamp: Stamp, b: Bounds, limit = 20000): TileMap {
  if (!inside(c, r, b)) return tiles;
  const target = tiles[key(c, r)];
  if (stamp.columns === 1 && stamp.rows === 1 && stamp.tiles[0] === target) return tiles; // nothing would change
  const out = { ...tiles };
  const seen = new Set<string>();
  const stack: [number, number][] = [[c, r]];
  while (stack.length && seen.size < limit) {
    const [x, y] = stack.pop()!;
    const k = key(x, y);
    if (seen.has(k) || !inside(x, y, b) || tiles[k] !== target) continue;
    seen.add(k);
    out[k] = patternAt(stamp, x, y, c, r);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return out;
}

/** The tile in a cell, as a one-tile stamp, or null when empty (the eyedropper). */
export function pick(tiles: TileMap, c: number, r: number): Stamp | null {
  const t = tiles[key(c, r)];
  return t === undefined ? null : single(t);
}

/** A block of tiles chosen on the tileset's grid, between two tiles (either order). */
export function stampFromPalette(a: number, b: number, columns: number): Stamp {
  const ca = a % columns, ra = Math.floor(a / columns), cb = b % columns, rb = Math.floor(b / columns);
  const left = Math.min(ca, cb), right = Math.max(ca, cb), top = Math.min(ra, rb), bottom = Math.max(ra, rb);
  const tiles: number[] = [];
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) tiles.push(r * columns + c);
  return { columns: right - left + 1, rows: bottom - top + 1, tiles };
}
