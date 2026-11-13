/**
 * One sprite: its picture, to draw on or with the origin and collision mask
 * drawn over it, its frames, its animation speed, and the mask's kind.
 *
 * The paint tools (Pencil, Eraser, Fill, Pick) draw on the frame shown. Each
 * stroke is saved as it ends: a new picture for that frame (pictures never
 * change once stored, see put_asset), so Undo puts the old one back and the
 * game sees the drawing the next time Play is pressed. With Origin, clicking
 * the picture sets the origin; with Mask, dragging draws a box or a circle.
 * An automatic or exact mask is refitted whenever the frames change — a
 * stroke included; one drawn by hand stays as drawn.
 */
import { useEffect, useRef, useState } from "react";
import { blankPicture } from "../../store/imageTools";
import { find, newId, type SpriteMask, type SpriteResource } from "../../store/project";
import { refitMask } from "../../store/spriteOps";
import {
  box as drawBox,
  CLEAR,
  clearBox,
  clip,
  colorsIn,
  copyPixels,
  crop,
  dab,
  ellipse,
  fill,
  fromHex,
  getPixel,
  line,
  PALETTE,
  spanOf,
  stamp,
  strip,
  toHex,
  transformed,
  transformFrame,
  type Box,
  type Pixels,
  type Transform,
} from "./paintOps";
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

type Tool = "pencil" | "eraser" | "fill" | "picker" | "line" | "rect" | "ellipse" | "select" | "origin" | "mask";
const PAINT_TOOLS: { tool: Tool; label: string; hint: string }[] = [
  { tool: "pencil", label: "Pencil", hint: "Draw with the colour. The right mouse button erases." },
  { tool: "eraser", label: "Eraser", hint: "Make pixels clear again." },
  { tool: "fill", label: "Fill", hint: "Fill the area of one colour you click." },
  { tool: "picker", label: "Pick colour", hint: "Click a pixel to draw with its colour." },
  { tool: "line", label: "Line", hint: "Drag a straight line." },
  { tool: "rect", label: "Box", hint: "Drag a box. Hold Shift for a square." },
  { tool: "ellipse", label: "Circle", hint: "Drag a circle or an oval. Hold Shift for a circle." },
  {
    tool: "select",
    label: "Select",
    hint: "Drag a box to select. Drag inside it to move it; the arrow keys nudge it. Ctrl+C copies, Ctrl+X cuts, Ctrl+V pastes, Delete clears it, Enter puts it down.",
  },
];
const paints = (t: Tool) => t !== "origin" && t !== "mask";
const SHAPES = new Set<Tool>(["line", "rect", "ellipse"]);

/**
 * What Copy took, for Paste: kept for the whole page, so a piece of one
 * sprite can be pasted into another. Not the computer's clipboard: a picture
 * there, pasted outside a paint tool, makes a new sprite (EditorPage), and
 * copying here would have turned every Ctrl+V into a new sprite.
 */
let clipboard: { px: Pixels; x: number; y: number } | null = null;

/** A picture's pixels, at the sprite's size (a bigger picture is cut, a smaller one sits at the top-left). */
async function pixelsOfBlob(blob: Blob, width?: number, height?: number): Promise<Pixels> {
  const bmp = await createImageBitmap(blob);
  const w = width ?? bmp.width, h = height ?? bmp.height;
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext("2d")!;
  x.drawImage(bmp, 0, 0);
  bmp.close();
  return { width: w, height: h, data: x.getImageData(0, 0, w, h).data };
}

function pngOf(p: Pixels): Promise<Blob> {
  const c = new OffscreenCanvas(p.width, p.height);
  c.getContext("2d")!.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.width, p.height), 0, 0);
  return c.convertToBlob({ type: "image/png" });
}

/** Typing somewhere, where the editor's shortcuts must leave keys alone. */
function typingIn(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.closest) return false;
  return !!el.closest(".cm-editor, .blocks-editor, .sheet-editor, .scene-editor") || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}
/** The largest picture a student may start drawing on: bigger is a painting, not a sprite. */
export const MAX_DRAW_SIDE = 256;

export function SpriteEditor({ spriteId, addFrames, startTool = "origin" }: { spriteId: string; addFrames: () => void; startTool?: Tool }) {
  const { project, assets, mutate, addAssets } = useProjectApi();
  const sprite = find(project, "sprites", spriteId);
  const urls = useFrameUrls(sprite, assets);
  const [frame, setFrame] = useState(0);
  const [tool, setTool] = useState<Tool>(startTool);
  const [playing, setPlaying] = useState(!paints(startTool));
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [color, setColor] = useState("#e8414f");
  const [brush, setBrush] = useState(1);
  const [zoomPick, setZoomPick] = useState<number | null>(null);
  const [grid, setGrid] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [own, setOwn] = useState<string[]>([]);
  const [filled, setFilled] = useState(false);
  const [onion, setOnion] = useState(false);
  const [everyFrame, setEveryFrame] = useState(false);
  /** The selection, in the sprite's pixels: shown as marching ants. While a piece is lifted, it's that piece's box. */
  const [sel, setSel] = useState<Box | null>(null);
  const [hasClip, setHasClip] = useState(clipboard !== null);
  /** The picture on the canvas: its frame's, once loaded (tests wait for it rather than read the last frame's pixels). */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const fps = sprite?.fps ?? project.settings.stepsPerSecond;

  // What a stroke's save, which finishes later, must read: the project and
  // pictures as they are then, not as they were when the stroke began.
  const projectRef = useRef(project);
  projectRef.current = project;
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The frame's pixels as drawn so far: the canvas shows these. */
  const pix = useRef<Pixels | null>(null);
  /** The picture `pix` was loaded from or saved as; another one in its frame (an undo) is loaded afresh. */
  const shownId = useRef<string | null>(null);
  const stroke = useRef<{ x: number; y: number; changed: boolean; erase: boolean } | null>(null);
  const saving = useRef(Promise.resolve());
  const curRef = useRef(0);
  /** A shape being dragged: drawn on a copy of pix until it's let go. */
  const shape = useRef<{ x0: number; y0: number; erase: boolean } | null>(null);
  const preview = useRef<Pixels | null>(null);
  /**
   * A selected piece lifted off the picture (to move, turn or flip it, or
   * pasted): drawn over pix where it is, put down into pix by `anchor`.
   * `dirty` once it has moved or changed, so putting it back untouched saves
   * nothing.
   */
  const float = useRef<{ px: Pixels; x: number; y: number; dirty: boolean } | null>(null);
  const selDrag = useRef<{ x0: number; y0: number; moved: boolean } | null>(null);
  /**
   * The frame list as this editor last knew it, and pictures it made that
   * may not be in `assets` yet: a frame button pressed while a stroke was
   * still saving used the list from before it, and the stroke was lost.
   */
  const framesRef = useRef<string[]>([]);
  if (sprite) framesRef.current = sprite.frames;
  const recent = useRef(new Map<string, Blob>());
  const blobOf = (id: string) => assetsRef.current.get(id) ?? recent.current.get(id);
  const moveDrag = useRef<{ dx: number; dy: number } | null>(null);

  const n = sprite?.frames.length ?? 0;
  const cur = Math.min(frame, Math.max(0, n - 1));
  curRef.current = cur;
  const frameId = sprite?.frames[cur] ?? null;
  const width = sprite?.width ?? 1, height = sprite?.height ?? 1;

  useEffect(() => {
    if (!sprite || sprite.frames.length < 2 || !playing || paints(tool)) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % sprite.frames.length), 1000 / Math.max(1, Math.min(60, fps)));
    return () => clearInterval(t);
  }, [sprite, playing, fps, tool]);

  /** Puts on the canvas: pix (or the shape being dragged), with a lifted piece over it. */
  const show = () => {
    const c = canvas.current;
    let p = preview.current ?? pix.current;
    if (!c || !p) return;
    const f = float.current;
    if (f) {
      p = copyPixels(p);
      stamp(p, f.px, f.x, f.y);
    }
    c.getContext("2d")!.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.width, p.height), 0, 0);
  };

  // The frame's picture into `pix`: when another frame is shown, or its
  // picture was changed from outside (Undo, Redo) — never again for the one
  // this editor just saved, which would throw away a stroke drawn meanwhile.
  useEffect(() => {
    if (!frameId || frameId === shownId.current) return;
    const blob = assets.get(frameId);
    if (!blob) return; // still arriving; this runs again when it has
    let gone = false;
    void (async () => {
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(width, height);
      const x = c.getContext("2d")!;
      x.drawImage(bmp, 0, 0);
      bmp.close();
      if (gone) return;
      const d = x.getImageData(0, 0, width, height);
      pix.current = { width, height, data: d.data };
      shownId.current = frameId;
      // A piece lifted off the old pixels belongs to them: an Undo while it
      // was lifted takes it away with the rest.
      float.current = null;
      setSel(null);
      setLoadedId(frameId);
      show();
      setOwn(colorsIn(pix.current));
    })();
    return () => void (gone = true);
  }, [frameId, assets, width, height]);

  /**
   * Saves the frame as drawn: a new picture in place of the old one, the
   * mask refitted, one undo step per stroke. Saves run one after another,
   * so a quick second stroke can't land before the first.
   */
  const save = (index: number) => {
    if (!pix.current || !sprite) return;
    const snap = copyPixels(pix.current);
    const sid = sprite.id;
    saving.current = saving.current
      .then(async () => {
        const c = new OffscreenCanvas(snap.width, snap.height);
        c.getContext("2d")!.putImageData(new ImageData(snap.data as Uint8ClampedArray<ArrayBuffer>, snap.width, snap.height), 0, 0);
        const blob = await c.convertToBlob({ type: "image/png" });
        const s0 = find(projectRef.current, "sprites", sid);
        if (!s0 || index >= framesRef.current.length) return;
        const id = newId();
        recent.current.set(id, blob);
        const frames = framesRef.current.map((f, i) => (i === index ? id : f));
        const blobs = frames.map((f) => (f === id ? blob : blobOf(f))).filter((b): b is Blob => !!b);
        const mask = await refitMask(s0.mask, blobs, s0.width, s0.height);
        await addAssets(new Map([[id, blob]]));
        if (curRef.current === index) shownId.current = id;
        framesRef.current = framesRef.current.map((f, i) => (i === index ? id : f));
        mutate(
          (p) => {
            const s = find(p, "sprites", sid);
            if (!s || index >= s.frames.length) return;
            s.frames[index] = id;
            if (mask) s.mask = mask;
          },
          // A group of its own: every stroke is one step to undo.
          { label: `draw on ${s0.name}`, group: `paint:${id}` },
        );
        setOwn(colorsIn(snap));
      })
      .catch((e) => console.error("The drawing wasn't saved:", e));
  };

  /** Puts a lifted piece down into the picture where it is, and saves if it moved or changed. */
  const anchor = () => {
    const f = float.current, p = pix.current;
    if (!f || !p) return;
    float.current = null;
    stamp(p, f.px, f.x, f.y);
    setSel(clip({ x: f.x, y: f.y, w: f.px.width, h: f.px.height }, p.width, p.height));
    show();
    if (f.dirty) save(curRef.current);
  };
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  // Closing the tab puts a lifted piece down rather than losing it.
  useEffect(() => () => anchorRef.current(), []);

  // Copy, cut, paste and the rest from the keyboard, while this editor is
  // shown. Set after the handlers below, read through refs so the listeners
  // are added once.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const pasteRef = useRef<(e: ClipboardEvent) => void>(() => {});
  useEffect(() => {
    const k = (e: KeyboardEvent) => keyRef.current(e);
    const v = (e: ClipboardEvent) => pasteRef.current(e);
    window.addEventListener("keydown", k);
    // Capturing, so a picture pasted while drawing is taken here before
    // EditorPage's listener makes it a new sprite (it skips one already taken).
    window.addEventListener("paste", v, true);
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("paste", v, true);
    };
  }, []);

  if (!sprite) return <div className="empty-pane">This sprite was deleted.</div>;
  // One label for the sprite's settings: typing "24" into a box is one undo step.
  const set = (recipe: (s: SpriteResource) => void) => mutate((p) => recipe(find(p, "sprites", spriteId)!), { label: "change the sprite" });
  const fitZoom = Math.max(1, Math.min(24, Math.floor(384 / Math.max(sprite.width, sprite.height))));
  const zoom = zoomPick ?? fitZoom;
  const mask: SpriteMask = sprite.mask ?? { kind: "auto", left: 0, top: 0, right: sprite.width, bottom: sprite.height };
  const usedBy = project.objects.filter((o) => o.sprite === sprite.id).map((o) => o.name);

  /**
   * Changes the frame list, and refits an automatic or exact mask to it.
   * After any lifted piece is put down and every stroke saved, from the
   * newest list: the edit is a function of it, not a list worked out before.
   */
  const changeFrames = async (edit: (frames: string[]) => string[], added?: Map<string, Blob>) => {
    anchor();
    await saving.current;
    added?.forEach((b, id) => recent.current.set(id, b));
    const frames = edit(framesRef.current);
    const blobs = frames.map((id) => blobOf(id)).filter((b): b is Blob => !!b);
    const refit = await refitMask(sprite.mask, blobs, sprite.width, sprite.height);
    framesRef.current = frames;
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

  const ready = () => !!pix.current && shownId.current === frameId;

  /** Lifts the selected pixels off the picture, to move or change them. */
  const lift = () => {
    const p = pix.current;
    if (float.current || !sel || !p) return;
    float.current = { px: crop(p, sel), x: sel.x, y: sel.y, dirty: false };
    clearBox(p, sel);
  };

  const pickTool = (t: Tool) => {
    anchor();
    if (t !== "select") setSel(null);
    setTool(t);
    if (paints(t)) setPlaying(false);
  };

  const goFrame = (i: number) => {
    anchor();
    setSel(null);
    setFrame(i);
  };

  /** What Copy and Cut take: the lifted piece, the selection, or (nothing selected) the whole frame. */
  const take = (): { px: Pixels; x: number; y: number } | null => {
    const p = pix.current;
    if (!p || !ready()) return null;
    const f = float.current;
    if (f) return { px: copyPixels(f.px), x: f.x, y: f.y };
    const b = sel ?? { x: 0, y: 0, w: p.width, h: p.height };
    return { px: crop(p, b), x: b.x, y: b.y };
  };
  const copy = () => {
    const got = take();
    if (!got) return;
    clipboard = got;
    setHasClip(true);
  };
  /** Clears the selection (or the whole frame) — Cut after copying it, Delete without. */
  const clearSelected = () => {
    const p = pix.current;
    if (!p || !ready()) return;
    if (float.current) float.current = null; // its hole is already in pix
    else clearBox(p, sel ?? { x: 0, y: 0, w: p.width, h: p.height });
    setSel(null);
    show();
    save(cur);
  };
  const cut = () => {
    copy();
    clearSelected();
  };
  /** Puts a picture down as a lifted piece, to drag where it goes: at the place it was copied from if that's on the picture, else the top-left. */
  const pasteAt = (px: Pixels, x: number, y: number) => {
    const p = pix.current;
    if (!p || !ready()) return;
    anchor();
    const fx = Math.max(0, Math.min(x, p.width - px.width)), fy = Math.max(0, Math.min(y, p.height - px.height));
    float.current = { px: copyPixels(px), x: fx, y: fy, dirty: true };
    setSel({ x: fx, y: fy, w: px.width, h: px.height });
    setTool("select");
    setPlaying(false);
    show();
  };
  const paste = () => clipboard && pasteAt(clipboard.px, clipboard.x, clipboard.y);

  /**
   * Flips or turns the selection, or with nothing selected the whole frame,
   * or every frame (a walk the other way round).
   */
  const transform = async (how: Transform) => {
    const p = pix.current;
    if (!p || !ready()) return;
    if (sel || float.current) {
      lift();
      const f = float.current!;
      const t = transformed(f.px, how);
      // Turned about its middle, as far as whole pixels allow.
      float.current = { px: t, x: f.x + Math.floor((f.px.width - t.width) / 2), y: f.y + Math.floor((f.px.height - t.height) / 2), dirty: true };
      setSel({ x: float.current.x, y: float.current.y, w: t.width, h: t.height });
      show();
      return;
    }
    if (!everyFrame || n < 2) {
      pix.current = transformFrame(p, how);
      show();
      save(cur);
      return;
    }
    await saving.current;
    const added = new Map<string, Blob>();
    const frames: string[] = [];
    for (const id of framesRef.current) {
      const blob = blobOf(id);
      if (!blob) return; // a picture still arriving: change none rather than some
      const nid = newId();
      added.set(nid, await pngOf(transformFrame(await pixelsOfBlob(blob, sprite.width, sprite.height), how)));
      frames.push(nid);
    }
    await addAssets(added);
    await changeFrames(() => frames, added);
  };

  /** The frames side by side as one picture, to keep or to use elsewhere: Import cuts it back into the same frames with Equal frames. */
  const saveStrip = async () => {
    const pics = await Promise.all(sprite.frames.map((id) => assets.get(id)).filter((b): b is Blob => !!b).map((b) => pixelsOfBlob(b, sprite.width, sprite.height)));
    const url = URL.createObjectURL(await pngOf(strip(pics)));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sprite.name}_strip${pics.length}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  /** Moves the selection a pixel (the arrow keys). */
  const nudge = (dx: number, dy: number) => {
    lift();
    const f = float.current;
    if (!f) return;
    float.current = { ...f, x: f.x + dx, y: f.y + dy, dirty: true };
    setSel({ x: f.x + dx, y: f.y + dy, w: f.px.width, h: f.px.height });
    show();
  };

  keyRef.current = (e) => {
    if (typingIn(e.target) || !paints(tool)) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    const selected = !!(sel || float.current);
    if (mod && k === "c") (e.preventDefault(), copy());
    else if (mod && k === "x") (e.preventDefault(), cut());
    // Only with something copied here: otherwise the paste event comes, and
    // may bring a picture from another program.
    else if (mod && k === "v" && clipboard) (e.preventDefault(), paste());
    else if (mod && k === "a") (e.preventDefault(), pickTool("select"), setSel({ x: 0, y: 0, w: width, h: height }));
    else if (mod) return;
    else if ((e.key === "Delete" || e.key === "Backspace") && selected) (e.preventDefault(), clearSelected());
    else if ((e.key === "Enter" || e.key === "Escape") && selected) {
      e.preventDefault();
      anchor();
      if (e.key === "Escape") setSel(null);
    } else if (tool === "select" && selected && e.key.startsWith("Arrow")) {
      e.preventDefault();
      nudge(e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0);
    }
  };
  pasteRef.current = (e) => {
    if (e.defaultPrevented || typingIn(e.target) || !paints(tool)) return;
    const file = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    void pixelsOfBlob(file).then((px) => pasteAt(px, 0, 0));
  };

  /** A new frame after the one shown: clear, or a copy of it to change a little (the way an animation is drawn). */
  const addFrame = async (copy: boolean) => {
    anchor();
    // A copy of what's on screen: the frame as drawn, even a stroke still saving.
    const blob = copy && pix.current && ready() ? await pngOf(pix.current) : await blankPicture(sprite.width, sprite.height);
    const id = newId();
    const added = new Map([[id, blob]]);
    await addAssets(added);
    const at = cur + 1;
    await changeFrames((f) => [...f.slice(0, at), id, ...f.slice(at)], added);
    setPlaying(false);
    goFrame(at);
  };

  /** The point between pixels nearest the pointer: origins and masks sit on pixel edges. */
  const at = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) / zoom), y: Math.round((e.clientY - r.top) / zoom) };
  };
  /** The pixel under the pointer: what a paint tool paints. */
  const cell = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) };
  };
  const ink = () => fromHex(color);

  const paintDown = (e: React.PointerEvent) => {
    const p = pix.current;
    // Not until the frame shown is the one loaded: a stroke on the last
    // frame's pixels would be saved over this one.
    if (!p || shownId.current !== frameId) return;
    const c = cell(e);
    if (tool === "select") {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const inside = sel && c.x >= sel.x && c.y >= sel.y && c.x < sel.x + sel.w && c.y < sel.y + sel.h;
      if (inside) {
        lift();
        const f = float.current!;
        moveDrag.current = { dx: c.x - f.x, dy: c.y - f.y };
        return;
      }
      anchor();
      selDrag.current = { x0: c.x, y0: c.y, moved: false };
      setSel(clip(spanOf(c.x, c.y, c.x, c.y), p.width, p.height));
      return;
    }
    if (SHAPES.has(tool)) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      shape.current = { x0: c.x, y0: c.y, erase: e.button === 2 };
      drawShape(c.x, c.y, e.shiftKey);
      return;
    }
    if (tool === "picker") {
      const got = getPixel(p, c.x, c.y);
      // A clear pixel has no colour to take; picking one, the tool stays.
      if (got && got[3] > 0) {
        setColor(toHex(got));
        setTool("pencil");
      }
      return;
    }
    if (tool === "fill") {
      if (fill(p, c.x, c.y, e.button === 2 ? CLEAR : ink()) > 0) (show(), save(cur));
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const erase = tool === "eraser" || e.button === 2;
    const changed = dab(p, c.x, c.y, erase ? CLEAR : ink(), brush);
    stroke.current = { ...c, changed, erase };
    if (changed) show();
  };

  /** The shape being dragged, from where it started to x, y, on a fresh copy of pix. */
  const drawShape = (x: number, y: number, square: boolean) => {
    const st = shape.current, p = pix.current;
    if (!st || !p) return;
    const q = copyPixels(p);
    const c = st.erase ? CLEAR : ink();
    if (tool === "line") line(q, st.x0, st.y0, x, y, c, brush);
    else if (tool === "rect") drawBox(q, spanOf(st.x0, st.y0, x, y, square), c, filled, brush);
    else ellipse(q, spanOf(st.x0, st.y0, x, y, square), c, filled);
    preview.current = q;
    show();
  };

  const down = (e: React.PointerEvent) => {
    if (paints(tool)) return paintDown(e);
    if (e.button !== 0) return;
    const p = at(e);
    if (tool === "origin") return set((s) => ((s.originX = p.x), (s.originY = p.y)));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const move = (e: React.PointerEvent) => {
    if (paints(tool)) {
      const c = cell(e);
      setHover(c);
      if (shape.current) return drawShape(c.x, c.y, e.shiftKey);
      const p = pix.current;
      if (moveDrag.current && float.current && p) {
        const f = float.current;
        const x = c.x - moveDrag.current.dx, y = c.y - moveDrag.current.dy;
        if (x !== f.x || y !== f.y) {
          float.current = { ...f, x, y, dirty: true };
          setSel({ x, y, w: f.px.width, h: f.px.height });
          show();
        }
        return;
      }
      if (selDrag.current && p) {
        const d = selDrag.current;
        if (c.x !== d.x0 || c.y !== d.y0) d.moved = true;
        setSel(clip(spanOf(d.x0, d.y0, c.x, c.y), p.width, p.height));
        return;
      }
      const st = stroke.current;
      if (st && pix.current && (c.x !== st.x || c.y !== st.y)) {
        const changed = line(pix.current, st.x, st.y, c.x, c.y, st.erase ? CLEAR : ink(), brush);
        stroke.current = { ...st, ...c, changed: st.changed || changed };
        if (changed) show();
      }
      return;
    }
    if (!drag) return;
    const p = at(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const up = () => {
    if (shape.current) {
      shape.current = null;
      if (preview.current) pix.current = preview.current;
      preview.current = null;
      show();
      save(cur);
      return;
    }
    if (moveDrag.current) {
      moveDrag.current = null;
      return;
    }
    if (selDrag.current) {
      // A click without a drag lets go of the selection.
      if (!selDrag.current.moved) setSel(null);
      selDrag.current = null;
      return;
    }
    if (stroke.current) {
      const st = stroke.current;
      stroke.current = null;
      if (st.changed) save(cur);
      return;
    }
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
        <div className="row sprite-tools">
          <div className="seg small" role="radiogroup" aria-label="Tool" data-tutorial="sprite-paint-tools">
            {PAINT_TOOLS.map((t) => (
              <button key={t.tool} role="radio" aria-checked={tool === t.tool} className={tool === t.tool ? "on" : ""} onClick={() => pickTool(t.tool)} title={t.hint} data-testid={`paint-${t.tool}`}>
                {t.label}
              </button>
            ))}
            <button role="radio" aria-checked={tool === "origin"} className={tool === "origin" ? "on" : ""} onClick={() => pickTool("origin")} data-tutorial="sprite-origin-tool">
              Origin
            </button>
            <button role="radio" aria-checked={tool === "mask"} className={tool === "mask" ? "on" : ""} onClick={() => pickTool("mask")} data-tutorial="sprite-mask-tool">
              Mask
            </button>
          </div>
          <span className="zoom-buttons">
            <button className="btn small" onClick={() => setZoomPick(Math.max(1, zoom - (zoom > 8 ? 2 : 1)))} disabled={zoom <= 1} title="Zoom out" aria-label="Zoom out">
              −
            </button>
            <span className="muted small">{zoom}×</span>
            <button className="btn small" onClick={() => setZoomPick(Math.min(32, zoom + (zoom >= 8 ? 2 : 1)))} disabled={zoom >= 32} title="Zoom in" aria-label="Zoom in">
              +
            </button>
          </span>
        </div>
        {paints(tool) && (
          <div className="paint-bar" data-tutorial="sprite-colors">
            <label className="paint-color" title="Choose any colour">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour" data-testid="paint-color" />
            </label>
            <div className="swatches" role="group" aria-label="Colours">
              {PALETTE.map((c) => (
                <button key={c} className={`swatch ${c === color ? "on" : ""}`} style={{ background: c }} onClick={() => (setColor(c), tool === "eraser" || tool === "picker" || tool === "select" ? pickTool("pencil") : null)} aria-label={c} />
              ))}
            </div>
            {own.length > 0 && (
              <div className="swatches own" role="group" aria-label="Colours in this picture">
                <span className="muted small">In this picture:</span>
                {own.map((c) => (
                  <button key={c} className={`swatch ${c === color ? "on" : ""}`} style={{ background: c }} onClick={() => (setColor(c), tool === "eraser" || tool === "picker" || tool === "select" ? pickTool("pencil") : null)} aria-label={c} />
                ))}
              </div>
            )}
            {(tool === "rect" || tool === "ellipse") && (
              <label className="small">
                <input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} data-testid="paint-filled" /> Filled
              </label>
            )}
            {(tool === "pencil" || tool === "eraser" || tool === "line" || tool === "rect") && (
              <div className="seg small" role="radiogroup" aria-label="Brush size">
                {[1, 2, 3, 4].map((b) => (
                  <button key={b} role="radio" aria-checked={brush === b} className={brush === b ? "on" : ""} onClick={() => setBrush(b)} title={`${b} × ${b} pixels`}>
                    {b}
                  </button>
                ))}
              </div>
            )}
            <label className="small">
              <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grid
            </label>
            {n > 1 && (
              <label className="small" title="The frame before this one, faintly under it: to line up the next step of an animation">
                <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} data-testid="paint-onion" /> Show last frame
              </label>
            )}
          </div>
        )}
        {paints(tool) && (
          <div className="row edit-bar" data-tutorial="sprite-edit-tools">
            <button className="btn small" onClick={copy} title="Copy the selection (or the whole frame), Ctrl+C" data-testid="paint-copy">
              Copy
            </button>
            <button className="btn small" onClick={cut} title="Copy it and clear it, Ctrl+X" data-testid="paint-cut">
              Cut
            </button>
            <button className="btn small" onClick={paste} disabled={!hasClip} title="Paste, Ctrl+V: then drag it where it goes" data-testid="paint-paste">
              Paste
            </button>
            <span className="sep" />
            <button className="btn small" onClick={() => void transform("flipH")} title="Flip left to right" data-testid="paint-flipH">
              Flip ↔
            </button>
            <button className="btn small" onClick={() => void transform("flipV")} title="Flip upside down" data-testid="paint-flipV">
              Flip ↕
            </button>
            <button className="btn small" onClick={() => void transform("rotateCCW")} title="Turn a quarter to the left" data-testid="paint-rotateCCW">
              Turn ⟲
            </button>
            <button className="btn small" onClick={() => void transform("rotateCW")} title="Turn a quarter to the right" data-testid="paint-rotateCW">
              Turn ⟳
            </button>
            {n > 1 && !sel && (
              <label className="small" title="Flip or turn every frame of the sprite, not only this one">
                <input type="checkbox" checked={everyFrame} onChange={(e) => setEveryFrame(e.target.checked)} data-testid="paint-every-frame" /> Every frame
              </label>
            )}
            <span className="muted small" data-testid="paint-target">
              {sel ? "Acts on the selection." : everyFrame && n > 1 ? "Acts on every frame." : "Acts on this frame."}
              {!sel && sprite.width !== sprite.height ? " A frame that isn't square loses what turns off its edges." : ""}
            </span>
          </div>
        )}
        <div
          className={`checker checker-bg tool-${tool}`}
          // While drawing, a checker square is one pixel: a 16 px checker under 12 px pixels made it hard to count them.
          style={{ width: sprite.width * zoom, height: sprite.height * zoom, ...(paints(tool) ? { backgroundSize: `${zoom * 2}px ${zoom * 2}px`, backgroundPosition: "0 0" } : {}) }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => paints(tool) && e.preventDefault()}
          data-testid="sprite-canvas"
          title={paints(tool) ? PAINT_TOOLS.find((t) => t.tool === tool)!.hint : tool === "origin" ? "Click to set the origin" : mask.kind === "circle" ? "Drag from the middle outward" : "Drag a box"}
        >
          {/* The frame's pixels, drawn from pix: the picture itself, so
              there's nothing to keep in step with an <img> of it. */}
          {paints(tool) && onion && cur > 0 && urls[cur - 1] && <img className="onion" src={urls[cur - 1]} alt="" draggable={false} data-testid="onion" />}
          <canvas ref={canvas} width={sprite.width} height={sprite.height} style={{ width: "100%", height: "100%" }} aria-label={sprite.name} data-testid="sprite-pixels" data-loaded={loadedId === frameId || shownId.current === frameId ? "1" : "0"} />
          {paints(tool) && grid && zoom >= 6 && <div className="pixel-grid" style={{ backgroundSize: `${zoom}px ${zoom}px` }} />}
          {paints(tool) && sel && (
            <svg className="selection" viewBox={`0 0 ${sprite.width} ${sprite.height}`} preserveAspectRatio="none" aria-hidden="true" data-testid="selection">
              <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h} />
            </svg>
          )}
          {paints(tool) && hover && (tool === "pencil" || tool === "eraser") && (
            <div
              className="brush-mark"
              style={{ left: (hover.x - Math.floor((brush - 1) / 2)) * zoom, top: (hover.y - Math.floor((brush - 1) / 2)) * zoom, width: brush * zoom, height: brush * zoom, background: tool === "pencil" ? color : "transparent" }}
            />
          )}
          {!paints(tool) && (
            <>
              <svg className="mask-overlay" viewBox={`0 0 ${sprite.width} ${sprite.height}`} preserveAspectRatio="none" aria-hidden="true">
                {shown.kind === "circle" ? (
                  <circle cx={shown.cx} cy={shown.cy} r={shown.r} />
                ) : (
                  <rect x={shown.left} y={shown.top} width={shown.right - shown.left} height={shown.bottom - shown.top} className={shown.kind === "precise" ? "dashed" : ""} />
                )}
              </svg>
              <span className="origin-mark" style={{ left: sprite.originX * zoom, top: sprite.originY * zoom }} />
            </>
          )}
        </div>
        <div className="frames" data-testid="sprite-frames">
          {urls.map((u, i) => (
            <button key={i} className={`frame ${i === cur ? "on" : ""}`} onClick={() => (goFrame(i), setPlaying(false))} aria-label={`Frame ${i}`}>
              {u && <img src={u} alt="" />}
              <span>{i}</span>
            </button>
          ))}
          <button className="frame add" onClick={addFrames} title="Add frames from a picture" data-testid="add-frames">
            {Icon.plus()}
          </button>
        </div>
        <div className="row frame-actions">
          <button className="btn small" disabled={cur === 0} onClick={() => (void changeFrames((f) => swap(f, cur, cur - 1)), goFrame(cur - 1))}>
            ◀ Move
          </button>
          <button className="btn small" disabled={cur >= n - 1} onClick={() => (void changeFrames((f) => swap(f, cur, cur + 1)), goFrame(cur + 1))}>
            Move ▶
          </button>
          <button className="btn small" onClick={() => void addFrame(false)} title="A clear frame after this one" data-testid="new-frame">
            New frame
          </button>
          <button className="btn small" onClick={() => void addFrame(true)} title="A copy of this frame after it, to change a little" data-testid="copy-frame">
            Copy frame
          </button>
          <button className="btn small" onClick={() => void saveStrip()} title="Save the frames side by side as one PNG picture, to keep or use in another game" data-testid="save-strip">
            Save as strip
          </button>
          <button className="btn small" disabled={n <= 1} onClick={() => (void changeFrames((f) => f.filter((_, i) => i !== cur)), goFrame(Math.max(0, cur - 1)))} data-testid="delete-frame">
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
