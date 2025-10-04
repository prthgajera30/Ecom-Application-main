#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, '..');
const firstRunMarker = path.join(rootDir, '.first-run-done');

const loadEnv = (file) => {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
  }
};

loadEnv(path.join(rootDir, '.env'));
loadEnv(path.join(rootDir, 'apps/api/.env'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not configured. Copy .env.example and apps/api/.env.example before running setup.');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const nodeCmd = process.execPath;
const runScriptDispatcher = path.join(scriptsDir, 'run-script.mjs');

const normalizeBoolean = (value, defaultValue = true) => {
  if (value === undefined) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const autoResetEnabled = normalizeBoolean(process.env.AUTO_RESET_DB_ON_P1000, true);
const isFirstRun = !fs.existsSync(firstRunMarker);

const spawnOptions = (capture) => ({
  cwd: rootDir,
  env: process.env,
  shell: isWindows,
  encoding: capture ? 'utf-8' : undefined,
  stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
});

const formatCommand = (command, args) => {
  const printableArgs = args.filter(Boolean).join(' ');
  return `${command}${printableArgs ? ' ' + printableArgs : ''}`;
};

const runCommand = (command, args = [], { allowFailure = false, capture = false, description } = {}) => {
  const display = description ?? formatCommand(command, args);
  console.log(`--> Running: ${display}`);
  const result = spawnSync(command, args, spawnOptions(capture));
  const code = result.status ?? 0;

  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (code !== 0 && !allowFailure) {
    const error = new Error(`Command '${display}' exited with code ${code}.`);
    error.code = code;
    error.stdout = result.stdout || '';
    error.stderr = result.stderr || '';
    throw error;
  }

  return {
    code,
    stdout: (result.stdout || '').toString(),
    stderr: (result.stderr || '').toString(),
  };
};

const commandExists = (command) => {
  const which = isWindows ? 'where' : 'which';
  const check = spawnSync(which, [command], { stdio: 'ignore', shell: isWindows });
  return check.status === 0;
};

const dockerAvailable = commandExists('docker')
  && spawnSync('docker', ['compose', 'version'], { stdio: 'ignore', shell: isWindows }).status === 0;

const composeServiceRunning = () => {
  if (!dockerAvailable) return false;
  const result = spawnSync('docker', ['compose', 'ps', '--status', 'running', 'db'], {
    cwd: rootDir,
    stdio: 'ignore',
    shell: isWindows,
  });
  return result.status === 0;
};

const ensureDbReady = () => {
  runCommand(nodeCmd, [runScriptDispatcher, 'db-wait'], {
    description: `node ${path.relative(rootDir, runScriptDispatcher)} db-wait`,
  });
};

const runMigrations = () => runCommand('pnpm', ['--filter', '@apps/api', 'prisma:migrate'], {
  capture: true,
  allowFailure: true,
  description: 'pnpm --filter @apps/api prisma:migrate',
});

const tryAutoReset = (reason) => {
  if (!dockerAvailable) {
    console.warn('Automatic Docker reset skipped: docker is not available on PATH.');
    return false;
  }
  if (!isFirstRun) {
    console.warn('Automatic Docker reset skipped: setup has already completed once (.first-run-done exists).');
    return false;
  }
  if (!autoResetEnabled) {
    console.warn('Automatic Docker reset skipped: AUTO_RESET_DB_ON_P1000=0.');
    return false;
  }

  console.warn(`Prisma reported ${reason}. Resetting Docker Postgres volume and retrying...`);
  runCommand('docker', ['compose', 'down', '--volumes', '--remove-orphans'], {
    description: 'docker compose down --volumes --remove-orphans',
  });
  runCommand('docker', ['compose', 'up', '-d', 'db', 'mongo'], {
    description: 'docker compose up -d db mongo',
  });
  ensureDbReady();
  return true;
};

const failWithGuidance = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

try {
  let migrateResult = runMigrations();
  let combined = `${migrateResult.stdout}\n${migrateResult.stderr}`;
  if (migrateResult.code !== 0) {
    const sawP1000 = combined.includes('P1000');
    const sawP3018 = combined.includes('P3018');

    if ((sawP1000 || sawP3018) && tryAutoReset(sawP3018 ? 'P3018 (failed migration)' : 'P1000 (authentication failure)')) {
      migrateResult = runMigrations();
      combined = `${migrateResult.stdout}\n${migrateResult.stderr}`;
    }

    if (migrateResult.code !== 0) {
      if (sawP1000) {
        if (!dockerAvailable) {
          failWithGuidance('Prisma migrations failed with P1000. Ensure your DATABASE_URL credentials match the running Postgres instance.');
        }
        if (!composeServiceRunning()) {
          failWithGuidance('Prisma migrations failed with P1000. Start the docker compose services or your local Postgres instance before rerunning setup.');
        }
        failWithGuidance('Prisma migrations failed with P1000. If credentials look correct, run `docker compose down --volumes` to reset the database and rerun `pnpm run setup`.');
      }
      if (sawP3018) {
        failWithGuidance('Prisma migrations failed with P3018. Inspect the failing migration or reset the Docker volume (`docker compose down --volumes`) before retrying.');
      }

      failWithGuidance('Prisma migrations failed. Review the logs above for details.');
    }

    console.log('Migrations succeeded after resetting the Postgres volume.');
  }

  if (!fs.existsSync(firstRunMarker)) {
    runCommand('pnpm', ['--filter', '@apps/api', 'prisma:seed'], {
      description: 'pnpm --filter @apps/api prisma:seed',
    });
    fs.writeFileSync(firstRunMarker, '');
    console.log('Database seeded (created .first-run-done marker).');
  } else {
    console.log('Seed skipped; .first-run-done already exists.');
  }
} catch (error) {
  if (error && typeof error === 'object') {
    if (error.stdout) process.stdout.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    if (error.message) console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(error?.code ?? 1);
}
