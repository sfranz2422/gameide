/**
 * Draws the engine's state with PixiJS. It only ever reads: positions,
 * frames and depths come straight out of the shared state array each frame,
 * Draw-event commands from Engine.drawList and guiList, the view from
 * Engine.camera.
 *
 * Three layers, back to front:
 *   world    the room: background layers, instances and Draw-event drawing,
 *            all sorted by depth, and moved by the camera (and its shake);
 *   gui      Draw GUI drawing, in screen pixels, which the camera never moves;
 *   overlay  the debug overlay.
 *
 * One Pixi Sprite per slot, reused for as long as the slot's GEN is the
 * same. A slot handed to a new instance (GEN changed) gets its sprite reset,
 * so a bullet never briefly appears with the last bullet's frame.
 */
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from "pixi.js";
import type { DrawCommand, Engine } from "../engine";
import type { BackgroundDef, GameDefinition, SpriteDef, TilesetDef } from "../game";
import { F, G, HANDLES, STRIDE } from "../layout";
import { boxOf, type Box } from "../sprites";

const DEG = Math.PI / 180;

/**
 * Each frame's picture as a texture. A sprite whose pictures are missing (an
 * asset that failed to load) gets a magenta placeholder of the right size
 * rather than nothing: an invisible player is much harder to diagnose.
 */
async function loadFrames(def: SpriteDef): Promise<Texture[]> {
  const count = Math.max(1, def.frameCount);
  const frames: Texture[] = [];
  for (let i = 0; i < count; i++) {
    const img = def.images?.[i];
    let source: ImageBitmap | OffscreenCanvas;
    if (img) {
      source = img instanceof Blob ? await createImageBitmap(img) : img;
    } else {
      source = new OffscreenCanvas(Math.max(1, def.width), Math.max(1, def.height));
      const ctx = source.getContext("2d")!;
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, def.width, def.height);
    }
    const tex = Texture.from(source);
    // Students' art is mostly pixel art; smoothing would blur it when the
    // game is scaled up to fill the pane.
    tex.source.scaleMode = "nearest";
    frames.push(tex);
  }
  return frames;
}

/**
 * The output of Draw (or Draw GUI) events: rectangles, text and sprites,
 * pooled and reused by position in the list, because making a Text's
 * texture is the expensive part and a HUD says the same thing most frames.
 */
class DrawLayer {
  private graphicsByDepth = new Map<number, Graphics>();
  private texts: Text[] = [];
  private sprites: Sprite[] = [];

  constructor(
    private readonly into: Container,
    private readonly frames: Texture[][],
    private readonly anchors: { x: number; y: number }[],
    /** The game's fonts that really loaded (gameWorker.loadFonts), by their place in the list. */
    private readonly fonts: ReadonlySet<number>,
  ) {}

  private graphicsAt(depth: number): Graphics {
    let gfx = this.graphicsByDepth.get(depth);
    if (!gfx) {
      gfx = new Graphics();
      gfx.zIndex = -depth;
      this.graphicsByDepth.set(depth, gfx);
      this.into.addChild(gfx);
    }
    return gfx;
  }

  render(list: DrawCommand[]) {
    for (const gfx of this.graphicsByDepth.values()) gfx.clear();
    let ti = 0;
    let si = 0;
    for (const cmd of list) {
      switch (cmd[0]) {
        case "rect": {
          const [, depth, x1, y1, x2, y2, color, outline] = cmd;
          const gfx = this.graphicsAt(depth);
          gfx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          if (outline) gfx.stroke({ color, width: 1, alignment: 1 });
          else gfx.fill({ color });
          break;
        }
        case "text": {
          const [, depth, x, y, text, color, font = -1, size = 16] = cmd;
          let t = this.texts[ti];
          if (!t) {
            t = new Text({ text: "", style: { fill: 0xffffff, fontFamily: "monospace", fontSize: 16 } });
            this.texts.push(t);
            this.into.addChild(t);
          }
          ti++;
          // A game's own font (draw_set_font) is loaded in the worker as
          // "gameide-font-<n>" (gameWorker.loadFonts); -1 is the built-in one.
          // One that didn't load is drawn in the built-in font, as its
          // warning says — asking for the missing family would get the
          // browser's default instead, a third font nobody chose.
          const family = this.fonts.has(font) ? `gameide-font-${font}` : "monospace";
          if (t.style.fontFamily !== family) t.style.fontFamily = family;
          if (t.style.fontSize !== size) t.style.fontSize = size;
          if (t.text !== text) t.text = text;
          if (t.style.fill !== color) t.style.fill = color;
          t.position.set(x, y);
          t.zIndex = -depth;
          t.visible = true;
          break;
        }
        case "sprite": {
          const [, depth, sprite, frame, x, y] = cmd;
          const frames = this.frames[sprite];
          if (!frames) break;
          let sp = this.sprites[si];
          if (!sp) {
            sp = new Sprite(frames[0]!);
            this.sprites.push(sp);
            this.into.addChild(sp);
          }
          si++;
          sp.texture = frames[((Math.floor(frame) % frames.length) + frames.length) % frames.length]!;
          const a = this.anchors[sprite]!;
          sp.anchor.set(a.x, a.y);
          sp.position.set(x, y);
          sp.zIndex = -depth;
          sp.visible = true;
          break;
        }
      }
    }
    for (let i = ti; i < this.texts.length; i++) this.texts[i]!.visible = false;
    for (let i = si; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
  }
}

/** Every tile of a tileset as its own texture, cut from the one picture. */
function cutTiles(t: TilesetDef): Texture[] {
  if (!t.image || t.image instanceof Blob) return [];
  const base = Texture.from(t.image);
  base.source.scaleMode = "nearest";
  const out: Texture[] = [];
  for (let n = 0; n < t.count; n++) {
    const c = n % t.columns, r = Math.floor(n / t.columns);
    const x = t.offsetX + c * (t.tileWidth + t.spacingX), y = t.offsetY + r * (t.tileHeight + t.spacingY);
    out.push(new Texture({ source: base.source, frame: new Rectangle(x, y, t.tileWidth, t.tileHeight) }));
  }
  return out;
}

/**
 * A tile layer on screen, in chunks of CHUNK × CHUNK tiles. A chunk's
 * sprites are made only when it comes near the view, hidden when it leaves,
 * and freed when it is far away — so a level of 100 000 tiles costs about
 * what is on screen, not what is in the room. (Every tile as its own sprite,
 * all the time, was fine for small rooms and slow for big ones.)
 */
interface Chunk {
  container: Container;
  sprites: Map<number, Sprite>; // cell → sprite
}

interface TileView {
  container: Container;
  chunks: Map<number, Chunk>; // chunk key → chunk
}

const CHUNK = 16;
/** Chunks this many chunk-widths beyond the view are freed. */
const FREE_BEYOND = 3;

/** One background layer's display objects. */
interface Backdrop {
  def: BackgroundDef;
  color: Graphics | null;
  picture: TilingSprite | Sprite | null;
}

export class PixiRenderer {
  private readonly frames: Texture[][];
  private readonly anchors: { x: number; y: number }[];
  private readonly world = new Container({ sortableChildren: true });
  private readonly gui = new Container({ sortableChildren: true });
  private readonly overlay = new Container();
  private readonly masks = new Graphics();
  private readonly debugLabel = new Text({
    text: "",
    style: { fill: 0xffffff, fontFamily: "monospace", fontSize: 12, stroke: { color: 0x000000, width: 3 } },
  });
  private readonly worldDraw: DrawLayer;
  private readonly guiDraw: DrawLayer;
  private sprites: (Sprite | null)[] = [];
  private gens: number[] = [];
  private backdrops: Backdrop[] = [];
  private tileTextures = new Map<string, Texture[]>();
  private tileViews: TileView[] = [];
  private roomShown = -1;
  private viewShown = "";
  showDebug = false;
  /** Tiles in chunks that are showing: what the chunking keeps small on a big level. */
  tilesShown = 0;
  /** One line of figures for the debug overlay, set by the session. */
  statsLine = "";

  private constructor(
    readonly app: Application,
    private readonly def: GameDefinition,
    private readonly engine: Engine,
    frames: Texture[][],
    fonts: ReadonlySet<number>,
  ) {
    this.frames = frames;
    this.anchors = def.sprites.map((s) => ({
      x: s.width ? s.originX / s.width : 0,
      y: s.height ? s.originY / s.height : 0,
    }));
    for (const t of def.tilesets ?? []) this.tileTextures.set(t.name, cutTiles(t));
    this.worldDraw = new DrawLayer(this.world, this.frames, this.anchors, fonts);
    this.guiDraw = new DrawLayer(this.gui, this.frames, this.anchors, fonts);
    app.stage.addChild(this.world, this.gui, this.overlay);
    this.overlay.addChild(this.debugLabel);
    this.world.addChild(this.masks);
    this.masks.zIndex = 1e9; // collision boxes over everything in the room
    this.debugLabel.position.set(6, 4);
  }

  /**
   * Draws into `canvas`. In the IDE that is an OffscreenCanvas inside the
   * game's worker (pixi's WebWorkerAdapter must be set first, see
   * gameWorker.ts); a plain canvas works too.
   */
  static async create(canvas: OffscreenCanvas | HTMLCanvasElement, def: GameDefinition, engine: Engine, fonts: ReadonlySet<number> = new Set()): Promise<PixiRenderer> {
    const frames = await Promise.all(def.sprites.map(loadFrames));
    const app = new Application();
    await app.init({
      canvas: canvas as HTMLCanvasElement,
      width: engine.camera.w || def.rooms[0]!.width,
      height: engine.camera.h || def.rooms[0]!.height,
      background: def.rooms[0]!.background ?? 0x000000,
      antialias: false,
      autoStart: false, // the game loop decides when to draw, not Pixi's ticker
      preference: "webgl",
    });
    return new PixiRenderer(app, def, engine, frames, fonts);
  }

  /** The game window changed size (a new room, or its view); the page fits the canvas to it. */
  onRoomSize: (w: number, h: number) => void = () => {};

  private syncRoom() {
    const i = this.engine.roomIndex;
    const cam = this.engine.camera;
    const view = `${cam.w}x${cam.h}`;
    if (view !== this.viewShown) {
      this.viewShown = view;
      this.app.renderer.resize(cam.w, cam.h);
      this.onRoomSize(cam.w, cam.h);
    }
    if (i === this.roomShown) return;
    this.roomShown = i;
    const room = this.def.rooms[i]!;
    this.app.renderer.background.color = room.background ?? 0x000000;
    for (const b of this.backdrops) {
      b.color?.destroy();
      b.picture?.destroy();
    }
    this.backdrops = (room.backgrounds ?? []).map((bg) => {
      const color = bg.color !== undefined ? new Graphics() : null;
      if (color) {
        color.rect(0, 0, 1, 1).fill({ color: bg.color! });
        color.zIndex = -bg.depth;
        this.world.addChild(color);
      }
      const si = bg.sprite ? this.def.sprites.findIndex((s) => s.name === bg.sprite) : -1;
      const tex = si >= 0 ? this.frames[si]?.[0] : undefined;
      let picture: TilingSprite | Sprite | null = null;
      if (tex) {
        picture = bg.mode === "tile" ? new TilingSprite({ texture: tex }) : new Sprite(tex);
        picture.zIndex = -bg.depth + 0.5; // over its own colour
        this.world.addChild(picture);
      }
      return { def: bg, color, picture };
    });
    for (const v of this.tileViews) v.container.destroy({ children: true });
    this.tileViews = this.engine.tiles.map((t) => {
      const container = new Container();
      container.zIndex = -t.def.depth;
      container.visible = t.def.visible;
      this.world.addChild(container);
      return { container, chunks: new Map() };
    });
  }

  private chunkKey(cx: number, cy: number) {
    return cy * 100000 + cx;
  }

  /** Makes (or refreshes) one tile's sprite in its chunk. */
  private drawTile(chunk: Chunk, t: Engine["tiles"][number], cell: number) {
    const tile = t.cells[cell]!;
    const tex = tile >= 0 ? this.tileTextures.get(t.tileset.name)?.[tile] : undefined;
    let sp = chunk.sprites.get(cell);
    if (!tex) {
      // Cleared (tile_set None): free the sprite rather than keep it hidden.
      sp?.destroy();
      chunk.sprites.delete(cell);
      return;
    }
    if (!sp) {
      sp = new Sprite(tex);
      sp.position.set((cell % t.def.columns) * t.tileset.tileWidth, Math.floor(cell / t.def.columns) * t.tileset.tileHeight);
      chunk.container.addChild(sp);
      chunk.sprites.set(cell, sp);
    }
    sp.texture = tex;
    sp.visible = true;
  }

  private buildChunk(view: TileView, t: Engine["tiles"][number], cx: number, cy: number): Chunk {
    const chunk: Chunk = { container: new Container(), sprites: new Map() };
    view.container.addChild(chunk.container);
    const cols = t.def.columns;
    for (let r = cy * CHUNK; r < Math.min(t.def.rows, (cy + 1) * CHUNK); r++)
      for (let c = cx * CHUNK; c < Math.min(cols, (cx + 1) * CHUNK); c++) if (t.cells[r * cols + c]! >= 0) this.drawTile(chunk, t, r * cols + c);
    view.chunks.set(this.chunkKey(cx, cy), chunk);
    return chunk;
  }

  /** Shows the chunks the view can see (plus a margin), hides the rest, frees far ones. */
  private placeTiles(vx: number, vy: number) {
    const cam = this.engine.camera;
    this.tilesShown = 0;
    for (let L = 0; L < this.tileViews.length; L++) {
      const view = this.tileViews[L]!, t = this.engine.tiles[L]!;
      const cw = CHUNK * t.tileset.tileWidth, ch = CHUNK * t.tileset.tileHeight;
      const x0 = Math.floor(vx / cw) - 1, x1 = Math.floor((vx + cam.w) / cw) + 1;
      const y0 = Math.floor(vy / ch) - 1, y1 = Math.floor((vy + cam.h) / ch) + 1;
      for (const [key, chunk] of view.chunks) {
        const cx = key % 100000, cy = Math.floor(key / 100000);
        const near = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
        chunk.container.visible = near;
        const far = cx < x0 - FREE_BEYOND || cx > x1 + FREE_BEYOND || cy < y0 - FREE_BEYOND || cy > y1 + FREE_BEYOND;
        if (far) {
          chunk.container.destroy({ children: true });
          view.chunks.delete(key);
        }
      }
      const maxCx = Math.ceil(t.def.columns / CHUNK) - 1, maxCy = Math.ceil(t.def.rows / CHUNK) - 1;
      for (let cy = Math.max(0, y0); cy <= Math.min(maxCy, y1); cy++)
        for (let cx = Math.max(0, x0); cx <= Math.min(maxCx, x1); cx++)
          if (!view.chunks.has(this.chunkKey(cx, cy))) this.buildChunk(view, t, cx, cy);
      for (const chunk of view.chunks.values()) if (chunk.container.visible) this.tilesShown += chunk.sprites.size;
    }
  }

  /** Background layers follow the view: a colour and a repeating picture always fill the window. */
  private placeBackdrops(vx: number, vy: number, step: number) {
    const cam = this.engine.camera;
    const room = this.def.rooms[this.roomShown]!;
    for (const { def: bg, color, picture } of this.backdrops) {
      if (color) {
        color.position.set(vx, vy);
        color.scale.set(cam.w, cam.h);
      }
      if (!picture) continue;
      // Parallax 0 sits in the room; 1 is fixed to the screen; between,
      // it slides more slowly than the room — further away.
      const px = vx * bg.parallax + bg.hspeed * step;
      const py = vy * bg.parallax + bg.vspeed * step;
      if (picture instanceof TilingSprite) {
        picture.position.set(vx, vy);
        picture.width = cam.w;
        picture.height = cam.h;
        picture.tilePosition.set(px - vx, py - vy);
      } else if (bg.mode === "stretch") {
        picture.position.set(px, py);
        picture.width = room.width;
        picture.height = room.height;
      } else {
        picture.position.set(px, py);
      }
    }
  }

  render() {
    this.syncRoom();
    const { st, g } = this.engine.fresh();
    const n = g[G.SLOTS]!;
    const flags = this.engine.flags;
    const cam = this.engine.camera;
    // Whole pixels, so pixel art doesn't shimmer as a smooth camera glides.
    const vx = Math.round(cam.x + cam.offX), vy = Math.round(cam.y + cam.offY);
    this.world.position.set(-vx, -vy);
    this.placeBackdrops(vx, vy, g[G.FRAME]!);
    // Tiles tile_set() changed since the last frame. A chunk not built yet
    // will read the cell when it is; only built ones need telling.
    for (const [layer, cell] of this.engine.tileChanges) {
      const view = this.tileViews[layer], t = this.engine.tiles[layer];
      if (!view || !t) continue;
      const c = cell % t.def.columns, r = Math.floor(cell / t.def.columns);
      const chunk = view.chunks.get(this.chunkKey(Math.floor(c / CHUNK), Math.floor(r / CHUNK)));
      if (chunk) this.drawTile(chunk, t, cell);
    }
    this.engine.tileChanges.length = 0;
    this.placeTiles(vx, vy);

    for (let s = 0; s < n; s++) {
      const b = s * STRIDE;
      let sp = this.sprites[s] ?? null;
      if (!st[b + F.ALIVE]) {
        if (sp) sp.visible = false;
        continue;
      }
      const si = st[b + F.SPRITE]!;
      const frames = this.frames[si];
      if (!frames) {
        if (sp) sp.visible = false;
        continue;
      }
      if (!sp) {
        sp = new Sprite(frames[0]!);
        this.sprites[s] = sp;
        this.world.addChild(sp);
      }
      const gen = st[b + F.GEN]!;
      if (this.gens[s] !== gen) {
        this.gens[s] = gen;
        sp.texture = frames[0]!;
      }
      const custom = (flags[st[b + F.TYPE]!]! & HANDLES.DRAW) !== 0;
      sp.visible = st[b + F.VISIBLE]! !== 0 && (!custom || st[b + F.DRAWN]! !== 0);
      if (!sp.visible) continue;
      const frame = frames[Math.floor(st[b + F.IMAGE_INDEX]!) % frames.length] ?? frames[0]!;
      if (sp.texture !== frame) sp.texture = frame;
      const a = this.anchors[si]!;
      sp.anchor.set(a.x, a.y);
      sp.position.set(st[b + F.X]!, st[b + F.Y]!);
      sp.scale.set(st[b + F.XSCALE]!, st[b + F.YSCALE]!);
      // GameMaker's angles turn counter-clockwise; Pixi's turn clockwise.
      sp.rotation = -st[b + F.ANGLE]! * DEG;
      sp.alpha = st[b + F.ALPHA]!;
      // Lower depth is drawn on top.
      sp.zIndex = -st[b + F.DEPTH]!;
    }

    this.worldDraw.render(this.engine.drawList);
    this.guiDraw.render(this.engine.guiList);
    this.drawOverlay(st, n);
    this.app.renderer.render(this.app.stage);
  }

  private drawOverlay(st: Float64Array, n: number) {
    this.masks.clear();
    const lines: string[] = [];
    if (this.showDebug) {
      lines.push(this.statsLine);
      const box: Box = { left: 0, top: 0, right: 0, bottom: 0 };
      for (let s = 0; s < n; s++) {
        const b = s * STRIDE;
        if (!st[b + F.ALIVE]) continue;
        if (!boxOf(st, s, st[b + F.X]!, st[b + F.Y]!, this.engine.sprites, box)) continue;
        this.masks.rect(box.left, box.top, box.right - box.left, box.bottom - box.top);
      }
      this.masks.stroke({ color: 0x22ff88, width: 1, alignment: 1 });
    }
    if (this.engine.debugText) lines.push(this.engine.debugText);
    const text = lines.join("\n");
    if (this.debugLabel.text !== text) this.debugLabel.text = text;
  }

  destroy() {
    this.app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
  }
}
