/** Shared by the editor and account suites. */
import { expect, type Page } from "@playwright/test";

export const SHOTS = process.env.SHOT_DIR;

export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

export async function fromTemplate(page: Page, key: string, query = "") {
  await page.goto(`/${query}`);
  await page.getByTestId(`template-${key}`).click();
  await page.waitForURL(/#\/p\//);
}

export const treeItem = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Resources" }).getByRole("button", { name, exact: true });
export const nameBox = (page: Page) => page.getByRole("textbox", { name: "Name", exact: true });

/** Replaces the code in the open event (or script) with `text`, exactly as given. */
export async function setCode(page: Page, text: string, testId = "event-code") {
  const content = page.getByTestId(testId).locator(".cm-content");
  await content.click();
  await page.keyboard.press("ControlOrMeta+a");
  // insertText arrives as one input: no auto-indent, no auto-closed brackets.
  if (text) await page.keyboard.insertText(text);
  else await page.keyboard.press("Backspace");
}

export const py = (page: Page, code: string) => page.evaluate((c) => (window as any).__gameide.host.evalPython(c), code);

export async function playAndWait(page: Page) {
  await page.getByTestId("play").click();
  await expect(page.getByTestId("fps")).toBeVisible({ timeout: 30_000 });
}


/** Screen position of a room point, from the room editor's own zoom and pan. */
export async function screenAt(page: Page, x: number, y: number) {
  const c = page.getByTestId("room-canvas");
  const b = (await c.boundingBox())!;
  const zoom = Number(await c.getAttribute("data-zoom"));
  const panX = Number(await c.getAttribute("data-pan-x"));
  const panY = Number(await c.getAttribute("data-pan-y"));
  return { x: b.x + panX + x * zoom, y: b.y + panY + y * zoom };
}

/** Opens the first room and places one instance of `object` at (x, y) with the Place tool. */
export async function placeInRoom(page: Page, room: string, object: string, x: number, y: number) {
  await treeItem(page, room).click();
  await page.getByRole("button", { name: "Fit" }).click();
  await page.getByTestId("tool-place").click();
  await page.getByTestId("place-object").selectOption({ label: object });
  const p = await screenAt(page, x, y);
  await page.mouse.click(p.x, p.y);
  await page.getByTestId("tool-select").click();
}
