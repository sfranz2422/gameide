/**
 * Export → Steam: a build kit for a desktop version of the game, the way
 * GDevelop makes Steam builds — an Electron app holding the HTML5 player
 * and the game, so it runs offline in its own window.
 *
 * The kit is a folder to build on a computer with Node: `npm install`, then
 * `npm run steam` makes steam/windows, steam/mac and steam/linux, ready to
 * upload to Steam with Steamworks' tools. (Building there rather than here:
 * Electron is packaged once per platform, ~100 MB each, and the teacher who
 * uploads to Steam has Node anyway.) The README walks through it.
 *
 * Inside the app, the player is served on its own scheme (app://game/),
 * not file:// — browsers won't run module workers or fetch files from
 * file:// pages — with the cross-origin isolation headers, so a stuck loop
 * can still be stopped at its line, as in the editor. Save files persist in
 * the app's own storage between launches.
 *
 * Versions are pinned: a kit made today builds the same way next year.
 */
import { strToU8, zipSync, type Zippable } from "fflate";
import { html5Files } from "./html5";
import type { Project } from "./project";

export const ELECTRON_VERSION = "44.7.0";
export const PACKAGER_VERSION = "20.3.0";

/** A name that works as a file and folder name on Windows, macOS and Linux. */
export function appName(name: string): string {
  return name.replace(/[^A-Za-z0-9 _-]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Game";
}

/** The game window's size: the first room's view, as in the editor. */
function windowSize(project: Project) {
  const room = project.rooms[0];
  const cam = room?.camera?.enabled ? room.camera : null;
  const w = cam?.width ?? room?.width ?? 1280;
  const h = cam?.height ?? room?.height ?? 720;
  // At least 2× small pixel-art rooms, at most 1600 wide: a sensible window.
  const k = Math.max(1, Math.min(Math.floor(1600 / w), Math.floor(900 / h), 3));
  return { width: w * k, height: h * k };
}

const MAIN_JS = `// The desktop app around the game (made by GameIDE's Export → Steam).
// It shows web/index.html — the game's HTML5 player — in a window of its own.
const { app, BrowserWindow, Menu, protocol } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const GAME = require("./game.json");

const WEB = path.join(__dirname, "web");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip",
  ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
};

// The game is served as app://game/, not file:// (browsers won't run its
// workers from file://), with the headers that let a stuck loop be stopped.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

app.whenReady().then(() => {
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const file = path.normalize(path.join(WEB, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
    if (!file.startsWith(WEB + path.sep)) return new Response("Not here.", { status: 403 });
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, {
        headers: {
          "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      });
    } catch {
      return new Response("Not found.", { status: 404 });
    }
  });

  // No menu bar — on a Mac, just the app menu, so Cmd+Q still quits.
  Menu.setApplicationMenu(process.platform === "darwin" ? Menu.buildFromTemplate([{ role: "appMenu" }]) : null);
  const win = new BrowserWindow({
    width: GAME.width,
    height: GAME.height,
    title: GAME.name,
    fullscreen: GAME.fullscreen,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: { autoplayPolicy: "no-user-gesture-required", devTools: !app.isPackaged },
  });
  // F11 (and Cmd+Ctrl+F on a Mac) switches full screen.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  win.on("page-title-updated", (event) => event.preventDefault());
  win.loadURL("app://game/index.html?autostart");
});

app.on("window-all-closed", () => app.quit());
`;

const BUILD_JS = `// npm run steam: the game as desktop apps, in steam/windows, steam/mac and
// steam/linux — each folder is what one Steam depot uploads.
const fs = require("node:fs");
const path = require("node:path");
const { packager } = require("@electron/packager");
const GAME = require("./game.json");

const TARGETS = [
  { platform: "win32", arch: "x64", folder: "windows" },
  { platform: "linux", arch: "x64", folder: "linux" },
  // A Mac app that runs on both Intel and Apple-silicon Macs. Only a Mac
  // can make one; elsewhere it is skipped.
  ...(process.platform === "darwin" ? [{ platform: "darwin", arch: "universal", folder: "mac" }] : []),
];

(async () => {
  const out = path.join(__dirname, "steam");
  fs.rmSync(out, { recursive: true, force: true });
  for (const t of TARGETS) {
    console.log(\`Building for \${t.folder}…\`);
    const [made] = await packager({
      dir: __dirname,
      out: path.join(out, "tmp"),
      name: GAME.name,
      executableName: GAME.name,
      appVersion: GAME.version,
      platform: t.platform,
      arch: t.arch,
      overwrite: true,
      asar: false,
      prune: true,
      ignore: [/^\\/steam($|\\/)/, /^\\/README/, /^\\/build\\.js$/],
    });
    fs.renameSync(made, path.join(out, t.folder));
  }
  fs.rmSync(path.join(out, "tmp"), { recursive: true, force: true });
  console.log("\\nDone. Upload steam/windows" + (TARGETS.some((t) => t.folder === "mac") ? ", steam/mac" : "") + " and steam/linux to Steam (see README.md).");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;

function readme(name: string) {
  return `# ${name} — Steam build kit

Made by GameIDE's **Export → Steam**. This folder turns the game into desktop
apps for Windows, macOS and Linux — the folders Steam wants — and lets you
try it on your computer first.

## 1. Build it (once per update of the game)

You need **Node.js** (https://nodejs.org, the LTS version). In a terminal, in
this folder:

    npm install
    npm run steam

That makes:

| Folder | What it is | Steam launch option |
|---|---|---|
| \`steam/windows\` | Windows, 64-bit | \`${name}.exe\` |
| \`steam/mac\` | macOS, Intel and Apple silicon (only built on a Mac) | \`${name}.app\` |
| \`steam/linux\` | Linux / Steam Deck, 64-bit | \`${name}\` |

To play it right away without building: \`npm start\`.

The game opens full screen; **F11** switches full screen on and off. Its
save files (\`save_set\`) stay on the player's computer between launches.

## 2. Put it on Steam

1. In Steamworks (https://partner.steamgames.com), your app's
   **SteamPipe → Depots**: one depot per platform you're shipping
   (Windows, and macOS / Linux if you want them).
2. **Installation → General**: a launch option per platform, with the
   executable from the table above.
3. Upload each \`steam/…\` folder to its depot — with the web uploader
   (zip the folder's contents), or SteamCMD's \`run_app_build\`.
4. Set the build live on a branch, and try it from your Steam library.

When the game changes: export a new kit from GameIDE, \`npm run steam\` again,
and upload again.

## Good to know

- The Mac app isn't signed by Apple. Started from Steam it runs; opened by
  double-clicking a downloaded copy, macOS asks first (right-click → Open).
- The app's icon is Electron's. Steam shows your store and library art
  instead; to change the app's own icon, add \`"icon"\` to \`build.js\`'s
  packager options (an .ico for Windows, an .icns for macOS).
- Steam achievements aren't in this kit yet.
`;
}

export async function exportSteamKit(project: Project, getAsset: (id: string) => Promise<Blob | null>, progress: (done: number, of: number) => void = () => {}): Promise<Blob> {
  const name = appName(project.name);
  const web = await html5Files(project, getAsset, progress);
  const zip: Zippable = {};
  for (const [path, data] of Object.entries(web)) zip[`web/${path}`] = data;
  zip["main.js"] = strToU8(MAIN_JS);
  zip["build.js"] = strToU8(BUILD_JS);
  zip["game.json"] = strToU8(JSON.stringify({ name, version: "1.0.0", fullscreen: true, ...windowSize(project) }, null, 2));
  zip["package.json"] = strToU8(
    JSON.stringify(
      {
        name: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game",
        productName: name,
        version: "1.0.0",
        private: true,
        description: `${name}, made with GameIDE`,
        main: "main.js",
        scripts: { start: "electron .", steam: "node build.js" },
        devDependencies: { electron: ELECTRON_VERSION, "@electron/packager": PACKAGER_VERSION },
      },
      null,
      2,
    ),
  );
  zip["README.md"] = strToU8(readme(name));
  return new Blob([zipSync(zip, { level: 6 }) as BlobPart], { type: "application/zip" });
}
