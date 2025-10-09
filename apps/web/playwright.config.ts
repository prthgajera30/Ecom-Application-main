import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    headless: true, // Always use headless mode to avoid browser launch issues
    // Increase action timeout to give slow dev servers more time before failing
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  // Let Playwright start or reuse the Next.js dev server. This avoids
  // race conditions where tests start before Next is listening.
  webServer: {
    command: 'pnpm --filter @apps/web dev',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: true,
  },

  // Note: Use test-runner.js to automatically start/stop servers
  // Or manually run: pnpm run stop && pnpm run dev (background) && npx playwright test

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
