import { describe, expect, it } from "vitest";
import { freeSpriteName, originFor, refitMask } from "./spriteOps";

const measured = async () => ({ left: 1, top: 2, right: 3, bottom: 4 });

describe("when a sprite's frames change", () => {
  it("an automatic or exact mask is refitted to the new pictures", async () => {
    expect(await refitMask({ kind: "auto", left: 0, top: 0, right: 9, bottom: 9 }, [], 9, 9, measured)).toEqual({ kind: "auto", left: 1, top: 2, right: 3, bottom: 4 });
    expect(await refitMask({ kind: "precise", left: 0, top: 0, right: 9, bottom: 9 }, [], 9, 9, measured)).toMatchObject({ kind: "precise", left: 1 });
    expect(await refitMask(undefined, [], 9, 9, measured)).toMatchObject({ kind: "auto", left: 1 });
  });

  it("a mask the student drew or set stays as they made it", async () => {
    const box = { kind: "rect" as const, left: 0, top: 0, right: 5, bottom: 5 };
    const circle = { kind: "circle" as const, cx: 4, cy: 4, r: 3 };
    expect(await refitMask(box, [], 9, 9, measured)).toBe(box);
    expect(await refitMask(circle, [], 9, 9, measured)).toBe(circle);
  });

  it("all-transparent frames get a box around the whole picture", async () => {
    expect(await refitMask(undefined, [], 9, 7, async () => null)).toEqual({ kind: "auto", left: 0, top: 0, right: 9, bottom: 7 });
  });
});

describe("new sprites", () => {
  it("get a name of their own and the origin asked for", () => {
    expect(freeSpriteName("hero", ["Hero", "hero2"])).toBe("hero3");
    expect(originFor("bottom-center", 16, 24)).toEqual([8, 24]);
  });
});
