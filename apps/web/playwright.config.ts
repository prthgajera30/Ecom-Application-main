import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'next start -p 3000',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:3000' },
});
