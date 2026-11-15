#!/usr/bin/env node
// scripts/codemod-accent-text.mjs — Batch Z-2 / Order I. One-shot, idempotent.
//
// --accent is a FILL colour (navy #14284B light / #2B4C85 dark). Used as TEXT it
// fails contrast in dark mode at 2.19:1 — the single biggest source of the
// responsive gate's contrast debt. --accent-text exists for exactly this.
//
// Rewrites, in src/**/*.jsx, every place the accent is used as a TEXT colour:
//   style={{ color: <expr containing T.accent | ACCENT | VAULT_ACCENT | var(--accent…)> }}
//   color={T.accent} / color={ACCENT} / color="var(--accent)"   (props like MD/Label → text)
// Fills (background, border, borderColor, boxShadow, fill, stroke) are left alone.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TEXT = "'var(--accent-text)'";
const ACC = /\bT\.accent\b(?!Hover|Wash|Border|Text)|\b(?:VAULT_)?ACCENT\b|'var\(--(?:accent|gold)(?:,[^)']*)?\)'|"var\(--(?:accent|gold)(?:,[^)"]*)?\)"/g;

function walk(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, out) : p.endsWith('.jsx') && out.push(p); } return out; }

// Find the end of a JS property value starting at i: stop at a top-level , or }.
function valueEnd(s, i) {
  let depth = 0, q = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return i; depth--; }
    else if (c === ',' && depth === 0) return i;
  }
  return i;
}

let files = 0, edits = 0;
for (const f of walk(path.join(ROOT, 'src'))) {
  let s = fs.readFileSync(f, 'utf8'); const before = s;
  // 1) style object property  color: <value>
  let out = ''; let last = 0;
  for (const m of s.matchAll(/(?<![A-Za-z-])color\s*:\s*/g)) {
    const start = m.index + m[0].length; if (start < last) continue;
    const end = valueEnd(s, start);
    const val = s.slice(start, end);
    const nv = val.replace(ACC, () => { edits++; return TEXT; });
    out += s.slice(last, start) + nv; last = end;
  }
  s = out + s.slice(last);
  // 2) color prop on components:  color={T.accent}  color={ACCENT}  color="var(--accent)"
  s = s.replace(/\bcolor=\{\s*(?:T\.accent|(?:VAULT_)?ACCENT)\s*\}/g, () => { edits++; return 'color="var(--accent-text)"'; });
  s = s.replace(/\bcolor="var\(--(?:accent|gold)\)"/g, () => { edits++; return 'color="var(--accent-text)"'; });
  if (s !== before) { fs.writeFileSync(f, s); files++; }
}
console.log(`codemod-accent-text: ${edits} accent-as-text uses → --accent-text in ${files} files`);
