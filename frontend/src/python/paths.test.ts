/**
 * Phase 12b in the real Pyodide: one-way platforms (and dropping through
 * them), collision_line, and path_find.
 *
 * The room is 160 × 160 of 16 px tiles: tile 1 is solid, tile 2 a one-way
 * platform. The "box" sprite is 16 × 16 with its origin at its top-left.
 */
import { describe, expect, it } from "vitest";
import type { RoomInstance, TilesetDef } from "../engine/game";
import { load, py, run } from "./testkit";

const TILES: TilesetDef[] = [
  { name: "t", tileWidth: 16, tileHeight: 16, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0, columns: 4, count: 4, solid: [1], oneWay: [2] },
];
const N = 10;

/** A room from rows of text: # solid, = one-way, anything else empty. */
function room(rows: string[], instances: RoomInstance[], code: Record<string, string>) {
  const cells: number[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push(rows[r]?.[c] === "#" ? 1 : rows[r]?.[c] === "=" ? 2 : -1);
  return load({
    tilesets: TILES,
    code,
    instances,
    rooms: [{ name: "R", width: N * 16, height: N * 16, instances, tileLayers: [{ name: "Ground", depth: 0, visible: true, tileset: "t", columns: N, rows: N, cells }] }],
  });
}

/** A falling box: it moves by vy with move_and_collide, and remembers what stopped it. */
const FALLER = `class P(GameObject):
    def on_create(self):
        self.vy = 0
        self.stopped = False
    def on_step(self):
        self.stopped = bool(move_and_collide(0, self.vy))
`;

describe("one-way platforms", () => {
  const level = ["", "", "", "", "", "==========", "", "", "", "##########"];

  it("land a box falling onto one from above", async () => {
    const { game } = await room(level, [{ object: "P", x: 32, y: 20 }], { P: FALLER });
    py(game, "instances('P')[0].vy = 5");
    run(game, 20);
    expect(py(game, "instances('P')[0].y")).toBe(64); // the platform is row 5: its top is y 80, and the box is 16 tall
    expect(py(game, "instances('P')[0].stopped")).toBe(true);
    expect(py(game, "instances('P')[0].place_free(32, 65)")).toBe(false); // standing on it
    expect(py(game, "instances('P')[0].place_free(48, 64)")).toBe(true); // and walking along it
  });

  it("let a box rise up through from below, and stay a floor once it is above", async () => {
    const { game } = await room(level, [{ object: "P", x: 32, y: 110 }], { P: FALLER });
    py(game, "instances('P')[0].vy = -4");
    run(game, 15); // from y 110 up past the platform at 80
    expect(py(game, "instances('P')[0].y")).toBeLessThan(64);
    py(game, "instances('P')[0].vy = 3");
    run(game, 20);
    expect(py(game, "instances('P')[0].y")).toBe(64);
  });

  it("let a box drop through while drop_through counts down, which it does by itself", async () => {
    const { game } = await room(level, [{ object: "P", x: 32, y: 64 }], { P: FALLER });
    py(game, "p = instances('P')[0]; p.drop_through = 6; p.vy = 4");
    run(game, 3);
    expect(py(game, "instances('P')[0].drop_through")).toBe(3);
    run(game, 20);
    expect(py(game, "instances('P')[0].y")).toBe(128); // through, and down onto the solid floor (row 9)
    expect(py(game, "instances('P')[0].drop_through")).toBe(0);
  });

  it("are still solid tiles' neighbours: a solid tile blocks from every side", async () => {
    const { game } = await room(["", "", "", "", "", "##########"], [{ object: "P", x: 32, y: 110 }], { P: FALLER });
    py(game, "instances('P')[0].vy = -4");
    run(game, 15);
    expect(py(game, "instances('P')[0].y")).toBe(96); // stopped under it
  });
});

describe("collision_line", () => {
  const WALL = "class Wall(GameObject):\n    pass\n";
  const EYE = "class Eye(GameObject):\n    pass\n";

  it("says what a line hits first, or None for a clear line", async () => {
    const { game } = await room(["", "", "", "", "", "", "", "", "", "    #"], [
      { object: "Eye", x: 0, y: 0 },
      { object: "Wall", x: 64, y: 0 },
      { object: "Wall", x: 112, y: 0 },
    ], { Eye: EYE, Wall: WALL });
    py(game, "for w in instances('Wall'): w.solid = True");
    expect(py(game, "collision_line(8, 8, 150, 8, 'Wall').x")).toBe(64); // the nearer of the two
    expect(py(game, "collision_line(150, 8, 8, 8, 'Wall').x")).toBe(112); // from the other end, the other one
    expect(py(game, "collision_line(8, 40, 150, 40) is None")).toBe(true); // nothing on that row
    expect(py(game, "collision_line(0, 150, 150, 150)")).toBe("Ground"); // the solid tile at column 4
    expect(py(game, "collision_line(0, 150, 150, 150, 'Ground')")).toBe("Ground");
    expect(py(game, "collision_line(8, 8, 150, 8, 'Eye').object_name")).toBe("Eye"); // starting inside it counts
  });

  it("never sees the instance asking, and goes over one-way platforms", async () => {
    const { game } = await room(["", "", "==========", "", "", "", "", "", "", ""], [{ object: "Eye", x: 0, y: 0 }], {
      Eye: "class Eye(GameObject):\n    def on_step(self):\n        self.seen = collision_line(8, 8, 150, 8, 'Eye')\n        self.down = collision_line(8, 8, 8, 150)\n",
    });
    py(game, "instances('Eye')[0].solid = True");
    run(game);
    expect(py(game, "instances('Eye')[0].seen is None")).toBe(true);
    expect(py(game, "instances('Eye')[0].down is None")).toBe(true);
  });
});

describe("path_find", () => {
  // A wall across the middle with one gap at the right.
  const maze = ["", "", "", "", "######### ", "", "", "", "", ""];

  it("finds a way round the walls, through the gap, without cutting a corner", async () => {
    const { game } = await room(maze, [], {});
    const path = py(game, "path_find(8, 8, 8, 150)") as unknown as [number, number][];
    expect(path[0]).toEqual([8, 8]);
    expect(path.at(-1)).toEqual([8, 152]);
    expect(path.some(([x, y]) => x === 152 && y === 72)).toBe(true); // through the gap (column 9, row 4)
    const solid = (x: number, y: number) => y >= 64 && y < 80 && x < 144;
    expect(path.every(([x, y]) => !solid(x, y))).toBe(true);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1]!, [bx, by] = path[i]!;
      expect(Math.abs(bx - ax) <= 16 && Math.abs(by - ay) <= 16).toBe(true); // one cell at a time
      if (ax !== bx && ay !== by) expect(solid(bx, ay) || solid(ax, by)).toBe(false); // no squeezing past a corner
    }
  });

  it("goes round solid instances too, and gives [] when there is no way", async () => {
    const { game } = await room(maze, [{ object: "Block", x: 144, y: 64 }], { Block: "class Block(GameObject):\n    pass\n" });
    expect((py(game, "path_find(8, 8, 8, 150)") as unknown as unknown[]).length).toBeGreaterThan(0); // not solid: no matter
    py(game, "instances('Block')[0].solid = True");
    expect(py(game, "path_find(8, 8, 8, 150)")).toEqual([]); // the gap is filled
    expect(py(game, "path_find(8, 72, 8, 8)")).toEqual([]); // starting inside a wall
    expect(() => py(game, "path_find(0, 0, 10, 10, 1)")).toThrow(/2 or more/);
  });
});
