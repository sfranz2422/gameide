/**
 * Scene mode's Python, compiled here and played in the real Pyodide, so a step's
 * card can't quietly write a call the game refuses.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API, type ApiFunction } from "../catalog/api";
import { py, load, run } from "../python/testkit";
import { checkProject, readCheck } from "../checks/checks";
import { EASES, emptyScene, moveStep, NOT_STEPS, newStep, renameInScene, SCENE_FUNCTIONS, SCENE_GROUPS, sceneProblems, sceneToPython, stepPython, quote, type Scene, type SceneStep } from "./scene";
import { keepCode } from "../editor/history";
import { replaceQuoted, type Project } from "../store/project";

const names = { objects: ["Hero", "Ghost"], sprites: ["Walk"], rooms: ["Town"], sounds: [], functions: [{ name: "open_door", params: [] }] };
const step = (fn: string, args: Record<string, string>, as?: string): SceneStep => ({ id: `${fn}-${Math.random()}`, fn, args, ...(as ? { as } : {}) });
const code = (steps: SceneStep[], once?: string) => sceneToPython({ steps, ...(once ? { once } : {}) }).code;

describe("scene steps", () => {
  it("every scene_ function in the catalog has a place on the Add menu, and nothing else does", () => {
    const listed = SCENE_GROUPS.flatMap((g) => Object.keys(g.steps)).sort();
    const cutscenes = API.filter((e): e is ApiFunction => e.kind === "function" && e.category === "Cutscenes").map((f) => f.name).filter((n) => !NOT_STEPS.has(n)).sort();
    expect(listed).toEqual(cutscenes);
  });

  it("one step is one line, reading as a person would write it", () => {
    expect(stepPython(step("scene_say", { text: quote("Hi"), picture: quote("Face") }))).toBe('scene_say("Hi", picture="Face")');
    expect(stepPython(step("scene_move", { instance: "self", x: "100", y: "200", steps: "60" }))).toBe("scene_move(self, 100, 200)");
    expect(stepPython(step("scene_move", { instance: "self", x: "1", y: "2", wait: "False" }))).toBe("scene_move(self, 1, 2, wait=False)");
    expect(stepPython(step("scene_create", { x: "1", y: "2", obj: quote("Ghost") }, "ghost"))).toBe('ghost = scene_create(1, 2, "Ghost")');
    const c = sceneToPython({ steps: [step("scene_wait", {}), step("scene_shake", {})] });
    expect(c.code).toBe("scene_wait()\nscene_shake()\n");
    expect(c.lines.length).toBe(2);
  });

  it("the line map finds a step, with Play once's two lines in front", () => {
    const a = step("scene_wait", {});
    const out = sceneToPython({ steps: [a], once: "seen_x" });
    expect(out.lines).toEqual([null, null, a.id]);
    expect(out.code).toContain('if not getattr(global_vars, "seen_x", False):');
    expect(sceneToPython({ steps: [], once: "seen_x" }).code).toBe("");
  });

  it("a step missing something says so and writes pass, so the game still starts", () => {
    const a = step("scene_move", { instance: "self", y: "2" });
    const scene: Scene = { steps: [a] };
    expect(sceneProblems(scene).get(a.id)).toMatch(/x/);
    expect(sceneToPython(scene).code).toMatch(/^pass {2}# Move/);
    const typed = step("scene_wait", { steps: "1 +" });
    expect(sceneProblems({ steps: [typed] }).get(typed.id)).toBeTruthy();
    expect(sceneToPython({ steps: [typed] }).code).toMatch(/^pass/);
  });

  it("an actor must be brought on before a step uses it", () => {
    const make = step("scene_create", { x: "1", y: "2", obj: quote("Ghost") }, "ghost");
    const use = step("scene_hide", { instance: "ghost" });
    expect(sceneProblems({ steps: [make, use] }).size).toBe(0);
    expect(sceneProblems({ steps: [use, make] }).get(use.id)).toMatch(/brought on later/);
    expect(sceneProblems({ steps: [use] }).get(use.id)).toMatch(/No step brings on/);
    const bad = step("scene_create", { x: "1", y: "2", obj: quote("Ghost") }, "class");
    expect(sceneProblems({ steps: [bad] }).get(bad.id)).toMatch(/name/);
  });

  it("moves in order, and a new Bring on gets a name not yet taken", () => {
    const [a, b, c] = [step("scene_wait", {}), step("scene_flash", {}), step("scene_shake", {})];
    const s: Scene = { steps: [a, b, c] };
    moveStep(s, c.id, 0);
    expect(s.steps.map((x) => x.fn)).toEqual(["scene_shake", "scene_wait", "scene_flash"]);
    const first = newStep("scene_create", "1", names, emptyScene());
    expect(first.as).toBe("actor1");
    expect(newStep("scene_create", "2", names, { steps: [first] }).as).toBe("actor2");
  });

  it("the card's easings are the runtime's", async () => {
    const source = readFileSync("src/python/runtime.py", "utf8");
    const table = source.slice(source.indexOf("_EASES = {"), source.indexOf("}\n", source.indexOf("_EASES = {")));
    expect([...table.matchAll(/^\s+"(\w+)":/gm)].map((m) => m[1])).toEqual(EASES);
  });

  it("every new step as it comes off the menu runs in the game with no error", async () => {
    const sprites = [{ name: "Walk", width: 16, height: 16, originX: 0, originY: 0, frameCount: 2, mask: { kind: "rect" } }];
    const scene = emptyScene();
    for (const f of SCENE_FUNCTIONS) {
      if (f.name === "scene_room" || f.name === "scene_sound") continue; // Rooms and sounds aren't in this test's game: tried below.
      scene.steps.push(newStep(f.name, f.name, names, scene));
    }
    expect([...sceneProblems(scene).entries()]).toEqual([]);
    const body = sceneToPython(scene).code.split("\n").map((l) => `        ${l}`).join("\n");
    const { game: g } = await load({
      code: {
        Hero: `def open_door():\n    global_vars.door = True\n\nclass Hero(GameObject):\n    def on_create(self):\n${body}\n`,
        Ghost: "class Ghost(GameObject):\n    pass\n",
      },
      sprites,
      instances: [{ object: "Hero", x: 100, y: 100 }],
    } as never);
    expect(py(g, "scene_playing()")).toBe(true);
    py(g, "scene_skip()");
    expect(py(g, "scene_playing()")).toBe(false);
    expect(py(g, "global_vars.door")).toBe(true);
  });

  it("Play once plays once, though the event happens again", async () => {
    const compiled = code([step("scene_wait", { steps: "1" })], "seen_x");
    const body = compiled.split("\n").map((l) => `        ${l}`).join("\n");
    const { game: g } = await load({ code: { Hero: `class Hero(GameObject):\n    def again(self):\n${body}\n` }, instances: [{ object: "Hero", x: 1, y: 1 }] } as never);
    py(g, "instances('Hero')[0].again()");
    expect(py(g, "scene_playing()")).toBe(true);
    run(g, 5);
    expect(py(g, "scene_playing()")).toBe(false);
    py(g, "instances('Hero')[0].again()");
    expect(py(g, "scene_playing()")).toBe(false);
  });

  const project = (scene: Scene) => ({ objects: [{ name: "Hero", events: [{ id: "e", key: { type: "create" }, mode: "scene", code: "", scene }] }], scripts: [], rooms: [] }) as unknown as Project;

  it("renaming a sprite or object reaches the scene's steps", () => {
    const s: Scene = { steps: [step("scene_sprite", { instance: `instances("Hero")[0]`, sprite: quote("Walk") })] };
    const p = project(s);
    replaceQuoted(p, "Walk", "Run");
    replaceQuoted(p, "Hero", "Star");
    expect(s.steps[0]!.args).toEqual({ instance: 'instances("Star")[0]', sprite: '"Run"' });
    renameInScene(s, (c) => c.replace("Run", "Jog"));
    expect(s.steps[0]!.args.sprite).toBe('"Jog"');
  });

  it("the project's undo leaves a scene as it is, as it does a sheet", () => {
    const before = project(emptyScene());
    const now = project({ steps: [step("scene_wait", {})] });
    const undone = keepCode(before, now);
    expect(undone.objects[0]!.events[0]!.scene!.steps.length).toBe(1);
  });

  it("a tutorial check can ask whether an event is a scene", () => {
    const p = project(emptyScene());
    expect(readCheck("Hero.create is in a scene")).toMatchObject({ kind: "mode", mode: "scene" });
    expect(checkProject(p, readCheck("Hero.create is in a scene"))?.ok).toBe(true);
  });
});
