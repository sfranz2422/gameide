/**
 * Alley Brawl, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': a Beach of sand and sea, a Cat (the ship picture) on
 * W A S D zapping with J, Zombies closing in, a Zap that lasts 8 steps, a Meter for health.
 * They fill the blanks their own way and write the parts the lesson leaves to them. The
 * checks have no names in them, so they must pass.
 */
import { expect } from "vitest";
import { fill, press, run, step, wasd, type Play, type Steps } from "./kit";

const beach = (b: string) => b.replace('"#3f3f46"', '"#e8c872"').replace('"#71717a"', '"#3b82f6"');
const cat = (b: string) => b.replace(/"Player"/g, '"Cat"').replace(/"Punch"/g, '"Zap"');

export const steps: Steps = {
  1: ([draw]) => ({
    roomSettings: { Room1: { width: 1920 } },
    objects: [{ name: "Beach", sprite: null }],
    place: [{ object: "Beach", x: 0, y: 0 }],
    code: { "Beach.draw": beach(draw!) },
    adapt: beach,
  }),
  2: ([create, step]) => {
    const mine = (b: string, i: number) => (i === 1 ? wasd(b).replace("dx * 3", "dx * 4") : b);
    return {
      named: [["ship", "kitty"]],
      objects: [{ name: "Cat", sprite: "kitty" }],
      place: [{ object: "Cat", x: 60, y: 340 }],
      code: { "Cat.create": create!, "Cat.step": mine(step!, 1) },
      adapt: mine,
    };
  },
  3: ([cam], code) => {
    const mine = (b: string) => fill(b, ["0.1"]);
    return { roomSettings: { Room1: { camera: { enabled: true } } }, code: { "Cat.create": code("Cat.create") + mine(cam!) }, adapt: mine };
  },
  4: ([create, step]) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["4"]) : fill(cat(b), ["350", "1.2"]));
    return {
      named: [["orb", "zombie"]],
      objects: [{ name: "Zombie", sprite: "zombie" }],
      // One on the first screen, near enough to come for the cat at once; the rest along the beach.
      place: [250, 700, 1000, 1250, 1500, 1800].map((x, i) => ({ object: "Zombie", x, y: i % 2 ? 400 : 300 })),
      code: { "Zombie.create": mine(create!, 0), "Zombie.step": mine(step!, 1) },
      adapt: mine,
    };
  },
  5: ([create, hit, zap], code) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["8"]) : i === 1 ? fill(b, ["30", '"yellow"']) : fill(cat(b), ['"j"']));
    return {
      named: [["bullet", "spark"]],
      objects: [{ name: "Zap", sprite: "spark" }],
      code: {
        "Zap.create": mine(create!, 0),
        "Zap.alarm 0": "self.destroy()\n",
        "Zap.collision Zombie": mine(hit!, 1),
        "Cat.step": code("Cat.step") + mine(zap!, 2),
      },
      adapt: mine,
    };
  },
  6: ([attack, draw], code) => {
    const mine = (b: string, i: number) => (i === 0 ? fill(b, ["8", "45"]) : fill(b, ['"orange"', "2"]));
    return {
      objects: [{ name: "Meter", sprite: null }],
      place: [{ object: "Meter", x: 0, y: 0 }],
      code: { "Zombie.step": code("Zombie.step") + mine(attack!, 0), "Meter.draw_gui": mine(draw!, 1) },
      adapt: mine,
    };
  },
  7: ([top], code) => {
    const mine = (b: string) => fill(b, ['"space"']);
    return {
      code: {
        "Cat.step": mine(top!) + code("Cat.step"),
        "Meter.draw_gui":
          code("Meter.draw_gui") +
          'draw_set_color("white")\nif global_vars.health <= 0:\n    draw_text(200, 220, "The zombies got you. Space for another go")\nelif instance_number("Zombie") == 0:\n    draw_text(240, 220, "Beach clear!")\n',
      },
      adapt: mine,
    };
  },
};

/** What the checks can't see: J zaps the zombie in front of the cat, and enough zaps knock it out. */
export const play: Play = (g) => {
  run(g, "c = instances('Cat')[0]\nz = min(instances('Zombie'), key=lambda z: z.x)\nc.x, c.y, c.facing = z.x - 40, z.y - 12, 1\nhp = z.hp");
  press(g, "j");
  step(g, 2);
  expect(run(g, "z.hp"), "a zap takes a point").toBe(run(g, "hp - 1"));
  for (let i = 0; i < 6 && run(g, "z._alive"); i++) {
    run(g, "c.x, c.y = z.x - 40, z.y - 12");
    press(g, "j");
    step(g, 10);
  }
  expect(run(g, "z._alive"), "four zaps knock a zombie out").toBe(false);
};
