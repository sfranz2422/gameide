/**
 * Drawing game feel (engine/effects.ts holds the state; this draws it):
 *
 *   ParticleLayer   the particles, in Pixi ParticleContainers — one per
 *                   depth used, because a container is drawn all at one depth
 *   LightLayer      darkness over the room with light() cut out of it, and a
 *                   soft coloured glow where each light is
 *   outlineFilter   a sprite's outline or glow (outline / glow properties)
 *   flashFilter     a sprite drawn as one colour (flash())
 *   screenFilter    a look for the whole screen (screen_effect())
 *
 * The shaders are WebGL only: the renderer asks Pixi for WebGL
 * (pixiRenderer.ts, `preference`), and every school Chromebook has it.
 */
import { ColorMatrixFilter, Container, Filter, GlProgram, Graphics, Particle, ParticleContainer, RenderTexture, Sprite, Texture, type Renderer } from "pixi.js";
import type { Effects } from "../effects";

const VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

/**
 * Our shaders read uInputSize in the fragment as well as the vertex; Pixi
 * gives a fragment medium precision by default, and a uniform at two
 * precisions fails to link — "Could not initialize shader", and the effect
 * silently isn't drawn. So every one of ours is high precision throughout.
 */
const program = (fragment: string, name: string) =>
  GlProgram.from({ vertex: VERTEX, fragment, name, preferredVertexPrecision: "highp", preferredFragmentPrecision: "highp" });

const rgb = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

// ---------------------------------------------------------------- one sprite

/**
 * An outline (hard, `glow` 0) or a glow (soft, fading out, `glow` 1) round
 * whatever the sprite draws, in a colour. Samples the sprite's alpha in 16
 * directions at a few distances: cheap enough for a dozen glowing things.
 */
const OUTLINE = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec3 uColor;
uniform float uWidth;
uniform float uGlow;
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  float m = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 0.3926991;
    vec2 d = vec2(cos(a), sin(a)) * uInputSize.zw;
    for (int j = 1; j <= 4; j++) {
      float k = float(j) / 4.0;
      float s = texture(uTexture, vTextureCoord + d * uWidth * k).a;
      m = max(m, s * mix(1.0, 1.0 - k * 0.85, uGlow));
    }
  }
  vec4 edge = vec4(uColor, 1.0) * m * mix(1.0, 0.9, uGlow);
  finalColor = c + edge * (1.0 - c.a);
}`;

export function outlineFilter(color: number, glow: boolean): Filter {
  const f = new Filter({
    glProgram: program(OUTLINE, "gameide-outline"),
    resources: {
      outline: {
        uColor: { value: new Float32Array(rgb(color)), type: "vec3<f32>" },
        uWidth: { value: glow ? 6 : 1.5, type: "f32" },
        uGlow: { value: glow ? 1 : 0, type: "f32" },
      },
    },
  });
  f.padding = glow ? 8 : 3;
  return f;
}

export function setOutline(f: Filter, color: number, glow: boolean) {
  const u = (f.resources as { outline: { uniforms: { uColor: Float32Array; uWidth: number; uGlow: number } } }).outline.uniforms;
  u.uColor.set(rgb(color));
  u.uWidth = glow ? 6 : 1.5;
  u.uGlow = glow ? 1 : 0;
  f.padding = glow ? 8 : 3;
}

/** The sprite as one solid colour, its shape kept: every pixel's colour replaced, its alpha left. */
export function flashFilter(color: number): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  setFlash(f, color);
  return f;
}

export function setFlash(f: ColorMatrixFilter, color: number) {
  const [r, g, b] = rgb(color);
  f.matrix = [0, 0, 0, 0, r!, 0, 0, 0, 0, g!, 0, 0, 0, 0, b!, 0, 0, 0, 1, 0];
}

// ---------------------------------------------------------------- the whole screen

/** `uv` is 0–1 across the screen, whatever padding the filter's texture has. */
const SCREEN_HEAD = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
vec2 screenUv() { return vTextureCoord * uInputSize.xy / uOutputFrame.zw; }
`;

const SHADERS: Record<string, string> = {
  // Darker towards the corners.
  vignette: `${SCREEN_HEAD}
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  float d = distance(screenUv(), vec2(0.5));
  finalColor = vec4(c.rgb * smoothstep(0.85, 0.35, d), c.a);
}`,
  // An old TV: scanlines, colours a little apart, darker corners.
  crt: `${SCREEN_HEAD}
void main() {
  vec2 uv = screenUv();
  vec2 px = uInputSize.zw;
  float r = texture(uTexture, vTextureCoord + vec2(px.x, 0.0)).r;
  vec4 c = texture(uTexture, vTextureCoord);
  float b = texture(uTexture, vTextureCoord - vec2(px.x, 0.0)).b;
  vec3 col = vec3(r, c.g, b);
  float line = mod(floor(uv.y * uOutputFrame.w), 2.0);
  col *= 1.0 - 0.22 * line;
  col *= smoothstep(0.9, 0.4, distance(uv, vec2(0.5)));
  finalColor = vec4(col * 1.08, c.a);
}`,
  // Big blocky pixels.
  pixelate: `${SCREEN_HEAD}
void main() {
  vec2 block = uInputSize.zw * 4.0;
  finalColor = texture(uTexture, (floor(vTextureCoord / block) + 0.5) * block);
}`,
};

/** A whole-screen look (effects.ts SCREEN_EFFECTS). */
export function screenFilter(name: string): Filter | null {
  if (name === "grayscale" || name === "sepia") {
    const f = new ColorMatrixFilter();
    if (name === "grayscale") f.desaturate();
    else f.sepia(false);
    return f;
  }
  const fragment = SHADERS[name];
  if (!fragment) return null;
  return new Filter({ glProgram: program(fragment, `gameide-${name}`) });
}

// ---------------------------------------------------------------- particles

/** One small picture with a square and a round dot side by side: every particle is one or the other. */
function particleTextures(): [Texture, Texture] {
  const c = new OffscreenCanvas(16, 8);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 8, 8);
  ctx.beginPath();
  ctx.arc(12, 4, 4, 0, Math.PI * 2);
  ctx.fill();
  const base = Texture.from(c);
  base.source.scaleMode = "linear";
  const at = (x: number) => new Texture({ source: base.source, frame: { x, y: 0, width: 8, height: 8 } as never });
  return [at(0), at(8)];
}

export class ParticleLayer {
  private readonly layers = new Map<number, { container: ParticleContainer; pool: Particle[] }>();
  private readonly tex: [Texture, Texture];

  constructor(private readonly world: Container) {
    this.tex = particleTextures();
  }

  private layer(depth: number) {
    let l = this.layers.get(depth);
    if (!l) {
      const container = new ParticleContainer({
        texture: this.tex[0],
        dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: true },
      });
      container.zIndex = -depth;
      this.world.addChild(container);
      l = { container, pool: [] };
      this.layers.set(depth, l);
    }
    return l;
  }

  /** Puts every live particle on screen; Particles are reused, never made per frame once there are enough. */
  draw(fx: Effects) {
    const used = new Map<number, number>();
    for (let p = 0; p < fx.count; p++) {
      const depth = fx.depth[p]!;
      const l = this.layer(depth);
      const n = used.get(depth) ?? 0;
      used.set(depth, n + 1);
      let part = l.pool[n];
      if (!part) {
        part = new Particle({ texture: this.tex[0], anchorX: 0.5, anchorY: 0.5 });
        l.pool.push(part);
      }
      const t = fx.life[p]! / fx.maxLife[p]!; // 1 at birth, 0 at the end
      const size = fx.size[p]! * (1 + fx.grow[p]! * (1 - t)) / 8;
      part.texture = this.tex[fx.circle[p] ? 1 : 0];
      part.x = fx.x[p]!;
      part.y = fx.y[p]!;
      part.scaleX = size;
      part.scaleY = size * fx.stretch[p]!;
      part.rotation = fx.stretch[p]! > 1 ? Math.atan2(fx.vx[p]!, -fx.vy[p]!) : (fx.angle[p]! * Math.PI) / 180;
      part.tint = fx.color[p]!;
      // Fades over the last half of its life.
      part.alpha = Math.min(1, t * 2);
    }
    for (const [depth, l] of this.layers) {
      const n = used.get(depth) ?? 0;
      const kids = l.container.particleChildren;
      if (kids.length !== n) {
        kids.length = 0;
        for (let i = 0; i < n; i++) kids.push(l.pool[i]!);
      }
      l.container.update();
      l.container.visible = n > 0;
    }
  }
}

// ---------------------------------------------------------------- lighting

/** A soft round light: white in the middle, fading to nothing at the edge. */
function lightTexture(): Texture {
  const c = new OffscreenCanvas(128, 128);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

/**
 * Darkness over the room, drawn into its own texture each frame: filled with
 * the dark colour, then each light erased out of it. Shown over the room and
 * under Draw GUI, so a score never goes dark. Each light also adds a soft
 * glow of its colour to the room (`glows`, in the world, added on top).
 */
export class LightLayer {
  readonly screen = new Container();
  private readonly scene = new Container();
  private readonly dark = new Graphics();
  private readonly erase: Sprite[] = [];
  private readonly glow: Sprite[] = [];
  private readonly glows = new Container();
  private readonly tex = lightTexture();
  private target: RenderTexture | null = null;
  private readonly shown = new Sprite();

  constructor(world: Container) {
    this.scene.addChild(this.dark);
    this.screen.addChild(this.shown);
    this.glows.zIndex = 1e8; // over everything in the room
    world.addChild(this.glows);
  }

  draw(renderer: Renderer, fx: Effects, vx: number, vy: number, w: number, h: number) {
    const lights = fx.lights;
    // The glows: in the room, so they move with it.
    for (let i = 0; i < Math.max(lights.length, this.glow.length); i++) {
      const L = lights[i];
      let s = this.glow[i];
      if (!L) {
        if (s) s.visible = false;
        continue;
      }
      if (!s) {
        s = new Sprite(this.tex);
        s.anchor.set(0.5);
        s.blendMode = "add";
        this.glow.push(s);
        this.glows.addChild(s);
      }
      s.visible = true;
      s.position.set(L[0], L[1]);
      s.width = s.height = L[2] * 2;
      s.tint = L[3];
      s.alpha = 0.22 * L[4];
    }
    this.screen.visible = fx.darkness > 0;
    if (!this.screen.visible) return;
    if (!this.target || this.target.width !== w || this.target.height !== h) {
      this.target?.destroy(true);
      this.target = RenderTexture.create({ width: w, height: h });
      this.shown.texture = this.target;
    }
    this.dark.clear().rect(0, 0, w, h).fill({ color: fx.darkColor, alpha: fx.darkness });
    for (let i = 0; i < Math.max(lights.length, this.erase.length); i++) {
      const L = lights[i];
      let s = this.erase[i];
      if (!L) {
        if (s) s.visible = false;
        continue;
      }
      if (!s) {
        s = new Sprite(this.tex);
        s.anchor.set(0.5);
        s.blendMode = "erase";
        this.erase.push(s);
        this.scene.addChild(s);
      }
      s.visible = true;
      // The darkness is drawn on the screen, so lights go where the room is on it.
      s.position.set(L[0] - vx, L[1] - vy);
      s.width = s.height = L[2] * 2;
      s.alpha = L[4];
    }
    renderer.render({ container: this.scene, target: this.target, clear: true });
  }
}
