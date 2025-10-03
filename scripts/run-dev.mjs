#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

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
const rootPackageJson = join(repoRoot, 'package.json');

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

function readWorkspacePackageDirs() {
  if (!existsSync(rootPackageJson)) {
    return [];
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(rootPackageJson, 'utf-8'));
  } catch {
    return [];
  }

  const packagesConfig = manifest?.pnpm?.packages;
  const patterns = Array.isArray(packagesConfig)
    ? packagesConfig
    : packagesConfig && typeof packagesConfig === 'object'
      ? Object.keys(packagesConfig)
      : [];

  const packageDirs = new Set();

  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || !pattern.length) {
      continue;
    }

    const starIndex = pattern.indexOf('*');
    if (starIndex === -1) {
      const candidate = join(repoRoot, pattern);
      if (existsSync(join(candidate, 'package.json'))) {
        packageDirs.add(candidate);
      }
      continue;
    }

    const base = pattern.slice(0, starIndex).replace(/[\/]*$/, '');
    if (!base) {
      continue;
    }

    const baseDir = join(repoRoot, base);
    if (!existsSync(baseDir)) {
      continue;
    }

    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = join(baseDir, entry.name);
      if (existsSync(join(candidate, 'package.json'))) {
        packageDirs.add(candidate);
      }
    }
  }

  return [...packageDirs];
}

const workspacePackageDirs = readWorkspacePackageDirs();

async function ensureNodeDependencies() {
  const currentHash = readLockfileHash();
  const recordedHash = readRecordedHash();

  let installReason = null;

  if (!existsSync(modulesMarker)) {
    installReason = 'workspace Node.js dependencies not found';
  } else if (currentHash && currentHash !== recordedHash) {
    installReason = 'lockfile changed';
  } else {
    const missingPackages = workspacePackageDirs
      .filter((dir) => !existsSync(join(dir, 'node_modules')))
      .map((dir) => relative(repoRoot, dir));

    if (missingPackages.length > 0) {
      installReason = `missing node_modules in ${missingPackages.join(', ')}`;
    }
  }

  if (!installReason) {
    return;
  }

  console.log(`Running pnpm install (${installReason})...`);

  const { command, args } = resolvePnpmInvocation(['install', '--recursive']);
  await run(command, args);

  const refreshedHash = readLockfileHash();
  if (refreshedHash) {
    writeFileSync(lockfileStamp, `${refreshedHash}\n`);
  }
}

const apiDir = join(repoRoot, 'apps', 'api');
const prismaSchema = join(apiDir, 'prisma', 'schema.prisma');

function hasGeneratedPrismaClient() {
  const prismaPackage = join(apiDir, 'node_modules', '@prisma', 'client');
  if (!existsSync(prismaPackage)) {
    return false;
  }

  const pnpmStore = join(apiDir, 'node_modules', '.pnpm');
  if (!existsSync(pnpmStore)) {
    return false;
  }

  for (const entry of readdirSync(pnpmStore)) {
    if (!entry.startsWith('@prisma+client@')) {
      continue;
    }

    const clientIndex = join(
      pnpmStore,
      entry,
      'node_modules',
      '.prisma',
      'client',
      'index.js',
    );

    if (existsSync(clientIndex)) {
      return true;
    }
  }

  return false;
}

async function ensurePrismaClient() {
  if (!existsSync(prismaSchema)) {
    return;
  }

  if (!existsSync(join(apiDir, 'node_modules'))) {
    // node dependencies aren't ready yet; ensureNodeDependencies will handle this
    return;
  }

  if (hasGeneratedPrismaClient()) {
    return;
  }

  console.log('Generating Prisma Client for API...');

  const { command, args } = resolvePnpmInvocation([
    '--filter',
    './apps/api',
    'exec',
    'prisma',
    'generate',
  ]);
  await run(command, args);
}

async function startServices() {
  const concurrently = (await import('concurrently')).default;

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
    await ensurePrismaClient();
    await startServices();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'number') {
      process.exit(error.code);
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();