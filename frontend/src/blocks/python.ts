/**
 * Blocks to Python. An event's blocks — or an instance's creation code —
 * become the body of a method; a script's blocks become its functions.
 *
 * Blockly's own Python generator does the standard blocks (if, loops, maths,
 * text); catalogBlocks.ts adds ours. This file makes the output look like
 * Python a person wrote:
 *   - four-space indents (Blockly's default is two);
 *   - "double quotes", as the rest of the editor and the templates use;
 *   - no `i = None` line for each variable at the top, which Blockly adds
 *     for module-level scripts — in a method, locals need no declaring;
 *   - imports (random, math) on the first lines, without blank lines after.
 *
 * Only the blocks under the event's hat become code — in a script, only
 * function definitions. Loose blocks are greyed out in the editor and left
 * out here, so half-built code lying to one side can't break the game.
 *
 * It also says which block each line came from (`lines`), so an error on
 * line 3 can select the block that made line 3.
 */
import * as Blockly from "blockly/core";
import { PythonGenerator, pythonGenerator } from "blockly/python";
import { installGenerators } from "./catalogBlocks";
import type { BlocksKind, BlocksState } from "./blockState";

class GamePython extends PythonGenerator {
  constructor() {
    super("GameIDE");
    this.INDENT = "    ";
    Object.assign(this.forBlock, pythonGenerator.forBlock);
    installGenerators(this);
  }

  override quote_(s: string): string {
    return `"${s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"')}"`;
  }

  override finish(code: string): string {
    const defs = Object.entries(this.definitions_)
      .filter(([k]) => k !== "variables")
      .map(([, v]) => v);
    this.definitions_ = Object.create(null);
    const body = super.finish(code).replace(/^\n+/, "");
    const isImport = (d: string) => /^(from\s+\S+\s+)?import\s/.test(d);
    // A script's functions, two blank lines apart as PEP 8 has it.
    const functions = defs
      .filter((d) => !isImport(d))
      .map((d) => d.replace(/\n+$/, ""))
      .join("\n\n\n");
    const rest = [functions, body].filter((x) => x.trim()).join("\n\n\n");
    // Blockly's round block asks for `import math` and then writes round():
    // an import the code never uses is left out.
    const imports = defs.filter((d) => {
      const m = /^import (\w+)$/.exec(d);
      return isImport(d) && (!m || rest.includes(`${m[1]}.`));
    });
    return imports.length ? `${imports.join("\n")}\n${functions ? "\n\n" : ""}${rest}` : rest;
  }
}

const gen = new GamePython();
// Blockly quotes the id in a marker itself, with single quotes.
const MARK = /^\s*#@(['"])(.*)\1$/;

const FUNCTION_DEFS = ["procedures_defnoreturn", "procedures_defreturn"];

function generate(ws: Blockly.Workspace, kind: BlocksKind): string {
  gen.init(ws);
  if (kind === "script") {
    // Each definition goes into the generator's definitions, which finish()
    // writes out; nothing else in a script is code.
    for (const b of ws.getTopBlocks(true)) if (FUNCTION_DEFS.includes(b.type)) gen.blockToCode(b);
    // Blockly declares every workspace variable `global` inside each
    // function, for its one-file programs. Here a function's variables are
    // its own (shared values belong in global_vars), so those lines go.
    return gen.finish("").replace(/^ +global [\w, ]+\n/gm, "").replace(/\n+$/, "");
  }
  const first = hatOf(ws)?.getInputTargetBlock("BODY") ?? null;
  const body = first ? (gen.blockToCode(first) as string) : "";
  return gen.finish(body).replace(/\n+$/, "");
}

export interface BlocksPython {
  /** The method's body, as it is saved in event.code. */
  code: string;
  /** For each line of `code` (0-based), the id of the block that made it, or null. */
  lines: (string | null)[];
}

/** The event's hat in a workspace: the first one, if a student somehow has two. */
export function hatOf(ws: Blockly.Workspace): Blockly.Block | null {
  return ws.getBlocksByType("gm_event", true)[0] ?? null;
}

export function workspaceToPython(ws: Blockly.Workspace, kind: BlocksKind = "event"): BlocksPython {
  const code = generate(ws, kind);
  // Again, with a marker line before each statement naming its block; the
  // markers taken out must leave exactly `code`, or the map is not trusted.
  gen.STATEMENT_PREFIX = "#@%1\n";
  let marked: string;
  try {
    marked = generate(ws, kind);
  } finally {
    gen.STATEMENT_PREFIX = null;
  }
  const lines: (string | null)[] = [];
  const kept: string[] = [];
  let current: string | null = null;
  for (const line of marked.split("\n")) {
    const m = MARK.exec(line);
    if (m) current = m[2]!;
    else {
      kept.push(line);
      lines.push(current);
    }
  }
  // A line before any marker (a def line) belongs to the block after it.
  for (let i = lines.length - 2; i >= 0; i--) if (lines[i] === null) lines[i] = lines[i + 1] ?? null;
  return { code, lines: kept.join("\n") === code ? lines : [] };
}

/** An event's saved blocks to its Python, without a page (tests, and checking saved code is current). */
export function blocksToPython(state: BlocksState, kind: BlocksKind = "event"): BlocksPython {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state as Record<string, unknown>, ws);
    return workspaceToPython(ws, kind);
  } finally {
    ws.dispose();
  }
}
