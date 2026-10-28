/**
 * The build itself. Runs after `npm run build` like the rest of the editor
 * suite, and reads dist/ — no page.
 */
import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";

// A chunk that imports the game worker's own script makes Safari run the
// worker a second time inside itself (Chrome reuses it): Pixi's extensions
// registered twice, "Extension type texture-source already has a handler",
// and every published game a black screen on an iPhone. It happened when
// Pixi was left to import its worker extensions itself (gameWorker.ts).
test("nothing in the build imports the game worker's own script", () => {
  const dir = `${process.cwd()}/dist/assets`;
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  const worker = files.find((f) => f.startsWith("gameWorker-"));
  expect(worker).toBeTruthy();
  const importers = files.filter((f) => f !== worker && readFileSync(`${dir}/${f}`, "utf8").includes(`./${worker}`));
  expect(importers).toEqual([]);
});
