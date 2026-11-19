/**
 * The page's side of raids (raids.ts): orders to the server, answers back for the game,
 * a kingdom shared at most every SHARE_EVERY (the newest one), signed out means offline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../store/api";
import { RaidLink, SHARE_EVERY } from "./raids";
import type { RaidNews } from "../engine/game";

describe("RaidLink", () => {
  let calls: { path: string; opts?: { method?: string; json?: unknown } }[];
  let heard: RaidNews[];
  let answer: (path: string) => unknown;
  const fetcher = async <T,>(path: string, opts?: { method?: string; json?: unknown }) => {
    calls.push({ path, ...(opts ? { opts } : {}) });
    const a = answer(path);
    if (a instanceof Error) throw a;
    return a as T;
  };
  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    heard = [];
    answer = () => ({ trophies: 3, shield: 0, defenses: [] });
  });
  afterEach(() => vi.useRealTimers());
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it("tells the game it's online with the news; signed out, offline", async () => {
    const link = new RaidLink("abc", (n) => heard.push(n), fetcher, () => Date.now());
    await link.news();
    expect(heard).toEqual([{ online: true, news: { trophies: 3, shield: 0, defenses: [] } }]);
    answer = () => new ApiError(401, "Sign in first.");
    await link.news();
    expect(heard.at(-1)).toEqual({ online: false });
    expect(calls[0]!.path).toBe("/api/play/abc/raid/news");
  });

  it("shares the kingdom at once, then at most every SHARE_EVERY, the newest only", async () => {
    const link = new RaidLink("abc", (n) => heard.push(n), fetcher, () => Date.now());
    const base = (g: number) => ({ buildings: [], gold: g, food: 0, power: 1 });
    link.handle([{ op: "share", base: base(1) }]);
    await vi.advanceTimersByTimeAsync(0);
    link.handle([{ op: "share", base: base(2) }]);
    link.handle([{ op: "share", base: base(3) }]);
    await vi.advanceTimersByTimeAsync(SHARE_EVERY - 1000);
    expect(calls.map((c) => (c.opts?.json as { gold: number }).gold)).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.map((c) => [c.path, c.opts?.method, (c.opts?.json as { gold: number }).gold])).toEqual([
      ["/api/play/abc/raid/base", "PUT", 1], ["/api/play/abc/raid/base", "PUT", 3]]);
  });

  it("alliance orders go to their routes, then the alliance's news; a refusal comes back in words", async () => {
    const link = new RaidLink("abc", (n) => heard.push(n), fetcher, () => Date.now());
    answer = (p) => (p.endsWith("/join") ? new ApiError(409, "That alliance is full (20).") : p.endsWith("/alliance") ? { school: [], alliance: null } : { ok: true });
    link.handle([{ op: "ally_say", phrase: 3 }, { op: "ally_join", id: 7 }]);
    await flush();
    expect(calls.map((c) => c.path)).toContain("/api/play/abc/alliance/say");
    expect(calls.find((c) => c.path.endsWith("/say"))!.opts!.json).toEqual({ phrase: 3 });
    expect(heard).toContainEqual({ ally_error: "That alliance is full (20)." });
    expect(heard).toContainEqual({ ally: { school: [], alliance: null } });
  });

  it("a search's answer, a finish's result (and fresh news), each back for the game", async () => {
    const link = new RaidLink("abc", (n) => heard.push(n), fetcher, () => Date.now());
    answer = (p) => (p.endsWith("/find") ? { raid: null, why: "Nobody to raid." } : p.endsWith("/9") ? { trophies: 13, mine: 40 } : { trophies: 40 });
    link.handle([{ op: "find" }, { op: "finish", id: 9, stars: 2, percent: 60, gold: 1, food: 2, replay: [] }]);
    await flush();
    expect(heard).toContainEqual({ found: { id: null, why: "Nobody to raid." } });
    expect(heard).toContainEqual({ result: { trophies: 13, mine: 40 } });
    expect(heard).toContainEqual({ online: true, news: { trophies: 40 } });
    expect(calls.find((c) => c.path.endsWith("/9"))!.opts!.json).toEqual({ stars: 2, percent: 60, gold: 1, food: 2, replay: [] });
  });
});
