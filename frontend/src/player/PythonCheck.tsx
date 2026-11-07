/**
 * A showcase game's Python check, over the game: when the server says one is
 * due, the game is held and a question asked, in any of the notes' self-marked
 * kinds. Right, and the game goes on. Wrong, and it says why and asks another.
 * Three wrong in a row (the server counts), and they're out for a while.
 *
 * Everything that matters is decided by the server (backend/pycheck.py): when
 * one is due, whether it's right, and whether they may play. Reloading this
 * page changes none of them.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameHost } from "../editor/gameHost";
import { QuestionCard, type Reply } from "../notes/NotesPane";
import { parseQuiz } from "../notes/quiz";
import { api } from "../store/api";

/** The longest a question waits for the game to say it's a fair moment. */
export const QUESTION_WAIT_MS = 15_000;

interface Start { every: number; dueIn: number; locked: number; practice: boolean; strikes: number }
interface Answered extends Reply { rightAnswer?: string; explain?: string; strikes?: number; strikesOut?: number; locked?: number }

type View =
  | { kind: "playing" }
  | { kind: "question"; block: string; n: number; reply: Answered | null }
  | { kind: "out"; left: number };

export default function PythonCheck({ slug, host }: { slug: string; host: GameHost }) {
  const [view, setView] = useState<View>({ kind: "playing" });
  const [note, setNote] = useState<string | null>(null);
  const [practice, setPractice] = useState(false);
  const every = useRef(300);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef(0);
  const base = `/api/play/${encodeURIComponent(slug)}/check`;

  const ask = useCallback(async () => {
    try {
      const q = await api<{ block: string }>(`${base}/next`, { json: {} });
      // Not in the middle of a jump: the game says when stopping is fair (question_ok),
      // and after QUESTION_WAIT_MS it's asked anyway, so no game can put it off for ever.
      await host.whenQuestionOk(QUESTION_WAIT_MS);
      host.holdForQuestion(true);
      setView({ kind: "question", block: q.block, n: ++asked.current, reply: null });
    } catch {
      // Not quite time by the server's clock, or a bad connection: try again shortly, game held or not.
      timer.current = setTimeout(() => void ask(), 3000);
    }
  }, [base, host]);

  const wait = useCallback((seconds: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void ask(), seconds * 1000);
  }, [ask]);

  useEffect(() => {
    void api<Start>(`${base}/start`, { json: {} }).then((s) => {
      every.current = s.every;
      setPractice(s.practice);
      if (s.locked) {
        host.holdForQuestion(true);
        setView({ kind: "out", left: s.locked });
      } else {
        wait(s.dueIn);
      }
    }, (e: Error) => setNote(e.message));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Out: counts down, then the page starts afresh, and the server decides.
  useEffect(() => {
    if (view.kind !== "out") return;
    if (view.left <= 0) {
      location.reload();
      return;
    }
    const t = setTimeout(() => setView({ kind: "out", left: view.left - 1 }), 1000);
    return () => clearTimeout(t);
  }, [view]);

  if (note) return <p className="player-check-note">{note}</p>;
  if (view.kind === "playing") return null;
  if (view.kind === "out") {
    return (
      <div className="player-check" data-testid="check-out">
        <div className="player-check-card">
          <h2>Too many wrong in a row</h2>
          <p>Time to look over what you've been learning. You can play again in {view.left} seconds.</p>
          <a className="btn" href="/#/tutorials">Go to the lessons</a>
        </div>
      </div>
    );
  }
  const reply = view.reply;
  const carryOn = () => {
    host.holdForQuestion(false);
    setView({ kind: "playing" });
    wait(every.current);
  };
  return (
    <div className="player-check" data-testid="python-check">
      <div className="player-check-card">
        <h2>Python check{practice ? " (practice)" : ""}</h2>
        <p className="muted small">Answer to keep playing.</p>
        <QuestionCard
          key={view.n}
          q={parseQuiz(view.block)}
          assignment={null}
          block={view.block}
          reply={reply ?? undefined}
          practice={false}
          onAnswer={(_id: string, r: Reply) => setView({ ...view, reply: r as Answered })}
          submit={(response: string) => api<Answered>(`${base}/answer`, { json: { response } })}
        />
        {reply?.correct && (
          <div className="player-check-result right" data-testid="check-right">
            <p>That's right!</p>
            <button className="btn primary" onClick={carryOn} data-testid="check-continue">Keep playing</button>
          </div>
        )}
        {reply && !reply.correct && (
          <div className="player-check-result wrong" data-testid="check-wrong">
            <p>Not quite. The answer:</p>
            <pre data-testid="check-answer">{reply.rightAnswer}</pre>
            {reply.explain && <p data-testid="check-explain">{reply.explain}</p>}
            {!!reply.strikes && <p className="muted small">{reply.strikes} wrong in a row. {reply.strikesOut} and you're out for a while.</p>}
            {reply.locked ? (
              <button className="btn" onClick={() => setView({ kind: "out", left: reply.locked! })} data-testid="check-next">Continue</button>
            ) : (
              <button className="btn primary" onClick={() => void ask()} data-testid="check-next">Try another question</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
