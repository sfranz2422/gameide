import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asItem, parseWeek, todayIn } from "./calendarWeek";

const WEEK = `Week of Oct 27
Bring your laptop charged

**Monday:**
Loops worksheet
Friday quiz on loops
Monday's homework is page 4
Tuesday: Lab day
- finish the guessing game
  - stretch: keep score
Wed 10/29:
1. Read [chapter 4](https://example.com)
## Thursday
thurs - no school
Fri (Oct 31) — Quiz
Saturday
`;

describe("the class's week", () => {
  const w = parseWeek(WEEK);

  it("each day is a card, in the order written; anything above the first is the title", () => {
    expect(w.days.map((d) => d.name)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
    expect(w.title).toBe("Week of Oct 27\nBring your laptop charged");
  });

  it("a line that only starts with a day's name is a to-do, not a new day", () => {
    expect(w.days[0]!.lines).toEqual([
      "Loops worksheet",
      "Friday quiz on loops",
      "Monday's homework is page 4",
    ]);
  });

  it("text after the colon is the day's first line, and typed bullets keep their indent", () => {
    expect(w.days[1]!.lines.map(asItem)).toEqual([
      "- Lab day",
      "- finish the guessing game",
      "  - stretch: keep score",
    ]);
    expect(asItem("1. Read it")).toBe("- Read it");
  });

  it("dates are kept as written and read, in brackets or by month name", () => {
    expect(w.days[2]).toMatchObject({
      date: "10/29",
      when: { month: 9, day: 29 },
    });
    expect(w.days[5]).toMatchObject({
      date: "Oct 31",
      when: { month: 9, day: 31 },
      lines: ["Quiz"],
    });
    expect(w.days[3]!.lines).toEqual([]);
    expect(w.days[4]!.lines).toEqual(["no school"]);
    expect(w.days[6]!.lines).toEqual([]);
  });

  it("undated, today is the day with today's name; dated, only on its date", () => {
    const undated = parseWeek("Monday:\nx\nWednesday:\ny\n").days;
    expect(todayIn(undated, new Date(2026, 9, 28))).toBe(1);
    expect(todayIn(undated, new Date(2026, 9, 29))).toBe(-1);
    const dated = parseWeek("Mon 10/27:\nx\nWed 10/29:\ny\n").days;
    expect(todayIn(dated, new Date(2026, 9, 29))).toBe(1);
    expect(todayIn(dated, new Date(2026, 10, 5))).toBe(-1); // the next Wednesday
  });

  it("text with no day in it has no days; Windows line endings read the same", () => {
    expect(parseWeek("just some words\nand more").days).toEqual([]);
    expect(parseWeek("").days).toEqual([]);
    expect(
      parseWeek("Monday:\r\nA\r\nTuesday:\r\nB").days.map((d) =>
        d.lines.join("|"),
      ),
    ).toEqual(["A", "B"]);
  });

  // The column is shared: a week the teacher pasted in PyIDE must read the
  // same here. Skipped only when PyIDE isn't checked out beside this repo.
  const pyide = join(homedir(), "pyide", "static", "calendar.js");
  it.skipIf(!existsSync(pyide))("reads exactly as PyIDE's calendar.js", () => {
    const theirs = createRequire(import.meta.url)(pyide) as {
      parse: (t: string) => unknown;
    };
    for (const text of [
      WEEK,
      "Monday:\r\nA",
      "nothing",
      "Mon - Fri: laptops\nTuesday\n  * a\n\t- b",
    ]) {
      expect(parseWeek(text)).toEqual(theirs.parse(text));
    }
  });
});
