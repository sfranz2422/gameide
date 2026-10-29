/**
 * The teacher's side of an assignment's notes, on its results page:
 *
 *   TutorialBox  which library tutorial its notes are, what students see,
 *                and the way to edit it (the library, the only place)
 *   CheckAll     run the tests on what every student turned in, in a game
 *                hidden on this page, and send each result: the one that
 *                counts toward the grade (backend/notes.py, tests_verify)
 */
import { useMemo, useRef, useState } from "react";
import { api } from "../store/api";
import { GameHost } from "../editor/gameHost";
import { buildGame } from "../python/codegen";
import { ViewStore } from "../store/viewStore";
import { loadAssets } from "../store/store";
import { allTests, readCheck, runTests } from "../checks/checks";
import { hostRunner, type HostWatch } from "../checks/hostRunner";
import type { GameState } from "../python/protocol";
import { pieces, parseQuiz, slides, takeAnimate } from "./quiz";
import { FlipCards, renderMarkdown } from "./NotesPane";
import { isTutorial, splitHeader, takeHighlight, unknownHighlights } from "../tutorials/tutorial";

/** An assignment's tutorial, as library.py says (GET /api/assignments/<slug>). */
export interface LinkedTutorial {
  slug: string;
  title: string;
  /** Other assignments using it: editing it changes them too. */
  others: number;
  origin: string;
}

/**
 * The assignment's tutorial: which one it is, what students see, and the
 * way to the library — the only place a tutorial's text is edited (the
 * teacher's call: no second editor, so nothing overwrites it). Its checks
 * and spotlights are read here, by GameIDE's own reader, because the
 * library's editor (PresMaker) doesn't know GameIDE's words.
 */
export function TutorialBox({ slug, notes, tutorial, choices, onChanged }: {
  slug: string;
  notes: string;
  tutorial: LinkedTutorial | null;
  choices: { slug: string; title: string }[];
  onChanged: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const text = notes;
  // A tutorial's header (title:, level:…) is how it's listed, not something
  // students read; its ```check lines are its tests, as much as ```tests ones.
  const body = useMemo(() => (isTutorial(text) ? splitHeader(text).body : text), [text]);
  const deck = useMemo(() => slides(body), [body]);
  // The whole notes at once, as written: an `animate:` line is how they play, not something to show.
  const parts = useMemo(() => pieces(takeHighlight(takeAnimate(body).body).md, ["tests", "check"]), [body]);
  const badSpots = useMemo(() => unknownHighlights(text), [text]);
  const questions = parts.filter((p) => p.type === "quiz").length;
  const tests = useMemo(() => [...allTests(text), ...allTests(text, "check")], [text]);
  const unknown = tests.filter((t) => readCheck(t.label).kind === "unknown");
  const act = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await f();
      onChanged();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const link = (to: string) => act(() => api(`/api/library/${to}/link`, { json: { link: [slug] } }));
  const unlink = () =>
    confirm("Unlink it? Its notes stay as they are now, as this assignment's own, and changes to the tutorial won't reach it any more.") &&
    void act(() => api(`/api/library/${tutorial!.slug}/link`, { json: { unlink: [slug] } }));
  const fresh = () =>
    void act(async () => {
      const r = await api<{ slug: string }>("/api/library", { json: { title: "Notes", body: "# Notes\n\n", linkTo: slug } });
      location.href = `/teacher/tutorials/${r.slug}/edit`;
    });
  return (
    <section className="class-section notes-editor tutorial-box" data-testid="notes-editor">
      <h2>Tutorial</h2>
      {tutorial ? (
        <p data-testid="tutorial-which">
          <b>{tutorial.title}</b>
          {tutorial.origin.startsWith("builtin:") && <span className="muted"> (from a built-in tutorial)</span>}
          {tutorial.others > 0 && (
            <span className="muted">
              {" "}
              · also in {tutorial.others} other assignment{tutorial.others === 1 ? "" : "s"}: editing it changes them all
            </span>
          )}
        </p>
      ) : (
        <p className="muted" data-testid="tutorial-which">
          {text.trim() ? "Its notes are its own (not linked to a tutorial)." : "No tutorial yet: students get no notes."}
        </p>
      )}
      <div className="row">
        {tutorial ? (
          <a className="btn go" href={`/teacher/tutorials/${tutorial.slug}/edit`} data-testid="tutorial-edit">
            Edit in library
          </a>
        ) : (
          <button className="btn go" disabled={busy} onClick={fresh} data-testid="tutorial-new">
            New tutorial
          </button>
        )}
        <select
          className="small-select"
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && void link(e.target.value)}
          aria-label={tutorial ? "Use another tutorial" : "Use a tutorial from the library"}
          data-testid="tutorial-choose"
        >
          <option value="">{tutorial ? "Use another…" : "Use one from the library…"}</option>
          {choices
            .filter((c) => c.slug !== tutorial?.slug)
            .map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title}
              </option>
            ))}
        </select>
        {tutorial && (
          <button className="btn small" disabled={busy} onClick={unlink} data-testid="tutorial-unlink"
            title="Keep the notes as they are now, as this assignment's own: changes to the tutorial won't reach it">
            Unlink
          </button>
        )}
        <a className="btn small" href="#/library">
          All tutorials
        </a>
        <span className="muted small">
          {deck.length ? `${deck.length} slides · ` : ""}
          {questions} question{questions === 1 ? "" : "s"} · {tests.length} test{tests.length === 1 ? "" : "s"}
        </span>
      </div>
      {unknown.length > 0 && (
        <p className="banner warn small">
          GameIDE can't read {unknown.length === 1 ? "this check" : "these checks"}: {unknown.map((t) => `"${t.label}"`).join(", ")}. See{" "}
          <a href="#/help/checks">the checks it knows</a>.
        </p>
      )}
      {badSpots.length > 0 && (
        <p className="banner warn small" data-testid="notes-bad-highlight">
          There's nothing called {badSpots.map((h) => `"${h}"`).join(", ")} to spotlight. See <a href="#/help/checks">the names</a>.
        </p>
      )}
      {problem && <p className="error-text">{problem}</p>}
      {text.trim() && (
        <div className="notes-preview" aria-label="What students see">
          {parts.map((p, i) =>
            p.type === "md" ? (
              <div key={i} className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.text) }} />
            ) : p.type === "quiz" ? (
              <div key={i} className="quiz-card">
                <span className="muted small">Question · {parseQuiz(p.body).points} point(s) · {parseQuiz(p.body).kind}</span>
                <div className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(parseQuiz(p.body).prompt) }} />
              </div>
            ) : p.type === "cards" ? (
              <FlipCards key={i} body={p.body} />
            ) : (
              <div key={i} className="tests-card">
                <b>{p.type === "tests" && p.kind === "check" ? "Checks — Next waits for these" : "Tests"}</b>
                <ul className="tests-list">
                  {allTests("```tests\n" + p.body + "\n```").map((t) => (
                    <li key={t.label} className={readCheck(t.label).kind === "unknown" ? "fail" : ""}>
                      <span className="tests-mark">{readCheck(t.label).kind === "unknown" ? "?" : "○"}</span>
                      <code>{t.label}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

interface Work {
  student: number;
  name: string;
  project: string;
  version: number;
}

/**
 * Check all: every frozen version (turned in, or frozen by a score) is
 * opened read only and its tests run in a game hidden on this page, one
 * student at a time; each result goes to the server as it comes.
 */
export function CheckAll({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const run = async () => {
    setBusy(true);
    const watch: HostWatch & { now: GameState } = { now: "stopped", state: () => watch.now, errors: [] };
    const host = new GameHost({
      state: (s) => (watch.now = s),
      output: () => undefined,
      error: (e) => watch.errors.push(e.message),
      stats: () => undefined,
      ready: () => undefined,
    });
    host.container = box.current;
    try {
      const { work, tests } = await api<{ work: Work[]; tests: { label: string; points: number }[] }>(`/api/assignments/${slug}/tests/work`);
      if (!tests.length) return setStatus("There are no tests in the notes to check.");
      if (!work.length) return setStatus("Nobody has turned anything in yet.");
      let done = 0;
      for (const w of work) {
        setStatus(`Checking ${w.name}'s game (${done + 1} of ${work.length})…`);
        const store = new ViewStore(w.project, w.version);
        const project = await store.load(w.project);
        if (!project) continue;
        const assets = await loadAssets(store, project);
        const runner = hostRunner(host, () => buildGame(project, assets).def, watch);
        const results = await runTests(tests, project, runner);
        await api(`/api/assignments/${slug}/tests/verify`, { json: { student: w.student, results } });
        done++;
        onDone();
      }
      setStatus(`Checked ${done} game${done === 1 ? "" : "s"}. The tests' points are in each total.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      host.dispose();
      setBusy(false);
    }
  };
  return (
    <span className="check-all">
      <button className="btn small go" disabled={busy} onClick={() => void run()} data-testid="check-all" title="Runs the notes' tests on what each student turned in. This result counts toward the grade.">
        {busy ? "Checking…" : "✔ Check all"}
      </button>
      {status && (
        <span className="muted small" data-testid="check-all-status">
          {status}
        </span>
      )}
      {/* The hidden game the checks play in: on the page (a canvas needs one), out of sight. */}
      <div ref={box} className="check-all-game" aria-hidden="true" />
    </span>
  );
}
