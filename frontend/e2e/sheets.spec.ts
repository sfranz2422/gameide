/**
 * Event sheets, as a student uses them: add rows, pick conditions and
 * actions, type into their boxes, watch the Python beside them, and play.
 */
import { expect, test, type Page } from "@playwright/test";
import { nameBox, placeInRoom, playAndWait, py, screenAt, SHOTS, treeItem, watchErrors, fromTemplate } from "./helpers";

async function newObjectWithEvent(page: Page, name: string, event = "pick-step") {
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill(name);
  await nameBox(page).press("Enter");
  await expect(treeItem(page, name)).toBeVisible();
  await page.getByTestId("add-event").click();
  await page.getByTestId(event).click();
}

const python = (page: Page) => page.getByTestId("sheet-code").locator(".cm-content");

async function emptyGame(page: Page) {
  await fromTemplate(page, "empty");
}

/** Replaces what's in a box (the nth with this label) with `text`. */
async function typeIn(page: Page, label: string, text: string, nth = 0) {
  const box = page.getByTestId(`box-${label}`).nth(nth);
  await box.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
}

const lines = (...l: string[]) => l.join("");

test("a sheet builds an event, its Python shows beside it, and the game runs it", async ({ page }) => {
  const errors = watchErrors(page);
  await emptyGame(page);
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("starter-player").click();
  await expect(treeItem(page, "player")).toBeVisible();
  await newObjectWithEvent(page, "Mover");
  await page.getByTestId("object-sprite").selectOption({ label: "player" });
  await page.getByTestId("tab-sheet").click();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-condition").click();
  await page.getByTestId("pick-keyboard_check").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-set").click();
  // Inside a name parameter's quotes, the box suggests names (keys here).
  await page.getByTestId("box-key").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type('"spa');
  await expect(page.locator(".cm-tooltip-autocomplete")).toContainText("space");
  await page.keyboard.press("Escape");
  await typeIn(page, "key", '"right"');
  await typeIn(page, "value", "6");
  await expect(python(page)).toHaveText(lines('if keyboard_check("right"):', "    self.x += 6"));
  await expect(page.getByTestId("event-Step").locator(".event-empty")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sheet.png` });

  await placeInRoom(page, "Room1 start", "Mover", 100, 100);
  await playAndWait(page);
  const x0 = (await py(page, "instances('Mover')[0].x")) as number;
  await page.waitForTimeout(300);
  expect(await py(page, "instances('Mover')[0].x")).toBe(x0); // no key, no move
  await page.locator("canvas[data-testid=game-canvas]").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowRight");
  expect((await py(page, "instances('Mover')[0].x")) as number).toBeGreaterThan(x0 + 30);
  expect(errors).toEqual([]);
});

test("rows nest; else, for each and comments; a box that isn't Python is marked", async ({ page }) => {
  await emptyGame(page);
  await newObjectWithEvent(page, "Mover");
  await page.getByTestId("tab-sheet").click();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-condition").click();
  await page.getByTestId("pick-compare").click();
  await typeIn(page, "left", "self.lives");
  await typeIn(page, "right", "1");
  // A sub-event under it, and an Else after it.
  await page.getByTestId("sheet-row-menu").first().click();
  await page.getByTestId("sheet-sub").click();
  await page.getByTestId("add-action").nth(1).click();
  await page.getByTestId("pick-room_restart").click();
  await page.getByTestId("sheet-row-menu").first().click();
  await page.getByTestId("sheet-else").click();
  await page.getByTestId("add-action").nth(2).click();
  await page.getByTestId("pick-code").click();
  await typeIn(page, "line", "self.hspeed = 2");
  await page.getByTestId("sheet-add-foreach").click();
  await page.getByTestId("sheet-add-comment").click();
  await page.getByLabel("Comment").fill("the end");
  // The sub-event has no conditions, so its action simply runs under the row's if.
  await expect(python(page)).toHaveText(
    lines("if self.lives < 1:", "    room_restart()", "else:", "    self.hspeed = 2", 'for e in instances("Mover"):', "    pass", "# the end"),
  );
  // Not Python: marked, and its tooltip says why.
  await typeIn(page, "right", "1 +");
  await expect(page.locator(".expr-box.bad")).toHaveAttribute("title", "This isn't a Python value.");
});

test("Python never becomes a sheet; a sheet becomes Python once, after a warning", async ({ page }) => {
  await emptyGame(page);
  await newObjectWithEvent(page, "Thing", "pick-create");
  await page.getByTestId("event-code").locator(".cm-content").click();
  await page.keyboard.insertText("self.x = 1");
  await expect(page.getByTestId("tab-sheet")).toBeDisabled();

  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void (dialogs.length === 1 ? d.dismiss() : d.accept());
  });
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await page.getByTestId("tab-sheet").click();
  // Empty: back to Python (or on to Blocks) without asking.
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("event-code")).toBeVisible();
  expect(dialogs).toEqual([]);
  await page.getByTestId("tab-sheet").click();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-set").click();
  // Something on the sheet: Blocks is closed to it, Python asks.
  await expect(page.getByTestId("tab-blocks")).toBeDisabled();
  await page.getByTestId("convert-to-python").click();
  expect(dialogs[0]).toContain("can't be turned back into a sheet");
  await expect(page.getByTestId("sheet")).toBeVisible();
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("event-code")).toContainText("self.x += 4");
  await expect(page.getByTestId("tab-sheet")).toBeDisabled();
});

test("an error lands on the row and the action that made it", async ({ page }) => {
  await emptyGame(page);
  await newObjectWithEvent(page, "Mover");
  await page.getByTestId("tab-sheet").click();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-set").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-code").click();
  await typeIn(page, "line", "self.lives -= 1");
  await expect(python(page)).toHaveText(lines("self.x += 4", "self.lives -= 1"));
  await placeInRoom(page, "Room1 start", "Mover", 100, 100);
  await page.getByTestId("play").click();
  const where = page.getByTestId("error-where");
  await expect(where).toHaveText("Mover → Step, line 2");
  await where.click();
  await expect(page.locator(".sheet-chip.error")).toHaveCount(1);
  await expect(page.locator(".sheet-chip.error")).toContainText("self.lives -= 1");
  await expect(page.locator(".blocks-python .cm-error-line")).toHaveText("self.lives -= 1");
});

test("Ctrl+Z on the sheet undoes the sheet; elsewhere the project, leaving the sheet alone", async ({ page }) => {
  await emptyGame(page);
  await newObjectWithEvent(page, "Mover");
  await page.getByTestId("tab-sheet").click();
  await page.getByRole("checkbox", { name: "Solid" }).check();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-set").click();
  // Typed key by key: still one undo step.
  await page.getByTestId("box-value").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("97");
  await expect(python(page)).toHaveText("self.x += 97");

  // Typing in a box is one step; undo it, then the action itself.
  await page.locator(".sheet-rows").click({ position: { x: 5, y: 200 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(python(page)).toHaveText("self.x += 4");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(python(page)).toHaveText("");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(python(page)).toHaveText("self.x += 4");
  await expect(page.getByRole("checkbox", { name: "Solid" })).toBeChecked();

  // Elsewhere: the project's undo — the Solid tick — and the sheet stays.
  await page.locator(".event-list-head").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("checkbox", { name: "Solid" })).not.toBeChecked();
  await expect(python(page)).toHaveText("self.x += 4");

  await page.reload();
  await treeItem(page, "Mover").click();
  await expect(python(page)).toHaveText("self.x += 4", { timeout: 20_000 });
});

test("creation code can be a sheet, and renaming reaches its boxes", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => void d.accept());
  await emptyGame(page);
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("starter-coin").click();
  await expect(treeItem(page, "coin")).toBeVisible();
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill("Gem");
  await nameBox(page).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "coin" });
  await placeInRoom(page, "Room1 start", "Gem", 128, 96);
  const at = await screenAt(page, 128, 96);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("creation-tab-sheet").click();
  await expect(page.getByRole("dialog", { name: "Creation code for Gem" })).toBeVisible();
  await page.getByTestId("sheet-add-row").click();
  await page.getByTestId("add-condition").click();
  await page.getByTestId("pick-instance_exists").click();
  await page.getByTestId("add-action").click();
  await page.getByTestId("pick-set").click();
  await typeIn(page, "target", "self.lives");
  await page.locator(".sheet-chip.act select").selectOption("=");
  await typeIn(page, "value", "3");
  await expect(python(page)).toHaveText(lines('if instance_exists("Gem"):', "    self.lives = 3"));
  await page.getByTestId("close-creation-blocks").click();
  await expect(page.getByTestId("creation-code-python")).toContainText("self.lives = 3");

  await treeItem(page, "Gem").focus();
  await page.keyboard.press("F2");
  await nameBox(page).fill("Ruby");
  await nameBox(page).press("Enter");
  await expect(page.getByTestId("creation-code-python")).toContainText('instance_exists("Ruby")');
  // The sheet itself was renamed too: opening it doesn't write the old name back.
  await page.getByTestId("edit-creation-blocks").click();
  await expect(python(page)).toHaveText(lines('if instance_exists("Ruby"):', "    self.lives = 3"));
  await page.getByTestId("close-creation-blocks").click();
  await expect(page.getByTestId("creation-code-python")).toContainText('instance_exists("Ruby")');
  await playAndWait(page);
  expect(await py(page, "instances('Ruby')[0].lives")).toBe(3);
  expect(errors).toEqual([]);
});

test("rows move by drag and drop: before, after, into a row as a sub-event, and out to the end", async ({ page }) => {
  await emptyGame(page);
  await newObjectWithEvent(page, "Mover");
  await page.getByTestId("tab-sheet").click();
  for (const [i, line] of ["self.a = 1", "self.b = 2"].entries()) {
    await page.getByTestId("sheet-add-row").click();
    await page.getByTestId("add-action").nth(i).click();
    await page.getByTestId("pick-code").click();
    await typeIn(page, "line", line, i);
  }
  await expect(python(page)).toHaveText(lines("self.a = 1", "self.b = 2"));
  const rows = page.getByTestId("sheet-row");
  const grip = (n: number) => page.getByTestId("sheet-grip").nth(n);
  const at = async (n: number, fraction: number) => {
    const b = (await rows.nth(n).boundingBox())!;
    return { x: b.width / 2, y: b.height * fraction };
  };

  // b onto the top of a: before it.
  await grip(1).dragTo(rows.nth(0), { targetPosition: await at(0, 0.1) });
  await expect(python(page)).toHaveText(lines("self.b = 2", "self.a = 1"));
  // b (now first) into the middle of a: a sub-event of a. With no conditions on a, it simply runs after a's action.
  await page.getByTestId("add-condition").nth(1).click();
  await page.getByTestId("pick-compare").click();
  await grip(0).dragTo(rows.nth(1), { targetPosition: await at(1, 0.5) });
  await expect(python(page)).toHaveText(lines("if self.x < 0:", "    self.a = 1", "    self.b = 2"));
  // b can't go into itself; out to the end of the sheet instead, below the last row.
  const area = (await page.getByTestId("sheet-rows").boundingBox())!;
  await grip(1).dragTo(page.getByTestId("sheet-rows"), { targetPosition: { x: 40, y: area.height - 10 } });
  await expect(python(page)).toHaveText(lines("if self.x < 0:", "    self.a = 1", "self.b = 2"));
  // A drag is one undo step.
  await page.locator(".sheet-rows").click({ position: { x: 5, y: area.height - 5 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(python(page)).toHaveText(lines("if self.x < 0:", "    self.a = 1", "    self.b = 2"));
});
