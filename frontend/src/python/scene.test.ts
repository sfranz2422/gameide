/**
 * Cutscenes, step by step in the real Pyodide: scene_ calls play one after
 * another while the game holds still, Esc plays the rest instantly, and a scene
 * leaves the game as it found it.
 */
import { describe, expect, it } from "vitest";
import { key, load, py, run } from "./testkit";

const game = (body = "    pass\n", extra = {}) =>
  load({
    code: {
      A: `class A(GameObject):\n${body}`,
      B: "class B(GameObject):\n    def on_step(self):\n        global_vars.b_steps = getattr(global_vars, 'b_steps', 0) + 1\n",
    },
    instances: [{ object: "A", x: 100, y: 100 }, { object: "B", x: 300, y: 100 }],
    ...extra,
  });
const a = "instances('A')[0]";
const fade = (g: Parameters<typeof run>[0]) => (g.engine.guiList.find((c) => c[0] === "rect" && c[1] === -3e6) as number[] | undefined)?.[8] ?? 0;
const LONG = "Sixty years I have lit these lanterns in this valley, and they have never gone out, not even once, not in the worst of winters.";
/** The widest line of some words on the screen, in the built-in font (0.6 of its size a letter, headless). */
const widest = (c: unknown[]) => Math.max(...String(c[4]).split("\n").map((l) => l.length)) * (c[7] as number) * 0.6;
const longWords = (g: Parameters<typeof run>[0]) => g.engine.guiList.find((c) => c[0] === "text" && String(c[4]).startsWith("Sixty")) as unknown[];
/** What the dialogue box says just now: the name, if any, then the line. */
const boxSays = (g: Parameters<typeof run>[0]) => g.engine.guiList.filter((c) => c[0] === "text").map((c) => c[4]).join("|");
const press = (g: Parameters<typeof run>[0], k: string) => {
  g.engine.input.keyDown(key(k));
  run(g, 1);
  g.engine.input.keyUp(key(k));
};

describe("cutscenes", () => {
  it("a move gets there on time, smoothly, and the next step waits for it", async () => {
    const { game: g } = await game();
    py(g, `scene_move(${a}, 200, 150, 10); scene_move(${a}, 200, 50, 10)`);
    expect(py(g, "scene_playing()")).toBe(true);
    run(g, 6);
    const x = py(g, `${a}.x`) as number;
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(200);
    expect(py(g, `${a}.y`) as number).toBeGreaterThan(100);
    run(g, 6);
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
    run(g, 12);
    expect(py(g, `${a}.y`)).toBeCloseTo(50);
    run(g, 2);
    expect(py(g, "scene_playing()")).toBe(false);
  });

  it("the game holds still while it plays, and carries on after", async () => {
    const { game: g } = await game();
    run(g, 3);
    const before = py(g, "global_vars.b_steps") as number;
    py(g, "scene_wait(20)");
    run(g, 10);
    expect(py(g, "global_vars.b_steps")).toBe(before);
    expect(py(g, "game_paused()")).toBe(true);
    run(g, 15);
    expect(py(g, "game_paused()")).toBe(false);
    expect(py(g, "global_vars.b_steps") as number).toBeGreaterThan(before);
  });

  it("a game paused before the scene stays paused after it, and a pause menu can't start it under the scene", async () => {
    const { game: g } = await game();
    py(g, "game_pause(); scene_wait(5)");
    run(g, 10);
    expect(py(g, "scene_playing()")).toBe(false);
    expect(py(g, "game_paused()")).toBe(true);
    py(g, "game_pause(False); scene_wait(20)");
    run(g, 2);
    py(g, "game_pause(False)");
    run(g, 2);
    expect(py(g, "game_paused()")).toBe(true);
  });

  it("wait=False lets two walk together", async () => {
    const { game: g } = await game();
    py(g, `scene_move(${a}, 200, 100, 10, wait=False); scene_move(instances('B')[0], 400, 100, 10)`);
    run(g, 6);
    expect(py(g, `${a}.x`) as number).toBeGreaterThan(100);
    expect(py(g, "instances('B')[0].x") as number).toBeGreaterThan(300);
    run(g, 8);
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
    expect(py(g, "instances('B')[0].x")).toBeCloseTo(400);
    expect(py(g, "scene_playing()")).toBe(false);
  });

  it("a scene doesn't end before a move nothing waited for", async () => {
    const { game: g } = await game();
    py(g, `scene_move(${a}, 200, 100, 20, wait=False)`);
    run(g, 10);
    expect(py(g, "scene_playing()")).toBe(true);
    run(g, 14);
    expect(py(g, "scene_playing()")).toBe(false);
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
  });

  it("what it moves animates, though the game is paused", async () => {
    const { game: g } = await load({
      code: { A: "class A(GameObject):\n    pass\n" },
      objects: [{ name: "A", sprite: "anim" }],
      instances: [{ object: "A", x: 100, y: 100 }],
    });
    py(g, `scene_move(${a}, 200, 100, 30)`);
    const frames = new Set<number>();
    for (let i = 0; i < 8; i++) {
      run(g, 1);
      frames.add(Math.floor(py(g, `${a}.image_index`) as number));
    }
    expect(frames.size).toBeGreaterThan(2);
    expect(Math.max(...frames)).toBeLessThan(4);
  });

  it("says wait for the player, in order", async () => {
    const { game: g } = await game();
    py(g, `scene_say("One", "Robin"); scene_say("Two"); scene_move(${a}, 200, 100, 5)`);
    run(g, 40);
    expect(boxSays(g)).toContain("Robin");
    expect(boxSays(g)).toContain("One");
    run(g, 40);
    expect(boxSays(g)).toContain("One");
    press(g, "space");
    run(g, 40);
    expect(boxSays(g)).toContain("Two");
    expect(py(g, `${a}.x`)).toBe(100);
    press(g, "space");
    run(g, 8);
    expect(py(g, "dialogue_open()")).toBe(false);
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
    expect(py(g, "scene_playing()")).toBe(false);
  });

  it("a question waits for its answer, and answer() has it", async () => {
    const { game: g } = await game();
    py(g, `scene_ask("Open it?", ["Yes", "No"]); scene_move(${a}, 200, 100, 3)`);
    run(g, 40);
    expect(py(g, `${a}.x`)).toBe(100);
    press(g, "2");
    run(g, 8);
    expect(py(g, "answer()")).toBe("No");
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
  });

  it("Esc plays the rest instantly: everything it would have done is done", async () => {
    const { game: g } = await game();
    py(g, `
global_vars.done = []
scene_move(${a}, 200, 100, 100)
scene_say("Long speech")
scene_ask("Which?", ["First", "Second"], then=lambda c: global_vars.done.append(c))
scene_do(lambda: global_vars.done.append("did"))
scene_move(${a}, 500, 300, 100)
scene_fade(1, 500)
`);
    run(g, 4);
    press(g, "escape");
    expect(py(g, "scene_playing()")).toBe(false);
    expect(py(g, `${a}.x`)).toBe(500);
    expect(py(g, `${a}.y`)).toBe(300);
    expect(py(g, "global_vars.done")).toEqual(["First", "did"]);
    expect(py(g, "dialogue_open()")).toBe(false);
    expect(py(g, "answer()")).toBe("First");
    expect(py(g, "game_paused()")).toBe(false);
    run(g, 3);
    expect(fade(g)).toBe(1);
  });

  it("skipping in the middle of a say, or a move under way", async () => {
    const { game: g } = await game();
    py(g, `scene_say("Hello"); scene_move(${a}, 200, 100, 5)`);
    run(g, 3);
    press(g, "escape");
    expect(py(g, "dialogue_open()")).toBe(false);
    expect(py(g, `${a}.x`)).toBe(200);
  });

  it("a skip finishes a move that's under way", async () => {
    const { game: g } = await game();
    py(g, `scene_move(${a}, 200, 150, 50)`);
    run(g, 5);
    expect(py(g, `${a}.x`) as number).toBeLessThan(200);
    press(g, "escape");
    expect(py(g, `${a}.x`)).toBe(200);
    expect(py(g, `${a}.y`)).toBe(150);
  });

  it("an ordinary room change ends the scene too", async () => {
    const { game: g } = await load({
      code: { A: "class A(GameObject):\n    pass\n" },
      rooms: [
        { name: "One", width: 640, height: 360, instances: [{ object: "A", x: 1, y: 1 }] },
        { name: "Two", width: 640, height: 360, instances: [] },
      ],
    } as never);
    py(g, 'scene_wait(500); room_goto("Two")');
    run(g, 3);
    expect(py(g, "room_name()")).toBe("Two");
    expect(py(g, "scene_playing()")).toBe(false);
    expect(py(g, "game_paused()")).toBe(false);
  });

  describe("the Skip button", () => {
    const tapAt = (g: Parameters<typeof run>[0], x: number, y: number) => {
      g.engine.input.mouseMove(x, y);
      run(g, 1);
      g.engine.input.mouseDown(0);
      run(g, 1);
      g.engine.input.mouseUp(0);
      run(g, 1);
    };
    const W = 320; // the test room's width, with no camera

    it("tapping it plays the rest instantly, as Esc does", async () => {
      const { game: g } = await game();
      py(g, `scene_say("A long speech"); scene_move(${a}, 200, 150, 100)`);
      run(g, 4);
      tapAt(g, W - 50, 20);
      expect(py(g, "scene_playing()")).toBe(false);
      expect(py(g, `${a}.x`)).toBe(200);
      expect(py(g, "dialogue_open()")).toBe(false);
    });

    it("tapping anywhere else doesn't skip: it only moves the words on", async () => {
      const { game: g } = await game();
      py(g, `scene_say("One"); scene_say("Two"); scene_wait(20)`);
      run(g, 40);
      tapAt(g, 50, 200);
      expect(py(g, "scene_playing()")).toBe(true);
      expect(py(g, "dialogue_open()")).toBe(true);
      tapAt(g, W - 120, 20); // just left of it
      expect(py(g, "scene_playing()")).toBe(true);
      tapAt(g, W - 50, 60); // just under it
      expect(py(g, "scene_playing()")).toBe(true);
    });

    it("is under the finger when the camera has moved and zoomed", async () => {
      const { game: g } = await load({
        code: { A: "class A(GameObject):\n    pass\n" },
        rooms: [{ name: "Big", width: 3000, height: 2000, camera: { width: 640, height: 360, smoothing: 1 }, instances: [{ object: "A", x: 1, y: 1 }] }],
      } as never);
      py(g, "camera_set(800, 500); camera_zoom(2)");
      run(g, 2);
      py(g, "scene_wait(500)");
      run(g, 2);
      // Input is in screen pixels: the engine works out the room point from the camera.
      // The button is at the window's edge (640), not view_width's (320, zoomed).
      tapAt(g, 640 - 50, 20);
      expect(py(g, "scene_playing()")).toBe(false);
    });

    it("doesn't skip anything when no scene is playing", async () => {
      const { game: g } = await game();
      tapAt(g, W - 50, 20);
      expect(py(g, "scene_playing()")).toBe(false);
    });
  });

  it("a zoomed camera doesn't shrink what's drawn over the window", async () => {
    const { game: g } = await load({
      code: { A: "class A(GameObject):\n    pass\n" },
      rooms: [{ name: "Big", width: 3000, height: 2000, camera: { width: 640, height: 360, smoothing: 1 }, instances: [{ object: "A", x: 1, y: 1 }] }],
    } as never);
    py(g, "camera_zoom(1.5)");
    run(g, 2);
    const rect = (depth: number) => g.engine.guiList.find((c) => c[0] === "rect" && c[1] === depth) as number[] | undefined;
    py(g, "screen_fade(1, 0); screen_flash()");
    run(g, 1);
    expect(rect(-3e6)!.slice(2, 6)).toEqual([0, 0, 640, 360]);
    expect(rect(-2e6)!.slice(2, 6)).toEqual([0, 0, 640, 360]);
    py(g, 'say("Hello")');
    run(g, 1);
    const box = rect(-1e6)!;
    expect(box[4]).toBe(640 - 12); // right edge
    expect(box[5]).toBe(360 - 12); // bottom edge
  });

  describe("movie polish", () => {
    const rects = (g: Parameters<typeof run>[0], depth: number) => g.engine.guiList.filter((c) => c[0] === "rect" && c[1] === depth) as number[][];

    it("bars slide in over their steps, stop there, and slide out when the scene ends", async () => {
      const { game: g } = await game();
      py(g, "scene_bars(True, 10); scene_wait(30)");
      run(g, 5);
      const part = rects(g, -0.5e6)[0]![5]!;
      expect(part).toBeGreaterThan(0);
      run(g, 15);
      const full = rects(g, -0.5e6)[0]![5]!;
      expect(full).toBeGreaterThan(part);
      run(g, 5);
      expect(rects(g, -0.5e6)[0]![5]!).toBe(full); // stopped there
      run(g, 40);
      expect(py(g, "scene_playing()")).toBe(false);
      expect(rects(g, -0.5e6)).toEqual([]);
    });

    it("a room change takes the bars away at once", async () => {
      const { game: g } = await load({
        code: { A: "class A(GameObject):\n    pass\n" },
        rooms: [{ name: "One", width: 320, height: 240, instances: [{ object: "A", x: 1, y: 1 }] }, { name: "Two", width: 320, height: 240, instances: [] }],
      } as never);
      py(g, 'scene_bars(True, 1); scene_wait(5); scene_room("Two")');
      run(g, 3);
      expect(rects(g, -0.5e6).length).toBe(2);
      run(g, 10);
      expect(rects(g, -0.5e6)).toEqual([]);
    });

    it("long words stay inside the window: box, bubble and caption", async () => {
      const { game: g } = await game();
      const w = py(g, 'say.__globals__["_screen_size"]()[0]') as number;
      py(g, `say("${LONG}")`);
      run(g, 400);
      let c = longWords(g);
      expect((c[2] as number) + widest(c)).toBeLessThanOrEqual(w - 12);
      py(g, "dialogue_clear()");
      run(g, 2);
      // A bubble: inside its own box.
      py(g, `say("${LONG}", "Oona", above=${a})`);
      run(g, 400);
      c = longWords(g);
      const box = g.engine.guiList.find((r) => r[0] === "rect" && r[1] === -1e6) as number[];
      expect((c[2] as number) + widest(c)).toBeLessThanOrEqual(box[4]!);
      py(g, "dialogue_clear()");
      // A caption is centred, so it's only too wide when it's wider than the window.
      py(g, `scene_caption("${LONG}", 60, size=28)`);
      run(g, 20);
      expect(widest(longWords(g))).toBeLessThanOrEqual(w);
    });

    it("a caption waits, fades in and out, and shows over a fade", async () => {
      const { game: g } = await game();
      py(g, 'screen_fade(1, 0); scene_caption("Later", 60); scene_wait(1)');
      const caption = () => g.engine.guiList.find((c) => c[0] === "text" && c[4] === "Later") as unknown[] | undefined;
      run(g, 5);
      expect(caption()![1]).toBeLessThan(-3e6);
      expect(caption()![8] as number).toBeLessThan(1);
      run(g, 25);
      expect(caption()![8]).toBe(1);
      run(g, 50);
      expect(caption()).toBeUndefined();
      expect(py(g, "scene_playing()")).toBe(false);
    });

    it("a flash is a step, in its turn", async () => {
      const { game: g } = await game();
      py(g, 'scene_wait(5); scene_flash("red", 10); scene_wait(30)');
      run(g, 2);
      expect(rects(g, -2e6)).toEqual([]);
      run(g, 6);
      expect(rects(g, -2e6).length).toBe(1);
    });
  });

  describe("acting", () => {
    const extra = { sprites: [{ name: "Walk", width: 16, height: 32, originX: 8, originY: 32, frameCount: 4, fps: 60, mask: { kind: "rect" } }] };

    it("scene_sprite and scene_face happen in their turn, and scene_face looks at an instance", async () => {
      const { game: g } = await game("    pass\n", extra);
      py(g, `scene_wait(5); scene_sprite(${a}, "Walk"); scene_face(${a}, "left"); scene_wait(5); scene_face(${a}, instances('B')[0]); scene_wait(5)`);
      run(g, 2);
      expect(py(g, `${a}.sprite`)).not.toBe("Walk");
      expect(py(g, `${a}.image_xscale`)).toBe(1);
      run(g, 6);
      expect(py(g, `${a}.sprite`)).toBe("Walk");
      expect(py(g, `${a}.image_xscale`)).toBe(-1);
      run(g, 6);
      expect(py(g, `${a}.image_xscale`)).toBe(1); // B is to the right
    });

    it("scene_animate runs the animation though the game is paused, then the next step starts", async () => {
      const { game: g } = await game("    pass\n", extra);
      py(g, `${a}.sprite = "Walk"; scene_animate(${a}, 3); scene_wait(40)`);
      const start = py(g, `${a}.image_index`) as number;
      run(g, 2);
      expect(py(g, `${a}.image_index`)).not.toBe(start);
      run(g, 6);
      const after = py(g, `${a}.image_index`);
      run(g, 5);
      expect(py(g, `${a}.image_index`)).toBe(after);
      expect(py(g, "scene_playing()")).toBe(true);
    });

    it("scene_hide fades out then hides with its alpha back; scene_show fades in", async () => {
      const { game: g } = await game();
      py(g, `scene_hide(${a}, 10); scene_wait(5); scene_show(${a}, 10)`);
      run(g, 5);
      const mid = py(g, `${a}.image_alpha`) as number;
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(1);
      expect(py(g, `${a}.visible`)).toBe(true);
      run(g, 8);
      expect(py(g, `${a}.visible`)).toBe(false);
      expect(py(g, `${a}.image_alpha`)).toBe(1);
      run(g, 9);
      expect(py(g, `${a}.visible`)).toBe(true);
      expect(py(g, `${a}.image_alpha`)).toBeLessThan(1);
      run(g, 10);
      expect(py(g, `${a}.image_alpha`)).toBe(1);
    });

    it("scene_tint goes there gradually", async () => {
      const { game: g } = await game();
      py(g, `scene_tint(${a}, "#ff0000", 10); scene_wait(5)`);
      run(g, 5);
      const mid = py(g, `${a}.image_blend`) as string;
      expect(mid).not.toBe("#ffffff");
      expect(mid).not.toBe("#ff0000");
      run(g, 8);
      expect(py(g, `${a}.image_blend`)).toBe("#ff0000");
    });

    it("scene_create hands the instance back now, hidden until its turn, and later steps can use it", async () => {
      const { game: g } = await game();
      py(g, `global_vars.new = scene_create(10, 20, "B"); scene_wait(1)`);
      py(g, `scene_wait(5)`);
      expect(py(g, "global_vars.new.visible")).toBe(false);
      py(g, `global_vars.new2 = scene_create(30, 40, "B"); scene_move(global_vars.new2, 200, 40, 2)`);
      run(g, 3);
      expect(py(g, "global_vars.new.visible")).toBe(true);
      expect(py(g, "global_vars.new2.visible")).toBe(false);
      run(g, 10);
      expect(py(g, "global_vars.new2.visible")).toBe(true);
      expect(py(g, "global_vars.new2.x")).toBe(200);
    });

    it("scene_destroy removes it in its turn", async () => {
      const { game: g } = await game();
      py(g, `scene_wait(5); scene_destroy(${a}); scene_wait(5)`);
      run(g, 2);
      expect(py(g, "instance_number('A')")).toBe(1);
      run(g, 6);
      expect(py(g, "instance_number('A')")).toBe(0);
    });

    it("a skip leaves every acting step's end state", async () => {
      const { game: g } = await game("    pass\n", extra);
      py(g, `
global_vars.new = scene_create(10, 20, "B")
scene_hide(instances('B')[0], 50)
scene_sprite(${a}, "Walk")
scene_face(${a}, "left")
scene_tint(${a}, "#00ff00", 50)
scene_show(global_vars.new)
scene_destroy(global_vars.new)
scene_create(1, 1, "A")
scene_wait(500)
`);
      run(g, 3); // the hide is under way: it ends too
      press(g, "escape");
      expect(py(g, "scene_playing()")).toBe(false);
      expect(py(g, "instances('B')[0].visible")).toBe(false);
      expect(py(g, "instances('B')[0].image_alpha")).toBe(1);
      expect(py(g, `${a}.sprite`)).toBe("Walk");
      expect(py(g, `${a}.image_xscale`)).toBe(-1);
      expect(py(g, `${a}.image_blend`)).toBe("#00ff00");
      expect(py(g, "global_vars.new._alive")).toBe(false);
      expect(py(g, "instances('A')[-1].visible")).toBe(true);
    });

    it("a misspelt sprite or a non-instance is an error on the student's own line", async () => {
      const { game: g } = await game();
      expect(() => py(g, `scene_sprite(${a}, "Nope")`)).toThrow(/no sprite called/);
      expect(() => py(g, 'scene_hide("A")')).toThrow(/wants an instance/);
      expect(() => py(g, `scene_face(${a}, "up")`)).toThrow(/looks "left"/);
      expect(() => py(g, 'scene_say("Hi", picture="Nope")')).toThrow(/no sprite called/);
      expect(() => py(g, 'scene_say("Hi", above="A")')).toThrow(/above is an instance/);
    });
  });

  describe("better dialogue", () => {
    const extra = { sprites: [{ name: "Face", width: 32, height: 16, originX: 0, originY: 0, frameCount: 1, mask: { kind: "rect" } }, { name: "Tall", width: 16, height: 32, originX: 8, originY: 32, frameCount: 1, mask: { kind: "rect" } }] };
    const texts = (g: Parameters<typeof run>[0]) => g.engine.guiList.filter((c) => c[0] === "text") as unknown[][];
    const boxes = (g: Parameters<typeof run>[0]) => g.engine.guiList.filter((c) => c[0] === "rect" && c[1] === -1e6) as number[][];

    it("long words beside a portrait stay inside the window", async () => {
      const { game: g } = await game("    pass\n", extra);
      py(g, `say("${LONG}", "Ann", picture="Face")`);
      run(g, 400);
      const c = longWords(g);
      expect((c[2] as number) + widest(c)).toBeLessThanOrEqual((py(g, 'say.__globals__["_screen_size"]()[0]') as number) - 12);
    });

    it("a portrait is drawn fitted, and the words move over for it", async () => {
      const { game: g } = await game("    pass\n", extra);
      py(g, 'scene_say("Hello", "Ann", picture="Face")');
      run(g, 3);
      const pic = g.engine.guiList.find((c) => c[0] === "sprite") as number[];
      expect(pic[7]).toBe(2); // 32 wide, in a 64 box
      expect(texts(g).find((t) => t[4] === "Ann")![2] as number).toBeGreaterThan(26 + 64);
      const box = boxes(g)[0]!;
      expect(box[3]! + 10 + 64).toBeLessThanOrEqual(box[5]!);
    });

    it("a line above an instance is a bubble over its head, following the camera", async () => {
      const { game: g } = await load({
        code: { A: "class A(GameObject):\n    pass\n" },
        sprites: extra.sprites,
        rooms: [{ name: "Big", width: 3000, height: 2000, camera: { width: 640, height: 360, smoothing: 1 }, instances: [{ object: "A", x: 400, y: 300 }] }],
      } as never);
      py(g, `${a}.sprite = "Tall"; camera_set(100, 100)`);
      run(g, 2);
      py(g, `scene_say("Hi", above=${a})`);
      run(g, 1);
      const box = () => boxes(g)[0]!;
      const left = box()[2]!;
      // Head at y 300 - 32 = 268, less the view's 100 = 168 on screen.
      expect(box()[5]!).toBeLessThanOrEqual(168);
      expect(box()[5]!).toBeGreaterThan(120);
      expect(left).toBeLessThan(300);
      expect(box()[4]!).toBeGreaterThan(300);
      py(g, "camera_set(150, 100)");
      run(g, 2);
      expect(box()[2]!).toBeCloseTo(left - 50);
    });

    it("with no room over the head, the bubble goes under the feet", async () => {
      const { game: g } = await game("    pass\n", extra);
      py(g, `${a}.sprite = "Tall"; ${a}.y = 40`);
      run(g, 1);
      py(g, `scene_say("Hi", above=${a})`);
      run(g, 1);
      expect(boxes(g)[0]![3]!).toBeGreaterThanOrEqual(40); // feet at 40: origin at the sprite's bottom
    });

    it("a speaker destroyed mid-line leaves the words in the box", async () => {
      const { game: g } = await game();
      py(g, `scene_say("Hi", above=${a})`);
      run(g, 2);
      py(g, `${a}.destroy()`);
      run(g, 2);
      expect(boxes(g)[0]![2]).toBe(12);
      expect(texts(g).some((t) => t[4] === "Hi")).toBe(true);
    });

    it("dialogue_style sets how fast the letters come", async () => {
      const { game: g } = await game();
      py(g, 'dialogue_style(0.5); say("Twelve chars")');
      run(g, 9);
      const slow = (texts(g)[0]![4] as string).length;
      expect(slow).toBeLessThan(6);
      expect(slow).toBeGreaterThan(2);
      py(g, 'dialogue_clear(); dialogue_style(4); say("Twelve chars")');
      run(g, 4);
      expect(texts(g)[0]![4]).toBe("Twelve chars");
      expect(() => py(g, "dialogue_style(0)")).toThrow(/above 0/);
    });
  });

  it("the Skip button shows only while a scene plays", async () => {
    const { game: g } = await game();
    const shown = () => JSON.stringify(g.engine.guiList).includes("Skip (Esc)");
    run(g, 1);
    expect(shown()).toBe(false);
    py(g, "scene_wait(5)");
    run(g, 1);
    expect(shown()).toBe(true);
    run(g, 10);
    expect(shown()).toBe(false);
  });

  it("the camera glides there, and goes back to following afterwards", async () => {
    const { game: g } = await load({
      code: { A: "class A(GameObject):\n    pass\n" },
      rooms: [{ name: "Big", width: 3000, height: 2000, camera: { enabled: true, width: 640, height: 360, follow: null, smoothing: 1 }, instances: [{ object: "A", x: 400, y: 300 }] }],
    } as never);
    py(g, `camera_follow(${a})`);
    run(g, 2);
    const start = g.engine.camera.x;
    expect(start).toBeGreaterThan(0);
    py(g, "scene_camera(1500, 800, 10); scene_wait(5)");
    run(g, 5);
    expect(g.engine.camera.x).toBeGreaterThan(start);
    expect(g.engine.camera.x).toBeLessThan(1500 - 320);
    run(g, 7);
    expect(g.engine.camera.x).toBeCloseTo(1500 - 320);
    expect(g.engine.camera.y).toBeCloseTo(800 - 180);
    run(g, 10);
    expect(py(g, "scene_playing()")).toBe(false);
    run(g, 2);
    expect(g.engine.camera.x).toBeCloseTo(start);
  });

  it("zoom and fade wait until they're done", async () => {
    const { game: g } = await game();
    py(g, `scene_fade(1, 10); scene_move(${a}, 200, 100, 2)`);
    run(g, 6);
    expect(py(g, `${a}.x`)).toBe(100);
    run(g, 10);
    expect(fade(g)).toBe(1);
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
    py(g, `scene_zoom(2, 10); scene_move(${a}, 300, 100, 2)`);
    run(g, 5);
    expect(py(g, `${a}.x`)).toBeCloseTo(200);
    run(g, 12);
    expect(py(g, `${a}.x`)).toBeCloseTo(300);
  });

  it("a room change ends the scene, steps after it never run, and the game isn't left paused", async () => {
    const { game: g } = await load({
      code: { A: "class A(GameObject):\n    pass\n" },
      rooms: [
        { name: "One", width: 640, height: 360, instances: [{ object: "A", x: 1, y: 1 }] },
        { name: "Two", width: 640, height: 360, instances: [] },
      ],
    } as never);
    py(g, 'global_vars.after = 0; scene_room("Two"); scene_do(lambda: setattr(global_vars, "after", 1))');
    run(g, 3);
    expect(py(g, "room_name()")).toBe("Two");
    expect(py(g, "scene_playing()")).toBe(false);
    expect(py(g, "game_paused()")).toBe(false);
    expect(py(g, "global_vars.after")).toBe(0);
  });

  it("something destroyed mid-move doesn't stop the scene", async () => {
    const { game: g } = await game();
    py(g, `scene_move(${a}, 200, 100, 50); scene_wait(1)`);
    run(g, 3);
    py(g, `${a}.destroy()`);
    run(g, 6);
    expect(py(g, "scene_playing()")).toBe(false);
  });

  it("a scene started in a room's Create plays when the room starts, the first room or a later one", async () => {
    const code = { A: "class A(GameObject):\n    def on_create(self):\n        scene_move(self, 200, self.y, 10)\n    def on_step(self):\n        global_vars.a_steps = getattr(global_vars, 'a_steps', 0) + 1\n" };
    const first = (await load({ code, instances: [{ object: "A", x: 100, y: 100 }] })).game;
    run(first, 4);
    expect(py(first, "scene_playing()")).toBe(true);
    expect(py(first, "game_paused()")).toBe(true);
    expect(py(first, "hasattr(global_vars, 'a_steps')")).toBe(false);
    run(first, 10);
    expect(py(first, "scene_playing()")).toBe(false);
    expect(py(first, `${a}.x`)).toBeCloseTo(200);
    const later = (await load({
      code,
      rooms: [{ name: "One", width: 320, height: 240, instances: [] }, { name: "Two", width: 320, height: 240, instances: [{ object: "A", x: 100, y: 100 }] }],
    } as never)).game;
    py(later, 'room_goto("Two")');
    run(later, 4);
    expect(py(later, "scene_playing()")).toBe(true);
    run(later, 10);
    expect(py(later, `${a}.x`)).toBeCloseTo(200);
    expect(py(later, "game_paused()")).toBe(false);
  });

  it("mistakes are said in words, at the line that made them", async () => {
    const { game: g } = await game();
    const wrong = (code: string) => {
      try {
        py(g, code);
        return "";
      } catch (e) {
        return String(e);
      }
    };
    expect(wrong('scene_move("hero", 1, 2)')).toContain("wants an instance");
    expect(wrong(`scene_move(${a}, 1, 2, 5, "bouncy")`)).toContain("bouncy");
    expect(wrong('scene_ask("Hm", "Yes")')).toContain("list of choices");
    expect(wrong("scene_do(print('x'))")).toContain("no () after its name");
    expect(wrong("scene_zoom(0)")).toContain("above 0");
  });
});
