/**
 * Tutorials with a class, against the real server: a teacher writes one and
 * shares it with their classes; a student finds it in the library, does
 * it — Next waiting for the check — and is paid XP; the teacher assigns a
 * built-in tutorial to the class, and their results say how far each
 * student has got.
 */
import { expect, test, type Browser } from "@playwright/test";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
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

test("a teacher's tutorial, shared with a class, done by a student; a built-in one assigned, with each student's step", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach@example.com");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Tutorials P6");
  await teacher.getByTestId("new-class-go").click();
  await teacher.waitForURL(/#\/class\/\d+$/);
  await teacher.getByTestId("roster-emails").fill("uri@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("uri@example.com")).toBeVisible();

  // Write one, for the class.
  await teacher.goto("/#/tutorials");
  await teacher.getByTestId("tutorial-new").click();
  await teacher.getByTestId("tutorial-source").fill(MINE);
  await expect(teacher.getByTestId("tutorial-problems")).toHaveCount(0);
  await teacher.getByTestId("tutorial-visibility").selectOption("classes");
  await teacher.getByTestId("tutorial-save").click();
  await teacher.waitForURL(/#\/tutorials\/edit\/\w+$/);

  // The student finds it, and does it.
  const { ctx: sctx, page: uri } = await signedIn(browser, "uri@example.com");
  await uri.goto("/#/tutorials");
  const card = uri.getByTestId("tutorial-card").filter({ hasText: "Bouncing ball" });
  await expect(card).toContainText("by Teach");
  await card.getByTestId("tutorial-start").click();
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

  // A built-in one, assigned to the class: an assignment whose notes are the tutorial.
  await teacher.goto("/#/tutorials");
  await teacher.getByTestId("tutorial-card").filter({ hasText: "Your First Game" }).getByTestId("tutorial-assign").selectOption({ label: "Tutorials P6" });
  await teacher.waitForURL(/#\/assignment\/\w+$/);
  const slug = teacher.url().split("/").pop()!;
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
  await teacher.getByTestId("roster-emails").fill("vic@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("vic@example.com")).toBeVisible();

  // The markdown of a built-in one, as a file.
  await teacher.goto("/#/tutorials");
  const novel = teacher.getByTestId("tutorial-card").filter({ hasText: "Visual Novel" }).first();
  const [file] = await Promise.all([teacher.waitForEvent("download"), novel.getByTestId("tutorial-download").click()]);
  expect(file.suggestedFilename()).toBe("visual-novel.md");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile((await file.path())!, "utf8")).toContain("title: Visual Novel");

  // My copy of it, with a question in its first step.
  await novel.getByTestId("tutorial-copy").click();
  await teacher.waitForURL(/#\/tutorials\/copy\//);
  const source = teacher.getByTestId("tutorial-source");
  await expect(source).toHaveValue(/title: Visual Novel \(my copy\)/);
  const md = (await source.inputValue()).replace("\n---\n\n## Change the words", QUESTION + "\n---\n\n## Change the words");
  await source.fill(md);
  await teacher.getByTestId("tutorial-save").click();
  await teacher.waitForURL(/#\/tutorials\/edit\/\w+$/);

  // Tried: the question shows in the tutorial and is marked, as practice.
  await teacher.getByRole("button", { name: "Try it" }).click();
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

  // Assigned to the class: the student's answer is marked once and counted.
  await teacher.goto("/#/tutorials");
  await teacher.getByTestId("tutorial-card").filter({ hasText: "Visual Novel (my copy)" }).getByTestId("tutorial-assign").selectOption({ label: "Questions P2" });
  await teacher.waitForURL(/#\/assignment\/\w+$/);
  const slug = teacher.url().split("/").pop()!;
  // A second question, added on the assignment's page: in this class's copy only.
  const notes = teacher.getByTestId("notes-source");
  await notes.fill((await notes.inputValue()).replace("\n---\n\n## Change the words", "\n```quiz\nHow many endings are there?\nanswer: 2\nanswer: two\n```\n\n---\n\n## Change the words"));
  await teacher.getByTestId("notes-save").click();
  await expect(teacher.getByTestId("notes-save")).toHaveText("Saved");
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
