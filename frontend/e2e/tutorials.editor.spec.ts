/**
 * A tutorial, the whole way through: "Your First Game", in the editor on
 * its own (no server: signed out, the game kept in the browser). Each step
 * is done as a student would; Next stays locked until its checks pass; a
 * step points at the part of the editor it's about; and how far they got
 * is kept in the game, so the library knows and a reload carries on.
 */
import { expect, test } from "@playwright/test";
import { screenAt, setCode, SHOTS, treeItem } from "./helpers";

test("Your First Game, step by step: strict Next, spotlights, checks that play the game, progress kept", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/#/tutorials");
  await page.getByTestId("tutorial-card").filter({ hasText: "Your First Game" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  const pane = page.getByTestId("tutorial-pane");
  await expect(pane).toBeVisible();
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 1 of 8");
  const next = page.getByTestId("tutorial-next");
  const check = page.getByTestId("check-my-work");

  // 1 → 2: no checks on the first step, so Next is open.
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 2 of 8");
  await expect(next).toBeDisabled();
  await expect(page.getByTestId("spotlight")).toHaveAttribute("data-target", "add-sprites");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tutorial-spotlight.png` });
  await check.click();
  await expect(pane.getByTestId("test-line")).toContainText("There's no sprite called player yet.");
  await expect(next).toBeDisabled();
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("starter-player").click();
  await check.click();
  await expect(pane.getByTestId("test-line")).toContainText("✓");
  await expect(next).toBeEnabled();
  await next.click();

  // 3: an object called Player.
  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Player");
  await page.keyboard.press("Enter");
  await check.click();
  await expect(next).toBeEnabled();
  await next.click();

  // 4: its sprite.
  await page.getByTestId("object-sprite").selectOption({ label: "player" });
  await check.click();
  await expect(next).toBeEnabled();
  await next.click();

  // 5: in the room.
  // The start room's button says "Room1 start" (its badge), so it's opened by that name.
  await page.getByRole("navigation", { name: "Resources" }).getByRole("button", { name: "Room1 start" }).click();
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("tool-place").click();
  await page.getByTestId("place-object").selectOption({ label: "Player" });
  const at = await screenAt(page, 200, 200);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("tool-select").click();
  await check.click();
  await expect(next).toBeEnabled();
  await next.click();

  // 6: a Step event that moves it — checked by playing the game, holding the arrow keys.
  await treeItem(page, "Player").click();
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
  await setCode(page, 'self.x += (keyboard_check("right") - keyboard_check("left")) * 4\nself.y += (keyboard_check("down") - keyboard_check("up")) * 4\n');
  await page.getByTestId("notes-tab").click();
  await check.click();
  await expect(next).toBeEnabled({ timeout: 90_000 });
  await expect(pane.getByTestId("test-line").filter({ hasText: "✓" })).toHaveCount(4);
  await next.click();

  // 7: it plays without errors. 8: the end — the tutorial is finished.
  await check.click();
  await expect(next).toBeEnabled({ timeout: 60_000 });
  await next.click();
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 8 of 8 · finished ✓");

  // The game remembers: a reload carries on there, and the library says so.
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.reload();
  await page.getByTestId("notes-tab").click();
  await expect(page.getByTestId("tutorial-step")).toContainText("Step 8 of 8");
  await page.getByTestId("tutorial-back").click();
  await page.getByTestId("tutorial-back").click();
  await expect(next).toBeEnabled();
  await page.goto("/#/tutorials");
  await expect(page.getByTestId("tutorial-card").filter({ hasText: "Your First Game" }).getByTestId("tutorial-status")).toHaveText("Finished ✓");
});

test("a tutorial's code can't be selected, and its later steps are locked until the earlier ones pass", async ({ page }) => {
  await page.goto("/#/tutorials");
  await page.getByTestId("tutorial-card").filter({ hasText: "Collect the Coins" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  await page.getByTestId("tutorial-next").click();
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 2 of 6");
  expect(await page.getByTestId("tutorial-pane").locator("pre").first().evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
  await expect(page.getByTestId("tutorial-next")).toBeDisabled();
  // The library lists it as started, with Resume.
  await page.goto("/#/tutorials");
  await expect(page.getByTestId("tutorial-card").filter({ hasText: "Collect the Coins" }).getByTestId("tutorial-resume")).toBeVisible();
});

test("Python Basics: lesson 1 checks what the program printed, in the game pane", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/#/tutorials");
  await expect(page.getByRole("heading", { name: "Python Basics" })).toBeVisible();
  await page.getByTestId("tutorial-card").filter({ hasText: "1. Hello, Python" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  const next = page.getByTestId("tutorial-next");
  const check = page.getByTestId("check-my-work");
  const pane = page.getByTestId("tutorial-pane");
  await next.click();
  // 2: Main and its Create event are already there.
  await check.click();
  await expect(next).toBeEnabled();
  await next.click();

  // 3: print — first a typo, which the check names, then the real thing.
  await treeItem(page, "Main").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, 'print("Helo, world!")\n');
  await page.getByTestId("notes-tab").click();
  await check.click();
  await expect(pane.getByTestId("test-line").filter({ hasText: 'It printed "Helo, world!"' })).toBeVisible({ timeout: 90_000 });
  await expect(next).toBeDisabled();
  await page.getByTestId("event-Create").click();
  await setCode(page, 'print("Hello, world!")\n');
  await page.getByTestId("notes-tab").click();
  await check.click();
  await expect(next).toBeEnabled({ timeout: 90_000 });
  // What it printed shows under the step, without leaving the lesson for the Console tab.
  await expect(page.getByTestId("tutorial-console")).toContainText("Hello, world!");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/python-basics-1.png` });
});
