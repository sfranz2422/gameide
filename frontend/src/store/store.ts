/**
 * Where projects are kept. The editor only ever talks to a ProjectStore:
 * LocalStore keeps everything in this browser's IndexedDB (signed out), and
 * CloudStore (cloudStore.ts) keeps it on the server, with a LocalStore of
 * its own as the offline cache (signed in).
 */
import { assetIds, migrate, type Project } from "./project";

export interface ProjectSummary {
  id: string;
  name: string;
  modified: string;
  /** Changes made offline that haven't reached the server yet. */
  unsynced?: boolean;
}

/**
 * How a save went. "offline" and "signed-out" mean it is safe in this
 * browser and will go to the server later; only "error" means it may not
 * be saved anywhere useful, and `message` says why in a student's words.
 */
export interface SaveOutcome {
  state: "saved" | "offline" | "signed-out" | "error";
  message?: string;
  /** Something worth saying even though it worked. */
  note?: string;
}

export interface VersionInfo {
  id: number;
  version: number;
  kind: "auto" | "manual" | "replaced" | "restore";
  label: string;
  created: string;
  size: number;
}

export interface ProjectStore {
  readonly kind: "local" | "cloud";
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project | null>;
  save(project: Project): Promise<SaveOutcome>;
  remove(id: string): Promise<void>;
  putAsset(projectId: string, assetId: string, blob: Blob): Promise<void>;
  getAsset(projectId: string, assetId: string): Promise<Blob | null>;
  /** Version history; only stores that keep one have these. */
  versions?(id: string): Promise<VersionInfo[]>;
  saveVersion?(id: string, label: string): Promise<void>;
  restoreVersion?(id: string, versionId: number): Promise<Project>;
  /** Hear about saves that finish later, in the background (back online). */
  onSync?(listener: (id: string, outcome: SaveOutcome) => void): () => void;
}

const DB_NAME = "gameide";
const DB_VERSION = 2; // 2 added `meta`

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("The save was cancelled."));
  });
}

/**
 * IndexedDB, in two stores: `projects` (the JSON, keyed by project id) and
 * `assets` (image and sound bytes, keyed by [projectId, assetId]). A
 * project's summary is read from the JSON itself, so there is no separate
 * index to fall out of step with it.
 */
export class LocalStore implements ProjectStore {
  readonly kind = "local" as const;
  private db: Promise<IDBDatabase>;

  constructor(readonly name = DB_NAME) {
    this.db = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
        // Anything a store wants to remember about a project besides the
        // project itself: CloudStore's sync state lives here.
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      open.onsuccess = () => resolve(open.result);
      // Private windows in some browsers, or storage turned off: say so
      // plainly instead of failing on the first save.
      open.onerror = () => reject(new Error("This browser won't let GameIDE save projects (is it a private window?)."));
    });
  }

  async list(): Promise<ProjectSummary[]> {
    const db = await this.db;
    const all = (await request(db.transaction("projects").objectStore("projects").getAll())) as Project[];
    return all
      .map((p) => ({ id: p.id, name: p.name, modified: p.modified }))
      .sort((a, b) => b.modified.localeCompare(a.modified));
  }

  async load(id: string): Promise<Project | null> {
    const db = await this.db;
    const p = await request(db.transaction("projects").objectStore("projects").get(id));
    return p ? migrate(p) : null;
  }

  async save(project: Project): Promise<SaveOutcome> {
    const db = await this.db;
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project);
    await done(tx);
    return { state: "saved" };
  }

  async remove(id: string): Promise<void> {
    const db = await this.db;
    const tx = db.transaction(["projects", "assets", "meta"], "readwrite");
    tx.objectStore("projects").delete(id);
    tx.objectStore("assets").delete(IDBKeyRange.bound([id, ""], [id, "\uffff"]));
    tx.objectStore("meta").delete(id);
    await done(tx);
  }

  async getMeta<T>(id: string): Promise<T | null> {
    const db = await this.db;
    return ((await request(db.transaction("meta").objectStore("meta").get(id))) as T) ?? null;
  }

  async setMeta<T>(id: string, value: T): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(value, id);
    await done(tx);
  }

  /** Throws the whole database away (a signed-out cache with nothing unsaved in it). */
  async destroy(): Promise<void> {
    const db = await this.db;
    db.close();
    await new Promise<void>((resolve) => {
      const r = indexedDB.deleteDatabase(this.name);
      r.onsuccess = r.onerror = r.onblocked = () => resolve();
    });
  }

  async putAsset(projectId: string, assetId: string, blob: Blob): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(blob, [projectId, assetId]);
    await done(tx);
  }

  async getAsset(projectId: string, assetId: string): Promise<Blob | null> {
    const db = await this.db;
    return ((await request(db.transaction("assets").objectStore("assets").get([projectId, assetId]))) as Blob) ?? null;
  }
}

/** Every asset a project uses, fetched. Missing ones are left out (and the sprite draws blank). */
export async function loadAssets(store: ProjectStore, project: Project): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  const ids = assetIds(project);
  await Promise.all(
    ids.map(async (id) => {
      const b = await store.getAsset(project.id, id);
      if (b) out.set(id, b);
    }),
  );
  return out;
}
