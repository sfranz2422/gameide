/**
 * Code blocks: every catalog entry has a block in the palette, every block
 * writes Python that compiles and calls the function the way the catalog
 * says, and the Python reads like a person wrote it — checked against real
 * Python in Pyodide, never by eye.
 */
import * as Blockly from "blockly/core";
import { describe, expect, it } from "vitest";
import { API } from "../catalog/api";
import { load, py, run } from "../python/testkit";
import { emptyBlocks, hasBlocks, renameInBlocks, type BlocksState } from "./blockState";
import { blocksFor } from "./catalogBlocks";
import { blocksToPython } from "./python";
import { toolbox, VARIABLE_BLOCKS, variablesFlyout } from "./toolbox";

type B = Record<string, unknown>;
/** An event: these blocks, one after another, under the hat. */
function event(...stack: B[]): BlocksState {
  let next: B | undefined;
  for (const b of [...stack].reverse()) next = next ? { ...b, next: { block: next } } : b;
  return { blocks: { languageVersion: 0, blocks: [{ type: "gm_event", id: "hat", x: 0, y: 0, ...(next ? { inputs: { BODY: { block: next } } } : {}) }] } };
}
const n = (v: number) => ({ shadow: { type: "math_number", fields: { NUM: v } } });
const code = (s: BlocksState) => blocksToPython(s).code;

type Category = { kind: string; name: string; contents?: B[]; custom?: string };
const categories = (toolbox() as unknown as { contents: Category[] }).contents;
function paletteBlocks(): { category: string; block: B }[] {
  const ws = new Blockly.Workspace();
  ws.getVariableMap().createVariable("i");
  const out: { category: string; block: B }[] = [];
  for (const c of categories) {
    const contents = c.custom ? variablesFlyout(ws) : (c.contents ?? []);
    for (const b of contents) if (b["kind"] === "block") out.push({ category: c.name, block: b });
  }
  ws.dispose();
  return out;
}

describe("the palette", () => {
  it("has every catalog entry's blocks, in the entry's own category", () => {
    const palette = paletteBlocks();
    const missing: string[] = [];
    for (const e of API)
      for (const type of blocksFor(e)) {
        const want = e.name === "global_vars" ? "Variables" : e.category;
        if (!palette.some((p) => p.block["type"] === type && p.category === want)) missing.push(`${type} in ${want}`);
      }
    expect(missing).toEqual([]);
    for (const t of VARIABLE_BLOCKS) expect(palette.some((p) => p.block["type"] === t)).toBe(true);
  });

  it("has the spec's categories, Scratch-coloured", () => {
    const names = categories.map((c) => c.name);
    for (const want of ["Motion", "Instances", "Collision", "Input", "Variables", "Logic", "Loops", "Math", "Drawing", "Rooms"]) expect(names).toContain(want);
  });

  it("every block, as it comes out of the palette, writes Python that compiles and calls with the catalog's parameters", async () => {
    // Each block in an event of its own: a statement as it is, a value
    // printed, so even a lone value makes a whole line.
    const bodies = paletteBlocks().map(({ block }) => {
      const { kind: _k, ...b } = block;
      const s = Blockly.Blocks[b["type"] as string];
      expect(s, `${String(b["type"])} is defined`).toBeTruthy();
      const ws = new Blockly.Workspace();
      const one = Blockly.serialization.blocks.append(b as never, ws);
      const isValue = !!one.outputConnection;
      ws.dispose();
      return { type: b["type"] as string, code: code(isValue ? event({ type: "text_print", inputs: { TEXT: { block: b } } }) : event(b)) };
    });
    expect(bodies.length).toBeGreaterThan(60);
    if (process.env["SHOW"]) for (const b of bodies) console.log(`${b.type.padEnd(28)} ${b.code.replace(/\n/g, " ⏎ ")}`);
    const { game } = await load({ code: {} });
    const arity = Object.fromEntries(
      API.filter((e) => e.kind === "function").map((f) => [f.name, [f.params.filter((p) => p.default === undefined).length, f.params.length]]),
    );
    const problems = py(game, `
import ast, json
problems = []
arity = json.loads(${JSON.stringify(JSON.stringify(arity))})
for item in json.loads(${JSON.stringify(JSON.stringify(bodies))}):
    src = "def on_step(self):\\n" + "".join("    " + l + "\\n" for l in (item["code"] or "pass").split("\\n"))
    try:
        tree = ast.parse(compile(src, item["type"], "exec", ast.PyCF_ONLY_AST))
    except SyntaxError as e:
        problems.append(f"{item['type']}: {e}\\n{src}")
        continue
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in arity:
            lo, hi = arity[node.func.id]
            if not lo <= len(node.args) <= hi:
                problems.append(f"{item['type']}: {node.func.id} given {len(node.args)} arguments")
problems
`);
    game.dispose();
    expect(problems).toEqual([]);
  });
});

describe("the Python blocks write", () => {
  it("is what a person would type: 4 spaces, double quotes, -= for a negative", () => {
    const s = event(
      {
        type: "controls_if",
        inputs: {
          IF0: { block: { type: "gm_fn_keyboard_check", inputs: { key: { shadow: { type: "gm_key", fields: { NAME: "left" } } } } } },
          DO0: { block: { type: "gm_prop_change", fields: { PROP: "x" }, inputs: { BY: n(-4) } } },
        },
      },
      { type: "gm_global_change", fields: { NAME: "score" }, inputs: { BY: n(1) } },
      { type: "gm_my_set", fields: { NAME: "lives" }, inputs: { TO: n(3) } },
      { type: "gm_do_draw_text", inputs: { x: n(10), y: n(10), text: { shadow: { type: "text", fields: { TEXT: "Hi" } } } } },
    );
    expect(code(s)).toBe(['if keyboard_check("left"):', "    self.x -= 4", "global_vars.score += 1", "self.lives = 3", 'draw_text(10, 10, "Hi")'].join("\n"));
  });

  it("leaves out optional arguments still at their default, and only those", () => {
    expect(code(event({ type: "gm_do_camera_shake", inputs: { strength: n(4), steps: n(15) } }))).toBe("camera_shake()");
    expect(code(event({ type: "gm_do_camera_shake", inputs: { strength: n(8), steps: n(15) } }))).toBe("camera_shake(8)");
    expect(code(event({ type: "gm_do_camera_shake", inputs: { strength: n(4), steps: n(30) } }))).toBe("camera_shake(4, 30)");
    expect(code(event({ type: "gm_do_move_and_collide", inputs: { dx: n(4), dy: n(0), obj: { shadow: { type: "gm_object_any", fields: { NAME: " none" } } } } }))).toBe(
      "move_and_collide(4, 0)",
    );
  });

  it("puts imports first, with no `x = None` lines for variables", () => {
    const s = event(
      { type: "variables_set", fields: { VAR: { id: "v1" } }, inputs: { VALUE: { block: { type: "math_random_int", inputs: { FROM: n(1), TO: n(6) } } } } },
      { type: "gm_my_set", fields: { NAME: "roll" }, inputs: { TO: { block: { type: "variables_get", fields: { VAR: { id: "v1" } } } } } },
    );
    s.variables = [{ name: "dice", id: "v1" }];
    expect(code(s)).toBe(["import random", "dice = random.randint(1, 6)", "self.roll = dice"].join("\n"));
  });

  it("joins text into an f-string, and imports only what it uses", () => {
    const join = (...items: B[]) =>
      code(event({ type: "text_print", inputs: { TEXT: { block: { type: "text_join", extraState: { itemCount: items.length }, inputs: Object.fromEntries(items.map((b, i) => [`ADD${i}`, { block: b }])) } } } }));
    const text = (t: string) => ({ type: "text", fields: { TEXT: t } });
    const score = { type: "gm_global_get", fields: { NAME: "score" } };
    expect(join(text("Score: "), score)).toBe('print(f"Score: {global_vars.score}")');
    expect(join(text("{a} "), score, text('"!"'))).toBe('print(f"{{a}} {global_vars.score}\\"!\\"")');
    expect(join(text("a"), text("b"))).toBe('print("ab")');
    expect(join(score)).toBe("print(str(global_vars.score))");
    expect(code(event({ type: "text_print", inputs: { TEXT: { block: { type: "math_round", inputs: { NUM: n(3.5) } } } } }))).toBe("print(round(3.5))");
  });

  it("goes through every instance of an object with a for loop", () => {
    const s = event({
      type: "controls_forEach",
      fields: { VAR: { id: "e1" } },
      inputs: {
        LIST: { block: { type: "gm_fn_instances", inputs: { obj: { shadow: { type: "gm_object", fields: { NAME: "Enemy" } } } } } },
        DO: { block: { type: "gm_of_set", fields: { PROP: "hspeed" }, inputs: { OF: { block: { type: "variables_get", fields: { VAR: { id: "e1" } } } }, TO: n(0) } } },
      },
    });
    s.variables = [{ name: "e", id: "e1" }];
    expect(code(s)).toBe(['for e in instances("Enemy"):', "    e.hspeed = 0"].join("\n"));
  });

  it("leaves out blocks that aren't under the hat", () => {
    const s = event({ type: "gm_prop_change", fields: { PROP: "x" }, inputs: { BY: n(1) } });
    s.blocks!.blocks!.push({ type: "gm_do_room_restart", x: 400, y: 400 });
    expect(code(s)).toBe("self.x += 1");
  });

  it("keeps a name the project no longer has, rather than swapping in another", () => {
    const s = event({ type: "gm_do_instance_create", inputs: { x: n(0), y: n(0), obj: { shadow: { type: "gm_object", fields: { NAME: "Ghost" } } } } });
    expect(code(s)).toBe('instance_create(0, 0, "Ghost")');
  });

  it("says which block made each line", () => {
    const s = event(
      { type: "controls_if", id: "if", inputs: { IF0: { block: { type: "logic_boolean", fields: { BOOL: "TRUE" } } }, DO0: { block: { type: "gm_prop_change", id: "inner", fields: { PROP: "x" }, inputs: { BY: n(1) } } } } },
      { type: "gm_do_room_restart", id: "last" },
    );
    const { code: c, lines } = blocksToPython(s);
    expect(c.split("\n")).toEqual(["if True:", "    self.x += 1", "room_restart()"]);
    expect(lines).toEqual(["if", "inner", "last"]);
  });

  it("an event with nothing under the hat is empty", () => {
    expect(code(emptyBlocks())).toBe("");
    expect(hasBlocks(emptyBlocks())).toBe(false);
    expect(hasBlocks(event({ type: "gm_do_room_restart" }))).toBe(true);
  });
});

describe("blocks in a game", () => {
  it("run as the event's code", async () => {
    const create = code(event({ type: "gm_my_set", fields: { NAME: "lives" }, inputs: { TO: n(3) } }));
    const step = code(
      event(
        { type: "gm_prop_change", fields: { PROP: "x" }, inputs: { BY: n(2) } },
        {
          type: "controls_if",
          inputs: {
            IF0: { block: { type: "logic_compare", fields: { OP: "GT" }, inputs: { A: { block: { type: "gm_prop_get", fields: { PROP: "x" } } }, B: n(10) } } },
            DO0: { block: { type: "gm_my_change", fields: { NAME: "lives" }, inputs: { BY: n(-1) } } },
          },
        },
      ),
    );
    const { game, error } = await load({
      code: { Player: `class Player(GameObject):\n    def on_create(self):\n${indent(create)}\n    def on_step(self):\n${indent(step)}\n` },
      instances: [{ object: "Player", x: 0, y: 0 }],
    });
    expect(error).toBeNull();
    run(game, 6); // x: 2 4 6 8 10 12 — past 10 once
    expect(py(game, "[instances('Player')[0].x, instances('Player')[0].lives]")).toEqual([12, 2]);
    game.dispose();
  });
});

describe("renaming", () => {
  it("changes name pickers and exactly-matching text, nothing else", () => {
    const s = event(
      { type: "gm_do_instance_create", inputs: { x: n(0), y: n(0), obj: { shadow: { type: "gm_object", fields: { NAME: "Coin" } } } } },
      { type: "gm_do_draw_text", inputs: { x: n(0), y: n(0), text: { shadow: { type: "text", fields: { TEXT: "Coin" } } } } },
      { type: "gm_do_draw_text", inputs: { x: n(0), y: n(0), text: { shadow: { type: "text", fields: { TEXT: "Coins: " } } } } },
      { type: "gm_my_set", fields: { NAME: "Coin" }, inputs: { TO: n(1) } },
    );
    renameInBlocks(s, "Coin", "Gem");
    expect(code(s)).toBe(['instance_create(0, 0, "Gem")', 'draw_text(0, 0, "Gem")', 'draw_text(0, 0, "Coins: ")', "self.Coin = 1"].join("\n"));
  });
});

function indent(body: string) {
  return (body || "pass").split("\n").map((l) => `        ${l}`).join("\n");
}
