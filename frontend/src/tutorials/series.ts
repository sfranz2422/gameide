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
import { newEvent, newInstance, newObject, type EventKey, type ObjectResource, type Project } from "../store/project";

/** What one step of a lesson changes, as a careful student would do it. */
export interface Edit {
  /** New objects the step makes: name, and its sprite's name (or null). */
  objects?: { name: string; sprite: string | null }[];
  /** "Object.event" → that event's whole code after the step. Events: create, step, draw, draw_gui, "alarm 0", "collision Enemy". */
  code?: Record<string, string>;
  /** Instances dragged into the first room. */
  place?: { object: string; x: number; y: number }[];
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

/** Applies one step's edits to a project. Sprites and objects are found by name. */
export function applyEdit(p: Project, e: Edit) {
  for (const o of e.objects ?? []) {
    const sprite = o.sprite ? p.sprites.find((s) => s.name === o.sprite) : null;
    if (o.sprite && !sprite) throw new Error(`There's no sprite called ${o.sprite}.`);
    p.objects.push({ ...newObject(o.name), sprite: sprite?.id ?? null });
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
  const room = p.rooms[0]!;
  for (const i of e.place ?? []) {
    const obj = p.objects.find((o) => o.name === i.object);
    if (!obj) throw new Error(`There's no object called ${i.object} to place.`);
    room.instances.push(newInstance(room, obj.id, i.x, i.y));
  }
}

/** Lesson `n`'s starting game: the base, then every earlier lesson's steps in order. */
export function applyLessonsBefore(p: Project, series: Series, n: number) {
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
            "Player.create": 'global_vars.lives = 3\nglobal_vars.score = 0\nif not hasattr(global_vars, "best"):\n    global_vars.best = 0\n',
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

export const SERIES: Series[] = [DODGE];
