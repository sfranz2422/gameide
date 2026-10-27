/**
 * The Notes tab (beside Console and Docs): an assignment's notes, as its
 * teacher wrote them — slides when they have `---` lines, questions to
 * answer, and the tests with Check my work.
 *
 * SANITISED: notes are the one place stored text becomes HTML here, so
 * every bit of markdown goes through DOMPurify, with forms and inline style
 * taken out as PyIDE's notes.js does (a fake "school login" form; a
 * position:fixed box over the whole editor). Links open in a new tab, so a
 * student never navigates away from their game.
 *
 * Code in notes can't be selected (the teacher's decision for tutorials):
 * typing it is the exercise. A speed bump, not a lock — the page has it.
 *
 * The notes come redacted (backend/notes.py): questions carry an `id:` and
 * no key, so all this can do with an answer is send it; the server marks it.
 */
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../store/api";
import { allTests, runTests, type GameRunner, type TestResult } from "../checks/checks";
import type { Project } from "../store/project";
import { announceXp } from "../xp/runXp";
import { BLANK, codeLines, fnv, parseCards, parseQuiz, pieces, slides, type Question } from "./quiz";
import { Spotlight } from "../tutorials/TutorialPane";
import { takeHighlight } from "../tutorials/tutorial";

const SANITIZE = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["form", "input", "button", "textarea", "select", "option", "label", "fieldset"],
  FORBID_ATTR: ["style"],
};

export function renderMarkdown(md: string): string {
  // A checklist's boxes as placeholders: the sanitiser takes every <input>
  // out, so a task list arrived as bare items. A span with a data- attribute
  // survives, and enhanceTasks makes it a real checkbox, in the DOM.
  const raw = (marked.parse(md ?? "", { breaks: true, async: false }) as string).replace(
    /<input\b[^>]*type="checkbox"[^>]*>/g,
    (tag) => `<span class="task-box" data-done="${/\bchecked\b/.test(tag) ? "1" : "0"}"></span>`,
  );
  const html = DOMPurify.sanitize(raw, SANITIZE) as string;
  // Links open in a new tab, and can't reach back into this one.
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

/**
 * `- [ ] item` in notes: a box the student ticks, kept in this browser, per
 * assignment and per item — their own record of how far they've got; nothing
 * is sent or marked. `- [x]` starts ticked. Keyed by the item's words and its
 * place among items with the same words, so two "Test it"s are two boxes.
 */
export function enhanceTasks(root: HTMLElement, page: string) {
  const seen = new Map<string, number>();
  root.querySelectorAll<HTMLElement>("span.task-box").forEach((spot) => {
    const item = (spot.closest("li") as HTMLElement | null) ?? (spot.parentElement as HTMLElement);
    const text = (item.textContent ?? "").trim();
    const n = (seen.get(text) ?? 0) + 1;
    seen.set(text, n);
    const key = `gameide-task:${page}:${fnv(text)}:${n}`;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "task-check";
    box.setAttribute("aria-label", text || "Done");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(key);
    } catch {
      /* a private window: nothing remembered */
    }
    box.checked = stored === null ? spot.dataset.done === "1" : stored === "1";
    item.classList.add("task-item");
    item.classList.toggle("is-done", box.checked);
    box.addEventListener("change", () => {
      item.classList.toggle("is-done", box.checked);
      try {
        localStorage.setItem(key, box.checked ? "1" : "0");
      } catch {
        /* this visit only */
      }
    });
    spot.replaceWith(box);
  });
}

function Markdown({ md, className = "", tasks }: { md: string; className?: string; tasks?: string }) {
  const html = useMemo(() => renderMarkdown(md), [md]);
  const ref = useRef<HTMLDivElement>(null);
  // After React has put the HTML in: it never touches what's inside again
  // until the html itself changes, so the boxes made here stay.
  useEffect(() => {
    if (tasks !== undefined && ref.current) enhanceTasks(ref.current, tasks);
  }, [html, tasks]);
  return <div ref={ref} className={`notes-md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A ```cards block: each card shows its front, and a click turns it over. For practising — nothing is marked. */
function FlipCards({ body }: { body: string }) {
  const cards = useMemo(() => parseCards(body), [body]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  if (!cards.length) return null;
  return (
    <div className="flip-cards" data-testid="flip-cards">
      {cards.map((c, i) => {
        const on = flipped.has(i);
        return (
          <button
            key={i}
            type="button"
            className={`flip-card${on ? " is-flipped" : ""}`}
            aria-pressed={on}
            title="Click to turn it over"
            onClick={() => setFlipped((f) => {
              const next = new Set(f);
              if (next.has(i)) next.delete(i);
              else next.add(i);
              return next;
            })}
          >
            <span className="notes-md inline" dangerouslySetInnerHTML={{ __html: renderMarkdown(on ? c.back : c.front) }} />
          </button>
        );
      })}
    </div>
  );
}

interface Reply {
  kind?: string;
  response: string;
  correct: boolean | null;
  points: number;
  earned: number;
  graded?: boolean;
  practice?: boolean;
  xp?: number;
}

export interface NotesProps {
  notes: string;
  /** The assignment's slug: where answers and results go. */
  assignment: string;
  /** The game as it is now, for the checks that read it. */
  project: Project;
  /** Plays the game for the checks that need it running; null where it can't. */
  runner: GameRunner | null;
  /** The teacher (or a game open read only): answers are practice, nothing is recorded. */
  practice: boolean;
}

export function NotesPane({ notes, assignment, project, runner, practice }: NotesProps) {
  const deck = useMemo(() => slides(notes), [notes]);
  const key = `gameide-slide:${assignment}`;
  const [at, setAt] = useState(() => {
    try {
      return Number(localStorage.getItem(key) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  const go = (n: number) => {
    const to = Math.max(0, Math.min(deck.length - 1, n));
    setAt(to);
    try {
      localStorage.setItem(key, String(to));
    } catch {
      /* remembered for this visit only */
    }
  };
  const [mine, setMine] = useState<Record<string, Reply>>({});
  useEffect(() => {
    if (practice) return;
    void api<{ answers: Record<string, Reply> }>(`/api/quiz/${assignment}/mine`).then((r) => setMine(r.answers), () => undefined);
  }, [assignment, practice]);
  const answered = useCallback((qid: string, r: Reply) => setMine((m) => ({ ...m, [qid]: r })), []);

  // A slide's `highlight:` line spotlights part of the editor while the slide
  // is open, as a tutorial step's does; the line itself isn't shown.
  const { md: shown, highlight } = takeHighlight(deck.length ? deck[Math.min(at, deck.length - 1)]! : notes);
  const [spot, setSpot] = useState(true);
  useEffect(() => setSpot(true), [at, highlight]);
  const hideSpot = useCallback(() => setSpot(false), []);
  return (
    <div className="notes-pane" data-testid="notes-pane">
      {deck.length > 0 && (
        <div className="notes-slides-bar">
          <button className="btn small" disabled={at <= 0} onClick={() => go(at - 1)} aria-label="Previous slide">
            ←
          </button>
          <span className="muted small" data-testid="slide-count">
            {Math.min(at, deck.length - 1) + 1} / {deck.length}
          </span>
          <button className="btn small" disabled={at >= deck.length - 1} onClick={() => go(at + 1)} aria-label="Next slide" data-testid="slide-next">
            →
          </button>
        </div>
      )}
      {highlight && spot && <Spotlight target={highlight} onDone={hideSpot} />}
      <div className="notes-body">
        {pieces(shown).map((p, i) =>
          p.type === "md" ? (
            <Markdown key={i} md={p.text} tasks={assignment} />
          ) : p.type === "cards" ? (
            <FlipCards key={i} body={p.body} />
          ) : p.type === "quiz" ? (
            <QuestionCard key={i} q={parseQuiz(p.body)} assignment={assignment} reply={mine[parseQuiz(p.body).id]} onAnswer={answered} practice={practice} />
          ) : (
            <TestsCard key={i} notes={notes} assignment={assignment} project={project} runner={runner} practice={practice} />
          ),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- questions

function QuestionCard({ q, assignment, reply, onAnswer, practice }: { q: Question; assignment: string; reply?: Reply; onAnswer: (qid: string, r: Reply) => void; practice: boolean }) {
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const blanks = q.kind === "blank" ? [...q.prompt.matchAll(BLANK)].length : 0;
  const [items, setItems] = useState<string[]>(() => Array(q.kind === "match" ? q.choices.length : blanks).fill(""));
  // Put in order, sort into groups, find the bug (quiz.py has what each sends).
  const [order, setOrder] = useState<string[]>(() => [...q.choices]);
  const [placed, setPlaced] = useState<string[]>(() => q.choices.map(() => ""));
  const [picked, setPicked] = useState(-1);
  const [bugLine, setBugLine] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!q.id) return <p className="banner error">This question isn't finished: it needs its answer and enough choices.</p>;

  const response = () => {
    if (q.kind === "choice") return choice;
    if (q.kind === "blank" || q.kind === "match") return JSON.stringify(items);
    if (q.kind === "order") return JSON.stringify(order);
    if (q.kind === "sort") return JSON.stringify(placed);
    if (q.kind === "bug") return bugLine;
    if (q.kind === "long")
      // Paragraphs, escaped: the server cleans it again whatever is sent (quiz.clean_html).
      return text
        .split(/\n{2,}/)
        .map((para) => `<p>${para.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
        .join("");
    return text;
  };
  const send = async () => {
    if (q.kind === "sort" && placed.some((g) => !g)) return setProblem("Put every item in a group first.");
    if (q.kind === "bug" && !bugLine) return setProblem("Click the line with the bug first.");
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<Reply>("/api/quiz/answer", { json: { assignment, question: q.id, response: response() } });
      onAnswer(q.id, r);
      if (r.xp) announceXp(r.xp, "Question answered");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const done = !!reply && !reply.practice;
  const promptMd = q.kind === "blank" ? (() => {
    let n = 0;
    return q.prompt.replace(BLANK, () => `**(${++n})** ____`);
  })() : q.kind === "bug" ? withoutCode(q.prompt) : q.prompt;
  // What's shown once answered: their answer, as they sent it.
  const sent = (fallback: string[]) => {
    try {
      const got = JSON.parse(reply?.response ?? "null");
      return Array.isArray(got) && got.length === fallback.length ? (got as string[]) : fallback;
    } catch {
      return fallback;
    }
  };
  const shownOrder = done ? sent(order) : order;
  const shownPlaced = done ? sent(placed) : placed;
  const shownBug = done ? (reply!.response ?? "") : bugLine;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    setOrder((o) => {
      const next = [...o];
      next.splice(to, 0, next.splice(from, 1)[0]!);
      return next;
    });
  };
  const put = (group: string) => {
    if (done || picked < 0) return;
    setPlaced((p) => p.map((g, i) => (i === picked ? group : g)));
    setPicked(-1);
  };
  return (
    <div className={`quiz-card${done ? " done" : ""}`} data-testid="question">
      <div className="quiz-head">
        <span className="muted small">
          Question · {q.points} point{q.points === 1 ? "" : "s"}
        </span>
      </div>
      <Markdown md={promptMd} />
      {q.kind === "choice" && (
        <div className="quiz-choices">
          {q.choices.map((c) => (
            <label key={c} className="check">
              <input type="radio" name={q.id} disabled={done} checked={(done ? reply!.response : choice) === c} onChange={() => setChoice(c)} />
              <span className="notes-md inline" dangerouslySetInnerHTML={{ __html: renderMarkdown(c) }} />
            </label>
          ))}
        </div>
      )}
      {q.kind === "text" && <input className="quiz-text" value={done ? reply!.response : text} disabled={done} onChange={(e) => setText(e.target.value)} aria-label="Your answer" />}
      {q.kind === "long" &&
        (done ? (
          <div className="quiz-long-done" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reply!.response, { ALLOWED_TAGS: ["p", "br", "b", "i", "em", "strong", "ul", "ol", "li", "div", "u"], ALLOWED_ATTR: [] }) }} />
        ) : (
          <textarea className="quiz-long" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your answer" />
        ))}
      {q.kind === "blank" && (
        <div className="quiz-items">
          {items.map((v, i) => (
            <label key={i}>
              ({i + 1}){" "}
              <input
                value={done ? (JSON.parse(reply!.response || "[]")[i] ?? "") : v}
                disabled={done}
                onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
                aria-label={`Blank ${i + 1}`}
              />
            </label>
          ))}
        </div>
      )}
      {q.kind === "match" && (
        <div className="quiz-items">
          {q.choices.map((left, i) => (
            <label key={left}>
              <span className="notes-md inline" dangerouslySetInnerHTML={{ __html: renderMarkdown(left) }} />
              <select
                value={done ? (JSON.parse(reply!.response || "[]")[i] ?? "") : items[i]}
                disabled={done}
                onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
                aria-label={`Match for ${left}`}
              >
                <option value="">Choose…</option>
                {q.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {q.kind === "order" && (
        <ol className="quiz-order" data-testid="quiz-order">
          {shownOrder.map((line, i) => (
            <li key={`${i}:${line}`} className="quiz-order-row">
              <code className="quiz-order-line">{line}</code>
              <button type="button" className="quiz-order-btn" disabled={done || i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">
                ▲
              </button>
              <button type="button" className="quiz-order-btn" disabled={done || i === shownOrder.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">
                ▼
              </button>
            </li>
          ))}
        </ol>
      )}
      {q.kind === "bug" && (
        <div className="quiz-bug" data-testid="quiz-bug">
          {codeLines(q.prompt).map((line, i) => (
            <button
              key={i}
              type="button"
              className={`quiz-bug-line${shownBug === String(i + 1) ? " is-picked" : ""}`}
              disabled={done}
              onClick={() => setBugLine(String(i + 1))}
              aria-label={`Line ${i + 1}: ${line}`}
            >
              <span className="quiz-bug-num">{i + 1}</span>
              <code className="quiz-bug-code">{line || " "}</code>
            </button>
          ))}
        </div>
      )}
      {q.kind === "sort" && (
        <div className="quiz-sort" data-testid="quiz-sort">
          {["", ...q.answers.map(String)].map((group) =>
            // The tray, once answered with every item placed, says nothing.
            !group && done && shownPlaced.every((g) => g) ? null : (
              <div
                key={group || "tray"}
                className={`${group ? "quiz-sort-group" : "quiz-sort-tray"}${!done && picked >= 0 ? " is-target" : ""}`}
                onClick={() => put(group)}
                data-testid={group ? `sort-group-${group}` : "sort-tray"}
              >
                <div className="quiz-sort-head">{group || "Not sorted yet"}</div>
                <div className="quiz-sort-items">
                  {q.choices.map((item, i) =>
                    shownPlaced[i] === group ? (
                      <button
                        key={i}
                        type="button"
                        className={`quiz-sort-item${picked === i ? " is-picked" : ""}`}
                        disabled={done}
                        title="Click it, then click the group it belongs in"
                        onClick={(e) => {
                          e.stopPropagation();
                          // With another item picked, a click on an item in a
                          // different group puts it there: a group's box fills
                          // with items, and a click aimed at the box landed on
                          // one of them and only changed which was picked.
                          if (picked >= 0 && picked !== i && shownPlaced[picked] !== shownPlaced[i]) put(shownPlaced[i]!);
                          else setPicked(picked === i ? -1 : i);
                        }}
                      >
                        <span className="notes-md inline" dangerouslySetInnerHTML={{ __html: renderMarkdown(item) }} />
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
      {reply ? (
        <p className={`quiz-result ${reply.kind === "long" ? "" : reply.correct ? "right" : reply.earned > 0 ? "part" : "wrong"}`} data-testid="question-result">
          {reply.practice ? "Practice: " : ""}
          {reply.kind === "long"
            ? reply.graded
              ? `Marked: ${reply.earned} / ${reply.points}`
              : "Sent. Your teacher marks this one."
            : reply.correct
              ? `✓ Right — ${reply.earned} / ${reply.points}`
              : reply.earned > 0
                ? `Partly right — ${reply.earned} / ${reply.points}`
                : `✗ Not right — 0 / ${reply.points}`}
          {reply.practice && <span className="muted small"> (you set it, so it isn't kept)</span>}
        </p>
      ) : null}
      {!done && (
        <button className="btn small go" disabled={busy} onClick={() => void send()} data-testid="question-answer">
          {practice ? "Try it" : "Answer"} {practice ? "" : "(one try)"}
        </button>
      )}
      {problem && <p className="error-text">{problem}</p>}
    </div>
  );
}

/** A bug question's prompt without its code: the code is drawn as a button a line instead. */
function withoutCode(prompt: string): string {
  const lines = prompt.split("\n");
  let inner: string | null = null;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]!);
    if (!f) continue;
    if (inner === null) {
      inner = f[1]!;
      start = i;
    } else if (f[1]![0] === inner[0] && f[1]!.length >= inner.length) {
      return [...lines.slice(0, start), ...lines.slice(i + 1)].join("\n");
    }
  }
  return prompt;
}

// ---------------------------------------------------------------- tests

function TestsCard({ notes, assignment, project, runner, practice }: { notes: string; assignment: string; project: Project; runner: GameRunner | null; practice: boolean }) {
  // Every tests block in the notes is checked together, wherever this one is.
  const tests = useMemo(() => allTests(notes), [notes]);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const check = async () => {
    setResults(null);
    const r = await runTests(tests, project, runner, setRunning);
    setRunning(null);
    setResults(r);
    if (!practice)
      try {
        const kept = await api<{ xp?: number }>("/api/tests/self", { json: { assignment, results: r } });
        if (kept.xp) announceXp(kept.xp, "Tests passed");
      } catch {
        /* the result is still on screen; only the teacher's copy is lost */
      }
  };
  const passed = results?.filter((r) => r.ok).length ?? 0;
  return (
    <div className="tests-card" data-testid="tests">
      <div className="quiz-head">
        <b>Tests</b>
        <span className="muted small">
          {results ? `${passed} of ${tests.length} passing` : `${tests.length} to pass`}
        </span>
      </div>
      <ul className="tests-list">
        {tests.map((t, i) => {
          const r = results?.[i];
          return (
            <li key={t.label} className={r ? (r.ok ? "pass" : "fail") : running === i ? "running" : ""} data-testid="test-line">
              <span className="tests-mark">{r ? (r.ok ? "✓" : "✗") : running === i ? "…" : "○"}</span>
              <span>
                <code>{t.label}</code>
                {t.points !== 1 && <span className="muted small"> ({t.points} points)</span>}
                {r && !r.ok && r.detail && <span className="tests-why">{r.detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <button className="btn small go" disabled={running !== null} onClick={() => void check()} data-testid="check-my-work">
        {running !== null ? "Checking…" : "✔ Check my work"}
      </button>
      <p className="muted small">The checks that play your game play it in the game pane. Your teacher's Check all is the one that counts.</p>
    </div>
  );
}
