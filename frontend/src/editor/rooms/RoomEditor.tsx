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
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyBlocks } from "../../blocks/blockState";
import { find, newId, newInstance, tilesetGrid, type Project, type RoomInstance, type RoomLayer, type RoomResource } from "../../store/project";
import {
  autotileErase,
  autotilePaint,
  erase as eraseTiles,
  fillRect,
  floodCells,
  floodFill,
  paint,
  pick,
  rectCells,
  single,
  stampFromPalette,
  type AutotileSet,
  type Stamp,
} from "../tiles/tileOps";
import { tileRect } from "../tiles/TilesetEditor";
import { CodeEditor } from "../code/CodeEditor";
import { blockNamesFor, BlocksEditor, confirmToPython, isBlocks, ModeTabs, projectNames, toBlocks, toPython } from "../codeMode";
import { Icon } from "../ui/icons";
import { useProjectApi } from "../useProject";
import { cameraPreview, copy, corners, drawOrder, hitTest, inBox, occupied, paste, shapeOf, snap, visibleLayers, type Clip } from "./roomOps";

/** Shared by every room, so copying in one and pasting in another works. */
let clipboard: Clip | null = null;

export const OBJECT_DRAG_TYPE = "application/x-gameide-object";
const MIN_ZOOM = 0.02;

type TileLayer = Extract<RoomLayer, { kind: "tiles" }>;
type Tool = "select" | "place" | "paint" | "rect" | "fill" | "pick" | "erase";

type Drag =
  | { kind: "move"; x0: number; y0: number; dx: number; dy: number; anchor: RoomInstance }
  | { kind: "tiles"; erasing: boolean; last: string }
  | { kind: "tilerect"; c0: number; r0: number; c1: number; r1: number; erasing: boolean }
  | { kind: "box"; x0: number; y0: number; x1: number; y1: number; add: boolean }
  | { kind: "pan"; sx: number; sy: number; panX: number; panY: number }
  | { kind: "paint" }
  | { kind: "erase" };

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
function useSpriteImages(project: Project, assets: Map<string, Blob>) {
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
function useTilesetImages(project: Project, assets: Map<string, Blob>) {
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

export function RoomEditor({ roomId, focus }: { roomId: string; focus: { instanceId: string; line: number; nonce: number } | null }) {
  const { project, assets, mutate, undo, redo, undoLabel, redoLabel, endUndoGroup } = useProjectApi();
  const room = find(project, "rooms", roomId);
  const [tool, setTool] = useState<Tool>("select");
  const [stamp, setStamp] = useState<Stamp>(single(0));
  /** An autotile set chosen as the brush (its id), or null for ordinary tiles. */
  const [autoSetId, setAutoSetId] = useState<string | null>(null);
  const [placeObject, setPlaceObject] = useState<string>(project.objects[0]?.id ?? "");
  const [layerId, setLayerId] = useState<string>(room?.layers.find((l) => l.kind === "instances")?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<Panel>("room");
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0, fitted: false });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const spaceDown = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const images = useSpriteImages(project, assets);
  const tileImages = useTilesetImages(project, assets);
  const lastPaint = useRef<string>("");

  // ---------------------------------------------------------------- undo
  // Room edits go into the project's undo history (history.ts), so they can
  // be undone after switching tabs and back. A drag — a painted stroke, a
  // move, a rectangle — is one step: its changes share a group, which ends
  // when the pointer comes up.
  const strokeCount = useRef(0);
  const stroke = useRef<string | null>(null);
  const beginStroke = () => (stroke.current = `room:${roomId}:${++strokeCount.current}`);
  const endStroke = () => {
    stroke.current = null;
    endUndoGroup();
  };

  const setRoom = useCallback(
    (recipe: (r: RoomResource) => void, label = "edit the room") =>
      mutate((p) => recipe(find(p, "rooms", roomId)!), { label, ...(stroke.current ? { group: stroke.current } : {}) }),
    [mutate, roomId],
  );

  // An error in an instance's creation code: select it and show its code.
  useEffect(() => {
    if (!focus || !room?.instances.some((i) => i.id === focus.instanceId)) return;
    setSelected(new Set([focus.instanceId]));
    setPanel("instance");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // Keep the current layer a real layer as layers come and go.
  useEffect(() => {
    if (room && !room.layers.some((l) => l.id === layerId && l.kind !== "background"))
      setLayerId(room.layers.find((l) => l.kind === "instances")?.id ?? "");
  }, [room, layerId]);

  // Tile layers have their own tools; switching layer kind switches the tool.
  const currentLayer = room?.layers.find((l) => l.id === layerId);
  const tileLayer = currentLayer?.kind === "tiles" ? currentLayer : null;
  const tileSet = tileLayer ? find(project, "tilesets", tileLayer.tileset) : undefined;
  const tileSize = tileSet ? { w: tileSet.tileWidth, h: tileSet.tileHeight } : null;
  const autoSet: AutotileSet | null = (autoSetId && tileSet?.autotiles.find((a) => a.id === autoSetId)) || null;
  useEffect(() => {
    const tileTools: Tool[] = ["paint", "rect", "fill", "pick", "erase"];
    if (tileLayer && !tileTools.includes(tool)) setTool("paint");
    if (!tileLayer && tileTools.includes(tool)) setTool("select");
    if (tileLayer) setPanel((p) => (p === "instance" ? "tiles" : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileLayer?.id]);

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
    // Down to 2%: a 9600 px level has to fit too. (At a 10% floor it didn't,
    // and Fit left most of a big room off screen.)
    const zoom = Math.max(MIN_ZOOM, Math.min(4, Math.min((el.clientWidth - 40) / room.width, (el.clientHeight - 40) / room.height)));
    setView({ zoom, panX: (el.clientWidth - room.width * zoom) / 2, panY: (el.clientHeight - room.height * zoom) / 2, fitted: true });
  }, [room]);

  useEffect(() => {
    if (!view.fitted) fit();
  }, [fit, view.fitted]);

  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const el = box.current!;
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2;
    setView((v) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(16, v.zoom * factor));
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
          const c1 = Math.ceil((el.clientWidth - view.panX) / view.zoom / tw), r1 = Math.ceil((el.clientHeight - view.panY) / view.zoom / th);
          const onScreen = (c1 - c0 + 1) * (r1 - r0 + 1);
          const draw = (c: number, r: number, tile: number) => {
            const src = tileRect(ts, tile, columns);
            ctx.drawImage(img, src.x, src.y, src.w, src.h, c * tw, r * th, tw, th);
          };
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

    // The grid: the room's, or on a tile layer, its tileset's.
    const gw = tileSize?.w ?? room.gridWidth, gh = tileSize?.h ?? room.gridHeight;
    if (showGrid && gw * view.zoom >= 6 && gh * view.zoom >= 6) {
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1 / view.zoom;
      ctx.beginPath();
      for (let x = 0; x <= room.width; x += gw) ctx.moveTo(x, 0), ctx.lineTo(x, room.height);
      for (let y = 0; y <= room.height; y += gh) ctx.moveTo(0, y), ctx.lineTo(room.width, y);
      ctx.stroke();
    }
    // What a tile tool would do: the stamp under the pointer, or the rectangle being dragged.
    if (tileLayer && tileSize) {
      const tsImg = tileSet ? tileImages.get(tileSet.id) : undefined;
      if (drag?.kind === "tilerect") {
        const left = Math.min(drag.c0, drag.c1), top = Math.min(drag.r0, drag.r1);
        ctx.fillStyle = drag.erasing ? "rgba(255,90,90,0.25)" : "rgba(79,140,255,0.25)";
        ctx.fillRect(left * tileSize.w, top * tileSize.h, (Math.abs(drag.c1 - drag.c0) + 1) * tileSize.w, (Math.abs(drag.r1 - drag.r0) + 1) * tileSize.h);
      } else if (hover && (tool === "paint" || tool === "fill" || tool === "erase" || tool === "rect")) {
        const c = Math.floor(hover.x / tileSize.w), r = Math.floor(hover.y / tileSize.h);
        if (tool === "paint" && tsImg && tileSet && !autoSet) {
          ctx.globalAlpha = 0.6;
          const { columns } = tilesetGrid(tileSet);
          for (let y = 0; y < stamp.rows; y++)
            for (let x = 0; x < stamp.columns; x++) {
              const src = tileRect(tileSet, stamp.tiles[y * stamp.columns + x]!, columns);
              ctx.drawImage(tsImg, src.x, src.y, src.w, src.h, (c + x) * tileSize.w, (r + y) * tileSize.h, tileSize.w, tileSize.h);
            }
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = tool === "erase" ? "#ff6b6b" : "#4f8cff";
        ctx.lineWidth = 2 / view.zoom;
        const brushed = (tool === "paint" || tool === "erase") && !autoSet;
        const w = brushed ? stamp.columns : 1, h = brushed ? stamp.rows : 1;
        ctx.strokeRect(c * tileSize.w, r * tileSize.h, w * tileSize.w, h * tileSize.h);
      }
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

  // ---------------------------------------------------------------- tiles
  const bounds = tileSize ? { columns: Math.ceil(room.width / tileSize.w), rows: Math.ceil(room.height / tileSize.h) } : { columns: 0, rows: 0 };
  const cellOf = (p: { x: number; y: number }) => ({ c: Math.floor(p.x / tileSize!.w), r: Math.floor(p.y / tileSize!.h) });
  const setTiles = (make: (tiles: Record<string, number>) => Record<string, number>) =>
    setRoom((r) => {
      const l = r.layers.find((x) => x.id === layerId);
      if (l?.kind === "tiles") l.tiles = make(l.tiles);
    });
  /** One brush dab at (c, r): the stamp, or the autotile set (which also re-picks the neighbours). */
  const dab = (t: Record<string, number>, c: number, r: number, erasing: boolean) =>
    autoSet
      ? erasing
        ? autotileErase(t, [[c, r]], autoSet)
        : autotilePaint(t, [[c, r]], autoSet, bounds)
      : erasing
        ? eraseTiles(t, c, r, stamp.columns, stamp.rows)
        : paint(t, c, r, stamp, bounds);

  const tileDown = (e: React.PointerEvent, p: { x: number; y: number }) => {
    if (!tileLayer || !tileSize || layerLocked) return;
    const { c, r } = cellOf(p);
    const erasing = tool === "erase" || e.button === 2;
    beginStroke();
    if (tool === "pick") {
      const got = pick(tileLayer.tiles, c, r);
      if (got) {
        setStamp(got);
        setAutoSetId(null);
      }
      setTool("paint");
      return;
    }
    if (tool === "fill") {
      setTiles((t) => (autoSet ? autotilePaint(t, floodCells(t, c, r, bounds), autoSet, bounds) : floodFill(t, c, r, stamp, bounds)));
      return;
    }
    if (tool === "rect") return setDrag({ kind: "tilerect", c0: c, r0: r, c1: c, r1: r, erasing });
    setTiles((t) => dab(t, c, r, erasing));
    setDrag({ kind: "tiles", erasing, last: `${c},${r}` });
  };

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
    if (tileLayer) return tileDown(e, p);
    beginStroke();
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
    if (drag.kind === "tilerect") {
      const { c, r } = cellOf(p);
      return setDrag({ ...drag, c1: c, r1: r });
    }
    if (drag.kind === "tiles") {
      const { c, r } = cellOf(p);
      const k = `${c},${r}`;
      if (k === drag.last) return;
      setDrag({ ...drag, last: k });
      return setTiles((t) => dab(t, c, r, drag.erasing));
    }
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
    if (d?.kind === "tilerect")
      setTiles((t) => {
        if (!autoSet) return fillRect(t, d.c0, d.r0, d.c1, d.r1, d.erasing ? null : stamp, bounds);
        const cells = rectCells(d.c0, d.r0, d.c1, d.r1);
        return d.erasing ? autotileErase(t, cells, autoSet) : autotilePaint(t, cells, autoSet, bounds);
      });
    // The stroke ends after its last change, so the whole drag is one undo step.
    endStroke();
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
          {(tileLayer
            ? ([["paint", "Paint"], ["rect", "Rectangle"], ["fill", "Fill"], ["pick", "Pick"], ["erase", "Erase"]] as const)
            : ([["select", "Select"], ["place", "Place"]] as const)
          ).map(([t, label]) => (
            <button key={t} role="radio" aria-checked={tool === t} className={tool === t ? "on" : ""} onClick={() => setTool(t)} data-testid={`tool-${t}`}>
              {label}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={undo} disabled={!undoLabel} title={undoLabel ? `Undo ${undoLabel} (Ctrl+Z)` : "Nothing to undo"} aria-label="Undo" data-testid="room-undo">
          ↶
        </button>
        <button className="icon-btn" onClick={redo} disabled={!redoLabel} title={redoLabel ? `Redo ${redoLabel} (Ctrl+Shift+Z)` : "Nothing to redo"} aria-label="Redo" data-testid="room-redo">
          ↷
        </button>
        {tool === "place" && (
          <select value={placeObject} onChange={(e) => setPlaceObject(e.target.value)} aria-label="Object to place" data-testid="place-object">
            {project.objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <select value={layerId} onChange={(e) => setLayerId(e.target.value)} aria-label="Layer to work on" title="The layer you place on or paint" data-testid="current-layer">
          {room.layers
            .filter((l) => l.kind !== "background")
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
          tileLayer={tileLayer}
          stamp={stamp}
          setStamp={(st) => {
            setStamp(st);
            setAutoSetId(null);
            if (tool !== "rect" && tool !== "fill") setTool("paint");
          }}
          autoSetId={autoSet?.id ?? null}
          setAutoSetId={(id) => {
            setAutoSetId(id);
            if (tool !== "rect" && tool !== "fill" && tool !== "erase") setTool("paint");
          }}
          tileImages={tileImages}
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

type Panel = "room" | "layers" | "instance" | "tiles";

function RoomPanel({
  tileLayer,
  stamp,
  setStamp,
  autoSetId,
  setAutoSetId,
  tileImages,
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
  tileLayer: TileLayer | null;
  stamp: Stamp;
  setStamp: (s: Stamp) => void;
  autoSetId: string | null;
  setAutoSetId: (id: string | null) => void;
  tileImages: Map<string, ImageBitmap>;
  room: RoomResource;
  panel: Panel;
  setPanel: (p: Panel) => void;
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
        {(["room", "layers", tileLayer ? "tiles" : "instance"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={panel === p} className={panel === p ? "on" : ""} onClick={() => setPanel(p)} data-testid={`room-panel-${p}`}>
            {p === "room" ? "Room" : p === "layers" ? "Layers" : p === "tiles" ? "Tiles" : selected.length > 1 ? `${selected.length} selected` : "Instance"}
          </button>
        ))}
      </div>

      {panel === "tiles" && tileLayer && (
        <TilePalette layer={tileLayer} stamp={stamp} setStamp={setStamp} images={tileImages} autoSetId={autoSetId} setAutoSetId={setAutoSetId} />
      )}

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
            {one && <CreationCode roomId={room.id} inst={one} focus={focus && focus.instanceId === one.id ? focus : null} />}
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

/**
 * The tile layer's tileset, to choose the brush from: click a tile, or drag
 * across several to paint them together.
 */
function TilePalette({
  layer,
  stamp,
  setStamp,
  images,
  autoSetId,
  setAutoSetId,
}: {
  layer: TileLayer;
  stamp: Stamp;
  setStamp: (s: Stamp) => void;
  images: Map<string, ImageBitmap>;
  autoSetId: string | null;
  setAutoSetId: (id: string | null) => void;
}) {
  const { project } = useProjectApi();
  const ts = find(project, "tilesets", layer.tileset);
  const img = ts ? images.get(ts.id) : undefined;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [anchor, setAnchor] = useState<number | null>(null);
  const grid = ts ? tilesetGrid(ts) : { columns: 0, rows: 0 };
  const zoom = ts ? Math.max(1, Math.min(3, Math.floor(240 / Math.max(1, ts.imageWidth)))) : 1;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !ts || !img) return;
    c.width = ts.imageWidth * zoom;
    c.height = ts.imageHeight * zoom;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const chosen = new Set(autoSetId ? [] : stamp.tiles);
    for (let n = 0; n < grid.columns * grid.rows; n++) {
      const r = tileRect(ts, n, grid.columns);
      ctx.strokeStyle = chosen.has(n) ? "#4f8cff" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = chosen.has(n) ? 2 : 1;
      ctx.strokeRect(r.x * zoom + 1, r.y * zoom + 1, r.w * zoom - 2, r.h * zoom - 2);
    }
  });

  if (!ts) return <p className="muted small panel-body">Choose this layer's tileset in Layers.</p>;
  if (!img) return <p className="muted small panel-body">{ts.name} has no picture yet. Open it and choose one.</p>;
  const tileAt = (e: React.PointerEvent) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - b.left) / zoom, y = (e.clientY - b.top) / zoom;
    for (let n = 0; n < grid.columns * grid.rows; n++) {
      const r = tileRect(ts, n, grid.columns);
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return n;
    }
    return null;
  };
  return (
    <div className="panel-body" data-tutorial="tile-palette">
      <p className="muted small">Click a tile to paint with it; drag across several to paint a block. Right-click in the room erases.</p>
      <div className="palette checker-bg">
        <canvas
          ref={canvas}
          data-testid="tile-palette"
          onPointerDown={(e) => {
            const n = tileAt(e);
            if (n === null) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setAnchor(n);
            setStamp(single(n));
          }}
          onPointerMove={(e) => {
            if (anchor === null) return;
            const n = tileAt(e);
            if (n !== null) setStamp(stampFromPalette(anchor, n, grid.columns));
          }}
          onPointerUp={() => setAnchor(null)}
        />
      </div>
      <p className="muted small" data-testid="stamp-size">
        {autoSetId
          ? `Brush: ${ts.autotiles.find((a) => a.id === autoSetId)?.name ?? "?"} (autotile)`
          : `Brush: ${stamp.columns} × ${stamp.rows} ${stamp.columns * stamp.rows === 1 ? `(tile ${stamp.tiles[0]})` : "tiles"}`}
      </p>
      {ts.autotiles.length > 0 && (
        <div className="autotile-brushes" data-tutorial="autotile-brushes">
          <p className="muted small">Autotile: paint, and the edges and corners pick themselves.</p>
          {ts.autotiles.map((a) => {
            const r = tileRect(ts, a.tiles[0] !== undefined && a.tiles[0]! >= 0 ? a.tiles[0]! : 0, grid.columns);
            return (
              <button key={a.id} className={`btn small ${autoSetId === a.id ? "on" : ""}`} onClick={() => setAutoSetId(a.id)} data-testid={`autotile-${a.name}`}>
                <AutotileThumb img={img} rect={r} /> {a.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AutotileThumb({ img, rect }: { img: ImageBitmap; rect: { x: number; y: number; w: number; h: number } }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = c.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, 16, 16);
  }, [img, rect.x, rect.y, rect.w, rect.h]);
  return <canvas ref={c} width={16} height={16} className="thumb" />;
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
  const add = (kind: "instances" | "background" | "tiles") => {
    const deepest = Math.max(0, ...room.layers.map((l) => l.depth));
    const id = newId();
    const n = room.layers.filter((l) => l.kind === kind).length + 1;
    const layer: RoomLayer =
      kind === "instances"
        ? { id, name: `Instances ${n}`, kind, depth: 0, visible: true, locked: false }
        : kind === "tiles"
          ? // Behind the instances (depth 0) by default, as ground usually is.
            { id, name: n === 1 ? "Ground" : `Tiles ${n}`, kind, depth: 100, visible: true, locked: false, tileset: project.tilesets[0]?.id ?? null, tiles: {} }
          : { id, name: `Background ${n}`, kind, depth: deepest + 100, visible: true, locked: false, color: null, sprite: null, mode: "tile", hspeed: 0, vspeed: 0, parallax: 0 };
    setRoom((r) => void r.layers.push(layer));
    if (kind === "tiles") setLayerId(id);
    setOpen(id);
  };
  /** Swaps a layer's depth with its neighbour's in the list (front to back). */
  const shift = (id: string, by: -1 | 1) => {
    const i = layers.findIndex((l) => l.id === id), j = i + by;
    const a = layers[i], b = layers[j];
    if (!a || !b) return;
    setRoom((r) => {
      const la = r.layers.find((l) => l.id === a.id)!, lb = r.layers.find((l) => l.id === b.id)!;
      // Equal depths can't be swapped into an order; nudge them apart first.
      const da = la.depth, db = lb.depth === la.depth ? la.depth + by : lb.depth;
      la.depth = db;
      lb.depth = da;
    });
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
                <button className="layer-name" onClick={() => (l.kind !== "background" ? setLayerId(l.id) : setOpen(open === l.id ? null : l.id))}>
                  {l.name}{" "}
                  <span className="muted small">
                    {l.kind === "instances" ? `${count}` : l.kind === "tiles" ? `${Object.keys(l.tiles).length} tiles` : "background"}
                  </span>
                </button>
                <button className="icon-btn" onClick={() => shift(l.id, -1)} aria-label={`Move ${l.name} forward`} title="Draw in front">
                  ↑
                </button>
                <button className="icon-btn" onClick={() => shift(l.id, 1)} aria-label={`Move ${l.name} back`} title="Draw behind">
                  ↓
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
                  {l.kind === "tiles" && (
                    <>
                      <label className="num">
                        Tileset
                        <select
                          value={l.tileset ?? ""}
                          onChange={(e) => setLayer(l.id, (x) => x.kind === "tiles" && void (x.tileset = e.target.value || null))}
                          aria-label="Tileset"
                          data-testid="layer-tileset"
                        >
                          <option value="">(none)</option>
                          {project.tilesets.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="muted small">
                        Solid tiles collide: place_meeting(x, y, "{l.name}"). Hidden, a layer isn't drawn but still collides — handy for invisible walls.
                      </p>
                      <button className="btn small" onClick={() => confirm(`Clear every tile on ${l.name}?`) && setLayer(l.id, (x) => x.kind === "tiles" && void (x.tiles = {}))}>
                        Clear tiles
                      </button>
                    </>
                  )}
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
        <button className="btn small" onClick={() => add("tiles")} data-testid="add-tile-layer">
          {Icon.plus()} Tile layer
        </button>
        <button className="btn small" onClick={() => add("background")} data-testid="add-background-layer">
          {Icon.plus()} Background layer
        </button>
      </div>
    </div>
  );
}

/**
 * One instance's creation code: Python, or blocks (codeMode.tsx's rules).
 * Blocks don't fit in this side panel, so they open in a large dialog; the
 * panel shows the Python they make.
 */
function CreationCode({ roomId, inst, focus }: { roomId: string; inst: RoomInstance; focus: { line: number; nonce: number } | null }) {
  const { project, mutate } = useProjectApi();
  const projectRef = useRef(project);
  projectRef.current = project;
  const [open, setOpen] = useState(false);
  const objectName = find(project, "objects", inst.object)?.name ?? "this instance";
  // Code has its own undo, in its editor (history.ts).
  const edit = (recipe: (i: RoomInstance) => void) =>
    mutate(
      (p) => {
        const i = find(p, "rooms", roomId)?.instances.find((x) => x.id === inst.id);
        if (i) recipe(i);
      },
      { history: "skip" },
    );
  const convert = () => confirmToPython(inst, "this creation code") && (edit(toPython), setOpen(false));
  // An error in blocks creation code: open them, with the block selected.
  useEffect(() => {
    if (focus && isBlocks(inst)) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return (
    <div className="creation-code">
      <div className="signature">
        Creation code — runs for this one instance, after its Create event. <code>self</code> is this instance.
      </div>
      <ModeTabs
        holder={inst}
        testPrefix="creation"
        onBlocks={() => {
          edit((i) => toBlocks(i, "creation"));
          setOpen(true);
        }}
        onPython={convert}
      />
      {isBlocks(inst) ? (
        <>
          <CodeEditor docKey={`inst-blocks:${inst.id}`} value={inst.code} readOnly testId="creation-code-python" errorLine={focus} />
          <div className="row">
            <button className="btn small" onClick={() => setOpen(true)} data-testid="edit-creation-blocks">
              Edit blocks
            </button>
          </div>
        </>
      ) : (
        <CodeEditor
          docKey={`inst:${inst.id}`}
          value={inst.code}
          onChange={(code) => edit((i) => void (i.code = code))}
          names={() => projectNames(project)}
          errorLine={focus}
          testId="creation-code"
        />
      )}
      {open && isBlocks(inst) && (
        <div className="blocks-dialog" role="dialog" aria-label={`Creation code for ${objectName}`} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="blocks-dialog-head">
            <span>
              Creation code for <b>{objectName}</b> at ({inst.x}, {inst.y})
            </span>
            <button className="btn small" onClick={() => setOpen(false)} data-testid="close-creation-blocks">
              Done
            </button>
          </div>
          <div className="blocks-dialog-body">
            <Suspense fallback={<div className="empty-pane">Loading blocks…</div>}>
              <BlocksEditor
                key={inst.id}
                eventId={`inst:${inst.id}`}
                kind="creation"
                signature={`creation code: self is this ${objectName}`}
                state={inst.blocks ?? emptyBlocks("creation")}
                code={inst.code}
                onChange={(blocks, code) =>
                  edit((i) => {
                    i.blocks = blocks;
                    i.code = code;
                  })
                }
                names={() => blockNamesFor(projectRef.current)}
                onConvert={convert}
                errorLine={focus}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
