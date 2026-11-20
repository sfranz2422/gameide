/**
 * Busy Road, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': a heart picture called "frog" on an object Hopper,
 * on W A S D; dragons in the way; a Board for the score. They fill the blanks their own way
 * and write the parts the lesson leaves to them. The checks have no names in them, so they
 * must pass.
 */
import { expect } from "vitest";
import { fill, press, run, step, wasd, type Play, type Steps } from "./kit";

export const steps: Steps = {
  1: () => ({ named: [["heart", "frog"]], objects: [{ name: "Hopper", sprite: "frog" }], place: [{ object: "Hopper", x: 292, y: 452 }] }),
  2: ([hop]) => ({ code: { "Hopper.step": wasd(hop!) }, adapt: wasd }),
  3: ([create, step]) => ({
    named: [["enemy", "dragon"]],
    objects: [{ name: "Dragon", sprite: "dragon" }],
    // Middles on rows 3 to 12; some lanes with two, gaps between.
    place: [3, 4, 5, 7, 8, 10, 12, 12].map((row, i) => ({ object: "Dragon", x: 60 + ((i * 170) % 560), y: row * 32 + 16 })),
    code: { "Dragon.create": create!, "Dragon.step": step! },
  }),
  4: ([lanes]) => {
    const mine = (b: string) => fill(b, ["2 + lane % 3", "-self.hspeed"]);
    return { code: { "Dragon.create": mine(lanes!) }, adapt: mine };
  },
  5: ([create, hit]) => {
    const mine = (b: string, i: number) => fill(b, i === 0 ? ["self.y", "5"] : ["1"]);
    return {
      code: { "Hopper.create": mine(create!, 0), "Hopper.collision Dragon": mine(hit!, 1) + "self.x = self.start_x\nself.y = self.start_y\n" },
      adapt: mine,
    };
  },
  6: ([across], code) => {
    const mine = (b: string) => fill(b, ["32"]);
    return {
      code: {
        "Hopper.create": code("Hopper.create") + "global_vars.score = 0\n",
        "Hopper.step": code("Hopper.step") + mine(across!) + "    self.x = self.start_x\n    self.y = self.start_y\n",
      },
      adapt: mine,
    };
  },
  7: ([draw]) => {
    const mine = (b: string) => fill(b, ['"yellow"', "Dragons dodged:"]);
    return {
      objects: [{ name: "Board", sprite: null }],
      place: [{ object: "Board", x: 0, y: 0 }],
      code: { "Board.draw_gui": mine(draw!) + 'draw_text(10, 24, f"Hearts left: {global_vars.lives}")\n' },
      adapt: mine,
    };
  },
  8: ([top], code) => {
    const mine = (b: string) => fill(b, ['"space"']);
    return {
      code: {
        "Hopper.step": mine(top!) + code("Hopper.step"),
        "Board.draw_gui": code("Board.draw_gui") + 'if global_vars.lives <= 0:\n    draw_text(200, 220, "The dragons got you! Space to try again")\n',
      },
      adapt: mine,
    };
  },
  9: (_, code) => ({ code: { "Dragon.step": code("Dragon.step") + "self.x += self.hspeed * global_vars.score / 4\n" } }),
};

/** "holding a key moves something" can't see which way: up hops up a square (and down, down). */
export const play: Play = (g) => {
  step(g, 2);
  const y = run(g, "instances('Hopper')[0].y");
  press(g, "w");
  expect(run(g, "instances('Hopper')[0].y"), "W hops up one square").toBe(y - 32);
  press(g, "s");
  expect(run(g, "instances('Hopper')[0].y"), "and S back down").toBe(y);
};
