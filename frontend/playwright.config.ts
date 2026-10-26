import { defineConfig } from "@playwright/test";

// Two servers, two kinds of test:
//   editor   the production build on its own (vite preview): no server
//            behind it, so no sign-in, projects in the browser.
//   account  the same build served by Flask (backend/app.py) with the dev
//            sign-in on and a throwaway SQLite database, so signing in,
//            saving to the account, offline and History run for real.
const DB = `${process.cwd()}/../backend/tests/e2e.db`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: { viewport: { width: 1366, height: 768 } },
  projects: [
    { name: "editor", testMatch: /(editor|sprites|rooms|tiles)\.spec\.ts/, use: { baseURL: "http://localhost:4173" } },
    { name: "account", testMatch: "account.spec.ts", use: { baseURL: "http://127.0.0.1:5055" } },
  ],
  webServer: [
    {
      command: "npm run build && npm run preview",
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `rm -f ${DB} && cd ../backend && GAMEIDE_DEV_LOGIN=1 GAMEIDE_TEST_DATABASE_URL=sqlite:///${DB} PORT=5055 .venv/bin/python -c "import app; app.app.run(port=5055)"`,
      url: "http://127.0.0.1:5055/healthz",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
