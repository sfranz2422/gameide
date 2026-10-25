/**
 * Students' own pictures: dropped or chosen, cut into frames, given a mask
 * — and the masks then decide collisions in a running game.
 */
import { expect, test, type Page } from "@playwright/test";
import { fromTemplate, playAndWait, py, treeItem, watchErrors } from "./helpers";

/** Rectangles to paint, then the picture as a PNG: [x, y, w, h, colour]. */
type Paint = { width: number; height: number; rects: [number, number, number, number, string][]; clear?: [number, number, number, number][] };

async function pngIn(page: Page, p: Paint): Promise<string> {
  return page.evaluate(async (p) => {
    const c = new OffscreenCanvas(p.width, p.height);
    const x = c.getContext("2d")!;
    for (const [rx, ry, w, h, col] of p.rects) (x.fillStyle = col), x.fillRect(rx, ry, w, h);
    for (const [rx, ry, w, h] of p.clear ?? []) x.clearRect(rx, ry, w, h);
    const bytes = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, p);
}

/** Drops a painted picture onto the editor, as dragging a file from the desktop does. */
async function drop(page: Page, name: string, p: Paint) {
  const b64 = await pngIn(page, p);
  await page.evaluate(
    ({ b64, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: "image/png" }));
      window.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, cancelable: true }));
      window.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, cancelable: true }));
    },
    { b64, name },
  );
}

const STRIP: Paint = {
  width: 64,
  height: 16,
  rects: ["#f00", "#0f0", "#00f", "#ff0"].map((c, i) => [i * 16 + 4, 2, 8, 12, c] as [number, number, number, number, string]),
};

test("a sprite sheet dropped on the editor becomes an animated sprite", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  await drop(page, "hero_run.png", STRIP);
  await expect(page.getByTestId("slice-summary")).toHaveText("4 frames, 16 × 16");
  // Leave out frame 1 by clicking it on the sheet.
  const sheet = page.getByTestId("slice-sheet");
  const box = (await sheet.boundingBox())!;
  await sheet.click({ position: { x: box.width * (1.5 / 4), y: box.height / 2 } });
  await expect(page.getByTestId("slice-summary")).toHaveText("3 frames, 16 × 16");
  await page.getByTestId("import-done").click();

  await expect(treeItem(page, "hero_run")).toBeVisible();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(3);
  // The automatic mask is fitted to the drawn part, not the whole 16 × 16.
  await expect(page.getByText("Box: 4, 2 to 12, 14")).toBeVisible();
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});

test("a grid with spacing is cut where the frames really are", async ({ page }) => {
  await fromTemplate(page, "empty");
  // Four 16 px frames in a 2 × 2 grid with 2 px between them.
  await drop(page, "grid.png", {
    width: 34,
    height: 34,
    rects: [[0, 0, 16, 16, "#f00"], [18, 0, 16, 16, "#0f0"], [0, 18, 16, 16, "#00f"], [18, 18, 16, 16, "#ff0"]],
  });
  await page.getByTestId("slice-grid").click();
  await page.getByLabel("Frame width").fill("16");
  await page.getByLabel("Frame height").fill("16");
  await page.getByLabel("Spacing x").fill("2");
  await page.getByLabel("Spacing y").fill("2");
  await expect(page.getByTestId("slice-summary")).toHaveText("4 frames, 16 × 16");
});

test("frames added to a sprite must be its size", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drop(page, "hero_run.png", STRIP);
  await page.getByTestId("import-done").click();
  await expect(treeItem(page, "hero_run")).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("add-frames").click();
  const big = Buffer.from(await pngIn(page, { width: 32, height: 32, rects: [[0, 0, 32, 32, "#fff"]] }), "base64");
  await (await chooser).setFiles({ name: "big.png", mimeType: "image/png", buffer: big });
  await expect(page.getByRole("dialog")).toContainText("hero_run's frames are 16 × 16; these are 32 × 32.");
  await expect(page.getByTestId("import-done")).toBeDisabled();
  await page.getByTestId("slice-strip").click();
  await page.getByTestId("strip-count").fill("2"); // two 16 × 32 frames: still wrong
  await expect(page.getByTestId("import-done")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();

  const chooser2 = page.waitForEvent("filechooser");
  await page.getByTestId("add-frames").click();
  const two = Buffer.from(await pngIn(page, { width: 32, height: 16, rects: [[0, 0, 32, 16, "#fff"]] }), "base64");
  await (await chooser2).setFiles({ name: "more.png", mimeType: "image/png", buffer: two });
  await page.getByTestId("import-done").click();
  await expect(page.getByTestId("sprite-frames").getByRole("button", { name: /^Frame \d$/ })).toHaveCount(6);
  // The new frames fill their whole 16 × 16, so the fitted mask grows to match.
  await expect(page.getByText("Box: 0, 0 to 16, 16")).toBeVisible();
});

test("a mask drawn by hand is the box dragged", async ({ page }) => {
  await fromTemplate(page, "empty");
  await drop(page, "hero_run.png", STRIP);
  await page.getByTestId("import-done").click();
  await page.getByTestId("mask-kind").selectOption("rect");
  await page.getByRole("radio", { name: "Mask" }).click();
  const canvas = page.getByTestId("sprite-canvas");
  const b = (await canvas.boundingBox())!;
  const px = b.width / 16; // one sprite pixel on screen
  await page.mouse.move(b.x + 2 * px, b.y + 3 * px);
  await page.mouse.down();
  await page.mouse.move(b.x + 10 * px, b.y + 12 * px, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByLabel("left")).toHaveValue("2");
  await expect(page.getByLabel("bottom")).toHaveValue("12");
});

test("an exact-pixel mask: the hole in a ring is not part of it", async ({ page }) => {
  const errors = watchErrors(page);
  await fromTemplate(page, "empty");
  // A 40 × 40 ring, 4 px thick.
  await drop(page, "ring.png", { width: 40, height: 40, rects: [[0, 0, 40, 40, "#fa0"]], clear: [[4, 4, 32, 32]] });
  await page.getByTestId("slice-whole").click();
  await page.getByLabel("Origin").selectOption("top-left");
  await page.getByTestId("import-done").click();
  await page.getByTestId("mask-kind").selectOption("precise");

  await page.getByTestId("add-objects").click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ring");
  await page.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
  await page.getByTestId("object-sprite").selectOption({ label: "ring" });
  await treeItem(page, "Room1 start").click();
  await page.getByTestId("room-add-object").selectOption({ label: "Ring" });
  await page.getByTestId("room-add").click(); // at 320, 240

  await playAndWait(page);
  // In the hole, on the rim, and (for contrast) what a plain box would say.
  const hits = await py(page, `
r = instances("Ring")[0]
(collision_point(r.x + 20, r.y + 20, "Ring") is None, collision_point(r.x + 1, r.y + 20, "Ring") is r)`);
  expect(hits).toEqual([true, true]);
  expect(errors.filter((e) => !e.includes("502"))).toEqual([]);
});
