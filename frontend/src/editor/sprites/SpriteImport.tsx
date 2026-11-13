/**
 * Importing a picture as a sprite, or as more frames for one.
 *
 * A picture is taken whole, cut on a grid (frame size, columns and rows,
 * offset, spacing), or cut into a number of equal frames; an animated GIF
 * can also be taken frame by frame. The grid is drawn over the picture as
 * the numbers change, every frame is numbered, and clicking one leaves it
 * out (or puts it back). The frames chosen play beside it at the speed set.
 *
 * "Find the pictures" is for a sheet that isn't a grid (findPictures.ts):
 * the background is made clear, each drawing found and numbered in reading
 * order, and every frame made the size of the biggest, each drawing standing
 * on the bottom (or in the middle) so the animation doesn't jump. Dragging
 * across drawings joins them into one.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { backgroundOf, defaultJoin, findPictures, keyOut, placeIn, union, type Found } from "../../store/findPictures";
import { cutFrames, gridRects, pixelsOf, stripRects, type Decoded, type GridParams, type Rect } from "../../store/imageTools";

export interface ImportResult {
  name: string;
  frames: Blob[];
  width: number;
  height: number;
  fps: number;
  origin: "top-left" | "center" | "bottom-center";
}

type Mode = "whole" | "grid" | "strip" | "find" | "gif";

/** A picture shrunk by halves and then the rest of the way: one big step makes a smooth picture grainy. */
function shrink(src: OffscreenCanvas, scale: number): OffscreenCanvas {
  let cur = src;
  let left = scale;
  while (left < 0.5) {
    const c = new OffscreenCanvas(Math.max(1, Math.round(cur.width / 2)), Math.max(1, Math.round(cur.height / 2)));
    const x = c.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    left *= 2;
  }
  if (left >= 0.999) return cur;
  const c = new OffscreenCanvas(Math.max(1, Math.round(cur.width * left)), Math.max(1, Math.round(cur.height * left)));
  const x = c.getContext("2d")!;
  x.imageSmoothingQuality = "high";
  x.drawImage(cur, 0, 0, c.width, c.height);
  return c;
}

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

  // ---------------------------------------------------------------- finding the pictures
  const [tolerance, setTolerance] = useState(45);
  const [join, setJoin] = useState(defaultJoin(W, H));
  const [align, setAlign] = useState<"bottom" | "middle">("bottom");
  /** Boxes dragged across the sheet: every drawing each touches becomes one. */
  const [joins, setJoins] = useState<Rect[]>([]);
  const looking = mode === "find";
  // Typing a tolerance or a distance shouldn't wait on a big picture each key.
  const tol = useDeferredValue(tolerance), joinAt = useDeferredValue(join);
  const pixels = useMemo(() => (looking ? pixelsOf(source.frames[0]!) : null), [looking, source]);
  const bg = useMemo(() => (pixels ? backgroundOf(pixels.data, W, H) : null), [pixels, W, H]);
  /** The picture with its background made clear: drawn on the sheet, and what frames are cut from. */
  const keyed = useMemo(() => {
    if (!pixels || !bg) return null;
    const data = keyOut(pixels.data, bg, tol);
    const c = new OffscreenCanvas(W, H);
    c.getContext("2d")!.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
    return { data, canvas: c };
  }, [pixels, bg, tol, W, H]);
  const found: Found[] = useMemo(() => {
    if (!keyed) return [];
    let boxes = findPictures(keyed.data, W, H, Math.max(0, joinAt));
    for (const j of joins) {
      const hit = boxes.filter((b) => b.x < j.x + j.w && j.x < b.x + b.w && b.y < j.y + j.h && j.y < b.y + b.h);
      if (hit.length < 2) continue;
      const one = hit.reduce(union);
      // The joined drawing takes the place of the first of them.
      const at = boxes.indexOf(hit[0]!);
      boxes = boxes.filter((b) => !hit.includes(b));
      boxes.splice(Math.min(at, boxes.length), 0, one);
    }
    return boxes;
  }, [keyed, joinAt, joins, W, H]);

  const rects: Rect[] = useMemo(() => {
    if (mode === "whole" || mode === "gif") return [{ x: 0, y: 0, w: W, h: H }];
    if (mode === "grid") return gridRects(grid, W, H);
    if (mode === "find") return found;
    return stripRects(count, W, H, vertical);
  }, [mode, grid, count, vertical, W, H, found]);
  // Changing how the picture is cut renumbers the frames; start again.
  useEffect(() => setSkipped(new Set()), [mode, grid, count, vertical, tol, joinAt, joins]);
  useEffect(() => setJoins([]), [mode, tol, joinAt]);

  const frameCount = mode === "gif" ? source.frames.length : rects.length;
  const chosen = Array.from({ length: frameCount }, (_, i) => i).filter((i) => !skipped.has(i));
  // Found drawings: every frame is the size of the biggest one chosen, shrunk
  // to `scale` (a generated picture's poses are hundreds of pixels tall), or
  // to the sprite's own size when adding frames to one.
  const bigW = Math.max(1, ...chosen.map((i) => rects[i]?.w ?? 1)), bigH = Math.max(1, ...chosen.map((i) => rects[i]?.h ?? 1));
  const [scalePick, setScale] = useState<number | null>(null);
  const autoScale = bigH > 128 ? Math.max(1, Math.round((96 / bigH) * 100)) : 100;
  const scale = looking ? (appendTo ? Math.min(1, appendTo.width / bigW, appendTo.height / bigH) : (scalePick ?? autoScale) / 100) : 1;
  const fw = mode === "gif" ? W : looking ? (appendTo ? appendTo.width : Math.max(1, Math.round(bigW * scale))) : rects[0]?.w ?? 0;
  const fh = mode === "gif" ? H : looking ? (appendTo ? appendTo.height : Math.max(1, Math.round(bigH * scale))) : rects[0]?.h ?? 0;

  /** The found drawings as frames: cut from the keyed picture, shrunk, placed. */
  const made = useMemo(() => {
    if (!looking || !keyed || !chosen.length) return [];
    const small = shrink(keyed.canvas, scale);
    const k = small.width / W;
    return chosen.map((i) => {
      const r = rects[i]!;
      const sx = Math.floor(r.x * k), sy = Math.floor(r.y * k);
      const sw = Math.max(1, Math.min(small.width - sx, Math.ceil((r.x + r.w) * k) - sx)), sh = Math.max(1, Math.min(small.height - sy, Math.ceil((r.y + r.h) * k) - sy));
      const at = placeIn({ w: sw, h: sh }, fw, fh, align);
      const c = new OffscreenCanvas(fw, fh);
      c.getContext("2d")!.drawImage(small, sx, sy, sw, sh, at.x, at.y, sw, sh);
      return c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looking, keyed, rects, skipped, scale, align, fw, fh, W]);
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
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<Rect | null>(null);
  const zoom = Math.max(0.1, Math.min(8, Math.floor(Math.min(560 / W, 340 / H)) || Math.min(560 / W, 340 / H)));
  useEffect(() => {
    const c = sheet.current;
    if (!c) return;
    c.width = Math.round(W * zoom);
    c.height = Math.round(H * zoom);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(looking && keyed ? keyed.canvas : source.frames[0]!, 0, 0, c.width, c.height);
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
    if (dragBox) {
      ctx.strokeStyle = "#ffcc66";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(dragBox.x * zoom, dragBox.y * zoom, dragBox.w * zoom, dragBox.h * zoom);
      ctx.setLineDash([]);
    }
  }, [source, rects, skipped, zoom, mode, W, H, looking, keyed, dragBox]);

  /** Where on the picture the pointer is. */
  const onSheet = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - b.left) / zoom, y: (e.clientY - b.top) / zoom };
  };
  const sheetDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode === "gif" || mode === "whole") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = onSheet(e);
  };
  const sheetMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || !looking) return;
    const p = onSheet(e);
    setDragBox({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) });
  };
  /** A click leaves a frame out (or puts it back); a drag across found drawings joins them. */
  const sheetUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragBox(null);
    if (!d) return;
    const p = onSheet(e);
    if (looking && Math.hypot(p.x - d.x, p.y - d.y) * zoom > 5) {
      setJoins((j) => [...j, { x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) }]);
      return;
    }
    toggleAt(p.x, p.y);
  };

  const toggleAt = (x: number, y: number) => {
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
      else if (looking) {
        const m = made[k % made.length];
        if (m) ctx.drawImage(m, 0, 0, c.width, c.height);
      } else {
        const r = rects[i]!;
        ctx.drawImage(source.frames[0]!, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      }
      k++;
    };
    draw();
    const t = setInterval(draw, 1000 / Math.max(1, fps));
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, rects, skipped, fps, mode, fw, fh, made]);

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
          : looking
            ? await Promise.all(made.map((c) => c.convertToBlob({ type: "image/png" })))
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
          {(isGif ? (["gif", "whole"] as Mode[]) : (["whole", "strip", "grid", "find"] as Mode[])).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? "on" : ""}
              // Found drawings stand on the bottom of their frames: the feet are the natural origin.
              onClick={() => (setMode(m), m === "find" && setOrigin("bottom-center"))}
              data-testid={`slice-${m}`}
            >
              {m === "whole" ? "Whole picture" : m === "strip" ? "Equal frames" : m === "grid" ? "Grid" : m === "find" ? "Find the pictures" : "GIF frames"}
            </button>
          ))}
        </div>
        {looking && bg && (
          <div className="slice-params" data-testid="find-params">
            <span className="muted small find-bg">
              Background:{" "}
              {bg.kind === "clear" ? (
                "see-through already"
              ) : (
                <>
                  <span className="swatch-inline" style={{ background: `rgb(${bg.rgb.join(",")})` }} /> the corners' colour, made see-through
                </>
              )}
            </span>
            {bg.kind === "colour" && (
              <label className="num" title="Colours this close to the background are made see-through. Higher if a rim of it is left round the drawings; lower if parts of the drawings vanish.">
                Background match
                <input type="range" min={5} max={150} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} aria-label="Background match" />
              </label>
            )}
            <label className="num" title="Pieces closer than this are one drawing: sparks, a sword, a shadow. Lower it if two drawings came out as one.">
              Join pieces closer than
              <input type="number" min={0} max={200} value={join} onChange={(e) => setJoin(Math.max(0, Number(e.target.value) || 0))} aria-label="Join distance" data-testid="find-join" />
              px
            </label>
            <label className="num">
              Line up
              <select value={align} onChange={(e) => setAlign(e.target.value as "bottom" | "middle")} aria-label="Line up">
                <option value="bottom">Standing on the bottom</option>
                <option value="middle">In the middle</option>
              </select>
            </label>
            {!appendTo && (
              <label className="num" title="Generated pictures are big: shrink them to a game's size. Every frame shrinks the same.">
                Size
                <input type="number" min={1} max={100} value={scalePick ?? autoScale} onChange={(e) => setScale(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} aria-label="Size percent" data-testid="find-scale" />%
              </label>
            )}
            <span className="muted small">Click a drawing to leave it out. Drag across drawings to make them one.</span>
            {joins.length > 0 && (
              <button className="btn small" onClick={() => setJoins([])}>
                Undo joins
              </button>
            )}
          </div>
        )}
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
            <canvas
              ref={sheet}
              onPointerDown={sheetDown}
              onPointerMove={sheetMove}
              onPointerUp={sheetUp}
              data-testid="slice-sheet"
              title={looking ? "Click a drawing to leave it out; drag across drawings to join them" : mode === "grid" || mode === "strip" ? "Click a frame to leave it out" : ""}
            />
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
