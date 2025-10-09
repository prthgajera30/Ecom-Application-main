import { test as setup } from '@playwright/test';
import { spawn } from 'node:child_process';

// Start Next dev and poll the URL until it responds with 200.
setup('start dev server', async ({}) => {
  console.log('Starting dev server (global-setup)...');

  const server = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: process.cwd() + '/apps/web',
    stdio: 'inherit',
    shell: true,
  });

  const start = Date.now();
  const timeout = 120_000; // 2 minutes
  const url = 'http://localhost:3000';

  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log('Dev server started successfully');
        (global as any).__SERVER_PROCESS__ = server;
        return;
      }
    } catch (e) {
      // ignore, server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.error('Dev server failed to start within timeout');
  // kill process and throw
  try { server.kill(); } catch (e) {}
  throw new Error('Dev server did not become ready');
});
