/**
 * The room editor: a picture of the room to place and arrange instances on,
 * and a panel for the room, its layers, and whatever is selected.
 *
 * Placing: drag an object from the resource tree onto the room, or pick the
 * Place tool and click (drag to paint a row of walls along the grid; right
 * click erases). Selecting: click, Shift-click to add, or drag a box. The
 * selection moves by dragging (snapped to the grid unless Alt is held) or
 * with the arrow keys, and Delete, Ctrl+C, Ctrl+V, Ctrl+D and Ctrl+A do what
 * they do everywhere. Space-drag or the middle button pans; Ctrl+wheel (or a
 * pinch) zooms about the pointer; the wheel alone scrolls.
 *
 * A drag only previews while it happens and is saved once, on release — a
 * save per pointer move would rewrite the project sixty times a second.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { find, newId, newInstance, type Project, type RoomInstance, type RoomLayer, type RoomResource } from "../../store/project";
import { CodeEditor } from "../code/CodeEditor";
import { projectNames } from "../ObjectEditor";
import { Icon } from "../ui/icons";
import { useProjectApi } from "../useProject";
import { cameraPreview, copy, corners, drawOrder, hitTest, inBox, occupied, paste, shapeOf, snap, visibleLayers, type Clip } from "./roomOps";

/** Shared by every room, so copying in one and pasting in another works. */
let clipboard: Clip | null = null;

export const OBJECT_DRAG_TYPE = "application/x-gameide-object";

type Drag =
  | { kind: "move"; x0: number; y0: number; dx: number; dy: number; anchor: RoomInstance }
  | { kind: "box"; x0: number; y0: number; x1: number; y1: number; add: boolean }
  | { kind: "pan"; sx: number; sy: number; panX: number; panY: number }
  | { kind: "paint" }
  | { kind: "erase" };

/** The first frame of every sprite, decoded, for drawing the room. */
function useSpriteImages(project: Project, assets: Map<string, Blob>) {
  const [images, setImages] = useState(new Map<string, ImageBitmap>());
  const key = project.sprites.map((s) => `${s.id}:${s.frames[0] ?? ""}`).join(",");
  useEffect(() => {
    let alive = true;
    const made: ImageBitmap[] = [];
    void (async () => {
      const out = new Map<string, ImageBitmap>();
      for (const s of project.sprites) {
        const blob = s.frames[0] ? assets.get(s.frames[0]) : undefined;
        if (!blob) continue;
        try {
          const bmp = await createImageBitmap(blob);
          made.push(bmp);
          out.set(s.id, bmp);
        } catch {
          /* drawn as a stand-in box */
        }
      }
      if (alive) setImages(out);
    })();
    return () => {
      alive = false;
      made.forEach((b) => b.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, assets]);
  return images;
}

export function RoomEditor({ roomId, focus }: { roomId: string; focus: { instanceId: string; line: number; nonce: number } | null }) {
  const { project, assets, mutate } = useProjectApi();
  const room = find(project, "rooms", roomId);
  const [tool, setTool] = useState<"select" | "place">("select");
  const [placeObject, setPlaceObject] = useState<string>(project.objects[0]?.id ?? "");
  const [layerId, setLayerId] = useState<string>(room?.layers.find((l) => l.kind === "instances")?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"room" | "layers" | "instance">("room");
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0, fitted: false });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const spaceDown = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const images = useSpriteImages(project, assets);
  const lastPaint = useRef<string>("");

  const setRoom = useCallback((recipe: (r: RoomResource) => void) => mutate((p) => recipe(find(p, "rooms", roomId)!)), [mutate, roomId]);

  // An error in an instance's creation code: select it and show its code.
  useEffect(() => {
    if (!focus || !room?.instances.some((i) => i.id === focus.instanceId)) return;
    setSelected(new Set([focus.instanceId]));
    setPanel("instance");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // Keep the current layer a real instance layer as layers come and go.
  useEffect(() => {
    if (room && !room.layers.some((l) => l.id === layerId && l.kind === "instances"))
      setLayerId(room.layers.find((l) => l.kind === "instances")?.id ?? "");
  }, [room, layerId]);

  // ---------------------------------------------------------------- coordinates
  const toRoom = useCallback(
    (clientX: number, clientY: number) => {
      const r = canvas.current!.getBoundingClientRect();
      return { x: (clientX - r.left - view.panX) / view.zoom, y: (clientY - r.top - view.panY) / view.zoom };
    },
    [view],
  );

  const fit = useCallback(() => {
    const el = box.current;
    if (!el || !room) return;
    const zoom = Math.max(0.1, Math.min(4, Math.min((el.clientWidth - 40) / room.width, (el.clientHeight - 40) / room.height)));
    setView({ zoom, panX: (el.clientWidth - room.width * zoom) / 2, panY: (el.clientHeight - room.height * zoom) / 2, fitted: true });
  }, [room]);

  useEffect(() => {
    if (!view.fitted) fit();
  }, [fit, view.fitted]);

  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const el = box.current!;
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2;
    setView((v) => {
      const zoom = Math.max(0.1, Math.min(16, v.zoom * factor));
      return { zoom, panX: px - ((px - v.panX) / v.zoom) * zoom, panY: py - ((py - v.panY) / v.zoom) * zoom, fitted: true };
    });
  };

  // ---------------------------------------------------------------- drawing
  useEffect(() => {
    const c = canvas.current, el = box.current;
    if (!c || !el || !room) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(el.clientWidth * dpr);
    c.height = Math.round(el.clientHeight * dpr);
    c.style.width = `${el.clientWidth}px`;
    c.style.height = `${el.clientHeight}px`;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, el.clientWidth, el.clientHeight);
    ctx.save();
    ctx.translate(view.panX, view.panY);
    ctx.scale(view.zoom, view.zoom);
    ctx.imageSmoothingEnabled = false;

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
          if (l.mode === "stretch") ctx.drawImage(img, 0, 0, room.width, room.height);
          else if (l.mode === "once") ctx.drawImage(img, 0, 0);
          else {
            ctx.save();
            ctx.fillStyle = ctx.createPattern(img, "repeat")!;
            ctx.fillRect(0, 0, room.width, room.height);
            ctx.restore();
          }
        },
      });
    }
    for (const inst of order) {
      if (!shown.has(inst.layer)) continue;
      const obj = find(project, "objects", inst.object);
      const sprite = find(project, "sprites", obj?.sprite);
      const moving = drag?.kind === "move" && selected.has(inst.id);
      const x = inst.x + (moving ? drag.dx : 0), y = inst.y + (moving ? drag.dy : 0);
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

    if (showGrid && room.gridWidth * view.zoom >= 6 && room.gridHeight * view.zoom >= 6) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1 / view.zoom;
      ctx.beginPath();
      for (let x = 0; x <= room.width; x += room.gridWidth) ctx.moveTo(x, 0), ctx.lineTo(x, room.height);
      for (let y = 0; y <= room.height; y += room.gridHeight) ctx.moveTo(0, y), ctx.lineTo(room.width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1 / view.zoom;
    ctx.strokeRect(0, 0, room.width, room.height);

    const cam = cameraPreview(room);
    if (cam) {
      ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
      ctx.strokeStyle = "#ffcc66";
      ctx.lineWidth = 2 / view.zoom;
      ctx.strokeRect(cam.x, cam.y, cam.w, cam.h);
      ctx.setLineDash([]);
    }

    // Selection outlines.
    ctx.strokeStyle = "#4f8cff";
    ctx.lineWidth = 2 / view.zoom;
    for (const inst of room.instances) {
      if (!selected.has(inst.id)) continue;
      const moving = drag?.kind === "move";
      const pts = corners(inst, find(project, "sprites", find(project, "objects", inst.object)?.sprite), moving ? drag.dx : 0, moving ? drag.dy : 0);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }
    if (drag?.kind === "box") {
      ctx.fillStyle = "rgba(79,140,255,0.15)";
      ctx.fillRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0));
      ctx.strokeRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0));
    }
    // Where a click would place, in the Place tool.
    if (tool === "place" && hover && !drag) {
      const sx = room.snap ? snap(hover.x, room.gridWidth) : Math.round(hover.x);
      const sy = room.snap ? snap(hover.y, room.gridHeight) : Math.round(hover.y);
      const sprite = find(project, "sprites", find(project, "objects", placeObject)?.sprite);
      const { w, h, ox, oy } = shapeOf(sprite);
      ctx.globalAlpha = 0.5;
      const img = sprite ? images.get(sprite.id) : undefined;
      if (img) ctx.drawImage(img, sx - ox, sy - oy, w, h);
      else ctx.strokeRect(sx - ox, sy - oy, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });

  // Redraw when the pane is resized.
  const [, setTick] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!room) return <div className="empty-pane">This room was deleted.</div>;
  const layer = room.layers.find((l) => l.id === layerId);
  const layerLocked = !layer || layer.locked || !layer.visible;

  // ---------------------------------------------------------------- placing and erasing
  const snapped = (p: { x: number; y: number }, alt: boolean) =>
    room.snap && !alt ? { x: snap(p.x, room.gridWidth), y: snap(p.y, room.gridHeight) } : { x: Math.round(p.x), y: Math.round(p.y) };

  const place = (object: string, at: { x: number; y: number }) => {
    if (layerLocked || !find(project, "objects", object)) return null;
    const inst = newInstance(room, object, at.x, at.y, layerId);
    setRoom((r) => void r.instances.push(inst));
    return inst;
  };

  const erase = (at: { x: number; y: number }) => {
    const hit = hitTest(project, room, at.x, at.y);
    if (hit) setRoom((r) => void (r.instances = r.instances.filter((i) => i.id !== hit.id)));
  };

  // ---------------------------------------------------------------- pointer
  const down = (e: React.PointerEvent) => {
    canvas.current!.focus();
    const p = toRoom(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || spaceDown.current) return setDrag({ kind: "pan", sx: e.clientX, sy: e.clientY, panX: view.panX, panY: view.panY });
    if (tool === "place") {
      if (e.button === 2) {
        erase(p);
        return setDrag({ kind: "erase" });
      }
      const at = snapped(p, e.altKey);
      lastPaint.current = `${at.x},${at.y}`;
      if (!occupied(room, placeObject, at.x, at.y)) place(placeObject, at);
      return setDrag({ kind: "paint" });
    }
    const hit = hitTest(project, room, p.x, p.y);
    if (hit) {
      let next = selected;
      if (e.shiftKey) {
        next = new Set(selected);
        if (next.has(hit.id)) next.delete(hit.id);
        else next.add(hit.id);
      } else if (!selected.has(hit.id)) next = new Set([hit.id]);
      setSelected(next);
      setPanel("instance");
      if (next.has(hit.id)) setDrag({ kind: "move", x0: p.x, y0: p.y, dx: 0, dy: 0, anchor: hit });
      return;
    }
    if (!e.shiftKey) setSelected(new Set());
    setDrag({ kind: "box", x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey });
  };

  const move = (e: React.PointerEvent) => {
    const p = toRoom(e.clientX, e.clientY);
    setHover(p);
    if (!drag) return;
    if (drag.kind === "pan") return setView((v) => ({ ...v, panX: drag.panX + e.clientX - drag.sx, panY: drag.panY + e.clientY - drag.sy }));
    if (drag.kind === "box") return setDrag({ ...drag, x1: p.x, y1: p.y });
    if (drag.kind === "erase") return erase(p);
    if (drag.kind === "paint") {
      const at = snapped(p, e.altKey);
      const key = `${at.x},${at.y}`;
      if (key !== lastPaint.current) {
        lastPaint.current = key;
        if (!occupied(room, placeObject, at.x, at.y)) place(placeObject, at);
      }
      return;
    }
    // Moving: the anchor (the instance grabbed) lands on the grid; the rest keep their places relative to it.
    const raw = { x: drag.anchor.x + p.x - drag.x0, y: drag.anchor.y + p.y - drag.y0 };
    const at = snapped(raw, e.altKey);
    setDrag({ ...drag, dx: at.x - drag.anchor.x, dy: at.y - drag.anchor.y });
  };

  const up = () => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    if (d.kind === "box") {
      const caught = inBox(project, room, d.x0, d.y0, d.x1, d.y1).map((i) => i.id);
      setSelected((s) => new Set([...(d.add ? s : []), ...caught]));
      if (caught.length) setPanel("instance");
    }
    if (d.kind === "move" && (d.dx || d.dy)) {
      setRoom((r) => {
        for (const i of r.instances) if (selected.has(i.id)) (i.x += d.dx), (i.y += d.dy);
      });
    }
  };

  const wheel = (e: React.WheelEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top);
    else setView((v) => ({ ...v, panX: v.panX - e.deltaX, panY: v.panY - e.deltaY, fitted: true }));
  };

  // ---------------------------------------------------------------- keys
  const selectedList = room.instances.filter((i) => selected.has(i.id));
  const pasteAt = (clip: Clip) => {
    const where = hover && hover.x >= 0 && hover.y >= 0 ? snapped(hover, false) : { x: room.gridWidth, y: room.gridHeight };
    const made = paste(project, clip, where.x, where.y, layerId);
    if (!made.length || layerLocked) return;
    setRoom((r) => void r.instances.push(...made));
    setSelected(new Set(made.map((m) => m.id)));
  };
  const key = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === " ") {
      spaceDown.current = true;
      e.preventDefault();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!selected.size) return;
      e.preventDefault();
      setRoom((r) => void (r.instances = r.instances.filter((i) => !selected.has(i.id))));
      setSelected(new Set());
    } else if (mod && e.key.toLowerCase() === "c") {
      clipboard = copy(selectedList);
    } else if (mod && e.key.toLowerCase() === "x") {
      clipboard = copy(selectedList);
      setRoom((r) => void (r.instances = r.instances.filter((i) => !selected.has(i.id))));
      setSelected(new Set());
    } else if (mod && e.key.toLowerCase() === "v") {
      if (clipboard) pasteAt(clipboard);
    } else if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const clip = copy(selectedList);
      if (!clip) return;
      const x0 = Math.min(...selectedList.map((i) => i.x)), y0 = Math.min(...selectedList.map((i) => i.y));
      const made = paste(project, clip, x0 + room.gridWidth, y0 + room.gridHeight, layerId);
      setRoom((r) => void r.instances.push(...made));
      setSelected(new Set(made.map((m) => m.id)));
    } else if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSelected(new Set(room.instances.filter((i) => i.layer === layerId).map((i) => i.id)));
    } else if (e.key.startsWith("Arrow") && selected.size) {
      e.preventDefault();
      const step = e.shiftKey ? 1 : room.snap ? 0 : 1;
      const sx = step || room.gridWidth, sy = step || room.gridHeight;
      const dx = e.key === "ArrowLeft" ? -sx : e.key === "ArrowRight" ? sx : 0;
      const dy = e.key === "ArrowUp" ? -sy : e.key === "ArrowDown" ? sy : 0;
      setRoom((r) => {
        for (const i of r.instances) if (selected.has(i.id)) (i.x += dx), (i.y += dy);
      });
    } else if (e.key === "Escape") {
      setSelected(new Set());
    }
  };

  // ---------------------------------------------------------------- drop from the tree
  const dragOver = (e: React.DragEvent) => {
    if ([...e.dataTransfer.types].includes(OBJECT_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setHover(toRoom(e.clientX, e.clientY));
    }
  };
  const drop = (e: React.DragEvent) => {
    const object = e.dataTransfer.getData(OBJECT_DRAG_TYPE);
    if (!object) return;
    e.preventDefault();
    const inst = place(object, snapped(toRoom(e.clientX, e.clientY), e.altKey));
    if (inst) {
      setSelected(new Set([inst.id]));
      setPanel("instance");
      setPlaceObject(object);
    }
    canvas.current?.focus();
  };

  const cursor = drag?.kind === "pan" ? "grabbing" : tool === "place" ? "crosshair" : "default";

  return (
    <div className="room-editor2" data-tutorial="room-editor">
      <div className="room-toolbar">
        <div className="seg small" role="radiogroup" aria-label="Tool">
          <button role="radio" aria-checked={tool === "select"} className={tool === "select" ? "on" : ""} onClick={() => setTool("select")} data-testid="tool-select">
            Select
          </button>
          <button role="radio" aria-checked={tool === "place"} className={tool === "place" ? "on" : ""} onClick={() => setTool("place")} data-testid="tool-place">
            Place
          </button>
        </div>
        {tool === "place" && (
          <select value={placeObject} onChange={(e) => setPlaceObject(e.target.value)} aria-label="Object to place" data-testid="place-object">
            {project.objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <select value={layerId} onChange={(e) => setLayerId(e.target.value)} aria-label="Layer to place on" title="New instances go on this layer">
          {room.layers
            .filter((l) => l.kind === "instances")
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.locked ? " (locked)" : ""}
                {!l.visible ? " (hidden)" : ""}
              </option>
            ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={room.snap} onChange={(e) => setRoom((r) => void (r.snap = e.target.checked))} data-testid="room-snap" /> Snap
        </label>
        <label className="check">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid
        </label>
        <span className="spacer" />
        <span className="muted small coords" data-testid="room-coords">
          {hover ? `${Math.round(hover.x)}, ${Math.round(hover.y)}` : ""}
        </span>
        <button className="icon-btn" onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out">
          −
        </button>
        <span className="muted small">{Math.round(view.zoom * 100)}%</span>
        <button className="icon-btn" onClick={() => zoomAt(1.25)} aria-label="Zoom in">
          +
        </button>
        <button className="btn small" onClick={fit}>
          Fit
        </button>
      </div>
      <div className="room-body">
        <div className="room-canvas" ref={box} onDragOver={dragOver} onDrop={drop}>
          <canvas
            ref={canvas}
            tabIndex={0}
            style={{ cursor }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={() => !drag && setHover(null)}
            onWheel={wheel}
            onKeyDown={key}
            onKeyUp={(e) => e.key === " " && (spaceDown.current = false)}
            onContextMenu={(e) => e.preventDefault()}
            data-testid="room-canvas"
            data-tutorial="room-canvas"
            // Where the room is on the canvas, for tests and tutorials to aim at.
            data-zoom={view.zoom}
            data-pan-x={view.panX}
            data-pan-y={view.panY}
            aria-label={`Room ${room.name}`}
          />
          {room.instances.length === 0 && !drag && (
            <p className="room-hint">Drag an object here from the list on the left, or choose Place and click.</p>
          )}
        </div>
        <RoomPanel
          room={room}
          panel={panel}
          setPanel={setPanel}
          selected={selectedList}
          setRoom={setRoom}
          clear={() => setSelected(new Set())}
          layerId={layerId}
          setLayerId={setLayerId}
          focus={focus}
        />
      </div>
    </div>
  );
}

function RoomPanel({
  room,
  panel,
  setPanel,
  selected,
  setRoom,
  clear,
  layerId,
  setLayerId,
  focus,
}: {
  room: RoomResource;
  panel: "room" | "layers" | "instance";
  setPanel: (p: "room" | "layers" | "instance") => void;
  selected: RoomInstance[];
  setRoom: (recipe: (r: RoomResource) => void) => void;
  clear: () => void;
  layerId: string;
  setLayerId: (id: string) => void;
  focus: { instanceId: string; line: number; nonce: number } | null;
}) {
  const { project } = useProjectApi();
  const num = (label: string, value: number, change: (v: number) => void, testid?: string, min?: number) => (
    <label className="num">
      {label}
      <input
        type="number"
        value={Math.round(value * 1000) / 1000}
        {...(min !== undefined ? { min } : {})}
        onChange={(e) => change(Number(e.target.value) || 0)}
        aria-label={label}
        {...(testid ? { "data-testid": testid } : {})}
      />
    </label>
  );
  const eachSelected = (recipe: (i: RoomInstance) => void) =>
    setRoom((r) => {
      const ids = new Set(selected.map((s) => s.id));
      for (const i of r.instances) if (ids.has(i.id)) recipe(i);
    });
  const one = selected.length === 1 ? selected[0]! : null;

  return (
    <aside className="room-panel">
      <div className="seg small panel-tabs" role="tablist">
        {(["room", "layers", "instance"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={panel === p} className={panel === p ? "on" : ""} onClick={() => setPanel(p)} data-testid={`room-panel-${p}`}>
            {p === "room" ? "Room" : p === "layers" ? "Layers" : selected.length > 1 ? `${selected.length} selected` : "Instance"}
          </button>
        ))}
      </div>

      {panel === "room" && (
        <div className="panel-body">
          <fieldset>
            <legend>Size</legend>
            {num("Width", room.width, (v) => setRoom((r) => void (r.width = Math.max(16, v))), "room-width", 16)}
            {num("Height", room.height, (v) => setRoom((r) => void (r.height = Math.max(16, v))), "room-height", 16)}
            <label className="num">
              Colour <input type="color" value={room.background} onChange={(e) => setRoom((r) => void (r.background = e.target.value))} aria-label="Background colour" />
            </label>
          </fieldset>
          <fieldset>
            <legend>Grid</legend>
            {num("Width", room.gridWidth, (v) => setRoom((r) => void (r.gridWidth = Math.max(1, v))), "grid-width", 1)}
            {num("Height", room.gridHeight, (v) => setRoom((r) => void (r.gridHeight = Math.max(1, v))), "grid-height", 1)}
          </fieldset>
          <fieldset data-tutorial="room-camera">
            <legend>Camera</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={room.camera.enabled}
                onChange={(e) => setRoom((r) => void (r.camera.enabled = e.target.checked))}
                data-testid="camera-enabled"
              />{" "}
              Show part of the room (a view that can move)
            </label>
            {room.camera.enabled && (
              <>
                <div>
                  {num("View width", room.camera.width, (v) => setRoom((r) => void (r.camera.width = Math.max(16, v))), "camera-width", 16)}
                  {num("View height", room.camera.height, (v) => setRoom((r) => void (r.camera.height = Math.max(16, v))), "camera-height", 16)}
                </div>
                <label className="num">
                  Follow
                  <select
                    value={room.camera.follow ?? ""}
                    onChange={(e) => setRoom((r) => void (r.camera.follow = e.target.value || null))}
                    aria-label="Camera follows"
                    data-testid="camera-follow"
                  >
                    <option value="">(nothing — stays put)</option>
                    {project.objects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="num">
                  Smoothing
                  <input
                    type="range"
                    min={0.02}
                    max={1}
                    step={0.02}
                    value={room.camera.smoothing}
                    onChange={(e) => setRoom((r) => void (r.camera.smoothing = Number(e.target.value)))}
                    aria-label="Camera smoothing"
                  />
                  <span className="muted small">{room.camera.smoothing >= 1 ? "sticks" : "glides"}</span>
                </label>
                <p className="muted small">The dashed box is the view. In code: camera_follow(self), camera_shake(6, 20).</p>
              </>
            )}
          </fieldset>
        </div>
      )}

      {panel === "layers" && <LayersPanel room={room} setRoom={setRoom} layerId={layerId} setLayerId={setLayerId} />}

      {panel === "instance" &&
        (selected.length === 0 ? (
          <p className="muted small panel-body">Click an instance to select it, or drag a box around several.</p>
        ) : (
          <div className="panel-body" data-testid="instance-panel">
            {one ? (
              <label className="num">
                Object
                <select value={one.object} onChange={(e) => eachSelected((i) => void (i.object = e.target.value))} aria-label="Object">
                  {project.objects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="muted small">Changes apply to all {selected.length}.</p>
            )}
            {one && (
              <div>
                {num("x", one.x, (v) => eachSelected((i) => void (i.x = v)), "inst-x")}
                {num("y", one.y, (v) => eachSelected((i) => void (i.y = v)), "inst-y")}
              </div>
            )}
            <div>
              {num("Scale x", (one ?? selected[0]!).scaleX, (v) => eachSelected((i) => void (i.scaleX = v)), "inst-scalex")}
              {num("Scale y", (one ?? selected[0]!).scaleY, (v) => eachSelected((i) => void (i.scaleY = v)), "inst-scaley")}
              {num("Angle", (one ?? selected[0]!).angle, (v) => eachSelected((i) => void (i.angle = v)), "inst-angle")}
            </div>
            <label className="num">
              Layer
              <select value={(one ?? selected[0]!).layer} onChange={(e) => eachSelected((i) => void (i.layer = e.target.value))} aria-label="Instance layer">
                {room.layers
                  .filter((l) => l.kind === "instances")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>
            {one && (
              <div className="creation-code">
                <div className="signature">
                  Creation code — runs for this one instance, after its Create event. <code>self</code> is this instance.
                </div>
                <CodeEditor
                  docKey={`inst:${one.id}`}
                  value={one.code}
                  onChange={(code) => eachSelected((i) => void (i.code = code))}
                  names={() => projectNames(project)}
                  errorLine={focus && focus.instanceId === one.id ? { line: focus.line, nonce: focus.nonce } : null}
                  testId="creation-code"
                />
              </div>
            )}
            <div className="row">
              <button
                className="btn small"
                onClick={() => {
                  setRoom((r) => void (r.instances = r.instances.filter((i) => !selected.some((s) => s.id === i.id))));
                  clear();
                }}
                data-testid="delete-instances"
              >
                {Icon.trash()} Delete {selected.length > 1 ? `${selected.length}` : ""}
              </button>
            </div>
          </div>
        ))}
    </aside>
  );
}

function LayersPanel({
  room,
  setRoom,
  layerId,
  setLayerId,
}: {
  room: RoomResource;
  setRoom: (recipe: (r: RoomResource) => void) => void;
  layerId: string;
  setLayerId: (id: string) => void;
}) {
  const { project } = useProjectApi();
  const [open, setOpen] = useState<string | null>(null);
  // Front to back: lowest depth (drawn on top) first, as the student thinks of it.
  const layers = useMemo(() => [...room.layers].sort((a, b) => a.depth - b.depth), [room.layers]);
  const setLayer = (id: string, recipe: (l: RoomLayer) => void) => setRoom((r) => recipe(r.layers.find((l) => l.id === id)!));
  const add = (kind: "instances" | "background") => {
    const deepest = Math.max(0, ...room.layers.map((l) => l.depth));
    const id = newId();
    const layer: RoomLayer =
      kind === "instances"
        ? { id, name: `Instances ${room.layers.filter((l) => l.kind === "instances").length + 1}`, kind, depth: 0, visible: true, locked: false }
        : { id, name: `Background ${room.layers.filter((l) => l.kind === "background").length + 1}`, kind, depth: deepest + 100, visible: true, locked: false, color: null, sprite: null, mode: "tile", hspeed: 0, vspeed: 0, parallax: 0 };
    setRoom((r) => void r.layers.push(layer));
    setOpen(id);
  };
  return (
    <div className="panel-body" data-tutorial="room-layers">
      <ul className="layer-list" data-testid="layer-list">
        {layers.map((l) => {
          const count = room.instances.filter((i) => i.layer === l.id).length;
          return (
            <li key={l.id} className={l.id === layerId ? "current" : ""}>
              <div className="layer-row">
                <button className="icon-btn" onClick={() => setLayer(l.id, (x) => void (x.visible = !x.visible))} aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`} title={l.visible ? "Hide in the editor" : "Show"}>
                  {l.visible ? "👁" : "–"}
                </button>
                <button className="icon-btn" onClick={() => setLayer(l.id, (x) => void (x.locked = !x.locked))} aria-label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`} title={l.locked ? "Locked: can't be clicked or changed" : "Lock"}>
                  {l.locked ? "🔒" : "🔓"}
                </button>
                <button className="layer-name" onClick={() => (l.kind === "instances" ? setLayerId(l.id) : setOpen(open === l.id ? null : l.id))}>
                  {l.name} <span className="muted small">{l.kind === "instances" ? `${count}` : "background"}</span>
                </button>
                <button className="icon-btn" onClick={() => setOpen(open === l.id ? null : l.id)} aria-label={`Settings for ${l.name}`}>
                  {Icon.settings()}
                </button>
              </div>
              {open === l.id && (
                <div className="layer-settings">
                  <label className="num">
                    Name <input value={l.name} onChange={(e) => setLayer(l.id, (x) => void (x.name = e.target.value))} aria-label="Layer name" />
                  </label>
                  <label className="num">
                    Depth{" "}
                    <input type="number" value={l.depth} onChange={(e) => setLayer(l.id, (x) => void (x.depth = Number(e.target.value) || 0))} aria-label="Layer depth" />
                  </label>
                  {l.kind === "instances" && <p className="muted small">Instances draw at their object's depth; this layer only groups them in the editor.</p>}
                  {l.kind === "background" && (
                    <>
                      <label className="check">
                        <input type="checkbox" checked={!!l.color} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.color = e.target.checked ? "#334155" : null))} /> Colour
                        {l.color && <input type="color" value={l.color} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.color = e.target.value))} aria-label="Layer colour" />}
                      </label>
                      <label className="num">
                        Picture
                        <select value={l.sprite ?? ""} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.sprite = e.target.value || null))} aria-label="Background picture" data-testid="bg-sprite">
                          <option value="">(none)</option>
                          {project.sprites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="num">
                        Fill
                        <select value={l.mode} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.mode = e.target.value as "tile"))} aria-label="Background fill">
                          <option value="tile">Repeat</option>
                          <option value="stretch">Stretch to the room</option>
                          <option value="once">Once, at the top-left</option>
                        </select>
                      </label>
                      <div>
                        <label className="num">
                          Scroll x <input type="number" value={l.hspeed} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.hspeed = Number(e.target.value) || 0))} aria-label="Scroll x" />
                        </label>
                        <label className="num">
                          y <input type="number" value={l.vspeed} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.vspeed = Number(e.target.value) || 0))} aria-label="Scroll y" />
                        </label>
                      </div>
                      <label className="num">
                        Parallax
                        <input type="range" min={0} max={1} step={0.05} value={l.parallax} onChange={(e) => setLayer(l.id, (x) => x.kind === "background" && void (x.parallax = Number(e.target.value)))} aria-label="Parallax" />
                        <span className="muted small">{l.parallax === 0 ? "moves with the room" : l.parallax === 1 ? "fixed to the screen" : "far away"}</span>
                      </label>
                    </>
                  )}
                  <button
                    className="btn small"
                    disabled={l.kind === "instances" && room.layers.filter((x) => x.kind === "instances").length <= 1}
                    onClick={() => {
                      if (count && !confirm(`Delete ${l.name} and the ${count} instance${count === 1 ? "" : "s"} on it?`)) return;
                      setRoom((r) => {
                        r.layers = r.layers.filter((x) => x.id !== l.id);
                        r.instances = r.instances.filter((i) => i.layer !== l.id);
                      });
                    }}
                  >
                    {Icon.trash()} Delete layer
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="row">
        <button className="btn small" onClick={() => add("instances")} data-testid="add-instance-layer">
          {Icon.plus()} Instance layer
        </button>
        <button className="btn small" onClick={() => add("background")} data-testid="add-background-layer">
          {Icon.plus()} Background layer
        </button>
      </div>
      <p className="muted small">Tile layers arrive with the tile map editor.</p>
    </div>
  );
}
