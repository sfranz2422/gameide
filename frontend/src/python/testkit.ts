/**
 * Small games for the bridge suites: a few objects, a room, some Python,
 * and helpers to step them and read Python values back.
 */
import type { PythonGameError } from "../engine/engine";
import type { GameDefinition, ObjectDef, RoomInstance, SpriteDef } from "../engine/game";
import { KEY_CODE } from "../engine/input";
import { PythonGame } from "./bridge";

export const SPRITES: SpriteDef[] = [
  { name: "box", width: 16, height: 16, originX: 0, originY: 0, frameCount: 1 },
  { name: "big", width: 32, height: 32, originX: 0, originY: 0, frameCount: 1 },
  { name: "anim", width: 8, height: 8, originX: 4, originY: 4, frameCount: 4 },
];

export interface MiniGame {
  sprites?: SpriteDef[];
  objects?: ObjectDef[];
  code?: Record<string, string>;
  instances?: RoomInstance[];
  rooms?: GameDefinition["rooms"];
  scripts?: Record<string, string>;
}

export interface Loaded {
  game: PythonGame;
  error: PythonGameError | null;
  out: string[];
  warnings: string[];
}

export async function load(m: MiniGame): Promise<Loaded> {
  const out: string[] = [];
  const warnings: string[] = [];
  const code = m.code ?? {};
  const objects = m.objects ?? Object.keys(code).map((name) => ({ name, sprite: "box" }));
  const def: GameDefinition = {
    sprites: [...SPRITES, ...(m.sprites ?? [])],
    objects,
    rooms: m.rooms ?? [{ name: "Room1", width: 320, height: 240, instances: m.instances ?? [] }],
    code,
    ...(m.scripts ? { scripts: m.scripts } : {}),
  };
  const { game, error } = await PythonGame.load(def, {
    stdout: (s) => out.push(s),
    stderr: (s) => out.push(s),
    warning: (s) => warnings.push(s),
  });
  return { game, error, out, warnings };
}

/** Steps n times; throws if the game raised, so a test shows the Python error. */
export function run(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}

export const py = (game: PythonGame, expr: string) => game.evalPython(expr);

export const key = (name: string) => KEY_CODE.get(name)!;
