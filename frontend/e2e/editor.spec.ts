/**
 * The editor, driven like a student would: real clicks and keys in
 * Chromium, the game running in its worker. These are the only checks on
 * the React UI, the worker and the watchdog, so each one names the thing
 * it would catch.
 */
import { expect, test } from "@playwright/test";

import { fromTemplate, nameBox, placeInRoom, playAndWait, py, setCode, SHOTS, treeItem, watchErrors } from "./helpers";

test("a game built from an empty project runs", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");

  await page.getByTestId("add-sprites").click();
  await page.getByTestId("starter-player").click();
  await expect(treeItem(page, "player")).toBeVisible();

  await page.getByTestId("add-objects").click();
  await nameBox(page).fill("Hero");
  await nameBox(page).press("Enter");
  await expect(treeItem(page, "Hero")).toBeVisible();
  await page.getByTestId("object-sprite").selectOption({ label: "player" });

  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-create").click();
  await setCode(page, 'print("hello from", self.object_name)\nself.hspeed = 2\n');

  await placeInRoom(page, "Room1 start", "Hero", 320, 224);

  await playAndWait(page);
  await expect(page.getByTestId("console")).toContainText("hello from Hero");
  const x1 = (await py(page, "instances('Hero')[0].x")) as number;
  await page.waitForTimeout(500);
  expect((await py(page, "instances('Hero')[0].x")) as number).toBeGreaterThan(x1 + 20);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/built.png` });
  expect(errors).toEqual([]);
});

test("an error names the event and line, and clicking it goes there", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Step").click();
  await setCode(page, "self.x += 1\nself.x += spead\n");
  await page.getByTestId("play").click();
  const where = page.getByTestId("error-where");
  await expect(where).toHaveText("Player → Step, line 2");
  await expect(page.getByTestId("console")).toContainText("NameError: name 'spead' is not defined");

  // Go somewhere else, then follow the error back.
  await treeItem(page, "Wall").click();
  await where.click();
  await expect(page.getByTestId("event-code")).toBeVisible();
  await expect(page.locator(".event-list li.active")).toHaveText(/Step/);
  await expect(page.locator(".cm-error-line")).toHaveText("self.x += spead");
  // Typing the fix must stay where it is typed, not jump back to the line.
  await page.keyboard.press("End");
  await page.keyboard.type(" # fixed");
  await expect(page.getByTestId("event-code").locator(".cm-line").nth(1)).toHaveText("self.x += spead # fixed");
});

test("an endless loop is stopped at its line, and the next Play works", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Step").click();
  await setCode(page, "x = 0\nwhile True:\n    x += 1\n");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("error-where")).toHaveText(/Player → Step, line [23]/, { timeout: 10_000 });
  await expect(page.getByTestId("console")).toContainText("stopped responding");

  await setCode(page, "self.x += 0\n");
  await playAndWait(page);
});

test("without shared memory, an endless loop still can't freeze the page", async ({ page }) => {
  await fromTemplate(page, "coins", "?nointerrupt");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Step").click();
  await setCode(page, "while True:\n    pass\n");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("console")).toContainText("can't say which line", { timeout: 15_000 });
  // The worker was replaced; Python reloads and the next game runs.
  await setCode(page, "pass\n");
  await playAndWait(page);
});

test("work is saved and comes back after a reload", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, "self.move_speed = 4\nself.lives = 9\n");
  await expect(page.getByTestId("save-status")).toHaveText("Saving…");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.reload();
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await expect(page.getByTestId("event-code")).toContainText("self.lives = 9");
});

// The autosave waits a moment after the last keystroke. Closing the tab in
// that moment must not lose the keystroke: the page keeps a copy in
// localStorage as it goes, and the next load prefers it.
test("an edit made just before the page closes is not lost", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, "self.move_speed = 4\nself.last_second = True\n");
  await page.reload(); // at once — the delayed save has not happened
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await expect(page.getByTestId("event-code")).toContainText("self.last_second = True");
});

test("renaming an object can update its name in quotes", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "coins");
  page.on("dialog", (d) => void d.accept());
  await treeItem(page, "Coin").dblclick();
  await nameBox(page).fill("Gem");
  await nameBox(page).press("Enter");
  await treeItem(page, "Hud").click();
  await page.getByTestId("event-Game Start").click();
  await expect(page.getByTestId("event-code")).toContainText('instance_number("Gem")');
  // The collision event follows the object by id, so the game still works.
  await treeItem(page, "Player").click();
  await expect(page.getByTestId("event-Collision with Gem")).toBeVisible();
  await playAndWait(page);
  expect(await py(page, "global_vars.total")).toBe(15);
  expect(errors).toEqual([]);
});

test("autocomplete offers object names inside the quotes", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Step").click();
  await setCode(page, "");
  await page.keyboard.type('place_meeting(self.x, self.y, "W');
  await expect(page.locator(".cm-tooltip-autocomplete")).toContainText("Wall");
});

test("the stress test runs 300+ instances, and a second Play starts fast", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "stress");
  await playAndWait(page);
  await page.waitForTimeout(2500);
  expect((await py(page, "instance_number('Ball')")) as number).toBeGreaterThanOrEqual(300);
  const fps = Number(await page.getByTestId("fps").textContent());
  console.log(`stress: ${fps} steps/s in headless Chromium`);
  expect(fps).toBeGreaterThan(20);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stress2.png` });

  await page.getByTestId("stop").click();
  const t0 = Date.now();
  await playAndWait(page);
  console.log(`second Play: ${Date.now() - t0} ms`);
  expect(Date.now() - t0).toBeLessThan(3000);
  expect(errors).toEqual([]);
});

test("a game exported as a .zip imports as a new game that plays", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "coins");
  const download = page.waitForEvent("download");
  await page.getByTestId("export-zip").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Collect-the-coins.zip");
  const path = await file.path();

  await page.goto("/");
  await page.getByTestId("import-file").setInputFiles(path!);
  await page.waitForURL(/#\/p\//);
  await expect(page.getByRole("textbox", { name: "Game name" })).toHaveValue("Collect the coins (imported)");
  await expect(treeItem(page, "coin")).toBeVisible();
  await playAndWait(page);
  expect(await py(page, "instance_number('Coin')")).toBe(15);
  expect(errors).toEqual([]);
});

test("importing something that isn't a game says so", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("import-file").setInputFiles({ name: "notes.zip", mimeType: "application/zip", buffer: Buffer.from("not a zip") });
  await expect(page.getByRole("alert")).toHaveText("That isn't a .zip file GameIDE can open.");
});

test("undo reaches across tabs, never undoes typing, and brings back a deleted object", async ({ page }) => {
  await fromTemplate(page, "coins");
  page.on("dialog", (d) => void d.accept());
  // 1. Change the Player's sprite.
  await treeItem(page, "Player").click();
  await page.getByTestId("object-sprite").selectOption({ label: "wall" });
  // 2. In another tab, place a wall.
  await placeInRoom(page, "Maze start", "Wall", 320, 32);
  // 3. Back in the Player, type some code after both changes.
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, "self.move_speed = 4\nself.typed_after = True\n");
  // Undo twice, from the top bar: the wall, then the sprite.
  await page.getByTestId("undo").click();
  await page.getByTestId("undo").click();
  await expect(page.getByTestId("object-sprite").locator("option:checked")).toHaveText("player");
  await expect(page.getByTestId("event-code")).toContainText("self.typed_after = True");
  await page.getByTestId("redo").click();
  await expect(page.getByTestId("object-sprite").locator("option:checked")).toHaveText("wall");

  // Delete Coin — which takes its 15 instances and the Player's collision event — then undo.
  await treeItem(page, "Coin").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(treeItem(page, "Coin")).toHaveCount(0);
  await page.getByTestId("undo").click();
  await expect(treeItem(page, "Coin")).toBeVisible();
  await playAndWait(page);
  expect(await py(page, "instance_number('Coin')")).toBe(15);
});
