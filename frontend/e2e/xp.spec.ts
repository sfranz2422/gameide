/**
 * XP, against the real server: the teacher gives XP from the class's XP
 * page and it pops up for the student; the student sees their level, picks
 * an avatar that then shows on the leaderboard, asks for something from the
 * token shop and the teacher approves it; a random event is shown big and
 * on the class's page; and a game that runs without an error is claimed for
 * XP, while one stopped too soon isn't.
 */
import { expect, test, type Browser } from "@playwright/test";
import { chooseTemplate, SHOTS } from "./helpers";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

test("XP: given by the teacher, shown to the student, avatars, the token shop and random events", async ({ browser }) => {
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach@example.com");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("XP P2");
  await teacher.getByTestId("new-class-go").click();
  await teacher.waitForURL(/#\/class\/\d+$/);
  const classId = teacher.url().split("/").pop()!;
  await teacher.getByTestId("roster-emails").fill("ola@example.com\npip@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("ola@example.com")).toBeVisible();

  // The student signs in and looks at their Classes page: level 1, no XP.
  const { ctx: sctx, page: ola } = await signedIn(browser, "ola@example.com");
  await ola.goto("/#/classes");
  await expect(ola.getByTestId("xp-card")).toContainText("Level 1");
  await expect(ola.getByTestId("xp-card")).toContainText("0 XP");

  // The teacher gives XP from the class's XP page, with a reason.
  await teacher.goto(`/#/class/${classId}/xp`);
  const row = teacher.getByTestId("xp-student").filter({ hasText: "Ola" });
  await row.getByRole("checkbox").check();
  await teacher.getByTestId("behavior").selectOption({ label: "Solved the challenge problem (+20)" });
  await teacher.getByTestId("give-go").click();
  await expect(row).toContainText("20");

  // It pops up for the student, wherever they are, and their card shows it.
  await ola.reload();
  await expect(ola.getByTestId("xp-toast")).toContainText("+20 XP");
  await expect(ola.getByTestId("xp-toast")).toContainText("Solved the challenge problem");
  await expect(ola.getByTestId("xp-card")).toContainText("20 XP");
  await ola.goto("/#/xp");
  await expect(ola.getByTestId("xp-row").first()).toContainText("Solved the challenge problem");

  // An avatar, then on the class's leaderboard.
  await ola.goto("/#/classes");
  await ola.getByTestId("avatar-choose").click();
  await expect(ola.getByTestId("avatar-wizard")).toBeDisabled();
  await ola.getByTestId("avatar-robot").click();
  await ola.getByRole("button", { name: "Done" }).click();
  await ola.goto(`/#/class/${classId}`);
  await expect(ola.getByTestId("board").first().locator("[data-avatar=robot]")).toBeVisible();

  // A token's worth of XP, a request from the shop, approved by the teacher.
  await teacher.getByTestId("give-amount").fill("1000");
  await teacher.getByTestId("give-reason").fill("Token time");
  await row.getByRole("checkbox").check();
  await teacher.getByTestId("give-go").click();
  await ola.goto("/#/classes");
  await expect(ola.getByTestId("tokens")).toHaveText("1");
  await ola.getByTestId("shop-ask").first().click();
  await expect(ola.getByTestId("tokens")).toHaveText("0");
  await teacher.reload();
  await teacher.getByTestId("request-approve").click();
  await expect(teacher.getByTestId("request")).toHaveCount(0);
  await expect(row).toContainText("List Wrangler");

  // A random event: big on the teacher's screen, then on the class's page —
  // and in the green popup for everyone in the class, wherever they are in
  // the app, whether it gave them XP or not, naming who it did (first names).
  const { ctx: pctx, page: pip } = await signedIn(browser, "pip@example.com");
  await pip.goto("/#/games");
  await ola.goto("/#/games");
  await pip.waitForTimeout(1500); // their first ask marks where events count from
  await teacher.getByTestId("random-event").click();
  await expect(teacher.getByTestId("event-show")).toBeVisible();
  const title = await teacher.getByTestId("event-show").locator("h2").innerText();
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/xp-event.png` });
  await teacher.getByRole("button", { name: "OK", exact: true }).click();
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/xp-class.png`, fullPage: true });
  for (const s of [ola, pip]) {
    const pop = s.getByTestId("xp-toast").filter({ hasText: title });
    await expect(pop).toHaveCount(1, { timeout: 30_000 });
    // Green — red only for the student the event took XP from.
    const bg = await pop.evaluate((e) => getComputedStyle(e).backgroundColor);
    const text = await pop.innerText();
    expect(bg === "rgb(51, 153, 119)" || (bg === "rgb(184, 69, 69)" && /You −/.test(text)), `${bg} ${text}`).toBe(true);
    await expect(pop).not.toContainText(/[A-Z][a-z]* [A-Z]\./); // never a last initial
  }
  await pctx.close();
  await ola.goto(`/#/class/${classId}`);
  await expect(ola.getByTestId("event-banner")).toContainText(title);
  if (SHOTS) {
    await ola.goto("/#/classes");
    await expect(ola.getByTestId("xp-card")).toBeVisible();
    await ola.screenshot({ path: `${SHOTS}/xp-student.png`, fullPage: true });
  }
  await sctx.close();
  await tctx.close();
});

test("a game that runs without an error is claimed for XP, and one stopped at once isn't", async ({ browser }) => {
  const { ctx, page } = await signedIn(browser, "runner@example.com");
  const claims: string[] = [];
  // The server pays only after half an hour's work; here it answers at once.
  await page.route("**/api/xp/run", async (route) => {
    claims.push(JSON.parse(Buffer.from(JSON.parse(route.request().postData()!)._packed, "base64").toString()).code);
    await route.fulfill({ json: { awarded: 2 } });
  });
  await page.goto("/#/games");
  await chooseTemplate(page, "coins");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("stop").click();
  await page.waitForTimeout(6000);
  expect(claims).toEqual([]);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("xp-toast")).toContainText("+2 XP", { timeout: 15_000 });
  expect(claims).toHaveLength(1);
  expect(claims[0]).toMatch(/^[0-9a-f]{16}$/);
  await ctx.close();
});
