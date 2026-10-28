/**
 * The Docs: a page of its own from the bar at the top (#/docs), where a
 * click copies an entry, and the editor's Docs tab, where a click types it
 * into the code. The same list in both.
 */
import { expect, test } from "@playwright/test";
import { fromTemplate, treeItem } from "./helpers";

test("Docs is in the top bar: every function, searchable, a click copies it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#/");
  await page.getByTestId("nav-docs").click();
  await expect(page).toHaveURL(/#\/docs$/);
  const docs = page.getByTestId("docs-page");
  await expect(page.getByTestId("nav-docs")).toHaveAttribute("aria-current", "page");
  await expect(docs.getByRole("heading", { name: "Docs" })).toBeVisible();
  await expect(docs.locator(".doc-entry").filter({ hasText: "instance_create" })).toBeVisible();
  await expect(docs.locator(".doc-entry code", { hasText: /^self\.x$/ })).toBeVisible();

  await docs.getByRole("textbox", { name: "Search docs" }).fill("keyboard_check_pressed");
  await expect(docs.locator(".doc-entry").filter({ hasText: "instance_create" })).toHaveCount(0);
  const entry = docs.locator(".doc-entry").filter({ hasText: "keyboard_check_pressed" }).first();
  await entry.click();
  await expect(docs.getByRole("status")).toContainText("Copied keyboard_check_pressed(key)");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("keyboard_check_pressed(key)");
});

test("on a phone the top bar still fits: Docs and the light/dark button on screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/#/docs");
  for (const el of [page.getByTestId("nav-docs"), page.locator(".site-nav .theme-toggle")]) {
    const box = (await el.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  const entry = (await page.locator(".doc-entry").first().boundingBox())!;
  expect(entry.x + entry.width).toBeLessThanOrEqual(320);
});

test("the editor's Docs tab still types an entry into the code", async ({ page }) => {
  await fromTemplate(page, "coins");
  await treeItem(page, "Player").click();
  await page.getByTestId("event-Create").click();
  const code = page.getByTestId("event-code").locator(".cm-content");
  await code.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.getByRole("tab", { name: "Docs" }).click();
  await page.getByRole("textbox", { name: "Search docs" }).fill("instance_create");
  await page.locator(".doc-entry").filter({ hasText: "instance_create" }).first().click();
  await expect(code).toContainText("instance_create(");
});
