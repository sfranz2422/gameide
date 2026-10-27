/**
 * The tutorial series (series.ts) worked through as a student would: each
 * lesson from its own starter, each step's edits made, and then —
 *
 *   - every ```python block the step shows is in the game's code (so the
 *     words and the edits that build the next lesson's starter agree), and
 *   - every one of the step's checks passes, the ones that play the game
 *     in the real Pyodide.
 *
 * So a student who does what a step says is never locked on it, and the
 * next lesson opens on the game this one made.
 *
 * Starter sprites are painted on a canvas, which node hasn't got: here
 * they're empty pictures with their real sizes, which is all collisions need.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame, checkProject, readCheck } from "../checks/checks";
import { TUTORIAL_STARTERS } from "../store/templates";
import { nodeRunner } from "./nodeRunner";
import { applyEdit, SERIES } from "./series";
import { parseTutorial } from "./tutorial";

vi.mock("../store/starterArt", async (original) => ({
  ...(await original<typeof import("../store/starterArt")>()),
  paintStarter: async () => [],
}));

const DIR = join(__dirname, "../../public/tutorials");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; starter: string }[];

/** A block's lines, without their indentation or blank lines. */
const lines = (code: string) => code.split("\n").map((l) => l.trim()).filter(Boolean);
/** Is `block` a run of whole lines somewhere in `code`, whatever the indentation? */
function contains(code: string, block: string) {
  const c = lines(code), b = lines(block);
  for (let i = 0; i + b.length <= c.length; i++) if (b.every((l, j) => c[i + j] === l)) return true;
  return false;
}

describe("tutorial series", () => {
  for (const series of SERIES) {
    it(`${series.name}: every lesson is listed, in order, starting from the lesson before`, () => {
      series.lessons.forEach((l, n) => {
        expect(index.find((t) => t.key === l.key)?.starter, l.key).toBe(`${series.name}-${n}`);
        expect(parseTutorial(readFileSync(join(DIR, `${l.key}.md`), "utf8")).meta.starter, l.key).toBe(`${series.name}-${n}`);
      });
    });

    series.lessons.forEach((lesson, n) => {
      it(`${lesson.key}: doing what each step says passes its checks`, { timeout: 180_000 }, async () => {
        const t = parseTutorial(readFileSync(join(DIR, `${lesson.key}.md`), "utf8"));
        const { project } = await TUTORIAL_STARTERS[`${series.name}-${n}`]!();
        const runner = nodeRunner(() => project);
        for (const [s, step] of t.steps.entries()) {
          const edit = lesson.edits[s];
          if (edit) applyEdit(project, edit);
          const code = [...project.objects.flatMap((o) => o.events.map((e) => e.code)), ...project.scripts.map((x) => x.code)].join("\n\n");
          for (const block of [...step.md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!))
            expect(contains(code, block), `${lesson.key} step ${s + 1} shows code the game doesn't have:\n${block}`).toBe(true);
          for (const c of step.checks) {
            const check = readCheck(c.label);
            expect(check.kind, `${lesson.key} step ${s + 1}: ${c.label}`).not.toBe("unknown");
            const r = checkProject(project, check) ?? (await checkGame(runner, check));
            expect(r, `${lesson.key} step ${s + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
          }
        }
        // A step that edits must exist, or its edits never reach the lessons after it.
        for (const s of Object.keys(lesson.edits).map(Number)) expect(s, `${lesson.key} edits step ${s + 1}`).toBeLessThan(t.steps.length);
      });
    });
  }
});
