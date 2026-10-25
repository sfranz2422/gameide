/**
 * The front page: your games in this browser, and new ones from templates.
 */
import { useEffect, useState } from "react";
import type { ProjectStore, ProjectSummary } from "../store/store";
import { TEMPLATES } from "../store/templates";
import { Icon } from "./ui/icons";
import { ThemeToggle } from "./ui/ThemeToggle";

function ago(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProjectsPage({ store }: { store: ProjectStore }) {
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);

  const refresh = () =>
    store
      .list()
      .then(setList)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (key: string) => {
    setMaking(true);
    try {
      const { project, assets } = await TEMPLATES.find((t) => t.key === key)!.build();
      for (const [id, blob] of assets) await store.putAsset(project.id, id, blob);
      await store.save(project);
      location.hash = `#/p/${project.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMaking(false);
    }
  };

  return (
    <div className="projects-page">
      <header className="topbar">
        <span className="brand">GameIDE</span>
        <span className="spacer" />
        <ThemeToggle />
      </header>
      <main className="projects-main">
        {error && <p className="banner error">{error}</p>}
        <h2>Make a new game</h2>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.key} className="template-card" disabled={making} onClick={() => create(t.key)} data-testid={`template-${t.key}`}>
              <b>{t.label}</b>
              <span>{t.description}</span>
            </button>
          ))}
        </div>
        <h2>Your games</h2>
        <p className="muted small">Saved in this browser. Signing in to keep them anywhere comes in a later phase.</p>
        {list === null ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="project-list">
            {list.map((p) => (
              <li key={p.id}>
                <a href={`#/p/${p.id}`} className="project-link" data-testid="project-link">
                  <b>{p.name}</b>
                  <span className="muted small">{ago(p.modified)}</span>
                </a>
                <button
                  className="icon-btn"
                  aria-label={`Delete ${p.name}`}
                  onClick={async () => {
                    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
                    await store.remove(p.id);
                    void refresh();
                  }}
                >
                  {Icon.trash()}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
