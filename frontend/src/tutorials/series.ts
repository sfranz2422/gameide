/**
 * Tutorial series that build one game a lesson at a time (the Game
 * Elements shelves, after mrLman's microStudio course). Each lesson starts
 * from the game as the lesson before it left it, so a student can start at
 * any lesson — or a teacher assign just one — and still have the game the
 * words describe.
 *
 * One list says what every step of every lesson types and makes (`edits`).
 * The starters are built from it (lesson k's is the base game with every
 * earlier lesson's edits applied), and so is the walkthrough test
 * (series.test.ts), which also holds each lesson's markdown to it: every
 * ```python block a step shows must be in the game's code after that step.
 * Without that, a lesson's code and the next lesson's starter could drift
 * apart and a student would open lesson 4 to find code lesson 3 never had.
 */
import { newEvent, newInstance, newObject, newRoom, newScript, type EventKey, type ObjectResource, type Project } from "../store/project";

/** What one step of a lesson changes, as a careful student would do it. */
export interface Edit {
  /** New rooms; `first` puts it at the top of the list, which makes it where the game starts. */
  rooms?: { name: string; first?: boolean }[];
  /** New objects the step makes: name, its sprite's name (or null), and its parent object's name. */
  objects?: { name: string; sprite: string | null; parent?: string }[];
  /** Scripts, by name → their whole code after the step. */
  scripts?: Record<string, string>;
  /** Events deleted, as "Object.event". */
  remove?: string[];
  /** "Object.event" → that event's whole code after the step. Events: create, step, draw, draw_gui, "alarm 0", "collision Enemy". */
  code?: Record<string, string>;
  /** Instances dragged into a room (Room1 unless it says). */
  place?: { object: string; x: number; y: number; room?: string }[];
}

export interface SeriesLesson {
  /** Its tutorial's key (public/tutorials/<key>.md). */
  key: string;
  /** Step number (from 0) → what that step does. */
  edits: Record<number, Edit>;
}

export interface Series {
  /** The name its starters go by: `<name>-<lesson number from 0>`. */
  name: string;
  /** A series this one carries on from: its first lesson starts where that one's last ended. */
  continues?: Series;
  /** Sprites (starter art keys) the game has from the start. */
  sprites: string[];
  /** The game before the first lesson. */
  base: Edit;
  lessons: SeriesLesson[];
}

/** An event's key from its name in an Edit ("step", "alarm 0", "collision Enemy"). */
export function eventKey(p: Project, name: string): EventKey {
  const [type, arg] = name.split(" ", 2) as [string, string | undefined];
  if (type === "alarm") return { type: "alarm", n: Number(arg) };
  if (type === "collision") {
    const other = p.objects.find((o) => o.name === arg);
    if (!other) throw new Error(`There's no object called ${arg} to collide with.`);
    return { type: "collision", object: other.id };
  }
  return { type: type as "create" };
}

const sameKey = (a: EventKey, b: EventKey) => JSON.stringify(a) === JSON.stringify(b);

/** Every sprite a series' game has from the start, the series it carries on from first. */
export function seriesSprites(series: Series): string[] {
  const before = series.continues ? seriesSprites(series.continues) : [];
  return [...before, ...series.sprites.filter((s) => !before.includes(s))];
}

/** Applies one step's edits to a project. Sprites and objects are found by name. */
export function applyEdit(p: Project, e: Edit) {
  for (const r of e.rooms ?? []) {
    if (r.first) p.rooms.unshift(newRoom(r.name));
    else p.rooms.push(newRoom(r.name));
  }
  for (const o of e.objects ?? []) {
    const sprite = o.sprite ? p.sprites.find((s) => s.name === o.sprite) : null;
    if (o.sprite && !sprite) throw new Error(`There's no sprite called ${o.sprite}.`);
    const parent = o.parent ? p.objects.find((x) => x.name === o.parent) : null;
    if (o.parent && !parent) throw new Error(`There's no object called ${o.parent} to be the parent.`);
    p.objects.push({ ...newObject(o.name), sprite: sprite?.id ?? null, parent: parent?.id ?? null });
  }
  for (const [name, code] of Object.entries(e.scripts ?? {})) {
    const script = p.scripts.find((s) => s.name === name);
    if (script) script.code = code;
    else p.scripts.push({ ...newScript(name), code });
  }
  for (const where of e.remove ?? []) {
    const dot = where.indexOf(".");
    const obj = p.objects.find((o) => o.name === where.slice(0, dot));
    if (!obj) throw new Error(`There's no object called ${where.slice(0, dot)}.`);
    const key = eventKey(p, where.slice(dot + 1));
    obj.events = obj.events.filter((x) => !sameKey(x.key, key));
  }
  for (const [where, code] of Object.entries(e.code ?? {})) {
    const dot = where.indexOf(".");
    const obj: ObjectResource | undefined = p.objects.find((o) => o.name === where.slice(0, dot));
    if (!obj) throw new Error(`There's no object called ${where.slice(0, dot)}.`);
    const key = eventKey(p, where.slice(dot + 1));
    const ev = obj.events.find((x) => sameKey(x.key, key));
    if (ev) ev.code = code;
    else obj.events.push({ ...newEvent(key), code });
  }
  for (const i of e.place ?? []) {
    const obj = p.objects.find((o) => o.name === i.object);
    if (!obj) throw new Error(`There's no object called ${i.object} to place.`);
    // By name: once a title room is made first, the first room isn't the level any more.
    const room = p.rooms.find((r) => r.name === (i.room ?? "Room1"));
    if (!room) throw new Error(`There's no room called ${i.room ?? "Room1"}.`);
    room.instances.push(newInstance(room, obj.id, i.x, i.y));
  }
}

/** Lesson `n`'s starting game: the base, then every earlier lesson's steps in order. */
export function applyLessonsBefore(p: Project, series: Series, n: number) {
  if (series.continues) applyLessonsBefore(p, series.continues, series.continues.lessons.length);
  applyEdit(p, series.base);
  for (const lesson of series.lessons.slice(0, n))
    for (const step of Object.keys(lesson.edits).map(Number).sort((a, b) => a - b)) applyEdit(p, lesson.edits[step]!);
}

// ---------------------------------------------------------------- Game Elements 1: The Basics — a dodging game

const MOVE_ARROWS = `speed = 4
if keyboard_check("left"):
    self.x -= speed
if keyboard_check("right"):
    self.x += speed
if keyboard_check("up"):
    self.y -= speed
if keyboard_check("down"):
    self.y += speed
`;
const MOVE_WASD = `speed = 4
if keyboard_check("left") or keyboard_check("a"):
    self.x -= speed
if keyboard_check("right") or keyboard_check("d"):
    self.x += speed
if keyboard_check("up") or keyboard_check("w"):
    self.y -= speed
if keyboard_check("down") or keyboard_check("s"):
    self.y += speed
`;
const ON_SCREEN = `self.x = clamp(self.x, 0, room_width - 24)
self.y = clamp(self.y, 0, room_height - 24)
`;
const moveXY = (start: string, pad: boolean, run: boolean) => `speed = 4
${run ? 'if keyboard_check("shift") or gamepad_check("b"):\n    speed = 8\n' : ""}move_x = ${start === "pad" ? 'gamepad_axis("left_x")' : "0"}
move_y = ${start === "pad" ? 'gamepad_axis("left_y")' : "0"}
if keyboard_check("left") or keyboard_check("a")${pad ? ' or gamepad_check("left")' : ""}:
    move_x = -1
if keyboard_check("right") or keyboard_check("d")${pad ? ' or gamepad_check("right")' : ""}:
    move_x = 1
if keyboard_check("up") or keyboard_check("w")${pad ? ' or gamepad_check("up")' : ""}:
    move_y = -1
if keyboard_check("down") or keyboard_check("s")${pad ? ' or gamepad_check("down")' : ""}:
    move_y = 1
self.x += move_x * speed
self.y += move_y * speed
${ON_SCREEN}`;

const ENEMY_BACK = `import random
if self.x < -12:
    self.x = room_width + 12
    self.y = random.randint(12, room_height - 12)
`;
const ENEMY_BACK_SCORE = `import random
if self.x < -12:
    self.x = room_width + 12
    self.y = random.randint(12, room_height - 12)
    global_vars.score += 1
`;
const ENEMY_BACK_BEST = `import random
if self.x < -12:
    self.x = room_width + 12
    self.y = random.randint(12, room_height - 12)
    global_vars.score += 1
    global_vars.best = max(global_vars.best, global_vars.score)
`;
const HIT = `global_vars.lives -= 1
other.x = room_width + 12
`;
const HIT_RESTART = HIT + `if global_vars.lives <= 0:
    room_restart()
`;
const HUD = `draw_set_color("white")
draw_text(10, 10, f"Score: {global_vars.score}")
draw_text(10, 30, f"Lives: {global_vars.lives}")
`;
const HUD_BEST = HUD + `draw_text(10, 50, f"Best: {global_vars.best}")
`;
const HUD_TIME = HUD_BEST + `draw_text(10, 70, f"Time: {global_vars.time_left}")
`;
const HUD_OVER = (msg: string) => HUD_TIME + `if global_vars.game_over:
    draw_text(260, 220, ${msg})
`;
const P_CREATE_BEST = `global_vars.lives = 3
global_vars.score = 0
if not hasattr(global_vars, "best"):
    global_vars.best = 0
`;
const TICK = `global_vars.time_left -= 1
if global_vars.time_left > 0:
    self.alarm[0] = 60
`;

export const DODGE: Series = {
  name: "dodge",
  sprites: ["player", "enemy"],
  base: {
    objects: [{ name: "Player", sprite: "player" }, { name: "Enemy", sprite: "enemy" }],
    place: [{ object: "Player", x: 60, y: 228 }],
  },
  lessons: [
    {
      key: "el1-player",
      edits: {
        1: { code: { "Player.step": MOVE_ARROWS } },
        2: { code: { "Player.step": MOVE_WASD } },
        3: { code: { "Player.step": MOVE_WASD + ON_SCREEN } },
      },
    },
    {
      key: "el1-gamepad",
      edits: {
        1: { code: { "Player.step": moveXY("zero", false, false) } },
        2: { code: { "Player.step": moveXY("pad", false, false) } },
        3: { code: { "Player.step": moveXY("pad", true, false) } },
        4: { code: { "Player.step": moveXY("pad", true, true) } },
      },
    },
    {
      key: "el1-enemy",
      edits: {
        1: {
          code: { "Enemy.create": "self.hspeed = -3\n" },
          place: [{ object: "Enemy", x: 560, y: 80 }, { object: "Enemy", x: 600, y: 240 }, { object: "Enemy", x: 580, y: 400 }],
        },
        2: { code: { "Enemy.step": ENEMY_BACK } },
        3: { code: { "Enemy.create": "import random\nself.hspeed = -random.randint(2, 5)\n" } },
        4: { code: { "Enemy.create": "import random\nself.hspeed = -random.randint(2, 5)\nself.y = random.randint(12, room_height - 12)\n" } },
      },
    },
    {
      key: "el1-collisions",
      edits: {
        1: { code: { "Player.create": "global_vars.lives = 3\n", "Player.collision Enemy": HIT } },
        2: { code: { "Player.collision Enemy": HIT_RESTART } },
        3: { code: { "Player.collision Enemy": HIT_RESTART + 'self.flash("white", 10)\n' } },
      },
    },
    {
      key: "el1-score",
      edits: {
        1: { code: { "Player.create": "global_vars.lives = 3\nglobal_vars.score = 0\n", "Enemy.step": ENEMY_BACK_SCORE } },
        2: { objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": HUD } },
        3: {
          code: {
            "Player.create": P_CREATE_BEST,
            "Enemy.step": ENEMY_BACK_BEST,
            "Hud.draw_gui": HUD_BEST,
          },
        },
      },
    },
    {
      key: "el1-time-limit",
      edits: {
        1: { code: { "Hud.create": "global_vars.time_left = 30\nself.alarm[0] = 60\n", "Hud.alarm 0": TICK, "Hud.draw_gui": HUD_TIME } },
        2: {
          code: {
            "Hud.create": "global_vars.time_left = 30\nglobal_vars.game_over = False\nself.alarm[0] = 60\n",
            "Hud.alarm 0": TICK + "else:\n    global_vars.game_over = True\n    game_pause()\n",
            "Hud.draw_gui": HUD_OVER('"Time\'s up!"'),
          },
        },
        3: {
          code: {
            "Hud.create": "global_vars.time_left = 30\nglobal_vars.game_over = False\nself.alarm[0] = 60\nself.ignore_pause = True\n",
            "Hud.step": 'if global_vars.game_over and keyboard_check_pressed("space"):\n    game_restart()\n',
          },
        },
        4: { code: { "Hud.draw_gui": HUD_OVER('f"Time\'s up! You scored {global_vars.score}"') } },
      },
    },
  ],
};

// ---------------------------------------------------------------- Game Elements 2: Adding to the Fun — the same game, carried on

const TITLE_DRAW = `draw_set_color("white")
draw_set_halign("center")
draw_text(320, 160, "DODGE")
draw_text(320, 260, "Press Space to start")
`;
const startKeys = (enter: boolean) => `if keyboard_check_pressed("space")${enter ? ' or keyboard_check_pressed("enter")' : ""}:
    room_goto("Room1")
`;
const RANDOM_XY = (who: string) => `${who}.x = random.randint(40, room_width - 40)
${who}.y = random.randint(40, room_height - 40)
`;
const SCORE_COIN = `global_vars.score += 5
global_vars.best = max(global_vars.best, global_vars.score)
`;
const PLACES = `import random


def move_to_random_place(thing):
    thing.x = random.randint(40, room_width - 40)
    thing.y = random.randint(40, room_height - 40)
`;
const fire = (pad: "none" | "a" | "own") => `if self.cooldown > 0:
    self.cooldown -= 1
if ${pad === "none" ? 'keyboard_check("space")' : pad === "a" ? '(keyboard_check("space") or gamepad_check("a"))' : '(keyboard_check(self.fire_key) or gamepad_check("a", self.pad))'} and self.cooldown == 0:
    instance_create(self.x + 24, self.y + 12, "Bullet")
    self.cooldown = 15
`;
const P_STEP_L1 = moveXY("pad", true, true);
const P_STEP_OWN_KEYS = `speed = 4
if keyboard_check(self.run_key) or gamepad_check("b", self.pad):
    speed = 8
move_x = gamepad_axis("left_x", self.pad)
move_y = gamepad_axis("left_y", self.pad)
if keyboard_check(self.left_key) or gamepad_check("left", self.pad):
    move_x = -1
if keyboard_check(self.right_key) or gamepad_check("right", self.pad):
    move_x = 1
if keyboard_check(self.up_key) or gamepad_check("up", self.pad):
    move_y = -1
if keyboard_check(self.down_key) or gamepad_check("down", self.pad):
    move_y = 1
self.x += move_x * speed
self.y += move_y * speed
${ON_SCREEN}${fire("own")}`;
const OWN_KEYS = `self.left_key = "left"
self.right_key = "right"
self.up_key = "up"
self.down_key = "down"
self.run_key = "shift"
self.fire_key = "space"
self.pad = 0
`;
const P2_CREATE = `super().on_create()
self.left_key = "a"
self.right_key = "d"
self.up_key = "w"
self.down_key = "s"
self.run_key = "q"
self.fire_key = "f"
self.pad = 1
`;
const BULLET_HIT = `self.destroy()
other.x = room_width + 12
global_vars.score += 1
global_vars.best = max(global_vars.best, global_vars.score)
`;
const FASTER = ENEMY_BACK_BEST + `    self.hspeed -= 0.5
`;
const NEW_ENEMY = `instance_create(room_width + 12, room_height / 2, "Enemy")
self.alarm[1] = 300
`;
const HUD_CREATE_L1 = "global_vars.time_left = 30\nglobal_vars.game_over = False\nself.alarm[0] = 60\nself.ignore_pause = True\n";
const END_DRAW = `draw_set_color("white")
draw_set_halign("center")
draw_text(320, 160, "GAME OVER")
draw_text(320, 220, f"Score: {global_vars.score}")
draw_text(320, 250, f"Best: {global_vars.best}")
draw_text(320, 320, "Press Space to play again")
`;

export const DODGE2: Series = {
  name: "dodge2",
  continues: DODGE,
  sprites: ["coin", "bullet"],
  base: {},
  lessons: [
    {
      key: "el2-title-screen",
      edits: {
        1: { rooms: [{ name: "Title", first: true }] },
        2: { objects: [{ name: "TitleScreen", sprite: null }], place: [{ object: "TitleScreen", x: 0, y: 0, room: "Title" }], code: { "TitleScreen.draw_gui": TITLE_DRAW } },
        3: { code: { "TitleScreen.step": startKeys(false) } },
        4: { code: { "TitleScreen.step": startKeys(true) } },
      },
    },
    {
      key: "el2-collecting",
      edits: {
        1: { objects: [{ name: "Coin", sprite: "coin" }], place: [{ object: "Coin", x: 320, y: 120 }], code: { "Coin.create": "import random\n" + RANDOM_XY("self") } },
        2: { code: { "Player.collision Coin": "import random\n" + SCORE_COIN + RANDOM_XY("other") } },
        3: {
          scripts: { places: PLACES },
          code: { "Coin.create": "move_to_random_place(self)\n", "Player.collision Coin": SCORE_COIN + "move_to_random_place(other)\n" },
        },
        4: { code: { "Player.collision Coin": SCORE_COIN + "move_to_random_place(other)\nglobal_vars.time_left += 1\n" } },
      },
    },
    {
      key: "el2-projectile",
      edits: {
        1: {
          objects: [{ name: "Bullet", sprite: "bullet" }],
          code: { "Bullet.create": "self.hspeed = 10\n", "Player.create": P_CREATE_BEST + "self.cooldown = 0\n", "Player.step": P_STEP_L1 + fire("none") },
        },
        2: { code: { "Bullet.outside_room": "self.destroy()\n" } },
        3: { code: { "Bullet.collision Enemy": BULLET_HIT } },
        4: { code: { "Player.step": P_STEP_L1 + fire("a") } },
      },
    },
    {
      key: "el2-difficulty",
      edits: {
        1: { code: { "Enemy.step": FASTER } },
        2: { code: { "Enemy.step": FASTER + "    self.hspeed = max(self.hspeed, -12)\n" } },
        3: { code: { "Hud.create": HUD_CREATE_L1 + "self.alarm[1] = 300\n", "Hud.alarm 1": NEW_ENEMY } },
        4: { code: { "Hud.alarm 1": NEW_ENEMY + "global_vars.time_left += 5\n" } },
      },
    },
    {
      key: "el2-multiplayer",
      edits: {
        1: { code: { "Player.create": P_CREATE_BEST + "self.cooldown = 0\n" + OWN_KEYS, "Player.step": P_STEP_OWN_KEYS } },
        2: { objects: [{ name: "Player2", sprite: "player", parent: "Player" }], place: [{ object: "Player2", x: 60, y: 300 }], code: { "Player2.create": P2_CREATE } },
        3: { code: { "Player2.create": P2_CREATE + 'self.image_blend = "orange"\n' } },
      },
    },
    {
      key: "el2-end-screen",
      edits: {
        1: {
          rooms: [{ name: "GameOver" }],
          objects: [{ name: "EndScreen", sprite: null }],
          place: [{ object: "EndScreen", x: 0, y: 0, room: "GameOver" }],
          code: { "EndScreen.draw_gui": END_DRAW, "EndScreen.step": 'if keyboard_check_pressed("space"):\n    room_goto("Title")\n' },
        },
        2: {
          code: {
            "Hud.alarm 0": TICK + 'else:\n    room_goto("GameOver")\n',
            "Player.collision Enemy": 'global_vars.lives -= 1\nother.x = room_width + 12\nif global_vars.lives <= 0:\n    room_goto("GameOver")\nself.flash("white", 10)\n',
          },
        },
        3: { remove: ["Hud.step"], code: { "Hud.create": "global_vars.time_left = 30\nself.alarm[0] = 60\nself.alarm[1] = 300\n", "Hud.draw_gui": HUD_TIME } },
        4: {
          code: {
            "EndScreen.create": 'save_set("best", global_vars.best)\n',
            "Player.create": P_CREATE_BEST.replace("global_vars.best = 0", 'global_vars.best = save_get("best", 0)') + "self.cooldown = 0\n" + OWN_KEYS,
          },
        },
      },
    },
  ],
};

export const SERIES: Series[] = [DODGE, DODGE2];
