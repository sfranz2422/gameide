import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TUTORIAL_STARTERS } from "../store/templates";
import { isTutorial, parseTutorial, splitHeader, TARGETS, tutorialProblems } from "./tutorial";
import cases from "../notes/parse-cases.json";

const DIR = join(__dirname, "../../public/tutorials");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; title: string; level: string; starter: string }[];

describe("tutorials", () => {
  it("are read: a header, then one step per --- slide, each with its checks and spotlight", () => {
    const t = parseTutorial("---\ntitle: T\nlevel: Platformers\nstarter: coins-start\n---\n# One\nhighlight: play\nPress it.\n---\n## Two\n```check\nobject Player exists\n```\n");
    expect(t.meta).toMatchObject({ title: "T", level: "Platformers", starter: "coins-start", locked: true });
    expect(t.steps.map((s) => s.title)).toEqual(["One", "Two"]);
    expect(t.steps[0]!.highlight).toBe("play");
    expect(t.steps[0]!.md).not.toContain("highlight:");
    expect(t.steps[1]!.checks).toEqual([{ label: "object Player exists", points: 1 }]);
    expect(splitHeader("---\ntitle: x\nlocked: no\n---\nhi").meta.locked).toBe(false);
    expect(isTutorial("# just notes")).toBe(false);
  });
  it("count their steps as the server does (the shared cases)", () => {
    for (const c of cases.tutorials) {
      const t = parseTutorial(c.body);
      expect({ steps: t.steps.length, tutorial: isTutorial(c.body), title: c.expect.tutorial ? t.meta.title : c.expect.title }).toEqual(c.expect);
    }
  });
  it("say what's wrong with one: unreadable checks, spotlights on nothing", () => {
    const t = parseTutorial("---\ntitle: T\n---\n# A\nhighlight: nowhere\n```check\nmake it good\n```");
    expect(tutorialProblems(t, TARGETS)).toEqual([
      'Step 1: GameIDE can\'t read the check "make it good".',
      'Step 1: there\'s nothing called "nowhere" to highlight.',
    ]);
  });

  it("every built-in one is listed, reads cleanly, and starts from a game that exists", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
    expect(index.map((t) => t.key).sort()).toEqual(files);
    for (const entry of index) {
      const md = readFileSync(join(DIR, `${entry.key}.md`), "utf8");
      const t = parseTutorial(md);
      expect(isTutorial(md), entry.key).toBe(true);
      expect(t.meta.title, entry.key).toBe(entry.title);
      expect(t.steps.length, entry.key).toBeGreaterThanOrEqual(4);
      expect(tutorialProblems(t, TARGETS), entry.key).toEqual([]);
      expect(Object.keys(TUTORIAL_STARTERS), entry.key).toContain(t.meta.starter);
      // Code is shown to type, never handed over.
      expect(md, entry.key).not.toMatch(/copy/i);
    }
  });

  it("every spotlight target is still in the editor", () => {
    const src: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        if (f.isDirectory()) walk(join(dir, f.name));
        else if (f.name.endsWith(".tsx") || f.name.endsWith(".ts")) src.push(readFileSync(join(dir, f.name), "utf8"));
      }
    };
    walk(join(__dirname, ".."));
    const all = src.join("\n");
    for (const t of TARGETS) {
      if (t.endsWith("*")) expect(all, t).toContain(`data-tutorial={\`${t.slice(0, -1)}`);
      else if (t === "game-canvas") expect(all, t).toContain('dataset.tutorial = "game-canvas"');
      // The folders' are made in a loop, one per kind of resource (ResourceTree's FOLDERS).
      else if (t.startsWith("folder-")) {
        expect(all, t).toContain("data-tutorial={`folder-${f.kind}`}");
        expect(all, t).toContain(`kind: "${t.slice("folder-".length)}"`);
      }
      else expect(all, t).toContain(`data-tutorial="${t}"`);
    }
  });
});
