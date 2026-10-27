/**
 * The Python Basics lessons (public/tutorials/py-*.md), worked through as a
 * careful student would: at each step, the code the step shows is typed
 * into Main's Create event under what's there, then the step's own checks
 * run — in the real Pyodide, on a game built from the project exactly as
 * Play builds it — and every one must pass.
 *
 * Without this, a lesson whose check can't be passed by doing what it says
 * (a typo in a "prints" line, a check on the wrong event) locks a student
 * on that step with Next greyed out, and nobody notices until a class is
 * stuck on it.
 *
 * Steps that show a mistake to make on purpose are typed without it, and
 * the "Your turn" steps are given an answer (ANSWERS), as a student would.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkGame, checkProject, printedOk, readCheck, type GameRunner } from "../checks/checks";
import { KEY_CODE } from "../engine/input";
import { PythonGame } from "../python/bridge";
import { buildGame } from "../python/codegen";
import type { Project } from "../store/project";
import { TUTORIAL_STARTERS } from "../store/templates";
import { parseTutorial } from "./tutorial";

const DIR = join(__dirname, "../../public/tutorials");

/** A GameRunner on a PythonGame in node: steps() runs the game a few steps each time it's asked. */
function nodeRunner(project: () => Project): GameRunner {
  let game: PythonGame | null = null;
  let errors: string[] = [];
  return {
    stepsPerSecond: 60,
    async steps() {
      if (!game) return 0;
      for (let i = 0; i < 10 && !game.isStopped; i++) {
        const e = game.step();
        if (e) errors.push(e.message);
      }
      return Number(game.evalPython("__import__('gameide')._step_count"));
    },
    async start() {
      errors = [];
      const { game: g, error } = await PythonGame.load(buildGame(project(), new Map()).def);
      if (error) throw new Error(`The game stopped with an error: ${error.message}`);
      game = g;
    },
    stop() {
      game?.dispose();
      game = null;
    },
    hold(key, down) {
      const code = KEY_CODE.get(key)!;
      if (down) game!.engine.input.keyDown(code);
      else game!.engine.input.keyUp(code);
    },
    async py(expr) {
      try {
        return game!.evalPython(expr);
      } catch (e) {
        return { error: String(e) };
      }
    },
    errors: () => [...errors],
  };
}

/** Code blocks a step shows, in order. */
const blocksOf = (md: string) => [...md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);

/** What a student types for each "Your turn", by lesson and step number (from 0). */
const ANSWERS: Record<string, Record<number, string>> = {
  "py-text": { 5: 'food = "pizza"\ncount = 4\nprint(f"I could eat {count} {food}s")\n' },
  "py-decisions": { 6: 'age = 12\nif age >= 13:\n    print("You\'re a teenager")\nelse:\n    print("You\'re not a teenager yet")\n' },
  "py-loops": { 6: 'for n in range(1, 11):\n    print(f"7 x {n} = {7 * n}")\n' },
  "py-functions": { 5: "def bigger(a, b):\n    if a > b:\n        return a\n    return b\n" },
};
/** Blocks NOT to type: the ones that show a mistake (lesson → step → block numbers). */
const SKIP: Record<string, Record<number, number[]>> = {
  "py-text": { 3: [0] }, // "Score: " + 12, the error the step is about
};

/** Lesson 9 types into three events, and changes a line: what each event holds after each step. */
const GAME_STEPS: Record<number, Partial<Record<"create" | "draw" | "step", string>>> = {
  1: { draw: 'draw_set_color("yellow")\ndraw_circle(320, 240, 50)\n' },
  2: { draw: 'draw_set_color("yellow")\ndraw_circle(320, 240, 50)\nfor i in range(10):\n    draw_circle(40 + i * 64, 400, 20)\n' },
  3: {
    create: "self.size = 50\n",
    draw: 'draw_set_color("yellow")\ndraw_circle(320, 240, self.size)\nfor i in range(10):\n    draw_circle(40 + i * 64, 400, 20)\n',
  },
  4: { step: 'if keyboard_check("up"):\n    self.size += 2\nif keyboard_check("down") and self.size > 5:\n    self.size -= 2\n' },
  5: {
    draw: 'if self.size > 100:\n    draw_set_color("red")\nelse:\n    draw_set_color("yellow")\ndraw_circle(320, 240, self.size)\nfor i in range(10):\n    draw_circle(40 + i * 64, 400, 20)\n',
  },
};

const LESSONS = (JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; level: string }[])
  .filter((t) => t.level === "Python Basics")
  .map((t) => t.key);

describe("the prints check", () => {
  it("ignores capitals and spacing, and says what was printed instead", () => {
    expect(readCheck("prints Hello, world!")).toEqual({ kind: "prints", text: "Hello, world!" });
    expect(printedOk("hello,   World!\n", "Hello, world!")).toEqual({ ok: true, detail: "" });
    expect(printedOk("Helo, world\n", "Hello, world!")).toEqual({ ok: false, detail: 'It printed "Helo, world", not "Hello, world!".' });
    expect(printedOk("", "Hi")).toEqual({ ok: false, detail: 'Nothing was printed yet. It should print "Hi".' });
  });
});

describe("Python Basics", () => {
  it("is nine lessons, numbered in order", () => {
    expect(LESSONS).toEqual(["py-hello", "py-variables", "py-maths", "py-text", "py-decisions", "py-loops", "py-lists", "py-functions", "py-game"]);
    LESSONS.forEach((k, i) => expect(parseTutorial(readFileSync(join(DIR, `${k}.md`), "utf8")).meta.title.startsWith(`${i + 1}. `), k).toBe(true));
  });

  for (const key of LESSONS) {
    it(`${key}: doing what each step says passes its checks`, { timeout: 120_000 }, async () => {
      const t = parseTutorial(readFileSync(join(DIR, `${key}.md`), "utf8"));
      const { project } = await TUTORIAL_STARTERS[t.meta.starter]!();
      const main = project.objects.find((o) => o.name === "Main")!;
      const event = (type: "create" | "draw" | "step") => {
        let e = main.events.find((x) => x.key.type === type);
        if (!e) main.events.push((e = { id: `e-${type}`, key: { type }, mode: "python", code: "" }));
        return e;
      };
      const runner = nodeRunner(() => project);
      for (const [n, step] of t.steps.entries()) {
        if (key === "py-game") {
          for (const [type, code] of Object.entries(GAME_STEPS[n] ?? {})) event(type as "create").code = code!;
        } else {
          const typed = blocksOf(step.md).filter((_, b) => !SKIP[key]?.[n]?.includes(b));
          event("create").code += (ANSWERS[key]?.[n] ?? "") + typed.join("");
        }
        for (const c of step.checks) {
          const check = readCheck(c.label);
          expect(check.kind, `${key} step ${n + 1}: ${c.label}`).not.toBe("unknown");
          const r = checkProject(project, check) ?? (await checkGame(runner, check));
          expect(r, `${key} step ${n + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
        }
      }
    });
  }
});
