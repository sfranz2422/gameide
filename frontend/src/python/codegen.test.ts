/**
 * Code generation and error mapping, checked by running the generated
 * classes in the real Pyodide: an error must land on the event and line
 * the student typed, whatever else the object has.
 */
import { describe, expect, it } from "vitest";
import { blankProject, newEvent, newObject, type EventKey, type ObjectResource, type Project } from "../store/project";
import { PythonGame } from "./bridge";
import { buildGame, generateObject, mapError, parentsFirst } from "./codegen";

function project(): Project {
  return blankProject("t");
}
function addObj(p: Project, name: string, extra: Partial<ObjectResource> = {}) {
  const o = { ...newObject(name), ...extra };
  p.objects.push(o);
  return o;
}
function addEv(o: ObjectResource, key: EventKey, code: string) {
  const e = { ...newEvent(key), code };
  o.events.push(e);
  return e;
}

async function runUntilError(p: Project, steps = 3) {
  const built = buildGame(p, new Map());
  const { game, error } = await PythonGame.load(built.def);
  let e = error;
  for (let i = 0; i < steps && !e; i++) e = game.step();
  game.dispose();
  return e ? mapError(p, built.sources, e) : null;
}

describe("generated classes", () => {
  it("puts each event's body inside its method, with the def line students are shown", () => {
    const p = project();
    const coin = addObj(p, "Coin");
    const o = addObj(p, "Player");
    addEv(o, { type: "create" }, "self.lives = 3\n");
    addEv(o, { type: "collision", object: coin.id }, "other.destroy()");
    addEv(o, { type: "key", kind: "pressed", key: "space" }, "");
    expect(generateObject(p, o).source).toBe(
      [
        "class Player(GameObject):",
        "    def on_create(self):",
        "        self.lives = 3",
        "",
        "    def on_collision_coin(self, other):",
        "        other.destroy()",
        "",
        "    def on_key_pressed_space(self):",
        "        pass",
        "",
      ].join("\n"),
    );
  });

  it("an object with no events is still a class, and children come after parents", () => {
    const p = project();
    const child = addObj(p, "Goblin");
    const parent = addObj(p, "Enemy");
    child.parent = parent.id;
    expect(parentsFirst(p).map((o) => o.name)).toEqual(["Enemy", "Goblin"]);
    expect(generateObject(p, child).source).toBe("class Goblin(Enemy):\n    pass\n");
  });

  it("a body of only comments still compiles", async () => {
    const p = project();
    const o = addObj(p, "A");
    addEv(o, { type: "step" }, "# nothing yet\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, x: 0, y: 0 });
    expect(await runUntilError(p)).toBeNull();
  });

  it("tabs at the start of a line become spaces, so mixed indentation can't break it", async () => {
    const p = project();
    const o = addObj(p, "A");
    // The editor shows a tab as 4 columns, so these two lines look level —
    // but untouched, Python would see 8 spaces + a tab against 12 spaces.
    addEv(o, { type: "step" }, "if True:\n\tself.x = 5\n    self.y = 6\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, x: 0, y: 0 });
    expect(await runUntilError(p)).toBeNull();
  });
});

describe("errors point at what the student typed", () => {
  it("a runtime error in the third event, line 2", async () => {
    const p = project();
    const o = addObj(p, "Player");
    addEv(o, { type: "create" }, "self.a = 1\nself.b = 2\n");
    addEv(o, { type: "begin_step" }, "pass\n");
    // The error is on a middle line: on the last line, mapping one line too
    // far would be hidden by the clamp that maps an added `pass`.
    const step = addEv(o, { type: "step" }, "self.x += 1\nself.x += spead\nself.y += 1\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, x: 0, y: 0 });
    const e = await runUntilError(p);
    expect(e?.where).toBe("Player → Step, line 2");
    expect(e?.target).toEqual({ kind: "event", objectId: o.id, eventId: step.id, line: 2 });
    expect(e?.traceback).toContain("Player → Step, line 2");
    expect(e?.traceback).not.toContain("<object");
  });

  it("a syntax error, before anything runs", async () => {
    const p = project();
    const o = addObj(p, "Player");
    addEv(o, { type: "create" }, "x = 1\n");
    const draw = addEv(o, { type: "draw" }, "draw_self()\nif x > 1\n    pass\n");
    const e = await runUntilError(p);
    expect(e?.where).toBe("Player → Draw, line 2");
    expect(e?.target).toMatchObject({ eventId: draw.id, line: 2 });
  });

  it("an error inside a script names the script and its own line", async () => {
    const p = project();
    p.scripts.push({ id: "s1", name: "helpers", code: "def boom():\n    return 1 / 0\n" });
    const o = addObj(p, "A");
    addEv(o, { type: "create" }, "boom()\n");
    p.rooms[0]!.instances.push({ id: "i", object: o.id, x: 0, y: 0 });
    const e = await runUntilError(p);
    expect(e?.where).toBe("script helpers, line 2");
    expect(e?.target).toEqual({ kind: "script", scriptId: "s1", line: 2 });
    expect(e?.traceback).toContain("A → Create, line 1");
  });

  it("the def line and an empty event's added `pass` map to that event's line 1", () => {
    // class line 1; Create: def 2, pass 3; blank 4; Step: def 5, body 6.
    const p = project();
    const o = addObj(p, "A");
    const create = addEv(o, { type: "create" }, "");
    const step = addEv(o, { type: "step" }, "x = 1\n");
    const built = buildGame(p, new Map());
    const at = (line: number) =>
      mapError(p, built.sources, { kind: "object", object: "A", event: null, line, message: "", traceback: "" }).target;
    expect(at(3)).toEqual({ kind: "event", objectId: o.id, eventId: create.id, line: 1 });
    expect(at(5)).toEqual({ kind: "event", objectId: o.id, eventId: step.id, line: 1 });
    expect(at(6)).toEqual({ kind: "event", objectId: o.id, eventId: step.id, line: 1 });
    expect(at(1)).toBeNull();
  });
});
