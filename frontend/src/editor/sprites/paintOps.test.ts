import { describe, expect, it } from "vitest";
import { blank, box, clearBox, clip, colorsIn, crop, dab, ellipse, fill, flipH, flipV, fromHex, getPixel, line, rotate, setPixel, spanOf, stamp, strip, toHex, transformFrame, type Pixels, type RGBA } from "./paintOps";

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];

/** The picture as rows of "#" (painted) and "." (clear), to read at a glance. */
function rows(p: Pixels): string[] {
  const out: string[] = [];
  for (let y = 0; y < p.height; y++) {
    let r = "";
    for (let x = 0; x < p.width; x++) r += getPixel(p, x, y)![3] ? "#" : ".";
    out.push(r);
  }
  return out;
}

describe("the pencil", () => {
  it("paints the pixel clicked, and a bigger brush grows from it", () => {
    const p = blank(5, 5);
    dab(p, 0, 0, RED);
    dab(p, 2, 2, RED, 2);
    expect(rows(p)).toEqual(["#....", ".....", "..##.", "..##.", "....."]);
    // A 3 brush is centred: the pixel clicked is its middle.
    const q = blank(5, 5);
    dab(q, 2, 2, RED, 3);
    expect(rows(q)).toEqual([".....", ".###.", ".###.", ".###.", "....."]);
  });

  it("a fast stroke leaves no gaps between the points it was told", () => {
    const p = blank(8, 3);
    line(p, 0, 0, 7, 2, RED);
    // Every column painted once: a connected line, not two dots.
    for (let x = 0; x < 8; x++) expect([0, 1, 2].filter((y) => getPixel(p, x, y)![3]).length).toBe(1);
    expect(getPixel(p, 0, 0)).toEqual(RED);
    expect(getPixel(p, 7, 2)).toEqual(RED);
  });

  it("painting off the edge is ignored, and painting the same colour changes nothing", () => {
    const p = blank(3, 3);
    expect(dab(p, -1, -1, RED, 2)).toBe(true); // only 0,0 is on the picture
    expect(rows(p)).toEqual(["#..", "...", "..."]);
    expect(dab(p, 0, 0, RED)).toBe(false);
    expect(setPixel(p, 3, 0, RED)).toBe(false);
  });
});

describe("the fill", () => {
  it("fills inside a wall and stops at it, never through a corner", () => {
    const p = blank(5, 5);
    // A diagonal from top-right to bottom-left splits the picture in two.
    for (let i = 0; i < 5; i++) setPixel(p, 4 - i, i, BLUE);
    expect(fill(p, 0, 0, RED)).toBe(10);
    expect(rows(p)).toEqual(["#####", "####.", "###..", "##...", "#...."]);
    expect(getPixel(p, 4, 4)![3]).toBe(0);
    expect(getPixel(p, 4, 0)).toEqual(BLUE);
  });

  it("fills a colour with a colour, and does nothing where it's already that colour", () => {
    const p = blank(2, 2);
    fill(p, 0, 0, RED);
    expect(fill(p, 1, 1, RED)).toBe(0);
    expect(fill(p, 1, 1, BLUE)).toBe(4);
  });

  it("all clear pixels are one area, whatever colour hides in them", () => {
    const p = blank(3, 1);
    p.data.set([10, 20, 30, 0], 4); // clear, but not all zeros
    expect(fill(p, 0, 0, RED)).toBe(3);
  });
});

describe("colours", () => {
  it("hex both ways", () => {
    expect(fromHex("#ff8000")).toEqual([255, 128, 0, 255]);
    expect(fromHex("#f80")).toEqual([255, 136, 0, 255]);
    expect(toHex([1, 2, 255, 255])).toBe("#0102ff");
  });

  it("a picture's own colours, most used first, faint edges left out", () => {
    const p = blank(4, 1);
    setPixel(p, 0, 0, BLUE);
    setPixel(p, 1, 0, RED);
    setPixel(p, 2, 0, RED);
    setPixel(p, 3, 0, [0, 255, 0, 40]);
    expect(colorsIn(p)).toEqual(["#ff0000", "#0000ff"]);
  });
});

describe("shapes", () => {
  it("a box from either corner, outlined or filled", () => {
    const p = blank(5, 4);
    box(p, spanOf(3, 2, 0, 0), RED, false);
    expect(rows(p)).toEqual(["####.", "#..#.", "####.", "....."]);
    const q = blank(3, 3);
    box(q, spanOf(0, 0, 2, 2), RED, true);
    expect(rows(q)).toEqual(["###", "###", "###"]);
  });

  it("Shift makes the box square, from the corner it started at", () => {
    expect(spanOf(4, 4, 0, 1, true)).toEqual({ x: 1, y: 1, w: 4, h: 4 });
  });

  it("an ellipse fits its box, its edge unbroken and its middle clear", () => {
    const p = blank(7, 7);
    ellipse(p, { x: 0, y: 0, w: 7, h: 7 }, RED, false);
    expect(rows(p)).toEqual(["..###..", ".#...#.", "#.....#", "#.....#", "#.....#", ".#...#.", "..###.."]);
    const q = blank(7, 7);
    ellipse(q, { x: 0, y: 0, w: 7, h: 7 }, RED, true);
    expect(rows(q)[3]).toBe("#######");
    expect(rows(q)[0]).toBe("..###..");
  });
});

describe("selections", () => {
  // An L: the top row and the left column.
  const L = () => {
    const p = blank(3, 3);
    line(p, 0, 0, 2, 0, RED);
    line(p, 0, 0, 0, 2, RED);
    setPixel(p, 2, 0, BLUE); // a different corner, to see where it goes
    return p;
  };

  it("flips and quarter turns", () => {
    expect(rows(flipH(L()))).toEqual(["###", "..#", "..#"]);
    expect(rows(flipV(L()))).toEqual(["#..", "#..", "###"]);
    expect(rows(rotate(L(), true))).toEqual(["###", "..#", "..#"]);
    expect(getPixel(rotate(L(), true), 2, 2)).toEqual(BLUE); // top-right goes to bottom-right
    expect(getPixel(rotate(L(), false), 0, 0)).toEqual(BLUE); // and turning back, to top-left
    const wide = blank(3, 1);
    expect([rotate(wide, true).width, rotate(wide, true).height]).toEqual([1, 3]);
  });

  it("a turned frame that isn't square keeps its size, centred", () => {
    const p = blank(4, 2);
    line(p, 0, 0, 3, 0, RED); // the top row
    const t = transformFrame(p, "rotateCW");
    expect([t.width, t.height]).toEqual([4, 2]);
    expect(rows(t)).toEqual(["..#.", "..#."]); // a column, two of its four pixels left on the picture
  });

  it("crop, clear and stamp: a piece moved leaves its hole, and its clear corners hide nothing", () => {
    const p = L();
    const piece = crop(p, { x: 0, y: 0, w: 2, h: 2 });
    clearBox(p, { x: 0, y: 0, w: 2, h: 2 });
    expect(rows(p)).toEqual(["..#", "...", "#.."]);
    stamp(p, piece, 1, 1);
    expect(rows(p)).toEqual(["..#", ".##", "##."]);
    // A piece's clear pixel over a painted one leaves it painted.
    const red = blank(2, 2);
    fill(red, 0, 0, RED);
    const corner = blank(2, 2);
    setPixel(corner, 0, 0, BLUE);
    stamp(red, corner, 0, 0);
    expect(getPixel(red, 0, 0)).toEqual(BLUE);
    expect(getPixel(red, 1, 1)).toEqual(RED);
    // `replace` copies the clear pixels too.
    stamp(p, blank(1, 1), 1, 1, true);
    expect(rows(p)[1]).toBe("..#");
  });

  it("clip keeps the part of a box on the picture", () => {
    expect(clip({ x: -2, y: 1, w: 4, h: 9 }, 5, 5)).toEqual({ x: 0, y: 1, w: 2, h: 4 });
    expect(clip({ x: 6, y: 0, w: 2, h: 2 }, 5, 5)).toBeNull();
  });

  it("a strip is the frames side by side", () => {
    const a = blank(2, 1), b = blank(2, 1);
    setPixel(a, 0, 0, RED);
    setPixel(b, 1, 0, BLUE);
    const s = strip([a, b]);
    expect([s.width, s.height]).toEqual([4, 1]);
    expect(getPixel(s, 0, 0)).toEqual(RED);
    expect(getPixel(s, 3, 0)).toEqual(BLUE);
  });
});
