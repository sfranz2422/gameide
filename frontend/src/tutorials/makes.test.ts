/**
 * The "Now You Can Make" tutorials (public/tutorials/make-*.md) done step by
 * step from an empty game, as a careful student would: each step's edits
 * made (with the code taken from that step's own ```python blocks, put
 * where its words say), and then —
 *
 *   - every block the step shows is in the game's code,
 *   - the step's checks didn't all pass before it (a check that passes on
 *     its own teaches nothing), and
 *   - every one of them passes after it, the ones that play the game in the
 *     real Pyodide.
 *
 * Starter sprites are painted on a canvas, which node hasn't got: here
 * they're empty pictures with their real sizes, which is all collisions need.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkGame, checkProject, readCheck, type Check } from "../checks/checks";
import { addStarterSprite, TUTORIAL_STARTERS } from "../store/templates";
import type { Project } from "../store/project";
import { nodeRunner } from "./nodeRunner";
import { applyEdit, type Edit } from "./series";
import { MAKE_LEVEL, parseTutorial, type Step } from "./tutorial";

vi.mock("../store/starterArt", async (original) => ({
  ...(await original<typeof import("../store/starterArt")>()),
  paintStarter: async () => [],
}));

const DIR = join(__dirname, "../../public/tutorials");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as { key: string; level: string; after?: string; starter: string }[];

/** The step's ```python blocks, in order. */
const blocks = (step: Step) => [...step.md.matchAll(/```python\n([\s\S]*?)```/g)].map((m) => m[1]!);
const lines = (code: string) => code.split("\n").map((l) => l.trim()).filter(Boolean);
function contains(code: string, block: string) {
  const c = lines(code), b = lines(block);
  for (let i = 0; i + b.length <= c.length; i++) if (b.every((l, j) => c[i + j] === l)) return true;
  return false;
}

type MakeStep = Edit & { sprites?: string[] };
/** For each tutorial, step number → what it does, given that step's python blocks and the game so far. */
type Steps = Record<number, (b: string[], code: (where: string) => string) => MakeStep>;

const MAKES: Record<string, Steps> = {
  "make-coin-rush": {
    1: () => ({ sprites: ["player"], objects: [{ name: "Player", sprite: "player" }], place: [{ object: "Player", x: 300, y: 220 }] }),
    2: ([move]) => ({ code: { "Player.step": move! } }),
    3: ([create]) => ({
      sprites: ["coin"],
      objects: [{ name: "Coin", sprite: "coin" }],
      place: [{ object: "Coin", x: 120, y: 100 }],
      code: { "Coin.create": create! },
    }),
    4: ([score, grab]) => ({ code: { "Player.create": score!, "Player.collision Coin": grab! } }),
    5: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    6: ([create, alarm, line], code) => ({
      code: { "Hud.create": create!, "Hud.alarm 0": alarm!, "Hud.draw_gui": code("Hud.draw_gui") + line! },
    }),
    7: ([top, shown], code) => ({ code: { "Player.step": top! + code("Player.step"), "Hud.draw_gui": code("Hud.draw_gui") + shown! } }),
  },
  "make-bomb-dodge": {
    1: ([move]) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      place: [{ object: "Player", x: 308, y: 440 }],
      code: { "Player.step": move! },
    }),
    2: ([create]) => ({ sprites: ["bomb"], objects: [{ name: "Bomb", sprite: "bomb" }], code: { "Bomb.create": create! } }),
    3: ([create, alarm]) => ({
      objects: [{ name: "Spawner", sprite: null }],
      place: [{ object: "Spawner", x: 0, y: 0 }],
      code: { "Spawner.create": create!, "Spawner.alarm 0": alarm! },
    }),
    4: ([create, step]) => ({ code: { "Player.create": create!, "Bomb.step": step! } }),
    5: ([hit]) => ({ code: { "Player.collision Bomb": hit! } }),
    6: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    7: ([top, spawn, shown], code) => {
      const alarm = code("Spawner.alarm 0");
      const make = 'instance_create(random.randint(8, room_width - 8), -10, "Bomb")\n';
      expect(alarm).toContain(make);
      return {
        code: {
          "Player.step": top! + code("Player.step"),
          "Spawner.alarm 0": alarm.replace(make, spawn!),
          "Hud.draw_gui": code("Hud.draw_gui") + shown!,
        },
      };
    },
    8: ([wait, speed], code) => {
      expect(code("Spawner.alarm 0")).toContain("self.alarm[0] = 30\n");
      return {
        code: {
          "Spawner.alarm 0": code("Spawner.alarm 0").replace("self.alarm[0] = 30\n", wait!),
          "Bomb.create": speed!,
        },
      };
    },
  },
  "make-busy-road": {
    1: ([hop]) => ({
      sprites: ["player"],
      objects: [{ name: "Player", sprite: "player" }],
      place: [{ object: "Player", x: 292, y: 452 }],
      code: { "Player.step": hop! },
    }),
    2: ([create, step]) => ({
      sprites: ["car"],
      objects: [{ name: "Car", sprite: "car" }],
      // Cars' middles on rows 3 to 12; some lanes with two, gaps between.
      place: [3, 4, 5, 7, 8, 10, 12, 12].map((row, i) => ({ object: "Car", x: 60 + ((i * 170) % 560), y: row * 32 + 16 })),
      code: { "Car.create": create!, "Car.step": step! },
    }),
    3: ([create]) => ({ code: { "Car.create": create! } }),
    4: ([create, hit]) => ({ code: { "Player.create": create!, "Player.collision Car": hit! } }),
    5: ([across], code) => ({ code: { "Player.step": code("Player.step") + across! } }),
    6: ([draw]) => ({ objects: [{ name: "Hud", sprite: null }], place: [{ object: "Hud", x: 0, y: 0 }], code: { "Hud.draw_gui": draw! } }),
    7: ([top, shown], code) => ({ code: { "Player.step": top! + code("Player.step"), "Hud.draw_gui": code("Hud.draw_gui") + shown! } }),
    8: ([faster], code) => ({ code: { "Car.step": code("Car.step") + faster! } }),
  },
};

/** An event's code in the game so far ("Object.event", as Edit names them), "" if there's none. */
function codeOf(p: Project, where: string) {
  const [name, ev] = [where.slice(0, where.indexOf(".")), where.slice(where.indexOf(".") + 1)];
  const obj = p.objects.find((o) => o.name === name);
  const [type, arg] = ev.split(" ");
  const e = obj?.events.find((x) =>
    x.key.type === type &&
    (type !== "alarm" || (x.key as { n: number }).n === Number(arg)) &&
    (type !== "collision" || (x.key as { object: string }).object === p.objects.find((o) => o.name === arg)?.id));
  return e?.code ?? "";
}

async function passes(p: Project, runner: ReturnType<typeof nodeRunner>, check: Check) {
  const quick = checkProject(p, check);
  if (quick) return quick.ok;
  try {
    return (await checkGame(runner, check)).ok;
  } catch {
    return false;
  }
}

describe("Now You Can Make", () => {
  it("every one is listed after a shelf that's on the Learn page, and starts from an empty game", () => {
    const makes = index.filter((t) => t.level === MAKE_LEVEL);
    expect(makes.map((t) => t.key).sort()).toEqual(Object.keys(MAKES).sort());
    const shelves = new Set(index.filter((t) => t.level !== MAKE_LEVEL).map((t) => t.level));
    for (const t of makes) {
      expect(shelves.has(t.after ?? ""), `${t.key} comes after "${t.after}"`).toBe(true);
      const meta = parseTutorial(readFileSync(join(DIR, `${t.key}.md`), "utf8")).meta;
      expect(meta.after, t.key).toBe(t.after);
      expect(meta.starter, t.key).toBe("empty");
    }
  });

  for (const [key, steps] of Object.entries(MAKES)) {
    it(`${key}: doing what each step says passes its checks, and they didn't pass before`, { timeout: 300_000 }, async () => {
      const t = parseTutorial(readFileSync(join(DIR, `${key}.md`), "utf8"));
      const { project } = await TUTORIAL_STARTERS.empty!();
      const runner = nodeRunner(() => project);
      for (const [s, step] of t.steps.entries()) {
        const checks = step.checks.map((c) => ({ label: c.label, check: readCheck(c.label) }));
        for (const c of checks) expect(c.check.kind, `${key} step ${s + 1}: ${c.label}`).not.toBe("unknown");
        const real = checks.filter((c) => c.check.kind !== "runs");
        if (real.length) {
          const before = await Promise.all(real.map((c) => passes(project, runner, c.check)));
          expect(before.every(Boolean), `${key} step ${s + 1} "${step.title}" passes before it's done`).toBe(false);
        }
        const make = steps[s];
        if (make) {
          const edit = make(blocks(step), (where) => codeOf(project, where));
          for (const sprite of edit.sprites ?? []) await addStarterSprite(project, new Map(), sprite);
          applyEdit(project, edit);
        }
        const code = project.objects.flatMap((o) => o.events.map((e) => e.code)).join("\n\n");
        for (const block of blocks(step)) expect(contains(code, block), `${key} step ${s + 1} shows code the game doesn't have:\n${block}`).toBe(true);
        for (const c of checks) {
          const r = checkProject(project, c.check) ?? (await checkGame(runner, c.check));
          expect(r, `${key} step ${s + 1} "${step.title}": ${c.label}`).toEqual({ ok: true, detail: "" });
        }
      }
      runner.stop();
    });
  }
});
