/**
 * Ledge Runner, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': their own map with their own letters (o, s, X), a
 * Fox (the enemy picture, its origin in the middle, so its own offsets) running on A and D
 * and jumping on Space, Brick ground, Apples to collect, Snails in the way, an Exit to reach,
 * and a Corner showing the score. The checks have no names in them, so they must pass.
 */
import { expect } from "vitest";
import { KEY_CODE } from "../../engine/input";
import { fill, run, step, type Play, type Steps } from "./kit";

const MAP = [
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "........................................",
  "..........o.............................",
  ".........###..............o.............",
  "........................####............",
  "....o.........o.........................",
  "...###.......###.......s.........o......",
  "..................##########....###.....",
  "........................................",
  "P...o.....s...........o.......s.....X...",
  "################....####################",
];
if (MAP.some((r) => r.length !== 40) || MAP.length !== 15) throw new Error("the map is 40 × 15");

const LEVEL = `rows = [
${MAP.map((r) => `    "${r}",`).join("\n")}
]
for row in range(len(rows)):
    for col in range(len(rows[row])):
        if rows[row][col] == "#":
            instance_create(col * 32, row * 32, "Brick")
`;

/** The arrow keys swapped for A and D, and a quicker run. */
const keys = (b: string) => b.replace(/"right"/g, '"d"').replace(/"left"/g, '"a"').replace("move * 3", "move * 4");

export const steps: Steps = {
  1: () => ({
    named: [["ground", "brick"]],
    objects: [{ name: "Brick", sprite: "brick", solid: true }, { name: "Level", sprite: null }],
    roomSettings: { Room1: { width: 1280 } },
    place: [{ object: "Level", x: 0, y: 0 }],
    code: { "Level.create": LEVEL },
    adapt: () => LEVEL,
  }),
  2: ([elif, create, step], code) => {
    // The fox's origin is its middle: in the middle of the square, its feet on the floor.
    const mine = (b: string, i: number) => (i === 0 ? b.replace("col * 32 + 4, row * 32 + 8", "col * 32 + 16, row * 32 + 20").replace('"Player"', '"Fox"') : i === 2 ? keys(b) : b);
    return {
      named: [["enemy", "fox"]],
      objects: [{ name: "Fox", sprite: "fox" }],
      code: { "Level.create": code("Level.create") + mine(elif!, 0), "Fox.create": create!, "Fox.step": mine(step!, 2) },
      adapt: mine,
    };
  },
  3: ([jump], code) => {
    const mine = (b: string) => fill(b, ['"space"', "-10", '"space"']);
    return { code: { "Fox.step": code("Fox.step") + mine(jump!) + "if self.y > room_height:\n    room_restart()\n" }, adapt: mine };
  },
  4: ([cam], code) => {
    const mine = (b: string) => fill(b, ["0.2"]);
    return { roomSettings: { Room1: { camera: { enabled: true } } }, code: { "Fox.create": code("Fox.create") + mine(cam!) }, adapt: mine };
  },
  5: ([elif, take], code) => {
    const mine = (b: string, i: number) =>
      i === 0 ? fill(b, ["col * 32 + 16", "row * 32 + 16"]).replace('"c"', '"o"').replace('"Coin"', '"Apple"') : fill(b, ["10", "other"]);
    return {
      named: [["orb", "apple"]],
      objects: [{ name: "Apple", sprite: "apple" }],
      code: {
        "Level.create": code("Level.create") + mine(elif!, 0),
        "Fox.create": code("Fox.create") + "global_vars.score = 0\n",
        "Fox.collision Apple": mine(take!, 1),
      },
      adapt: mine,
    };
  },
  6: ([create, step, stomp], code) => {
    // The fox is 24 tall with its origin in the middle: its feet are 12 below its y.
    const mine = (b: string, i: number) =>
      i === 0 ? fill(b, ["1.5"]) : i === 1 ? fill(b, ["-self.hspeed"]) : fill(b.replace("self.y + 24", "self.y + 12"), ["-7", "room_restart()"]);
    return {
      named: [["bomb", "snail"]],
      objects: [{ name: "Snail", sprite: "snail" }],
      code: {
        "Level.create": code("Level.create") + '        elif rows[row][col] == "s":\n            instance_create(col * 32 + 16, row * 32 + 22, "Snail")\n',
        "Snail.create": mine(create!, 0),
        "Snail.step": mine(step!, 1),
        "Fox.collision Snail": mine(stomp!, 2),
      },
      adapt: mine,
    };
  },
  7: ([top], code) => {
    const mine = (b: string) => fill(b, ['"r"']);
    return {
      named: [["door", "portal"]],
      objects: [{ name: "Exit", sprite: "portal" }],
      code: {
        "Level.create": code("Level.create") + '        elif rows[row][col] == "X":\n            instance_create(col * 32, row * 32, "Exit")\n',
        "Fox.collision Exit": "global_vars.won = True\n",
        "Fox.create": code("Fox.create") + "global_vars.won = False\n",
        "Fox.step": mine(top!) + code("Fox.step"),
      },
      adapt: mine,
    };
  },
  8: ([draw]) => {
    const mine = (b: string) => fill(b, ['"orange"', "Apples:"]);
    return {
      objects: [{ name: "Corner", sprite: null }],
      place: [{ object: "Corner", x: 0, y: 0 }],
      code: { "Corner.draw_gui": mine(draw!) + 'if global_vars.won:\n    draw_text(200, 200, "Home safe! R to run again")\n' },
      adapt: mine,
    };
  },
};

/** What the checks can't see: Space jumps from the floor, and a stomp from above takes a snail. */
export const play: Play = (g) => {
  step(g, 30);
  run(g, "f = instances('Fox')[0]\ny0 = f.y");
  g.engine.input.keyDown(KEY_CODE.get("space")!);
  step(g, 10);
  g.engine.input.keyUp(KEY_CODE.get("space")!);
  expect(run(g, "f.y < y0 - 40"), "Space jumps").toBe(true);
  run(g, "s = instances('Snail')[0]\nn = instance_number('Snail')\nf.x, f.y, f.vy = s.x, s.y - 40, 4");
  step(g, 6);
  expect(run(g, "instance_number('Snail')"), "landing on a snail stomps it").toBe(run(g, "n - 1"));
  expect(run(g, "f.vy")).toBeLessThan(0);
};
