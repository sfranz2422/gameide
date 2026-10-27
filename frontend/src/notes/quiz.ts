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
const TYPE = /^type\s*:\s*(blanks?|fill|match|matching|order|parsons|bug|sort|groups?|predict)\s*$/i;
const PAIR = /^[-*+]\s+(.+?)\s+->\s+(.+)$/;
const MATCHL = /^match\s*:\s*(.+)$/i;
const OPTION = /^option\s*:\s*(.+)$/i;
export const BLANK = /\[\[([^[\]\n]*)\]\]/g;
const ITEM = /^[-*+] (.*)$/;
const LINEQ = /^(?:line|item)\s*:\s?(.*)$/i;
const GROUP = /^group\s*:\s*(.+)$/i;
const BUGQ = /^bugs?\s*:\s*([\d,\s]+)$/i;
const KINDS: Record<string, string> = {
  blank: "blank", blanks: "blank", fill: "blank", match: "match", matching: "match",
  order: "order", parsons: "order", bug: "bug", sort: "sort", group: "sort", groups: "sort",
  predict: "predict",
};

/**
 * quiz.py's _fnv and scramble, exactly: an order or sort question's shuffled
 * order is part of its id, and the server marks a response against it, so
 * anything here that shuffles must shuffle the same way. FNV-1a over UTF-8
 * (not SHA-1: there's no synchronous SHA-1 in a browser).
 */
export function fnv(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h >>> 0;
}
export function scramble(things: string[]): string[] {
  const keys = things.map((t, i) => fnv(`${i}\0${t}`));
  let out = things.map((_, i) => i).sort((a, b) => keys[a]! - keys[b]! || a - b).map((i) => things[i]!);
  if (things.some((t) => t !== things[0]) && out.every((t, i) => t === things[i])) out = [...out.slice(1), ...out.slice(0, 1)];
  return out;
}
/** The lines of the first fenced code in a prompt (quiz.py, code_lines): what a bug question counts. */
export function codeLines(prompt: string): string[] {
  let inner: string | null = null;
  let found: string[] | null = null;
  for (const ln of String(prompt ?? "").split("\n")) {
    const f = FENCE.exec(ln);
    if (f) {
      if (inner === null) {
        inner = f[1]!;
        found = [];
        continue;
      }
      if (f[1]![0] === inner[0] && f[1]!.length >= inner.length) return found ?? [];
    } else if (inner !== null) found!.push(ln);
  }
  return found ?? [];
}

export interface Question {
  id: string;
  kind: "choice" | "text" | "long" | "blank" | "match" | "order" | "bug" | "sort" | "predict";
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
  const ordered: string[] = [], shownItems: string[] = [], groups: string[] = [], itemGroups: (string | null)[] = [], bugs: string[] = [];
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
    // Lines and items before choices, as quiz.parse: `- [1, 2]` is code.
    const bare = ln.replace(/^\s+/, "");
    if (typed === "order" || typed === "sort") {
      if ((m = ITEM.exec(bare)) && m[1]!.trim()) {
        if (typed === "order") ordered.push(m[1]!.replace(/\s+$/, ""));
        else {
          shownItems.push(m[1]!.trim());
          itemGroups.push(groups.length ? groups[groups.length - 1]! : "");
        }
        continue;
      }
      if ((m = LINEQ.exec(bare)) && m[1]!.trim()) {
        shownItems.push(typed === "order" ? m[1]!.replace(/\s+$/, "") : m[1]!.trim());
        itemGroups.push(null);
        continue;
      }
    }
    if (typed === "sort" && (m = GROUP.exec(s))) {
      groups.push(m[1]!.trim());
      continue;
    }
    if (typed === "bug" && (m = BUGQ.exec(s))) {
      for (const b of m[1]!.split(/[,\s]+/)) if (b) bugs.push(b);
      continue;
    }
    if ((m = CHOICE.exec(s))) {
      q.choices.push(m[2]!.trim());
      if (m[1] !== " ") q.correct.push(m[2]!.trim());
    } else if ((m = ANSWER.exec(s))) {
      if (m[1]!.trim()) q.answers.push(m[1]!.trim());
    } else if ((m = POINTS.exec(s))) q.points = parseFloat(m[1]!);
    else if ((m = QID.exec(s))) q.id = m[1]!;
    else if (LONG.test(s)) long = true;
    else if ((m = TYPE.exec(s))) typed = KINDS[m[1]!.toLowerCase()]!;
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
  } else if (typed === "order") {
    q.answers = [];
    if (ordered.length) {
      q.choices = scramble(ordered);
      q.correct = ordered;
    } else {
      q.choices = [...shownItems];
      q.correct = [];
    }
    q.kind = "order";
  } else if (typed === "sort") {
    // choices: the items as shown (shuffled); correct: each one's group; answers: the groups, as written.
    q.answers = groups;
    if (itemGroups.some((g) => g)) {
      const pairs = shownItems.map((it, i) => [it, itemGroups[i]] as const).filter(([, g]) => g);
      const shuffled = scramble(pairs.map(([it]) => it));
      const left = [...pairs];
      q.correct = shuffled.map((it) => left.splice(left.findIndex(([x]) => x === it), 1)[0]![1]!);
      q.choices = shuffled;
    } else {
      q.choices = [...shownItems];
      q.correct = [];
    }
    q.kind = "sort";
  } else if (typed === "predict") {
    // A short answer about the question's code (quiz.parse): answer: is what it prints.
    q.choices = [];
    q.correct = [];
    q.kind = "predict";
  } else if (typed === "bug") {
    q.choices = [];
    q.answers = [];
    q.correct = bugs.map((b) => b.replace(/^0+/, "") || "0");
    q.kind = "bug";
  } else q.kind = q.choices.length ? "choice" : "text";
  return q;
}

/** Notes as pieces: markdown, a question, or a block of tests — skipping fences, so an example isn't a question. */
export type Piece =
  | { type: "md"; text: string }
  | { type: "quiz"; body: string }
  | { type: "cards"; body: string }
  | { type: "tests"; body: string; kind: string };

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
    if (fence === null && f && (lang === "quiz" || lang === "cards" || testKinds.includes(lang))) {
      const mark = f[1]!;
      const body: string[] = [];
      for (i++; i < lines.length; i++) {
        const g = FENCE.exec(lines[i]!);
        if (g && !g[2]!.trim() && g[1]![0] === mark[0] && g[1]!.length >= mark.length) break;
        body.push(lines[i]!);
      }
      flush();
      out.push(
        lang === "quiz" || lang === "cards" ? { type: lang, body: body.join("\n") } : { type: "tests", body: body.join("\n"), kind: lang },
      );
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

/** A ```cards block, a card a line: `front -> back` (a leading `- ` is fine); lines without -> are skipped. */
export function parseCards(text: string): { front: string; back: string }[] {
  return String(text ?? "")
    .split("\n")
    .map((ln) => /^(.+?)\s+->\s+(.+)$/.exec(ln.trim().replace(/^[-*+]\s+/, "")))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ front: m[1]!.trim(), back: m[2]!.trim() }));
}

/**
 * `animate: words` (or `animate: type`) as the notes' first line: they're
 * played a section at a time in the Notes tab (NotesPane), as in the other
 * editors (notes.js, takeHeader). {animate, body}: the mode ("" for none)
 * and the notes without the line. A name it doesn't know stays in, as text,
 * so a typo shows on the slide instead of silently doing nothing.
 *
 * A speed may follow, `animate: words slow`, or stand alone, `animate: slow`
 * (words); none is "normal". The first speed (70 ms a word, about 850 words
 * a minute) was far too quick to read along with — SPEEDS in reveal.ts.
 */
const ANIMATE_LINE = /^[ \t]*animate[ \t]*:[ \t]*([a-z]+)(?:[ \t]+([a-z]+))?[ \t]*$/i;
export type Speed = "slow" | "normal" | "fast";
const SPEED_NAMES: Speed[] = ["slow", "normal", "fast"];
const ANIMATIONS: Record<string, "words" | "type"> = {
  words: "words", word: "words", reveal: "words", on: "words", yes: "words", true: "words",
  type: "type", typewriter: "type", typing: "type",
};
export function takeAnimate(md: string): { animate: "" | "words" | "type"; speed: Speed; body: string } {
  const text = String(md ?? "");
  const m = /^\s*([^\n]*)\n?/.exec(text);
  const hit = m ? ANIMATE_LINE.exec(m[1]!.replace(/\r$/, "")) : null;
  if (hit) {
    const first = hit[1]!.toLowerCase(), second = (hit[2] ?? "").toLowerCase();
    const body = text.slice(m![0].length);
    if (SPEED_NAMES.includes(first as Speed) && !second) return { animate: "words", speed: first as Speed, body };
    const mode = ANIMATIONS[first];
    if (mode && (!second || SPEED_NAMES.includes(second as Speed))) return { animate: mode, speed: (second || "normal") as Speed, body };
  }
  return { animate: "", speed: "normal", body: text };
}

/**
 * A slide cut into the sections it's played in: a line with only `...` on
 * it ends one and starts the next — never inside fenced code, where it's a
 * line of output. A slide with none is one section.
 */
export function sections(md: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  for (const ln of String(md ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
    } else if (fence === null && /^ {0,3}\.\.\.\s*$/.test(ln)) {
      out.push(cur.join("\n"));
      cur = [];
      continue;
    }
    cur.push(ln);
  }
  out.push(cur.join("\n"));
  const kept = out.filter((x) => x.trim());
  return kept.length ? kept : [""];
}

/**
 * What the teacher wraps to make it stand out — `:::pop` … `:::` lines round
 * a sentence, a reminder, a code block. Nothing pops by itself. The marker
 * lines become paragraphs of a word no one writes (never inside fenced
 * code), and popBoxes turns the rendered pairs into a box round what's
 * between: a box that stands out, and arrives with a pop when it's played.
 */
const POP_START = "%%POPSTART%%", POP_END = "%%POPEND%%";
export function popMarks(md: string): string {
  let fence: string | null = null;
  return String(md ?? "")
    .split("\n")
    .map((ln) => {
      const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
      if (f) {
        if (fence === null) fence = f[1]!;
        else if (f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
        return ln;
      }
      if (fence !== null) return ln;
      if (/^ {0,3}:::\s*pop\s*$/i.test(ln)) return `\n${POP_START}\n`;
      if (/^ {0,3}:::\s*$/.test(ln)) return `\n${POP_END}\n`;
      return ln;
    })
    .join("\n");
}
/** Rendered HTML with each marker pair made a box. Each marker is a paragraph of its own, so what's between is whole blocks. */
/**
 * A pause while a section plays (notes.js's pauseLines): `^` with a space,
 * or the line's end, on each side waits about a second; `^^` twice as long.
 * A line of only carets joins the end of the line before (or the start of
 * the line after, under a blank line), since alone it would make an empty
 * paragraph — a gap on the slide. Never inside fenced code.
 */
export const PAUSE = /(^|\s)(\^+)(?=\s|$)/g;
export function pauseLines(md: string): string {
  const out: string[] = [];
  let fence: string | null = null, carry = "";
  for (let ln of String(md ?? "").split("\n")) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(ln);
    if (f) {
      if (fence === null) fence = f[1]!;
      else if (f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = null;
    } else if (fence === null) {
      const p = /^ {0,3}(\^+)\s*$/.exec(ln);
      if (p) {
        const before = out.length ? out[out.length - 1]! : "";
        if (before.trim() && !/^ {0,3}(`{3,}|~{3,})|%%POP/.test(before)) out[out.length - 1] = before.replace(/\s+$/, "") + " " + p[1];
        else carry += p[1];
        continue;
      }
      // Not onto a :::pop marker: that would stop it being one.
      if (carry && ln.trim() && !ln.includes("%%POP")) {
        const indent = /^\s*(?:[-*+] |\d+[.)] |#{1,6} |> )?/.exec(ln)![0];
        ln = indent + carry + " " + ln.slice(indent.length);
        carry = "";
      }
    }
    out.push(ln);
  }
  return out.join("\n");
}

export function popBoxes(html: string): string {
  let open = 0;
  const out = html.replace(/<p>%%POP(START|END)%%<\/p>/g, (_, which: string) => {
    if (which === "START") {
      const close = open ? "</div>" : "";
      open = 1;
      return `${close}<div class="pop-box">`;
    }
    if (!open) return "";
    open = 0;
    return "</div>";
  });
  return open ? out + "</div>" : out;
}

/**
 * Notes cut into slides at lines of `---` (outside code fences), as PyIDE's
 * slides(): [] when there's none — one slide is not slides, and the notes
 * are shown whole. The `animate:` line is taken out first, so it never
 * changes the count.
 */
export function slides(md: string): string[] {
  const lines = takeAnimate(md).body.replace(/\r\n?/g, "\n").split("\n");
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
