#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dryRun = argv.includes('--dry-run') || !apply;
const mappingPathIndex = argv.indexOf('--mapping');
const mappingPath = mappingPathIndex >= 0 ? argv[mappingPathIndex + 1] : path.join(__dirname, 'color-mapping.json');

let mapping = {};
try { mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8')); } catch (e) { console.error('Failed to read mapping', e.message); process.exit(1); }

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const res = path.resolve(dir, e.name);
    if (/node_modules|\.git|\.next|dist|build|out/.test(res)) continue;
    if (res.startsWith(path.join(root, 'scripts') + path.sep)) continue;
    if (e.isDirectory()) walk(res, cb);
    else cb(res);
  }
}

function replaceInClassString(value) {
  const parts = value.split(/\s+/);
  let any = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (mapping[p]) { parts[i] = mapping[p]; any = true; }
  }
  return any ? parts.join(' ') : null;
}

const matches = [];

walk(root, (file) => {
  if (!file.match(/\.(ts|tsx|js|jsx)$/)) return;
  const src = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, src, ts.ScriptTarget.ESNext, true);
  let changed = false;
  const edits = [];

  function visit(node) {
    if (ts.isCallExpression(node)) {
      let fnName = null;
      if (ts.isIdentifier(node.expression)) fnName = node.expression.escapedText;
      else if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)) fnName = node.expression.name.escapedText;

      if (fnName === 'cn' || fnName === 'clsx') {
        for (const arg of node.arguments) {
          if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
            const orig = arg.text;
            const replaced = replaceInClassString(orig);
            if (replaced) {
              edits.push({ start: arg.getStart(sourceFile) + 1, end: arg.getEnd() - 1, text: replaced });
              changed = true;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (changed) {
    matches.push({ file, edits });
    if (apply) {
      edits.sort((a,b) => b.start - a.start);
      let out = src;
      for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
      fs.writeFileSync(file, out, 'utf8');
    }
  }
});

if (!matches.length) {
  console.log('No replaceable cn/clsx occurrences found.');
  process.exit(0);
}

console.log('Found cn/clsx replacements in:');
for (const m of matches) {
  console.log('\n' + m.file);
  for (const e of m.edits) console.log('  edit', e.start, e.end, '->', '...');
}

if (dryRun) console.log('\nDry-run mode (no files modified). Use --apply to persist changes.');
else console.log('\nApplied edits. Run build/tests to verify visuals and types.');
