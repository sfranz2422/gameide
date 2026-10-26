/**
 * A tileset: a picture, how it is cut into tiles, and which tiles are solid.
 *
 * Clicking a tile marks it solid (or not): solid tiles are what players
 * stand on and bump into — place_meeting(x, y, "Ground"), place_free and
 * move_and_collide all see them. Tiles are numbered from 0, across then
 * down, the number tile_at() gives back; the numbers are drawn on them.
 */
import { useEffect, useRef, useState } from "react";
import { decodeImage } from "../../store/imageTools";
import { find, newId, tilesetGrid, type TilesetResource } from "../../store/project";
import { useProjectApi } from "../useProject";

/** The tileset's picture, decoded once for drawing. */
export function useTilesetImage(tileset: TilesetResource | undefined, assets: Map<string, Blob>): ImageBitmap | null {
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const blob = tileset?.image ? assets.get(tileset.image) : undefined;
  useEffect(() => {
    let alive = true;
    let made: ImageBitmap | null = null;
    if (!blob) {
      setImg(null);
      return;
    }
    void createImageBitmap(blob)
      .then((b) => {
        made = b;
        if (alive) setImg(b);
      })
      .catch(() => alive && setImg(null));
    return () => {
      alive = false;
      made?.close();
    };
  }, [blob]);
  return img;
}

/** Where tile `n` is in the tileset's picture. */
export function tileRect(t: TilesetResource, n: number, columns: number) {
  const c = n % columns, r = Math.floor(n / columns);
  return { x: t.offsetX + c * (t.tileWidth + t.spacingX), y: t.offsetY + r * (t.tileHeight + t.spacingY), w: t.tileWidth, h: t.tileHeight };
}

export function TilesetEditor({ tilesetId }: { tilesetId: string }) {
  const { project, assets, mutate, addAssets } = useProjectApi();
  const tileset = find(project, "tilesets", tilesetId);
  const img = useTilesetImage(tileset, assets);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const grid = tileset ? tilesetGrid(tileset) : { columns: 0, rows: 0 };
  const zoom = tileset && tileset.imageWidth ? Math.max(1, Math.min(4, Math.floor(560 / tileset.imageWidth))) : 1;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !tileset || !img) return;
    c.width = tileset.imageWidth * zoom;
    c.height = tileset.imageHeight * zoom;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const solid = new Set(tileset.solid);
    ctx.font = "10px system-ui";
    for (let n = 0; n < grid.columns * grid.rows; n++) {
      const r = tileRect(tileset, n, grid.columns);
      if (solid.has(n)) {
        ctx.fillStyle = "rgba(255,90,90,0.35)";
        ctx.fillRect(r.x * zoom, r.y * zoom, r.w * zoom, r.h * zoom);
      }
      ctx.strokeStyle = solid.has(n) ? "#ff6b6b" : "rgba(255,255,255,0.35)";
      ctx.strokeRect(r.x * zoom + 0.5, r.y * zoom + 0.5, r.w * zoom - 1, r.h * zoom - 1);
      if (r.w * zoom >= 18) {
        ctx.fillStyle = "#fff";
        ctx.fillText(String(n), r.x * zoom + 2, r.y * zoom + 10);
      }
    }
  });

  if (!tileset) return <div className="empty-pane">This tileset was deleted.</div>;
  const set = (recipe: (t: TilesetResource) => void) => mutate((p) => recipe(find(p, "tilesets", tilesetId)!));

  const choose = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const d = await decodeImage(file);
        const bmp = d.frames[0]!;
        // Stored as PNG whatever came in, as sprite frames are.
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        c.getContext("2d")!.drawImage(bmp, 0, 0);
        const png = await c.convertToBlob({ type: "image/png" });
        const id = newId();
        await addAssets(new Map([[id, png]]));
        set((t) => {
          t.image = id;
          t.imageWidth = bmp.width;
          t.imageHeight = bmp.height;
        });
        setProblem(null);
      } catch (e) {
        setProblem(e instanceof Error ? e.message : String(e));
      }
    };
    input.click();
  };

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - b.left) / zoom, y = (e.clientY - b.top) / zoom;
    for (let n = 0; n < grid.columns * grid.rows; n++) {
      const r = tileRect(tileset, n, grid.columns);
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        set((t) => void (t.solid = t.solid.includes(n) ? t.solid.filter((s) => s !== n) : [...t.solid, n].sort((a, b) => a - b)));
        return;
      }
    }
  };

  const num = (label: string, key: "tileWidth" | "tileHeight" | "offsetX" | "offsetY" | "spacingX" | "spacingY", min: number) => (
    <label className="num">
      {label}
      <input
        type="number"
        min={min}
        value={tileset[key]}
        onChange={(e) => set((t) => void (t[key] = Math.max(min, Math.floor(Number(e.target.value) || 0))))}
        aria-label={label}
        data-testid={`tileset-${key}`}
      />
    </label>
  );

  return (
    <div className="tileset-editor" data-tutorial="tileset-editor">
      <div className="tileset-props">
        <button className="btn" onClick={choose} data-testid="tileset-image">
          {tileset.image ? "Replace picture…" : "Choose a picture…"}
        </button>
        {problem && <p className="banner error">{problem}</p>}
        <fieldset>
          <legend>Tiles</legend>
          {num("Width", "tileWidth", 1)}
          {num("Height", "tileHeight", 1)}
          <div>
            {num("Offset x", "offsetX", 0)}
            {num("Offset y", "offsetY", 0)}
          </div>
          <div>
            {num("Spacing x", "spacingX", 0)}
            {num("Spacing y", "spacingY", 0)}
          </div>
          <p className="muted small" data-testid="tileset-count">
            {tileset.image ? `${grid.columns} × ${grid.rows} = ${grid.columns * grid.rows} tiles, ${tileset.solid.length} solid` : "No picture yet."}
          </p>
        </fieldset>
        <fieldset>
          <legend>Solid tiles</legend>
          <p className="muted small">Click a tile to make it solid (red) — what players stand on and bump into. Click again to undo.</p>
          <div className="row">
            <button className="btn small" onClick={() => set((t) => void (t.solid = Array.from({ length: grid.columns * grid.rows }, (_, i) => i)))}>
              All solid
            </button>
            <button className="btn small" onClick={() => set((t) => void (t.solid = []))}>
              None
            </button>
          </div>
        </fieldset>
      </div>
      <div className="tileset-sheet checker-bg">
        {tileset.image ? (
          <canvas ref={canvas} onClick={click} data-testid="tileset-canvas" />
        ) : (
          <p className="muted pad">A tileset is one picture with all its tiles side by side. Choose one to cut it up.</p>
        )}
      </div>
    </div>
  );
}
