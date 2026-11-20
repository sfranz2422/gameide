/**
 * Crypt of Keys, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': a haunted library. An owl (the ship picture, its
 * origin in the middle) on W A S D, shelves for walls, scrolls for keys, gates for doors,
 * ghosts, a zap on Space, candles for hearts, a lost book for the prize, R to play again,
 * and a map of their own (pillars in the hall). The checks have no names in them, so they
 * must pass.
 */
import { expect } from "vitest";
import { fill, run, step, wasd, type Play, type Steps } from "./kit";

const HALL = '    "#..................#",\n    "#.........k........#",';
const MY_HALL = '    "#...##.......##....#",\n    "#.........k........#",';

/** A line of the map's loop, as this student writes one themselves. */
const elif = (ch: string, object: string) =>
  `        elif rows[row][col] == "${ch}":\n            instance_create(col * 32 + 16, row * 32 + 16, "${object}")\n`;

export const steps: Steps = {
  1: ([level]) => {
    const mine = (b: string) => b.replace('"Wall"', '"Shelf"').replace(HALL, MY_HALL);
    expect(mine(level!)).toContain(MY_HALL);
    return {
      named: [["ground", "books"]],
      objects: [{ name: "Shelf", sprite: "books", solid: true }, { name: "Builder", sprite: null }],
      place: [{ object: "Builder", x: 0, y: 0 }],
      code: { "Builder.create": mine(level!) },
      adapt: mine,
    };
  },
  2: ([at, create, walk], code) => {
    const mine = (b: string, i: number) =>
      i === 0 ? b.replace('"Player"', '"Owl"').replace("col * 32 + 4, row * 32 + 4", "col * 32 + 16, row * 32 + 16")
      : i === 2 ? wasd(b).replace("speed = 3", "speed = 4")
      : b;
    return {
      named: [["ship", "owl"]],
      objects: [{ name: "Owl", sprite: "owl" }],
      code: { "Builder.create": code("Builder.create") + mine(at!, 0), "Owl.create": mine(create!, 1), "Owl.step": mine(walk!, 2) },
      adapt: mine,
    };
  },
  3: ([at, take, open], code) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ['"Scroll"', '"Gate"']) : i === 2 ? fill(b, ['"Gate"', "50"]) : b);
    return {
      named: [["coin", "scroll"], ["wall", "gate"]],
      objects: [{ name: "Scroll", sprite: "scroll" }, { name: "Gate", sprite: "gate", solid: true }],
      code: {
        "Builder.create": code("Builder.create") + mine(at!, 0),
        "Owl.create": code("Owl.create") + "global_vars.keys = 0\n",
        "Owl.collision Scroll": take!,
        "Owl.step": code("Owl.step") + mine(open!, 2),
      },
      adapt: mine,
    };
  },
  4: ([chase], code) => {
    const mine = (b: string) => fill(b, ['"Owl"', "120"]);
    return {
      named: [["bomb", "ghost"]],
      objects: [{ name: "Ghost", sprite: "ghost" }],
      code: { "Builder.create": code("Builder.create") + elif("s", "Ghost"), "Ghost.step": mine(chase!) },
      adapt: mine,
    };
  },
  5: ([create, hit, swing], code) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["12"]) : i === 2 ? fill(b, ['"space"', '"Zap"']) : b);
    return {
      named: [["orb", "zap"]],
      objects: [{ name: "Zap", sprite: "zap" }],
      code: {
        "Zap.create": mine(create!, 0),
        "Zap.alarm 0": "self.destroy()\n",
        "Zap.collision Ghost": hit!,
        "Owl.step": code("Owl.step") + mine(swing!, 2),
      },
      adapt: mine,
    };
  },
  6: ([start, hurt, draw], code) => {
    const mine = (b: string, i: number) => fill(b, i === 0 ? ["4"] : i === 1 ? ["45", '"purple"'] : ['"candle"']);
    return {
      named: [["gem", "candle"]],
      objects: [{ name: "Panel", sprite: null }],
      place: [{ object: "Panel", x: 0, y: 0 }],
      code: {
        "Owl.create": code("Owl.create") + mine(start!, 0),
        "Owl.collision Ghost": mine(hurt!, 1),
        "Owl.step": code("Owl.step") + "if self.hurt > 0:\n    self.hurt -= 1\n",
        "Panel.draw_gui": mine(draw!, 2) + 'draw_text(100, 12, f"Scrolls: {global_vars.keys}")\n',
      },
      adapt: mine,
    };
  },
  7: ([grab, top], code) => {
    const mine = (b: string, i: number) => (i === 1 ? fill(b, ['"r"']) : b);
    return {
      named: [["key", "tome"]],
      objects: [{ name: "Book", sprite: "tome" }],
      code: {
        "Builder.create": code("Builder.create") + elif("G", "Book"),
        "Owl.create": code("Owl.create") + "global_vars.escaped = False\n",
        "Owl.collision Book": grab!,
        "Owl.step": mine(top!, 1) + code("Owl.step"),
        "Panel.draw_gui": code("Panel.draw_gui") + 'if global_vars.escaped:\n    draw_text(160, 220, "You found the lost book! R to read it again")\n',
      },
      adapt: mine,
    };
  },
};

/** A scroll opens the gate it's next to; without one, the gate stays. */
export const play: Play = (g) => {
  run(g, "p = instances('Owl')[0]\nd = min(instances('Gate'), key=lambda d: d.x)\np.x, p.y = d.x - 14, d.y + 16");
  step(g, 5);
  expect(run(g, "instance_number('Gate')"), "no scroll, no opening").toBe(2);
  run(g, "global_vars.keys = 1");
  step(g, 2);
  expect(run(g, "instance_number('Gate')")).toBe(1);
  expect(run(g, "global_vars.keys")).toBe(0);
  // The book ends the game; R plays again.
  run(g, "b = instances('Book')[0]\np.x, p.y = b.x, b.y");
  step(g, 2);
  expect(run(g, "global_vars.escaped")).toBe(true);
};
