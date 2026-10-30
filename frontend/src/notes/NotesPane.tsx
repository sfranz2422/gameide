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
import { pythonLanguage } from "@codemirror/lang-python";
import { highlightCode, tagHighlighter, tags as t } from "@lezer/highlight";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../store/api";
import { allTests, runTests, type GameRunner, type TestResult } from "../checks/checks";
import type { Project } from "../store/project";
import { announceXp } from "../xp/runXp";
import { BLANK, codeLines, fnv, parseCards, parseQuiz, PAUSE, pauseLines, pieces, popBoxes, popMarks, sections, slides, takeAnimate, type Piece, type Question, type Speed } from "./quiz";
import { animateIn, type Finish } from "./reveal";
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
  // `...` (a section divider) is never shown, and `:::pop` … `:::` becomes a box (quiz.ts, popMarks).
  const raw = (marked.parse(pauseLines(popMarks(sections(md ?? "").join("\n\n"))), { breaks: true, async: false }) as string).replace(
    /<input\b[^>]*type="checkbox"[^>]*>/g,
    (tag) => `<span class="task-box" data-done="${/\bchecked\b/.test(tag) ? "1" : "0"}"></span>`,
  );
  const html = colourCode(markPauses(popBoxes(DOMPurify.sanitize(raw, SANITIZE) as string)));
  // Links open in a new tab, and can't reach back into this one.
  // A lesson's pictures (tutorials/art/) are for importing: the link saves the
  // file, where a plain link opened it in a tab to be saved by hand.
  return html.replace(/<a href="(tutorials\/art\/[^"]+)"/g, '<a download href="$1"').replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

/**
 * Python to type, coloured the way the student's editor colours it
 * (CodeEditor.tsx's highlight, the same --syn-* colours), and marked
 * type-this so it stands out from the words around it. Black text in a
 * black box was hard to read, and nothing in it matched what appears in the
 * editor as they type. A block in another language is left plain.
 */
const SYNTAX = tagHighlighter([
  { tag: [t.keyword, t.definitionKeyword, t.controlKeyword, t.operatorKeyword], class: "syn-keyword" },
  { tag: [t.string, t.special(t.string)], class: "syn-string" },
  { tag: [t.number, t.bool, t.null], class: "syn-number" },
  { tag: t.comment, class: "syn-comment" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: "syn-function" },
  { tag: t.self, class: "syn-self" },
  { tag: t.propertyName, class: "syn-property" },
  { tag: [t.className, t.definition(t.variableName)], class: "syn-class" },
]);

export function colourCode(html: string): string {
  if (!html.includes("language-python") || typeof document === "undefined") return html;
  const box = document.createElement("template");
  box.innerHTML = html;
  for (const code of box.content.querySelectorAll<HTMLElement>("pre > code.language-python")) {
    const text = code.textContent ?? "";
    code.textContent = "";
    highlightCode(
      text,
      pythonLanguage.parser.parse(text),
      SYNTAX,
      (piece, classes) => {
        if (!classes) return void code.append(piece);
        const span = document.createElement("span");
        span.className = classes;
        span.textContent = piece;
        code.append(span);
      },
      () => code.append("\n"),
    );
    code.parentElement!.classList.add("type-this");
  }
  return box.innerHTML;
}

/**
 * Each `^` pause (quiz.ts, pauseLines) as an empty span.reveal-pause, which
 * CSS hides and reveal.ts waits at — never inside code or a question.
 */
function markPauses(html: string): string {
  if (!html.includes("^") || typeof document === "undefined") return html;
  const box = document.createElement("template");
  box.innerHTML = html;
  const walk = document.createTreeWalker(box.content, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeValue?.includes("^") && !n.parentElement?.closest("code, pre, textarea")) hits.push(n as Text);
  }
  for (const n of hits) {
    const text = n.nodeValue ?? "";
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(PAUSE)) {
      const at = m.index! + m[1]!.length;
      frag.appendChild(document.createTextNode(text.slice(last, at)));
      const span = document.createElement("span");
      span.className = "reveal-pause";
      span.dataset.beats = String(m[2]!.length);
      frag.appendChild(span);
      last = at + m[2]!.length;
    }
    if (!last) continue;
    frag.appendChild(document.createTextNode(text.slice(last)));
    n.replaceWith(frag);
  }
  return box.innerHTML;
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
export function FlipCards({ body }: { body: string }) {
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

export interface Reply {
  kind?: string;
  /** A predict question's real output, once it's answered (notes.py, _answer_reply). */
  output?: string;
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
  const head = useMemo(() => takeAnimate(notes), [notes]);
  // What's turned through: the slides, or the notes whole when they have none.
  const pages = deck.length ? deck : [head.body];
  const mode = head.animate;
  const speed = head.speed;
  const key = `gameide-slide:${assignment}`;

  /* PLAYED A SECTION AT A TIME (`animate:` at the top of the notes; notes.js
     slideView does the same in the other editors). The slide starts empty
     with ▶ Play above it; each press plays the next section (`...` divides
     them), and the next slide's arrow waits until all of this one has been
     played. Slides already played show whole and never replay: how far
     they've got (`reached`) is kept in this browser. The teacher's copy is
     kept apart and has ⏭ Skip, to see the slide without sitting through it;
     a student has no Skip. */
  const revealKey = `gameide-reveal:${practice ? "author:" : ""}${assignment}`;
  const [reached, setReached] = useState<{ slide: number; played: number }>(() => {
    try {
      const got = JSON.parse(localStorage.getItem(revealKey) ?? "null");
      if (got && got.slide >= 0 && got.played >= 0) return { slide: Number(got.slide), played: Number(got.played) };
    } catch {
      /* none kept */
    }
    return { slide: 0, played: 0 };
  });
  const reach = (r: { slide: number; played: number }) => {
    setReached(r);
    try {
      localStorage.setItem(revealKey, JSON.stringify(r));
    } catch {
      /* this visit only */
    }
  };
  const [busy, setBusy] = useState(false);
  const finish = useRef<Finish | null>(null);
  // Notes changed under a section that was playing: it's gone, and Play must come back.
  useEffect(() => setBusy(false), [notes]);

  const [at, setAt] = useState(() => {
    // Opened where they got to, when the notes play.
    if (takeAnimate(notes).animate) return reached.slide;
    try {
      return Number(localStorage.getItem(key) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  const here = Math.max(0, Math.min(at, pages.length - 1));
  const go = (n: number) => {
    const to = Math.max(0, Math.min(deck.length - 1, n));
    // Onto the slide after the furthest one reached: it's the new furthest, unplayed.
    if (mode && to > here && here === reached.slide) reach({ slide: to, played: 0 });
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
  const { md: shown, highlight } = takeHighlight(pages[here]!);
  const [spot, setSpot] = useState(true);
  useEffect(() => setSpot(true), [at, highlight]);
  // A new slide starts at its top (as a tutorial's step does: TutorialPane.tsx).
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    for (let el: HTMLElement | null = paneRef.current; el; el = el.parentElement) if (el.scrollTop) el.scrollTop = 0;
  }, [here]);
  const hideSpot = useCallback(() => setSpot(false), []);

  const parts = useMemo(() => sections(shown), [shown]);
  const played = !mode ? parts.length : here < reached.slide ? parts.length : here === reached.slide ? Math.min(reached.played, parts.length) : 0;
  const more = !!mode && here === reached.slide && played < parts.length;
  // This slide still has sections to play: the way on waits.
  const unfinished = !!mode && here >= reached.slide && played < parts.length;
  const playNext = () => {
    if (busy || !more) return;
    setBusy(true);
    reach({ slide: here, played: played + 1 });
  };
  /* The teacher only: this slide unplayed again. Without it a slide once
     played showed whole for good, so a change to it could never be watched. */
  const replay = () => {
    if (!busy) reach({ slide: here, played: 0 });
  };
  const skip = () => {
    if (busy) finish.current?.();
    else if (more) reach({ slide: here, played: parts.length });
  };
  const piece = (p: Piece, i: number) =>
    p.type === "md" ? (
      <Markdown key={i} md={p.text} tasks={assignment} />
    ) : p.type === "cards" ? (
      <FlipCards key={i} body={p.body} />
    ) : p.type === "quiz" ? (
      <QuestionCard key={i} q={parseQuiz(p.body)} assignment={assignment} reply={mine[parseQuiz(p.body).id]} onAnswer={answered} practice={practice} />
    ) : (
      <TestsCard key={i} notes={notes} assignment={assignment} project={project} runner={runner} practice={practice} />
    );
  return (
    <div className="notes-pane" data-testid="notes-pane" ref={paneRef}>
      {deck.length > 0 && (
        <div className="notes-slides-bar">
          <button className="btn small" disabled={here <= 0 || busy} onClick={() => go(here - 1)} aria-label="Previous slide">
            ←
          </button>
          <span className="muted small" data-testid="slide-count">
            {here + 1} / {deck.length}
          </span>
          <button
            className="btn small"
            disabled={here >= deck.length - 1 || unfinished || busy}
            onClick={() => go(here + 1)}
            aria-label="Next slide"
            title={unfinished ? "Play the rest of this slide first" : "Next slide"}
            data-testid="slide-next"
          >
            →
          </button>
        </div>
      )}
      {mode && (
        <div className="reveal-bar" data-testid="reveal-bar">
          {more && (
            <button className="btn primary reveal-play" disabled={busy} onClick={playNext} data-testid="reveal-play">
              {played ? "▶ Play more" : "▶ Play"}
            </button>
          )}
          {practice && (busy || more) && (
            <button className="btn reveal-skip" onClick={skip} title="Show it now — students don't get this button" data-testid="reveal-skip">
              ⏭ Skip
            </button>
          )}
          {practice && !busy && played > 0 && (
            <button className="btn reveal-replay" onClick={replay} title="Play this slide again from the start" data-testid="reveal-replay">
              ↺ Replay
            </button>
          )}
          <span className="muted small reveal-hint">
            {busy ? "" : more ? (parts.length > 1 ? `Part ${played + 1} of ${parts.length}` : "") : deck.length && here < deck.length - 1 ? "Done — on to the next slide →" : "Done"}
          </span>
        </div>
      )}
      {highlight && spot && <Spotlight target={highlight} onDone={hideSpot} />}
      <div className="notes-body">
        {!mode ? (
          pieces(shown).map(piece)
        ) : played === 0 ? (
          <p className="reveal-start muted">Press ▶ Play to start this slide.</p>
        ) : (
          parts.slice(0, played).map((sec, i) => (
            <Section
              key={`${here}:${i}`}
              how={busy && i === played - 1 ? mode : ""}
              speed={speed}
              onFinish={(f) => (finish.current = f)}
              onPlayed={() => setBusy(false)}
            >
              {pieces(sec).map(piece)}
            </Section>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * One section of played notes. The one just played animates in (reveal.ts)
 * as it first appears — before the browser paints it, so it's never seen
 * whole and then hidden; the rest are simply there.
 */
function Section({ how, speed, onFinish, onPlayed, children }: { how: "" | "words" | "type"; speed: Speed; onFinish: (f: Finish) => void; onPlayed: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef({ how, speed, onFinish, onPlayed });
  useLayoutEffect(() => {
    const { how, speed, onFinish, onPlayed } = first.current;
    if (!how || !ref.current) return;
    let gone = false;
    let stop: Finish | null = null;
    void animateIn(ref.current, how, (f) => {
      stop = f;
      onFinish(f);
    }, speed).then(() => {
      if (!gone) onPlayed();
    });
    // Taken away mid-play (or React's development double run): show it all,
    // and leave Play to whoever is drawn next.
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return (
    <div ref={ref} className="reveal-part">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- questions

/**
 * One question. With an assignment, the answer goes to it: marked against the
 * key kept from its notes, one try, counted. Without one (a tutorial played on
 * its own), `block` is the question whole and is marked as practice
 * (/api/quiz/practice): any number of tries, counted nowhere.
 */
export function QuestionCard({ q: asWritten, assignment, block, reply, onAnswer, practice }: { q: Question; assignment: string | null; block?: string; reply?: Reply; onAnswer: (qid: string, r: Reply) => void; practice: boolean }) {
  // Unassigned, nothing has given it an id (the server adds one as it hides the key).
  const q = !asWritten.id && !assignment && block ? { ...asWritten, id: `p${fnv(block)}` } : asWritten;
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
    if (q.kind === "predict" && !text.trim()) return setProblem("Type what you think it will print first.");
    setBusy(true);
    setProblem(null);
    try {
      const r = assignment
        ? await api<Reply>("/api/quiz/answer", { json: { assignment, question: q.id, response: response() } })
        : await api<Reply>("/api/quiz/practice", { json: { block, response: response() } });
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
      {q.kind === "predict" && (
        <textarea
          className="quiz-long quiz-predict"
          rows={3}
          value={done ? reply!.response : text}
          disabled={done}
          onChange={(e) => setText(e.target.value)}
          placeholder="What will it print?"
          aria-label="What it will print"
        />
      )}
      {q.kind === "predict" && reply?.output !== undefined && (
        <div className="quiz-predict-output" data-testid="predict-output">
          <span className="muted small">It prints:</span>
          <pre>{reply?.output}</pre>
        </div>
      )}
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
          {reply.practice && <span className="muted small">{assignment ? " (you set it, so it isn't kept)" : " (not counted: try it as often as you like)"}</span>}
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
