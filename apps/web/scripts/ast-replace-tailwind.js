#!/usr/bin/env node
// AST-aware conservative replacer for Tailwind color utility classes inside apps/web
// - Only replaces string literal values (JSXText, StringLiteral, No-expression TemplateLiteral)
// - Skips template literals with expressions and complex computed forms

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

const matches = [];

walk(root, (file) => {
  if (!file.match(/\.(ts|tsx|js|jsx)$/)) return;
  const src = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, src, ts.ScriptTarget.ESNext, true);
  let changed = false;
  const edits = [];

  function replaceInClassString(value) {
    // naive split by whitespace and replace exact tokens
    const parts = value.split(/\s+/);
    let any = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (mapping[p]) { parts[i] = mapping[p]; any = true; }
    }
    return any ? parts.join(' ') : null;
  }

  function visit(node) {
    // JSX attribute with string literal: className="..."
    if (ts.isJsxAttribute(node) && node.name && node.name.escapedText === 'className' && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) {
        const orig = node.initializer.text;
        const replaced = replaceInClassString(orig);
        if (replaced) {
          edits.push({ start: node.initializer.getStart(sourceFile) + 1, end: node.initializer.getEnd() - 1, text: replaced });
          changed = true;
        }
      } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isNoSubstitutionTemplateLiteral(node.initializer.expression)) {
        const orig = node.initializer.expression.text;
        const replaced = replaceInClassString(orig);
        if (replaced) {
          edits.push({ start: node.initializer.expression.getStart(sourceFile) + 1, end: node.initializer.expression.getEnd() - 1, text: replaced });
          changed = true;
        }
      }
    }

    // For plain string literals used in code like const cls = "text-yellow-400 foo"
    if (ts.isStringLiteral(node)) {
      const orig = node.text;
      const replaced = replaceInClassString(orig);
      if (replaced) {
        edits.push({ start: node.getStart(sourceFile) + 1, end: node.getEnd() - 1, text: replaced });
        changed = true;
      }
    }

    // Template literal without expressions `...` (NoSubstitutionTemplateLiteral)
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const orig = node.text;
      const replaced = replaceInClassString(orig);
      if (replaced) {
        edits.push({ start: node.getStart(sourceFile) + 1, end: node.getEnd() - 1, text: replaced });
        changed = true;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (changed) {
    matches.push({ file, edits });
    if (apply) {
      // apply edits in reverse order
      edits.sort((a,b) => b.start - a.start);
      let out = src;
      for (const e of edits) {
        out = out.slice(0, e.start) + e.text + out.slice(e.end);
      }
      fs.writeFileSync(file, out, 'utf8');
    }
  }
});

if (!matches.length) {
  console.log('No replaceable occurrences found by AST codemod.');
  process.exit(0);
}

console.log('AST codemod found replacements in:');
for (const m of matches) {
  console.log('\n' + m.file);
  for (const e of m.edits) console.log('  edit', e.start, e.end, '->', '...');
}

if (dryRun) console.log('\nDry-run mode (no files modified). Use --apply to persist changes.');
else console.log('\nApplied edits. Run build/tests to verify visuals and types.');