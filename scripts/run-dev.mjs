#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import concurrently from 'concurrently';

const repoRoot = process.cwd();

function resolvePnpmInvocation(args) {
  const execPath = process.env.npm_execpath ?? '';
  if (execPath && execPath.endsWith('.cjs')) {
    return { command: process.execPath, args: [execPath, ...args] };
  }
  return { command: execPath || 'pnpm', args };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: repoRoot,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        const err = new Error(`Process exited with signal ${signal}`);
        err.signal = signal;
        reject(err);
      } else if (code === 0) {
        resolve();
      } else {
        const err = new Error(`Process exited with code ${code}`);
        err.code = code ?? 1;
        reject(err);
      }
    });
  });
}

const modulesMarker = join(repoRoot, 'node_modules', '.modules.yaml');
const lockfile = join(repoRoot, 'pnpm-lock.yaml');
const lockfileStamp = join(repoRoot, 'node_modules', '.pnpm-lock.hash');

function readLockfileHash() {
  if (!existsSync(lockfile)) {
    return null;
  }

  return createHash('sha256').update(readFileSync(lockfile)).digest('hex');
}

function readRecordedHash() {
  if (!existsSync(lockfileStamp)) {
    return null;
  }

  return readFileSync(lockfileStamp, 'utf-8').trim();
}

async function ensureNodeDependencies() {
  const currentHash = readLockfileHash();
  const recordedHash = readRecordedHash();

  const needsInstall = !existsSync(modulesMarker) || (currentHash && currentHash !== recordedHash);

  if (!needsInstall) {
    return;
  }

  if (!existsSync(modulesMarker)) {
    console.log('Installing workspace Node.js dependencies...');
  } else {
    console.log('Lockfile changed; reinstalling workspace Node.js dependencies...');
  }

  const { command, args } = resolvePnpmInvocation(['install']);
  await run(command, args);

  const refreshedHash = readLockfileHash();
  if (refreshedHash) {
    writeFileSync(lockfileStamp, `${refreshedHash}\n`);
  }
}

async function startServices() {
  const { result } = concurrently(
    [
      { name: 'api', command: 'pnpm dev:api' },
      { name: 'web', command: 'pnpm dev:web' },
      { name: 'recs', command: 'pnpm dev:recs' },
    ],
    {
      prefix: 'name',
      prefixColors: ['green', 'cyan', 'yellow'],
      killOthers: ['failure', 'success'],
    },
  );

  await result;
}

(async () => {
  try {
    await ensureNodeDependencies();
    await startServices();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'number') {
      process.exit(error.code);
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
