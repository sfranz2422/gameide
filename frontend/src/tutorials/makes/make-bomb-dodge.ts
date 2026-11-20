/**
 * Bomb Dodge, an open lesson (2026-11-20), replayed as a student who made their own choices,
 * none of them the examples': a key picture called "knight" on an object Knight, on A and D;
 * rocks falling (an orb picture called "rock") from a Cloud; a Sign for the score; 4 lives;
 * R to play again. They fill the blanks their own way and write the parts the lesson leaves
 * to them. The checks have no names in them, so they must pass.
 */
import { expect } from "vitest";
import { fill, run, step, type Play, type Steps } from "./kit";

/** The student's line that makes a rock, and the one that sets the alarm again (with the example's comments). */
const MAKE_ONE = /^instance_create\(.*$/m;
const AGAIN = /^self\.alarm\[0\] = 45.*$/m;

export const steps: Steps = {
  1: () => ({ named: [["key", "knight"]], objects: [{ name: "Knight", sprite: "knight" }], place: [{ object: "Knight", x: 312, y: 450 }] }),
  2: ([move]) => {
    const mine = (b: string) => b.replace('"right"', '"d"').replace('"left"', '"a"').replace("* 6", "* 7").replace("room_width - 24", "room_width - 16");
    return { code: { "Knight.step": mine(move!) }, adapt: mine };
  },
  3: ([create]) => ({ named: [["orb", "rock"]], objects: [{ name: "Rock", sprite: "rock" }], code: { "Rock.create": create! } }),
  4: ([create, alarm]) => {
    const mine = (b: string, i: number) => fill(b, i === 0 ? ["40"] : ['"Rock"', "45"]);
    return {
      objects: [{ name: "Cloud", sprite: null }],
      place: [{ object: "Cloud", x: 0, y: 0 }],
      code: { "Cloud.create": mine(create!, 0), "Cloud.alarm 0": mine(alarm!, 1) },
      adapt: mine,
    };
  },
  5: ([create, out]) => {
    const mine = (b: string, i: number) => fill(b, i === 0 ? ["4"] : ["1"]);
    return {
      code: { "Knight.create": mine(create!, 0), "Rock.step": mine(out!, 1) + "    self.destroy()\n" },
      adapt: mine,
    };
  },
  6: ([hit]) => {
    const mine = (b: string) => fill(b, ["1"]);
    return { code: { "Knight.collision Rock": mine(hit!) + 'self.flash("orange", 20)\n' }, adapt: mine };
  },
  7: ([draw]) => {
    const mine = (b: string) => fill(b, ['"cyan"', "Rocks dodged:"]);
    return {
      objects: [{ name: "Sign", sprite: null }],
      place: [{ object: "Sign", x: 0, y: 0 }],
      code: { "Sign.draw_gui": mine(draw!) + 'draw_text(10, 30, f"Shields: {global_vars.lives}")\n' },
      adapt: mine,
    };
  },
  8: ([top], code) => {
    const mine = (b: string) => fill(b, ['"r"']);
    const alarm = code("Cloud.alarm 0");
    expect(alarm).toMatch(MAKE_ONE);
    return {
      code: {
        "Knight.step": mine(top!) + code("Knight.step"),
        "Cloud.alarm 0": alarm.replace(MAKE_ONE, (line) => "if global_vars.lives > 0:\n    " + line),
        "Sign.draw_gui": code("Sign.draw_gui") + 'if global_vars.lives <= 0:\n    draw_text(220, 220, "Squashed! Press R")\n',
      },
      adapt: mine,
    };
  },
  9: ([wait, speed], code) => {
    const mine = (b: string, i: number) => fill(b, i === 0 ? ["10", "45"] : ["2", "5"]);
    const alarm = code("Cloud.alarm 0");
    expect(alarm).toMatch(AGAIN);
    return {
      code: { "Cloud.alarm 0": alarm.replace(AGAIN, mine(wait!, 0).trimEnd()), "Rock.create": mine(speed!, 1) },
      adapt: mine,
    };
  },
};

/** A rock that lands on the knight takes a life; once they're gone, no more rocks fall. */
export const play: Play = (g) => {
  run(g, "k = instances('Knight')[0]\nr = instance_create(k.x + 4, k.y - 4, 'Rock')\nlives = global_vars.lives");
  step(g, 2);
  expect(run(g, "lives - global_vars.lives")).toBe(1);
  run(g, "global_vars.lives = 0\nfor r in instances('Rock'): r.destroy()");
  step(g, 180);
  expect(run(g, "instance_number('Rock')")).toBe(0);
};
