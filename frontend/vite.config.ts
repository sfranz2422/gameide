import { createReadStream, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Pyodide is served from our own origin, out of node_modules, rather than
// from a CDN. Two reasons: the version the browser runs is then exactly the
// version the Vitest suites run (they load the same package in node), and a
// school network that blocks jsdelivr cannot stop a game from starting.
//
// Only the files the runtime actually fetches are copied. Wheels for extra
// packages are not part of the npm package and are not needed — student game
// logic uses the standard library only.
const PYODIDE_FILES = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];

const require = createRequire(import.meta.url);
const pyodideDir = dirname(require.resolve("pyodide/package.json"));

// Blockly's cursors, icons and sounds. It would fetch them from Google's
// demo site unless told otherwise; served from here, a school filter can't
// leave the blocks editor without its trash can and drag cursors.
// (Found from Blockly's main file: its package doesn't export package.json.)
const blocklyMediaDir = join(dirname(require.resolve("blockly")), "media");

function servePyodide(): Plugin {
  const types: Record<string, string> = {
    ".mjs": "text/javascript",
    ".wasm": "application/wasm",
    ".zip": "application/zip",
    ".json": "application/json",
  };
  return {
    name: "gameide-pyodide",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const media = req.url?.match(/^\/blockly-media\/([\w.-]+)/)?.[1];
        if (media && existsSync(join(blocklyMediaDir, media))) {
          res.setHeader("Content-Type", media.endsWith(".svg") ? "image/svg+xml" : media.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream");
          for (const [k, v] of Object.entries(ISOLATION)) res.setHeader(k, v);
          createReadStream(join(blocklyMediaDir, media)).pipe(res);
          return;
        }
        const m = req.url?.match(/^\/pyodide\/([^?]+)/);
        const file = m?.[1];
        if (!file || !PYODIDE_FILES.includes(file)) return next();
        const path = join(pyodideDir, file);
        const ext = file.slice(file.lastIndexOf("."));
        res.setHeader("Content-Type", types[ext] ?? "application/octet-stream");
        res.setHeader("Content-Length", String(statSync(path).size));
        for (const [k, v] of Object.entries(ISOLATION)) res.setHeader(k, v);
        createReadStream(path).pipe(res);
      });
    },
    writeBundle(options) {
      const out = join(options.dir ?? resolve("dist"), "pyodide");
      if (!existsSync(out)) mkdirSync(out, { recursive: true });
      for (const f of PYODIDE_FILES) copyFileSync(join(pyodideDir, f), join(out, f));
      const media = join(options.dir ?? resolve("dist"), "blockly-media");
      if (!existsSync(media)) mkdirSync(media, { recursive: true });
      for (const f of readdirSync(blocklyMediaDir)) copyFileSync(join(blocklyMediaDir, f), join(media, f));
      // What an exported game (store/html5.ts) copies besides itself: the
      // player page and every built script and style, and Pyodide. Every
      // file in assets/ rather than only the player's: the game's worker is
      // bundled on its own, out of sight of the main build's chunk graph,
      // and a file missed here would be a blank exported game.
      const dir = options.dir ?? resolve("dist");
      const built = readdirSync(join(dir, "assets")).filter((f) => !f.endsWith(".map")).map((f) => `assets/${f}`);
      const files = ["play.html", ...built, ...PYODIDE_FILES.map((f) => `pyodide/${f}`)];
      writeFileSync(join(dir, "player-files.json"), JSON.stringify(files));
    },
  };
}

// Cross-origin isolation, so SharedArrayBuffer exists and a stuck game can
// be interrupted at the line it is on (see editor/gameHost.ts). The server
// in Phase 3 must send the same two headers. "credentialless" rather than
// "require-corp", so pictures from other sites (Google profile photos) still
// load without each one opting in.
const ISOLATION = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  plugins: [react(), servePyodide()],
  // Relative paths throughout, so an exported game (the player page and
  // its files, store/html5.ts) works from any folder of any web host —
  // itch.io serves each game under a path of its own. The play page on our
  // own server sets <base href="/"> to keep them right at /play/<id>.
  base: "./",
  build: {
    rollupOptions: {
      // The editor, and the player that published and exported games run in.
      input: { main: resolve("index.html"), play: resolve("play.html") },
    },
  },
  // In development the editor is served by Vite and the API by Flask
  // (backend/app.py on 5001); these go through to Flask so both share one
  // origin, as they do in production where Flask serves everything.
  server: {
    headers: ISOLATION,
    proxy: Object.fromEntries(
      ["/api", "/login", "/logout", "/auth", "/dev"].map((p) => [p, { target: "http://127.0.0.1:5001", changeOrigin: false }]),
    ),
  },
  // Not the dev proxy (preview would inherit it): the editor tests run the
  // build on its own, with no server behind it, as a static host would.
  preview: { headers: ISOLATION, proxy: {} },
  // The game worker imports Pixi and Pyodide; ES modules let it split them.
  worker: { format: "es" },
  // Pre-bundling pyodide breaks its own lookup of the files next to it.
  // Pixi is listed because only the game worker imports it: the dev server
  // would otherwise find it on the first Play and reload the page, losing
  // whatever the student had open.
  // Blockly likewise: only the lazily loaded Blocks tab imports it.
  optimizeDeps: { exclude: ["pyodide"], include: ["pixi.js", "blockly/core", "blockly/blocks", "blockly/python", "blockly/msg/en"] },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The bridge suites start a real Pyodide, which takes a few seconds cold.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
