import { describe, expect, it } from "vitest";
import { blankProject, newInstance, newObject, type Project, type RoomInstance } from "../../store/project";
import { cameraPreview, contains, copy, drawOrder, hitTest, inBox, occupied, paste, snap } from "./roomOps";

function setup() {
  const p: Project = blankProject("t");
  const box = { id: "box", name: "box", width: 20, height: 10, originX: 0, originY: 0, frames: [] };
  p.sprites.push(box);
  const wall = { ...newObject("Wall"), id: "wall", sprite: "box", depth: 10 };
  const coin = { ...newObject("Coin"), id: "coin", sprite: "box", depth: -10 };
  p.objects.push(wall, coin);
  const room = p.rooms[0]!;
  return { p, room };
}

const put = (room: Project["rooms"][0], object: string, x: number, y: number, extra: Partial<RoomInstance> = {}) => {
  const i = { ...newInstance(room, object, x, y), ...extra };
  room.instances.push(i);
  return i;
};

describe("the room editor's geometry", () => {
  it("snaps to grid lines", () => {
    expect([snap(31, 32), snap(32, 32), snap(-1, 32), snap(7.6, 0)]).toEqual([0, 32, -32, 8]);
    // A click exactly on a line, after zoom arithmetic, is on that line.
    expect(snap(95.99999999, 32)).toBe(96);
  });

  it("finds an instance by its picture, turned and scaled as the game draws it", () => {
    const { p, room } = setup();
    const i = put(room, "wall", 100, 100, { angle: 90, scaleX: 2 });
    // 20 × 10 doubled to 40 × 10, turned 90° counter-clockwise: it now runs up from (100, 100).
    expect(contains(i, p.sprites[0], 105, 70)).toBe(true);
    expect(contains(i, p.sprites[0], 130, 105)).toBe(false);
  });

  it("clicks the one drawn on top, and never a hidden or locked layer", () => {
    const { p, room } = setup();
    put(room, "wall", 0, 0);
    const coin = put(room, "coin", 5, 0); // lower depth: drawn over the wall
    expect(hitTest(p, room, 8, 5)?.id).toBe(coin.id);
    room.layers[0]!.locked = true;
    expect(hitTest(p, room, 8, 5)).toBeNull();
    room.layers[0]!.locked = false;
    room.layers[0]!.visible = false;
    expect(hitTest(p, room, 8, 5)).toBeNull();
  });

  it("draws higher depths first", () => {
    const { p, room } = setup();
    const c = put(room, "coin", 0, 0);
    const w = put(room, "wall", 0, 0);
    expect(drawOrder(p, room).map((i) => i.id)).toEqual([w.id, c.id]);
  });

  it("a dragged box catches only what lies wholly inside it", () => {
    const { p, room } = setup();
    const a = put(room, "wall", 0, 0);
    put(room, "wall", 15, 0); // half in the box: not caught
    put(room, "wall", 50, 0);
    expect(inBox(p, room, -1, -1, 25, 15).map((i) => i.id)).toEqual([a.id]);
  });

  it("copies keep their arrangement, and paste where asked with new ids", () => {
    const { p, room } = setup();
    const a = put(room, "wall", 64, 32, { angle: 45 });
    const b = put(room, "coin", 96, 64);
    const clip = copy([a, b])!;
    const made = paste(p, clip, 0, 0, "L2");
    expect(made.map((m) => [m.object, m.x, m.y, m.angle, m.layer])).toEqual([["wall", 0, 0, 45, "L2"], ["coin", 32, 32, 0, "L2"]]);
    expect(made.every((m) => m.id !== a.id && m.id !== b.id)).toBe(true);
    expect(new Set(made.map((m) => m.id)).size).toBe(2); // and different from each other
    // An object deleted since copying isn't pasted.
    p.objects = p.objects.filter((o) => o.id !== "coin");
    expect(paste(p, clip, 0, 0, "L2")).toHaveLength(1);
  });

  it("painting doesn't stack a second copy in the same place", () => {
    const { room } = setup();
    put(room, "wall", 32, 32);
    expect(occupied(room, "wall", 32, 32)).toBe(true);
    expect(occupied(room, "coin", 32, 32)).toBe(false);
  });

  it("shows the camera's view where the game would start it, inside the room", () => {
    const { room } = setup();
    expect(cameraPreview(room)).toBeNull();
    Object.assign(room.camera, { enabled: true, width: 200, height: 100, follow: "coin" });
    put(room, "coin", 620, 20);
    expect(cameraPreview(room)).toEqual({ x: 440, y: 0, w: 200, h: 100 }); // clamped to the room's edge
  });
});
