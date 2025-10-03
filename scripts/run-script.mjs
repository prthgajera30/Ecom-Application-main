#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptName = process.argv[2];

if (!scriptName) {
  console.error('Usage: node scripts/run-script.mjs <script-name-without-extension>');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const extension = isWindows ? '.ps1' : '.sh';
const scriptPath = resolve(__dirname, `${scriptName}${extension}`);

if (!existsSync(scriptPath)) {
  console.error(`Cannot find script ${scriptPath}`);
  process.exit(1);
}

const command = isWindows ? 'powershell.exe' : 'bash';
const args = isWindows
  ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
  : [scriptPath];

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
