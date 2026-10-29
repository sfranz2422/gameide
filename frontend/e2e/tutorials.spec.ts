/**
 * Tutorials with a class, against the real server: a teacher writes one —
 * kept in their library, never on the public Learn page — and assigns it to
 * a class from there; a student does it — Next waiting for the check — and
 * is paid XP; the teacher assigns a built-in tutorial to the class, and
 * their results say how far each student has got.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { setNotes } from "./helpers";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

/**
 * A class gets a tutorial the way a teacher gives it one: Try it in the
 * library (its starting game, in their games), New assignment on the class
 * page from that game, then Link to… in the library. On the assignment's
 * page afterwards; its slug.
 */
async function giveClass(teacher: Page, classUrl: string, tutorial: string, title: string): Promise<string> {
  await teacher.goto("/#/library");
  await teacher.getByTestId("library-row").filter({ hasText: tutorial }).first().getByTestId("library-try").click();
  await teacher.waitForURL(/#\/p\//);
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved");
  await teacher.goto(classUrl);
  await teacher.getByTestId("new-assignment").click();
  await teacher.getByTestId("assignment-game").selectOption({ label: tutorial });
  await teacher.getByTestId("assignment-title").fill(title);
  await teacher.getByTestId("assignment-go").click();
  await teacher.getByTestId("assignment-link").filter({ hasText: title }).click();
  await teacher.waitForURL(/#\/assignment\/\w+$/);
  const slug = teacher.url().split("/").pop()!;
  await teacher.goto("/#/library");
  await teacher.getByTestId("library-row").filter({ hasText: tutorial }).first().getByTestId("library-link").click();
  await teacher.getByTestId("library-dialog").getByLabel(title, { exact: true }).check();
  await teacher.getByTestId("library-link-save").click();
  await expect(teacher.getByTestId("library-report")).toContainText("Linked");
  await teacher.goto(`/#/assignment/${slug}`);
  return slug;
}

const MINE = `---
title: Bouncing ball
level: Top-Down
time: 5 min
starter: empty
description: Make a ball.
---
# A ball

Press the + beside Objects and call it **Ball**.

\`\`\`check
object Ball exists
\`\`\`

---

## Done

That's it.
`;

test("a teacher's tutorial, given to a class from the library, done by a student; a built-in one assigned, with each student's step", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach@example.com");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Tutorials P6");
  await teacher.getByTestId("new-class-go").click();
  await teacher.waitForURL(/#\/class\/\d+$/);
  const classUrl = teacher.url();
  await teacher.getByTestId("roster-emails").fill("uri@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("uri@example.com")).toBeVisible();

  // Write one, for the class: in the tutorial library (library.py), where
  // tutorials are written. Only me: it isn't on the Learn page, for anyone.
  const made = await teacher.request.post("/api/library", { data: { body: MINE } });
  expect(made.status()).toBe(201);
  await teacher.goto("/#/tutorials");
  await expect(teacher.getByTestId("tutorial-card").filter({ hasText: "Your First Game" })).toBeVisible();
  await expect(teacher.getByTestId("tutorial-card").filter({ hasText: "Bouncing ball" })).toHaveCount(0);
  await teacher.goto("/#/library");
  const row = teacher.getByTestId("library-row").filter({ hasText: "Bouncing ball" });
  await expect(row.getByRole("option", { name: "My classes" })).toHaveCount(0);
  // Nowhere to assign it but Link to…: the library has no Assign to, nor the Learn page.
  await expect(row.getByTestId("library-assign")).toHaveCount(0);
  // Given to the class: an assignment whose notes are the tutorial.
  const mineSlug = await giveClass(teacher, classUrl, "Bouncing ball", "Ball homework");

  // The student doesn't find it on the Learn page; they do it from the assignment.
  const { ctx: sctx, page: uri } = await signedIn(browser, "uri@example.com");
  await uri.goto("/#/tutorials");
  await expect(uri.getByTestId("tutorial-card").filter({ hasText: "Your First Game" })).toBeVisible();
  await expect(uri.getByTestId("tutorial-card").filter({ hasText: "Bouncing ball" })).toHaveCount(0);
  await uri.goto(`/a/${mineSlug}`);
  await uri.waitForURL(/#\/p\//);
  await expect(uri.getByTestId("tutorial-next")).toBeDisabled();
  await uri.getByTestId("add-objects").click();
  await uri.getByRole("textbox", { name: "Name", exact: true }).fill("Ball");
  await uri.keyboard.press("Enter");
  await uri.getByTestId("check-my-work").click();
  await expect(uri.getByTestId("tutorial-next")).toBeEnabled();
  await expect(uri.getByTestId("xp-toast").first()).toContainText("+2 XP");
  await uri.getByTestId("tutorial-next").click();
  await expect(uri.getByTestId("tutorial-step")).toHaveText("Step 2 of 2 · finished ✓");
  await expect(uri.getByTestId("xp-toast").filter({ hasText: "Tutorial finished" })).toContainText("+20 XP");

  // A built-in one, given to the class the same way.
  await teacher.goto("/#/tutorials");
  await expect(teacher.getByTestId("tutorial-card").filter({ hasText: "Your First Game" }).getByTestId("tutorial-start")).toBeVisible();
  await expect(teacher.getByTestId("tutorial-assign")).toHaveCount(0);
  const slug = await giveClass(teacher, classUrl, "Your First Game", "First game homework");
  await uri.goto(`/a/${slug}`);
  await uri.waitForURL(/#\/p\//);
  await expect(uri.getByTestId("tutorial-step")).toHaveText("Step 1 of 8");
  await uri.getByTestId("tutorial-next").click();
  await uri.getByTestId("add-sprites").click();
  await uri.getByTestId("starter-player").click();
  await uri.getByTestId("check-my-work").click();
  await expect(uri.getByTestId("tutorial-next")).toBeEnabled();
  await uri.getByTestId("tutorial-next").click();
  await expect(uri.getByTestId("save-status")).toHaveText("Saved");

  await teacher.reload();
  await expect(teacher.getByTestId("result-row").filter({ hasText: "Uri" }).getByTestId("row-tutorial")).toHaveText("step 3 of 8");
  await sctx.close();
  await tctx.close();
});

const QUESTION = `
\`\`\`quiz
What does "lines" hold in each scene?
- [ ] One picture
- [x] What's said, in order
\`\`\`
`;

test("a built-in tutorial copied, a question added, tried as practice, downloaded, and assigned: the question counts", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach2@example.com");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Questions P2");
  await teacher.getByTestId("new-class-go").click();
  await teacher.waitForURL(/#\/class\/\d+$/);
  const classUrl = teacher.url();
  await teacher.getByTestId("roster-emails").fill("vic@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("vic@example.com")).toBeVisible();

  // The Learn page is for following them: copying and downloading are the library's.
  await teacher.goto("/#/tutorials");
  const card = teacher.getByTestId("tutorial-card").filter({ hasText: "Visual Novel" }).first();
  await expect(card.getByTestId("tutorial-start")).toBeVisible();
  await expect(teacher.getByTestId("tutorial-copy")).toHaveCount(0);
  await expect(teacher.getByTestId("tutorial-download")).toHaveCount(0);

  // The markdown of a built-in one, as a file, from its row in the library.
  await teacher.goto("/#/library");
  const novel = teacher.getByTestId("library-row").filter({ hasText: "Visual Novel" }).first();
  const [file] = await Promise.all([teacher.waitForEvent("download"), novel.getByTestId("library-download").click()]);
  expect(file.suggestedFilename()).toBe("visual-novel.md");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile((await file.path())!, "utf8")).toContain("title: Visual Novel");

  // Duplicated: my copy of it, in the library, opened in its editor
  // (PresMaker), with a question put into its first step and saved there (Ctrl+S).
  await novel.getByTestId("library-duplicate").click();
  await expect(teacher.getByTestId("library-report")).toContainText("Visual Novel (my copy)");
  await teacher.getByTestId("library-row").filter({ hasText: "Visual Novel (my copy)" }).getByTestId("library-edit").click();
  await teacher.waitForURL(/\/teacher\/tutorials\/\w+\/edit$/);
  await expect.poll(() => teacher.evaluate(() => !!(window as any).PM?.editor()?.getValue())).toBe(true);
  expect(await teacher.evaluate(() => (window as any).PM.editor().getValue())).toContain("title: Visual Novel (my copy)");
  await teacher.evaluate((q) => {
    const cm = (window as any).PM.editor();
    cm.setValue(cm.getValue().replace("\n---\n\n## Change the words", q + "\n---\n\n## Change the words"));
  }, QUESTION);
  await teacher.keyboard.press("ControlOrMeta+s");
  await expect.poll(() => teacher.evaluate(() => (window as any).PM.dirty())).toBe(false);
  // The Save button says so, where the teacher is looking.
  await expect(teacher.locator('[data-cmd="save"]')).toHaveText(/✓ Saved/);
  await expect(teacher.locator('[data-cmd="save"]')).toHaveText("Save", { timeout: 5000 });

  // Tried, from its row in the library (it's the teacher's own, so not on
  // the Learn page): the question shows in the tutorial and is marked, as practice.
  await teacher.goto("/#/library");
  const mine = teacher.getByTestId("library-row").filter({ hasText: "Visual Novel (my copy)" });
  await mine.getByTestId("library-try").click();
  await teacher.waitForURL(/#\/p\//);
  const q = teacher.getByTestId("tutorial-pane").getByTestId("question");
  await expect(q).toContainText('What does "lines" hold');
  await q.getByLabel("One picture").check();
  await q.getByTestId("question-answer").click();
  await expect(q.getByTestId("question-result")).toContainText("Practice: ✗ Not right");
  await q.getByLabel("What's said, in order").check();
  await q.getByTestId("question-answer").click();
  await expect(q.getByTestId("question-result")).toContainText("Practice: ✓ Right");
  await expect(teacher.getByTestId("tutorial-next")).toBeDisabled(); // the step's check still holds Next, not the question

  // Given to the class, from the library: the student's answer is marked once and counted.
  const slug = await giveClass(teacher, classUrl, "Visual Novel (my copy)", "Novel homework");
  // The assignment's page says which tutorial it is, and that it's the library's to edit.
  await expect(teacher.getByTestId("tutorial-which")).toContainText("Visual Novel (my copy)");
  await expect(teacher.getByTestId("tutorial-edit")).toHaveAttribute("href", /\/teacher\/tutorials\/\w+\/edit$/);
  // A second question, added to the tutorial (in the library): the assignment, linked, has it at once.
  const now = (await (await teacher.request.get(`/api/assignments/${slug}`)).json()).notes as string;
  await setNotes(teacher, now.replace("\n---\n\n## Change the words", "\n```quiz\nHow many endings are there?\nanswer: 2\nanswer: two\n```\n\n---\n\n## Change the words"));
  const { ctx: sctx, page: vic } = await signedIn(browser, "vic@example.com");
  await vic.goto(`/a/${slug}`);
  await vic.waitForURL(/#\/p\//);
  await expect(vic.getByTestId("tutorial-pane").getByTestId("question")).toHaveCount(2);
  await expect(vic.getByTestId("tutorial-pane")).toContainText("How many endings are there?"); // the assignment's own question
  await expect(vic.getByTestId("tutorial-pane")).not.toContainText("answer: 2");
  const sq = vic.getByTestId("tutorial-pane").getByTestId("question").first();
  await expect(sq).toContainText('What does "lines" hold');
  await expect(sq).not.toContainText("[x]");
  await sq.getByLabel("What's said, in order").check();
  await sq.getByTestId("question-answer").click();
  await expect(sq.getByTestId("question-result")).toHaveText("✓ Right — 1 / 1");
  await expect(sq.getByTestId("question-answer")).toHaveCount(0); // one try
  await teacher.reload();
  await expect(teacher.getByTestId("result-row").filter({ hasText: "Vic" })).toContainText("1");
  await sctx.close();
  await tctx.close();
});

test("the tutorial library: built-ins listed, one assigned and linked, an upload, and its editor (PresMaker) drawing a step's checks", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx, page: teacher } = await signedIn(browser, "teach3@example.com");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Library P3");
  await teacher.getByTestId("new-class-go").click();
  await teacher.waitForURL(/#\/class\/\d+$/);
  const classUrl = teacher.url();

  // The built-in ones are there before any is used, marked as built-in.
  await teacher.goto("/#/library");
  const topDown = teacher.getByTestId("library-row").filter({ hasText: "Top-Down Adventure" });
  await expect(topDown).toContainText("Built-in");
  await expect(topDown).toContainText("Not used yet");

  // Given to a class from its row in the library, as it ships: the library has it, linked to that assignment.
  await expect(topDown.getByTestId("library-audience")).toHaveCount(0); // the built-ins' audience is an admin's
  await giveClass(teacher, classUrl, "Top-Down Adventure", "Village homework");
  await expect(teacher.getByTestId("tutorial-which")).toContainText("Top-Down Adventure");
  await expect(teacher.getByTestId("tutorial-which")).toContainText("from a built-in tutorial");
  // Its preview: no header, its checks counted and shown as checks.
  const box = teacher.getByTestId("notes-editor");
  await expect(box).not.toContainText("starter: topdown");
  await expect(box).toContainText("Checks — Next waits for these");
  await expect(box).not.toContainText(" 0 tests");
  if (process.env.SHOT_DIR) await teacher.getByTestId("notes-editor").screenshot({ path: `${process.env.SHOT_DIR}/lib-box.png` });
  await teacher.goto("/#/library");
  await expect(teacher.getByTestId("library-row").filter({ hasText: "Top-Down Adventure" })).toContainText("1 assignment");
  await expect(teacher.getByTestId("library-row").filter({ hasText: "Top-Down Adventure" })).toHaveCount(1); // the built-in and its row are one

  // Many files at once from the computer.
  await teacher.getByTestId("library-files").setInputFiles([
    { name: "Mine.md", mimeType: "text/markdown", buffer: Buffer.from("---\ntitle: Mine\nlevel: Top-Down\nstarter: empty\n---\n# Mine\n\n```check\nobject Ball exists\n```\n\nhighlight: add-event\n") },
  ]);
  await expect(teacher.getByTestId("library-report")).toContainText("1 added");
  const mine = teacher.getByTestId("library-row").filter({ hasText: "Mine" });
  await expect(mine).toBeVisible();
  if (process.env.SHOT_DIR) await teacher.screenshot({ path: `${process.env.SHOT_DIR}/lib-page.png` });

  // Its editor: PresMaker, drawing the step's checks and spotlight in words.
  await mine.getByTestId("library-edit").click();
  await teacher.waitForURL(/\/teacher\/tutorials\/\w+\/edit$/);
  // Its header, cut off as the first slide, is drawn as a title card…
  await expect(teacher.locator("#stage")).toContainText("📘 Mine", { timeout: 15_000 });
  await expect(teacher.locator("#stage")).not.toContainText("starter: empty");
  // …and the step after it shows its checks and spotlight in words.
  await teacher.locator("#p-next").click();
  await expect(teacher.locator("#stage")).toContainText("Checks — Next waits for these");
  if (process.env.SHOT_DIR) await teacher.screenshot({ path: `${process.env.SHOT_DIR}/lib-edit.png` });
  await expect(teacher.locator("#stage")).toContainText("object Ball exists");
  await expect(teacher.locator("#stage")).toContainText("Points at add-event");
  await ctx.close();
});

test("an admin takes a built-in off the Learn page, and puts it back", async ({ browser }) => {
  const { ctx, page: admin } = await signedIn(browser, "teach4@example.com");
  await admin.goto("/#/library");
  const coins = admin.getByTestId("library-row").filter({ hasText: "Collect the Coins" });
  await expect(coins.getByTestId("library-audience")).toHaveValue("site");
  await coins.getByTestId("library-audience").selectOption("hidden");
  await expect(coins.getByTestId("library-audience")).toHaveValue("hidden");
  // Gone from the Learn page, for everyone, not just the admin.
  const { ctx: sctx, page: someone } = await signedIn(browser, "learner@example.com");
  await someone.goto("/#/tutorials");
  await expect(someone.getByTestId("tutorial-card").filter({ hasText: "Your First Game" })).toBeVisible();
  await expect(someone.getByTestId("tutorial-card").filter({ hasText: "Collect the Coins" })).toHaveCount(0);
  await coins.getByTestId("library-audience").selectOption("site");
  await expect(coins.getByTestId("library-audience")).toHaveValue("site");
  await someone.reload();
  await expect(someone.getByTestId("tutorial-card").filter({ hasText: "Collect the Coins" })).toBeVisible();
  await sctx.close();
  await ctx.close();
});
