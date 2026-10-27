/**
 * Event sheets: rows of conditions → actions, GDevelop's way of writing
 * game logic, as a third way to write an event's body (beside Python and
 * blocks), and an instance's creation code.
 *
 * A sheet lives inside the object model rather than beside it. It is one
 * method's body, so its subject is `self`, the instance whose event is
 * running. Other instances are reached explicitly: a "for each" row names
 * one (`for e in instances("Enemy"):`) for the rows under it. That is how
 * GDevelop's hidden "picking" is done here, in the open, which is exactly
 * the loop students will write in Python later.
 *
 * Like blocks, a sheet is saved as plain JSON (`sheet`) and writes its
 * Python into `code` on every change. The game, error mapping and export
 * read only `code`. Everything here is pure — no React, no Blockly — so it
 * runs headless in the tests, and tutorial checks can read a sheet directly.
 *
 * Parameters are small Python expressions the student types: "self.x + 4",
 * "random.randint(1, 6)", "\"Coin\"". That makes a sheet a step between
 * blocks and Python, and every box is checked as it is typed (checkExpr).
 */
import { pythonLanguage } from "@codemirror/lang-python";
import { API, type ApiFunction, type Category, type Param } from "../catalog/api";

// ---------------------------------------------------------------- the format

export type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type SetOp = "=" | "+=" | "-=";

export type Condition =
  /** A function that answers True or False: keyboard_check("right"). */
  | { id: string; type: "call"; fn: string; args: string[]; not?: boolean }
  /** Two values compared: self.lives <= 0. */
  | { id: string; type: "compare"; left: string; op: CompareOp; right: string; not?: boolean }
  /** Any Python condition, typed. */
  | { id: string; type: "expr"; code: string; not?: boolean }
  /** GDevelop's "Trigger once": true the first step the rest is true, then not until it has been false. */
  | { id: string; type: "once" };

export type Action =
  /** A function called for what it does: camera_shake(), a script's spawn(3). */
  | { id: string; type: "call"; fn: string; args: string[] }
  /** self.x += 4, global_vars.score = 0, e.hspeed = 0. */
  | { id: string; type: "set"; target: string; op: SetOp; value: string }
  /** other.destroy(). */
  | { id: string; type: "destroy"; who: string }
  /** One line of Python, typed. */
  | { id: string; type: "code"; code: string };

export type Row =
  /** Conditions → actions, with rows under it that run only when it does. */
  | { id: string; kind: "event"; conditions: Condition[]; any?: boolean; actions: Action[]; children: Row[] }
  /** Otherwise: after an event row (or another else). With conditions, it is `elif`. */
  | { id: string; kind: "else"; conditions: Condition[]; any?: boolean; actions: Action[]; children: Row[] }
  /** The rows under it run once for each instance of an object, which they call `as`. */
  | { id: string; kind: "foreach"; object: string; as: string; children: Row[] }
  | { id: string; kind: "comment"; text: string };

export interface Sheet {
  rows: Row[];
}

export const emptySheet = (): Sheet => ({ rows: [] });
export const hasRows = (s: Sheet | undefined) => !!s?.rows.length;

// ---------------------------------------------------------------- the catalog, as conditions and actions

/** Functions that answer True or False: the condition picker. */
export const CONDITION_FUNCTIONS = API.filter((e): e is ApiFunction => e.kind === "function" && e.returns === "True or False");
/** Functions called for what they do: the action picker. */
export const ACTION_FUNCTIONS = API.filter((e): e is ApiFunction => e.kind === "function" && (e.returns === "nothing" || !!e.alsoStatement));

/** The pickers' order: input and collisions first, as conditions mostly are. */
export const PICKER_ORDER: Category[] = ["Input", "Collision", "Instances", "Motion", "Physics", "Drawing", "Sound", "Saving", "Rooms", "Camera", "Effects", "Debug"];

const NUMBER_DEFAULTS: Record<string, string> = { speed: "4", strength: "4", steps: "15", x2: "100", y2: "100" };

/**
 * What a parameter's box starts with: something that works as it is, as a
 * block's shadow does. `firstName` supplies a real object/sprite/room/layer
 * name when the project has one.
 */
export function defaultArg(p: Param, firstName: (kind: Param["type"]) => string | undefined = () => undefined): string {
  if (p.default !== undefined) return p.default;
  switch (p.type) {
    case "number":
      return NUMBER_DEFAULTS[p.name] ?? (p.name === "x" ? "self.x" : p.name === "y" ? "self.y" : "0");
    case "boolean":
      return "False";
    case "key":
      return '"right"';
    case "button":
      return '"left"';
    case "color":
      return '"white"';
    case "padbutton":
      return '"a"';
    case "axis":
      return '"left_x"';
    case "instance":
      return "self";
    case "object":
    case "sprite":
    case "room":
    case "layer":
    case "sound":
    case "font": {
      const n = firstName(p.type);
      return n ? JSON.stringify(n) : '""';
    }
    default:
      return p.name === "text" ? '"Hello"' : '""';
  }
}

// ---------------------------------------------------------------- checking what is typed

const COMPOUND = new Set(["IfStatement", "WhileStatement", "ForStatement", "TryStatement", "WithStatement", "FunctionDefinition", "ClassDefinition", "DecoratedStatement", "MatchStatement"]);

function topNodes(code: string): { names: string[]; error: boolean } {
  const tree = pythonLanguage.parser.parse(code);
  let error = false;
  tree.iterate({ enter: (n) => void (n.type.isError && (error = true)) });
  const names: string[] = [];
  for (let c = tree.topNode.firstChild; c; c = c.nextSibling) names.push(c.name);
  return { names, error };
}

/** Why `code` isn't one Python value or condition, or null when it is. */
export function checkExpr(code: string): string | null {
  if (!code.trim()) return "Needs a value.";
  if (code.includes("\n")) return "One line only.";
  const { names, error } = topNodes(code);
  if (error || names.length !== 1 || names[0] !== "ExpressionStatement") return "This isn't a Python value.";
  return null;
}

/** Why `code` isn't one simple line of Python (no if, for, def…: rows do those), or null when it is. */
export function checkLine(code: string): string | null {
  if (!code.trim()) return "Needs a line of Python.";
  if (code.includes("\n")) return "One line only.";
  const { names, error } = topNodes(code);
  if (error || names.length !== 1) return "This isn't a line of Python.";
  if (COMPOUND.has(names[0]!)) return "Use rows for if, for and while.";
  return null;
}

const IDENT = /^[A-Za-z_]\w*$/;

/** Every problem in a sheet, by the id of the row, condition or action it is in. */
export function sheetProblems(sheet: Sheet): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rows: Row[]) => {
    rows.forEach((r, i) => {
      if (r.kind === "comment") return;
      if (r.kind === "foreach") {
        if (!r.object) out.set(r.id, "Pick an object.");
        else if (!IDENT.test(r.as)) out.set(r.id, "The name for each one must be a Python name, like e.");
        return walk(r.children);
      }
      if (r.kind === "else") {
        const prev = rows[i - 1];
        if (!prev || (prev.kind !== "event" && prev.kind !== "else") || !prev.conditions.some((c) => c.type !== "once"))
          out.set(r.id, "An Else row goes straight after a row with conditions.");
      }
      for (const c of r.conditions) {
        const bad =
          c.type === "call" ? c.args.map(checkExpr).find((x) => x) :
          c.type === "compare" ? checkExpr(c.left) ?? checkExpr(c.right) :
          c.type === "expr" ? checkExpr(c.code) : null;
        if (bad) out.set(c.id, bad);
      }
      for (const a of r.actions) {
        const bad =
          a.type === "call" ? a.args.map(checkExpr).find((x) => x) :
          a.type === "set" ? checkExpr(a.target) ?? checkExpr(a.value) :
          a.type === "destroy" ? checkExpr(a.who) :
          checkLine(a.code);
        if (bad) out.set(a.id, bad);
      }
      walk(r.children);
    });
  };
  walk(sheet.rows);
  return out;
}

// ---------------------------------------------------------------- to Python

export interface SheetPython {
  code: string;
  /** For each line of `code`, the id of the row, condition or action that made it. */
  lines: string[];
}

/**
 * `name(a, b)`, leaving out optional arguments at the end that are still
 * their default (or empty), as a person writes it — camera_shake(), not
 * camera_shake(4, 15).
 */
function callCode(fn: string, args: string[]): string {
  const f = API.find((e): e is ApiFunction => e.kind === "function" && e.name === fn);
  const out = args.map((a) => a.trim());
  if (f)
    while (out.length) {
      const p = f.params[out.length - 1];
      if (p?.default === undefined || (out[out.length - 1] !== p.default && out[out.length - 1] !== "")) break;
      out.pop();
    }
  return `${fn}(${out.map((a) => a || "None").join(", ")})`;
}

/** A condition joined to others needs brackets if it has an and/or of its own. */
const LOOSE = /\b(and|or|if|lambda)\b/;

function conditionCode(c: Exclude<Condition, { type: "once" }>, joined: boolean): string {
  const not = "not" in c && c.not;
  if (c.type === "call") return `${not ? "not " : ""}${callCode(c.fn, c.args)}`;
  if (c.type === "compare") {
    const code = `${c.left.trim() || "None"} ${c.op} ${c.right.trim() || "None"}`;
    return not ? `not ${code}` : code;
  }
  const code = c.code.trim() || "True";
  if (not) return /^[\w.]+(\(.*\))?$/.test(code) ? `not ${code}` : `not (${code})`;
  return joined && LOOSE.test(code) ? `(${code})` : code;
}

function actionCode(a: Action): string {
  switch (a.type) {
    case "call":
      return callCode(a.fn, a.args);
    case "set":
      return `${a.target.trim() || "self.x"} ${a.op} ${a.value.trim() || "None"}`;
    case "destroy":
      return `${a.who.trim() || "self"}.destroy()`;
    case "code":
      return a.code.trim() || "pass";
  }
}

/** The `if` (or `elif`) test of an event or else row, or null when it has no conditions. */
function test(r: Extract<Row, { kind: "event" | "else" }>): string | null {
  const plain = r.conditions.filter((c): c is Exclude<Condition, { type: "once" }> => c.type !== "once");
  const joined = plain.length > 1;
  const parts = plain.map((c) => conditionCode(c, joined));
  // `or` joins looser than `and`: a part with its own `or`, joined by
  // `and`, would need brackets — conditionCode has given them already.
  const all = parts.join(r.any ? " or " : " and ");
  if (r.conditions.some((c) => c.type === "once")) return `self.once(${JSON.stringify(r.id.slice(0, 6))}, ${all || "True"})`;
  return all || null;
}

export function sheetToPython(sheet: Sheet): SheetPython {
  const lines: string[] = [];
  const map: string[] = [];
  const emit = (depth: number, text: string, id: string) => {
    lines.push("    ".repeat(depth) + text);
    map.push(id);
  };

  const rows = (list: Row[], depth: number) => {
    list.forEach((r, i) => {
      if (r.kind === "comment") {
        for (const t of r.text.split("\n")) emit(depth, `# ${t}`.trimEnd(), r.id);
        return;
      }
      if (r.kind === "foreach") {
        emit(depth, `for ${r.as || "e"} in instances(${JSON.stringify(r.object)}):`, r.id);
        body([], r.children, depth + 1, r.id);
        return;
      }
      const t = test(r);
      const prev = list[i - 1];
      const follows = r.kind === "else" && prev && (prev.kind === "event" || prev.kind === "else") && test(prev) !== null;
      if (follows) emit(depth, t ? `elif ${t}:` : "else:", r.id);
      else if (t) emit(depth, `if ${t}:`, r.id);
      else {
        // No conditions: the actions simply run, with no `if` around them.
        body(r.actions, r.children, depth, r.id, false);
        return;
      }
      body(r.actions, r.children, depth + 1, r.id);
    });
  };

  const body = (actions: Action[], children: Row[], depth: number, owner: string, needed = true) => {
    const before = lines.length;
    for (const a of actions) emit(depth, actionCode(a), a.id);
    rows(children, depth);
    // Comments alone are no body to Python.
    const real = lines.slice(before).some((l) => !l.trim().startsWith("#"));
    if (needed && !real) emit(depth, "pass", owner);
  };

  rows(sheet.rows, 0);
  return { code: lines.join("\n"), lines: map };
}

// ---------------------------------------------------------------- renaming

/**
 * Renaming a resource changes it in a sheet as project.replaceQuoted does in
 * code: `sub` (the same quoted-name replacement) on every typed box, and a
 * for-each row's object if it is exactly the name.
 */
export function renameInSheet(sheet: Sheet, from: string, sub: (code: string) => string, to: string) {
  const walk = (rows: Row[]) => {
    for (const r of rows) {
      if (r.kind === "comment") continue;
      if (r.kind === "foreach") {
        if (r.object === from) r.object = to;
        walk(r.children);
        continue;
      }
      for (const c of r.conditions) {
        if (c.type === "call") c.args = c.args.map(sub);
        else if (c.type === "compare") (c.left = sub(c.left)), (c.right = sub(c.right));
        else if (c.type === "expr") c.code = sub(c.code);
      }
      for (const a of r.actions) {
        if (a.type === "call") a.args = a.args.map(sub);
        else if (a.type === "set") (a.target = sub(a.target)), (a.value = sub(a.value));
        else if (a.type === "destroy") a.who = sub(a.who);
        else a.code = sub(a.code);
      }
      walk(r.children);
    }
  };
  walk(sheet.rows);
}

// ---------------------------------------------------------------- moving rows

/** Where a row is: the list holding it (the sheet's, or a row's children) and its place in it. */
export interface RowPlace {
  list: Row[];
  index: number;
}

export function findRow(rows: Row[], id: string): RowPlace | null {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.id === id) return { list: rows, index: i };
    if (r.kind !== "comment") {
      const inner = findRow(r.children, id);
      if (inner) return inner;
    }
  }
  return null;
}

/** Where a dragged row goes: before or after another row, inside it (its last sub-event), or at the end of the sheet. */
export type DropWhere = "before" | "after" | "inside";

/** Could row `id` be dropped there? Not on itself, not into its own sub-events, not inside a comment. */
export function canDrop(sheet: Sheet, id: string, target: string | null, where: DropWhere): boolean {
  const from = findRow(sheet.rows, id);
  if (!from) return false;
  if (target === null) return true;
  if (target === id) return false;
  const row = from.list[from.index]!;
  if (row.kind !== "comment" && findRow(row.children, target)) return false;
  const to = findRow(sheet.rows, target);
  if (!to) return false;
  return where !== "inside" || to.list[to.index]!.kind !== "comment";
}

/**
 * Moves a row (with its sub-events) by drag and drop. `target` null means
 * the end of the sheet. Returns whether it moved; a drop canDrop refuses
 * changes nothing.
 */
export function moveRow(sheet: Sheet, id: string, target: string | null, where: DropWhere): boolean {
  if (!canDrop(sheet, id, target, where)) return false;
  const from = findRow(sheet.rows, id)!;
  const [row] = from.list.splice(from.index, 1);
  if (target === null) {
    sheet.rows.push(row!);
    return true;
  }
  // Found again: taking the row out may have moved the target up one.
  const to = findRow(sheet.rows, target)!;
  const t = to.list[to.index]!;
  if (where === "inside" && t.kind !== "comment") t.children.push(row!);
  else to.list.splice(to.index + (where === "after" ? 1 : 0), 0, row!);
  return true;
}

/**
 * Fits calls to the scripts' functions to their parameters as they are now
 * — a box added for a new parameter (starting at 0), the box of a removed
 * one taken away — as call blocks are refitted when they load. Without it,
 * a function that gained a parameter showed a box for it while the Python
 * left the argument out, and the call failed in the game. Catalog functions
 * are left alone; their optional parameters are meant to be left empty.
 * Returns whether anything changed.
 */
export function fitCalls(sheet: Sheet, functions: { name: string; params: string[] }[]): boolean {
  let changed = false;
  const fit = (item: Condition | Action) => {
    if (item.type !== "call" || API.some((e) => e.name === item.fn)) return;
    const f = functions.find((x) => x.name === item.fn);
    if (!f || f.params.length === item.args.length) return;
    item.args = f.params.map((_, i) => item.args[i] ?? "0");
    changed = true;
  };
  const walk = (rows: Row[]) => {
    for (const r of rows) {
      if (r.kind === "comment") continue;
      if (r.kind !== "foreach") [...r.conditions, ...r.actions].forEach(fit);
      walk(r.children);
    }
  };
  walk(sheet.rows);
  return changed;
}

/** Every row, condition and action id in a sheet, to find which row a line's id belongs to. */
export function rowOf(sheet: Sheet, id: string): Row | null {
  let found: Row | null = null;
  const walk = (rows: Row[]) => {
    for (const r of rows) {
      if (found) return;
      if (r.id === id) return void (found = r);
      if (r.kind === "event" || r.kind === "else") {
        if (r.conditions.some((c) => c.id === id) || r.actions.some((a) => a.id === id)) return void (found = r);
      }
      if (r.kind !== "comment") walk(r.children);
    }
  };
  walk(sheet.rows);
  return found;
}
