/**
 * The API catalog: every name a student's Python can use, with its
 * parameters and a one-line description in beginner words.
 *
 * This is the single source of truth the spec asks for. Today it is checked
 * against the runtime both ways (catalog.test.ts: every entry exists in
 * runtime.py with exactly these parameters, and every public name in
 * runtime.py has an entry). Later phases read it to build autocomplete
 * (Phase 2), code blocks (Phase 7: blocks/catalogBlocks.ts makes one per
 * entry), event-sheet pickers (Phase 8) and the in-IDE docs — so a function added here and in runtime.py appears in all of
 * them, and one added to only one of the two fails the test.
 *
 * Functions planned for later phases (camera_*, sound_*, tile_at) are not
 * listed until they exist: a catalog entry is a promise the runtime keeps.
 */

export type Category =
  | "Instances"
  | "Collision"
  | "Input"
  | "Motion"
  | "Drawing"
  | "Rooms"
  | "Camera"
  | "Debug";

export type ParamType = "number" | "string" | "object" | "sprite" | "key" | "button" | "color" | "boolean" | "room" | "instance" | "layer" | "any";

export interface Param {
  name: string;
  type: ParamType;
  /** Shown in docs and used as the default in generated code. Present = optional. */
  default?: string;
}

export interface ApiFunction {
  kind: "function";
  name: string;
  category: Category;
  params: Param[];
  returns: string; // in words: "an instance or None"
  description: string;
  /**
   * Also worth calling for what it does, ignoring what it gives back
   * (instance_create, move_and_collide): code blocks then offer a statement
   * version beside the value one.
   */
  alsoStatement?: boolean;
}

export interface ApiVariable {
  kind: "variable";
  name: string;
  category: Category;
  type: string;
  description: string;
}

export type ApiEntry = ApiFunction | ApiVariable;

const fn = (
  category: Category,
  name: string,
  params: Param[],
  returns: string,
  description: string,
  extra: Partial<ApiFunction> = {},
): ApiFunction => ({ kind: "function", name, category, params, returns, description, ...extra });

const p = (name: string, type: ParamType, def?: string): Param => (def === undefined ? { name, type } : { name, type, default: def });

export const API: ApiEntry[] = [
  // Instances
  fn("Instances", "instance_create", [p("x", "number"), p("y", "number"), p("obj", "object")], "the new instance",
    "Makes a new instance of an object at (x, y). Its Create event runs straight away.", { alsoStatement: true }),
  fn("Instances", "instance_exists", [p("obj", "object")], "True or False",
    "Is there at least one instance of this object? Also takes an instance, to ask if it is still alive."),
  fn("Instances", "instance_number", [p("obj", "object")], "a whole number",
    "How many instances of this object there are, counting its children."),
  fn("Instances", "instance_nearest", [p("x", "number"), p("y", "number"), p("obj", "object")], "an instance or None",
    "The instance of this object closest to (x, y). Never the instance asking."),
  fn("Instances", "instances", [p("obj", "object")], "a list of instances",
    "Every instance of this object, for a for loop: for e in instances(\"Enemy\"):"),

  // Collision
  fn("Collision", "place_meeting", [p("x", "number"), p("y", "number"), p("obj", "object")], "True or False",
    "Would this instance touch that object — or that tile layer's solid tiles — if it were at (x, y)?"),
  fn("Collision", "place_free", [p("x", "number"), p("y", "number")], "True or False",
    "Is (x, y) free of every solid instance and solid tile?"),
  fn("Collision", "instance_place", [p("x", "number"), p("y", "number"), p("obj", "object")], "an instance or None",
    "Which instance of that object this one would touch at (x, y)."),
  fn("Collision", "collision_point", [p("x", "number"), p("y", "number"), p("obj", "object")], "an instance or None",
    "The instance of that object covering the point (x, y)."),
  fn("Collision", "tile_at", [p("x", "number"), p("y", "number"), p("layer", "layer", "None")], "a tile number or None",
    "Which tile is at (x, y) on a tile layer (or the top one). Tiles are numbered from 0, across then down the tileset."),
  fn("Collision", "tile_set", [p("x", "number"), p("y", "number"), p("tile", "number"), p("layer", "layer", "None")], "nothing",
    "Changes the tile at (x, y) — None removes it. Breakable blocks, doors that open."),

  // Input
  fn("Input", "keyboard_check", [p("key", "key")], "True or False", "Is this key held down?"),
  fn("Input", "keyboard_check_pressed", [p("key", "key")], "True or False", "Was this key pressed this step?"),
  fn("Input", "keyboard_check_released", [p("key", "key")], "True or False", "Was this key let go this step?"),
  fn("Input", "mouse_check", [p("button", "button", '"left"')], "True or False", "Is this mouse button held down?"),
  fn("Input", "mouse_check_pressed", [p("button", "button", '"left"')], "True or False",
    "Was this mouse button pressed this step?"),
  fn("Input", "mouse_check_released", [p("button", "button", '"left"')], "True or False",
    "Was this mouse button let go this step?"),
  { kind: "variable", name: "mouse_x", category: "Input", type: "number", description: "The mouse's x in the room." },
  { kind: "variable", name: "mouse_y", category: "Input", type: "number", description: "The mouse's y in the room." },

  // Motion
  fn("Motion", "move_towards", [p("x", "number"), p("y", "number"), p("speed", "number")], "nothing",
    "Points this instance at (x, y) and sets its speed."),
  fn("Motion", "point_direction", [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number")],
    "degrees", "The direction from one point to another: 0 is right, 90 is up."),
  fn("Motion", "point_distance", [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number")],
    "a number", "The distance between two points, in pixels."),
  fn("Motion", "move_and_collide", [p("dx", "number"), p("dy", "number"), p("obj", "object", "None")],
    "a list of the instances it bumped into",
    "Moves by (dx, dy), stopping flush against the object or tile layer — or, with none named, anything solid, solid tiles included.",
    { alsoStatement: true }),

  // Drawing
  fn("Drawing", "draw_self", [], "nothing", "Draws this instance's sprite as it would be drawn without a Draw event."),
  fn("Drawing", "draw_sprite", [p("sprite", "sprite"), p("frame", "number"), p("x", "number"), p("y", "number")],
    "nothing", "Draws one frame of a sprite at (x, y)."),
  fn("Drawing", "draw_text", [p("x", "number"), p("y", "number"), p("text", "any")], "nothing",
    "Writes text with its top-left corner at (x, y)."),
  fn("Drawing", "draw_rect",
    [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("outline", "boolean", "False")],
    "nothing", "Draws a rectangle between two corners, filled unless outline is True."),
  fn("Drawing", "draw_set_color", [p("color", "color")], "nothing",
    'Sets the colour for what is drawn next: "red", "#ff8800" or (255, 136, 0).'),

  // Rooms and the game
  fn("Rooms", "room_goto", [p("room", "room")], "nothing", "Goes to another room at the end of this step."),
  fn("Rooms", "room_restart", [], "nothing", "Starts this room again at the end of this step."),
  fn("Rooms", "game_restart", [], "nothing", "Starts the whole game again, from the first room."),
  { kind: "variable", name: "global_vars", category: "Rooms", type: "namespace",
    description: "Somewhere to keep values every object can see: global_vars.score = 0" },
  { kind: "variable", name: "room_width", category: "Rooms", type: "number", description: "The width of the room." },
  { kind: "variable", name: "room_height", category: "Rooms", type: "number", description: "The height of the room." },

  // Camera
  fn("Camera", "camera_follow", [p("instance", "instance"), p("smoothing", "number", "None")], "nothing",
    "Keeps the view centred on an instance (camera_follow(self)). smoothing: 1 sticks to it, 0.1 glides. None stops following."),
  fn("Camera", "camera_set", [p("x", "number"), p("y", "number")], "nothing",
    "Puts the view's top-left corner at (x, y) in the room, and stops following."),
  fn("Camera", "camera_shake", [p("strength", "number", "4"), p("steps", "number", "15")], "nothing",
    "Shakes the screen by up to `strength` pixels, fading out over `steps` steps. Great for hits and explosions."),
  { kind: "variable", name: "view_x", category: "Camera", type: "number", description: "Where the view's left edge is in the room." },
  { kind: "variable", name: "view_y", category: "Camera", type: "number", description: "Where the view's top edge is in the room." },
  { kind: "variable", name: "view_width", category: "Camera", type: "number", description: "How wide the view is (the game window)." },
  { kind: "variable", name: "view_height", category: "Camera", type: "number", description: "How tall the view is." },

  // Debug
  fn("Debug", "show_debug", [p("text", "any")], "nothing",
    "Shows text in the corner of the game until it is changed. show_debug(None) hides it."),
];

/**
 * Built-in instance properties, for autocomplete after `self.`. Kept beside
 * the functions so there is one place to look; catalog.test.ts checks each
 * one is really a property of GameObject.
 */
export const PROPERTIES: { name: string; description: string }[] = [
  { name: "x", description: "Position across the room." },
  { name: "y", description: "Position down the room." },
  { name: "xprevious", description: "x at the start of this step." },
  { name: "yprevious", description: "y at the start of this step." },
  { name: "hspeed", description: "Pixels moved right each step (negative is left)." },
  { name: "vspeed", description: "Pixels moved down each step (negative is up)." },
  { name: "speed", description: "Pixels moved each step, in `direction`." },
  { name: "direction", description: "Direction of travel in degrees: 0 right, 90 up." },
  { name: "gravity", description: "Added to the speed each step, in gravity_direction." },
  { name: "gravity_direction", description: "Direction gravity pulls: 270 is down." },
  { name: "friction", description: "Taken off the speed each step." },
  { name: "sprite", description: "The name of the sprite drawn, or None." },
  { name: "image_index", description: "Which frame of the sprite is showing." },
  { name: "image_speed", description: "Animation speed: 1 is the sprite's own speed, 2 twice as fast, 0 stopped." },
  { name: "image_xscale", description: "Width multiplier; -1 flips the sprite." },
  { name: "image_yscale", description: "Height multiplier; -1 flips it upside down." },
  { name: "image_angle", description: "Rotation in degrees, counter-clockwise. The collision mask turns with it." },
  { name: "image_alpha", description: "1 is solid, 0 is invisible." },
  { name: "visible", description: "Whether it is drawn." },
  { name: "solid", description: "Whether place_free and move_and_collide treat it as a wall." },
  { name: "depth", description: "Lower depth draws on top." },
  { name: "alarm", description: "Twelve countdowns: self.alarm[0] = 60 runs on_alarm_0 in 60 steps." },
  { name: "object_name", description: "The name of this instance's object." },
  { name: "once", description: 'self.once("key", condition): True the first step the condition is true, then not until it has been false. Event sheets\' "Trigger once".' },
];
