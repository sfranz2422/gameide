/**
 * Robot's Garden, an open lesson (2026-11-20), replayed as a student who made their own
 * choices, none of them the examples': a beetle from a sheet of their own (8 frames of
 * 64 × 64, half size) on W A S D, layers called Lawn, Trails and Rocks, acorns to collect,
 * a Clock for the words, ninety seconds, R to play again. The checks have no names in them
 * (but the room and the tileset, which the lesson names), so they must pass.
 */
import { expect } from "vitest";
import { KEY_CODE } from "../../engine/input";
import { autotilePaint, rectCells } from "../../editor/tiles/tileOps";
import { newId, newTileset, type Project } from "../../store/project";
import { fill, run, step, wasd, type Play, type Steps } from "./kit";

/** The garden as this student paints it, 60 × 45 tiles of 16. */
const GARDEN = { cols: 60, rows: 45, grass: 16, bush: 18, pond: 19 };
const pathSet = { id: "path", name: "path", tiles: Array.from({ length: 16 }, (_, i) => i) };
const layer = (p: Project, name: string, tiles: Record<string, number>) =>
  p.rooms[0]!.layers.push({ id: newId(), name, kind: "tiles", depth: 100 - p.rooms[0]!.layers.length, visible: true, locked: false, tileset: p.tilesets[0]!.id, tiles });
// A loop round the garden with a path across its middle, and a dead end off the top.
const trails = [
  ...rectCells(5, 5, 50, 5), ...rectCells(50, 5, 50, 35), ...rectCells(5, 35, 50, 35), ...rectCells(5, 5, 5, 35),
  ...rectCells(5, 20, 25, 20), ...rectCells(40, 1, 40, 5),
];
const ACORNS = [[100, 100], [820, 100], [100, 600], [820, 600], [460, 300], [700, 450], [300, 650], [600, 150], [880, 350], [60, 350], [640, 40]];

const SCALE = (b: string) => b.replace(/0\.25/g, "0.5");

export const steps: Steps = {
  1: () => ({
    also: (p) =>
      // A picture id, as a student's has (the game leaves out the tile layers of a tileset with none).
      void p.tilesets.push({ ...newTileset("garden"), image: newId(), imageWidth: 128, imageHeight: 48, tileWidth: 16, tileHeight: 16, autotiles: [pathSet] }),
  }),
  2: () => ({
    roomSettings: { Room1: { width: 960, height: 720 } },
    also: (p) => {
      layer(p, "Lawn", Object.fromEntries(rectCells(0, 0, GARDEN.cols - 1, GARDEN.rows - 1).map(([c, r]) => [`${c},${r}`, GARDEN.grass])));
      layer(p, "Trails", autotilePaint({}, trails, pathSet, { columns: GARDEN.cols, rows: GARDEN.rows }));
    },
  }),
  3: () => ({
    also: (p) => {
      const things: Record<string, number> = {};
      for (let c = 9; c < 27; c += 3) things[`${c},6`] = GARDEN.bush; // a hedge under the loop's top
      things["44,24"] = things["45,24"] = things["44,25"] = things["45,25"] = GARDEN.pond;
      things["30,20"] = GARDEN.bush; // the one the play-check walks into
      layer(p, "Rocks", things);
      p.tilesets[0]!.solid = [GARDEN.bush, GARDEN.pond];
    },
  }),
  4: ([create, walk]) => {
    const mine = (b: string, i: number) => (i === 1 ? wasd(SCALE(b)) : SCALE(b));
    return {
      objects: [{ name: "Beetle", sprite: null }], // its sprite is made below, then given to it
      place: [{ object: "Beetle", x: 240, y: 420 }],
      code: { "Beetle.create": mine(create!, 0), "Beetle.step": mine(walk!, 1) },
      adapt: mine,
      also: (p) => {
        // The beetle as the importer makes it from the student's own sheet: 8 frames of 64 × 64, its feet the origin.
        const beetle = { id: newId(), name: "beetle", width: 64, height: 64, originX: 32, originY: 63, frames: Array.from({ length: 8 }, newId), fps: 12,
          mask: { kind: "rect" as const, left: 16, top: 8, right: 48, bottom: 64 } };
        p.sprites.push(beetle);
        p.objects.find((o) => o.name === "Beetle")!.sprite = beetle.id;
      },
    };
  },
  5: ([faster], code) => {
    const mine = (b: string) => fill(b, ['"Trails"', "3.5"]);
    expect(code("Beetle.step")).toMatch(/^speed = 2\n/);
    return { code: { "Beetle.step": code("Beetle.step").replace(/^speed = 2\n/, mine(faster!)) }, adapt: mine };
  },
  6: () => ({ roomSettings: { Room1: { camera: { enabled: true, follow: "Beetle" } } } }),
  7: ([draw]) => {
    const mine = (b: string) => fill(b, ['"yellow"', "Acorns", '"Acorn"']);
    return {
      named: [["gem", "acorn"]],
      objects: [{ name: "Acorn", sprite: "acorn" }, { name: "Clock", sprite: null }],
      place: [...ACORNS.map(([x, y]) => ({ object: "Acorn", x: x!, y: y! })), { object: "Clock", x: 0, y: 0 }],
      code: { "Beetle.collision Acorn": "global_vars.seeds += 1\nother.destroy()\n", "Clock.draw_gui": mine(draw!) },
      adapt: mine,
    };
  },
  8: ([create, alarm, shown, top], code) => {
    const mine = (b: string, i: number) =>
      fill(b, i === 0 ? ["90"] : i === 1 ? ['"Acorn"'] : i === 2 ? ['"Acorn"', '"Every acorn! R to play again"'] : ['"Acorn"', '"r"']);
    return {
      code: {
        "Clock.create": mine(create!, 0),
        "Clock.alarm 0": mine(alarm!, 1),
        "Clock.draw_gui": code("Clock.draw_gui") + mine(shown!, 2) + 'elif global_vars.time == 0:\n    draw_text(240, 220, "Out of time! R to try again")\n',
        "Beetle.step": mine(top!, 3) + code("Beetle.step"),
      },
      adapt: mine,
    };
  },
};

/** Quicker on a path than on grass; a bush in the way stops it; the clock stops with the last acorn. */
export const play: Play = (g) => {
  const walk = (x: number, y: number) => {
    run(g, `b = instances('Beetle')[0]\nb.x, b.y = ${x}, ${y}`);
    step(g);
    const from = run(g, "b.x");
    g.engine.input.keyDown(KEY_CODE.get("d")!);
    step(g, 30);
    g.engine.input.keyUp(KEY_CODE.get("d")!);
    return run(g, "b.x") - from;
  };
  const onPath = walk(8 * 16, 35 * 16 + 12); // along the loop's bottom
  const onGrass = walk(8 * 16, 28 * 16 + 12);
  expect(onPath, "quicker on the path").toBeGreaterThan(onGrass * 1.3);
  expect(walk(27 * 16, 20 * 16 + 12), "a bush at column 30 stops it").toBeLessThan(50); // free, it goes 60 or more
  run(g, "for a in instances('Acorn'): a.destroy()");
  step(g, 2);
  const left = run(g, "global_vars.time");
  expect(left).toBeGreaterThan(0);
  step(g, 150);
  expect(run(g, "global_vars.time"), "the clock stops with the last acorn").toBe(left);
};
