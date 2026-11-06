/**
 * The twelfth showcase game, Snowcap Scramble (an endless climb), played headless
 * in the real Pyodide. Runs when the game has been built (python3
 * showcase/climber/build.py, which needs only the repo).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/climber/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const scores: number[] = [];
  const { game, error } = await PythonGame.load({ ...def, save } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    score: (n) => scores.push(n),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { saved: () => saved, scores });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
const key = (g: PythonGame, name: string, down: boolean) => (down ? g.engine.input.keyDown(KEY_CODE.get(name)!) : g.engine.input.keyUp(KEY_CODE.get(name)!));
function tap(g: PythonGame, name: string) {
  key(g, name, true);
  step(g);
  key(g, name, false);
  step(g);
}
async function climbing(save: Record<string, unknown> = {}) {
  const g = await start(save);
  tap(g, "space");
  step(g, 2);
  expect(py(g, "room_name()")).toBe("Mountain");
  step(g, 30);
  return g;
}

/** The climber: x, y, the plan's number of the ledge stood on (-1 the ground, null in the air), vy. */
const me = (g: PythonGame) =>
  (py(g, "p = global_vars.player\n(p.x, p.y, p.on.plan_i if p.on is not None and hasattr(p.on, 'plan_i') else (-1 if p.on is not None else 'air'), p.vy)") as unknown as [number, number, number | string, number])
    .map((v) => (v === "air" ? null : v)) as [number, number, number | null, number];
/** Puts the climber standing on the plan's ledge `i` (its middle, or `dx` from it). */
function standOn(g: PythonGame, i: number, dx = 0) {
  py(g, `p = plan(); e = p.ledges[${i}]\nme = global_vars.player\nme.x, me.y, me.on = e['x'], e['y'] - 300, None\ncamera_set(e['x'] - VIEW_W / 2, e['y'] - 200)`);
  step(g, 2);
  py(g, `e = plan().ledges[${i}]\nl = [o for o in instances('Ledge') if getattr(o, 'plan_i', None) == ${i}][0]\nme = global_vars.player\nme.x, me.y, me.vx, me.vy, me.on = l.x + ${dx}, l.y, 0, 0, l\nme.top_of_fall = me.y`);
  step(g, 2);
}
/** One route of the plan, as the bot sees it: the one nearest base camp, unless another's asked for. */
const path = (g: PythonGame, n: number, route = 1) =>
  py(g, `p = plan(); p.grow(GROUND_Y - 30000)\n[(e['i'], e['x'], e['y'], e['w'], e['kind']) for e in p.routes[${route}][:${n}]]`) as unknown as [number, number, number, number, string][];

/**
 * A bot that climbs the way a player would, with the keys: stands under (or at
 * the near edge of) the next ledge of the path, jumps, and steers onto it. It
 * knows the plan, which a player doesn't, but it has to make every jump itself.
 */
function climbTo(g: PythonGame, metres: number, maxSteps: number) {
  const ledges = path(g, 1000);
  const held = new Set<string>();
  const hold = (k: string, on: boolean) => {
    if (on && !held.has(k)) (key(g, k, true), held.add(k));
    if (!on && held.has(k)) (key(g, k, false), held.delete(k));
  };
  let next = 0;
  let wasJump = false;
  let runFrom: number | null = null;   // the ledge a run-up is being taken on
  let runUp = false;
  for (let t = 0; t < maxSteps; t++) {
    const [x, y, on, vy] = me(g);
    if ((py(g, "global_vars.height") as number) >= metres) {
      // Let go of everything: the next climb starts with no keys down.
      for (const k of [...held]) hold(k, false);
      return t;
    }
    // The next ledge of the path above the feet (after a fall, a lower one again),
    // chosen standing: in the air it keeps going for the one it jumped at.
    if (on != null) next = ledges.findIndex((l) => l[2] < y - 1);
    const [ti, planX, , tw] = ledges[next]!;
    // Where it is now: a plank swings.
    const live = py(g, `[o.x for o in instances('Ledge') if getattr(o, 'plan_i', None) == ${ti}]`) as unknown as number[];
    const tx = live[0] ?? planX;
    const half = tw / 2;
    let want = 0;
    if (on != null) {
      // Standing. Under it: straight up. Close: from the near edge. Far: back up to
      // the far end first and take a run at it, as a player would (on ice above all).
      const [lx, lhalf, cracked] = py(g, "o = global_vars.player.on\n(o.x, o.half, o.slippery or o.object_name == 'CrumbleLedge')") as unknown as [number, number, boolean];
      const dir = Math.sign(tx - lx) || 1;
      const gapAcross = Math.abs(tx - lx) - lhalf - half;
      const under = Math.abs(x - tx) < half - 6 && Math.abs(x - lx) < lhalf;
      if (on !== runFrom) (runFrom = on, runUp = false);
      // No run-up on ice: you'd slide off the end backing up (and cracked ice breaks
      // before you get going). Crossing it is run-up enough: ice gets you going as you go.
      if (!under && gapAcross > 24 && !runUp && !cracked) {
        const back = lx - dir * (lhalf - 8);
        want = Math.abs(back - x) > 4 ? Math.sign(back - x) : 0;
        if (want === 0) runUp = true;
      } else if (!under) {
        want = dir;
      } else {
        want = Math.abs(tx - x) > 4 ? Math.sign(tx - x) : 0;
      }
      const atEdge = !under && want === dir && dir * (x - lx) > lhalf - 4;
      // A jump is a press: let go first if it's still held from the last one.
      const jump: boolean = (under || atEdge) && !wasJump;
      hold("space", jump);
      wasJump = jump;
    } else {
      runFrom = null;
      // In the air: steer over it, and stop pushing once over it.
      const gap = tx - x;
      want = vy < 0 || Math.abs(gap) > half - 10 ? (Math.abs(gap) > 4 ? Math.sign(gap) : 0) : 0;
      hold("space", vy < 0);
      wasJump = false;
    }
    hold("right", want > 0);
    hold("left", want < 0);
    step(g);
  }
  for (const k of [...held]) hold(k, false);
  return -1;
}

describe.skipIf(!have)("Snowcap Scramble", () => {
  it("starts on the title, and Space starts the climb at base camp", async () => {
    const g = await climbing();
    expect(py(g, "global_vars.height")).toBe(0);
    expect(py(g, "instance_number('Ledge')") as number).toBeGreaterThan(5);
    expect(py(g, "global_vars.player.sprite")).toBe("climber_red");
  });

  it("the climber picked on the title is the one climbing, and is remembered", async () => {
    const g = await start();
    tap(g, "right");
    tap(g, "right");
    tap(g, "space");
    step(g, 3);
    expect(py(g, "global_vars.player.sprite")).toBe("climber_purple");
    expect(g.saved().climber).toBe("purple");
    const again = await start({ climber: "fox" });
    tap(again, "space");
    step(again, 3);
    expect(py(again, "global_vars.player.sprite")).toBe("climber_fox");
  });

  it("the same seed makes the same mountain, five screens wide, with four ways up that can each be climbed", async () => {
    const g = await start();
    const check = py(g, `
a, b = Plan(), Plan()
a.grow(GROUND_Y - 1500 * METER)
b.grow(GROUND_Y - 1500 * METER)
bad = []
for k, route in enumerate(a.routes):
    prev = {"kind": "rock", "x": round(sum(a.lanes[k]) / 2), "y": GROUND_Y, "w": 400}
    for e in route:
        if not can_reach(prev, e):
            bad.append(e["i"])
        prev = e
for e in a.ledges:
    if not (WALL_L <= e["x"] - e["w"] / 2 and e["x"] + e["w"] / 2 <= WALL_R):
        bad.append(("wall", e["i"]))
xs = [e["x"] for e in a.path]
(a.ledges == b.ledges, [len(r) for r in a.routes], bad, sorted(set(e["kind"] for e in a.path)), ROOM_W // VIEW_W, min(xs) < VIEW_W, max(xs) > ROOM_W - VIEW_W)`) as unknown as [boolean, number[], unknown[], string[], number, boolean, boolean];
    expect(check[0]).toBe(true);
    expect(check[1].length).toBe(4);
    for (const n of check[1]) expect(n).toBeGreaterThan(500);
    expect(check[2]).toEqual([]);
    expect(check[3]).toEqual(["block", "crumble", "ice", "plank", "rock"]);
    expect(check[4]).toBe(5);
    expect(check[5] && check[6], "the routes reach both ends").toBe(true);
    expect(py(g, "Plan(7).ledges[:5] != Plan(2026).ledges[:5] or (Plan(7).grow(GROUND_Y - 400), Plan(7).ledges[:3]) != None")).toBe(true);
  });

  it("ledges never sit on top of each other: overlapping across, they're a climber's height apart", async () => {
    const g = await start();
    const [over, squeezed] = py(g, `
p = Plan()
p.grow(GROUND_Y - 1500 * METER)
over = 0
for a in p.ledges:
    for b in p.ledges_between(a["y"] - CLEAR_Y + 1, a["y"] + CLEAR_Y - 1, a["x"] - 400, a["x"] + 400):
        swing = (PLANK_SWING if a["kind"] == "plank" else 0) + (PLANK_SWING if b["kind"] == "plank" else 0)
        if b["i"] > a["i"] and abs(a["x"] - b["x"]) - (a["w"] + b["w"]) / 2 - swing < CLEAR_X:
            over += 1
(over, p.squeezed)`) as unknown as [number, number];
    // A route that's boxed in gets a ledge anyway, rather than stopping: rare, and counted.
    expect(squeezed).toBeLessThan(6);
    expect(over).toBeLessThanOrEqual(squeezed);
  });

  it("the snow goes the whole way across the foot of the mountain, not just under the camp", async () => {
    const g = await climbing();
    const snow = py(g, 'import gameide\ngameide._sprite_index["snow_ground"]') as number;
    const [w, top] = py(g, '(SIZES["snow_ground"][0], GROUND_Y + GROUND_TOP)') as unknown as [number, number];
    for (const x of [100, 700, 1600, 2600, 3100]) {
      py(g, `me = global_vars.player\nme.x = ${x}`);
      step(g, 90);
      const vx = py(g, "view_x") as number;
      const strips = g.engine.drawList.filter((c) => c[0] === "sprite" && c[2] === snow) as unknown as unknown[][];
      expect(strips.length, `at ${x}`).toBeGreaterThan(0);
      for (const c of strips) expect(c[5]).toBe(top);
      const xs = strips.map((c) => c[4] as number).sort((a, b) => a - b);
      expect(xs[0]!).toBeLessThanOrEqual(vx);
      expect(xs.at(-1)! + w).toBeGreaterThanOrEqual(vx + 640);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBe(w);
    }
  });

  it("running alternates two strides", async () => {
    const g = await climbing();
    key(g, "right", true);
    const frames = new Set<number>();
    for (let t = 0; t < 40; t++) {
      step(g);
      frames.add(py(g, "global_vars.player.image_index") as number);
    }
    key(g, "right", false);
    expect(frames.has(1) && frames.has(2)).toBe(true);
    expect([...frames].every((f) => f <= 2)).toBe(true);
  });

  it("the camera follows you across the mountain, and the walls are only at its ends", async () => {
    const g = await climbing();
    const [x0] = me(g);
    expect(x0).toBe(py(g, "ROOM_W / 2"));
    py(g, "me = global_vars.player\nme.x = ROOM_W - 100");
    step(g, 90);
    expect(py(g, "view_x")).toBe(py(g, "ROOM_W - VIEW_W"));
    key(g, "right", true);
    step(g, 60);
    key(g, "right", false);
    expect(me(g)[0]).toBe(py(g, "WALL_R - HALF"));
    expect(py(g, "view_width")).toBe(640);
  });

  it("each part of the mountain is named once, the first time your best gets there", async () => {
    const g = await climbing();
    const banner = () => py(g, "h = instances('Hud')[0]\n(h.zone, h.banner > 0)") as unknown as [string, boolean];
    expect(banner()).toEqual(["Base Camp", true]);
    step(g, 200);
    expect(banner()[1]).toBe(false);
    // Climbing into Pine Slopes names it.
    py(g, "me = global_vars.player\nme.y = GROUND_Y - 26 * METER\nme.on = None");
    step(g, 2);
    expect(banner()).toEqual(["Pine Slopes", true]);
    step(g, 200);
    // Falling back to base camp and climbing again names nothing.
    py(g, "me = global_vars.player\nme.y = GROUND_Y - 2 * METER\nme.on = None");
    step(g, 60);
    expect(banner()[1]).toBe(false);
    py(g, "me = global_vars.player\nme.y = GROUND_Y - 30 * METER\nme.on = None");
    step(g, 2);
    expect(banner()[1]).toBe(false);
    // Nor the next time you play, until you beat your best.
    const again = await climbing({ best: 100 });
    py(again, "me = global_vars.player\nme.y = GROUND_Y - 80 * METER\nme.on = None");
    step(again, 200);
    py(again, "me = global_vars.player\nme.y = GROUND_Y - 90 * METER\nme.on = None");
    step(again, 2);
    expect(py(again, "h = instances('Hud')[0]\nh.banner > 0")).toBe(false);
  });

  it("a jump is about four metres high, and a ledge is landed on from above, never from below", async () => {
    const g = await climbing();
    const [, y0] = me(g);
    key(g, "space", true);
    let top = y0;
    for (let t = 0; t < 40; t++) {
      step(g);
      top = Math.min(top, me(g)[1]);
    }
    key(g, "space", false);
    expect(y0 - top).toBeGreaterThan(90);
    expect(y0 - top).toBeLessThan(110);
    // Straight up through a ledge from below: it doesn't stop the head, and it's stood on coming down.
    const ledges = path(g, 3);
    const [, lx, ly] = ledges[0]!;
    py(g, `me = global_vars.player\nme.x, me.y, me.vy, me.on = ${lx}, ${ly + 60}, 0, None\nme.top_of_fall = me.y`);
    step(g);
    py(g, "global_vars.player.vy = JUMP_V")
    key(g, "space", true);
    let passed = false;
    for (let t = 0; t < 60; t++) {
      step(g);
      if (me(g)[1] < ly - 10) passed = true;
    }
    key(g, "space", false);
    step(g, 30);
    expect(passed).toBe(true);
    expect(me(g)[1]).toBeCloseTo(ly, 0);
    expect(me(g)[2]).toBe(ledges[0]![0]);
  });

  // Not run usually (minutes): FAR=1 npx vitest run climber -t "how far" says how high the bot gets, for balancing.
  it.runIf(!!process.env.FAR)("how far the bot gets", async () => {
    const g = await climbing();
    for (const m of [25, 50, 75, 100, 150, 200, 250, 300]) {
      const t = climbTo(g, m, 60 * 600);
      process.stderr.write(`FAR ${m} ${t} ${py(g, "global_vars.best")}\n`);
      if (t < 0) break;
    }
  });

  it("a bot climbs 150 metres with the keys alone, past ice, cracking ledges and the first planks", async () => {
    const g = await climbing();
    // In stages, each one fresh: the bot gets no smarter, but one long try can
    // circle the same few ledges, where a person would try something else.
    for (const m of [25, 50, 75, 100, 125, 150]) expect(climbTo(g, m, 60 * 60 * 4), `never got to ${m} m`).toBeGreaterThan(0);
    expect(py(g, "global_vars.best")).toBeGreaterThanOrEqual(150);
  });

  it("the best height is kept, sent to the school's board, and there again next time", async () => {
    const g = await climbing();
    climbTo(g, 12, 60 * 60);
    const best = py(g, "global_vars.best") as number;
    expect(best).toBeGreaterThanOrEqual(12);
    expect(g.saved().best).toBe(best);
    expect(g.scores.at(-1)).toBe(best);
    const again = await climbing({ best: 321 });
    expect(py(again, "global_vars.best")).toBe(321);
    step(again, 10);
    expect(again.scores).toEqual([]);
  });

  it("ice: slow to get going and slow to stop", async () => {
    const g = await climbing();
    const on = (kind: string) => {
      const i = py(g, `p = plan(); p.grow(GROUND_Y - 6000)\nnext(e['i'] for e in p.path if e['kind'] == '${kind}' and e['w'] >= 128)`) as number;
      standOn(g, i, -50);
      return i;
    };
    const getGoing = (kind: string) => {
      on(kind);
      key(g, "right", true);
      step(g, 12);
      key(g, "right", false);
      return py(g, "global_vars.player.vx") as number;
    };
    const stopping = (kind: string) => {
      on(kind);
      py(g, "global_vars.player.vx = RUN");
      const [x0] = me(g);
      step(g, 60);
      return me(g)[0] - x0;
    };
    expect(getGoing("ice")).toBeLessThan(getGoing("rock") / 2);
    const rock = stopping("rock");
    const ice = stopping("ice");
    expect(rock).toBeLessThan(15);
    expect(ice).toBeGreaterThan(3 * rock);
  });

  it("a cracked ledge breaks under you, and is back a while later", async () => {
    const g = await climbing();
    const i = py(g, "p = plan(); p.grow(GROUND_Y - 6000)\nnext(e['i'] for e in p.ledges if e['kind'] == 'crumble')") as number;
    standOn(g, i);
    const ledge = `[o for o in instances('CrumbleLedge') if o.plan_i == ${i}][0]`;
    step(g, 10);
    expect(py(g, `${ledge}.image_index`)).toBe(1);
    expect(me(g)[2]).toBe(i);
    step(g, py(g, "CRUMBLE_STAND") as number);
    expect(py(g, `${ledge}.broken`)).toBe(true);
    step(g, 5);
    expect(me(g)[2]).not.toBe(i);
    step(g, py(g, "CRUMBLE_BACK") as number);
    expect(py(g, `${ledge}.broken`)).toBe(false);
  });

  it("a swinging plank carries whoever stands on it", async () => {
    const g = await climbing();
    const i = py(g, "p = plan(); p.grow(GROUND_Y - 300 * METER)\nnext(e['i'] for e in p.ledges if e['kind'] == 'plank')") as number;
    standOn(g, i);
    const plank = `[o for o in instances('Plank') if o.plan_i == ${i}][0]`;
    const offset = () => me(g)[0] - (py(g, `${plank}.x`) as number);
    const start = offset();
    let swung = 0;
    const px0 = py(g, `${plank}.x`) as number;
    for (let t = 0; t < 220; t++) {
      step(g);
      swung = Math.max(swung, Math.abs((py(g, `${plank}.x`) as number) - px0));
      expect(Math.abs(offset() - start)).toBeLessThan(2);
    }
    expect(swung).toBeGreaterThan(30);
    expect(me(g)[2]).toBe(i);
  });

  it("a long fall lands on whatever is below, with a thump", async () => {
    const g = await climbing();
    climbTo(g, 15, 60 * 60);
    py(g, "me = global_vars.player\nme.y -= 600\nme.on = None\nme.vy = 0\nme.x = 70\nme.top_of_fall = me.y");
    const top = me(g)[1];
    step(g, 200);
    const [, y, on] = me(g);
    expect(on).not.toBeNull();
    expect(y).toBeGreaterThan(top + 400);
    expect(py(g, "global_vars.player.top_of_fall")).toBe(y);
  });

  it("the ground at base camp catches every fall", async () => {
    const g = await climbing();
    py(g, "for o in instances('Ledge'):\n    if o.object_name != 'Ground':\n        o.broken = True\nme = global_vars.player\nme.y -= 400\nme.x = 100\nme.on = None");
    step(g, 120);
    const [, y, on] = me(g);
    expect(y).toBe(py(g, "GROUND_Y"));
    expect(on).toBe(-1);
  });

  it("X throws a snowball that arcs away; a click throws one where it points, and it bursts on a ledge", async () => {
    const g = await climbing();
    tap(g, "x");
    expect(py(g, "instance_number('Snowball')")).toBe(1);
    expect(py(g, "global_vars.player.image_index")).toBe(5);
    const [vx, vy] = py(g, "b = instances('Snowball')[0]\n(b.vx, b.vy)") as unknown as [number, number];
    expect(vx).toBeGreaterThan(5);
    expect(vy).toBeLessThan(0);
    // Not again at once: one every THROW_EVERY steps.
    tap(g, "x");
    expect(py(g, "instance_number('Snowball')")).toBe(1);
    step(g, 160);
    // Aimed at the snow just in front of the feet: it bursts on the ground, a ledge.
    const [x, y] = me(g);
    const [vx0, vy0] = py(g, "(view_x, view_y)") as unknown as [number, number];
    g.engine.input.mouseMove(x - 30 - vx0, y + 4 - vy0);
    g.engine.input.mouseDown(0);
    step(g);
    g.engine.input.mouseUp(0);
    let splat: [number, number][] = [];
    for (let t = 0; t < 60 && !splat.length; t++) {
      step(g);
      splat = py(g, "[(s.x, s.y) for s in instances('Splat')]") as unknown as [number, number][];
    }
    expect(splat.length).toBe(1);
    const [sx, sy] = splat[0]!;
    expect(sx).toBeLessThan(x);
    expect(Math.abs(sy - y)).toBeLessThan(18);
    expect(py(g, "instance_number('Snowball')")).toBe(0);
  });

  it("the wind blows on Windy Ridge, and not below it", async () => {
    const g = await climbing();
    let below = 0;
    for (let t = 0; t < 430; t++) {
      step(g);
      below = Math.max(below, Math.abs(py(g, "global_vars.wind") as number));
    }
    expect(below).toBe(0);
    const i = py(g, "p = plan(); p.grow(GROUND_Y - 300 * METER)\nnext(e['i'] for e in p.path if metres_at(e['y']) > 220 and e['kind'] == 'rock')") as number;
    standOn(g, i);
    let most = 0;
    for (let t = 0; t < 420; t++) {
      step(g);
      most = Math.max(most, Math.abs(py(g, "global_vars.wind") as number));
    }
    expect(most).toBeGreaterThan(0.5);
  });

  it("only the mountain near the camera exists, however high you go", async () => {
    const g = await climbing();
    for (const m of [100, 400, 900]) {
      const i = py(g, `p = plan(); p.grow(GROUND_Y - ${m + 50} * METER)\nnext(e['i'] for e in p.path if metres_at(e['y']) >= ${m})`) as number;
      standOn(g, i);
      step(g, 30);
      expect(py(g, "instance_number('Ledge')") as number).toBeLessThan(60);
      expect(py(g, "zone_at(global_vars.height)")).toBe(py(g, `zone_at(${m})`));
    }
  });

  it("P pauses, and P again carries on", async () => {
    const g = await climbing();
    tap(g, "p");
    expect(py(g, "game_paused()")).toBe(true);
    const [x] = me(g);
    key(g, "right", true);
    step(g, 20);
    expect(me(g)[0]).toBe(x);
    key(g, "right", false);
    tap(g, "p");
    expect(py(g, "game_paused()")).toBe(false);
  });
});
