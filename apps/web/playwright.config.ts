import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    headless: true, // Always use headless mode to avoid browser launch issues
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
