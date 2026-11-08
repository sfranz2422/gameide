/**
 * Before a multiplayer game starts: join a room by its code, or make one and
 * tell everyone the code. Or play alone. Anyone signed in may make or join a
 * room (backend/multiplayer.py): they aren't tied to classes.
 */
import { useState } from "react";
import { createRoom, joinRoom, type Joined } from "./net";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  const make = () => void go(() => createRoom(slug));

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
      <button className="btn go" onClick={make} disabled={busy || !ready} data-testid="net-create">
        Make a room
      </button>
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
