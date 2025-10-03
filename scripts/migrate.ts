import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { config as loadEnv } from 'dotenv';

const repoRoot = process.cwd();

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

try {
  const stdout = execSync('pnpm prisma migrate deploy', { cwd: 'apps/api' });
  if (stdout.length) {
    process.stdout.write(stdout);
  }
  console.log('Migrations applied');
} catch (error) {
  const err = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
  const stdout = err.stdout?.toString() ?? '';
  const stderr = err.stderr?.toString() ?? '';
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  const combinedMessage = `${stdout}\n${stderr}\n${err.message ?? ''}`;
  if (combinedMessage.includes('Environment variable not found: POSTGRES_URL')) {
    console.error(
      'POSTGRES_URL is not set. Copy infra/.env.example to apps/api/.env (or export POSTGRES_URL) so Prisma knows how to reach your database.',
    );
  } else if (combinedMessage.includes('P1001')) {
    const target = describeDbTarget(dbUrl);
    console.error(
      `Prisma could not reach PostgreSQL at ${target}. ` +
        'Start the database before running migrations (for example, `docker compose -f infra/docker-compose.yml up postgres mongo -d` or ensure your local Postgres service is accepting connections).',
    );
  } else {
    console.error('Migration failed');
  }

  process.exit(1);
}
