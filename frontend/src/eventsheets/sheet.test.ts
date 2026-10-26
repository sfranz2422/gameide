/**
 * Event sheets to Python: the exact text a sheet writes (students read it
 * beside the sheet), every catalog condition and action compiling in real
 * Python, the checks on what is typed, and sheets running in a game.
 */
import { describe, expect, it } from "vitest";
import { API } from "../catalog/api";
import { load, py, run } from "../python/testkit";
import {
  ACTION_FUNCTIONS,
  checkExpr,
  checkLine,
  CONDITION_FUNCTIONS,
  canDrop,
  defaultArg,
  fitCalls,
  moveRow,
  renameInSheet,
  rowOf,
  sheetProblems,
  sheetToPython,
  type Action,
  type Condition,
  type Row,
  type Sheet,
} from "./sheet";

let n = 0;
const id = () => `id${++n}`;
const key = (k: string, fn = "keyboard_check"): Condition => ({ id: id(), type: "call", fn, args: [`"${k}"`] });
const change = (target: string, by: string): Action => ({ id: id(), type: "set", target, op: by.startsWith("-") ? "-=" : "+=", value: by.replace(/^-/, "") });
const row = (conditions: Condition[], actions: Action[], children: Row[] = [], extra: Partial<Extract<Row, { kind: "event" }>> = {}): Row => ({
  id: id(),
  kind: "event",
  conditions,
  actions,
  children,
  ...extra,
});
const code = (...rows: Row[]) => sheetToPython({ rows }).code;

describe("the Python a sheet writes", () => {
  it("is a row's conditions joined with and, its actions under them", () => {
    expect(code(row([key("right"), { id: id(), type: "expr", code: "not place_free(self.x + 4, self.y)" }], [change("self.x", "4")]))).toBe(
      ['if keyboard_check("right") and not place_free(self.x + 4, self.y):', "    self.x += 4"].join("\n"),
    );
  });

  it("with no conditions, the actions just run", () => {
    expect(code(row([], [change("self.y", "-2"), { id: id(), type: "call", fn: "camera_shake", args: ["4", "15"] }]))).toBe("self.y -= 2\ncamera_shake()");
  });

  it("an OR row joins with or; a condition with its own and/or gets brackets", () => {
    const either = row([key("a", "keyboard_check_pressed"), key("b", "keyboard_check_pressed")], [{ id: id(), type: "set", target: "global_vars.score", op: "=", value: "0" }], [], { any: true });
    expect(code(either)).toBe(['if keyboard_check_pressed("a") or keyboard_check_pressed("b"):', "    global_vars.score = 0"].join("\n"));
    const mixed = row([key("up"), { id: id(), type: "expr", code: "self.y > 0 or self.flying" }], [change("self.y", "-4")]);
    expect(code(mixed)).toBe(['if keyboard_check("up") and (self.y > 0 or self.flying):', "    self.y -= 4"].join("\n"));
  });

  it("negates a condition", () => {
    const r = row(
      [
        { id: id(), type: "call", fn: "place_free", args: ["self.x", "self.y + 1"], not: true },
        { id: id(), type: "compare", left: "self.lives", op: "<=", right: "0", not: true },
        { id: id(), type: "expr", code: "self.a or self.b", not: true },
      ],
      [],
    );
    expect(code(r)).toBe(["if not place_free(self.x, self.y + 1) and not self.lives <= 0 and not (self.a or self.b):", "    pass"].join("\n"));
  });

  it("nests sub-events, and else/elif rows follow the row above", () => {
    const sub = row([{ id: id(), type: "compare", left: "self.lives", op: "<=", right: "0" }], [{ id: id(), type: "call", fn: "room_restart", args: [] }]);
    const hit = row([{ id: id(), type: "call", fn: "place_meeting", args: ["self.x", "self.y", '"Spike"'] }], [change("self.lives", "-1")], [sub]);
    const elif: Row = { id: id(), kind: "else", conditions: [key("space")], actions: [change("self.y", "-8")], children: [] };
    const otherwise: Row = { id: id(), kind: "else", conditions: [], actions: [{ id: id(), type: "code", code: "self.hspeed = 0" }], children: [] };
    expect(code(hit, elif, otherwise)).toBe(
      [
        'if place_meeting(self.x, self.y, "Spike"):',
        "    self.lives -= 1",
        "    if self.lives <= 0:",
        "        room_restart()",
        'elif keyboard_check("space"):',
        "    self.y -= 8",
        "else:",
        "    self.hspeed = 0",
      ].join("\n"),
    );
  });

  it("goes through other instances with a for-each row, by the name it gives them", () => {
    const near = row([{ id: id(), type: "compare", left: "point_distance(self.x, self.y, e.x, e.y)", op: "<", right: "100" }], [{ id: id(), type: "set", target: "e.hspeed", op: "=", value: "0" }]);
    const each: Row = { id: id(), kind: "foreach", object: "Enemy", as: "e", children: [near] };
    expect(code(each)).toBe(['for e in instances("Enemy"):', "    if point_distance(self.x, self.y, e.x, e.y) < 100:", "        e.hspeed = 0"].join("\n"));
    expect(code({ ...each, children: [] } as Row)).toBe('for e in instances("Enemy"):\n    pass');
  });

  it("writes comments, and a body of only comments still gets pass", () => {
    const note: Row = { id: id(), kind: "comment", text: "Jumping\nonly on the ground" };
    expect(code(note, row([key("space")], [], [note]))).toBe(["# Jumping", "# only on the ground", 'if keyboard_check("space"):', "    # Jumping", "    # only on the ground", "    pass"].join("\n"));
  });

  it("Trigger once wraps the rest of the row's conditions in self.once", () => {
    const r = row([key("space"), { id: id(), type: "once" }], [{ id: id(), type: "destroy", who: "self" }]);
    expect(code(r)).toBe([`if self.once("${r.id.slice(0, 6)}", keyboard_check("space")):`, "    self.destroy()"].join("\n"));
  });

  it("says which row, condition or action made each line", () => {
    const act = change("self.x", "1");
    const r = row([key("right")], [act]);
    const { lines } = sheetToPython({ rows: [r] });
    expect(lines).toEqual([r.id, act.id]);
    expect(rowOf({ rows: [r] }, act.id)).toBe(r);
  });
});

describe("what students type", () => {
  it("must be one Python value in a value box", () => {
    expect(checkExpr("self.x + 4")).toBeNull();
    expect(checkExpr('f"Score: {global_vars.score}"')).toBeNull();
    expect(checkExpr("self.x +")).not.toBeNull();
    expect(checkExpr("x = 3")).not.toBeNull();
    expect(checkExpr("")).toBe("Needs a value.");
  });

  it("must be one simple line in a line box — rows do if, for and while", () => {
    expect(checkLine("self.lives = 3")).toBeNull();
    expect(checkLine("print(self.x)")).toBeNull();
    expect(checkLine("if x: y")).toBe("Use rows for if, for and while.");
    expect(checkLine("x = = 3")).not.toBeNull();
  });

  it("problems are found by the id of the box's condition or action, and of rows", () => {
    const bad = change("self.x", "4");
    (bad as Extract<Action, { type: "set" }>).value = "4 +";
    const orphan: Row = { id: id(), kind: "else", conditions: [], actions: [], children: [] };
    const each: Row = { id: id(), kind: "foreach", object: "Enemy", as: "2e", children: [] };
    const problems = sheetProblems({ rows: [orphan, row([], [bad]), each] });
    expect([...problems.keys()].sort()).toEqual([bad.id, orphan.id, each.id].sort());
  });
});

describe("the catalog's conditions and actions", () => {
  it("are every function that answers True/False, and every one called for what it does", () => {
    for (const f of API) {
      if (f.kind !== "function") continue;
      const isCondition = f.returns === "True or False";
      expect(CONDITION_FUNCTIONS.includes(f), f.name).toBe(isCondition);
      expect(ACTION_FUNCTIONS.includes(f), f.name).toBe(f.returns === "nothing" || !!f.alsoStatement);
    }
  });

  it("each compiles in real Python with the arguments its boxes start with, and the catalog's parameters", async () => {
    const name = () => "Thing";
    const rows: Row[] = [
      ...CONDITION_FUNCTIONS.map((f) => row([{ id: id(), type: "call", fn: f.name, args: f.params.map((p) => defaultArg(p, name)) }], [])),
      row([], ACTION_FUNCTIONS.map((f) => ({ id: id(), type: "call", fn: f.name, args: f.params.map((p) => defaultArg(p, name)) }) as Action)),
    ];
    const body = code(...rows);
    const arity = Object.fromEntries(API.filter((e) => e.kind === "function").map((f) => [f.name, [f.params.filter((p) => p.default === undefined).length, f.params.length]]));
    const { game } = await load({ code: {} });
    const problems = py(game, `
import ast, json
src = "def on_step(self):\\n" + "".join("    " + l + "\\n" for l in ${JSON.stringify(body)}.split("\\n"))
arity = json.loads(${JSON.stringify(JSON.stringify(arity))})
problems = []
for node in ast.walk(ast.parse(src)):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in arity:
        lo, hi = arity[node.func.id]
        if not lo <= len(node.args) <= hi:
            problems.append(f"{node.func.id} given {len(node.args)} arguments")
problems
`);
    game.dispose();
    expect(problems).toEqual([]);
  });
});

describe("sheets in a game", () => {
  it("run as the event's code, Trigger once included", async () => {
    // Step: x moves 2 each step; once x passes 6, count it — once, not every step after.
    const step = code(
      row([], [change("self.x", "2")]),
      row([{ id: "onceRow1", type: "compare", left: "self.x", op: ">", right: "6" }, { id: id(), type: "once" }], [{ id: id(), type: "code", code: "global_vars.passed += 1" }]),
    );
    const { game, error } = await load({
      code: {
        Mover: `class Mover(GameObject):\n    def on_create(self):\n        global_vars.passed = 0\n    def on_step(self):\n${step
          .split("\n")
          .map((l) => `        ${l}`)
          .join("\n")}\n`,
      },
      instances: [{ object: "Mover", x: 0, y: 0 }],
    });
    expect(error).toBeNull();
    run(game, 10);
    expect(py(game, "[instances('Mover')[0].x, global_vars.passed]")).toEqual([20, 1]);
    // Back below, then past again: counted a second time.
    py(game, "instances('Mover')[0].x = 0");
    run(game, 10);
    expect(py(game, "global_vars.passed")).toBe(2);
    game.dispose();
  });
});

describe("moving rows by drag and drop", () => {
  const named = (name: string, children: Row[] = []): Row => ({ id: name, kind: "event", conditions: [], actions: [{ id: id(), type: "code", code: `${name}()` }], children });
  const sheet = (): Sheet => ({ rows: [named("a", [named("a1"), named("a2")]), named("b"), { id: "c", kind: "comment", text: "note" }] });
  const order = (s: Sheet) => sheetToPython(s).code;

  it("goes before, after, or inside a row (as its last sub-event), with its own sub-events", () => {
    let s = sheet();
    expect(moveRow(s, "b", "a", "before")).toBe(true);
    expect(order(s)).toBe(["b()", "a()", "a1()", "a2()", "# note"].join("\n"));
    s = sheet();
    expect(moveRow(s, "a", "c", "after")).toBe(true);
    expect(order(s)).toBe(["b()", "# note", "a()", "a1()", "a2()"].join("\n"));
    s = sheet();
    expect(moveRow(s, "b", "a", "inside")).toBe(true);
    expect(s.rows[0]!.kind !== "comment" && s.rows[0]!.children.map((r) => r.id)).toEqual(["a1", "a2", "b"]);
    s = sheet();
    expect(moveRow(s, "a2", null, "after")).toBe(true); // out of a sub-event, to the end
    expect(s.rows.map((r) => r.id)).toEqual(["a", "b", "c", "a2"]);
    s = sheet();
    expect(moveRow(s, "a", "a2", "after")).toBe(false); // a2 is under a
  });

  it("never onto itself, into its own sub-events, or inside a comment", () => {
    const s = sheet();
    expect(canDrop(s, "a", "a", "before")).toBe(false);
    expect(canDrop(s, "a", "a1", "after")).toBe(false);
    expect(canDrop(s, "b", "c", "inside")).toBe(false);
    expect(canDrop(s, "b", "c", "after")).toBe(true);
    expect(moveRow(s, "a", "a1", "inside")).toBe(false);
    expect(order(s)).toBe(order(sheet())); // nothing moved
  });

  it("finds its target again after taking the row out", () => {
    // a1 is before a2 in the same list: once a1 is out, a2 moves up one.
    const s = sheet();
    expect(moveRow(s, "a1", "a2", "after")).toBe(true);
    expect(s.rows[0]!.kind !== "comment" && s.rows[0]!.children.map((r) => r.id)).toEqual(["a2", "a1"]);
    // Three in a row, so a stale place would show: p after q is q, p, r — not q, r, p.
    const three: Sheet = { rows: [named("p"), named("q"), named("r")] };
    expect(moveRow(three, "p", "q", "after")).toBe(true);
    expect(three.rows.map((r) => r.id)).toEqual(["q", "p", "r"]);
  });
});

describe("calls to a script's functions", () => {
  it("are fitted to the function's parameters as they are now; the catalog's are left alone", () => {
    const grown: Action = { id: id(), type: "call", fn: "spawn", args: ["3"] };
    const shrunk: Action = { id: id(), type: "call", fn: "jump", args: ["1", "2"] };
    const catalog: Action = { id: id(), type: "call", fn: "camera_shake", args: [] };
    const sheet: Sheet = { rows: [row([], [grown, shrunk, catalog])] };
    expect(fitCalls(sheet, [{ name: "spawn", params: ["n", "kind"] }, { name: "jump", params: ["height"] }])).toBe(true);
    expect(sheetToPython(sheet).code).toBe("spawn(3, 0)\njump(1)\ncamera_shake()");
    expect(fitCalls(sheet, [{ name: "spawn", params: ["n", "kind"] }, { name: "jump", params: ["height"] }])).toBe(false);
  });
});

describe("renaming", () => {
  it("changes quoted names in every box, and a for-each's object", () => {
    const sub = (s: string) => s.replace(/"Coin"/g, '"Gem"');
    const sheet: Sheet = {
      rows: [
        { id: id(), kind: "foreach", object: "Coin", as: "c", children: [row([{ id: id(), type: "expr", code: 'instance_exists("Coin")' }], [{ id: id(), type: "call", fn: "instance_create", args: ["0", "0", '"Coin"'] }])] },
      ],
    };
    renameInSheet(sheet, "Coin", sub, "Gem");
    expect(sheetToPython(sheet).code).toBe(['for c in instances("Gem"):', '    if instance_exists("Gem"):', '        instance_create(0, 0, "Gem")'].join("\n"));
  });
});
