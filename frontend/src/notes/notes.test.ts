import { describe, expect, it } from "vitest";
import cases from "./parse-cases.json";
import { parseQuiz, pieces, slides } from "./quiz";
import { checkGame, checkProject, parseTests, readCheck, runTests, allTests, type GameRunner } from "../checks/checks";
import { blankProject, newEvent, newObject, newRoom, newInstance } from "../store/project";
import { CHECK_EXAMPLES } from "./HelpPage";

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
function fakeRunner(opts: { error?: string } = {}): GameRunner & { held: Set<string> } {
  let x = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const held = new Set<string>();
  return {
    held,
    async start() {
      x = 0;
      timer = setInterval(() => (x += held.has("right") ? 1 : 0), 10);
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
