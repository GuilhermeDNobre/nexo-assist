import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  globalSetup: "./tests/helpers/playwright-global-setup.ts",
  globalTeardown: "./tests/helpers/playwright-global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `${BASE_URL}/favicon.ico`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      DATABASE_URL_TEST: process.env.DATABASE_URL_TEST ?? "",
      APP_BASE_URL: BASE_URL,
      AGENT_MODEL: "fake",
      TYPESAFE_API_KEY: "",
    },
  },
});
