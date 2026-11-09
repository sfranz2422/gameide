/**
 * A published game's multiplayer room, on the page (the server's side is
 * backend/multiplayer.py; the game's is runtime.py's net_ functions).
 *
 * The page joins before the game starts (NetLobby.tsx), then, for as long as
 * the game is open, this player's newest state and any shouted messages go up,
 * and everyone else's state and new messages come down and go to the game
 * (GameHost.netArrive → worker → the next step).
 *
 * Two ways. A WebSocket (/api/net/ws) when the server keeps rooms in memory: an
 * update goes at most every SEND_EVERY ms, and the others' come the moment they
 * change. If it can't open (a school network may block them), or the server
 * says it can't (several processes), or it breaks, the page POLLS instead,
 * /api/net/sync a few times a second, one request at a time. ?nows forces
 * polling, for testing.
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
  /** net_host(): the number of the game in charge. */
  host?: number | null;
}

/** Does this game use a room at all? Reads the whole project, so blocks and sheets count. */
export const usesNet = (project: unknown) => /\bnet_(room|me|players|send|shout|messages|away)\s*\(/.test(JSON.stringify(project));

/** Messages waiting to go, at most: a game shouting every step can't make the page's queue grow forever. */
const MAX_QUEUED = 40;
/** The server takes this many a sync. */
const PER_SYNC = 10;
/** On a WebSocket, an update goes at most this often (ms), and a ping every PING_EVERY. */
const SEND_EVERY = 50;
const PING_EVERY = 2000;
/** A WebSocket not open by then, and the page polls. */
const OPEN_WITHIN = 4000;
/**
 * Polling after a WebSocket went (a server restart, a network blip), the page
 * tries a new one after this long, twice as long after each try that fails, up
 * to RETRY_MOST; a server that said it can't (several processes) every RETRY_SLOW.
 */
const RETRY_FIRST = 5000;
const RETRY_MOST = 30_000;
const RETRY_SLOW = 60_000;

export class NetSession {
  private state: Record<string, unknown> | null = null;
  private queue: unknown[] = [];
  /** net_tell: [their number, message], waiting to go. */
  private tells: [number, unknown][] = [];
  private after: number;
  private every: number;
  private timer: number | undefined;
  private busy = false;
  private stopped = false;
  private held = false;
  private gameAway = false;
  private wasAway = false;
  /** How long a sync takes there and back, smoothed: the room bar shows it. */
  private ping = 0;
  private ws: WebSocket | null = null;
  /** "ws" while a WebSocket is open; "poll" when polling; "connecting" until one or the other. */
  private mode: "connecting" | "ws" | "poll" = "connecting";
  private sendTimer: number | undefined;
  private pingTimer: number | undefined;
  private retryTimer: number | undefined;
  /** How long until the next try at a WebSocket, polling (a test sets it short). */
  retryMs = RETRY_FIRST;
  private cantSocket = false;
  /** What net_me() should start with if the game starts again: the newest state sent. */
  latest: Record<string, unknown>;

  constructor(
    readonly joined: Joined,
    private readonly host: GameHost,
    private readonly report: (here: number, ping: number) => void,
    private readonly gone: (message: string) => void,
  ) {
    this.after = joined.after;
    this.every = joined.every;
    this.latest = joined.state;
    document.addEventListener("visibilitychange", this.onVisibility);
    addEventListener("pagehide", this.onLeave);
    addEventListener("pageshow", this.onBack);
    if (typeof WebSocket !== "undefined" && !location.search.includes("nows")) this.connect();
    else this.poll();
  }

  /** How this page is talking to the room: for the tests, and the room bar. */
  get via() {
    return this.mode;
  }

  private connect() {
    const url = new URL("api/net/ws", document.baseURI);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return this.poll();
    }
    this.ws = ws;
    const giveUp = window.setTimeout(() => ws.readyState !== WebSocket.OPEN && ws.close(), OPEN_WITHIN);
    ws.onopen = () => {
      clearTimeout(giveUp);
      ws.send(JSON.stringify({ token: this.joined.token, after: this.after }));
      // Back on a WebSocket: polling stops (sync() sees the mode), and the next drop starts the waits afresh.
      this.mode = "ws";
      clearTimeout(this.timer);
      this.retryMs = Math.min(this.retryMs, RETRY_FIRST);
      this.flushSoon(0);
      const ping = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ ping: performance.now() }));
      ping();
      this.pingTimer = window.setInterval(ping, PING_EVERY);
    };
    ws.onmessage = (ev) => {
      let m: Partial<SyncReply> & { fallback?: boolean; error?: string; status?: number; pong?: number };
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.fallback) {
        this.cantSocket = true;
        return ws.close();
      }
      if (m.pong !== undefined) {
        const took = performance.now() - m.pong;
        this.ping = this.ping ? this.ping * 0.8 + took * 0.2 : took;
        return;
      }
      if (m.error) {
        if (m.status === 410 || m.status === 401) {
          this.stop(false);
          this.host.netArrive([], []);
          this.gone(m.error);
        }
        return;
      }
      if (m.players) this.arrive(m as SyncReply);
    };
    ws.onclose = () => {
      clearTimeout(giveUp);
      clearInterval(this.pingTimer);
      if (this.ws === ws) this.ws = null;
      if (this.stopped) return;
      // Couldn't open, refused, or broke (a server restart): carry on by polling,
      // and try again in a while, so a restart doesn't leave the room choppy until a reload.
      this.poll();
      const wait = this.cantSocket ? RETRY_SLOW : this.retryMs;
      this.retryMs = Math.min(this.retryMs * 2, RETRY_MOST);
      clearTimeout(this.retryTimer);
      this.retryTimer = window.setTimeout(() => !this.stopped && this.mode === "poll" && this.connect(), wait);
    };
  }

  private poll() {
    if (this.mode === "poll" || this.stopped) return;
    this.mode = "poll";
    this.schedule(0);
  }

  /** On a WebSocket: what's changed goes soon, but no more than once every SEND_EVERY. */
  private flushSoon(ms = SEND_EVERY) {
    if (this.sendTimer !== undefined) return;
    this.sendTimer = window.setTimeout(() => {
      this.sendTimer = undefined;
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN || this.stopped) return;
      const away = this.away;
      if (away) (this.queue = []), (this.tells = []);
      const body: Record<string, unknown> = { away };
      if (this.state) body.state = this.state;
      const msgs = this.queue.splice(0, PER_SYNC);
      if (msgs.length) body.msgs = msgs;
      const tells = this.tells.splice(0, PER_SYNC - msgs.length);
      if (tells.length) body.tells = tells;
      if (!body.state && !msgs.length && !tells.length && away === this.wasAway) return;
      ws.send(JSON.stringify(body));
      this.state = null;
      this.wasAway = away;
      if (this.queue.length || this.tells.length) this.flushSoon();
    }, ms);
  }

  /** What the room says, by either way: the others, and new messages, for the game. */
  private arrive(r: SyncReply) {
    this.after = r.after;
    if (r.every) this.every = r.every;
    this.report(r.here, Math.round(this.ping));
    // Held, the game takes no steps, so nothing would read it; away for any reason, it mustn't get messages.
    if (!this.held) this.host.netArrive(r.players, this.away ? [] : r.msgs, r.host);
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
    if (o.tells && !this.away) this.tells.push(...o.tells);
    if (this.tells.length > MAX_QUEUED) this.tells.splice(0, this.tells.length - MAX_QUEUED);
    if (this.queue.length > MAX_QUEUED) this.queue.splice(0, this.queue.length - MAX_QUEUED);
    if (this.mode === "ws") this.flushSoon(this.away !== this.wasAway ? 0 : SEND_EVERY);
    else if (this.away !== this.wasAway) this.schedule(0);
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
    this.ws?.close();
    void fetch("/api/net/leave", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: packed({ token: this.joined.token }) }).catch(() => undefined);
  };

  /** Back from the browser's back-forward cache: the page left the room as it went, so say so. */
  private readonly onBack = (e: PageTransitionEvent) => {
    if (e.persisted && this.stopped) {
      this.host.netArrive([], []);
      this.gone("You left the room when you went to another page.");
    }
  };

  /** Something changed (away, say): on a WebSocket it goes at once; polling, the next sync is now. */
  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.mode === "ws") return this.flushSoon(0);
    if (this.mode !== "poll") return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.sync(), ms);
  }

  private async sync() {
    // Back on a WebSocket since this was scheduled: no more polling.
    if (this.stopped || this.mode !== "poll") return;
    if (this.busy) return; // the one in flight schedules the next
    this.busy = true;
    const away = this.away;
    if (away) (this.queue = []), (this.tells = []);
    const body: Record<string, unknown> = { token: this.joined.token, after: this.after, away };
    if (this.state) body.state = this.state;
    const msgs = this.queue.splice(0, PER_SYNC);
    if (msgs.length) body.msgs = msgs;
    const tells = this.tells.splice(0, PER_SYNC - msgs.length);
    if (tells.length) body.tells = tells;
    let next = this.every;
    try {
      const sentAt = performance.now();
      const r = await api<SyncReply>("/api/net/sync", { json: body });
      const took = performance.now() - sentAt;
      this.ping = this.ping ? this.ping * 0.8 + took * 0.2 : took;
      if (body.state === this.state) this.state = null; // sent; a newer one may have come meanwhile
      this.wasAway = away;
      this.arrive(r);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 410 || e.status === 401)) {
        this.stop(false);
        this.host.netArrive([], []);
        this.gone(e.message);
        return;
      }
      // Offline for a moment, or the server busy: what didn't go goes next time.
      this.queue.unshift(...msgs);
      this.tells.unshift(...tells);
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
    clearTimeout(this.sendTimer);
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close();
    document.removeEventListener("visibilitychange", this.onVisibility);
    removeEventListener("pagehide", this.onLeave);
    removeEventListener("pageshow", this.onBack);
    if (leave) this.onLeave();
  }
}

/** A new room in this game: anyone signed in may make one (rooms aren't tied to classes). */
export const createRoom = (slug: string) => api<Joined>(`/api/play/${encodeURIComponent(slug)}/net/create`, { json: {} });

export const joinRoom = (slug: string, code: string) => api<Joined>(`/api/play/${encodeURIComponent(slug)}/net/join`, { json: { code } });
