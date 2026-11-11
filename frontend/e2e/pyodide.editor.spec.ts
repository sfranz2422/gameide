/**
 * Where Play gets Pyodide (src/python/pyodideSource.ts): from jsdelivr, so
 * its 6.5 MB isn't counted against the Render workspace's bandwidth each
 * school day, and from our own copy when jsdelivr can't be reached — an
 * exported game played offline, or a school filter that blocks the CDN.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, playAndWait, watchErrors } from "./helpers";

/** Every Pyodide file the page or its workers asked for, by host. */
function watchPyodide(page: Page) {
  const seen: string[] = [];
  page.context().on("request", (r) => {
    const u = r.url();
    if (/pyodide\.asm\.wasm|python_stdlib\.zip/.test(u)) seen.push(u);
  });
  return seen;
}

test("Play loads Pyodide from jsdelivr, not from our server", async ({ page }) => {
  const errors = watchErrors(page);
  const seen = watchPyodide(page);
  await fromTemplate(page, "coins");
  await playAndWait(page);
  expect(seen.some((u) => u.startsWith("https://cdn.jsdelivr.net/pyodide/v"))).toBe(true);
  expect(seen.filter((u) => u.includes("/pyodide/") && !u.includes("cdn.jsdelivr.net"))).toEqual([]);
  expect(errors).toEqual([]);
});

test("with jsdelivr blocked, Play falls back to our own copy", async ({ page }) => {
  await page.context().route("https://cdn.jsdelivr.net/**", (r) => r.abort());
  const seen = watchPyodide(page);
  await fromTemplate(page, "coins");
  await playAndWait(page);
  expect(seen.some((u) => u.startsWith("http://localhost:4173/pyodide/"))).toBe(true);
});
