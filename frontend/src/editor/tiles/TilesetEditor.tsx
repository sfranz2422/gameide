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
import { find, newId, remapTileset, tilesetGrid, type TilesetResource } from "../../store/project";
import { useProjectApi } from "../useProject";

/**
 * The tileset's picture, decoded once for drawing.
 *
 * An old picture is closed only after the new one is showing. Closing it as
 * soon as the file changed (in the effect's cleanup) left the screen drawing
 * a closed picture until the new one decoded — "the image source is
 * detached" — and replacing a tileset's picture crashed the editor.
 */
export function useTilesetImage(tileset: TilesetResource | undefined, assets: Map<string, Blob>): ImageBitmap | null {
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const shown = useRef<ImageBitmap | null>(null);
  const blob = tileset?.image ? assets.get(tileset.image) : undefined;
  useEffect(() => {
    let alive = true;
    const swap = (next: ImageBitmap | null) => {
      const old = shown.current;
      shown.current = next;
      setImg(next);
      // After React has drawn with the new one.
      if (old && old !== next) setTimeout(() => old.close(), 0);
    };
    if (!blob) swap(null);
    else
      void createImageBitmap(blob)
        .then((b) => (alive ? swap(b) : b.close()))
        .catch(() => alive && swap(null));
    return () => {
      alive = false;
    };
  }, [blob]);
  useEffect(() => () => shown.current?.close(), []);
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
  const [notice, setNotice] = useState<string | null>(null);
  /** The autotile set being filled in, and which of its 16 slots a click on the picture fills. */
  const [editing, setEditing] = useState<{ set: string; slot: number } | null>(null);
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
  // Every change goes through remapTileset, so painted levels keep their
  // look when the grid changes; it says if any tiles had nowhere to go.
  const set = (recipe: (t: TilesetResource) => void) => {
    let lost = 0;
    mutate(
      (p) => {
        const t = find(p, "tilesets", tilesetId)!;
        const before = structuredClone(t);
        recipe(t);
        lost = remapTileset(p, tilesetId, before);
      },
      { label: `change ${tileset.name}` },
    );
    setNotice(lost ? `${lost} painted tile${lost === 1 ? "" : "s"} used part of the picture that isn't there now, so ${lost === 1 ? "it was" : "they were"} removed. Undo brings ${lost === 1 ? "it" : "them"} back.` : null);
  };

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
        if (editing) {
          // Filling an autotile set: this tile goes in the chosen slot, and
          // the next slot is chosen, so 16 clicks fill a set.
          const { set: id, slot } = editing;
          set((t) => {
            const a = t.autotiles.find((x) => x.id === id);
            if (a) a.tiles[slot] = n;
          });
          setEditing({ set: id, slot: (slot + 1) % 16 });
          return;
        }
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
        {notice && (
          <p className="banner warn" data-testid="tileset-notice">
            {notice}
          </p>
        )}
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
        <AutotileSets tileset={tileset} img={img} columns={grid.columns} editing={editing} setEditing={setEditing} change={set} />
        <fieldset>
          <legend>Solid tiles</legend>
          <p className="muted small">
            {editing
              ? "Filling an autotile set: clicks on the picture go into its slots. Press Done to mark solid tiles again."
              : "Click a tile to make it solid (red) — what players stand on and bump into. Click again to undo."}
          </p>
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

/** The 16 ways a cell can join its neighbours, drawn small: the middle, and a bar to each joined side. */
function SlotDiagram({ mask }: { mask: number }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="slot-diagram">
      <rect x="6" y="6" width="8" height="8" />
      {mask & 1 ? <rect x="8" y="0" width="4" height="6" /> : null}
      {mask & 2 ? <rect x="14" y="8" width="6" height="4" /> : null}
      {mask & 4 ? <rect x="8" y="14" width="4" height="6" /> : null}
      {mask & 8 ? <rect x="0" y="8" width="6" height="4" /> : null}
    </svg>
  );
}

function TileImage({ img, rect, size }: { img: ImageBitmap | null; rect: { x: number; y: number; w: number; h: number } | null; size: number }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = c.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    if (!img || !rect) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, size, size);
  });
  return <canvas ref={c} width={size} height={size} />;
}

function AutotileSets({
  tileset,
  img,
  columns,
  editing,
  setEditing,
  change,
}: {
  tileset: TilesetResource;
  img: ImageBitmap | null;
  columns: number;
  editing: { set: string; slot: number } | null;
  setEditing: (e: { set: string; slot: number } | null) => void;
  change: (recipe: (t: TilesetResource) => void) => void;
}) {
  const [from, setFrom] = useState(0);
  const current = editing ? tileset.autotiles.find((a) => a.id === editing.set) : undefined;
  return (
    <fieldset data-tutorial="autotile-sets">
      <legend>Autotile sets</legend>
      <p className="muted small">
        16 tiles that fit together — edges, corners, middle — so painting picks the right one for each cell. Each slot shows the sides
        that join more of the same.
      </p>
      {tileset.autotiles.map((a) => (
        <div key={a.id} className="row autotile-row">
          <input
            value={a.name}
            onChange={(e) => change((t) => void (t.autotiles.find((x) => x.id === a.id)!.name = e.target.value))}
            aria-label="Autotile set name"
          />
          <button className="btn small" onClick={() => setEditing(editing?.set === a.id ? null : { set: a.id, slot: 0 })} data-testid={`edit-autotile-${a.name}`}>
            {editing?.set === a.id ? "Done" : "Edit"}
          </button>
          <button className="icon-btn" aria-label={`Delete ${a.name}`} onClick={() => change((t) => void (t.autotiles = t.autotiles.filter((x) => x.id !== a.id)))}>
            ×
          </button>
        </div>
      ))}
      <button
        className="btn small"
        disabled={!tileset.image}
        data-testid="new-autotile"
        onClick={() => {
          const id = newId();
          change((t) => void t.autotiles.push({ id, name: `set${t.autotiles.length + 1}`, tiles: new Array(16).fill(-1) }));
          setEditing({ set: id, slot: 0 });
        }}
      >
        New autotile set
      </button>
      {current && editing && (
        <div className="autotile-editor">
          <div className="slot-grid" data-testid="autotile-slots">
            {current.tiles.map((t, mask) => (
              <button
                key={mask}
                className={`slot ${editing.slot === mask ? "on" : ""}`}
                onClick={() => setEditing({ set: current.id, slot: mask })}
                title={`Slot ${mask}: joined ${["up", "right", "down", "left"].filter((_, i) => mask & (1 << i)).join(", ") || "on no side"}`}
              >
                <SlotDiagram mask={mask} />
                <TileImage img={img} rect={t >= 0 ? tileRect(tileset, t, columns) : null} size={24} />
              </button>
            ))}
          </div>
          <p className="muted small">Pick a slot, then click its tile in the picture. Laid out in order already?</p>
          <div className="row">
            <label className="num">
              From tile <input type="number" min={0} value={from} onChange={(e) => setFrom(Math.max(0, Number(e.target.value) || 0))} aria-label="First tile" />
            </label>
            <button
              className="btn small"
              onClick={() => change((t) => void (t.autotiles.find((x) => x.id === current.id)!.tiles = Array.from({ length: 16 }, (_, i) => from + i)))}
              data-testid="autotile-in-order"
            >
              Take 16 in order
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
