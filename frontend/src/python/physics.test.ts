/**
 * Physics (engine/physics.ts) in the real Pyodide: self.physics = True and
 * the handful of settings around it, joints, and physics mixed with the
 * ordinary objects and tiles a game already has.
 *
 * Rooms are 20 × 10 tiles of 16 px drawn as text: # solid, = one-way.
 * "box" is 16 × 16 and "big" 32 × 32, origins at their top-left; "ball" is a
 * circle mask of radius 8 about its middle, which is its origin.
 */
import { describe, expect, it } from "vitest";
import type { RoomInstance, SpriteDef, TilesetDef } from "../engine/game";
import { load, py, run } from "./testkit";

const TILES: TilesetDef[] = [
  { name: "t", tileWidth: 16, tileHeight: 16, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0, columns: 4, count: 4, solid: [1], oneWay: [2] },
];
const BALL: SpriteDef = { name: "ball", width: 16, height: 16, originX: 8, originY: 8, frameCount: 1, mask: { kind: "circle", cx: 8, cy: 8, r: 8 } };
const COLS = 20, ROWS = 10;
const FLOOR = ["", "", "", "", "", "", "", "", "", "####################"];

/** Objects named in `code`, whose sprite is "box" unless `sprites` names another. */
function room(rows: string[], instances: RoomInstance[], code: Record<string, string>, sprites: Record<string, string> = {}) {
  const cells: number[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push(rows[r]?.[c] === "#" ? 1 : rows[r]?.[c] === "=" ? 2 : -1);
  const full = Object.fromEntries(Object.entries(code).map(([k, v]) => [k, v.includes("class ") ? v : `class ${k}(GameObject):\n${v || "    pass\n"}`]));
  return load({
    sprites: [BALL],
    tilesets: TILES,
    code: full,
    objects: Object.keys(full).map((name) => ({ name, sprite: sprites[name] ?? "box" })),
    instances,
    rooms: [{ name: "R", width: COLS * 16, height: ROWS * 16, instances, tileLayers: [{ name: "Ground", depth: 0, visible: true, tileset: "t", columns: COLS, rows: ROWS, cells }] }],
  });
}

const PHYS = "    def on_create(self):\n        self.physics = True\n";
const num = (game: Awaited<ReturnType<typeof room>>["game"], expr: string) => py(game, expr) as number;

describe("a physics instance", () => {
  it("falls, lands on solid tiles, and stays there", async () => {
    const { game } = await room(FLOOR, [{ object: "Crate", x: 40, y: 20 }, { object: "Still", x: 100, y: 20 }], { Crate: PHYS, Still: "" });
    run(game, 10);
    expect(num(game, "instances('Crate')[0].vspeed")).toBeGreaterThan(1); // falling, and getting faster
    run(game, 110);
    expect(num(game, "instances('Crate')[0].y")).toBeCloseTo(128, 0); // the floor's top is 144, the crate 16 tall
    expect(Math.abs(num(game, "instances('Crate')[0].vspeed"))).toBeLessThan(0.05);
    expect(num(game, "instances('Crate')[0].image_angle")).toBeCloseTo(0, 1); // landed flat, didn't tip
    expect(py(game, "instances('Still')[0].y")).toBe(20); // no physics: nothing moves it
  });

  it("stacks on others", async () => {
    const crates = [0, 1, 2].map((i) => ({ object: "Crate", x: 60, y: 20 + i * 24 }));
    const { game } = await room(FLOOR, crates, { Crate: PHYS });
    run(game, 240);
    const ys = (py(game, "sorted(c.y for c in instances('Crate'))") as number[]);
    expect(ys[0]).toBeCloseTo(96, 0);
    expect(ys[1]).toBeCloseTo(112, 0);
    expect(ys[2]).toBeCloseTo(128, 0);
    expect(py(game, "all(abs(c.x - 60) < 0.5 for c in instances('Crate'))")).toBe(true);
  });

  it("bounces as much as its bounce says", async () => {
    const code = { Ball: PHYS + "        self.high = 999\n    def on_step(self):\n        if self.vspeed < 0: self.high = min(self.high, self.y)\n" };
    const { game } = await room(FLOOR, [{ object: "Ball", x: 40, y: 40 }, { object: "Ball", x: 120, y: 40 }], code, { Ball: "ball" });
    py(game, "a, b = instances('Ball'); a.bounce = 0.8; b.bounce = 0");
    run(game, 120);
    // Dropped from 40 onto a floor at 144 (its middle stops at 136): 0.8 comes most of the way back up.
    expect(num(game, "instances('Ball')[0].high")).toBeLessThan(90);
    expect(num(game, "instances('Ball')[1].high")).toBeGreaterThan(130);
  });

  it("is moved by its own code: x and y put it there, hspeed and vspeed throw it", async () => {
    const { game } = await room(FLOOR, [{ object: "Crate", x: 40, y: 128 }], { Crate: PHYS });
    run(game, 5);
    py(game, "c = instances('Crate')[0]; c.x = 200; c.y = 60");
    run(game);
    expect(num(game, "instances('Crate')[0].x")).toBeCloseTo(200, 0);
    expect(num(game, "instances('Crate')[0].y")).toBeLessThan(62);
    run(game, 120);
    py(game, "instances('Crate')[0].vspeed = -6");
    run(game, 3);
    expect(num(game, "instances('Crate')[0].y")).toBeLessThan(115); // thrown up
  });

  it("takes push() divided by its weight; a fixed one isn't moved at all", async () => {
    const { game } = await room(FLOOR, [{ object: "Crate", x: 20, y: 128 }, { object: "Crate", x: 120, y: 128 }, { object: "Crate", x: 220, y: 128 }], {
      Crate: PHYS + "        self.friction = 0\n",
    });
    run(game, 5);
    py(game, "a, b, c = instances('Crate'); b.weight = 4; c.fixed = True");
    const before = py(game, "[k.x for k in instances('Crate')]") as number[];
    py(game, "for k in instances('Crate'): k.push(4, 0)");
    run(game, 10);
    const [a, b, c] = (py(game, "[k.x for k in instances('Crate')]") as number[]).map((x, i) => x - before[i]!);
    expect(a).toBeCloseTo(40, 0); // 4 px a step, frictionless, for 10 steps
    expect(b).toBeCloseTo(10, 0); // a quarter of that
    expect(c).toBe(0);
    expect(() => py(game, "instances('Crate')[0].weight = 0")).toThrow(/more than 0/);
  });

  it("has its weight as its mass, whatever its size", async () => {
    // A small crate of weight 1 slides into a big one (four times its size)
    // of weight 4, with nothing to slow them and no bounce: they go on
    // together at a fifth of the speed, as momentum says (1 × 4 = 5 × 0.8).
    const { game } = await room(FLOOR, [{ object: "Small", x: 20, y: 128 }, { object: "Big", x: 100, y: 112 }], {
      Small: PHYS + "        self.friction = 0\n",
      Big: PHYS + "        self.friction = 0\n        self.weight = 4\n",
    }, { Big: "big" });
    run(game, 5);
    py(game, "instances('Small')[0].hspeed = 4");
    run(game, 40);
    expect(num(game, "instances('Big')[0].hspeed")).toBeCloseTo(0.8, 1);
    expect(num(game, "instances('Small')[0].hspeed")).toBeCloseTo(0.8, 1);
  });

  it("spins, and physics_gravity changes the pull", async () => {
    // A ball, whose origin is its middle: a box with its origin at a corner
    // turns about its middle, and its x and y go round with the corner.
    const { game } = await room(FLOOR, [{ object: "Ball", x: 100, y: 40 }], { Ball: PHYS }, { Ball: "ball" });
    py(game, "physics_gravity(0, 0); instances('Ball')[0].spin = 3");
    run(game, 10);
    expect(num(game, "instances('Ball')[0].image_angle")).toBeCloseTo(30, 0);
    expect(num(game, "instances('Ball')[0].spin")).toBeCloseTo(3, 3); // and spin reads back as it was set
    expect(num(game, "instances('Ball')[0].y")).toBeCloseTo(40, 3); // nothing pulls it
    py(game, "physics_gravity(-0.2, 0)");
    run(game, 10);
    expect(num(game, "instances('Ball')[0].x")).toBeLessThan(95); // pulled to the left
  });

  it("drops its body when physics is turned off or it is destroyed", async () => {
    const { game } = await room(FLOOR, [{ object: "Crate", x: 40, y: 20 }], { Crate: PHYS });
    run(game, 10);
    py(game, "c = instances('Crate')[0]; c.physics = False; c.vspeed = 0; c.y = 20");
    run(game, 10);
    expect(py(game, "instances('Crate')[0].y")).toBe(20);
    expect(game.engine.physics.world!.getBodyCount()).toBe(2); // the walls and the ground left
    py(game, "c = instances('Crate')[0]; c.physics = True");
    run(game);
    expect(game.engine.physics.world!.getBodyCount()).toBe(3);
    py(game, "instances('Crate')[0].destroy()");
    run(game);
    expect(game.engine.physics.world!.getBodyCount()).toBe(2);
  });
});

describe("joints", () => {
  it("a rope holds a ball to a point and lets it swing", async () => {
    const { game } = await room(FLOOR, [{ object: "Ball", x: 100, y: 60 }], { Ball: PHYS }, { Ball: "ball" });
    py(game, "global_vars.j = physics_join(instances('Ball')[0], None, 'rope', 160, 20)");
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < 200; i++) {
      run(game);
      const [x, y] = py(game, "(instances('Ball')[0].x, instances('Ball')[0].y)") as number[];
      expect(Math.hypot(x! - 160, y! - 20)).toBeLessThan(72.5 + 1); // never further than it started (72.1)
      minX = Math.min(minX, x!);
      maxX = Math.max(maxX, x!);
    }
    expect(maxX).toBeGreaterThan(200); // swung out the other side
    expect(minX).toBeLessThan(110);
    py(game, "physics_unjoin(global_vars.j); physics_unjoin(global_vars.j)"); // twice: no matter
    run(game, 60);
    expect(num(game, "instances('Ball')[0].y")).toBeCloseTo(136, 0); // let go, it falls to the floor
  });

  it("a rope goes slack, where a spring pushes back", async () => {
    const { game } = await room(FLOOR, [{ object: "Ball", x: 160, y: 80 }, { object: "Ball", x: 240, y: 80 }], { Ball: PHYS }, { Ball: "ball" });
    py(game, "physics_gravity(0, 0); a, b = instances('Ball'); physics_join(a, None, 'rope', 160, 20); physics_join(b, None, 'spring', 240, 20)");
    py(game, "for k in instances('Ball'): k.vspeed = -2"); // towards the knot
    run(game, 15);
    expect(num(game, "instances('Ball')[0].y")).toBeCloseTo(50, 0); // 30 px nearer: nothing holds it off
    expect(num(game, "instances('Ball')[1].y")).toBeGreaterThan(60); // pushed back long before that
  });

  it("a hinge with no point pins a at its own origin", async () => {
    const { game } = await room(FLOOR, [{ object: "Ball", x: 100, y: 40 }], { Ball: PHYS }, { Ball: "ball" });
    py(game, "b = instances('Ball')[0]; physics_join(b); b.spin = 4");
    run(game, 60);
    expect(num(game, "instances('Ball')[0].y")).toBeCloseTo(40, 1); // turning where it is, not falling
    expect(num(game, "instances('Ball')[0].image_angle")).toBeGreaterThan(100);
  });

  it("a hinge holds a plank up by one point; a weld makes two into one", async () => {
    const { game } = await room(FLOOR, [{ object: "Plank", x: 100, y: 40 }, { object: "A", x: 200, y: 40 }, { object: "B", x: 216, y: 40 }], {
      Plank: PHYS, A: PHYS, B: PHYS,
    });
    py(game, "p = instances('Plank')[0]; physics_join(p, None, 'hinge', 100, 40)"); // its top-left corner
    py(game, "physics_join(instances('A')[0], instances('B')[0], 'weld', 216, 48)");
    run(game, 240);
    // Hanging from its corner: it turned until its middle is straight below the pin.
    expect(num(game, "instances('Plank')[0].x")).toBeCloseTo(100, 0); // still pinned there
    expect(num(game, "instances('Plank')[0].y")).toBeCloseTo(40, 0);
    // Nothing slows a swing down, so it's still going: from where it started
    // (0) round to level the other way (-90) and back, about -45, below the pin.
    const angles: number[] = [];
    for (let i = 0; i < 60; i++) {
      run(game);
      angles.push(num(game, "instances('Plank')[0].image_angle"));
    }
    expect(Math.min(...angles)).toBeGreaterThan(-92);
    expect(Math.max(...angles)).toBeLessThan(2);
    expect(Math.min(...angles)).toBeLessThan(-70);
    // Welded: still side by side, 16 apart, at the same angle.
    expect(num(game, "instances('B')[0].x - instances('A')[0].x")).toBeCloseTo(16, 0);
    expect(num(game, "instances('B')[0].image_angle - instances('A')[0].image_angle")).toBeCloseTo(0, 1);
  });

  it("a spring pulls back, and joints end with their instances", async () => {
    const { game } = await room(FLOOR, [{ object: "Ball", x: 160, y: 60 }], { Ball: PHYS }, { Ball: "ball" });
    py(game, "physics_gravity(0, 0); physics_join(instances('Ball')[0], None, 'spring', 160, 20)");
    py(game, "instances('Ball')[0].vspeed = 4");
    let lowest = 0;
    for (let i = 0; i < 20; i++) {
      run(game);
      lowest = Math.max(lowest, num(game, "instances('Ball')[0].y"));
    }
    expect(lowest).toBeGreaterThan(70); // stretched…
    run(game, 300);
    expect(num(game, "instances('Ball')[0].y")).toBeCloseTo(60, 0); // …and settled back
    expect(game.engine.physics.jointCount).toBe(1);
    py(game, "instances('Ball')[0].destroy()");
    run(game);
    expect(game.engine.physics.jointCount).toBe(0);
  });

  it("says what's wrong in plain words", async () => {
    const { game } = await room(FLOOR, [{ object: "Ball", x: 100, y: 60 }, { object: "Still", x: 10, y: 10 }], { Ball: PHYS, Still: "" }, { Ball: "ball" });
    expect(() => py(game, "physics_join(instances('Ball')[0], None, 'hindge')")).toThrow(/"hinge"|'hinge'/);
    expect(() => py(game, "physics_join(instances('Ball')[0], instances('Still')[0])")).toThrow(/physics = True/);
    expect(() => py(game, "physics_join(instances('Ball')[0], instances('Ball')[0])")).toThrow(/itself/);
    expect(() => py(game, "physics_join(instances('Ball')[0], None, 'rope', 5)")).toThrow(/both x and y/);
  });
});

describe("mixed with the rest of a game", () => {
  it("a crate rides a moving solid platform, which physics never moves", async () => {
    const { game } = await room([], [{ object: "Lift", x: 100, y: 100 }, { object: "Crate", x: 100, y: 80 }], {
      Lift: "    def on_create(self):\n        self.solid = True\n        self.image_xscale = 4\n",
      // A collision event with a solid instance: GameMaker's put-back-where-it-was must not happen to a physics body.
      Crate: PHYS + "        self.rode = 0\n    def on_collision_lift(self, other):\n        self.rode += 1\n",
    });
    run(game, 30); // landed on it
    py(game, "instances('Lift')[0].hspeed = 1");
    run(game, 60);
    expect(num(game, "instances('Lift')[0].x")).toBe(160);
    expect(num(game, "instances('Lift')[0].y")).toBe(100);
    // Carried along: slipping a little as the lift set off, then going with it.
    expect(num(game, "instances('Crate')[0].x")).toBeGreaterThan(150);
    expect(num(game, "instances('Crate')[0].hspeed")).toBeCloseTo(1, 1);
    expect(num(game, "instances('Crate')[0].rode")).toBeGreaterThan(60);
    expect(num(game, "instances('Crate')[0].y")).toBeCloseTo(84, 0);
  });

  it("touching fires collision events — resting, not overlapping — once a step", async () => {
    const { game } = await room(FLOOR, [{ object: "Crate", x: 40, y: 100 }, { object: "Button", x: 40, y: 128 }], {
      Crate: PHYS + "        self.hits = 0\n    def on_collision_button(self, other):\n        self.hits += 1\n",
      Button: "    def on_create(self):\n        self.physics = True\n        self.fixed = True\n        self.pressed = 0\n    def on_collision_crate(self, other):\n        self.pressed += 1\n",
    });
    run(game, 60);
    const before = py(game, "(instances('Crate')[0].hits, instances('Button')[0].pressed)") as number[];
    run(game, 10);
    const after = py(game, "(instances('Crate')[0].hits, instances('Button')[0].pressed)") as number[];
    expect(after[0]! - before[0]!).toBe(10);
    expect(after[1]! - before[1]!).toBe(10);
    expect(num(game, "instances('Crate')[0].y")).toBeCloseTo(112, 0); // resting on it, not put back
    // Pushed 4 px into it, the pair both overlaps and touches: still one event a step, not two.
    py(game, "physics_gravity(0, 0); c = instances('Crate')[0]; c.y = 116; c.vspeed = 0");
    const into = num(game, "instances('Crate')[0].hits");
    run(game);
    expect(num(game, "instances('Crate')[0].hits") - into).toBe(1);
  });

  it("is in the way of move_and_collide and place_free, so a player can shove a crate", async () => {
    const { game } = await room(FLOOR, [{ object: "Player", x: 20, y: 128 }, { object: "Crate", x: 60, y: 128 }], {
      Player: "    def on_step(self):\n        for c in move_and_collide(2, 0):\n            if not isinstance(c, str):\n                c.push(0.5, 0)\n",
      Crate: PHYS,
    });
    run(game, 30);
    expect(num(game, "instances('Player')[0].x")).toBeGreaterThanOrEqual(43); // walked up to it…
    expect(num(game, "instances('Crate')[0].x")).toBeGreaterThan(62); // …and shoved it along
    expect(py(game, "instances('Player')[0].place_free(instances('Crate')[0].x - 8, 128)")).toBe(false);
  });

  it("lands on one-way tiles from above, rises through them, and drops through", async () => {
    const level = ["", "", "", "", "", "====================", "", "", "", "####################"];
    const { game } = await room(level, [{ object: "Crate", x: 40, y: 20 }, { object: "Crate", x: 120, y: 128 }], { Crate: PHYS });
    run(game, 90);
    expect(num(game, "instances('Crate')[0].y")).toBeCloseTo(64, 0); // landed on the platform (its top is 80)
    py(game, "instances('Crate')[1].vspeed = -7");
    run(game, 60);
    expect(num(game, "instances('Crate')[1].y")).toBeCloseTo(64, 0); // up through it, then landed on it
    py(game, "instances('Crate')[0].drop_through = 10");
    run(game, 90);
    expect(num(game, "instances('Crate')[0].y")).toBeCloseTo(128, 0); // through, onto the floor
  });

  it("walls are only where solid tiles are: under a ledge is open", async () => {
    const level = ["", "", "", "#####", "", "", "", "", "", "####################"];
    const { game } = await room(level, [{ object: "Crate", x: 32, y: 80 }], { Crate: PHYS });
    run(game, 90);
    expect(num(game, "instances('Crate')[0].y")).toBeCloseTo(128, 0); // fell from under the ledge to the floor
  });

  it("walls follow tile_set", async () => {
    const { game } = await room(FLOOR, [{ object: "Crate", x: 40, y: 100 }], { Crate: PHYS });
    run(game, 60);
    py(game, "tile_set(40, 150, None, 'Ground'); tile_set(56, 150, None, 'Ground')");
    run(game, 40);
    expect(num(game, "instances('Crate')[0].y")).toBeGreaterThan(150); // fell through the hole
  });

  it("is not moved while the game is paused, and a new room starts a new world", async () => {
    const { game } = await load({
      tilesets: TILES,
      code: { Crate: `class Crate(GameObject):\n${PHYS}` },
      instances: [],
      rooms: [
        { name: "A", width: 320, height: 160, instances: [{ object: "Crate", x: 40, y: 20 }] },
        { name: "B", width: 320, height: 160, instances: [{ object: "Crate", x: 40, y: 20 }] },
      ],
    });
    run(game, 10);
    py(game, "game_pause()");
    const y = num(game, "instances('Crate')[0].y");
    run(game, 10);
    expect(num(game, "instances('Crate')[0].y")).toBe(y);
    py(game, "game_pause(False); physics_join(instances('Crate')[0], None, 'rope', 40, 0)");
    expect(game.engine.physics.jointCount).toBe(1);
    py(game, "room_goto('B')");
    run(game, 2);
    expect(game.engine.physics.jointCount).toBe(0);
    expect(num(game, "instances('Crate')[0].y")).toBeLessThan(25);
  });
});
