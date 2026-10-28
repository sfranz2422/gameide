/**
 * The Starter Projects (starterProjects.ts) played headless in the real
 * Pyodide: each one works as it opens, before a student changes anything —
 * a starter that's broken on the first Play teaches nothing. Their pictures
 * are fetched from public/, so fetch is handed the files from disk here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import { novel, pointclick, topdown, VILLAGE, VILLAGE_SOLID, VILLAGE_TILES } from "./starterProjects";
import type { Built } from "./templates";
import { checkProject, readCheck } from "../checks/checks";
import { parseTutorial } from "../tutorials/tutorial";
import { newId, newInstance, newRoom, type Project } from "./project";

const PUBLIC = join(__dirname, "../../public");

beforeAll(() => {
  vi.stubGlobal("fetch", async (path: string) => {
    try {
      return new Response(readFileSync(join(PUBLIC, path)));
    } catch {
      return new Response(null, { status: 404 });
    }
  });
});
afterAll(() => vi.unstubAllGlobals());

async function start(make: () => Promise<Built>) {
  return startFrom(await make());
}

async function startFrom({ project, assets }: Built) {
  const { def } = buildGame(project, assets);
  const warnings: string[] = [];
  const { game, error } = await PythonGame.load(def, { stdout: () => undefined, stderr: () => undefined, warning: (s) => warnings.push(s) });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return { game, warnings, project };
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, expr: string) => g.evalPython(expr) as never;
const key = (g: PythonGame, k: string, down: boolean) => (down ? g.engine.input.keyDown(KEY_CODE.get(k)!) : g.engine.input.keyUp(KEY_CODE.get(k)!));
function press(g: PythonGame, k: string) {
  key(g, k, true);
  step(g, 1);
  key(g, k, false);
  step(g, 1);
}
function click(g: PythonGame, x: number, y: number) {
  g.engine.input.mouseMove(x, y);
  g.engine.input.mouseDown(0);
  step(g, 1);
  g.engine.input.mouseUp(0);
  step(g, 1);
}
/** Clicks through whatever's being said, until the box closes (or a question waits). */
function readOn(g: PythonGame) {
  // Not a question: Space there would answer it.
  for (let i = 0; i < 40 && py(g, "dialogue_open() and __import__('gameide')._dialogue[0][2] is None"); i++) {
    press(g, "space");
    step(g, 2);
  }
}

describe("Starter Projects", () => {
  it("Village Quest: walk, stop at trees, collect coins, get slimed, talk to the wizard", async () => {
    const { game: g, warnings } = await start(topdown);
    // Nothing held, nothing moves (self.speed is the engine's own motion: a
    // hero given a "speed" walked off by itself).
    const x0 = py(g, "instances('Player')[0].x") as number;
    step(g, 30);
    expect(py(g, "instances('Player')[0].x")).toBe(x0);
    // Holding right moves the hero; a wall of trees stops it.
    key(g, "right", true);
    step(g, 30);
    key(g, "right", false);
    expect(py(g, "instances('Player')[0].x")).toBeGreaterThan(x0);
    py(g, "p = instances('Player')[0]; p.x, p.y = 24, 40");
    key(g, "up", true);
    step(g, 40);
    key(g, "up", false);
    expect(py(g, "instances('Player')[0].y")).toBeGreaterThanOrEqual(16 + 4); // stopped by the trees along the top
    // A coin counts; a slime sends you home.
    py(g, "p = instances('Player')[0]; c = instances('Coin')[0]; p.x, p.y = c.x, c.y");
    step(g, 2);
    expect(py(g, "global_vars.coins")).toBe(1);
    py(g, "p = instances('Player')[0]; s = instances('Slime')[0]; p.x, p.y = s.x, s.y");
    step(g, 2);
    expect(py(g, "[instances('Player')[0].x, instances('Player')[0].y, *instances('Player')[0].home]")).toEqual((() => { const h = py(g, "list(instances('Player')[0].home)") as number[]; return [...h, ...h]; })());
    // Next to the wizard, Space talks.
    py(g, "p = instances('Player')[0]; w = instances('Wizard')[0]; p.x, p.y = w.x + 12, w.y");
    press(g, "space");
    expect(py(g, "dialogue_open()"), "the wizard talks").toBe(true);
    readOn(g);
    expect(warnings).toEqual([]);
  });

  it("Village Quest's map: every letter is a tile, solid where it should be, and nobody starts in a wall", async () => {
    const solid = new Set(VILLAGE_SOLID);
    expect(VILLAGE).toHaveLength(30);
    for (const row of VILLAGE) expect(row).toHaveLength(40);
    // Trees, bushes, roofs, walls and fences stop you; grass, flowers, paths and doors don't.
    for (const [ch, tile] of Object.entries(VILLAGE_TILES)) expect(solid.has(tile), ch).toBe("TtbRrWF".includes(ch));
    const { game: g } = await start(topdown);
    for (const o of ["Player", "Wizard", "Coin", "Slime"])
      expect(py(g, `[ (i.x, i.y) for i in instances('${o}') if not i.place_free(i.x, i.y) ]`), o).toEqual([]);
  });

  it("The Newsroom: click to walk, pick up the camera, the door it opens, and the way to the hallway", async () => {
    const { game: g, warnings } = await start(pointclick);
    expect(py(g, "room_name()")).toBe("Newsroom");
    // The cafeteria door is in the hallway; first, the camera on the shelf.
    click(g, 560, 44);
    step(g, 200);
    readOn(g);
    expect(py(g, "global_vars.items")).toEqual(["notepad", "camera"]);
    expect(py(g, "len([s for s in instances('Spot') if s.item == 'camera'])")).toBe(0);
    // A click on the floor walks there, kept on the floor.
    click(g, 400, 20);
    step(g, 200);
    const robin = py(g, "(round(instances('Robin')[0].x), round(instances('Robin')[0].y))") as number[];
    expect(robin).toEqual([400, 238]);
    // The door goes to the hallway.
    click(g, 620, 150);
    step(g, 200);
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Hallway");
    // The cafeteria door says something now the camera's in hand.
    click(g, 170, 150);
    step(g, 200);
    expect(py(g, "dialogue_open()")).toBe(true);
    readOn(g);
    // Back to the newsroom: the camera stays picked up (the rooms are persistent).
    click(g, 630, 200);
    step(g, 200);
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Newsroom");
    expect(py(g, "len([s for s in instances('Spot') if s.item == 'camera'])")).toBe(0);
    expect(warnings).toEqual([]);
  });

  it("The Newsroom: the cafeteria door needs the camera", async () => {
    const { game: g } = await start(pointclick);
    py(g, "room_goto('Hallway')");
    step(g, 3);
    py(g, "act(collision_point(170, 150, 'Spot'))");
    // Robin says why not, and stays in the hallway.
    expect(py(g, "__import__('gameide')._dialogue[0][1]")).toBe(py(g, "collision_point(170, 150, 'Spot').locked"));
    expect(py(g, "collision_point(170, 150, 'Spot').locked")).toContain("camera");
  });

  it("The Ferryman: every choice goes somewhere, both endings come round to the start", async () => {
    const { game: g, warnings } = await start(novel);
    expect(py(g, "[(n, goes) for n, s in SCENES.items() for _, goes in (s['choices'] or []) if goes not in SCENES]")).toEqual([]);
    // Every scene can be reached from the start.
    const goes = py(g, "{n: [to for _, to in (s['choices'] or [])] for n, s in SCENES.items()}") as Record<string, string[]>;
    const seen = new Set<string>();
    const todo = ["start"];
    while (todo.length) {
      const n = todo.pop()!;
      if (!seen.has(n)) (seen.add(n), todo.push(...goes[n]!));
    }
    expect(Object.keys(goes).filter((n) => !seen.has(n))).toEqual([]);
    // Play: the ferry, keep quiet, wait for morning: the end, then Play again.
    expect(py(g, "global_vars.scene")).toBe("start");
    const pick = (n: number) => {
      readOn(g);
      step(g, 40); // the question types out before its choices can be picked
      press(g, String(n));
      step(g, 2);
    };
    pick(1);
    expect(py(g, "global_vars.scene")).toBe("ferry");
    pick(2);
    expect(py(g, "global_vars.scene")).toBe("chapel");
    pick(1);
    expect(py(g, "global_vars.scene")).toBe("dawn");
    pick(1);
    expect(py(g, "global_vars.scene")).toBe("start");
    expect(warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------- the tutorials, done as a student does them

/**
 * Each tutorial's steps, done to its starter by hand the way the tutorial
 * says: every check must fail before its step and pass after it. A check
 * that passes on the untouched starter checks nothing (the house rule).
 */
async function checkAll(built: Built, line: string): Promise<boolean> {
  const c = readCheck(line);
  const quick = checkProject(built.project, c);
  if (quick) return quick.ok;
  const { game } = await startFrom(built).catch(() => ({ game: null }));
  if (!game) return false;
  try {
    if (c.kind === "runs") {
      step(game, Math.round(c.seconds * 60));
      return true;
    }
    if (c.kind === "after-expr") {
      step(game, Math.round(c.seconds * 60));
      return game.evalPython(`bool(${c.expr})`) === true;
    }
  } catch {
    return false;
  }
  throw new Error(`The test can't run "${line}"`);
}

const md = (key: string) => readFileSync(join(PUBLIC, "tutorials", `${key}.md`), "utf8");
const obj = (p: Project, name: string) => p.objects.find((o) => o.name === name)!;
const room = (p: Project, name: string) => p.rooms.find((r) => r.name === name)!;
const code = (p: Project, objName: string, type: string) => obj(p, objName).events.find((e) => e.key.type === type)!;
const script = (p: Project, name: string) => p.scripts.find((s) => s.name === name)!;
function edit(where: { code: string }, from: string, to: string) {
  expect(where.code, from).toContain(from);
  where.code = where.code.replace(from, to);
}

async function walkThrough(key: string, make: () => Promise<Built>, doStep: Record<number, (p: Project) => void>) {
  const t = parseTutorial(md(key));
  const built = await make();
  for (let i = 0; i < t.steps.length; i++) {
    const checks = t.steps[i]!.checks.map((c) => c.label);
    const real = checks.filter((l) => readCheck(l).kind !== "runs");
    if (real.length) {
      // Before the step: at least the step's real checks aren't all passing already.
      const before = await Promise.all(real.map((l) => checkAll(built, l)));
      expect(before.every(Boolean), `${key} step ${i + 1} passes before it's done: ${real.join(" / ")}`).toBe(false);
    }
    doStep[i]?.(built.project);
    for (const l of checks) expect(await checkAll(built, l), `${key} step ${i + 1}: ${l}`).toBe(true);
  }
}

describe("Starter Projects' tutorials, done step by step", () => {
  it("Top-Down Adventure", async () => {
    await walkThrough("top-down", topdown, {
      1: (p) => edit(code(p, "Player", "create"), "self.walk_speed = 1.5", "self.walk_speed = 2.5"),
      2: (p) => {
        const r = room(p, "Village");
        for (let i = 0; i < 5; i++) r.instances.push(newInstance(r, obj(p, "Coin").id, 40 + i * 16, 56));
      },
      3: (p) => edit(code(p, "Wizard", "create"), '"Slimes got into the fields and scattered my gold. Can you find it all?",', '"Slimes got into the fields and scattered my gold. Can you find it all?",\n    "Mind the slimes.",'),
      4: (p) => {
        const r = room(p, "Village");
        r.instances.push(newInstance(r, obj(p, "Slime").id, 200, 312));
        edit(code(p, "Slime", "create"), "self.hspeed = 0.6", "self.hspeed = 1.2");
      },
      5: (p) => {
        const r = room(p, "Village");
        const ground = r.layers.find((l) => l.kind === "tiles")!;
        const tiles: Record<string, number> = { "2,2": 2, "3,2": 2, "4,8": 1, "5,8": 1, "6,8": 1 };
        r.layers.unshift({ ...ground, id: newId(), name: "Scenery", depth: 90, tiles } as typeof ground);
      },
    });
  });

  it("Point-and-Click Adventure", async () => {
    await walkThrough("point-and-click", pointclick, {
      1: (p) => {
        const computer = room(p, "Newsroom").instances.find((i) => i.code.includes('"computer"'))!;
        edit(computer, "The school computer. It takes four minutes to open a picture of a cat.", "Older than my dad. Still faster than the school bus.");
      },
      2: (p) => {
        const r = room(p, "Newsroom");
        const i = newInstance(r, obj(p, "Spot").id, 512, 60);
        Object.assign(i, { scaleX: 1.4, scaleY: 2.8, code: 'self.name = "bookshelf"\nself.text = "Old yearbooks."\n' });
        r.instances.push(i);
      },
      3: (p) => {
        p.sprites.push({ ...p.sprites.find((s) => s.name === "camera")!, id: newId(), name: "key" });
        const r = room(p, "Hallway");
        const i = newInstance(r, obj(p, "Spot").id, 74, 96);
        Object.assign(i, { scaleX: 1.8, scaleY: 2, code: 'self.name = "bulletin board"\nself.text = "A key!"\nself.item = "key"\n' });
        r.instances.push(i);
      },
      4: (p) => {
        const office = room(p, "Hallway").instances.find((i) => i.code.includes('"office door"'))!;
        office.code += 'self.needs = "key"\nself.locked = "Locked."\n';
      },
      5: (p) => {
        const r = newRoom("Cafeteria");
        Object.assign(r, { width: 640, height: 400 });
        r.instances.push(newInstance(r, obj(p, "Robin").id, 100, 260), newInstance(r, obj(p, "Game").id, 0, 0));
        p.rooms.push(r);
        edit(script(p, "adventure"), '    "Hallway": (10, 224, 630, 284),\n', '    "Hallway": (10, 224, 630, 284),\n    "Cafeteria": (10, 230, 380, 284),\n');
        const door = room(p, "Hallway").instances.find((i) => i.code.includes('"cafeteria door"'))!;
        door.code += 'self.goto = "Cafeteria"\n';
      },
    });
  });

  it("Visual Novel", async () => {
    await walkThrough("visual-novel", novel, {
      1: (p) => edit(script(p, "story"), "You're the one with the lantern? Good.", "Late again, lantern-bearer."),
      2: (p) => edit(script(p, "story"), '("Walk the boardwalk", "reeds")],', '("Walk the boardwalk", "reeds"), ("Run back home", "lost")],'),
      3: (p) => {
        edit(script(p, "story"), '    "dawn": {', `    "marrows_tale": {
        "picture": "ferry",
        "face": "marrow_1",
        "lines": [("Marrow", "I wasn't always a ferryman, you know.")],
        "choices": [("Ask how he got home", "chapel")],
    },
    "dawn": {`);
        edit(script(p, "story"), '("Keep quiet", "chapel")]', '("Keep quiet", "chapel"), ("Ask about Marrow", "marrows_tale")]');
      },
      4: (p) => {
        edit(code(p, "Story", "create"), 'play("start")', 'global_vars.met_pip = False\nplay("start")');
        edit(script(p, "story"), "    global_vars.scene = name\n", `    global_vars.scene = name
    if name == "willow":
        global_vars.met_pip = True
    if name == "dawn" and global_vars.met_pip:
        say("Pip squeezes your hand, smiles, and fades into the morning light.")
`);
      },
    });
  });
});
