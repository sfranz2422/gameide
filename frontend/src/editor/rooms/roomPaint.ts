/**
 * A room's picture, for the room editor and Scene mode's position picker: its
 * decoded pictures and everything in it drawn in depth order. The caller sets
 * up the canvas's transform to the view it passes.
 */
import { useEffect, useRef, useState } from "react";
import { TILE_MASK } from "../../engine/game";
import { find, tilesetGrid, type Project, type RoomInstance, type RoomLayer, type RoomResource } from "../../store/project";
import { drawTileValue } from "../tiles/tileOps";
import { tileRect } from "../tiles/TilesetEditor";
import { drawOrder, shapeOf, visibleLayers } from "./roomOps";

/**
 * Decoded pictures that are swapped, not closed early: the old set is closed
 * only after the new one is showing. Closing them in the effect's cleanup
 * left the canvas drawing closed pictures until the new ones decoded, and
 * drawImage throws on those ("the image source is detached").
 */
function useBitmaps(key: string, load: () => Promise<Map<string, ImageBitmap>>) {
  const [images, setImages] = useState(new Map<string, ImageBitmap>());
  const shown = useRef<Map<string, ImageBitmap>>(new Map());
  useEffect(() => {
    let alive = true;
    void load().then((next) => {
      if (!alive) return next.forEach((b) => b.close());
      const old = shown.current;
      shown.current = next;
      setImages(next);
      setTimeout(() => old.forEach((b) => b.close()), 0);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => shown.current.forEach((b) => b.close()), []);
  return images;
}

/** The first frame of every sprite, decoded, for drawing the room. */
export function useSpriteImages(project: Project, assets: Map<string, Blob>) {
  const key = project.sprites.map((s) => `${s.id}:${s.frames[0] ?? ""}:${assets.has(s.frames[0] ?? "")}`).join(",");
  return useBitmaps(key, async () => {
    const out = new Map<string, ImageBitmap>();
    for (const s of project.sprites) {
      const blob = s.frames[0] ? assets.get(s.frames[0]) : undefined;
      if (!blob) continue;
      try {
        out.set(s.id, await createImageBitmap(blob));
      } catch {
        /* drawn as a stand-in box */
      }
    }
    return out;
  });
}

/** Every tileset's picture, decoded, for drawing tile layers and the palette. */
export function useTilesetImages(project: Project, assets: Map<string, Blob>) {
  const key = project.tilesets.map((t) => `${t.id}:${t.image ?? ""}:${assets.has(t.image ?? "")}`).join(",");
  return useBitmaps(key, async () => {
    const out = new Map<string, ImageBitmap>();
    for (const t of project.tilesets) {
      const blob = t.image ? assets.get(t.image) : undefined;
      if (!blob) continue;
      try {
        out.set(t.id, await createImageBitmap(blob));
      } catch {
        /* drawn as nothing; the tileset editor says why */
      }
    }
    return out;
  });
}

export interface PaintOptions {
  view: { zoom: number; panX: number; panY: number };
  /** The canvas's size on screen: only the tiles inside it are drawn. */
  width: number;
  height: number;
  /** Where a drag has moved an instance to, for now. */
  offset?: (inst: RoomInstance) => { x: number; y: number } | null;
}

export function paintRoom(ctx: CanvasRenderingContext2D, project: Project, room: RoomResource, images: Map<string, ImageBitmap>, tileImages: Map<string, ImageBitmap>, opts: PaintOptions) {
  const { view } = opts;
  ctx.fillStyle = room.background;
  ctx.fillRect(0, 0, room.width, room.height);

  // Background layers, deepest first; instances fall between them by depth.
  const bgs = room.layers.filter((l): l is Extract<RoomLayer, { kind: "background" }> => l.kind === "background" && l.visible);
  const order = drawOrder(project, room);
  const shown = visibleLayers(room);
  type Item = { depth: number; draw: () => void };
  const items: Item[] = [];
  for (const l of bgs) {
    items.push({
      depth: l.depth,
      draw: () => {
        if (l.color) {
          ctx.fillStyle = l.color;
          ctx.fillRect(0, 0, room.width, room.height);
        }
        const img = l.sprite ? images.get(l.sprite) : undefined;
        if (!img) return;
        const ox = l.offsetX ?? 0, oy = l.offsetY ?? 0;
        if (l.mode === "stretch") ctx.drawImage(img, 0, 0, room.width, room.height);
        else if (l.mode === "once") ctx.drawImage(img, ox, oy);
        else if (l.mode === "tile_x") for (let x = (ox % img.width) - img.width; x < room.width; x += img.width) ctx.drawImage(img, x, oy);
        else if (l.mode === "tile_y") for (let y = (oy % img.height) - img.height; y < room.height; y += img.height) ctx.drawImage(img, ox, y);
        else {
          ctx.save();
          ctx.fillStyle = ctx.createPattern(img, "repeat")!;
          ctx.fillRect(0, 0, room.width, room.height);
          ctx.restore();
        }
      },
    });
  }
  for (const l of room.layers) {
    if (l.kind !== "tiles" || !l.visible) continue;
    const ts = find(project, "tilesets", l.tileset);
    const img = ts ? tileImages.get(ts.id) : undefined;
    if (!ts || !img) continue;
    const { columns } = tilesetGrid(ts);
    items.push({
      depth: l.depth,
      draw: () => {
        // Only the cells on screen: on a huge level, walking every painted
        // tile on each redraw (the pointer moving is a redraw) crawled.
        const tw = ts.tileWidth, th = ts.tileHeight;
        const c0 = Math.max(0, Math.floor(-view.panX / view.zoom / tw)), r0 = Math.max(0, Math.floor(-view.panY / view.zoom / th));
        const c1 = Math.ceil((opts.width - view.panX) / view.zoom / tw), r1 = Math.ceil((opts.height - view.panY) / view.zoom / th);
        const onScreen = (c1 - c0 + 1) * (r1 - r0 + 1);
        const draw = (c: number, r: number, tile: number) => drawTileValue(ctx, img, tileRect(ts, tile & TILE_MASK, columns), tile, c * tw, r * th, tw, th);
        const painted = Object.keys(l.tiles).length;
        if (painted <= onScreen) {
          // Fewer painted tiles than cells on screen: go through the tiles.
          for (const [k, tile] of Object.entries(l.tiles)) {
            const [c, r] = k.split(",").map(Number) as [number, number];
            if (c >= c0 && c <= c1 && r >= r0 && r <= r1) draw(c, r, tile);
          }
        } else {
          for (let r = r0; r <= r1; r++)
            for (let c = c0; c <= c1; c++) {
              const tile = l.tiles[`${c},${r}`];
              if (tile !== undefined) draw(c, r, tile);
            }
        }
      },
    });
  }
  for (const inst of order) {
    if (!shown.has(inst.layer)) continue;
    const obj = find(project, "objects", inst.object);
    const sprite = find(project, "sprites", obj?.sprite);
    const moved = opts.offset?.(inst);
    const x = inst.x + (moved?.x ?? 0), y = inst.y + (moved?.y ?? 0);
    items.push({
      depth: obj?.depth ?? 0,
      draw: () => {
        const { w, h, ox, oy } = shapeOf(sprite);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-inst.angle * (Math.PI / 180));
        ctx.scale(inst.scaleX, inst.scaleY);
        const img = sprite ? images.get(sprite.id) : undefined;
        if (img) ctx.drawImage(img, -ox, -oy, w, h);
        else {
          // No sprite (a controller object, say): a labelled stand-in, so it can still be found and moved.
          ctx.fillStyle = "rgba(148,163,184,0.25)";
          ctx.fillRect(-ox, -oy, w, h);
          ctx.strokeStyle = "rgba(148,163,184,0.8)";
          ctx.lineWidth = 1 / view.zoom;
          ctx.strokeRect(-ox, -oy, w, h);
          ctx.fillStyle = "#e2e8f0";
          ctx.font = `${Math.max(8, 10)}px system-ui`;
          ctx.fillText((obj?.name ?? "?").slice(0, 6), -ox + 3, -oy + 13);
        }
        ctx.restore();
      },
    });
  }
  // Stable sort: deepest first, so what is drawn last is on top.
  items.sort((a, b) => b.depth - a.depth).forEach((i) => i.draw());
}
