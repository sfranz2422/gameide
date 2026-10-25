import { defineConfig } from "@playwright/test";

// The smoke test runs against the production build (vite preview), so it
// also catches a build that works in dev and breaks once bundled — Pyodide's
// file lookup is the usual suspect.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:4173", viewport: { width: 1366, height: 768 } },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
