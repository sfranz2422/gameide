/**
 * Saves that overlap. A save landing while another was going up once started
 * a loop that never ended: the tab read IndexedDB flat out, its memory climbed
 * with nobody touching anything, and Chrome killed it at 4 GB.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "./project";

const fake = vi.hoisted(() => ({
  projects: new Map<string, unknown>(),
  metas: new Map<string, unknown>(),
  reads: 0,
  sent: [] as unknown[],
  release: [] as (() => void)[],
  open: 0,
  most: 0,
  fail: false,
}));

vi.mock("./store", () => ({
  LocalStore: class {
    async save(p: { id: string }) {
      fake.projects.set(p.id, structuredClone(p));
    }
    async load(id: string) {
      fake.reads++;
      return structuredClone(fake.projects.get(id) ?? null);
    }
    async getMeta(id: string) {
      return structuredClone(fake.metas.get(id) ?? null);
    }
    async setMeta(id: string, m: unknown) {
      fake.metas.set(id, structuredClone(m));
    }
    async list() {
      return [];
    }
    async getAsset() {
      return new Blob(["picture"]);
    }
  },
}));

// A PUT stays open until the test lets it finish, so saves can overlap on purpose.
vi.mock("./api", () => ({
  ApiError: class extends Error {},
  OfflineError: class extends Error {},
  api: (_path: string, opts: { json?: { data: unknown }; body?: Blob }) =>
    new Promise((resolve, reject) => {
      if (fake.fail) return reject(new Error("502 Bad Gateway"));
      if (opts.body) {
        // A picture: counted while it's open, so the test sees how many go at once.
        fake.open++;
        fake.most = Math.max(fake.most, fake.open);
        fake.release.push(() => {
          fake.open--;
          resolve({ ok: true });
        });
        return;
      }
      fake.sent.push(opts.json!.data);
      fake.release.push(() => resolve({ version: fake.sent.length, replaced: false }));
    }),
}));

const { CloudStore, UPLOADS_AT_ONCE, retryWait } = await import("./cloudStore");
const game = (modified: string) => ({ id: "g", modified }) as unknown as Project;
/** Long enough for any loop of promises and timers to show itself. */
const settle = () => new Promise((r) => setTimeout(r, 30));
/** Lets every PUT that is open, or opens while we wait, finish. */
async function letAllFinish() {
  for (let i = 0; i < 8; i++) {
    fake.release.splice(0).forEach((f) => f());
    await settle();
  }
}

describe("overlapping saves", () => {
  let store: InstanceType<typeof CloudStore>;
  beforeEach(() => {
    vi.stubGlobal("window", { addEventListener: () => undefined, removeEventListener: () => undefined });
    fake.projects.clear();
    fake.metas.clear();
    fake.reads = 0;
    fake.sent = [];
    fake.release = [];
    fake.open = fake.most = 0;
    fake.fail = false;
    store = new CloudStore(1);
  });
  afterEach(() => {
    store.dispose();
    vi.unstubAllGlobals();
  });

  it("a save during a save finishes, and everything goes quiet afterwards", async () => {
    const first = store.save(game("one"));
    await settle();
    const second = store.save(game("two"));
    const third = store.save(game("three"));
    await letAllFinish();
    await expect(Promise.all([first, second, third])).resolves.toHaveLength(3);
    const reads = fake.reads;
    await settle();
    await settle();
    expect(fake.reads).toBe(reads);
  });

  it("the last save is what reaches the server, and each overlap costs one more send", async () => {
    const first = store.save(game("one"));
    await settle();
    const later = [store.save(game("two")), store.save(game("three")), store.save(game("four"))];
    await letAllFinish();
    await Promise.all([first, ...later]);
    expect((fake.sent[fake.sent.length - 1] as Project).modified).toBe("four");
    expect(fake.sent.length).toBeLessThanOrEqual(3);
    expect((fake.metas.get("g") as { dirty: boolean }).dirty).toBe(false);
  });
});

describe("a struggling server", () => {
  let store: InstanceType<typeof CloudStore>;
  beforeEach(() => {
    vi.stubGlobal("window", { addEventListener: () => undefined, removeEventListener: () => undefined });
    fake.projects.clear();
    fake.metas.clear();
    fake.sent = [];
    fake.release = [];
    fake.open = fake.most = 0;
    fake.fail = false;
    store = new CloudStore(1);
  });
  afterEach(() => {
    store.dispose();
    vi.unstubAllGlobals();
  });

  it("pictures go up two at a time, never more (six at once was followed by the server restarting)", async () => {
    fake.projects.set("g", game("one"));
    fake.metas.set("g", { base: 1, dirty: false, pending: ["a", "b", "c", "d", "e", "f", "h"] });
    const done = store.sync("g");
    await letAllFinish();
    await done;
    expect(UPLOADS_AT_ONCE).toBe(2);
    expect(fake.most).toBe(2);
    expect((fake.metas.get("g") as { pending: string[] }).pending).toEqual([]);
  });

  it("after a failed save the background waits longer each time, up to five minutes; one that works resets it", async () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(retryWait)).toEqual([0, 30_000, 60_000, 120_000, 240_000, 300_000, 300_000]);
    const s = store as unknown as { failures: number; nextTry: number };
    fake.projects.set("g", game("one"));
    fake.fail = true;
    const before = Date.now();
    expect((await store.save(game("one"))).state).toBe("error");
    expect(s.failures).toBe(1);
    expect(s.nextTry).toBeGreaterThanOrEqual(before + 30_000);
    expect((await store.save(game("two"))).state).toBe("error");
    expect(s.nextTry).toBeGreaterThanOrEqual(before + 60_000);
    // A save the student makes still goes at once, and one that works clears the wait.
    fake.fail = false;
    const ok = store.save(game("three"));
    await letAllFinish();
    expect((await ok).state).toBe("saved");
    expect([s.failures, s.nextTry]).toEqual([0, 0]);
  });
});
