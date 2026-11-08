/**
 * The Python check in a real browser, against the real server: a teacher uploads
 * a week's questions, predict block and all, and makes a game a showcase game; a
 * student's game really stops for a question, carries on when it's answered, and
 * shuts them out after as many wrong as the teacher set. (The server's rules are in test_server.py;
 * here the seconds are set low in playwright.config.ts.)
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
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

  // Signed out, a guest plays it, and gets the questions too (kept in their session).
  const stranger = await browser.newContext();
  const anon = await stranger.newPage();
  await anon.goto(path);
  await anon.getByTestId("player-start").click({ timeout: 60_000 });
  await expect(anon.getByTestId("python-check")).toBeVisible({ timeout: 30_000 });
  await expect(anon.getByTestId("python-check")).not.toContainText("XP");
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

// A game says when stopping would be fair (question_ok): a question never lands
// mid-jump. This one says "not now" until the test says otherwise.
test("a question waits for the game to say it's a fair moment, but not for ever", async ({ browser }) => {
  test.setTimeout(180_000);
  const { ctx: tctx, page: teacher } = await signedIn(browser, "teach6@example.com");
  const klass = await (await teacher.request.post("/api/classes", { data: { name: "Fair moments" } })).json();
  await teacher.request.post(`/api/classes/${klass.id}/students`, { data: { emails: "fay.check@example.com" } });
  // Two of the main test's questions (no predict block: that needs this page to run it).
  const bank = BANK.slice(0, BANK.indexOf("```python predict"));
  expect((await teacher.request.post("/api/check/bank", { data: { markdown: bank, save: true } })).ok()).toBe(true);
  const project = {
    format: "gameide-project", schemaVersion: 8, id: "fairzip", name: "Fair", created: "2026-01-01T00:00:00Z", modified: "2026-01-01T00:00:00Z",
    settings: { stepsPerSecond: 60 }, sprites: [], tilesets: [], scripts: [], sounds: [], fonts: [],
    objects: [{ id: "o1", name: "Jumper", sprite: null, visible: true, solid: false, persistent: false, depth: 0, parent: null,
      events: [{ id: "e1", key: { type: "step" }, mode: "python",
        code: 'question_ok(getattr(global_vars, "landed", False))\nglobal_vars.waiting = question_waiting()\nglobal_vars.steps = getattr(global_vars, "steps", 0) + 1\n' }] }],
    rooms: [{ id: "r1", name: "Room1", width: 320, height: 180, background: "#223344", gridWidth: 16, gridHeight: 16, snap: true,
      layers: [{ id: "L", name: "Instances", kind: "instances", depth: 0, visible: true, locked: false }],
      camera: { enabled: false, width: 320, height: 180, follow: null, smoothing: 1 },
      instances: [{ id: "i1", object: "o1", layer: "L", x: 0, y: 0, scaleX: 1, scaleY: 1, angle: 0, code: "" }] }],
  };
  await teacher.goto("/#/games");
  const zip = Buffer.from(zipSync({ "project.json": strToU8(JSON.stringify(project)), "assets/index.json": strToU8("{}") }));
  await teacher.getByTestId("import-file").setInputFiles({ name: "f.zip", mimeType: "application/zip", buffer: zip });
  await teacher.waitForURL(/#\/p\//, { timeout: 30_000 });
  await expect(teacher.getByTestId("save-status")).toHaveText("Saved", { timeout: 30_000 });
  await teacher.getByTestId("publish").click();
  await teacher.getByTestId("publish-title").fill("Fair");
  await teacher.getByTestId("publish-unlisted").check();
  await teacher.getByTestId("publish-showcase").check();
  await teacher.getByTestId("publish-go").click();
  await expect(teacher.getByTestId("publish-link")).toHaveValue(/\/play\/[\w-]+$/);
  const path = new URL(await teacher.getByTestId("publish-link").inputValue()).pathname;

  const { ctx: sctx, page: student } = await signedIn(browser, "fay.check@example.com");
  const py = (code: string) => student.evaluate((c) => (window as any).__gameide.host.evalPython(c), code);
  await student.goto(path);
  await student.getByTestId("player-start").click({ timeout: 60_000 });
  const check = student.getByTestId("python-check");
  // Due after a few seconds (playwright.config.ts), but the game says "not now": it waits, and the game knows.
  await expect.poll(() => py("global_vars.waiting"), { timeout: 30_000 }).toBe(true);
  await student.waitForTimeout(2000);
  await expect(check).toHaveCount(0);
  const before = await py("global_vars.steps");
  await student.waitForTimeout(300);
  expect(await py("global_vars.steps")).not.toBe(before);   // still playing
  // The moment it says yes, the question comes, and the game is held.
  await py("global_vars.landed = True");
  await expect(check).toBeVisible({ timeout: 3000 });
  await answer(student, true);
  await student.getByTestId("check-continue").click();
  await expect.poll(() => py("global_vars.waiting"), { timeout: 5000 }).toBe(false);

  // Only playing counts: left alone, no question comes; touching the keys again, it does.
  await student.evaluate(() => ((window as any).__gameide.host.idleMs = 800));
  await student.waitForTimeout(1500);
  await py("global_vars.landed = True");
  await student.waitForTimeout(8000);
  await expect(check).toHaveCount(0);
  const canvas = student.locator("canvas[data-testid=game-canvas]");
  await canvas.click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 40 && !(await check.isVisible()); i++) {
    await student.keyboard.press("ArrowRight");
    await student.waitForTimeout(250);
  }
  await expect(check).toBeVisible({ timeout: 5000 });
  await answer(student, true);
  await student.getByTestId("check-continue").click();
  await student.evaluate(() => ((window as any).__gameide.host.idleMs = 30_000));

  // A game can't put it off for ever: "not now" for 15 seconds, and it's asked anyway.
  await py("global_vars.landed = False");
  await expect.poll(() => py("global_vars.waiting"), { timeout: 30_000 }).toBe(true);
  const waitedFrom = Date.now();
  await expect(check).toBeVisible({ timeout: 25_000 });
  expect(Date.now() - waitedFrom).toBeGreaterThan(12_000);
  await sctx.close();
  await tctx.close();
});
