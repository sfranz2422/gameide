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

import { TILE_FLIP_X, TILE_FLIP_Y, TILE_MASK, TILE_TURN } from "../../engine/game";

export interface Stamp {
  columns: number;
  rows: number;
  tiles: number[]; // row by row
}

export const single = (tile: number): Stamp => ({ columns: 1, rows: 1, tiles: [tile] });

export type TileOp = "flipX" | "flipY" | "turn";

/**
 * A brush flipped across, flipped down, or turned a quarter clockwise: the
 * block of tiles moves as a whole, and each tile's own bits (game.ts
 * TILE_FLIP_X…) change with it. The renderer draws a tile scaled first and
 * turned second, so a flip of a turned tile is the other flip, and two
 * turns are both flips — kept that way here, so what the brush shows is
 * what the game draws.
 */
export function transformStamp(s: Stamp, op: TileOp): Stamp {
  const at = (x: number, y: number) => s.tiles[y * s.columns + x]!;
  const each = (n: number, change: (bits: number) => number) => (n < 0 ? n : (n & TILE_MASK) | change(n & ~TILE_MASK));
  const turned = (bits: number) => (bits & TILE_TURN) !== 0;
  if (op === "turn") {
    const columns = s.rows, rows = s.columns, tiles: number[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++)
        tiles.push(each(at(y, s.rows - 1 - x), (b) => (turned(b) ? (b & ~TILE_TURN) ^ TILE_FLIP_X ^ TILE_FLIP_Y : b | TILE_TURN)));
    return { columns, rows, tiles };
  }
  const tiles: number[] = [];
  for (let y = 0; y < s.rows; y++)
    for (let x = 0; x < s.columns; x++) {
      const n = op === "flipX" ? at(s.columns - 1 - x, y) : at(x, s.rows - 1 - y);
      const own = op === "flipX" ? TILE_FLIP_X : TILE_FLIP_Y, other = op === "flipX" ? TILE_FLIP_Y : TILE_FLIP_X;
      tiles.push(each(n, (b) => b ^ (turned(b) ? other : own)));
    }
  return { columns: s.columns, rows: s.rows, tiles };
}

/** Draws a painted cell's tile, flipped and turned as its bits say (as the renderer does: scaled, then turned). */
export function drawTileValue(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  src: { x: number; y: number; w: number; h: number },
  value: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (!(value & ~TILE_MASK)) {
    ctx.drawImage(img, src.x, src.y, src.w, src.h, dx, dy, dw, dh);
    return;
  }
  ctx.save();
  ctx.translate(dx + dw / 2, dy + dh / 2);
  if (value & TILE_TURN) ctx.rotate(Math.PI / 2);
  ctx.scale(value & TILE_FLIP_X ? -1 : 1, value & TILE_FLIP_Y ? -1 : 1);
  ctx.drawImage(img, src.x, src.y, src.w, src.h, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

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
  for (const [x, y] of floodCells(tiles, c, r, b, limit)) out[key(x, y)] = patternAt(stamp, x, y, c, r);
  return out;
}

/** The cells the bucket would fill from (c, r): joined (up, down, left, right) and alike, inside the room. */
export function floodCells(tiles: TileMap, c: number, r: number, b: Bounds, limit = 20000): [number, number][] {
  if (!inside(c, r, b)) return [];
  const target = tiles[key(c, r)];
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const stack: [number, number][] = [[c, r]];
  while (stack.length && seen.size < limit) {
    const [x, y] = stack.pop()!;
    const k = key(x, y);
    if (seen.has(k) || !inside(x, y, b) || tiles[k] !== target) continue;
    seen.add(k);
    out.push([x, y]);
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

// ---------------------------------------------------------------- autotiling

/**
 * An autotile set: 16 tiles, one for each way a cell can join its
 * neighbours. The index is a sum — up 1, right 2, down 4, left 8 — of the
 * sides where the next cell is in the same set: 0 is an island, 15 is
 * surrounded, 4 is a top edge (only joined below), and so on. A slot with
 * no tile (-1) borrows the fully joined tile, so a half-made set still paints.
 */
export interface AutotileSet {
  id: string;
  name: string;
  tiles: number[]; // 16
}

export const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;

function tileFor(set: AutotileSet, mask: number): number {
  const t = set.tiles[mask];
  if (t !== undefined && t >= 0) return t;
  return set.tiles[15] !== undefined && set.tiles[15]! >= 0 ? set.tiles[15]! : set.tiles.find((x) => x >= 0) ?? 0;
}

/** Re-picks the tile of each listed cell that belongs to the set, from its neighbours now. */
function retile(tiles: TileMap, cells: [number, number][], set: AutotileSet): TileMap {
  const members = new Set(set.tiles.filter((t) => t >= 0));
  const isMember = (c: number, r: number) => {
    const t = tiles[key(c, r)];
    return t !== undefined && members.has(t);
  };
  const out = { ...tiles };
  for (const [c, r] of cells) {
    if (!isMember(c, r)) continue;
    const mask = (isMember(c, r - 1) ? UP : 0) | (isMember(c + 1, r) ? RIGHT : 0) | (isMember(c, r + 1) ? DOWN : 0) | (isMember(c - 1, r) ? LEFT : 0);
    out[key(c, r)] = tileFor(set, mask);
  }
  return out;
}

/** The cells and their neighbours, each once: everything a change there can affect. */
function withNeighbours(cells: [number, number][]): [number, number][] {
  const seen = new Map<string, [number, number]>();
  for (const [c, r] of cells)
    for (const [x, y] of [[c, r], [c, r - 1], [c + 1, r], [c, r + 1], [c - 1, r]] as [number, number][]) seen.set(key(x, y), [x, y]);
  return [...seen.values()];
}

/**
 * Paints cells with an autotile set: each becomes a member, then it and
 * its neighbours pick the right piece. `cells` is one cell for the brush,
 * a block for the rectangle.
 */
export function autotilePaint(tiles: TileMap, cells: [number, number][], set: AutotileSet, b: Bounds): TileMap {
  const inRoom = cells.filter(([c, r]) => inside(c, r, b));
  if (!inRoom.length) return tiles;
  let out = { ...tiles };
  const placeholder = tileFor(set, 15);
  for (const [c, r] of inRoom) out[key(c, r)] = placeholder;
  out = retile(out, withNeighbours(inRoom), set);
  return out;
}

/** Erases cells, then lets neighbours in the set re-pick their pieces (an edge appears). */
export function autotileErase(tiles: TileMap, cells: [number, number][], set: AutotileSet): TileMap {
  const out = { ...tiles };
  for (const [c, r] of cells) delete out[key(c, r)];
  return retile(out, withNeighbours(cells), set);
}

/** Every cell of the rectangle between two cells. */
export function rectCells(c0: number, r0: number, c1: number, r1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) out.push([c, r]);
  return out;
}
