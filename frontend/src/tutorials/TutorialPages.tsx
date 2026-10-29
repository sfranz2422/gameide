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
 * A class gets one through the library (#/library): Try it makes its
 * starting game, New assignment on the class page uses that game, and Link
 * to… makes the tutorial its notes (strict steps, Check all on its checks,
 * marks, Classroom — unchanged).
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../store/api";
import type { Project } from "../store/project";
import type { ProjectStore, ProjectSummary } from "../store/store";
import { TUTORIAL_STARTERS } from "../store/templates";
import { useSession } from "../editor/session";
import { SiteNav } from "../editor/SiteNav";
import { LEVELS, parseTutorial } from "./tutorial";

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

/** The tutorial library's editor for one (PresMaker, served by library.py): a page of its own. */
export const libraryEditUrl = (slug: string) => `/teacher/tutorials/${slug}/edit`;

/**
 * The library row (library.py) for a tutorial, to edit or link it: a
 * built-in becomes the teacher's own row, "<title> (copy)" (origin
 * builtin:<name>, found again if it's theirs already); their own is its row; someone else's shared one
 * is copied into theirs. Its slug.
 */
export async function libraryRowFor(key: string, title: string, mine: boolean): Promise<string> {
  const [kind, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "t" && mine) return name;
  const body = await tutorialMarkdown(key);
  // "(copy)": the built-in stays listed in the library beside the teacher's version of it.
  if (kind === "builtin") return (await api<{ slug: string }>("/api/library", { json: { origin: key, title: `${title} (copy)`, body } })).slug;
  return (await api<{ slug: string }>("/api/library", { json: { title, body } })).slug;
}

/** Start one: its starting game made in this person's games, and opened. */
export async function startTutorial(store: ProjectStore, key: string): Promise<void> {
  const p = await makeStarter(store, key, await tutorialMarkdown(key));
  location.hash = `#/p/${p.id}`;
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
  const [hidden, setHidden] = useState<string[]>([]);
  const [games, setGames] = useState<ProjectSummary[]>([]);
  const [teacher, setTeacher] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void fetch(new URL("tutorials/index.json", document.baseURI))
      .then((r) => r.json())
      .then((list: Entry[]) => setBuiltins(list.map((t) => ({ ...t, key: `builtin:${t.key}` }))), () => setProblem("The tutorials couldn't be loaded."));
    void api<{ tutorials: (Entry & { slug: string })[]; hidden?: string[]; teacher: boolean }>("/api/tutorials").then(
      (r) => {
        // With no server behind the editor, a static host answers with its own
        // page, not a list: the built-in tutorials are then all there is.
        if (!Array.isArray(r?.tutorials)) return;
        setOthers(r.tutorials);
        // Built-ins an admin took off the Learn page (the library's audience).
        setHidden(r.hidden ?? []);
        setTeacher(r.teacher);
      },
      () => undefined, // no server: the built-in ones are all there is
    );
    void store.list().then((l) => setGames(Array.isArray(l) ? l : []), () => undefined);
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
  const start = (e: Entry) => act(() => startTutorial(store, e.key));

  const all = [...builtins.filter((t) => !hidden.includes(t.key.slice("builtin:".length))), ...others];
  const levels = [...LEVELS, ...new Set(all.map((t) => t.level).filter((l) => !LEVELS.includes(l)))];
  const byKey = useMemo(() => new Map(games.filter((g) => g.tutorial).map((g) => [g.tutorial!.key, g])), [games]);
  return (
    <div className="site-page">
      <SiteNav at="learn" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>Tutorials</h1>
          {teacher && (
            <a className="btn go" href="#/library" data-testid="tutorial-new">
              Your tutorial library
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
                          <a className="btn small" href={libraryEditUrl(t.slug!)}>
                            Edit
                          </a>
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
