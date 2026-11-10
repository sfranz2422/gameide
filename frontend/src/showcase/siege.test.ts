/**
 * The fourteenth showcase game, Tabletop Siege (a lane battle across a desk),
 * played headless in the real Pyodide. Runs when the game has been built
 * (python3 showcase/siege/build.py, which needs only the repo).
 * Phase 1: a match against the computer.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";
import type { NetJoined, NetMessageIn, NetOut, NetPlayerState } from "../engine/game";

const BUILT = resolve(__dirname, "../../../showcase/siege/out/project.json");
const have = existsSync(BUILT);

async function start(net?: NetJoined, save: Record<string, unknown> = {}) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const oks: boolean[] = [];
  const sent: NetOut[] = [];
  const { game, error } = await PythonGame.load({ ...def, save, ...(net ? { net } : {}) } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    questionOk: (ok) => oks.push(ok),
    net: (o) => sent.push(o),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { oks, sent });
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
type Game = Awaited<ReturnType<typeof start>>;
/** On the desk, a match begun. With `cpu` false, the computer is sent away, so the test plays both sides. */
async function desk(cpu = true, save: Record<string, unknown> = {}): Promise<Game> {
  const g = await start(undefined, save);
  tap(g, "space");
  step(g, 2);
  expect(py(g, "room_name()")).toBe("Field");
  if (!cpu) py(g, "[c.destroy() for c in instances('Cpu')]");
  return g;
}
const count = (g: Game, obj: string, side?: number) =>
  py(g, `len([o for o in instances('${obj}')${side === undefined ? "" : ` if o.side == ${side}`}])`) as unknown as number;
/** Puts `card` in hand slot 0 for `side` and plenty of energy, then plays it at (x, y). */
function play(g: Game, side: number, card: string, x: number, y: number) {
  // (A card not in the deck, one of the new ones, is put in: the deck screen would.)
  return py(g, `d = global_vars.decks[${side}]\nif '${card}' in d: d.remove('${card}')\nd.insert(0, '${card}')\nglobal_vars.energy[${side}] = 10\nplay_card(${side}, 0, ${x}, ${y})`) as unknown as boolean;
}

describe.skipIf(!have)("Tabletop Siege: a match against the computer", () => {
  it("the art: every troop of both teams in its three poses, the towers and ice castles, the eight cards", () => {
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    const frames = (n: string) => project.sprites.find((x) => x.name === n)?.frames.length;
    for (const troop of ["kid", "snowman", "owl", "penguin", "yeti", "sled", "bear", "fox", "fairy", "icegolem", "chunk",
                         "kangaroo", "salamander", "moose", "hedgehog", "squirrel"])
      for (const team of ["blue", "red"]) expect(frames(`${troop}_${team}`), troop).toBe(3);
    for (const team of ["blue", "red"]) {
      expect(frames(`tower_${team}`)).toBe(3);
      expect(frames(`castle_${team}`)).toBe(1);
    }
    for (const card of ["kids", "snowman", "owl", "penguin", "yeti", "wall", "snowball", "ice",
                        "sled", "bear", "foxes", "fairy", "cannon", "avalanche", "cocoa", "icegolem",
                        "kangaroo", "salamander", "moose", "hedgehog", "beaver", "campfire", "fireworks", "squirrels"]) expect(frames(`card_${card}`), card).toBe(1);
    for (const n of ["cannon_blue", "cannon_red", "cannon_fire", "avalanche", "cocoa", "heal", "ice_burst",
                     "campfire_blue", "campfire_red", "campfire_blaze", "beaver_blue", "beaver_red", "firework"]) expect(frames(n), n).toBe(1);
    for (const n of ["snow", "bridge", "title", "castle_broken", "puff", "spark", "snowshot", "icicle", "swirl", "snow_wall", "ice_patch", "icon"]) expect(frames(n), n).toBe(1);
  });

  it("a match starts with three towers a side, 5 energy, a hand of four, and three minutes", async () => {
    const g = await desk();
    expect(count(g, "Tower", 0)).toBe(3);
    expect(count(g, "Tower", 1)).toBe(3);
    expect(count(g, "Keep")).toBe(2);
    expect(py(g, "len(hand(0)), len(set(global_vars.decks[0]))")).toEqual([4, 8]);
    expect(py(g, "round(global_vars.energy[0])")).toBe(5);
    expect(py(g, "global_vars.clock")).toBeGreaterThan(3 * 60 * 60 - 10);
  });

  it("playing a card: it costs energy, waits a moment, arrives, and the next card comes into the hand", async () => {
    const g = await desk(false);
    // Whatever the shuffle dealt (the yeti costs 6): enough energy for any card.
    py(g, "global_vars.energy[0] = 10");
    const [first, next] = py(g, "(hand(0)[1], up_next(0))") as unknown as [string, string];
    const cost = py(g, `CARDS['${first}']['cost']`) as unknown as number;
    expect(py(g, "play_card(0, 1, 200, 150)")).toBe(true);
    expect(py(g, "round(global_vars.energy[0], 1)")).toBeCloseTo(10 - cost, 0);
    expect(py(g, "hand(0)[1]")).toBe(next);
    expect(py(g, "global_vars.decks[0][-1]")).toBe(first);
    expect(count(g, "Deploy")).toBe(1);
    step(g, 62);
    expect(count(g, "Deploy")).toBe(0);
  });

  it("not enough energy, or the wrong side of the desk: refused", async () => {
    const g = await desk(false);
    py(g, "d = global_vars.decks[0]\nd.remove('yeti')\nd.insert(0, 'yeti')\nglobal_vars.energy[0] = 5");
    expect(py(g, "play_card(0, 0, 200, 150)")).toBe(false);
    py(g, "global_vars.energy[0] = 10");
    expect(py(g, "play_card(0, 0, 450, 150)")).toBe(false);
    expect(py(g, "play_card(0, 0, 200, 150)")).toBe(true);
    // IcePatch goes anywhere.
    expect(play(g, 0, "ice", 450, 150)).toBe(true);
  });

  it("troops on foot cross only by a ruler; a snowman with an penguin behind knocks down the tower at the end of their lane", async () => {
    const g = await desk(false);
    play(g, 0, "snowman", 200, 230);
    step(g, 20);
    play(g, 0, "penguin", 150, 230);
    let worst = 0;
    let onGap = false;
    for (let t = 0; t < 60 * 40 && count(g, "Tower", 1) === 3; t++) {
      step(g);
      const ks = py(g, "[(k.x, k.y) for k in instances('Snowman')]") as unknown as [number, number][];
      for (const [x, y] of ks) if (py(g, `on_the_gap(${x}, ${y})`)) onGap = true;
      worst = Math.max(worst, ks.length);
    }
    expect(onGap).toBe(false);
    expect(count(g, "Tower", 1)).toBe(2);
    expect(py(g, "global_vars.crowns")).toEqual([1, 0]);
    // The bottom lane's tower fell (the snowman's lane), not the top's.
    expect(py(g, "[round(t.y) for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep')]")).toEqual([96]);
  });

  it("towers shoot troops that come near; a lone kid never gets there", async () => {
    const g = await desk(false);
    py(g, "s = instance_create(400, 200, 'SnowKid')\ns.side = 0");
    step(g, 60 * 8);
    expect(count(g, "SnowKid")).toBe(0);
    expect(py(g, "min(t.hp / t.max_hp for t in instances('Tower') if t.side == 1)")).toBeGreaterThan(0.9);
  });

  it("a paper owl flies over the gap and past troops, for the towers; kids can't hit it, an penguin can", async () => {
    const g = await desk(false);
    py(g, "p = instance_create(300, 60, 'Owl')\np.side = 0\ns = instance_create(330, 70, 'SnowKid')\ns.side = 1");
    step(g, 30);
    expect(py(g, "instances('Owl')[0].target is not None and is_a(instances('Owl')[0].target, 'Tower')")).toBe(true);
    expect(py(g, "instances('Owl')[0].hp == instances('Owl')[0].max_hp")).toBe(true);
    expect(py(g, "can_hit(instances('SnowKid')[0], instances('Owl')[0])")).toBe(false);
    py(g, "a = instance_create(400, 60, 'Penguin')\na.side = 1");
    expect(py(g, "can_hit(instances('Penguin')[0], instances('Owl')[0])")).toBe(true);
  });

  it("an eraser yeti walks past troops for the buildings", async () => {
    const g = await desk(false);
    py(g, "e = instance_create(200, 96, 'Yeti')\ne.side = 0\ns = instance_create(240, 96, 'SnowKid')\ns.side = 1");
    step(g, 25);
    expect(py(g, "is_a(instances('Yeti')[0].target, 'Building')")).toBe(true);
  });

  it("a snowball bowls over each troop once, and stops at a building", async () => {
    const g = await desk(false);
    py(g, "for x in (380, 420):\n    s = instance_create(x, 200, 'SnowKid')\n    s.side = 1\n    s.pace = 0\nk = instance_create(460, 200, 'Snowman')\nk.side = 1\nk.base_pace = 0");
    play(g, 0, "snowball", 250, 200);
    step(g, 62 + 50);
    expect(count(g, "SnowKid", 1)).toBe(0);
    // The snowman is bowled over once, not every step the snowball touches it.
    expect(py(g, "[k.max_hp - k.hp for k in instances('Snowman')]")).toEqual([150]);
    step(g, 60);
    expect(count(g, "Snowball")).toBe(0);
    expect(py(g, "min(t.hp for t in instances('Tower') if t.side == 1 and abs(t.y - 200) < 5)")).toBeLessThan(1400);
  });

  it("ice slows the other side's troops, not your own", async () => {
    const g = await desk(false);
    play(g, 1, "ice", 200, 150);
    step(g, 62);
    py(g, "a = instance_create(195, 150, 'Snowman')\na.side = 0\nb = instance_create(205, 160, 'Snowman')\nb.side = 1");
    step(g, 2);
    expect(py(g, "[k.slowed for k in sorted(instances('Snowman'), key=lambda k: k.side)]")).toEqual([true, false]);
  });

  it("a block wall draws attackers to it, and crumbles by itself", async () => {
    const g = await desk(false);
    play(g, 0, "wall", 250, 200);
    step(g, 62);
    py(g, "k = instance_create(360, 200, 'Snowman')\nk.side = 1");
    step(g, 25);
    expect(py(g, "is_a(instances('Snowman')[0].target, 'SnowWall')")).toBe(true);
    py(g, "[k.destroy() for k in instances('Snowman')]");
    step(g, 40 * 60 + 5);
    expect(count(g, "SnowWall")).toBe(0);
  });

  it("a lone snowman hurts a tower but doesn't take it; the keep sleeps until it's hit or a tower falls", async () => {
    const g = await desk(false);
    play(g, 0, "snowman", 200, 96);
    step(g, 60 * 40);
    expect(count(g, "Snowman")).toBe(0);
    const hp = py(g, "[t.hp for t in instances('Tower') if t.side == 1 and abs(t.y - 96) < 5][0]") as unknown as number;
    expect(hp).toBeLessThan(1400 * 0.6);
    expect(hp).toBeGreaterThan(0);
    expect(py(g, "[k.awake for k in instances('Keep') if k.side == 1]")).toEqual([false]);
    py(g, "t = [t for t in instances('Tower') if t.side == 1 and abs(t.y - 96) < 5][0]\nhurt(t, 99999)");
    step(g, 2);
    expect(py(g, "[k.awake for k in instances('Keep') if k.side == 1]")).toEqual([true]);
  });

  it("with its lane's tower down, a troop goes on to the keep (not across to the other lane's), and the keep fights back", async () => {
    const g = await desk(false);
    py(g, "t = [t for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep') and t.y > 150][0]\nhurt(t, 99999)");
    py(g, "k = instance_create(420, 200, 'Snowman')\nk.side = 0");
    step(g, 25);
    expect(py(g, "type(instances('Snowman')[0].target).__name__")).toBe("Keep");
    step(g, 60 * 6);
    expect(py(g, "[k.hp < k.max_hp for k in instances('Snowman')]")).toEqual([true]);
    expect(py(g, "[k.hp < k.max_hp for k in instances('Keep') if k.side == 1]")).toEqual([true]);
  });

  it("a troop fights only what's in its own lane, and a tower shoots only at its own", async () => {
    const g = await desk(false);
    // A red kid in the top lane, on our half: a snowman dropped in the bottom lane walks on.
    py(g, "s = instance_create(200, 96, 'SnowKid')\ns.side = 1\ns.pace = 0\nk = instance_create(200, 200, 'Snowman')\nk.side = 0");
    step(g, 25);
    expect(py(g, "type(instances('Snowman')[0].target).__name__")).toBe("Tower");
    // A snowman at the bottom tower, crowded up toward the middle: the top tower doesn't shoot it.
    py(g, "[o.destroy() for o in instances('Unit')]\nk = instance_create(500, 168, 'Snowman')\nk.side = 0\nk.base_pace = 0");
    step(g, 60 * 3);
    expect(py(g, "[t.target is None for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep') and t.y < 150]")).toEqual([true]);
    expect(py(g, "[t.target is not None for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep') and t.y > 150]")).toEqual([true]);
  });

  it("knock a tower down, and you may drop troops just past the creek in that lane", async () => {
    const g = await desk(false);
    expect(play(g, 0, "snowman", 380, 200)).toBe(false);
    py(g, "t = [t for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep') and t.y > 150][0]\nhurt(t, 99999)");
    step(g);
    expect(play(g, 0, "snowman", 380, 200)).toBe(true);
    // Not in the other lane, and not far over.
    expect(play(g, 0, "snowman", 380, 96)).toBe(false);
    expect(play(g, 0, "snowman", 460, 200)).toBe(false);
    // The other side the same, mirrored.
    expect(play(g, 1, "snowman", 260, 96)).toBe(false);
    py(g, "t = [t for t in instances('Tower') if t.side == 0 and not is_a(t, 'Keep') and t.y < 150][0]\nhurt(t, 99999)");
    step(g);
    expect(play(g, 1, "snowman", 260, 96)).toBe(true);
  });

  it("troops turn to face what they're fighting, even behind them", async () => {
    const g = await desk(false);
    // Away from the towers' reach: a blue snowman with a red kid just behind it.
    py(g, "a = instance_create(250, 200, 'Snowman')\na.side = 0\na.base_pace = 0\nb = instance_create(232, 200, 'SnowKid')\nb.side = 1\nb.pace = 0");
    step(g, 10);
    expect(py(g, "(instances('Snowman')[0].face, instances('SnowKid')[0].face)")).toEqual([-1, 1]);
  });

  it("the keep falling wins at once, with all three crowns", async () => {
    const g = await desk(false);
    py(g, "k = [t for t in instances('Keep') if t.side == 1][0]\nhurt(k, 99999)");
    step(g);
    expect(py(g, "(global_vars.over, global_vars.winner, global_vars.crowns)")).toEqual([true, 0, [3, 0]]);
  });

  it("time up: more crowns wins; level, overtime with double energy; still level, the stronger towers", async () => {
    const g = await desk(false);
    py(g, "t = [t for t in instances('Tower') if t.side == 0 and not is_a(t, 'Keep')][0]\nhurt(t, 99999)\nglobal_vars.clock = 2");
    step(g, 3);
    expect(py(g, "(global_vars.over, global_vars.winner)")).toEqual([true, 1]);
    py(g, "new_match()\nglobal_vars.clock = 2");
    step(g, 3);
    expect(py(g, "(global_vars.over, global_vars.overtime)")).toEqual([false, true]);
    const e0 = py(g, "global_vars.energy[0]") as unknown as number;
    step(g, 84);
    expect((py(g, "global_vars.energy[0]") as unknown as number) - e0).toBeCloseTo(1, 1);
    py(g, "t = [t for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep')][0]\nhurt(t, 10)\nglobal_vars.clock = 2");
    step(g, 3);
    expect(py(g, "(global_vars.over, global_vars.winner)")).toEqual([true, 0]);
  });

  it("questions wait for the end of a match", async () => {
    const g = await desk();
    step(g, 5);
    expect(g.oks.at(-1)).toBe(false);
    py(g, "end_match(0)");
    step(g, 2);
    expect(g.oks.at(-1)).toBe(true);
    // Play again: a fresh match.
    tap(g, "space");
    expect(py(g, "(global_vars.over, global_vars.crowns)")).toEqual([false, [0, 0]]);
  });

  it("the computer defends: troops sent at it are met", async () => {
    const g = await desk();
    play(g, 0, "snowman", 280, 96);
    // Enough to answer, not enough to push or to spend because it's full.
    // (A hand it can defend with: one of yeti, owl, snowball and ice alone is 1 deal in 70.)
    py(g, "global_vars.energy[1] = 6\nc = instances('Cpu')[0]\nc.save_for = 9\nglobal_vars.decks[1] = ['snowman', 'kids', 'wall', 'penguin', 'yeti', 'owl', 'snowball', 'ice']");
    step(g, 60 * 6);
    // Something of its own, dropped in the snowman's lane on its side of the desk.
    expect((py(g, "[(round(o.x), round(o.y)) for o in instances('Unit') + instances('Deploy') + instances('Building') if o.side == 1 and not is_a(o, 'Tower') and abs(o.y - 96) < 60 and o.x > 330]") as unknown as unknown[]).length).toBeGreaterThan(0);
  });

  it("the computer against itself: a whole match, to the end, without an error", async () => {
    const g = await desk();
    py(g, "c = instance_create(0, 0, 'Cpu')\nc.side = 0");
    let t = 0;
    while (!(py(g, "global_vars.over") as unknown as boolean) && t < 5 * 60 * 60) {
      step(g, 60);
      t += 60;
    }
    expect(py(g, "global_vars.over")).toBe(true);
    // Both sides played: towers were hit somewhere.
    expect(py(g, "global_vars.crowns[0] + global_vars.crowns[1] > 0 or min(t.hp / t.max_hp for t in instances('Tower')) < 1")).toBe(true);
  });
});

interface Seat { g: Game; number: number; name: string; here: boolean; state: Record<string, unknown>; inbox: NetMessageIn[]; read: number }

/** A room as the server keeps one: each step, every game gets the others' newest states, its messages, and the host. */
class Room {
  seats: Seat[] = [];
  async join(number: number, name: string, save: Record<string, unknown> = {}) {
    const g = await start({ code: "KXTD", number, name, state: {} }, save);
    // From the very start: a game sends an unchanged state only once, and this one sent it on its first steps.
    const seat: Seat = { g, number, name, here: true, state: {}, inbox: [], read: 0 };
    this.seats.push(seat);
    return seat;
  }
  seat(n: number) {
    return this.seats.find((s) => s.number === n)!;
  }
  step(n = 1) {
    for (let i = 0; i < n; i++) {
      const live = this.seats.filter((s) => s.here);
      const host = Math.min(...live.map((s) => s.number));
      for (const s of live) {
        const others: NetPlayerState[] = live.filter((o) => o !== s && Object.keys(o.state).length)
          .map((o) => ({ number: o.number, name: o.name, state: o.state }));
        s.g.netArrive(others, s.inbox, host);
        s.inbox = [];
        step(s.g);
      }
      for (const s of live) {
        for (const out of s.g.sent.slice(s.read)) {
          if (out.state) s.state = out.state;
          for (const m of out.msgs ?? []) for (const o of live) if (o !== s) o.inbox.push({ from: s.number, data: m, age: 0 });
          for (const [to, m] of out.tells ?? []) {
            const o = live.find((x) => x.number === to);
            if (o) o.inbox.push({ from: s.number, data: m, age: 0, private: true } as NetMessageIn);
          }
        }
        s.read = s.g.sent.length;
      }
    }
  }
}

/** Two players in a room, both on the desk: #1 (the host) and #2. */
async function duel() {
  const room = new Room();
  const a = await room.join(1, "Ana");
  const b = await room.join(2, "Ben");
  room.step(100);
  expect(py(a.g, "room_name()")).toBe("Field");
  expect(py(b.g, "room_name()")).toBe("Field");
  room.step(3);
  return { room, a, b };
}
const towers = (g: Game) => py(g, "sorted((round(t.x), round(t.y), t.side) for t in instances('Tower'))") as unknown as [number, number, number][];

describe.skipIf(!have)("Tabletop Siege: two players", () => {
  it("in a room, each waits for the other, then both go to the desk; the computer stays out of it", async () => {
    const room = new Room();
    const a = await room.join(1, "Ana");
    room.step(150);
    expect(py(a.g, "room_name()")).toBe("Title");
    await room.join(2, "Ben");
    room.step(100);
    expect(room.seats.map((s) => py(s.g, "room_name()"))).toEqual(["Field", "Field"]);
    expect(room.seats.map((s) => count(s.g, "Cpu"))).toEqual([0, 0]);
  });

  it("the host runs the battle; the other sees it mirrored, themselves blue on the left", async () => {
    const { a, b } = await duel();
    expect(py(a.g, "runs_battle()")).toBe(true);
    expect(py(b.g, "runs_battle()")).toBe(false);
    expect(py(b.g, "all(t.puppet for t in instances('Tower'))")).toBe(true);
    // The same six towers, each side's on its own left.
    const host = towers(a.g);
    const other = towers(b.g).map(([x, y, side]): [number, number, number] => [640 - x, y, 1 - side]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    expect(other).toEqual(host);
    expect(py(b.g, "len(global_vars.decks[0]) >= 5 and global_vars.match_no")).toBe(1);
  });

  it("the other player's card goes to the host, is played there as the red side, and both see it", async () => {
    const { room, a, b } = await duel();
    py(a.g, "global_vars.energy[1] = 10");
    room.step(3);
    const card = py(b.g, "hand(0)[0]") as unknown as string;
    const x = card === "ice" ? 200 : 200;
    expect(py(b.g, `play(0, ${x}, 200)`)).toBe(true);
    room.step(3);
    expect(py(a.g, "[(round(d.x), round(d.y), d.side, d.card) for d in instances('Deploy')]")).toEqual([[440, 200, 1, card]]);
    expect(py(a.g, "round(global_vars.energy[1])")).toBeLessThan(10);
    room.step(3);
    // In the other game, its own drop: on its left, blue.
    expect(py(b.g, "[(round(d.x), d.side) for d in instances('Deploy')]")).toEqual([[200, 0]]);
    room.step(70);
    expect(py(b.g, "round(global_vars.energy[0])")).toBe(py(a.g, "round(global_vars.energy[1])"));
  });

  it("a play the host may not allow is refused: the wrong half, or too little energy", async () => {
    const { room, a, b } = await duel();
    py(a.g, "global_vars.energy[1] = 10\nd = global_vars.decks[1]\nd.remove('snowman')\nd.insert(0, 'snowman')");
    room.step(3);
    // A changed game asking for a drop on the host's half (host x 200).
    py(b.g, "net_tell(1, {'play': [0, 200, 150], 'n': global_vars.match_no})");
    room.step(3);
    expect(count(a.g, "Deploy")).toBe(0);
    py(a.g, "global_vars.energy[1] = 1");
    py(b.g, "net_tell(1, {'play': [0, 500, 150], 'n': global_vars.match_no})");
    room.step(3);
    expect(count(a.g, "Deploy")).toBe(0);
  });

  it("a troop faces the same way in both games: mirrored, as the field is", async () => {
    const { room, a, b } = await duel();
    // On the host's field a blue snowman turns left, to a red kid behind it.
    py(a.g, "u = instance_create(250, 200, 'Snowman')\nu.side = 0\nu.base_pace = 0\nk = instance_create(232, 200, 'SnowKid')\nk.side = 1\nk.pace = 0");
    room.step(6);
    expect(py(a.g, "instances('Snowman')[0].face")).toBe(-1);
    // On the other player's (mirrored) field, it's red and turned right.
    expect(py(b.g, "[(round(o.x), o.side, o.face) for o in instances('Snowman')]")).toEqual([[390, 1, 1]]);
  });

  it("troops fight and the crowns and winner read the right way round in both games", async () => {
    const { room, a, b } = await duel();
    py(a.g, "k = [t for t in instances('Keep') if t.side == 0][0]\nhurt(k, 99999)");
    room.step(4);
    expect(py(a.g, "(global_vars.winner, global_vars.crowns)")).toEqual([1, [0, 3]]);
    expect(py(b.g, "(global_vars.over, global_vars.winner, global_vars.crowns)")).toEqual([true, 0, [3, 0]]);
  });

  it("a rematch when both press Play again", async () => {
    const { room, a, b } = await duel();
    py(a.g, "end_match(0)");
    room.step(3);
    tap(b.g, "space");
    room.step(3);
    expect(py(a.g, "global_vars.again")).toEqual([false, true]);
    expect(py(a.g, "global_vars.over")).toBe(true);
    tap(a.g, "space");
    room.step(4);
    expect(py(a.g, "(global_vars.over, global_vars.match_no)")).toEqual([false, 2]);
    expect(py(b.g, "(global_vars.over, global_vars.match_no)")).toEqual([false, 2]);
  });

  it("an opponent away, answering a question, holds the match; gone for good, the one still here wins", async () => {
    const { room, a, b } = await duel();
    room.step(30);
    b.here = false;
    room.step(5);
    const clock = py(a.g, "global_vars.clock") as unknown as number;
    room.step(60);
    expect(py(a.g, "(global_vars.halt, global_vars.clock)")).toEqual([true, clock]);
    b.here = true;
    room.step(10);
    expect(py(a.g, "global_vars.halt")).toBe(false);
    b.here = false;
    room.step(150 * 60 + 10);
    expect(py(a.g, "(global_vars.over, global_vars.winner)")).toEqual([true, 0]);
  });

  it("the host away: the other game holds too", async () => {
    const { room, a, b } = await duel();
    room.step(10);
    a.here = false;
    room.step(5);
    expect(py(b.g, "global_vars.halt")).toBe(true);
  });

  it("a big battle still fits in what a game may send", async () => {
    const { room, a } = await duel();
    py(a.g, "for k in range(120):\n    u = instance_create(60 + k * 4, 40 + (k % 11) * 20, 'SnowKid')\n    u.side = k % 2");
    room.step(30);
    const sizes = a.g.sent.filter((o) => o.state).slice(-10).map((o) => JSON.stringify(o.state).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(2000);
  });
});

describe.skipIf(!have)("Tabletop Siege: the eight new cards, and picking a deck", () => {
  const red = (g: Game, obj: string, x: number, y: number, still = true) =>
    py(g, `o = instance_create(${x}, ${y}, '${obj}')\no.side = 1\n${still ? "o.pace = 0\nif hasattr(o, 'base_pace'): o.base_pace = 0" : ""}\no.uid`);
  const hpOf = (g: Game, obj: string) => py(g, `[round(o.max_hp - o.hp) for o in instances('${obj}') if o.side == 1]`) as unknown as number[];

  it("Sled Riders: the first hit after a run-up does double, the next ones don't", async () => {
    const g = await desk(false);
    red(g, "Snowman", 280, 200);
    py(g, "u = instance_create(180, 200, 'SledRider')\nu.side = 0");
    let first = 0;
    for (let t = 0; t < 400 && !first; t++) {
      step(g);
      first = (hpOf(g, "Snowman")[0] ?? 0);
    }
    expect(first).toBe(140);
    step(g, 62);
    expect(hpOf(g, "Snowman")[0]).toBe(210);
  });

  it("a Polar Bear's swipe hits every troop of theirs around what it hits", async () => {
    const g = await desk(false);
    red(g, "Snowman", 240, 200);
    red(g, "Snowman", 245, 222);
    py(g, "u = instance_create(205, 200, 'PolarBear')\nu.side = 0");
    step(g, 30);
    expect(hpOf(g, "Snowman").sort()).toEqual([66, 66]);
  });

  it("Arctic Foxes come four at a time", async () => {
    const g = await desk(false);
    play(g, 0, "foxes", 200, 200);
    step(g, 62);
    expect(count(g, "Fox", 0)).toBe(4);
  });

  it("a Frost Fairy flies, and her shots slow what they hit", async () => {
    const g = await desk(false);
    red(g, "Snowman", 260, 200);
    py(g, "u = instance_create(200, 200, 'Fairy')\nu.side = 0");
    step(g, 40);
    expect(py(g, "[o.chill > 0 for o in instances('Snowman')]")).toEqual([true]);
    expect(py(g, "instances('Fairy')[0].flies")).toBe(true);
  });

  it("a Snow Cannon shoots troops on foot (not flyers), and melts away", async () => {
    const g = await desk(false);
    play(g, 0, "cannon", 200, 200);
    step(g, 62);
    red(g, "Owl", 280, 200);
    step(g, 60);
    expect(py(g, "instances('SnowCannon')[0].target")).toBe(undefined);
    red(g, "SnowKid", 290, 200);
    step(g, 80);
    expect(count(g, "SnowKid", 1)).toBe(0);
    step(g, 30 * 60);
    expect(count(g, "SnowCannon")).toBe(0);
  });

  it("an Avalanche hurts everything of theirs in its circle, towers a little; not your own", async () => {
    const g = await desk(false);
    // Out of the towers' reach, too far apart to fight each other.
    red(g, "Snowman", 420, 200);
    py(g, "a = instance_create(440, 245, 'Snowman')\na.side = 0\na.base_pace = 0");
    play(g, 0, "avalanche", 430, 215);
    step(g, 62 + 32);
    expect(hpOf(g, "Snowman")).toEqual([260]);
    expect(py(g, "[o.hp == o.max_hp for o in instances('Snowman') if o.side == 0]")).toEqual([true]);
    // Dropped on a tower: it takes a little.
    play(g, 0, "avalanche", 524, 200);
    step(g, 62 + 32);
    expect(py(g, "[t.max_hp - t.hp for t in instances('Tower') if t.side == 1 and abs(t.y - 200) < 5]")).toEqual([90]);
  });

  it("Hot Cocoa heals your own troops in its circle, not theirs", async () => {
    const g = await desk(false);
    py(g, "a = instance_create(205, 200, 'Snowman')\na.side = 0\na.base_pace = 0\na.hp = 300");
    red(g, "Snowman", 205, 241);
    py(g, "[o.__setattr__('hp', 300) for o in instances('Snowman') if o.side == 1]");
    play(g, 0, "cocoa", 205, 215);
    step(g, 63);
    expect(py(g, "sorted((o.side, round(o.hp)) for o in instances('Snowman'))")).toEqual([[0, 540], [1, 300]]);
  });

  it("an Ice Golem knocked out breaks into two ice chunks that keep fighting", async () => {
    const g = await desk(false);
    py(g, "u = instance_create(200, 200, 'IceGolem')\nu.side = 0\nhurt(u, 99999)");
    step(g);
    expect(py(g, "[(c.side, c.hp == c.max_hp) for c in instances('IceChunk')]")).toEqual([[0, true], [0, true]]);
  });

  it("the deck screen: pick 8 of the 16 by clicking, Done only at 8, kept; a match deals from it", async () => {
    const g = await start();
    const click = (x: number, y: number) => {
      g.engine.input.mouseMove(x, y);
      g.engine.input.mouseDown(0);
      step(g);
      g.engine.input.mouseUp(0);
      step(g);
    };
    const slot = (card: string) => py(g, `deck_slot(ALL_CARDS.index('${card}'))`) as unknown as [number, number];
    click(320, 304);                                   // Your deck
    expect(count(g, "Decks")).toBe(1);
    // Out with the starting eight, in with the new eight, clicking each.
    for (const c of ["kids", "snowman", "owl", "penguin", "yeti", "wall", "snowball", "ice"]) click(slot(c)[0] + 30, slot(c)[1] + 30);
    for (const c of ["sled", "bear", "foxes", "fairy", "cannon", "avalanche", "cocoa"]) click(slot(c)[0] + 30, slot(c)[1] + 30);
    click(320, 330);                                   // Done, at seven: not yet
    expect(count(g, "Decks")).toBe(1);
    click(slot("icegolem")[0] + 30, slot("icegolem")[1] + 30);
    click(320, 330);
    expect(count(g, "Decks")).toBe(0);
    tap(g, "space");
    step(g, 2);
    expect(py(g, "sorted(global_vars.decks[0])")).toEqual(["avalanche", "bear", "cannon", "cocoa", "fairy", "foxes", "icegolem", "sled"]);
    // A deck that isn't 8 different real cards is the starting deck instead.
    py(g, "save_set('deck', ['sled', 'sled', 'dragon'])");
    expect(py(g, "sorted(my_deck())")).toEqual(["ice", "kids", "owl", "penguin", "snowball", "snowman", "wall", "yeti"]);
  });

  it("in a room the host deals the other player's own deck, and both see the new cards", async () => {
    const room = new Room();
    const a = await room.join(1, "Ana");
    const b = await room.join(2, "Ben");
    py(b.g, "save_set('deck', ['sled', 'bear', 'foxes', 'fairy', 'cannon', 'avalanche', 'cocoa', 'icegolem'])");
    room.step(100);
    room.step(3);
    expect(py(a.g, "room_name()")).toBe("Field");
    expect(py(a.g, "sorted(global_vars.decks[1])")).toEqual(["avalanche", "bear", "cannon", "cocoa", "fairy", "foxes", "icegolem", "sled"]);
    // The host plays an avalanche: the other game shows it.
    py(a.g, "d = global_vars.decks[0]\nd.remove('yeti')\nd.insert(0, 'yeti')\nglobal_vars.energy[0] = 10");
    py(a.g, "o = instance_create(400, 200, 'Avalanche')\no.side = 0");
    room.step(3);
    expect(count(b.g, "Avalanche")).toBe(1);
  });
});

describe.skipIf(!have)("Tabletop Siege: coins, upgrades, and cards to buy", () => {
  const red = (g: Game, obj: string, x: number, y: number) =>
    py(g, `o = instance_create(${x}, ${y}, '${obj}')\no.side = 1\no.pace = 0\nif hasattr(o, 'base_pace'): o.base_pace = 0\no.uid`);
  const blue = (g: Game, obj: string, x: number, y: number) => py(g, `o = instance_create(${x}, ${y}, '${obj}')\no.side = 0\no.uid`);
  const coins = (g: Game) => py(g, "my_coins()") as unknown as number;
  const lost = (g: Game, obj: string, side = 1) => py(g, `[round(o.max_hp - o.hp) for o in instances('${obj}') if o.side == ${side}]`) as unknown as number[];

  it("a match pays coins once: 10 for beating the computer, 3 for losing", async () => {
    const g = await desk(true, { coins: 5 });
    py(g, "end_match(0)");
    step(g, 3);
    expect(coins(g)).toBe(15);
    step(g, 30);
    expect(coins(g)).toBe(15);
    py(g, "new_match()\nend_match(1)");
    step(g, 3);
    expect(coins(g)).toBe(18);
    py(g, "new_match()\nend_match(-1)");      // a draw pays what a loss does
    step(g, 3);
    expect(coins(g)).toBe(21);
  });

  it("in a room, a win pays 30 and the loser still gets 3, in both games", async () => {
    const { room, a, b } = await duel();
    py(a.g, "end_match(0)");
    room.step(4);
    expect([coins(a.g), coins(b.g)]).toEqual([30, 3]);
    room.step(20);
    expect([coins(a.g), coins(b.g)]).toEqual([30, 3]);
  });

  it("upgrading costs coins, more each level, up to level 5; not without enough", async () => {
    const g = await start(undefined, { coins: 330 });
    for (const want of [2, 3, 4, 5]) {
      expect(py(g, "upgrade_card('kids')")).toBe(true);
      expect(py(g, "my_levels()['kids']")).toBe(want);
    }
    expect(coins(g)).toBe(330 - 20 - 40 - 80 - 160);
    expect(py(g, "upgrade_card('kids')")).toBe(false);   // the top
    expect(py(g, "upgrade_cost('kids') is None")).toBe(true);
    expect(py(g, "upgrade_card('yeti')")).toBe(true);      // 30 coins left: one more level, at 20
    expect(py(g, "upgrade_card('owl')")).toBe(false);      // 10 left
    expect(coins(g)).toBe(10);
    expect(py(g, "upgrade_card('kangaroo')")).toBe(false);   // not bought
  });

  it("an upgraded card's troops have 10% a level more health and damage", async () => {
    const g = await desk(false, { levels: { kids: 3 } });
    play(g, 0, "kids", 200, 200);
    play(g, 1, "kids", 440, 200);
    step(g, 62);
    const kids = py(g, "sorted((k.side, round(k.max_hp), round(k.damage, 1), k.level) for k in instances('SnowKid'))") as unknown as number[][];
    expect(kids.filter((k) => k[0] === 0)).toEqual([[0, 132, 26.4, 3], [0, 132, 26.4, 3], [0, 132, 26.4, 3]]);
    // The computer's (side 1): your deck's average level, here 1.
    expect(kids.filter((k) => k[0] === 1)[0]).toEqual([1, 110, 22, 1]);
  });

  it("spells, walls and ice grow with their level too", async () => {
    const g = await desk(false, { levels: { avalanche: 5, wall: 2, ice: 3, snowball: 4 } });
    red(g, "Snowman", 420, 200);
    play(g, 0, "avalanche", 420, 200);
    step(g, 62 + 31);
    expect(lost(g, "Snowman")).toEqual([364]);      // 260, +40%
    play(g, 0, "wall", 200, 96);
    play(g, 0, "ice", 400, 96);
    step(g, 62);
    expect(py(g, "round(instances('SnowWall')[0].max_hp)")).toBe(880);
    expect(py(g, "round(instances('IcePatch')[0].life / 300, 2) >= 1.19")).toBe(true);
    py(g, "[s.destroy() for s in instances('Snowman')]");
    red(g, "Snowman", 300, 150);
    py(g, "o = instance_create(260, 150, 'Snowball')\no.side = 0\nupgrade(o, 4)");
    step(g, 20);
    expect(lost(g, "Snowman")).toEqual([195]);      // 150, +30%
    // An Ice Golem's chunks are as strong as the golem was.
    py(g, "o = instance_create(200, 240, 'IceGolem')\no.side = 0\nupgrade(o, 3)\nhurt(o, 99999)");
    expect(py(g, "sorted(round(c.max_hp) for c in instances('IceChunk'))")).toEqual([264, 264]);
  });

  it("the computer plays at your deck's average level", async () => {
    const g = await desk(true, { levels: { kids: 4, snowman: 4, owl: 4, penguin: 4, yeti: 5, wall: 3, snowball: 4, ice: 4 } });
    expect(py(g, "global_vars.levels[1]['snowman'], global_vars.levels[1]['sled']")).toEqual([4, 4]);
    expect(py(g, "global_vars.levels[0]['yeti'], global_vars.levels[0]['sled']")).toEqual([5, 1]);
  });

  it("in a room the host plays each player's cards at their own levels, and made-up levels are level 1", async () => {
    const room = new Room();
    const a = await room.join(1, "Ana", { levels: { kids: 2 } });
    await room.join(2, "Ben", { levels: { kids: 5, yeti: 99, owl: "lots" } });
    room.step(100);
    room.step(3);
    expect(py(a.g, "room_name()")).toBe("Field");
    expect(py(a.g, "[global_vars.levels[0]['kids'], global_vars.levels[1]['kids'], global_vars.levels[1]['yeti'], global_vars.levels[1]['owl']]")).toEqual([2, 5, 1, 1]);
    py(a.g, "d = global_vars.decks[1]\nd.remove('kids')\nd.insert(0, 'kids')\nglobal_vars.energy[1] = 10\nplay_card(1, 0, 440, 200)");
    room.step(62);
    expect(py(a.g, "sorted({round(k.max_hp) for k in instances('SnowKid') if k.side == 1})")).toEqual([154]);      // level 5: +40%
  });

  it("the shop: a card to buy can't go in a deck until it's bought, and buying costs its price", async () => {
    const g = await start(undefined, { coins: 100 });
    const click = (x: number, y: number) => {
      g.engine.input.mouseMove(x, y);
      g.engine.input.mouseDown(0);
      step(g);
      g.engine.input.mouseUp(0);
      step(g);
    };
    const at = (card: string) => {
      const [x, y] = py(g, `deck_slot(ALL_CARDS.index('${card}'))`) as unknown as [number, number];
      click(x + 30, y + 30);
    };
    click(320, 304);                                   // Your deck
    at("kids");                                        // out: seven
    at("kangaroo");                                    // not bought: only chosen
    expect(py(g, "'kangaroo' in instances('Decks')[0].chosen")).toBe(false);
    click(320, 288);                                   // Buy it: 80 coins
    expect(py(g, "owns('kangaroo')")).toBe(true);
    expect(coins(g)).toBe(20);
    at("kangaroo");
    expect(py(g, "'kangaroo' in instances('Decks')[0].chosen")).toBe(true);
    at("moose");
    click(320, 288);                                   // 100 coins: not enough
    expect(py(g, "owns('moose')")).toBe(false);
    expect(coins(g)).toBe(20);
    at("owl");                                         // out, and chosen: its button upgrades it
    click(320, 288);
    expect(py(g, "my_levels()['owl']")).toBe(2);
    expect(coins(g)).toBe(0);
    at("owl");
    click(320, 330);                                   // Done
    expect(py(g, "'kangaroo' in my_deck()")).toBe(true);
    // A deck saved with a card that was never bought isn't played.
    py(g, "save_set('deck', ['moose', 'snowman', 'owl', 'penguin', 'yeti', 'wall', 'snowball', 'ice'])");
    expect(py(g, "'moose' in my_deck()")).toBe(false);
  });

  it("a Kangaroo hops straight over the creek, nowhere near a bridge", async () => {
    const g = await desk(false);
    blue(g, "Kangaroo", 250, 148);
    let crossed: number | null = null;
    for (let t = 0; t < 300 && crossed === null; t++) {
      step(g);
      const [x, y] = py(g, "k = instances('Kangaroo')[0]\n[k.x, k.y]") as unknown as [number, number];
      if (Math.abs(x - 320) < 4) crossed = y;
    }
    expect(crossed).not.toBeNull();
    expect(py(g, `on_the_gap(320, ${crossed})`)).toBe(true);
  });

  it("a Fire Salamander does triple damage to snow things, not to kids", async () => {
    const g = await desk(false);
    red(g, "Snowman", 240, 200);
    py(g, "instances('Snowman')[0].damage = 0");
    blue(g, "Salamander", 215, 200);
    for (let t = 0; t < 100 && !(lost(g, "Snowman")[0] ?? 0); t++) step(g);
    expect(lost(g, "Snowman")).toEqual([60]);
    const h = await desk(false);
    red(h, "SnowKid", 240, 200);
    py(h, "instances('SnowKid')[0].damage = 0");
    blue(h, "Salamander", 215, 200);
    for (let t = 0; t < 100 && !(lost(h, "SnowKid")[0] ?? 0); t++) step(h);
    expect(lost(h, "SnowKid")).toEqual([20]);
  });

  it("a Moose's hit knocks a troop back down the lane", async () => {
    const g = await desk(false);
    red(g, "Snowman", 250, 200);
    py(g, "instances('Snowman')[0].damage = 0");
    blue(g, "Moose", 215, 200);
    for (let t = 0; t < 100 && !(lost(g, "Snowman")[0] ?? 0); t++) step(g);
    expect(py(g, "round(instances('Snowman')[0].x)")).toBe(250 + 26);
  });

  it("a Hedgehog hurts what hits it up close", async () => {
    const g = await desk(false);
    red(g, "Snowman", 240, 200);
    blue(g, "Hedgehog", 222, 200);
    py(g, "h = instances('Hedgehog')[0]\nh.damage = 0\nh.pace = 0");
    for (let t = 0; t < 100 && !(lost(g, "Hedgehog", 0)[0] ?? 0); t++) step(g);
    expect(lost(g, "Hedgehog", 0)).toEqual([82]);
    expect(lost(g, "Snowman")).toEqual([30]);
  });

  it("a Beaver Dam goes only on a bridge, and their troops go round by the other lane", async () => {
    const g = await desk(false);
    expect(py(g, "can_drop(0, 'beaver', 320, 200), can_drop(0, 'beaver', 200, 200), can_drop(0, 'beaver', 320, 150)")).toEqual([true, false, false]);
    const crossing = (who: Game) => {
      for (let t = 0; t < 600; t++) {
        step(who);
        const [x, y] = py(who, "k = instances('SnowKid')[0]\n[k.x, k.y]") as unknown as [number, number];
        if (x > 320) return y;
      }
      return null;
    };
    py(g, "o = instance_create(320, 200, 'BeaverDam')\no.side = 1");
    blue(g, "SnowKid", 250, 200);
    expect(Math.abs(crossing(g)! - 96)).toBeLessThan(18);
    // Your own dam doesn't stop your troops.
    const h = await desk(false);
    py(h, "o = instance_create(320, 200, 'BeaverDam')\no.side = 0");
    blue(h, "SnowKid", 250, 200);
    expect(Math.abs(crossing(h)! - 200)).toBeLessThan(18);
  });

  it("a Campfire warms your troops near it and melts their snow things, and burns out", async () => {
    const g = await desk(false);
    // Out of the towers' reach, or they'd shoot the red ones too.
    py(g, "o = instance_create(250, 150, 'Campfire')\no.side = 0");
    blue(g, "SnowKid", 265, 150);
    py(g, "k = instances('SnowKid')[0]\nk.hp = 50\nk.pace = 0");
    red(g, "Snowman", 235, 160);
    red(g, "SnowKid", 240, 140);
    py(g, "for u in instances('Unit'):\n    u.damage = 0");
    step(g, 60);
    expect(py(g, "round(instances('SnowKid')[0].hp) if instances('SnowKid')[0].side == 0 else round(instances('SnowKid')[1].hp)")).toBe(110);
    expect(lost(g, "Snowman")).toEqual([180]);
    expect(lost(g, "SnowKid")).toEqual([0]);
    step(g, 20 * 60);
    expect(count(g, "Campfire")).toBe(0);
  });

  it("Fireworks burst all over their circle, hurting theirs, never yours", async () => {
    const g = await desk(false);
    for (const [dx, dy] of [[-40, -40], [0, -40], [40, -40], [-40, 0], [40, 0], [-40, 40], [0, 40], [40, 40]]) red(g, "Snowman", 420 + dx!, 150 + dy!);
    blue(g, "Snowman", 420, 150);
    py(g, "for u in instances('Unit'):\n    u.damage = 0\n    u.pace = u.base_pace = 0");
    play(g, 0, "fireworks", 420, 150);
    step(g, 62 + 60);
    expect(count(g, "Fireworks")).toBe(0);
    expect(lost(g, "Snowman").reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3 * 90);
    expect(lost(g, "Snowman", 0)).toEqual([0]);
  });

  it("Squirrel Thieves come two at a time, and a hit on a tower takes an energy from them", async () => {
    const g = await desk(false);
    play(g, 0, "squirrels", 200, 200);
    step(g, 62);
    expect(count(g, "Squirrel", 0)).toBe(2);
    py(g, "[s.destroy() for s in instances('Squirrel')]");
    blue(g, "Squirrel", 500, 200);
    py(g, "global_vars.energy = [0.0, 6.0]");
    for (let t = 0; t < 120 && py(g, "min(t.hp for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep'))") >= 1400; t++) step(g);
    const [mine, theirs] = py(g, "global_vars.energy") as unknown as [number, number];
    expect(mine).toBeGreaterThan(0.99);
    expect(theirs).toBeLessThan(5.9);
  });

  it("the other player's game shows the new cards, and the same fireworks bursts, mirrored", async () => {
    const { room, a, b } = await duel();
    for (const [obj, x, y] of [["Kangaroo", 200, 150], ["Campfire", 150, 240], ["BeaverDam", 320, 96], ["Fireworks", 420, 150], ["Moose", 100, 200]] as const)
      py(a.g, `o = instance_create(${x}, ${y}, '${obj}')\no.side = 0`);
    room.step(12);
    for (const obj of ["Kangaroo", "Campfire", "BeaverDam", "Fireworks", "Moose"]) expect(count(b.g, obj), obj).toBe(1);
    const host = py(a.g, "f = instances('Fireworks')[0]\n[burst_at(f, k) for k in range(3)]") as unknown as [number, number][];
    const other = py(b.g, "f = instances('Fireworks')[0]\n[burst_at(f, k) for k in range(3)]") as unknown as [number, number][];
    other.forEach(([x, y], k) => {
      expect(x).toBeCloseTo(640 - host[k]![0], 0);
      expect(y).toBeCloseTo(host[k]![1], 0);
    });
  });
});
