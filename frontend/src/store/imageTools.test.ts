import { describe, expect, it } from "vitest";
import { gridRects, opaqueBounds, solidPixels, stripRects } from "./imageTools";

const grid = (o: Partial<Parameters<typeof gridRects>[0]>) => ({
  frameWidth: 16, frameHeight: 16, columns: 0, rows: 0, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0, ...o,
});

describe("cutting a sprite sheet", () => {
  it("finds every whole frame on a grid, left to right then down", () => {
    const r = gridRects(grid({}), 48, 32);
    expect(r.map((f) => [f.x, f.y])).toEqual([[0, 0], [16, 0], [32, 0], [0, 16], [16, 16], [32, 16]]);
  });

  it("allows for an offset and spacing, and leaves out half frames at the edge", () => {
    // 2 px margin, 1 px between frames: 2 + 16 + 1 + 16 = 35, a third frame would need 52.
    const r = gridRects(grid({ offsetX: 2, offsetY: 2, spacingX: 1, spacingY: 1 }), 50, 20);
    expect(r.map((f) => [f.x, f.y, f.w, f.h])).toEqual([[2, 2, 16, 16], [19, 2, 16, 16]]);
  });

  it("stops at the columns and rows asked for", () => {
    expect(gridRects(grid({ columns: 2, rows: 1 }), 64, 64)).toHaveLength(2);
  });

  it("splits a strip into equal frames, across or down", () => {
    expect(stripRects(4, 64, 16).map((f) => f.x)).toEqual([0, 16, 32, 48]);
    expect(stripRects(3, 10, 30, true).map((f) => [f.y, f.h])).toEqual([[0, 10], [10, 10], [20, 10]]);
  });

  it("gives nothing for nonsense sizes rather than broken frames", () => {
    expect(gridRects(grid({ frameWidth: 0 }), 32, 32)).toEqual([]);
    expect(stripRects(100, 10, 10)).toEqual([]);
  });
});

function rgba(w: number, h: number, solid: [number, number, number?][]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x, y, a = 255] of solid) data[(y * w + x) * 4 + 3] = a;
  return { data, width: w, height: h };
}

describe("the opaque part of a picture", () => {
  it("is the box around every solid pixel of every frame", () => {
    const a = rgba(8, 8, [[2, 3]]);
    const b = rgba(8, 8, [[5, 1], [4, 6]]);
    expect(opaqueBounds([a, b])).toEqual({ left: 2, top: 1, right: 6, bottom: 7 });
  });

  it("ignores faint pixels (a soft edge doesn't grow the mask)", () => {
    expect(opaqueBounds([rgba(4, 4, [[0, 0, 40], [1, 1, 200]])])).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
  });

  it("is nothing for a fully transparent picture", () => {
    expect(opaqueBounds([rgba(4, 4, [])])).toBeNull();
  });

  it("as one byte per pixel, for exact masks", () => {
    const f = rgba(2, 2, [[1, 0], [0, 1, 100]]);
    expect([...solidPixels(f.data, 2, 2)]).toEqual([0, 1, 0, 0]);
  });
});
