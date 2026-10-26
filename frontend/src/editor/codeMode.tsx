/**
 * Python or blocks, the same way everywhere code lives: an object's events,
 * scripts, and an instance's creation code.
 *
 * The rules: something with no Python in it yet (nothing, or only comments)
 * can switch either way freely. Blocks can become Python — once, after a
 * warning, because it can't be undone. Python never becomes blocks: that
 * would mean reading any code at all as blocks, and a student's typing
 * would come back changed.
 */
import { lazy } from "react";
import { emptyBlocks, hasBlocks, hasPython, scriptFunctions, type BlocksKind, type BlocksState } from "../blocks/blockState";
import type { BlockNames } from "../blocks/catalogBlocks";
import type { Project } from "../store/project";
import type { ProjectNames } from "./code/pythonHelp";

// Blockly is about 700 KB: fetched the first time a Blocks tab opens.
export const BlocksEditor = lazy(() => import("../blocks/BlocksEditor"));

/** Anything that holds code that may be blocks. */
export interface CodeHolder {
  code: string;
  mode?: "python" | "blocks";
  blocks?: BlocksState;
}

export const isBlocks = (h: CodeHolder) => h.mode === "blocks";
/** Can the Blocks tab be chosen? Yes for blocks, or for code with no Python in it yet. */
export const canUseBlocks = (h: CodeHolder) => isBlocks(h) || !hasPython(h.code);

export function toBlocks(h: CodeHolder, kind: BlocksKind) {
  if (isBlocks(h) || hasPython(h.code)) return;
  h.mode = "blocks";
  h.blocks = emptyBlocks(kind);
  // A new script's "# Functions here…" comment is not code the blocks made.
  h.code = "";
}

/**
 * Asks first if there are blocks to lose the use of; empty blocks just go.
 * Returns whether to go ahead; `apply` then makes the change in the project.
 */
export function confirmToPython(h: CodeHolder, what: string): boolean {
  if (!isBlocks(h)) return false;
  return !hasBlocks(h.blocks) || confirm(`Turn ${what} into Python?\n\nYou'll edit the Python from now on. It can't be turned back into blocks.`);
}

export function toPython(h: CodeHolder) {
  h.mode = "python";
  delete h.blocks;
}

/** Names for autocomplete and the blocks' pickers. */
export function projectNames(p: Project): ProjectNames {
  return {
    objects: p.objects.map((o) => o.name),
    sprites: p.sprites.map((s) => s.name),
    rooms: p.rooms.map((r) => r.name),
    layers: [...new Set(p.rooms.flatMap((r) => r.layers.filter((l) => l.kind === "tiles").map((l) => l.name)))],
  };
}

/** The names the blocks' pickers offer. A script's own functions are left out of its Functions category (they're under Make a function). */
export function blockNamesFor(project: Project, exceptScript?: string): BlockNames {
  return {
    layers: [],
    ...projectNames(project),
    functions: scriptFunctions(project.scripts.filter((s) => s.id !== exceptScript)),
  };
}

/** Python | Blocks tabs, for a script or creation code (the object editor has its own row, with more tabs). */
export function ModeTabs({ holder, onPython, onBlocks, testPrefix }: { holder: CodeHolder; onPython: () => void; onBlocks: () => void; testPrefix: string }) {
  const blocks = isBlocks(holder);
  return (
    <div className="code-tabs" role="tablist">
      <button role="tab" aria-selected={!blocks} className={!blocks ? "on" : ""} onClick={onPython} data-testid={`${testPrefix}-tab-python`}>
        Python
      </button>
      <button
        role="tab"
        aria-selected={blocks}
        className={blocks ? "on" : ""}
        disabled={!canUseBlocks(holder)}
        onClick={onBlocks}
        data-testid={`${testPrefix}-tab-blocks`}
        title={canUseBlocks(holder) ? "Build this with code blocks" : "This is written in Python. Python can't be turned into blocks."}
      >
        Blocks
      </button>
    </div>
  );
}
