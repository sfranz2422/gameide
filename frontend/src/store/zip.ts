/**
 * A project as a .zip file and back: project.json plus every picture under
 * assets/. The same format whether the project came from the server or the
 * browser, so a game can move between accounts, schools, or GameIDE
 * installs, and a student can keep their own copy.
 *
 * Importing never overwrites anything: the project gets a fresh id, and
 * " (imported)" when a game of that name already exists.
 */
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { migrate, newId, type Project } from "./project";

const MAX_IMPORT_BYTES = 60_000_000;

function extensionFor(type: string) {
  return type === "image/jpeg" ? "jpg" : type === "image/gif" ? "gif" : type === "image/webp" ? "webp" : "png";
}

export async function exportZip(project: Project, getAsset: (id: string) => Promise<Blob | null>): Promise<Blob> {
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(project, null, 2)),
  };
  const index: Record<string, string> = {};
  for (const id of new Set([...project.sprites.flatMap((s) => s.frames), ...(project.tilesets ?? []).flatMap((t) => (t.image ? [t.image] : []))])) {
    const blob = await getAsset(id);
    if (!blob) continue;
    const name = `assets/${id}.${extensionFor(blob.type)}`;
    files[name] = new Uint8Array(await blob.arrayBuffer());
    index[id] = name;
  }
  files["assets/index.json"] = strToU8(JSON.stringify(index, null, 2));
  files["README.txt"] = strToU8(
    `${project.name}\n\nA GameIDE project. To open it, go to GameIDE's front page and use Import.\n` +
      "project.json holds the objects, events, rooms and scripts; assets/ holds the pictures.\n",
  );
  // Pictures are already compressed; level 6 still shrinks the JSON well.
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}

export interface Imported {
  project: Project;
  assets: Map<string, Blob>;
}

/** Reads a .zip made by exportZip. Throws with a sentence a student can act on. */
export async function importZip(file: Blob, existingNames: string[]): Promise<Imported> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is too big to be a GameIDE project.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("That isn't a .zip file GameIDE can open.");
  }
  // Accept a zip whose files sit inside one folder (zipped by hand).
  const prefix = Object.keys(entries).find((k) => k.endsWith("project.json"))?.slice(0, -"project.json".length);
  if (prefix === undefined) throw new Error("That .zip has no project.json in it, so it isn't a GameIDE project.");
  let project: Project;
  try {
    project = migrate(JSON.parse(strFromU8(entries[prefix + "project.json"]!)));
  } catch (e) {
    throw new Error(e instanceof SyntaxError ? "That project's project.json is damaged." : (e as Error).message);
  }
  const index = entries[prefix + "assets/index.json"];
  const names: Record<string, string> = index ? JSON.parse(strFromU8(index)) : {};
  const assets = new Map<string, Blob>();
  for (const [id, name] of Object.entries(names)) {
    const bytes = entries[prefix + name];
    if (!bytes) continue;
    const ext = name.split(".").pop() ?? "png";
    const type = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    assets.set(id, new Blob([bytes as BlobPart], { type }));
  }
  const now = new Date().toISOString();
  project.id = newId();
  project.created = now;
  project.modified = now;
  if (existingNames.includes(project.name)) project.name = `${project.name} (imported)`;
  return { project, assets };
}

/** Hands the browser a file to save. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFileName(name: string) {
  return (name.replace(/[^\w\- ]+/g, "").trim() || "game").replace(/\s+/g, "-");
}
