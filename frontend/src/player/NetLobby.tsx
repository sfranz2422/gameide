/**
 * Before a multiplayer game starts: join a room by its code, or make one for
 * your class and tell everyone the code. Or play alone. The server decides
 * who may join (backend/multiplayer.py): only the class the room is for.
 */
import { useEffect, useState } from "react";
import { createRoom, joinRoom, roomClasses, type Joined } from "./net";

export function NetLobby({ slug, title, signedIn, ready, onJoined, onAlone }: {
  slug: string;
  title: string;
  signedIn: boolean;
  /** Python is loaded, so the game can start the moment a room is joined. */
  ready: boolean;
  onJoined: (j: Joined) => void;
  onAlone: () => void;
}) {
  const [code, setCode] = useState("");
  const [classes, setClasses] = useState<{ id: number; name: string }[] | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    roomClasses(slug).then(
      (r) => {
        setClasses(r.classes);
        setClassId(r.classes[0]?.id ?? null);
      },
      (e: Error) => setError(e.message),
    );
  }, [slug, signedIn]);

  const go = async (how: () => Promise<Joined>) => {
    setBusy(true);
    setError(null);
    try {
      onJoined(await how());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const join = () => void go(() => joinRoom(slug, code));
  const make = () => void go(() => createRoom(slug, classes && classes.length > 1 ? classId ?? undefined : undefined));

  if (!signedIn) {
    return (
      <div className="net-lobby" data-testid="net-lobby">
        <h2>{title}</h2>
        <p>Sign in to play with your class.</p>
        <a className="btn primary" href={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</a>
        <button className="btn" onClick={onAlone} disabled={!ready} data-testid="net-alone">Play alone</button>
      </div>
    );
  }
  const canMake = !!classes?.length;
  return (
    <div className="net-lobby" data-testid="net-lobby">
      <h2>{title}</h2>
      <form
        className="net-join"
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <label>
          Room code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            placeholder="ABCD"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            data-testid="net-code"
          />
        </label>
        <button className="btn primary" disabled={busy || !ready || code.length < 4} data-testid="net-join">
          {ready ? "Join" : "Getting Python ready…"}
        </button>
      </form>
      <div className="net-or">or</div>
      {canMake ? (
        <div className="net-make">
          {classes.length > 1 && (
            <select value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))} aria-label="Which class" data-testid="net-class">
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button className="btn go" onClick={make} disabled={busy || !ready} data-testid="net-create">
            Make a room
          </button>
        </div>
      ) : (
        classes && <p className="muted small">You can join a room, but making one needs a GameIDE class.</p>
      )}
      <button className="btn small net-alone" onClick={onAlone} disabled={busy || !ready} data-testid="net-alone">Play alone</button>
      {error && <p className="net-error" role="alert" data-testid="net-error">{error}</p>}
    </div>
  );
}

/** Above the game while in a room: its code (to tell the class), how many are in it, and who you are. */
export function NetBar({ joined, here, gone }: { joined: Joined; here: number; gone: string | null }) {
  return (
    <div className={`net-bar${gone ? " gone" : ""}`} data-testid="net-bar">
      {gone ? (
        <span>{gone} Reload the page to join again.</span>
      ) : (
        <>
          <span>
            Room <b data-testid="net-room-code">{joined.code}</b>
          </span>
          <span data-testid="net-here">{here} {here === 1 ? "player" : "players"}</span>
          <span>
            You are <b>#{joined.number}</b>
          </span>
        </>
      )}
    </div>
  );
}
