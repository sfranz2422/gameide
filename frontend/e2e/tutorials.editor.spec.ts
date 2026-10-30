/**
 * A tutorial, the whole way through: "Your First Game", in the editor on
 * its own (no server: signed out, the game kept in the browser). Each step
 * is done as a student would; Next stays locked until its checks pass; a
 * step points at the part of the editor it's about; and how far they got
 * is kept in the game, so the library knows and a reload carries on.
 */
import { expect, test } from "@playwright/test";
import { py, screenAt, setCode, SHOTS, treeItem } from "./helpers";

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

test("Game Elements: a lesson starts from the game the lessons before it made", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/#/tutorials");
  await expect(page.getByRole("heading", { name: "Game Elements 1: The Basics" })).toBeVisible();
  await page.getByTestId("tutorial-card").filter({ hasText: "3. Enemy" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 1 of 6");
  // Lessons 1 and 2 are done in it: the Player moves with the keys, a gamepad and Shift.
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Step").click();
  await expect(page.getByTestId("event-code")).toContainText('gamepad_check("b")');
  await expect(treeItem(page, "Enemy")).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/elements-3.png` });
});

test("Game Elements 3: the cave platformer, with its real sprites, lands where the lessons' checks expect", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/#/tutorials");
  await page.getByTestId("tutorial-card").filter({ hasText: "12. Strike and Interact" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 60_000 });
  // The wide map built by lessons 9 and 11, and a player standing on its floor:
  // "after 1 second, instances("Player")[0].y == 424" in lesson 10 depends on the painted sprite's box.
  await expect.poll(async () => await py(page, "instance_number('Wall')"), { timeout: 10_000 }).toBe(89);
  await expect.poll(async () => await py(page, "instances('Player')[0].y"), { timeout: 10_000 }).toBe(424);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/elements-cave.png` });
});

test("a tutorial's Python is coloured and marked to type, and Next opens the next step at its top", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 }); // short: the steps scroll
  await page.goto("/#/tutorials");
  await page.getByTestId("tutorial-card").filter({ hasText: "Simple Platformer" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  const pane = page.getByTestId("tutorial-pane");
  await expect(pane).toBeVisible();
  // Scrolled down to Next at the bottom of step 1…
  await page.getByTestId("tutorial-next").scrollIntoViewIfNeeded();
  const scrolled = () => pane.evaluate((el) => { let most = 0; for (let e: Element | null = el; e; e = e.parentElement) most = Math.max(most, e.scrollTop); return most; });
  expect(await scrolled()).toBeGreaterThan(0);
  await page.getByTestId("tutorial-next").click();
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 2 of 7");
  // …and step 2 opens at its top, its heading in sight.
  await expect.poll(scrolled).toBe(0);
  await expect(pane.getByRole("heading", { name: "Speed" })).toBeInViewport();
  // Its Python is a card to type, coloured as the editor colours it.
  const code = pane.locator("pre.type-this").first();
  await expect(code).toBeVisible();
  await expect(code.locator(".syn-property").first()).toHaveText("vx");
  await expect(code.locator(".syn-number").first()).toHaveText("0");
  if (SHOTS) await pane.screenshot({ path: `${SHOTS}/tutorial-code.png` });
});

test("Now you can make: a whole-game tutorial sits just after the lesson it builds on, and starts from an empty game", async ({ page }) => {
  await page.goto("/#/tutorials");
  // Each band follows its lesson, in the middle of the shelf: the card just
  // before it is that lesson, and the shelf carries on after it.
  for (const [lesson, title, games] of [
    ["collect-coins", "Collect the Coins", ["Coin Rush"]],
    ["el1-time-limit", "6. Time Limit", ["Busy Road"]],
    ["el2-difficulty", "4. Increasing Difficulty", ["Bomb Dodge"]],
    ["el2-multiplayer", "5. Multiplayer", ["Paddle Duel"]],
    ["el3-camera", "11. Scrolling Camera", ["Ledge Runner"]],
    ["el3-strike", "12. Strike and Interact", ["Crypt of Keys", "Alley Brawl"]],
    // After a whole shelf: Moonwell needs all of Starter Projects.
    ["Starter Projects", "Play on a Phone", ["Moonwell"]],
  ] as const) {
    const band = page.locator(`[data-testid="make-band"][data-after="${lesson}"]`);
    await expect(band.getByRole("heading")).toHaveText("Now you can make…");
    await expect(band.getByTestId("tutorial-card")).toHaveText(games.map((g) => new RegExp(g)));
    expect(await band.evaluate((b) => [...(b.previousElementSibling?.querySelectorAll("[data-testid=tutorial-card] b") ?? [])].pop()?.textContent)).toBe(title);
  }
  // Collect the Coins isn't Getting Started's last lesson: the shelf goes on after the band, under no new heading.
  const after = page.locator('[data-after="collect-coins"] + [data-testid="shelf"]');
  await expect(after).toHaveAttribute("data-shelf", "Getting Started");
  await expect(after.getByRole("heading")).toHaveCount(0);
  await expect(after.getByTestId("tutorial-card").first()).toContainText("Blocks to Python");
  // Not a shelf of its own.
  await expect(page.getByRole("heading", { name: "Now You Can Make", exact: true })).toHaveCount(0);

  await page.locator('[data-after="el1-time-limit"]').getByTestId("tutorial-card").filter({ hasText: "Busy Road" }).getByTestId("tutorial-start").click();
  await page.waitForURL(/#\/p\//);
  await expect(page.getByTestId("tutorial-pane")).toContainText("Busy Road");
  // From nothing: no objects yet. The car the lesson asks for is there to pick, and is drawn.
  await expect(page.getByTestId("tutorial-step")).toHaveText("Step 1 of 10");
  await page.getByTestId("add-sprites").click();
  await expect(page.getByTestId("starter-bomb")).toBeVisible();
  await page.getByTestId("starter-car").click();
  // The car is drawn (a ready-made sprite is painted when it's added): read its picture back.
  const img = page.getByTestId("sprite-canvas").locator("img");
  await expect(img).toHaveAttribute("alt", "car");
  const lit = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    const c = new OffscreenCanvas(el.naturalWidth, el.naturalHeight);
    const x = c.getContext("2d")!;
    x.drawImage(el, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return [c.width, c.height, n];
  });
  expect(lit.slice(0, 2)).toEqual([40, 24]);
  expect(lit[2]).toBeGreaterThan(300);
});
