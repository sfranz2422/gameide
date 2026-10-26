/**
 * The tutorial library (#/tutorials) and the page for writing one
 * (#/tutorials/edit/<slug> or /new).
 *
 * The library shelves the built-in tutorials (public/tutorials/) and the
 * ones teachers wrote and shared (backend/tutorials.py) by level, each with
 * how far this person has got — read from their games (Project.tutorial),
 * so it is right offline and signed out too. Start makes the tutorial's
 * starting game and opens it; Resume opens the game it's in.
 *
 * A teacher can also assign one to a class: it becomes an assignment whose
 * notes are the tutorial (strict steps, Check all on its checks, marks,
 * Classroom — unchanged).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../store/api";
import type { Project } from "../store/project";
import type { ProjectStore, ProjectSummary } from "../store/store";
import { TUTORIAL_STARTERS } from "../store/templates";
import { useSession } from "../editor/session";
import { SiteNav } from "../editor/SiteNav";
import { renderMarkdown } from "../notes/NotesPane";
import { pieces } from "../notes/quiz";
import { LEVELS, parseTutorial, TARGETS, tutorialProblems } from "./tutorial";

interface Entry {
  key: string;
  title: string;
  level: string;
  time: string;
  description: string;
  starter: string;
  /** A teacher's own (editable). */
  mine?: boolean;
  slug?: string;
  owner?: string;
  visibility?: string;
}

/** A tutorial's markdown, by key: built-in from the editor's own files, a teacher's from the server. */
export async function tutorialMarkdown(key: string): Promise<string> {
  const [kind, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "builtin") {
    const r = await fetch(new URL(`tutorials/${name}.md`, document.baseURI));
    if (!r.ok) throw new Error("That tutorial couldn't be loaded.");
    return r.text();
  }
  return (await api<{ markdown: string }>(`/api/tutorials/${encodeURIComponent(name)}`)).markdown;
}

/** The tutorial's starting game, made and saved in this person's games; its id. */
async function makeStarter(store: ProjectStore, key: string, md: string): Promise<Project> {
  const t = parseTutorial(md);
  const build = TUTORIAL_STARTERS[t.meta.starter] ?? TUTORIAL_STARTERS.empty!;
  const { project, assets } = await build();
  project.name = t.meta.title;
  project.tutorial = { key, title: t.meta.title, step: 0, steps: t.steps.length };
  await store.putAssets(project.id, assets);
  const outcome = await store.save(project);
  if (outcome.state === "error") throw new Error(outcome.message ?? "It couldn't be saved.");
  return project;
}

function status(p: ProjectSummary | undefined) {
  if (!p?.tutorial) return null;
  const { step, steps } = p.tutorial;
  return step >= steps ? "Finished ✓" : step === 0 ? "Started" : `Step ${step + 1} of ${steps}`;
}

export function TutorialsPage() {
  const { me, store } = useSession();
  const [builtins, setBuiltins] = useState<Entry[]>([]);
  const [others, setOthers] = useState<Entry[]>([]);
  const [games, setGames] = useState<ProjectSummary[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [teacher, setTeacher] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void fetch(new URL("tutorials/index.json", document.baseURI))
      .then((r) => r.json())
      .then((list: Entry[]) => setBuiltins(list.map((t) => ({ ...t, key: `builtin:${t.key}` }))), () => setProblem("The tutorials couldn't be loaded."));
    void api<{ tutorials: (Entry & { slug: string })[]; teacher: boolean }>("/api/tutorials").then(
      (r) => {
        // With no server behind the editor, a static host answers with its own
        // page, not a list: the built-in tutorials are then all there is.
        if (!Array.isArray(r?.tutorials)) return;
        setOthers(r.tutorials);
        setTeacher(r.teacher);
      },
      () => undefined, // no server: the built-in ones are all there is
    );
    void store.list().then((l) => setGames(Array.isArray(l) ? l : []), () => undefined);
    if (me.user?.teacher)
      void api<{ classes: { id: number; name: string; teaching: boolean }[] }>("/api/classes").then((r) => setClasses(r.classes.filter((c) => c.teaching)), () => undefined);
  }, [store, me.user]);

  const act = async (f: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await f();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const start = (e: Entry) =>
    act(async () => {
      const p = await makeStarter(store, e.key, await tutorialMarkdown(e.key));
      location.hash = `#/p/${p.id}`;
    });
  const assign = (e: Entry, classId: number) =>
    act(async () => {
      const md = await tutorialMarkdown(e.key);
      // Made in the teacher's games just long enough for the class's copy to be taken from it.
      const p = await makeStarter(store, e.key, md);
      try {
        const r = await api<{ slug: string }>(`/api/classes/${classId}/assignments`, { json: { title: e.title, project: p.id, notes: md } });
        location.hash = `#/assignment/${r.slug}`;
      } finally {
        await store.remove(p.id).catch(() => undefined);
      }
    });

  const all = [...builtins, ...others];
  const levels = [...LEVELS, ...new Set(all.map((t) => t.level).filter((l) => !LEVELS.includes(l)))];
  const byKey = useMemo(() => new Map(games.filter((g) => g.tutorial).map((g) => [g.tutorial!.key, g])), [games]);
  return (
    <div className="site-page">
      <SiteNav at="learn" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>Tutorials</h1>
          {teacher && (
            <a className="btn go" href="#/tutorials/edit/new" data-testid="tutorial-new">
              Write a tutorial
            </a>
          )}
        </header>
        <p className="muted">Step by step, in the editor: each step says what to do, and ✔ Check my work checks it before you go on.</p>
        {problem && <p className="banner error">{problem}</p>}
        {levels.map((level) => {
          const here = all.filter((t) => t.level === level);
          if (!here.length) return null;
          return (
            <section key={level} className="class-section">
              <h2>{level}</h2>
              <div className="tutorial-cards">
                {here.map((t) => {
                  const game = byKey.get(t.key);
                  return (
                    <div key={t.key} className="tutorial-card" data-testid="tutorial-card">
                      <b>{t.title}</b>
                      <span className="muted small">
                        {t.time}
                        {t.owner ? ` · by ${t.owner}` : ""}
                        {t.mine && t.visibility ? ` · ${t.visibility === "private" ? "only you" : t.visibility === "classes" ? "your classes" : "everyone"}` : ""}
                      </span>
                      <p className="small">{t.description}</p>
                      {status(game) && (
                        <span className="pill" data-testid="tutorial-status">
                          {status(game)}
                        </span>
                      )}
                      <div className="row">
                        {game ? (
                          <a className="btn small go" href={`#/p/${game.id}`} data-testid="tutorial-resume">
                            {game.tutorial!.step >= game.tutorial!.steps ? "Open" : "Resume"}
                          </a>
                        ) : (
                          <button className="btn small go" disabled={busy} onClick={() => void start(t)} data-testid="tutorial-start">
                            Start
                          </button>
                        )}
                        {t.mine && (
                          <a className="btn small" href={`#/tutorials/edit/${t.slug}`}>
                            Edit
                          </a>
                        )}
                        {classes.length > 0 && (
                          <select
                            className="small-select"
                            value=""
                            disabled={busy}
                            onChange={(ev) => ev.target.value && void assign(t, Number(ev.target.value))}
                            aria-label={`Assign ${t.title} to a class`}
                            data-testid="tutorial-assign"
                          >
                            <option value="">Assign to…</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

const EXAMPLE = `---
title: My tutorial
level: Getting Started
time: 10 min
starter: player-start
description: What students will make.
---
# The first step

Say what to do. Code is shown to type, not to copy:

\`\`\`python
self.x += 4
\`\`\`

highlight: add-event

\`\`\`check
Player has event step
\`\`\`

---

## The next step

Each line of three dashes starts a step.
`;

export function TutorialEditPage({ slug }: { slug: string }) {
  const { me, store } = useSession();
  const isNew = slug === "new";
  const [md, setMd] = useState(isNew ? EXAMPLE : "");
  const [saved, setSaved] = useState(isNew ? "" : null as string | null);
  const [visibility, setVisibility] = useState("private");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (isNew) return;
    void api<{ markdown: string; visibility: string }>(`/api/tutorials/${slug}`).then(
      (r) => {
        setMd(r.markdown);
        setSaved(r.markdown);
        setVisibility(r.visibility);
      },
      (e) => setProblem(e instanceof Error ? e.message : String(e)),
    );
  }, [slug, isNew]);
  const t = useMemo(() => parseTutorial(md), [md]);
  const problems = useMemo(() => tutorialProblems(t, TARGETS), [t]);
  const step = t.steps[Math.min(at, Math.max(0, t.steps.length - 1))];
  const save = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    try {
      if (isNew) {
        const r = await api<{ slug: string }>("/api/tutorials", { json: { markdown: md, visibility } });
        location.hash = `#/tutorials/edit/${r.slug}`;
      } else {
        await api(`/api/tutorials/${slug}`, { json: { markdown: md, visibility } });
        setSaved(md);
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [isNew, md, visibility, slug]);
  return (
    <div className="site-page">
      <SiteNav at="learn" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>{isNew ? "A new tutorial" : t.meta.title}</h1>
          <a href="#/tutorials">All tutorials</a>
        </header>
        <p className="muted small">
          A header, then one step per <code>---</code>. Each step can have a <code>```check</code> block (Next waits for it to pass — see{" "}
          <a href="#/help/checks">the checks</a>) and a <code>highlight:</code> line naming part of the editor to point at. <code>starter:</code> is the game it
          starts from: {Object.keys(TUTORIAL_STARTERS).join(", ")}.
        </p>
        {problem && <p className="banner error">{problem}</p>}
        <div className="notes-editor-cols">
          <div>
            <textarea className="tutorial-source" value={md} onChange={(e) => setMd(e.target.value)} rows={24} spellCheck={false} aria-label="Tutorial" data-testid="tutorial-source" />
            <div className="row">
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Who can see it" data-testid="tutorial-visibility">
                <option value="private">Only me</option>
                <option value="classes">My classes</option>
                {(me.user?.admin || visibility === "site") && <option value="site">Everyone</option>}
              </select>
              <button className="btn go" disabled={busy || md === saved} onClick={() => void save()} data-testid="tutorial-save">
                {md === saved ? "Saved" : "Save"}
              </button>
              {!isNew && (
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={async () => {
                    const p = await makeStarter(store, `t:${slug}`, md);
                    location.hash = `#/p/${p.id}`;
                  }}
                >
                  Try it
                </button>
              )}
              {!isNew && (
                <button
                  className="btn small red"
                  onClick={() => confirm("Delete this tutorial?") && void api(`/api/tutorials/${slug}`, { method: "DELETE" }).then(() => (location.hash = "#/tutorials"))}
                >
                  Delete
                </button>
              )}
            </div>
            {problems.length > 0 && (
              <ul className="banner warn small" data-testid="tutorial-problems">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="notes-preview">
            <div className="tutorial-head">
              <b>{t.meta.title}</b>
              <span className="muted small">
                {t.meta.level} · {t.steps.length} steps
              </span>
            </div>
            <div className="row">
              {t.steps.map((s, i) => (
                <button key={i} className={`btn small${i === at ? " on" : ""}`} onClick={() => setAt(i)} title={s.title}>
                  {i + 1}
                </button>
              ))}
            </div>
            {step && (
              <>
                {pieces(step.md, ["check"]).map((p, i) =>
                  p.type === "md" ? <div key={i} className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.text) }} /> : null,
                )}
                {step.highlight && <p className="muted small">Points at: {step.highlight}</p>}
                {step.checks.length > 0 && (
                  <ul className="tests-list">
                    {step.checks.map((c) => (
                      <li key={c.label}>
                        <span className="tests-mark">○</span>
                        <code>{c.label}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
