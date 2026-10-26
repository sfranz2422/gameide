/**
 * Code blocks as data — the part the rest of the editor needs without
 * loading Blockly (about 700 KB, fetched only when a Blocks tab opens).
 *
 * Three kinds of code can be blocks: an object's event, an instance's
 * creation code (both a method body under a hat), and a script (function
 * definitions). Each keeps Blockly's own JSON in `blocks`, and the Python
 * it makes in `code`, written on every change. Everything that runs or
 * reads code — the game, error mapping, export, tutorial checks — reads
 * `code` and never needs to know it was made with blocks.
 */

/** What the blocks are for: a method body under a hat, or a script's functions. */
export type BlocksKind = "event" | "creation" | "script";

/** The JSON Blockly saves a workspace as. Treated as opaque except for the walks below. */
export type BlocksState = { blocks?: { languageVersion?: number; blocks?: unknown[] }; variables?: unknown[] };

/** New blocks: for a body, only the hat, ready for blocks to go under it; for a script, nothing yet. */
export function emptyBlocks(kind: BlocksKind = "event"): BlocksState {
  if (kind === "script") return { blocks: { languageVersion: 0, blocks: [] } };
  return { blocks: { languageVersion: 0, blocks: [{ type: "gm_event", x: 24, y: 24, deletable: false }] } };
}

/**
 * Is there any code here besides comments? An event or script with only
 * comments (a new script starts with one) can still become blocks; one with
 * real Python can't, because Python never turns into blocks.
 */
export function hasPython(code: string): boolean {
  return code.split("\n").some((l) => l.trim() !== "" && !l.trim().startsWith("#"));
}

/** A function a script defines, for the call blocks. */
export interface ScriptFunction {
  name: string;
  params: string[];
}

/**
 * The functions scripts define, read from their code — typed or made with
 * blocks alike, since blocks scripts keep their Python in `code` too. Only
 * top-level `def`s; `*args` and keyword-only parameters are left out of the
 * call block (it gives one slot per plain parameter).
 */
export function scriptFunctions(scripts: { code: string }[]): ScriptFunction[] {
  const out: ScriptFunction[] = [];
  for (const s of scripts)
    for (const m of s.code.matchAll(/^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm)) {
      const params: string[] = [];
      for (const raw of m[2]!.split(",")) {
        const p = raw.trim();
        if (!p || p.startsWith("*")) {
          if (p.startsWith("*")) break;
          continue;
        }
        params.push(p.split(/[=:]/)[0]!.trim());
      }
      if (!out.some((f) => f.name === m[1])) out.push({ name: m[1]!, params });
    }
  return out;
}

/** Is anything attached under the hat (or lying loose)? */
export function hasBlocks(state: BlocksState | undefined): boolean {
  const top = state?.blocks?.blocks ?? [];
  return top.some((b) => {
    const block = b as { type?: string; inputs?: { BODY?: unknown } };
    return block.type !== "gm_event" || !!block.inputs?.BODY;
  });
}

/** Pickers whose NAME field holds a project name. */
export const NAME_FIELD_BLOCKS = ["gm_object", "gm_object_any", "gm_sprite", "gm_room", "gm_layer", "gm_layer_any"];

/**
 * Renaming a resource changes it in blocks too, matching what
 * project.replaceQuoted does to code: a name picker set to it, and a text
 * block that is exactly it. Without this the blocks would keep the old name,
 * and the next change to them would write it back into the code.
 */
export function renameInBlocks(state: BlocksState, from: string, to: string): void {
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; fields?: Record<string, unknown> };
    if (n.fields) {
      if (n.type && NAME_FIELD_BLOCKS.includes(n.type) && n.fields["NAME"] === from) n.fields["NAME"] = to;
      if (n.type === "text" && n.fields["TEXT"] === from) n.fields["TEXT"] = to;
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(state);
}
