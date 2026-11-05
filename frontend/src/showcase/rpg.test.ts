/**
 * The eleventh showcase game, The Lanterns of Hollowmere (a story RPG), played
 * headless in the real Pyodide with the keys, as a person would. Runs when the
 * game has been built (python3 showcase/rpg/build.py, which needs only the repo).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { KEY_CODE } from "../engine/input";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/rpg/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { saved: () => saved });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
function tap(g: PythonGame, k: string) {
  g.engine.input.keyDown(KEY_CODE.get(k)!);
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(k)!);
  step(g);
}
const room = (g: PythonGame) => py(g, "room_name()") as string;
/** Skips any scene and moves through any words, until nothing's in the way. */
function clear(g: PythonGame) {
  for (let i = 0; i < 400 && (py(g, "scene_playing() or dialogue_open()") as boolean); i++) {
    if (py(g, "scene_playing()")) tap(g, "escape");
    else tap(g, "space");
    step(g, 1);
  }
}
async function newGame() {
  const g = await start();
  tap(g, "enter"); // New Game
  step(g, 4);
  expect(room(g)).toBe("Town");
  clear(g);
  return g;
}
/** Stands beside something by its object name, and presses Z. */
function useIt(g: PythonGame, name: string) {
  py(g, `p = instances("Player")[0]; o = instances("${name}")[0]; p.x, p.y = o.x, o.y + 30`);
  step(g, 2);
  tap(g, "z");
  step(g, 2);
}
/** Walks through a door by putting the Player on it. */
function goThrough(g: PythonGame, to: string) {
  py(g, `p = instances("Player")[0]; d = [o for o in instances("Door") if o.to == "${to}"][0]; p.x, p.y = d.x + 16, d.y + 24`);
  for (let i = 0; i < 6 && room(g) !== to; i++) step(g, 1);
  step(g, 3);
  expect(room(g)).toBe(to);
}
/** Starts a fight with the nearest foe of this name by walking the Player onto it. */
function bump(g: PythonGame, name: string) {
  py(g, `p = instances("Player")[0]; p.safe = 0; o = instances("${name}")[0]; p.x, p.y = o.x, o.y`);
  for (let i = 0; i < 10 && room(g) !== "Battle"; i++) step(g, 1);
}
/** Plays a fight with the menus: attack the first foe every time. Heals when low. Returns the room it ended in. */
function fight(g: PythonGame, steps = 8000) {
  for (let i = 0; i < steps && room(g) === "Battle"; i++) {
    if (py(g, "dialogue_open()")) tap(g, "space");
    else if (py(g, 'instance_exists("MenuBox")')) tap(g, "z");
    else step(g, 1);
  }
  step(g, 4);
  return room(g);
}

/** Plays as a careful person: Pip heals whoever's under half, everyone else attacks. Returns the room it ended in, and how many turns it took. */
function fightWell(g: PythonGame, steps = 20000) {
  let turns = 0;
  for (let i = 0; i < steps && room(g) === "Battle"; i++) {
    if (py(g, "dialogue_open()")) {
      tap(g, "space");
      continue;
    }
    if (!(py(g, 'instance_exists("MenuBox")') as boolean)) {
      step(g, 1);
      continue;
    }
    if (py(g, "newest_menu().age < 2")) {
      step(g, 1);
      continue;
    }
    turns++;
    const who = py(g, "newest_menu().title") as string;
    const hurt = py(g, 'next((i for i, h in enumerate(f for f in instances("HeroFighter") if f.hp > 0) if h.hp < h.max_hp * 0.5), -1)') as number;
    const mp = py(g, 'next(f.mp for f in instances("HeroFighter") if f.name == "Pip")' .replace('next(f.mp', 'next((f.mp').replace('== "Pip")', '== "Pip"), 0)')) as number;
    if (who === "Pip" && hurt >= 0 && mp >= 3) {
      tap(g, "down"); // Skill
      tap(g, "z");
      step(g, 2);
      tap(g, "z"); // Mend
      step(g, 2);
      for (let k = 0; k < hurt; k++) tap(g, "down");
      tap(g, "z");
    } else {
      tap(g, "z"); // Attack
      step(g, 2);
      tap(g, "z"); // the first foe
    }
    step(g, 1);
  }
  step(g, 4);
  return { end: room(g), turns };
}

describe.skipIf(!have)("The Lanterns of Hollowmere", () => {
  it("the map's edge stops you and no other ground does", () => {
    // Each ground is a block of tiles, so a mistake in the numbering makes the wrong ground solid, silently.
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    const solid = new Set(project.tilesets[0]!.solid);
    const town = readFileSync(resolve(__dirname, "../../../showcase/rpg/maps/Town.txt"), "utf8").split("\n").filter((l) => !/^# |: /.test(l) && l.trim());
    const layer = project.rooms.find((r) => r.name === "Town")!.layers.find((l) => l.kind === "tiles") as unknown as { tiles: Record<string, number> };
    let edges = 0;
    town.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === "#") edges++;
        expect(solid.has(layer.tiles[`${c},${r}`]!), `${ch} at ${c},${r}`).toBe(ch === "#");
      });
    });
    expect(edges).toBeGreaterThan(0);
  });

  it("starts with its opening scene and a town to walk in", { timeout: 60_000 }, async () => {
    const g = await start();
    tap(g, "enter");
    step(g, 4);
    expect(room(g)).toBe("Town");
    expect(py(g, "scene_playing()")).toBe(true);
    clear(g);
    const x = py(g, 'instances("Player")[0].x') as number;
    g.engine.input.keyDown(KEY_CODE.get("left")!);
    step(g, 20);
    g.engine.input.keyUp(KEY_CODE.get("left")!);
    expect(py(g, 'instances("Player")[0].x') as number).toBeLessThan(x);
  });

  it("the gate waits for Oona's word, and Oona gives the quest", { timeout: 60_000 }, async () => {
    const g = await newGame();
    py(g, 'p = instances("Player")[0]; d = instances("Door")[0]; p.x, p.y = d.x + 16, d.y + 24');
    step(g, 3);
    expect(room(g)).toBe("Town");
    clear(g);
    useIt(g, "Oona");
    clear(g);
    expect(py(g, '"thorn_road" in S["quests"]')).toBe(true);
    goThrough(g, "Forest");
  });

  it("Pip joins, and a fight is won with the menus: xp, gold, and the foe stays beaten", { timeout: 120_000 }, async () => {
    const g = await newGame();
    useIt(g, "Oona");
    clear(g);
    useIt(g, "Pip");
    clear(g);
    expect(py(g, 'len(S["party"])')).toBe(2);
    goThrough(g, "Forest");
    const before = py(g, 'instance_number("Thornling")') as number;
    const gold = py(g, 'S["gold"]') as number;
    const xp = py(g, 'S["party"][0]["xp"] + S["party"][0]["level"] * 100') as number;
    bump(g, "Thornling");
    expect(room(g)).toBe("Battle");
    // Everyone stands in front of the picture, and on the stage, clear of the menu.
    expect(py(g, 'all(f.depth < instances("BattleBack")[0].depth for f in instances("Fighter"))')).toBe(true);
    expect(py(g, 'all(f.visible and f.sprite and 150 < f.x < 620 for f in instances("Fighter"))')).toBe(true);
    expect(fight(g)).toBe("Forest");
    expect(py(g, 'S["gold"]') as number).toBeGreaterThan(gold);
    expect(py(g, 'S["party"][0]["xp"] + S["party"][0]["level"] * 100') as number).toBeGreaterThan(xp);
    expect(py(g, 'instance_number("Thornling")')).toBe(before - 1);
    step(g, 60);
    expect(py(g, 'instances("Player")[0].safe')).toBeLessThan(90);
  });

  it("losing leads to Game Over, and trying again goes back to the last save", { timeout: 60_000 }, async () => {
    const g = await newGame();
    useIt(g, "Oona");
    clear(g);
    goThrough(g, "Forest");
    py(g, 'S["party"][0]["hp"] = 1');
    bump(g, "Thornback");
    clear(g);
    for (let i = 0; i < 40 && room(g) !== "Battle"; i++) step(g, 1);
    expect(room(g)).toBe("Battle");
    py(g, 'S["party"][0]["hp"] = 1; instances("HeroFighter")[0].hp = 1');
    expect(fight(g)).toBe("GameOver");
    tap(g, "z");
    step(g, 4);
    expect(room(g)).toBe("Forest");
    expect(py(g, 'S["party"][0]["hp"]')).toBeGreaterThan(1);
  });

  it("a save comes back through the title's Continue", { timeout: 60_000 }, async () => {
    const g = await newGame();
    useIt(g, "Oona");
    clear(g);
    goThrough(g, "Forest");
    const saved = g.saved();
    const again = await start(saved);
    tap(again, "down");
    tap(again, "enter");
    step(again, 4);
    expect(room(again)).toBe("Forest");
    expect(py(again, '"thorn_road" in S["quests"]')).toBe(true);
  });

  it("the shop sells, and gear can be put on", { timeout: 60_000 }, async () => {
    const g = await newGame();
    py(g, 'S["gold"] = 500');
    const atk = py(g, 'stat(S["party"][0], "atk")') as number;
    useIt(g, "Shopkeeper");
    expect(py(g, 'instance_exists("MenuBox")')).toBe(true);
    tap(g, "down");
    tap(g, "down");
    tap(g, "down");
    tap(g, "z"); // Iron Sword
    step(g, 2);
    expect(py(g, 'S["gold"]')).toBe(420);
    expect(py(g, '"iron_sword" in S["gear"]')).toBe(true);
    tap(g, "x");
    step(g, 2);
    expect(py(g, 'instance_exists("MenuBox")')).toBe(false);
    py(g, "gear_menu()");
    step(g, 3);
    tap(g, "z"); // Wren
    step(g, 2);
    tap(g, "z"); // the sword
    step(g, 2);
    clear(g);
    expect(py(g, 'stat(S["party"][0], "atk")')).toBe(atk + 5);
  });

  it("the whole first chapter, with both side quests: Thornback beaten and the lantern lit", { timeout: 300_000 }, async () => {
    const g = await newGame();
    useIt(g, "Oona");
    clear(g);
    useIt(g, "Pip");
    clear(g);
    useIt(g, "Dot");
    clear(g);
    useIt(g, "Tam");
    clear(g);
    expect(py(g, 'sorted(S["quests"])')).toEqual(["cat", "herbs", "thorn_road"]);
    goThrough(g, "Forest");
    for (let i = 0; i < 5; i++) {
      useIt(g, "Herb");
      clear(g);
    }
    expect(py(g, 'count_item("herb")')).toBe(5);
    useIt(g, "Mittens");
    clear(g);
    expect(py(g, 'flag("found_cat")')).toBe(true);
    // Beats everything in the wood, the way a person would before the boss.
    for (let n = 0; n < 12; n++) {
      for (const foe of ["Thornling", "Bat", "Shroom"]) {
        if (py(g, `instance_number("${foe}")`)) {
          bump(g, foe);
          expect(fight(g)).toBe("Forest");
          py(g, "rest_party()"); // As if they'd used the inn.
        }
      }
    }
    expect(py(g, 'S["party"][0]["level"]')).toBeGreaterThanOrEqual(3);
    bump(g, "Thornback");
    clear(g);
    for (let i = 0; i < 40 && room(g) !== "Battle"; i++) step(g, 1);
    expect(room(g)).toBe("Battle");
    const boss = fightWell(g);
    process.stderr.write(`Thornback: ${JSON.stringify(boss)} ${JSON.stringify(py(g, '[(h["key"], h["level"], h["hp"], h["mp"]) for h in S["party"]]'))}\n`);
    expect(boss.end).toBe("Forest");
    clear(g);
    expect(py(g, 'flag("thornback_beaten")')).toBe(true);
    expect(py(g, 'count_item("ember_shard")')).toBe(1);
    goThrough(g, "Town");
    useIt(g, "Dot");
    clear(g);
    useIt(g, "Tam");
    clear(g);
    expect(py(g, 'sorted(S["done"])')).toEqual(["cat", "herbs"]);
    useIt(g, "Oona");
    clear(g);
    expect(py(g, 'S["lit"]')).toBe(1);
    expect(py(g, 'instances("Lantern")[0].lit')).toBe(true);
    expect(py(g, '"thorn_road" in S["done"]')).toBe(true);
  });
});
