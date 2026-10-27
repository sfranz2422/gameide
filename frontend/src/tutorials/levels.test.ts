/**
 * The Building Levels lessons (public/tutorials/lv-*.md) against their
 * starters (store/templates.ts, levelsStart): a lesson's starter is the
 * lessons before it done, so the code lesson 4 has the student type must be
 * the code lesson 5 opens with, and the art the lessons name must be the art
 * the starters use. The starters fetch the library's pictures, so they run
 * in a browser: e2e/levels.editor.spec.ts does every lesson, step by step.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEVELS_ART, LEVELS_CREATE, LEVELS_STEP, TUTORIAL_STARTERS } from "../store/templates";
import { LIBRARY } from "../library/library";
import { LEVELS, parseTutorial } from "./tutorial";

const DIR = join(__dirname, "../../public/tutorials");
const lesson = (key: string) => readFileSync(join(DIR, `${key}.md`), "utf8");
const python = (md: string) => [...md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);

describe("Building Levels", () => {
  it("has a starter for each lesson, each lesson's the one before it done", () => {
    const keys = ["lv-library", "lv-tileset", "lv-painting", "lv-walking", "lv-bigger-world"];
    keys.forEach((k, n) => expect(parseTutorial(lesson(k)).meta.starter, k).toBe(`levels-${n}`));
    for (let n = 0; n < keys.length; n++) expect(Object.keys(TUTORIAL_STARTERS)).toContain(`levels-${n}`);
  });

  it("lesson 4 ends with exactly the code lesson 5 opens with", () => {
    const blocks = python(lesson("lv-walking"));
    expect(blocks[0]).toBe(LEVELS_CREATE);
    expect(blocks[blocks.length - 1]).toBe(LEVELS_STEP);
  });

  it("the art the lessons name is the art the starters use", () => {
    const pack = LIBRARY.find((p) => p.id === LEVELS_ART.pack)!;
    expect(pack.name).toBe("Pixel Platformer");
    expect(lesson("lv-library")).toContain("**Pixel Platformer**");
    // Two frames of Characters; eight solid tiles (four grass, four dirt).
    expect(LEVELS_ART.hero).toEqual([0, 1]);
    expect(lesson("lv-library")).toMatch(/Add as a sprite \(2 frames\)/);
    expect(LEVELS_ART.solid).toHaveLength(8);
    expect(lesson("lv-tileset")).toMatch(/four grass blocks.*four plain dirt squares/s);
    // The tile sizes the lesson quotes are the sheet's.
    const tiles = pack.sheets.find((s) => s.name === "Tiles")!;
    expect(lesson("lv-tileset")).toContain(`**${tiles.tileWidth} × ${tiles.tileHeight}**`);
  });
});

describe("the shelves", () => {
  it("start with Python Basics: every game lesson is written in Python", () => {
    expect(LEVELS[0]).toBe("Python Basics");
    expect(LEVELS[1]).toBe("Getting Started");
  });
  it("put a tutorial that names no shelf on Getting Started, not Python Basics", () => {
    expect(parseTutorial("---\ntitle: T\n---\n# A\nhi").meta.level).toBe("Getting Started");
  });
});
