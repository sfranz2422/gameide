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
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../store/api";
import { allTests, runTests, type GameRunner, type TestResult } from "../checks/checks";
import type { Project } from "../store/project";
import { announceXp } from "../xp/runXp";
import { BLANK, parseQuiz, pieces, slides, type Question } from "./quiz";
import { Spotlight } from "../tutorials/TutorialPane";
import { takeHighlight } from "../tutorials/tutorial";

const SANITIZE = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["form", "input", "button", "textarea", "select", "option", "label", "fieldset"],
  FORBID_ATTR: ["style"],
};

export function renderMarkdown(md: string): string {
  const html = DOMPurify.sanitize(marked.parse(md ?? "", { breaks: true, async: false }) as string, SANITIZE) as string;
  // Links open in a new tab, and can't reach back into this one.
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

function Markdown({ md, className = "" }: { md: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(md), [md]);
  return <div className={`notes-md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
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
            <Markdown key={i} md={p.text} />
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
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!q.id) return <p className="banner error">This question isn't finished: it needs its answer and enough choices.</p>;

  const response = () => {
    if (q.kind === "choice") return choice;
    if (q.kind === "blank" || q.kind === "match") return JSON.stringify(items);
    if (q.kind === "long")
      // Paragraphs, escaped: the server cleans it again whatever is sent (quiz.clean_html).
      return text
        .split(/\n{2,}/)
        .map((para) => `<p>${para.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
        .join("");
    return text;
  };
  const send = async () => {
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
  })() : q.prompt;
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
