/**
 * Classes, against the real server: a teacher makes a class and an
 * assignment from one of their games; a student opens it, gets their own
 * copy, and turns it in; the teacher opens the student's game read only,
 * plays it, comments and scores, and copies it to demo — and the student
 * sees the comment and the score.
 */
import { expect, test, type Browser } from "@playwright/test";
import { chooseTemplate, SHOTS, watchErrors } from "./helpers";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

test("a class: an assignment from a game, a student's own copy, turned in, viewed, commented on and scored", async ({ browser }) => {
  // A teacher of its own: it counts the games on My Games, and the other
  // specs' teacher (teach@) makes games in parallel, so sharing one failed
  // now and then with 2 where 1 was right.
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach2@example.com");
  const errors = watchErrors(teacher);
  await teacher.goto("/#/games");
  await chooseTemplate(teacher, "coins");
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved");

  // A class, its students by email, and an assignment from the game.
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Game Design P4");
  await teacher.getByTestId("new-class-go").click();
  await expect(teacher.getByRole("heading", { name: "Game Design P4" })).toBeVisible();
  await teacher.getByTestId("roster-emails").fill("kim@example.com, lee@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("kim@example.com")).toBeVisible();
  await teacher.getByTestId("new-assignment").click();
  await teacher.getByTestId("assignment-game").selectOption({ label: "Collect the coins" });
  await teacher.getByTestId("assignment-title").fill("Coin level");
  await teacher.getByTestId("assignment-points").fill("10");
  await teacher.getByTestId("assignment-go").click();
  const link = teacher.getByTestId("assignment-link");
  await expect(link).toHaveText("Coin level");
  const slug = (await link.getAttribute("href"))!.split("/").pop()!;
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/class-teacher.png`, fullPage: true });
  // The starter is the class's, not one more game on My Games.
  await teacher.goto("/#/games");
  await expect(teacher.getByTestId("project-card")).toHaveCount(1);

  // A student finds the class, opens the assignment and gets their own copy.
  const { ctx: sctx, page: kim } = await signedIn(browser, "kim@example.com");
  await kim.goto("/#/classes");
  await kim.getByTestId("class-card").filter({ hasText: "Game Design P4" }).click();
  await expect(kim.getByTestId("class-assignment")).toContainText("Not started");
  await kim.getByTestId("open-assignment").click();
  await kim.waitForURL(/#\/p\//);
  const kimGame = kim.url().split("#/p/")[1]!;
  await expect(kim.getByLabel("Game name")).toHaveValue("Coin level");
  await kim.getByLabel("Game name").fill("Kim's coins");
  await expect(kim.getByTestId("save-status")).toHaveText("Saved");
  await kim.getByTestId("turn-in").click();
  await expect(kim.getByTestId("turn-in")).toHaveText("Turned in ✓");
  // The same link again is the same game, not another copy.
  await kim.goto(`/a/${slug}`);
  await kim.waitForURL(new RegExp(`#/p/${kimGame}$`));
  await expect(kim.getByLabel("Game name")).toHaveValue("Kim's coins");

  // The teacher sees it, opens it read only and plays it.
  await teacher.goto(`/#/assignment/${slug}`);
  const row = teacher.getByTestId("result-row").filter({ hasText: "Kim" });
  await expect(row.getByTestId("view-turned-in")).toBeVisible();
  await expect(teacher.getByTestId("result-row").filter({ hasText: "Lee" })).toContainText("Not started");
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/class-results.png`, fullPage: true });
  await row.getByTestId("view-game").click();
  await expect(teacher.getByTestId("read-only")).toBeVisible();
  await expect(teacher.getByLabel("Game name")).toHaveValue("Kim's coins");
  await expect(teacher.getByTestId("save-status")).toHaveCount(0);
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/class-view.png` });
  await teacher.getByTestId("play").click();
  await expect.poll(() => teacher.evaluate(() => (window as any).__gameide.host.evalPython("global_vars.total")), { timeout: 60_000 }).toBe(15);
  await teacher.getByTestId("stop").click();
  // Trying a change out never reaches the student's game.
  await teacher.getByLabel("Game name").fill("Teacher was here");
  await teacher.waitForTimeout(2500);
  await teacher.getByTestId("view-comments").click();
  await teacher.getByTestId("comment-text").fill("Great level! Add a second room.");
  await teacher.getByTestId("comment-send").click();
  await expect(teacher.getByTestId("comment")).toHaveText(/Great level/);
  // Looking again shows the student's game — never what a tab closed mid-change
  // left behind in this browser under the game's id (useProject's backup).
  await teacher.evaluate(async (id) => {
    const p = (await (await fetch(`/api/projects/${id}`)).json()).data;
    localStorage.setItem(`gameide.unsaved.${id}`, JSON.stringify({ ...p, name: "Teacher was here", modified: new Date(Date.now() + 60_000).toISOString() }));
  }, kimGame);
  await teacher.goto(`/#/assignment/${slug}`);
  await row.getByTestId("view-game").click();
  await expect(teacher.getByTestId("read-only")).toBeVisible();
  await expect(teacher.getByLabel("Game name")).toHaveValue("Kim's coins");

  await kim.reload();
  await expect(kim.getByLabel("Game name")).toHaveValue("Kim's coins");

  // A score, and a copy to show the class.
  await teacher.goto(`/#/assignment/${slug}`);
  await row.getByTestId("score").fill("9");
  await row.getByTestId("score").blur();
  await expect(row.getByTestId("score")).toHaveValue("9");
  await row.getByTestId("duplicate").click();
  await teacher.waitForURL(/#\/p\//);
  await expect(teacher.getByLabel("Game name")).toHaveValue("Kim's coins (from Kim)");
  await expect(teacher.getByTestId("save-status")).toBeVisible();
  await expect(teacher.getByTestId("read-only")).toHaveCount(0);

  // The student sees the comment and the score.
  await kim.goto("/#/classes");
  await kim.getByTestId("class-card").filter({ hasText: "Game Design P4" }).click();
  await expect(kim.getByTestId("new-comments")).toHaveText("1 new comment");
  await expect(kim.getByTestId("my-score")).toHaveText("9 / 10");
  if (SHOTS) await kim.screenshot({ path: `${SHOTS}/class-student.png`, fullPage: true });
  await kim.getByTestId("open-assignment").click();
  await kim.getByTestId("editor-comments").click();
  await expect(kim.getByTestId("comment")).toContainText("Great level! Add a second room.");
  await kim.getByTestId("comment-text").fill("Will do!");
  await kim.getByTestId("comment-send").click();
  await expect(kim.getByTestId("comment")).toHaveCount(2);
  if (SHOTS) await kim.screenshot({ path: `${SHOTS}/class-comments.png` });

  expect(errors.filter((e) => !e.includes("401"))).toEqual([]);
  await sctx.close();
  await tctx.close();
});

test("someone not in a class can't see it, and a hidden assignment can't be started", async ({ browser }) => {
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach@example.com");
  await teacher.goto("/#/games");
  await chooseTemplate(teacher, "coins");
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Period 9");
  await teacher.getByTestId("new-class-go").click();
  await teacher.waitForURL(/#\/class\/\d+/);
  const classUrl = teacher.url();
  await teacher.getByTestId("new-assignment").click();
  await teacher.getByTestId("assignment-game").selectOption({ index: 1 });
  await teacher.getByTestId("assignment-title").fill("Secret level");
  await teacher.getByTestId("assignment-go").click();
  const slug = (await teacher.getByTestId("assignment-link").getAttribute("href"))!.split("/").pop()!;
  await teacher.getByTestId("toggle-hidden").click();
  await expect(teacher.getByTestId("class-assignment")).toContainText("Hidden from students");

  const { ctx: sctx, page: outsider } = await signedIn(browser, "nora@example.com");
  await outsider.goto("/" + classUrl.split("/").slice(3).join("/"));
  await expect(outsider.getByText("That isn't one of your classes.")).toBeVisible();
  await outsider.goto(`/a/${slug}`);
  await expect(outsider.getByText("This assignment isn't open. Ask your teacher.")).toBeVisible();
  await sctx.close();
  await tctx.close();
});

test("the week's calendar: pasted as text, previewed as day cards, posted to two periods, seen by the class", async ({ browser }) => {
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach3@example.com");
  const errors = watchErrors(teacher);
  for (const name of ["Calendar P7", "Calendar P4"]) {
    await teacher.goto("/#/classes");
    await teacher.getByTestId("new-class-name").fill(name);
    await teacher.getByTestId("new-class-go").click();
    await expect(teacher.getByRole("heading", { name })).toBeVisible();
  }
  await teacher.getByTestId("roster-emails").fill("cal@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("cal@example.com")).toBeVisible();

  await teacher.getByTestId("edit-calendar").click();
  // The preview is drawn as it's typed, before anything is saved.
  await teacher.getByTestId("calendar-text").fill("Week of Oct 27\nMonday:\nLevel 1\nFriday quiz on loops\nTuesday: playtest\n- swap with a partner");
  const days = teacher.getByTestId("cal-day");
  await expect(days).toHaveCount(2);
  await expect(days.nth(0)).toContainText("Friday quiz on loops"); // a to-do, not a third day
  await expect(teacher.locator(".cal-heading")).toHaveText("Week of Oct 27");
  await teacher.getByRole("checkbox", { name: "Calendar P7" }).check();
  await teacher.getByTestId("save-calendar").click();
  await expect(teacher.getByTestId("edit-calendar")).toHaveText("Edit calendar");
  await expect(days).toHaveCount(2);
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/class-calendar.png`, fullPage: true });

  // The other period got the same week.
  await teacher.goto("/#/classes");
  await teacher.getByTestId("class-card").filter({ hasText: "Calendar P7" }).click();
  await expect(teacher.getByTestId("cal-day")).toHaveCount(2);

  // A student of the class sees it, with nothing to edit.
  const { ctx: sctx, page: student } = await signedIn(browser, "cal@example.com");
  await student.goto("/#/classes");
  await student.getByTestId("class-card").filter({ hasText: "Calendar P4" }).click();
  await expect(student.getByTestId("cal-day")).toHaveCount(2);
  await expect(student.getByTestId("cal-day").nth(1)).toContainText("swap with a partner");
  await expect(student.getByTestId("edit-calendar")).toHaveCount(0);

  expect(errors).toEqual([]);
  await sctx.close();
  await tctx.close();
});
