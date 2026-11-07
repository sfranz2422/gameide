/**
 * question_ok and question_waiting: a showcase game says when stopping for a
 * Python check question would be fair, and can tell one is waiting. The page's
 * side (waiting for the moment, and the limit) is in GameHost; e2e/pycheck holds both.
 */
import { describe, expect, it } from "vitest";
import { load, py, run } from "./testkit";

const game = () =>
  load({
    code: {
      P: `class P(GameObject):
    def on_step(self):
        question_ok(not getattr(global_vars, "flying", False))
        global_vars.saw = question_waiting()
`,
    },
    instances: [{ object: "P", x: 10, y: 10 }],
  });

describe("question_ok and question_waiting", () => {
  it("a game that never says anything is always ready, and tells the page nothing", async () => {
    const { game: g, questionOks } = await load({ code: { Q: "class Q(GameObject):\n    pass\n" }, instances: [{ object: "Q", x: 0, y: 0 }] });
    run(g, 5);
    expect(questionOks).toEqual([]);
  });

  it("only a change goes to the page", async () => {
    const { game: g, questionOks } = await game();
    run(g, 3);
    expect(questionOks).toEqual([]);
    py(g, "global_vars.flying = True");
    run(g, 5);
    expect(questionOks).toEqual([false]);
    py(g, "global_vars.flying = False");
    run(g, 5);
    expect(questionOks).toEqual([false, true]);
  });

  it("question_waiting is what the page last said, from the next step", async () => {
    const { game: g } = await game();
    run(g, 2);
    expect(py(g, "global_vars.saw")).toBe(false);
    g.setQuestionWaiting(true);
    run(g, 1);
    expect(py(g, "global_vars.saw")).toBe(true);
    run(g, 5);
    expect(py(g, "global_vars.saw")).toBe(true);
    g.setQuestionWaiting(false);
    run(g, 1);
    expect(py(g, "global_vars.saw")).toBe(false);
  });
});
