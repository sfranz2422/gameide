/**
 * The second showcase game, The Lantern of Greymire, played headless in the
 * real Pyodide: every page drawn, the whole journey to the best ending
 * played by keys, a duel fought, and Rewind. Runs only when the game has
 * been built (python3 showcase/greymire/build.py, which needs the teacher's
 * pictures); skipped otherwise.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildGame } from "../python/codegen";
import { PythonGame } from "../python/bridge";
import { KEY_CODE } from "../engine/input";
import type { Project } from "../store/project";

const BUILT = resolve(__dirname, "../../../showcase/greymire/out/project.json");
const have = existsSync(BUILT);

async function start() {
  const project = JSON.parse(readFileSync(BUILT, "utf8")) as Project;
  const { def } = buildGame(project, new Map());
  const warnings: string[] = [];
  const { game, error } = await PythonGame.load(def, { stdout: () => undefined, stderr: () => undefined, warning: (s) => warnings.push(s) });
  if (error) throw new Error(`${error.object} ${error.event} line ${error.line}: ${error.message}`);
  step(game, 2);
  return { game, warnings };
}

function step(game: PythonGame, n = 1) {
  for (let i = 0; i < n; i++) {
    const e = game.step();
    if (e) throw new Error(`Python error: ${e.object} ${e.event} line ${e.line}: ${e.message}\n${e.traceback}`);
  }
}

const py = (g: PythonGame, expr: string) => g.evalPython(expr) as never;
const press = (g: PythonGame, k: string) => {
  g.engine.input.keyDown(KEY_CODE.get(k)!);
  step(g, 1);
  g.engine.input.keyUp(KEY_CODE.get(k)!);
  step(g, 1);
};
const where = (g: PythonGame) => py(g, "f\"{STATE['mode']}:{STATE['page']}\"") as string;
/** On a page: Enter shows it whole, then a number takes that choice. */
const take = (g: PythonGame, n: number) => {
  press(g, "enter");
  press(g, String(n));
  step(g, 2);
};
/** On the map: the place that many to the right of the first, then walk there. */
const goTo = (g: PythonGame, rights: number) => {
  for (let i = 0; i < rights; i++) press(g, "right");
  press(g, "enter");
  for (let i = 0; i < 3000 && py(g, "STATE['mode']") === "map"; i++) step(g, 1);
  step(g, 2);
};
const words = (g: PythonGame) => g.engine.guiList.filter((c) => c[0] === "text").map((c) => c[4] as string).join("\n");

describe.skipIf(!have)("The Lantern of Greymire", () => {
  it("draws every page, whole, without an error or a warning", async () => {
    const { game, warnings } = await start();
    const pages = py(game, "list(PAGES)") as string[];
    expect(pages.length).toBeGreaterThan(50);
    for (const key of pages) {
      py(game, `new_journey(); STATE.update(mode="page", page=${JSON.stringify(key)}); instances("Book")[0].mode = "page"`);
      step(game, 2);
      press(game, "enter");
      step(game, 1);
      // Its first word and its last: all of it typed, none of it lost.
      const [first, last] = py(game, `(lambda w: [w[0], w[-1]])(curly(PAGES[${JSON.stringify(key)}]["text"]).split())`) as string[];
      expect(words(game), key).toContain(first);
      expect(words(game), key).toContain(last);
    }
    expect(warnings).toEqual([]);
    // Book quotes, opening and closing, where the story typed plain ones.
    py(game, `STATE.update(mode="page", page="marrow")`);
    step(game, 2);
    press(game, "enter");
    expect(words(game)).toContain("\u201cA");
    expect(words(game)).toContain("lantern-bearer,\u201d");
  });

  it("plays from the title to the best ending by keys alone", async () => {
    const { game } = await start();
    press(game, "enter"); // Begin the journey
    step(game, 2);
    expect(where(game)).toBe("page:intro");
    take(game, 1); // take up the lantern
    expect(where(game)).toBe("map:intro");
    goTo(game, 0); // Marrow's Landing
    take(game, 1); // knock
    take(game, 1); // pay two gold
    expect(where(game)).toBe("page:ferry_paid");
    take(game, 1);
    goTo(game, 1); // the reeds
    take(game, 4); // the dark path
    take(game, 1); // pick up the horse
    take(game, 1);
    goTo(game, 2); // the willow
    take(game, 1);
    take(game, 1); // give Pip the horse
    expect(py(game, "has('pip') and not has('horse')")).toBe(true);
    take(game, 1);
    goTo(game, 3); // the toll-bridge
    take(game, 1);
    take(game, 2); // the riddle
    take(game, 1); // a river
    expect(where(game)).toBe("page:gallow_right");
    take(game, 1);
    goTo(game, 4); // the chapel
    take(game, 1); // Gallow's feather
    take(game, 1);
    take(game, 1);
    take(game, 1); // press the faces
    take(game, 2); // the moon
    take(game, 2); // the fish
    take(game, 1); // the sun
    expect(where(game)).toBe("page:door_open");
    take(game, 1); // the clapper
    take(game, 1);
    goTo(game, 5); // Saltmere
    take(game, 1); // Marrow's whistle
    expect(where(game)).toBe("page:crossing_marrow");
    take(game, 1);
    take(game, 1); // Pip's alley
    take(game, 1);
    take(game, 1); // Pip steps out
    take(game, 1); // ring the bell
    expect(where(game)).toBe("end:together");
    expect(py(game, "STATE['stamina']")).toBe(10);
    expect(py(game, "save_get('endings')")).toEqual(["together"]);
  });

  it("a duel: blows decided by who puts in more, then on to what comes of it", async () => {
    const { game } = await start();
    py(game, `new_journey(); start_duel("gallow"); instances("Book")[0].mode = "duel"`);
    step(game, 2);
    expect(words(game)).toContain("Gallow");
    // The three ways a round goes, with Gallow's blow fixed: more lands, less is landed on, the same locks.
    const round = (his: number, mine: number, had = 5) =>
      py(game, `STATE['duel'].update(plan=${his}, mine=${had}, str=4, hp=8, over=None); STATE['stamina'] = 10; strike(${mine}); [STATE['stamina'], STATE['duel']['hp'], STATE['duel']['mine']]`) as number[];
    expect(round(2, 3)).toEqual([10, 6, 3]); // 5 - 3 spent + 1 back
    expect(round(1, 4)).toEqual([10, 5, 2]); // three more: a harder blow
    expect(round(3, 1)).toEqual([8, 8, 5]);
    expect(round(2, 2)).toEqual([10, 8, 4]);
    expect(round(2, 0, 2)).toEqual([8, 8, 4]); // held back: two strength back, not one
    expect(round(2, 0)).toEqual([8, 8, 5]); // …but never more than five
    // At full strength: all six choices, every one on the sheet.
    py(game, `start_duel("gallow"); STATE['duel']['mine'] = 5`);
    step(game, 2);
    press(game, "enter");
    step(game, 1);
    const rows = py(game, `instances("Book")[0].rows`) as number[][];
    expect(rows.length).toBe(6);
    expect(rows.at(-1)![1]).toBeLessThanOrEqual(700);
    py(game, `start_duel("gallow")`);
    step(game, 2);
    for (let round = 0; round < 40 && !py(game, "STATE['duel']['over']"); round++) {
      const before = py(game, "[STATE['stamina'], STATE['duel']['hp'], STATE['duel']['plan'], STATE['duel']['mine']]") as number[];
      const n = Math.min(before[3]!, 3);
      take(game, n + 1); // "Hold back" is 1, then 1 strength, 2…
      const after = py(game, "[STATE['stamina'], STATE['duel']['hp']]") as number[];
      if (n > before[2]!) expect(after[1]).toBeLessThan(before[1]!);
      else if (n < before[2]!) expect(after[0]).toBeLessThan(before[0]!);
      else expect(after).toEqual(before.slice(0, 2));
    }
    const won = py(game, "STATE['duel']['over']") === "win";
    take(game, 1); // Go on
    expect(where(game)).toBe(won ? "page:gallow_beaten" : "page:gallow_won");
    if (!won) expect(py(game, "STATE['stamina']")).toBe(3); // beaten, not killed
  });

  it("Rewind goes back to before the last choice", async () => {
    const { game } = await start();
    press(game, "enter");
    take(game, 1);
    goTo(game, 0);
    take(game, 1); // knock
    take(game, 1); // pay
    expect(py(game, "STATE['gold']")).toBe(3);
    press(game, "backspace");
    step(game, 2);
    expect(where(game)).toBe("page:marrow");
    expect(py(game, "STATE['gold']")).toBe(5);
  });

  it("out of stamina, the lantern goes out; Rewind from there", async () => {
    const { game } = await start();
    press(game, "enter");
    take(game, 1);
    goTo(game, 0);
    py(game, "STATE['stamina'] = 2");
    take(game, 2); // take the ferry yourself
    take(game, 3); // push off anyway: -2
    expect(where(game)).toBe("end:dark");
    take(game, 2); // Rewind, and try another way
    expect(where(game)).toBe("page:steal");
  });
});
