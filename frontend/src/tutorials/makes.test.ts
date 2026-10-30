/**
 * The "Now You Can Make" tutorials (public/tutorials/make-*.md) done step by
 * step from an empty game, as a careful student would: each step's edits
 * made (with the code taken from that step's own ```python blocks, put
 * where its words say), and then —
 *
 *   - every block the step shows is in the game's code,
 *   - the step's checks didn't all pass before it (a check that passes on
 *     its own teaches nothing), and
 *   - every one of them passes after it, the ones that play the game in the
 *     real Pyodide.
 *
 * Starter sprites are painted on a canvas, which node hasn't got: here
 * they're empty pictures with their real sizes, which is all collisions need.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame, checkProject, readCheck, type Check } from "../checks/checks";
import { addStarterSprite, TUTORIAL_STARTERS } from "../store/templates";
import { newId, newTileset, type Project } from "../store/project";
import { autotilePaint, rectCells } from "../editor/tiles/tileOps";
import { nodeRunner } from "./nodeRunner";
import { KEY_CODE } from "../engine/input";
import { PythonGame } from "../python/bridge";
import { buildGame } from "../python/codegen";
import { applyEdit, type Edit } from "./series";
import { MAKE_LEVEL, parseTutorial, type Step } from "./tutorial";

vi.mock("../store/starterArt", async (original) => ({
  ...(await original<typeof import("../store/starterArt")>()),
  paintStarter: async () => [],
}));

const DIR = join(__dirname, "../../public/tutorials");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; level: string; after?: string; starter: string }[];

/** The step's ```python blocks, in order. */
const blocks = (step: Step) => [...step.md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);
const lines = (code: string) => code.split("\n").map((l) => l.trim()).filter(Boolean);
function contains(code: string, block: string) {
  const c = lines(code), b = lines(block);
  for (let i = 0; i + b.length <= c.length; i++) if (b.every((l, j) => c[i + j] === l)) return true;
  return false;
}

/** What a step does: an Edit, ready-made sprites to add, and anything else (tilesets, painted tiles) by hand. */
type MakeStep = Edit & { sprites?: string[]; also?: (p: Project) => void };
/** For each tutorial, step number → what it does, given that step's python blocks and the game so far. */
type Steps = Record<number, (b: string[], code: (where: string) => string) => MakeStep>;

const MAKES: Record<string, Steps> = {
  "make-coin-rush": {
    1: () => ({ sprites: ["player"], objects: [{ name: "Player", sprite: "player" }], place: [{ object: "Player", x: 300, y: 220 }] }),
    2: ([move]) => ({ code: { "Player.step": move! } }),
    3: ([create]) => ({
      sprites: ["coin"],
      objects: [{ name: "Coin", sprite: "coin" }],
      place: [{ object: "Coin", x: 120, y: 100 }],
      code: { "Coin.create": create! },
    }),
    4: ([score, grab]) => ({ code: { "Player.create": score!, "Player.collision Coin": grab! } }),
    5: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    6: ([create, alarm, line], code) => ({
      code: { "Hud.create": create!, "Hud.alarm 0": alarm!, "Hud.draw_gui": code("Hud.draw_gui") + line! },
    }),
    7: ([top, shown], code) => ({ code: { "Player.step": top! + code("Player.step"), "Hud.draw_gui": code("Hud.draw_gui") + shown! } }),
  },
  "make-bomb-dodge": {
    1: ([move]) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      place: [{ object: "Player", x: 308, y: 440 }],
      code: { "Player.step": move! },
    }),
    2: ([create]) => ({ sprites: ["bomb"], objects: [{ name: "Bomb", sprite: "bomb" }], code: { "Bomb.create": create! } }),
    3: ([create, alarm]) => ({
      objects: [{ name: "Spawner", sprite: null }],
      place: [{ object: "Spawner", x: 0, y: 0 }],
      code: { "Spawner.create": create!, "Spawner.alarm 0": alarm! },
    }),
    4: ([create, step]) => ({ code: { "Player.create": create!, "Bomb.step": step! } }),
    5: ([hit]) => ({ code: { "Player.collision Bomb": hit! } }),
    6: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    7: ([top, spawn, shown], code) => {
      const alarm = code("Spawner.alarm 0");
      const make = 'instance_create(random.randint(8, room_width - 8), -10, "Bomb")\n';
      expect(alarm).toContain(make);
      return {
        code: {
          "Player.step": top! + code("Player.step"),
          "Spawner.alarm 0": alarm.replace(make, spawn!),
          "Hud.draw_gui": code("Hud.draw_gui") + shown!,
        },
      };
    },
    8: ([wait, speed], code) => {
      expect(code("Spawner.alarm 0")).toContain("self.alarm[0] = 30\n");
      return {
        code: {
          "Spawner.alarm 0": code("Spawner.alarm 0").replace("self.alarm[0] = 30\n", wait!),
          "Bomb.create": speed!,
        },
      };
    },
  },
  "make-busy-road": {
    1: ([hop]) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      place: [{ object: "Player", x: 292, y: 452 }],
      code: { "Player.step": hop! },
    }),
    2: ([create, step]) => ({
      sprites: ["car"],
      objects: [{ name: "Car", sprite: "car" }],
      // Cars' middles on rows 3 to 12; some lanes with two, gaps between.
      place: [3, 4, 5, 7, 8, 10, 12, 12].map((row, i) => ({ object: "Car", x: 60 + ((i * 170) % 560), y: row * 32 + 16 })),
      code: { "Car.create": create!, "Car.step": step! },
    }),
    3: ([create]) => ({ code: { "Car.create": create! } }),
    4: ([create, hit]) => ({ code: { "Player.create": create!, "Player.collision Car": hit! } }),
    5: ([across], code) => ({ code: { "Player.step": code("Player.step") + across! } }),
    6: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    7: ([top, shown], code) => ({ code: { "Player.step": top! + code("Player.step"), "Hud.draw_gui": code("Hud.draw_gui") + shown! } }),
    8: ([faster], code) => ({ code: { "Car.step": code("Car.step") + faster! } }),
  },
  "make-paddle-duel": {
    1: ([create, step]) => ({
      sprites: ["paddle"],
      objects: [{ name: "Paddle", sprite: "paddle" }],
      place: [{ object: "Paddle", x: 24, y: 208 }],
      code: { "Paddle.create": create!, "Paddle.step": step! },
    }),
    2: ([create]) => ({
      objects: [{ name: "Paddle2", sprite: "paddle", parent: "Paddle" }],
      place: [{ object: "Paddle2", x: 604, y: 208 }],
      code: { "Paddle2.create": create! },
    }),
    3: ([create, step]) => ({
      sprites: ["ball"],
      objects: [{ name: "Ball", sprite: "ball" }],
      place: [{ object: "Ball", x: 320, y: 240 }],
      code: { "Ball.create": create!, "Ball.step": step! },
    }),
    4: ([hit]) => ({ code: { "Ball.collision Paddle": hit! } }),
    5: ([rules, create, scoring], code) => ({ scripts: { rules: rules! }, code: { "Ball.create": create!, "Ball.step": code("Ball.step") + scoring! } }),
    6: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    7: ([top, shown], code) => ({ code: { "Ball.step": top! + code("Ball.step"), "Hud.draw_gui": code("Hud.draw_gui") + shown! } }),
  },
  "make-ledge-runner": {
    1: ([level]) => ({
      sprites: ["wall"],
      objects: [{ name: "Wall", sprite: "wall", solid: true }, { name: "Level", sprite: null }],
      roomSettings: { Room1: { width: 1280 } },
      place: [{ object: "Level", x: 0, y: 0 }],
      code: { "Level.create": level! },
    }),
    2: ([elif, create, step], code) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      code: { "Level.create": code("Level.create") + elif!, "Player.create": create!, "Player.step": step! },
    }),
    3: ([more], code) => ({ code: { "Player.step": code("Player.step") + more! } }),
    4: () => ({ roomSettings: { Room1: { camera: { enabled: true, follow: "Player" } } } }),
    5: ([elif, start, take], code) => ({
      sprites: ["coin"],
      objects: [{ name: "Coin", sprite: "coin" }],
      code: { "Level.create": code("Level.create") + elif!, "Player.create": code("Player.create") + start!, "Player.collision Coin": take! },
    }),
    6: ([elif, create, step, stomp], code) => ({
      sprites: ["enemy"],
      objects: [{ name: "Crawler", sprite: "enemy" }],
      code: { "Level.create": code("Level.create") + elif!, "Crawler.create": create!, "Crawler.step": step!, "Player.collision Crawler": stomp! },
    }),
    7: ([elif, win, start, top], code) => ({
      sprites: ["flag"],
      objects: [{ name: "Flag", sprite: "flag" }],
      code: {
        "Level.create": code("Level.create") + elif!,
        "Player.collision Flag": win!,
        "Player.create": code("Player.create") + start!,
        "Player.step": top! + code("Player.step"),
      },
    }),
    8: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
  },
  "make-crypt-of-keys": {
    1: ([level]) => ({
      sprites: ["wall"],
      objects: [{ name: "Wall", sprite: "wall", solid: true }, { name: "Level", sprite: null }],
      place: [{ object: "Level", x: 0, y: 0 }],
      code: { "Level.create": level! },
    }),
    2: ([elif, create, step], code) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      code: { "Level.create": code("Level.create") + elif!, "Player.create": create!, "Player.step": step! },
    }),
    3: ([elif, keys, take, open], code) => ({
      sprites: ["key", "door"],
      objects: [{ name: "Key", sprite: "key" }, { name: "Door", sprite: "door", solid: true }],
      code: {
        "Level.create": code("Level.create") + elif!,
        "Player.create": code("Player.create") + keys!,
        "Player.collision Key": take!,
        "Player.step": code("Player.step") + open!,
      },
    }),
    4: ([elif, step], code) => ({
      sprites: ["enemy"],
      objects: [{ name: "Slime", sprite: "enemy" }],
      code: { "Level.create": code("Level.create") + elif!, "Slime.step": step! },
    }),
    5: ([create, alarm, hit, swing], code) => ({
      sprites: ["slash"],
      objects: [{ name: "Slash", sprite: "slash" }],
      code: { "Slash.create": create!, "Slash.alarm 0": alarm!, "Slash.collision Slime": hit!, "Player.step": code("Player.step") + swing! },
    }),
    6: ([start, hurt, count, draw], code) => ({
      sprites: ["heart"],
      objects: [{ name: "Hud", sprite: null }],
      place: [{ object: "Hud", x: 0, y: 0 }],
      code: {
        "Player.create": code("Player.create") + start!,
        "Player.collision Slime": hurt!,
        "Player.step": code("Player.step") + count!,
        "Hud.draw_gui": draw!,
      },
    }),
    7: ([elif, grab, start, top, shown], code) => ({
      sprites: ["gem"],
      objects: [{ name: "Gem", sprite: "gem" }],
      code: {
        "Level.create": code("Level.create") + elif!,
        "Player.collision Gem": grab!,
        "Player.create": code("Player.create") + start!,
        "Player.step": top! + code("Player.step"),
        "Hud.draw_gui": code("Hud.draw_gui") + shown!,
      },
    }),
  },
  "make-alley-brawl": {
    1: ([draw]) => ({
      roomSettings: { Room1: { width: 1920 } },
      objects: [{ name: "Street", sprite: null }],
      place: [{ object: "Street", x: 0, y: 0 }],
      code: { "Street.draw": draw! },
    }),
    2: ([create, step]) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      place: [{ object: "Player", x: 60, y: 340 }],
      code: { "Player.create": create!, "Player.step": step! },
    }),
    3: () => ({ roomSettings: { Room1: { camera: { enabled: true, follow: "Player" } } } }),
    4: ([create, step]) => ({
      sprites: ["enemy"],
      objects: [{ name: "Thug", sprite: "enemy" }],
      place: [400, 700, 1000, 1250, 1500, 1800].map((x, i) => ({ object: "Thug", x, y: i % 2 ? 400 : 300 })),
      code: { "Thug.create": create!, "Thug.step": step! },
    }),
    5: ([create, alarm, hit, punch], code) => ({
      sprites: ["slash"],
      objects: [{ name: "Punch", sprite: "slash" }],
      code: { "Punch.create": create!, "Punch.alarm 0": alarm!, "Punch.collision Thug": hit!, "Player.step": code("Player.step") + punch! },
    }),
    6: ([attack, draw], code) => ({
      objects: [{ name: "Hud", sprite: null }],
      place: [{ object: "Hud", x: 0, y: 0 }],
      code: { "Thug.step": code("Thug.step") + attack!, "Hud.draw_gui": draw! },
    }),
    7: ([top, shown], code) => ({ code: { "Player.step": top! + code("Player.step"), "Hud.draw_gui": code("Hud.draw_gui") + shown! } }),
  },
  "make-moonwell": {
    1: ([maps]) => ({ rooms: [{ name: "Room2" }], scripts: { maps: maps! } }),
    2: ([level]) => ({
      sprites: ["wall"],
      objects: [{ name: "Wall", sprite: "wall", solid: true }, { name: "Level", sprite: null }],
      place: [
        { object: "Level", x: 0, y: 0 },
        { object: "Level", x: 0, y: 0, room: "Room2" },
      ],
      code: { "Level.create": level! },
    }),
    3: ([elifs, create, step], code) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      code: { "Level.create": code("Level.create") + elifs!, "Player.create": create!, "Player.step": step! },
    }),
    4: ([exits], code) => ({ code: { "Player.step": code("Player.step") + exits! } }),
    5: ([elif, take], code) => ({
      sprites: ["orb"],
      objects: [{ name: "Orb", sprite: "orb" }],
      code: { "Level.create": code("Level.create") + elif!, "Player.collision Orb": take! },
    }),
    6: ([jump], code) => {
      const single = 'if on_ground and keyboard_check_pressed("up"):\n    self.vy = -9\n';
      expect(code("Player.step")).toContain(single);
      return { code: { "Player.step": code("Player.step").replace(single, jump!) } };
    },
    7: ([elif, grab, draw], code) => ({
      sprites: ["gem"],
      objects: [{ name: "Gem", sprite: "gem" }, { name: "Hud", sprite: null }],
      place: [
        { object: "Hud", x: 0, y: 0 },
        { object: "Hud", x: 0, y: 0, room: "Room2" },
      ],
      code: { "Level.create": code("Level.create") + elif!, "Player.collision Gem": grab!, "Hud.draw_gui": draw! },
    }),
  },
};

/** Robot's Garden: the garden as a student paints it, 60 × 45 tiles of 16. */
const GARDEN = { cols: 60, rows: 45, grass: 16, bush: 18, pond: 19 };
const gardenSet = { id: "path", name: "path", tiles: Array.from({ length: 16 }, (_, i) => i) };
const layer = (p: Project, name: string, tiles: Record<string, number>) =>
  p.rooms[0]!.layers.push({ id: newId(), name, kind: "tiles", depth: 100 - p.rooms[0]!.layers.length, visible: true, locked: false, tileset: p.tilesets[0]!.id, tiles });
const loop = [...rectCells(5, 5, 50, 5), ...rectCells(50, 5, 50, 35), ...rectCells(5, 35, 50, 35), ...rectCells(5, 5, 5, 35), ...rectCells(28, 5, 28, 35)];
MAKES["make-robots-garden"] = {
  1: () => ({
    also: (p) =>
      // A picture id, as a student's has (the game leaves out the tile layers of a tileset with none).
      void p.tilesets.push({ ...newTileset("garden"), image: newId(), imageWidth: 128, imageHeight: 48, tileWidth: 16, tileHeight: 16, autotiles: [gardenSet] }),
  }),
  2: () => ({
    roomSettings: { Room1: { width: 960, height: 720 } },
    also: (p) => {
      layer(p, "Grass", Object.fromEntries(rectCells(0, 0, GARDEN.cols - 1, GARDEN.rows - 1).map(([c, r]) => [`${c},${r}`, GARDEN.grass])));
      layer(p, "Paths", autotilePaint({}, loop, gardenSet, { columns: GARDEN.cols, rows: GARDEN.rows }));
    },
  }),
  3: () => ({
    also: (p) => {
      const things: Record<string, number> = {};
      for (let c = 8; c < 26; c += 2) things[`${c},7`] = GARDEN.bush; // a hedge inside the loop's top
      things["40,20"] = things["41,20"] = things["40,21"] = GARDEN.pond;
      things["30,20"] = GARDEN.bush; // the one the play-check walks into
      layer(p, "Things", things);
      p.tilesets[0]!.solid = [GARDEN.bush, GARDEN.pond];
    },
  }),
  4: ([create, step]) => ({
    objects: [{ name: "Robot", sprite: null }], // its sprite is made below, then given to it
    place: [{ object: "Robot", x: 200, y: 400 }],
    code: { "Robot.create": create!, "Robot.step": step! },
    also: (p) => {
      // The robot as the importer makes it: 8 frames of 96 × 128, its feet the origin, its box round the body.
      const robot = { id: newId(), name: "robot", width: 96, height: 128, originX: 48, originY: 127, frames: Array.from({ length: 8 }, newId), fps: 10,
        mask: { kind: "rect" as const, left: 26, top: 14, right: 70, bottom: 128 } };
      p.sprites.push(robot);
      p.objects.find((o) => o.name === "Robot")!.sprite = robot.id;
    },
  }),
  5: ([faster], code) => {
    expect(code("Robot.step")).toMatch(/^speed = 2\n/);
    return { code: { "Robot.step": code("Robot.step").replace(/^speed = 2\n/, faster!) } };
  },
  6: () => ({ roomSettings: { Room1: { camera: { enabled: true, follow: "Robot" } } } }),
  7: ([take, draw]) => ({
    sprites: ["coin"],
    objects: [{ name: "Seed", sprite: "coin" }, { name: "Hud", sprite: null }],
    place: [
      ...[[100, 100], [820, 100], [100, 600], [820, 600], [460, 300], [700, 450], [300, 650], [600, 150], [880, 350], [60, 350]].map(([x, y]) => ({ object: "Seed", x: x!, y: y! })),
      { object: "Hud", x: 0, y: 0 },
    ],
    code: { "Robot.collision Seed": take!, "Hud.draw_gui": draw! },
  }),
  8: ([create, alarm, shown, top], code) => ({
    code: {
      "Hud.create": create!,
      "Hud.alarm 0": alarm!,
      "Hud.draw_gui": code("Hud.draw_gui") + shown!,
      "Robot.step": top! + code("Robot.step"),
    },
  }),
};

/**
 * What each finished game must do that its tutorial's checks can't see:
 * played in the real Pyodide, after the last step.
 */
const PLAYS: Record<string, (g: PythonGame) => void> = {
  // Quicker on a path than on grass; a bush in the way stops it; the clock stops with the last seed.
  "make-robots-garden": (g) => {
    const walk = (x: number, y: number) => {
      run(g, `r = instances('Robot')[0]\nr.x, r.y = ${x}, ${y}`);
      step(g);
      const from = run(g, "r.x");
      g.engine.input.keyDown(KEY_CODE.get("right")!);
      step(g, 30);
      g.engine.input.keyUp(KEY_CODE.get("right")!);
      return run(g, "r.x") - from;
    };
    const onPath = walk(8 * 16, 35 * 16 + 12); // along the loop's bottom
    const onGrass = walk(8 * 16, 25 * 16 + 12);
    expect(onPath, "quicker on the path").toBeGreaterThan(onGrass * 1.3);
    expect(walk(27 * 16, 20 * 16 + 12), "a bush at column 30 stops it").toBeLessThan(50); // free, it goes 60 or more
    run(g, "for s in instances('Seed'): s.destroy()");
    step(g, 2);
    const left = run(g, "global_vars.time");
    step(g, 150);
    expect(run(g, "global_vars.time"), "the clock stops with the last seed").toBe(left);
  },
  // Paddle2 is a Paddle only through its parent: the ball must bounce off it too.
  "make-paddle-duel": (g) => {
    run(g, "b = instances('Ball')[0]\np2 = instances('Paddle2')[0]\nb.x, b.y, b.hspeed, b.vspeed = p2.x - 30, p2.y + 32, 4, 0");
    for (let i = 0; i < 30 && run(g, "b.hspeed") > 0; i++) step(g);
    expect(run(g, "b.hspeed"), "the ball bounces off the right paddle").toBeLessThan(0);
    expect(run(g, "b.x")).toBeLessThan(run(g, "p2.x"));
  },
  // A key opens the door it's next to; without one, the door stays.
  "make-crypt-of-keys": (g) => {
    run(g, "p = instances('Player')[0]\nd = min(instances('Door'), key=lambda d: d.x)\np.x, p.y = d.x - 28, d.y + 4");
    step(g, 5);
    expect(run(g, "instance_number('Door')"), "no key, no opening").toBe(2);
    run(g, "global_vars.keys = 1");
    step(g, 2);
    expect(run(g, "instance_number('Door')")).toBe(1);
    expect(run(g, "global_vars.keys")).toBe(0);
  },
  // The gem's ledge: out of reach of one jump from the step, in reach of two.
  "make-moonwell": (g) => {
    const highest = (double: boolean) => {
      run(g, `global_vars.double_jump = ${double ? "True" : "False"}\np = instances('Player')[0]\np.x, p.y, p.vy = 5 * 32 + 20, 12 * 32 - 24, 0`);
      step(g, 4);
      let top = 999;
      press(g, "up");
      for (let i = 0; i < 70; i++) {
        if (double && i === 16) press(g, "up");
        step(g);
        top = Math.min(top, run(g, "p.y"));
      }
      return top;
    };
    // The ledge under the gem, as the map built it; standing on it, the player's top is 24 above.
    const ledge = run(g, "gem = instances('Gem')[0]\nmin(w.y for w in instances('Wall') if w.x <= gem.x < w.x + 32 and w.y > gem.y)") - 24;
    expect(highest(false), "one jump reaches the ledge").toBeGreaterThan(ledge);
    expect(highest(true), "two jumps don't reach the ledge").toBeLessThanOrEqual(ledge);
  },
};

function step(g: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = g.step();
    if (e) throw new Error(`${e.object} ${e.event} line ${e.line}: ${e.message}`);
  }
}
const run = (g: PythonGame, code: string) => g.evalPython(code) as number;
function press(g: PythonGame, key: string) {
  g.engine.input.keyDown(KEY_CODE.get(key)!);
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
}

/** An event's code in the game so far ("Object.event", as Edit names them), "" if there's none. */
function codeOf(p: Project, where: string) {
  const [name, ev] = [where.slice(0, where.indexOf(".")), where.slice(where.indexOf(".") + 1)];
  const obj = p.objects.find((o) => o.name === name);
  const [type, arg] = ev.split(" ");
  const e = obj?.events.find((x) =>
    x.key.type === type &&
    (type !== "alarm" || (x.key as { n: number }).n === Number(arg)) &&
    (type !== "collision" || (x.key as { object: string }).object === p.objects.find((o) => o.name === arg)?.id));
  return e?.code ?? "";
}

async function passes(p: Project, runner: ReturnType<typeof nodeRunner>, check: Check) {
  const quick = checkProject(p, check);
  if (quick) return quick.ok;
  try {
    return (await checkGame(runner, check)).ok;
  } catch {
    return false;
  }
}

describe("Now You Can Make", () => {
  it("every one is listed after a lesson (or a shelf) that's on the Learn page, and starts from an empty game", () => {
    const makes = index.filter((t) => t.level === MAKE_LEVEL);
    expect(makes.map((t) => t.key).sort()).toEqual(Object.keys(MAKES).sort());
    const lessons = index.filter((t) => t.level !== MAKE_LEVEL);
    const places = new Set([...lessons.map((t) => t.level), ...lessons.map((t) => t.key)]);
    for (const t of makes) {
      expect(places.has(t.after ?? ""), `${t.key} comes after "${t.after}"`).toBe(true);
      const meta = parseTutorial(readFileSync(join(DIR, `${t.key}.md`), "utf8")).meta;
      expect(meta.after, t.key).toBe(t.after);
      expect(meta.starter, t.key).toBe("empty");
    }
  });

  for (const [key, steps] of Object.entries(MAKES)) {
    it(`${key}: doing what each step says passes its checks, and they didn't pass before`, { timeout: 300_000 }, async () => {
      const t = parseTutorial(readFileSync(join(DIR, `${key}.md`), "utf8"));
      const { project } = await TUTORIAL_STARTERS.empty!();
      const runner = nodeRunner(() => project);
      for (const [s, step] of t.steps.entries()) {
        const checks = step.checks.map((c) => ({ label: c.label, check: readCheck(c.label) }));
        for (const c of checks) expect(c.check.kind, `${key} step ${s + 1}: ${c.label}`).not.toBe("unknown");
        const real = checks.filter((c) => c.check.kind !== "runs");
        if (real.length) {
          const before = await Promise.all(real.map((c) => passes(project, runner, c.check)));
          expect(before.every(Boolean), `${key} step ${s + 1} "${step.title}" passes before it's done`).toBe(false);
        }
        const make = steps[s];
        if (make) {
          const edit = make(blocks(step), (where) => codeOf(project, where));
          for (const sprite of edit.sprites ?? []) await addStarterSprite(project, new Map(), sprite);
          applyEdit(project, edit);
          edit.also?.(project);
        }
        const code = [...project.objects.flatMap((o) => o.events.map((e) => e.code)), ...project.scripts.map((x) => x.code)].join("\n\n");
        for (const block of blocks(step)) expect(contains(code, block), `${key} step ${s + 1} shows code the game doesn't have:\n${block}`).toBe(true);
        for (const c of checks) {
          const r = checkProject(project, c.check) ?? (await checkGame(runner, c.check));
          expect(r, `${key} step ${s + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
        }
      }
      runner.stop();
      const play = PLAYS[key];
      if (play) {
        const { game, error } = await PythonGame.load(buildGame(project, new Map()).def);
        if (error) throw new Error(error.message);
        step(game, 2);
        play(game);
        game.dispose();
      }
    });
  }
});
