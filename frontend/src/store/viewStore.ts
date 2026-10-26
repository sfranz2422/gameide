/**
 * Someone else's game, open read only: a teacher looking at a student's
 * work for one of their assignments (backend/classes.py, can_read), or at
 * the version they turned in. It opens in the real editor, so the teacher
 * can look at every event and press Play exactly as the student would.
 *
 * Nothing is ever saved. The teacher may change things to try them out —
 * move a platform, fix a line — and those changes live only in this page;
 * the server would refuse them anyway (only an owner saves). useProject
 * knows a "view" store: it neither autosaves nor keeps a close-time backup
 * of it, because a backup under the student's project id would be shown
 * in place of the student's own work the next time the teacher looked.
 * "Copy to my games" is how a teacher keeps a version of their own.
 */
import { api, ApiError } from "./api";
import { migrate, type Project } from "./project";
import type { ProjectStore, ProjectSummary, SaveOutcome } from "./store";

export class ViewStore implements ProjectStore {
  readonly kind = "view" as const;
  /** Files added while trying things out: kept in this page only. */
  private added = new Map<string, Blob>();

  constructor(
    readonly projectId: string,
    /** A turned-in (or scored) version of it, or null for the game as it is now. */
    readonly versionId: number | null,
  ) {}

  async list(): Promise<ProjectSummary[]> {
    return [];
  }

  async load(id: string): Promise<Project | null> {
    const base = `/api/projects/${encodeURIComponent(id)}`;
    try {
      const r = await api<{ data: unknown }>(this.versionId ? `${base}/versions/${this.versionId}` : base);
      return migrate(r.data);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
      throw e;
    }
  }

  async save(): Promise<SaveOutcome> {
    return { state: "saved" };
  }

  async remove(): Promise<void> {
    throw new Error("This game isn't yours to delete.");
  }

  async putAsset(_projectId: string, assetId: string, blob: Blob): Promise<void> {
    this.added.set(assetId, blob);
  }

  async getAsset(projectId: string, assetId: string): Promise<Blob | null> {
    const mine = this.added.get(assetId);
    if (mine) return mine;
    try {
      const res = await api<Response>(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`);
      return await res.blob();
    } catch {
      return null;
    }
  }
}
