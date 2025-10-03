#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const [, , scriptBase] = process.argv;

if (!scriptBase) {
  console.error('Usage: node scripts/run-script.mjs <script-name>');
  process.exit(1);
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const shPath = path.join(scriptsDir, `${scriptBase}.sh`);
const psPath = path.join(scriptsDir, `${scriptBase}.ps1`);

const exists = (filePath) => {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const run = (command, args) => spawnSync(command, args, { stdio: 'inherit', env: process.env });

const handleResult = (result) => {
  if (result.error) {
    throw result.error;
  }
  const code = result.status ?? 0;
  if (code !== 0) {
    process.exit(code);
  }
  process.exit(0);
};

if (process.platform === 'win32') {
  if (exists(psPath)) {
    handleResult(run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath]));
  }
  if (exists(shPath)) {
    handleResult(run('bash', [shPath]));
  }
  console.error(`No script found for "${scriptBase}". Expected ${psPath} or ${shPath}.`);
  process.exit(1);
} else {
  if (exists(shPath)) {
    const shell = exists('/bin/bash') ? 'bash' : 'sh';
    handleResult(run(shell, [shPath]));
  }
  if (exists(psPath)) {
    const pwsh = process.env.PWSH_PATH || 'pwsh';
    handleResult(run(pwsh, ['-NoProfile', '-File', psPath]));
  }
  console.error(`No script found for "${scriptBase}". Expected ${shPath} or ${psPath}.`);
  process.exit(1);
}
