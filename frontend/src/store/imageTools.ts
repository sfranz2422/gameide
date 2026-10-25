/**
 * Pictures into sprites: decoding a file (every frame of an animated GIF
 * where the browser can), working out where the frames are on a sprite
 * sheet, cutting them out, and finding the part of a picture that isn't
 * transparent.
 *
 * The arithmetic (gridRects, stripRects, opaqueBounds) is plain functions
 * on numbers so it is tested without a browser; the rest needs canvases.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridParams {
  frameWidth: number;
  frameHeight: number;
  /** 0 = as many as fit. */
  columns: number;
  rows: number;
  offsetX: number;
  offsetY: number;
  spacingX: number;
  spacingY: number;
}

/**
 * The frames on a sheet laid out in a grid, left to right then top to
 * bottom (the order they animate in). Only frames wholly inside the picture
 * count: a half frame at the edge is a mistake in the numbers, not a frame.
 */
export function gridRects(p: GridParams, imageWidth: number, imageHeight: number): Rect[] {
  const fw = Math.floor(p.frameWidth), fh = Math.floor(p.frameHeight);
  if (fw < 1 || fh < 1) return [];
  const stepX = fw + Math.max(0, p.spacingX), stepY = fh + Math.max(0, p.spacingY);
  const fitCols = Math.floor((imageWidth - p.offsetX + Math.max(0, p.spacingX)) / stepX);
  const fitRows = Math.floor((imageHeight - p.offsetY + Math.max(0, p.spacingY)) / stepY);
  const cols = p.columns > 0 ? Math.min(p.columns, fitCols) : fitCols;
  const rows = p.rows > 0 ? Math.min(p.rows, fitRows) : fitRows;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push({ x: p.offsetX + c * stepX, y: p.offsetY + r * stepY, w: fw, h: fh });
  return out;
}

/** `count` equal frames side by side (or stacked, for a tall strip). */
export function stripRects(count: number, imageWidth: number, imageHeight: number, vertical = false): Rect[] {
  const n = Math.max(1, Math.floor(count));
  const w = vertical ? imageWidth : Math.floor(imageWidth / n);
  const h = vertical ? Math.floor(imageHeight / n) : imageHeight;
  if (w < 1 || h < 1) return [];
  return Array.from({ length: n }, (_, i) => (vertical ? { x: 0, y: i * h, w, h } : { x: i * w, y: 0, w, h }));
}

/**
 * Whether a pixel counts as part of the shape: half-transparent or more.
 * The soft edge of an anti-aliased drawing then doesn't make a mask bigger
 * than the shape the student sees.
 */
export const SOLID_ALPHA = 128;

/**
 * The box around every pixel that is solid in any of the frames (RGBA data,
 * all the same size), or null if every frame is fully transparent. Right
 * and bottom are exclusive, like every mask.
 */
export function opaqueBounds(frames: { data: Uint8ClampedArray; width: number; height: number }[]): { left: number; top: number; right: number; bottom: number } | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const f of frames) {
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        if (f.data[(y * f.width + x) * 4 + 3]! >= SOLID_ALPHA) {
          if (x < left) left = x;
          if (x + 1 > right) right = x + 1;
          if (y < top) top = y;
          if (y + 1 > bottom) bottom = y + 1;
        }
      }
    }
  }
  return left === Infinity ? null : { left, top, right, bottom };
}

/** One byte per pixel, 1 where solid: what a precise mask tests against. */
export function solidPixels(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3]! >= SOLID_ALPHA ? 1 : 0;
  return out;
}

/** The pixels of a picture (works in the page and in a worker). */
export function pixelsOf(image: ImageBitmap | OffscreenCanvas, width = image.width, height = image.height): ImageData {
  const c = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export const MAX_IMAGE_SIDE = 4096;

export interface Decoded {
  /** One picture, or every frame of an animated GIF. */
  frames: ImageBitmap[];
  width: number;
  height: number;
  /** The GIF's own speed, when it had one. */
  fps?: number;
}

/**
 * Reads an image file. An animated GIF gives all its frames where the
 * browser can decode them (ImageDecoder: Chrome and Edge); elsewhere its
 * first frame, which is still a usable sprite sheet source.
 */
export async function decodeImage(file: Blob): Promise<Decoded> {
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type) && !(await looksLikeImage(file)))
    throw new Error("That file isn't a PNG, JPG or GIF picture.");
  type Dec = { decode(o: { frameIndex: number }): Promise<{ image: VideoFrame }>; tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null } };
  const ImageDecoderCtor = (globalThis as unknown as { ImageDecoder?: new (o: { data: ReadableStream | ArrayBuffer; type: string }) => Dec }).ImageDecoder;
  if (file.type === "image/gif" && ImageDecoderCtor) {
    try {
      const dec = new ImageDecoderCtor({ data: await file.arrayBuffer(), type: "image/gif" });
      await dec.tracks.ready;
      const count = dec.tracks.selectedTrack?.frameCount ?? 1;
      const frames: ImageBitmap[] = [];
      let duration = 0;
      for (let i = 0; i < Math.min(count, 200); i++) {
        const { image } = await dec.decode({ frameIndex: i });
        duration += image.duration ?? 0;
        frames.push(await createImageBitmap(image));
        image.close();
      }
      const avgMs = duration / frames.length / 1000;
      return check({ frames, width: frames[0]!.width, height: frames[0]!.height, ...(avgMs > 0 ? { fps: Math.round(1000 / avgMs) } : {}) });
    } catch {
      /* fall through to the first frame */
    }
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("That picture couldn't be opened. It may be damaged, or a kind of file browsers can't show.");
  }
  return check({ frames: [bmp], width: bmp.width, height: bmp.height });
}

function check(d: Decoded): Decoded {
  if (d.width > MAX_IMAGE_SIDE || d.height > MAX_IMAGE_SIDE)
    throw new Error(`That picture is ${d.width} × ${d.height}. Pictures can be at most ${MAX_IMAGE_SIDE} pixels on a side.`);
  return d;
}

async function looksLikeImage(file: Blob): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const s = String.fromCharCode(...b);
  return s.startsWith("\x89PNG") || (b[0] === 0xff && b[1] === 0xd8) || s.startsWith("GIF8") || (s.startsWith("RIFF") && s.slice(8, 12) === "WEBP");
}

/** Cuts rectangles out of a picture, each as a PNG. */
export async function cutFrames(image: ImageBitmap, rects: Rect[]): Promise<Blob[]> {
  const out: Blob[] = [];
  for (const r of rects) {
    const c = new OffscreenCanvas(r.w, r.h);
    c.getContext("2d")!.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    out.push(await c.convertToBlob({ type: "image/png" }));
  }
  return out;
}

/** The opaque box across a sprite's frames, from their PNGs. */
export async function boundsOfBlobs(blobs: Blob[]) {
  const frames = [];
  for (const b of blobs) {
    const bmp = await createImageBitmap(b);
    frames.push(pixelsOf(bmp));
    bmp.close();
  }
  return opaqueBounds(frames);
}
