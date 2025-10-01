#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();
const venvPython = process.platform === 'win32'
  ? join(repoRoot, '.venv', 'Scripts', 'python.exe')
  : join(repoRoot, '.venv', 'bin', 'python');

const pythonExecutable = existsSync(venvPython) ? venvPython : 'python';

const child = spawn(pythonExecutable, ['apps/recs/app.py'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
