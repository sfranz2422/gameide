/**
 * In the game's worker, before a game starts: each sprite's pictures are
 * decoded once (the renderer and the masks share the result), and sprites
 * with a pixel-precise mask get their solid pixels, frame by frame.
 *
 * Done here rather than stored in the project because the pixels are the
 * pictures — storing them again would be one more thing to fall out of step
 * when a frame is replaced.
 */
import type { GameDefinition } from "../engine/game";
import { pixelsOf, solidPixels } from "../store/imageTools";

export async function prepareSprites(def: GameDefinition): Promise<void> {
  for (const t of def.tilesets ?? []) {
    if (t.image instanceof Blob) {
      const bmp = await createImageBitmap(t.image).catch(() => null);
      if (bmp) t.image = bmp;
      else delete t.image;
    }
  }
  for (const s of def.sprites) {
    if (!s.images?.length) continue;
    const bitmaps = await Promise.all(
      s.images.map(async (img) => (img instanceof Blob ? createImageBitmap(img).catch(() => null) : img)),
    );
    // A picture that won't decode is left out; the renderer draws a
    // placeholder in its place rather than nothing.
    s.images = bitmaps.filter((b): b is ImageBitmap => b !== null);
    const mask = s.mask as { kind?: string } | undefined;
    if (mask?.kind === "precise" && s.images.length) {
      s.pixelMasks = s.images.map((bmp) => {
        const px = pixelsOf(bmp as ImageBitmap, s.width, s.height);
        return solidPixels(px.data, px.width, px.height);
      });
    }
  }
}
