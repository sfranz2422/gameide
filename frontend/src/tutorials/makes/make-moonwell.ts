/**
 * Moonwell, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': a fox (the heart picture, its origin in the middle)
 * on W A S D, rocks for walls built by a World, a feather for the double jump, a crystal
 * for the prize, a Sign for the words, and a second jump a little weaker than the first.
 * The checks have no names in them, so they must pass.
 */
import { expect } from "vitest";
import { fill, press, run, step, wasd, type Play, type Steps } from "./kit";
import { KEY_CODE } from "../../engine/input";

const SINGLE = 'if on_ground and keyboard_check_pressed("w"):\n    self.vy = -9\n';

export const steps: Steps = {
  1: ([maps]) => ({ rooms: [{ name: "Room2" }], scripts: { levels: maps! } }),
  2: ([level]) => {
    const mine = (b: string) => b.replace('"Wall"', '"Rock"');
    return {
      named: [["ground", "stone"]],
      objects: [{ name: "Rock", sprite: "stone", solid: true }, { name: "World", sprite: null }],
      place: [
        { object: "World", x: 0, y: 0 },
        { object: "World", x: 0, y: 0, room: "Room2" },
      ],
      code: { "World.create": mine(level!) },
      adapt: mine,
    };
  },
  3: ([at, create, walk], code) => {
    const mine = (b: string, i: number) =>
      i === 0 ? b.replace(/"Player"/g, '"Fox"').replace(/col \* 32 \+ 4, row \* 32 \+ 8/g, "col * 32 + 16, row * 32 + 16") : i === 2 ? wasd(b) : b;
    return {
      named: [["heart", "fox"]],
      objects: [{ name: "Fox", sprite: "fox" }],
      code: { "World.create": code("World.create") + mine(at!, 0), "Fox.create": mine(create!, 1), "Fox.step": mine(walk!, 2) },
      adapt: mine,
    };
  },
  4: ([right], code) => {
    const mine = (b: string) => fill(b, ["room_width - 12"]);
    const left = 'if self.x < -8 and room_name() in LEFT:\n    global_vars.arrive = "right"\n    room_goto(LEFT[room_name()])\n';
    return { code: { "Fox.step": code("Fox.step") + mine(right!) + left }, adapt: mine };
  },
  5: ([at, take], code) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ['"Feather"']) : b);
    return {
      named: [["flag", "feather"]],
      objects: [{ name: "Feather", sprite: "feather" }],
      code: { "World.create": code("World.create") + mine(at!, 0), "Fox.collision Feather": take! + "other.destroy()\n" },
      adapt: mine,
    };
  },
  6: ([jump], code) => {
    const mine = (b: string) => fill(b, ['"w"', "-9", "-8.5"]);
    expect(code("Fox.step")).toContain(SINGLE);
    return { code: { "Fox.step": code("Fox.step").replace(SINGLE, mine(jump!)) }, adapt: mine };
  },
  7: ([grab, draw], code) => {
    const mine = (b: string, i: number) => (i === 1 ? fill(b, ['"yellow"', '"Feather power: jump in mid-air!"']) : b);
    const at = '        elif ch == "g":\n            instance_create(col * 32 + 16, row * 32 + 16, "Crystal")\n';
    return {
      named: [["ball", "crystal"]],
      objects: [{ name: "Crystal", sprite: "crystal" }, { name: "Sign", sprite: null }],
      place: [
        { object: "Sign", x: 0, y: 0 },
        { object: "Sign", x: 0, y: 0, room: "Room2" },
      ],
      code: {
        "World.create": code("World.create") + at,
        "Fox.collision Crystal": grab!,
        "Sign.draw_gui": mine(draw!, 1) + 'if hasattr(global_vars, "won"):\n    draw_text(180, 220, "The crystal is yours!")\n',
      },
      adapt: mine,
    };
  },
};

/**
 * Both gaps lead where they say, arriving at L and R; and the crystal's ledge is out of
 * reach of one jump from the step, in reach of two.
 */
export const play: Play = (g) => {
  const hold = (key: string, steps: number, until: string) => {
    g.engine.input.keyDown(KEY_CODE.get(key)!);
    for (let i = 0; i < steps && !run(g, until); i++) step(g);
    g.engine.input.keyUp(KEY_CODE.get(key)!);
    step(g);
  };
  hold("d", 400, "room_name() == 'Room2'");
  expect(run(g, "room_name() == 'Room2'"), "right, through Room1's gap").toBe(true);
  step(g, 2);
  expect(run(g, "instances('Fox')[0].x")).toBeLessThan(120); // arrived at the L
  hold("a", 200, "room_name() == 'Room1'");
  expect(run(g, "room_name() == 'Room1'"), "left, through Room2's gap").toBe(true);
  step(g, 2);
  expect(run(g, "instances('Fox')[0].x")).toBeGreaterThan(500); // arrived at the R

  const highest = (double: boolean) => {
    // On the step, standing: the fox's middle is 8 above the step's top.
    run(g, `global_vars.double_jump = ${double ? "True" : "False"}\np = instances('Fox')[0]\np.x, p.y, p.vy = 5 * 32 + 20, 12 * 32 - 8, 0`);
    step(g, 4);
    let top = 999;
    press(g, "w");
    for (let i = 0; i < 70; i++) {
      if (double && i === 16) press(g, "w");
      step(g);
      top = Math.min(top, run(g, "p.y"));
    }
    return top;
  };
  // The ledge under the crystal, as the map built it; standing on it, the fox's middle is 8 above.
  const ledge = run(g, "c = instances('Crystal')[0]\nmin(w.y for w in instances('Rock') if w.x <= c.x < w.x + 32 and w.y > c.y)") - 8;
  expect(highest(false), "one jump doesn't reach the ledge").toBeGreaterThan(ledge);
  expect(highest(true), "two jumps do").toBeLessThanOrEqual(ledge);
};
