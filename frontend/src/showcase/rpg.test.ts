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

/** A game as chapter 1 leaves it: a lantern lit, Pip in the party, everyone about level 4. */
async function chapterTwo() {
  const g = await newGame();
  py(g, 'S["lit"] = 1; S["done"].append("thorn_road"); S["quests"]["ember_mine"] = 0; S["party"].append(new_hero("pip")); S["gold"] = 200');
  py(g, '[give_xp(h, sum(xp_to_next(n) for n in range(1, 4))) for h in S["party"]]; rest_party()');
  return g;
}
/** Bram joins, and into the mine. */
async function inTheMine() {
  const g = await chapterTwo();
  useIt(g, "Bram");
  clear(g);
  goThrough(g, "Mine");
  clear(g);
  return g;
}
/** Walks with a key held, the real way, for so many steps. */
function walk(g: PythonGame, k: string, steps: number) {
  g.engine.input.keyDown(KEY_CODE.get(k)!);
  step(g, steps);
  g.engine.input.keyUp(KEY_CODE.get(k)!);
  step(g, 1);
}

describe.skipIf(!have)("The Lanterns of Hollowmere", () => {
  it("the mine road waits for Bram, and Oona and Bram both point the way", { timeout: 60_000 }, async () => {
    const g = await chapterTwo();
    py(g, 'p = instances("Player")[0]; d = [o for o in instances("Door") if o.to == "Mine"][0]; p.x, p.y = d.x + 16, d.y + 24');
    step(g, 6);
    expect(room(g)).toBe("Town");
    clear(g);
    useIt(g, "Oona");
    clear(g);
    useIt(g, "Bram");
    clear(g);
    expect(py(g, '[h["key"] for h in S["party"]]')).toEqual(["wren", "pip", "bram"]);
    expect(py(g, 'S["party"][2]["level"]')).toBe(py(g, 'S["party"][0]["level"]'));
    expect(py(g, 'S["quests"]["ember_mine"]')).toBe(1);
    goThrough(g, "Mine");
    expect(py(g, "scene_playing()")).toBe(true);
  });

  it("a rockfall stops you until Bram breaks it, and stays broken", { timeout: 60_000 }, async () => {
    const g = await inTheMine();
    const at = 'p = instances("Player")[0]; p.safe = 9999; r = instance_nearest(16 * 32, 13 * 32, "Rubble"); p.x, p.y = r.x - 48, r.y - 8';
    py(g, at);
    walk(g, "right", 60);
    expect(py(g, 'instances("Player")[0].x < instance_nearest(16 * 32, 13 * 32, "Rubble").x')).toBe(true);
    const before = py(g, 'instance_number("Rubble")') as number;
    tap(g, "z");
    clear(g);
    expect(py(g, 'instance_number("Rubble")')).toBe(before - 1);
    goThrough(g, "Town");
    goThrough(g, "Mine");
    expect(py(g, 'instance_number("Rubble")')).toBe(before - 1);
  });

  it("the lift wants the foreman's key from the chest, and Jory's tea heals", { timeout: 60_000 }, async () => {
    const g = await inTheMine();
    py(g, 'S["party"][0]["hp"] = 1');
    useIt(g, "Jory");
    clear(g);
    expect(py(g, 'S["party"][0]["hp"]')).toBeGreaterThan(1);
    expect(py(g, 'S["quests"]["ember_mine"]')).toBe(2);
    useIt(g, "Lift");
    clear(g);
    expect(room(g)).toBe("Mine");
    py(g, 'p = instances("Player")[0]; c = [o for o in instances("Chest") if o.item == "mine_key"][0]; p.x, p.y = c.x, c.y + 30');
    step(g, 2);
    tap(g, "z");
    clear(g);
    expect(py(g, 'count_item("mine_key")')).toBe(1);
    expect(py(g, 'S["quests"]["ember_mine"]')).toBe(3);
    useIt(g, "Lift");
    step(g, 4);
    expect(room(g)).toBe("MineDeep");
    expect(py(g, 'count_item("mine_key")')).toBe(0);
  });

  it("the golem glows and warns, then its Molten Burst hits everyone, and Defend halves it", { timeout: 60_000 }, async () => {
    const g = await inTheMine();
    py(g, 'start_battle(["golem"], 0, 0, run=False)');
    step(g, 4);
    const lines: string[] = [];
    let hurt: number[] = [];
    let guarded = false;
    for (let i = 0; i < 6000 && !lines.some((l) => l.includes("Molten Burst")); i++) {
      if (py(g, 'instance_exists("MenuBox")') && !py(g, "newest_menu().age < 2")) {
        const glowing = py(g, 'instances("FoeFighter")[0].charged') as boolean;
        // Everyone defends once it's glowing. Defend is the last row, as a fight can't be run from.
        if (glowing) {
          guarded = true;
          tap(g, "up");
          tap(g, "z");
        } else {
          tap(g, "z");
          step(g, 2);
          tap(g, "z");
        }
        py(g, 'rest_party(); [setattr(f, "hp", f.max_hp) for f in instances("HeroFighter")]');
        hurt = py(g, '[f.hp for f in instances("HeroFighter")]') as unknown as number[];
      } else step(g, 1);
      const line = py(g, "instances('BattleDirector')[0].line") as string;
      if (lines[lines.length - 1] !== line) lines.push(line);
    }
    expect(lines.some((l) => l.includes("glowing white-hot"))).toBe(true);
    expect(lines.some((l) => l.includes("Molten Burst"))).toBe(true);
    expect(guarded).toBe(true);
    const after = py(g, '[f.hp for f in instances("HeroFighter")]') as unknown as number[];
    const lost = after.map((n, i) => hurt[i]! - n);
    // Everyone was hit, and by far less than the undefended burst's 25 or so.
    expect(Math.min(...lost)).toBeGreaterThan(0);
    expect(Math.max(...lost)).toBeLessThan(18);
  });

  it("Hob's crystals pay, Marta counts beetles and gives free beds", { timeout: 60_000 }, async () => {
    const g = await inTheMine();
    goThrough(g, "Town");
    useIt(g, "Shopkeeper");
    clear(g);
    py(g, "close_menus()");
    step(g, 2);
    expect(py(g, '"crystals" in S["quests"]')).toBe(true);
    py(g, 'add_item("glow_crystal", 4)');
    const gold = py(g, 'S["gold"]') as number;
    useIt(g, "Shopkeeper");
    clear(g);
    py(g, "close_menus()");
    step(g, 2);
    expect(py(g, '"crystals" in S["done"]')).toBe(true);
    expect(py(g, 'S["gold"]')).toBe(gold + 120);
    expect(py(g, 'count_item("glow_crystal")')).toBe(0);

    useIt(g, "Innkeeper");
    clear(g);
    py(g, "close_menus()");
    step(g, 2);
    expect(py(g, '"beetles" in S["quests"]')).toBe(true);
    goThrough(g, "Mine");
    for (let n = 0; n < 3; n++) {
      py(g, 'start_battle(["beetle", "beetle"], instances("Player")[0].x, instances("Player")[0].y)');
      step(g, 4);
      fight(g);
      clear(g);
      py(g, "rest_party()");
    }
    expect(py(g, 'S["beaten"]["beetle"]')).toBe(6);
    goThrough(g, "Town");
    useIt(g, "Innkeeper");
    clear(g);
    expect(py(g, '"beetles" in S["done"]')).toBe(true);
    expect(py(g, "newest_menu().title")).toBe("A bed is free, love");
    const money = py(g, 'S["gold"]') as number;
    py(g, 'S["party"][0]["hp"] = 1');
    step(g, 3);
    tap(g, "z");
    clear(g);
    expect(py(g, 'S["gold"]')).toBe(money);
    expect(py(g, 'S["party"][0]["hp"]')).toBeGreaterThan(1);
  });

  it("a save from before the mine carries on into the mine's quest", { timeout: 60_000 }, async () => {
    const g = await newGame();
    py(g, 'S["quests"]["next"] = 0; S.pop("beaten"); save_game(); load_game()');
    expect(py(g, 'S["quests"]')).toBeDefined();
    expect(py(g, '"next" in S["quests"]')).toBe(false);
    expect(py(g, 'S["quests"]["ember_mine"]')).toBe(0);
    expect(py(g, 'S["beaten"] == {}')).toBe(true);
  });

  it("the whole of chapter 2: Jory found, the golem beaten, the second lantern lit", { timeout: 300_000 }, async () => {
    const g = await inTheMine();
    const beat = () => {
      for (let n = 0; n < 12; n++) {
        for (const foe of ["Beetle", "Rockling", "Mole"]) {
          if (py(g, `instance_number("${foe}")`)) {
            const before = room(g);
            bump(g, foe);
            expect(fightWell(g).end, foe).toBe(before);
            clear(g);
          }
        }
        py(g, "rest_party()"); // As if Jory's tea, or a walk back to the inn.
      }
    };
    useIt(g, "Rubble");
    clear(g);
    useIt(g, "Jory");
    clear(g);
    useIt(g, "Rubble");
    clear(g);
    beat();
    process.stderr.write(`Mine cleared: ${JSON.stringify(py(g, '[(h["key"], h["level"]) for h in S["party"]]'))} gold ${py(g, 'S["gold"]')}\n`);
    py(g, 'p = instances("Player")[0]; c = [o for o in instances("Chest") if o.item == "mine_key"][0]; p.x, p.y = c.x, c.y + 30');
    step(g, 2);
    tap(g, "z");
    clear(g);
    useIt(g, "Lift");
    step(g, 4);
    expect(room(g)).toBe("MineDeep");
    beat();
    py(g, "rest_party()");
    bump(g, "Golem");
    clear(g);
    for (let i = 0; i < 40 && room(g) !== "Battle"; i++) step(g, 1);
    expect(room(g)).toBe("Battle");
    const boss = fightWell(g);
    process.stderr.write(`Golem: ${JSON.stringify(boss)} ${JSON.stringify(py(g, '[(h["key"], h["level"], h["hp"], h["mp"]) for h in S["party"]]'))}\n`);
    expect(boss.end).toBe("MineDeep");
    clear(g);
    expect(py(g, 'flag("golem_beaten")')).toBe(true);
    expect(py(g, 'S["quests"]["ember_mine"]')).toBe(4);
    goThrough(g, "Mine");
    expect(py(g, 'instance_number("Jory")')).toBe(0);
    goThrough(g, "Town");
    expect(py(g, 'instance_number("Jory")')).toBe(1);
    useIt(g, "Oona");
    clear(g);
    expect(py(g, 'S["lit"]')).toBe(2);
    expect(py(g, '[l.lit for l in instances("Lantern")]')).toEqual([true, true]);
    expect(py(g, '"ember_mine" in S["done"]')).toBe(true);
    expect(py(g, '"next" in S["quests"]')).toBe(true);
    // Still lit after going away and coming back, when the room is built afresh.
    goThrough(g, "Mine");
    goThrough(g, "Town");
    step(g, 2);
    expect(py(g, '[l.image_index for l in instances("Lantern")]')).toEqual([1, 1]);
  });

  it("every menu's words fit inside it", { timeout: 60_000 }, async () => {
    const g = await start();
    tap(g, "enter");
    step(g, 4);
    clear(g);
    py(g, 'S["lit"] = 1; S["party"].extend([new_hero("pip"), new_hero("bram")]); S["gear"] = list(GEAR); S["items"] = {k: 9 for k in ITEMS}; [start_quest(k) for k in QUESTS]');
    for (const menu of ["items_menu", "gear_menu", "party_menu", "quests_menu", "shop_menu"]) {
      py(g, `${menu}()`);
      step(g);
      // The built-in font at the menus' size 15: 0.6 of that a letter.
      const over = py(g, '" | ".join(w for w, _ in newest_menu().options + [(newest_menu().note, True)] if len(w) * 9 + 16 > newest_menu().w)');
      expect(over, menu).toBe("");
      expect(py(g, "newest_menu().left + newest_menu().w <= VIEW_W and newest_menu().top + newest_menu().height() <= VIEW_H"), menu).toBe(true);
      py(g, "close_menus()");
      step(g);
    }
  });

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

  it("walking into Thornback starts its scene, with no teleporting", { timeout: 60_000 }, async () => {
    const g = await newGame();
    useIt(g, "Oona");
    clear(g);
    goThrough(g, "Forest");
    py(g, 'p = instances("Player")[0]; p.safe = 0; o = instances("Thornback")[0]; p.x, p.y = o.x, o.y + 40');
    g.engine.input.keyDown(KEY_CODE.get("up")!);
    for (let i = 0; i < 60 && !py(g, 'flag("met_thornback")'); i++) step(g);
    g.engine.input.keyUp(KEY_CODE.get("up")!);
    expect(py(g, 'flag("met_thornback")')).toBe(true);
  });

  it("walking steps through all four frames, so the legs move", { timeout: 60_000 }, async () => {
    const g = await newGame();
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    expect(project.sprites.find((s) => s.name === "wren_down")!.frames.length).toBe(4);
    const seen = new Set<number>();
    g.engine.input.keyDown(KEY_CODE.get("down")!);
    for (let i = 0; i < 60; i++) {
      step(g);
      seen.add(Math.floor(py(g, 'instances("Player")[0].image_index') as number) % 4);
    }
    g.engine.input.keyUp(KEY_CODE.get("down")!);
    expect(seen.size).toBe(4);
  });

  it("the shop can be left without buying, by a row on the list", { timeout: 60_000 }, async () => {
    const g = await newGame();
    const gold = py(g, 'S["gold"]') as number;
    useIt(g, "Shopkeeper");
    expect(py(g, 'newest_menu().options[-1][0]')).toBe("Leave");
    step(g, 2);
    tap(g, "up"); // from the top, round to the bottom
    tap(g, "enter");
    step(g, 2);
    expect(py(g, 'instance_exists("MenuBox")')).toBe(false);
    expect(py(g, 'S["gold"]')).toBe(gold);
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
