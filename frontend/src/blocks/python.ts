/**
 * Blocks to Python: an event's blocks become the body of its method.
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
 * Only the blocks under the event's hat become code. Loose blocks are
 * greyed out in the editor and left out here, so half-built code lying to
 * one side can't break the game.
 *
 * It also says which block each line came from (`lines`), so an error on
 * line 3 can select the block that made line 3.
 */
import * as Blockly from "blockly/core";
import { PythonGenerator, pythonGenerator } from "blockly/python";
import { installGenerators } from "./catalogBlocks";
import type { BlocksState } from "./blockState";

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
    // Blockly's round block asks for `import math` and then writes round():
    // an import the code never uses is left out.
    const used = defs.filter((d) => {
      const m = /^import (\w+)$/.exec(d);
      return !m || body.includes(`${m[1]}.`);
    });
    return used.length ? `${used.join("\n")}\n${body}` : body;
  }
}

const gen = new GamePython();
// Blockly quotes the id in a marker itself, with single quotes.
const MARK = /^\s*#@(['"])(.*)\1$/;

function generate(ws: Blockly.Workspace, hat: Blockly.Block | null): string {
  gen.init(ws);
  const first = hat?.getInputTargetBlock("BODY") ?? null;
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

export function workspaceToPython(ws: Blockly.Workspace): BlocksPython {
  const hat = hatOf(ws);
  const code = generate(ws, hat);
  // Again, with a marker line before each statement naming its block; the
  // markers taken out must leave exactly `code`, or the map is not trusted.
  gen.STATEMENT_PREFIX = "#@%1\n";
  let marked: string;
  try {
    marked = generate(ws, hat);
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
  return { code, lines: kept.join("\n") === code ? lines : [] };
}

/** An event's saved blocks to its Python, without a page (tests, and checking saved code is current). */
export function blocksToPython(state: BlocksState): BlocksPython {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state as Record<string, unknown>, ws);
    return workspaceToPython(ws);
  } finally {
    ws.dispose();
  }
}
