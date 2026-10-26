/**
 * Python, blocks or an event sheet, the same way everywhere code lives: an
 * object's events, an instance's creation code, and (Python or blocks
 * only) scripts.
 *
 * The rules: something with nothing in it yet — no Python but comments, no
 * blocks, no rows — can switch to any of the three freely. Blocks or a sheet
 * can become Python, once, after a warning, because it can't be undone.
 * Python never becomes blocks or a sheet: that would mean reading any code
 * at all as blocks or rows, and a student's typing would come back changed.
 * Blocks and sheets don't turn into each other either; both go to Python.
 */
import { lazy } from "react";
import { emptyBlocks, hasBlocks, hasPython, scriptFunctions, type BlocksKind, type BlocksState } from "../blocks/blockState";
import type { BlockNames } from "../blocks/catalogBlocks";
import { emptySheet, hasRows, type Sheet } from "../eventsheets/sheet";
import type { Project } from "../store/project";
import type { ProjectNames } from "./code/pythonHelp";

// Blockly is about 700 KB: fetched the first time a Blocks tab opens.
export const BlocksEditor = lazy(() => import("../blocks/BlocksEditor"));
// The sheet editor is small, but only sheet users need it.
export const SheetEditor = lazy(() => import("../eventsheets/SheetEditor"));

export type CodeMode = "python" | "blocks" | "sheet";

/** Anything that holds code that may be blocks or a sheet. */
export interface CodeHolder {
  code: string;
  mode?: CodeMode;
  blocks?: BlocksState;
  sheet?: Sheet;
}

export const modeOf = (h: CodeHolder): CodeMode => h.mode ?? "python";
export const isBlocks = (h: CodeHolder) => h.mode === "blocks";
export const isSheet = (h: CodeHolder) => h.mode === "sheet";

/** Nothing written yet, however it is written. */
export function isEmpty(h: CodeHolder): boolean {
  if (isBlocks(h)) return !hasBlocks(h.blocks);
  if (isSheet(h)) return !hasRows(h.sheet);
  return !hasPython(h.code);
}

/** Can this tab be chosen? Its own mode, or any when nothing is written yet. Never back from Python. */
export const canUse = (h: CodeHolder, mode: CodeMode) => modeOf(h) === mode || isEmpty(h);
export const canUseBlocks = (h: CodeHolder) => canUse(h, "blocks");

/** Switches something empty to blocks or a sheet (Python is toPython, which may ask). */
export function switchTo(h: CodeHolder, mode: "blocks" | "sheet", kind: BlocksKind) {
  if (modeOf(h) === mode || !isEmpty(h)) return;
  h.mode = mode;
  delete h.blocks;
  delete h.sheet;
  if (mode === "blocks") h.blocks = emptyBlocks(kind);
  else h.sheet = emptySheet();
  // A new script's "# Functions here…" comment is not code the blocks made.
  h.code = "";
}
export const toBlocks = (h: CodeHolder, kind: BlocksKind) => switchTo(h, "blocks", kind);

/**
 * Asks first if there are blocks or rows to lose the use of; empty ones
 * just go. Returns whether to go ahead; `toPython` then makes the change.
 */
export function confirmToPython(h: CodeHolder, what: string): boolean {
  if (modeOf(h) === "python") return false;
  return isEmpty(h) || confirm(`Turn ${what} into Python?\n\nYou'll edit the Python from now on. It can't be turned back into ${isSheet(h) ? "a sheet" : "blocks"}.`);
}

export function toPython(h: CodeHolder) {
  h.mode = "python";
  delete h.blocks;
  delete h.sheet;
}

/** Names for autocomplete and the blocks' pickers. */
export function projectNames(p: Project): ProjectNames {
  return {
    objects: p.objects.map((o) => o.name),
    sprites: p.sprites.map((s) => s.name),
    rooms: p.rooms.map((r) => r.name),
    layers: [...new Set(p.rooms.flatMap((r) => r.layers.filter((l) => l.kind === "tiles").map((l) => l.name)))],
    sounds: (p.sounds ?? []).map((s) => s.name),
    fonts: (p.fonts ?? []).map((f) => f.name),
  };
}

/** The names the blocks' pickers offer. A script's own functions are left out of its Functions category (they're under Make a function). */
export function blockNamesFor(project: Project, exceptScript?: string): BlockNames {
  // (Also what the sheet editor's pickers and boxes offer: the same names.)
  return {
    layers: [],
    ...projectNames(project),
    functions: scriptFunctions(project.scripts.filter((s) => s.id !== exceptScript)),
  };
}

/** Python | Blocks (| Event Sheet) tabs, for a script or creation code (the object editor has its own row, with more tabs). */
export function ModeTabs({
  holder,
  onPython,
  onBlocks,
  onSheet,
  testPrefix,
}: {
  holder: CodeHolder;
  onPython: () => void;
  onBlocks: () => void;
  /** Absent for scripts, which can't be sheets. */
  onSheet?: () => void;
  testPrefix: string;
}) {
  const mode = modeOf(holder);
  const tab = (m: CodeMode, label: string, run: () => void) => (
    <button
      role="tab"
      aria-selected={mode === m}
      className={mode === m ? "on" : ""}
      disabled={m !== "python" && !canUse(holder, m)}
      onClick={run}
      data-testid={`${testPrefix}-tab-${m}`}
      title={m === "python" || canUse(holder, m) ? undefined : "Something is already written here another way. Only empty code can switch."}
    >
      {label}
    </button>
  );
  return (
    <div className="code-tabs" role="tablist">
      {tab("python", "Python", onPython)}
      {tab("blocks", "Blocks", onBlocks)}
      {onSheet && tab("sheet", "Event Sheet", onSheet)}
    </div>
  );
}
