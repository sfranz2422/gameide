/**
 * Draws the engine's state with PixiJS. It only ever reads: positions,
 * frames and depths come straight out of the shared state array each frame,
 * and the Draw-event commands Python returned come from Engine.drawList.
 *
 * One Pixi Sprite per slot, reused for as long as the slot's GEN is the
 * same. A slot handed to a new instance (GEN changed) gets its sprite reset,
 * so a bullet never briefly appears with the last bullet's frame.
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { Engine } from "../engine";
import type { GameDefinition, SpriteDef } from "../game";
import { F, G, HANDLES, STRIDE } from "../layout";
import { boxOf, type Box } from "../sprites";

const DEG = Math.PI / 180;

function paintFrames(def: SpriteDef): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < Math.max(1, def.frameCount); i++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, def.width);
    canvas.height = Math.max(1, def.height);
    const ctx = canvas.getContext("2d")!;
    def.paint?.(ctx, i);
    const tex = Texture.from(canvas);
    // Students' art is mostly pixel art; smoothing would blur it when the
    // game is scaled up to fill the pane.
    tex.source.scaleMode = "nearest";
    frames.push(tex);
  }
  return frames;
}

export class PixiRenderer {
  private readonly frames: Texture[][];
  private readonly anchors: { x: number; y: number }[];
  private readonly world = new Container({ sortableChildren: true });
  private readonly overlay = new Container();
  private readonly masks = new Graphics();
  private readonly debugLabel = new Text({
    text: "",
    style: { fill: 0xffffff, fontFamily: "monospace", fontSize: 12, stroke: { color: 0x000000, width: 3 } },
  });
  private sprites: (Sprite | null)[] = [];
  private gens: number[] = [];
  private graphicsByDepth = new Map<number, Graphics>();
  private texts: Text[] = [];
  private drawnSprites: Sprite[] = [];
  private roomShown = -1;
  showDebug = false;
  /** One line of figures for the debug overlay, set by the session. */
  statsLine = "";

  private constructor(
    readonly app: Application,
    private readonly def: GameDefinition,
    private readonly engine: Engine,
  ) {
    this.frames = def.sprites.map(paintFrames);
    this.anchors = def.sprites.map((s) => ({
      x: s.width ? s.originX / s.width : 0,
      y: s.height ? s.originY / s.height : 0,
    }));
    app.stage.addChild(this.world, this.overlay);
    this.overlay.addChild(this.masks, this.debugLabel);
    this.debugLabel.position.set(6, 4);
  }

  static async create(host: HTMLElement, def: GameDefinition, engine: Engine): Promise<PixiRenderer> {
    const room = def.rooms[0]!;
    const app = new Application();
    await app.init({
      width: room.width,
      height: room.height,
      background: room.background ?? 0x000000,
      antialias: false,
      autoStart: false, // the game loop decides when to draw, not Pixi's ticker
      preference: "webgl",
    });
    app.canvas.dataset.tutorial = "game-canvas";
    app.canvas.tabIndex = 0;
    host.appendChild(app.canvas);
    return new PixiRenderer(app, def, engine);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** Room coordinates of a pointer event, allowing for the canvas being scaled by CSS. */
  toRoom(e: PointerEvent): { x: number; y: number } {
    const r = this.app.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * this.app.renderer.width,
      y: ((e.clientY - r.top) / r.height) * this.app.renderer.height,
    };
  }

  private syncRoom() {
    const i = this.engine.roomIndex;
    if (i === this.roomShown) return;
    this.roomShown = i;
    const room = this.def.rooms[i]!;
    this.app.renderer.resize(room.width, room.height);
    this.app.renderer.background.color = room.background ?? 0x000000;
  }

  render() {
    this.syncRoom();
    const { st, g } = this.engine.fresh();
    const n = g[G.SLOTS]!;
    const flags = this.engine.flags;

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

    this.drawCommands();
    this.drawOverlay(st, n);
    this.app.renderer.render(this.app.stage);
  }

  private graphicsAt(depth: number): Graphics {
    let gfx = this.graphicsByDepth.get(depth);
    if (!gfx) {
      gfx = new Graphics();
      gfx.zIndex = -depth;
      this.graphicsByDepth.set(depth, gfx);
      this.world.addChild(gfx);
    }
    return gfx;
  }

  /** Draw-event output. Text and sprite objects are pooled and reused by position in the list. */
  private drawCommands() {
    for (const gfx of this.graphicsByDepth.values()) gfx.clear();
    let ti = 0;
    let si = 0;
    for (const cmd of this.engine.drawList) {
      switch (cmd[0]) {
        case "rect": {
          const [, depth, x1, y1, x2, y2, color, outline] = cmd;
          const gfx = this.graphicsAt(depth);
          const x = Math.min(x1, x2), y = Math.min(y1, y2);
          gfx.rect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
          if (outline) gfx.stroke({ color, width: 1, alignment: 1 });
          else gfx.fill({ color });
          break;
        }
        case "text": {
          const [, depth, x, y, text, color] = cmd;
          let t = this.texts[ti];
          if (!t) {
            t = new Text({ text: "", style: { fill: 0xffffff, fontFamily: "monospace", fontSize: 16 } });
            this.texts.push(t);
            this.world.addChild(t);
          }
          ti++;
          // Re-rendering a Text's texture is the expensive part; skip it
          // when nothing changed, which is nearly every frame for a HUD.
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
          let sp = this.drawnSprites[si];
          if (!sp) {
            sp = new Sprite(frames[0]!);
            this.drawnSprites.push(sp);
            this.world.addChild(sp);
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
    for (let i = si; i < this.drawnSprites.length; i++) this.drawnSprites[i]!.visible = false;
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
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
  }
}
