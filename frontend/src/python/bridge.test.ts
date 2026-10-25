/**
 * The bridge, end to end, in the real Pyodide: Python's view of an instance
 * and the engine's are the same memory, events run in GameMaker's order,
 * and every way a student's code can fail reaches the IDE in words.
 */
import { describe, expect, it } from "vitest";
import { F, G, STRIDE } from "../engine/layout";
import { key, load, py, run } from "./testkit";

const one = (cls: string, body: string) => `class ${cls}(GameObject):\n${body}`;

describe("shared state", () => {
  // If layout.ts and runtime.py ever disagreed, self.x would quietly read
  // another field. This writes each property from Python and reads the
  // field from JavaScript, and the other way round.
  it("every built-in property is its own field of the shared array", async () => {
    const { game } = await load({ code: { A: one("A", "    pass\n") }, instances: [{ object: "A", x: 1, y: 2 }] });
    const pairs: [string, number][] = [
      ["x", F.X], ["y", F.Y], ["xprevious", F.XPREV], ["yprevious", F.YPREV],
      ["hspeed", F.HSPEED], ["vspeed", F.VSPEED], ["speed", F.SPEED], ["direction", F.DIRECTION],
      ["gravity", F.GRAVITY], ["gravity_direction", F.GRAVITY_DIR], ["friction", F.FRICTION],
      ["image_index", F.IMAGE_INDEX], ["image_speed", F.IMAGE_SPEED],
      ["image_xscale", F.XSCALE], ["image_yscale", F.YSCALE], ["image_angle", F.ANGLE],
      ["image_alpha", F.ALPHA], ["depth", F.DEPTH],
    ];
    const slot = py(game, "instances('A')[0]._slot") as number;
    for (const [name, field] of pairs) {
      py(game, `instances('A')[0].${name} = 41.5`);
      expect(game.engine.fresh().st[slot * STRIDE + field], `writing ${name}`).toBe(41.5);
      game.engine.fresh().st[slot * STRIDE + field] = 7.25;
      expect(py(game, `instances('A')[0].${name}`), `reading ${name}`).toBe(7.25);
    }
    for (const [name, field] of [["visible", F.VISIBLE], ["solid", F.SOLID]] as const) {
      py(game, `instances('A')[0].${name} = False`);
      expect(game.engine.fresh().st[slot * STRIDE + field]).toBe(0);
      py(game, `instances('A')[0].${name} = True`);
      expect(game.engine.fresh().st[slot * STRIDE + field]).toBe(1);
    }
    py(game, "instances('A')[0].alarm[5] = 9");
    expect(game.engine.fresh().st[slot * STRIDE + F.ALARM0 + 5]).toBe(9);
    py(game, "instances('A')[0].sprite = 'big'");
    expect(game.engine.fresh().st[slot * STRIDE + F.SPRITE]).toBe(1);
    expect(py(game, "instances('A')[0].sprite")).toBe("big");
  });

  it("speed/direction and hspeed/vspeed stay two views of one motion", async () => {
    const { game } = await load({ code: { A: one("A", "    pass\n") }, instances: [{ object: "A", x: 0, y: 0 }] });
    py(game, "a = instances('A')[0]; a.direction = 90; a.speed = 2");
    expect(py(game, "(a.hspeed, a.vspeed)")).toEqual([0, -2]);
    py(game, "a.hspeed = 3; a.vspeed = 4");
    expect(py(game, "a.speed")).toBe(5);
    expect(py(game, "round(a.direction, 2)")).toBe(306.87);
  });

  it("the engine applies speed, gravity and friction after the step", async () => {
    const { game } = await load({
      code: {
        A: one("A", "    def on_create(self):\n        self.hspeed = 2\n"),
        G: one("G", "    def on_create(self):\n        self.gravity = 0.5\n        self.gravity_direction = 270\n"),
        R: one("R", "    def on_create(self):\n        self.hspeed = 2.5\n        self.friction = 1\n"),
      },
      instances: [{ object: "A", x: 0, y: 0 }, { object: "G", x: 0, y: 0 }, { object: "R", x: 0, y: 0 }],
    });
    run(game, 3);
    expect(py(game, "instances('A')[0].x")).toBe(6);
    // Gravity accumulates: vspeed 0.5, 1.0, 1.5 → y 0.5 + 1 + 1.5.
    expect(py(game, "instances('G')[0].y")).toBe(3);
    expect(py(game, "instances('G')[0].vspeed")).toBe(1.5);
    // Friction: 2.5 → 1.5 → 0.5 → 0. The last step takes off only what is
    // left; taking the whole 1 would send it backwards at 0.5.
    expect(py(game, "instances('R')[0].x")).toBe(1.5 + 0.5 + 0);
    run(game, 2);
    expect(py(game, "instances('R')[0].hspeed")).toBe(0);
    expect(py(game, "instances('R')[0].x")).toBe(2);
  });
});

describe("events", () => {
  it("run in GameMaker's order within one step", async () => {
    const rec = (name: string) => `    def ${name}(self, *a):\n        global_vars.log.append("${name}")\n`;
    const { game } = await load({
      code: {
        Rec: `class Rec(GameObject):\n    def on_create(self):\n        global_vars.log = []\n        self.alarm[0] = 1\n` +
          ["on_begin_step", "on_alarm_0", "on_key_down_right", "on_step", "on_collision_other", "on_end_step", "on_draw"]
            .map(rec).join(""),
        Other: one("Other", "    pass\n"),
      },
      instances: [{ object: "Rec", x: 0, y: 0 }, { object: "Other", x: 4, y: 4 }],
    });
    game.engine.input.keyDown(key("right"));
    run(game, 1);
    expect(py(game, "global_vars.log")).toEqual([
      "on_begin_step", "on_alarm_0", "on_key_down_right", "on_step", "on_collision_other", "on_end_step", "on_draw",
    ]);
  });

  it("an alarm set to 3 fires on the third step, and 0 never fires", async () => {
    const { game } = await load({
      code: {
        A: one("A", `    def on_create(self):
        self.alarm[0] = 3
        self.alarm[1] = 0
        self.fired = []
        self.steps = 0
    def on_step(self):
        self.steps += 1
    def on_alarm_0(self):
        self.fired.append(("a0", self.steps + 1))
    def on_alarm_1(self):
        self.fired.append(("a1", self.steps + 1))
`),
      },
      instances: [{ object: "A", x: 0, y: 0 }],
    });
    run(game, 6);
    expect(py(game, "instances('A')[0].fired")).toEqual([["a0", 3]]);
    expect(py(game, "instances('A')[0].alarm[0]")).toBe(-1);
  });

  it("a parent's collision event fires for its children, unless the child has its own", async () => {
    const { game } = await load({
      objects: [
        { name: "Enemy", sprite: "box" },
        { name: "Goblin", sprite: "box", parent: "Enemy" },
        { name: "Orc", sprite: "box", parent: "Enemy" },
        { name: "Hero", sprite: "big" },
      ],
      code: {
        Hero: one("Hero", `    def on_create(self):
        self.hits = []
    def on_collision_enemy(self, other):
        self.hits.append(("enemy", other.object_name))
    def on_collision_goblin(self, other):
        self.hits.append(("goblin", other.object_name))
`),
      },
      instances: [
        { object: "Hero", x: 0, y: 0 },
        { object: "Goblin", x: 4, y: 4 },
        { object: "Orc", x: 10, y: 10 },
        { object: "Enemy", x: 200, y: 200 }, // far away: no event
      ],
    });
    run(game, 1);
    const hits = (py(game, "sorted(instances('Hero')[0].hits)") as string[][]).map((h) => h.join(":"));
    expect(hits).toEqual(["enemy:Orc", "goblin:Goblin"]);
  });

  it("touching a solid instance puts the mover back before its collision event", async () => {
    const { game } = await load({
      objects: [{ name: "Wall", sprite: "big", solid: true }, { name: "P", sprite: "box" }],
      code: {
        P: one("P", `    def on_create(self):
        self.hspeed = 8
        self.seen = None
    def on_collision_wall(self, other):
        self.seen = (self.x, self.xprevious)
`),
      },
      instances: [{ object: "P", x: 10, y: 0 }, { object: "Wall", x: 32, y: 0 }],
    });
    run(game, 1); // 10 → 18: right edge 34 overlaps the wall at 32
    expect(py(game, "instances('P')[0].seen")).toEqual([10, 10]);
  });

  it("outside room fires once when an instance leaves, not every step", async () => {
    const { game } = await load({
      code: {
        B: one("B", `    def on_create(self):
        self.hspeed = -5
        self.outs = 0
    def on_outside_room(self):
        self.outs += 1
`),
      },
      instances: [{ object: "B", x: 2, y: 50 }],
    });
    run(game, 20);
    expect(py(game, "instances('B')[0].outs")).toBe(1);
  });

  it("animation end fires as the last frame wraps", async () => {
    const { game } = await load({
      objects: [{ name: "S", sprite: "anim" }],
      code: { S: one("S", "    def on_create(self):\n        self.ends = 0\n    def on_animation_end(self):\n        self.ends += 1\n") },
      instances: [{ object: "S", x: 50, y: 50 }],
    });
    run(game, 3);
    expect(py(game, "instances('S')[0].ends")).toBe(0);
    run(game, 1);
    expect(py(game, "instances('S')[0].ends")).toBe(1);
    expect(py(game, "instances('S')[0].image_index")).toBe(0);
  });

  it("a key tapped between two steps is pressed for exactly one step", async () => {
    const { game } = await load({
      code: {
        K: one("K", `    def on_create(self):
        self.seen = []
    def on_step(self):
        self.seen.append((keyboard_check("space"), keyboard_check_pressed("space"), keyboard_check_released("space")))
`),
      },
      instances: [{ object: "K", x: 0, y: 0 }],
    });
    game.engine.input.keyDown(key("space"));
    game.engine.input.keyUp(key("space"));
    run(game, 2);
    expect(py(game, "instances('K')[0].seen")).toEqual([[false, true, true], [false, false, false]]);
  });

  it("clicking an instance runs its mouse event; clicking elsewhere does not", async () => {
    const { game } = await load({
      code: {
        Btn: one("Btn", `    def on_create(self):
        self.clicks = 0
        global_vars.anywhere = 0
    def on_mouse_left_pressed(self):
        self.clicks += 1
    def on_global_mouse_left_pressed(self):
        global_vars.anywhere += 1
`),
      },
      instances: [{ object: "Btn", x: 100, y: 100 }],
    });
    const input = game.engine.input;
    input.mouseX = 105;
    input.mouseY = 105;
    input.mouseDown(0);
    run(game, 1);
    input.mouseUp(0);
    input.mouseX = 10;
    input.mouseDown(0);
    run(game, 1);
    expect(py(game, "instances('Btn')[0].clicks")).toBe(1);
    expect(py(game, "global_vars.anywhere")).toBe(2);
  });

  it("Draw events send drawing to the engine; an object with one is drawn only by draw_self", async () => {
    const { game } = await load({
      objects: [{ name: "D", sprite: "box", depth: 5 }],
      code: {
        D: one("D", `    def on_draw(self):
        draw_set_color("red")
        draw_text(1, 2, "hi")
        draw_self()
`),
      },
      instances: [{ object: "D", x: 0, y: 0 }],
    });
    run(game, 1);
    expect(game.engine.drawList).toEqual([["text", 5, 1, 2, "hi", 0xff0000]]);
    const slot = py(game, "instances('D')[0]._slot") as number;
    expect(game.engine.fresh().st[slot * STRIDE + F.DRAWN]).toBe(1);
  });
});

describe("collisions", () => {
  // The reason the dirty list exists: a query must see where things are
  // now, not where they were when the step began.
  it("place_meeting sees an instance moved earlier in the same step", async () => {
    const { game } = await load({
      code: {
        A: one("A", `    def on_step(self):
        b = instances("B")[0]
        b.x = self.x + 4
        global_vars.hit = place_meeting(self.x, self.y, "B")
`),
        B: one("B", "    pass\n"),
      },
      instances: [{ object: "A", x: 0, y: 0 }, { object: "B", x: 200, y: 0 }],
    });
    run(game, 1);
    expect(py(game, "global_vars.hit")).toBe(true);
  });

  it("move_and_collide stops flush against a wall and reports it", async () => {
    const { game } = await load({
      objects: [{ name: "Wall", sprite: "big", solid: true }, { name: "P", sprite: "box" }],
      code: {
        P: one("P", `    def on_step(self):
        global_vars.hits = [h.object_name for h in move_and_collide(30, 0, "Wall")]
`),
      },
      instances: [{ object: "P", x: 0, y: 0 }, { object: "Wall", x: 40, y: 0 }],
    });
    run(game, 1);
    expect(py(game, "instances('P')[0].x")).toBe(24); // right edge 40 = the wall's left edge
    expect(py(game, "global_vars.hits")).toEqual(["Wall"]);
    run(game, 1);
    expect(py(game, "instances('P')[0].x")).toBe(24);
  });

  it("place_free, instance_place, collision_point and instance_nearest", async () => {
    const { game } = await load({
      objects: [{ name: "Wall", sprite: "big", solid: true }, { name: "P", sprite: "box" }],
      code: {
        P: one("P", `    def on_step(self):
        if self.x != 0:
            return
        global_vars.r = (
            place_free(0, 0),
            place_free(30, 0),
            instance_place(30, 0, "Wall") is instances("Wall")[0],
            instance_place(0, 0, "Wall"),
            collision_point(50, 10, "Wall") is not None,
            collision_point(39, 10, "Wall"),
            instance_nearest(0, 0, "P").x,
        )
`),
      },
      instances: [{ object: "P", x: 0, y: 0 }, { object: "P", x: 100, y: 100 }, { object: "Wall", x: 40, y: 0 }],
    });
    run(game, 1);
    const r = py(game, "global_vars.r") as unknown[];
    expect(r.slice(0, 6)).toEqual([true, false, true, undefined, true, undefined]);
    // Asked from where it stands, the nearest P is the asker itself — but
    // instance_nearest never answers the instance asking.
    expect(r[6]).toBe(100);
  });
});

describe("sprites in the game", () => {
  it("image_angle turns the collision mask", async () => {
    // A 40 × 4 bar with its origin at the left end; a block straight above that end.
    const { game } = await load({
      objects: [{ name: "Bar", sprite: "bar" }, { name: "Block", sprite: "box" }],
      code: { Bar: one("Bar", "    pass\n") },
      instances: [{ object: "Bar", x: 100, y: 100 }, { object: "Block", x: 98, y: 70 }],
      sprites: [{ name: "bar", width: 40, height: 4, originX: 0, originY: 2, frameCount: 1 }],
    });
    expect(py(game, "instances('Bar')[0].place_meeting(100, 100, 'Block')")).toBe(false);
    py(game, "instances('Bar')[0].image_angle = 90"); // now it points up, into the block
    expect(py(game, "instances('Bar')[0].place_meeting(100, 100, 'Block')")).toBe(true);
  });

  it("a sprite's own speed sets how fast it animates", async () => {
    const { game } = await load({
      objects: [{ name: "S", sprite: "walk" }],
      code: { S: one("S", "    pass\n") },
      instances: [{ object: "S", x: 0, y: 0 }],
      sprites: [{ name: "walk", width: 8, height: 8, originX: 0, originY: 0, frameCount: 4, fps: 15 }],
    });
    run(game, 8); // 15 fps at 60 steps a second: a frame every 4 steps
    expect(py(game, "instances('S')[0].image_index")).toBe(2);
    py(game, "instances('S')[0].image_speed = 2");
    run(game, 2);
    expect(py(game, "instances('S')[0].image_index")).toBe(3);
  });

  it("collision events use the shapes: two circles whose boxes touch but which don't, don't collide", async () => {
    const ball = { name: "ballmask", width: 20, height: 20, originX: 10, originY: 10, frameCount: 1, mask: { kind: "circle" as const, cx: 10, cy: 10, r: 10 } };
    const { game } = await load({
      objects: [{ name: "A", sprite: "ballmask" }, { name: "B", sprite: "ballmask" }],
      code: { A: one("A", "    def on_create(self):\n        self.hits = 0\n    def on_collision_b(self, other):\n        self.hits += 1\n") },
      // 16 px apart on both axes: the boxes overlap by 4 px, the circles are 22.6 px apart.
      instances: [{ object: "A", x: 100, y: 100 }, { object: "B", x: 116, y: 116 }],
      sprites: [ball],
    });
    run(game, 1);
    expect(py(game, "instances('A')[0].hits")).toBe(0);
    py(game, "instances('B')[0].x = 110; instances('B')[0].y = 105");
    run(game, 1);
    expect(py(game, "instances('A')[0].hits")).toBe(1);
  });

  it("an exact-pixel mask collides only where the picture is drawn", async () => {
    // A 12 × 12 ring, 2 px thick: inside the hole is not a collision.
    const ring = new Uint8Array(144);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (x < 2 || x > 9 || y < 2 || y > 9) ring[y * 12 + x] = 1;
    const sprites = [
      { name: "ring", width: 12, height: 12, originX: 0, originY: 0, frameCount: 1, mask: { kind: "precise" as const, left: 0, top: 0, right: 12, bottom: 12 }, pixelMasks: [ring] },
      { name: "dot", width: 2, height: 2, originX: 0, originY: 0, frameCount: 1 },
    ];
    const { game } = await load({
      objects: [{ name: "Ring", sprite: "ring" }, { name: "Dot", sprite: "dot" }],
      code: { Dot: one("Dot", "    pass\n") },
      instances: [{ object: "Ring", x: 50, y: 50 }, { object: "Dot", x: 0, y: 0 }],
      sprites,
    });
    expect(py(game, "instances('Dot')[0].place_meeting(55, 55, 'Ring')")).toBe(false); // in the hole
    expect(py(game, "instances('Dot')[0].place_meeting(50, 55, 'Ring')")).toBe(true); // on the rim
  });
});

describe("instances", () => {
  it("a destroyed instance keeps reading its own values after its slot is reused", async () => {
    const { game } = await load({
      objects: [{ name: "Thing", sprite: "box" }, { name: "Maker" }],
      code: {
        Maker: one("Maker", `    def on_create(self):
        t = instance_create(50, 60, "Thing")
        global_vars.slot = t._slot
        global_vars.old = t
        t.destroy()
`),
      },
      instances: [{ object: "Maker", x: 0, y: 0 }],
    });
    run(game, 1);
    py(game, "global_vars.new = instance_create(200, 210, 'Thing')");
    expect(py(game, "global_vars.new._slot == global_vars.slot")).toBe(true);
    expect(py(game, "(global_vars.old.x, global_vars.old.y)")).toEqual([50, 60]);
    expect(py(game, "instance_exists(global_vars.old)")).toBe(false);
    expect(py(game, "instance_number('Thing')")).toBe(1);
  });

  it("thousands of instances: the arrays grow and queries still work", async () => {
    const { game } = await load({
      objects: [{ name: "Dot", sprite: "box" }, { name: "Spawner" }],
      code: {
        Spawner: one("Spawner", `    def on_create(self):
        for i in range(1500):
            instance_create((i % 50) * 20, (i // 50) * 20, "Dot")
    def on_step(self):
        last = instances("Dot")[-1]
        global_vars.found = collision_point(last.x + 1, last.y + 1, "Dot") is last
`),
      },
      instances: [{ object: "Spawner", x: 0, y: 0 }],
    });
    run(game, 2);
    expect(game.engine.instanceCount()).toBe(1501);
    expect(py(game, "global_vars.found")).toBe(true);
  });

  // A Python allocation can grow the WebAssembly memory, which detaches
  // every view the engine holds. Without Engine.fresh() re-taking them, the
  // engine would read zeros and write nowhere, and nothing would move.
  it("the engine keeps working after Python's memory grows", async () => {
    const { game } = await load({
      code: { M: one("M", "    def on_create(self):\n        self.hspeed = 1\n") },
      instances: [{ object: "M", x: 0, y: 0 }],
    });
    run(game, 1);
    const before = game.engine.views.st;
    py(game, "_big = bytearray(64 * 1024 * 1024)");
    expect(before.length).toBe(0); // the old view really did go stale
    run(game, 1);
    expect(py(game, "instances('M')[0].x")).toBe(2);
  });

  it("room changes keep persistent instances and rebuild the rest", async () => {
    const { game } = await load({
      objects: [{ name: "Keeper", persistent: true }, { name: "Temp" }, { name: "New" }],
      code: {
        Keeper: one("Keeper", `    def on_game_start(self):
        global_vars.starts = 0
        global_vars.cleanups = 0
    def on_room_start(self):
        global_vars.starts += 1
    def on_step(self):
        if keyboard_check_pressed("n"):
            room_goto("Second")
        if keyboard_check_pressed("r"):
            game_restart()
`),
        Temp: one("Temp", "    def on_cleanup(self):\n        global_vars.cleanups += 1\n    def on_destroy(self):\n        global_vars.destroyed = True\n"),
      },
      rooms: [
        { name: "First", width: 320, height: 240, instances: [{ object: "Keeper", x: 0, y: 0 }, { object: "Temp", x: 0, y: 0 }] },
        { name: "Second", width: 500, height: 400, instances: [{ object: "New", x: 0, y: 0 }] },
      ],
    });
    run(game, 1);
    game.engine.input.keyDown(key("n"));
    run(game, 1);
    expect(game.engine.roomIndex).toBe(1);
    expect(py(game, "[o.object_name for o in instances('Keeper') + instances('Temp') + instances('New')]")).toEqual(["Keeper", "New"]);
    expect(py(game, "(global_vars.starts, global_vars.cleanups, hasattr(global_vars, 'destroyed'))")).toEqual([2, 1, false]);
    expect(py(game, "room_width")).toBe(500);
    expect(game.engine.fresh().g[G.ROOM_WIDTH]).toBe(500);

    game.engine.input.keyUp(key("n"));
    game.engine.input.keyDown(key("r"));
    run(game, 1);
    expect(game.engine.roomIndex).toBe(0);
    expect(py(game, "(global_vars.starts, instance_number('Keeper'), instance_number('Temp'))")).toEqual([1, 1, 1]);
  });
});

describe("errors and warnings", () => {
  it("a runtime error names the object, the event and the line, and stops the game", async () => {
    const { game } = await load({
      code: { Bad: "class Bad(GameObject):\n    def on_step(self):\n        self.x += spead\n" },
      instances: [{ object: "Bad", x: 0, y: 0 }],
    });
    const e = game.step();
    expect(e).toMatchObject({ kind: "object", object: "Bad", event: "on_step", line: 3 });
    expect(e!.message).toMatch(/^NameError: name 'spead' is not defined/);
    expect(e!.traceback).toContain("self.x += spead");
    expect(e!.traceback).not.toContain("gameide.py"); // the runtime's own frames are hidden
    expect(game.isStopped).toBe(true);
    expect(game.step()).toBeNull();
  });

  it("an error inside a script says it was the script", async () => {
    const { game } = await load({
      scripts: { helpers: "def jump(inst):\n    inst.vspeed = -height\n" },
      code: { P: one("P", "    def on_step(self):\n        jump(self)\n") },
      instances: [{ object: "P", x: 0, y: 0 }],
    });
    expect(game.step()).toMatchObject({ kind: "script", object: "helpers", event: "jump", line: 2 });
  });

  it("a syntax error stops the game loading and names the object and line", async () => {
    const { error } = await load({
      code: { Bad: "class Bad(GameObject):\n    def on_step(self)\n        pass\n" },
    });
    expect(error).toMatchObject({ kind: "object", object: "Bad", line: 2 });
    expect(error!.message).toMatch(/SyntaxError/);
  });

  it("misspelt events and drawing outside on_draw are warned about, once", async () => {
    const { game, warnings } = await load({
      objects: [{ name: "Coin", sprite: "box" }, { name: "P", sprite: "box" }],
      code: {
        P: one("P", `    def on_stepp(self):
        pass
    def on_collision_coyn(self, other):
        pass
    def on_step(self):
        draw_text(0, 0, "nope")
`),
      },
      instances: [{ object: "P", x: 0, y: 0 }],
    });
    run(game, 5);
    expect(warnings).toHaveLength(3);
    expect(warnings.join("\n")).toContain('on_stepp, which is not an event, so it never runs. Did you mean "on_step"');
    expect(warnings.join("\n")).toContain('no object called "coyn". Did you mean "coin"');
    expect(warnings.join("\n")).toContain("draw_text() only draws inside an on_draw event");
  });

  it("naming an object, key or sprite that doesn't exist says what was meant", async () => {
    const { game } = await load({
      objects: [{ name: "Wall", sprite: "box" }, { name: "P", sprite: "box" }],
      code: { P: one("P", "    def on_step(self):\n        place_meeting(0, 0, 'Wal')\n") },
      instances: [{ object: "P", x: 0, y: 0 }],
    });
    expect(game.step()!.message).toBe('NameError: There is no object called "Wal". Did you mean "Wall"?');
    expect(() => py(game, "keyboard_check('lefft')")).toThrow(/Did you mean "left"/);
    expect(() => py(game, "instances('P')[0].__setattr__('sprite', 'boxx')")).toThrow(/no sprite called "boxx". Did you mean "box"/);
  });
});

describe("performance", () => {
  // The spec's target is 300+ instances with simple step events at 60 fps,
  // which leaves 16.7 ms a frame for everything including drawing. Node is
  // faster than a Chromebook, so this asks for far less than that budget:
  // it is here to catch a change that makes every step, say, copy the
  // state across the bridge.
  it("300 instances with a Step event take well under a frame's budget", async () => {
    const { game } = await load({
      objects: [{ name: "Ball", sprite: "box" }, { name: "Spawner" }],
      code: {
        Ball: one("Ball", `    def on_create(self):
        self.hspeed = 2
        self.vspeed = 1.5
    def on_step(self):
        if self.x < 0 or self.x > room_width:
            self.hspeed = -self.hspeed
        if self.y < 0 or self.y > room_height:
            self.vspeed = -self.vspeed
`),
        Spawner: one("Spawner", "    def on_create(self):\n        for i in range(300):\n            instance_create(i % 300, i % 200, 'Ball')\n"),
      },
      instances: [{ object: "Spawner", x: 0, y: 0 }],
    });
    run(game, 30); // warm up
    const t0 = performance.now();
    run(game, 120);
    const ms = (performance.now() - t0) / 120;
    console.log(`300 instances: ${ms.toFixed(2)} ms per step`);
    expect(ms).toBeLessThan(5);
  });
});
