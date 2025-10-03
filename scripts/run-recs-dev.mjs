#!/usr/bin/env node
import { createHash } from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const recsDir = join(here, '..', 'apps', 'recs');
const venvDir = join(recsDir, '.venv');
const stampPath = join(venvDir, '.requirements-stamp');
const requirementsPath = join(recsDir, 'requirements.txt');

function findPython() {
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const command of candidates) {
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) {
      return command;
    }
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error('Python 3.10+ is required to run the recommendations service. Install Python and ensure it is on your PATH.');
  process.exit(1);
}

if (!existsSync(venvDir)) {
  console.log('Creating virtual environment for recommendations service...');
  const create = spawnSync(python, ['-m', 'venv', venvDir], { stdio: 'inherit' });
  if (create.status !== 0) {
    process.exit(create.status ?? 1);
  }
}

const venvPython = process.platform === 'win32'
  ? join(venvDir, 'Scripts', 'python.exe')
  : join(venvDir, 'bin', 'python');

if (!existsSync(requirementsPath)) {
  console.error('apps/recs/requirements.txt is missing.');
  process.exit(1);
}

const requirementsHash = createHash('sha1').update(readFileSync(requirementsPath)).digest('hex');
let previousHash = null;
if (existsSync(stampPath)) {
  previousHash = readFileSync(stampPath, 'utf8');
}

if (requirementsHash !== previousHash) {
  console.log('Installing/updating Python dependencies for recommendations service...');
  mkdirSync(venvDir, { recursive: true });
  const install = spawnSync(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel'], { stdio: 'inherit' });
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
  const deps = spawnSync(venvPython, ['-m', 'pip', 'install', '-r', requirementsPath], { stdio: 'inherit' });
  if (deps.status !== 0) {
    process.exit(deps.status ?? 1);
  }
  writeFileSync(stampPath, requirementsHash);
}

console.log('Starting recommendations service (Flask)...');
const child = spawn(venvPython, ['-m', 'flask', '--app', 'app', 'run', '--host=0.0.0.0', '--port=5000'], {
  cwd: recsDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    FLASK_APP: 'app.py',
    FLASK_ENV: 'development',
  },
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
