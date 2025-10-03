import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const cwd = dirname(fileURLToPath(import.meta.url));
const root = resolve(cwd, '..');

function loadEnv(path: string) {
  if (existsSync(path)) {
    dotenv.config({ path });
  }
}

loadEnv(resolve(root, '.env'));
loadEnv(resolve(root, 'apps/api/.env'));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not configured. Create .env (and apps/api/.env if needed) from the templates before running migrations.');
  process.exit(1);
}

function run(command: string, args: string[], ignoreFailure = false) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0 && !ignoreFailure) {
    process.exit(result.status ?? 1);
  }
}

function tryDockerCompose() {
  const docker = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  if (docker.status !== 0) {
    console.warn('Docker does not appear to be available. Ensure PostgreSQL is running locally before continuing.');
    return;
  }

  console.log('\nAttempting to start database containers with docker compose...');
  run('docker', ['compose', 'up', '-d', 'db', 'mongo'], true);
}

tryDockerCompose();

console.log('\nWaiting for PostgreSQL to become healthy...');
run('pnpm', ['run', 'db:wait'], true);

console.log('\nRunning migrations and seed commands (idempotent)...');
run('pnpm', ['run', 'first-run']);

console.log('\nMigrations complete.');
