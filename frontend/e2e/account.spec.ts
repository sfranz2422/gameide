/**
 * Signed in, against the real server (Flask, dev sign-in, a throwaway
 * database): work reaches the account and comes back on another computer,
 * survives being offline, keeps a history, and nothing made before signing
 * in is lost.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { chooseTemplate, setCode, treeItem, watchErrors } from "./helpers";

async function signIn(page: Page, email: string, next = "/") {
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

async function newGame(page: Page, template = "coins") {
  await page.goto("/#/games");
  await chooseTemplate(page, template);
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  return page.url().split("#/p/")[1]!;
}

/**
 * Waits for the save of an edit just made. "Saved" alone isn't enough: it is
 * already showing before the edit, and the save starts a moment later.
 */
async function saved(page: Page) {
  await expect(page.getByTestId("save-status")).toHaveText("Saving…");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
}

async function editPlayerCreate(page: Page, code: string) {
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  await setCode(page, code);
}

/** What the server has for a project, asked as the signed-in page. */
const onServer = (page: Page, id: string) =>
  page.evaluate(async (id) => {
    const r = await fetch(`/api/projects/${id}`);
    return r.ok ? ((await r.json()) as { data: { objects: { name: string; events: { code: string }[] }[] } }) : null;
  }, id);

const playerCreate = async (page: Page, id: string) =>
  (await onServer(page, id))?.data.objects.find((o) => o.name === "Player")?.events[0]?.code ?? null;

async function freshComputer(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await signIn(page, email, "/#/games");
  return { ctx, page };
}

test("work saved to the account opens on another computer", async ({ page, browser }) => {
  const errors = watchErrors(page);
  await signIn(page, "ada@example.com");
  await expect(page.getByTestId("account")).toContainText("Ada");
  const id = await newGame(page);
  const put = page.waitForRequest((r) => r.method() === "PUT" && r.url().endsWith(`/api/projects/${id}`));
  await editPlayerCreate(page, "self.move_speed = 6\n");
  await saved(page);
  expect(await playerCreate(page, id)).toBe("self.move_speed = 6\n");
  // What Render's firewall sees: base64, never the code itself.
  const body = (await put).postData() ?? "";
  expect(Object.keys(JSON.parse(body))).toEqual(["_packed"]);
  expect(body).not.toContain("move_speed");

  // A different browser: nothing cached, so this can only come from the server.
  const other = await freshComputer(browser, "ada@example.com");
  await other.page.getByTestId("project-link").filter({ hasText: "Collect the coins" }).click();
  await editPlayerCreate(other.page, "self.move_speed = 6\n"); // opens the same event to look at it
  await expect(other.page.getByTestId("event-code")).toContainText("self.move_speed = 6");
  await expect(treeItem(other.page, "coin", "sprites")).toBeVisible(); // (a sound is called coin too)
  await other.ctx.close();
  expect(errors).toEqual([]);
});

test("edits made offline wait in the browser and go up when back online", async ({ page, context }) => {
  await signIn(page, "grace@example.com");
  const id = await newGame(page);
  await context.setOffline(true);
  await editPlayerCreate(page, "self.move_speed = 9\n");
  await expect(page.getByTestId("save-status")).toHaveText("Offline — saved in this browser");
  await context.setOffline(false);
  await expect(page.getByTestId("save-status")).toHaveText("Saved", { timeout: 40_000 });
  expect(await playerCreate(page, id)).toBe("self.move_speed = 9\n");
});

test("History keeps versions, and going back can itself be undone", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await signIn(page, "alan@example.com");
  await newGame(page);
  await editPlayerCreate(page, "self.move_speed = 1\n");
  await saved(page);
  await page.getByTestId("history").click();
  await page.getByLabel("Version name").fill("slow and steady");
  await page.getByTestId("save-version").click();
  await expect(page.getByTestId("history-list")).toContainText("slow and steady");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await setCode(page, "self.move_speed = 99\n");
  await saved(page);
  await page.getByTestId("history").click();
  await page.locator(".history-list li", { hasText: "slow and steady" }).getByRole("button", { name: "Go back to this" }).click();
  await expect(page.getByTestId("event-code")).toContainText("self.move_speed = 1");

  await page.getByTestId("history").click();
  await expect(page.getByTestId("history-list")).toContainText("Before going back");
});

test("games made before signing in can be moved into the account", async ({ page }) => {
  await page.goto("/#/games");
  await expect(page.getByTestId("sign-in")).toBeVisible();
  await chooseTemplate(page, "empty");
  await page.getByRole("textbox", { name: "Game name" }).fill("Made while signed out");
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.goto("/");

  await signIn(page, "linus@example.com", "/#/games");
  const browserOnly = page.getByTestId("browser-only");
  await expect(browserOnly).toContainText("Made while signed out");
  await browserOnly.getByTestId("move-to-account").click();
  await expect(page.getByTestId("project-link").filter({ hasText: "Made while signed out" })).toBeVisible();
  await expect(browserOnly).toHaveCount(0);
});

test("a picture added in the editor reaches the server", async ({ page }) => {
  await signIn(page, "hedy@example.com");
  const id = await newGame(page, "empty");
  await page.getByTestId("add-sprites").click();
  await page.getByTestId("starter-heart").click();
  await saved(page);
  const status = await page.evaluate(async (id) => {
    const project = await (await fetch(`/api/projects/${id}`)).json();
    const frame = project.data.sprites[0]?.frames[0];
    return frame ? (await fetch(`/api/projects/${id}/assets/${frame}`)).status : "no sprite on the server";
  }, id);
  expect(status).toBe(200);
});

test("two tabs editing one game both keep their work", async ({ page, context }) => {
  await signIn(page, "barbara@example.com");
  const id = await newGame(page);
  const second = await context.newPage();
  await second.goto(`/#/p/${id}`);
  await expect(second.getByTestId("save-status")).toHaveText("Saved");

  await editPlayerCreate(page, "self.move_speed = 2  # tab one\n");
  await saved(page);
  await editPlayerCreate(second, "self.move_speed = 3  # tab two\n");
  await saved(second);
  await expect(second.getByTestId("console")).toContainText("Another tab or computer had saved this game too");

  await second.getByTestId("history").click();
  await expect(second.getByTestId("history-list")).toContainText("Replaced by a save from another tab or computer");
  expect(await playerCreate(page, id)).toContain("tab two");
});

test("signed out, a project URL from the account doesn't show someone else's work", async ({ page, browser }) => {
  await signIn(page, "owner@example.com");
  const id = await newGame(page);
  const other = await freshComputer(browser, "intruder@example.com");
  await other.page.goto(`/#/p/${id}`);
  await expect(other.page.getByText("That project belongs to someone else.")).toBeVisible();
  await other.ctx.close();
});
