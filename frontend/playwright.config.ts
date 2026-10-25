import { defineConfig, devices } from "@playwright/test";

// Own ports and database so e2e never collides with `make run` / `make fe-dev`.
const WEB_PORT = 3100;

/**
 * Runs the real stack: Vite (mocks off) proxying /api to Django on a dedicated
 * `tangostack_e2e` database. Needs Postgres up (`make db-up`).
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  // one shared database, flushed before every test
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "make -s -C .. e2e-backend",
      url: "http://localhost:8001/api/lists",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite dev --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { VITE_API_MOCKING: "false", API_PROXY_TARGET: "http://localhost:8001" },
    },
  ],
});
