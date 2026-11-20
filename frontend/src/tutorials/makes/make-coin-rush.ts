/**
 * Coin Rush, an open lesson (2026-11-20), replayed as a student who made their own choices,
 * none of them the examples': a ship picture called "bee" on an object Bee, on W A S D at
 * speed 4; flowers to grab (a gem picture called "flower"), worth 2; a Board for the score;
 * a 45-second clock; R to play again. They fill the blanks their own way and write the parts
 * the lesson leaves to them. The checks have no names in them, so they must pass.
 */
import { expect } from "vitest";
import { KEY_CODE } from "../../engine/input";
import { fill, run, step, wasd, type Play, type Steps } from "./kit";

export const steps: Steps = {
  1: () => ({ named: [["ship", "bee"]], objects: [{ name: "Bee", sprite: "bee" }], place: [{ object: "Bee", x: 300, y: 220 }] }),
  2: ([move]) => {
    const mine = (b: string) => wasd(b).replace("speed = 5", "speed = 4");
    return { code: { "Bee.step": mine(move!) }, adapt: mine };
  },
  3: ([create]) => ({
    named: [["gem", "flower"]],
    objects: [{ name: "Flower", sprite: "flower" }],
    place: [{ object: "Flower", x: 500, y: 80 }],
    code: { "Flower.create": create! },
  }),
  4: ([start, grab]) => {
    const mine = (b: string, i: number) => (i === 1 ? fill(b, ["2"]) : b);
    return {
      code: {
        "Bee.create": start!,
        "Bee.collision Flower": mine(grab!, 1) + "other.y = random.randint(20, room_height - 20)\n",
      },
      adapt: mine,
    };
  },
  5: ([draw]) => {
    const mine = (b: string) => fill(b, ['"pink"', "Flowers:"]);
    return {
      objects: [{ name: "Board", sprite: null }],
      place: [{ object: "Board", x: 0, y: 0 }],
      code: { "Board.draw_gui": mine(draw!) },
      adapt: mine,
    };
  },
  6: ([create, alarm], code) => {
    const mine = (b: string, i: number) => fill(b, i === 0 ? ["45"] : ["1", "60"]);
    return {
      code: {
        "Board.create": mine(create!, 0),
        "Board.alarm 0": mine(alarm!, 1),
        "Board.draw_gui": code("Board.draw_gui") + 'draw_text(10, 34, f"Seconds left: {global_vars.time}")\n',
      },
      adapt: mine,
    };
  },
  7: ([top], code) => {
    const mine = (b: string) => fill(b, ['"r"']);
    return {
      code: {
        "Bee.step": mine(top!) + code("Bee.step"),
        "Board.draw_gui": code("Board.draw_gui") + 'if global_vars.time == 0:\n    draw_text(200, 220, "Buzz! Out of time. R to fly again")\n',
      },
      adapt: mine,
    };
  },
  // The last-second rush: one more point a grab in the last ten seconds.
  8: (_, code) => ({ code: { "Bee.collision Flower": code("Bee.collision Flower") + "if global_vars.time < 10:\n    global_vars.score += 1\n" } }),
};

/** A grab scores the student's 2 and moves the flower; once the clock is out the bee stays put. */
export const play: Play = (g) => {
  run(g, "b = instances('Bee')[0]\nf = instances('Flower')[0]\nb.x, b.y = f.x - 8, f.y - 8");
  step(g, 2);
  expect(run(g, "global_vars.score")).toBe(2);
  const t0 = run(g, "global_vars.time");
  step(g, 130);
  expect(run(g, "global_vars.time"), "the clock counts down a second at a time").toBe(t0 - 2);
  run(g, "global_vars.time = 0\nx = b.x");
  g.engine.input.keyDown(KEY_CODE.get("d")!);
  step(g, 20);
  g.engine.input.keyUp(KEY_CODE.get("d")!);
  expect(run(g, "b.x - x")).toBe(0);
};
