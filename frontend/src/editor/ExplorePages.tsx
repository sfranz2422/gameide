/**
 * The pages about published games: Explore (approved public games, for
 * anyone), a class's gallery (its members' games), and Approvals (a
 * teacher's queue: games waiting for Explore, reports, and every game their
 * students have published). The server decides who sees what
 * (backend/publishing.py); these only show it.
 */
import { useEffect, useState } from "react";
import { api } from "../store/api";
import { useSession } from "./session";
import { SiteNav, type NavPlace } from "./SiteNav";

interface Card {
  id: string;
  title: string;
  author: string;
  plays: number;
  likes: number;
  tags: string[];
  thumbnail: boolean;
  featured: boolean;
}

function GameCard({ g, extra }: { g: Card; extra?: React.ReactNode }) {
  return (
    <div className="game-card" data-testid="game-card">
      <a href={`/play/${g.id}`} className="game-card-link">
        {g.thumbnail ? <img src={`/api/play/${g.id}/thumbnail`} alt="" loading="lazy" /> : <div className="game-card-blank">▶</div>}
        <b>{g.title}</b>
      </a>
      <span className="muted small">
        {g.author} · {g.plays} plays · ♥ {g.likes}
      </span>
      {g.tags.length > 0 && <span className="muted small">{g.tags.join(", ")}</span>}
      {extra}
    </div>
  );
}

function PageHead({ title, children, at = "" }: { title: string; children?: React.ReactNode; at?: NavPlace }) {
  return (
    <>
      <SiteNav at={at} />
      <header className="page-head">
        <h1>{title}</h1>
        {children}
      </header>
    </>
  );
}

export function ExplorePage() {
  const [sort, setSort] = useState<"featured" | "new" | "popular">("new");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(0);
  const [games, setGames] = useState<Card[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ sort, page: String(page), ...(q ? { q } : {}), ...(tag ? { tag } : {}) });
      void api<{ games: Card[]; more: boolean; tags: string[] }>(`/api/explore?${params}`).then((r) => {
        setGames((g) => (page ? [...g, ...r.games] : r.games));
        setMore(r.more);
        setTags(r.tags);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [sort, q, tag, page]);
  const choose = (f: () => void) => {
    setPage(0);
    f();
  };
  return (
    <div className="explore-page">
      <PageHead title="Explore games" at="explore" />
      <ClassGalleryLinks />
      <div className="explore-controls">
        {(["featured", "new", "popular"] as const).map((s) => (
          <button key={s} className={`btn small${sort === s ? " on" : ""}`} onClick={() => choose(() => setSort(s))} data-testid={`explore-${s}`}>
            {s === "featured" ? "Featured" : s === "new" ? "Newest" : "Most played"}
          </button>
        ))}
        <input placeholder="Search" value={q} onChange={(e) => choose(() => setQ(e.target.value))} aria-label="Search games" data-testid="explore-search" />
        <select value={tag} onChange={(e) => choose(() => setTag(e.target.value))} aria-label="Kind of game">
          <option value="">Every kind</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="game-grid">
        {games.map((g) => (
          <GameCard key={g.id} g={g} />
        ))}
      </div>
      {!games.length && <p className="muted">No games here yet.</p>}
      {more && (
        <button className="btn" onClick={() => setPage((p) => p + 1)}>
          More
        </button>
      )}
    </div>
  );
}

export function GalleryPage({ classId }: { classId: number }) {
  const [data, setData] = useState<{ name: string; games: Card[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void api<{ name: string; games: Card[] }>(`/api/gallery/${classId}`).then(setData, (e: Error) => setProblem(e.message));
  }, [classId]);
  return (
    <div className="explore-page">
      <PageHead title={data ? `${data.name}: games` : "Class games"} />
      {problem && <p className="error-text">{problem}</p>}
      <div className="game-grid">{data?.games.map((g) => <GameCard key={g.id} g={g} />)}</div>
      {data && !data.games.length && <p className="muted">Nobody in this class has published a game yet.</p>}
    </div>
  );
}

interface ModRow extends Card {
  visibility: string;
  status: string;
  takenDown: boolean;
  owner: string;
  reports: string[];
}

interface Moderation {
  pending: ModRow[];
  reported: ModRow[];
  games: ModRow[];
  classes: { id: number; name: string; autoApprove: boolean }[];
  admin: boolean;
}

export function ModerationPage() {
  const [data, setData] = useState<Moderation | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = () => void api<Moderation>("/api/moderation").then(setData, (e: Error) => setProblem(e.message));
  useEffect(load, []);
  const act = async (id: string, action: string, note?: string) => {
    await api(`/api/moderation/${id}`, { json: { action, ...(note ? { note } : {}) } });
    load();
  };
  const button = (g: ModRow, action: string, label: string) => (
    <button className="btn small" onClick={() => void act(g.id, action, action === "takedown" ? (prompt("Why? The student sees this.") ?? "") : undefined)} data-testid={`mod-${action}-${g.id}`}>
      {label}
    </button>
  );
  return (
    <div className="explore-page">
      <PageHead title="Published games: approvals" at="moderation" />
      {problem && <p className="error-text">{problem}</p>}
      {data && (
        <>
          <h2>Waiting for approval ({data.pending.length})</h2>
          <p className="muted small">Students' games for Explore. Play each first: once approved, anyone can.</p>
          <div className="game-grid">
            {data.pending.map((g) => (
              <GameCard key={g.id} g={g} extra={<div className="row">{button(g, "approve", "Approve")}{button(g, "reject", "Not for Explore")}</div>} />
            ))}
          </div>
          {!data.pending.length && <p className="muted">Nothing waiting.</p>}

          <h2>Reported ({data.reported.length})</h2>
          <div className="game-grid">
            {data.reported.map((g) => (
              <GameCard
                key={g.id}
                g={g}
                extra={
                  <>
                    <ul className="reports">{g.reports.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    <div className="row">
                      {button(g, "takedown", "Take down")}
                      {button(g, "dismiss", "Nothing wrong")}
                    </div>
                  </>
                }
              />
            ))}
          </div>
          {!data.reported.length && <p className="muted">No reports.</p>}

          {data.classes.length > 0 && (
            <>
              <h2>Your classes</h2>
              {data.classes.map((c) => (
                <label key={c.id} className="check field">
                  <input
                    type="checkbox"
                    checked={c.autoApprove}
                    onChange={async (e) => {
                      await api(`/api/moderation/classes/${c.id}`, { json: { autoApprove: e.target.checked } });
                      load();
                    }}
                    data-testid={`auto-approve-${c.id}`}
                  />
                  {c.name}: put students' public games on Explore without waiting for me
                </label>
              ))}
            </>
          )}

          <h2>Every game {data.admin ? "on the site" : "your students have published"} ({data.games.length})</h2>
          <table className="mod-table">
            <tbody>
              {data.games.map((g) => (
                <tr key={g.id}>
                  <td>
                    <a href={`/play/${g.id}`}>{g.title}</a>
                  </td>
                  <td>{g.owner}</td>
                  <td>
                    {g.takenDown ? "taken down" : g.visibility === "public" ? `public (${g.status})` : g.visibility}
                  </td>
                  <td>
                    {g.takenDown ? button(g, "restore", "Restore") : button(g, "takedown", "Take down")}
                    {data.admin && (g.featured ? button(g, "unfeature", "Unfeature") : g.visibility === "public" && g.status === "approved" && button(g, "feature", "Feature"))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Your classes' galleries, on Explore: GameIDE's own classes only (publishing.py). */
function ClassGalleryLinks() {
  const { me } = useSession();
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (me.user) void api<{ classes: { id: number; name: string }[] }>("/api/my-classes").then((r) => setClasses(r.classes), () => undefined);
  }, [me.user]);
  if (!classes.length) return null;
  return (
    <nav className="published-links" aria-label="Your classes' games">
      {classes.map((c) => (
        <a key={c.id} className="btn small" href={`#/gallery/${c.id}`}>
          {c.name}'s games
        </a>
      ))}
    </nav>
  );
}
