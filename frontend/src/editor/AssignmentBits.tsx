/**
 * Classes, in the editor's top bar — which otherwise stays exactly as it
 * is: these appear only on a game that is an assignment.
 *
 *   AssignmentButtons  a student's own work for an assignment: Comments
 *                      (the teacher's, with replies) and Turn in.
 *   ViewBar            a teacher looking at a student's game, read only
 *                      (viewStore.ts): whose it is, Comments, and Copy to
 *                      my games — the "duplicate to demo" of the spec.
 *   CommentsDialog     the comments on one game, used by both and by the
 *                      assignment's results page.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../store/api";
import type { CloudStore } from "../store/cloudStore";
import type { ProjectStore } from "../store/store";

/** A UTC time from the server, in the reader's own clock. */
export function whenText(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface Comment {
  id: number;
  text: string;
  author: string;
  mine: boolean;
  teacher: boolean;
  at: string;
}

export function CommentsDialog({ projectId, title, onClose }: { projectId: string; title: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    void api<{ comments: Comment[] }>(`/api/projects/${encodeURIComponent(projectId)}/comments`).then(
      (r) => setComments(r.comments),
      (e) => setProblem(e instanceof Error ? e.message : String(e)),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [projectId]);
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className="modal" role="dialog" aria-label="Comments" onPointerDown={(e) => e.stopPropagation()} data-testid="comments-dialog">
        <h2>Comments on {title}</h2>
        <div className="comment-list">
          {comments?.map((c) => (
            <div key={c.id} className={`comment${c.mine ? " mine" : ""}`} data-testid="comment">
              <span className="muted small">
                {c.author}
                {c.teacher ? " (teacher)" : ""} · {whenText(c.at)}
              </span>
              <p>{c.text}</p>
            </div>
          ))}
          {comments && !comments.length && <p className="muted">No comments yet.</p>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setProblem(null);
            api(`/api/projects/${encodeURIComponent(projectId)}/comments`, { json: { text } }).then(
              () => {
                setText("");
                setBusy(false);
                load();
              },
              (e) => {
                setProblem(e instanceof Error ? e.message : String(e));
                setBusy(false);
              },
            );
          }}
        >
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your comment" data-testid="comment-text" />
          {problem && <p className="error-text">{problem}</p>}
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
            <button className="btn go" disabled={busy || !text.trim()} data-testid="comment-send">
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface Standing {
  slug: string;
  title: string;
  /** The assignment's notes: redacted for a student (backend/notes.py), whole for its teacher. */
  notes: string;
  /** The teacher looking (a student's game read only, or the starter): nothing to turn in. */
  teacher?: boolean;
  dueAt?: string | null;
  turnedIn?: string | null;
  changedSince?: boolean;
  unread?: number;
}

/**
 * Whether the open game is an assignment's — a student's own work, or a
 * student's game or the starter open to its teacher — and how it stands.
 * Signed-out and browser-only games have none.
 */
export function useAssignment(store: ProjectStore, projectId: string) {
  const [a, setA] = useState<Standing | null>(null);
  const load = useCallback(() => {
    if (store.kind === "local") return;
    void api<{ assignment: Standing | null }>(`/api/projects/${encodeURIComponent(projectId)}/assignment`).then(
      (r) => setA(r.assignment),
      () => undefined,
    );
  }, [store, projectId]);
  useEffect(load, [load]);
  return { a, reload: load };
}

/** A student's assignment game: Comments and Turn in. Nothing at all on any other game. */
export function AssignmentButtons({ store, projectId, modified, a, reload: load }: { store: ProjectStore; projectId: string; modified: string; a: Standing | null; reload: () => void }) {
  const [talking, setTalking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Turned in, then changed: say so, so the student knows to turn in again.
  const [turnedAt, setTurnedAt] = useState<string | null>(null);
  useEffect(() => setTurnedAt(null), [projectId]);
  if (!a || a.teacher || store.kind !== "cloud") return null;
  const changed = turnedAt ? modified > turnedAt : a.changedSince;
  const done = (turnedAt || a.turnedIn) && !changed;
  return (
    <>
      <button className="btn small" onClick={() => setTalking(true)} data-testid="editor-comments" title="Your teacher's comments on this game">
        Comments{a.unread ? <span className="pill warn"> {a.unread} new</span> : null}
      </button>
      <button
        className={`btn small ${done ? "" : "go"}`}
        disabled={busy}
        title={problem ?? (a.dueAt ? `Due ${whenText(a.dueAt)}` : undefined)}
        onClick={async () => {
          setBusy(true);
          setProblem(null);
          try {
            // What is turned in is what the server has, so send what's on screen first.
            const o = await (store as CloudStore).sync(projectId);
            if (o.state !== "saved") throw new Error(o.message ?? "Can't reach the server, so it can't be turned in yet. Try again when you're online.");
            await api(`/api/projects/${encodeURIComponent(projectId)}/turn-in`, { json: {} });
            setTurnedAt(new Date().toISOString());
            load();
          } catch (e) {
            setProblem(e instanceof Error ? e.message : String(e));
            alert(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
        data-testid="turn-in"
      >
        {done ? "Turned in ✓" : turnedAt || a.turnedIn ? "Turn in again" : "Turn in"}
      </button>
      {talking && (
        <CommentsDialog
          projectId={projectId}
          title={a.title}
          onClose={() => {
            setTalking(false);
            load();
          }}
        />
      )}
    </>
  );
}

/** A teacher looking at a student's game: it says so, and nothing they change is saved. */
export function ViewBar({ projectId, versionId, name }: { projectId: string; versionId: number | null; name: string }) {
  const [talking, setTalking] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <span className="pill warn view-pill" data-testid="read-only" title="You can change things to try them out. Nothing is saved.">
        {versionId ? "As turned in" : "Their game"} · read only
      </span>
      <button className="btn small" onClick={() => setTalking(true)} data-testid="view-comments">
        Comments
      </button>
      <button
        className="btn small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ project: string }>(`/api/projects/${encodeURIComponent(projectId)}/duplicate`, { json: versionId ? { version: versionId } : {} });
            location.hash = `#/p/${r.project}`;
          } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
            setBusy(false);
          }
        }}
        title="A copy in your own games, to change or show the class. Theirs isn't touched."
        data-testid="view-duplicate"
      >
        Copy to my games
      </button>
      {talking && <CommentsDialog projectId={projectId} title={name} onClose={() => setTalking(false)} />}
    </>
  );
}
