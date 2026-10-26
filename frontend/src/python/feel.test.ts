/**
 * Game feel (Phase 9½), end to end in the real Pyodide: what Python asks
 * for reaches the engine as it should — particles, weather, lighting,
 * screen effects, hit-pause, flashes and outlines — and the parts Python
 * does itself (tweens, easing, dialogue, fades) behave step by step.
 * Drawing them is the renderer's, checked in a browser (e2e/feel.editor.spec.ts).
 */
import { describe, expect, it } from "vitest";
import { MAX_PARTICLES } from "../engine/effects";
import { F, STRIDE } from "../engine/layout";
import { key, load, py, run } from "./testkit";

const game = (body: string, extra = "") =>
  load({
    code: { A: `class A(GameObject):\n${body}${extra}` },
    instances: [{ object: "A", x: 100, y: 100 }],
  });
const slotOf = (g: Awaited<ReturnType<typeof load>>["game"]) => py(g, "instances('A')[0]._slot") as number;
const field = (g: Awaited<ReturnType<typeof load>>["game"], f: number) => g.engine.fresh().st[slotOf(g) * STRIDE + f];

describe("particles and effects", () => {
  it("a burst makes its particles, which move, fade and are gone after their life", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'particles(50, 60, count=20, color=["red", "#00ff00"], speed=2, life=10)');
    run(g, 1);
    const fx = g.engine.effects;
    expect(fx.count).toBe(20);
    expect([...fx.color.slice(0, 20)].every((c) => c === 0xff0000 || c === 0x00ff00)).toBe(true);
    expect(fx.x[0] !== 50 || fx.y[0] !== 60).toBe(true);
    run(g, 20);
    expect(fx.count).toBe(0);
  });

  it("never holds more than MAX_PARTICLES, however many are asked for", async () => {
    const { game: g } = await game("    pass\n");
    for (let i = 0; i < 12; i++) py(g, "particles(0, 0, count=500, life=1000)");
    run(g, 1);
    expect(g.engine.effects.count).toBe(MAX_PARTICLES);
  });

  it("ready-made effects, and a misspelt one says what was meant", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'effect("explosion", 10, 10)');
    run(g, 1);
    expect(g.engine.effects.count).toBeGreaterThan(20);
    expect(() => py(g, 'effect("explsion", 10, 10)')).toThrow(/isn't an effect GameIDE knows[\s\S]*explosion/);
    expect(() => py(g, 'particles(0, 0, shape="star")')).toThrow(/square, circle/);
  });

  it("weather falls every step until stopped, and a new room is clear", async () => {
    const { game: g } = await load({
      code: { A: "class A(GameObject):\n    pass\n" },
      rooms: [
        { name: "R1", width: 200, height: 200, instances: [{ object: "A", x: 0, y: 0 }] },
        { name: "R2", width: 200, height: 200, instances: [] },
      ],
    });
    py(g, 'weather("rain", 2)');
    run(g, 3);
    const fx = g.engine.effects;
    expect(fx.weather).toBe("rain");
    const raining = fx.count;
    expect(raining).toBeGreaterThan(10);
    py(g, "weather(None)");
    run(g, 1);
    expect(fx.weather).toBeNull();
    py(g, 'weather("snow")');
    run(g, 1);
    py(g, 'room_goto("R2")');
    run(g, 1);
    expect(fx.weather).toBeNull();
    expect(fx.count).toBe(0);
  });

  it("what a room's Create events ask for survives the room starting", async () => {
    const code = 'class A(GameObject):\n    def on_create(self):\n        particles(0, 0, count=5, life=100)\n        lighting(0.5)\n';
    const { game: g } = await load({
      code: { A: code, B: "class B(GameObject):\n    pass\n" },
      rooms: [
        { name: "R1", width: 100, height: 100, instances: [{ object: "A", x: 0, y: 0 }] },
        { name: "R2", width: 100, height: 100, instances: [{ object: "A", x: 0, y: 0 }] },
      ],
    });
    const fx = g.engine.effects;
    expect(fx.count).toBe(5);
    expect(fx.darkness).toBeCloseTo(0.5);
    py(g, 'room_goto("R2")');
    run(g, 1);
    expect(fx.count).toBe(5);
    expect(fx.darkness).toBeCloseTo(0.5);
  });

  it("particles_clear removes them all", async () => {
    const { game: g } = await game("    pass\n");
    py(g, "particles(0, 0, count=30, life=100)");
    run(g, 1);
    py(g, "particles_clear()");
    run(g, 1);
    expect(g.engine.effects.count).toBe(0);
  });
});

describe("lighting and the screen", () => {
  it("lighting darkens the room; light() shines for the step it is called in", async () => {
    const { game: g } = await game("    def on_step(self):\n        light(self.x, self.y, 80, \"orange\")\n");
    py(g, 'lighting(0.9, "navy")');
    run(g, 1);
    const fx = g.engine.effects;
    expect(fx.darkness).toBeCloseTo(0.9);
    expect(fx.darkColor).toBe(0x000080);
    expect(fx.lights).toEqual([[100, 100, 80, 0xffa040, 1]]); // the runtime's "orange"
    py(g, "instances('A')[0].destroy()");
    run(g, 1);
    expect(fx.lights).toEqual([]);
  });

  it("a screen effect stays until changed; an unknown one is refused in words", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'screen_effect("crt")');
    run(g, 2);
    expect(g.engine.effects.screen).toBe("crt");
    py(g, "screen_effect(None)");
    run(g, 1);
    expect(g.engine.effects.screen).toBeNull();
    expect(() => py(g, 'screen_effect("vhs")')).toThrow(/isn't a screen effect GameIDE knows/);
  });
});

describe("hits", () => {
  it("hit_pause freezes the whole game for its steps, then it carries on", async () => {
    const { game: g } = await game("    def on_step(self):\n        self.x += 1\n");
    run(g, 1);
    expect(py(g, "instances('A')[0].x")).toBe(101);
    py(g, "hit_pause(3)");
    run(g, 3);
    expect(py(g, "instances('A')[0].x")).toBe(101);
    run(g, 1);
    expect(py(g, "instances('A')[0].x")).toBe(102);
  });

  it("a key pressed during a hit pause isn't lost", async () => {
    const { game: g } = await game("    def on_step(self):\n        if keyboard_check_pressed('space'):\n            self.y = 0\n");
    py(g, "hit_pause(2)");
    g.engine.input.keyDown(key("space"));
    g.engine.input.keyUp(key("space"));
    run(g, 3);
    expect(py(g, "instances('A')[0].y")).toBe(0);
  });

  it("flash() shows one colour for its steps, counting down", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'instances("A")[0].flash("red", 3)');
    expect(field(g, F.FLASH)).toBe(3);
    expect(field(g, F.FLASH_COLOR)).toBe(0xff0000);
    run(g, 3);
    expect(field(g, F.FLASH)).toBe(0);
    run(g, 2);
    expect(field(g, F.FLASH)).toBe(0);
  });
});

describe("how a sprite looks", () => {
  it("image_blend, blend_mode, outline and glow are fields the renderer reads", async () => {
    const { game: g } = await game("    pass\n");
    expect(py(g, "instances('A')[0].image_blend")).toBe("#ffffff");
    expect(py(g, "instances('A')[0].blend_mode")).toBe("normal");
    py(g, 'a = instances("A")[0]; a.image_blend = "red"; a.blend_mode = "add"; a.outline = "yellow"');
    expect(field(g, F.TINT)).toBe(0xff0000);
    expect(field(g, F.BLEND)).toBe(1);
    expect(field(g, F.OUTLINE)).toBe(1);
    expect(field(g, F.OUTLINE_COLOR)).toBe(0xffff00);
    expect(py(g, "instances('A')[0].outline")).toBe("#ffff00");
    py(g, 'instances("A")[0].glow = "cyan"');
    expect(field(g, F.OUTLINE)).toBe(2);
    expect(py(g, "instances('A')[0].outline")).toBeFalsy(); // None
    py(g, "instances('A')[0].glow = None");
    expect(field(g, F.OUTLINE)).toBe(0);
    expect(() => py(g, 'instances("A")[0].blend_mode = "addd"')).toThrow(/blend_mode is one of[\s\S]*add/);
    expect(() => py(g, 'instances("A")[0].image_blend = "reddish"')).toThrow(/isn't a colour|is not a colour/);
  });
});

describe("tweens and easing", () => {
  it("tween moves a property along its easing, and lands exactly", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'tween(instances("A")[0], "x", 200, 10, "linear")');
    run(g, 5);
    expect(py(g, "instances('A')[0].x")).toBeCloseTo(150);
    run(g, 5);
    expect(py(g, "instances('A')[0].x")).toBe(200);
    run(g, 3);
    expect(py(g, "instances('A')[0].x")).toBe(200);
  });

  it("tweens anything with a number: global_vars too; tween_stop leaves it where it got to", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'global_vars.score = 0; tween(global_vars, "score", 100, 4, "linear")');
    run(g, 2);
    expect(py(g, "global_vars.score")).toBeCloseTo(50);
    py(g, "tween_stop(global_vars)");
    run(g, 3);
    expect(py(g, "global_vars.score")).toBeCloseTo(50);
  });

  it("a tween on an instance that's destroyed just stops", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'tween(instances("A")[0], "y", 0, 20); instances("A")[0].destroy()');
    run(g, 3);
    expect(py(g, "import gameide; len(gameide._tweens)")).toBe(0);
  });

  it("says what's wrong, at the student's line", async () => {
    const { game: g } = await game("    pass\n");
    expect(() => py(g, 'tween(instances("A")[0], "speeed", 1)')).toThrow(/has no 'speeed' to move/);
    expect(() => py(g, 'tween(instances("A")[0], "x", 1, 10, "bouncy")')).toThrow(/isn't an easing GameIDE knows/);
    expect(() => py(g, 'tween(instances("A")[0], x, 1)')).toThrow();
  });

  it("every easing starts at 0 and ends at 1; out_quad is fast then slow", async () => {
    const { game: g } = await game("    pass\n");
    const names = py(g, "import gameide; list(gameide._EASES)") as string[];
    expect(names.length).toBe(16);
    for (const n of names) {
      expect(py(g, `ease("${n}", 0)`), n).toBeCloseTo(0, 6);
      expect(py(g, `ease("${n}", 1)`), n).toBeCloseTo(1, 6);
    }
    expect(py(g, 'ease("linear", 0.25)')).toBeCloseTo(0.25);
    expect(py(g, 'ease("out_quad", 0.5)')).toBeCloseTo(0.75);
    expect(py(g, 'ease("out_back", 0.6)') as number).toBeGreaterThan(1);
  });
});

describe("dialogue, fades and alpha", () => {
  const texts = (g: Awaited<ReturnType<typeof load>>["game"]) => g.engine.guiList.filter((c) => c[0] === "text").map((c) => c[4] as string);

  it("say() types each line out; Space shows it all, then goes on; dialogue_open says when it's over", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'say("Hello there", name="Owl"); say("Second line")');
    expect(py(g, "dialogue_open()")).toBe(true);
    run(g, 1);
    expect(texts(g)).toContain("Owl");
    expect(texts(g)).toContain("H");
    run(g, 3);
    expect(texts(g)).toContain("Hell");
    const press = () => {
      g.engine.input.keyDown(key("space"));
      run(g, 1);
      g.engine.input.keyUp(key("space"));
      run(g, 1);
    };
    press();
    expect(texts(g)).toContain("Hello there");
    press();
    expect(texts(g)).toContain("S"); // the next line, one letter in
    press();
    press();
    expect(py(g, "dialogue_open()")).toBe(false);
    expect(texts(g)).toEqual([]);
  });

  it("the key that starts a line doesn't also skip it", async () => {
    const { game: g } = await game("    def on_step(self):\n        if keyboard_check_pressed('space') and not dialogue_open():\n            say('Hi there')\n");
    g.engine.input.keyDown(key("space"));
    run(g, 1);
    g.engine.input.keyUp(key("space"));
    expect(texts(g)).toContain("H");
  });

  it("screen_fade darkens step by step and lasts; screen_flash fades out", async () => {
    const { game: g } = await game("    pass\n");
    const cover = (d: number) => g.engine.guiList.find((c) => c[0] === "rect" && c[1] === d) as number[] | undefined;
    py(g, "screen_fade(1, 4)");
    run(g, 2);
    expect(cover(-3e6)?.[8]).toBeCloseTo(0.5);
    run(g, 5);
    expect(cover(-3e6)?.[8]).toBeCloseTo(1);
    py(g, 'screen_flash("white", 4)');
    run(g, 1);
    const first = cover(-2e6)?.[8] as number;
    run(g, 1);
    expect(cover(-2e6)?.[8] as number).toBeLessThan(first);
    run(g, 4);
    expect(cover(-2e6)).toBeUndefined();
  });

  it("draw_set_alpha makes what's drawn see-through, and starts each Draw event solid", async () => {
    const { game: g } = await game("    def on_draw(self):\n        draw_rect(0, 0, 5, 5)\n        draw_set_alpha(0.25)\n        draw_rect(0, 0, 5, 5)\n");
    run(g, 2);
    expect(g.engine.drawList.map((c) => c[8])).toEqual([1, 0.25]);
  });

  it("game_restart starts the feel over: no tweens, lines or fade", async () => {
    const { game: g } = await game("    pass\n");
    py(g, 'say("hi"); screen_fade(1, 1); tween(global_vars, "a", 1) if hasattr(global_vars, "a") else None; global_vars.a = 0; tween(global_vars, "a", 5, 50)');
    run(g, 2);
    py(g, "game_restart()");
    run(g, 2);
    expect(py(g, "dialogue_open()")).toBe(false);
    expect(py(g, "import gameide; len(gameide._tweens)")).toBe(0);
    expect(g.engine.guiList.find((c) => c[1] === -3e6)).toBeUndefined();
  });
});
