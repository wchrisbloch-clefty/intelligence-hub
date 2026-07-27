#!/usr/bin/env node
// scripts/migrate-colors.mjs — sweep hardcoded hex → tokens.
//
//   node scripts/migrate-colors.mjs --dry     inspect, change nothing
//   node scripts/migrate-colors.mjs           write
//
// Covers ~90% mechanically. Prints the remainder as a punch list so the
// leftovers are visible instead of quietly surviving the migration.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.argv.find(a => a.startsWith('--root='))?.split('=')[1] || 'src';
const DRY  = process.argv.includes('--dry');

// Film Room palette → semantic token. Order matters: longest-lived first.
const MAP = {
  '#D9A441': 'T.accent',          // brass, 346 uses — the whole accent surface
  '#B8862E': 'T.accentHover',     // brass pressed
  '#9BA69B': 'T.textSecondary',   // sage — used as muted text/labels
  '#5E685E': 'T.textTertiary',
  '#C4553D': 'T.negative',        // rust — warnings and destructive
  '#a855f7': 'T.accent',          // stray purple from capture bar
  '#A855F7': 'T.accent',

  // Inks → surfaces (these only ever appear as backgrounds)
  '#111A16': 'T.canvas',
  '#1A130A': 'T.canvas',
  '#1E2A22': 'T.surface',
  '#1F2C25': 'T.surface',
  '#2A362F': 'T.rule',
  '#2E3A32': 'T.rule',

  // Creams → light surfaces
  '#F6F3EC': 'T.canvas',
  '#F2EFE6': 'T.surface',
  '#EDE9E0': 'T.surfaceSunken',
  '#E7E1D5': 'T.rule',
  '#DCD9CE': 'T.rule',
  '#D6CFC0': 'T.ruleStrong',
};

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(entry)) files.push(p);
  }
})(ROOT);

let totalReplaced = 0, filesTouched = 0;
const leftovers = new Map();

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let out = original, replacedHere = 0;

  for (const [hex, token] of Object.entries(MAP)) {
    // Quoted string form:  '#D9A441' | "#D9A441" | `#D9A441`
    const quoted = new RegExp(`(['"\`])${hex}\\1`, 'gi');
    out = out.replace(quoted, () => { replacedHere++; return token; });

    // Interpolated form:  `${'#D9A441'}22` → token + opacity helper
    const alpha = new RegExp(`(['"\`])${hex}([0-9a-f]{2})\\1`, 'gi');
    out = out.replace(alpha, (_m, _q, aa) => {
      replacedHere++;
      const pct = Math.round((parseInt(aa, 16) / 255) * 100);
      return `withAlpha(${token}, ${pct})`;
    });
  }

  if (replacedHere > 0) {
    filesTouched++;
    totalReplaced += replacedHere;

    // Ensure the import exists.
    if (!/from\s+['"].*theme['"]/.test(out)) {
      const depth = relative(file, ROOT).split('/').filter(s => s === '..').length || 1;
      const spec  = '../'.repeat(depth - 1) + 'theme';
      const needsAlpha = /withAlpha\(/.test(out);
      const names = needsAlpha ? 'T, withAlpha' : 'T';
      out = `import { ${names} } from '${spec.startsWith('.') ? spec : './' + spec}';\n` + out;
    }

    if (!DRY) writeFileSync(file, out, 'utf8');
    console.log(`  ${replacedHere.toString().padStart(4)}  ${file}`);
  }

  // Anything still hardcoded goes on the punch list.
  for (const m of out.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const key = m[0].toUpperCase();
    if (!leftovers.has(key)) leftovers.set(key, new Set());
    leftovers.get(key).add(file);
  }
}

console.log(`\n${DRY ? 'DRY RUN — nothing written' : 'WROTE'}`);
console.log(`${totalReplaced} replacements across ${filesTouched} files\n`);

if (leftovers.size) {
  console.log('PUNCH LIST — still hardcoded, decide each by hand:');
  [...leftovers.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([hex, set]) => {
      console.log(`  ${hex}  ${set.size} file(s)`);
      [...set].slice(0, 3).forEach(f => console.log(`      ${f}`));
      if (set.size > 3) console.log(`      …and ${set.size - 3} more`);
    });
} else {
  console.log('No hardcoded hex remaining.');
}
