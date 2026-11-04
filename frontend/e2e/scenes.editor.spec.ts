/**
 * Scene mode, as a student uses it: add steps from the menu, fill in their
 * boxes, put them in order, watch the Python beside them, and play.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, nameBox, placeInRoom, playAndWait, py, SHOTS, treeItem, watchErrors } from "./helpers";

async function newObject(page: Page, event: string) {
  await fromTemplate(page, "empty");
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill("Star");
  await nameBox(page).press("Enter");
  await expect(treeItem(page, "Star")).toBeVisible();
  await page.getByTestId("add-event").click();
  await page.getByTestId(event).click();
}

const add = async (page: Page, fn: string) => {
  await page.getByTestId("scene-add").click();
  await page.getByTestId(`step-${fn}`).click();
};

test("a cutscene built from cards plays in the game", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await newObject(page, "pick-create");
  await page.getByTestId("tab-scene").click();
  await expect(page.getByTestId("scene")).toBeVisible();

  await add(page, "scene_bars");
  await add(page, "scene_say");
  await page.getByTestId("scene-scene_say-text").fill("Hello there");
  await page.getByTestId("scene-scene_say-name").fill("Robin");
  await add(page, "scene_move");
  await add(page, "scene_wait");
  const code = page.getByTestId("scene-code");
  await expect(code).toContainText('scene_say("Hello there", "Robin")');
  await expect(code).toContainText("scene_move(self, self.x, self.y)");
  await expect(page.getByTestId("scene-step")).toHaveCount(4);
  // However long the scene, its Python stays on screen, at a laptop's size too.
  await page.setViewportSize({ width: 1366, height: 600 });
  for (let i = 0; i < 6; i++) await add(page, "scene_shake");
  const box = await code.boundingBox();
  expect(box!.y + box!.height / 2).toBeLessThan(600);
  for (let i = 0; i < 6; i++) await page.getByTestId("scene-undo").click();
  await expect(page.getByTestId("scene-step")).toHaveCount(4);

  // New cards land after the one selected; arrows move them, Ctrl+Z takes it back.
  await page.getByTestId("scene-step").nth(3).getByTestId("scene-up").click();
  await expect(page.getByTestId("scene-step").nth(2)).toContainText("Wait");
  await page.getByTestId("scene-step").nth(0).click({ position: { x: 4, y: 4 } });
  await page.getByTestId("scene-undo").click();
  await expect(page.getByTestId("scene-step").nth(3)).toContainText("Wait");

  // Other modes are shut now: Python asks.
  await expect(page.getByTestId("tab-blocks")).toBeDisabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/scene-mode.png` });

  await placeInRoom(page, "Room1 start", "Star", 100, 100);
  await playAndWait(page);
  await expect.poll(() => py(page, "scene_playing() and dialogue_open()")).toBe(true);
  await py(page, "scene_skip()");
  await expect.poll(() => py(page, "scene_playing()")).toBe(false);
  expect(errors).toEqual([]);
});

test("a repeating event can't be a scene", async ({ page }) => {
  await newObject(page, "pick-step");
  await expect(page.getByTestId("tab-scene")).toBeDisabled();
  await expect(page.getByTestId("tab-scene")).toHaveAttribute("title", /every step/);
});

test("drag a card by its grip; a repeatable event asks about Play once; Convert keeps the Python", async ({ page }) => {
  test.setTimeout(120_000);
  const dialogs: string[] = [];
  page.on("dialog", (d) => (dialogs.push(d.message()), void d.accept()));
  await newObject(page, "pick-room_start");
  await page.getByTestId("tab-scene").click();
  await add(page, "scene_wait");
  await add(page, "scene_shake");
  await add(page, "scene_flash");
  await expect(page.getByTestId("scene-repeat-hint")).toBeVisible();
  await page.getByTestId("scene-once").check();
  await expect(page.getByTestId("scene-repeat-hint")).toHaveCount(0);
  await expect(page.getByTestId("scene-code")).toContainText("getattr(global_vars");

  const cards = page.getByTestId("scene-step");
  await cards.nth(2).getByTestId("scene-grip").dragTo(cards.nth(0), { targetPosition: { x: 40, y: 3 } });
  await expect(cards.nth(0)).toContainText("Flash");

  // An actor brought on after it's used: the card says so, and the game isn't broken.
  await add(page, "scene_create");
  await page.getByTestId("scene-as").fill("ghost");
  await add(page, "scene_hide");
  await page.getByTestId("scene-scene_hide-instance").selectOption("ghost");
  await expect(page.getByTestId("scene-problem")).toHaveCount(0);
  await cards.filter({ hasText: "Hide" }).getByTestId("scene-up").click();
  await expect(page.getByTestId("scene-problem")).toContainText("brought on later");
  await expect(page.getByTestId("scene-code")).toContainText("pass  # Hide");

  await page.getByTestId("convert-to-python").click();
  expect(dialogs.at(-1)).toContain("can't be turned back into a scene");
  await page.getByTestId("tab-python").click();
  await expect(page.getByTestId("event-code")).toContainText("scene_flash");
  await expect(page.getByTestId("tab-scene")).toBeDisabled();
});
