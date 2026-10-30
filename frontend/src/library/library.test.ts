/**
 * The library's promises: every picture it lists is there, cut into whole
 * cells of the size it says, and every pack carries its licence — CC0, so
 * games made with it can be published without a question.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY } from "./library";

const PUBLIC = resolve(__dirname, "../../public");

/** A PNG's width and height, from its header (no canvas in the tests). */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("the free art library", () => {
  it("lists packs, each with sheets", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(4);
    for (const p of LIBRARY) expect(p.sheets.length, p.id).toBeGreaterThan(0);
  });

  it("has every picture it lists, a whole number of cells across and down", () => {
    for (const p of LIBRARY) {
      expect(existsSync(resolve(PUBLIC, p.preview)), p.preview).toBe(true);
      for (const s of p.sheets) {
        const file = resolve(PUBLIC, s.file);
        expect(existsSync(file), s.file).toBe(true);
        const [w, h] = pngSize(file);
        expect(w % s.tileWidth, `${s.file} is ${w} wide`).toBe(0);
        expect(h % s.tileHeight, `${s.file} is ${h} tall`).toBe(0);
      }
    }
  });

  it("carries each pack's licence, and every one is CC0", () => {
    for (const p of LIBRARY) {
      const licence = resolve(PUBLIC, dirname(p.sheets[0]!.file), "License.txt");
      expect(existsSync(licence), licence).toBe(true);
      // In Kenney's words, or (older packs, like Space Shooter Redux) the CC0 deed's own address.
      expect(readFileSync(licence, "utf8")).toMatch(/Creative Commons Zero, CC0|creativecommons\.org\/publicdomain\/zero\/1\.0/);
      expect(p.licence).toMatch(/CC0/);
    }
  });
});
