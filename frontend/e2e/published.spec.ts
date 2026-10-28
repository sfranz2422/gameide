/**
 * Publishing, against the real server: a link anyone can play, Explore once
 * an admin approves, a remix, a report and a take-down, and a published game
 * that plays offline once installed (its service worker).
 */
import { devices, expect, test, webkit, type Browser, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { chooseTemplate, playAndWait, watchErrors } from "./helpers";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

async function newGame(page: Page) {
  await page.goto("/#/games");
  await chooseTemplate(page, "coins");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
}

/** Publishes the open game; answers its /play/ link. */
async function publish(page: Page, title: string, who: "unlisted" | "public") {
  await page.getByTestId("publish").click();
  await page.getByTestId("publish-title").fill(title);
  await page.getByTestId(`publish-${who}`).check();
  await page.getByTestId("publish-go").click();
  const link = page.getByTestId("publish-link");
  await expect(link).toHaveValue(/\/play\/[\w-]+$/);
  return new URL(await link.inputValue()).pathname;
}

async function playIt(page: Page) {
  await page.getByTestId("player-start").click({ timeout: 60_000 });
  await expect(page.locator("canvas[data-testid=game-canvas]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__gameide.host.evalPython("global_vars.total")), { timeout: 30_000 }).toBe(15);
}

test("a published game plays from its link for anyone, signed out too, and shows no email", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "pat@example.com");
  await newGame(page);
  const link = await publish(page, "Pat's Coins", "unlisted");
  await expect(page.getByTestId("publish-status")).toContainText("anyone with the link");

  const stranger = await browser.newContext();
  const play = await stranger.newPage();
  const errors = watchErrors(play);
  await play.goto(link);
  await expect(play.getByTestId("player-title")).toHaveText("Pat's Coins");
  await expect(play.locator("body")).not.toContainText("@example.com");
  await expect(play).toHaveTitle("Pat's Coins — GameIDE");
  await playIt(play);
  await play.reload();
  await expect(play.getByTestId("player-plays")).toHaveText("1");
  // Signed out: liking and reporting need an account.
  await expect(play.getByTestId("player-like")).toBeDisabled();
  expect(errors.filter((e) => !e.includes("401"))).toEqual([]);
  await stranger.close();
  await ctx.close();
});

// Safari's engine, which every browser on an iPhone is. A published game was
// a black screen there and nowhere else (gameWorker.ts says why), so only
// WebKit itself can tell. `npx playwright install webkit` once to have it.
test("a published game plays on an iPhone (Safari's engine)", async ({ browser }) => {
  test.skip(!existsSync(webkit.executablePath()), "WebKit isn't installed: npx playwright install webkit");
  const { ctx, page } = await signedIn(browser, "ivy@example.com");
  await newGame(page);
  const link = await publish(page, "Ivy's Coins", "unlisted");
  const safari = await webkit.launch();
  const phone = await (await safari.newContext({ ...devices["iPhone 13"], baseURL: test.info().project.use.baseURL })).newPage();
  await phone.goto(link);
  await playIt(phone);
  // Drawn, not just started: the game's Python runs before the renderer
  // does, so a renderer that fails still leaves the game's numbers right.
  const frame = () => phone.evaluate(async () => ((await (window as any).__gameide.host.snapshot()) as Blob | null)?.size ?? 0);
  await expect.poll(frame, { timeout: 30_000 }).toBeGreaterThan(1000);
  await expect(phone.getByRole("alert")).toHaveCount(0);
  await safari.close();
  await ctx.close();
});

test("an engine that can't start says so, rather than a black screen", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "ike@example.com");
  await newGame(page);
  const link = await publish(page, "Ike's Coins", "unlisted");
  const play = await (await browser.newContext()).newPage();
  await play.goto(link);
  await playIt(play);
  // What the worker sends when Pixi or WebGL fails, which no Python error comes with.
  await play.evaluate(() => (window as any).__gameide.host.receive({ type: "fatal", message: "WebGL is turned off" }));
  await expect(play.getByRole("alert")).toContainText("The game engine failed: WebGL is turned off");
  await ctx.close();
});

test("a public game waits for approval, then is on Explore with its picture; others can remix it", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "quinn@example.com");
  await newGame(page);
  // A picture: what the game shows while it runs.
  await playAndWait(page);
  const link = await publish(page, "Quinn's Quest", "public");
  await expect(page.getByTestId("publish-status")).toContainText("waiting for a teacher");

  const anon = await (await browser.newContext()).newPage();
  await anon.goto("/#/explore");
  await expect(anon.getByTestId("game-card")).toHaveCount(0);

  const admin = await signedIn(browser, "admin@example.com");
  await admin.page.goto("/#/moderation");
  const id = link.split("/").pop()!;
  await admin.page.getByTestId(`mod-approve-${id}`).click();

  await anon.reload();
  const card = anon.getByTestId("game-card").filter({ hasText: "Quinn's Quest" });
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveJSProperty("complete", true);
  expect(await card.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(320);
  await card.getByRole("link").click();
  await expect(anon.getByTestId("player-title")).toHaveText("Quinn's Quest");

  // A remix: a copy in the remixer's own games, crediting where it came from.
  const other = await signedIn(browser, "rae@example.com");
  await other.page.goto(link);
  await other.page.getByTestId("player-remix").click();
  await other.page.waitForURL(/#\/p\//);
  await expect(other.page.getByRole("textbox", { name: "Game name" })).toHaveValue("Quinn's Quest (remix)");
  await ctx.close();
});

test("a reported game can be taken down, and its link says so", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "sam@example.com");
  await newGame(page);
  const link = await publish(page, "Sam's Game", "unlisted");
  const other = await signedIn(browser, "tia@example.com");
  other.page.on("dialog", (d) => void d.accept("it says mean things"));
  await other.page.goto(link);
  await other.page.getByTestId("player-report").click();
  await expect(other.page.getByRole("status")).toHaveText("Thanks — it has been reported.");

  const admin = await signedIn(browser, "admin@example.com");
  admin.page.on("dialog", (d) => void d.accept("unkind words"));
  await admin.page.goto("/#/moderation");
  await expect(admin.page.locator(".reports")).toContainText("it says mean things");
  const id = link.split("/").pop()!;
  await admin.page.getByTestId(`mod-takedown-${id}`).first().click();

  const anon = await (await browser.newContext()).newPage();
  await anon.goto(link);
  await expect(anon.getByRole("alert")).toContainText("taken down");
  // Its author sees why, opening Publish again.
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("publish").click();
  await expect(page.getByTestId("publish-status")).toContainText("unkind words");
  await ctx.close();
});

test("a published game can be installed as an app: it has a manifest", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "uma@example.com");
  await newGame(page);
  const link = await publish(page, "Uma's App", "unlisted");
  const play = await (await browser.newContext()).newPage();
  await play.goto(link);
  await expect(play.locator("link[rel=manifest]")).toHaveAttribute("href", /manifest\.webmanifest$/);
  const manifest = await play.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>("link[rel=manifest]")!.href)).json());
  expect(manifest).toMatchObject({ name: "Uma's App", display: "standalone", start_url: link });
  const icon = await play.evaluate(async (src) => (await fetch(src)).status, manifest.icons[0].src);
  expect(icon).toBe(200);
  await ctx.close();
});
