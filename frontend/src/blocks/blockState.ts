/**
 * Code blocks as data — the part the rest of the editor needs without
 * loading Blockly (about 700 KB, fetched only when a Blocks tab opens).
 *
 * A blocks event keeps Blockly's own JSON in `event.blocks`, and the Python
 * it makes in `event.code`, written on every change. Everything that runs or
 * reads code — the game, error mapping, export, tutorial checks — reads
 * `code` and never needs to know the event was made with blocks.
 */

/** The JSON Blockly saves a workspace as. Treated as opaque except for the walks below. */
export type BlocksState = { blocks?: { languageVersion?: number; blocks?: unknown[] }; variables?: unknown[] };

/** A new event's blocks: only the hat, ready for blocks to go under it. */
export function emptyBlocks(): BlocksState {
  return { blocks: { languageVersion: 0, blocks: [{ type: "gm_event", x: 24, y: 24, deletable: false }] } };
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
