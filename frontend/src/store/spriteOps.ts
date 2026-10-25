/**
 * Making and changing sprites from pictures. Kept out of the React code so
 * the rules — names, origins, keeping an automatic mask fitted — live in
 * one place.
 */
import { boundsOfBlobs } from "./imageTools";
import { newId, type SpriteMask, type SpriteResource } from "./project";

export interface NewFrames {
  name: string;
  frames: Blob[];
  width: number;
  height: number;
  fps: number;
  origin: "top-left" | "center" | "bottom-center";
}

export function originFor(o: NewFrames["origin"], w: number, h: number): [number, number] {
  return o === "top-left" ? [0, 0] : o === "center" ? [Math.floor(w / 2), Math.floor(h / 2)] : [Math.floor(w / 2), h];
}

/** A sprite name not already used (sprites are named in students' code, so they must differ). */
export function freeSpriteName(base: string, taken: string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!lower.has(`${base}${i}`.toLowerCase())) return `${base}${i}`;
}

/** A new sprite from imported frames, with its mask fitted to the picture. */
export async function spriteFromFrames(f: NewFrames, taken: string[]): Promise<{ sprite: SpriteResource; assets: Map<string, Blob> }> {
  const assets = new Map<string, Blob>();
  const frames = f.frames.map((b) => {
    const id = newId();
    assets.set(id, b);
    return id;
  });
  const [originX, originY] = originFor(f.origin, f.width, f.height);
  const box = (await boundsOfBlobs(f.frames)) ?? { left: 0, top: 0, right: f.width, bottom: f.height };
  return {
    sprite: {
      id: newId(),
      name: freeSpriteName(f.name, taken),
      width: f.width,
      height: f.height,
      originX,
      originY,
      frames,
      fps: f.fps,
      mask: { kind: "auto", ...box },
    },
    assets,
  };
}

/**
 * The mask after the frames changed. An automatic or exact mask is refitted
 * to the opaque pixels of the frames now there; one set by hand is the
 * student's, and stays as they set it.
 */
export async function refitMask(
  mask: SpriteMask | undefined,
  frames: Blob[],
  width: number,
  height: number,
  measure: (frames: Blob[]) => Promise<{ left: number; top: number; right: number; bottom: number } | null> = boundsOfBlobs,
): Promise<SpriteMask | undefined> {
  // No mask at all is the automatic box; a mask saved before masks had
  // kinds was a box set by hand, and stays.
  const kind = mask ? ((mask as { kind?: string }).kind ?? "rect") : "auto";
  if (kind !== "auto" && kind !== "precise") return mask;
  const box = (await measure(frames)) ?? { left: 0, top: 0, right: width, bottom: height };
  return { kind, ...box };
}
