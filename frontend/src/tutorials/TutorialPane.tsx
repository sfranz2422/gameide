/**
 * A tutorial in the Notes tab: one step at a time, "Step 3 of 8", the step's
 * words and code (which can't be selected — typing it is the point), its
 * checks with ✔ Check my work, and Back / Next.
 *
 * STRICT, the teacher's decision: Next stays locked on a step with checks
 * until they pass — or until the student passed it before (their game
 * remembers how far they got, Project.tutorial). A header line of
 * `locked: no` lets a tutorial's author make it free to skip.
 *
 * A step can spotlight part of the editor (`highlight: folder-sprites`):
 * a ring around it, and the rest of the page dimmed a little, gone at the
 * first click anywhere — it points, it never blocks.
 *
 * A lesson that checks what was printed (Python Basics) shows the Console's
 * last lines under each step. The Console is a tab beside this one, so
 * without it a beginner reading "look in the Console" had to leave the
 * lesson to see their output, and find the way back, after every Play.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../store/api";
import { readCheck, runTests, type GameRunner, type TestResult } from "../checks/checks";
import type { ConsoleLine } from "../editor/RunPanes";
import type { Project, TutorialProgress } from "../store/project";
import { pieces } from "../notes/quiz";
import { renderMarkdown } from "../notes/NotesPane";
import { announceXp } from "../xp/runXp";
import { parseTutorial } from "./tutorial";

export interface TutorialPaneProps {
  md: string;
  progress: TutorialProgress;
  /** Saves how far they've got into the game (null: nowhere to save — someone else's game). */
  onProgress: ((p: TutorialProgress) => void) | null;
  project: Project;
  runner: GameRunner | null;
  /** Signed in as a student: steps passed earn XP (backend/tutorials.py). */
  earns: boolean;
  /** The Console's lines, shown under the step in a lesson with `prints` checks. */
  output?: ConsoleLine[];
}

/** How many of the Console's last lines the lesson shows. */
const OUTPUT_LINES = 8;

export function TutorialPane({ md, progress, onProgress, project, runner, earns, output }: TutorialPaneProps) {
  const t = useMemo(() => parseTutorial(md), [md]);
  const printing = useMemo(() => t.steps.some((s) => s.checks.some((c) => readCheck(c.label).kind === "prints")), [t]);
  const last = Math.max(0, t.steps.length - 1);
  const [at, setAt] = useState(() => Math.min(progress.step, last));
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [spot, setSpot] = useState(true);
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setResults(null);
    setSpot(true);
    // A new step starts at its top. Next is at the bottom of a long step, and
    // the next one opened scrolled just as far down: the student saw its end,
    // or its checks, and not what to do.
    for (let el: HTMLElement | null = paneRef.current; el; el = el.parentElement) if (el.scrollTop) el.scrollTop = 0;
  }, [at]);
  const hideSpot = useCallback(() => setSpot(false), []);
  const step = t.steps[at];
  if (!step) return <p className="muted">This tutorial has no steps yet.</p>;

  const passedNow = !!results && results.every((r) => r.ok);
  const open = !t.meta.locked || !step.checks.length || at < progress.step || passedNow;

  const reach = (n: number) => {
    // How far they've got only ever grows: going Back to read again loses nothing.
    if (n > progress.step && onProgress) onProgress({ ...progress, step: Math.min(n, t.steps.length), steps: t.steps.length, title: t.meta.title });
  };
  const claim = (n: number) => {
    if (!earns) return;
    void api<{ xp: number }>("/api/tutorials/step", { json: { key: progress.key, step: n } }).then(
      (r) => r.xp && announceXp(r.xp, n === last ? "Tutorial finished" : "Tutorial step done"),
      () => undefined,
    );
  };
  const check = async () => {
    setResults(null);
    const r = await runTests(step.checks, project, runner, setRunning);
    setRunning(null);
    setResults(r);
    if (r.every((x) => x.ok)) {
      reach(at + 1);
      claim(at);
    }
  };
  const next = () => {
    if (!step.checks.length) reach(at + 1);
    const to = Math.min(at + 1, last);
    // The last step finishes the tutorial on arriving — unless it has checks, which finish it when they pass.
    if (to === last && !t.steps[last]!.checks.length) {
      reach(t.steps.length);
      claim(last);
    }
    setAt(to);
  };
  const done = progress.step >= t.steps.length;

  return (
    <div className="tutorial-pane" data-testid="tutorial-pane" ref={paneRef}>
      <div className="tutorial-head">
        <b>{t.meta.title}</b>
        <span className="muted small" data-testid="tutorial-step">
          Step {at + 1} of {t.steps.length}
          {done ? " · finished ✓" : ""}
        </span>
      </div>
      <div className="tutorial-bar" aria-hidden="true">
        {t.steps.map((_, i) => (
          <span key={i} className={i < progress.step ? "done" : i === at ? "here" : ""} />
        ))}
      </div>
      <div className="notes-body">
        {pieces(step.md, ["check"]).map((p, i) =>
          p.type === "md" ? <div key={i} className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.text) }} /> : null,
        )}
      </div>
      {printing && output && (
        <div className="console tutorial-console" data-testid="tutorial-console" aria-label="Console">
          <span className="muted small">Console</span>
          {output.length === 0 && <pre className="line info">Press Play to run your code.</pre>}
          {output.slice(-OUTPUT_LINES).map((l, i) =>
            l.kind === "error" ? (
              <pre key={i} className="line err">{l.error.message}</pre>
            ) : (
              <pre key={i} className={`line ${l.kind}`}>{l.text}</pre>
            ),
          )}
        </div>
      )}
      {step.checks.length > 0 && (
        <div className="tests-card" data-testid="tutorial-checks">
          <ul className="tests-list">
            {step.checks.map((c, i) => {
              const r = results?.[i];
              return (
                <li key={c.label} className={r ? (r.ok ? "pass" : "fail") : running === i ? "running" : ""} data-testid="test-line">
                  <span className="tests-mark">{r ? (r.ok ? "✓" : "✗") : running === i ? "…" : at < progress.step ? "✓" : "○"}</span>
                  <span>
                    <code>{c.label}</code>
                    {r && !r.ok && r.detail && <span className="tests-why">{r.detail}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          <button className="btn small go" disabled={running !== null} onClick={() => void check()} data-testid="check-my-work">
            {running !== null ? "Checking…" : "✔ Check my work"}
          </button>
        </div>
      )}
      <div className="tutorial-nav">
        <button className="btn small" disabled={at === 0} onClick={() => setAt(at - 1)} data-testid="tutorial-back">
          ← Back
        </button>
        <span className="spacer" />
        {at < last && (
          <button
            className={`btn small ${open ? "go" : ""}`}
            disabled={!open}
            onClick={next}
            title={open ? undefined : "Pass this step's checks first: press ✔ Check my work"}
            data-testid="tutorial-next"
          >
            Next →
          </button>
        )}
      </div>
      {step.highlight && spot && <Spotlight target={step.highlight} onDone={hideSpot} />}
    </div>
  );
}

/** A ring round `[data-tutorial=target]`, following it as the page moves; gone at the first click. */
export function Spotlight({ target, onDone }: { target: string; onDone: () => void }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    let frame = 0;
    const find = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-tutorial="${CSS.escape(target)}"]`)].find((e) => e.offsetParent !== null);
      const r = el?.getBoundingClientRect() ?? null;
      setBox((b) => (r && b && r.x === b.x && r.y === b.y && r.width === b.width && r.height === b.height ? b : r));
      frame = requestAnimationFrame(find);
    };
    find();
    // Any click anywhere: they've seen it. Captured, so it never stops the click itself.
    const off = () => onDone();
    window.addEventListener("pointerdown", off, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", off, true);
    };
  }, [target, onDone]);
  if (!box) return null;
  const pad = 6;
  return createPortal(
    <div
      className="spotlight"
      data-testid="spotlight"
      data-target={target}
      style={{ left: box.x - pad, top: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 }}
      aria-hidden="true"
    />,
    document.body,
  );
}
