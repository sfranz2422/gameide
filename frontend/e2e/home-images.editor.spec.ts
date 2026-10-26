/**
 * Makes the home page's pictures (public/home/*.jpg): screenshots of
 * GameIDE itself. Not a test — it is skipped unless asked for:
 *
 *     MAKE_HOME_IMAGES=1 npx playwright test home-images
 *
 * Run it again when the editor's look changes, and commit the pictures.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, nameBox, treeItem } from "./helpers";

test.skip(!process.env["MAKE_HOME_IMAGES"], "only makes pictures when asked");
test.use({ viewport: { width: 1440, height: 860 } });

const OUT = "public/home";
const shot = (page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }) =>
  page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, ...(clip ? { clip } : {}) });

async function newObjectWithStep(page: Page, name: string) {
  await page.getByTestId("add-objects").click();
  await nameBox(page).fill(name);
  await nameBox(page).press("Enter");
  await page.getByTestId("add-event").click();
  await page.getByTestId("pick-step").click();
}

test("hero and Python", async ({ page }) => {
  await fromTemplate(page, "platformer");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Step").click();
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 30_000 });
  await page.locator("canvas[data-testid=game-canvas]").click();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await shot(page, "hero");
  const code = (await page.locator(".event-code").boundingBox())!;
  await shot(page, "python", { x: code.x, y: code.y, width: Math.min(code.width, 560), height: Math.min(code.height, 420) });
});

// Wider for blocks and sheets, so their Python shows beside them, not under.
const wide = { viewport: { width: 2000, height: 900 } };

test.describe("wide", () => {
  test.use(wide);

  test("blocks", async ({ page }) => {
    await fromTemplate(page, "platformer"); // it has sounds to pick
    await newObjectWithStep(page, "Hero");
    await page.getByTestId("tab-blocks").click();
    await expect(page.locator(".blocklyMainBackground")).toBeVisible({ timeout: 20_000 });
    const canvas = page.locator(".blocklyMainBackground").locator("xpath=..").locator(".blocklyBlockCanvas");
    const hat = canvas.locator(":scope > .blocklyDraggable").first();
    const palette = (cat: string, text: RegExp) => {
      return page
        .getByRole("treeitem", { name: cat, exact: true })
        .click()
        .then(() => page.waitForTimeout(300))
        .then(() => page.locator(".blocklyFlyout .blocklyDraggable").filter({ hasText: text }).first().boundingBox());
    };
    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 40, from.y + 10, { steps: 4 });
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    // if … under the hat, then change x by 4 inside the if, then keyboard_check in its slot.
    let h = (await hat.boundingBox())!;
    let b = (await palette("Logic", /^if\s*do$/))!;
    await drag({ x: b.x + 6, y: b.y + 6 }, { x: h.x + 20, y: h.y + h.height * 0.48 + 6 });
    const ifBlock = canvas.locator(".blocklyDraggable").filter({ hasText: /^if/ }).first();
    let i = (await ifBlock.boundingBox())!;
    b = (await palette("Motion", /change/))!;
    await drag({ x: b.x + 6, y: b.y + 6 }, { x: i.x + 20, y: i.y + i.height * 0.5 + 4 });
    i = (await ifBlock.boundingBox())!;
    b = (await palette("Input", /keyboard_check\s*key/))!;
    await drag({ x: b.x + 4, y: b.y + b.height / 2 }, { x: i.x + 34, y: i.y + 16 });
    // And a sound, under the if.
    h = (await hat.boundingBox())!;
    b = (await palette("Sound", /sound_play/))!;
    await drag({ x: b.x + 6, y: b.y + 6 }, { x: h.x + 20, y: h.y + h.height - 20 });
    await page.mouse.click(10, 10); // the palette closes
    await page.waitForTimeout(300);
    const area = (await page.locator(".blocks-split").boundingBox())!;
    await shot(page, "blocks", { x: area.x, y: area.y, width: area.width, height: Math.min(area.height, 520) });
  });

  test("event sheet", async ({ page }) => {
    await fromTemplate(page, "platformer");
    await newObjectWithStep(page, "Hero");
    await page.getByTestId("tab-sheet").click();
    await page.getByTestId("sheet-add-row").click();
    await page.getByTestId("add-condition").click();
    await page.getByTestId("pick-keyboard_check").click();
    await page.getByTestId("add-action").click();
    await page.getByTestId("pick-set").click();
    await page.getByTestId("sheet-add-row").click();
    await page.getByTestId("add-condition").nth(1).click();
    await page.getByTestId("pick-place_meeting").click();
    await page.getByTestId("add-action").nth(1).click();
    await page.getByTestId("pick-sound_play").click();
    await page.getByTestId("sheet-add-foreach").click();
    await page.waitForTimeout(400);
    const area = (await page.locator(".blocks-split").boundingBox())!;
    await shot(page, "sheet", { x: area.x, y: area.y, width: area.width, height: Math.min(area.height, 520) });
  });
});
