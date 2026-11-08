/**
 * A published game's multiplayer room, on the page (the server's side is
 * backend/multiplayer.py; the game's is runtime.py's net_ functions).
 *
 * The page joins before the game starts (NetLobby.tsx), then syncs a few
 * times a second for as long as the game is open: this player's newest state
 * and any shouted messages go up, everyone else's state and new messages come
 * down and go to the game (GameHost.netArrive → worker → the next step). One
 * request at a time, never a pile of them: a slow answer just means the next
 * one waits.
 *
 * Away is the server's word for "don't show me, don't send me anything":
 * held for a Python check (the teacher's rule: nothing can affect a player
 * answering one), the tab hidden, or the game's own net_away(). While away the
 * game is sent nothing, so nothing it missed lands when it comes back.
 */
import type { NetJoined, NetMessageIn, NetOut, NetPlayerState } from "../engine/game";
import type { GameHost } from "../editor/gameHost";
import { api, ApiError, packed } from "../store/api";

/** What joining (or making) a room answers. */
export interface Joined extends NetJoined {
  token: string;
  after: number;
  every: number;
}

interface SyncReply {
  players: NetPlayerState[];
  msgs: NetMessageIn[];
  after: number;
  here: number;
  every: number;
}

/** Does this game use a room at all? Reads the whole project, so blocks and sheets count. */
export const usesNet = (project: unknown) => /\bnet_(room|me|players|send|shout|messages|away)\s*\(/.test(JSON.stringify(project));

/** Messages waiting to go, at most: a game shouting every step can't make the page's queue grow forever. */
const MAX_QUEUED = 40;
/** The server takes this many a sync. */
const PER_SYNC = 10;

export class NetSession {
  private state: Record<string, unknown> | null = null;
  private queue: unknown[] = [];
  private after: number;
  private every: number;
  private timer: number | undefined;
  private busy = false;
  private stopped = false;
  private held = false;
  private gameAway = false;
  private wasAway = false;
  /** What net_me() should start with if the game starts again: the newest state sent. */
  latest: Record<string, unknown>;

  constructor(
    readonly joined: Joined,
    private readonly host: GameHost,
    private readonly report: (here: number) => void,
    private readonly gone: (message: string) => void,
  ) {
    this.after = joined.after;
    this.every = joined.every;
    this.latest = joined.state;
    document.addEventListener("visibilitychange", this.onVisibility);
    addEventListener("pagehide", this.onLeave);
    addEventListener("pageshow", this.onBack);
    this.schedule(0);
  }

  /** The game for a new start: who this player is, with what they last sent. */
  get forGame(): NetJoined {
    const { code, number, name } = this.joined;
    return { code, number, name, state: this.latest };
  }

  private get away() {
    return this.held || this.gameAway || document.visibilityState === "hidden";
  }

  /** What a step of the game asked for (net_send, net_shout, net_away). */
  out(o: NetOut) {
    if (o.state) this.state = this.latest = o.state;
    if (o.away !== undefined) this.gameAway = o.away;
    if (o.msgs && !this.away) this.queue.push(...o.msgs);
    if (this.queue.length > MAX_QUEUED) this.queue.splice(0, this.queue.length - MAX_QUEUED);
    if (this.away !== this.wasAway) this.schedule(0);
  }

  /** The game held for a question, or let go: away meanwhile, and the others told at once. */
  hold(on: boolean) {
    this.held = on;
    if (on) this.queue = [];
    this.schedule(0);
  }

  private readonly onVisibility = () => this.schedule(0);

  /** Closing the tab: gone at once for the others, not ten seconds later. keepalive lets it finish after the page. */
  private readonly onLeave = () => {
    // Nothing more goes after this: the server takes the token back on leaving.
    this.stopped = true;
    clearTimeout(this.timer);
    void fetch("/api/net/leave", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: packed({ token: this.joined.token }) }).catch(() => undefined);
  };

  /** Back from the browser's back-forward cache: the page left the room as it went, so say so. */
  private readonly onBack = (e: PageTransitionEvent) => {
    if (e.persisted && this.stopped) {
      this.host.netArrive([], []);
      this.gone("You left the room when you went to another page.");
    }
  };

  private schedule(ms: number) {
    if (this.stopped) return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.sync(), ms);
  }

  private async sync() {
    if (this.stopped) return;
    if (this.busy) return; // the one in flight schedules the next
    this.busy = true;
    const away = this.away;
    if (away) this.queue = [];
    const body: Record<string, unknown> = { token: this.joined.token, after: this.after, away };
    if (this.state) body.state = this.state;
    const msgs = this.queue.splice(0, PER_SYNC);
    if (msgs.length) body.msgs = msgs;
    let next = this.every;
    try {
      const r = await api<SyncReply>("/api/net/sync", { json: body });
      if (body.state === this.state) this.state = null; // sent; a newer one may have come meanwhile
      this.after = r.after;
      this.every = r.every;
      this.wasAway = away;
      this.report(r.here);
      // Held, the game takes no steps, so nothing would read it; away for any reason, it mustn't get messages.
      if (!this.held) this.host.netArrive(r.players, this.away ? [] : r.msgs);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 410 || e.status === 401)) {
        this.stop(false);
        this.host.netArrive([], []);
        this.gone(e.message);
        return;
      }
      // Offline for a moment, or the server busy: what didn't go goes next time.
      this.queue.unshift(...msgs);
      next = Math.max(1000, this.every);
    } finally {
      this.busy = false;
    }
    this.schedule(next);
  }

  /** Done with the room: closing the game, or the server said we're not in it. */
  stop(leave = true) {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    document.removeEventListener("visibilitychange", this.onVisibility);
    removeEventListener("pagehide", this.onLeave);
    removeEventListener("pageshow", this.onBack);
    if (leave) this.onLeave();
  }
}

/** A new room in this game: anyone signed in may make one (rooms aren't tied to classes). */
export const createRoom = (slug: string) => api<Joined>(`/api/play/${encodeURIComponent(slug)}/net/create`, { json: {} });

export const joinRoom = (slug: string, code: string) => api<Joined>(`/api/play/${encodeURIComponent(slug)}/net/join`, { json: { code } });
