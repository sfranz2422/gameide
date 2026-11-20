/**
 * The "Now You Can Make" tutorials (public/tutorials/make-*.md) done step by
 * step from an empty game, as a careful student would: each step's edits
 * made (with the code taken from that step's own ```python blocks, put
 * where its words say), and then —
 *
 *   - every block the step shows is in the game's code,
 *   - the step's checks didn't all pass before it (a check that passes on
 *     its own teaches nothing), and
 *   - every one of them passes after it, the ones that play the game in the
 *     real Pyodide.
 *
 * Starter sprites are painted on a canvas, which node hasn't got: here
 * they're empty pictures with their real sizes, which is all collisions need.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame, checkProject, readCheck, type Check } from "../checks/checks";
import { addStarterSprite, TUTORIAL_STARTERS } from "../store/templates";
import type { Project } from "../store/project";
import { nodeRunner } from "./nodeRunner";
import { PythonGame } from "../python/bridge";
import { buildGame } from "../python/codegen";
import { applyEdit } from "./series";
import { MAKE_LEVEL, parseTutorial, type Step } from "./tutorial";

vi.mock("../store/starterArt", async (original) => ({
  ...(await original<typeof import("../store/starterArt")>()),
  paintStarter: async () => [],
}));

const DIR = join(__dirname, "../../public/tutorials");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; level: string; after?: string; starter: string }[];

/** The step's ```python blocks, in order. */
const blocks = (step: Step) => [...step.md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);
const lines = (code: string) => code.split("\n").map((l) => l.trim()).filter(Boolean);
function contains(code: string, block: string) {
  const c = lines(code), b = lines(block);
  for (let i = 0; i + b.length <= c.length; i++) if (b.every((l, j) => c[i + j] === l)) return true;
  return false;
}

import { step, type Play, type Steps } from "./makes/kit";



/** An event's code in the game so far ("Object.event", as Edit names them), "" if there's none. */
function codeOf(p: Project, where: string) {
  const [name, ev] = [where.slice(0, where.indexOf(".")), where.slice(where.indexOf(".") + 1)];
  const obj = p.objects.find((o) => o.name === name);
  const [type, arg] = ev.split(" ");
  const e = obj?.events.find((x) =>
    x.key.type === type &&
    (type !== "alarm" || (x.key as { n: number }).n === Number(arg)) &&
    (type !== "collision" || (x.key as { object: string }).object === p.objects.find((o) => o.name === arg)?.id));
  return e?.code ?? "";
}

async function passes(p: Project, runner: ReturnType<typeof nodeRunner>, check: Check) {
  const quick = checkProject(p, check);
  if (quick) return quick.ok;
  try {
    return (await checkGame(runner, check)).ok;
  } catch {
    return false;
  }
}

/**
 * Each lesson's replay is a file of its own, makes/make-*.ts (2026-11-20: every lesson is an
 * open one, replayed as a student who chose differently from its examples): `steps`, and
 * `play` if the finished game has a play-check. Read from the folder, not import.meta.glob:
 * Vitest's module cache kept the glob's list from when the test file last changed, and a new
 * lesson's file was silently skipped while its old entry ran.
 */
const MAKES: Record<string, Steps> = {};
const PLAYS: Record<string, Play> = {};
for (const file of readdirSync(join(__dirname, "makes")).filter((f) => /^make-[a-z-]+\.ts$/.test(f)).sort()) {
  const m = (await import(`./makes/${file}`)) as { steps: Steps; play?: Play };
  const key = file.replace(/\.ts$/, "");
  MAKES[key] = m.steps;
  if (m.play) PLAYS[key] = m.play;
}

describe("Now You Can Make", () => {
  it("every one is listed after a lesson (or a shelf) that's on the Learn page, and starts from an empty game", () => {
    const makes = index.filter((t) => t.level === MAKE_LEVEL);
    expect(makes.map((t) => t.key).sort()).toEqual(Object.keys(MAKES).sort());
    const lessons = index.filter((t) => t.level !== MAKE_LEVEL);
    const places = new Set([...lessons.map((t) => t.level), ...lessons.map((t) => t.key)]);
    for (const t of makes) {
      expect(places.has(t.after ?? ""), `${t.key} comes after "${t.after}"`).toBe(true);
      const meta = parseTutorial(readFileSync(join(DIR, `${t.key}.md`), "utf8")).meta;
      expect(meta.after, t.key).toBe(t.after);
      expect(meta.starter, t.key).toBe("empty");
    }
  });

  for (const [key, steps] of Object.entries(MAKES)) {
    it(`${key}: doing what each step says passes its checks, and they didn't pass before`, { timeout: 300_000 }, async () => {
      const t = parseTutorial(readFileSync(join(DIR, `${key}.md`), "utf8"));
      const { project } = await TUTORIAL_STARTERS.empty!();
      const runner = nodeRunner(() => project);
      for (const [s, step] of t.steps.entries()) {
        const checks = step.checks.map((c) => ({ label: c.label, check: readCheck(c.label) }));
        for (const c of checks) expect(c.check.kind, `${key} step ${s + 1}: ${c.label}`).not.toBe("unknown");
        const real = checks.filter((c) => c.check.kind !== "runs");
        if (real.length) {
          const before = await Promise.all(real.map((c) => passes(project, runner, c.check)));
          expect(before.every(Boolean), `${key} step ${s + 1} "${step.title}" passes before it's done`).toBe(false);
        }
        const make = steps[s];
        let adapt = (b: string, _i: number) => b;
        if (make) {
          const edit = make(blocks(step), (where) => codeOf(project, where));
          adapt = edit.adapt ?? adapt;
          for (const sprite of edit.sprites ?? []) await addStarterSprite(project, new Map(), sprite);
          for (const [starter, name] of edit.named ?? []) await addStarterSprite(project, new Map(), starter, name);
          applyEdit(project, edit);
          edit.also?.(project);
        }
        const code = [...project.objects.flatMap((o) => o.events.map((e) => e.code)), ...project.scripts.map((x) => x.code)].join("\n\n");
        for (const block of blocks(step).map((b, i) => adapt(b, i))) expect(contains(code, block), `${key} step ${s + 1} shows code the game doesn't have:\n${block}`).toBe(true);
        for (const c of checks) {
          const r = checkProject(project, c.check) ?? (await checkGame(runner, c.check));
          expect(r, `${key} step ${s + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
        }
      }
      runner.stop();
      const play = PLAYS[key];
      if (play) {
        const { game, error } = await PythonGame.load(buildGame(project, new Map()).def);
        if (error) throw new Error(error.message);
        step(game, 2);
        play(game);
        game.dispose();
      }
    });
  }
});
