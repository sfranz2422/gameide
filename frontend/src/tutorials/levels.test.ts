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
import { LEVELS_ART, LEVELS_CREATE, LEVELS_GAP, LEVELS_STEP, LEVELS_STEP_5, TUTORIAL_STARTERS } from "../store/templates";
import { LIBRARY } from "../library/library";
import { LEVELS, parseTutorial } from "./tutorial";

const DIR = join(__dirname, "../../public/tutorials");
const lesson = (key: string) => readFileSync(join(DIR, `${key}.md`), "utf8");
const python = (md: string) => [...md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);

describe("Building Levels", () => {
  it("has a starter for each lesson, each lesson's the one before it done", () => {
    const keys = ["lv-library", "lv-tileset", "lv-painting", "lv-walking", "lv-bigger-world", "lv-physics"];
    keys.forEach((k, n) => expect(parseTutorial(lesson(k)).meta.starter, k).toBe(`levels-${n}`));
    for (let n = 0; n < keys.length; n++) expect(Object.keys(TUTORIAL_STARTERS)).toContain(`levels-${n}`);
  });

  it("lesson 4 ends with exactly the code lesson 5 opens with", () => {
    const blocks = python(lesson("lv-walking"));
    expect(blocks[0]).toBe(LEVELS_CREATE);
    expect(blocks[blocks.length - 1]).toBe(LEVELS_STEP);
  });

  it("lesson 6 opens with lesson 5 done: its restart line, its gap and its camera", () => {
    // Lesson 5 has the student add these lines to the end of lesson 4's Step event.
    const added = python(lesson("lv-bigger-world"));
    expect(added).toHaveLength(1);
    expect(LEVELS_STEP_5).toBe(LEVELS_STEP + added[0]);
    // The gap it has them erase: "three or four tiles wide".
    expect(LEVELS_GAP.length).toBeGreaterThanOrEqual(3);
    expect(LEVELS_GAP.length).toBeLessThanOrEqual(4);
    expect(lesson("lv-bigger-world")).toContain("**1920**");
  });

  it("lesson 4 says why its hero isn't physics, and names the lesson that is", () => {
    expect(lesson("lv-walking")).toContain("**Why not physics?**");
    expect(lesson("lv-walking")).toContain(`**${parseTutorial(lesson("lv-physics")).meta.title}**`);
  });

  it("lesson 6 tells the hero's push to go where lesson 4's walking line is", () => {
    // "just under `move_and_collide(move * 3, 0)`": that line must be in the Step event it opens with.
    expect(lesson("lv-physics")).toContain("just under `move_and_collide(move * 3, 0)`");
    expect(LEVELS_STEP_5.split("\n")).toContain("move_and_collide(move * 3, 0)");
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
    // Then making art work: their own sheets, slicing, autotiling, a town (2026-10-30).
    expect(LEVELS[2]).toBe("Art and Tiles");
  });
  it("put a tutorial that names no shelf on Getting Started, not Python Basics", () => {
    expect(parseTutorial("---\ntitle: T\n---\n# A\nhi").meta.level).toBe("Getting Started");
  });
});
