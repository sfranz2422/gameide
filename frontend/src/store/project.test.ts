import { describe, expect, it } from "vitest";
import { blankProject, deleteResource, nameProblem, newEvent, newObject, quotedUses, replaceQuoted, wouldLoop, type Project } from "./project";

function withObjects(...names: string[]): Project {
  const p = blankProject("t");
  for (const n of names) p.objects.push({ ...newObject(n), id: n });
  return p;
}

describe("names", () => {
  it("objects must be Python names, unique ignoring case, and not GameIDE's own", () => {
    const p = withObjects("Coin");
    expect(nameProblem(p, "objects", "Player")).toBeNull();
    expect(nameProblem(p, "objects", "coin")).toMatch(/already one called "Coin"/);
    expect(nameProblem(p, "objects", "2fast")).toMatch(/letters, digits/);
    expect(nameProblem(p, "objects", "class")).toMatch(/Python word/);
    expect(nameProblem(p, "objects", "GameObject")).toMatch(/already used by GameIDE/);
    expect(nameProblem(p, "objects", "Coin", "Coin")).toBeNull(); // renaming to itself
  });
});

describe("deleting", () => {
  it("an object takes its room instances, collision events aimed at it, and children's parent link", () => {
    const p = withObjects("Coin", "Player", "Gem");
    p.objects[2]!.parent = "Coin";
    p.objects[1]!.events.push(newEvent({ type: "collision", object: "Coin" }), newEvent({ type: "step" }));
    p.rooms[0]!.instances.push({ id: "a", object: "Coin", layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" }, { id: "b", object: "Player", layer: "", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" });
    const effects = deleteResource(p, "objects", "Coin");
    expect(p.objects.map((o) => o.id)).toEqual(["Player", "Gem"]);
    expect(p.rooms[0]!.instances.map((i) => i.id)).toEqual(["b"]);
    expect(p.objects[0]!.events.map((e) => e.key.type)).toEqual(["step"]);
    expect(p.objects[1]!.parent).toBeNull();
    expect(effects).toEqual(["1 instance in Room1", "Player's collision event with it", "Gem's parent"]);
  });
});

describe("parents", () => {
  it("refuses a parent that would make a loop", () => {
    const p = withObjects("A", "B", "C");
    p.objects[1]!.parent = "A"; // B → A
    p.objects[2]!.parent = "B"; // C → B → A
    expect(wouldLoop(p, "A", "C")).toBe(true);
    expect(wouldLoop(p, "A", "A")).toBe(true);
    expect(wouldLoop(p, "C", "A")).toBe(false);
  });
});

describe("renaming references in code", () => {
  it("finds and replaces the name in quotes only", () => {
    const p = withObjects("Coin", "Player");
    const ev = { ...newEvent({ type: "step" }), code: `if place_meeting(x, y, "Coin") or instance_exists('Coin'):\n    Coin = "Coins"\n` };
    p.objects[1]!.events.push(ev);
    expect(quotedUses(p, "Coin")).toEqual([{ where: "Player → Step", count: 2 }]);
    replaceQuoted(p, "Coin", "Gem");
    expect(p.objects[1]!.events[0]!.code).toBe(`if place_meeting(x, y, "Gem") or instance_exists('Gem'):\n    Coin = "Coins"\n`);
  });
});

describe("loading an older project", () => {
  it("version 1 rooms get layers, a grid and a camera, and look exactly as they did", async () => {
    const { migrate } = await import("./project");
    const old = {
      format: "gameide-project", schemaVersion: 1, id: "x", name: "Old", created: "", modified: "",
      settings: { stepsPerSecond: 60 }, sprites: [], objects: [], scripts: [],
      rooms: [{ id: "r", name: "Room1", width: 800, height: 600, background: "#000000", instances: [{ id: "i", object: "o", x: 5, y: 6 }] }],
    };
    const p = migrate(old);
    const room = p.rooms[0]!;
    expect(p.schemaVersion).toBe(3);
    expect(p.tilesets).toEqual([]); // 2 → 3 added tilesets
    expect(room.camera).toEqual({ enabled: false, width: 800, height: 600, follow: null, smoothing: 1 });
    expect([room.gridWidth, room.snap]).toEqual([32, true]);
    const layer = room.layers.find((l) => l.kind === "instances")!;
    expect(room.instances[0]).toEqual({ id: "i", object: "o", x: 5, y: 6, layer: layer.id, scaleX: 1, scaleY: 1, angle: 0, code: "" });
  });
});

describe("tilesets", () => {
  it("count their tiles allowing for offset and spacing", async () => {
    const { tilesetGrid, newTileset } = await import("./project");
    // 2 px margin, 4 px gaps, 16 px tiles: 2 + 16 + 4 + 16 = 38 fits in 56; a third needs 58.
    // (Without the gaps, 56 would wrongly hold three.)
    expect(tilesetGrid({ ...newTileset("t"), imageWidth: 56, imageHeight: 40, tileWidth: 16, tileHeight: 16, offsetX: 2, offsetY: 2, spacingX: 4, spacingY: 1 })).toEqual({ columns: 2, rows: 2 });
  });

  it("deleting one clears the tile layers painted with it, and says so", async () => {
    const { deleteResource, newTileset } = await import("./project");
    const p = blankProject("t");
    p.tilesets.push({ ...newTileset("terrain"), id: "ts" });
    p.rooms[0]!.layers.push({ id: "L", name: "Ground", kind: "tiles", depth: 0, visible: true, locked: false, tileset: "ts", tiles: { "0,0": 1, "1,0": 1 } });
    expect(deleteResource(p, "tilesets", "ts")).toEqual(["the 2 tiles painted on Room1's Ground"]);
    // toEqual, not toMatchObject: `tiles: {}` in a partial match matches any tiles at all.
    const layer = p.rooms[0]!.layers.find((l) => l.id === "L") as { tileset: string | null; tiles: object };
    expect(layer.tileset).toBeNull();
    expect(layer.tiles).toEqual({});
  });
});
