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

export interface SpriteDef {
  name: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  /** The collision box. Omitted means the whole image. */
  mask?: MaskRect;
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
}

export interface RoomDef {
  name: string;
  width: number;
  height: number;
  background?: number; // 0xRRGGBB
  instances: RoomInstance[];
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
  /** Steps per second (GameMaker's room speed). Default 60. */
  stepsPerSecond?: number;
  /** Shared functions every object can call (the Scripts folder). */
  scripts?: Record<string, string>;
}
