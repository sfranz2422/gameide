/**
 * Questions in notes: PyIDE's ```quiz format, read exactly as
 * backend/quiz.py (a copy of PyIDE's) reads it — notes.js's parseQuiz, in
 * TypeScript. quiz-cases.json holds the two readers to each other: Vitest
 * runs this on each case, the server checks run quiz.py on the same ones.
 *
 * A student's notes are redacted before they leave the server: no `[x]`,
 * no `answer:` lines, no blanks' answers, and an `id:` line per question,
 * which is how an answer says which question it's for. So in the browser
 * the key is always empty — this only needs the question, its kind and
 * what to choose from.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const CHOICE = /^[-*+]\s+\[([ xX])\]\s+(.*)$/;
const ANSWER = /^answer\s*:\s*(.*)$/i;
const POINTS = /^points?\s*:\s*(\d{1,4}(?:\.\d{1,2})?)\s*$/i;
const QID = /^id\s*:\s*([0-9a-f]{12})\s*$/;
const LONG = /^type\s*:\s*(long|essay)\s*$/i;
const TYPE = /^type\s*:\s*(blanks?|fill|match|matching)\s*$/i;
const PAIR = /^[-*+]\s+(.+?)\s+->\s+(.+)$/;
const MATCHL = /^match\s*:\s*(.+)$/i;
const OPTION = /^option\s*:\s*(.+)$/i;
export const BLANK = /\[\[([^[\]\n]*)\]\]/g;

export interface Question {
  id: string;
  kind: "choice" | "text" | "long" | "blank" | "match";
  prompt: string;
  choices: string[];
  correct: string[];
  answers: (string | string[])[];
  options: string[];
  points: number;
}

export function parseQuiz(body: string): Question {
  const lines = String(body ?? "").replace(/\r\n?/g, "\n").split("\n");
  const q: Question = { id: "", kind: "text", prompt: "", choices: [], correct: [], answers: [], options: [], points: 1 };
  const prompt: string[] = [];
  let inner: string | null = null;
  let long = false;
  let typed = "";
  const lefts: string[] = [], rights: string[] = [], options: string[] = [];
  for (const ln of lines) {
    const s = ln.trim();
    const f = FENCE.exec(ln);
    if (f) {
      if (inner === null) inner = f[1]!;
      else if (f[1]![0] === inner[0] && f[1]!.length >= inner.length) inner = null;
      prompt.push(ln);
      continue;
    }
    if (inner !== null) {
      prompt.push(ln);
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = CHOICE.exec(s))) {
      q.choices.push(m[2]!.trim());
      if (m[1] !== " ") q.correct.push(m[2]!.trim());
    } else if ((m = ANSWER.exec(s))) {
      if (m[1]!.trim()) q.answers.push(m[1]!.trim());
    } else if ((m = POINTS.exec(s))) q.points = parseFloat(m[1]!);
    else if ((m = QID.exec(s))) q.id = m[1]!;
    else if (LONG.test(s)) long = true;
    else if ((m = TYPE.exec(s))) typed = /^match/i.test(m[1]!) ? "match" : "blank";
    else if (typed === "match" && (m = PAIR.exec(s))) {
      lefts.push(m[1]!.trim());
      rights.push(m[2]!.trim());
    } else if (typed === "match" && (m = MATCHL.exec(s))) lefts.push(m[1]!.trim());
    else if (typed === "match" && (m = OPTION.exec(s))) options.push(m[1]!.trim());
    else prompt.push(ln);
  }
  while (prompt.length && !prompt[0]!.trim()) prompt.shift();
  while (prompt.length && !prompt[prompt.length - 1]!.trim()) prompt.pop();
  q.prompt = prompt.join("\n");
  if (long) {
    q.choices = [];
    q.correct = [];
    q.answers = [];
    q.kind = "long";
  } else if (typed === "blank") {
    q.choices = [];
    q.correct = [];
    q.answers = [...q.prompt.matchAll(BLANK)].map((b) => b[1]!.split("|").map((a) => a.trim()).filter(Boolean));
    q.kind = "blank";
  } else if (typed === "match") {
    // Every right and option, SORTED as quiz.py does, so neither order nor place gives a pair away.
    q.choices = lefts;
    q.correct = rights;
    q.answers = [];
    q.options = [...new Set([...rights, ...options])].sort();
    q.kind = "match";
  } else q.kind = q.choices.length ? "choice" : "text";
  return q;
}

/** Notes as pieces: markdown, a question, or a block of tests — skipping fences, so an example isn't a question. */
export type Piece = { type: "md"; text: string } | { type: "quiz"; body: string } | { type: "tests"; body: string; kind: string };

export function pieces(md: string, testKinds: string[] = ["tests"]): Piece[] {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: Piece[] = [];
  let text: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    if (text.join("").trim()) out.push({ type: "md", text: text.join("\n") });
    text = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    const f = FENCE.exec(ln);
    const lang = f ? f[2]!.trim().toLowerCase() : "";
    if (fence === null && f && (lang === "quiz" || testKinds.includes(lang))) {
      const mark = f[1]!;
      const body: string[] = [];
      for (i++; i < lines.length; i++) {
        const g = FENCE.exec(lines[i]!);
        if (g && !g[2]!.trim() && g[1]![0] === mark[0] && g[1]!.length >= mark.length) break;
        body.push(lines[i]!);
      }
      flush();
      out.push(lang === "quiz" ? { type: "quiz", body: body.join("\n") } : { type: "tests", body: body.join("\n"), kind: lang });
      continue;
    }
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1]![0] === fence[0] && f[1]!.length >= fence.length && !f[2]!.trim()) fence = null;
    }
    text.push(ln);
  }
  flush();
  return out;
}

/**
 * Notes cut into slides at lines of `---` (outside code fences), as PyIDE's
 * slides(): [] when there's none — one slide is not slides, and the notes
 * are shown whole.
 */
export function slides(md: string): string[] {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[][] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  let cuts = 0;
  for (const ln of lines) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
    } else if (fence === null && /^ {0,3}-{3,}\s*$/.test(ln)) {
      out.push(cur);
      cur = [];
      cuts++;
      continue;
    }
    cur.push(ln);
  }
  out.push(cur);
  if (!cuts) return [];
  return out
    .map((s) => {
      while (s.length && !s[0]!.trim()) s.shift();
      while (s.length && !s[s.length - 1]!.trim()) s.pop();
      return s.join("\n");
    })
    .filter((s) => s.trim());
}
