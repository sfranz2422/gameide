/**
 * The tutorial series (series.ts) worked through as a student would: each
 * lesson from its own starter, each step's edits made, and then —
 *
 *   - every ```python block the step shows is in the game's code (so the
 *     words and the edits that build the next lesson's starter agree), and
 *   - every one of the step's checks passes, the ones that play the game
 *     in the real Pyodide.
 *
 * So a student who does what a step says is never locked on it, and the
 * next lesson opens on the game this one made.
 *
 * Starter sprites are painted on a canvas, which node hasn't got: here
 * they're empty pictures with their real sizes, which is all collisions need.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame, checkProject, readCheck } from "../checks/checks";
import { KEY_CODE } from "../engine/input";
import type { NetOut } from "../engine/game";
import { PythonGame } from "../python/bridge";
import { buildGame } from "../python/codegen";
import { TUTORIAL_STARTERS } from "../store/templates";
import { nodeRunner } from "./nodeRunner";
import { applyEdit, SERIES } from "./series";
import { parseTutorial } from "./tutorial";

vi.mock("../store/starterArt", async (original) => ({
  ...(await original<typeof import("../store/starterArt")>()),
  paintStarter: async () => [],
}));

const DIR = join(__dirname, "../../public/tutorials");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; starter: string }[];

/** A block's lines, without their indentation or blank lines. */
const lines = (code: string) => code.split("\n").map((l) => l.trim()).filter(Boolean);
/** Is `block` a run of whole lines somewhere in `code`, whatever the indentation? */
function contains(code: string, block: string) {
  const c = lines(code), b = lines(block);
  for (let i = 0; i + b.length <= c.length; i++) if (b.every((l, j) => c[i + j] === l)) return true;
  return false;
}

describe("tutorial series", () => {
  it("the Scene Mode lesson's game plays its cards once, when the two touch", { timeout: 60_000 }, async () => {
    const series = SERIES.find((s) => s.lessons.some((l) => l.key === "el3-scene-mode"))!;
    const n = series.lessons.findIndex((l) => l.key === "el3-scene-mode");
    const { project } = await TUTORIAL_STARTERS[`${series.name}-${n}`]!();
    for (const e of Object.values(series.lessons[n]!.edits)) applyEdit(project, e);
    const event = project.objects.find((o) => o.name === "Player")!.events.find((e) => e.mode === "scene")!;
    expect(event.code).toContain('scene_say("Follow me!", above=instances("Friend")[0])');
    const { game, error } = await PythonGame.load(buildGame(project, new Map()).def, { stdout: () => undefined, stderr: () => undefined, warning: () => undefined });
    expect(error).toBeFalsy();
    const py = (c: string) => game.evalPython(c) as never;
    const steps = (k: number) => {
      for (let i = 0; i < k; i++) expect(game.step()).toBeFalsy();
    };
    steps(1);
    py("scene_skip()"); // Lesson 13's scene, at the start of the level.
    steps(2);
    expect(py("scene_playing()")).toBe(false);
    py('p = instances("Player")[0]; f = instances("Friend")[0]; p.x, p.y = f.x, f.y');
    steps(2);
    expect(py("scene_playing()")).toBe(true);
    py("scene_skip()");
    expect(py("f.x")).toBe(400);
    // Put back on the friend: without Play once it would start again.
    py("p.x, p.y = f.x, f.y");
    steps(3);
    expect(py("scene_playing()")).toBe(false);
  });

  describe("the cutscene lesson's game", () => {
    const build = async () => {
      const series = SERIES.find((s) => s.lessons.some((l) => l.key === "el3-cutscenes"))!;
      const n = series.lessons.findIndex((l) => l.key === "el3-cutscenes");
      const { project } = await TUTORIAL_STARTERS[`${series.name}-${n}`]!();
      for (const e of Object.values(series.lessons[n]!.edits)) applyEdit(project, e);
      const { game, error } = await PythonGame.load(buildGame(project, new Map()).def, {
        stdout: () => undefined, stderr: () => undefined, warning: () => undefined,
      });
      expect(error).toBeFalsy();
      return {
        game,
        py: (c: string) => game.evalPython(c) as never,
        tap: (k: string, steps = 1) => {
          game.engine.input.keyDown(KEY_CODE.get(k)!);
          for (let i = 0; i < steps; i++) expect(game.step()).toBeFalsy();
          game.engine.input.keyUp(KEY_CODE.get(k)!);
          expect(game.step()).toBeFalsy();
        },
      };
    };

    it("plays from start to end, and leaves everyone where it says", { timeout: 60_000 }, async () => {
      const { game, py, tap } = await build();
      expect(game.step()).toBeFalsy();
      expect(py("scene_playing()")).toBe(true);
      for (let i = 0; i < 400 && py("scene_playing()"); i++) {
        for (let k = 0; k < 50; k++) expect(game.step()).toBeFalsy();
        tap("space");
      }
      expect(py("scene_playing()")).toBe(false);
      expect(py('instances("Player")[0].x')).toBeCloseTo(200);
      expect(py('instances("Friend")[0].x')).toBeCloseTo(240);
      expect(py('instances("Friend")[0].image_blend')).not.toBe(py('instances("Slime")[0].image_blend'));
      // The game's going again, and the camera is back on the player.
      const x = py('instances("Player")[0].x') as number;
      game.engine.input.keyDown(KEY_CODE.get("left")!);
      for (let k = 0; k < 30; k++) expect(game.step()).toBeFalsy();
      game.engine.input.keyUp(KEY_CODE.get("left")!);
      expect(py('instances("Player")[0].x') as number).toBeLessThan(x);
      expect(game.engine.camera.x).toBeLessThan(400);
    });

    it("plays only the first time: a room restart leaves it out", { timeout: 60_000 }, async () => {
      const { game, py, tap } = await build();
      expect(game.step()).toBeFalsy();
      tap("escape");
      expect(py("scene_playing()")).toBe(false);
      py("room_restart()");
      for (let k = 0; k < 3; k++) expect(game.step()).toBeFalsy();
      expect(py("scene_playing()")).toBe(false);
      expect(py('instances("Player")[0].x') as number).toBeLessThan(100);
    });

    it("Esc leaves everyone where the whole scene would", { timeout: 60_000 }, async () => {
      const { game, py, tap } = await build();
      expect(game.step()).toBeFalsy();
      tap("escape");
      expect(py('instances("Player")[0].x')).toBe(200);
      expect(py('instances("Friend")[0].x')).toBe(240);
    });
  });

  it("the leaderboard lesson's game sends the final score when the game ends", { timeout: 60_000 }, async () => {
    const series = SERIES.find((s) => s.lessons.some((l) => l.key === "el2-leaderboard"))!;
    const n = series.lessons.findIndex((l) => l.key === "el2-leaderboard");
    const { project } = await TUTORIAL_STARTERS[`${series.name}-${n}`]!();
    applyEdit(project, series.lessons[n]!.edits[1]!);
    const scores: number[] = [];
    const { game, error } = await PythonGame.load(buildGame(project, new Map()).def, {
      stdout: () => undefined, stderr: () => undefined, warning: () => undefined, score: (s) => scores.push(s),
    });
    expect(error).toBeFalsy();
    game.step();
    expect(scores).toEqual([]);
    game.evalPython('global_vars.score = 7; global_vars.best = 7; room_goto("GameOver")');
    game.step();
    game.step();
    expect(scores).toEqual([7]);
  });

  it("the online lesson's game, in a room: Player 1 alone is sent, a partner is drawn, their shots arrive", { timeout: 60_000 }, async () => {
    const series = SERIES.find((s) => s.lessons.some((l) => l.key === "el2-online"))!;
    const n = series.lessons.findIndex((l) => l.key === "el2-online");
    const { project } = await TUTORIAL_STARTERS[`${series.name}-${n}`]!();
    for (const e of Object.values(series.lessons[n]!.edits)) applyEdit(project, e);
    const nets: NetOut[] = [];
    const { def } = buildGame(project, new Map());
    const { game, error } = await PythonGame.load(
      { ...def, net: { code: "KXTD", number: 1, name: "Nia", state: {} } },
      { stdout: () => undefined, stderr: () => undefined, warning: () => undefined, net: (o) => nets.push(o) },
    );
    expect(error).toBeFalsy();
    const py = (c: string) => game.evalPython(c) as never;
    game.step();
    py('room_goto("Room1")');
    game.step();
    // One with no x yet (still on the title screen) is skipped, not an error.
    game.netArrive([{ number: 2, name: "Oli", state: { x: 100, y: 50, vx: 4, vy: 0 } }, { number: 3, name: "Ana", state: {} }], []);
    game.engine.input.keyDown(KEY_CODE.get("right")!);
    game.engine.input.keyDown(KEY_CODE.get("space")!);
    for (let i = 0; i < 3; i++) expect(game.step()).toBeFalsy();
    game.engine.input.keyUp(KEY_CODE.get("right")!);
    game.engine.input.keyUp(KEY_CODE.get("space")!);
    // What went out is Player 1, never Player 2 (which runs the same Step event), moving right.
    const p1 = py('[(p.x, p.y) for p in instances("Player") if p.pad == 0][0]') as [number, number];
    const sent = nets.map((o) => o.state).filter(Boolean).at(-1) as Record<string, number>;
    expect([sent.x, sent.y, sent.vx, sent.vy]).toEqual([p1[0], p1[1], 4, 0]);
    expect(nets.flatMap((o) => o.msgs ?? []).length).toBeGreaterThan(0);
    expect(py("[(p.name, round(p.draw_x)) for p in net_players() if p.draw_x is not None]")).toEqual([["Oli", expect.any(Number)]]);
    // A partner's shot is a bullet here.
    const before = py("instance_number('Bullet')") as number;
    game.netArrive(null, [{ from: 2, data: { x: 120, y: 60 }, age: 0 }]);
    expect(game.step()).toBeFalsy();
    expect(py("instance_number('Bullet')")).toBe(before + 1);
  });

  for (const series of SERIES) {
    it(`${series.name}: every lesson is listed, in order, starting from the lesson before`, () => {
      series.lessons.forEach((l, n) => {
        expect(index.find((t) => t.key === l.key)?.starter, l.key).toBe(`${series.name}-${n}`);
        expect(parseTutorial(readFileSync(join(DIR, `${l.key}.md`), "utf8")).meta.starter, l.key).toBe(`${series.name}-${n}`);
      });
    });

    series.lessons.forEach((lesson, n) => {
      it(`${lesson.key}: doing what each step says passes its checks`, { timeout: 180_000 }, async () => {
        const t = parseTutorial(readFileSync(join(DIR, `${lesson.key}.md`), "utf8"));
        const { project } = await TUTORIAL_STARTERS[`${series.name}-${n}`]!();
        const runner = nodeRunner(() => project);
        for (const [s, step] of t.steps.entries()) {
          const edit = lesson.edits[s];
          if (edit) applyEdit(project, edit);
          const code = [...project.objects.flatMap((o) => o.events.map((e) => e.code)), ...project.scripts.map((x) => x.code)].join("\n\n");
          for (const block of [...step.md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!))
            expect(contains(code, block), `${lesson.key} step ${s + 1} shows code the game doesn't have:\n${block}`).toBe(true);
          for (const c of step.checks) {
            const check = readCheck(c.label);
            expect(check.kind, `${lesson.key} step ${s + 1}: ${c.label}`).not.toBe("unknown");
            const r = checkProject(project, check) ?? (await checkGame(runner, check));
            expect(r, `${lesson.key} step ${s + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
          }
        }
        // A step that edits must exist, or its edits never reach the lessons after it.
        for (const s of Object.keys(lesson.edits).map(Number)) expect(s, `${lesson.key} edits step ${s + 1}`).toBeLessThan(t.steps.length);
      });
    });
  }
});
