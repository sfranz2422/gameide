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

async function start(net?: NetJoined) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const oks: boolean[] = [];
  const sent: NetOut[] = [];
  const { game, error } = await PythonGame.load({ ...def, ...(net ? { net } : {}) } as typeof def, {
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
async function desk(cpu = true): Promise<Game> {
  const g = await start();
  tap(g, "space");
  step(g, 2);
  expect(py(g, "room_name()")).toBe("Desk");
  if (!cpu) py(g, "[c.destroy() for c in instances('Cpu')]");
  return g;
}
const count = (g: Game, obj: string, side?: number) =>
  py(g, `len([o for o in instances('${obj}')${side === undefined ? "" : ` if o.side == ${side}`}])`) as unknown as number;
/** Puts `card` in hand slot 0 for `side` and plenty of energy, then plays it at (x, y). */
function play(g: Game, side: number, card: string, x: number, y: number) {
  return py(g, `d = global_vars.decks[${side}]\nd.remove('${card}')\nd.insert(0, '${card}')\nglobal_vars.energy[${side}] = 10\nplay_card(${side}, 0, ${x}, ${y})`) as unknown as boolean;
}

describe.skipIf(!have)("Tabletop Siege: a match against the computer", () => {
  it("the art: every troop of both teams in its three poses, the cups and lunchboxes, the eight cards", () => {
    const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
    const frames = (n: string) => project.sprites.find((x) => x.name === n)?.frames.length;
    for (const troop of ["soldier", "knight", "plane", "archer", "golem"]) for (const team of ["blue", "red"]) expect(frames(`${troop}_${team}`), troop).toBe(3);
    for (const team of ["blue", "red"]) {
      expect(frames(`cup_${team}`)).toBe(3);
      expect(frames(`box_${team}`)).toBe(1);
    }
    for (const card of ["soldiers", "knight", "plane", "archer", "golem", "wall", "marble", "glue"]) expect(frames(`card_${card}`), card).toBe(1);
    for (const n of ["wood", "ruler", "title", "box_broken", "puff", "spark", "band", "shaving", "key", "icon"]) expect(frames(n), n).toBe(1);
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
    // Whatever the shuffle dealt (the golem costs 6): enough energy for any card.
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
    py(g, "d = global_vars.decks[0]\nd.remove('golem')\nd.insert(0, 'golem')\nglobal_vars.energy[0] = 5");
    expect(py(g, "play_card(0, 0, 200, 150)")).toBe(false);
    py(g, "global_vars.energy[0] = 10");
    expect(py(g, "play_card(0, 0, 450, 150)")).toBe(false);
    expect(py(g, "play_card(0, 0, 200, 150)")).toBe(true);
    // Glue goes anywhere.
    expect(play(g, 0, "glue", 450, 150)).toBe(true);
  });

  it("troops on foot cross only by a ruler; a knight with an archer behind knocks down the tower at the end of their lane", async () => {
    const g = await desk(false);
    play(g, 0, "knight", 200, 230);
    step(g, 20);
    play(g, 0, "archer", 150, 230);
    let worst = 0;
    let onGap = false;
    for (let t = 0; t < 60 * 40 && count(g, "Tower", 1) === 3; t++) {
      step(g);
      const ks = py(g, "[(k.x, k.y) for k in instances('Knight')]") as unknown as [number, number][];
      for (const [x, y] of ks) if (py(g, `on_the_gap(${x}, ${y})`)) onGap = true;
      worst = Math.max(worst, ks.length);
    }
    expect(onGap).toBe(false);
    expect(count(g, "Tower", 1)).toBe(2);
    expect(py(g, "global_vars.crowns")).toEqual([1, 0]);
    // The bottom lane's tower fell (the knight's lane), not the top's.
    expect(py(g, "[round(t.y) for t in instances('Tower') if t.side == 1 and not is_a(t, 'Keep')]")).toEqual([96]);
  });

  it("towers shoot troops that come near; a lone soldier never gets there", async () => {
    const g = await desk(false);
    py(g, "s = instance_create(400, 200, 'Soldier')\ns.side = 0");
    step(g, 60 * 8);
    expect(count(g, "Soldier")).toBe(0);
    expect(py(g, "min(t.hp / t.max_hp for t in instances('Tower') if t.side == 1)")).toBeGreaterThan(0.9);
  });

  it("a paper plane flies over the gap and past troops, for the towers; soldiers can't hit it, an archer can", async () => {
    const g = await desk(false);
    py(g, "p = instance_create(300, 60, 'Plane')\np.side = 0\ns = instance_create(330, 70, 'Soldier')\ns.side = 1");
    step(g, 30);
    expect(py(g, "instances('Plane')[0].target is not None and is_a(instances('Plane')[0].target, 'Tower')")).toBe(true);
    expect(py(g, "instances('Plane')[0].hp == instances('Plane')[0].max_hp")).toBe(true);
    expect(py(g, "can_hit(instances('Soldier')[0], instances('Plane')[0])")).toBe(false);
    py(g, "a = instance_create(400, 60, 'Archer')\na.side = 1");
    expect(py(g, "can_hit(instances('Archer')[0], instances('Plane')[0])")).toBe(true);
  });

  it("an eraser golem walks past troops for the buildings", async () => {
    const g = await desk(false);
    py(g, "e = instance_create(200, 96, 'Golem')\ne.side = 0\ns = instance_create(240, 96, 'Soldier')\ns.side = 1");
    step(g, 25);
    expect(py(g, "is_a(instances('Golem')[0].target, 'Building')")).toBe(true);
  });

  it("a marble bowls over each troop once, and stops at a building", async () => {
    const g = await desk(false);
    py(g, "for x in (380, 420):\n    s = instance_create(x, 200, 'Soldier')\n    s.side = 1\n    s.pace = 0\nk = instance_create(460, 200, 'Knight')\nk.side = 1\nk.base_pace = 0");
    play(g, 0, "marble", 250, 200);
    step(g, 62 + 50);
    expect(count(g, "Soldier", 1)).toBe(0);
    // The knight is bowled over once, not every step the marble touches it.
    expect(py(g, "[k.max_hp - k.hp for k in instances('Knight')]")).toEqual([150]);
    step(g, 60);
    expect(count(g, "Marble")).toBe(0);
    expect(py(g, "min(t.hp for t in instances('Tower') if t.side == 1 and abs(t.y - 200) < 5)")).toBeLessThan(1400);
  });

  it("glue slows the other side's troops, not your own", async () => {
    const g = await desk(false);
    play(g, 1, "glue", 200, 150);
    step(g, 62);
    py(g, "a = instance_create(195, 150, 'Knight')\na.side = 0\nb = instance_create(205, 160, 'Knight')\nb.side = 1");
    step(g, 2);
    expect(py(g, "[k.glued for k in sorted(instances('Knight'), key=lambda k: k.side)]")).toEqual([true, false]);
  });

  it("a block wall draws attackers to it, and crumbles by itself", async () => {
    const g = await desk(false);
    play(g, 0, "wall", 250, 200);
    step(g, 62);
    py(g, "k = instance_create(360, 200, 'Knight')\nk.side = 1");
    step(g, 25);
    expect(py(g, "is_a(instances('Knight')[0].target, 'Wall')")).toBe(true);
    py(g, "[k.destroy() for k in instances('Knight')]");
    step(g, 40 * 60 + 5);
    expect(count(g, "Wall")).toBe(0);
  });

  it("a lone knight hurts a tower but doesn't take it; the keep sleeps until it's hit or a tower falls", async () => {
    const g = await desk(false);
    play(g, 0, "knight", 200, 96);
    step(g, 60 * 40);
    expect(count(g, "Knight")).toBe(0);
    const hp = py(g, "[t.hp for t in instances('Tower') if t.side == 1 and abs(t.y - 96) < 5][0]") as unknown as number;
    expect(hp).toBeLessThan(1400 * 0.6);
    expect(hp).toBeGreaterThan(0);
    expect(py(g, "[k.awake for k in instances('Keep') if k.side == 1]")).toEqual([false]);
    py(g, "t = [t for t in instances('Tower') if t.side == 1 and abs(t.y - 96) < 5][0]\nhurt(t, 99999)");
    step(g, 2);
    expect(py(g, "[k.awake for k in instances('Keep') if k.side == 1]")).toEqual([true]);
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
    play(g, 0, "knight", 280, 96);
    // Enough to answer, not enough to push or to spend because it's full.
    // (A hand it can defend with: one of golem, plane, marble and glue alone is 1 deal in 70.)
    py(g, "global_vars.energy[1] = 6\nc = instances('Cpu')[0]\nc.save_for = 9\nglobal_vars.decks[1] = ['knight', 'soldiers', 'wall', 'archer', 'golem', 'plane', 'marble', 'glue']");
    step(g, 60 * 6);
    // Something of its own, dropped in the knight's lane on its side of the desk.
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
  async join(number: number, name: string) {
    const g = await start({ code: "KXTD", number, name, state: {} });
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
  expect(py(a.g, "room_name()")).toBe("Desk");
  expect(py(b.g, "room_name()")).toBe("Desk");
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
    expect(room.seats.map((s) => py(s.g, "room_name()"))).toEqual(["Desk", "Desk"]);
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
    const x = card === "glue" ? 200 : 200;
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
    py(a.g, "global_vars.energy[1] = 10\nd = global_vars.decks[1]\nd.remove('knight')\nd.insert(0, 'knight')");
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
    py(a.g, "for k in range(120):\n    u = instance_create(60 + k * 4, 40 + (k % 11) * 20, 'Soldier')\n    u.side = k % 2");
    room.step(30);
    const sizes = a.g.sent.filter((o) => o.state).slice(-10).map((o) => JSON.stringify(o.state).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(2000);
  });
});
