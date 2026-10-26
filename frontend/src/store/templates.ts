/**
 * Projects a student can start from. Each is built fresh — new ids, newly
 * painted pictures — so two projects made from one template share nothing.
 */
import {
  blankProject,
  newEvent,
  newId,
  newInstance,
  newTileset,
  newObject,
  newScript,
  type EventKey,
  type ObjectResource,
  type Project,
  type SpriteResource,
} from "./project";
import { boundsOfBlobs } from "./imageTools";
import { paintStarter, paintStarterTileset, STARTER_SPRITES, STARTER_TILESET } from "./starterArt";

export interface Built {
  project: Project;
  assets: Map<string, Blob>;
}

/** Adds a starter sprite (painting its frames) and returns it. */
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

  const wall = obj(p, "Wall", sWall, { solid: true });
  const coin = obj(p, "Coin", sCoin, { depth: 10 });
  const player = obj(p, "Player", sPlayer, { depth: -10 });
  const hud = obj(p, "Hud", null, { depth: -1000 });

  ev(player, { type: "create" }, "self.move_speed = 4\n");
  ev(player, { type: "step" }, `dx = (keyboard_check("right") - keyboard_check("left")) * self.move_speed
dy = (keyboard_check("down") - keyboard_check("up")) * self.move_speed
move_and_collide(dx, dy, "Wall")
`);
  ev(player, { type: "collision", object: coin.id }, "other.destroy()\nglobal_vars.score += 1\n");
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
  "    ====         E           E          ",
  " P                      *               ",
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

# Move, stopping against walls, floors and solid tiles
if move_and_collide(self.vx, 0):
    self.vx = 0
if move_and_collide(0, self.vy):
    self.vy = 0

# Fell off the world
if self.y > room_height + 64:
    room_restart()
`);
  ev(player, { type: "collision", object: coin.id }, "other.destroy()\nglobal_vars.score += 1\n");
  ev(player, { type: "collision", object: enemy.id }, `# Landing on top squashes it; walking into it doesn't end well
if self.vy > 0 and self.y < other.y:
    other.destroy()
    self.vy = -8
    global_vars.score += 5
else:
    camera_shake(6, 20)
    room_restart()
`);
  ev(coin, { type: "create" }, "self.image_speed = 1\n");
  ev(enemy, { type: "create" }, "self.hspeed = 1.5\n");
  ev(enemy, { type: "step" }, `# Turn round at a wall, or at the edge of a drop
ahead = self.x + self.hspeed * 10
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
  LEVEL.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const x = c * T, y = r * T;
      if (ch === "G") ground.tiles[`${c},${r}`] = 0;
      if (ch === "D") ground.tiles[`${c},${r}`] = 1;
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

export const TEMPLATES: { key: string; label: string; description: string; build: () => Promise<Built> }[] = [
  { key: "empty", label: "Empty game", description: "One empty room. Start from nothing.", build: empty },
  { key: "coins", label: "Collect the coins", description: "A maze, arrow keys, walls and coins.", build: coins },
  { key: "platformer", label: "Platformer", description: "Run, jump and stomp, on a tile map, with a camera.", build: platformer },
  { key: "stress", label: "Stress test", description: "300 bouncing balls, to see how fast it runs.", build: stress },
];
