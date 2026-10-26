/**
 * What the engine is given to run: plain data, no classes, so that the
 * project format of Phase 2 can be turned into one of these by a function
 * and a tutorial check can read it without running anything.
 */

/** A rectangle in sprite-local pixels, measured from the image's top-left. */
export interface MaskRect {
  left: number;
  top: number;
  right: number; // exclusive
  bottom: number; // exclusive
}

/**
 * A collision mask, in the sprite's own pixels (sprites.ts has how each is
 * tested). `precise` carries the box around the opaque pixels for the
 * spatial hash; the pixels themselves come in SpriteDef.pixelMasks.
 */
export type MaskShape =
  | ({ kind: "rect" } & MaskRect)
  | { kind: "circle"; cx: number; cy: number; r: number }
  | ({ kind: "precise" } & MaskRect);

export interface SpriteDef {
  name: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  /** The collision mask. Omitted means a box around the whole image. */
  mask?: MaskShape | MaskRect;
  /**
   * Animation speed in frames per second, at image_speed 1. Omitted means
   * one frame per step (what image_speed meant before sprites had a speed).
   */
  fps?: number;
  /**
   * For a precise mask, one byte per pixel per frame (1 = solid), made from
   * the pictures in the game's worker (python/spritePrep.ts). Never sent to
   * Python.
   */
  pixelMasks?: Uint8Array[];
  /** Number of animation frames. */
  frameCount: number;
  /**
   * The frames' pictures, in order. Only the renderer reads them, so a
   * headless test can describe sprites with none. Blobs can be posted to the
   * game's worker as they are; it decodes them there.
   */
  images?: (Blob | ImageBitmap)[];
}

export interface ObjectDef {
  name: string;
  sprite?: string;
  visible?: boolean; // default true
  solid?: boolean; // default false
  persistent?: boolean; // default false
  depth?: number; // default 0
  parent?: string;
}

export interface RoomInstance {
  object: string;
  x: number;
  y: number;
  /** Overrides, applied before the instance's Create event. */
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  /** Python run for this instance after its Create event (its body, using `self`). */
  code?: string;
}

/** What the game window shows. Absent: the whole room. */
export interface CameraDef {
  width: number;
  height: number;
  /** Keep the first instance of this object in the middle. */
  follow?: string;
  /** 1 = snap to the target every step; smaller glides. */
  smoothing: number;
}

/** A background layer: a colour, a picture, or a picture over a colour. */
export interface BackgroundDef {
  depth: number;
  color?: number;
  sprite?: string;
  mode: "tile" | "stretch" | "once";
  hspeed: number;
  vspeed: number;
  parallax: number;
}

export interface RoomDef {
  name: string;
  width: number;
  height: number;
  background?: number; // 0xRRGGBB
  instances: RoomInstance[];
  camera?: CameraDef;
  backgrounds?: BackgroundDef[];
}

export interface GameDefinition {
  sprites: SpriteDef[];
  objects: ObjectDef[];
  /** The first room is the start room. */
  rooms: RoomDef[];
  /**
   * Python source defining one class per object that has events, named
   * after the object (`class Player(GameObject):`). Phase 2 generates this
   * from the object editor; Phase 1's demos write it by hand.
   *
   * Each entry is compiled separately, under the filename `<object Name>`,
   * so a traceback says which object an error came from.
   */
  code: Record<string, string>;
  /**
   * Scale the game window by whole numbers only (2×, 3×…), so every pixel
   * of pixel art is the same size. Default true. Off: fill the space exactly.
   */
  pixelScaling?: boolean;
  /** Steps per second (GameMaker's room speed). Default 60. */
  stepsPerSecond?: number;
  /** Shared functions every object can call (the Scripts folder). */
  scripts?: Record<string, string>;
}
