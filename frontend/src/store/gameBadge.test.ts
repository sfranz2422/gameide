import { describe, expect, it } from "vitest";
import { BADGE_SIZE, gameBadge } from "./gameBadge";

describe("a game's badge on My Games", () => {
  it("is the same every time for one game", () => {
    expect(gameBadge("abc123")).toEqual(gameBadge("abc123"));
  });
  it("differs between games", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `game${i}`);
    const shapes = new Set(ids.map((id) => JSON.stringify(gameBadge(id).cells)));
    const colours = new Set(ids.map((id) => gameBadge(id).body));
    expect(shapes.size).toBeGreaterThan(45);
    expect(colours.size).toBeGreaterThan(30);
  });
  it("is mirrored left to right, like a sprite, and never blank", () => {
    for (const id of ["a", "b", "zz", "Q9x", ""]) {
      const { cells } = gameBadge(id);
      expect(cells).toHaveLength(BADGE_SIZE);
      for (const row of cells) expect(row).toEqual([...row].reverse());
      expect(cells.flat().some((c) => c > 0)).toBe(true);
    }
  });
});
