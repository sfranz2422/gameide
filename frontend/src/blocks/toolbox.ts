/**
 * The block palette: categories down the side, in the spec's order, each
 * filled from the catalog plus a few hand-made blocks. Every input starts
 * with a sensible value already in it (a "shadow"), so a block dragged out
 * works at once and the student only changes what they need to.
 */
import type * as Blockly from "blockly/core";
import { API, type Category } from "../catalog/api";
import type { BlocksKind } from "./blockState";
import { blockNames, blocksFor, COLOURS, functionBlock, shadowFor, statementBlock, variableBlock } from "./catalogBlocks";

type Item = Record<string, unknown>;
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const shadow = (type: string, fields?: Record<string, unknown>) => ({ shadow: fields ? { type, fields } : { type } });

/** Each catalog entry's blocks, with their inputs filled. */
function catalogItems(category: Category): Item[] {
  const out: Item[] = [];
  for (const e of API) {
    if (e.category !== category || e.kind === "variable" && e.name === "global_vars") continue;
    if (e.kind === "variable") {
      out.push({ kind: "block", type: variableBlock(e) });
      continue;
    }
    const inputs = Object.fromEntries(e.params.map((p) => [p.name, { shadow: shadowFor(p) }]));
    for (const type of blocksFor(e)) out.push({ kind: "block", type, inputs });
  }
  return out;
}

const prop = (type: "gm_prop_set" | "gm_prop_change" | "gm_prop_get", name: string, value?: number) => ({
  kind: "block",
  type,
  fields: { PROP: name },
  ...(value === undefined ? {} : { inputs: { [type === "gm_prop_set" ? "TO" : "BY"]: num(value) } }),
});
const label = (text: string) => ({ kind: "label", text });

/**
 * Blocks that need `self` — this instance's properties, "my" variables,
 * alarms, `other`. A script's functions have no instance of their own, so
 * its palette leaves these out, and an input that would start as `self`
 * starts empty instead (the function's caller passes the instance).
 */
const NEEDS_SELF = new Set(["gm_prop_get", "gm_prop_set", "gm_prop_change", "gm_self", "gm_other", "gm_alarm_set", "gm_my_get", "gm_my_set", "gm_my_change"]);

function withoutSelf(items: Item[]): Item[] {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      const t = (v as { type?: string } | null)?.type;
      if (k === "shadow" && t && NEEDS_SELF.has(t)) continue;
      out[k] = strip(v);
    }
    return out;
  };
  return items.filter((i) => !NEEDS_SELF.has(i["type"] as string)).map((i) => strip(i) as Item);
}

export function toolbox(kind: BlocksKind = "event"): Blockly.utils.toolbox.ToolboxDefinition {
  const category = (name: string, colour: string, contents: Item[]) => ({
    kind: "category",
    name,
    colour,
    contents: kind === "script" ? withoutSelf(contents) : contents,
  });
  const functions = { kind: "category", name: "Functions", colour: COLOURS.Functions, custom: "GAMEIDE_FUNCTIONS" };
  return {
    kind: "categoryToolbox",
    contents: [
      // A script is functions: making one comes first. (Blockly's own
      // category: define, return, and calls to this script's functions.)
      ...(kind === "script" ? [{ kind: "category", name: "Make a function", colour: COLOURS.Functions, custom: "PROCEDURE" }] : []),
      category("Motion", COLOURS.Motion, [
        prop("gm_prop_change", "x", 4),
        prop("gm_prop_change", "y", 4),
        prop("gm_prop_set", "x", 0),
        prop("gm_prop_set", "hspeed", 2),
        prop("gm_prop_set", "vspeed", 2),
        prop("gm_prop_set", "direction", 90),
        prop("gm_prop_set", "speed", 4),
        prop("gm_prop_get", "x"),
        prop("gm_prop_get", "y"),
        ...catalogItems("Motion"),
      ]),
      category("Physics", COLOURS.Physics, [
        { kind: "block", type: "gm_prop_set", fields: { PROP: "physics" }, inputs: { TO: shadow("logic_boolean", { BOOL: "TRUE" }) } },
        prop("gm_prop_set", "bounce", 0.5),
        prop("gm_prop_set", "weight", 1),
        prop("gm_prop_set", "friction", 0.3),
        prop("gm_prop_set", "spin", 5),
        { kind: "block", type: "gm_prop_set", fields: { PROP: "fixed" }, inputs: { TO: shadow("logic_boolean", { BOOL: "TRUE" }) } },
        ...catalogItems("Physics"),
      ]),
      category("Instances", COLOURS.Instances, [
        { kind: "block", type: "gm_self" },
        { kind: "block", type: "gm_other" },
        { kind: "block", type: "gm_destroy", inputs: { WHO: shadow("gm_self") } },
        { kind: "block", type: "gm_of_get", fields: { PROP: "x" }, inputs: { OF: shadow("gm_other") } },
        { kind: "block", type: "gm_of_set", fields: { PROP: "visible" }, inputs: { OF: shadow("gm_other"), TO: shadow("logic_boolean", { BOOL: "FALSE" }) } },
        { kind: "block", type: "gm_alarm_set", inputs: { STEPS: num(60) } },
        ...catalogItems("Instances"),
      ]),
      category("Collision", COLOURS.Collision, catalogItems("Collision")),
      category("Input", COLOURS.Input, catalogItems("Input")),
      // Filled when opened (variablesFlyout), so local variables made since show up.
      { kind: "category", name: "Variables", colour: COLOURS.Variables, custom: "GAMEIDE_VARIABLES" },
      category("Logic", COLOURS.Logic, [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "controls_if", extraState: { hasElse: true } },
        { kind: "block", type: "logic_compare", inputs: { A: num(0), B: num(0) } },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "logic_null" },
        { kind: "block", type: "logic_ternary" },
      ]),
      category("Loops", COLOURS.Loops, [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: num(10) } },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for", fields: { VAR: { name: "i" } }, inputs: { FROM: num(1), TO: num(10), BY: num(1) } },
        {
          kind: "block",
          type: "controls_forEach",
          fields: { VAR: { name: "e" } },
          inputs: { LIST: { block: { type: "gm_fn_instances", inputs: { obj: shadow("gm_object") } } } },
        },
        { kind: "block", type: "controls_flow_statements" },
      ]),
      category("Math", COLOURS.Math, [
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "math_arithmetic", inputs: { A: num(1), B: num(1) } },
        { kind: "block", type: "math_single", inputs: { NUM: num(9) } },
        { kind: "block", type: "math_round", inputs: { NUM: num(3.1) } },
        { kind: "block", type: "math_modulo", inputs: { DIVIDEND: num(10), DIVISOR: num(3) } },
        { kind: "block", type: "math_constrain", inputs: { VALUE: num(50), LOW: num(0), HIGH: num(100) } },
        { kind: "block", type: "math_random_int", inputs: { FROM: num(1), TO: num(6) } },
        { kind: "block", type: "math_random_float" },
      ]),
      category("Text", COLOURS.Text, [
        { kind: "block", type: "text" },
        { kind: "block", type: "text_join", extraState: { itemCount: 2 }, inputs: { ADD0: shadow("text", { TEXT: "Score: " }) } },
        { kind: "block", type: "text_length", inputs: { VALUE: shadow("text", { TEXT: "abc" }) } },
      ]),
      category("Drawing", COLOURS.Drawing, [
        ...catalogItems("Drawing"),
        prop("gm_prop_set", "image_xscale", -1),
        prop("gm_prop_set", "image_angle", 0),
        prop("gm_prop_change", "image_angle", 5),
        prop("gm_prop_set", "image_alpha", 1),
        prop("gm_prop_set", "image_speed", 1),
      ]),
      category("Rooms", COLOURS.Rooms, catalogItems("Rooms")),
      category("Camera", COLOURS.Camera, catalogItems("Camera")),
      category("Effects", COLOURS.Effects, catalogItems("Effects")),
      category("Sound", COLOURS.Sound, catalogItems("Sound")),
      category("Saving", COLOURS.Saving, catalogItems("Saving")),
      category("Debug", COLOURS.Debug, [{ kind: "block", type: "text_print", inputs: { TEXT: shadow("text", { TEXT: "Hello" }) } }, ...catalogItems("Debug")]),
      functions,
    ],
  };
}

/**
 * The Functions category: a call block for each function the project's
 * scripts define (in a script's own palette, the other scripts' — its own
 * are under Make a function). Filled when opened, so a function written a
 * moment ago in another tab is there.
 */
export function functionsFlyout(): Item[] {
  const fns = blockNames().functions;
  if (!fns.length) return [label("No functions yet. Make one in a script — typed, or with blocks.")];
  return fns.flatMap((f) => {
    const block = { fields: { FN: f.name }, extraState: { params: f.params }, inputs: Object.fromEntries(f.params.map((_, i) => [`ARG${i}`, num(0)])) };
    return [
      { kind: "block", type: "gm_call_do", ...block },
      { kind: "block", type: "gm_call_get", ...block },
    ];
  });
}

/** The Variables category: "my" and global variables, then local ones (Blockly's). */
export function variablesFlyout(ws: Blockly.Workspace, kind: BlocksKind = "event"): Item[] {
  const locals = ws.getVariableMap().getAllVariables().map((v) => v.getName());
  const items: Item[] = [
    { kind: "block", type: "gm_my_set", inputs: { TO: num(3) } },
    { kind: "block", type: "gm_my_change", inputs: { BY: num(-1) } },
    { kind: "block", type: "gm_my_get" },
    { kind: "block", type: "gm_global_set", inputs: { TO: num(0) } },
    { kind: "block", type: "gm_global_change", inputs: { BY: num(1) } },
    { kind: "block", type: "gm_global_get" },
    label("Local: only inside this event"),
    { kind: "button", text: "Make a local variable", callbackkey: "CREATE_VARIABLE" },
    ...locals.flatMap((name) => [
      { kind: "block", type: "variables_set", fields: { VAR: { name } }, inputs: { VALUE: num(0) } },
      { kind: "block", type: "gm_local_change", fields: { VAR: { name } }, inputs: { BY: num(1) } },
      { kind: "block", type: "variables_get", fields: { VAR: { name } } },
    ]),
  ];
  return kind === "script" ? withoutSelf(items) : items;
}

/** Every block type the palette can offer, for the tests. */
export const CALL_BLOCKS = ["gm_call_do", "gm_call_get"];
export const VARIABLE_BLOCKS = ["gm_my_set", "gm_my_change", "gm_my_get", "gm_global_set", "gm_global_change", "gm_global_get", "variables_set", "gm_local_change", "variables_get"];
export { functionBlock, statementBlock };
