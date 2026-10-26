/**
 * Projects kept on the server, for a signed-in student — with this
 * browser's IndexedDB as a cache in front of it, so the editor works the
 * same on a train as in class.
 *
 * Every save goes to the cache first and is marked dirty, then goes to the
 * server; only a save the server accepted clears the mark. So whatever goes
 * wrong — offline, the Wi-Fi drops mid-save, signed out after two idle
 * hours — the work is in this browser, and it goes up the next time it can:
 * on the `online` event, every 30 seconds while anything is dirty, and the
 * next time the project is opened.
 *
 * Opening a project prefers a dirty cached copy (it has work the server
 * hasn't seen) and otherwise asks the server, which may have newer work
 * from another computer.
 *
 * Each save says which server version it was based on. If another tab or
 * computer saved in between, the server keeps the version being replaced
 * in History before accepting this one (backend/app.py, save_project), so
 * two copies of a project can never silently destroy each other's work.
 *
 * Each user has their own cache database, so two students taking turns on
 * one Chromebook profile don't see each other's games; signing out throws
 * the cache away when nothing in it is waiting to be saved.
 */
import { api, ApiError, OfflineError } from "./api";
import { migrate, type Project } from "./project";
import { LocalStore, type ProjectStore, type ProjectSummary, type SaveOutcome, type VersionInfo } from "./store";

interface SyncMeta {
  /** The server version the cached copy is based on; 0 = never on the server. */
  base: number;
  /** The cached copy has changes the server hasn't accepted yet. */
  dirty: boolean;
  /** Asset ids stored here but not yet on the server. */
  pending: string[];
}

const NO_META: SyncMeta = { base: 0, dirty: false, pending: [] };
/** Pictures sent at once by a save: enough to be quick, few enough not to swamp a free server. */
const UPLOADS_AT_ONCE = 6;
const RETRY_MS = 30_000;

export function cacheName(userId: number) {
  return `gameide-user-${userId}`;
}

export class CloudStore implements ProjectStore {
  readonly kind = "cloud" as const;
  readonly cache: LocalStore;
  private listeners = new Set<(id: string, o: SaveOutcome) => void>();
  private uploads = new Set<(id: string, done: number, total: number) => void>();
  /** One sync at a time per project; a save during one asks for another after it. */
  private running = new Map<string, Promise<SaveOutcome>>();
  private again = new Set<string>();
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly onOnline = () => void this.syncAll();

  constructor(readonly userId: number) {
    this.cache = new LocalStore(cacheName(userId));
    window.addEventListener("online", this.onOnline);
    this.timer = setInterval(() => void this.syncAll(), RETRY_MS);
  }

  dispose() {
    clearInterval(this.timer);
    window.removeEventListener("online", this.onOnline);
  }

  onSync(listener: (id: string, o: SaveOutcome) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  onUpload(listener: (id: string, done: number, total: number) => void) {
    this.uploads.add(listener);
    return () => void this.uploads.delete(listener);
  }

  private meta(id: string) {
    return this.cache.getMeta<SyncMeta>(id).then((m) => m ?? { ...NO_META });
  }

  /**
   * The server version each project was at when THIS tab loaded or last
   * saved it. Not the cache's `base`: two tabs in one browser share the
   * cache, so after tab one saved, tab two would send tab one's version,
   * the server would see no conflict, and tab two would overwrite tab one's
   * work with no copy kept in History. A tab must speak only for what it
   * has seen. (The cache's `base` is still used for a background sync of a
   * project no tab here has open.)
   */
  private bases = new Map<string, number>();

  private locks = new Map<string, Promise<unknown>>();
  /**
   * Changes a project's sync state as read-modify-write, one change at a
   * time per project. Without the queue a picture added while a save was
   * going up could be dropped from `pending` by the save writing back the
   * copy it read earlier — and that picture would never reach the server.
   */
  private updateMeta(id: string, change: (m: SyncMeta) => void): Promise<SyncMeta> {
    const prev = this.locks.get(id) ?? Promise.resolve();
    const next = prev.then(async () => {
      const m = await this.meta(id);
      change(m);
      await this.cache.setMeta(id, m);
      return m;
    });
    this.locks.set(id, next.catch(() => undefined));
    return next;
  }

  // ---------------------------------------------------------------- reading

  async list(): Promise<ProjectSummary[]> {
    const local = await this.cache.list();
    const dirty = new Set<string>();
    for (const p of local) if ((await this.meta(p.id)).dirty) dirty.add(p.id);
    let server: ProjectSummary[];
    try {
      server = (await api<{ projects: ProjectSummary[] }>("/api/projects")).projects;
    } catch (e) {
      if (e instanceof OfflineError) return local.map((p) => ({ ...p, unsynced: dirty.has(p.id) }));
      throw e;
    }
    // The server's list, plus anything made here that hasn't reached it yet.
    const byId = new Map(server.map((p) => [p.id, p]));
    for (const p of local) {
      if (dirty.has(p.id)) byId.set(p.id, { ...p, unsynced: true });
    }
    return [...byId.values()].sort((a, b) => b.modified.localeCompare(a.modified));
  }

  async load(id: string): Promise<Project | null> {
    const meta = await this.meta(id);
    const cached = await this.cache.load(id);
    if (cached && meta.dirty) {
      this.bases.set(id, meta.base);
      void this.sync(id);
      return cached;
    }
    try {
      const r = await api<{ data: unknown; version: number }>(`/api/projects/${encodeURIComponent(id)}`);
      const p = migrate(r.data);
      await this.cache.save(p);
      await this.updateMeta(id, (m) => ((m.base = r.version), (m.dirty = false)));
      this.bases.set(id, r.version);
      return p;
    } catch (e) {
      if (e instanceof OfflineError) {
        if (cached) this.bases.set(id, meta.base);
        return cached;
      }
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  async getAsset(projectId: string, assetId: string): Promise<Blob | null> {
    const cached = await this.cache.getAsset(projectId, assetId);
    if (cached) return cached;
    try {
      const res = await api<Response>(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`);
      const blob = await res.blob();
      await this.cache.putAsset(projectId, assetId, blob);
      return blob;
    } catch {
      return null; // drawn as a placeholder, and asked for again next time
    }
  }

  // ---------------------------------------------------------------- writing

  async save(project: Project): Promise<SaveOutcome> {
    await this.cache.save(project);
    await this.updateMeta(project.id, (m) => void (m.dirty = true));
    return this.sync(project.id);
  }

  async putAsset(projectId: string, assetId: string, blob: Blob): Promise<void> {
    await this.cache.putAsset(projectId, assetId, blob);
    await this.updateMeta(projectId, (m) => void (m.pending.includes(assetId) || m.pending.push(assetId)));
    void this.sync(projectId);
  }

  /** Cached and queued; the save that follows sends them (see push). No upload run per picture. */
  async putAssets(projectId: string, assets: Map<string, Blob>): Promise<void> {
    await this.cache.putAssets(projectId, assets);
    await this.updateMeta(projectId, (m) => {
      for (const assetId of assets.keys()) if (!m.pending.includes(assetId)) m.pending.push(assetId);
    });
  }

  async remove(id: string): Promise<void> {
    try {
      await api(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      if (e instanceof OfflineError) throw new Error("You're offline. Delete it once you're back online.");
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
    await this.cache.remove(id);
  }

  /** Pushes a project's cached changes and pictures to the server. */
  sync(id: string): Promise<SaveOutcome> {
    const current = this.running.get(id);
    if (current) {
      this.again.add(id);
      return current.then(() => this.sync(id));
    }
    const run = this.push(id).finally(() => {
      this.running.delete(id);
    });
    this.running.set(id, run);
    void run.then((o) => {
      for (const l of this.listeners) l(id, o);
      if (this.again.delete(id)) void this.sync(id);
    });
    return run;
  }

  private async push(id: string): Promise<SaveOutcome> {
    const project = await this.cache.load(id);
    if (!project) return { state: "saved" };
    const meta = await this.meta(id);
    let note: string | undefined;
    try {
      if (meta.dirty) {
        const r = await api<{ version: number; replaced: boolean }>(`/api/projects/${encodeURIComponent(id)}`, {
          method: "PUT",
          json: { data: project, base: this.bases.get(id) ?? meta.base },
        });
        this.bases.set(id, r.version);
        if (r.replaced) note = "Another tab or computer had saved this game too. Its version is kept in History.";
        // Still dirty if it was saved again while this went up: the copy
        // sent is not the copy cached now.
        const now = await this.cache.load(id);
        const stillDirty = !!now && now.modified !== project.modified;
        await this.updateMeta(id, (m) => ((m.base = r.version), (m.dirty = stillDirty)));
      }
      // Several pictures at a time: one after another, a game of 600 frames
      // took minutes on the real server. updateMeta queues its changes, so
      // the uploads can each take their picture off `pending` safely.
      const queue = [...(await this.meta(id)).pending];
      const total = queue.length;
      let sent = 0;
      const upload = async () => {
        for (let assetId = queue.shift(); assetId !== undefined; assetId = queue.shift()) {
          const blob = await this.cache.getAsset(id, assetId);
          if (blob) await api(`/api/projects/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}`, { method: "PUT", body: blob });
          const done = assetId;
          await this.updateMeta(id, (m) => void (m.pending = m.pending.filter((a) => a !== done)));
          sent++;
          for (const l of this.uploads) l(id, sent, total);
        }
      };
      await Promise.all(Array.from({ length: Math.min(UPLOADS_AT_ONCE, total) }, upload));
      return note ? { state: "saved", note } : { state: "saved" };
    } catch (e) {
      if (e instanceof OfflineError) return { state: "offline" };
      if (e instanceof ApiError && e.status === 401) return { state: "signed-out", message: e.message };
      return { state: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Every project with something waiting, pushed. */
  async syncAll(): Promise<void> {
    for (const p of await this.cache.list()) {
      const m = await this.meta(p.id);
      if (m.dirty || m.pending.length) void this.sync(p.id);
    }
  }

  /** Projects in this cache with work the server hasn't got. */
  async unsavedCount(): Promise<number> {
    let n = 0;
    for (const p of await this.cache.list()) {
      const m = await this.meta(p.id);
      if (m.dirty || m.pending.length) n++;
    }
    return n;
  }

  // ---------------------------------------------------------------- history

  async versions(id: string): Promise<VersionInfo[]> {
    return (await api<{ versions: VersionInfo[] }>(`/api/projects/${encodeURIComponent(id)}/versions`)).versions;
  }

  async saveVersion(id: string, label: string): Promise<void> {
    // The version kept must be what is on screen, so send that first.
    const o = await this.sync(id);
    if (o.state !== "saved") throw new Error(o.message ?? "Can't reach the server to keep a version.");
    await api(`/api/projects/${encodeURIComponent(id)}/versions`, { json: { label } });
  }

  async restoreVersion(id: string, versionId: number): Promise<Project> {
    await this.sync(id);
    const r = await api<{ data: unknown; version: number }>(`/api/projects/${encodeURIComponent(id)}/versions/${versionId}/restore`, { json: {} });
    const p = migrate(r.data);
    await this.cache.save(p);
    await this.updateMeta(id, (m) => ((m.base = r.version), (m.dirty = false)));
    this.bases.set(id, r.version);
    return p;
  }
}
