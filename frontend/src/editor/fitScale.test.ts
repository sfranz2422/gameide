/** How a game is scaled to its box (gameHost.ts, fitScale). */
import { describe, expect, it } from "vitest";
import { fitScale } from "./gameHost";

describe("fitScale", () => {
  it("scales pixel art by whole numbers in the editor and on the page", () => {
    expect(fitScale(320, 200, 851, 393, true, false)).toBe(1); // 1.96 fits: 1 keeps every pixel square
    expect(fitScale(320, 200, 1280, 900, true, false)).toBe(4);
    expect(fitScale(640, 480, 851, 393, true, false)).toBeCloseTo(393 / 480); // smaller than 1×: smoothly
    expect(fitScale(320, 200, 851, 393, false, false)).toBeCloseTo(1.965); // painted art: no whole numbers
  });
  it("on a phone, fills the screen where whole numbers would leave much of it empty", () => {
    expect(fitScale(320, 200, 851, 393, true, true)).toBeCloseTo(1.965); // 1× would be half the height
    expect(fitScale(320, 200, 1300, 600, true, true)).toBe(3); // 3 of 3.0: whole, nothing lost
    expect(fitScale(320, 200, 800, 500, true, true)).toBe(2); // 2 of 2.5: a fifth lost, no more
  });
});
