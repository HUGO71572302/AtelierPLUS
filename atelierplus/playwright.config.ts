import "dotenv/config";
import { defineConfig } from "@playwright/test";

// Start the production app with the managed preview before running this suite.
// No long-lived server is started by Playwright.
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "/tmp/atelierplus-browser-results",
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    browserName: "chromium",
    serviceWorkers: "allow",
    screenshot: "only-on-failure",
    // Avoid writing session tokens to network traces.
    trace: "off",
  },
  projects: [
    { name: "ordinateur", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
