import { describe, expect, it } from "vitest";
import cases from "./parse-cases.json";
import { parseCards, parseQuiz, pieces, popBoxes, popMarks, scramble, sections, slides, takeAnimate } from "./quiz";
import { checkGame, checkProject, parseTests, readCheck, runTests, allTests, type GameRunner } from "../checks/checks";
import { blankProject, newEvent, newObject, newRoom, newInstance } from "../store/project";
import { ANIMATED, CHECK_EXAMPLES } from "./HelpPage";

describe("questions and tests are read as the server reads them", () => {
  it("every question case reads the same as quiz.py", () => {
    for (const c of cases.quiz) {
      const q = parseQuiz(c.body);
      expect({ id: q.id, kind: q.kind, prompt: q.prompt, choices: q.choices, correct: q.correct, answers: q.answers, options: q.options, points: q.points }).toEqual(c.expect);
    }
  });
  it("every tests case reads the same as checks.py", () => {
    for (const c of cases.tests) expect(parseTests(c.body)).toEqual(c.expect);
  });
});

describe("notes", () => {
  it("are cut into slides at --- lines, never inside code", () => {
    expect(slides("# One\ntext\n---\n## Two\n```\n---\n```\n---\n\n")).toEqual(["# One\ntext", "## Two\n```\n---\n```"]);
    expect(slides("no slides here")).toEqual([]);
  });
  it("split into markdown, questions and tests — an example in a fence is an example", () => {
    const md = "Hi\n```quiz\nQ?\nanswer: a\n```\n````markdown\n```quiz\nnot one\n```\n````\n```tests\nuses for\n```";
    expect(pieces(md).map((p) => p.type)).toEqual(["md", "quiz", "md", "tests"]);
  });
  it("tests in several blocks are listed once each", () => {
    expect(allTests("```tests\nuses for\n```\n```tests\nuses for\nuses if (2 points)\n```")).toEqual([
      { label: "uses for", points: 1 },
      { label: "uses if", points: 2 },
    ]);
  });
});

function game() {
  const p = blankProject("T");
  const player = newObject("Player");
  const step = newEvent({ type: "step" });
  step.code = 'self.x += keyboard_check("right")\n';
  player.events.push(step);
  const coin = newObject("Coin");
  const jumper = newObject("Jumper");
  const jump = newEvent({ type: "step" });
  jump.code = 'if keyboard_check_pressed("space"):\n    self.vy = -8\n';
  jumper.events.push(jump);
  p.objects.push(player, coin, jumper);
  const room = newRoom("Level1");
  room.instances.push(newInstance(room, coin.id, 0, 0), newInstance(room, coin.id, 10, 0), newInstance(room, player.id, 5, 5));
  p.rooms.push(room);
  return p;
}

describe("checks of the project", () => {
  const p = game();
  const run = (line: string) => checkProject(p, readCheck(line));
  it("existence, events, code and counts", () => {
    expect(run("object Player exists")?.ok).toBe(true);
    expect(run("sprite hero exists")).toEqual({ ok: false, detail: "There's no sprite called hero yet." });
    expect(run("Player has event step")?.ok).toBe(true);
    expect(run("Player has event Step")?.ok).toBe(true);
    expect(run("Coin has event step")?.ok).toBe(false);
    expect(run("Player.step uses keyboard_check")?.ok).toBe(true);
    expect(run("Player.step uses keyboard_check_pressed")?.ok).toBe(false);
    expect(run("Player avoids keyboard_check")?.ok).toBe(false);
    expect(run("Jumper uses keyboard_check")?.ok).toBe(false);
    expect(run("Jumper uses keyboard_check_pressed")?.ok).toBe(true);
    expect(run("uses keyboard_check")?.ok).toBe(true);
    expect(run("avoids while")?.ok).toBe(true);
    expect(run("Player.step is written in python")?.ok).toBe(true);
    expect(run("Player.step is written in blocks")).toEqual({ ok: false, detail: "Player's step event is written in Python, not blocks." });
    expect(readCheck("Player.step is in an event sheet")).toMatchObject({ kind: "mode", mode: "sheet" });
    expect(run("room Level1 has 2 Coin")?.ok).toBe(true);
    expect(run("room Level1 has 3 Coin")).toEqual({ ok: false, detail: "Level1 has 2 Coins, not 3." });
    expect(run("room Level1 has at least 1 Coin")?.ok).toBe(true);
    expect(run("Player has sprite")).toEqual({ ok: false, detail: "Player doesn't have a sprite yet." });
  });
  it("a line it can't read fails, saying so", () => {
    expect(run("make it fun")).toEqual({ ok: false, detail: "GameIDE doesn't know this kind of check." });
    expect(readCheck("after 1 second holding rite, Player.x increased").kind).toBe("unknown");
  });
  it("game checks are read, not run here", () => {
    expect(readCheck("after 1 second holding right and up, Player.x increased")).toEqual({
      kind: "after", seconds: 1, hold: ["right", "up"], object: "Player", prop: "x", change: "increased",
    });
    expect(readCheck('after 2 seconds, instance_number("Coin") < 2')).toEqual({ kind: "after-expr", seconds: 2, hold: [], expr: 'instance_number("Coin") < 2' });
    expect(checkProject(p, readCheck("game runs 1 second without errors"))).toBeNull();
  });
});

/** A pretend game: x grows while right is held. */
function fakeRunner(opts: { error?: string; slow?: number } = {}): GameRunner & { held: Set<string> } {
  let x = 0;
  let steps = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const held = new Set<string>();
  return {
    held,
    stepsPerSecond: 60,
    async steps() {
      return steps;
    },
    async start() {
      x = 0;
      steps = 0;
      // One step every `slow` ms: 16 is full speed; more is a busy computer.
      timer = setInterval(() => {
        steps++;
        x += held.has("right") ? 1 : 0;
      }, opts.slow ?? 16);
    },
    stop() {
      if (timer) clearInterval(timer);
    },
    hold(k, down) {
      if (down) held.add(k);
      else held.delete(k);
    },
    async py(expr) {
      return expr.includes('"x"') ? x : expr.startsWith("bool(") ? x > 0 : null;
    },
    errors: () => (opts.error ? [opts.error] : []),
  };
}

describe("checks of the game running", () => {
  it("holding a key, a property changes", async () => {
    expect((await checkGame(fakeRunner(), readCheck("after 0.2 seconds holding right, Player.x increased"))).ok).toBe(true);
    const still = await checkGame(fakeRunner(), readCheck("after 0.2 seconds, Player.x increased"));
    expect(still).toEqual({ ok: false, detail: "Player.x went from 0 to 0." });
  });
  it("a second is a second of the game's steps, however slow the computer", async () => {
    const run = fakeRunner({ slow: 40 }); // two and a half times slower than it should be
    const t0 = performance.now();
    const r = await checkGame(run, readCheck("after 0.25 seconds holding right, Player.x increased"));
    expect(r.ok).toBe(true);
    // 15 steps at 40 ms: about 600 ms of clock for a quarter-second of game.
    expect(performance.now() - t0).toBeGreaterThan(450);
    expect(run.held.size).toBe(0);
  });

  it("an error in the game fails the check, with the error", async () => {
    expect(await checkGame(fakeRunner({ error: "NameError: name 'spead' is not defined" }), readCheck("game runs 0.1 seconds without errors"))).toEqual({
      ok: false,
      detail: "The game stopped with an error: NameError: name 'spead' is not defined",
    });
  });
  it("runs project checks without a game, and says so for game checks", async () => {
    const r = await runTests(parseTests("object Player exists\ngame runs 1 second without errors"), game(), null);
    expect(r.map((x) => x.ok)).toEqual([true, false]);
    expect(r[1]!.detail).toMatch(/can't run here/);
  });
});

describe("the help page", () => {
  it("lists only checks GameIDE can read", () => {
    for (const [line] of CHECK_EXAMPLES) expect(readCheck(line).kind, line).not.toBe("unknown");
  });
});

describe("order, sort and flip cards", () => {
  it("shuffle exactly as quiz.py does, and never into the right order", () => {
    // quiz.py: scramble(["for i in range(QQONE):", "    total += i", "print(total)"])
    expect(scramble(["for i in range(QQONE):", "    total += i", "print(total)"])).toEqual(["    total += i", "print(total)", "for i in range(QQONE):"]);
    expect(scramble(["a", "b"])).not.toEqual(["a", "b"]);
    expect(scramble(["x", "x"])).toEqual(["x", "x"]);
  });
  it("read a cards block a card a line, skipping lines without ->", () => {
    expect(parseCards("- a -> b\nno arrow here\n`len` -> how many")).toEqual([
      { front: "a", back: "b" },
      { front: "`len`", back: "how many" },
    ]);
  });
  it("find a cards block as a piece of its own, but not one inside another fence", () => {
    expect(pieces("Hi\n```cards\na -> b\n```\n~~~\n```cards\n~~~").map((p) => p.type)).toEqual(["md", "cards", "md"]);
  });
});


// Notes played a part at a time (`animate:`; NotesPane, reveal.ts) — the
// same rules as notes.js's takeHeader/sections/popMarks in the other editors.
describe("animate: notes", () => {
  it("takes the animate line off the top, and names how", () => {
    expect(takeAnimate("animate: words\n# Hi")).toEqual({ animate: "words", body: "# Hi" });
    expect(takeAnimate("animate: type\n# Hi").animate).toBe("type");
    expect(takeAnimate("animate: on\n# Hi").animate).toBe("words");
  });
  it("leaves a name it doesn't know in, as text, and only the top line counts", () => {
    expect(takeAnimate("animate: fast\n# Hi")).toEqual({ animate: "", body: "animate: fast\n# Hi" });
    expect(takeAnimate("# Hi\nanimate: words").animate).toBe("");
  });
  it("never changes how many slides there are", () => {
    const deck = "# One\n...\nmore\n---\n# Two";
    expect(slides("animate: words\n" + deck)).toHaveLength(2);
    expect(slides("animate: words\n" + deck)[0]).not.toContain("animate");
    expect(slides(deck)).toHaveLength(2);
  });
  it("cuts a slide into sections at ... lines, never inside fenced code", () => {
    expect(sections("A\n...\nB\n\n...\nC")).toEqual(["A", "B\n", "C"]);
    expect(sections("A\n```text\n...\n```\nB")).toEqual(["A\n```text\n...\n```\nB"]);
    expect(sections("Just one")).toEqual(["Just one"]);
    expect(sections("...\nA\n...")).toEqual(["A"]);
  });
  it(":::pop … ::: marks a box, never inside fenced code; nothing pops by itself", () => {
    const marked = popMarks(":::pop\nLook!\n:::\n```\n:::pop\n```\n::: pop\nx");
    expect(marked.split("%%POPSTART%%")).toHaveLength(3);
    expect(marked).toContain("```\n:::pop\n```");
    expect(marked).toContain("%%POPEND%%");
    expect(popMarks("Check my work\n```python\nx = 1\n```")).toBe("Check my work\n```python\nx = 1\n```");
    expect(popBoxes("<p>%%POPSTART%%</p><p>Look!</p><p>%%POPEND%%</p>")).toBe('<div class="pop-box"><p>Look!</p></div>');
  });
  it("the help page's example plays in three parts, the last a pop", () => {
    const { animate, body } = takeAnimate(ANIMATED);
    expect(animate).toBe("words");
    const parts = sections(body);
    expect(parts).toHaveLength(3);
    expect(popMarks(parts[2]!)).toContain("%%POPSTART%%");
  });
});
