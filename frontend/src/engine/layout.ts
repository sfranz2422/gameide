/**
 * The memory both sides of the bridge share.
 *
 * Every instance's built-in properties live in one Float64Array, `STRIDE`
 * numbers per instance, at `slot * STRIDE`. The array is allocated by Python
 * (an `array.array('d')`) and JavaScript holds a *view* into the same bytes in
 * the WebAssembly heap, so `self.x = 4` in a student's step event and the
 * engine's motion code are reading and writing the same number. Nothing is
 * copied across the bridge per frame, which is what makes 300+ instances at
 * 60 fps possible: crossing JS↔Python costs microseconds per call, and copying
 * every instance's state both ways every frame would cost far more than the
 * game logic itself.
 *
 * This file is the single definition of that layout. Python is handed these
 * numbers at start-up (`layoutForPython()`), never a copy typed by hand, so
 * the two sides cannot drift apart — if they did, `self.x` would silently
 * read `self.y`, and nothing would fail loudly.
 */

/** Indices into one instance's block of the state array. */
export const F = {
  ALIVE: 0, // 1 while the instance exists; 0 the moment it is destroyed
  TYPE: 1, // index of its object in GameDefinition.objects
  GEN: 2, // bumped each time a slot is reused, so the renderer notices
  X: 3,
  Y: 4,
  XPREV: 5,
  YPREV: 6,
  HSPEED: 7,
  VSPEED: 8,
  SPEED: 9,
  DIRECTION: 10, // degrees, 0 = right, 90 = up (GameMaker's convention)
  GRAVITY: 11,
  GRAVITY_DIR: 12,
  FRICTION: 13,
  SPRITE: 14, // index into the sprite table, -1 for none
  IMAGE_INDEX: 15,
  IMAGE_SPEED: 16, // multiplier on the sprite's own speed (1 = as the sprite says)
  XSCALE: 17,
  YSCALE: 18,
  ANGLE: 19,
  ALPHA: 20,
  VISIBLE: 21,
  DEPTH: 22, // lower depth draws on top, as in GameMaker
  SOLID: 23,
  DIRTY: 24, // 1 = queued in the dirty list for the spatial hash (see below)
  OUTSIDE: 25, // engine's memory of "was outside the room last step"
  BOUNDARY: 26, // engine's memory of "was touching the room edge last step"
  DRAWN: 27, // set by draw_self() in a custom Draw event, cleared each frame
  ALARM0: 28, // ALARM0 .. ALARM0 + 11
} as const;

export const ALARM_COUNT = 12;
export const STRIDE = F.ALARM0 + ALARM_COUNT; // 40

/**
 * Small Int32 arrays, also shared:
 *
 * dirty   [count, slot, slot, ...]  Slots whose collision box may have changed
 *         since the spatial hash last saw them: moved, rescaled, given a new
 *         sprite, created, destroyed. Python appends (in the property setters)
 *         and the engine drains the list at the start of every collision
 *         query. Without it a query made in a Step event would test against
 *         where things were at the start of the frame, and two instances that
 *         both moved this frame would pass through each other.
 *
 * events  [count, overflowed, kind, a, b, kind, a, b, ...]  Things the engine
 *         noticed that Python must turn into event calls: collisions, alarms,
 *         the end of an animation, leaving the room. `overflowed` is set when
 *         there were more than fit, so Python can say so rather than quietly
 *         skipping collisions.
 *
 * result  [count, slot, ...]  Where a query that returns several instances
 *         (move_and_collide's hits) puts them.
 */
export const EV = {
  COLLISION: 1, // a = slot, b = other slot
  ALARM: 2, // a = slot, b = alarm number
  ANIMATION_END: 3, // a = slot
  OUTSIDE_ROOM: 4, // a = slot
  INTERSECT_BOUNDARY: 5, // a = slot
  MOUSE: 6, // a = slot, b = button * 2 + (0 pressed, 1 released)
} as const;
export const EVENTS_HEADER = 2;

export const MOUSE_BUTTONS = ["left", "right", "middle"] as const;

/**
 * Global numbers in a small shared Float64Array: the mouse, the room, and the
 * high-water mark of slots in use, which Python keeps up to date so the
 * engine's per-frame loops stop where the instances stop.
 */
export const G = {
  MOUSE_X: 0,
  MOUSE_Y: 1,
  ROOM_WIDTH: 2,
  ROOM_HEIGHT: 3,
  FPS: 4,
  FRAME: 5,
  MOUSE_DOWN: 6, // 6, 7, 8 — left, right, middle
  MOUSE_PRESSED: 9, // 9, 10, 11
  MOUSE_RELEASED: 12, // 12, 13, 14
  SLOTS: 15,
  // The view (camera), in room coordinates, as of the end of the last step.
  VIEW_X: 16,
  VIEW_Y: 17,
  VIEW_W: 18,
  VIEW_H: 19,
  // Gamepads (input.ts fills these each step): PAD_COUNT pads, each with
  // PAD_AXES.length axes and PAD_BUTTONS.length buttons held/pressed/released.
  PAD_CONNECTED: 20, // 20–23
  PAD_AXIS: 24, // 24–39
  PAD_DOWN: 40, // 40–107
  PAD_PRESSED: 108, // 108–175
  PAD_RELEASED: 176, // 176–243
} as const;
export const G_SIZE = 244;

/**
 * Gamepad buttons Python can name, in the order of the browser's "standard"
 * mapping (Xbox names; a PlayStation pad's cross is "a", circle "b"…).
 */
export const PAD_BUTTONS = ["a", "b", "x", "y", "lb", "rb", "lt", "rt", "select", "start", "ls", "rs", "up", "down", "left", "right", "home"] as const;
export const PAD_AXES = ["left_x", "left_y", "right_x", "right_y"] as const;
export const PAD_COUNT = 4;

/**
 * Keys Python can name, in order; a key's code is its index. Names follow
 * GameMaker's vk_ constants with the prefix dropped, plus letters and digits.
 * `KeyboardEvent.code` is mapped onto these in input.ts.
 */
export const KEY_NAMES = [
  "any", // held while any key below is held — keyboard_check("any")
  "left", "right", "up", "down",
  "space", "enter", "shift", "control", "alt", "escape", "tab", "backspace",
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
] as const;
export type KeyName = (typeof KEY_NAMES)[number];

/**
 * Keyboard state is one Uint8Array of 3 * KEY_COUNT: [held..., pressed this
 * step..., released this step...].
 */
export const KEY_COUNT = KEY_NAMES.length;

/**
 * Bits in a type's handler flags, which Python sends once at load so the
 * engine only does work for events somebody listens to.
 */
export const HANDLES = {
  OUTSIDE_ROOM: 1,
  INTERSECT_BOUNDARY: 2,
  ANIMATION_END: 4,
  DRAW: 8, // has its own Draw event, so the sprite is drawn only by draw_self()
  MOUSE: 16, // has an instance mouse event
  COLLISION: 32, // has at least one collision event
} as const;

/** Everything Python needs to agree with the engine about, as plain data. */
export function layoutForPython() {
  return {
    F,
    STRIDE,
    ALARM_COUNT,
    EV,
    EVENTS_HEADER,
    G,
    G_SIZE,
    PAD_BUTTONS: [...PAD_BUTTONS],
    PAD_AXES: [...PAD_AXES],
    PAD_COUNT,
    HANDLES,
    KEY_NAMES: [...KEY_NAMES],
    MOUSE_BUTTONS: [...MOUSE_BUTTONS],
  };
}
