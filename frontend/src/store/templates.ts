/**
 * Projects a student can start from. Each is built fresh — new ids, newly
 * painted pictures — so two projects made from one template share nothing.
 */
import { applyLessonsBefore, SERIES, seriesSprites, type Series } from "../tutorials/series";
import {
  blankProject,
  newEvent,
  newId,
  newSound,
  newInstance,
  newTileset,
  newObject,
  newScript,
  type EventKey,
  type ObjectResource,
  type Project,
  type SoundResource,
  type SpriteResource,
} from "./project";
import { autotilePaint } from "../editor/tiles/tileOps";
import { boundsOfBlobs } from "./imageTools";
import { paintStarter, paintStarterTileset, STARTER_SPRITES, STARTER_TILESET } from "./starterArt";
import { starterSoundBlob } from "./starterSounds";
import { cutCells, LIBRARY } from "../library/library";
import { spriteFromFrames } from "./spriteOps";

export interface Built {
  project: Project;
  assets: Map<string, Blob>;
}

/** Adds a starter sprite (painting its frames) and returns it. */
/** A starter sound (store/starterSounds.ts) in the Sounds folder, under its own name. */
export function addStarterSound(project: Project, assets: Map<string, Blob>, key: string): SoundResource {
  const id = newId();
  assets.set(id, starterSoundBlob(key));
  const sound: SoundResource = { ...newSound(key), asset: id };
  project.sounds.push(sound);
  return sound;
}

export async function addStarterSprite(project: Project, assets: Map<string, Blob>, key: string, name?: string): Promise<SpriteResource> {
  const s = STARTER_SPRITES.find((x) => x.key === key)!;
  const blobs = await paintStarter(s);
  const frames = blobs.map((b) => {
    const id = newId();
    assets.set(id, b);
    return id;
  });
  const box = await boundsOfBlobs(blobs);
  const sprite: SpriteResource = {
    id: newId(),
    name: name ?? s.name,
    width: s.width,
    height: s.height,
    originX: s.originX,
    originY: s.originY,
    frames,
    mask: s.circle
      ? { kind: "circle", cx: s.width / 2, cy: s.height / 2, r: Math.min(s.width, s.height) / 2 }
      : { kind: "auto", ...(box ?? { left: 0, top: 0, right: s.width, bottom: s.height }) },
    ...(s.fps ? { fps: s.fps } : {}),
  };
  project.sprites.push(sprite);
  return sprite;
}

function obj(project: Project, name: string, sprite: SpriteResource | null, extra: Partial<ObjectResource> = {}) {
  const o = { ...newObject(name), sprite: sprite?.id ?? null, ...extra };
  project.objects.push(o);
  return o;
}

function ev(o: ObjectResource, key: EventKey, code: string) {
  o.events.push({ ...newEvent(key), code });
}

const MAZE = [
  "####################",
  "#P....c.....#.....c#",
  "#.####.####.#.####.#",
  "#.#c.....c#...#c...#",
  "#.#.#####.#####.##.#",
  "#...#..c..#c.....#.#",
  "###.#.###.#.####.#.#",
  "#c..#...#...#..c.#.#",
  "#.#####.#####.####.#",
  "#.c...#.....c.#....#",
  "#.###.#.#####.#.##.#",
  "#...#...#c....#..#c#",
  "#.#.#####.#####.##.#",
  "#c#.......c........#",
  "####################",
];

async function coins(): Promise<Built> {
  const p = blankProject("Collect the coins");
  const assets = new Map<string, Blob>();
  const sPlayer = await addStarterSprite(p, assets, "player");
  const sWall = await addStarterSprite(p, assets, "wall");
  const sCoin = await addStarterSprite(p, assets, "coin");
  addStarterSound(p, assets, "coin");

  const wall = obj(p, "Wall", sWall, { solid: true });
  const coin = obj(p, "Coin", sCoin, { depth: 10 });
  const player = obj(p, "Player", sPlayer, { depth: -10 });
  const hud = obj(p, "Hud", null, { depth: -1000 });

  ev(player, { type: "create" }, "self.move_speed = 4\n");
  ev(player, { type: "step" }, `dx = (keyboard_check("right") - keyboard_check("left")) * self.move_speed
dy = (keyboard_check("down") - keyboard_check("up")) * self.move_speed
move_and_collide(dx, dy, "Wall")
`);
  ev(player, { type: "collision", object: coin.id }, 'other.destroy()\nglobal_vars.score += 1\nsound_play("coin")\n');
  ev(hud, { type: "game_start" }, 'global_vars.score = 0\nglobal_vars.total = instance_number("Coin")\n');
  ev(hud, { type: "draw_gui" }, `draw_set_color("white")
draw_text(8, 452, f"Coins: {global_vars.score} / {global_vars.total}")
if not instance_exists("Coin"):
    draw_set_color("yellow")
    draw_text(250, 220, "You got them all!  (R to play again)")
`);
  ev(hud, { type: "key", kind: "pressed", key: "r" }, "game_restart()\n");

  const room = p.rooms[0]!;
  room.name = "Maze";
  room.background = "#0f172a";
  const T = 32;
  MAZE.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const x = c * T, y = r * T;
      if (ch === "#") room.instances.push(newInstance(room, wall.id, x, y));
      if (ch === "c") room.instances.push(newInstance(room, coin.id, x + 16, y + 16));
      if (ch === "P") room.instances.push(newInstance(room, player.id, x + 4, y + 4));
    }),
  );
  room.instances.push(newInstance(room, hud.id, 0, 0));
  return { project: p, assets };
}

async function stress(): Promise<Built> {
  const p = blankProject("Stress test");
  const assets = new Map<string, Blob>();
  const sBall = await addStarterSprite(p, assets, "ball");
  const sBlock = await addStarterSprite(p, assets, "block");
  const ball = obj(p, "Ball", sBall);
  const block = obj(p, "Block", sBlock);
  const spawner = obj(p, "Spawner", null, { depth: -100 });
  const script = newScript("spawning");
  script.code = `import random

def spawn(n):
    for _ in range(n):
        while True:
            x = random.uniform(10, room_width - 10)
            y = random.uniform(10, room_height - 10)
            ball = instance_create(x, y, "Ball")
            if not ball.place_meeting(x, y, "Block"):
                break
            ball.destroy()
`;
  p.scripts.push(script);
  ev(ball, { type: "create" }, "self.speed = random.uniform(1.5, 4)\nself.direction = random.uniform(0, 360)\n");
  ev(ball, { type: "step" }, `if self.x < 6 or self.x > room_width - 6:
    self.hspeed = -self.hspeed
if self.y < 6 or self.y > room_height - 6:
    self.vspeed = -self.vspeed
`);
  ev(ball, { type: "collision", object: block.id }, `# Bounce off the side it came in through.
if self.xprevious + 6 <= other.x or self.xprevious - 6 >= other.x + 64:
    self.hspeed = -self.hspeed
else:
    self.vspeed = -self.vspeed
self.x = self.xprevious
self.y = self.yprevious
`);
  ev(spawner, { type: "create" }, "spawn(300)\n");
  ev(spawner, { type: "key", kind: "pressed", key: "space" }, "spawn(100)\n");
  ev(spawner, { type: "key", kind: "pressed", key: "backspace" }, 'for ball in instances("Ball")[:100]:\n    ball.destroy()\n');
  ev(spawner, { type: "draw" }, `draw_set_color("white")
draw_text(8, 8, f"{instance_number('Ball')} balls — Space adds 100, Backspace removes 100")
`);
  const room = p.rooms[0]!;
  room.name = "Arena";
  room.width = 800;
  room.height = 600;
  room.background = "#020617";
  for (const [x, y] of [[160, 140], [576, 140], [368, 268], [160, 396], [576, 396]])
    room.instances.push(newInstance(room, block.id, x!, y!));
  room.instances.push(newInstance(room, spawner.id, 0, 0));
  return { project: p, assets };
}

/** The starter tileset, added to a project (picture painted, solid tiles set). */
export async function addStarterTileset(project: Project, assets: Map<string, Blob>) {
  const t = STARTER_TILESET;
  const image = newId();
  assets.set(image, await paintStarterTileset());
  const ts = {
    ...newTileset(t.name),
    image,
    imageWidth: t.columns * t.tileWidth,
    imageHeight: t.rows * t.tileHeight,
    tileWidth: t.tileWidth,
    tileHeight: t.tileHeight,
    solid: [...t.solid],
    autotiles: t.autotiles.map((a) => ({ id: newId(), name: a.name, tiles: [...a.tiles] })),
  };
  project.tilesets.push(ts);
  return ts;
}

// The platformer's level, 40 × 15 tiles of 32 px: G grass, D dirt,
// = a platform (ends drawn by themselves), B brick, * bush, c coin, P the
// player, E an enemy.
const LEVEL = [
  "                                        ",
  "                                        ",
  "                                        ",
  "                                        ",
  "                              c c c     ",
  "                             =====      ",
  "             c c                        ",
  "            ====        c          c    ",
  "                       BBB        BBB   ",
  "     c                                  ",
  "    ====                                ",
  " P               E      *    E          ",
  "GGGGGGGGGGGG   GGGGGGGGGGGGGGGGG  GGGGGG",
  "DDDDDDDDDDDD   DDDDDDDDDDDDDDDDD  DDDDDD",
  "DDDDDDDDDDDD   DDDDDDDDDDDDDDDDD  DDDDDD",
];

async function platformer(): Promise<Built> {
  const p = blankProject("Platformer");
  const assets = new Map<string, Blob>();
  const terrain = await addStarterTileset(p, assets);
  const sHero = await addStarterSprite(p, assets, "player", "hero");
  // Origin at the feet, in the middle: flipping to face left turns about the
  // centre, and the hero stands on the ground at its y.
  sHero.originX = 12;
  sHero.originY = 24;
  const sCoin = await addStarterSprite(p, assets, "coin");
  const sEnemy = await addStarterSprite(p, assets, "enemy");
  for (const key of ["coin", "jump", "hit"]) addStarterSound(p, assets, key);

  const player = obj(p, "Player", sHero, { depth: -10 });
  const coin = obj(p, "Coin", sCoin);
  const enemy = obj(p, "Enemy", sEnemy);
  const hud = obj(p, "Hud", null, { depth: -1000 });

  ev(player, { type: "create" }, "self.vx = 0\nself.vy = 0\n");
  ev(player, { type: "step" }, `# Left and right
move = keyboard_check("right") - keyboard_check("left")
self.vx = move * 4
if move != 0:
    self.image_xscale = move   # face the way we're going

# Gravity pulls a little more every step, up to a top speed
self.vy = min(self.vy + 0.6, 12)

# Jump, only when standing on something solid
on_ground = not place_free(self.x, self.y + 1)
if on_ground and keyboard_check_pressed("space"):
    self.vy = -11
    sound_play("jump")

# Move, stopping against walls, floors and solid tiles
if move_and_collide(self.vx, 0):
    self.vx = 0
if move_and_collide(0, self.vy):
    self.vy = 0

# Fell off the world
if self.y > room_height + 64:
    room_restart()
`);
  ev(player, { type: "collision", object: coin.id }, 'other.destroy()\nglobal_vars.score += 1\nsound_play("coin")\n');
  ev(player, { type: "collision", object: enemy.id }, `# Landing on top squashes it; walking into it doesn't end well
if self.vy > 0 and self.y < other.y:
    other.destroy()
    self.vy = -8
    global_vars.score += 5
    sound_play("hit")
else:
    camera_shake(6, 20)
    room_restart()
`);
  ev(coin, { type: "create" }, "self.image_speed = 1\n");
  ev(enemy, { type: "create" }, "self.hspeed = 1.5\n");
  ev(enemy, { type: "step" }, `# Turn round at a wall, or at the edge of a drop
ahead = self.x + self.hspeed * 16   # half a tile ahead
if not place_free(ahead, self.y) or place_free(ahead, self.y + 14):
    self.hspeed = -self.hspeed
`);
  ev(hud, { type: "game_start" }, "global_vars.score = 0\n");
  ev(hud, { type: "draw_gui" }, `draw_set_color("white")
draw_text(10, 10, f"Score: {global_vars.score}")
draw_text(10, 30, "Arrows to move, Space to jump")
`);

  const room = p.rooms[0]!;
  room.name = "Level1";
  room.width = 1280;
  room.height = 480;
  room.background = "#7ec8f2";
  room.camera = { enabled: true, width: 640, height: 480, follow: player.id, smoothing: 0.15 };
  const ground = { id: newId(), name: "Ground", kind: "tiles" as const, depth: 100, visible: true, locked: false, tileset: terrain.id, tiles: {} as Record<string, number> };
  room.layers.unshift(ground);
  const T = 32;
  // The ground is painted with the grass autotile set, as a student would
  // with the autotile brush: edges and corners pick themselves.
  const grassCells: [number, number][] = [];
  LEVEL.forEach((row, r) => [...row].forEach((ch, c) => (ch === "G" || ch === "D") && grassCells.push([c, r])));
  ground.tiles = autotilePaint(ground.tiles, grassCells, terrain.autotiles[0]!, { columns: 40, rows: 15 });
  LEVEL.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const x = c * T, y = r * T;
      if (ch === "B") ground.tiles[`${c},${r}`] = 2;
      if (ch === "*") ground.tiles[`${c},${r}`] = 7;
      if (ch === "=") ground.tiles[`${c},${r}`] = row[c - 1] !== "=" ? 4 : row[c + 1] !== "=" ? 6 : 5;
      if (ch === "c") room.instances.push(newInstance(room, coin.id, x + 16, y + 16));
      if (ch === "P") room.instances.push(newInstance(room, player.id, x + 16, y + T));
      if (ch === "E") room.instances.push(newInstance(room, enemy.id, x + 16, y + 20));
    }),
  );
  room.instances.push(newInstance(room, hud.id, 0, 0));
  return { project: p, assets };
}

async function empty(): Promise<Built> {
  return { project: blankProject("My game"), assets: new Map() };
}

/**
 * The games tutorials start from (public/tutorials/*.md, `starter:`): each a
 * template with the part the tutorial teaches taken out. Not offered on My
 * Games' Create New Game — they're half a game on purpose.
 */
async function coinsStart(): Promise<Built> {
  // The maze, walls, coins and a player who moves — but nothing happens on
  // touching a coin, and there's no score: that's the tutorial.
  const built = await coins();
  const p = built.project;
  const player = p.objects.find((o) => o.name === "Player")!;
  player.events = player.events.filter((e) => e.key.type !== "collision");
  const hud = p.objects.find((o) => o.name === "Hud")!;
  p.objects = p.objects.filter((o) => o !== hud);
  for (const r of p.rooms) r.instances = r.instances.filter((i) => i.object !== hud.id);
  return built;
}

async function platformerStart(): Promise<Built> {
  // The level, the hero and the coins — and a Player that doesn't move yet.
  const built = await platformer();
  const p = built.project;
  for (const o of p.objects) if (o.name === "Player") o.events = [];
  const gone = new Set(p.objects.filter((o) => o.name === "Enemy" || o.name === "Hud").map((o) => o.id));
  p.objects = p.objects.filter((o) => !gone.has(o.id));
  for (const r of p.rooms) r.instances = r.instances.filter((i) => !gone.has(i.object));
  return built;
}

async function playerStart(): Promise<Built> {
  // One room, one Player with a sprite, standing in the middle, doing nothing.
  const p = blankProject("My game");
  const assets = new Map<string, Blob>();
  const s = await addStarterSprite(p, assets, "player");
  const player = obj(p, "Player", s);
  p.rooms[0]!.instances.push(newInstance(p.rooms[0]!, player.id, 304, 224));
  return { project: p, assets };
}

async function pythonStart(): Promise<Built> {
  // The Python Basics lessons: one object, Main, in the room, with a Create
  // event to type in. No sprite — nothing to look at but the Console, which
  // is the point: the lessons are about Python, not the game around it.
  const p = blankProject("Python practice");
  const main = obj(p, "Main", null);
  ev(main, { type: "create" }, "# Your code goes here. Press Play to run it.\n");
  p.rooms[0]!.instances.push(newInstance(p.rooms[0]!, main.id, 0, 0));
  return { project: p, assets: new Map() };
}

/** Lesson n of a series (tutorials/series.ts): the base game with every earlier lesson done. */
function seriesStart(series: Series, n: number) {
  return async (): Promise<Built> => {
    const p = blankProject("My game");
    const assets = new Map<string, Blob>();
    for (const key of seriesSprites(series)) await addStarterSprite(p, assets, key);
    applyLessonsBefore(p, series, n);
    return { project: p, assets };
  };
}

// ------------------------------------------------- Building Levels lessons

/*
 * The Getting Started lessons that teach the editor itself (public/tutorials/
 * lv-*.md): art from the library, a tileset, painting a room, walking on it,
 * a bigger world. Each opens with the lessons before it done, made from the
 * library's Kenney art the way a student makes it — so these starters fetch
 * pictures, and run in a browser only (e2e/levels.spec.ts starts every one).
 * The numbers are what each lesson tells the student to choose.
 */
export const LEVELS_ART = {
  pack: "pixel-platformer",
  /** The green astronaut, its two frames: Characters, cells 0 and 1. */
  hero: [0, 1],
  /** Grass tops (0–3) and plain dirt (4, 5, 24, 25) in Tiles: what's solid. */
  solid: [0, 1, 2, 3, 4, 5, 24, 25],
  grass: 2,
  dirt: 4,
  plants: [124, 125, 126],
};

/** Lesson 4's code, as the lesson has the student type it (levels.test.ts holds the two together). */
export const LEVELS_CREATE = "self.vy = 0\n";
export const LEVELS_STEP = [
  'move = keyboard_check("right") - keyboard_check("left")',
  "move_and_collide(move * 3, 0)",
  "",
  "self.vy = min(self.vy + 0.5, 10)",
  "on_ground = not place_free(self.x, self.y + 1)",
  'if on_ground and keyboard_check_pressed("space"):',
  "    self.vy = -9",
  "if move_and_collide(0, self.vy):",
  "    self.vy = 0",
  "",
].join("\n");

function levelsStart(n: number) {
  return async (): Promise<Built> => {
    const p = blankProject("My level");
    const assets = new Map<string, Blob>();
    const room = p.rooms[0]!;
    const pack = LIBRARY.find((x) => x.id === LEVELS_ART.pack)!;
    // 1. Art from the library: the hero sprite, and a Player wearing it.
    if (n >= 1) {
      const sheet = pack.sheets.find((x) => x.name === "Characters")!;
      const frames = await cutCells(sheet, LEVELS_ART.hero);
      const { sprite, assets: made } = await spriteFromFrames(
        { name: "hero", width: sheet.tileWidth, height: sheet.tileHeight, frames, fps: 8, origin: "center" },
        [],
      );
      made.forEach((blob, id) => assets.set(id, blob));
      p.sprites.push(sprite);
      const player = obj(p, "Player", sprite);
      room.instances.push(newInstance(room, player.id, 96, 352));
    }
    // 2. A tileset: the Tiles sheet, named ground, its grass and dirt solid.
    if (n >= 2) {
      const sheet = pack.sheets.find((x) => x.name === "Tiles")!;
      const blob = await (await fetch(sheet.file)).blob();
      const bmp = await createImageBitmap(blob);
      const id = newId();
      assets.set(id, blob);
      p.tilesets.push({
        ...newTileset("ground"),
        image: id,
        imageWidth: bmp.width,
        imageHeight: bmp.height,
        tileWidth: sheet.tileWidth,
        tileHeight: sheet.tileHeight,
        solid: [...LEVELS_ART.solid],
      });
    }
    // 3. Painting: a Ground layer — grass along the bottom with dirt under
    //    it, and a platform — and a Decor layer of plants in front.
    if (n >= 3) {
      const ts = p.tilesets[0]!;
      const rows = Math.floor(room.height / ts.tileHeight), cols = Math.ceil(room.width / ts.tileWidth);
      const ground: Record<string, number> = {};
      for (let c = 0; c < cols; c++) {
        ground[`${c},${rows - 2}`] = LEVELS_ART.grass;
        ground[`${c},${rows - 1}`] = LEVELS_ART.dirt;
      }
      for (let c = 12; c < 17; c++) ground[`${c},${rows - 7}`] = LEVELS_ART.grass;
      const decor: Record<string, number> = {};
      [3, 8, 22].forEach((c, i) => (decor[`${c},${rows - 3}`] = LEVELS_ART.plants[i % LEVELS_ART.plants.length]!));
      room.layers.push(
        { id: newId(), name: "Ground", kind: "tiles", depth: 100, visible: true, locked: false, tileset: ts.id, tiles: ground },
        { id: newId(), name: "Decor", kind: "tiles", depth: 90, visible: true, locked: false, tileset: ts.id, tiles: decor },
      );
    }
    // 4. Walking on it: the Player falls, runs and jumps.
    if (n >= 4) {
      const player = p.objects.find((o) => o.name === "Player")!;
      ev(player, { type: "create" }, LEVELS_CREATE);
      ev(player, { type: "step" }, LEVELS_STEP);
    }
    return { project: p, assets };
  };
}

/** Templates for tutorials only, by their `starter:` name. */
export const TUTORIAL_STARTERS: Record<string, () => Promise<Built>> = {
  ...Object.fromEntries(SERIES.flatMap((s) => s.lessons.map((_, n) => [`${s.name}-${n}`, seriesStart(s, n)]))),
  empty,
  coins,
  platformer,
  "coins-start": coinsStart,
  "platformer-start": platformerStart,
  "player-start": playerStart,
  "python-start": pythonStart,
  ...Object.fromEntries([0, 1, 2, 3, 4].map((n) => [`levels-${n}`, levelsStart(n)])),
};

export const TEMPLATES: { key: string; label: string; description: string; build: () => Promise<Built> }[] = [
  { key: "empty", label: "Empty game", description: "One empty room. Start from nothing.", build: empty },
  { key: "coins", label: "Collect the coins", description: "A maze, arrow keys, walls and coins.", build: coins },
  { key: "platformer", label: "Platformer", description: "Run, jump and stomp, on a tile map, with a camera.", build: platformer },
  { key: "stress", label: "Stress test", description: "300 bouncing balls, to see how fast it runs.", build: stress },
];
