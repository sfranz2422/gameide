/**
 * Exports a game as a web page that runs on its own: the player (play.html,
 * renamed index.html), every built file it may load, Pyodide, and the game
 * itself — project.json and its files under game/.
 *
 * The zip goes straight onto itch.io (an "HTML" project; it wants
 * index.html at the top of the zip) or into any folder of any web host.
 * It can't be opened by double-clicking index.html: browsers don't run
 * module workers from file:// pages. The README says so, and how to try it
 * on your own computer.
 *
 * Everything is fetched from our own server (the files the player needs
 * are listed by the build in player-files.json), so the export is the
 * player this deploy runs, never an older or newer one.
 */
import { strToU8, zipSync, type Zippable } from "fflate";
import type { ExportIndex } from "../player/source";
import { extensionOf } from "./assetTypes";
import { assetIds, type Project } from "./project";

async function bytes(url: URL): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Couldn't fetch ${url.pathname} for the export (${r.status}). Reload the page and try again.`);
  return new Uint8Array(await r.arrayBuffer());
}

/**
 * Every file of the game as a web page, by its path in the folder: the
 * HTML5 export is these zipped; the Steam kit (steamKit.ts) puts them in
 * its web/ folder.
 */
export async function html5Files(project: Project, getAsset: (id: string) => Promise<Blob | null>, progress: (done: number, of: number) => void = () => {}): Promise<Zippable> {
  const base = new URL(".", document.baseURI);
  const listing = await fetch(new URL("player-files.json", base));
  if (!listing.ok) throw new Error("This copy of GameIDE can't export games (player-files.json is missing).");
  const files = (await listing.json()) as string[];
  const zip: Zippable = {};
  let done = 0;
  for (const f of files) {
    const data = await bytes(new URL(f, base));
    // Already compressed (Pyodide's library is a zip itself): stored as it is.
    zip[f === "play.html" ? "index.html" : f] = f.endsWith(".zip") || f.endsWith(".wasm") ? [data, { level: 0 }] : data;
    progress(++done, files.length);
  }

  const index: ExportIndex = { project: "project.json", assets: {} };
  for (const id of assetIds(project)) {
    const blob = await getAsset(id);
    if (!blob) continue;
    const name = `assets/${id}.${extensionOf(blob.type)}`;
    zip[`game/${name}`] = new Uint8Array(await blob.arrayBuffer());
    index.assets[id] = name;
  }
  zip["game/project.json"] = strToU8(JSON.stringify(project));
  zip["game/index.json"] = strToU8(JSON.stringify(index, null, 2));
  return zip;
}

export async function exportHtml5(project: Project, getAsset: (id: string) => Promise<Blob | null>, progress: (done: number, of: number) => void = () => {}): Promise<Blob> {
  const zip = await html5Files(project, getAsset, progress);
  zip["README.txt"] = strToU8(
    `${project.name}\n\nMade with GameIDE. This folder is the whole game, ready to put on the web.\n\n` +
      "On itch.io: make a new project, set Kind of project to HTML, upload this .zip, and tick\n" +
      '"This file will be played in the browser". Ticking "SharedArrayBuffer support" lets a\n' +
      "game that gets stuck in a loop be stopped at its line; it plays either way.\n\n" +
      "On any other website: put these files in a folder there, and open its index.html.\n\n" +
      "On your own computer: double-clicking index.html won't work (browsers don't run games\n" +
      "from files that way). Open a terminal in this folder and run\n\n" +
      "    python3 -m http.server\n\n" +
      "then go to http://localhost:8000 in your browser.\n",
  );
  return new Blob([zipSync(zip, { level: 6 }) as BlobPart], { type: "application/zip" });
}
