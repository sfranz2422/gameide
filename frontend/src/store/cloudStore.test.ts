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
  },
}));

// A PUT stays open until the test lets it finish, so saves can overlap on purpose.
vi.mock("./api", () => ({
  ApiError: class extends Error {},
  OfflineError: class extends Error {},
  api: (_path: string, opts: { json: { data: unknown } }) =>
    new Promise((resolve) => {
      fake.sent.push(opts.json.data);
      fake.release.push(() => resolve({ version: fake.sent.length, replaced: false }));
    }),
}));

const { CloudStore } = await import("./cloudStore");
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
