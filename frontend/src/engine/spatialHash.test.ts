import { describe, expect, it } from "vitest";
import { SpatialHash } from "./spatialHash";

const found = (h: SpatialHash, l: number, t: number, r: number, b: number) => {
  const out: number[] = [];
  h.query(l, t, r, b, (s) => void out.push(s));
  return out.sort((a, b) => a - b);
};

describe("SpatialHash", () => {
  it("finds what is filed under the cells a query covers, and nothing else", () => {
    const h = new SpatialHash(64);
    h.update(1, 0, 0, 16, 16);
    h.update(2, 500, 500, 516, 516);
    expect(found(h, 0, 0, 10, 10)).toEqual([1]);
    expect(found(h, 490, 490, 520, 520)).toEqual([2]);
    expect(found(h, 200, 200, 210, 210)).toEqual([]);
  });

  it("reports a slot spanning several cells once per query", () => {
    const h = new SpatialHash(64);
    h.update(7, 0, 0, 300, 300); // 5 × 5 cells
    expect(found(h, 0, 0, 400, 400)).toEqual([7]);
  });

  it("treats a box's far edge as exclusive, so a 64-wide box sits in one cell", () => {
    const h = new SpatialHash(64);
    h.update(3, 0, 0, 64, 64);
    expect(found(h, 64, 0, 70, 10)).toEqual([]);
  });

  it("works left of and above the origin", () => {
    const h = new SpatialHash(64);
    h.update(4, -100, -100, -80, -80);
    expect(found(h, -90, -90, -85, -85)).toEqual([4]);
    expect(found(h, 0, 0, 10, 10)).toEqual([]);
  });

  it("moves and removes slots", () => {
    const h = new SpatialHash(64);
    h.update(5, 0, 0, 16, 16);
    h.update(5, 300, 300, 316, 316);
    expect(found(h, 0, 0, 16, 16)).toEqual([]);
    expect(found(h, 300, 300, 316, 316)).toEqual([5]);
    h.remove(5);
    expect(found(h, 300, 300, 316, 316)).toEqual([]);
  });

  it("stops at the first match when the visitor says so", () => {
    const h = new SpatialHash(64);
    for (let i = 0; i < 10; i++) h.update(i, 0, 0, 8, 8);
    let visits = 0;
    expect(h.query(0, 0, 8, 8, () => (visits++, true))).toBe(true);
    expect(visits).toBe(1);
  });
});
