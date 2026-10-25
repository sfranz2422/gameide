import { createReadStream, copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
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
  server: { headers: ISOLATION },
  preview: { headers: ISOLATION },
  // The game worker imports Pixi and Pyodide; ES modules let it split them.
  worker: { format: "es" },
  // Pre-bundling pyodide breaks its own lookup of the files next to it.
  // Pixi is listed because only the game worker imports it: the dev server
  // would otherwise find it on the first Play and reload the page, losing
  // whatever the student had open.
  optimizeDeps: { exclude: ["pyodide"], include: ["pixi.js"] },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The bridge suites start a real Pyodide, which takes a few seconds cold.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
