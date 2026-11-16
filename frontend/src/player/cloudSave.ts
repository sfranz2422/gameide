/**
 * A published game's save (save_set), kept in the player's account as well as in
 * this browser, when they're signed in (the teacher's ask, 2026-11-16: "they can
 * play at home, or if we update the game they don't lose their progress").
 * The server's half is publishing.get_save / put_save (gamestore.GameSave).
 *
 * The browser keeps its copy as before (GameHost, saveKey) and when it was made
 * (saveAtKey). Before a game starts, `settle` plays the newer of the two: the
 * account's is written into the browser if it's newer; the browser's goes up to
 * the account if that's newer (a game played signed out, or while offline). While
 * the game runs, `CloudSaver` sends each new save up, at most every few seconds,
 * and what's waiting as the page hides. Signed out, nothing goes anywhere: the
 * browser's copy is all there is, as it always was.
 */
import { saveAtKey, saveKey } from "../editor/gameHost";
import { api, ApiError } from "../store/api";

/** At most one save sent this often (ms): a game may save every step. */
export const SEND_EVERY = 4000;
/** How long the page waits for the account's save before starting with the browser's (ms). */
const WAIT = 5000;

interface Stored {
  data: Record<string, unknown> | null;
  at: number;
}

function local(saveId: string): Stored {
  try {
    const raw = localStorage.getItem(saveKey(saveId));
    const data = raw ? (JSON.parse(raw) as unknown) : null;
    return {
      data: data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null,
      at: Number(localStorage.getItem(saveAtKey(saveId))) || 0,
    };
  } catch {
    return { data: null, at: 0 };
  }
}

const url = (gameId: string) => `/api/play/${encodeURIComponent(gameId)}/save`;

/**
 * Makes the browser's copy the newer of the two, before the game reads it.
 * "signed-out": nothing in the account (or no account): only the browser's copy counts.
 */
export async function settle(gameId: string, saveId: string): Promise<"account" | "browser" | "signed-out"> {
  let theirs: Stored;
  try {
    theirs = await Promise.race([
      api<Stored>(url(gameId)),
      new Promise<never>((_, no) => setTimeout(() => no(new Error("slow")), WAIT)),
    ]);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return "signed-out";
    return "browser"; // offline or slow: play this browser's copy; it goes up next time
  }
  const mine = local(saveId);
  if (theirs.data && theirs.at > mine.at) {
    try {
      localStorage.setItem(saveKey(saveId), JSON.stringify(theirs.data));
      localStorage.setItem(saveAtKey(saveId), String(theirs.at));
    } catch {
      // A browser that won't store it (a private window): the game reads the
      // browser's copy, so this one can't be played here. Nothing to lose.
    }
    return "account";
  }
  if (mine.data && mine.at > theirs.at) void api(url(gameId), { method: "PUT", json: { data: mine.data, at: mine.at } }).catch(() => undefined);
  return "browser";
}

/** Sends a running game's saves to the player's account: the newest, at most every SEND_EVERY. */
export class CloudSaver {
  private waiting: { data: Record<string, unknown>; at: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;
  private stopped = false;
  private readonly onHide = () => {
    if (document.visibilityState === "hidden") void this.flush();
  };

  constructor(
    private readonly gameId: string,
    /** Something worth telling the player went wrong (a save too big for the account). */
    private readonly warn: (text: string) => void = () => undefined,
  ) {
    document.addEventListener("visibilitychange", this.onHide);
    addEventListener("pagehide", this.onHide);
  }

  saved(data: Record<string, unknown>, at: number) {
    if (this.stopped) return;
    this.waiting = { data, at };
    if (this.timer) return;
    this.timer = setTimeout(() => void this.flush(), Math.max(0, this.last + SEND_EVERY - Date.now()));
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const w = this.waiting;
    if (!w) return;
    this.waiting = null;
    this.last = Date.now();
    try {
      await api(url(this.gameId), { method: "PUT", json: w, keepalive: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) this.stopped = true; // signed out meanwhile: the browser keeps it
      else if (e instanceof ApiError && e.status === 413) this.warn(e.message);
      // Offline: this browser's copy is newer, and goes up the next time the game starts (settle).
    }
  }

  stop() {
    void this.flush();
    this.stopped = true;
    document.removeEventListener("visibilitychange", this.onHide);
    removeEventListener("pagehide", this.onHide);
  }
}
