// Load .env so the specs can sign a session cookie with the same JWT_SECRET the
// dev server verifies against. Playwright does not read .env on its own.
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// E2E / responsive checks. Kept separate from the vitest suite (tests/) so the two
// runners never collide: vitest owns tests/**/*.test.ts, playwright owns e2e/**/*.spec.ts.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
