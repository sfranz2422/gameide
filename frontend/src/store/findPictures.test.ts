import { describe, expect, it } from "vitest";
import { backgroundOf, defaultJoin, findPictures, gapBetween, islands, joinClose, keyOut, placeIn, readingOrder } from "./findPictures";

type RGB = [number, number, number];
const PINK: RGB = [193, 58, 148];

/** A sheet `w` × `h` of one colour (alpha 0 for "clear"), with boxes painted on it. */
function sheet(w: number, h: number, bg: RGB | "clear", boxes: [number, number, number, number, RGB][] = []) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) if (bg !== "clear") d.set([...bg, 255], i * 4);
  for (const [x, y, bw, bh, c] of boxes) for (let yy = y; yy < y + bh; yy++) for (let xx = x; xx < x + bw; xx++) d.set([...c, 255], (yy * w + xx) * 4);
  return d;
}

const boxes = (found: { x: number; y: number; w: number; h: number }[]) => found.map((b) => [b.x, b.y, b.w, b.h]);

describe("the background", () => {
  it("see-through corners are a clear background; otherwise the corners' colour, an odd corner outvoted", () => {
    expect(backgroundOf(sheet(10, 10, "clear"), 10, 10)).toEqual({ kind: "clear" });
    const d = sheet(10, 10, PINK, [[0, 0, 4, 4, [0, 0, 0]]]); // a drawing in one corner
    expect(backgroundOf(d, 10, 10)).toEqual({ kind: "colour", rgb: PINK });
  });

  it("near the background colour is clear, far from it untouched, and between part clear with the colour taken out", () => {
    const d = new Uint8ClampedArray([
      ...[200, 60, 150, 255], // a JPEG's not-quite-pink: clear
      ...[20, 200, 30, 255], // green: drawing
      ...[150, 50, 120, 255], // an outline's edge, mixed with the pink
    ]);
    const k = keyOut(d, { kind: "colour", rgb: PINK });
    expect(k[3]).toBe(0);
    expect([...k.slice(4, 8)]).toEqual([20, 200, 30, 255]);
    expect(k[11]).toBeGreaterThan(0);
    expect(k[11]).toBeLessThan(255);
    expect(k[8]).toBeLessThan(150); // less red than it was: the pink's rim is gone
    expect(keyOut(d, { kind: "clear" })).toEqual(d);
  });
});

describe("finding the drawings", () => {
  it("two rows read top to bottom, left to right, even when a tall pose stands among short ones", () => {
    const green: RGB = [20, 200, 30];
    const d = sheet(100, 60, PINK, [
      [60, 5, 10, 10, green], // row 1, right
      [10, 2, 10, 20, green], // row 1, left, taller and starting higher
      [35, 8, 10, 10, green], // row 1, middle
      [10, 40, 10, 10, green], // row 2
    ]);
    const k = keyOut(d, backgroundOf(d, 100, 60));
    expect(boxes(findPictures(k, 100, 60, defaultJoin(100, 60)))).toEqual([
      [10, 2, 10, 20],
      [35, 8, 10, 10],
      [60, 5, 10, 10],
      [10, 40, 10, 10],
    ]);
  });

  it("sparks near a drawing are part of it; specks and leftovers are noise", () => {
    const c: RGB = [250, 250, 250];
    const d = sheet(100, 40, "clear", [
      [10, 10, 10, 10, c],
      [22, 12, 3, 3, c], // a spark 2 px away: joined
      [60, 10, 10, 10, c],
      [90, 35, 1, 1, c], // a speck: gone
    ]);
    expect(boxes(findPictures(d, 100, 40, 3))).toEqual([
      [10, 10, 15, 10],
      [60, 10, 10, 10],
    ]);
    // Joining further apart makes one drawing of the two.
    expect(findPictures(d, 100, 40, 40)).toHaveLength(1);
  });

  it("pixels touching corner to corner are one island (a diagonal line is one drawing)", () => {
    const c: RGB = [9, 9, 9];
    const d = sheet(4, 4, "clear", [[0, 0, 1, 1, c], [1, 1, 1, 1, c], [2, 2, 1, 1, c], [3, 3, 1, 1, c]]);
    expect(boxes(islands(d, 4, 4))).toEqual([[0, 0, 4, 4]]);
  });

  it("joining runs until nothing is close: a join can bring a third piece in reach", () => {
    const s = (x: number) => ({ x, y: 0, w: 4, h: 4, solid: 16 });
    expect(joinClose([s(0), s(14), s(7)], 3)).toHaveLength(1);
    expect(gapBetween(s(0), s(7))).toBe(3);
  });

  it("reading order on its own", () => {
    const b = (x: number, y: number) => ({ x, y, w: 4, h: 4 });
    expect(readingOrder([b(20, 0), b(0, 10), b(0, 1)])).toEqual([b(0, 1), b(20, 0), b(0, 10)]);
  });
});

describe("placing a drawing in its frame", () => {
  it("across in the middle; down standing on the bottom, or in the middle", () => {
    expect(placeIn({ w: 4, h: 6 }, 10, 10, "bottom")).toEqual({ x: 3, y: 4 });
    expect(placeIn({ w: 4, h: 6 }, 10, 10, "middle")).toEqual({ x: 3, y: 2 });
  });
});
