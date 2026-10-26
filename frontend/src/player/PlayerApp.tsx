/**
 * The player: one game, full window, nothing of the editor. It runs an
 * exported game (from the folder it sits in) and published games (at
 * /play/<id> on our server, with the game's title, author, likes, Remix and
 * Report around it).
 *
 * A game starts on a click, never by itself: browsers only allow sound
 * after the player has clicked something, and the click also gives the
 * game the keyboard.
 */
import { useEffect, useRef, useState } from "react";
import type { PythonGameError } from "../engine/engine";
import { GameHost } from "../editor/gameHost";
import { buildGame } from "../python/codegen";
import { api } from "../store/api";

/** A POST to our server, as a result rather than a throw: the header shows the sentence. */
async function post<T>(path: string, json: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await api<T>(path, { json }) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
import { loadExported, loadPublished, PlayError, type GamePackage, type PublishedInfo } from "./source";

/** /play/<id> on our server; anywhere else, an exported game's own folder. */
export const publishedId = () => location.pathname.match(/\/play\/([\w-]+)\/?$/)?.[1] ?? null;

type Phase = { kind: "loading" } | { kind: "ready" } | { kind: "playing" } | { kind: "failed"; message: string; status?: number } | { kind: "crashed"; error: PythonGameError };

export function PlayerApp() {
  const id = publishedId();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [pkg, setPkg] = useState<GamePackage | null>(null);
  const [info, setInfo] = useState<PublishedInfo | null>(null);
  const [pythonReady, setPythonReady] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<GameHost | null>(null);

  // Python starts loading at once, alongside the game's files.
  useEffect(() => {
    const h = new GameHost({
      state: (s) => s === "crashed" || setPhase((p) => (s === "running" ? { kind: "playing" } : p)),
      output: () => undefined,
      error: (error) => setPhase({ kind: "crashed", error }),
      stats: () => undefined,
      ready: setPythonReady,
    });
    host.current = h;
    (window as unknown as Record<string, unknown>).__gameide = { host: h };
    h.container = stage.current;
    return () => h.dispose();
  }, []);

  useEffect(() => {
    (id ? loadPublished(id) : loadExported().then((pkg) => ({ info: null, pkg })))
      .then(({ info, pkg: p }) => {
        setInfo(info);
        setPkg(p);
        // A published game by the title it was published under; an exported one by its project's name.
        document.title = info ? `${info.title} — GameIDE` : p.project.name;
        setPhase({ kind: "ready" });
      })
      .catch((e: Error) => setPhase({ kind: "failed", message: e.message, ...(e instanceof PlayError ? { status: e.status } : {}) }));
  }, [id]);

  const start = () => {
    if (!pkg || !host.current) return;
    const { def } = buildGame(pkg.project, pkg.assets);
    // Saves are per game, kept apart from the same game in the editor.
    void host.current.play(def, id ? `play:${id}` : `export:${pkg.project.id}`);
    setPhase({ kind: "playing" });
    if (id) void fetch(`/api/play/${encodeURIComponent(id)}/played`, { method: "POST" }).catch(() => undefined);
  };

  const title = info?.title ?? pkg?.project.name ?? "";
  return (
    <div className={`player-page${info ? " published" : ""}`}>
      {info && <PublishedHeader info={info} setInfo={setInfo} host={host.current} />}
      <div className="player-stage" ref={stage} data-testid="player-stage">
        {phase.kind !== "playing" && (
          <div className="player-overlay">
            {phase.kind === "loading" && <p>Loading…</p>}
            {phase.kind === "ready" && (
              <button className="btn primary player-start" onClick={start} disabled={!pythonReady} data-testid="player-start">
                {pythonReady ? `▶ Play ${title}` : "Getting Python ready…"}
              </button>
            )}
            {phase.kind === "failed" && (
              <div className="player-message" role="alert">
                <p>{phase.message}</p>
                {phase.status === 401 && (
                  <a className="btn" href={`/login?next=${encodeURIComponent(location.pathname)}`}>
                    Sign in to play it
                  </a>
                )}
              </div>
            )}
            {phase.kind === "crashed" && (
              <div className="player-message" role="alert" data-testid="player-error">
                <p>The game stopped with an error{phase.error.object ? ` in ${phase.error.object}` : ""}:</p>
                <pre>{phase.error.message}</pre>
                <button className="btn" onClick={start}>
                  Start again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {info && (
        <footer className="player-about">
          {info.description && <p className="player-description">{info.description}</p>}
          {info.remixOf && (
            <p className="muted small">
              A remix of <a href={`/play/${info.remixOf.id}`}>{info.remixOf.title}</a> by {info.remixOf.author}.
            </p>
          )}
          <p className="muted small">
            Made with <a href="/">GameIDE</a>. <a href="/#/explore">More games</a>
          </p>
        </footer>
      )}
    </div>
  );
}

function PublishedHeader({ info, setInfo, host }: { info: PublishedInfo; setInfo: (i: PublishedInfo) => void; host: GameHost | null }) {
  const [note, setNote] = useState<string | null>(null);
  const install = useInstallPrompt();
  const like = async () => {
    const r = await post<{ liked: boolean; likes: number }>(`/api/play/${info.id}/like`, {});
    if (r.ok) setInfo({ ...info, liked: r.data.liked, likes: r.data.likes });
  };
  const remix = async () => {
    const r = await post<{ slug: string }>(`/api/play/${info.id}/remix`, {});
    if (r.ok) location.href = `/#/p/${r.data.slug}`;
    else setNote(r.error);
  };
  const report = async () => {
    const reason = prompt("What's wrong with this game? Your teacher and the site's admin will see this.");
    if (!reason?.trim()) return;
    const r = await post(`/api/play/${info.id}/report`, { reason });
    setNote(r.ok ? "Thanks — it has been reported." : r.error);
  };
  return (
    <header className="player-head">
      <div>
        <h1 data-testid="player-title">{info.title}</h1>
        <span className="muted">
          by {info.author} · <span data-testid="player-plays">{info.plays}</span> plays
        </span>
      </div>
      <span className="spacer" />
      {note && <span className="muted small" role="status">{note}</span>}
      <button
        className={`btn small${info.liked ? " on" : ""}`}
        onClick={() => void like()}
        disabled={!info.signedIn}
        title={info.signedIn ? "Like this game" : "Sign in to like games"}
        data-testid="player-like"
      >
        ♥ {info.likes}
      </button>
      {info.allowRemix && (
        <button className="btn small" onClick={() => void remix()} disabled={!info.signedIn} title={info.signedIn ? "Copy this game into your account, to change it" : "Sign in to remix"} data-testid="player-remix">
          Remix
        </button>
      )}
      {install && (
        <button className="btn small" onClick={install} title="Install it as an app, with its own window and icon (it still needs the internet to start)" data-testid="player-install">
          Install
        </button>
      )}
      <button className="btn small" onClick={() => host?.fullscreen()} title="Full screen (Esc to leave)">
        ⛶
      </button>
      <button className="btn small" onClick={() => void report()} disabled={!info.signedIn} title={info.signedIn ? "Report a problem with this game" : "Sign in to report a game"} data-testid="player-report">
        Report
      </button>
    </header>
  );
}

/** The browser's "install this app" offer, when it has one (Chrome, Edge). */
function useInstallPrompt(): (() => void) | null {
  const [event, setEvent] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvent(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  return event ? () => void event.prompt().then(() => setEvent(null)) : null;
}
