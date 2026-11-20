/**
 * What makes.test.ts needs to replay a "Now you can make" lesson, shared with each
 * lesson's own replay file (makes/make-*.ts): a step's edits, an open lesson's blanks
 * filled the student's way, and helpers for a play-check of the finished game.
 */
import { KEY_CODE } from "../../engine/input";
import type { PythonGame } from "../../python/bridge";
import type { Project } from "../../store/project";
import type { Edit } from "../series";

/**
 * What a step does: an Edit, ready-made sprites to add, and anything else (tilesets, painted
 * tiles) by hand. `adapt`: how this student changed the step's examples (an open lesson's
 * code is an example: names and keys are theirs; blanks are theirs to fill), so it's that
 * version the game must have: block i of the step, as this student has it.
 * `named`: ready-made sprites added under the student's own names ([starter, name]).
 */
export type MakeStep = Edit & {
  sprites?: string[];
  named?: [string, string][];
  also?: (p: Project) => void;
  adapt?: (block: string, i: number) => string;
};
/** For each step number: what it does, given that step's python blocks and the game's code so far ("Object.event"). */
export type Steps = Record<number, (b: string[], code: (where: string) => string) => MakeStep>;
/** What the finished game must do that the checks can't see, played in the real Pyodide. */
export type Play = (g: PythonGame) => void;

/** An example's blanks (`___`) filled in, in order, as this student chose. */
export const fill = (code: string, values: string[]) => values.reduce((c, v) => c.replace("___", v), code);

/** A student who plays on W A S D: the examples' arrow keys swapped for theirs. */
export const wasd = (code: string) =>
  code.replace(/"up"/g, '"w"').replace(/"down"/g, '"s"').replace(/"left"/g, '"a"').replace(/"right"/g, '"d"');

export function step(g: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = g.step();
    if (e) throw new Error(`${e.object} ${e.event} line ${e.line}: ${e.message}`);
  }
}
export const run = (g: PythonGame, code: string) => g.evalPython(code) as number;
export function press(g: PythonGame, key: string) {
  g.engine.input.keyDown(KEY_CODE.get(key)!);
  step(g);
  g.engine.input.keyUp(KEY_CODE.get(key)!);
}
