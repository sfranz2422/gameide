/**
 * Autocomplete and hover help for students' Python, built from the API
 * catalog — the same list the runtime is tested against, so every
 * suggestion is a call that works.
 *
 * Three kinds of suggestion:
 *   - engine functions and variables anywhere, with their parameters filled
 *     in as placeholders (Tab moves between them);
 *   - after `self.` or `other.`, an instance's properties and methods;
 *   - inside quotes, what that parameter wants: object names in
 *     `place_meeting(x, y, "`, key names in `keyboard_check("`, and so on,
 *     read from the catalog's parameter types.
 */
import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { hoverTooltip } from "@codemirror/view";
import { API, PROPERTIES, type ApiFunction, type ParamType } from "../../catalog/api";
import { KEY_NAMES, MOUSE_BUTTONS } from "../../engine/layout";

/** Names the project currently has, for suggestions inside quotes. */
export interface ProjectNames {
  objects: string[];
  sprites: string[];
  rooms: string[];
  /** Tile layer names, from every room (a collision check can name one). */
  layers?: string[];
}

const COLORS = ["white", "black", "red", "green", "blue", "yellow", "orange", "purple", "aqua", "lime", "gray", "silver", "navy", "teal", "maroon", "olive", "fuchsia", "dkgray", "ltgray"];

const FUNCTIONS = new Map(API.filter((e): e is ApiFunction => e.kind === "function").map((f) => [f.name, f]));

/** Methods an instance has, beyond its properties. */
const METHODS: { name: string; params: string[]; info: string }[] = [
  { name: "destroy", params: [], info: "Removes this instance (its Destroy event runs first)." },
  { name: "place_meeting", params: ["x", "y", "obj"], info: "Would this instance touch that object at (x, y)?" },
  { name: "place_free", params: ["x", "y"], info: "Is (x, y) free of solid instances?" },
  { name: "instance_place", params: ["x", "y", "obj"], info: "Which instance of that object it would touch at (x, y)." },
  { name: "move_and_collide", params: ["dx", "dy", "obj"], info: "Moves, stopping against the object." },
  { name: "move_towards", params: ["x", "y", "speed"], info: "Points at (x, y) and sets the speed." },
];

export function signature(f: ApiFunction): string {
  return `${f.name}(${f.params.map((p) => (p.default !== undefined ? `${p.name}=${p.default}` : p.name)).join(", ")})`;
}

function functionCompletions(): Completion[] {
  const out: Completion[] = [];
  for (const e of API) {
    if (e.kind === "variable") {
      out.push({ label: e.name, type: "variable", detail: e.type, info: e.description, boost: 1 });
      continue;
    }
    const required = e.params.filter((p) => p.default === undefined);
    const template = `${e.name}(${required.map((p) => `\${${p.name}}`).join(", ")})`;
    out.push(snippetCompletion(template, { label: e.name, type: "function", detail: signature(e).slice(e.name.length), info: e.description, boost: 1 }));
  }
  return out;
}

function memberCompletions(): Completion[] {
  return [
    ...PROPERTIES.map((p) => ({ label: p.name, type: "property", info: p.description })),
    ...METHODS.map((m) =>
      snippetCompletion(`${m.name}(${m.params.map((p) => `\${${p}}`).join(", ")})`, { label: m.name, type: "method", info: m.info, detail: `(${m.params.join(", ")})` }),
    ),
  ];
}

const FN_COMPLETIONS = functionCompletions();
const MEMBER_COMPLETIONS = memberCompletions();

/**
 * If the cursor is inside the quotes of an engine function's argument,
 * which parameter type is it? Works on the text of the line before the
 * cursor: find the innermost unclosed `name(`, count the commas after it.
 */
export function stringArgType(before: string): ParamType | null {
  // Inside a string: an odd number of unescaped quotes of one kind.
  const m = before.match(/(["'])([^"']*)$/);
  if (!m) return null;
  const head = before.slice(0, before.length - m[0].length);
  let depth = 0;
  let commas = 0;
  for (let i = head.length - 1; i >= 0; i--) {
    const c = head[i]!;
    if (c === ")" || c === "]") depth++;
    else if (c === "(" || c === "[") {
      if (depth === 0) {
        const name = head.slice(0, i).match(/([A-Za-z_]\w*)\s*$/)?.[1];
        const f = name ? FUNCTIONS.get(name) ?? methodAsFunction(name) : undefined;
        return f?.params[commas]?.type ?? null;
      }
      depth--;
    } else if (c === "," && depth === 0) commas++;
  }
  return null;
}

function methodAsFunction(name: string): ApiFunction | undefined {
  // self.place_meeting(x, y, "…") takes the same arguments as the function.
  return FUNCTIONS.get(name);
}

export function valuesFor(type: ParamType, names: ProjectNames): string[] {
  switch (type) {
    case "object":
      return [...names.objects, ...(names.layers ?? [])];
    case "layer":
      return names.layers ?? [];
    case "sprite":
      return names.sprites;
    case "room":
      return names.rooms;
    case "key":
      return [...KEY_NAMES];
    case "button":
      return [...MOUSE_BUTTONS];
    case "color":
      return COLORS;
    default:
      return [];
  }
}

export function completionSource(getNames: () => ProjectNames) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);

    const argType = stringArgType(before);
    if (argType) {
      const word = ctx.matchBefore(/[\w ]*/);
      const values = valuesFor(argType, getNames());
      if (!values.length) return null;
      return { from: word ? word.from : ctx.pos, options: values.map((v) => ({ label: v, type: "constant" })), validFor: /^[\w ]*$/ };
    }
    if (/["']/.test(before) && (before.match(/["']/g)!.length % 2 === 1)) return null; // in some other string

    const member = ctx.matchBefore(/\b(self|other|\w+)\.\w*$/);
    if (member) {
      const dot = member.text.indexOf(".");
      return { from: member.from + dot + 1, options: MEMBER_COMPLETIONS, validFor: /^\w*$/ };
    }
    const word = ctx.matchBefore(/\w+/);
    if (!word && !ctx.explicit) return null;
    return { from: word ? word.from : ctx.pos, options: FN_COMPLETIONS, validFor: /^\w*$/ };
  };
}

/** Hovering an engine function shows what it does — the same words as the docs pane. */
export const apiHover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  let s = pos - line.from;
  let e = s;
  while (s > 0 && /\w/.test(text[s - 1]!)) s--;
  while (e < text.length && /\w/.test(text[e]!)) e++;
  const word = text.slice(s, e);
  const f = FUNCTIONS.get(word);
  const v = f ? null : API.find((x) => x.name === word && x.kind === "variable");
  const prop = f || v ? null : text[s - 1] === "." ? PROPERTIES.find((p) => p.name === word) : null;
  if (!f && !v && !prop) return null;
  return {
    pos: line.from + s,
    end: line.from + e,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "api-tip";
      const head = document.createElement("code");
      head.textContent = f ? signature(f) : word;
      const body = document.createElement("div");
      body.textContent = f ? f.description : v ? v.description : prop!.description;
      dom.append(head, body);
      return { dom };
    },
  };
});
