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
