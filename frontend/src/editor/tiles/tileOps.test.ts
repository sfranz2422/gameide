import { describe, expect, it } from "vitest";
import { autotileErase, autotilePaint, cellsBetween, erase, fillRect, floodFill, paint, pick, rectCells, single, stampFromPalette, type AutotileSet } from "./tileOps";
import { transformStamp } from "./tileOps";
import { TILE_FLIP_X, TILE_FLIP_Y, TILE_TURN } from "../../engine/game";

const B = { columns: 10, rows: 5 };

describe("painting tiles", () => {
  it("a stamp paints its block from the cell clicked, clipped to the room", () => {
    const block = { columns: 2, rows: 2, tiles: [1, 2, 5, 6] };
    expect(paint({}, 3, 1, block, B)).toEqual({ "3,1": 1, "4,1": 2, "3,2": 5, "4,2": 6 });
    expect(paint({}, 9, 4, block, B)).toEqual({ "9,4": 1 }); // the rest would be off the room
  });

  it("erasing clears a block the brush's size, and nothing else", () => {
    const t = { "0,0": 1, "1,0": 1, "2,0": 1 };
    expect(erase(t, 0, 0, 2, 1)).toEqual({ "2,0": 1 });
  });

  it("a rectangle repeats the stamp's pattern from its top-left, either way it was dragged", () => {
    const stripes = { columns: 2, rows: 1, tiles: [7, 8] };
    expect(fillRect({}, 3, 0, 0, 0, stripes, B)).toEqual({ "0,0": 7, "1,0": 8, "2,0": 7, "3,0": 8 });
    expect(fillRect({ "1,1": 4 }, 0, 0, 2, 2, null, B)).toEqual({}); // a null stamp erases
  });

  it("the bucket fills what is joined and alike, inside the room only", () => {
    // A wall of 3s down column 2 splits the room; fill on the left side.
    const wall: Record<string, number> = {};
    for (let r = 0; r < 5; r++) wall[`2,${r}`] = 3;
    const filled = floodFill(wall, 0, 0, single(9), B);
    expect(Object.values(filled).filter((t) => t === 9)).toHaveLength(10); // 2 columns × 5 rows
    expect(filled["5,0"]).toBeUndefined();
    expect(filled["2,0"]).toBe(3);
  });

  it("the bucket stops at its limit, and filling a tile with itself changes nothing", () => {
    expect(Object.keys(floodFill({}, 0, 0, single(1), { columns: 1000, rows: 1000 }, 50))).toHaveLength(50);
    const same = { "0,0": 4 };
    expect(floodFill(same, 0, 0, single(4), B)).toBe(same);
  });

  it("the eyedropper picks a cell's tile, or nothing", () => {
    expect(pick({ "1,1": 6 }, 1, 1)).toEqual(single(6));
    expect(pick({}, 1, 1)).toBeNull();
  });

  it("a block chosen on the palette, dragged either way", () => {
    expect(stampFromPalette(5, 0, 4)).toEqual({ columns: 2, rows: 2, tiles: [0, 1, 4, 5] });
  });
});

// Tile number = 100 + mask, so a result reads as the mask it was chosen for.
const grass: AutotileSet = { id: "g", name: "grass", tiles: Array.from({ length: 16 }, (_, m) => 100 + m) };

describe("autotiling", () => {
  it("one cell alone is an island; a row joins its ends to the middle", () => {
    expect(autotilePaint({}, [[2, 2]], grass, B)).toEqual({ "2,2": 100 });
    const row = autotilePaint({}, rectCells(1, 2, 3, 2), grass, B);
    expect(row).toEqual({ "1,2": 102, "2,2": 110, "3,2": 108 }); // right; right+left; left
  });

  it("painting next to a cell changes the cell already there", () => {
    let t = autotilePaint({}, [[2, 2]], grass, B);
    t = autotilePaint(t, [[2, 3]], grass, B); // one below
    expect(t).toEqual({ "2,2": 104, "2,3": 101 }); // top edge (joined down); bottom (joined up)
  });

  it("a filled block has edges, corners and a middle", () => {
    const t = autotilePaint({}, rectCells(0, 0, 2, 2), grass, B);
    expect(t["1,1"]).toBe(115); // all four sides
    expect(t["1,0"]).toBe(100 + 2 + 4 + 8); // top edge: right, down, left
    expect(t["0,0"]).toBe(100 + 2 + 4); // top-left corner
  });

  it("erasing lets the neighbours grow an edge; other tiles are left alone", () => {
    let t = autotilePaint({ "5,0": 7 }, rectCells(0, 0, 2, 0), grass, B);
    t = autotileErase(t, [[1, 0]], grass);
    expect(t).toEqual({ "0,0": 100, "2,0": 100, "5,0": 7 });
  });

  it("an unfinished set borrows its fully joined tile for missing pieces", () => {
    const half: AutotileSet = { id: "h", name: "half", tiles: [...new Array(15).fill(-1), 42] };
    expect(autotilePaint({}, [[0, 0]], half, B)).toEqual({ "0,0": 42 });
  });
});

describe("flipping and turning a brush", () => {
  const X = TILE_FLIP_X, Y = TILE_FLIP_Y, T = TILE_TURN;
  it("flips a block across or down as a whole, and each tile with it", () => {
    const s = { columns: 2, rows: 1, tiles: [3, 4] };
    expect(transformStamp(s, "flipX")).toEqual({ columns: 2, rows: 1, tiles: [4 | X, 3 | X] });
    expect(transformStamp(s, "flipY")).toEqual({ columns: 2, rows: 1, tiles: [3 | Y, 4 | Y] });
    expect(transformStamp(transformStamp(s, "flipX"), "flipX")).toEqual(s); // twice is back
  });

  it("turns a block a quarter clockwise: its rows become columns", () => {
    const s = { columns: 2, rows: 1, tiles: [3, 4] }; // [3][4] turned clockwise stands up: 3 on top
    expect(transformStamp(s, "turn")).toEqual({ columns: 1, rows: 2, tiles: [3 | T, 4 | T] });
    const tall = { columns: 1, rows: 2, tiles: [3, 4] }; // 3 over 4, turned: 4 on the left
    expect(transformStamp(tall, "turn")).toEqual({ columns: 2, rows: 1, tiles: [4 | T, 3 | T] });
  });

  it("keeps a tile's look consistent with how the game draws it: scaled, then turned", () => {
    const one = single(5);
    const twice = transformStamp(transformStamp(one, "turn"), "turn");
    expect(twice.tiles).toEqual([5 | X | Y]); // half a turn is both flips
    expect(transformStamp(transformStamp(twice, "turn"), "turn").tiles).toEqual([5]); // a whole turn is nothing
    expect(transformStamp(transformStamp(one, "turn"), "flipX").tiles).toEqual([5 | T | Y]); // a turned tile flipped across flips down
    expect(transformStamp(single(-1), "turn").tiles).toEqual([-1]); // empty stays empty
  });
});

describe("a stroke between two pointer moves", () => {
  it("paints every cell it crosses, each sharing a side with the one before, ending where the pointer is", () => {
    expect(cellsBetween(0, 0, 4, 0)).toEqual([[1, 0], [2, 0], [3, 0], [4, 0]]);
    expect(cellsBetween(2, 5, 2, 2)).toEqual([[2, 4], [2, 3], [2, 2]]);
    expect(cellsBetween(3, 3, 3, 3)).toEqual([]);
    for (const [c1, r1] of [[7, 3], [-5, 2], [2, -9], [-4, -4], [1, 6]] as const) {
      const cells = cellsBetween(0, 0, c1, r1);
      expect(cells.at(-1)).toEqual([c1, r1]);
      expect(cells).toHaveLength(Math.abs(c1) + Math.abs(r1));
      let [pc, pr] = [0, 0];
      for (const [c, r] of cells) {
        expect(Math.abs(c - pc) + Math.abs(r - pr), `${c1},${r1}`).toBe(1); // never a diagonal step
        [pc, pr] = [c, r];
      }
      // And it keeps close to the straight line: no cell more than a cell away from it.
      for (const [c, r] of cells) {
        const off = Math.abs(c * r1 - r * c1) / Math.hypot(c1, r1);
        expect(off).toBeLessThan(1);
      }
    }
  });
});
