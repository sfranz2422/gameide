/**
 * A week's questions on their way to the server: each ```python predict block
 * run by the page and turned into the ```quiz block it amounts to.
 */
import { describe, expect, it } from "vitest";
import { hasPredicts, predictCode, predictsToQuiz, type Run } from "./bank";

const prints = (output: string): Run => async () => ({ output });

describe("predict blocks in a bank", () => {
  it("a block becomes a question whose answer is what it printed", async () => {
    const seen: string[] = [];
    const run: Run = async (code) => {
      seen.push(code);
      return { output: "0\n2\n4\n" };
    };
    const { markdown, problems } = await predictsToQuiz("# Week\n```python predict\nfor i in range(3):\n    print(i * 2)\n```\nAfter", run);
    expect(problems).toEqual([]);
    expect(seen).toEqual(["for i in range(3):\n    print(i * 2)"]);
    expect(markdown).toBe(["# Week", "```quiz", "type: predict", "What will this print?", "~~~python", "for i in range(3):", "    print(i * 2)", "~~~", "answer: 0 2 4", "```", "After"].join("\n"));
  });

  it("a hint isn't part of what runs, as the other editors read a block", async () => {
    expect(predictCode(["print(1)", "# hint: think about it", "print(2)", ""])).toBe("print(1)\nprint(2)");
    const { markdown } = await predictsToQuiz("```py predict\nprint(1)\n# hint: one\n```", prints("1"));
    expect(markdown).not.toContain("hint");
  });

  it("every ```python and ~~~ form is found, and other blocks are left alone", async () => {
    expect(hasPredicts("```python predict\nx\n```")).toBe(true);
    expect(hasPredicts("~~~ py predict\nx\n~~~")).toBe(true);
    expect(hasPredicts("```python\nx\n```")).toBe(false);
    expect(hasPredicts("```html predict\nx\n```")).toBe(false);
    const quiz = "```quiz\nWhy?\nanswer: because\n```\n```html predict\n<p>x</p>\n```";
    expect((await predictsToQuiz(quiz, prints("never"))).markdown).toBe(quiz);
  });

  it("one that won't run, or prints nothing, is a problem with its line, and the rest still go through", async () => {
    const r = await predictsToQuiz("one\n```python predict\nboom\n```\n```python predict\nquiet\n```\n```python predict\nok\n```", async (code) =>
      code === "boom" ? { error: "it stopped with an error: NameError" } : code === "quiet" ? { output: "  \n" } : { output: "ok" });
    expect(r.problems).toEqual([
      "Line 2: this predict block can't be used: it stopped with an error: NameError",
      "Line 5: this predict block doesn't print anything, so there's nothing to predict.",
    ]);
    expect(r.markdown).toContain("answer: ok");
    expect(r.markdown).not.toContain("boom");
  });

  it("a file's Windows line endings don't hide a block", async () => {
    expect((await predictsToQuiz("```python predict\r\nprint(1)\r\n```\r\n", prints("1"))).markdown).toContain("answer: 1");
  });
});
