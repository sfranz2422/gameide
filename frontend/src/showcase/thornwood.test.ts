/**
 * The showcase game, played headless in the real Pyodide: what a person
 * would find out in the first minute of playing, checked before anyone
 * has to. Runs only when the game has been built (python3
 * showcase/build.py, which needs Anokolisa's art); skipped otherwise.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/out/project.json");
const have = existsSync(BUILT);

interface Played {
  game: PythonGame;
  warnings: string[];
  out: string[];
}

async function start(room = "Thornwood", level = 0, abilities: string[] = []): Promise<Played> {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const warnings: string[] = [];
  const out: string[] = [];
  const { game, error } = await PythonGame.load(def, { stdout: (s) => out.push(s), stderr: (s) => out.push(s), warning: (s) => warnings.push(s) });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  game.evalPython(`new_game()`);
  game.evalPython(`global_vars.level = ${level}; global_vars.abilities = set(${JSON.stringify(abilities)})`);
  game.evalPython(`room_goto(${JSON.stringify(room)})`);
  step(game, 2);
  return { game, warnings, out };
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}

const py = (g: PythonGame, expr: string) => g.evalPython(expr) as never;
const down = (g: PythonGame, k: string) => g.engine.input.keyDown(KEY_CODE.get(k)!);
const up = (g: PythonGame, k: string) => g.engine.input.keyUp(KEY_CODE.get(k)!);
const hero = (g: PythonGame) => py(g, "[round(player().x, 1), round(player().y, 1)] if player() else None") as [number, number];

describe.skipIf(!have)("Thornwood", () => {
  it("starts without a warning, and the hero stands on the ground", async () => {
    const { game, warnings } = await start();
    step(game, 60);
    expect(warnings).toEqual([]);
    const [x, y] = hero(game);
    expect(y % 16).toBe(0); // feet on a tile's top
    step(game, 60);
    expect(hero(game)).toEqual([x, y]);
  });

  it("runs, and jumps four tiles high; a tap is a short hop", async () => {
    const { game } = await start();
    step(game, 30);
    const [x0, y0] = hero(game);
    down(game, "right");
    step(game, 40);
    up(game, "right");
    expect(hero(game)[0]).toBeGreaterThan(x0 + 60);
    step(game, 20);
    // a held jump
    const [, ground] = hero(game);
    down(game, "space");
    let top = ground;
    for (let i = 0; i < 60; i++) {
      step(game);
      top = Math.min(top, hero(game)[1]);
    }
    up(game, "space");
    expect(ground - top).toBeGreaterThan(60);
    expect(ground - top).toBeLessThan(72);
    step(game, 30);
    // a tap
    down(game, "space");
    step(game);
    up(game, "space");
    top = ground;
    for (let i = 0; i < 60; i++) {
      step(game);
      top = Math.min(top, hero(game)[1]);
    }
    expect(ground - top).toBeLessThan(30);
    expect(y0).toBe(ground);
  });

  it("the sword kills a boar in three hits, and it drops nothing it shouldn't", async () => {
    const { game } = await start();
    step(game, 10);
    const [x, y] = hero(game);
    game.evalPython(`b = instance_create(${x + 30}, ${y}, "Boar"); b.state = "rest"; b.timer = 9999`);
    for (let i = 0; i < 3; i++) {
      down(game, "x");
      step(game);
      up(game, "x");
      step(game, 30);
    }
    expect(py(game, `len([b for b in instances("Boar") if abs(b.x - ${x + 30}) < 60])`)).toBe(0);
    expect(py(game, "global_vars.kills")).toBe(1);
  });
});

describe.skipIf(!have)("Tusk, the boss", () => {
  /**
   * A small bot plays the fight: keep away, jump over a charge, and swing
   * at Tusk while he is stunned against a wall. It is not clever — if it
   * can win, a person can — and it checks the whole chain: the trigger
   * shuts the arena, Tusk charges and stuns himself, the sword hurts him,
   * he dies, the arena opens, the exit appears and leads on.
   */
  it("can be beaten, and opens the way on", async () => {
    const { game } = await start();
    step(game, 5);
    // Into the arena, onto the tripwire, with the relic and full health.
    game.evalPython(`global_vars.abilities.add("double_jump"); global_vars.max_hp = global_vars.hp = 99`);
    game.evalPython(`p = player(); p.x, p.y = 126 * 16 + 8, 44 * 16; p.vx = p.vy = 0`);
    step(game, 120);
    expect(py(game, `[g.solid for g in instances("BossGate")]`)).toEqual([true, true, true, true]);
    expect(py(game, `instances("Tusk")[0].state`)).not.toBe("sleep");
    const held = new Set<string>();
    const hold = (k: string, on: boolean) => {
      if (on && !held.has(k)) { down(game, k); held.add(k); }
      if (!on && held.has(k)) { up(game, k); held.delete(k); }
    };
    let stuns = 0, last = "";
    for (let t = 0; t < 60 * 90 && py(game, `len(instances("Tusk"))`) > 0; t++) {
      const [state, bx, px, facing] = py(game, `[instances("Tusk")[0].state, instances("Tusk")[0].x, player().x, instances("Tusk")[0].facing]`) as unknown as [string, number, number, number];
      if (state === "stunned" && last !== "stunned") stuns++;
      last = state;
      const dist = bx - px;
      hold("x", false);
      if (state === "stunned" || state === "dying") {
        // In close, and swing.
        hold("left", dist < -30); hold("right", dist > 30);
        if (Math.abs(dist) < 50 && t % 8 === 0) hold("x", true);
        hold("space", false);
      } else if (state === "charge" && Math.abs(dist) < 90 && Math.sign(dist) === -facing) {
        hold("space", true); // over it
        hold("left", false); hold("right", false);
      } else {
        // Keep about 120 px away, backing off towards the middle.
        hold("space", false);
        const away = Math.abs(dist) < 120;
        hold("left", away && dist > 0); hold("right", away && dist < 0);
      }
      step(game);
    }
    for (const k of [...held]) hold(k, false);
    expect(stuns).toBeGreaterThan(0);
    expect(py(game, `len(instances("Tusk"))`)).toBe(0);
    expect(py(game, `boss_beaten()`)).toBe(true);
    expect(py(game, `[g.solid for g in instances("BossGate")]`)).toEqual([false, false, false, false]);
    expect(py(game, `instances("Exit")[0].visible`)).toBe(true);
    // Through the door: the next level (or the ending, after the last).
    game.evalPython(`e = instances("Exit")[0]; p = player(); p.x, p.y = e.x, e.y`);
    step(game, 80);
    expect(py(game, `global_vars.level`)).toBe(1);
    expect(py(game, `player() is not None and instances("Hud") != []`)).toBe(true); // in the Deep Cave
  });
});

describe.skipIf(!have)("The Deep Cave", () => {
  it("the dash crosses the pool under the low ceiling; walking off, the hero falls in", async () => {
    const { game } = await start("DeepCave", 1, ["double_jump", "dash"]);
    step(game, 5);
    const edge = () => game.evalPython(`p = player(); p.x, p.y = 72 * 16 + 8, 37 * 16; p.vx = p.vy = 0; p.facing = 1; global_vars.hp = 5`);
    edge();
    step(game, 3);
    down(game, "right");
    step(game, 4);
    down(game, "c");
    step(game, 1);
    up(game, "c");
    step(game, 30);
    up(game, "right");
    expect(hero(game)[0]).toBeGreaterThan(77 * 16); // across
    expect(py(game, "global_vars.hp")).toBe(5); // and dry
    // Without the dash: into the water, and back out where it last stood, a life point poorer.
    game.evalPython(`global_vars.abilities.discard("dash")`);
    edge();
    step(game, 3);
    down(game, "right");
    down(game, "space");
    step(game, 60);
    up(game, "right");
    up(game, "space");
    expect(py(game, "global_vars.hp")).toBe(4);
  });

  it("Esc pauses the game: the hero can't move, and Esc again lets him", async () => {
    const { game } = await start("DeepCave", 1, ["double_jump"]);
    step(game, 10);
    down(game, "escape");
    step(game, 1);
    up(game, "escape");
    expect(py(game, "game_paused()")).toBe(true);
    const [x] = hero(game);
    down(game, "right");
    step(game, 30);
    expect(hero(game)[0]).toBe(x);
    up(game, "right");
    down(game, "escape");
    step(game, 1);
    up(game, "escape");
    down(game, "right");
    step(game, 30);
    up(game, "right");
    expect(hero(game)[0]).toBeGreaterThan(x + 20);
  });

  it("Shellmaw can be beaten — rolling, dizzy, angry — and the last door leads to the ending", async () => {
    const { game } = await start("DeepCave", 1, ["double_jump", "dash"]);
    step(game, 5);
    game.evalPython(`global_vars.max_hp = global_vars.hp = 99`);
    game.evalPython(`p = player(); p.x, p.y = 116 * 16 + 8, 44 * 16; p.vx = p.vy = 0`);
    step(game, 140);
    expect(py(game, `instances("Boss")[0].state`)).not.toBe("sleep");
    const held = new Set<string>();
    const hold = (k: string, on: boolean) => {
      if (on && !held.has(k)) { down(game, k); held.add(k); }
      if (!on && held.has(k)) { up(game, k); held.delete(k); }
    };
    let dizzy = 0, last = "", angry = false;
    for (let t = 0; t < 60 * 120 && py(game, `len(instances("Boss"))`) > 0; t++) {
      const [state, bx, px, vx, isAngry] = py(game, `[instances("Boss")[0].state, instances("Boss")[0].x, player().x, instances("Boss")[0].vx, instances("Boss")[0].angry]`) as unknown as [string, number, number, number, boolean];
      if (state === "dizzy" && last !== "dizzy") dizzy++;
      last = state;
      angry ||= isAngry;
      const dist = bx - px;
      hold("x", false);
      if (state === "dizzy" || state === "crawl" || state === "dying") {
        hold("left", dist < -40); hold("right", dist > 40);
        if (Math.abs(dist) < 70 && t % 8 === 0) hold("x", true);
        hold("space", false);
      } else if (state === "roll" && Math.abs(dist) < 110 && Math.sign(vx) === Math.sign(dist) * -1) {
        hold("space", true); // over the shell (the second jump is pressed again by the next tap)
        if (t % 6 === 0) { up(game, "space"); held.delete("space"); }
      } else {
        hold("space", false);
        const away = Math.abs(dist) < 140;
        hold("left", away && dist > 0); hold("right", away && dist < 0);
      }
      step(game);
    }
    for (const k of [...held]) hold(k, false);
    expect(dizzy).toBeGreaterThan(0);
    expect(angry).toBe(true);
    expect(py(game, `len(instances("Boss"))`)).toBe(0);
    expect(py(game, `boss_beaten()`)).toBe(true);
    game.evalPython(`e = instances("Exit")[0]; p = player(); p.x, p.y = e.x, e.y`);
    step(game, 80);
    expect(py(game, `global_vars.level`)).toBe(2);
    expect(py(game, `instances("Ending") != []`)).toBe(true);
  });
});
