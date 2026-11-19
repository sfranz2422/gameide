/**
 * A published game's raids, between the game (the raid_ functions in runtime.py) and the
 * server (backend/raids.py): the game's orders go to the server, and what it says comes
 * back for the game's next step. Only a published game whose code uses raid_ gets one.
 *
 * Gentle on the server (2026-11-18: a class at once took it down): a kingdom is shared at
 * most every SHARE_EVERY (the newest kept), and the news is asked for every NEWS_EVERY.
 * Signed out, the game hears {online: false} and every raid_ function does nothing.
 */
import { ApiError, api } from "../store/api";
import type { RaidNews, RaidOrder } from "../engine/game";

export const SHARE_EVERY = 15_000;
export const NEWS_EVERY = 60_000;

export const usesRaids = (project: unknown) => JSON.stringify(project).includes("raid_");

type Fetch = <T>(path: string, opts?: { method?: string; json?: unknown }) => Promise<T>;

export class RaidLink {
  private base: unknown = null;
  private shareTimer: ReturnType<typeof setTimeout> | null = null;
  private lastShare = 0;
  private newsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly slug: string,
    private readonly arrive: (news: RaidNews) => void,
    private readonly fetch: Fetch = api as Fetch,
    private readonly clock: () => number = Date.now,
  ) {}

  private url(rest: string) {
    return `/api/play/${encodeURIComponent(this.slug)}/raid/${rest}`;
  }

  /** Asks for the news now and every NEWS_EVERY after: it tells the game whether it's online. */
  start() {
    void this.news();
    this.newsTimer = setInterval(() => void this.news(), NEWS_EVERY);
  }

  stop() {
    if (this.newsTimer) clearInterval(this.newsTimer);
    if (this.shareTimer) clearTimeout(this.shareTimer);
    this.newsTimer = this.shareTimer = null;
  }

  async news() {
    try {
      const news = await this.fetch<unknown>(this.url("news"));
      this.arrive({ online: true, news });
    } catch (e) {
      // Signed out, or a game they may not play: no raids. Anything else: try again later.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) this.arrive({ online: false });
    }
  }

  handle(orders: RaidOrder[]) {
    for (const o of orders) {
      if (o.op === "share") this.share(o.base);
      else if (o.op === "find") void this.find();
      else if (o.op === "finish") void this.finish(o);
      else if (o.op === "seen") void this.seen(o.ids);
    }
  }

  /** The newest kingdom, sent at once if it's been a while, or when the wait is over. */
  private share(base: unknown) {
    this.base = base;
    if (this.shareTimer) return;
    const wait = Math.max(0, this.lastShare + SHARE_EVERY - this.clock());
    this.shareTimer = setTimeout(() => {
      this.shareTimer = null;
      this.lastShare = this.clock();
      const b = this.base;
      this.base = null;
      if (b) void this.fetch(this.url("base"), { method: "PUT", json: b }).catch(() => undefined);
    }, wait);
  }

  private async find() {
    try {
      const r = await this.fetch<{ raid: unknown; why?: string }>(this.url("find"), { json: {} });
      this.arrive({ found: r.raid ?? { id: null, why: r.why ?? "Nobody to raid right now." } });
    } catch (e) {
      this.arrive({ found: { id: null, why: e instanceof Error ? e.message : "The server didn't answer." } });
    }
  }

  private async finish(o: Extract<RaidOrder, { op: "finish" }>) {
    try {
      const { id, op: _op, ...result } = o;
      const r = await this.fetch<unknown>(this.url(String(id)), { json: result });
      this.arrive({ result: r });
    } catch (e) {
      this.arrive({ result: { error: e instanceof Error ? e.message : "The server didn't answer." } });
    }
    void this.news();
  }

  private async seen(ids: number[]) {
    await this.fetch(this.url("seen"), { json: { ids } }).catch(() => undefined);
    void this.news();
  }
}
