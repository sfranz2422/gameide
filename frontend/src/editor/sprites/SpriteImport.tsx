/**
 * Importing a picture as a sprite, or as more frames for one.
 *
 * A picture is taken whole, cut on a grid (frame size, columns and rows,
 * offset, spacing), or cut into a number of equal frames; an animated GIF
 * can also be taken frame by frame. The grid is drawn over the picture as
 * the numbers change, every frame is numbered, and clicking one leaves it
 * out (or puts it back). The frames chosen play beside it at the speed set.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cutFrames, gridRects, stripRects, type Decoded, type GridParams, type Rect } from "../../store/imageTools";

export interface ImportResult {
  name: string;
  frames: Blob[];
  width: number;
  height: number;
  fps: number;
  origin: "top-left" | "center" | "bottom-center";
}

type Mode = "whole" | "grid" | "strip" | "gif";

const MAX_FRAMES = 200;

function baseName(file: string) {
  const n = file.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_ -]+/g, "").trim();
  return n || "sprite";
}

export function SpriteImport({
  source,
  fileName,
  appendTo,
  onDone,
  onClose,
}: {
  source: Decoded;
  fileName: string;
  /** Adding frames to this sprite: they must be its size. */
  appendTo?: { name: string; width: number; height: number };
  onDone: (r: ImportResult) => void;
  onClose: () => void;
}) {
  const W = source.width, H = source.height;
  const isGif = source.frames.length > 1;
  // A first guess: a strip of square frames is the commonest sheet.
  const squareStrip = W > H && W % H === 0 ? W / H : 0;
  const [mode, setMode] = useState<Mode>(isGif ? "gif" : squareStrip > 1 ? "strip" : "whole");
  const [grid, setGrid] = useState<GridParams>({
    frameWidth: appendTo?.width ?? (squareStrip ? H : Math.min(32, W)),
    frameHeight: appendTo?.height ?? (squareStrip ? H : Math.min(32, H)),
    columns: 0,
    rows: 0,
    offsetX: 0,
    offsetY: 0,
    spacingX: 0,
    spacingY: 0,
  });
  const [count, setCount] = useState(squareStrip || 4);
  const [vertical, setVertical] = useState(H > W && H % W === 0);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [name, setName] = useState(baseName(fileName));
  const [fps, setFps] = useState(source.fps ?? 10);
  const [origin, setOrigin] = useState<ImportResult["origin"]>("center");
  const [busy, setBusy] = useState(false);

  const rects: Rect[] = useMemo(() => {
    if (mode === "whole" || mode === "gif") return [{ x: 0, y: 0, w: W, h: H }];
    if (mode === "grid") return gridRects(grid, W, H);
    return stripRects(count, W, H, vertical);
  }, [mode, grid, count, vertical, W, H]);
  // Changing how the picture is cut renumbers the frames; start again.
  useEffect(() => setSkipped(new Set()), [mode, grid, count, vertical]);

  const frameCount = mode === "gif" ? source.frames.length : rects.length;
  const chosen = Array.from({ length: frameCount }, (_, i) => i).filter((i) => !skipped.has(i));
  const fw = mode === "gif" ? W : rects[0]?.w ?? 0;
  const fh = mode === "gif" ? H : rects[0]?.h ?? 0;
  const wrongSize = appendTo && (fw !== appendTo.width || fh !== appendTo.height);
  const problem = !chosen.length
    ? "Choose at least one frame."
    : chosen.length > MAX_FRAMES
      ? `That's ${chosen.length} frames; a sprite can have at most ${MAX_FRAMES}.`
      : wrongSize
        ? `${appendTo!.name}'s frames are ${appendTo!.width} × ${appendTo!.height}; these are ${fw} × ${fh}.`
        : null;

  // ---------------------------------------------------------------- the sheet, drawn with its grid
  const sheet = useRef<HTMLCanvasElement>(null);
  const zoom = Math.max(0.1, Math.min(8, Math.floor(Math.min(560 / W, 340 / H)) || Math.min(560 / W, 340 / H)));
  useEffect(() => {
    const c = sheet.current;
    if (!c) return;
    c.width = Math.round(W * zoom);
    c.height = Math.round(H * zoom);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(source.frames[0]!, 0, 0, c.width, c.height);
    if (mode === "gif") return;
    ctx.font = "11px system-ui";
    rects.forEach((r, i) => {
      const on = !skipped.has(i);
      ctx.fillStyle = on ? "rgba(79,140,255,0.18)" : "rgba(0,0,0,0.55)";
      ctx.fillRect(r.x * zoom, r.y * zoom, r.w * zoom, r.h * zoom);
      ctx.strokeStyle = on ? "#4f8cff" : "#666";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x * zoom + 0.5, r.y * zoom + 0.5, r.w * zoom - 1, r.h * zoom - 1);
      ctx.fillStyle = on ? "#fff" : "#999";
      ctx.fillText(String(i), r.x * zoom + 3, r.y * zoom + 12);
    });
  }, [source, rects, skipped, zoom, mode, W, H]);

  const toggleAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode === "gif" || mode === "whole") return;
    const b = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - b.left) / zoom, y = (e.clientY - b.top) / zoom;
    const i = rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    if (i < 0) return;
    setSkipped((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  // ---------------------------------------------------------------- the animation preview
  const anim = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = anim.current;
    if (!c || !chosen.length || fw < 1) return;
    const scale = Math.max(1, Math.floor(96 / Math.max(fw, fh)));
    c.width = fw * scale;
    c.height = fh * scale;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let k = 0;
    const draw = () => {
      const i = chosen[k % chosen.length]!;
      ctx.clearRect(0, 0, c.width, c.height);
      if (mode === "gif") ctx.drawImage(source.frames[i]!, 0, 0, c.width, c.height);
      else {
        const r = rects[i]!;
        ctx.drawImage(source.frames[0]!, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      }
      k++;
    };
    draw();
    const t = setInterval(draw, 1000 / Math.max(1, fps));
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, rects, skipped, fps, mode, fw, fh]);

  const num = (key: keyof GridParams, label: string, min = 0) => (
    <label className="num">
      {label}
      <input type="number" min={min} value={grid[key]} onChange={(e) => setGrid((g) => ({ ...g, [key]: Math.max(min, Number(e.target.value) || 0) }))} aria-label={label} />
    </label>
  );

  const finish = async () => {
    setBusy(true);
    try {
      const frames =
        mode === "gif"
          ? await Promise.all(chosen.map((i) => cutFrames(source.frames[i]!, [{ x: 0, y: 0, w: W, h: H }]).then((b) => b[0]!)))
          : await cutFrames(source.frames[0]!, chosen.map((i) => rects[i]!));
      onDone({ name: name.trim() || "sprite", frames, width: fw, height: fh, fps, origin });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className="modal wide" role="dialog" aria-label="Import a picture" onPointerDown={(e) => e.stopPropagation()}>
        <h3>{appendTo ? `Add frames to ${appendTo.name}` : "Import a picture"}</h3>
        <p className="muted small">
          {fileName} · {W} × {H} px{isGif ? ` · ${source.frames.length} frames` : ""}
        </p>
        <div className="seg" role="tablist" aria-label="How to cut it">
          {(isGif ? (["gif", "whole"] as Mode[]) : (["whole", "strip", "grid"] as Mode[])).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)} data-testid={`slice-${m}`}>
              {m === "whole" ? "Whole picture" : m === "strip" ? "Equal frames" : m === "grid" ? "Grid" : "GIF frames"}
            </button>
          ))}
        </div>
        {mode === "grid" && (
          <div className="slice-params" data-testid="grid-params">
            {num("frameWidth", "Frame width", 1)}
            {num("frameHeight", "Frame height", 1)}
            {num("columns", "Columns (0 = all)")}
            {num("rows", "Rows (0 = all)")}
            {num("offsetX", "Offset x")}
            {num("offsetY", "Offset y")}
            {num("spacingX", "Spacing x")}
            {num("spacingY", "Spacing y")}
          </div>
        )}
        {mode === "strip" && (
          <div className="slice-params">
            <label className="num">
              Frames
              <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} aria-label="Frames" data-testid="strip-count" />
            </label>
            <label className="check">
              <input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} /> Stacked top to bottom
            </label>
          </div>
        )}
        <div className="slice-body">
          <div className="slice-sheet checker-bg">
            <canvas ref={sheet} onClick={toggleAt} data-testid="slice-sheet" title={mode === "grid" || mode === "strip" ? "Click a frame to leave it out" : ""} />
          </div>
          <div className="slice-side">
            <canvas ref={anim} className="checker-bg slice-anim" />
            <p className="muted small" data-testid="slice-summary">
              {chosen.length} frame{chosen.length === 1 ? "" : "s"}, {fw} × {fh}
            </p>
            <label className="num">
              Speed
              <input type="number" min={1} max={60} value={fps} onChange={(e) => setFps(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} aria-label="Frames per second" />
              <span className="muted small">frames/s</span>
            </label>
            {!appendTo && (
              <>
                <label className="num">
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Sprite name" data-testid="import-name" />
                </label>
                <label className="num">
                  Origin
                  <select value={origin} onChange={(e) => setOrigin(e.target.value as ImportResult["origin"])} aria-label="Origin">
                    <option value="center">Center</option>
                    <option value="bottom-center">Bottom center (feet)</option>
                    <option value="top-left">Top-left</option>
                  </select>
                </label>
              </>
            )}
          </div>
        </div>
        {problem && <p className="banner error">{problem}</p>}
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!!problem || busy} onClick={finish} data-testid="import-done">
            {appendTo ? `Add ${chosen.length} frame${chosen.length === 1 ? "" : "s"}` : `Make sprite`}
          </button>
        </div>
      </div>
    </div>
  );
}
