/**
 * Scene mode: a cutscene as a list of steps, picked and put in order, as a
 * fourth way to write an event (beside Python, blocks and a sheet).
 *
 * Like a sheet it is saved as plain JSON (`scene`) and writes its Python into
 * `code` on every change, so the game, error mapping and export read only
 * `code`. One step is one line of Python: scene_ calls are what line steps up,
 * so this adds nothing to the game itself. Steps come from the catalog's
 * Cutscenes category, so a new scene_ function only needs a place in
 * SCENE_GROUPS (scene.test.ts fails until it has one).
 *
 * Every value is kept as the Python that goes in the call, whatever box shows
 * it, so compiling, renaming and checking need no knowledge of the boxes.
 * Everything here is pure: tests and tutorial checks read it headless.
 */
import { API, type ApiFunction, type Param } from "../catalog/api";
import { checkExpr } from "../eventsheets/sheet";

export interface SceneStep {
  id: string;
  fn: string;
  /** By the parameter's name: the Python that goes there. Missing or empty is left out. */
  args: Record<string, string>;
  /** scene_create: the name later steps know the new instance by. */
  as?: string;
}

export interface Scene {
  steps: SceneStep[];
  /** Set: the scene plays once a game, remembered in global_vars under this name. */
  once?: string;
}

export const emptyScene = (): Scene => ({ steps: [] });
export const hasSteps = (s: Scene | undefined) => !!s?.steps.length;

/** The steps offered, by what they're for, each with the word on its button. */
export const SCENE_GROUPS: { label: string; steps: Record<string, string> }[] = [
  { label: "Story", steps: { scene_say: "Say", scene_ask: "Ask", scene_caption: "Caption", scene_wait: "Wait" } },
  {
    label: "Actors",
    steps: {
      scene_move: "Move",
      scene_face: "Face",
      scene_sprite: "Change sprite",
      scene_animate: "Animate",
      scene_show: "Show",
      scene_hide: "Hide",
      scene_tint: "Tint",
      scene_create: "Bring on",
      scene_destroy: "Remove",
    },
  },
  { label: "Camera", steps: { scene_camera: "Camera to", scene_zoom: "Zoom", scene_shake: "Shake" } },
  { label: "Screen", steps: { scene_bars: "Movie bars", scene_fade: "Fade", scene_flash: "Flash" } },
  { label: "More", steps: { scene_sound: "Sound", scene_do: "Run a function", scene_room: "Go to room" } },
];

/** scene_playing and scene_skip are for code outside a scene, so they aren't steps. */
export const NOT_STEPS = new Set(["scene_playing", "scene_skip"]);

export const SCENE_FUNCTIONS = API.filter((e): e is ApiFunction => e.kind === "function" && e.category === "Cutscenes" && !NOT_STEPS.has(e.name));
const fnOf = (name: string) => SCENE_FUNCTIONS.find((f) => f.name === name);

export const stepLabel = (fn: string) => {
  for (const g of SCENE_GROUPS) if (g.steps[fn]) return g.steps[fn]!;
  return fn;
};

/**
 * These run every step, and each run would line the scene up again: a Python
 * student finds that out from a game that never moves again, so the tab is shut.
 */
export const REPEATING_EVENTS = new Set(["begin_step", "step", "end_step", "draw", "draw_gui"]);

/** Runtime's _EASES: scene.test.ts holds the two together. */
export const EASES = ["linear", "in_quad", "out_quad", "in_out_quad", "in_cubic", "out_cubic", "in_out_cubic", "in_sine", "out_sine", "in_out_sine", "in_back", "out_back", "in_out_back", "in_bounce", "out_bounce", "out_elastic"];

// ---------------------------------------------------------------- which box a value gets

export type Box = "text" | "choices" | "expr" | "actor" | "name" | "color" | "bool" | "ease" | "face" | "function";

export function boxOf(p: Param): Box {
  if (p.name === "text" || p.name === "question" || p.name === "name") return "text";
  if (p.name === "choices") return "choices";
  if (p.name === "ease") return "ease";
  if (p.name === "target") return "face";
  if (p.name === "function" || p.name === "then") return "function";
  if (p.type === "instance") return "actor";
  if (p.type === "sprite" || p.type === "object" || p.type === "room" || p.type === "sound") return "name";
  if (p.type === "color") return "color";
  if (p.type === "boolean") return "bool";
  return "expr";
}

/** Optional, but what most uses of a step change: always on its card, not behind More. */
export const isMainOption = (p: Param) => ["steps", "to", "zoom", "strength", "on", "name", "color"].includes(p.name);

export const quote = (text: string) => JSON.stringify(text);
/** What's in a Python string this file wrote, for its box. Typed Python comes back as it is. */
export function unquote(code: string): string {
  if (!code.startsWith('"')) return code;
  try {
    return JSON.parse(code) as string;
  } catch {
    return code;
  }
}
export const listOf = (lines: string[]) => `[${lines.map(quote).join(", ")}]`;
export function linesOf(code: string): string[] {
  try {
    const list = JSON.parse(code) as unknown;
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

export interface SceneNames {
  objects: string[];
  sprites: string[];
  rooms: string[];
  sounds?: string[];
  functions: { name: string; params: string[] }[];
}

/** A new step, with what it needs filled in so that it works as it is. */
export function newStep(fn: string, id: string, names: SceneNames, scene: Scene): SceneStep {
  const f = fnOf(fn)!;
  const args: Record<string, string> = {};
  for (const p of f.params) {
    if (p.default !== undefined) {
      // A number to see and change. It's left out of the Python while it's the default.
      if (isMainOption(p) && boxOf(p) === "expr") args[p.name] = p.default;
      continue;
    }
    const first = (list: string[] | undefined) => (list?.[0] ? quote(list[0]) : "");
    if (p.name === "text") args[p.name] = quote("Hello!");
    else if (p.name === "question") args[p.name] = quote("Ready?");
    else if (p.name === "choices") args[p.name] = listOf(["Yes", "No"]);
    else if (p.name === "target") args[p.name] = quote("right");
    else if (p.name === "function") args[p.name] = names.functions.find((x) => !x.params.length)?.name ?? "";
    else if (p.type === "instance") args[p.name] = "self";
    else if (p.type === "sprite") args[p.name] = first(names.sprites);
    else if (p.type === "object") args[p.name] = first(names.objects);
    else if (p.type === "room") args[p.name] = first(names.rooms);
    else if (p.type === "sound") args[p.name] = first(names.sounds);
    else if (p.name === "x") args[p.name] = "self.x";
    else if (p.name === "y") args[p.name] = "self.y";
    else args[p.name] = "0";
  }
  const step: SceneStep = { id, fn, args };
  if (fn === "scene_create") {
    let n = 1;
    const taken = new Set(scene.steps.map((s) => s.as));
    while (taken.has(`actor${n}`)) n++;
    step.as = `actor${n}`;
  }
  return step;
}

// ---------------------------------------------------------------- compiling

const KEYWORDS = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield self other".split(" "));
export const isActorName = (s: string) => /^[A-Za-z_]\w*$/.test(s) && !KEYWORDS.has(s);

/** What's wrong with a step, in words, for the card; null if nothing. */
export function stepProblem(scene: Scene, index: number): string | null {
  const step = scene.steps[index]!;
  const f = fnOf(step.fn);
  if (!f) return `GameIDE has no step called ${step.fn}.`;
  if (step.fn === "scene_create" && !isActorName(step.as ?? "")) return "Give the new actor a name made of letters, digits and _, like ghost.";
  for (const p of f.params) {
    const v = (step.args[p.name] ?? "").trim();
    if (!v || v === '""') {
      if (p.default === undefined) return `Choose its ${p.name}.`;
      continue;
    }
    const bad = checkExpr(v);
    if (bad) return `Its ${p.name}: ${bad}`;
    // An actor is `self`, Python like instances("X")[0], or the name a Bring on gave it.
    if ((p.type === "instance" || p.name === "target") && /^\w+$/.test(v) && isActorName(v)) {
      const at = scene.steps.findIndex((s) => s.as === v);
      if (at < 0) return `No step brings on an actor called ${v}.`;
      if (at >= index) return `${v} is brought on later, so this step can't use it yet. Move one of them.`;
    }
  }
  return null;
}

export function sceneProblems(scene: Scene): Map<string, string> {
  const out = new Map<string, string>();
  scene.steps.forEach((s, i) => {
    const bad = stepProblem(scene, i);
    if (bad) out.set(s.id, bad);
  });
  return out;
}

/** One step's line. Defaults are left out, and what follows one that's left out goes by name, as a person would write it. */
export function stepPython(step: SceneStep): string {
  const f = fnOf(step.fn)!;
  const parts: string[] = [];
  let byName = false;
  for (const p of f.params) {
    const v = (step.args[p.name] ?? "").trim();
    if (!v || v === p.default) {
      byName = true;
      continue;
    }
    parts.push(byName ? `${p.name}=${v}` : v);
  }
  return `${step.as ? `${step.as} = ` : ""}${step.fn}(${parts.join(", ")})`;
}

export interface ScenePython {
  code: string;
  /** Per line of `code`, the step that made it; null for the lines that aren't one. */
  lines: (string | null)[];
}

/**
 * A step with a problem writes `pass`, saying why: it's red on its card, and one
 * unfinished step shouldn't stop the whole game from starting with a syntax error.
 */
export function sceneToPython(scene: Scene): ScenePython {
  const out: string[] = [];
  const lines: (string | null)[] = [];
  const indent = scene.once && scene.steps.length ? "    " : "";
  if (indent) {
    out.push(`if not getattr(global_vars, "${scene.once}", False):`, `    global_vars.${scene.once} = True`);
    lines.push(null, null);
  }
  scene.steps.forEach((s, i) => {
    const bad = stepProblem(scene, i);
    out.push(indent + (bad ? `pass  # ${stepLabel(s.fn)}: ${bad.replace(/\s+/g, " ")}` : stepPython(s)));
    lines.push(s.id);
  });
  return { code: out.length ? out.join("\n") + "\n" : "", lines };
}

/** Renaming a resource: `sub` is project.replaceQuoted's quoted-name replacement. */
export function renameInScene(scene: Scene, sub: (code: string) => string) {
  for (const s of scene.steps) for (const k of Object.keys(s.args)) s.args[k] = sub(s.args[k]!);
}

export function moveStep(scene: Scene, id: string, to: number) {
  const from = scene.steps.findIndex((s) => s.id === id);
  if (from < 0) return;
  const [step] = scene.steps.splice(from, 1);
  scene.steps.splice(Math.max(0, Math.min(to, scene.steps.length)), 0, step!);
}
