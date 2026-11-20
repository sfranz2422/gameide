/**
 * Paddle Duel, an open lesson (2026-11-20), replayed as a student who made their own choices,
 * none of them the examples': a block picture called "shield" on a Wizard (Q and A) and a
 * Witch, its child (O and L); an orb picture called "fireball" served at 5; a script "game";
 * a Tally for the scores; first to 7; Space to play again. They fill the blanks their own way
 * and write the parts the lesson leaves to them. The checks have no names in them, so they
 * must pass.
 */
import { expect } from "vitest";
import { KEY_CODE } from "../../engine/input";
import { fill, run, step, type Play, type Steps } from "./kit";

export const steps: Steps = {
  1: () => ({ named: [["block", "shield"]], objects: [{ name: "Wizard", sprite: "shield" }], place: [{ object: "Wizard", x: 16, y: 208 }] }),
  2: ([create, move]) => {
    const mine = (b: string) => b.replace('"w"', '"q"').replace('"s"', '"a"').replace("move * 6", "move * 8");
    return { code: { "Wizard.create": mine(create!), "Wizard.step": mine(move!) }, adapt: mine };
  },
  3: ([create]) => {
    const mine = (b: string) => b.replace('"up"', '"o"').replace('"down"', '"l"');
    return {
      objects: [{ name: "Witch", sprite: "shield", parent: "Wizard" }],
      place: [{ object: "Witch", x: 560, y: 208 }],
      code: { "Witch.create": mine(create!) },
      adapt: mine,
    };
  },
  4: ([create, top]) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["-5", "5"]) : b);
    return {
      named: [["orb", "fireball"]],
      objects: [{ name: "Fireball", sprite: "fireball" }],
      place: [{ object: "Fireball", x: 320, y: 240 }],
      code: {
        "Fireball.create": mine(create!, 0),
        "Fireball.step": top! + "if self.y > room_height - 6:\n    self.vspeed = -abs(self.vspeed)\n",
      },
      adapt: mine,
    };
  },
  5: ([hit]) => {
    const mine = (b: string) => fill(b, ["1.1", "-speed", "4"]);
    return { code: { "Fireball.collision Wizard": mine(hit!) }, adapt: mine };
  },
  6: ([rules, create, scoring], code) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["-5", "5"]) : b);
    return {
      scripts: { game: mine(rules!, 0) },
      code: {
        "Fireball.create": create!,
        "Fireball.step": code("Fireball.step") + scoring! + "if self.x > room_width + 20:\n    global_vars.left += 1\n    serve(self)\n",
      },
      adapt: mine,
    };
  },
  7: ([draw]) => {
    const mine = (b: string) => fill(b, ['"orange"', "40"]);
    return {
      objects: [{ name: "Tally", sprite: null }],
      place: [{ object: "Tally", x: 0, y: 0 }],
      code: { "Tally.draw_gui": mine(draw!) + "draw_text(360, 20, global_vars.right)\n" },
      adapt: mine,
    };
  },
  8: ([top], code) => {
    const mine = (b: string) => fill(b, ["7", "7", '"space"']);
    return {
      code: {
        "Fireball.step": mine(top!) + code("Fireball.step"),
        "Tally.draw_gui": code("Tally.draw_gui") +
          'if global_vars.left == 7:\n    draw_text(180, 220, "The wizard wins! Space for a rematch")\n' +
          'if global_vars.right == 7:\n    draw_text(180, 220, "The witch wins! Space for a rematch")\n',
      },
      adapt: mine,
    };
  },
};

/** The fireball bounces off the right paddle (a Wizard only through its parent) and the bottom; at 7 it stops. */
export const play: Play = (g) => {
  // Each paddle on its own keys: O moves the Witch and not the Wizard; Q the Wizard and not the Witch.
  const held = (key: string, who: string) => {
    const y = run(g, `instances('${who}')[0].y`);
    g.engine.input.keyDown(KEY_CODE.get(key)!);
    step(g, 10);
    g.engine.input.keyUp(KEY_CODE.get(key)!);
    return run(g, `instances('${who}')[0].y`) - y;
  };
  expect(held("o", "Witch"), "the second paddle moves on its own keys").toBeLessThan(0);
  expect(held("o", "Wizard"), "and the first doesn't").toBe(0);
  expect(held("q", "Witch"), "nor the second on the first's").toBe(0);
  run(g, "b = instances('Fireball')[0]\np2 = instances('Witch')[0]\nb.x, b.y, b.hspeed, b.vspeed = p2.x - 30, p2.y + 32, 4, 0");
  for (let i = 0; i < 30 && run(g, "b.hspeed") > 0; i++) step(g);
  expect(run(g, "b.hspeed"), "the ball bounces off the right paddle").toBeLessThan(0);
  expect(run(g, "b.x")).toBeLessThan(run(g, "p2.x"));
  run(g, "b.x, b.y, b.hspeed, b.vspeed = 320, room_height - 4, 0, 3");
  step(g, 2);
  expect(run(g, "b.vspeed"), "and off the bottom").toBeLessThan(0);
  run(g, "global_vars.left = 7\nb.hspeed = 5");
  step(g);
  expect(run(g, "b.hspeed"), "the winner stops the game").toBe(0);
};
