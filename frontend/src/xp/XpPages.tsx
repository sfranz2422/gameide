/**
 * XP on the page (Phase 10b). The server (backend/rewards.py, with xp.py
 * shared by all four editors) decides everything; these show it:
 *
 *   XpToasts      the pop-up when XP arrives, on every page, editor too
 *   XpCard        a student's level, badges, tokens, boards, quests, shop
 *   AvatarPicker  choose a picture, or send a photo for approval
 *   XpLogPage     #/xp — every award, from every editor, and why
 *   ShopPage      #/shop — the teacher's token shop (the same shelf in every editor)
 *   ClassXpPage   #/class/<id>/xp — the teacher's: give and take XP, random
 *                 events, tokens, requests and photos waiting
 *   ClassBoard    a class's leaderboard and its latest random event
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../store/api";
import { useSession } from "../editor/session";
import { SiteNav } from "../editor/SiteNav";
import { whenText } from "../editor/AssignmentBits";
import { Avatar } from "./avatar";

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  xp: number;
  have: boolean;
}

interface Summary {
  xp: number;
  level: number;
  title: string;
  progress: number;
  to_next: number;
  tokens: number;
  tokens_earned: number;
  token_every: number;
  badges: Badge[];
}

interface BoardRow {
  place: number;
  name: string;
  xp: number;
  level: number;
  avatar: string;
  me: boolean;
}

// ---------------------------------------------------------------- pop-ups

const NEWS_KEY = "gameide-xp-news";

/**
 * XP that reached a student from elsewhere — the teacher's reward, a random
 * event, a quest finished by a score — pops up on whatever page they're on,
 * and a run that paid pops up in the editor as it happens. Polled every 20
 * seconds while the page is visible; a GET to /api/, so it never counts as
 * activity. The mark of what was already shown is per browser AND per
 * student, so a shared Chromebook doesn't show one student another's XP.
 */
export function XpToasts() {
  const { me } = useSession();
  const [shown, setShown] = useState<{ key: number; xp: number; reason: string }[]>([]);
  const next = useRef(0);
  const push = useCallback((xp: number, reason: string) => {
    const key = ++next.current;
    setShown((s) => [...s, { key, xp, reason }].slice(-4));
    setTimeout(() => setShown((s) => s.filter((t) => t.key !== key)), 5000);
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ xp: number; reason: string }>).detail;
      push(d.xp, d.reason);
    };
    window.addEventListener("gameide-xp", on);
    return () => window.removeEventListener("gameide-xp", on);
  }, [push]);

  const student = !!me.user && !me.user.teacher;
  useEffect(() => {
    if (!student) return;
    let alive = true;
    const poll = async () => {
      if (document.hidden) return;
      let mark: { user: number; after: number } | null = null;
      try {
        mark = JSON.parse(localStorage.getItem(NEWS_KEY) ?? "null");
      } catch {
        /* none */
      }
      const after = mark && mark.user === me.user!.id ? `?after=${mark.after}` : "";
      try {
        const r = await api<{ user: number | null; latest: number; awards: { xp: number; reason: string }[] }>(`/api/me/xp/news${after}`);
        if (!alive || r.user === null) return;
        for (const a of r.awards) push(a.xp, a.reason);
        try {
          localStorage.setItem(NEWS_KEY, JSON.stringify({ user: r.user, after: r.latest }));
        } catch {
          /* private window: it asks from the start each time, and shows nothing old */
        }
      } catch {
        /* offline: try again next time */
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 20_000);
    const onShow = () => !document.hidden && void poll();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [student, me.user, push]);

  return (
    <div className="xp-toasts" aria-live="polite">
      {shown.map((t) => (
        <div key={t.key} className={`xp-toast${t.xp < 0 ? " minus" : ""}`} data-testid="xp-toast">
          <b>
            {t.xp > 0 ? "+" : ""}
            {t.xp} XP
          </b>
          <span>{t.reason}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- a student's card

interface Card extends Summary {
  avatar: string;
  avatars: { id: string; label: string; level: number }[];
  earns: boolean;
  photo: string;
  pending: string;
  hidden?: boolean;
  recent?: { xp: number; reason: string; when: string }[];
  ranks?: { name: string; of: number; place: number | null; top: BoardRow[]; meRow: BoardRow | null; classId: number }[];
  quests?: { title: string; xp: number; class: string; slug: string }[];
  held?: number;
  free?: number;
  shops?: { teacher: string; items: { id: number; name: string; cost: number; description: string }[] }[];
  requests?: { id: number; name: string; cost: number; status: string; when: string }[];
  runMinutes?: number;
  runXp?: number;
}

export function LevelBar({ s }: { s: Summary }) {
  return (
    <div className="xp-level">
      <div className="xp-level-line">
        <b>
          Level {s.level} · {s.title}
        </b>
        <span className="muted small">
          {s.xp} XP · {s.to_next} to level {s.level + 1}
        </span>
      </div>
      <div className="xp-bar" role="progressbar" aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${s.progress}%` }} />
      </div>
    </div>
  );
}

function BoardList({ rows, extra }: { rows: BoardRow[]; extra?: BoardRow | null }) {
  const row = (r: BoardRow) => (
    <li key={`${r.place}${r.name}`} className={r.me ? "me" : ""}>
      <span className="board-place">{r.place}</span>
      <Avatar id={r.avatar} size={28} />
      <span className="board-name">{r.name}</span>
      <span className="muted small">Lv {r.level}</span>
      <b>{r.xp} XP</b>
    </li>
  );
  return (
    <ol className="board" data-testid="board">
      {rows.map(row)}
      {extra && (
        <>
          <li className="board-gap">⋯</li>
          {row(extra)}
        </>
      )}
    </ol>
  );
}

export function XpCard() {
  const [card, setCard] = useState<Card | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const load = useCallback(() => void api<Card>("/api/me/xp").then(setCard, (e) => setProblem(message(e))), []);
  useEffect(load, [load]);
  if (problem) return <p className="banner error">{problem}</p>;
  if (!card || !card.earns) return null;
  const act = (f: () => Promise<unknown>) =>
    f().then(load, (e) => {
      setProblem(message(e));
      setTimeout(() => setProblem(null), 4000);
    });
  return (
    <section className="xp-card" data-testid="xp-card">
      <div className="xp-card-head">
        <button className="avatar-btn" onClick={() => setPicking(true)} title="Choose your picture" data-testid="avatar-choose">
          <Avatar id={card.avatar} size={72} />
        </button>
        <div className="xp-card-main">
          <LevelBar s={card} />
          <div className="xp-badges">
            {card.badges.map((b) => (
              <span key={b.id} className={`xp-badge${b.have ? " have" : ""}`} title={`${b.name} — ${b.xp} XP`}>
                {b.icon}
              </span>
            ))}
          </div>
        </div>
        <div className="xp-tokens" title={`One token for every ${card.token_every} XP. Your teacher's shop says what they buy.`}>
          <b data-testid="tokens">{card.free ?? card.tokens}</b>
          <span className="muted small">token{(card.free ?? card.tokens) === 1 ? "" : "s"} to spend</span>
        </div>
      </div>
      <p className="muted small">
        Games that run earn {card.runXp} XP about every half hour you work on them
        {card.runMinutes ? ` (the next in about ${card.runMinutes} min)` : ""}, and your teacher gives XP for quests and good work.{" "}
        <a href="#/xp">Every XP you've had</a>
      </p>

      <div className="xp-columns">
        {card.ranks && card.ranks.length > 0 && (
          <div>
            <h3>Leaderboards</h3>
            {card.hidden ? (
              <p className="muted small">You're hidden from the leaderboards. You still earn XP.</p>
            ) : (
              card.ranks.map((r) => (
                <div key={r.name} className="xp-rank">
                  <a href={`#/class/${r.classId}`}>
                    {r.name}
                    {r.place ? ` — you're #${r.place} of ${r.of}` : ""}
                  </a>
                  <BoardList rows={r.top} extra={r.meRow} />
                </div>
              ))
            )}
            <label className="check class-check small">
              <input type="checkbox" checked={!!card.hidden} onChange={(e) => void act(() => api("/api/me/board", { json: { hidden: e.target.checked } }))} data-testid="board-hide" />
              Hide me from the leaderboards
            </label>
          </div>
        )}
        <div>
          {card.quests && card.quests.length > 0 && (
            <>
              <h3>Quests</h3>
              <ul className="xp-quests">
                {card.quests.map((q) => (
                  <li key={q.slug}>
                    <a href={`#/a/${q.slug}`}>{q.title}</a> <span className="muted small">{q.class}</span> <span className="pill quest">+{q.xp} XP for full marks</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {card.shops?.map((shop) => (
            <div key={shop.teacher} className="xp-shop">
              <h3>{card.shops!.length > 1 ? `${shop.teacher}'s token shop` : "Token shop"}</h3>
              <ul>
                {shop.items.map((i) => (
                  <li key={i.id}>
                    <span>
                      <b>{i.name}</b> <span className="muted small">{i.description}</span>
                    </span>
                    <button
                      className="btn small"
                      disabled={(card.free ?? 0) < i.cost}
                      onClick={() => void act(() => api("/api/shop/request", { json: { item: i.id } }))}
                      data-testid="shop-ask"
                    >
                      Ask · {i.cost} token{i.cost === 1 ? "" : "s"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {card.requests && card.requests.length > 0 && (
            <>
              <h3>Your requests</h3>
              <ul className="xp-requests">
                {card.requests.map((r) => (
                  <li key={r.id}>
                    {r.name} <span className="muted small">· {r.cost} token{r.cost === 1 ? "" : "s"} · {r.status === "pending" ? "waiting for your teacher" : r.status}</span>
                    {r.status === "pending" && (
                      <button className="link-btn small" onClick={() => void act(() => api(`/api/shop/request/${r.id}/cancel`, { json: {} }))}>
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {picking && (
        <AvatarPicker
          card={card}
          onClose={() => {
            setPicking(false);
            load();
          }}
        />
      )}
    </section>
  );
}

/** A photo, cropped square to the middle and shrunk to 400px before it's sent, as PyIDE's page does. */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(400, side);
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("That picture couldn't be read."))), "image/jpeg", 0.85));
}

function AvatarPicker({ card, onClose }: { card: Card; onClose: () => void }) {
  const [current, setCurrent] = useState(card.avatar);
  const [pending, setPending] = useState(card.pending);
  const [problem, setProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const choose = (avatar: string) =>
    api<{ avatar: string }>("/api/me/avatar", { json: { avatar } }).then(
      (r) => setCurrent(r.avatar),
      (e) => setProblem(message(e)),
    );
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className="modal wide" role="dialog" aria-label="Choose your picture" onPointerDown={(e) => e.stopPropagation()}>
        <h2>Your picture</h2>
        <p className="muted small">It's you on the leaderboards, in every editor. More unlock as you level up.</p>
        <div className="avatar-grid">
          {card.avatars.map((a) => {
            const locked = a.level > card.level;
            return (
              <button
                key={a.id}
                className={`avatar-pick${current === a.id ? " on" : ""}`}
                disabled={locked}
                onClick={() => void choose(a.id)}
                title={locked ? `Unlocks at level ${a.level}` : a.label}
                data-testid={`avatar-${a.id}`}
              >
                <Avatar id={a.id} size={64} />
                <span className="small">{locked ? `🔒 Level ${a.level}` : a.label}</span>
              </button>
            );
          })}
          {card.photo && (
            <button className={`avatar-pick${current === card.photo ? " on" : ""}`} onClick={() => void choose("photo")}>
              <Avatar id={card.photo} size={64} />
              <span className="small">Your photo</span>
            </button>
          )}
        </div>
        <p className="small">
          Or a photo of your own: your teacher sees it first, and it's your picture once they approve it.{" "}
          <button className="link-btn" onClick={() => file.current?.click()} data-testid="photo-upload">
            Send a photo
          </button>
          {pending && <span className="muted"> · one is waiting for your teacher</span>}
        </p>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const r = await api<{ pending: string }>("/api/me/photo", { body: await squarePhoto(f) });
              setPending(r.pending);
            } catch (err) {
              setProblem(message(err));
            }
          }}
        />
        {problem && <p className="error-text">{problem}</p>}
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- #/xp

export function XpLogPage() {
  const [data, setData] = useState<{ summary: Summary; awards: { xp: number; reason: string; app: string; when: string }[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => void api<NonNullable<typeof data>>("/api/me/xp/all").then(setData, (e) => setProblem(message(e))), []);
  const APPS: Record<string, string> = { pyide: "PyIDE", webide: "WebIDE", flaskide: "FlaskIDE", gameide: "GameIDE" };
  return (
    <div className="site-page">
      <SiteNav at="classes" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>Your XP</h1>
        </header>
        {problem && <p className="banner error">{problem}</p>}
        {data && (
          <>
            <LevelBar s={data.summary} />
            <table className="mod-table xp-log">
              <tbody>
                {data.awards.map((a, i) => (
                  <tr key={i} data-testid="xp-row">
                    <td className={a.xp < 0 ? "minus" : "plus"}>
                      {a.xp > 0 ? "+" : ""}
                      {a.xp}
                    </td>
                    <td>{a.reason}</td>
                    <td className="muted small">{APPS[a.app] ?? a.app}</td>
                    <td className="muted small">{whenText(a.when)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.awards.length && <p className="muted">No XP yet. Run a game you've changed, and it comes.</p>}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- #/shop

interface Item {
  id: number;
  name: string;
  cost: number;
  description: string;
  active: boolean;
}

export function ShopPage() {
  const [data, setData] = useState<{ items: Item[]; tokenEvery: number; maxCost: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("1");
  const [description, setDescription] = useState("");
  const load = useCallback(() => void api<NonNullable<typeof data>>("/api/shop").then(setData, (e) => setProblem(message(e))), []);
  useEffect(load, [load]);
  const change = (id: number, fields: Partial<Item>) => api(`/api/shop/item/${id}`, { json: fields }).then(load, (e) => setProblem(message(e)));
  return (
    <div className="site-page">
      <SiteNav at="classes" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>Token shop</h1>
        </header>
        <p className="muted">
          What your students' tokens buy — one token for every {data?.tokenEvery ?? 1000} XP. It's one shop for all your classes, the same in PyIDE,
          WebIDE and FlaskIDE. Students ask from their Classes page; you approve on each class's XP page, which spends the tokens.
        </p>
        {problem && <p className="banner error">{problem}</p>}
        <table className="mod-table shop-table">
          <tbody>
            {data?.items.map((i) => (
              <tr key={i.id} className={i.active ? "" : "off-shelf"} data-testid="shop-item">
                <td>
                  <input defaultValue={i.name} onBlur={(e) => e.target.value !== i.name && void change(i.id, { name: e.target.value })} aria-label="Name" />
                </td>
                <td>
                  <input defaultValue={i.description} onBlur={(e) => e.target.value !== i.description && void change(i.id, { description: e.target.value })} aria-label="What it is" className="wide-input" />
                </td>
                <td>
                  <input type="number" min={1} max={data.maxCost} defaultValue={i.cost} onBlur={(e) => Number(e.target.value) !== i.cost && void change(i.id, { cost: Number(e.target.value) })} aria-label="Tokens" /> tokens
                </td>
                <td>
                  <button className="btn small" onClick={() => void change(i.id, { active: !i.active })}>
                    {i.active ? "Take off the shelf" : "Put back"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="row shop-new"
          onSubmit={(e) => {
            e.preventDefault();
            void api("/api/shop/item", { json: { name, cost, description } }).then(
              () => {
                setName("");
                setDescription("");
                load();
              },
              (err) => setProblem(message(err)),
            );
          }}
        >
          <input placeholder="New item" value={name} onChange={(e) => setName(e.target.value)} data-testid="shop-new-name" />
          <input placeholder="What it is" value={description} onChange={(e) => setDescription(e.target.value)} className="wide-input" />
          <input type="number" min={1} value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Tokens" />
          <button className="btn go" disabled={!name.trim()} data-testid="shop-new-go">
            Add
          </button>
        </form>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- #/class/<id>/xp

interface XpStudent extends Partial<Summary> {
  id: number | null;
  name: string;
  email: string;
  avatar?: string;
  hidden?: boolean;
  held?: number;
}

interface EventOut {
  id: number;
  title: string;
  text: string;
  icon: string;
  when: string;
  undone: boolean;
  hits: { name: string; xp: number }[];
}

interface ClassXp {
  name: string;
  students: XpStudent[];
  grantLimit: number;
  behaviors: { reason: string; xp: number }[];
  requests: { id: number; name: string; cost: number; student: string }[];
  photos: { id: number; url: string; name: string }[];
  events: EventOut[];
}

export function ClassXpPage({ classId }: { classId: number }) {
  const [data, setData] = useState<ClassXp | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("");
  const [showing, setShowing] = useState<EventOut | null>(null);
  const load = useCallback(() => void api<ClassXp>(`/api/classes/${classId}/xp`).then(setData, (e) => setProblem(message(e))), [classId]);
  useEffect(load, [load]);
  const act = (f: () => Promise<unknown>) => {
    setProblem(null);
    return f().then(load, (e) => setProblem(message(e)));
  };
  const signedIn = data?.students.filter((s) => s.id !== null) ?? [];
  const tick = (id: number) =>
    setTicked((t) => {
      const n = new Set(t);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="site-page">
      <SiteNav at="classes" />
      <main className="explore-page class-page">
        <header className="page-head">
          <h1>{data?.name ?? "Class"}: XP and tokens</h1>
          <a href={`#/class/${classId}`}>Back to the class</a>
          <a href="#/shop">Token shop</a>
        </header>
        {problem && (
          <p className="banner error" role="alert">
            {problem}
          </p>
        )}
        {note && <p className="banner">{note}</p>}
        {data && (
          <>
            <section className="xp-give">
              <select
                value=""
                onChange={(e) => {
                  const b = data.behaviors[Number(e.target.value)];
                  if (b) {
                    setAmount(String(b.xp));
                    setReason(b.reason);
                  }
                }}
                aria-label="A reason"
                data-testid="behavior"
              >
                <option value="">Pick a reason…</option>
                {data.behaviors.map((b, i) => (
                  <option key={b.reason} value={i}>
                    {b.reason} ({b.xp > 0 ? "+" : ""}
                    {b.xp})
                  </option>
                ))}
              </select>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="XP" className="xp-amount" data-testid="give-amount" />
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason the student sees" className="wide-input" data-testid="give-reason" />
              <button
                className="btn go"
                disabled={!ticked.size || !Number(amount)}
                onClick={() =>
                  void act(async () => {
                    const r = await api<{ skipped: string[] }>(`/api/classes/${classId}/xp`, { json: { students: [...ticked], xp: Number(amount), reason } });
                    setNote(`Done.${r.skipped.length ? ` ${r.skipped.join(", ")} had no XP to take.` : ""}`);
                    setTicked(new Set());
                  })
                }
                data-testid="give-go"
              >
                Give to {ticked.size || "…"}
              </button>
              <span className="spacer" />
              <button
                className="btn blue"
                onClick={() =>
                  void act(async () => {
                    const r = await api<{ event: EventOut }>(`/api/classes/${classId}/event`, { json: {} });
                    setShowing(r.event);
                  })
                }
                data-testid="random-event"
              >
                🎲 Random event
              </button>
            </section>

            <table className="mod-table xp-roster">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Everyone"
                      checked={signedIn.length > 0 && ticked.size === signedIn.length}
                      onChange={(e) => setTicked(e.target.checked ? new Set(signedIn.map((s) => s.id!)) : new Set())}
                    />
                  </th>
                  <th>Student</th>
                  <th>XP</th>
                  <th>Level</th>
                  <th>Tokens</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.email} data-testid="xp-student">
                    <td>{s.id !== null && <input type="checkbox" checked={ticked.has(s.id)} onChange={() => tick(s.id!)} aria-label={`Choose ${s.name}`} />}</td>
                    <td className="xp-who">
                      <Avatar id={s.avatar} size={28} /> {s.name}
                      {s.hidden && <span className="muted small"> (hidden from boards)</span>}
                    </td>
                    {s.id === null ? (
                      <td colSpan={4} className="muted small">
                        hasn't signed in yet
                      </td>
                    ) : (
                      <>
                        <td>
                          <b>{s.xp}</b>
                        </td>
                        <td>
                          {s.level} <span className="muted small">{s.title}</span>
                        </td>
                        <td>
                          {s.tokens}
                          {s.held ? <span className="muted small"> ({s.held} asked for)</span> : null}
                        </td>
                        <td>
                          <button className="btn small" disabled={!s.tokens} onClick={() => confirm(`Use one of ${s.name}'s tokens?`) && void act(() => api(`/api/classes/${classId}/tokens`, { json: { student: s.id } }))}>
                            Use a token
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {data.requests.length > 0 && (
              <section className="class-section">
                <h2>Waiting for you</h2>
                <ul className="xp-requests">
                  {data.requests.map((r) => (
                    <li key={r.id} data-testid="request">
                      <b>{r.student}</b> asks for {r.name} ({r.cost} token{r.cost === 1 ? "" : "s"}){" "}
                      <button className="btn small go" onClick={() => void act(() => api(`/api/shop/request/${r.id}/approve`, { json: {} }))} data-testid="request-approve">
                        Approve
                      </button>{" "}
                      <button className="btn small" onClick={() => void act(() => api(`/api/shop/request/${r.id}/decline`, { json: {} }))}>
                        Decline
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.photos.length > 0 && (
              <section className="class-section">
                <h2>Photos to approve</h2>
                <div className="xp-photos">
                  {data.photos.map((p) => (
                    <div key={p.id} className="xp-photo">
                      <img src={p.url} alt={`${p.name}'s photo`} />
                      <span>{p.name}</span>
                      <div className="row">
                        <button className="btn small go" onClick={() => void act(() => api(`/api/classes/${classId}/photo/${p.id}/approve`, { json: {} }))}>
                          Approve
                        </button>
                        <button className="btn small" onClick={() => void act(() => api(`/api/classes/${classId}/photo/${p.id}/reject`, { json: {} }))}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.events.length > 0 && (
              <section className="class-section">
                <h2>Random events</h2>
                <ul className="xp-events">
                  {data.events.map((e) => (
                    <li key={e.id} className={e.undone ? "undone" : ""}>
                      {e.icon} <b>{e.title}</b> <span className="muted small">{whenText(e.when)}</span>{" "}
                      {e.hits.map((h) => `${h.name} ${h.xp > 0 ? "+" : ""}${h.xp}`).join(", ")}{" "}
                      {!e.undone && (
                        <button className="link-btn small" onClick={() => void act(() => api(`/api/classes/${classId}/event/${e.id}/undo`, { json: {} }))} data-testid="event-undo">
                          Undo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
      {showing && <EventShow event={showing} onClose={() => setShowing(null)} />}
    </div>
  );
}

/** A random event, big, for the projector. */
function EventShow({ event, onClose }: { event: EventOut; onClose: () => void }) {
  return (
    <div className="modal-back" onPointerDown={onClose}>
      <div className="modal event-show" role="dialog" aria-label={event.title} onPointerDown={(e) => e.stopPropagation()} data-testid="event-show">
        <div className="event-icon">{event.icon}</div>
        <h2>{event.title}</h2>
        <p>{event.text}</p>
        <p className="event-hits">{event.hits.map((h) => `${h.name} ${h.xp > 0 ? "+" : ""}${h.xp} XP`).join(" · ")}</p>
        <button className="btn go" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- a class's board

export function ClassBoard({ classId }: { classId: number }) {
  const [data, setData] = useState<{ board: BoardRow[]; all: BoardRow[] | null; event: EventOut | null } | null>(null);
  useEffect(() => void api<NonNullable<typeof data>>(`/api/classes/${classId}/board`).then(setData, () => undefined), [classId]);
  if (!data) return null;
  return (
    <>
      {data.event && (
        <div className="event-banner" data-testid="event-banner">
          <span className="event-icon small">{data.event.icon}</span>
          <div>
            <b>{data.event.title}</b>
            <p className="small">{data.event.text}</p>
          </div>
        </div>
      )}
      <section className="class-section" id="leaderboard">
        <h2>Leaderboard</h2>
        {data.board.length ? <BoardList rows={data.board} /> : <p className="muted small">No one on it yet.</p>}
        {data.all && (
          <>
            <h3>All classes</h3>
            <BoardList rows={data.all} />
          </>
        )}
      </section>
    </>
  );
}
