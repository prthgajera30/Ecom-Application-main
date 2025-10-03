import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const repoRoot = process.cwd();
const apiDir = join(repoRoot, 'apps', 'api');
const composeFile = join(repoRoot, 'infra', 'docker-compose.yml');

// Load environment variables from both the repo root and the API package if available.
loadEnv();
const apiEnvPath = join(repoRoot, 'apps', 'api', '.env');
if (existsSync(apiEnvPath)) {
  loadEnv({ path: apiEnvPath, override: false });
}

function describeDbTarget(rawUrl: string | undefined | null) {
  if (!rawUrl) {
    return 'the configured PostgreSQL instance';
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname || parsed.host || 'localhost';
    const port = parsed.port || '5432';
    return `${host}:${port}`;
  } catch {
    return rawUrl;
  }
}

const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;

function resolvePnpmInvocation(args: string[]) {
  const execPath = process.env.npm_execpath ?? '';
  if (execPath && execPath.endsWith('.cjs')) {
    return { command: process.execPath, args: [execPath, ...args] } as const;
  }
  return { command: execPath || 'pnpm', args } as const;
}

type MigrateResult =
  | { success: true }
  | { success: false; combinedMessage: string; exitCode: number };

function runMigrations(): MigrateResult {
  const invocation = resolvePnpmInvocation(['prisma', 'migrate', 'deploy']);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: apiDir,
    encoding: 'utf-8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const exitCode = typeof result.status === 'number' ? result.status : 1;

  if (!result.error && result.status === 0 && !result.signal) {
    console.log('Migrations applied');
    return { success: true };
  }

  const combinedMessage = [result.stdout ?? '', result.stderr ?? '', result.error?.message ?? '']
    .filter(Boolean)
    .join('\n');

  return {
    success: false,
    combinedMessage,
    exitCode,
  };
}

function getDbHost(rawUrl: string | undefined | null) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || parsed.host || null;
  } catch {
    return null;
  }
}

function resolveComposeInvocation() {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return { command: 'docker', args: ['compose'] } as const;
  } catch {
    // fall through
  }

  try {
    execSync('docker-compose --version', { stdio: 'ignore' });
    return { command: 'docker-compose', args: [] as string[] } as const;
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(['postgres', 'localhost', '127.0.0.1', '0.0.0.0']);

function tryAutoStartDatabases(host: string | null) {
  if (process.env.SKIP_AUTO_START_DB === '1') {
    return false;
  }

  if (!host || !LOCAL_HOSTS.has(host)) {
    return false;
  }

  if (!existsSync(composeFile)) {
    return false;
  }

  const composeInvocation = resolveComposeInvocation();
  if (!composeInvocation) {
    console.error(
      'Docker Compose is not available in PATH, so the migration helper cannot auto-start PostgreSQL. Start your database manually and re-run `pnpm migrate`.',
    );
    return false;
  }

  console.log('PostgreSQL is unreachable. Attempting to start postgres and mongo via Docker Compose...');

  const result = spawnSync(
    composeInvocation.command,
    [...composeInvocation.args, '-f', composeFile, 'up', '-d', 'postgres', 'mongo'],
    { cwd: repoRoot, stdio: 'inherit' },
  );

  if (result.error) {
    console.error(`Failed to start Docker Compose services: ${result.error.message}`);
    return false;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`Docker Compose exited with code ${result.status}. Start the databases manually and retry.`);
    return false;
  }

  return true;
}

const dbHost = getDbHost(dbUrl);

let attempt = runMigrations();

if (!attempt.success && attempt.combinedMessage.includes('P1001')) {
  const autoStarted = tryAutoStartDatabases(dbHost);
  if (autoStarted) {
    console.log('Retrying migrations now that the databases are starting...');
    attempt = runMigrations();
  }
}

if (attempt.success) {
  process.exit(0);
}

const combinedMessage = attempt.combinedMessage;

if (combinedMessage.includes('Environment variable not found: POSTGRES_URL')) {
  console.error(
    'POSTGRES_URL is not set. Copy infra/.env.example to apps/api/.env (or export POSTGRES_URL) so Prisma knows how to reach your database.',
  );
} else if (combinedMessage.includes('P1001')) {
  const target = describeDbTarget(dbUrl);
  console.error(
    `Prisma could not reach PostgreSQL at ${target}. ` +
      'Ensure the database is running (the migration helper will auto-start docker compose if available) and rerun `pnpm migrate`.',
  );
} else {
  console.error('Migration failed');
}

process.exit(attempt.exitCode);
