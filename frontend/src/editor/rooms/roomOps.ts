/**
 * The room editor's geometry and edits, as plain functions: where an
 * instance is on screen (turned and scaled, about its sprite's origin, the
 * way the game draws it), what is under the pointer, what a dragged box
 * catches, snapping, copying and pasting.
 *
 * Kept free of React and canvases so the rules are tested on their own.
 */
import { find, newId, type Project, type RoomInstance, type RoomResource, type SpriteResource } from "../../store/project";

const DEG = Math.PI / 180;

/**
 * Snaps to the grid's lines (the instance's x, y lands on a grid corner).
 * The tiny allowance matters: a pointer exactly on a line arrives as
 * 95.99999 after the zoom arithmetic, and a plain floor put the instance a
 * whole row up from where the student clicked.
 */
export function snap(v: number, grid: number): number {
  return grid > 0 ? Math.floor(v / grid + 1e-6) * grid : Math.round(v);
}

/** The size an instance shows at in the editor: its sprite, or a 32 × 32 stand-in. */
export function shapeOf(sprite: SpriteResource | undefined) {
  return sprite
    ? { w: sprite.width, h: sprite.height, ox: sprite.originX, oy: sprite.originY }
    : { w: 32, h: 32, ox: 0, oy: 0 };
}

/** An instance's four corners in the room, as the game would draw it. */
export function corners(inst: RoomInstance, sprite: SpriteResource | undefined, dx = 0, dy = 0): [number, number][] {
  const { w, h, ox, oy } = shapeOf(sprite);
  // The renderer's transform: scale about the origin, then turn by -angle (y points down).
  const c = Math.cos(-inst.angle * DEG), s = Math.sin(-inst.angle * DEG);
  return ([[0, 0], [w, 0], [w, h], [0, h]] as const).map(([px, py]) => {
    const lx = (px - ox) * inst.scaleX, ly = (py - oy) * inst.scaleY;
    return [inst.x + dx + lx * c - ly * s, inst.y + dy + lx * s + ly * c];
  });
}

/** Is the room point (x, y) on the instance (inside its turned, scaled picture)? */
export function contains(inst: RoomInstance, sprite: SpriteResource | undefined, x: number, y: number): boolean {
  const { w, h, ox, oy } = shapeOf(sprite);
  if (!inst.scaleX || !inst.scaleY) return false;
  const c = Math.cos(inst.angle * DEG), s = Math.sin(inst.angle * DEG);
  const dx = x - inst.x, dy = y - inst.y;
  const lx = (dx * c - dy * s) / inst.scaleX + ox;
  const ly = (dx * s + dy * c) / inst.scaleY + oy;
  return lx >= 0 && lx < w && ly >= 0 && ly < h;
}

/** Layers the student can see and isn't protecting: the only ones the editor touches. */
function editable(room: RoomResource): Set<string> {
  return new Set(room.layers.filter((l) => l.kind === "instances" && l.visible && !l.locked).map((l) => l.id));
}

export function visibleLayers(room: RoomResource): Set<string> {
  return new Set(room.layers.filter((l) => l.kind === "instances" && l.visible).map((l) => l.id));
}

/**
 * Instances in the order the game draws them: highest object depth first,
 * so the last drawn is on top. Equal depths keep room order.
 */
export function drawOrder(project: Project, room: RoomResource): RoomInstance[] {
  const depth = (i: RoomInstance) => find(project, "objects", i.object)?.depth ?? 0;
  return room.instances.map((inst, n) => ({ inst, n })).sort((a, b) => depth(b.inst) - depth(a.inst) || a.n - b.n).map((x) => x.inst);
}

const spriteFor = (project: Project, inst: RoomInstance) => find(project, "sprites", find(project, "objects", inst.object)?.sprite);

/** The topmost editable instance under (x, y), or null. */
export function hitTest(project: Project, room: RoomResource, x: number, y: number): RoomInstance | null {
  const ok = editable(room);
  const order = drawOrder(project, room);
  for (let i = order.length - 1; i >= 0; i--) {
    const inst = order[i]!;
    if (ok.has(inst.layer) && contains(inst, spriteFor(project, inst), x, y)) return inst;
  }
  return null;
}

/** Editable instances whose picture lies wholly inside the dragged box. */
export function inBox(project: Project, room: RoomResource, x0: number, y0: number, x1: number, y1: number): RoomInstance[] {
  const left = Math.min(x0, x1), right = Math.max(x0, x1), top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  const ok = editable(room);
  return room.instances.filter(
    (inst) => ok.has(inst.layer) && corners(inst, spriteFor(project, inst)).every(([x, y]) => x >= left && x <= right && y >= top && y <= bottom),
  );
}

/** Is there already one of this object exactly here? (Painting doesn't stack copies.) */
export function occupied(room: RoomResource, object: string, x: number, y: number): boolean {
  return room.instances.some((i) => i.object === object && i.x === x && i.y === y);
}

/** What Copy keeps: the instances, with positions relative to the first. */
export interface Clip {
  items: Omit<RoomInstance, "id" | "layer">[];
}

export function copy(instances: RoomInstance[]): Clip | null {
  if (!instances.length) return null;
  const x0 = Math.min(...instances.map((i) => i.x)), y0 = Math.min(...instances.map((i) => i.y));
  return { items: instances.map(({ id: _id, layer: _layer, ...rest }) => ({ ...rest, x: rest.x - x0, y: rest.y - y0 })) };
}

/** Pasted copies, new ids, their top-left at (x, y), on `layer`. Objects deleted since copying are left out. */
export function paste(project: Project, clip: Clip, x: number, y: number, layer: string): RoomInstance[] {
  return clip.items.filter((i) => find(project, "objects", i.object)).map((i) => ({ ...i, id: newId(), layer, x: i.x + x, y: i.y + y }));
}

/** The view rectangle the editor outlines: centred on what the camera follows, as the game would start. */
export function cameraPreview(room: RoomResource): { x: number; y: number; w: number; h: number } | null {
  const c = room.camera;
  if (!c.enabled) return null;
  const target = c.follow ? room.instances.find((i) => i.object === c.follow) : undefined;
  let x = target ? target.x - c.width / 2 : 0, y = target ? target.y - c.height / 2 : 0;
  x = Math.max(0, Math.min(x, room.width - c.width));
  y = Math.max(0, Math.min(y, room.height - c.height));
  return { x, y, w: c.width, h: c.height };
}
