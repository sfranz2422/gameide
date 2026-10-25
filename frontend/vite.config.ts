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

export default defineConfig({
  plugins: [react(), servePyodide()],
  // Pre-bundling pyodide breaks its own lookup of the files next to it.
  optimizeDeps: { exclude: ["pyodide"] },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The bridge suites start a real Pyodide, which takes a few seconds cold.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
