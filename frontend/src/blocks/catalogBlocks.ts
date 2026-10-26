/**
 * The code blocks: what each one looks like and the Python it writes, side
 * by side so the two can't drift apart.
 *
 * Most of them are made from the API catalog (catalog/api.ts), one per
 * function and variable, so a function added to the catalog and the runtime
 * becomes a block with no work here — blocks.test.ts checks every catalog
 * entry has one and that its Python really runs. The rest are written by
 * hand: properties (self.x), the student's own variables, self and other,
 * and the event's hat.
 *
 * The Python must be what a good student would type, because students learn
 * from it: `self.x += 4`, `keyboard_check("left")`, no defensive clutter,
 * optional arguments left out while they're still the default.
 *
 * Nothing here touches the page, so the same definitions load in a headless
 * workspace (python.ts, and the tests).
 */
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as En from "blockly/msg/en";
import { Order, type PythonGenerator } from "blockly/python";
import { API, PROPERTIES, type ApiFunction, type ApiVariable, type Category, type Param } from "../catalog/api";
import { KEY_NAMES, MOUSE_BUTTONS, PAD_AXES, PAD_BUTTONS } from "../engine/layout";
import { NAME_FIELD_BLOCKS, type ScriptFunction } from "./blockState";

/** The project's names, for the object/sprite/room/layer dropdowns. Set by the editor; empty when headless. */
export interface BlockNames {
  objects: string[];
  sprites: string[];
  rooms: string[];
  layers: string[];
  sounds?: string[];
  fonts?: string[];
  /** Functions the project's scripts define, for the call blocks. */
  functions: ScriptFunction[];
}
let currentNames: () => BlockNames = () => ({ objects: [], sprites: [], rooms: [], layers: [], functions: [] });
export function setBlockNames(get: () => BlockNames) {
  currentNames = get;
}
export const blockNames = () => currentNames();

/**
 * Category colours, after Scratch's: blue motion, orange variables, gold
 * control, green operators. Students who used Scratch or MakeCode find
 * things where their eye expects them.
 */
export const COLOURS: Record<Category | "Variables" | "Logic" | "Loops" | "Math" | "Text" | "Events" | "Functions", string> = {
  Motion: "#4C97FF",
  Instances: "#D65CD6",
  Collision: "#0FBD8C",
  Input: "#5CB1D6",
  Drawing: "#9966FF",
  Rooms: "#5562D9",
  Camera: "#2E7FA8",
  Sound: "#CF63CF", // Scratch's Sound
  Saving: "#8D6E63",
  Debug: "#7A8699",
  Variables: "#FF8C1A",
  Logic: "#FFAB19",
  Loops: "#E09A0B",
  Math: "#59C059",
  Text: "#3FB6B2",
  Events: "#FFBF00",
  Functions: "#FF6680", // Scratch's My Blocks
};

// blockly/core comes with no words: the standard blocks' labels are looked
// up in Msg, and without a locale they come out empty, which Blockly
// rejects when the block is made.
Blockly.setLocale(En as unknown as Record<string, string>);
// Python's spelling on the standard blocks, not JavaScript's: the block says
// what the code beside it says.
Blockly.Msg["LOGIC_BOOLEAN_TRUE"] = "True";
Blockly.Msg["LOGIC_BOOLEAN_FALSE"] = "False";
Blockly.Msg["LOGIC_NULL"] = "None";
Blockly.Msg["LOGIC_OPERATION_AND"] = "and";
Blockly.Msg["LOGIC_OPERATION_OR"] = "or";
Blockly.Msg["LOGIC_NEGATE_TITLE"] = "not %1";
Blockly.Msg["TEXT_PRINT_TITLE"] = "print %1";
// Functions, as Python says it: "def jump(height)", not "to jump with: height".
Blockly.Msg["PROCEDURES_DEFNORETURN_TITLE"] = "def";
Blockly.Msg["PROCEDURES_DEFRETURN_TITLE"] = "def";
Blockly.Msg["PROCEDURES_DEFNORETURN_PROCEDURE"] = "my_function";
Blockly.Msg["PROCEDURES_DEFRETURN_PROCEDURE"] = "my_function";
Blockly.Msg["PROCEDURES_BEFORE_PARAMS"] = "with";
Blockly.Msg["PROCEDURES_CALL_BEFORE_PARAMS"] = "with";
Blockly.Msg["PROCEDURES_DEFNORETURN_DO"] = "";
// Blockly gives a new function the comment "Describe this function...",
// which would turn up in the Python as a comment nobody wrote.
Blockly.Msg["PROCEDURES_DEFNORETURN_COMMENT"] = "";
Blockly.Msg["PROCEDURES_DEFRETURN_COMMENT"] = "";

/** Dropdown value for "nothing chosen" (None). A leading space: no name can start with one. */
export const NONE = " none";

/**
 * A dropdown of the project's names. It accepts any name on load, even one
 * no longer in the project: Blockly's own dropdown silently swaps an unknown
 * value for its first option, which would quietly change "Coin" into
 * "Enemy" in a saved project after Coin was deleted. Kept as typed, the game
 * says "there's no object called Coin" instead, which a student can act on.
 */
class NameDropdown extends Blockly.FieldDropdown {
  protected override doClassValidation_(value?: string): string | null {
    return typeof value === "string" ? value : null;
  }
}

function nameField(kind: "objects" | "sprites" | "rooms" | "layers" | "sounds" | "fonts", none: string | null, alsoLayers = false) {
  return new NameDropdown(function (this: Blockly.FieldDropdown) {
    const n = currentNames();
    const options: [string, string][] = (n[kind] ?? []).map((x) => [x, x]);
    if (alsoLayers) for (const l of n.layers) options.push([`layer ${l}`, l]);
    const value = this.getValue();
    if (value && value !== NONE && !options.some((o) => o[1] === value)) options.push([value, value]);
    if (none !== null) options.unshift([none, NONE]);
    if (!options.length) options.push([`(no ${kind} yet)`, ""]);
    return options;
  });
}

/** A text box that keeps a valid Python name: "high score" becomes high_score. */
function pythonName(initial: string) {
  return new Blockly.FieldTextInput(initial, (text: string) => {
    let s = text.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
    if (/^[0-9]/.test(s)) s = `_${s}`;
    return s || null;
  });
}

type Gen = PythonGenerator;
type ForBlock = (block: Blockly.Block, g: Gen) => string | [string, number] | null;
const generators: Record<string, ForBlock> = {};

function define(type: string, init: (this: Blockly.Block) => void, python: ForBlock) {
  Blockly.Blocks[type] = { init };
  generators[type] = python;
}

const quote = (g: Gen, s: string) => g.quote_(s);
const arg = (b: Blockly.Block, g: Gen, input: string, order: number = Order.NONE) => g.valueToCode(b, input, order) || "None";

// ---------------------------------------------------------------- the event hat

/**
 * Every event's blocks hang under one hat that can't be deleted, showing the
 * method they become: `def on_step(self):`. Only blocks attached under it
 * are code; a loose one is greyed out and left out, as in Scratch.
 */
define(
  "gm_event",
  function () {
    // The editor puts the real words here: "def on_step(self):", or what
    // creation code is. Labels aren't saved, so they can never go stale.
    this.appendDummyInput().appendField("def on_event(self):", "SIG");
    this.appendStatementInput("BODY");
    this.setColour(COLOURS.Events);
    this.setDeletable(false);
    this.setTooltip("The code under here runs whenever this event happens.");
  },
  () => "", // python.ts generates the body itself
);

// ---------------------------------------------------------------- name and value pickers (shadows)

const pick = (type: string, colour: string, field: () => Blockly.Field, python: (v: string, g: Gen) => string, tooltip: string) =>
  define(
    type,
    function () {
      this.appendDummyInput().appendField(field(), "NAME");
      this.setOutput(true, null);
      this.setColour(colour);
      this.setTooltip(tooltip);
    },
    (b, g) => [python(b.getFieldValue("NAME") as string, g), Order.ATOMIC],
  );
const nameOrNone = (v: string, g: Gen) => (v === NONE ? "None" : quote(g, v));

pick("gm_object", COLOURS.Instances, () => nameField("objects", null, true), nameOrNone, "An object (or a tile layer, for collisions).");
pick("gm_object_any", COLOURS.Instances, () => nameField("objects", "anything solid", true), nameOrNone, "An object or tile layer — or anything solid.");
pick("gm_sprite", COLOURS.Drawing, () => nameField("sprites", null), nameOrNone, "A sprite.");
pick("gm_room", COLOURS.Rooms, () => nameField("rooms", null), nameOrNone, "A room.");
pick("gm_layer", COLOURS.Collision, () => nameField("layers", null), nameOrNone, "A tile layer.");
pick("gm_layer_any", COLOURS.Collision, () => nameField("layers", "the top tile layer"), nameOrNone, "A tile layer, or the top one.");
pick("gm_sound", COLOURS.Sound, () => nameField("sounds", null), nameOrNone, "A sound from the Sounds folder.");
pick("gm_sound_any", COLOURS.Sound, () => nameField("sounds", "every sound"), nameOrNone, "A sound — or every sound.");
pick("gm_font", COLOURS.Drawing, () => nameField("fonts", "the built-in font"), nameOrNone, "A font from the Fonts folder, or the built-in one.");
pick("gm_padbutton", COLOURS.Input, () => new Blockly.FieldDropdown(PAD_BUTTONS.map((k) => [k, k])), (v, g) => quote(g, v), "A gamepad button.");
pick("gm_axis", COLOURS.Input, () => new Blockly.FieldDropdown(PAD_AXES.map((k) => [k, k])), (v, g) => quote(g, v), "A gamepad stick's direction.");
pick("gm_key", COLOURS.Input, () => new Blockly.FieldDropdown(KEY_NAMES.map((k) => [k, k])), (v, g) => quote(g, v), "A key.");
pick("gm_button", COLOURS.Input, () => new Blockly.FieldDropdown(MOUSE_BUTTONS.map((k) => [k, k])), (v, g) => quote(g, v), "A mouse button.");
const COLOR_NAMES = ["white", "black", "red", "orange", "yellow", "green", "blue", "purple", "pink", "gray"];
pick("gm_color", COLOURS.Drawing, () => new Blockly.FieldDropdown(COLOR_NAMES.map((k) => [k, k])), (v, g) => quote(g, v), "A colour. A text block works too: \"#ff8800\".");

define(
  "gm_self",
  function () {
    this.appendDummyInput().appendField("self");
    this.setOutput(true, null);
    this.setColour(COLOURS.Instances);
    this.setTooltip("This instance: the one whose event is running.");
  },
  () => ["self", Order.ATOMIC],
);
define(
  "gm_other",
  function () {
    this.appendDummyInput().appendField("other");
    this.setOutput(true, null);
    this.setColour(COLOURS.Instances);
    this.setTooltip("In a collision event: the instance it bumped into.");
  },
  () => ["other", Order.ATOMIC],
);

// ---------------------------------------------------------------- the catalog

const NUMBER_DEFAULTS: Record<string, number> = { speed: 4, strength: 4, steps: 15, x2: 100, y2: 100 };

/** The block a parameter starts with in the toolbox: a value the student can change, or replace with another block. */
export function shadowFor(p: Param): { type: string; fields?: Record<string, unknown> } {
  switch (p.type) {
    case "number":
      if (p.default === "None") return { type: "logic_null" };
      return { type: "math_number", fields: { NUM: p.default !== undefined ? Number(p.default) : (NUMBER_DEFAULTS[p.name] ?? 0) } };
    case "boolean":
      return { type: "logic_boolean", fields: { BOOL: p.default === "True" ? "TRUE" : "FALSE" } };
    case "object":
      return { type: p.default === "None" ? "gm_object_any" : "gm_object" };
    case "sprite":
      return { type: "gm_sprite" };
    case "room":
      return { type: "gm_room" };
    case "layer":
      return { type: p.default === "None" ? "gm_layer_any" : "gm_layer" };
    case "key":
      return { type: "gm_key", fields: { NAME: "right" } };
    case "button":
      return { type: "gm_button", fields: { NAME: p.default ? JSON.parse(p.default) : "left" } };
    case "color":
      return { type: "gm_color", fields: { NAME: "white" } };
    case "sound":
      return { type: p.default === "None" ? "gm_sound_any" : "gm_sound" };
    case "font":
      return { type: "gm_font" };
    case "padbutton":
      return { type: "gm_padbutton", fields: { NAME: "a" } };
    case "axis":
      return { type: "gm_axis", fields: { NAME: "left_x" } };
    case "instance":
      return { type: "gm_self" };
    default:
      return { type: "text", fields: { TEXT: p.name === "text" ? "Hello" : "" } };
  }
}

export const functionBlock = (f: ApiFunction) => `gm_fn_${f.name}`; // gives a value
export const statementBlock = (f: ApiFunction) => `gm_do_${f.name}`; // a step of its own
export const variableBlock = (v: ApiVariable) => `gm_var_${v.name}`;

/** The block types made for one catalog entry. */
export function blocksFor(e: ApiFunction | ApiVariable): string[] {
  if (e.kind === "variable") return e.name === "global_vars" ? ["gm_global_get", "gm_global_set", "gm_global_change"] : [variableBlock(e)];
  const out: string[] = [];
  if (e.returns !== "nothing") out.push(functionBlock(e));
  if (e.returns === "nothing" || e.alsoStatement) out.push(statementBlock(e));
  return out;
}

/**
 * `name(a, b)`, leaving out optional arguments at the end that are still
 * their default shadow — `camera_shake()`, not `camera_shake(4, 15)` —
 * because that's how a person writes it.
 */
function callCode(f: ApiFunction, b: Blockly.Block, g: Gen): string {
  const args = f.params.map((p) => {
    const code = arg(b, g, p.name);
    const target = b.getInputTargetBlock(p.name);
    const isDefault = p.default !== undefined && (!target || target.isShadow()) && code === p.default;
    return { code, isDefault };
  });
  while (args.length && args[args.length - 1]!.isDefault) args.pop();
  return `${f.name}(${args.map((a) => a.code).join(", ")})`;
}

function defineFunction(f: ApiFunction, statement: boolean) {
  define(
    statement ? statementBlock(f) : functionBlock(f),
    function () {
      this.appendDummyInput().appendField(f.name);
      for (const p of f.params) this.appendValueInput(p.name).appendField(p.name);
      this.setInputsInline(true);
      if (statement) {
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
      } else this.setOutput(true, null);
      this.setColour(COLOURS[f.category]);
      this.setTooltip(`${f.description}\nGives back: ${f.returns}.`);
    },
    (b, g) => (statement ? `${callCode(f, b, g)}\n` : [callCode(f, b, g), Order.FUNCTION_CALL]),
  );
}

for (const e of API) {
  if (e.kind === "variable") {
    if (e.name === "global_vars") continue; // the Variables category's global blocks
    define(
      variableBlock(e),
      function () {
        this.appendDummyInput().appendField(e.name);
        this.setOutput(true, null);
        this.setColour(COLOURS[e.category]);
        this.setTooltip(e.description);
      },
      () => [e.name, Order.ATOMIC],
    );
    continue;
  }
  if (e.returns !== "nothing") defineFunction(e, false);
  if (e.returns === "nothing" || e.alsoStatement) defineFunction(e, true);
}

// ---------------------------------------------------------------- properties

/** Built-in properties a block can set: not object_name (read-only). */
// Not alarm (its own block) or once (a method, for event sheets).
const SETTABLE = PROPERTIES.filter((p) => !["object_name", "alarm", "once"].includes(p.name)).map((p) => p.name);
const READABLE = PROPERTIES.filter((p) => !["alarm", "once"].includes(p.name)).map((p) => p.name);
const propField = (names: string[]) => new Blockly.FieldDropdown(names.map((n) => [n, n]));
const propTip = (b: Blockly.Block) => () => PROPERTIES.find((p) => p.name === b.getFieldValue("PROP"))?.description ?? "";

/** `+= 4`, or `-= 4` when the amount is a plain negative number: what a person would write. */
function changeBy(target: string, b: Blockly.Block, g: Gen): string {
  const by = b.getInputTargetBlock("BY");
  if (by?.type === "math_number" && Number(by.getFieldValue("NUM")) < 0) return `${target} -= ${-Number(by.getFieldValue("NUM"))}\n`;
  return `${target} += ${arg(b, g, "BY", Order.ADDITIVE)}\n`;
}

const statementShape = (b: Blockly.Block, colour: string) => {
  b.setPreviousStatement(true, null);
  b.setNextStatement(true, null);
  b.setInputsInline(true);
  b.setColour(colour);
};

define(
  "gm_prop_get",
  function () {
    this.appendDummyInput().appendField(propField(READABLE), "PROP");
    this.setOutput(true, null);
    this.setColour(COLOURS.Motion);
    this.setTooltip(propTip(this));
  },
  (b) => [`self.${b.getFieldValue("PROP")}`, Order.MEMBER],
);
define(
  "gm_prop_set",
  function () {
    this.appendValueInput("TO").appendField("set").appendField(propField(SETTABLE), "PROP").appendField("to");
    statementShape(this, COLOURS.Motion);
    this.setTooltip(propTip(this));
  },
  (b, g) => `self.${b.getFieldValue("PROP")} = ${arg(b, g, "TO")}\n`,
);
define(
  "gm_prop_change",
  function () {
    this.appendValueInput("BY").appendField("change").appendField(propField(SETTABLE), "PROP").appendField("by");
    statementShape(this, COLOURS.Motion);
    this.setTooltip(propTip(this));
  },
  (b, g) => changeBy(`self.${b.getFieldValue("PROP")}`, b, g),
);
define(
  "gm_of_get",
  function () {
    this.appendValueInput("OF").appendField(propField(READABLE), "PROP").appendField("of");
    this.setInputsInline(true);
    this.setOutput(true, null);
    this.setColour(COLOURS.Instances);
    this.setTooltip("A property of another instance: other.x, e.hspeed.");
  },
  (b, g) => [`${arg(b, g, "OF", Order.MEMBER)}.${b.getFieldValue("PROP")}`, Order.MEMBER],
);
define(
  "gm_of_set",
  function () {
    this.appendValueInput("OF").appendField("set").appendField(propField(SETTABLE), "PROP").appendField("of");
    this.appendValueInput("TO").appendField("to");
    statementShape(this, COLOURS.Instances);
    this.setTooltip("Changes a property of another instance: other.visible = False.");
  },
  (b, g) => `${arg(b, g, "OF", Order.MEMBER)}.${b.getFieldValue("PROP")} = ${arg(b, g, "TO")}\n`,
);
define(
  "gm_destroy",
  function () {
    this.appendValueInput("WHO").appendField("destroy");
    statementShape(this, COLOURS.Instances);
    this.setTooltip("Removes an instance from the game. Its Destroy event runs first.");
  },
  (b, g) => `${arg(b, g, "WHO", Order.MEMBER)}.destroy()\n`,
);
define(
  "gm_alarm_set",
  function () {
    this.appendValueInput("STEPS")
      .appendField("set alarm")
      .appendField(new Blockly.FieldDropdown(Array.from({ length: 12 }, (_, i) => [String(i), String(i)])), "N")
      .appendField("to");
    statementShape(this, COLOURS.Instances);
    this.setTooltip("Counts down this many steps, then runs the Alarm event with the same number.");
  },
  (b, g) => `self.alarm[${b.getFieldValue("N")}] = ${arg(b, g, "STEPS")}\n`,
);

// ---------------------------------------------------------------- the student's own variables

/**
 * "my" variables live on the instance (self.lives), and keep their value
 * from one step to the next — what students almost always mean. Global ones
 * (global_vars.score) are shared by every object. Blockly's own variables
 * would be method locals, gone at the end of the event, so they are offered
 * only as "local" for loops and working values.
 */
function ownVariable(prefix: string, label: string, initial: string, colour: string, tooltip: string) {
  const id = prefix === "self" ? "my" : "global";
  define(
    `gm_${id}_get`,
    function () {
      this.appendDummyInput().appendField(label).appendField(pythonName(initial), "NAME");
      this.setOutput(true, null);
      this.setColour(colour);
      this.setTooltip(tooltip);
    },
    (b) => [`${prefix}.${b.getFieldValue("NAME")}`, Order.MEMBER],
  );
  define(
    `gm_${id}_set`,
    function () {
      this.appendValueInput("TO").appendField("set").appendField(label).appendField(pythonName(initial), "NAME").appendField("to");
      statementShape(this, colour);
      this.setTooltip(tooltip);
    },
    (b, g) => `${prefix}.${b.getFieldValue("NAME")} = ${arg(b, g, "TO")}\n`,
  );
  define(
    `gm_${id}_change`,
    function () {
      this.appendValueInput("BY").appendField("change").appendField(label).appendField(pythonName(initial), "NAME").appendField("by");
      statementShape(this, colour);
      this.setTooltip(tooltip);
    },
    (b, g) => changeBy(`${prefix}.${b.getFieldValue("NAME")}`, b, g),
  );
}
ownVariable("self", "my", "lives", COLOURS.Variables, "A variable of this instance (self.lives). Each instance has its own, and it keeps its value between steps.");
ownVariable("global_vars", "global", "score", COLOURS.Variables, "A variable every object shares (global_vars.score).");

define(
  "gm_local_change",
  function () {
    this.appendValueInput("BY").appendField("change").appendField(new Blockly.FieldVariable("i"), "VAR").appendField("by");
    statementShape(this, COLOURS.Variables);
    this.setTooltip("Adds to a local variable.");
  },
  (b, g) => changeBy(g.getVariableName(b.getFieldValue("VAR") as string), b, g),
);

// ---------------------------------------------------------------- joining text

/**
 * Joining text writes an f-string, as the templates do —
 * f"Score: {global_vars.score}" — instead of Blockly's
 * str("Score: ") + str(global_vars.score). Text typed into the join goes in
 * as it is (braces doubled, so they stay braces); anything else goes in {}.
 */
generators["text_join"] = (b, g) => {
  const parts: { text?: string; code?: string }[] = [];
  for (let i = 0; b.getInput(`ADD${i}`); i++) {
    const t = b.getInputTargetBlock(`ADD${i}`);
    if (!t) continue;
    if (t.type === "text") parts.push({ text: String(t.getFieldValue("TEXT")) });
    else parts.push({ code: g.valueToCode(b, `ADD${i}`, Order.NONE) });
  }
  if (!parts.length) return ['""', Order.ATOMIC];
  if (parts.every((p) => p.text !== undefined)) return [g.quote_(parts.map((p) => p.text).join("")), Order.ATOMIC];
  if (parts.length === 1) return [`str(${parts[0]!.code})`, Order.FUNCTION_CALL];
  const inner = parts.map((p) => (p.text !== undefined ? g.quote_(p.text).slice(1, -1).replace(/[{}]/g, (c) => c + c) : `{${p.code}}`)).join("");
  return [`f"${inner}"`, Order.ATOMIC];
};

// ---------------------------------------------------------------- calling a script's functions

/**
 * "call speed_up with 3": any function a script defines, typed or made with
 * blocks. The block has one slot per parameter, remembered in the saved
 * blocks (extraState), so it loads with its slots even before the project's
 * functions are known — or after the function is gone, when the game says
 * so by name.
 *
 * It takes the function's parameters as they are now through refreshCalls,
 * which the editor runs after loading and when another function is picked —
 * never while loading: Blockly loads a block's shape, then its fields, then
 * what is plugged in, and reshaping as the name loaded made a call to a
 * function that had lost a parameter fail to load at all.
 */
type CallBlock = Blockly.Block & { params: string[]; setParams(params: string[]): void };

function defineCall(type: string, statement: boolean) {
  Blockly.Blocks[type] = {
    init(this: CallBlock) {
      this.params = [];
      const field = new NameDropdown(function (this: Blockly.FieldDropdown) {
        const options: [string, string][] = currentNames().functions.map((f) => [f.name, f.name]);
        const value = this.getValue();
        if (value && !options.some((o) => o[1] === value)) options.push([value, value]);
        if (!options.length) options.push(["(no functions yet)", ""]);
        return options;
      });
      this.appendDummyInput("HEAD").appendField("call").appendField(field as unknown as Blockly.Field<string | undefined>, "FN");
      this.setInputsInline(true);
      if (statement) {
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
      } else this.setOutput(true, null);
      this.setColour(COLOURS.Functions);
      this.setTooltip("Runs a function one of your scripts defines.");
    },
    setParams(this: CallBlock, params: string[]) {
      // Keep what was plugged into a slot whose name is still there.
      const kept = new Map<string, Blockly.Connection>();
      this.params.forEach((name, i) => {
        const target = this.getInput(`ARG${i}`)?.connection?.targetConnection;
        if (target && params.includes(name)) kept.set(name, target);
      });
      for (let i = 0; this.getInput(`ARG${i}`); i++) this.removeInput(`ARG${i}`);
      this.params = [...params];
      params.forEach((name, i) => {
        const input = this.appendValueInput(`ARG${i}`).appendField(name);
        const old = kept.get(name);
        if (old) input.connection!.connect(old);
      });
    },
    saveExtraState(this: CallBlock) {
      return { params: this.params };
    },
    loadExtraState(this: CallBlock, state: { params?: string[] }) {
      this.setParams(state.params ?? []);
    },
  };
  generators[type] = (b, g) => {
    const block = b as CallBlock;
    const name = String(b.getFieldValue("FN") || "missing_function");
    const call = `${name}(${block.params.map((_, i) => arg(b, g, `ARG${i}`)).join(", ")})`;
    return statement ? `${call}\n` : [call, Order.FUNCTION_CALL];
  };
}
defineCall("gm_call_do", true);
defineCall("gm_call_get", false);

/** Gives call blocks (all, or the listed ones) their function's parameters as the scripts have them now. */
export function refreshCalls(ws: Blockly.Workspace, blocks?: Blockly.Block[]) {
  const all = blocks ?? [...ws.getBlocksByType("gm_call_do", false), ...ws.getBlocksByType("gm_call_get", false)];
  for (const b of all as CallBlock[]) {
    if (!b.setParams) continue;
    const f = currentNames().functions.find((x) => x.name === b.getFieldValue("FN"));
    if (f && f.params.join() !== b.params.join()) b.setParams(f.params);
  }
}

/** Installs every block's Python on a generator. */
export function installGenerators(g: Gen) {
  for (const [type, f] of Object.entries(generators)) g.forBlock[type] = f as never;
}

/** Name pickers whose value is a project name: renaming walks these (blockState.ts). */
for (const t of NAME_FIELD_BLOCKS) if (!(t in Blockly.Blocks)) throw new Error(`blockState lists ${t}, which isn't a block`);
