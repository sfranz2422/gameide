import { describe, expect, it } from "vitest";
import { autotileErase, autotilePaint, erase, fillRect, floodFill, paint, pick, rectCells, single, stampFromPalette, type AutotileSet } from "./tileOps";

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
