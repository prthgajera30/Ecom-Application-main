#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const usage = () => {
  console.log('Usage: node replace-tailwind-colors.js [--apply] [--mapping ./color-mapping.json] [--dry-run]');
  process.exit(1);
};

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dryRun = argv.includes('--dry-run') || !apply;
const mappingArgIndex = argv.indexOf('--mapping');
const mappingPath = mappingArgIndex >= 0 ? argv[mappingArgIndex + 1] : path.join(__dirname, 'color-mapping.json');

if (argv.includes('--help')) usage();

let mapping = {};
try {
  mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
} catch (e) {
  console.error('Failed to read mapping file at', mappingPath, '-', e.message);
  process.exit(1);
}

// conservative regex: matches classes like text-yellow-400, bg-emerald-200, border-indigo-300
const colorClassRegex = /\b(?:text|bg|border)-(?:[a-z]+)-\d{3}\b/g;

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const res = path.resolve(dir, e.name);
    if (/node_modules|\.git|\.next|dist|build|out/.test(res)) continue;
    // exclude this scripts folder itself to avoid matching mapping files or the script
    if (res.startsWith(path.join(root, 'scripts') + path.sep)) continue;
    if (e.isDirectory()) walk(res, cb);
    else cb(res);
  }
}

const matches = [];

walk(root, (file) => {
  if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.jsx') && !file.endsWith('.html')) return;
  const content = fs.readFileSync(file, 'utf8');
  const found = [...content.matchAll(colorClassRegex)].map(m => m[0]);
  if (found.length) {
    const replacements = found
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((cls) => ({ from: cls, to: mapping[cls] || null }));
    matches.push({ file, replacements });
  }
});

if (!matches.length) {
  console.log('No literal Tailwind color utility classes found in apps/web source files (per conservative regex).');
  process.exit(0);
}

console.log('Found occurrences in the following files:');
for (const m of matches) {
  console.log('\n' + m.file);
  for (const r of m.replacements) {
    if (r.to) {
      console.log('  ', r.from, '->', r.to);
    } else {
      console.log('  ', r.from, '->', 'NO MAPPING (manual review required)');
    }
  }
}

if (dryRun) {
  console.log('\nDry-run mode (no files modified). Use --apply to modify files.');
  process.exit(0);
}

// apply replacements (careful: simple string replace)
for (const m of matches) {
  let content = fs.readFileSync(m.file, 'utf8');
  let changed = false;
  for (const r of m.replacements) {
    if (!r.to) continue; // skip unmapped
    const re = new RegExp('\\b' + r.from.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'g');
    if (re.test(content)) {
      content = content.replace(re, r.to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(m.file, content, 'utf8');
    console.log('Updated', m.file);
  }
}

console.log('Replacement complete. Run your build/test to verify visuals and types.');
