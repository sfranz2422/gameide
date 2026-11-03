/**
 * The Python check in a real browser, against the real server: a teacher uploads
 * a week's questions, predict block and all, and makes a game a showcase game; a
 * student's game really stops for a question, carries on when it's answered, and
 * shuts them out after as many wrong as the teacher set. (The server's rules are in test_server.py;
 * here the seconds are set low in playwright.config.ts.)
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { chooseTemplate, watchErrors } from "./helpers";

const BANK = `# Week 1
\`\`\`quiz
What is 2 + 2?
- [ ] 3
- [x] 4
- [ ] 5
explain: Two and two make four.
\`\`\`

\`\`\`quiz
Name the keyword that starts a function, in a word.
answer: def
\`\`\`

\`\`\`python predict
for i in range(3):
    print(i * 2)
\`\`\`
`;

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

/** Answers whatever's asked, right or wrong, the way a person would. */
async function answer(page: Page, right: boolean) {
  const card = page.getByTestId("python-check");
  const text = await card.innerText();
  if (text.includes("What is 2 + 2?")) {
    await card.getByText(right ? "4" : "3", { exact: true }).click();
  } else if (text.includes("Name the keyword")) {
    await card.locator("input.quiz-text").pressSequentially(right ? "def" : "not it");
  } else {
    // Spaces and arrows must reach the box, not the game underneath.
    const box = card.locator("textarea.quiz-predict");
    await box.pressSequentially(right ? "0 2 4" : "1 2 3");
    await box.press("ArrowLeft");
    await expect(box).toHaveValue(right ? "0 2 4" : "1 2 3");
  }
  await card.getByTestId("question-answer").click();
}

const steps = (page: Page) => page.evaluate(() => (window as any).__gameide.host.evalPython("instances('Player')[0].x + instances('Player')[0].y + len(instances('Player'))"));

test("a week's questions go up, and a showcase game stops for them", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach@example.com");

  // A slow page doesn't wipe what's typed while it loads.
  await teacher.route("**/api/check/bank", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue().catch(() => undefined); // the page may have moved on
  });
  await teacher.goto("/#/python-check");
  await teacher.getByTestId("bank-text").fill("typed before it loaded");
  await expect(teacher.getByTestId("bank-none")).toBeVisible({ timeout: 10_000 });
  await expect(teacher.getByTestId("bank-text")).toHaveValue("typed before it loaded");
  await teacher.unrouteAll({ behavior: "wait" });

  // No questions yet: the page says so.
  await teacher.reload();
  await expect(teacher.getByTestId("bank-none")).toBeVisible();

  // A file with a mistake is refused whole, in words, and changes nothing.
  await teacher.getByTestId("bank-text").fill(BANK + "\n```quiz\nNo answer here\n```\n");
  await teacher.getByTestId("bank-use").click();
  await expect(teacher.getByTestId("bank-problems")).toContainText("isn't finished", { timeout: 60_000 });
  await expect(teacher.getByTestId("bank-none")).toBeVisible();

  // A predict block that won't run says why.
  await teacher.getByTestId("bank-text").fill("```python predict\nprint(nothing_here)\n```\n");
  await teacher.getByTestId("bank-use").click();
  await expect(teacher.getByTestId("bank-problems")).toContainText("NameError", { timeout: 60_000 });
  // Nor can one hang the page: an endless loop is stopped.
  await teacher.getByTestId("bank-text").fill("```python predict\nwhile True:\n    pass\n```\n");
  await teacher.getByTestId("bank-use").click();
  await expect(teacher.getByTestId("bank-problems")).toContainText("still running", { timeout: 60_000 });

  // A file, uploaded: its predict block is run here in the browser, and its answer shown.
  await teacher.getByTestId("bank-file").setInputFiles({ name: "Week 1.md", mimeType: "text/markdown", buffer: Buffer.from(BANK) });
  await expect(teacher.getByTestId("bank-text")).toHaveValue(BANK);
  await teacher.getByTestId("bank-use").click();
  await expect(teacher.getByTestId("bank-saved")).toBeVisible({ timeout: 60_000 });
  await expect(teacher.getByTestId("bank-summary")).toContainText("Week 1");
  await expect(teacher.getByTestId("bank-summary")).toContainText("3 questions");
  await teacher.getByTestId("bank-list").locator("xpath=..").locator("summary").click();
  await expect(teacher.getByTestId("bank-list")).toContainText("0 2 4");

  // It opens again as written, predict block and all, to edit.
  await teacher.reload();
  await expect(teacher.getByTestId("bank-text")).toHaveValue(/python predict/);
  const edited = BANK + "\n```quiz\nWhat is 1 + 1?\n- [x] 2\n- [ ] 3\n```\n";
  await teacher.getByTestId("bank-text").fill(edited);
  await teacher.getByTestId("bank-use").click();
  await expect(teacher.getByTestId("bank-saved")).toBeVisible({ timeout: 60_000 });
  await expect(teacher.getByTestId("bank-summary")).toContainText("4 questions");
  await teacher.getByTestId("bank-text").fill(BANK);
  await teacher.getByTestId("bank-use").click();
  await expect(teacher.getByTestId("bank-summary")).toContainText("3 questions", { timeout: 60_000 });

  // The penalty is the teacher's: out after two here.
  await expect(teacher.getByTestId("setting-strikesOut")).toHaveValue("3");
  await teacher.getByTestId("setting-strikesOut").fill("99");
  await teacher.getByTestId("settings-save").click();
  await expect(teacher.getByTestId("settings-note")).toContainText("from 1 to 10");
  await teacher.getByTestId("setting-strikesOut").fill("2");
  await teacher.getByTestId("settings-save").click();
  await expect(teacher.getByTestId("settings-note")).toContainText("Saved");
  await teacher.reload();
  await expect(teacher.getByTestId("setting-strikesOut")).toHaveValue("2");

  // The teacher makes a game a showcase game.
  await teacher.goto("/#/games");
  await chooseTemplate(teacher, "coins");
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved");
  await teacher.getByTestId("publish").click();
  await teacher.getByTestId("publish-title").fill("Show Coins");
  await teacher.getByTestId("publish-public").check();
  await teacher.getByTestId("publish-showcase").check();
  await teacher.getByTestId("publish-go").click();
  const link = teacher.getByTestId("publish-link");
  await expect(link).toHaveValue(/\/play\/[\w-]+$/);
  const path = new URL(await link.inputValue()).pathname;

  // Signed out, it asks you to sign in.
  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  await anon.goto(path);
  await expect(anon.getByRole("link", { name: "Sign in to play it" })).toBeVisible();
  await stranger.close();

  // A student.
  const { ctx: sctx, page: student } = await signedIn(browser, "sam.check@example.com");
  const errors = watchErrors(student);
  await student.goto(path);
  await expect(student.getByTestId("player-title")).toHaveText("Show Coins");
  await expect(student.getByRole("button", { name: "Remix" })).toHaveCount(0);
  await student.getByTestId("player-start").click({ timeout: 60_000 });

  // It stops, and the game really is held.
  const check = student.getByTestId("python-check");
  await expect(check).toBeVisible({ timeout: 30_000 });
  await student.keyboard.down("ArrowRight");
  const held = await steps(student);
  await student.waitForTimeout(500);
  expect(await steps(student)).toBe(held);
  // Sound stops too: it plays on the page, and wouldn't stop with the game by itself.
  expect(await student.evaluate(() => (window as any).__gameide.host.sound.ctx?.state ?? "suspended")).toBe("suspended");
  await student.screenshot({ path: process.env.CHECK_SHOT ?? "test-results/python-check.png" });
  await student.keyboard.up("ArrowRight");

  // Reloading doesn't get round it: the same question's waiting.
  const asked = await check.innerText();
  await student.reload();
  await student.getByTestId("player-start").click({ timeout: 60_000 });
  await expect(check).toBeVisible({ timeout: 30_000 });
  expect((await check.innerText()).split("\n")[2]).toBe(asked.split("\n")[2]);

  // Wrong: it says the answer, and asks another.
  await answer(student, false);
  await expect(student.getByTestId("check-wrong")).toBeVisible();
  await expect(student.getByTestId("check-answer")).not.toBeEmpty();
  await student.getByTestId("check-next").click();
  await expect(student.getByTestId("check-wrong")).toHaveCount(0);

  // Right: the game goes on, and the keys are its own again.
  await answer(student, true);
  await expect(student.getByTestId("check-right")).toBeVisible();
  await student.getByTestId("check-continue").click();
  await expect(check).toHaveCount(0);
  const from = await steps(student);
  await student.keyboard.down("ArrowRight");
  await expect.poll(() => steps(student), { timeout: 3000 }).not.toBe(from);
  await student.keyboard.up("ArrowRight");

  // Due again in a few seconds. Two wrong, as the teacher set, and they're out.
  await expect(check).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 2; i++) {
    await answer(student, false);
    await expect(student.getByTestId("check-wrong")).toBeVisible();
    await student.getByTestId("check-next").click();
    if (i < 1) await expect(student.getByTestId("check-wrong")).toHaveCount(0);
  }
  await expect(student.getByTestId("check-out")).toBeVisible();

  // Out means out, reloading or not, until the time's up.
  await student.reload();
  await expect(student.locator(".player-message")).toContainText("Too many wrong answers");
  await student.waitForTimeout(6500);
  await student.reload();
  await student.getByTestId("player-start").click({ timeout: 60_000 });
  await expect(student.locator("canvas[data-testid=game-canvas]")).toBeVisible();

  // The teacher sees it, by name.
  await teacher.goto("/#/python-check");
  await teacher.reload();
  await expect(teacher.getByTestId("bank-report")).toContainText("Sam");
  expect(errors.filter((e) => !/40[139]|423/.test(e))).toEqual([]);
  await sctx.close();
  await tctx.close();
});
