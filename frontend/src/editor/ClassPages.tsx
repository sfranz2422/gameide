/**
 * Classes (Phase 10): the class list (#/classes), a class's page
 * (#/class/<id>, the teacher's or a student's), an assignment's results
 * (#/assignment/<slug>, the teacher's), and an assignment's link (#/a/<slug>,
 * which makes or finds the student's own copy and opens it).
 *
 * The server decides who sees what (backend/classes.py); these only show it.
 * Classes are PyIDE's — one per period, students from a Google Classroom
 * roster (or typed in by email), assignments copied rather than shared
 * between periods — so a teacher who knows one editor knows this one.
 */
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, signInUrl } from "../store/api";
import type { ProjectSummary } from "../store/store";
import { CommentsDialog, whenText } from "./AssignmentBits";
import { useSession } from "./session";
import { SiteNav } from "./SiteNav";
import { ClassBoard, XpCard } from "../xp/XpPages";
import { CheckAll, NotesEditor } from "../notes/TeacherNotes";
import { Fragment } from "react";
import DOMPurify from "dompurify";
import { Icon } from "./ui/icons";

interface ClassroomState {
  configured: boolean;
  connected: boolean;
  email: string;
}

/** <input type="datetime-local"> is the teacher's own clock; the server keeps UTC (as PyIDE's Classroom posting does). */
function toUtc(local: string): string | null {
  return local ? new Date(local).toISOString().slice(0, 16) : null;
}

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/** Runs an action, showing its error in words; reloads after. */
function useAct(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const act = useCallback(
    async (f: () => Promise<unknown>) => {
      setBusy(true);
      setProblem(null);
      try {
        await f();
        reload();
      } catch (e) {
        setProblem(message(e));
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  return { busy, problem, setProblem, act };
}

function Page({ title, children, head }: { title: string; children: React.ReactNode; head?: React.ReactNode }) {
  return (
    <div className="site-page">
      <SiteNav at="classes" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>{title}</h1>
          {head}
        </header>
        {children}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- #/classes

interface ClassRow {
  id: number;
  name: string;
  teaching: boolean;
  courseName?: string;
  students?: number;
  teacher?: string;
}

export function ClassesPage() {
  const { me } = useSession();
  const [data, setData] = useState<{ classes: ClassRow[]; teacher: boolean; classroom: ClassroomState | null } | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    void api<NonNullable<typeof data>>("/api/classes").then(setData, (e) => setLoadProblem(message(e)));
  }, []);
  useEffect(() => (me.user ? load() : undefined), [me.user, load]);
  const { busy, problem, act } = useAct(load);
  const [name, setName] = useState("");
  const [courses, setCourses] = useState<{ id: string; name: string; section: string; here: boolean }[] | null>(null);
  const [course, setCourse] = useState("");

  useEffect(() => {
    if (data?.classroom?.connected)
      void api<{ courses: NonNullable<typeof courses> }>("/api/classroom/courses").then(
        (r) => setCourses(r.courses),
        () => setCourses([]),
      );
  }, [data?.classroom?.connected]);

  if (!me.user)
    return (
      <Page title="Classes">
        <p className="muted">Sign in to see your classes.</p>
      </Page>
    );
  const teaching = data?.classes.filter((c) => c.teaching) ?? [];
  const learning = data?.classes.filter((c) => !c.teaching) ?? [];
  return (
    <Page title="Classes">
      {(loadProblem || problem) && <p className="banner error">{loadProblem || problem}</p>}
      {!data && !loadProblem && <p className="muted">Loading…</p>}
      {data && !data.teacher && <XpCard />}
      {data && (
        <>
          {data.teacher && (
            <section className="class-section">
              <h2>Your classes</h2>
              <div className="class-cards">
                {teaching.map((c) => (
                  <a key={c.id} className="class-card" href={`#/class/${c.id}`} data-testid="class-card">
                    <b>{c.name}</b>
                    <span className="muted small">
                      {c.students} student{c.students === 1 ? "" : "s"}
                      {c.courseName ? ` · Classroom: ${c.courseName}` : ""}
                    </span>
                  </a>
                ))}
                {!teaching.length && <p className="muted">No classes yet. Make one for each period below.</p>}
              </div>
              <form
                className="class-new"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    const r = await api<{ id: number; rosterError: string }>("/api/classes", { json: { name, course } });
                    setName("");
                    setCourse("");
                    location.hash = `#/class/${r.id}`;
                  });
                }}
              >
                <h3>New class</h3>
                <p className="muted small">One for each period: Period 4 and Period 7 are two classes, each with its own students and assignments.</p>
                {data.classroom?.connected && courses && courses.length > 0 && (
                  <label className="field">
                    From Google Classroom (its students come with it)
                    <select
                      value={course}
                      onChange={(e) => {
                        setCourse(e.target.value);
                        const c = courses.find((x) => x.id === e.target.value);
                        if (c && !name) setName(c.section ? `${c.name} — ${c.section}` : c.name);
                      }}
                      data-testid="new-class-course"
                    >
                      <option value="">None — I'll add students by email</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id} disabled={c.here}>
                          {c.name}
                          {c.section ? ` — ${c.section}` : ""}
                          {c.here ? " (already here)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  Name
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Game Design, Period 4" data-testid="new-class-name" />
                </label>
                <button className="btn go" disabled={busy || !name.trim()} data-testid="new-class-go">
                  {Icon.plus()} Make the class
                </button>
              </form>
              <p className="muted small">
                <a href="#/shop">Token shop</a>: what your students' XP tokens buy, the same shelf in every editor.
              </p>
              {data.classroom?.configured && (
                <p className="muted small classroom-line">
                  {data.classroom.connected ? (
                    <>
                      Google Classroom is connected ({data.classroom.email}).{" "}
                      <button className="link-btn" disabled={busy} onClick={() => void act(() => api("/classroom/disconnect", { json: {} }))}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <a href="/classroom/connect">Connect Google Classroom</a> to bring in your classes with their students, and to send grades.
                    </>
                  )}
                </p>
              )}
            </section>
          )}
          {(learning.length > 0 || !data.teacher) && (
            <section className="class-section">
              <h2>{data.teacher ? "Classes you're in" : "Your classes"}</h2>
              <div className="class-cards">
                {learning.map((c) => (
                  <a key={c.id} className="class-card" href={`#/class/${c.id}`} data-testid="class-card">
                    <b>{c.name}</b>
                    {c.teacher && <span className="muted small">{c.teacher}</span>}
                  </a>
                ))}
              </div>
              {!learning.length && (
                <p className="muted">
                  You're not in a class here yet. Your teacher adds you, with the email you signed in with ({me.user.email}).
                </p>
              )}
            </section>
          )}
        </>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- #/class/<id>

interface Item {
  id: number;
  kind: "group" | "assignment";
  title: string;
  description: string;
  hidden?: boolean;
  slug?: string;
  outOf?: number | null;
  dueAt?: string | null;
  // the teacher's
  archived?: boolean;
  started?: number;
  turnedIn?: number | string | null;
  posted?: boolean;
  xpBonus?: number;
  // a student's
  questDone?: boolean;
  project?: string | null;
  score?: number | null;
  unread?: number;
}

interface ClassData {
  id: number;
  name: string;
  teaching: boolean;
  items: Item[];
  teacher?: string;
  courseId?: string;
  courseName?: string;
  rosterAt?: string | null;
  students?: { email: string; name: string; signedIn: boolean }[];
  autoApprove?: boolean;
  others?: { id: number; name: string }[];
  classroom?: ClassroomState;
}

export function ClassPage({ classId }: { classId: number }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    void api<ClassData>(`/api/classes/${classId}`).then(setData, (e) => setLoadProblem(message(e)));
  }, [classId]);
  useEffect(load, [load]);
  if (loadProblem)
    return (
      <Page title="Class">
        <p className="banner error">{loadProblem}</p>
        <a href="#/classes">Your classes</a>
      </Page>
    );
  if (!data)
    return (
      <Page title="Class">
        <p className="muted">Loading…</p>
      </Page>
    );
  return data.teaching ? <TeacherClass data={data} reload={load} /> : <StudentClass data={data} />;
}

function StudentClass({ data }: { data: ClassData }) {
  return (
    <Page title={data.name} head={data.teacher ? <span className="muted">{data.teacher}</span> : null}>
      <div className="class-items">
        {data.items.map((i) =>
          i.kind === "group" ? (
            <h2 key={i.id} className="class-group">
              {i.title}
            </h2>
          ) : (
            <div key={i.id} className="class-item" data-testid="class-assignment">
              <div className="class-item-main">
                <a href={`#/a/${i.slug}`} className="class-item-title">
                  {i.title}
                </a>
                {i.description && <p className="small">{i.description}</p>}
                <span className="muted small">
                  {i.dueAt ? `Due ${whenText(i.dueAt)} · ` : ""}
                  {i.turnedIn ? `Turned in ${whenText(i.turnedIn as string)}` : i.project ? "Started, not turned in" : "Not started"}
                </span>
              </div>
              {i.unread ? (
                <span className="pill warn" data-testid="new-comments">
                  {i.unread} new comment{i.unread === 1 ? "" : "s"}
                </span>
              ) : null}
              {i.xpBonus ? (
                <span className={`pill quest${i.questDone ? " done" : ""}`} data-testid="quest">
                  {i.questDone ? "✓ Quest done" : `Quest: +${i.xpBonus} XP for full marks`}
                </span>
              ) : null}
              {i.score != null && (
                <span className="pill" data-testid="my-score">
                  {i.score}
                  {i.outOf ? ` / ${i.outOf}` : ""}
                </span>
              )}
              <a className="btn go" href={`#/a/${i.slug}`} data-testid="open-assignment">
                {i.project ? "Open" : "Start"}
              </a>
            </div>
          ),
        )}
        {!data.items.length && <p className="muted">Nothing here yet.</p>}
      </div>
      <ClassBoard classId={data.id} />
    </Page>
  );
}

function TeacherClass({ data, reload }: { data: ClassData; reload: () => void }) {
  const { busy, problem, setProblem, act } = useAct(reload);
  const [making, setMaking] = useState(false);
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const live = data.items.filter((i) => !i.archived);
  const archived = data.items.filter((i) => i.archived);

  const move = (id: number, by: number) => {
    const ids = data.items.map((i) => i.id);
    const at = ids.indexOf(id);
    const to = at + by;
    if (to < 0 || to >= ids.length) return;
    [ids[at], ids[to]] = [ids[to]!, ids[at]!];
    void act(() => api(`/api/classes/${data.id}/order`, { json: { items: ids } }));
  };
  const item = (id: number, change: Record<string, unknown>) => act(() => api(`/api/classes/${data.id}/items/${id}`, { json: change }));

  return (
    <Page
      title={data.name}
      head={
        <>
          <button className="btn go" disabled={busy} onClick={() => setMaking(true)} data-testid="new-assignment">
            {Icon.plus()} New assignment
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => {
              const title = prompt("The group's heading (Week 1, Platformers…):");
              if (title?.trim()) void act(() => api(`/api/classes/${data.id}/groups`, { json: { title } }));
            }}
            data-testid="new-group"
          >
            New group
          </button>
          <a className="btn blue" href={`#/class/${data.id}/xp`} data-testid="class-xp">
            XP and tokens
          </a>
        </>
      }
    >
      {problem && (
        <p className="banner error" role="alert">
          {problem}
        </p>
      )}
      {note && <p className="banner">{note}</p>}
      <div className="class-items">
        {live.map((i, n) => (
          <div key={i.id} className={`class-item${i.hidden ? " hidden-item" : ""}${i.kind === "group" ? " group" : ""}`} data-testid={i.kind === "group" ? "class-group" : "class-assignment"}>
            <span className="class-move">
              <button className="icon-btn" disabled={busy || n === 0} onClick={() => move(i.id, -1)} aria-label={`Move ${i.title} up`}>
                ↑
              </button>
              <button className="icon-btn" disabled={busy || n === live.length - 1} onClick={() => move(i.id, 1)} aria-label={`Move ${i.title} down`}>
                ↓
              </button>
            </span>
            {i.kind === "group" ? (
              <>
                <h2 className="class-group">{i.title}</h2>
                <span className="spacer" />
                <button
                  className="btn small"
                  onClick={() => {
                    const title = prompt("Heading:", i.title);
                    if (title?.trim()) void item(i.id, { title });
                  }}
                >
                  Rename
                </button>
                <button className="btn small" onClick={() => confirm(`Delete the heading "${i.title}"? Nothing under it is deleted.`) && void act(() => api(`/api/classes/${data.id}/items/${i.id}`, { method: "DELETE" }))}>
                  Delete
                </button>
              </>
            ) : (
              <>
                <div className="class-item-main">
                  <a href={`#/assignment/${i.slug}`} className="class-item-title" data-testid="assignment-link">
                    {i.title}
                  </a>
                  <span className="muted small">
                    {i.hidden ? "Hidden from students · " : ""}
                    {i.dueAt ? `Due ${whenText(i.dueAt)} · ` : ""}
                    {i.started} started · {i.turnedIn} turned in{i.posted ? " · in Classroom" : ""}
                    {i.xpBonus ? ` · quest: +${i.xpBonus} XP` : ""}
                  </span>
                </div>
                <button
                  className="btn small"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${location.origin}/a/${i.slug}`);
                    setNote(`Copied the link for "${i.title}": ${location.origin}/a/${i.slug}`);
                  }}
                  title="The link to give students"
                >
                  {Icon.copy()} Link
                </button>
                <button className="btn small" onClick={() => void item(i.id, { hidden: !i.hidden })} data-testid="toggle-hidden">
                  {i.hidden ? "Show" : "Hide"}
                </button>
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const r = await api<{ project: string }>(`/api/assignments/${i.slug}/start`, { json: {} });
                      location.hash = `#/p/${r.project}`;
                    })
                  }
                  data-testid="edit-starter"
                  title="Change the game students start from. Students who already started keep theirs."
                >
                  Edit starter
                </button>
                {(data.others?.length ?? 0) > 0 && (
                  <select
                    className="small-select"
                    value=""
                    onChange={(e) => {
                      const to = Number(e.target.value);
                      if (to) void act(() => api(`/api/assignments/${i.slug}/copy`, { json: { class: to } }).then(() => setNote(`Copied "${i.title}" to ${data.others!.find((c) => c.id === to)?.name}.`)));
                    }}
                    aria-label={`Copy ${i.title} to another class`}
                  >
                    <option value="">Copy to…</option>
                    {data.others!.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <button className="btn small" onClick={() => void act(() => api(`/api/assignments/${i.slug}`, { json: { archived: true } }))}>
                  Archive
                </button>
                <button
                  className="btn small red"
                  onClick={() => confirm(`Delete "${i.title}"? Students who started keep their games.`) && void act(() => api(`/api/assignments/${i.slug}`, { method: "DELETE" }))}
                  aria-label={`Delete ${i.title}`}
                >
                  {Icon.trash()}
                </button>
              </>
            )}
          </div>
        ))}
        {!live.length && <p className="muted">No assignments yet. Press New assignment to hand out one of your games.</p>}
      </div>

      {archived.length > 0 && (
        <details className="class-section">
          <summary>Archived ({archived.length})</summary>
          {archived.map((i) => (
            <div key={i.id} className="class-item">
              <a href={`#/assignment/${i.slug}`} className="class-item-title">
                {i.title}
              </a>
              <span className="spacer" />
              <button className="btn small" onClick={() => void act(() => api(`/api/assignments/${i.slug}`, { json: { archived: false } }))}>
                Bring back
              </button>
            </div>
          ))}
        </details>
      )}

      <section className="class-section">
        <h2>Students ({data.students?.length ?? 0})</h2>
        {data.courseId ? (
          <p className="muted small">
            From Google Classroom: {data.courseName}
            {data.rosterAt ? `, as of ${whenText(data.rosterAt)}` : ""}.{" "}
            <button
              className="link-btn"
              disabled={busy}
              onClick={() => void act(() => api<{ students: number }>(`/api/classes/${data.id}/roster`, { json: {} }).then((r) => setNote(`${r.students} students in Classroom.`)))}
              data-testid="sync-roster"
            >
              Sync roster
            </button>
          </p>
        ) : (
          <form
            className="roster-add"
            onSubmit={(e) => {
              e.preventDefault();
              void act(() => api(`/api/classes/${data.id}/students`, { json: { emails } }).then(() => setEmails("")));
            }}
          >
            <label className="field">
              Add students by the email they sign in with (several at once: one per line, or separated by commas)
              <textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} data-testid="roster-emails" />
            </label>
            <button className="btn" disabled={busy || !emails.trim()} data-testid="roster-add">
              Add
            </button>
          </form>
        )}
        <table className="mod-table">
          <tbody>
            {data.students?.map((s) => (
              <tr key={s.email}>
                <td>{s.name || s.email.split("@")[0]}</td>
                <td className="muted">{s.email}</td>
                <td className="muted small">{s.signedIn ? "" : "hasn't signed in yet"}</td>
                <td>
                  {!data.courseId && (
                    <button className="btn small" onClick={() => void act(() => api(`/api/classes/${data.id}/students`, { method: "DELETE", json: { email: s.email } }))} aria-label={`Remove ${s.email}`}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ClassBoard classId={data.id} />

      <section className="class-section">
        <h2>Publishing</h2>
        <label className="check class-check">
          <input
            type="checkbox"
            checked={!!data.autoApprove}
            onChange={(e) => void act(() => api(`/api/moderation/classes/${data.id}`, { json: { autoApprove: e.target.checked } }))}
            data-testid="class-auto-approve"
          />
          Put this class's public games on Explore without waiting for me
        </label>
        <p className="muted small">
          Otherwise they wait for you on <a href="#/moderation">Approvals</a>, with any reports. The class's own games are in its{" "}
          <a href={`#/gallery/${data.id}`}>gallery</a>.
        </p>
      </section>

      <section className="class-section">
        <h2>Class</h2>
        <div className="row">
          <button
            className="btn small"
            onClick={() => {
              const name = prompt("The class's name:", data.name);
              if (name?.trim()) void act(() => api(`/api/classes/${data.id}`, { json: { name } }));
            }}
          >
            Rename
          </button>
          <button
            className="btn small red"
            onClick={() => {
              if (confirm(`Delete the class "${data.name}"? Its assignments are archived; students keep their games and everything turned in.`))
                void act(() => api(`/api/classes/${data.id}`, { method: "DELETE" }).then(() => (location.hash = "#/classes")));
            }}
          >
            Delete class
          </button>
        </div>
      </section>

      {making && (
        <NewAssignment
          classId={data.id}
          onClose={() => setMaking(false)}
          onMade={() => {
            setMaking(false);
            setProblem(null);
            reload();
          }}
        />
      )}
    </Page>
  );
}

function NewAssignment({ classId, onClose, onMade }: { classId: number; onClose: () => void; onMade: () => void }) {
  const { store } = useSession();
  const [games, setGames] = useState<ProjectSummary[] | null>(null);
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [outOf, setOutOf] = useState("");
  const [due, setDue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Only games already in the account: the starter is copied on the server.
    void store.list().then((l) => setGames(l.filter((g) => !g.unsynced)));
  }, [store]);
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-label="New assignment"
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setProblem(null);
          api(`/api/classes/${classId}/assignments`, { json: { title, project, outOf: outOf || null, dueAt: toUtc(due) } }).then(onMade, (e) => {
            setProblem(message(e));
            setBusy(false);
          });
        }}
      >
        <h2>New assignment</h2>
        <p className="muted small">Students each get their own copy of the game you choose, the first time they open the assignment's link.</p>
        <label className="field">
          Start from
          <select
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              if (!title) setTitle(games?.find((g) => g.id === e.target.value)?.name ?? "");
            }}
            data-testid="assignment-game"
          >
            <option value="">Choose one of your games…</option>
            {games?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        {games && !games.length && <p className="muted small">You have no games yet. Make the starter on My Games first.</p>}
        <label className="field">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="assignment-title" />
        </label>
        <label className="field">
          Points (empty: not graded)
          <input type="number" min={1} max={1000} value={outOf} onChange={(e) => setOutOf(e.target.value)} data-testid="assignment-points" />
        </label>
        <label className="field">
          Due (optional)
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} data-testid="assignment-due" />
        </label>
        {problem && <p className="error-text">{problem}</p>}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn go" disabled={busy || !project || !title.trim()} data-testid="assignment-go">
            Make it
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- #/assignment/<slug>

interface ResultRow {
  student: number | null;
  name: string;
  email: string;
  onRoster: boolean;
  project: string | null;
  deleted: boolean;
  updated: string | null;
  turnedIn: string | null;
  times: number;
  version: number | null;
  score: number | null;
  synced: boolean;
  comments: number;
  unread: number;
  /** Points from the notes' questions, null when they answered none. */
  quiz: number | null;
  /** The grade: score plus questions plus checked tests (backend/grades.py). */
  total: number | null;
  testsSelf: TestRun | null;
  testsVerified: TestRun | null;
  longs: { question: string; prompt: string; points: number; response: string; score: number | null }[];
  /** How far they've got, when the assignment is a tutorial. */
  tutorial: { step: number; steps: number } | null;
}

interface TestRun {
  earned: number;
  possible: number;
  at: string;
  /** Checked before their last turn-in: of work since replaced. */
  stale: boolean;
  details: { label: string; ok: boolean; detail: string; points: number }[];
}

interface Results {
  slug: string;
  title: string;
  xpBonus: number;
  notes: string;
  possible: number;
  questions: number;
  tests: { label: string; points: number }[];
  outOf: number | null;
  dueAt: string | null;
  archived: boolean;
  hidden: boolean;
  classId: number | null;
  className: string;
  courseId: string;
  starter: string | null;
  rows: ResultRow[];
  posted: { url: string; courseName: string } | null;
  classroom: ClassroomState | null;
}

export function AssignmentPage({ slug }: { slug: string }) {
  const [data, setData] = useState<Results | null>(null);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    void api<Results>(`/api/assignments/${slug}`).then(setData, (e) => setLoadProblem(message(e)));
  }, [slug]);
  useEffect(load, [load]);
  const { busy, problem, act } = useAct(load);
  const [note, setNote] = useState<string | null>(null);
  const [talking, setTalking] = useState<ResultRow | null>(null);
  const [draft, setDraft] = useState(true);

  if (loadProblem)
    return (
      <Page title="Assignment">
        <p className="banner error">{loadProblem}</p>
      </Page>
    );
  if (!data)
    return (
      <Page title="Assignment">
        <p className="muted">Loading…</p>
      </Page>
    );
  const set = (change: Record<string, unknown>) => act(() => api(`/api/assignments/${slug}`, { json: change }));
  const started = data.rows.filter((r) => r.project).length;
  // The notes give points of their own: show what each student has from them, and the total.
  const extra = data.questions > 0 || data.tests.length > 0;
  const turned = data.rows.filter((r) => r.turnedIn).length;
  return (
    <Page title={data.title} head={data.classId ? <a href={`#/class/${data.classId}`}>{data.className}</a> : null}>
      {problem && (
        <p className="banner error" role="alert">
          {problem}
        </p>
      )}
      {note && <p className="banner">{note}</p>}
      <div className="assignment-settings">
        <label>
          Title{" "}
          <input defaultValue={data.title} key={data.title} onBlur={(e) => e.target.value.trim() && e.target.value !== data.title && void set({ title: e.target.value })} />
        </label>
        <label>
          Points{" "}
          <input
            type="number"
            min={1}
            max={1000}
            defaultValue={data.outOf ?? ""}
            key={`o${data.outOf}`}
            onBlur={(e) => String(data.outOf ?? "") !== e.target.value && void set({ outOf: e.target.value || null })}
            data-testid="results-points"
          />
        </label>
        <label>
          Due{" "}
          <input type="datetime-local" defaultValue={toLocal(data.dueAt)} key={`d${data.dueAt}`} onBlur={(e) => toLocal(data.dueAt) !== e.target.value && void set({ dueAt: toUtc(e.target.value) })} />
        </label>
        <label title="XP paid once to each student who gets full marks. 0 is no quest.">
          Quest reward{" "}
          <input
            type="number"
            min={0}
            defaultValue={data.xpBonus || ""}
            key={`x${data.xpBonus}`}
            placeholder="0"
            onBlur={(e) =>
              Number(e.target.value || 0) !== data.xpBonus &&
              void act(async () => {
                const r = await api<{ paid: number }>(`/api/assignments/${slug}/xp-bonus`, { json: { xp: e.target.value || 0 } });
                if (r.paid) setNote(`Paid the quest reward to ${r.paid} student${r.paid === 1 ? "" : "s"} who already had full marks.`);
              })
            }
            data-testid="quest-reward"
          />{" "}
          XP
        </label>
        {data.starter && (
          <a className="btn small" href={`#/p/${data.starter}`}>
            Edit starter
          </a>
        )}
        <button
          className="btn small"
          onClick={() => document.querySelector("[data-testid=notes-editor]")?.scrollIntoView({ behavior: "smooth" })}
          title="The notes students read in their editor's Notes tab: instructions, slides, questions, tests and spotlights"
          data-testid="go-to-notes"
        >
          ✎ Notes
        </button>
        <button
          className="btn small"
          onClick={() => {
            void navigator.clipboard?.writeText(`${location.origin}/a/${data.slug}`);
            setNote(`Copied the link: ${location.origin}/a/${data.slug}`);
          }}
        >
          {Icon.copy()} Link
        </button>
      </div>
      <p className="muted small">
        {started} of {data.rows.length} started · {turned} turned in{data.hidden ? " · hidden from students" : ""}
        {data.archived ? " · archived" : ""}
      </p>

      {data.classroom?.configured && (
        <section className="classroom-box">
          {data.posted ? (
            <>
              <span>
                In Google Classroom ({data.posted.courseName}).{" "}
                {data.posted.url && (
                  <a href={data.posted.url} target="_blank" rel="noreferrer">
                    Open it there
                  </a>
                )}
              </span>
              <button
                className="btn small"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const r = await api<{ sent: number; unmatched: string[]; failed: string[] }>(`/api/assignments/${slug}/classroom/sync`, { json: {} });
                    setNote(
                      `Sent ${r.sent} score${r.sent === 1 ? "" : "s"} to Classroom as draft grades — return them there.` +
                        (r.unmatched.length ? ` Not in the Classroom class: ${r.unmatched.join(", ")}.` : "") +
                        (r.failed.length ? ` Refused: ${r.failed.join("; ")}.` : ""),
                    );
                  })
                }
                data-testid="classroom-sync"
              >
                Sync grades
              </button>
            </>
          ) : !data.classroom.connected ? (
            <span className="muted small">
              <a href="/classroom/connect">Connect Google Classroom</a> to post this there and send its grades.
            </span>
          ) : !data.courseId ? (
            <span className="muted small">This class isn't from Google Classroom, so there's nowhere to post it.</span>
          ) : (
            <>
              <label className="check">
                <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} /> as a draft, to assign in Classroom later
              </label>
              <button
                className="btn small"
                disabled={busy || !data.outOf}
                title={data.outOf ? undefined : "Give it points first"}
                onClick={() => void act(() => api(`/api/assignments/${slug}/classroom/post`, { json: { draft } }).then(() => setNote("Posted to Google Classroom.")))}
                data-testid="classroom-post"
              >
                Post to Classroom
              </button>
            </>
          )}
        </section>
      )}

      {data.tests.length > 0 && (
        <p>
          <CheckAll slug={slug} onDone={load} />
        </p>
      )}
      <table className="mod-table results-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Their game</th>
            <th>Turned in</th>
            <th>{extra ? "Your score" : "Score"}</th>
            {data.questions > 0 && <th>Questions</th>}
            {data.tests.length > 0 && <th title="From your Check all; their own check in grey">Tests</th>}
            {extra && <th>Total</th>}
            <th>Comments</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <Fragment key={r.email}>
            <tr data-testid="result-row">
              <td>
                {r.name}
                {!r.onRoster && <span className="muted small"> (not on the roster)</span>}
              </td>
              <td>
                {r.project ? (
                  <>
                    <a href={`#/view/${r.project}`} data-testid="view-game">
                      Open and play
                    </a>
                    <span className="muted small"> · changed {whenText(r.updated)}</span>
                    {r.tutorial && (
                      <span className="pill" data-testid="row-tutorial">
                        {r.tutorial.step >= r.tutorial.steps ? "tutorial finished" : `step ${r.tutorial.step + 1} of ${r.tutorial.steps}`}
                      </span>
                    )}
                    {r.deleted && <span className="muted small"> (they deleted it)</span>}
                  </>
                ) : (
                  <span className="muted">Not started</span>
                )}
              </td>
              <td>
                {r.turnedIn ? (
                  <>
                    <a href={`#/view/${r.project}/${r.version}`} data-testid="view-turned-in">
                      {whenText(r.turnedIn)}
                    </a>
                    {r.times > 1 && <span className="muted small"> ({r.times} times)</span>}
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                {r.student && r.project ? (
                  <span className="score-box">
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      defaultValue={r.score ?? ""}
                      key={`${r.email}${r.score}`}
                      aria-label={`Score for ${r.name}`}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== r.score) void act(() => api(`/api/assignments/${slug}/score`, { json: { student: r.student, score: v } }));
                      }}
                      data-testid="score"
                    />
                    {!extra && data.outOf ? <span className="muted"> / {data.outOf}</span> : null}
                    {!extra && data.posted && r.score != null && <span className="muted small">{r.synced ? " ✓ in Classroom" : " not sent"}</span>}
                  </span>
                ) : null}
              </td>
              {data.questions > 0 && <td data-testid="row-quiz">{r.quiz ?? <span className="muted">—</span>}</td>}
              {data.tests.length > 0 && (
                <td data-testid="row-tests">
                  {r.testsVerified ? (
                    <span title={r.testsVerified.details.filter((d) => !d.ok).map((d) => `✗ ${d.label}: ${d.detail}`).join("\n") || "All passing"}>
                      {r.testsVerified.earned} / {r.testsVerified.possible}
                      {r.testsVerified.stale && <span title="Checked before they turned it in again: press Check all"> ⟳</span>}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {r.testsSelf && (
                    <span className="muted small" title="Their own Check my work: feedback, not counted">
                      {" "}
                      (their check {r.testsSelf.earned}/{r.testsSelf.possible})
                    </span>
                  )}
                </td>
              )}
              {extra && (
                <td data-testid="row-total">
                  {r.total ?? <span className="muted">—</span>}
                  {data.outOf && r.total != null ? <span className="muted"> / {data.outOf}</span> : null}
                  {data.posted && r.total != null && <span className="muted small">{r.synced ? " ✓ in Classroom" : " not sent"}</span>}
                </td>
              )}
              <td>
                {r.project && (
                  <button className="btn small" onClick={() => setTalking(r)} data-testid="comments">
                    {r.comments ? `${r.comments}` : "Comment"}
                    {r.unread ? <span className="pill warn"> {r.unread} new</span> : null}
                  </button>
                )}
              </td>
              <td>
                {r.project && (
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const c = await api<{ project: string }>(`/api/projects/${r.project}/duplicate`, { json: {} });
                        location.hash = `#/p/${c.project}`;
                      })
                    }
                    title="A copy of their game in your own games, to show the class. Theirs isn't touched."
                    data-testid="duplicate"
                  >
                    {Icon.copy()} Copy to demo
                  </button>
                )}
              </td>
            </tr>
            {r.longs.length > 0 && (
              <tr className="long-row">
                <td />
                <td colSpan={7}>
                  {r.longs.map((l) => (
                    <div key={l.question} className="long-answer" data-testid="long-answer">
                      <div className="muted small">{l.prompt}</div>
                      {/* Cleaned on the server when saved and when sent (quiz.clean_html); again here, as it is drawn as markup. */}
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(l.response, { ALLOWED_TAGS: ["p", "div", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li"], ALLOWED_ATTR: [] }) }} />
                      <label className="small">
                        Mark{" "}
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          defaultValue={l.score ?? ""}
                          key={`${l.question}${l.score}`}
                          onBlur={(e) =>
                            (e.target.value === "" ? null : Number(e.target.value)) !== l.score &&
                            void act(() => api("/api/quiz/grade", { json: { assignment: slug, student: r.student, question: l.question, score: e.target.value } }))
                          }
                          data-testid="long-mark"
                        />{" "}
                        / {l.points}
                      </label>
                    </div>
                  ))}
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <NotesEditor slug={slug} notes={data.notes} onSaved={load} />
      {talking?.project && (
        <CommentsDialog
          projectId={talking.project}
          title={`${talking.name}'s game`}
          onClose={() => {
            setTalking(null);
            load();
          }}
        />
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- #/a/<slug>

/** An assignment's link: the student's own copy (made the first time), opened in the editor. */
export function StartAssignment({ slug }: { slug: string }) {
  const { me } = useSession();
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!me.user) return;
    let alive = true;
    api<{ project: string }>(`/api/assignments/${slug}/start`, { json: {} }).then(
      (r) => alive && location.replace(`#/p/${r.project}`),
      (e) => alive && setProblem(e instanceof ApiError || e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [slug, me.user]);
  if (!me.user)
    return (
      <Page title="An assignment">
        {me.loginEnabled ? (
          <p>
            <a className="btn go" href={signInUrl(me)} data-testid="assignment-sign-in">
              Sign in
            </a>{" "}
            with your school account to get your own copy of the game.
          </p>
        ) : (
          <p className="muted">Assignments need signing in, which isn't set up on this server.</p>
        )}
      </Page>
    );
  return (
    <Page title="An assignment">
      {problem ? <p className="banner error">{problem}</p> : <p className="muted">Opening your copy…</p>}
    </Page>
  );
}
