import { promisify } from 'node:util';

const sleep = promisify(setTimeout);

export default async function globalTeardown() {
  console.log('Shutting down dev server...');

  const server = (global as any).__SERVER_PROCESS__;
  if (server) {
    server.kill('SIGTERM');

    // Give it time to shut down gracefully
    await sleep(1000);

    if (!server.killed) {
      server.kill('SIGKILL');
    }

    console.log('Dev server shut down');
  }
}
