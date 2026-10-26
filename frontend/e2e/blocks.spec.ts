/**
 * Code blocks, as a student uses them: drag blocks from the palette under
 * an event's hat, watch the Python appear beside them, play the game, and
 * convert to Python.
 */
import { expect, test, type Page } from "@playwright/test";
import { nameBox, placeInRoom, playAndWait, py, screenAt, SHOTS, treeItem, watchErrors } from "./helpers";

async function newObjectWithEvent(page: Page, name: string, event = "pick-step") {
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill(name);
  await nameBox(page).press("Enter");
  await expect(treeItem(page, name)).toBeVisible();
  await page.getByTestId("add-event").click();
  await page.getByTestId(event).click();
}

const category = (page: Page, name: string) => page.getByTestId("blocks-workspace").getByRole("treeitem", { name, exact: true }).click();
const fromPalette = (page: Page, text: string | RegExp) => page.locator(".blocklyFlyout .blocklyDraggable").filter({ hasText: text }).first();
const onCanvas = (page: Page, text: string | RegExp) => mainCanvas(page).locator(".blocklyDraggable").filter({ hasText: text }).first();
/** The hat: the workspace's first block, whatever it says ("def on_step(self):", "creation code: …"). */
const hat = (page: Page) => mainCanvas(page).locator(":scope > .blocklyDraggable").first();

/**
 * Where a block is, once it has stopped moving. A palette is still being
 * laid out just after its category opens, and a dropped block may still be
 * settling: a position read too early made a drag grab empty space, now and
 * then, under the load of the whole suite.
 */
async function settled(block: ReturnType<typeof fromPalette>) {
  let last = (await block.boundingBox())!;
  for (let i = 0; i < 20; i++) {
    await block.page().waitForTimeout(50);
    const now = (await block.boundingBox())!;
    if (now.x === last.x && now.y === last.y && now.height === last.height) return now;
    last = now;
  }
  return last;
}

/** Drags a block by its top-left corner so that corner lands at (x, y). */
async function dragTo(page: Page, block: ReturnType<typeof fromPalette>, x: number, y: number) {
  const b = await settled(block);
  await page.mouse.move(b.x + 6, b.y + 6);
  await page.mouse.down();
  await page.mouse.move(b.x + 30, b.y + 10, { steps: 4 });
  await page.mouse.move(x + 6, y + 6, { steps: 10 });
  await page.mouse.up();
}

/** Where a block must go to hang under the hat: inside its C, below the def line. */
async function underHat(page: Page) {
  const box = (await hat(page).boundingBox())!;
  return { x: box.x + 14, y: box.y + box.height * 0.48 };
}

/** The workspace's blocks (the palette has a canvas of its own). */
const mainCanvas = (page: Page) => page.locator(".blocklyMainBackground").locator("xpath=..").locator(".blocklyBlockCanvas");
const pythonPane = (page: Page) => page.getByTestId("blocks-code").locator(".cm-content");

async function openBlocks(page: Page) {
  await page.getByTestId("tab-blocks").click();
  await expect(page.getByTestId("blocks-workspace").locator(".blocklyMainBackground")).toBeVisible({ timeout: 20_000 });
}

/** Drags a palette block (found by its text) under the hat, or under the last block there. */
async function addUnderHat(page: Page, cat: string, text: string | RegExp, nth = 0) {
  await category(page, cat);
  const stack = hat(page);
  const before = (await stack.boundingBox())!;
  const at = await underHat(page);
  // Under the last block already there: just below the lowest block inside
  // the hat, measured (block sizes follow the fonts, so no guessing).
  const inside = await stack.locator(".blocklyDraggable:not(.blocklyShadow)").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
  const y = inside.length ? Math.max(...inside) + 2 : at.y;
  // A block low in the palette may be under its edge (or scrollbar): scroll the palette first.
  const block = page.locator(".blocklyFlyout .blocklyDraggable").filter({ hasText: text }).nth(nth);
  const flyout = (await page.locator(".blocklyFlyout").first().boundingBox())!;
  for (let tries = 0; tries < 10; tries++) {
    const b = (await block.boundingBox())!;
    if (b.y + b.height <= flyout.y + flyout.height - 24) break;
    await page.mouse.move(flyout.x + flyout.width / 2, flyout.y + flyout.height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(100);
  }
  await dragTo(page, block, at.x, y);
  await expect.poll(async () => (await stack.boundingBox())!.height).toBeGreaterThan(before.height);
}

test("blocks build an event, its Python shows beside them, and the game runs it", async ({ page }) => {
  const errors = watchErrors(page);
  // Blockly's sounds and icons, from our own origin (vite.config.ts copies them in).
  const media: [string, number][] = [];
  page.on("response", (r) => r.url().includes("/blockly-media/") && media.push([r.url(), r.status()]));
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await newObjectWithEvent(page, "Mover");
  await openBlocks(page);
  await addUnderHat(page, "Motion", "change");
  await expect(pythonPane(page)).toHaveText("self.x += 4");
  await expect(page.getByTestId("event-Step").locator(".event-empty")).toHaveCount(0);

  // A block left lying loose is not code.
  await category(page, "Motion");
  const ws = (await page.getByTestId("blocks-workspace").boundingBox())!;
  await dragTo(page, fromPalette(page, "set"), ws.x + ws.width - 160, ws.y + ws.height - 120);
  await page.waitForTimeout(300);
  await expect(pythonPane(page)).toHaveText("self.x += 4");

  // The whole class shows the same Python, inside its method.
  await page.getByRole("tab", { name: "Python class" }).click();
  await expect(page.getByTestId("generated-class")).toContainText("def on_step(self):");
  await expect(page.getByTestId("generated-class")).toContainText("self.x += 4");
  await page.getByTestId("tab-blocks").click();
  await expect(pythonPane(page)).toHaveText("self.x += 4");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/blocks.png` });

  expect(media.length).toBeGreaterThan(0);
  expect(media.filter(([, status]) => status !== 200)).toEqual([]);

  await placeInRoom(page, "Room1 start", "Mover", 100, 100);
  await playAndWait(page);
  const x1 = (await py(page, "instances('Mover')[0].x")) as number;
  await page.waitForTimeout(300);
  expect((await py(page, "instances('Mover')[0].x")) as number).toBeGreaterThan(x1 + 20);
  expect(errors).toEqual([]);
});

test("Python never becomes blocks; blocks become Python once, after a warning", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await newObjectWithEvent(page, "Thing", "pick-create");
  await page.getByTestId("event-code").locator(".cm-content").click();
  await page.keyboard.insertText("self.x = 1");
  await expect(page.getByTestId("tab-blocks")).toBeDisabled();

  // An empty blocks event goes back to Python without asking: nothing is lost.
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void (dialogs.length === 1 ? d.dismiss() : d.accept());
  });
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-draw").click();
  await openBlocks(page);
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("event-code")).toBeVisible();
  expect(dialogs).toEqual([]);

  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await openBlocks(page);
  await addUnderHat(page, "Motion", "change");
  // Asked first; saying no keeps the blocks.
  await page.getByTestId("convert-to-python").click();
  expect(dialogs[0]).toContain("can't be turned back into blocks");
  await expect(page.getByTestId("blocks-workspace")).toBeVisible();
  // Saying yes: the same Python, now typed into.
  await page.getByTestId("tab-python").click();
  expect(dialogs).toHaveLength(2);
  await expect(page.getByTestId("event-code")).toContainText("self.x += 4");
  await expect(page.getByTestId("tab-blocks")).toBeDisabled();
  await page.getByTestId("event-code").locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\nself.y += 1");
  await expect(page.getByTestId("event-code")).toContainText("self.y += 1");
});

test("an error in blocks shows its line and selects the block that made it", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await newObjectWithEvent(page, "Mover");
  await openBlocks(page);
  await addUnderHat(page, "Motion", "change");
  await addUnderHat(page, "Variables", /change\s*my/);
  await expect(pythonPane(page)).toHaveText("self.x += 4self.lives -= 1"); // two lines, as innerText of the lines
  await placeInRoom(page, "Room1 start", "Mover", 100, 100);
  await page.getByTestId("play").click();
  const where = page.getByTestId("error-where");
  await expect(where).toHaveText("Mover → Step, line 2");
  await where.click();
  await expect(page.locator(".blocks-python .cm-error-line")).toHaveText("self.lives -= 1");
  await expect(mainCanvas(page).locator(".blocklySelected")).toContainText("my");
  await expect(mainCanvas(page).locator(".blocklySelected")).not.toContainText("x");
});

test("Ctrl+Z in the blocks undoes blocks; elsewhere it undoes the project and leaves blocks alone", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await newObjectWithEvent(page, "Mover");
  await openBlocks(page);
  await page.getByRole("checkbox", { name: "Solid" }).check();
  await addUnderHat(page, "Motion", "change");
  await addUnderHat(page, "Motion", "change");
  await expect(pythonPane(page)).toHaveText("self.x += 4self.x += 4");

  // In the workspace: Blockly's own undo takes the last block off.
  const ws = (await page.getByTestId("blocks-workspace").boundingBox())!;
  await page.mouse.click(ws.x + ws.width - 80, ws.y + 40);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(pythonPane(page)).toHaveText("self.x += 4");
  await expect(page.getByRole("checkbox", { name: "Solid" })).toBeChecked();

  // Anywhere else: the project's undo — the Solid tick — and the blocks stay.
  await page.locator(".event-list-head").click();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("checkbox", { name: "Solid" })).not.toBeChecked();
  await expect(pythonPane(page)).toHaveText("self.x += 4");

  // And they're saved.
  await page.reload();
  await treeItem(page, "Mover").click();
  await expect(pythonPane(page)).toHaveText("self.x += 4", { timeout: 20_000 });
});

test("renaming an object renames it in the blocks' pickers too", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill("Coin");
  await nameBox(page).press("Enter");
  await newObjectWithEvent(page, "Spawner", "pick-create");
  await openBlocks(page);
  // The statement one (the second): the first gives back the new instance, a value.
  await addUnderHat(page, "Instances", "instance_create", 1);
  await expect(pythonPane(page)).toHaveText('instance_create(0, 0, "Coin")');

  // F2, not a double-click: that would open Coin, and this is about the
  // blocks open on screen while their object is renamed.
  await treeItem(page, "Coin").focus();
  await page.keyboard.press("F2");
  await nameBox(page).fill("Gem");
  await nameBox(page).press("Enter");
  await expect(pythonPane(page)).toHaveText('instance_create(0, 0, "Gem")');
  await expect(mainCanvas(page)).toContainText("Gem");
  await expect(mainCanvas(page)).not.toContainText("Coin");
  // The next change keeps the new name rather than writing the old one back.
  await addUnderHat(page, "Motion", "change");
  await expect(pythonPane(page)).toHaveText('instance_create(0, 0, "Gem")self.x += 4');
  expect(errors).toEqual([]);
});

test("a script made with blocks defines a function, and an event's blocks call it", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await page.getByTestId("add-scripts").click();
  await nameBox(page).fill("helpers");
  await nameBox(page).press("Enter");
  // A new script has only a comment in it, so it can still become blocks.
  await page.getByTestId("script-tab-blocks").click();
  await expect(page.getByTestId("blocks-workspace").locator(".blocklyMainBackground")).toBeVisible({ timeout: 20_000 });
  await category(page, "Make a function");
  const ws = (await page.getByTestId("blocks-workspace").boundingBox())!;
  await dragTo(page, fromPalette(page, "def"), ws.x + ws.width * 0.45, ws.y + 40);
  await expect(pythonPane(page)).toHaveText("def my_function():    pass");
  // Its body: one block, inside the def's C.
  const def = await settled(onCanvas(page, "def"));
  await category(page, "Variables");
  await dragTo(page, fromPalette(page, /change\s*global/), def.x + 14, def.y + def.height * 0.5);
  await expect(pythonPane(page)).toHaveText("def my_function():    global_vars.score += 1");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/script-blocks.png` });

  await newObjectWithEvent(page, "Counter", "pick-create");
  await page.getByTestId("event-code").locator(".cm-content").click();
  await page.keyboard.insertText("global_vars.score = 0");
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await openBlocks(page);
  await addUnderHat(page, "Functions", /call\s*my_function/);
  await expect(pythonPane(page)).toHaveText("my_function()");

  await placeInRoom(page, "Room1 start", "Counter", 100, 100);
  await playAndWait(page);
  await page.waitForTimeout(300);
  expect((await py(page, "global_vars.score")) as number).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test("creation code can be blocks too, built in a dialog", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByTestId("template-empty").click();
  await page.waitForURL(/#\/p\//);
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("starter-coin").click();
  await expect(treeItem(page, "coin")).toBeVisible(); // its tab opens when it's made; wait, or it takes over from Gem's
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill("Gem");
  await nameBox(page).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "coin" });
  await placeInRoom(page, "Room1 start", "Gem", 128, 96);
  const at = await screenAt(page, 128, 96);
  await page.mouse.click(at.x, at.y);

  await page.getByTestId("creation-tab-blocks").click();
  await expect(page.getByRole("dialog", { name: "Creation code for Gem" })).toBeVisible();
  await expect(page.getByTestId("blocks-workspace").locator(".blocklyMainBackground")).toBeVisible({ timeout: 20_000 });
  await expect(onCanvas(page, "creation code")).toBeVisible();
  await addUnderHat(page, "Variables", /set\s*my/);
  await expect(pythonPane(page)).toHaveText("self.lives = 3");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/creation-blocks.png` });
  await page.getByTestId("close-creation-blocks").click();
  // The panel shows the Python the blocks made.
  await expect(page.getByTestId("creation-code-python")).toContainText("self.lives = 3");

  await playAndWait(page);
  expect(await py(page, "instances('Gem')[0].lives")).toBe(3);
  expect(errors).toEqual([]);
});
