import { describe, expect, it } from "vitest";
import cases from "./parse-cases.json";
import { parseCards, parseQuiz, pauseLines, pieces, popBoxes, popMarks, scramble, sections, slides, takeAnimate } from "./quiz";
import { checkGame, checkProject, parseTests, readCheck, runTests, allTests, type GameRunner } from "../checks/checks";
import { blankProject, newEvent, newObject, newRoom, newInstance, newTileset } from "../store/project";
import { ANIMATED, CHECK_EXAMPLES } from "./HelpPage";
import { SPEEDS } from "./reveal";

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
  const summer = newObject("Summer");
  summer.events.push(newEvent({ type: "create" }));
  p.objects.push(player, coin, jumper, summer);
  const room = newRoom("Level1");
  room.instances.push(newInstance(room, coin.id, 0, 0), newInstance(room, coin.id, 10, 0), newInstance(room, player.id, 5, 5));
  p.rooms.push(room);
  return p;
}

describe("checks of the project", () => {
  const p = game();
  const run = (line: string) => checkProject(p, readCheck(line));
  const jumpSum = p.objects.find((o) => o.name === "Summer")!.events[0]!;
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
    // A symbol has no word edges: `3+4` uses + though a digit touches it.
    jumpSum.code = "print(3+4)\nprint(10*2)\n";
    expect(run("Summer.create uses +")?.ok).toBe(true);
    expect(run("Summer.create uses *")?.ok).toBe(true);
    expect(run("Summer.create uses -")?.ok).toBe(false);
    expect(run("Summer.create uses print")?.ok).toBe(true);
    expect(run("Summer.create uses pri")?.ok).toBe(false);
    expect(run("Player.step is written in python")?.ok).toBe(true);
    expect(run("Player.step is written in blocks")).toEqual({ ok: false, detail: "Player's step event is written in Python, not blocks." });
    expect(readCheck("Player.step is in an event sheet")).toMatchObject({ kind: "mode", mode: "sheet" });
    expect(run("room Level1 has 2 Coin")?.ok).toBe(true);
    expect(run("room Level1 has 3 Coin")).toEqual({ ok: false, detail: "Level1 has 2 Coins, not 3." });
    expect(run("room Level1 has at least 1 Coin")?.ok).toBe(true);
    expect(run("Player has sprite")).toEqual({ ok: false, detail: "Player doesn't have a sprite yet." });
  });
  it("how pictures are cut: a tileset's tile size and spacing, its autotile sets, a sprite's frame size", () => {
    const q = game();
    q.sprites.push({ id: "s1", name: "robot", width: 96, height: 128, originX: 48, originY: 127, frames: ["a"] });
    const town = { ...newTileset("town"), tileWidth: 16, tileHeight: 16, spacingX: 1, spacingY: 1 };
    q.tilesets.push(town);
    const run = (line: string) => checkProject(q, readCheck(line));
    expect(run("tileset town is cut 16 × 16 with spacing 1")?.ok).toBe(true);
    expect(run("tileset town is cut 16 x 16")?.ok).toBe(true);
    expect(run("tileset town is cut 16 × 16 with spacing 0")?.ok).toBe(false);
    town.spacingY = 0; // both ways, or it isn't spaced 1
    expect(run("tileset town is cut 16 × 16 with spacing 1")).toEqual({
      ok: false,
      detail: "town's tiles are 16 × 16 with spacing 1 across and 0 down, not 16 × 16 with spacing 1. Set them in the tileset's Tiles box.",
    });
    expect(run("tileset town is cut 32 × 32")?.ok).toBe(false);
    expect(run("tileset town has an autotile set")?.ok).toBe(false);
    town.autotiles.push({ id: "a", name: "path", tiles: [...new Array(15).fill(3), -1] });
    expect(run("tileset town has an autotile set")?.ok).toBe(false); // a slot still empty
    town.autotiles[0]!.tiles[15] = 4;
    expect(run("tileset town has an autotile set")?.ok).toBe(true);
    expect(run("tileset town has at least 2 autotile sets")?.ok).toBe(false);
    expect(run("sprite robot is 96 × 128")?.ok).toBe(true);
    expect(run("sprite robot is 96 x 96")).toEqual({ ok: false, detail: "robot's frames are 96 × 128, not 96 × 96." });
    expect(run("tileset nowhere is cut 16 × 16")).toEqual({ ok: false, detail: "There's no tileset called nowhere yet." });
  });

  it("what the editor makes: frames, solid tiles, painted tiles, layers, room size, camera", () => {
    const q = game();
    q.sprites.push({ id: "s1", name: "hero", width: 24, height: 24, originX: 12, originY: 12, frames: ["a", "b"] });
    const ground = { ...newTileset("ground"), solid: [0, 1, 2, 3] };
    q.tilesets.push(ground);
    const room = q.rooms.find((r) => r.name === "Level1")!;
    const run = (line: string) => checkProject(q, readCheck(line));
    expect(run("sprite hero has at least 2 frames")?.ok).toBe(true);
    expect(run("sprite hero has 3 frames")).toEqual({ ok: false, detail: "hero has 2 frames, not 3." });
    expect(run("tileset ground has at least 4 solid tiles")?.ok).toBe(true);
    expect(run("tileset ground has at least 5 solid tiles")?.ok).toBe(false);
    expect(run("room Level1 has a tile layer using ground")?.ok).toBe(false);
    expect(run("room Level1 has at least 1 tiles")?.ok).toBe(false);
    room.layers.push({ id: "t1", name: "Ground", kind: "tiles", depth: 100, visible: true, locked: false, tileset: ground.id, tiles: { "0,5": 2, "1,5": 2 } });
    room.layers.push({ id: "t2", name: "Decor", kind: "tiles", depth: 50, visible: true, locked: false, tileset: ground.id, tiles: { "0,4": 124 } });
    expect(run("room Level1 has a tile layer using ground")?.ok).toBe(true);
    expect(run("room Level1 has at least 3 tiles")?.ok).toBe(true);
    expect(run("room Level1 has 4 tiles")?.ok).toBe(false);
    expect(run("room Level1 has at least 2 tile layers")?.ok).toBe(true);
    // "tiles" is painted tiles, never an object called tiles.
    expect(readCheck("room Level1 has 3 tiles").kind).toBe("tiles");
    expect(readCheck("room Level1 has 3 Coin").kind).toBe("count");
    expect(run("room Level1 is at least 640 wide")?.ok).toBe(true);
    expect(run("room Level1 is at least 1600 wide")?.ok).toBe(false);
    expect(run("room Level1 is at least 480 tall")?.ok).toBe(true);
    expect(run("room Level1 camera follows Player")?.detail).toMatch(/camera is off/);
    room.camera.enabled = true;
    expect(run("room Level1 camera follows Player")?.ok).toBe(false);
    room.camera.follow = q.objects.find((o) => o.name === "Player")!.id;
    expect(run("room Level1 camera follows Player")?.ok).toBe(true);
    expect(run("room Level1's camera follows Player")?.ok).toBe(true);
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
    expect(takeAnimate("animate: words\n# Hi")).toEqual({ animate: "words", speed: "normal", body: "# Hi" });
    expect(takeAnimate("animate: type\n# Hi").animate).toBe("type");
    expect(takeAnimate("animate: on\n# Hi").animate).toBe("words");
  });
  it("leaves a name it doesn't know in, as text, and only the top line counts", () => {
    expect(takeAnimate("animate: quick\n# Hi")).toEqual({ animate: "", speed: "normal", body: "animate: quick\n# Hi" });
    expect(takeAnimate("# Hi\nanimate: words").animate).toBe("");
  });
  it("takes a speed after the kind, or alone; one it doesn't know stays as text", () => {
    expect(takeAnimate("animate: words slow\n# Hi")).toEqual({ animate: "words", speed: "slow", body: "# Hi" });
    expect(takeAnimate("animate: type fast\n# Hi")).toMatchObject({ animate: "type", speed: "fast" });
    expect(takeAnimate("animate: slow\n# Hi")).toEqual({ animate: "words", speed: "slow", body: "# Hi" });
    expect(takeAnimate("animate: words quickly\n# Hi").animate).toBe("");
  });
  it("plays slowly enough to read along (70 ms a word was not), slow < normal < fast", () => {
    for (const k of ["word", "letter", "block"] as const) {
      expect(SPEEDS.slow[k]).toBeGreaterThan(SPEEDS.normal[k]);
      expect(SPEEDS.normal[k]).toBeGreaterThan(SPEEDS.fast[k]);
    }
    expect(SPEEDS.normal.word).toBeGreaterThanOrEqual(200);
  });
  it("a ^ pause joins a line, never sits alone, and is never read in code", () => {
    expect(pauseLines("One\n^\nTwo")).toBe("One ^\nTwo");
    expect(pauseLines("One\n\n^^\n\nTwo")).toBe("One\n\n\n^^ Two");
    expect(pauseLines("- a\n\n^\n- b")).toBe("- a\n\n- ^ b");
    expect(pauseLines("```\n^\n```\nx")).toBe("```\n^\n```\nx");
    expect(pauseLines("x ^ y")).toBe("x ^ y");
    // A pause before :::pop goes inside the box, not onto its marker.
    expect(pauseLines(popMarks("A\n\n^^\n:::pop\nLook\n:::"))).toMatch(/^%%POPSTART%%$[\s\S]*^\^\^ Look$/m);
    expect(SPEEDS.normal.pause).toBeGreaterThanOrEqual(500);
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
