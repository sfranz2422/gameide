/**
 * Phase 12c in the real Pyodide: pausing, camera zoom, and rooms that
 * remember how they were left. (Parallax across and down is the
 * renderer's: e2e/view.editor.spec.ts reads the picture.)
 */
import { describe, expect, it } from "vitest";
import type { TilesetDef } from "../engine/game";
import { key, load, py, run } from "./testkit";

describe("game_pause", () => {
  const game = () =>
    load({
      code: {
        Mover: `class Mover(GameObject):
    def on_create(self):
        self.steps = 0
        self.hspeed = 2
        self.image_speed = 1
        self.alarm[0] = 5
        self.rang = False
    def on_step(self):
        self.steps += 1
    def on_alarm_0(self):
        self.rang = True
    def on_key_pressed_space(self):
        global_vars.mover_key = True
    def on_draw(self):
        global_vars.draws = getattr(global_vars, "draws", 0) + 1
        draw_self()
`,
        Menu: `class Menu(GameObject):
    def on_create(self):
        self.steps = 0
        self.ignore_pause = True
        self.hspeed = 1
    def on_step(self):
        self.steps += 1
    def on_key_pressed_space(self):
        global_vars.menu_key = True
`,
      },
      objects: [{ name: "Mover", sprite: "anim" }, { name: "Menu", sprite: "box" }],
      instances: [{ object: "Mover", x: 0, y: 0 }, { object: "Menu", x: 0, y: 50 }],
    });

  it("stops everything that doesn't ignore it: moving, animating, alarms, events", async () => {
    const { game: g } = await game();
    run(g, 1);
    py(g, "game_pause()");
    const before = py(g, "m = instances('Mover')[0]; (m.x, m.image_index, m.steps)") as unknown as number[];
    run(g, 10);
    expect(py(g, "game_paused()")).toBe(true);
    expect(py(g, "m = instances('Mover')[0]; (m.x, m.image_index, m.steps)")).toEqual(before);
    expect(py(g, "instances('Mover')[0].rang")).toBe(false); // its alarm waits
    expect(py(g, "global_vars.draws")).toBe(11); // still drawn, every step
    py(g, "game_pause(False)");
    run(g, 10);
    expect(py(g, "instances('Mover')[0].x")).toBeGreaterThan(before[0]!);
    expect(py(g, "instances('Mover')[0].rang")).toBe(true);
  });

  it("keeps running what ignores it — its steps, moving and keys", async () => {
    const { game: g } = await game();
    run(g, 1);
    py(g, "game_pause()");
    const x = py(g, "instances('Menu')[0].x") as number;
    g.engine.input.keyDown(key("space"));
    run(g, 5);
    expect(py(g, "instances('Menu')[0].steps")).toBe(6);
    expect(py(g, "instances('Menu')[0].x")).toBe(x + 5);
    expect(py(g, "getattr(global_vars, 'menu_key', False)")).toBe(true);
    expect(py(g, "getattr(global_vars, 'mover_key', False)")).toBe(false);
  });

  it("freezes particles and tweens, and game_restart starts unpaused", async () => {
    const { game: g } = await game();
    py(g, "particles(10, 10, count=5, life=50)");
    py(g, "tween(instances('Mover')[0], 'y', 100, 20)");
    run(g, 2);
    py(g, "game_pause()");
    const life = g.engine.effects.life[0];
    const y = py(g, "instances('Mover')[0].y");
    run(g, 5);
    expect(g.engine.effects.life[0]).toBe(life);
    expect(py(g, "instances('Mover')[0].y")).toBe(y);
    py(g, "game_restart()");
    run(g, 1);
    expect(py(g, "game_paused()")).toBe(false);
  });
});

describe("camera_zoom", () => {
  const zoomed = () =>
    load({
      code: { Dot: "class Dot(GameObject):\n    pass\n" },
      rooms: [{ name: "R", width: 1000, height: 1000, instances: [{ object: "Dot", x: 500, y: 500 }], camera: { width: 200, height: 100, smoothing: 1, follow: "Dot" } }],
    });

  it("shows less of the room, about the middle, at once or over some steps", async () => {
    const { game: g } = await zoomed();
    run(g, 2);
    expect(py(g, "(view_x, view_y, view_width, view_height)")).toEqual([400, 450, 200, 100]);
    py(g, "camera_zoom(2)");
    run(g, 2);
    expect(py(g, "(view_x, view_y, view_width, view_height)")).toEqual([450, 475, 100, 50]); // the Dot still in the middle
    py(g, "camera_zoom(0.5, 10)");
    run(g, 3);
    const w = py(g, "view_width") as number;
    expect(w).toBeGreaterThan(100);
    expect(w).toBeLessThan(400);
    run(g, 10);
    expect(py(g, "view_width")).toBe(400);
    expect(() => py(g, "camera_zoom(0)")).toThrow(/above 0/);
  });

  it("keeps the middle of a view that follows nothing where it was", async () => {
    const { game: g } = await load({
      code: { Dot: "class Dot(GameObject):\n    pass\n" },
      rooms: [{ name: "R", width: 1000, height: 1000, instances: [], camera: { width: 200, height: 100, smoothing: 1 } }],
    });
    py(g, "camera_set(100, 100)");
    run(g, 1);
    py(g, "camera_zoom(2)");
    run(g, 2);
    expect(py(g, "(view_x, view_y, view_width, view_height)")).toEqual([150, 125, 100, 50]); // the middle stays at (200, 150)
  });

  it("puts the mouse where it is in the zoomed room", async () => {
    const { game: g } = await zoomed();
    py(g, "camera_zoom(2)");
    run(g, 2);
    g.engine.input.mouseMove(100, 50); // the middle of the 200 × 100 window
    run(g, 1);
    expect(py(g, "(mouse_x, mouse_y)")).toEqual([500, 500]);
  });
});

describe("persistent rooms", () => {
  const TS: TilesetDef[] = [{ name: "t", tileWidth: 16, tileHeight: 16, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0, columns: 2, count: 2, solid: [0] }];
  const visit = (persistent: boolean) =>
    load({
      tilesets: TS,
      code: {
        Thing: `class Thing(GameObject):
    def on_create(self):
        global_vars.made = getattr(global_vars, "made", 0) + 1
        self.note = "new"
    def on_room_start(self):
        global_vars.starts = getattr(global_vars, "starts", 0) + 1
`,
      },
      rooms: [
        { name: "A", width: 64, height: 64, persistent, instances: [{ object: "Thing", x: 10, y: 10 }, { object: "Thing", x: 40, y: 10 }],
          tileLayers: [{ name: "G", depth: 0, visible: true, tileset: "t", columns: 4, rows: 4, cells: new Array(16).fill(-1) }] },
        { name: "B", width: 64, height: 64, instances: [] },
      ],
    });
  const there = (g: Awaited<ReturnType<typeof visit>>["game"]) => py(g, "sorted((t.x, t.y, t.note) for t in instances('Thing'))");

  it("are as they were left: moved, changed, destroyed and tiles — and Create doesn't run again", async () => {
    const { game: g } = await visit(true);
    run(g, 1);
    py(g, "a, b = instances('Thing'); a.x = 20; a.note = 'moved'; b.destroy(); tile_set(0, 0, 0); global_vars.kept = a");
    run(g, 1);
    py(g, "room_goto('B')");
    run(g, 2);
    expect(py(g, "len(instances('Thing'))")).toBe(0);
    expect(py(g, "global_vars.kept.x")).toBe(20); // a reference to a parked one still reads where it was
    py(g, "room_goto('A')");
    run(g, 2);
    expect(there(g), JSON.stringify(py(g, "[(t.x, t.y, t.note, t._slot) for t in instances('Thing')]"))).toEqual([[20, 10, "moved"]]);
    expect(py(g, "tile_at(0, 0)")).toBe(0);
    expect(py(g, "global_vars.made")).toBe(2); // the two first made, none since
    expect(py(g, "global_vars.starts")).toBe(3); // Room Start ran again on the way back
    expect(py(g, "global_vars.kept is instances('Thing')[0] and global_vars.kept.x == 20")).toBe(true); // the same instance
    py(g, "global_vars.kept.x += 1"); // and it moves the real one
    expect(there(g)).toEqual([[21, 10, "moved"]]);
  });

  it("a room that isn't persistent, room_restart and game_restart all start afresh", async () => {
    const { game: g } = await visit(false);
    run(g, 1);
    py(g, "instances('Thing')[0].destroy()");
    py(g, "room_goto('B')");
    run(g, 2);
    py(g, "room_goto('A')");
    run(g, 2);
    expect(py(g, "len(instances('Thing'))")).toBe(2);

    const { game: p } = await visit(true);
    run(p, 1);
    py(p, "instances('Thing')[0].destroy(); tile_set(0, 0, 0)");
    py(p, "room_restart()");
    run(p, 2);
    expect(py(p, "(len(instances('Thing')), tile_at(0, 0))")).toEqual([2, undefined]);
    py(p, "instances('Thing')[0].destroy()");
    py(p, "room_goto('B')");
    run(p, 2);
    py(p, "game_restart()");
    run(p, 2);
    expect(py(p, "len(instances('Thing'))")).toBe(2);
  });
});

describe("room_name", () => {
  it("is the room the game is in now", async () => {
    const { game } = await load({
      code: { Thing: "class Thing(GameObject):\n    pass\n" },
      rooms: [
        { name: "Title", width: 100, height: 100, instances: [] },
        { name: "Level", width: 100, height: 100, instances: [] },
      ],
    });
    expect(py(game, "room_name()")).toBe("Title");
    py(game, "room_goto('Level')");
    run(game);
    expect(py(game, "room_name()")).toBe("Level");
  });
});
