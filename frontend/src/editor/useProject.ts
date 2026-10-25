/**
 * The open project: its state, how to change it, and autosave.
 *
 * Every change goes through `mutate(recipe)`, which runs the recipe on a
 * copy and swaps the copy in. Recipes must not make ids or touch anything
 * outside the copy: React may run them twice (StrictMode does), and only
 * one result is kept — an id made inside would differ from the one the
 * caller remembered. Make new things first, then push them in the recipe.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { migrate, type Project } from "../store/project";
import { loadAssets, type ProjectStore, type SaveOutcome } from "../store/store";

/**
 * "offline" and "signed-out" are safe: the work is in this browser and goes
 * to the server when it can. Only "error" may mean it isn't saved anywhere
 * it should be, and `saveError` says why.
 */
export type SaveStatus = "saved" | "saving" | "offline" | "signed-out" | "error";

export interface ProjectApi {
  project: Project;
  assets: Map<string, Blob>;
  mutate: (recipe: (draft: Project) => void) => void;
  addAssets: (assets: Map<string, Blob>) => Promise<void>;
  status: SaveStatus;
  saveError: string | null;
  /** Something worth saying about a save that worked ("another tab saved too"). */
  saveNote: string | null;
  /** Swap in a different version of the project (History's restore). */
  replace: (p: Project) => void;
  store: ProjectStore;
}

export const ProjectContext = createContext<ProjectApi | null>(null);

export function useProjectApi(): ProjectApi {
  const api = useContext(ProjectContext);
  if (!api) throw new Error("useProjectApi outside a project");
  return api;
}

const SAVE_DELAY_MS = 600;

/**
 * A safety copy for the moment the page closes. IndexedDB writes are
 * asynchronous, and one started as a tab closes may never finish — so the
 * last few keystrokes would be lost without a word. localStorage writes are
 * synchronous, so the pending project goes there first; the next load
 * prefers it when it is newer than what IndexedDB has, and it is removed
 * once a save has gone through.
 */
const backupKey = (id: string) => `gameide.unsaved.${id}`;

function readBackup(id: string): Project | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function useProjectState(store: ProjectStore, id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<Map<string, Blob>>(new Map());
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loaded = useRef<Project | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Project | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await store.load(id);
        if (cancelled) return;
        if (!stored) return setLoadError("There is no project here. It may have been deleted.");
        const backup = readBackup(id);
        const newer = backup && backup.id === id && backup.modified > stored.modified ? migrate(backup) : null;
        const a = await loadAssets(store, stored);
        if (cancelled) return;
        // With a newer backup, `loaded` stays the stored version, so the
        // autosave sees a change and writes the backup through.
        loaded.current = stored;
        setAssets(a);
        setProject(newer ?? stored);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, id]);

  const save = useCallback(async () => {
    timer.current = null;
    const p = latest.current;
    if (!p) return;
    try {
      const outcome = await store.save(p);
      // In this browser now, whatever the server said: the close-time
      // backup has done its job.
      try {
        localStorage.removeItem(backupKey(p.id));
      } catch {
        /* nothing to remove */
      }
      // Only report it if nothing changed while that save was in flight.
      if (latest.current === p) report(outcome);
    } catch (e) {
      setStatus("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const report = useCallback((o: SaveOutcome) => {
    setStatus(o.state);
    setSaveError(o.state === "error" ? (o.message ?? "Not saved.") : null);
    if (o.note) setSaveNote(o.note);
  }, []);

  // A save that finishes later (back online, signed in again) updates the
  // status too — "Offline" must not stay up after the work has gone through.
  useEffect(() => {
    if (!store.onSync) return;
    return store.onSync((pid, o) => {
      if (pid === id && !timer.current) report(o);
    });
  }, [store, id, report]);

  // Autosave: shortly after the last change, and at once when the page is
  // hidden or closed, so switching tabs never leaves a change unsaved.
  useEffect(() => {
    latest.current = project;
    if (!project || project === loaded.current) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, SAVE_DELAY_MS);
  }, [project, save]);

  useEffect(() => {
    const now = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        const p = latest.current;
        try {
          if (p) localStorage.setItem(backupKey(p.id), JSON.stringify(p));
        } catch {
          /* full or blocked: the IndexedDB save below is all there is */
        }
        void save();
      }
    };
    const onHide = () => document.visibilityState === "hidden" && now();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", now);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", now);
      now();
    };
  }, [save]);

  const mutate = useCallback((recipe: (draft: Project) => void) => {
    setProject((p) => {
      if (!p) return p;
      const next = structuredClone(p);
      recipe(next);
      next.modified = new Date().toISOString();
      return next;
    });
  }, []);

  const addAssets = useCallback(
    async (more: Map<string, Blob>) => {
      if (!more.size) return;
      const p = latest.current ?? loaded.current;
      if (!p) return;
      await Promise.all([...more].map(([aid, blob]) => store.putAsset(p.id, aid, blob)));
      setAssets((a) => new Map([...a, ...more]));
    },
    [store],
  );

  /**
   * Puts a whole different version in place — what the store already holds
   * (History's restore saved it there), so it is "loaded", not a change.
   */
  const replace = useCallback((p: Project) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    loaded.current = p;
    latest.current = p;
    setProject(p);
    setStatus("saved");
    void loadAssets(store, p).then(setAssets);
  }, [store]);

  return { project, assets, mutate, addAssets, status, saveError, saveNote, setSaveNote, loadError, replace };
}
