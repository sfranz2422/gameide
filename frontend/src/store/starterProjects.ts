/**
 * The Starter Projects shelf's games (public/tutorials: top-down.md,
 * point-and-click.md, visual-novel.md): each a small game that already
 * works, for the tutorial to change and grow — unlike the other starters,
 * which are half a game on purpose.
 *
 * Their pictures are in public/starters/, made by scripts/make_starters.py:
 * Kenney's Tiny Town and Tiny Dungeon for the village, and the teacher's
 * own Gemini pictures from the showcase games for the other two. They are
 * fetched, so these build in a browser — and in the tests, which hand
 * fetch the files from public/ (starters.test.ts).
 */
import { blankProject, newEvent, newId, newInstance, newObject, newRoom, newScript, newTileset, type EventKey, type ObjectResource, type Project, type RoomResource, type SpriteResource } from "./project";
import type { Built } from "./templates";

async function file(path: string): Promise<Blob> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Couldn't load ${path} for the starter (${r.status}).`);
  return r.blob();
}

/** A sprite from pictures in public/starters, all one size. */
async function picture(
  p: Project,
  assets: Map<string, Blob>,
  name: string,
  files: string[],
  size: [number, number],
  origin: [number, number] = [0, 0],
  extra: Partial<SpriteResource> = {},
): Promise<SpriteResource> {
  const frames: string[] = [];
  for (const f of files) {
    const id = newId();
    assets.set(id, await file(`starters/${f}`));
    frames.push(id);
  }
  const [w, h] = size;
  const sprite: SpriteResource = {
    id: newId(),
    name,
    width: w,
    height: h,
    originX: origin[0],
    originY: origin[1],
    frames,
    mask: { kind: "auto", left: 0, top: 0, right: w, bottom: h },
    ...extra,
  };
  p.sprites.push(sprite);
  return sprite;
}

function obj(p: Project, name: string, sprite: SpriteResource | null, extra: Partial<ObjectResource> = {}) {
  const o = { ...newObject(name), sprite: sprite?.id ?? null, ...extra };
  p.objects.push(o);
  return o;
}

function ev(o: ObjectResource, key: EventKey, code: string) {
  o.events.push({ ...newEvent(key), code });
}

function script(p: Project, name: string, code: string) {
  const s = newScript(name);
  s.code = code;
  p.scripts.push(s);
}

/** A room's picture behind everything, drawn once at the top-left. */
function backdrop(room: RoomResource, sprite: SpriteResource) {
  const bg = room.layers.find((l) => l.kind === "background");
  if (bg && bg.kind === "background") Object.assign(bg, { sprite: sprite.id, mode: "once", color: null });
}

// ---------------------------------------------------------------- top-down: Village Quest

/*
 * The village, 40 × 30 tiles of Tiny Town (16 px). What each letter is:
 * . grass  , flowers  T tree  t orange tree  b bush  - path
 * R red roof, r its lower edge, W wall, D door (a house is 3 wide)
 * F fence  P the hero (standing on the path)  w the wizard  c a coin  s a slime
 */
export const VILLAGE = [
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "T......,.......T.........,.........b...T",
  "T..RRR......c..........t.......RRR.....T",
  "T..rrr.................T.......rrr..c..T",
  "T..WDW.....b......,............WDW.....T",
  "T...-...........................-......T",
  "T...-------------------------------....T",
  "T..........-.........,........-........T",
  "T..c.......-.......T..........-....c...T",
  "T....t.....-.................--........T",
  "T..........-.....w...........-.........T",
  "T.....,....--------P----------.....,...T",
  "T...............-.....................TT",
  "T....FFFFFF.....-.........c.....t......T",
  "T...............-......................T",
  "T..b.....c......-.......s..........b...T",
  "T...............-..........,...........T",
  "T.......T.......-...........TT.........T",
  "T...,...........-------------..........T",
  "T..........t................-......c...T",
  "T...........................-..........T",
  "T....c.........s....,.......-..........T",
  "T...........................-......t...T",
  "T..TT.......b..........RRR..-..........T",
  "T......................rrr..-....,.....T",
  "T...,.....c............WDW---..........T",
  "T.............t..............c.........T",
  "T..........................b...........T",
  "T....,.........T..............,........T",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
];
/** Tiny Town's cells for each letter, and which are solid. */
export const VILLAGE_TILES: Record<string, number> = { ".": 0, ",": 2, T: 16, t: 15, b: 5, "-": 40, P: 40, R: 53, r: 65, W: 73, D: 74, F: 81 };
export const VILLAGE_SOLID = [3, 4, 5, 15, 16, 27, 28, 48, 49, 50, 52, 53, 54, 60, 61, 62, 64, 65, 66, 72, 73, 75, 76, 77, 79, 80, 81, 82];

export async function topdown(): Promise<Built> {
  const p = blankProject("Village Quest");
  const assets = new Map<string, Blob>();
  const tiles = await file("library/kenney/tiny-town/tiles.png");
  const image = newId();
  assets.set(image, tiles);
  const ts = { ...newTileset("village"), image, imageWidth: 192, imageHeight: 176, tileWidth: 16, tileHeight: 16, solid: [...VILLAGE_SOLID] };
  p.tilesets.push(ts);
  const sHero = await picture(p, assets, "hero", ["topdown/hero.png"], [16, 16], [8, 8], { mask: { kind: "auto", left: 3, top: 4, right: 13, bottom: 15 } });
  const sWizard = await picture(p, assets, "wizard", ["topdown/wizard.png"], [16, 16], [8, 8]);
  const sSlime = await picture(p, assets, "slime", ["topdown/slime.png"], [16, 16], [8, 8], { mask: { kind: "auto", left: 3, top: 5, right: 13, bottom: 15 } });
  const sCoin = await picture(p, assets, "coin", ["topdown/coin.png"], [16, 16], [8, 8], { mask: { kind: "auto", left: 4, top: 3, right: 12, bottom: 13 } });

  const player = obj(p, "Player", sHero, { depth: -10 });
  const wizard = obj(p, "Wizard", sWizard);
  const slime = obj(p, "Slime", sSlime);
  const coin = obj(p, "Coin", sCoin);
  const hud = obj(p, "Hud", null, { depth: -1000 });

  ev(player, { type: "create" }, "self.walk_speed = 1.5   # not speed: that one moves you by itself\nself.home = (self.x, self.y)   # where a slime sends you back to\n");
  ev(player, { type: "step" }, `# Nobody walks off while someone is talking
if dialogue_open():
    return

dx = keyboard_check("right") - keyboard_check("left")
dy = keyboard_check("down") - keyboard_check("up")
if dx != 0:
    self.image_xscale = dx   # face the way we're going

# Trees, houses and fences are solid tiles: walk into them and you stop
move_and_collide(dx * self.walk_speed, 0)
move_and_collide(0, dy * self.walk_speed)
`);
  ev(player, { type: "collision", object: coin.id }, `other.destroy()
global_vars.coins += 1
`);
  ev(player, { type: "collision", object: slime.id }, `# Slimed! Back to where you started
camera_shake(4, 15)
self.x, self.y = self.home
`);

  ev(wizard, { type: "create" }, `self.lines = [
    "Welcome to the village, traveller!",
    "Slimes got into the fields and scattered my gold. Can you find it all?",
]
`);
  ev(wizard, { type: "step" }, `# Close enough to talk? Press Space.
hero = instance_nearest(self.x, self.y, "Player")
if hero and point_distance(self.x, self.y, hero.x, hero.y) < 24:
    if keyboard_check_pressed("space") and not dialogue_open():
        if instance_exists("Coin"):
            for line in self.lines:
                say(line, "Wizard")
        else:
            say("You found every coin! The village thanks you.", "Wizard")
`);

  ev(slime, { type: "create" }, "self.hspeed = 0.6\n");
  ev(slime, { type: "step" }, `# Turn round at anything solid
if not place_free(self.x + self.hspeed * 8, self.y):
    self.hspeed = -self.hspeed
`);

  ev(hud, { type: "game_start" }, "global_vars.coins = 0\nglobal_vars.total = instance_number(\"Coin\")\n");
  ev(hud, { type: "draw_gui" }, `draw_set_color("white")
draw_text(6, 4, f"Coins: {global_vars.coins} / {global_vars.total}")
if global_vars.coins == global_vars.total:
    draw_text(6, 20, "Go and tell the wizard!")
`);

  const room = p.rooms[0]!;
  room.name = "Village";
  room.width = 640;
  room.height = 480;
  room.gridWidth = room.gridHeight = 16;
  room.background = "#5fb84f";
  room.camera = { enabled: true, width: 320, height: 240, follow: player.id, smoothing: 0.2 };
  const ground = { id: newId(), name: "Ground", kind: "tiles" as const, depth: 100, visible: true, locked: false, tileset: ts.id, tiles: {} as Record<string, number> };
  room.layers.unshift(ground);
  VILLAGE.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const tile = VILLAGE_TILES[ch];
      ground.tiles[`${c},${r}`] = tile ?? 0;
      const at = (o: ObjectResource) => room.instances.push(newInstance(room, o.id, c * 16 + 8, r * 16 + 8));
      if (ch === "P") at(player);
      if (ch === "w") at(wizard);
      if (ch === "c") at(coin);
      if (ch === "s") at(slime);
    }),
  );
  room.instances.push(newInstance(room, hud.id, 0, 0));
  return { project: p, assets };
}

// ---------------------------------------------------------------- point and click: The Newsroom

export const ADVENTURE_SCRIPT = `# How the point-and-click works. Clicking somewhere walks Robin there;
# clicking a Spot walks Robin over, and then does what that Spot says.
#
# Each Spot is set up in its own Creation code (click it in the room):
#   self.name     what it's called, shown under the mouse
#   self.text     what Robin says about it
#   self.item     picked up into your things (then the Spot goes)
#   self.goto     a room: walking into the Spot goes there
#   self.needs    an item you must have first; self.locked says why not

# Where Robin can walk in each room: left, top, right, bottom.
FLOOR = {
    "Newsroom": (180, 238, 630, 284),
    "Hallway": (10, 224, 630, 284),
}

# What Robin says about the things you carry, when you click them.
ITEM_TEXT = {
    "notepad": "My reporter's notepad. Story idea: why is everyone so sleepy?",
    "camera": "The paper's instant camera. Every reporter needs one.",
}


def on_floor(x, y):
    left, top, right, bottom = FLOOR[room_name()]
    return clamp(x, left, right), clamp(y, top, bottom)


def act(spot):
    """Robin has walked over to a Spot: do what it says."""
    if spot.needs and spot.needs not in global_vars.items:
        say(spot.locked, "Robin")
    elif spot.item:
        global_vars.items.append(spot.item)
        say(spot.text, "Robin")
        spot.destroy()
    elif spot.goto:
        room_goto(spot.goto)
    else:
        say(spot.text, "Robin")
`;

export async function pointclick(): Promise<Built> {
  const p = blankProject("The Newsroom");
  const assets = new Map<string, Blob>();
  const robinFrames = Array.from({ length: 9 }, (_, i) => `pointclick/robin_${i}.png`);
  const sRobin = await picture(p, assets, "robin", robinFrames, [70, 102], [35, 101], { mask: { kind: "auto", left: 20, top: 70, right: 50, bottom: 102 } });
  const sSpot = await picture(p, assets, "spot", ["pointclick/spot.png"], [32, 32]);
  const sNews = await picture(p, assets, "pic_newsroom", ["pointclick/newsroom.png"], [640, 288]);
  const sHall = await picture(p, assets, "pic_hallway", ["pointclick/hallway.png"], [640, 288]);
  await picture(p, assets, "pic_cafeteria", ["pointclick/cafeteria.png"], [640, 288]);
  await picture(p, assets, "camera", ["pointclick/camera.png"], [66, 38]);
  await picture(p, assets, "notepad", ["pointclick/notepad.png"], [66, 38]);
  script(p, "adventure", ADVENTURE_SCRIPT);

  const robin = obj(p, "Robin", sRobin, { depth: -10 });
  const spot = obj(p, "Spot", sSpot, { depth: 10 });
  const game = obj(p, "Game", null, { depth: -1000 });

  ev(robin, { type: "create" }, `self.image_speed = 0
self.image_index = 6     # standing, facing us
self.goal_x, self.goal_y = self.x, self.y
self.going_to = None     # the Spot to use on arriving
`);
  ev(robin, { type: "step" }, `dx = self.goal_x - self.x
dy = self.goal_y - self.y
far = point_distance(self.x, self.y, self.goal_x, self.goal_y)
if far > 3:
    self.x += dx / far * 3
    self.y += dy / far * 3
    self.image_xscale = 1 if dx > 0 else -1
    self.image_index = (self.image_index + 0.15) % 6      # frames 0-5: the walk
else:
    self.x, self.y = self.goal_x, self.goal_y
    self.image_index = 6
    if self.going_to is not None:
        spot = self.going_to
        self.going_to = None
        act(spot)
`);

  ev(spot, { type: "create" }, `self.visible = False    # Tab shows them
self.name = "thing"
self.text = "Nothing special."
self.item = None
self.goto = None
self.needs = None
self.locked = "I can't, yet."
`);

  ev(game, { type: "game_start" }, 'global_vars.items = ["notepad"]\n');
  ev(game, { type: "step" }, `# Tab shows where the Spots are
for s in instances("Spot"):
    s.visible = keyboard_check("tab")

if dialogue_open() or not mouse_check_pressed("left"):
    return
robin = instances("Robin")[0]

# A click on the things you carry: Robin says what it is
if mouse_y > 288:
    for i, item in enumerate(global_vars.items):
        if 120 + i * 80 <= mouse_x < 120 + i * 80 + 70 and 318 <= mouse_y < 360:
            say(ITEM_TEXT.get(item, "It's a " + item + "."), "Robin")
    return

# A click on a Spot: walk to the floor under it, then use it
spot = collision_point(mouse_x, mouse_y, "Spot")
robin.goal_x, robin.goal_y = on_floor(mouse_x, mouse_y)
robin.going_to = spot
`);
  ev(game, { type: "draw_gui" }, `# The panel under the room: what's under the mouse, and your things
draw_set_color("black")
draw_rect(0, 288, 640, 400)
spot = collision_point(mouse_x, mouse_y, "Spot")
draw_set_color("#d7a8ff")
if spot and mouse_y < 288:
    draw_text(12, 294, spot.name)
for i, item in enumerate(global_vars.items):
    draw_sprite(item, 0, 120 + i * 80, 318)
`);

  // The two rooms. A Spot's box is its x, y and how far it's stretched (the
  // Spot sprite is 32 square). They're persistent: what you picked up stays picked up.
  const news = p.rooms[0]!;
  news.name = "Newsroom";
  const hall = newRoom("Hallway");
  p.rooms.push(hall);
  for (const room of [news, hall]) {
    room.width = 640;
    room.height = 400;
    room.background = "#000000";
    room.persistent = true;
  }
  backdrop(news, sNews);
  backdrop(hall, sHall);
  const put = (room: RoomResource, box: [number, number, number, number], code: string) => {
    const i = newInstance(room, spot.id, box[0], box[1]);
    i.scaleX = box[2] / 32;
    i.scaleY = box[3] / 32;
    i.code = code;
    room.instances.push(i);
  };
  put(news, [224, 100, 64, 68], 'self.name = "computer"\nself.text = "The school computer. It takes four minutes to open a picture of a cat."\n');
  put(news, [328, 40, 130, 98], 'self.name = "bulletin board"\nself.text = "My WEIRD STUFF board. A new lunch lady nobody hired, and everybody yawning."\n');
  put(news, [340, 144, 164, 92], 'self.name = "desk"\nself.text = "My desk. Somewhere under there is last month\'s homework."\n');
  put(news, [536, 28, 48, 32], 'self.name = "camera"\nself.text = "Every reporter needs a camera."\nself.item = "camera"\n');
  put(news, [608, 36, 32, 224], 'self.name = "door"\nself.goto = "Hallway"\n');
  news.instances.push(newInstance(news, robin.id, 300, 262));
  news.instances.push(newInstance(news, game.id, 0, 0));

  put(hall, [0, 40, 72, 172], 'self.name = "stairs"\nself.text = "The stairs to the roof. There\'s a chain across them."\n');
  put(hall, [140, 84, 60, 128], 'self.name = "cafeteria door"\nself.text = "The cafeteria. The story is in there, I can feel it."\nself.needs = "camera"\nself.locked = "Not without my camera. A reporter needs proof."\n');
  put(hall, [212, 92, 108, 124], 'self.name = "lockers"\nself.text = "Rows of lockers. Half the school is asleep against them."\n');
  put(hall, [328, 84, 92, 62], 'self.name = "trophy case"\nself.text = "Trophies for chess, spelling, and a brand-new one for Best Napper."\n');
  put(hall, [378, 152, 40, 52], 'self.name = "water fountain"\nself.text = "The water tastes like pennies."\n');
  put(hall, [428, 84, 64, 128], 'self.name = "office door"\nself.text = "The principal\'s office. He\'s asleep in there. Let him sleep."\n');
  put(hall, [622, 80, 18, 206], 'self.name = "way to the newsroom"\nself.goto = "Newsroom"\n');
  hall.instances.push(newInstance(hall, robin.id, 590, 262));
  hall.instances.push(newInstance(hall, game.id, 0, 0));
  return { project: p, assets };
}

// ---------------------------------------------------------------- visual novel: The Ferryman

export const STORY_SCRIPT = `# The story, one scene at a time. Each scene has:
#   picture   the background: a sprite's name
#   face      who's shown at the side: a sprite's name, or None
#   lines     what's said, in order: (who, words)
#   choices   what you can do next: (what it says, the scene it goes to).
#             No choices: the story ends there.

SCENES = {
    "start": {
        "picture": "landing",
        "face": "marrow_0",
        "lines": [
            ("Marrow", "You're the one with the lantern? Good. The marsh is no place to be in the dark."),
            ("Marrow", "I can row you across to the chapel. Or there's the old boardwalk, if you like your feet wet."),
        ],
        "choices": [("Take the ferry", "ferry"), ("Walk the boardwalk", "reeds")],
    },
    "ferry": {
        "picture": "ferry",
        "face": "marrow_0",
        "lines": [
            ("Marrow", "Sit still, and don't look at the water too long."),
            ("Marrow", "Folk say there's a willow out here that remembers everyone who ever got lost."),
        ],
        "choices": [("Ask about the willow", "willow"), ("Keep quiet", "chapel")],
    },
    "reeds": {
        "picture": "reeds",
        "face": None,
        "lines": [
            ("", "The boardwalk creaks. Little green lights drift between the reeds, closer and closer."),
            ("", "Somewhere ahead, a child is humming."),
        ],
        "choices": [("Follow the humming", "willow"), ("Follow the lights", "lost")],
    },
    "willow": {
        "picture": "willow",
        "face": "pip_0",
        "lines": [
            ("Pip", "You can see me? Nobody sees me any more."),
            ("Pip", "I've been waiting by this tree for ever so long. Will you take me to the chapel?"),
        ],
        "choices": [("Take Pip's hand", "chapel"), ("Leave Pip behind", "lost")],
    },
    "chapel": {
        "picture": "chapel",
        "face": None,
        "lines": [
            ("", "The chapel's door stands open. Inside, someone has lit every candle."),
            ("", "You set your lantern on the altar, and the mist outside begins to thin."),
        ],
        "choices": [("Wait for morning", "dawn")],
    },
    "dawn": {
        "picture": "dawn",
        "face": None,
        "lines": [
            ("", "The sun comes up over the marsh, gold and warm. You made it through the night."),
        ],
        "choices": None,
    },
    "lost": {
        "picture": "reeds",
        "face": "pip_1",
        "lines": [
            ("", "The lights lead you further and further from the path, and the boardwalk ends."),
            ("", "Your lantern flickers, and goes out."),
        ],
        "choices": None,
    },
}


def play(name):
    """Shows a scene: its picture, its lines, then its choices."""
    scene = SCENES[name]
    global_vars.scene = name
    for who, words in scene["lines"]:
        say(words, who or None)
    if scene["choices"]:
        ask("What do you do?", [words for words, goes in scene["choices"]], then=choose)
    else:
        ask("The End", ["Play again"], then=lambda answer: play("start"))


def choose(answer):
    """A choice was picked: on to the scene it goes to."""
    for words, goes in SCENES[global_vars.scene]["choices"]:
        if words == answer:
            play(goes)
`;

export async function novel(): Promise<Built> {
  const p = blankProject("The Ferryman");
  p.settings.pixelScaling = false; // painted pictures: drawn smooth, not in blocks
  const assets = new Map<string, Blob>();
  for (const scene of ["landing", "ferry", "reeds", "willow", "chapel", "dawn"]) await picture(p, assets, scene, [`novel/${scene}.webp`], [960, 540]);
  for (const face of ["marrow", "pip"]) for (const i of [0, 1]) await picture(p, assets, `${face}_${i}`, [`novel/${face}_${i}.webp`], [160, 200]);
  script(p, "story", STORY_SCRIPT);

  const story = obj(p, "Story", null);
  ev(story, { type: "create" }, 'play("start")\n');
  ev(story, { type: "draw" }, `scene = SCENES[global_vars.scene]
draw_sprite(scene["picture"], 0, 0, 0)
if scene["face"]:
    draw_sprite(scene["face"], 0, 24, 24)
`);
  const room = p.rooms[0]!;
  room.name = "Story";
  room.width = 960;
  room.height = 540;
  room.background = "#000000";
  room.instances.push(newInstance(room, story.id, 0, 0));
  return { project: p, assets };
}
