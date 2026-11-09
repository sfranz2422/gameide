/**
 * Multiplayer in the real Pyodide: what a room sends arrives with a step, a
 * message lasts one step, net_send only sends a change, and away means
 * nothing gets in. Outside a room every net_ function quietly does nothing,
 * so a game can be built in the editor before it's ever in one.
 */
import { describe, expect, it } from "vitest";
import { load, py, run } from "./testkit";

const ROOM = { code: "KXTD", number: 3, name: "Nia", state: { best: 120 } };
const climber = `class P(GameObject):
    def on_step(self):
        net_send({"x": self.x, "best": 5})
        for m in net_messages():
            global_vars.got = getattr(global_vars, "got", []) + [(m.sender, m.data)]
`;
const game = (net: typeof ROOM | null = ROOM, code = climber) => load({ code: { P: code }, instances: [{ object: "P", x: 10, y: 20 }], ...(net ? { net } : {}) });

describe("multiplayer", () => {
  it("knows its room and who it is, and what it sent before a reload", async () => {
    const { game: g } = await game();
    expect(py(g, "net_room()")).toBe("KXTD");
    expect(py(g, "[net_me().number, net_me().name, net_me().best]")).toEqual([3, "Nia", 120]);
  });

  it("outside a room everything quietly does nothing", async () => {
    const { game: g, nets, error } = await game(null);
    expect(error).toBeNull();
    run(g, 3);
    py(g, 'net_shout({"a": 1})');
    run(g, 1);
    expect(py(g, "[net_room() is None, net_me() is None, net_players(), net_messages()]")).toEqual([true, true, [], []]);
    expect(nets).toEqual([]);
  });

  it("sends its state, but only when it changed", async () => {
    const { game: g, nets } = await game();
    run(g, 3);
    expect(nets).toEqual([{ state: { x: 10, best: 5 } }]);
    py(g, "instances('P')[0].x = 50");
    run(g, 1);
    expect(nets.at(-1)).toEqual({ state: { x: 50, best: 5 } });
    expect(py(g, "net_me().x")).toBe(50);
  });

  it("the others arrive with the next step, by name", async () => {
    const { game: g } = await game();
    g.netArrive([{ number: 1, name: "Oli", state: { x: 4, y: -300 } }], []);
    expect(py(g, "net_players()")).toEqual([]);
    run(g, 1);
    expect(py(g, "[(p.number, p.name, p.x, p.y, p.get('z', 7)) for p in net_players()]")).toEqual([[1, "Oli", 4, -300, 7]]);
    run(g, 1);
    expect(py(g, "len(net_players())")).toBe(1);
  });

  it("a name a player never sent says what they did send", async () => {
    const { game: g } = await game();
    g.netArrive([{ number: 1, name: "Oli", state: { x: 4 } }], []);
    run(g, 1);
    expect(() => py(g, "net_players()[0].height")).toThrow(/didn't send 'height' with net_send. They sent: x/);
  });

  it("a message lasts the one step it arrived in, and none is lost between steps", async () => {
    const { game: g } = await game();
    g.netArrive(null, [{ from: 1, data: { snowball: [1, 2] }, age: 0.1 }]);
    g.netArrive(null, [{ from: 2, data: "hi", age: 0 }]);
    run(g, 1);
    expect(py(g, "global_vars.got")).toEqual([[1, { snowball: [1, 2] }], [2, "hi"]]);
    run(g, 1);
    expect(py(g, "len(global_vars.got)")).toBe(2);
    expect(py(g, "net_messages()")).toEqual([]);
  });

  it("shouts go out with the step", async () => {
    const { game: g, nets } = await game();
    py(g, 'net_shout({"snowball": [1, 2]}); net_shout(3)');
    run(g, 1);
    expect(nets.at(-1)).toEqual({ state: { x: 10, best: 5 }, msgs: [{ snowball: [1, 2] }, 3] });
  });

  it("away: hidden, deaf and silent until back", async () => {
    const { game: g, nets } = await game();
    run(g, 1);
    py(g, 'net_away(True); net_shout("lost")');
    g.netArrive(null, [{ from: 1, data: "missed", age: 0 }]);
    run(g, 1);
    expect(nets.at(-1)).toEqual({ away: true });
    expect(py(g, "getattr(global_vars, 'got', [])")).toEqual([]);
    py(g, "net_away(False)");
    g.netArrive(null, [{ from: 1, data: "heard", age: 0 }]);
    run(g, 1);
    expect(nets.at(-1)).toEqual({ away: false });
    expect(py(g, "global_vars.got")).toEqual([[1, "heard"]]);
  });

  it("refuses what it couldn't send, in words", async () => {
    const { game: g } = await game();
    const err = (code: string) => String(py(g, `
try:
    ${code}
    r = "no error"
except Exception as e:
    r = str(e)
r`));
    expect(err("net_send(5)")).toMatch(/net_send takes a dict/);
    expect(err('net_send({"x": instances("P")[0]})')).toMatch(/can send numbers, text/);
    expect(err('net_send({"name": "Bob"})')).toMatch(/can't be a name in net_send/);
    expect(err('net_send({"x": "a" * 3000})')).toMatch(/2000 characters/);
    expect(err('net_shout("a" * 600)')).toMatch(/500 characters/);
  });

  it("draw_x and draw_y: a player keeps moving between words, for a while, and glides onto each new one", async () => {
    const { game: g } = await game();
    const at = () => py(g, "p = net_players()[0]\n(p.draw_x, p.draw_y)") as unknown as [number, number];
    g.netArrive([{ number: 1, name: "Oli", state: { x: 100, y: 50, vx: 3, vy: 0, s: 1 } }], []);
    run(g, 1);
    expect(at()).toEqual([100, 50]);
    run(g, 6);
    expect(at()[0], "still going, though nothing new has come").toBeGreaterThan(110);
    run(g, 60);
    expect(at()[0], "but not for ever").toBeCloseTo(100 + 3 * (py(g, "import gameide\ngameide.NET_PREDICT_STEPS") as number), 0);
    g.netArrive([{ number: 1, name: "Oli", state: { x: 200, y: 50, vx: 0, vy: 0, s: 2 } }], []);
    run(g, 1);
    const glided = at()[0];
    expect(glided, "glides, doesn't jump").toBeGreaterThan(140);
    expect(glided).toBeLessThan(200);
    run(g, 30);
    expect(at()[0]).toBeCloseTo(200, 0);
    // ay: a jump's gravity, up and then down.
    g.netArrive([{ number: 1, name: "Oli", state: { x: 200, y: 50, vx: 0, vy: -6, ay: 0.5, s: 3 } }], []);
    run(g, 8);
    expect(at()[1]).toBeLessThan(50);
  });

  it("draw_x is None for a player who sends no x and y, and nothing outside a room", async () => {
    const { game: g } = await game();
    g.netArrive([{ number: 1, name: "Oli", state: { score: 3 } }], []);
    run(g, 2);
    expect(py(g, "net_players()[0].draw_x is None")).toBe(true);
  });
});

