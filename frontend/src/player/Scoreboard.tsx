/**
 * The school's high scores, either side of a published game: first names and
 * scores from the viewer's own school (publishing.py decides who that is). The
 * left board is the top ten; the right is the viewer's best and the next ten.
 * A game only has boards if its code calls high_score().
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../store/api";
import type { Project } from "../store/project";

export interface Board {
  signedIn: boolean;
  school: boolean;
  scores: { name: string; score: number; me: boolean }[];
  mine: { score: number; rank: number } | null;
  /** From the published game's settings. */
  lowest: boolean;
  unit: string;
}

/** A score as the board shows it: "time" scores are kept in hundredths of a second. */
export function showScore(score: number, unit: string) {
  if (unit !== "time") return score.toLocaleString();
  const seconds = Math.floor(score / 100);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.${String(score % 100).padStart(2, "0")}`;
}

/** Does this game ever call high_score()? Reads the whole project, so blocks and sheets count. */
export const usesScores = (project: Project) => JSON.stringify(project).includes("high_score(");

/** Other students' scores arrive this often while the page is open. */
const REFRESH_MS = 60_000;
/** A game can raise its score every step: the server hears at most this often. */
const SEND_MS = 2_000;

export function useScores(slug: string | null) {
  const [board, setBoard] = useState<Board | null>(null);
  const waiting = useRef<number | null>(null);
  const rules = useRef({ lowest: false });
  rules.current.lowest = board?.lowest ?? false;
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setBoard(await api<Board>(`/api/play/${encodeURIComponent(slug)}/scores`));
    } catch {
      /* the boards are extra: a game still plays without them */
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const every = window.setInterval(() => document.visibilityState === "visible" && void load(), REFRESH_MS);
    return () => {
      clearInterval(every);
      clearTimeout(timer.current);
    };
  }, [load]);

  const send = useCallback(
    (score: number) => {
      if (!slug) return;
      // Two scores inside one wait: keep the better, as the game may send a worse one after.
      const lowest = rules.current.lowest;
      const held = waiting.current;
      waiting.current = held === null ? score : lowest ? Math.min(held, score) : Math.max(held, score);
      if (timer.current !== undefined) return;
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        const n = waiting.current;
        waiting.current = null;
        if (n === null) return;
        api(`/api/play/${encodeURIComponent(slug)}/score`, { json: { score: n } }).then(load, () => undefined);
      }, SEND_MS);
    },
    [slug, load],
  );
  return { board, send };
}

function Rows({ rows, first, unit }: { rows: Board["scores"]; first: number; unit: string }) {
  return (
    <ol>
      {rows.map((r, i) => (
        <li key={first + i} className={r.me ? "me" : undefined}>
          <span className="score-rank">{first + i}</span>
          <span className="score-name">{r.name}</span>
          <span>{showScore(r.score, unit)}</span>
        </li>
      ))}
    </ol>
  );
}

export function Scoreboard({ side, board }: { side: "left" | "right"; board: Board | null }) {
  const shown = side === "left" ? board?.scores.slice(0, 10) : board?.scores.slice(10, 20);
  return (
    <aside className="score-board" data-testid={`scores-${side}`}>
      {side === "left" ? (
        <>
          <h2>School high scores</h2>
          {board && (board.unit || board.lowest) && (
            <p className="muted small score-unit" data-testid="scores-unit">
              {board.unit === "time" ? "Time" : board.unit}
              {board.unit && board.lowest ? ", " : ""}
              {board.lowest ? "lowest wins" : ""}
            </p>
          )}
          {board && !board.signedIn && <p className="muted small">Sign in to see your school's high scores.</p>}
          {board?.signedIn && !board.school && <p className="muted small">Scores are shared within a school. Sign in with your school email to see them.</p>}
          {board?.school && shown?.length === 0 && <p className="muted small">No scores yet. Be the first!</p>}
          {shown && <Rows rows={shown} first={1} unit={board?.unit ?? ""} />}
        </>
      ) : (
        <>
          <h2>Your best</h2>
          {board?.mine ? (
            <p className="score-mine">
              {showScore(board.mine.score, board.unit)} (number {board.mine.rank})
            </p>
          ) : (
            <p className="muted small">{board?.school ? "Play to get on the board." : "Your best score shows here."}</p>
          )}
          {shown && shown.length > 0 && <Rows rows={shown} first={11} unit={board?.unit ?? ""} />}
        </>
      )}
    </aside>
  );
}
