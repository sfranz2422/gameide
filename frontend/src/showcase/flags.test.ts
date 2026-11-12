/**
 * Snowfort Flags (capture the flag as a snowball fight, in a park too big to see
 * across), played headless in the real Pyodide. Runs when the game has been
 * built (python3 showcase/flags/build.py, which needs only the repo).
 * Phase 1: you and three computer kids against four.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";
import type { NetJoined, NetMessageIn, NetOut, NetPlayerState } from "../engine/game";

const BUILT = resolve(__dirname, "../../../showcase/flags/out/project.json");
const have = existsSync(BUILT);

async function start(save: Record<string, unknown> = {}, net?: NetJoined) {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  let saved: Record<string, unknown> = save;
  const scores: number[] = [];
  const oks: boolean[] = [];
  const sent: NetOut[] = [];
  const { game, error } = await PythonGame.load({ ...def, save, ...(net ? { net } : {}) } as typeof def, {
    stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
    save: (d) => (saved = d),
    score: (n) => scores.push(n),
    questionOk: (ok) => oks.push(ok),
    net: (o) => sent.push(o),
  });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return Object.assign(game, { saved: () => saved, scores, oks, project, sent });
}
function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}
const py = (g: PythonGame, code: string) => g.evalPython(code) as never;
const key = (g: PythonGame, name: string, down: boolean) => (down ? g.engine.input.keyDown(KEY_CODE.get(name)!) : g.engine.input.keyUp(KEY_CODE.get(name)!));
function tap(g: PythonGame, name: string, times = 1) {
  for (let i = 0; i < times; i++) {
    key(g, name, true);
    step(g);
    key(g, name, false);
    step(g);
  }
}
/** On the field, past the title. */
async function onField(save: Record<string, unknown> = {}) {
  const g = await start(save);
  tap(g, "space");
  step(g, 2);
  expect(py(g, "room_name()")).toBe("Field");
  return g;
}

/** On the field with nobody else moving: every computer kid gone, and still kids (plain Kids, no brain) put where a test wants them. */
async function quiet(save: Record<string, unknown> = {}) {
  const g = await onField(save);
  py(g, "for b in instances('Bot'): b.destroy()");
  step(g);
  return g;
}
function kid(g: PythonGame, team: string, x: number, y: number) {
  py(g, `_k = instance_create(${x}, ${y}, "Kid")\n_k.team = "${team}"\n_k.k = 1\n_k.sprite = "kid_${team}_1"\nglobal_vars.test_kid = _k`);
}
const me = (g: PythonGame, what: string) => py(g, `global_vars.player.${what}`) as unknown;
const put = (g: PythonGame, x: number, y: number) => py(g, `global_vars.player.x, global_vars.player.y = ${x}, ${y}`);
/** A snowball from `team` at (x, y), heading right, `length` pixels long, already `gone` along. */
function ball(g: PythonGame, team: string, x: number, y: number, length: number, gone = 0) {
  py(g, `_b = instance_create(${x}, ${y}, "Snowball")\n_b.team = "${team}"\n_b.vx, _b.vy = BALL_PACE, 0\n_b.length = ${length}\n_b.gone = ${gone}`);
}
/** A spot in the open: the first fresh-snow tile in the middle row band, on Red's side. */
const OPEN = (g: PythonGame) => py(g, "tile_middle(*next((c, r) for r in range(20, 24) for c in range(20, 40) if all(GRID[r][c + i] == '.' for i in range(-3, 8))))") as unknown as [number, number];

describe.skipIf(!have)("Snowfort Flags: the park", () => {
  it("every floor tile can be walked to, both stands too, and the engine finds the way across", async () => {
    const g = await onField();
    const lost = py(g, `
walk = lambda ch: ch not in SOLID + WATER
start = sorted(places("S"))[0]
seen = {start}
todo = [start]
while todo:
    c, r = todo.pop()
    for n in ((c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1)):
        if 0 <= n[0] < COLS and 0 <= n[1] < ROWS and n not in seen and walk(GRID[n[1]][n[0]]):
            seen.add(n)
            todo.append(n)
[(c, r) for r in range(ROWS) for c in range(COLS) if walk(GRID[r][c]) and (c, r) not in seen]`);
    expect(lost).toEqual([]);
    expect(py(g, "len(path_find(*stand_of('red'), *stand_of('blue'), TILE)) > 50")).toBe(true);
    // Mirrored: neither side has the better half.
    expect(py(g, "all(row == row[::-1] for row in GRID)")).toBe(true);
  }, 60_000);

  it("the creek stops kids but not snowballs; a pine stops both", async () => {
    const g = await quiet();
    const [cx, cy] = py(g, "tile_middle(COLS // 2 - 3, 5)") as unknown as [number, number];
    put(g, cx, cy);
    key(g, "d", true);
    step(g, 60);
    key(g, "d", false);
    expect(me(g, "x") as number).toBeLessThan(COLS_MID(g));
    // A ball rolls right across the ice.
    ball(g, "red", cx, cy, 400);
    step(g, 30);
    expect(py(g, "len(instances('Snowball'))")).toBe(1);
    expect(py(g, "instances('Snowball')[0].x") as number).toBeGreaterThan(COLS_MID(g));
  }, 60_000);

  it("in the woods you're seen only from close by; a pine between hides you", async () => {
    const g = await quiet();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    kid(g, "blue", ox + 200, oy);
    step(g, 20);
    expect(py(g, "global_vars.test_kid in seen_by_team('red')")).toBe(true);
    // Just inside the woods' edge, five tiles off across open snow (a clear line): not
    // seen. Out in the open at that distance, they would be.
    const [wx, wy] = py(g, "tile_middle(*next((c, r) for r in range(2, 14) for c in range(10, 40) if GRID[r][c] == 'w' and all(GRID[r][c - i] == '.' for i in range(1, 7))))") as unknown as [number, number];
    py(g, `global_vars.test_kid.x, global_vars.test_kid.y = ${wx}, ${wy}`);
    put(g, wx - 160, wy);
    py(g, "work_out_sight()");
    expect(py(g, "clear_line(global_vars.player, global_vars.test_kid)")).toBe(true);
    expect(py(g, "global_vars.test_kid in seen_by_team('red')")).toBe(false);
    put(g, wx - 100, wy);
    py(g, "work_out_sight()");
    expect(py(g, "global_vars.test_kid in seen_by_team('red')")).toBe(true);
    // Behind a pine: the line hits it.
    const [tx, ty] = py(g, "tile_middle(*next((c, r) for r in range(2, 14) for c in range(18, 40) if GRID[r][c] == 'T' and GRID[r][c - 1] == 'w' and GRID[r][c + 1] == 'w'))") as unknown as [number, number];
    py(g, `global_vars.test_kid.x, global_vars.test_kid.y = ${tx + 32}, ${ty + 14}`);
    put(g, tx - 32, ty + 14);
    py(g, "work_out_sight()");
    expect(py(g, "global_vars.test_kid in seen_by_team('red')")).toBe(false);
    py(g, `global_vars.test_kid.x, global_vars.test_kid.y = ${tx - 32}, ${ty + 50}`);
    py(g, "work_out_sight()");
    expect(py(g, "global_vars.test_kid in seen_by_team('red')")).toBe(true);
  }, 60_000);
});
const COLS_MID = (g: PythonGame) => py(g, "(COLS // 2 - 2) * TILE") as unknown as number;

describe.skipIf(!have)("Snowfort Flags: a kid", () => {
  it("walks with WASD and the arrows, and leaves footprints in fresh snow (not on paths)", async () => {
    const g = await quiet();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    key(g, "right", true);
    step(g, 60);
    key(g, "right", false);
    expect(me(g, "x") as number).toBeGreaterThan(ox + 150);
    expect(py(g, "len(global_vars.prints)") as number).toBeGreaterThanOrEqual(3);
    py(g, "global_vars.prints.clear()");
    const [px, py_] = py(g, "tile_middle(20, 21)") as unknown as [number, number];
    expect(py(g, "GRID[21][20]")).toBe(",");
    put(g, px, py_);
    key(g, "d", true);
    step(g, 40);
    key(g, "d", false);
    expect(py(g, "len(global_vars.prints)")).toBe(0);
  }, 60_000);

  it("holding the throw longer throws further; no snowball, no throw; a moment between throws", async () => {
    const g = await quiet();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    py(g, "global_vars.player.aim_x, global_vars.player.aim_y = 1, 0");
    expect(me(g, "stock")).toBe(3);
    key(g, "space", true);
    step(g, 2);
    key(g, "space", false);
    step(g);
    const short = py(g, "instances('Snowball')[0].length") as unknown as number;
    expect(short).toBeLessThan(140);
    expect(me(g, "stock")).toBe(2);
    step(g, 60);
    key(g, "space", true);
    step(g, 60);
    key(g, "space", false);
    step(g);
    expect(py(g, "max(b.length for b in instances('Snowball'))")).toBe(py(g, "THROW_MAX"));
    expect(me(g, "stock")).toBe(1);
    // Right after a throw: nothing.
    expect(py(g, "throw(global_vars.player, 0, 0, 1) is None")).toBe(true);
    py(g, "global_vars.player.throw_t = 0\nglobal_vars.player.stock = 0");
    expect(py(g, "throw(global_vars.player, 0, 0, 1) is None")).toBe(true);
  }, 60_000);

  it("scoops a snowball a half-second at a drift with E, up to five; not away from one", async () => {
    const g = await quiet();
    const [dx, dy] = py(g, "d = instances('Drift')[0]\n(d.x, d.y)") as unknown as [number, number];
    put(g, dx, dy + 20);
    py(g, "global_vars.player.stock = 0");
    key(g, "e", true);
    step(g, py(g, "SCOOP_STEPS * 2 + 2") as unknown as number);
    expect(me(g, "stock")).toBe(2);
    step(g, 400);
    expect(me(g, "stock")).toBe(5);
    key(g, "e", false);
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    py(g, "global_vars.player.stock = 0");
    key(g, "e", true);
    step(g, 100);
    key(g, "e", false);
    expect(me(g, "stock")).toBe(0);
  }, 60_000);

  it("a low snowball knocks you down, a high one sails over, your own team's never hits", async () => {
    const g = await quiet();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    // Mid-flight of a long throw: high over your head.
    ball(g, "blue", ox - 200, oy, 400, 0);
    step(g, 40);
    expect(me(g, "stun")).toBe(0);
    ball(g, "red", ox - 30, oy, 120);
    step(g, 10);
    expect(me(g, "stun")).toBe(0);
    // Coming down at the end of its flight: down you go.
    ball(g, "blue", ox - 40, oy, 120, 70);
    step(g, 10);
    expect(me(g, "stun") as number).toBeGreaterThan(0);
  }, 60_000);

  it("knocked down: dizzy for three seconds, then back at your fort, safe for a moment", async () => {
    const g = await quiet();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    py(g, "knock_down(global_vars.player)");
    key(g, "right", true);
    step(g, 60);
    expect(me(g, "x")).toBe(ox);
    key(g, "right", false);
    step(g, (py(g, "STUN_STEPS") as unknown as number) - 58);
    expect(me(g, "stun")).toBe(0);
    expect(py(g, "point_distance(global_vars.player.x, global_vars.player.y, *stand_of('red')) < 4 * TILE")).toBe(true);
    expect(me(g, "safe") as number).toBeGreaterThan(0);
    ball(g, "blue", (me(g, "x") as number) - 30, me(g, "y") as number, 120, 70);
    step(g, 6);
    expect(me(g, "stun")).toBe(0);
  }, 60_000);
});

describe.skipIf(!have)("Snowfort Flags: the flags", () => {
  /** Walks the player onto Blue's flag (put there), and back to Red's stand. */
  async function carrying() {
    const g = await quiet();
    const [bx, by] = py(g, "stand_of('blue')") as unknown as [number, number];
    put(g, bx - 10, by);
    step(g, 2);
    expect(py(g, "flag_of('blue').state")).toBe("carried");
    expect(py(g, "global_vars.player.carry is flag_of('blue')")).toBe(true);
    return g;
  }

  it("grab theirs, bring it home to yours: a capture, and it goes on the board", async () => {
    const g = await carrying();
    const [rx, ry] = py(g, "stand_of('red')") as unknown as [number, number];
    put(g, rx + 10, ry);
    step(g, 2);
    expect(py(g, "global_vars.m['score']")).toEqual({ red: 1, blue: 0 });
    expect(py(g, "flag_of('blue').state")).toBe("home");
    expect(g.scores).toEqual([1]);
    expect(g.saved().captures).toBe(1);
  }, 60_000);

  it("no capture while your own flag isn't home", async () => {
    const g = await carrying();
    py(g, "drop_flag(flag_of('red'), *tile_middle(30, 21))");
    const [rx, ry] = py(g, "stand_of('red')") as unknown as [number, number];
    put(g, rx + 10, ry);
    step(g, 5);
    expect(py(g, "global_vars.m['score']")).toEqual({ red: 0, blue: 0 });
    expect(py(g, "flag_of('blue').state")).toBe("carried");
  }, 60_000);

  it("knocked down carrying it: it drops there; their team's touch sends it home, yours picks it up again", async () => {
    const g = await carrying();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    step(g);
    py(g, "knock_down(global_vars.player)");
    expect(py(g, "(flag_of('blue').state, round(flag_of('blue').x), global_vars.player.carry is None)")).toEqual(["dropped", Math.round(ox), true]);
    // A red teammate picks it up again.
    kid(g, "red", ox + 5, oy);
    step(g, 2);
    expect(py(g, "flag_of('blue').carrier is global_vars.test_kid")).toBe(true);
    py(g, "knock_down(global_vars.test_kid)");
    // A blue kid touches it: home.
    kid(g, "blue", ox + 5, oy);
    step(g, 2);
    expect(py(g, "flag_of('blue').state")).toBe("home");
  }, 60_000);

  it("a dropped flag nobody touches goes home by itself", async () => {
    const g = await quiet();
    py(g, "drop_flag(flag_of('blue'), *tile_middle(60, 21))");
    step(g, (py(g, "DROP_RETURN") as unknown as number) + 2);
    expect(py(g, "flag_of('blue').state")).toBe("home");
  }, 60_000);
});

describe.skipIf(!have)("Snowfort Flags: the match", () => {
  it("first to three wins, and back to the title after", async () => {
    const g = await quiet();
    py(g, "global_vars.m['score']['red'] = 2");
    const [bx, by] = py(g, "stand_of('blue')") as unknown as [number, number];
    put(g, bx - 10, by);
    step(g, 2);
    const [rx, ry] = py(g, "stand_of('red')") as unknown as [number, number];
    put(g, rx + 10, ry);
    step(g, 2);
    expect(py(g, "global_vars.m['over']")).toBe("red");
    step(g, py(g, "OVER_STEPS + 3") as unknown as number);
    expect(py(g, "room_name()")).toBe("Title");
  }, 60_000);

  it("time up: most captures wins; level, it's overtime and the next capture wins", async () => {
    const g = await quiet();
    py(g, "global_vars.m['score']['blue'] = 1\nglobal_vars.m['t'] = 2");
    step(g, 3);
    expect(py(g, "global_vars.m['over']")).toBe("blue");
    const h = await quiet();
    py(h, "global_vars.m['t'] = 2");
    step(h, 3);
    expect(py(h, "(global_vars.m['over'] is None, global_vars.m['overtime'])")).toEqual([true, true]);
    py(h, "flag_of('red').state = 'carried'\nk = instance_create(*stand_of('blue'), 'Kid')\nk.team = 'blue'\nk.carry = flag_of('red')\nflag_of('red').carrier = k");
    step(h, 2);
    expect(py(h, "global_vars.m['over']")).toBe("blue");
  }, 60_000);
});

describe.skipIf(!have)("Snowfort Flags: the computer's kids", () => {
  it("left alone, eight of them play a whole match, and flags get captured", async () => {
    const g = await start();
    py(g, "random.seed(4)");
    tap(g, "space");
    step(g, 2);
    let n = 0;
    while (n < 8 * 60 * 60 && py(g, "global_vars.m['over'] is None")) {
      step(g, 600);
      n += 600;
    }
    const total = py(g, "sum(global_vars.m['score'].values())") as unknown as number;
    expect(total).toBeGreaterThanOrEqual(1);
  }, 300_000);

  it("both flags taken, each carrier waiting at home: someone goes to fetch theirs back", async () => {
    const g = await onField();
    py(g, "random.seed(2)");
    // A red bot holds Blue's flag at Red's stand; a blue bot holds Red's at Blue's.
    py(g, `
for team in TEAMS:
    c = [k for k in kids(team) if getattr(k, 'role', '') == 'attack'][0]
    f = flag_of(other_team(team))
    c.x, c.y = stand_of(team)
    c.x += 40 if team == 'red' else -40
    f.state, f.carrier, c.carry = 'carried', c, f`);
    // At once, before the carriers give up waiting: Blue's other attacker sets off to fetch Blue's flag back.
    step(g, 45);
    expect(py(g, "any(b.role == 'attack' and b.carry is None and b.why == 'chase' for b in instances('Bot') if b.team == 'blue')")).toBe(true);
    let n = 0;
    while (n < 3 * 60 * 60 && py(g, "flag_of('red').state == 'carried' and flag_of('blue').state == 'carried'")) {
      step(g, 60);
      n += 60;
    }
    expect(py(g, "flag_of('red').state == 'carried' and flag_of('blue').state == 'carried'")).toBe(false);
  }, 300_000);

  it("both flags taken and nobody else to fetch them: a carrier stops waiting at home and goes for its own", async () => {
    const g = await onField();
    py(g, "random.seed(3)");
    py(g, `
for team in TEAMS:
    c = [k for k in kids(team) if getattr(k, 'role', '') == 'attack'][0]
    f = flag_of(other_team(team))
    c.x, c.y = stand_of(team)
    c.x += 40 if team == 'red' else -40
    f.state, f.carrier, c.carry = 'carried', c, f
for b in instances('Bot'):
    if b.carry is None:
        b.destroy()`);
    const away = "max(point_distance(c.x, c.y, *stand_of(c.team)) for c in instances('Bot'))";
    // Waiting, as a carrier should, for a while...
    step(g, 10 * 60);
    expect(py(g, away) as number).toBeLessThan(120);
    // ...but not for ever (STANDOFF_WAIT): one sets off after its own flag.
    step(g, 20 * 60);
    expect(py(g, away) as number).toBeGreaterThan(200);
  }, 120_000);

  it("throw only at someone they can see", async () => {
    const g = await quiet();
    const [ox, oy] = OPEN(g);
    put(g, ox, oy);
    py(g, `b = instance_create(${ox + 200}, ${oy}, "Bot")\nb.team = "blue"\nb.k = 1\nb.role = "defend"\nb.sprite = "kid_blue_1"\nglobal_vars.bot = b`);
    step(g, 30);
    expect(py(g, "global_vars.bot.stock") as number).toBeLessThan(3);
    // Same distance, a pine wall between (into the woods): no throws.
    const h = await quiet();
    const [wx, wy] = py(h, "tile_middle(*next((c, r) for r in range(2, 14) for c in range(18, 40) if GRID[r][c] == 'w' and GRID[r][c + 1] == 'w'))") as unknown as [number, number];
    put(h, wx, wy);
    py(h, `b = instance_create(${wx - 200}, ${wy}, "Bot")\nb.team = "blue"\nb.k = 1\nb.role = "defend"\nb.sprite = "kid_blue_1"\nb.stock = 3\nglobal_vars.bot = b`);
    py(h, "global_vars.bot.goal = (global_vars.bot.x, global_vars.bot.y)");
    expect(py(h, "clear_line(global_vars.player, global_vars.bot)")).toBe(false);
    step(h, 30);
    expect(py(h, "global_vars.bot.stock")).toBe(3);
  }, 60_000);

  it("the title: pick a look, Space plays, the look is kept", async () => {
    const g = await start();
    tap(g, "right");
    tap(g, "right");
    tap(g, "space");
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Field");
    expect(g.saved().look).toBe(2);
    expect(py(g, "global_vars.player.sprite")).toBe("kid_red_2");
  }, 60_000);
});

// ---------------------------------------------------------------- in a room

type Game = Awaited<ReturnType<typeof start>>;
interface Seat { g: Game; number: number; name: string; here: boolean; state: Record<string, unknown>; inbox: NetMessageIn[]; read: number }

/**
 * A room, as the server keeps one, for real games side by side: each step every
 * game is handed the others' newest states, the shouts and private words sent to
 * it, and who the host is (the lowest number here and not away); then it steps,
 * and what it sent is passed on. A seat not `here` is away (answering a question):
 * the server hides it from the others and its game is held still.
 */
class Room {
  seats: Seat[] = [];
  async join(number: number, name: string) {
    const g = await start({}, { code: "KXTD", number, name, state: {} });
    tap(g, "space");
    step(g, 2);
    expect(py(g, "room_name()")).toBe("Field");
    const seat: Seat = { g, number, name, here: true, state: {}, inbox: [], read: g.sent.length };
    this.seats.push(seat);
    return seat;
  }
  seat(n: number) {
    return this.seats.find((s) => s.number === n)!;
  }
  host() {
    return Math.min(...this.seats.filter((s) => s.here).map((s) => s.number));
  }
  step(n = 1) {
    for (let i = 0; i < n; i++) {
      const host = this.host();
      for (const s of this.seats.filter((s) => s.here)) {
        const others: NetPlayerState[] = this.seats
          .filter((o) => o.here && o !== s && Object.keys(o.state).length)
          .map((o) => ({ number: o.number, name: o.name, state: o.state }));
        s.g.netArrive(others, s.inbox, host);
        s.inbox = [];
        step(s.g);
      }
      for (const s of this.seats.filter((s) => s.here)) {
        for (const out of s.g.sent.slice(s.read)) {
          if (out.state) s.state = out.state;
          for (const m of out.msgs ?? []) for (const o of this.seats) if (o !== s && o.here) o.inbox.push({ from: s.number, data: m, age: 0 });
          for (const [to, m] of out.tells ?? []) {
            const o = this.seats.find((x) => x.number === to && x.here);
            if (o) o.inbox.push({ from: s.number, data: m, age: 0, private: true } as NetMessageIn);
          }
        }
        s.read = s.g.sent.length;
      }
    }
  }
  /** True if `code` (Python) is true in every game here. */
  all(code: string) {
    return this.seats.filter((s) => s.here).every((s) => py(s.g, code) === true);
  }
}
const M = (s: Seat, key: string) => py(s.g, `global_vars.m[${JSON.stringify(key)}]`) as unknown;

/** A room of `count` players, settled, and the host's Enter starting a match. `size` computer kids' worth of team (TEAM_SIZE). */
async function match(count: number, size?: number) {
  const room = new Room();
  for (let n = 1; n <= count; n++) await room.join(n, ["Ana", "Ben", "Cai", "Dee"][n - 1]!);
  if (size !== undefined) for (const s of room.seats) py(s.g, `TEAM_SIZE = ${size}`);
  room.step(40);
  expect(room.all("global_vars.m['ph'] == 'lobby'")).toBe(true);
  key(room.seat(1).g, "enter", true);
  room.step(1);
  key(room.seat(1).g, "enter", false);
  room.step(6);
  expect(room.all("global_vars.m['ph'] == 'play'")).toBe(true);
  // Past the moment just back at the fort, when nobody can be hit or touch a flag.
  room.step(100);
  return room;
}
/** Puts player n at (x, y): in their own game, and the host's copy of them too (as if they'd walked there). */
function place(room: Room, n: number, x: number, y: number) {
  py(room.seat(n).g, `global_vars.player.x, global_vars.player.y = ${x}, ${y}`);
  const host = room.seat(room.host());
  if (n !== host.number) py(host.g, `_k = kid_by_tag("p${n}")\n_k.x, _k.y = ${x}, ${y}`);
  room.step(4);
}
const where = (s: Seat, tag: string) => py(s.g, `(lambda k: (round(k.x), round(k.y)))(kid_by_tag("${tag}"))`) as unknown as [number, number];

describe.skipIf(!have)("Snowfort Flags: in a room", () => {
  it("waiting in the park: only the host's Enter starts, and the teams are dealt evenly with computer kids filling them", async () => {
    const room = new Room();
    for (const [n, name] of [[1, "Ana"], [2, "Ben"], [3, "Cai"]] as const) await room.join(n, name);
    room.step(40);
    // The lobby: everyone here has a kid on a team already, and no computer kids.
    expect(room.all("len(instances('Bot')) == 0 and global_vars.player.team is not None")).toBe(true);
    key(room.seat(2).g, "enter", true);
    room.step(1);
    key(room.seat(2).g, "enter", false);
    room.step(6);
    expect(room.all("global_vars.m['ph'] == 'lobby'")).toBe(true);
    key(room.seat(1).g, "enter", true);
    room.step(1);
    key(room.seat(1).g, "enter", false);
    room.step(6);
    // Dealt in turn: #1 and #3 Red, #2 Blue; four a side, computer kids in the rest.
    expect(room.all("global_vars.m['ph'] == 'play'")).toBe(true);
    expect(room.seats.map((s) => py(s.g, "global_vars.player.team"))).toEqual(["red", "blue", "red"]);
    expect(room.all("sorted(k.team for k in kids()) == ['blue'] * 4 + ['red'] * 4")).toBe(true);
    expect(room.all("len([k for k in kids() if k.tag.startswith('b')]) == 5")).toBe(true);
    // Only the host runs them: elsewhere they're puppets.
    expect(py(room.seat(1).g, "any(k.puppet for k in kids())")).toBe(false);
    expect(room.seats.slice(1).every((s) => py(s.g, "all(k.puppet for k in kids() if k is not global_vars.player)") === true)).toBe(true);
    // Everyone starts at their fort, where the host put them.
    for (const s of room.seats) {
      const [x, y] = py(s.g, "spawn_spot(global_vars.player.team, global_vars.player.k)") as unknown as [number, number];
      expect(py(s.g, "(global_vars.player.x, global_vars.player.y)")).toEqual([x, y]);
    }
  }, 120_000);

  it("rooms bigger than eight: teams grow, and nobody plays alongside a computer kid", async () => {
    const room = await match(3, 1);
    expect(room.all("len(kids()) == 4 and len([k for k in kids() if k.tag.startswith('b')]) == 1")).toBe(true);
  }, 120_000);

  it("a throw in another player's game: the host throws it for real and it knocks down; the host's throw knocks them down at home", async () => {
    const room = await match(2, 1);
    const [ox, oy] = OPEN(room.seat(1).g);
    place(room, 1, ox, oy);
    place(room, 2, ox + 90, oy);
    // #2 (Blue) throws at #1: it flies at once in #2's game, and for real in the host's.
    py(room.seat(2).g, `ask_throw(global_vars.player, ${ox}, ${oy}, 0)`);
    expect(py(room.seat(2).g, "len([b for b in instances('Snowball') if not b.real])")).toBe(1);
    room.step(30);
    expect(py(room.seat(1).g, "global_vars.player.stun") as number).toBeGreaterThan(0);
    expect(py(room.seat(2).g, "kid_by_tag('p1').stun") as number).toBeGreaterThan(0);
    // The host's own throws go out, and a copy flies in #2's game.
    room.step(STUN(room) + 100);
    place(room, 1, ox, oy);
    place(room, 2, ox + 90, oy);
    room.step(100);
    const life = py(room.seat(2).g, "global_vars.player.life") as number;
    py(room.seat(1).g, `ask_throw(global_vars.player, ${ox + 90}, ${oy}, 0)`);
    room.step(3);
    expect(py(room.seat(2).g, "len(instances('Snowball'))")).toBe(1);
    room.step(30);
    expect(py(room.seat(2).g, "global_vars.player.stun") as number).toBeGreaterThan(0);
    // Up again: back at Blue's fort, when the host says.
    room.step(STUN(room) + 20);
    expect(py(room.seat(2).g, "global_vars.player.life")).toBe(life + 1);
    expect(py(room.seat(2).g, "(global_vars.player.x, global_vars.player.y) == spawn_spot('blue', global_vars.player.k)")).toBe(true);
  }, 120_000);

  it("a capture by a player who isn't the host counts, and goes on their board, not the host's", async () => {
    const room = await match(2, 1);
    const ben = room.seat(2);
    const [rx, ry] = py(ben.g, "stand_of('red')") as unknown as [number, number];
    place(room, 2, rx + 10, ry);
    room.step(5);
    expect(room.all("flag_of('red').state == 'carried' and flag_of('red').carrier.tag == 'p2'")).toBe(true);
    expect(py(ben.g, "global_vars.player.carry is not None")).toBe(true);
    const [bx, by] = py(ben.g, "stand_of('blue')") as unknown as [number, number];
    place(room, 2, bx, by);
    room.step(5);
    expect(room.all("global_vars.m['score'] == {'red': 0, 'blue': 1} and flag_of('red').state == 'home'")).toBe(true);
    expect(ben.g.scores).toEqual([1]);
    expect(M(ben, "mine")).toBe(1);
    expect(room.seat(1).g.scores).toEqual([]);
  }, 120_000);

  it("a changed game gets nowhere: claiming to be on their flag, or throwing from afar, too often, or with none", async () => {
    const room = await match(2, 1);
    const ben = room.seat(2), host = room.seat(1);
    const start = where(host, "p2");
    const [rx, ry] = py(ben.g, "stand_of('red')") as unknown as [number, number];
    // Ben's game says he's on Red's flag: the host's copy of him walks there, no faster than CATCH_UP times a kid.
    py(ben.g, `global_vars.player.x, global_vars.player.y = ${rx}, ${ry}`);
    room.step(3);
    const now = where(host, "p2");
    expect(Math.hypot(now[0] - start[0], now[1] - start[1])).toBeLessThan(3 * 3.2 * 1.7 + 2);
    expect(py(host.g, "flag_of('red').state")).toBe("home");
    // A throw is thrown from where the HOST says he is, with the snowballs it says he has, and not too often.
    const [hx, hy] = where(host, "p2");
    const n = M(ben, "n");
    for (let i = 0; i < 5; i++) py(ben.g, `to_host({"th": [${rx}, ${ry}, 1], "n": ${n}})`);
    room.step(3);
    const balls = py(host.g, "[(round(b.x), round(b.y)) for b in instances('Snowball') if b.real and b.thrower.tag == 'p2']") as unknown as [number, number][];
    expect(balls.length).toBe(1);
    expect(Math.hypot(balls[0]![0] - hx, balls[0]![1] - hy)).toBeLessThan(40);
    py(host.g, "kid_by_tag('p2').stock = 0");
    room.step(80);
    py(ben.g, `to_host({"th": [${rx}, ${ry}, 1], "n": ${n}})`);
    room.step(3);
    expect(py(host.g, "len([b for b in instances('Snowball') if b.real and b.thrower.tag == 'p2'])")).toBe(0);
  }, 120_000);

  it("answering a question: off the field, a carried flag dropped, and no snowball can reach you", async () => {
    const room = await match(3, 2);
    const [rx, ry] = py(room.seat(2).g, "stand_of('red')") as unknown as [number, number];
    place(room, 2, rx + 10, ry);
    room.step(5);
    expect(py(room.seat(1).g, "flag_of('red').carrier.tag")).toBe("p2");
    room.seat(2).here = false;
    room.step(5);
    expect(py(room.seat(1).g, "flag_of('red').state")).toBe("dropped");
    expect(py(room.seat(1).g, "kid_by_tag('p2').away")).toBe(true);
    expect(py(room.seat(3).g, "kid_by_tag('p2').away and kid_by_tag('p2') not in kids()")).toBe(true);
    // A real snowball right at their feet does nothing.
    const [x, y] = where(room.seat(1), "p2");
    py(room.seat(1).g, `make_ball("red", ${x - 30}, ${y}, BALL_PACE, 0, 60, global_vars.player)`);
    room.step(10);
    expect(py(room.seat(1).g, "kid_by_tag('p2').stun")).toBe(0);
    // Back: on the field again, the flag where it fell.
    room.seat(2).here = true;
    room.step(5);
    expect(py(room.seat(1).g, "kid_by_tag('p2').away")).toBe(false);
  }, 120_000);

  it("someone joining mid-match takes a computer kid's place, on the side with fewer players", async () => {
    const room = await match(2);
    expect(py(room.seat(1).g, "len(instances('Bot'))")).toBe(6);
    await room.join(3, "Cai");
    room.step(20);
    const cai = room.seat(3);
    expect(py(cai.g, "global_vars.player.team")).not.toBe(null);
    expect(room.all("len(kids()) == 8 and len([k for k in kids() if k.tag.startswith('b')]) == 5")).toBe(true);
    // At their fort, where the computer kid they replaced would come back.
    expect(py(cai.g, "(global_vars.player.x, global_vars.player.y) == spawn_spot(global_vars.player.team, global_vars.player.k)")).toBe(true);
  }, 120_000);

  it("a whole match's worth of play in a room: no errors, and the host's word always fits in a room's message", async () => {
    const room = await match(2);
    let longest = 0;
    for (let i = 0; i < 40; i++) {
      // Ben wanders and throws now and then; the computer kids play.
      for (const [k, on] of [["a", i % 4 === 0], ["w", i % 4 === 1], ["d", i % 4 === 2], ["s", i % 4 === 3]] as const) key(room.seat(2).g, k, on);
      key(room.seat(2).g, "space", i % 3 === 0);
      room.step(60);
      longest = Math.max(longest, JSON.stringify(room.seat(1).state).length);
    }
    expect(longest).toBeLessThan(2000);
    expect(py(room.seat(1).g, "global_vars.m['score']['red'] + global_vars.m['score']['blue'] + len(global_vars.m['caps'])") as number).toBeGreaterThanOrEqual(0);
    // Twenty in a room: still fits.
    const big = py(room.seat(1).g, `
import json
for n in range(3, 21):
    _k = instance_create(100, 100, "Remote")
    _k.tag, _k.team, _k.k = f"p{n}", TEAMS[n % 2], n
len(json.dumps(snapshot(1), separators=(",", ":")))`) as unknown as number;
    expect(big).toBeLessThan(1900);
  }, 180_000);

  it("the host leaves mid-match: the next player's game carries on from its copy, computer kids and all", async () => {
    const room = await match(3);
    const [rx, ry] = py(room.seat(2).g, "stand_of('red')") as unknown as [number, number];
    place(room, 2, rx + 10, ry);
    room.step(60);
    const t = M(room.seat(2), "t") as number;
    room.seat(1).here = false;
    room.step(40);
    const two = room.seat(2);
    expect(py(two.g, "global_vars.in_charge")).toBe(true);
    expect(py(two.g, "len(instances('Bot')) == 5 and not any(b.puppet for b in instances('Bot'))")).toBe(true);
    // The flag Ben carried is still his, and the clock carried on.
    expect(py(two.g, "flag_of('red').carrier is global_vars.player")).toBe(true);
    expect(M(two, "t") as number).toBeLessThan(t);
    room.step(120);
    // (#3's game is a step or two behind: it hears #2's word the step after #2 sends it.)
    expect(Math.abs((py(room.seat(3).g, "global_vars.g['v']") as number) - (py(two.g, "global_vars.g['v']") as number))).toBeLessThanOrEqual(2);
    expect(Math.abs((M(room.seat(3), "t") as number) - (M(two, "t") as number))).toBeLessThanOrEqual(2);
  }, 120_000);
});
const STUN = (room: Room) => py(room.seat(1).g, "STUN_STEPS") as unknown as number;
