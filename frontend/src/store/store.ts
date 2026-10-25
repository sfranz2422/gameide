/**
 * Where projects are kept. The editor only ever talks to a ProjectStore;
 * LocalStore keeps everything in this browser's IndexedDB, and Phase 3 adds
 * CloudStore (the server) with LocalStore as its offline cache.
 */
import { migrate, type Project } from "./project";

export interface ProjectSummary {
  id: string;
  name: string;
  modified: string;
}

export interface ProjectStore {
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
  putAsset(projectId: string, assetId: string, blob: Blob): Promise<void>;
  getAsset(projectId: string, assetId: string): Promise<Blob | null>;
}

const DB_NAME = "gameide";
const DB_VERSION = 1;

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
  private db: Promise<IDBDatabase>;

  constructor(name = DB_NAME) {
    this.db = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
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

  async save(project: Project): Promise<void> {
    const db = await this.db;
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project);
    await done(tx);
  }

  async remove(id: string): Promise<void> {
    const db = await this.db;
    const tx = db.transaction(["projects", "assets"], "readwrite");
    tx.objectStore("projects").delete(id);
    tx.objectStore("assets").delete(IDBKeyRange.bound([id, ""], [id, "￿"]));
    await done(tx);
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
  const ids = project.sprites.flatMap((s) => s.frames);
  await Promise.all(
    ids.map(async (id) => {
      const b = await store.getAsset(project.id, id);
      if (b) out.set(id, b);
    }),
  );
  return out;
}
