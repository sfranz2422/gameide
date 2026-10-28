/**
 * The class's week, at the top of its page (`Course.calendar`): pure, so
 * calendarWeek.test.ts can hold it to PyIDE's.
 *
 * A port of PyIDE's `static/calendar.js` (the same file in PyIDE, WebIDE and
 * FlaskIDE), which reads the same column of the same shared table — so a
 * calendar must read here exactly as it does there. Change the rules in
 * both, and in both tests.
 *
 * The teacher pastes one block of text, the way they would type it in an
 * email:
 *
 *     Week of Oct 27            <- anything before the first day is the title
 *     Monday:
 *     Loops worksheet
 *     - Quiz on [chapter 4](https://...)
 *     Tuesday: Lab day          <- text after the colon is that day's first line
 *
 * WHAT COUNTS AS A DAY. A line that starts with a day's name (Monday, Mon,
 * Tues, Thurs…), optionally a date (10/27, Oct 27), and then a colon, a
 * spaced dash, or nothing at all. "Friday: quiz" and "Friday" are days;
 * "Friday quiz on loops" is a line of whatever day came before. Without that
 * rule the first to-do that starts with a day's name ("Monday's homework
 * is…") silently splits a day in two. Markdown around the header
 * (**Monday:**, ## Monday) is allowed.
 *
 * TODAY. A day with a date is today only on that date, so a calendar left up
 * from last week doesn't point at the wrong Wednesday. With no dates written
 * anywhere, today is whichever day has today's name.
 */

const DAYS: string[][] = [
  ["Sunday", "sun", "sunday"],
  ["Monday", "mon", "monday"],
  ["Tuesday", "tue", "tues", "tuesday"],
  ["Wednesday", "wed", "weds", "wednesday"],
  ["Thursday", "thu", "thur", "thurs", "thursday"],
  ["Friday", "fri", "friday"],
  ["Saturday", "sat", "saturday"],
];
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// Longest first, so "thursday" is never read as "thu" + "rsday".
const NAMES = DAYS.flatMap((d) => d.slice(1)).sort(
  (a, b) => b.length - a.length,
);
const DATE = `(\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|(?:${MONTHS.join("|")})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?)`;
const HEADER = new RegExp(
  `^[\\s#>*_]*(${NAMES.join("|")})\\.?` + // the day, markdown before it
    `(?:,?\\s*\\(?${DATE}\\)?)?` + // a date, maybe in brackets
    "[*_]*\\s*(?::|[-–—]\\s|$)[*_]*\\s*(.*)$", // colon, " - ", or the end
  "i",
);

export interface CalendarDay {
  /** 0 is Sunday, as Date.getDay(). */
  index: number;
  name: string;
  /** The date as the teacher wrote it, or "". */
  date: string;
  when: { month: number; day: number } | null;
  lines: string[];
}

export interface Week {
  title: string;
  /** Empty when no line is a day — the teacher's preview says so. */
  days: CalendarDay[];
}

function dayIndex(word: string): number {
  const w = word.toLowerCase();
  return DAYS.findIndex((d) => d.indexOf(w, 1) > 0);
}

/** "10/27", "10-27-26", "Oct 27th" → { month: 9, day: 27 }, or null. */
function readDate(text: string | undefined): CalendarDay["when"] {
  if (!text) return null;
  let m = /^(\d{1,2})[/.-](\d{1,2})/.exec(text);
  if (m) return { month: Number(m[1]) - 1, day: Number(m[2]) };
  m = /^([a-z]+)\.?\s+(\d{1,2})/i.exec(text);
  if (m) {
    const at = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase());
    if (at >= 0) return { month: at, day: Number(m[2]) };
  }
  return null;
}

/** A line under a day as a markdown list item: a bullet the teacher typed
 *  (and its indent, for a sub-point) is kept, and one is added if not. */
export function asItem(line: string): string {
  const m = /^(\s*)(?:[-*+•]|\d+[.)])\s+(.*)$/.exec(line);
  if (m) return m[1]!.replace(/\t/g, "  ") + "- " + m[2];
  return "- " + line.trim();
}

export function parseWeek(text: string): Week {
  const title: string[] = [];
  const days: CalendarDay[] = [];
  let day: CalendarDay | null = null;
  for (const line of (text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const m = HEADER.exec(line);
    if (m) {
      const index = dayIndex(m[1]!);
      day = {
        index,
        name: DAYS[index]![0]!,
        date: (m[2] ?? "").trim(),
        when: readDate(m[2]),
        lines: [],
      };
      days.push(day);
      if (m[3]!.trim()) day.lines.push(m[3]!);
      continue;
    }
    if (!line.trim()) continue;
    (day ? day.lines : title).push(line);
  }
  return { title: title.join("\n").trim(), days };
}

/** Which of `days` is today, as an index into it, or -1. */
export function todayIn(days: CalendarDay[], now: Date = new Date()): number {
  const dated = days.some((d) => d.when);
  return days.findIndex((d) =>
    dated
      ? !!d.when &&
        d.when.month === now.getMonth() &&
        d.when.day === now.getDate()
      : d.index === now.getDay(),
  );
}
