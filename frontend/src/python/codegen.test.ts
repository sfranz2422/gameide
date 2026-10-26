/**
 * Code generation and error mapping, checked by running the generated
 * classes in the real Pyodide: an error must land on the event and line
 * the student typed, whatever else the object has.
 */
import { describe, expect, it } from "vitest";
import { blankProject, newEvent, newObject, type EventKey, type ObjectResource, type Project } from "../store/project";
import { PythonGame } from "./bridge";
import { buildGame, generateObject, mapError, parentsFirst } from "./codegen";

function project(): Project {
  return blankProject("t");
}
function addObj(p: Project, name: string, extra: Partial<ObjectResource> = {}) {
  const o = { ...newObject(name), ...extra };
  p.objects.push(o);
  return o;
}
function addEv(o: ObjectResource, key: EventKey, code: string) {
  const e = { ...newEvent(key), code };
  o.events.push(e);
  return e;
}

async function runUntilError(p: Project, steps = 3) {
  const built = buildGame(p, new Map());
  const { game, error } = await PythonGame.load(built.def);
  let e = error;
  for (let i = 0; i < steps && !e; i++) e = game.step();
  game.dispose();
  return e ? mapError(p, built.sources, e) : null;
}

describe("generated classes", () => {
  it("puts each event's body inside its method, with the def line students are shown", () => {
    const p = project();
    const coin = addObj(p, "Coin");
    const o = addObj(p, "Player");
    addEv(o, { type: "create" }, "self.lives = 3\n");
    addEv(o, { type: "collision", object: coin.id }, "other.destroy()");
    addEv(o, { type: "key", kind: "pressed", key: "space" }, "");
    expect(generateObject(p, o).source).toBe(
      [
        "class Player(GameObject):",
        "    def on_create(self):",
        "        self.lives = 3",
        "",
        "    def on_collision_coin(self, other):",
        "        other.destroy()",
        "",
        "    def on_key_pressed_space(self):",
        "        pass",
        "",
      ].join("\n"),
    );
  });

  it("an object with no events is still a class, and children come after parents", () => {
    const p = project();
    const child = addObj(p, "Goblin");
    const parent = addObj(p, "Enemy");
    child.parent = parent.id;
    expect(parentsFirst(p).map((o) => o.name)).toEqual(["Enemy", "Goblin"]);
    expect(generateObject(p, child).source).toBe("class Goblin(Enemy):\n    pass\n");
  });

  it("a body of only comments still compiles", async () => {
    const p = project();
    const o = addObj(p, "A");
    addEv(o, { type: "step" }, "# nothing yet\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" });
    expect(await runUntilError(p)).toBeNull();
  });

  it("tabs at the start of a line become spaces, so mixed indentation can't break it", async () => {
    const p = project();
    const o = addObj(p, "A");
    // The editor shows a tab as 4 columns, so these two lines look level —
    // but untouched, Python would see 8 spaces + a tab against 12 spaces.
    addEv(o, { type: "step" }, "if True:\n\tself.x = 5\n    self.y = 6\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" });
    expect(await runUntilError(p)).toBeNull();
  });
});

describe("sprites in the built game", () => {
  it("carry their speed, and their mask in the engine's terms", () => {
    const p = project();
    const base = { width: 10, height: 10, originX: 0, originY: 0, frames: [] as string[] };
    p.sprites.push(
      { ...base, id: "a", name: "auto", fps: 12, mask: { kind: "auto", left: 1, top: 2, right: 9, bottom: 8 } },
      { ...base, id: "c", name: "round", mask: { kind: "circle", cx: 5, cy: 5, r: 4 } },
      { ...base, id: "x", name: "exact", mask: { kind: "precise", left: 0, top: 0, right: 10, bottom: 10 } },
      { ...base, id: "n", name: "none" },
    );
    const s = buildGame(p, new Map()).def.sprites;
    expect(s[0]).toMatchObject({ fps: 12, mask: { kind: "rect", left: 1, top: 2, right: 9, bottom: 8 } });
    expect(s[1]!.mask).toEqual({ kind: "circle", cx: 5, cy: 5, r: 4 });
    expect(s[2]!.mask).toEqual({ kind: "precise", left: 0, top: 0, right: 10, bottom: 10 });
    expect(s[3]!.mask).toBeUndefined();
    expect(s[3]!.fps).toBeUndefined(); // old sprites keep one frame per step
  });
});

describe("rooms in the built game", () => {
  it("carry overrides only where set, visible backgrounds only, and the camera when it is on", () => {
    const p = project();
    const o = addObj(p, "Hero");
    const room = p.rooms[0]!;
    room.instances.push(
      { id: "a", object: o.id, layer: "", x: 1, y: 2, scaleX: 1, scaleY: 1, angle: 0, code: "" },
      { id: "b", object: o.id, layer: "", x: 3, y: 4, scaleX: -1, scaleY: 2, angle: 30, code: "self.hp = 9\n" },
      { id: "c", object: "deleted", layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" },
    );
    const bg = room.layers.find((l) => l.kind === "background")!;
    if (bg.kind === "background") Object.assign(bg, { color: "#112233", depth: 900 });
    room.layers.push({ ...bg, id: "hidden", visible: false });
    Object.assign(room.camera, { enabled: true, width: 320, height: 240, follow: o.id, smoothing: 0.2 });
    const r = buildGame(p, new Map()).def.rooms[0]!;
    expect(r.instances).toEqual([
      { object: "Hero", x: 1, y: 2 },
      { object: "Hero", x: 3, y: 4, scaleX: -1, scaleY: 2, angle: 30, code: "self.hp = 9\n" },
    ]);
    expect(r.backgrounds).toEqual([{ depth: 900, color: 0x112233, mode: "tile", hspeed: 0, vspeed: 0, parallax: 0 }]);
    expect(r.camera).toEqual({ width: 320, height: 240, smoothing: 0.2, follow: "Hero" });
    room.camera.enabled = false;
    expect(buildGame(p, new Map()).def.rooms[0]!.camera).toBeUndefined();
    // Parallax down, offsets and a remembered room travel too — and stay out when unset.
    expect(r.persistent).toBeUndefined();
    if (bg.kind === "background") Object.assign(bg, { mode: "tile_x", parallax: 0.5, parallaxY: 1, offsetX: 0, offsetY: 200 });
    room.persistent = true;
    const r2 = buildGame(p, new Map()).def.rooms[0]!;
    expect(r2.backgrounds).toEqual([{ depth: 900, color: 0x112233, mode: "tile_x", hspeed: 0, vspeed: 0, parallax: 0.5, parallaxY: 1, offsetY: 200 }]);
    expect(r2.persistent).toBe(true);
  });

  it("an error in an instance's creation code points at that instance and line", async () => {
    const p = project();
    const o = addObj(p, "Hero");
    addEv(o, { type: "create" }, "self.hp = 3\n");
    const room = p.rooms[0]!;
    room.instances.push(
      { id: "ok", object: o.id, layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" },
      { id: "bad", object: o.id, layer: "", x: 64, y: 32, scaleX: 1, scaleY: 1, angle: 0, code: "self.hp += 1\nself.hp += oops\n" },
    );
    const e = await runUntilError(p);
    expect(e?.where).toBe("Room1 → Hero at (64, 32), creation code line 2");
    expect(e?.target).toEqual({ kind: "instance", roomId: room.id, instanceId: "bad", line: 2 });
  });
});

describe("tiles in the built game", () => {
  it("a tile layer becomes a dense grid; tiles past the room's edge are left out, not lost", () => {
    const p = project();
    p.tilesets.push({ id: "ts", name: "terrain", image: "img", imageWidth: 64, imageHeight: 32, tileWidth: 32, tileHeight: 32, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0, solid: [0, 2], oneWay: [1], animations: [{ tiles: [0, 1], fps: 3 }], autotiles: [] });
    const room = p.rooms[0]!;
    Object.assign(room, { width: 96, height: 40 }); // 3 × 2 tiles (the last row only partly in the room)
    room.layers.push({ id: "L", name: "Ground", kind: "tiles", depth: 5, visible: false, locked: false, tileset: "ts", tiles: { "0,0": 1, "2,1": 3, "7,0": 2 } });
    room.layers.push({ id: "M", name: "Empty", kind: "tiles", depth: 5, visible: true, locked: false, tileset: null, tiles: { "0,0": 1 } });
    const def = buildGame(p, new Map([["img", new Blob(["x"])]])).def;
    expect(def.tilesets).toEqual([expect.objectContaining({ name: "terrain", columns: 2, count: 2, solid: [0, 2], oneWay: [1], animations: [{ tiles: [0, 1], fps: 3 }] })]);
    expect(def.rooms[0]!.tileLayers).toEqual([
      { name: "Ground", depth: 5, visible: false, tileset: "terrain", columns: 3, rows: 2, cells: [1, -1, -1, -1, -1, 3] },
    ]);
    expect(room.layers.find((l) => l.id === "L")).toMatchObject({ tiles: { "7,0": 2 } }); // still in the project
  });
});

describe("errors point at what the student typed", () => {
  it("a runtime error in the third event, line 2", async () => {
    const p = project();
    const o = addObj(p, "Player");
    addEv(o, { type: "create" }, "self.a = 1\nself.b = 2\n");
    addEv(o, { type: "begin_step" }, "pass\n");
    // The error is on a middle line: on the last line, mapping one line too
    // far would be hidden by the clamp that maps an added `pass`.
    const step = addEv(o, { type: "step" }, "self.x += 1\nself.x += spead\nself.y += 1\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" });
    const e = await runUntilError(p);
    expect(e?.where).toBe("Player → Step, line 2");
    expect(e?.target).toEqual({ kind: "event", objectId: o.id, eventId: step.id, line: 2 });
    expect(e?.traceback).toContain("Player → Step, line 2");
    expect(e?.traceback).not.toContain("<object");
  });

  it("a syntax error, before anything runs", async () => {
    const p = project();
    const o = addObj(p, "Player");
    addEv(o, { type: "create" }, "x = 1\n");
    const draw = addEv(o, { type: "draw" }, "draw_self()\nif x > 1\n    pass\n");
    const e = await runUntilError(p);
    expect(e?.where).toBe("Player → Draw, line 2");
    expect(e?.target).toMatchObject({ eventId: draw.id, line: 2 });
  });

  it("an error inside a script names the script and its own line", async () => {
    const p = project();
    p.scripts.push({ id: "s1", name: "helpers", code: "def boom():\n    return 1 / 0\n" });
    const o = addObj(p, "A");
    addEv(o, { type: "create" }, "boom()\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" });
    const e = await runUntilError(p);
    expect(e?.where).toBe("script helpers, line 2");
    expect(e?.target).toEqual({ kind: "script", scriptId: "s1", line: 2 });
    expect(e?.traceback).toContain("A → Create, line 1");
  });

  it("the def line and an empty event's added `pass` map to that event's line 1", () => {
    // class line 1; Create: def 2, pass 3; blank 4; Step: def 5, body 6.
    const p = project();
    const o = addObj(p, "A");
    const create = addEv(o, { type: "create" }, "");
    const step = addEv(o, { type: "step" }, "x = 1\n");
    const built = buildGame(p, new Map());
    const at = (line: number) =>
      mapError(p, built.sources, { kind: "object", object: "A", event: null, line, message: "", traceback: "" }).target;
    expect(at(3)).toEqual({ kind: "event", objectId: o.id, eventId: create.id, line: 1 });
    expect(at(5)).toEqual({ kind: "event", objectId: o.id, eventId: step.id, line: 1 });
    expect(at(6)).toEqual({ kind: "event", objectId: o.id, eventId: step.id, line: 1 });
    expect(at(1)).toBeNull();
  });
});
