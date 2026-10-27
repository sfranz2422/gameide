/**
 * An assignment's notes, against the real server: the teacher writes notes
 * with slides, a question and tests; the student reads them in the editor's
 * Notes tab, answers the question, and presses Check my work — which plays
 * their game in the game pane, holding keys — then turns it in; the
 * teacher's Check all runs the same tests on what they turned in, and the
 * points are in the total.
 */
import { expect, test, type Browser } from "@playwright/test";
import { chooseTemplate, SHOTS } from "./helpers";

async function signedIn(browser: Browser, email: string) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/login?email=${encodeURIComponent(email)}&next=/`);
  return { ctx, page };
}

const NOTES = `# Collect the coins

Move with the arrow keys. In Player's Step event:

highlight: play

\`\`\`python
move_and_collide(dx, dy, "Wall")
\`\`\`

---

## A question

\`\`\`quiz
Which function says whether a key is held down?
- [ ] keyboard_check_pressed
- [x] keyboard_check
\`\`\`

---

## Checks

\`\`\`tests
object Player exists
Player.step uses keyboard_check
after 1 second holding right, Player.x increased (2 points)
after 1 second, Player.x stayed the same
after 1 second holding right, instance_number("Coin") < global_vars.total
Player has event draw
\`\`\`
`;

test("notes: slides, a question, Check my work in the game pane, and the teacher's Check all", async ({ browser }) => {
  test.setTimeout(180_000);
  // A teacher of its own: it picks its game by name ("Collect the coins"),
  // and the other specs' teacher makes games of that name in parallel.
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach3@example.com");
  await teacher.goto("/#/games");
  await chooseTemplate(teacher, "coins");
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Notes P5");
  await teacher.getByTestId("new-class-go").click();
  await teacher.getByTestId("roster-emails").fill("nia@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("nia@example.com")).toBeVisible();
  await teacher.getByTestId("new-assignment").click();
  await teacher.getByTestId("assignment-game").selectOption({ label: "Collect the coins" });
  await teacher.getByTestId("assignment-title").fill("Coins with notes");
  await teacher.getByTestId("assignment-go").click();
  await teacher.getByTestId("assignment-link").filter({ hasText: "Coins with notes" }).click();
  await teacher.getByTestId("notes-source").fill(NOTES);
  await teacher.getByTestId("notes-save").click();
  await expect(teacher.getByTestId("notes-save")).toHaveText("Saved");
  const slug = teacher.url().split("/").pop()!;

  // The student's editor opens on the notes.
  const { ctx: sctx, page: nia } = await signedIn(browser, "nia@example.com");
  await nia.goto(`/a/${slug}`);
  await nia.waitForURL(/#\/p\//);
  await expect(nia.getByTestId("notes-pane")).toBeVisible();
  await expect(nia.getByTestId("slide-count")).toHaveText("1 / 3");
  // The slide's spotlight, on Play — and the line itself isn't shown.
  await expect(nia.getByTestId("spotlight")).toHaveAttribute("data-target", "play");
  await expect(nia.getByTestId("notes-pane")).not.toContainText("highlight:");
  // Code in the notes is for typing, not copying.
  expect(await nia.getByTestId("notes-pane").locator("pre").first().evaluate((el) => getComputedStyle(el).userSelect)).toBe("none");
  await expect(nia.getByTestId("notes-pane")).not.toContainText("[x]");

  await nia.getByTestId("slide-next").click();
  await nia.getByRole("radio", { name: "keyboard_check", exact: true }).check();
  await nia.getByTestId("question-answer").click();
  await expect(nia.getByTestId("question-result")).toContainText("✓ Right");

  await nia.getByTestId("slide-next").click();
  await nia.getByTestId("check-my-work").click();
  await expect(nia.getByTestId("check-my-work")).toHaveText("✔ Check my work", { timeout: 120_000 });
  const lines = nia.getByTestId("test-line");
  await expect(lines).toHaveCount(6);
  await expect(lines.filter({ hasText: "✓" })).toHaveCount(5);
  await expect(lines.filter({ hasText: "Player has event draw" })).toContainText("Player doesn't have a draw event yet.");
  if (SHOTS) await nia.screenshot({ path: `${SHOTS}/notes-student.png` });
  await nia.getByTestId("turn-in").click();
  await expect(nia.getByTestId("turn-in")).toHaveText("Turned in ✓");

  // The teacher's Check all: the result that counts.
  await teacher.reload();
  await teacher.getByTestId("check-all").click();
  await expect(teacher.getByTestId("check-all-status")).toContainText("Checked 1 game", { timeout: 120_000 });
  const row = teacher.getByTestId("result-row").filter({ hasText: "Nia" });
  await expect(row.getByTestId("row-tests")).toContainText("6 / 7");
  await expect(row.getByTestId("row-quiz")).toHaveText("1");
  await expect(row.getByTestId("row-total")).toContainText("7");
  if (SHOTS) await teacher.screenshot({ path: `${SHOTS}/notes-teacher.png`, fullPage: true });
  await sctx.close();
  await tctx.close();
});

const PUZZLES = `# Puzzles

- [ ] Read this
- [ ] Solve them all

\`\`\`cards
sprite -> a picture, with frames
room -> where the game happens
\`\`\`

\`\`\`quiz
type: order
Put the lines in order.
- def on_step(self):
-     if keyboard_check("right"):
-         self.x += 4
\`\`\`

\`\`\`quiz
type: bug
Which line is wrong?
~~~python
x = 1
print(x
y = 2
~~~
bug: 2
\`\`\`

\`\`\`quiz
type: sort
Sort them.
group: Event
- Create
- Step
group: Function
- instance_create
- keyboard_check
\`\`\`

\`\`\`quiz
type: predict
What will this print?
~~~python
for i in range(3):
    print(i * 2)
~~~
answer: 0 2 4
\`\`\`
`;

test("notes: a checklist that stays ticked, flip cards, and order, bug, sort and predict questions", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach3@example.com");
  await teacher.goto("/#/games");
  await chooseTemplate(teacher, "platformer");
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved");
  await teacher.goto("/#/classes");
  await teacher.getByTestId("new-class-name").fill("Puzzles P6");
  await teacher.getByTestId("new-class-go").click();
  await teacher.getByTestId("roster-emails").fill("pia@example.com");
  await teacher.getByTestId("roster-add").click();
  await expect(teacher.getByText("pia@example.com")).toBeVisible();
  await teacher.getByTestId("new-assignment").click();
  await teacher.getByTestId("assignment-game").selectOption({ label: "Platformer" });
  await teacher.getByTestId("assignment-title").fill("Puzzles");
  await teacher.getByTestId("assignment-go").click();
  await teacher.getByTestId("assignment-link").filter({ hasText: "Puzzles" }).click();
  await teacher.getByTestId("notes-source").fill(PUZZLES);
  await teacher.getByTestId("notes-save").click();
  await expect(teacher.getByTestId("notes-save")).toHaveText("Saved");
  const slug = teacher.url().split("/").pop()!;

  const { ctx: sctx, page: pia } = await signedIn(browser, "pia@example.com");
  await pia.goto(`/a/${slug}`);
  await pia.waitForURL(/#\/p\//);
  const pane = pia.getByTestId("notes-pane");
  await expect(pane).toBeVisible();

  // The checklist: ticked, and still ticked after a reload.
  await pane.getByRole("checkbox", { name: "Read this" }).check();
  await pia.reload();
  await expect(pia.getByTestId("notes-pane").getByRole("checkbox", { name: "Read this" })).toBeChecked();
  await expect(pia.getByTestId("notes-pane").getByRole("checkbox", { name: "Solve them all" })).not.toBeChecked();

  // A flip card turns over.
  const card = pia.getByTestId("flip-cards").getByRole("button").first();
  await expect(card).toContainText("sprite");
  await card.click();
  await expect(card).toContainText("a picture, with frames");

  // Put in order: move each line up to where it belongs.
  const want = ["def on_step(self):", '    if keyboard_check("right"):', "        self.x += 4"];
  const order = pia.getByTestId("quiz-order");
  for (let t = 0; t < want.length; t++) {
    for (;;) {
      const lines = await order.locator(".quiz-order-line").allTextContents();
      const at = lines.indexOf(want[t]!);
      if (at <= t) break;
      await order.locator(".quiz-order-row").nth(at).getByRole("button", { name: "Move up" }).click();
    }
  }
  const questions = pia.getByTestId("question");
  await questions.nth(0).getByTestId("question-answer").click();
  await expect(questions.nth(0).getByTestId("question-result")).toContainText("✓ Right");

  // Find the bug: line 2.
  await pia.getByTestId("quiz-bug").getByRole("button", { name: /^Line 2:/ }).click();
  await questions.nth(1).getByTestId("question-answer").click();
  await expect(questions.nth(1).getByTestId("question-result")).toContainText("✓ Right");

  // Sort: click each item, then its group.
  const groupOf: Record<string, string> = { Create: "Event", Step: "Event", instance_create: "Function", keyboard_check: "Function" };
  const sort = pia.getByTestId("quiz-sort");
  for (let k = 0; k < 4; k++) {
    const chip = sort.getByTestId("sort-tray").locator(".quiz-sort-item").first();
    const text = (await chip.textContent())!.trim();
    await chip.click();
    await sort.getByTestId(`sort-group-${groupOf[text]}`).click();
  }
  await questions.nth(2).getByTestId("question-answer").click();
  await expect(questions.nth(2).getByTestId("question-result")).toContainText("✓ Right");

  // Predict the output: what it really prints is shown only once it's answered.
  await expect(questions.nth(3).getByTestId("predict-output")).toHaveCount(0);
  await questions.nth(3).getByRole("textbox", { name: "What it will print" }).fill("0\n2\n4");
  await questions.nth(3).getByTestId("question-answer").click();
  await expect(questions.nth(3).getByTestId("question-result")).toContainText("✓ Right");
  await expect(questions.nth(3).getByTestId("predict-output")).toContainText("0 2 4");
  if (SHOTS) await pia.screenshot({ path: `${SHOTS}/notes-puzzles.png` });
  await sctx.close();
  await tctx.close();
});
