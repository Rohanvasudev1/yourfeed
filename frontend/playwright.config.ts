import { defineConfig, devices } from "@playwright/test";

/** Ports of their own, so the smoke test never talks to a dev server left running from another checkout. */
const API_PORT = 8010;
const APP_PORT = 5183;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const SERVER_START_TIMEOUT_MS = 120_000;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: APP_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: "../backend",
      /** No AI key and no Google secrets, so the keyword rules answer and the app is demo-only whatever the shell has set. */
      env: {
        AI_BASE_URL: "",
        AI_API_KEY: "",
        AI_MODEL: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        SESSION_SECRET: "",
        TOKEN_ENCRYPTION_KEY: "",
      },
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      timeout: SERVER_START_TIMEOUT_MS,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${APP_PORT} --strictPort`,
      env: { YOURFEED_API_URL: `http://127.0.0.1:${API_PORT}` },
      url: APP_URL,
      timeout: SERVER_START_TIMEOUT_MS,
      reuseExistingServer: false,
    },
  ],
});
