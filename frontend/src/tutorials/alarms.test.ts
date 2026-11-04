/**
 * The Alarms lesson done step by step from its starter, as a careful student
 * would, with the code taken from its own ```python blocks, and each step's
 * checks run in the real Pyodide. Then what the lesson says about alarms, held
 * against the engine: a lesson explaining something must be right about it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame, checkProject, readCheck } from "../checks/checks";
import { load, py, run } from "../python/testkit";
import { TUTORIAL_STARTERS } from "../store/templates";
import { nodeRunner } from "./nodeRunner";
import { applyEdit, type Edit } from "./series";
import { parseTutorial } from "./tutorial";

vi.mock("../store/starterArt", async (original) => ({
  ...(await original<typeof import("../store/starterArt")>()),
  paintStarter: async () => [],
}));

const blocks = (md: string) => [...md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);

describe("the Alarms lesson", () => {
  it("alarms: doing what each step says passes its checks", { timeout: 180_000 }, async () => {
    const t = parseTutorial(readFileSync(join(__dirname, "../../public/tutorials/alarms.md"), "utf8"));
    const { project } = await TUTORIAL_STARTERS["coins-start"]!();
    const room = project.rooms[0]!.name;
    const runner = nodeRunner(() => project);
    const steps: Record<number, (b: string[]) => Edit> = {
      1: (b) => ({
        objects: [{ name: "Clock", sprite: null }],
        place: [{ object: "Clock", x: 0, y: 0, room }],
        code: { "Clock.create": b[0]!, "Clock.draw_gui": b[1]!, "Clock.alarm 0": b[2]! },
      }),
      2: (b) => ({
        code: {
          "Clock.create": blocks(t.steps[1]!.md)[0]! + b[0]!,
          "Clock.alarm 1": b[1]!,
          "Clock.draw_gui": blocks(t.steps[1]!.md)[1]! + b[2]!,
        },
      }),
      4: (b) => ({ code: { "Coin.create": b[0]!, "Coin.alarm 0": b[1]! } }),
      5: (b) => ({ code: { "Clock.step": b[0]! } }),
    };
    for (const [s, step] of t.steps.entries()) {
      if (steps[s]) applyEdit(project, steps[s]!(blocks(step.md)));
      for (const c of step.checks) {
        const check = readCheck(c.label);
        expect(check.kind, `step ${s + 1}: ${c.label}`).not.toBe("unknown");
        const r = checkProject(project, check) ?? (await checkGame(runner, check));
        expect(r, `step ${s + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
      }
    }
  });

  it("what the lesson says about alarms is what they do", async () => {
    const { game: g } = await load({
      code: {
        A: `class A(GameObject):
    def on_create(self):
        self.rang = 0
        self.alarm[2] = 3
    def on_alarm_2(self):
        self.rang += 1
`,
      },
      instances: [{ object: "A", x: 0, y: 0 }],
    });
    const a = "instances('A')[0]";
    // Runs once, and reads -1 afterwards.
    run(g, 10);
    expect(py(g, `${a}.rang`)).toBe(1);
    expect(py(g, `${a}.alarm[2]`)).toBe(-1);
    // Reading gives the steps left.
    py(g, `${a}.alarm[2] = 30`);
    run(g, 5);
    expect(py(g, `${a}.alarm[2]`)).toBe(25);
    // -1 cancels.
    py(g, `${a}.alarm[2] = -1`);
    run(g, 40);
    expect(py(g, `${a}.rang`)).toBe(1);
    // 0 runs nothing.
    py(g, `${a}.alarm[2] = 0`);
    run(g, 5);
    expect(py(g, `${a}.rang`)).toBe(1);
    // It waits while the game is paused.
    py(g, `${a}.alarm[2] = 3; game_pause()`);
    run(g, 10);
    expect(py(g, `${a}.rang`)).toBe(1);
    py(g, "game_pause(False)");
    run(g, 5);
    expect(py(g, `${a}.rang`)).toBe(2);
    // Set every step, it never runs: the lesson's "mistake everybody makes".
    for (let i = 0; i < 90; i++) {
      py(g, `${a}.alarm[2] = 60`);
      run(g, 1);
    }
    expect(py(g, `${a}.rang`)).toBe(2);
    // Twelve of them, and the thirteenth says so.
    expect(() => py(g, `${a}.alarm[12] = 5`)).toThrow(/0 to 11/);
    py(g, `${a}.alarm[11] = 5`);
  });
});
