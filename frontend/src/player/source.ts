/**
 * Where the player gets its game: the folder of an exported game, or a
 * published game on our server. Either way it is a project and its files —
 * the same as the editor works on — and the player builds the game from
 * them (python/codegen.ts), so an exported or published game runs exactly
 * the code the editor ran.
 */
import { assetIds, migrate, type Project } from "../store/project";

export interface GamePackage {
  project: Project;
  assets: Map<string, Blob>;
}

/** What the play page shows about a published game (from /api/play/<id>). */
export interface PublishedInfo {
  id: string;
  title: string;
  description: string;
  author: string;
  plays: number;
  likes: number;
  liked: boolean;
  allowRemix: boolean;
  tags: string[];
  visibility: "unlisted" | "class" | "public";
  status: string;
  /** Signed in? (Liking, remixing and reporting need it.) */
  signedIn: boolean;
  /** May this viewer take it down (its teacher, an admin)? */
  canModerate: boolean;
  remixOf: { id: string; title: string; author: string } | null;
}

/** The index an exported game carries beside project.json: asset id → file in the folder. */
export interface ExportIndex {
  project: string;
  assets: Record<string, string>;
}

async function fetchBlob(url: string): Promise<Blob | null> {
  const r = await fetch(url);
  return r.ok ? r.blob() : null;
}

/** An exported game: game/index.json, game/project.json and game/assets/, next to the page. */
export async function loadExported(): Promise<GamePackage> {
  const base = new URL("game/", document.baseURI);
  const r = await fetch(new URL("index.json", base));
  if (!r.ok) throw new Error("This folder has no game in it (game/index.json is missing).");
  const index = (await r.json()) as ExportIndex;
  const project = migrate(await (await fetch(new URL(index.project, base))).json());
  const assets = new Map<string, Blob>();
  await Promise.all(
    Object.entries(index.assets).map(async ([id, file]) => {
      const b = await fetchBlob(new URL(file, base).href);
      if (b) assets.set(id, b);
    }),
  );
  return { project, assets };
}

export class PlayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** A published game, as this viewer may see it. */
export async function loadPublished(id: string): Promise<{ info: PublishedInfo; pkg: GamePackage }> {
  const r = await fetch(`/api/play/${encodeURIComponent(id)}`);
  const body = (await r.json().catch(() => ({}))) as { error?: string; info?: PublishedInfo; project?: unknown };
  if (!r.ok || !body.info) throw new PlayError(body.error ?? "This game couldn't be opened.", r.status);
  const project = migrate(body.project);
  const assets = new Map<string, Blob>();
  await Promise.all(
    assetIds(project).map(async (a) => {
      const b = await fetchBlob(`/api/play/${encodeURIComponent(id)}/assets/${encodeURIComponent(a)}`);
      if (b) assets.set(a, b);
    }),
  );
  return { info: body.info, pkg: { project, assets } };
}
