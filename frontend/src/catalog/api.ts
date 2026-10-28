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
 * A function is listed only once it exists: a catalog entry is a promise
 * the runtime keeps.
 */

export type Category =
  | "Instances"
  | "Collision"
  | "Input"
  | "Motion"
  | "Physics"
  | "Drawing"
  | "Rooms"
  | "Camera"
  | "Sound"
  | "Saving"
  | "Effects"
  | "Debug";

/**
 * Every category, in the order the docs list them. The docs pane, the
 * blocks palette and the sheet pickers each list categories; catalog.test.ts
 * holds all three to this, so a new category can't go missing from one.
 */
export const CATEGORIES: Category[] = ["Instances", "Collision", "Input", "Motion", "Physics", "Drawing", "Sound", "Saving", "Rooms", "Camera", "Effects", "Debug"];

export type ParamType =
  | "number" | "string" | "object" | "sprite" | "key" | "button" | "color" | "boolean" | "room" | "instance" | "layer" | "any"
  | "sound" | "font" | "padbutton" | "axis";

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

  fn("Collision", "collision_line", [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("obj", "object", "None")],
    "an instance, a tile layer's name, or None",
    "The first thing a straight line from (x1, y1) to (x2, y2) touches, nearest the start: an instance of that object, or that tile layer's solid tiles — or, with none named, anything solid. None means a clear line: can the guard see the player?"),
  fn("Collision", "path_find", [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("cell", "number", "16")],
    "a list of (x, y) points, or an empty list",
    "A way from (x1, y1) to (x2, y2) round every solid tile and solid instance, on a grid of `cell` pixels: the points to walk through, in order. Empty when there is no way. For games seen from above; follow it with move_towards."),

  // Physics (engine/physics.ts): self.physics = True and the properties beside it do most of it.
  fn("Physics", "physics_gravity", [p("x", "number"), p("y", "number")], "nothing",
    "Which way, and how hard, physics pulls everything with self.physics = True: pixels per step, added each step. It starts as physics_gravity(0, 0.3); (0, 0) floats, like space."),
  fn("Physics", "physics_join", [p("a", "instance"), p("b", "instance", "None"), p("kind", "string", '"hinge"'), p("x", "number", "None"), p("y", "number", "None")],
    "a joint, for physics_unjoin",
    `Joins two physics instances, or a to the room itself when b is None. "hinge": pinned at (x, y) and free to turn — wheels, doors, pendulums. "weld": stuck together as one. "rope": never further apart than now. "spring": a rope that pulls back. (x, y) is a's origin if left out (b's, for a rope or spring).`),
  fn("Physics", "physics_unjoin", [p("joint", "any")], "nothing",
    "Ends a joint physics_join made: cut the rope. A joint already gone (one of its instances was destroyed) is no matter."),

  // Input
  fn("Input", "keyboard_check", [p("key", "key")], "True or False", "Is this key held down?"),
  fn("Input", "keyboard_check_pressed", [p("key", "key")], "True or False", "Was this key pressed this step?"),
  fn("Input", "keyboard_check_released", [p("key", "key")], "True or False", "Was this key let go this step?"),
  fn("Input", "touch_controls", [p("show", "boolean", "True"), p("buttons", "any", "('space', 'x')"), p("always", "boolean", "False")], "nothing",
    'On-screen controls for a touchscreen: arrows (the arrow keys) and a button for each key in buttons, up to 4. Pressing one holds that key, so keyboard_check code just works. Shown only on a touchscreen unless always=True; touch_controls(False) hides them.'),
  fn("Input", "mouse_check", [p("button", "button", '"left"')], "True or False", "Is this mouse button held down?"),
  fn("Input", "mouse_check_pressed", [p("button", "button", '"left"')], "True or False",
    "Was this mouse button pressed this step?"),
  fn("Input", "mouse_check_released", [p("button", "button", '"left"')], "True or False",
    "Was this mouse button let go this step?"),
  fn("Input", "gamepad_check", [p("button", "padbutton"), p("pad", "number", "0")], "True or False",
    'Is this button held on a gamepad? "a", "b", "x", "y", "lb", "rb", "lt", "rt", "start", "select", "up", "down", "left", "right"… pad 0 is the first one plugged in.'),
  fn("Input", "gamepad_check_pressed", [p("button", "padbutton"), p("pad", "number", "0")], "True or False",
    "Was this gamepad button pressed this step?"),
  fn("Input", "gamepad_check_released", [p("button", "padbutton"), p("pad", "number", "0")], "True or False",
    "Was this gamepad button let go this step?"),
  fn("Input", "gamepad_axis", [p("axis", "axis"), p("pad", "number", "0")], "a number from -1 to 1",
    'How far a stick is pushed: "left_x", "left_y", "right_x" or "right_y". Right and down are positive; a stick at rest is 0.'),
  fn("Input", "gamepad_connected", [p("pad", "number", "0")], "True or False", "Is a gamepad plugged in as this number?"),
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

  fn("Motion", "clamp", [p("value", "number"), p("low", "number"), p("high", "number")], "a number",
    "value, kept between low and high: clamp(hp, 0, 10)."),
  fn("Motion", "lerp", [p("a", "number"), p("b", "number"), p("t", "number")], "a number",
    "The point t of the way from a to b: lerp(0, 100, 0.25) is 25. A camera or a health bar easing towards a value."),
  fn("Motion", "approach", [p("value", "number"), p("target", "number"), p("step", "number")], "a number",
    "value moved towards target by at most step, never past it: speeding up and slowing down smoothly."),
  fn("Motion", "sign", [p("value", "number")], "1, -1 or 0", "1 for a positive number, -1 for a negative one, 0 for 0: which way something is going."),
  fn("Motion", "choose", [p("options", "any")], "one of them", 'One of a list, picked at random: choose(["red", "green", "blue"]).'),

  // Drawing
  fn("Drawing", "draw_self", [], "nothing", "Draws this instance's sprite as it would be drawn without a Draw event."),
  fn("Drawing", "draw_sprite", [p("sprite", "sprite"), p("frame", "number"), p("x", "number"), p("y", "number")],
    "nothing", "Draws one frame of a sprite at (x, y)."),
  fn("Drawing", "draw_text", [p("x", "number"), p("y", "number"), p("text", "any"), p("width", "number", "None")], "nothing",
    "Writes text with its top-left corner at (x, y). Given a width, long lines are broken between words to fit inside it."),
  fn("Drawing", "draw_rect",
    [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("outline", "boolean", "False")],
    "nothing", "Draws a rectangle between two corners, filled unless outline is True."),
  fn("Drawing", "draw_set_alpha", [p("alpha", "number")], "nothing",
    "How solid what you draw is from now on, in this event: 1 solid, 0.5 see-through, 0 invisible."),
  fn("Drawing", "draw_set_color", [p("color", "color")], "nothing",
    'Sets the colour for what is drawn next: "red", "#ff8800" or (255, 136, 0).'),
  fn("Drawing", "draw_set_font", [p("font", "font", "None"), p("size", "number", "16")], "nothing",
    "Sets the font for draw_text from now on: one from the Fonts folder, and its size. draw_set_font() goes back to the built-in font."),

  fn("Drawing", "draw_sprite_ext",
    [p("sprite", "sprite"), p("frame", "number"), p("x", "number"), p("y", "number"), p("xscale", "number", "1"), p("yscale", "number", "1"),
      p("angle", "number", "0"), p("color", "color", '"white"'), p("alpha", "number", "1")],
    "nothing", 'A frame of a sprite, scaled (2 is twice the size, -1 flipped), turned (degrees, anticlockwise), tinted ("white" leaves it alone) and faded (1 solid, 0 invisible).'),
  fn("Drawing", "draw_line", [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("width", "number", "1")], "nothing",
    "Draws a straight line from (x1, y1) to (x2, y2), `width` pixels thick."),
  fn("Drawing", "draw_circle", [p("x", "number"), p("y", "number"), p("r", "number"), p("outline", "boolean", "False")], "nothing",
    "Draws a circle round (x, y) with radius r, filled unless outline is True."),
  fn("Drawing", "draw_ellipse", [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("outline", "boolean", "False")], "nothing",
    "Draws an oval filling the box between two corners, filled unless outline is True."),
  fn("Drawing", "draw_triangle",
    [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("x3", "number"), p("y3", "number"), p("outline", "boolean", "False")],
    "nothing", "Draws a triangle with corners at three points, filled unless outline is True."),
  fn("Drawing", "draw_rect_gradient",
    [p("x1", "number"), p("y1", "number"), p("x2", "number"), p("y2", "number"), p("color1", "color"), p("color2", "color"), p("vertical", "boolean", "True")],
    "nothing", "A rectangle shading from color1 to color2: top to bottom, or left to right with vertical=False. Skies, health bars."),
  fn("Drawing", "draw_set_halign", [p("align", "string")], "nothing",
    'Where draw_text\'s x is from now on, in this event: "left" (the start), "center" or "right" of the text. Centring a title: draw_set_halign("center").'),
  fn("Drawing", "draw_set_valign", [p("align", "string")], "nothing",
    'Where draw_text\'s y is from now on, in this event: "top", "middle" or "bottom" of the text.'),
  fn("Drawing", "string_width", [p("text", "any")], "a number of pixels", "How wide draw_text would write this, in the font set now."),
  fn("Drawing", "string_height", [p("text", "any")], "a number of pixels", "How tall draw_text would write this, in the font set now (more lines, taller)."),
  fn("Drawing", "string_wrap", [p("text", "any"), p("width", "number")], "text with line breaks",
    "The text broken between words so no line is wider than width, in the font set now. To type a page out letter by letter: draw_text(x, y, string_wrap(text, 300)[:n])."),

  // Rooms and the game
  fn("Rooms", "room_goto", [p("room", "room")], "nothing", "Goes to another room at the end of this step."),
  fn("Rooms", "room_restart", [], "nothing", "Starts this room again at the end of this step."),
  fn("Rooms", "room_name", [], "the room's name", 'The name of the room the game is in now: if room_name() == "Title":'),
  fn("Rooms", "game_restart", [], "nothing", "Starts the whole game again, from the first room."),
  fn("Rooms", "game_pause", [p("paused", "boolean", "True")], "nothing",
    "Pauses the game (or carries on, with False): nothing moves, animates, counts down or collides, and Step and key events run only for instances with self.ignore_pause = True — a pause menu. Everything is still drawn."),
  fn("Rooms", "game_paused", [], "True or False", "Is the game paused?"),
  { kind: "variable", name: "global_vars", category: "Rooms", type: "namespace",
    description: "Somewhere to keep values every object can see: global_vars.score = 0" },
  { kind: "variable", name: "room_width", category: "Rooms", type: "number", description: "The width of the room." },
  { kind: "variable", name: "room_height", category: "Rooms", type: "number", description: "The height of the room." },

  // Camera
  fn("Camera", "camera_follow", [p("instance", "instance"), p("smoothing", "number", "None")], "nothing",
    "Keeps the view centred on an instance (camera_follow(self)). smoothing: 1 sticks to it, 0.1 glides. None stops following."),
  fn("Camera", "camera_set", [p("x", "number"), p("y", "number")], "nothing",
    "Puts the view's top-left corner at (x, y) in the room, and stops following."),
  fn("Camera", "camera_zoom", [p("zoom", "number", "1"), p("steps", "number", "0")], "nothing",
    "Zooms the view in or out about its middle: 2 shows half as much, twice as big; 0.5 twice as much; 1 as drawn. Over `steps` steps, or at once. Draw GUI isn't zoomed."),
  fn("Camera", "camera_shake", [p("strength", "number", "4"), p("steps", "number", "15")], "nothing",
    "Shakes the screen by up to `strength` pixels, fading out over `steps` steps. Great for hits and explosions."),
  { kind: "variable", name: "view_x", category: "Camera", type: "number", description: "Where the view's left edge is in the room." },
  { kind: "variable", name: "view_y", category: "Camera", type: "number", description: "Where the view's top edge is in the room." },
  { kind: "variable", name: "view_width", category: "Camera", type: "number", description: "How wide the view is (the game window)." },
  { kind: "variable", name: "view_height", category: "Camera", type: "number", description: "How tall the view is." },

  // Sound
  fn("Sound", "sound_play", [p("sound", "sound"), p("loop", "boolean", "False"), p("volume", "number", "1")], "nothing",
    "Plays a sound from the Sounds folder. loop=True plays it again and again until sound_stop. volume: 0 (silent) to 1."),
  fn("Sound", "sound_stop", [p("sound", "sound", "None")], "nothing",
    "Stops a sound everywhere it is playing — or, with none named, every sound (not the music)."),
  fn("Sound", "sound_playing", [p("sound", "sound")], "True or False", "Is this sound playing right now?"),
  fn("Sound", "music_play", [p("sound", "sound"), p("loop", "boolean", "True"), p("volume", "number", "1")], "nothing",
    "Plays a sound as the music. There is only ever one music: this replaces any already playing."),
  fn("Sound", "music_stop", [], "nothing", "Stops the music."),

  // Saving
  fn("Saving", "save_set", [p("key", "string"), p("value", "any")], "nothing",
    'Keeps a value for next time the game is played, under a name: save_set("best", score). Numbers, text, True/False, lists and dicts.'),
  fn("Saving", "save_get", [p("key", "string"), p("default", "any", "None")], "the saved value, or default",
    'A value kept with save_set — or `default` if nothing is saved under that name: save_get("best", 0).'),
  fn("Saving", "save_delete", [p("key", "string")], "nothing", "Forgets one saved value."),
  fn("Saving", "save_clear", [], "nothing", "Forgets everything this game saved."),

  // Effects: game feel (engine/effects.ts, render/feel.ts)
  fn("Effects", "effect", [p("kind", "string"), p("x", "number"), p("y", "number"), p("color", "color", "None"), p("scale", "number", "1")], "nothing",
    'A ready-made effect at (x, y): "explosion", "sparkle", "dust", "smoke", "confetti" or "hit". scale makes it bigger or smaller; color changes its colours.'),
  fn("Effects", "particles", [p("x", "number"), p("y", "number"), p("count", "number", "12"), p("color", "color", '"white"'), p("speed", "number", "3"),
    p("size", "number", "3"), p("life", "number", "30"), p("gravity", "number", "0"), p("spread", "number", "360"), p("direction", "number", "90"),
    p("shape", "string", '"square"'), p("depth", "number", "-1000")], "nothing",
    'A burst of particles at (x, y): how many, their colour (or a list of colours), speed, size and life in steps. spread is how wide a fan, in degrees, around direction (90 is up); shape "square" or "circle".'),
  fn("Effects", "weather", [p("kind", "string", "None"), p("amount", "number", "1")], "nothing",
    'Rain or snow across the screen until changed: weather("rain"), weather("snow", 3) for a blizzard, weather(None) to stop.'),
  fn("Effects", "particles_clear", [], "nothing", "Removes every particle, and stops the weather."),
  fn("Effects", "hit_pause", [p("steps", "number", "4")], "nothing",
    "Freezes the whole game for a few steps — the tiny stop that makes a hit feel hard. Pair it with camera_shake."),
  fn("Effects", "lighting", [p("darkness", "number", "0.8"), p("color", "color", '"black"')], "nothing",
    "Darkens this room (0 is daylight, 1 pitch black) everywhere light() doesn't shine. A new room starts in daylight."),
  fn("Effects", "light", [p("x", "number"), p("y", "number"), p("radius", "number", "100"), p("color", "color", '"white"'), p("strength", "number", "1")], "nothing",
    "A light at (x, y) for this step: call it every step (in Step) to keep it on — light(self.x, self.y, 120) carries a torch."),
  fn("Effects", "screen_effect", [p("name", "string", "None")], "nothing",
    'A look for the whole screen: "crt" (an old TV), "vignette" (dark corners), "grayscale", "sepia", "pixelate" — or None.'),
  fn("Effects", "screen_flash", [p("color", "color", '"white"'), p("steps", "number", "8")], "nothing",
    "Flashes the whole screen a colour, fading out over a few steps: a big hit, lightning, a power-up."),
  fn("Effects", "screen_fade", [p("to", "number", "1.0"), p("steps", "number", "30"), p("color", "color", '"black"')], "nothing",
    "Fades the screen to a colour (to=1) or back from it (to=0). Fade out, change room, fade in: it lasts across rooms."),
  fn("Effects", "tween", [p("target", "any"), p("prop", "string"), p("to", "number"), p("steps", "number", "30"), p("ease", "string", '"out_quad"')], "nothing",
    'Moves a property smoothly to a value over `steps` steps: tween(self, "y", 100, 30, "out_bounce"). Eases: linear, in_quad, out_quad, in_out_quad, in_cubic, out_cubic, in_out_cubic, in_sine, out_sine, in_out_sine, in_back, out_back, in_out_back, in_bounce, out_bounce, out_elastic.'),
  fn("Effects", "tween_stop", [p("target", "any"), p("prop", "string", "None")], "nothing",
    "Stops a target's tweens (or just the one moving prop), leaving it where it got to."),
  fn("Effects", "ease", [p("name", "string"), p("t", "number")], "a number",
    'An easing at t, from 0 to 1: the curve tween() moves along. ease("out_bounce", 0.5).'),
  fn("Effects", "say", [p("text", "any"), p("name", "string", "None")], "nothing",
    "Shows text in a box at the bottom of the screen, typed out. Space, Enter or a click goes on to the next say()."),
  fn("Effects", "ask", [p("question", "any"), p("choices", "any"), p("name", "string", "None"), p("then", "any", "None")], "nothing",
    'Asks a question in the dialogue box with choices under it: ask("Fight or run?", ["Fight", "Run"]). Click or tap one, use the arrow keys and Enter, or press its number. Comes after say() lines already waiting.'),
  fn("Effects", "answer", [], "the choice's text, or None",
    'The choice picked for the last ask(): if answer() == "Run": … None while the question is still up. Or give ask a then function, called with the choice.'),
  fn("Effects", "dialogue_open", [], "True or False", "True while say() has something on screen: stop the player moving while people talk."),
  fn("Effects", "dialogue_clear", [], "nothing", "Closes the dialogue box and forgets lines still waiting."),

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
  { name: "friction", description: "Taken off the speed each step. With physics: how much it grips what it touches (0 slides like ice)." },
  { name: "sprite", description: "The name of the sprite drawn, or None." },
  { name: "image_index", description: "Which frame of the sprite is showing." },
  { name: "image_speed", description: "Animation speed: 1 is the sprite's own speed, 2 twice as fast, 0 stopped." },
  { name: "image_xscale", description: "Width multiplier; -1 flips the sprite." },
  { name: "image_yscale", description: "Height multiplier; -1 flips it upside down." },
  { name: "image_angle", description: "Rotation in degrees, counter-clockwise. The collision mask turns with it." },
  { name: "image_alpha", description: "1 is solid, 0 is invisible." },
  { name: "visible", description: "Whether it is drawn." },
  { name: "solid", description: "Whether place_free and move_and_collide treat it as a wall." },
  { name: "ignore_pause", description: "True keeps this instance running while the game is paused (game_pause): a pause menu, a blinking cursor." },
  { name: "drop_through", description: "Steps left of falling through one-way platforms: self.drop_through = 12 when Down is pressed drops off one. Counts down by itself." },
  { name: "physics", description: "True hands it to physics: it falls, bounces, stacks, tips over and rolls, its sprite's mask its shape. Its x, y, image_angle, hspeed and vspeed are still yours to set." },
  { name: "bounce", description: "With physics: how bouncy, 0 (lands dead) to 1 (bounces back as high)." },
  { name: "weight", description: "With physics: how heavy, 1 to start. Heavier things push lighter ones aside, and push() moves them less." },
  { name: "fixed", description: "With physics: True and it never moves — things land on it, bounce off it and hang from it." },
  { name: "spin", description: "With physics: how fast it turns, in degrees a step, counter-clockwise." },
  { name: "push", description: "other.push(dx, dy): shoves a physics instance — its speed changes by (dx, dy), divided by its weight." },
  { name: "depth", description: "Lower depth draws on top." },
  { name: "image_blend", description: 'A colour the sprite is tinted with: "red" makes it reddish; "white" is as drawn.' },
  { name: "blend_mode", description: '"normal", "add" (glowing: fire, lasers, magic), "multiply" (darker) or "screen" (lighter).' },
  { name: "outline", description: 'A coloured outline round the sprite: self.outline = "white"; None takes it off.' },
  { name: "glow", description: 'A soft glow round the sprite: self.glow = "yellow"; None takes it off.' },
  { name: "flash", description: 'self.flash("white", 6): drawn as one solid colour for a few steps — "I was hit".' },
  { name: "alarm", description: "Twelve countdowns: self.alarm[0] = 60 runs on_alarm_0 in 60 steps." },
  { name: "object_name", description: "The name of this instance's object." },
  { name: "once", description: 'self.once("key", condition): True the first step the condition is true, then not until it has been false. Event sheets\' "Trigger once".' },
];
