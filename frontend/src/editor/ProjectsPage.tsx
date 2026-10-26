/**
 * "My Games": a shelf of cartridges — each game's picture on its label (its
 * "icon" sprite, or a badge made from its id), its name, size, when it was
 * last changed and whether it's published, with Export, Clone and Delete
 * along the bottom. The first slot is New game (from a template); Import
 * and the search box are above. Inspired by microStudio's project list, but
 * deliberately not a copy of it.
 *
 * Signed in, these are the account's games, and anything made in this
 * browser before signing in is listed apart, with Move to my account — the
 * same idea as PyIDE's rescue: signing in must never make earlier work
 * vanish from view, and moving it is one click.
 */
import { useEffect, useRef, useState } from "react";
import { signInUrl } from "../store/api";
import { newId, type Project } from "../store/project";
import { loadAssets, type ProjectStore, type ProjectSummary } from "../store/store";
import { TEMPLATES } from "../store/templates";
import { download, exportZip, importZip, safeFileName } from "../store/zip";
import { gameBadge } from "../store/gameBadge";
import { useSession } from "./session";
import { SiteNav } from "./SiteNav";
import { Icon } from "./ui/icons";

/** Saves a project and its files into a store, and confirms it got there. */
async function putProject(store: ProjectStore, project: Project, assets: Map<string, Blob>) {
  for (const [id, blob] of assets) await store.putAsset(project.id, id, blob);
  const outcome = await store.save(project);
  if (outcome.state === "error") throw new Error(outcome.message ?? "It couldn't be saved.");
  return outcome;
}

function sizeText(bytes: number | undefined) {
  if (bytes === undefined) return null;
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function ProjectsPage() {
  const { me, store, cloud, browser } = useSession();
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [local, setLocal] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
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

  const exportGame = (p: ProjectSummary) =>
    act(async () => {
      const project = await store.load(p.id);
      if (!project) throw new Error("That game couldn't be opened.");
      download(await exportZip(project, (id) => store.getAsset(p.id, id)), `${safeFileName(project.name)}.zip`);
    });

  /** A copy with a new id and its own copies of the files: changing one never changes the other. */
  const clone = (p: ProjectSummary) =>
    act(async () => {
      const project = await store.load(p.id);
      if (!project) throw new Error("That game couldn't be opened.");
      const assets = await loadAssets(store, project);
      const now = new Date().toISOString();
      const copy: Project = { ...structuredClone(project), id: newId(), name: `${project.name} (copy)`, created: now, modified: now };
      await putProject(store, copy, assets);
      await refresh();
    });

  const remove = (p: ProjectSummary) =>
    act(async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      await store.remove(p.id);
      await refresh();
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

  const shown = (list ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="site-page">
      <SiteNav at="games" />
      <main className="games-main">
        <div className="games-head">
          <h1>My Games</h1>
          <button className="btn" disabled={busy} onClick={() => fileInput.current?.click()} data-testid="import-zip" title="A game exported from GameIDE as a .zip">
            {Icon.upload()} Import a game
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
          <span className="spacer" />
          <label className="games-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search your games" />
            {Icon.search(18)}
          </label>
        </div>
        <p className="muted small games-where">
          {cloud ? (
            "Saved to your account, so they're there on any computer you sign in on."
          ) : me.loginEnabled ? (
            <>
              Saved in this browser only. <a href={signInUrl(me)}>Sign in</a> to keep them in your account and use them anywhere.
            </>
          ) : (
            "Saved in this browser."
          )}
        </p>
        {error && (
          <p className="banner error" role="alert">
            {error}
          </p>
        )}

        {list === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="game-cards">
            <button className="new-game-slot" disabled={busy} onClick={() => setCreating(true)} data-testid="create-game">
              <span className="new-game-plus">{Icon.plus()}</span>
              <b>New game</b>
              <span className="muted small">{list.length ? "From a template, or from nothing" : "Make your first one"}</span>
            </button>
            {shown.map((p) => (
              <GameCard key={p.id} p={p} store={store} busy={busy} exportGame={exportGame} clone={clone} remove={remove} />
            ))}
          </div>
        )}

        {cloud && local.length > 0 && (
          <section className="local-section" data-testid="browser-only">
            <h2>In this browser only</h2>
            <p className="muted small">Made before you signed in. Move them into your account to keep them safe and open them anywhere.</p>
            <ul className="project-list">
              {local.map((p) => (
                <li key={p.id}>
                  <span className="project-link">
                    <b>{p.name}</b>
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
      {creating && (
        <div className="modal-back" onPointerDown={() => setCreating(false)}>
          <div className="modal wide" role="dialog" aria-label="Create a new game" onPointerDown={(e) => e.stopPropagation()}>
            <h2>Create a new game</h2>
            <p className="muted">Start from nothing, or from a game that already works and change it.</p>
            <div className="template-grid">
              {TEMPLATES.map((t) => (
                <button key={t.key} className="template-card" disabled={busy} onClick={() => void create(t.key)} data-testid={`template-${t.key}`}>
                  <b>{t.label}</b>
                  <span>{t.description}</span>
                </button>
              ))}
            </div>
            <div className="modal-foot">
              <span className="spacer" />
              <button className="btn" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The game's picture: its "icon" sprite, or a game controller like microStudio's. */
function useIcon(store: ProjectStore, p: ProjectSummary): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!p.icon) return setUrl(null);
    let made: string | null = null;
    let alive = true;
    void store.getAsset(p.id, p.icon).then((b) => {
      if (!alive || !b) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [store, p.id, p.icon]);
  return url;
}

/** A game's badge (gameBadge.ts), for games with no "icon" sprite. */
export function BadgeIcon({ id }: { id: string }) {
  const b = gameBadge(id);
  return (
    <svg viewBox={`-1 -1 ${b.cells.length + 2} ${b.cells.length + 2}`} className="badge-icon" aria-hidden="true" shapeRendering="crispEdges">
      {b.cells.flatMap((row, y) => row.map((c, x) => (c ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={c === 2 ? b.light : b.body} /> : null)))}
    </svg>
  );
}

function changedText(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1 && d.getDate() === new Date().getDate()) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function GameCard({
  p,
  store,
  busy,
  exportGame,
  clone,
  remove,
}: {
  p: ProjectSummary;
  store: ProjectStore;
  busy: boolean;
  exportGame: (p: ProjectSummary) => void;
  clone: (p: ProjectSummary) => void;
  remove: (p: ProjectSummary) => void;
}) {
  const icon = useIcon(store, p);
  const badge = gameBadge(p.id);
  return (
    <div className="project-card" data-testid="project-card">
      <a
        href={`#/p/${p.id}`}
        className={`project-card-icon${icon ? " has-icon" : ""}`}
        style={icon ? undefined : { background: badge.back }}
        tabIndex={-1}
        title={icon ? undefined : 'Name a sprite "icon" to make it this game\'s picture'}
      >
        {icon ? <img src={icon} alt="" /> : <BadgeIcon id={p.id} />}
      </a>
      <div className="project-card-label">
        <a href={`#/p/${p.id}`} className="project-card-title" data-testid="project-link">
          {p.name}
        </a>
        <span className="muted small">
          {[sizeText(p.size), p.modified && `changed ${changedText(p.modified)}`].filter(Boolean).join(" · ")}
        </span>
        <div className="pills">
          {p.published && <span className={`pill published ${p.published.replace(" ", "-")}`}>{p.published}</span>}
          {p.unsynced && <span className="pill warn">not yet in your account</span>}
        </div>
      </div>
      <div className="project-card-actions">
        <button className="card-act" disabled={busy} onClick={() => exportGame(p)} title="Download it as a .zip">
          {Icon.download()} Export
        </button>
        <button className="card-act" disabled={busy} onClick={() => clone(p)} data-testid="clone-game">
          {Icon.copy()} Clone
        </button>
        <button className="card-act danger" disabled={busy} onClick={() => remove(p)} aria-label={`Delete ${p.name}`} title="Delete">
          {Icon.trash()}
        </button>
      </div>
    </div>
  );
}
