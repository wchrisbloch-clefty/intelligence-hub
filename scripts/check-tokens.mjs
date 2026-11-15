#!/usr/bin/env node
// scripts/check-tokens.mjs — the tokens-only guardrail (Batch Z / Order C).
// Wired into `npm run build`. Instruction doesn't hold a line across 26 files; a
// failing build does.
//
// FAILS on:
//   1. any src/**/*.css (except src/styles/tokens.css, the one place colour
//      VALUES live) containing a hex colour, rgb( / rgba(, or hsl( / hsla(
//   2. any src/**/*.jsx containing an inline style={{ … }} that carries a colour,
//      background, border, outline, box-shadow or fill/stroke value
//   3. any src/**/*.jsx containing a literal hex colour
//
// RATCHET: the 26 inline-styled modules can't all move in one PR (Order C goes one
// container at a time), so scripts/check-tokens.baseline.json records today's
// per-file violation counts. A file may only go DOWN. A count above baseline, or
// any violation in a file not in the baseline, fails the build. Extracted files
// drop out of the baseline (count 0) and are held at zero from then on.
//
//   node scripts/check-tokens.mjs            # check (CI / build)
//   node scripts/check-tokens.mjs --update   # rewrite baseline — ONLY to lower it
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASELINE = path.join(ROOT, 'scripts/check-tokens.baseline.json');
const EXEMPT_CSS = new Set(['src/styles/tokens.css']);

const COLOR_IN_CSS = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;
const HEX_IN_JSX = /['"`]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?['"`]|#[0-9a-fA-F]{6}\b/g;
const STYLE_KEYS = /\b(color|background|backgroundColor|backgroundImage|border(?:Top|Right|Bottom|Left)?(?:Color)?|outline(?:Color)?|boxShadow|fill|stroke)\s*:/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// Extract each `style={{ … }}` body with brace balancing (handles nested objects
// and template literals well enough for this codebase).
function inlineStyles(src) {
  const out = []; let i = 0;
  while ((i = src.indexOf('style={{', i)) !== -1) {
    let depth = 0, j = i + 'style={'.length;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) break; }
    }
    out.push({ at: src.slice(0, i).split('\n').length, body: src.slice(i, j + 1) });
    i = j + 1;
  }
  return out;
}

const counts = {}; const samples = {};
const add = (f, line, why) => { counts[f] = (counts[f] || 0) + 1; (samples[f] ||= []).length < 3 && samples[f].push(`  ${f}:${line}  ${why}`); };

for (const abs of walk(path.join(ROOT, 'src'))) {
  const f = path.relative(ROOT, abs).split(path.sep).join('/');
  const src = fs.readFileSync(abs, 'utf8');
  if (f.endsWith('.css') && !EXEMPT_CSS.has(f)) {
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (const m of noComments.matchAll(COLOR_IN_CSS)) add(f, noComments.slice(0, m.index).split('\n').length, `literal colour ${m[0]}`);
  }
  if (f.endsWith('.jsx')) {
    for (const s of inlineStyles(src)) if (STYLE_KEYS.test(s.body)) add(f, s.at, `inline colour/background/border style`);
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');
    for (const m of noComments.matchAll(HEX_IN_JSX)) add(f, noComments.slice(0, m.index).split('\n').length, `hex literal ${m[0]}`);
  }
}

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
if (process.argv.includes('--update')) {
  const next = {};
  for (const [f, n] of Object.entries(counts)) {
    if (base[f] !== undefined && n > base[f]) { console.error(`refusing to RAISE baseline for ${f} (${base[f]} → ${n})`); process.exit(1); }
    if (base[f] === undefined && Object.keys(base).length) { console.error(`refusing to ADD ${f} to the baseline — fix it instead`); process.exit(1); }
    next[f] = n;
  }
  fs.writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(Object.entries(next).sort()), null, 2) + '\n');
  console.log(`check-tokens: baseline written (${Object.values(next).reduce((a, b) => a + b, 0)} violations across ${Object.keys(next).length} files)`);
  process.exit(0);
}

const failures = [];
for (const [f, n] of Object.entries(counts)) {
  const allowed = base[f] || 0;
  if (n > allowed) failures.push(`${f}: ${n} violation(s), baseline ${allowed}\n${samples[f].join('\n')}`);
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
const lowered = Object.entries(base).filter(([f, n]) => (counts[f] || 0) < n).map(([f, n]) => `${f} ${n}→${counts[f] || 0}`);
if (failures.length) {
  console.error('check-tokens FAILED — tokens only. Move colour/background/border into the module\'s .css using var(--token).\n');
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(`check-tokens: ok — ${total} legacy violations remaining (baseline ${baseTotal})${lowered.length ? `; lowered: ${lowered.join(', ')} — run with --update to lock in` : ''}`);
