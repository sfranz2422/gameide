/**
 * The teacher's side of an assignment's notes, on its results page:
 *
 *   NotesEditor  write the notes — markdown, `---` for slides, ```quiz
 *                questions, ```tests — with the students' view beside it
 *   CheckAll     run the tests on what every student turned in, in a game
 *                hidden on this page, and send each result: the one that
 *                counts toward the grade (backend/notes.py, tests_verify)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../store/api";
import { GameHost } from "../editor/gameHost";
import { buildGame } from "../python/codegen";
import { ViewStore } from "../store/viewStore";
import { loadAssets } from "../store/store";
import { allTests, readCheck, runTests } from "../checks/checks";
import { hostRunner, type HostWatch } from "../checks/hostRunner";
import type { GameState } from "../python/protocol";
import { pieces, parseQuiz, slides } from "./quiz";
import { renderMarkdown } from "./NotesPane";

const EXAMPLE = `# Collect the coins

Make the player move with the arrow keys, and pick up every coin.

---

## A question

\`\`\`quiz
Which function says whether a key is held down?
- [x] keyboard_check
- [ ] keyboard_check_pressed
- [ ] key_down
\`\`\`

---

## Checks

\`\`\`tests
object Player exists
Player has event step
Player.step uses keyboard_check
after 1 second holding right, Player.x increased (2 points)
\`\`\`
`;

export function NotesEditor({ slug, notes, onSaved }: { slug: string; notes: string; onSaved: () => void }) {
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(notes);
    setSaved(notes);
  }, [notes]);
  const deck = useMemo(() => slides(text), [text]);
  const parts = useMemo(() => pieces(text), [text]);
  const questions = parts.filter((p) => p.type === "quiz").length;
  const unknown = useMemo(() => allTests(text).filter((t) => readCheck(t.label).kind === "unknown"), [text]);
  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/assignments/${slug}/notes`, { json: { notes: text } });
      setSaved(text);
      onSaved();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="class-section notes-editor" data-testid="notes-editor">
      <h2>Notes</h2>
      <p className="muted small">
        What students see in their editor's Notes tab. Markdown; a line of <code>---</code> starts a new slide. A <code>```quiz</code> block is a question (one try,
        marked at once); a <code>```tests</code> block is checks their game must pass. The answers never leave the server.
      </p>
      <div className="notes-editor-cols">
        <div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} spellCheck={false} aria-label="Notes" data-testid="notes-source" />
          <div className="row">
            <button className="btn go" disabled={busy || text === saved} onClick={() => void save()} data-testid="notes-save">
              {text === saved ? "Saved" : "Save notes"}
            </button>
            {!text.trim() && (
              <button className="btn small" onClick={() => setText(EXAMPLE)}>
                Start from an example
              </button>
            )}
            <span className="muted small">
              {deck.length ? `${deck.length} slides · ` : ""}
              {questions} question{questions === 1 ? "" : "s"} · {allTests(text).length} test{allTests(text).length === 1 ? "" : "s"}
            </span>
          </div>
          {unknown.length > 0 && (
            <p className="banner warn small">
              GameIDE can't read {unknown.length === 1 ? "this check" : "these checks"}: {unknown.map((t) => `"${t.label}"`).join(", ")}. See{" "}
              <a href="#/help/checks">the checks it knows</a>.
            </p>
          )}
          {problem && <p className="error-text">{problem}</p>}
        </div>
        <div className="notes-preview" aria-label="What students see">
          {parts.map((p, i) =>
            p.type === "md" ? (
              <div key={i} className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.text) }} />
            ) : p.type === "quiz" ? (
              <div key={i} className="quiz-card">
                <span className="muted small">Question · {parseQuiz(p.body).points} point(s) · {parseQuiz(p.body).kind}</span>
                <div className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(parseQuiz(p.body).prompt) }} />
              </div>
            ) : (
              <div key={i} className="tests-card">
                <b>Tests</b>
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
      </div>
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
