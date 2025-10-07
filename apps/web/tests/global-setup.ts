import { test as setup } from '@playwright/test';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const sleep = promisify(setTimeout);

setup('start dev server', async ({}) => {
  console.log('Starting dev server...');

  // Start the web server
  const server = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: process.cwd() + '/apps/web',
    stdio: 'inherit',
    shell: true
  });

  // Give it time to start
  await sleep(5000);

  // Test if server is responding
  try {
    const response = await fetch('http://localhost:3000');
    if (!response.ok) {
      throw new Error('Server not ready');
    }
    console.log('Dev server started successfully');
  } catch (error) {
    console.error('Server startup check failed:', error);
    throw error;
  }

  // Store process reference for cleanup in global teardown
  (global as any).__SERVER_PROCESS__ = server;
});
