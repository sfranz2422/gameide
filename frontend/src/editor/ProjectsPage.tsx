/**
 * The front page: your games, new ones from templates, and Import.
 *
 * Signed in, "Your games" are the account's, and anything made in this
 * browser before signing in is listed apart, with Move to my account — the
 * same idea as PyIDE's rescue: signing in must never make earlier work
 * vanish from view, and moving it is one click.
 */
import { useEffect, useRef, useState } from "react";
import { signInUrl } from "../store/api";
import { newId, type Project } from "../store/project";
import { loadAssets, type ProjectStore, type ProjectSummary } from "../store/store";
import { TEMPLATES } from "../store/templates";
import { importZip } from "../store/zip";
import { AccountMenu } from "./AccountBits";
import { useSession } from "./session";
import { Icon } from "./ui/icons";
import { ThemeToggle } from "./ui/ThemeToggle";

function ago(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Saves a project and its pictures into a store, and confirms it got there. */
async function putProject(store: ProjectStore, project: Project, assets: Map<string, Blob>) {
  for (const [id, blob] of assets) await store.putAsset(project.id, id, blob);
  const outcome = await store.save(project);
  if (outcome.state === "error") throw new Error(outcome.message ?? "It couldn't be saved.");
  return outcome;
}

export function ProjectsPage() {
  const { me, store, cloud, browser } = useSession();
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [local, setLocal] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      setList(await store.list());
      setLocal(cloud ? await browser.list() : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const act = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const create = (key: string) =>
    act(async () => {
      const { project, assets } = await TEMPLATES.find((t) => t.key === key)!.build();
      await putProject(store, project, assets);
      location.hash = `#/p/${project.id}`;
    });

  const importFile = (file: File) =>
    act(async () => {
      const names = (list ?? []).map((p) => p.name);
      const { project, assets } = await importZip(file, names);
      await putProject(store, project, assets);
      location.hash = `#/p/${project.id}`;
    });

  /** A game from this browser into the account, then out of the browser. */
  const move = (summary: ProjectSummary) =>
    act(async () => {
      const project = await browser.load(summary.id);
      if (!project) return;
      const assets = await loadAssets(browser, project);
      // Its id may already be used on the server (moved before, from another
      // browser); then it goes up as a new project rather than over that one.
      const existing = (list ?? []).some((p) => p.id === project.id);
      if (existing) project.id = newId();
      const outcome = await putProject(store, project, assets);
      if (outcome.state !== "saved")
        throw new Error("Couldn't reach your account just now, so it stays in this browser. Try again when you're online.");
      await browser.remove(summary.id);
      await refresh();
    });

  return (
    <div className="projects-page">
      <header className="topbar">
        <span className="brand">GameIDE</span>
        <span className="spacer" />
        <AccountMenu />
        <ThemeToggle />
      </header>
      <main className="projects-main">
        {error && (
          <p className="banner error" role="alert">
            {error}
          </p>
        )}
        <h2>Make a new game</h2>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.key} className="template-card" disabled={busy} onClick={() => create(t.key)} data-testid={`template-${t.key}`}>
              <b>{t.label}</b>
              <span>{t.description}</span>
            </button>
          ))}
          <button className="template-card" disabled={busy} onClick={() => fileInput.current?.click()} data-testid="import-zip">
            <b>Import a game</b>
            <span>Open a .zip exported from GameIDE.</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            hidden
            data-testid="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importFile(f);
            }}
          />
        </div>

        <h2>Your games</h2>
        {cloud ? (
          <p className="muted small">Saved to your account, so they're there on any computer you sign in on.</p>
        ) : me.loginEnabled ? (
          <p className="muted small">
            Saved in this browser only. <a href={signInUrl(me)}>Sign in</a> to keep them in your account and use them anywhere.
          </p>
        ) : (
          <p className="muted small">Saved in this browser.</p>
        )}
        <ProjectList items={list} store={store} refresh={refresh} />

        {cloud && local.length > 0 && (
          <section className="local-section" data-testid="browser-only">
            <h2>In this browser only</h2>
            <p className="muted small">Made before you signed in. Move them into your account to keep them safe and open them anywhere.</p>
            <ul className="project-list">
              {local.map((p) => (
                <li key={p.id}>
                  <span className="project-link">
                    <b>{p.name}</b>
                    <span className="muted small">{ago(p.modified)}</span>
                  </span>
                  <button className="btn small" disabled={busy} onClick={() => move(p)} data-testid="move-to-account">
                    Move to my account
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function ProjectList({ items, store, refresh }: { items: ProjectSummary[] | null; store: ProjectStore; refresh: () => Promise<void> }) {
  if (items === null) return <p className="muted">Loading…</p>;
  if (items.length === 0) return <p className="muted">None yet.</p>;
  return (
    <ul className="project-list">
      {items.map((p) => (
        <li key={p.id}>
          <a href={`#/p/${p.id}`} className="project-link" data-testid="project-link">
            <b>{p.name}</b>
            <span className="muted small">
              {p.unsynced && <span className="unsynced">not yet in your account · </span>}
              {ago(p.modified)}
            </span>
          </a>
          <button
            className="icon-btn"
            aria-label={`Delete ${p.name}`}
            onClick={async () => {
              if (!confirm(`Delete "${p.name}"?`)) return;
              try {
                await store.remove(p.id);
              } catch (e) {
                alert(e instanceof Error ? e.message : String(e));
              }
              await refresh();
            }}
          >
            {Icon.trash()}
          </button>
        </li>
      ))}
    </ul>
  );
}
