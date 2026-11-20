/**
 * Gem Guard, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': their own path, Slimes sent from a Cave, Cannons
 * firing Peas, a Cake to guard, Pads to build on, Zippy and Tank as the new kinds, and their
 * own prices, gold, lives and toughness. The checks have no names in them, so they must
 * pass; the play-check then plays the whole game with the student's numbers.
 */
import { expect } from "vitest";
import { fill, press, run, step, type Play, type Steps } from "./kit";

const PATH = "ROAD = [(-20, 100), (520, 100), (520, 280), (120, 280), (120, 420), (600, 420)]\n";
/** The examples' names, as this student called them. */
const names = (b: string) =>
  b.replace(/"Enemy"/g, '"Slime"').replace(/"Shot"/g, '"Pea"').replace(/"Tower"/g, '"Cannon"').replace(/"Runner"/g, '"Zippy"').replace(/"Brute"/g, '"Tank"');

export const steps: Steps = {
  1: ([, create, draw]) => {
    const mine = (b: string, i: number) => (i === 0 ? PATH : i === 2 ? b.replace('"#b08850"', '"#6b8e23"').replace(", 40)", ", 36)") : b);
    return {
      scripts: { paths: PATH },
      objects: [{ name: "Path", sprite: null }],
      place: [{ object: "Path", x: 0, y: 0 }],
      code: { "Path.create": create!, "Path.draw": mine(draw!, 2) },
      adapt: mine,
    };
  },
  2: ([create, walk]) => {
    const mine = (b: string, i: number) => (i === 0 ? b.replace("self.walk = 1.5", "self.walk = 1.4").replace("self.hp = 20", "self.hp = 18") : b);
    return {
      named: [["bomb", "goo"]],
      objects: [{ name: "Slime", sprite: "goo" }],
      code: { "Slime.create": mine(create!, 0), "Slime.step": walk! },
      adapt: mine,
    };
  },
  3: ([create, alarm]) => {
    const mine = (b: string, i: number) => (i === 1 ? fill(names(b), ["50"]) : b);
    return {
      objects: [{ name: "Cave", sprite: null }],
      place: [{ object: "Cave", x: 0, y: 0 }],
      code: { "Cave.create": create!, "Cave.alarm 0": mine(alarm!, 1) },
      adapt: mine,
    };
  },
  4: ([create, fire]) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["25", "150", "6"]) : fill(names(b), ["9"]));
    return {
      named: [["orb", "turret"], ["ball", "pea"]],
      objects: [{ name: "Cannon", sprite: "turret" }, { name: "Pea", sprite: "pea" }],
      place: [{ object: "Cannon", x: 320, y: 190 }],
      code: { "Cannon.create": mine(create!, 0), "Cannon.step": mine(fire!, 1), "Pea.create": "self.alarm[0] = 45\n", "Pea.alarm 0": "self.destroy()\n" },
      adapt: mine,
    };
  },
  5: ([hit], code) => {
    const mine = (b: string) => fill(b, ["self.damage"]);
    return {
      code: {
        "Pea.collision Slime": mine(hit!),
        "Slime.step": 'if self.hp <= 0:\n    effect("explosion", self.x, self.y)\n    self.destroy()\n' + code("Slime.step"),
      },
      adapt: mine,
    };
  },
  6: ([steal, start, shown, paid], code) => {
    const blow = 'effect("explosion", self.x, self.y)\n';
    expect(code("Slime.step")).toContain(blow);
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["other"]) : i === 1 ? fill(b, ["120", "8"]) : i === 2 ? fill(b, ['"pink"']) : b);
    return {
      named: [["heart", "cake"]],
      objects: [{ name: "Cake", sprite: "cake" }, { name: "Panel", sprite: null }],
      place: [{ object: "Cake", x: 600, y: 420 }, { object: "Panel", x: 0, y: 0 }],
      code: {
        "Cake.collision Slime": mine(steal!, 0),
        "Panel.create": mine(start!, 1),
        "Panel.draw_gui": mine(shown!, 2) + 'draw_text(10, 30, f"Bites left {global_vars.lives}")\n',
        "Slime.step": code("Slime.step").replace(blow, blow + paid!),
        "Slime.create": code("Slime.create") + "self.pay = 12\n",
      },
      adapt: mine,
    };
  },
  7: ([build]) => {
    const mine = (b: string) => fill(names(b), ["60", "60"]);
    return {
      named: [["door", "pad"]],
      objects: [{ name: "Pad", sprite: "pad" }],
      place: [[200, 140], [400, 140], [560, 180], [240, 320], [420, 330], [40, 330]].map(([x, y]) => ({ object: "Pad", x: x!, y: y! })),
      code: { "Pad.mouse left pressed": mine(build!) },
      adapt: mine,
    };
  },
  8: ([child, left, pick], code) => {
    const line = /instance_create\(ROAD\[0\]\[0\], ROAD\[0\]\[1\], "Slime"\)\n/;
    expect(code("Cave.alarm 0")).toMatch(line);
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["2.8", "9", "6"]) : i === 1 ? fill(b, ["32"]) : names(b));
    return {
      named: [["enemy", "zip"], ["car", "tank"]],
      objects: [{ name: "Zippy", sprite: "zip", parent: "Slime" }, { name: "Tank", sprite: "tank", parent: "Slime" }],
      code: {
        "Zippy.create": mine(child!, 0),
        "Tank.create": "super().on_create()\nself.walk = 0.7\nself.hp = 55\nself.pay = 24\nself.image_xscale = self.image_yscale = 1.3\n",
        "Cave.create": code("Cave.create") + mine(left!, 1),
        "Cave.alarm 0": code("Cave.alarm 0").replace(line, mine(pick!, 2)),
      },
      adapt: mine,
    };
  },
  9: ([up]) => {
    const mine = (b: string) => fill(b, ["70", "70"]);
    return { code: { "Cannon.mouse left pressed": mine(up!) }, adapt: mine };
  },
  10: ([again, done], code) => {
    const last = /self\.alarm\[0\] = 50 .*\n/;
    expect(code("Cave.alarm 0")).toMatch(last);
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["18"]) : names(b));
    return {
      code: {
        "Cave.alarm 0": code("Cave.alarm 0").replace(last, mine(again!, 0)),
        "Cave.step": mine(done!, 1),
        "Panel.create": code("Panel.create") + "global_vars.won = False\n",
        "Panel.step": 'if keyboard_check_pressed("enter"):\n    room_restart()\n',
        "Panel.draw_gui":
          code("Panel.draw_gui") +
          'if global_vars.lives <= 0:\n    draw_text(200, 220, "They ate the cake! Enter to try again")\nelif global_vars.won:\n    draw_text(200, 220, "The cake is safe! Enter to play again")\n',
      },
      adapt: mine,
    };
  },
};

/** A whole game with the mouse, at this student's prices: towers built on pads and upgraded hold the cake; a lone cannon doesn't. */
export const play: Play = (g) => {
  const click = (x: number, y: number) => {
    g.engine.input.mouseMove(x + 5, y + 5);
    step(g);
    g.engine.input.mouseDown(0);
    step(g);
    g.engine.input.mouseUp(0);
    step(g);
  };
  const start = run(g, "instance_number('Cannon')");
  run(g, "s = instances('Pad')[0]\nsx, sy = s.x, s.y\ngold = global_vars.gold");
  click(run(g, "sx"), run(g, "sy"));
  expect(run(g, "instance_number('Cannon')"), "a click on a pad builds").toBe(start + 1);
  expect(run(g, "global_vars.gold"), "and costs").toBe(run(g, "gold - 60"));
  expect(run(g, "instance_number('Pad')")).toBe(5);
  // The cannon stands in the middle of where the pad was.
  expect(run(g, "any(t.x == sx + 16 and t.y == sy + 16 for t in instances('Cannon'))")).toBe(true);
  // Too poor: nothing.
  run(g, "global_vars.gold = 10");
  run(g, "s = instances('Pad')[0]\nsx, sy = s.x, s.y");
  click(run(g, "sx"), run(g, "sy"));
  expect(run(g, "instance_number('Cannon')")).toBe(start + 1);
  // An upgrade doubles what its shots do.
  run(g, "global_vars.gold = 100\nt = instances('Cannon')[0]");
  click(run(g, "t.x"), run(g, "t.y"));
  expect(run(g, "t.damage")).toBe(12);
  expect(run(g, "global_vars.gold")).toBe(30);
  // Children are slimes, with their own numbers and their parent's walk.
  run(g, "r = instance_create(0, 100, 'Zippy')\nb = instance_create(0, 100, 'Tank')");
  expect(run(g, "r.walk > 1.4 and r.hp < 18 and b.walk < 1.4 and b.hp > 18")).toBe(true);
  step(g);
  expect(run(g, "r.speed")).toBeCloseTo(2.8);
  run(g, "r.hp = 0\ngold = global_vars.gold");
  step(g, 2);
  expect(run(g, "r._alive"), "a child dies as its parent does").toBe(false);
  expect(run(g, "global_vars.gold")).toBe(run(g, "gold + 6"));
  run(g, "b.destroy()");
  // Slimes walk the middle of the path they're drawn on: its corners are their own x and y.
  run(g, "e = instance_create(ROAD[0][0], ROAD[0][1], 'Slime')");
  step(g, 60);
  expect(run(g, "e.y")).toBe(run(g, "ROAD[0][1]"));
  run(g, "e.destroy()");
  // Now the whole game, built up as gold comes in.
  for (let i = 0; i < 16000 && !run(g, "global_vars.won or global_vars.lives <= 0"); i += 30) {
    if (run(g, "global_vars.gold >= 60 and instance_number('Pad') > 0")) {
      run(g, "s = instances('Pad')[0]\nsx, sy = s.x, s.y");
      click(run(g, "sx"), run(g, "sy"));
    } else if (run(g, "global_vars.gold >= 70 and instance_number('Pad') == 0")) {
      run(g, "t = min(instances('Cannon'), key=lambda t: t.damage)");
      click(run(g, "t.x"), run(g, "t.y"));
    }
    step(g, 30);
  }
  expect(run(g, "global_vars.won"), "cannons and upgrades hold the cake").toBe(true);
  expect(run(g, "global_vars.lives")).toBeGreaterThan(0);
  expect(run(g, "instance_number('Slime')")).toBe(0);
  // Enter starts again, as it began.
  press(g, "enter");
  step(g, 2);
  expect(run(g, "global_vars.won")).toBe(false);
  expect(run(g, "global_vars.lives")).toBe(8);
  expect(run(g, "instance_number('Pad')")).toBe(6);
  // And with only the one cannon it started with, the cake goes.
  for (let i = 0; i < 16000 && run(g, "global_vars.lives > 0"); i += 60) step(g, 60);
  expect(run(g, "global_vars.lives"), "one cannon isn't enough").toBeLessThanOrEqual(0);
  expect(run(g, "global_vars.won")).toBe(false);
};
