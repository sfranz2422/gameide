/**
 * The room as a picture, to click where a scene's step should go. Students think
 * "over there by the door", not "x 412": the Python still gets plain numbers.
 */
import { useEffect, useRef, useState } from "react";
import { find, type Project } from "../store/project";
import { cameraPreview } from "../editor/rooms/roomOps";
import { paintRoom, useSpriteImages, useTilesetImages } from "../editor/rooms/roomPaint";
import { fitRoom, pointAt } from "./pick";

export interface PositionPickerProps {
  project: Project;
  assets: Map<string, Blob>;
  /** Starts here; the student can change it. */
  roomId: string;
  /** The camera's step: show how much of the room the view will take in, around the point. */
  showView: boolean;
  /** What the step says now, if it's plain numbers. */
  current: { x: number; y: number } | null;
  onPick: (x: number, y: number, roomId: string) => void;
  onClose: () => void;
}

export function PositionPicker({ project, assets, roomId, showView, current, onPick, onClose }: PositionPickerProps) {
  const [chosen, setChosen] = useState(roomId);
  const room = find(project, "rooms", chosen);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useSpriteImages(project, assets);
  const tileImages = useTilesetImages(project, assets);

  const fitNow = () => {
    const el = stage.current;
    return room && el ? fitRoom(room, el.clientWidth, el.clientHeight) : null;
  };

  useEffect(() => {
    const c = canvas.current, el = stage.current, fit = fitNow();
    if (!c || !el || !room || !fit) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(el.clientWidth * dpr);
    c.height = Math.round(el.clientHeight * dpr);
    c.style.width = `${el.clientWidth}px`;
    c.style.height = `${el.clientHeight}px`;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, el.clientWidth, el.clientHeight);
    ctx.save();
    ctx.translate(fit.panX, fit.panY);
    ctx.scale(fit.zoom, fit.zoom);
    ctx.imageSmoothingEnabled = false;
    paintRoom(ctx, project, room, images, tileImages, { view: fit, width: el.clientWidth, height: el.clientHeight });
    const mark = (p: { x: number; y: number }, color: string) => {
      const r = 8 / fit.zoom;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / fit.zoom;
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y);
      ctx.lineTo(p.x + r, p.y);
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x, p.y + r);
      ctx.stroke();
    };
    if (current) mark(current, "#ffd166");
    if (hover) {
      mark(hover, "#ffffff");
      const v = showView ? cameraPreview(room) : null;
      if (v) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1 / fit.zoom;
        ctx.strokeRect(hover.x - v.w / 2, hover.y - v.h / 2, v.w, v.h);
      }
    }
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, images, tileImages, hover, current]);

  const place = (e: React.PointerEvent | React.MouseEvent) => {
    const fit = fitNow(), r = canvas.current?.getBoundingClientRect();
    return room && fit && r ? pointAt(room, fit, e.clientX - r.left, e.clientY - r.top, e.altKey) : null;
  };

  return (
    <div className="position-picker" role="dialog" aria-label="Pick a place in the room" onKeyDown={(e) => e.key === "Escape" && onClose()} data-testid="position-picker">
      <div className="position-picker-head">
        <label>
          Room{" "}
          <select autoFocus value={chosen} onChange={(e) => setChosen(e.target.value)} data-testid="position-room">
            {project.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">Click where it should go. Hold Alt to go between the grid's lines.</span>
        <span className="spacer" />
        <span data-testid="position-at">{hover ? `${hover.x}, ${hover.y}` : ""}</span>
        <button className="btn small" onClick={onClose} data-testid="position-cancel">
          Cancel
        </button>
      </div>
      <div className="position-picker-stage" ref={stage}>
        <canvas
          ref={canvas}
          data-testid="position-canvas"
          onPointerMove={(e) => setHover(place(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const p = place(e);
            if (p) onPick(p.x, p.y, chosen);
          }}
        />
      </div>
    </div>
  );
}
