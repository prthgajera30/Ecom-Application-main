#!/usr/bin/env node
import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const venvDir = join(repoRoot, '.venv');
const venvPython = process.platform === 'win32'
  ? join(venvDir, 'Scripts', 'python.exe')
  : join(venvDir, 'bin', 'python');
const requirementsFile = join(repoRoot, 'apps', 'recs', 'requirements.txt');
const requirementsStamp = join(venvDir, '.recs-requirements.sha');

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function findPythonInterpreter() {
  const candidates = process.platform === 'win32'
    ? ['python', 'py']
    : ['python3', 'python'];

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['--version'], {
      stdio: 'ignore',
    });

    if (check.status === 0) {
      return candidate;
    }
  }

  return null;
}

if (!existsSync(venvPython)) {
  const interpreter = findPythonInterpreter();

  if (!interpreter) {
    console.error(
      'Unable to find a Python interpreter. Please install Python 3.11 and re-run `pnpm dev`.',
    );
    process.exit(1);
  }

  console.log('Creating Python virtual environment for recommendations service...');
  runSync(interpreter, ['-m', 'venv', venvDir]);
}

if (existsSync(requirementsFile)) {
  const requirementsHash = crypto
    .createHash('sha256')
    .update(readFileSync(requirementsFile))
    .digest('hex');

  let existingHash = null;
  if (existsSync(requirementsStamp)) {
    existingHash = readFileSync(requirementsStamp, 'utf-8').trim();
  }

  if (requirementsHash !== existingHash) {
    console.log('Installing Python dependencies for recommendations service...');
    runSync(venvPython, ['-m', 'pip', 'install', '-r', requirementsFile]);
    writeFileSync(requirementsStamp, requirementsHash);
  }
}

const pythonExecutable = existsSync(venvPython) ? venvPython : 'python';

const child = spawn(pythonExecutable, ['apps/recs/app.py'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
