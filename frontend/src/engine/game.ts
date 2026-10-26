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

/** A tileset as the engine needs it. Tiles are numbered from 0, across then down. */
export interface TilesetDef {
  name: string;
  /** The picture; only the renderer reads it. */
  image?: Blob | ImageBitmap;
  tileWidth: number;
  tileHeight: number;
  offsetX: number;
  offsetY: number;
  spacingX: number;
  spacingY: number;
  columns: number;
  count: number;
  /** Tile numbers that collide. */
  solid: number[];
  /**
   * Animated tiles: painting `tiles[0]` shows each of `tiles` in turn, at
   * `fps` frames a second (water, torches). Collisions and tile_at go by
   * `tiles[0]`.
   */
  animations?: { tiles: number[]; fps: number }[];
  /**
   * Tile numbers that are one-way platforms: solid only to something coming
   * down onto them from above. Jumped up through, walked along, and dropped
   * through while an instance's drop_through is counting down.
   */
  oneWay?: number[];
}

/**
 * A painted cell can carry how its tile is drawn, in bits above the tile
 * number: flipped across, flipped down, turned a quarter clockwise. Only
 * the picture changes; collisions and tile_at go by the tile number alone
 * (tileNumber). An empty cell is -1 — check that BEFORE masking, since
 * -1 masked is a large, real-looking tile number.
 */
export const TILE_FLIP_X = 1 << 28;
export const TILE_FLIP_Y = 1 << 29;
export const TILE_TURN = 1 << 30;
export const TILE_MASK = TILE_FLIP_X - 1;
export const tileNumber = (cell: number) => (cell < 0 ? -1 : cell & TILE_MASK);

/**
 * A room's painted tiles on one layer: `cells[row * columns + column]` is a
 * tile number, or -1 for empty. The grid is the tileset's, from the room's
 * top-left. A hidden layer isn't drawn, but its solid tiles still collide —
 * the usual way to make invisible walls.
 */
export interface TileLayerDef {
  name: string;
  depth: number;
  visible: boolean;
  tileset: string;
  columns: number;
  rows: number;
  cells: number[];
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
  /** "tile_x" repeats across only (a strip of hills), "tile_y" down only. */
  mode: "tile" | "tile_x" | "tile_y" | "stretch" | "once";
  hspeed: number;
  vspeed: number;
  /** Across: 0 moves with the room, 1 is fixed to the screen; between is far away. */
  parallax: number;
  /** Down, the same; absent is the same as `parallax`. 1 keeps a strip at one height on the screen. */
  parallaxY?: number;
  /** Where the picture is put: added to where parallax puts it (with parallax 1, from the screen's top-left). */
  offsetX?: number;
  offsetY?: number;
}

export interface RoomDef {
  name: string;
  width: number;
  height: number;
  background?: number; // 0xRRGGBB
  instances: RoomInstance[];
  camera?: CameraDef;
  backgrounds?: BackgroundDef[];
  tileLayers?: TileLayerDef[];
  /** Remembers how it was left: its instances (and changed tiles) are as they were when the game comes back. */
  persistent?: boolean;
}

export interface GameDefinition {
  sprites: SpriteDef[];
  tilesets?: TilesetDef[];
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
  /**
   * The Sounds folder. Python needs only the names and how long each one is
   * (to answer sound_playing); the page plays them, so the host takes the
   * files out before the definition goes to the game's worker.
   */
  sounds?: SoundDef[];
  /** The Fonts folder, for draw_set_font: loaded in the worker, where the game draws. */
  fonts?: FontDef[];
  /** What the game saved last time it was played here (save_set), handed back as it starts. */
  save?: Record<string, unknown>;
}

export interface SoundDef {
  name: string;
  /** In seconds. Measured by the host before the game starts. */
  duration?: number;
  /** The sound's own volume, 0–1, multiplied with the one sound_play is given. */
  volume?: number;
  /** The file. Only on the page: never sent to the worker. */
  sound?: Blob;
}

export interface FontDef {
  name: string;
  font?: Blob;
}

/** What Python asks the page to do with sounds: ["play", name, loop, volume], ["stop", name]… */
export type SoundOrder =
  | ["play", string, number, number]
  | ["stop", string]
  | ["stop_all"]
  | ["music", string, number, number]
  | ["music_stop"];
