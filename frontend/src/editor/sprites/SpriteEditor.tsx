/**
 * One sprite: its picture with the origin and collision mask drawn over it,
 * its frames, its animation speed, and the mask's kind.
 *
 * Clicking the picture sets the origin; with the Mask tool, dragging draws a
 * box or a circle. An automatic or exact mask is refitted whenever the
 * frames change; one drawn by hand stays as drawn.
 */
import { useEffect, useState } from "react";
import { find, type SpriteMask, type SpriteResource } from "../../store/project";
import { refitMask } from "../../store/spriteOps";
import { Icon } from "../ui/icons";
import { useProjectApi } from "../useProject";

/**
 * Object URLs for a sprite's frames, revoked when no longer shown.
 *
 * Made inside the effect that revokes them, never in a useMemo: React
 * (StrictMode, and some re-mounts) runs an effect's cleanup and then the
 * effect again, which with memoised URLs revoked the very URLs still on
 * screen — the frames went blank with "file not found".
 *
 * Keyed on the frame ids, not the sprite: every edit to the project makes
 * a new sprite object, and remaking URLs on each keystroke would flicker.
 */
export function useFrameUrls(sprite: SpriteResource | undefined, assets: Map<string, Blob>): string[] {
  const frames = sprite?.frames.join(",") ?? "";
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = frames ? frames.split(",").map((id) => (assets.get(id) ? URL.createObjectURL(assets.get(id)!) : "")) : [];
    setUrls(made);
    return () => made.forEach((u) => u && URL.revokeObjectURL(u));
  }, [frames, assets]);
  return urls;
}

export function SpriteThumb({ spriteId, size = 32 }: { spriteId: string | null; size?: number }) {
  const { project, assets } = useProjectApi();
  const sprite = find(project, "sprites", spriteId);
  const [url] = useFrameUrls(sprite, assets);
  if (!url) return <span className="thumb empty" style={{ width: size, height: size }} />;
  return <img className="thumb" src={url} alt="" style={{ width: size, height: size }} />;
}

const MASK_KINDS: { kind: SpriteMask["kind"]; label: string; hint: string }[] = [
  { kind: "auto", label: "Box fitted to the picture", hint: "A box around the drawn part of every frame, kept fitted as frames change." },
  { kind: "rect", label: "Box I draw", hint: "Drag on the picture with the Mask tool." },
  { kind: "circle", label: "Circle", hint: "Drag from the middle outward with the Mask tool. Good for balls and coins." },
  { kind: "precise", label: "Exact pixels", hint: "Collides with exactly what is drawn, frame by frame. Slower: use it for oddly shaped things." },
];

export function SpriteEditor({ spriteId, addFrames }: { spriteId: string; addFrames: () => void }) {
  const { project, assets, mutate } = useProjectApi();
  const sprite = find(project, "sprites", spriteId);
  const urls = useFrameUrls(sprite, assets);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tool, setTool] = useState<"origin" | "mask">("origin");
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const fps = sprite?.fps ?? project.settings.stepsPerSecond;

  useEffect(() => {
    if (!sprite || sprite.frames.length < 2 || !playing) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % sprite.frames.length), 1000 / Math.max(1, Math.min(60, fps)));
    return () => clearInterval(t);
  }, [sprite, playing, fps]);

  if (!sprite) return <div className="empty-pane">This sprite was deleted.</div>;
  const n = sprite.frames.length;
  const cur = Math.min(frame, n - 1);
  // One label for the sprite's settings: typing "24" into a box is one undo step.
  const set = (recipe: (s: SpriteResource) => void) => mutate((p) => recipe(find(p, "sprites", spriteId)!), { label: "change the sprite" });
  const zoom = Math.max(1, Math.min(16, Math.floor(320 / Math.max(sprite.width, sprite.height))));
  const mask: SpriteMask = sprite.mask ?? { kind: "auto", left: 0, top: 0, right: sprite.width, bottom: sprite.height };
  const usedBy = project.objects.filter((o) => o.sprite === sprite.id).map((o) => o.name);

  /** Changes the frame list, and refits an automatic or exact mask to it. */
  const changeFrames = async (frames: string[]) => {
    const blobs = frames.map((id) => assets.get(id)).filter((b): b is Blob => !!b);
    const refit = await refitMask(sprite.mask, blobs, sprite.width, sprite.height);
    set((s) => {
      s.frames = frames;
      if (refit) s.mask = refit;
    });
  };

  const setKind = async (kind: SpriteMask["kind"]) => {
    if (kind === "circle") {
      const r = Math.floor(Math.min(sprite.width, sprite.height) / 2);
      return set((s) => void (s.mask = { kind, cx: sprite.width / 2, cy: sprite.height / 2, r }));
    }
    if (kind === "rect") {
      const box = mask.kind === "circle" ? { left: 0, top: 0, right: sprite.width, bottom: sprite.height } : { left: mask.left, top: mask.top, right: mask.right, bottom: mask.bottom };
      return set((s) => void (s.mask = { kind, ...box }));
    }
    const blobs = sprite.frames.map((id) => assets.get(id)).filter((b): b is Blob => !!b);
    const refit = await refitMask({ kind, left: 0, top: 0, right: 0, bottom: 0 }, blobs, sprite.width, sprite.height);
    set((s) => void (s.mask = refit));
  };

  const at = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) / zoom), y: Math.round((e.clientY - r.top) / zoom) };
  };
  const down = (e: React.PointerEvent) => {
    const p = at(e);
    if (tool === "origin") return set((s) => ((s.originX = p.x), (s.originY = p.y)));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = at(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const up = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (mask.kind === "circle") {
      const r = Math.round(Math.hypot(d.x1 - d.x0, d.y1 - d.y0));
      if (r > 0) set((s) => void (s.mask = { kind: "circle", cx: d.x0, cy: d.y0, r }));
      return;
    }
    const left = Math.min(d.x0, d.x1), right = Math.max(d.x0, d.x1), top = Math.min(d.y0, d.y1), bottom = Math.max(d.y0, d.y1);
    if (right > left && bottom > top) set((s) => void (s.mask = { kind: "rect", left, top, right, bottom }));
  };

  // What to draw over the picture: the drag in progress, or the mask.
  const shown: SpriteMask =
    drag && mask.kind === "circle"
      ? { kind: "circle", cx: drag.x0, cy: drag.y0, r: Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0) }
      : drag
        ? { kind: "rect", left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), right: Math.max(drag.x0, drag.x1), bottom: Math.max(drag.y0, drag.y1) }
        : mask;

  const numField = (label: string, value: number, change: (v: number) => void) => (
    <label className="num">
      {label}
      <input type="number" value={Math.round(value * 100) / 100} onChange={(e) => change(Number(e.target.value) || 0)} aria-label={label} />
    </label>
  );

  return (
    <div className="sprite-editor" data-tutorial="sprite-editor">
      <div className="sprite-stage">
        <div className="seg small" role="radiogroup" aria-label="Tool">
          <button role="radio" aria-checked={tool === "origin"} className={tool === "origin" ? "on" : ""} onClick={() => setTool("origin")} data-tutorial="sprite-origin-tool">
            Origin
          </button>
          <button role="radio" aria-checked={tool === "mask"} className={tool === "mask" ? "on" : ""} onClick={() => setTool("mask")} data-tutorial="sprite-mask-tool">
            Mask
          </button>
        </div>
        <div
          className={`checker checker-bg tool-${tool}`}
          style={{ width: sprite.width * zoom, height: sprite.height * zoom }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          data-testid="sprite-canvas"
          title={tool === "origin" ? "Click to set the origin" : mask.kind === "circle" ? "Drag from the middle outward" : "Drag a box"}
        >
          {urls[cur] && <img src={urls[cur]} alt={sprite.name} draggable={false} style={{ width: "100%", height: "100%" }} />}
          <svg className="mask-overlay" viewBox={`0 0 ${sprite.width} ${sprite.height}`} preserveAspectRatio="none" aria-hidden="true">
            {shown.kind === "circle" ? (
              <circle cx={shown.cx} cy={shown.cy} r={shown.r} />
            ) : (
              <rect x={shown.left} y={shown.top} width={shown.right - shown.left} height={shown.bottom - shown.top} className={shown.kind === "precise" ? "dashed" : ""} />
            )}
          </svg>
          <span className="origin-mark" style={{ left: sprite.originX * zoom, top: sprite.originY * zoom }} />
        </div>
        <div className="frames" data-testid="sprite-frames">
          {urls.map((u, i) => (
            <button key={i} className={`frame ${i === cur ? "on" : ""}`} onClick={() => (setFrame(i), setPlaying(false))} aria-label={`Frame ${i}`}>
              {u && <img src={u} alt="" />}
              <span>{i}</span>
            </button>
          ))}
          <button className="frame add" onClick={addFrames} title="Add frames from a picture" data-testid="add-frames">
            {Icon.plus()}
          </button>
        </div>
        <div className="row frame-actions">
          <button className="btn small" disabled={cur === 0} onClick={() => (changeFrames(swap(sprite.frames, cur, cur - 1)), setFrame(cur - 1))}>
            ◀ Move
          </button>
          <button className="btn small" disabled={cur >= n - 1} onClick={() => (changeFrames(swap(sprite.frames, cur, cur + 1)), setFrame(cur + 1))}>
            Move ▶
          </button>
          <button className="btn small" disabled={n <= 1} onClick={() => (changeFrames(sprite.frames.filter((_, i) => i !== cur)), setFrame(Math.max(0, cur - 1)))} data-testid="delete-frame">
            {Icon.trash()} Frame {cur}
          </button>
          {n > 1 && (
            <button className="btn small" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </button>
          )}
        </div>
      </div>

      <div className="sprite-props">
        <p className="muted">
          {sprite.width} × {sprite.height} px, {n} frame{n === 1 ? "" : "s"}
          {usedBy.length ? ` · used by ${usedBy.join(", ")}` : ""}
        </p>
        {n > 1 && (
          <fieldset>
            <legend>Animation speed</legend>
            <input
              type="range"
              min={1}
              max={60}
              value={Math.min(60, fps)}
              onChange={(e) => set((s) => void (s.fps = Number(e.target.value)))}
              aria-label="Frames per second"
              data-testid="sprite-fps"
            />{" "}
            {fps} frames/s
            <p className="muted small">In the game, <code>self.image_speed</code> multiplies this: 2 is twice as fast, 0 stops it.</p>
          </fieldset>
        )}
        <fieldset>
          <legend>Origin</legend>
          <p className="muted small">The point that sits at the instance's x, y, and that it turns around.</p>
          {numField("x", sprite.originX, (v) => set((s) => void (s.originX = v)))}
          {numField("y", sprite.originY, (v) => set((s) => void (s.originY = v)))}
          <div className="row">
            {(
              [
                ["Top-left", 0, 0],
                ["Center", Math.floor(sprite.width / 2), Math.floor(sprite.height / 2)],
                ["Bottom-center", Math.floor(sprite.width / 2), sprite.height],
              ] as const
            ).map(([label, x, y]) => (
              <button key={label} className="btn small" onClick={() => set((s) => ((s.originX = x), (s.originY = y)))}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset data-tutorial="sprite-mask">
          <legend>Collision mask</legend>
          <select value={mask.kind} onChange={(e) => void setKind(e.target.value as SpriteMask["kind"])} aria-label="Mask kind" data-testid="mask-kind">
            {MASK_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="muted small">{MASK_KINDS.find((k) => k.kind === mask.kind)!.hint} Every mask turns and scales with the instance.</p>
          {mask.kind === "circle" ? (
            <div className="row">
              {numField("x", mask.cx, (v) => set((s) => void (s.mask = { ...mask, cx: v })))}
              {numField("y", mask.cy, (v) => set((s) => void (s.mask = { ...mask, cy: v })))}
              {numField("radius", mask.r, (v) => set((s) => void (s.mask = { ...mask, r: Math.max(0, v) })))}
            </div>
          ) : mask.kind === "rect" ? (
            <div className="row">
              {(["left", "top", "right", "bottom"] as const).map((k) => numField(k, mask[k], (v) => set((s) => void (s.mask = { ...mask, [k]: v }))))}
            </div>
          ) : (
            <p className="muted small">
              Box: {mask.left}, {mask.top} to {mask.right}, {mask.bottom}
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
}

function swap(list: string[], i: number, j: number): string[] {
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
