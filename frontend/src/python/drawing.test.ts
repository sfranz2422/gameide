/**
 * Phase 12a's drawing and maths, in the real Pyodide: what a Draw event
 * asks for reaches the renderer as commands with every setting it gave, the
 * text settings last for one event, and the small maths helpers answer as
 * their docs say. That the renderer really draws them is checked in a
 * browser (e2e/drawing.editor.spec.ts).
 */
import { describe, expect, it } from "vitest";
import { load, py, run } from "./testkit";

const drawing = (draw: string, gui = "") =>
  load({
    code: { A: `class A(GameObject):\n    def on_draw(self):\n${draw}${gui ? `\n    def on_draw_gui(self):\n${gui}` : ""}` },
    instances: [{ object: "A", x: 100, y: 100 }],
  });

describe("drawing", () => {
  it("draw_sprite_ext sends its scale, angle, tint and alpha; draw_sprite stays plain", async () => {
    const { game } = await drawing(`        draw_set_alpha(0.5)
        draw_sprite_ext("anim", 2, 10, 20, 2, -1, 90, "blue", 0.5)
        draw_sprite("anim", 1, 30, 40)
`);
    run(game);
    const [ext, plain] = game.engine.drawList.filter((c) => c[0] === "sprite");
    expect(ext!.slice(3)).toEqual([2, 10, 20, 0.25, 2, -1, 90, 0x0000ff]); // the alphas multiply
    expect(plain!.length).toBe(7); // no scale, angle or tint: the renderer's defaults
  });

  it("lines, circles, ellipses, triangles and gradients each send their shape", async () => {
    const { game } = await drawing(`        draw_set_color("red")
        draw_line(0, 0, 10, 5, 3)
        draw_circle(50, 50, -8, True)
        draw_ellipse(0, 0, 20, 10)
        draw_triangle(0, 0, 10, 0, 5, 9, True)
        draw_rect_gradient(0, 0, 40, 10, "black", "white", False)
`);
    run(game);
    const kinds = game.engine.drawList.map((c) => [c[0], ...c.slice(2)]);
    expect(kinds).toEqual([
      ["line", 0, 0, 10, 5, 0xff0000, 3, 1],
      ["circle", 50, 50, 8, 0xff0000, 1, 1], // a negative radius is its size
      ["ellipse", 0, 0, 20, 10, 0xff0000, 0, 1],
      ["tri", 0, 0, 10, 0, 5, 9, 0xff0000, 1, 1],
      ["grad", 0, 0, 40, 10, 0x000000, 0xffffff, 0, 1],
    ]);
  });

  it("text alignment goes with the text, and lasts for one event only", async () => {
    const { game } = await drawing(`        draw_set_halign("center")
        draw_set_valign("bottom")
        draw_text(100, 50, "Game over")
`, `        draw_text(0, 0, "score")
`);
    run(game);
    const world = game.engine.drawList.find((c) => c[0] === "text")!;
    const gui = game.engine.guiList.find((c) => c[0] === "text")!;
    expect(world.slice(9)).toEqual(["center", "bottom"]);
    expect(gui.slice(9)).toEqual(["left", "top"]);
  });

  it("string_width and string_height grow with the text and the font size", async () => {
    const { game } = await drawing("        pass\n");
    const w = (code: string) => py(game, code) as number;
    expect(w('string_width("abcd")')).toBeGreaterThan(w('string_width("ab")'));
    py(game, "draw_set_font(None, 32)");
    expect(w('string_width("ab")')).toBeCloseTo(2 * w('(draw_set_font(None, 16), string_width("ab"))[1]'), 5);
    expect(w('string_height("one\\ntwo")')).toBeCloseTo(2 * w('string_height("one")'), 5);
    expect(w('(draw_set_font(None, 32), string_height("one"))[1]')).toBeCloseTo(2 * w('(draw_set_font(None, 16), string_height("one"))[1]'), 5);
  });

  it("a wrong alignment, or drawing outside a Draw event, is said in words", async () => {
    const { game } = await drawing("        pass\n");
    expect(() => py(game, 'draw_set_halign("middle")')).toThrow(/isn't a way to line text up.*left, center, right/s);
    const { game: g2, warnings } = await load({
      code: { A: "class A(GameObject):\n    def on_step(self):\n        draw_circle(0, 0, 5)\n" },
      instances: [{ object: "A", x: 0, y: 0 }],
    });
    run(g2);
    expect(warnings.join(" ")).toMatch(/draw_circle\(\) only draws inside an on_draw/);
  });
});

describe("small maths", () => {
  it("clamp, lerp, approach, sign and choose do what their docs say", async () => {
    const { game } = await drawing("        pass\n");
    expect(py(game, "[clamp(15, 0, 10), clamp(-3, 0, 10), clamp(4, 0, 10)]")).toEqual([10, 0, 4]);
    expect(py(game, "[lerp(0, 100, 0.25), lerp(10, 20, 1)]")).toEqual([25, 20]);
    expect(py(game, "[approach(0, 10, 3), approach(9, 10, 3), approach(5, 0, -2), approach(4, 4, 1)]")).toEqual([3, 10, 3, 4]);
    expect(py(game, "[sign(-4), sign(0), sign(0.5)]")).toEqual([-1, 0, 1]);
    expect(py(game, "all(choose(['a', 'b']) in ('a', 'b') for i in range(50))")).toBe(true);
    expect(py(game, "len({choose(range(5)) for i in range(200)})")).toBe(5);
    expect(() => py(game, "choose([])")).toThrow(/a list with something in it/);
  });
});
