/**
 * What a tutorial's steps and questions are worth, read and rewritten, for
 * assigning one (New assignment, "a tutorial"). Points live in the text, as
 * checks.py and quiz.py read them: "(2 points)" at the end of a check's line,
 * a "points: 2" line in a question; 1 when nothing says. Nothing else in the
 * text is ever touched (the teacher's ask: tutorials "in their original state",
 * only the points adjusted), and the server refuses a tutorial that differs
 * from its original in anything but points (classes.tutorial_row).
 *
 * Counted as grades.py counts them: a check's label once however many steps
 * repeat it ("game runs 2 seconds without errors" is one test), a question
 * once however often it's asked. A question set to 0 isn't graded at all
 * (quiz.py drops it), which makes it practice.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const LINE_POINTS = /\s*\((\d{1,4}(?:\.\d{1,2})?)\s*points?\)\s*$/i;
const QUESTION_POINTS = /^\s*points?\s*:\s*(\d{1,4}(?:\.\d{1,2})?)\s*$/i;

export interface PointItem {
  kind: "check" | "question";
  /** A check's line, or a question's first line of words. */
  label: string;
  points: number;
}

/** One fenced block: where it is, what kind, its body's line numbers. */
interface Block {
  kind: "check" | "question";
  first: number;
  /** The closing fence's line (or the end). */
  end: number;
}

function blocksOf(lines: string[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const f = FENCE.exec(lines[i]!);
    if (!f) continue;
    const info = f[2]!.trim().toLowerCase();
    const fence = f[1]!;
    const first = i + 1;
    for (i++; i < lines.length; i++) {
      const g = FENCE.exec(lines[i]!);
      if (g && g[1]![0] === fence[0] && g[1]!.length >= fence.length && !g[2]!.trim()) break;
    }
    if (info === "check" || info === "tests") out.push({ kind: "check", first, end: i });
    else if (info === "quiz") out.push({ kind: "question", first, end: i });
  }
  return out;
}

/** A check line's label, as checks.ts reads it (points off, spaces squeezed). */
function checkLabel(raw: string): string | null {
  const line = raw.trim();
  if (!line || line.startsWith("#")) return null;
  return line.replace(LINE_POINTS, "").trimEnd().split(/\s+/).join(" ") || null;
}

/** A question's lines outside its own inner code fence, as quiz.py reads them. */
function questionLines(lines: string[], b: Block): { at: number; text: string; outside: boolean }[] {
  let inner: string | null = null;
  const out: { at: number; text: string; outside: boolean }[] = [];
  for (let i = b.first; i < b.end; i++) {
    const ln = lines[i]!;
    const f = FENCE.exec(ln);
    if (f) {
      if (inner === null) inner = f[1]!;
      else if (f[1]![0] === inner[0] && f[1]!.length >= inner.length) inner = null;
      out.push({ at: i, text: ln, outside: false });
      continue;
    }
    out.push({ at: i, text: ln, outside: inner === null });
  }
  return out;
}

/** What tells one question from another: its text without its points. */
function questionKey(lines: string[], b: Block): string {
  return questionLines(lines, b)
    .filter((l) => !(l.outside && QUESTION_POINTS.test(l.text)))
    .map((l) => l.text.trim())
    .join("\n");
}

function walk(md: string) {
  const lines = String(md ?? "").replace(/\r\n/g, "\n").split("\n");
  const items: PointItem[] = [];
  const index = new Map<string, number>();
  const blocks = blocksOf(lines);
  /** For each block: which item each of its lines is (a check block), or the block's item (a question). */
  const uses: { block: Block; item: number; lines?: Map<number, number> }[] = [];
  for (const b of blocks) {
    if (b.kind === "check") {
      const at = new Map<number, number>();
      for (let i = b.first; i < b.end; i++) {
        const label = checkLabel(lines[i]!);
        if (!label) continue;
        const key = `c:${label}`;
        if (!index.has(key)) {
          const m = LINE_POINTS.exec(lines[i]!.trim());
          index.set(key, items.length);
          items.push({ kind: "check", label, points: m ? parseFloat(m[1]!) : 1 });
        }
        at.set(i, index.get(key)!);
      }
      uses.push({ block: b, item: -1, lines: at });
    } else {
      const key = `q:${questionKey(lines, b)}`;
      if (!index.has(key)) {
        const ql = questionLines(lines, b);
        const p = ql.find((l) => l.outside && QUESTION_POINTS.test(l.text));
        const words = ql.find((l) => l.outside && l.text.trim() && !/^\s*(type|points?|id)\s*:/i.test(l.text));
        index.set(key, items.length);
        items.push({
          kind: "question",
          // Backticks and bold marks off; underscores stay (keyboard_check is a name).
          label: (words?.text.trim() ?? "A question").replace(/`|\*\*/g, ""),
          points: p ? parseFloat(QUESTION_POINTS.exec(p.text)![1]!) : 1,
        });
      }
      uses.push({ block: b, item: index.get(key)! });
    }
  }
  return { lines, items, uses };
}

/** Every check and question in a tutorial with what it's worth, each once, in order. */
export function pointItems(md: string): PointItem[] {
  return walk(md).items;
}

/** A number of points as it's written: 2, 1.5, 0.33. */
export function showPoints(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** The tutorial with these points (one per pointItems entry, in its order), nothing else changed. */
export function withPoints(md: string, points: number[]): string {
  const { lines, uses } = walk(md);
  const out = [...lines];
  const insertAfter = new Map<number, string>();
  const drop = new Set<number>();
  for (const u of uses) {
    if (u.lines) {
      for (const [i, item] of u.lines) {
        const p = points[item] ?? 1;
        const bare = lines[i]!.replace(LINE_POINTS, "");
        out[i] = p === 1 ? bare : `${bare} (${showPoints(p)} point${p === 1 ? "" : "s"})`;
      }
    } else {
      const p = points[u.item] ?? 1;
      for (const l of questionLines(lines, u.block)) if (l.outside && QUESTION_POINTS.test(l.text)) drop.add(l.at);
      // At the end of the question, where it changes nothing about how it reads.
      if (p !== 1) insertAfter.set(u.block.end - 1, `points: ${showPoints(p)}`);
    }
  }
  const result: string[] = [];
  out.forEach((line, i) => {
    if (!drop.has(i)) result.push(line);
    const extra = insertAfter.get(i);
    if (extra !== undefined) result.push(extra);
  });
  return result.join("\n");
}

/**
 * `total` points shared out over `n` things: whole points while there are enough
 * (any left over going to the last ones, the later steps), otherwise equal parts
 * to two places, the last taking what rounding leaves.
 */
export function spread(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (total >= n && Number.isInteger(total)) {
    const base = Math.floor(total / n);
    const extra = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i >= n - extra ? 1 : 0));
  }
  const each = Math.floor((total / n) * 100) / 100;
  const out = Array.from({ length: n }, () => each);
  out[n - 1] = Math.round((total - each * (n - 1)) * 100) / 100;
  return out;
}

export const sumPoints = (points: number[]) => Math.round(points.reduce((a, b) => a + b, 0) * 100) / 100;
