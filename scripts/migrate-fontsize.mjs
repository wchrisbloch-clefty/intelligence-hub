#!/usr/bin/env node
// scripts/migrate-fontsize.mjs — sweep inline `fontSize: <px>` → --fs-* tokens.
//
//   node scripts/migrate-fontsize.mjs --dry     inspect, change nothing
//   node scripts/migrate-fontsize.mjs           write
//
// Modeled on migrate-colors.mjs. Every module hardcodes font sizes inline
// (7–48px), most of them 8–12px — which is why the UI is unreadable without
// zooming. This maps each numeric fontSize to the nearest scale token so the
// whole app moves onto one readable type ramp.
//
// Rules
//   • Body/label copy floors at readable sizes: nothing non-eyebrow renders
//     below --fs-base for the body band. The crushed 8–13px sizes come up.
//   • EYEBROW labels — uppercase + letter-spaced micro-labels — are the one
//     exception the brief allows below 13px. They're left untouched and
//     logged, so they stay the deliberate 8–9px kickers they are.
//   • Anything the sweep can't resolve to a number (a variable, an already
//     stringified 'px'/rem/var value) is left alone and printed on a punch
//     list to decide by hand.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.argv.find(a => a.startsWith('--root='))?.split('=')[1] || 'src';
const DRY  = process.argv.includes('--dry');

// px → token. Nearest step on the ramp, with a readability floor: the body
// band (11–13) lands on --fs-base, and sub-11 non-eyebrow text comes up to
// --fs-sm rather than staying micro.
function tokenFor(px) {
  if (px <= 10) return 'sm';     // small non-eyebrow labels → readable
  if (px <= 13) return 'base';   // BODY → --fs-base
  if (px <= 17) return 'lg';
  if (px <= 23) return 'xl';
  if (px <= 32) return '2xl';
  return '3xl';
}

// Is this fontSize part of an eyebrow label? Eyebrows cluster uppercase +
// letterSpacing in the same style object. We scan a window around the match;
// a false positive just leaves a size literal (safe), so we bias toward
// catching the real kickers.
function isEyebrow(src, idx) {
  const win = src.slice(Math.max(0, idx - 80), idx + 240);
  return /textTransform:\s*['"`]uppercase/.test(win) && /letterSpacing/.test(win);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(entry)) files.push(p);
  }
})(ROOT);

let totalReplaced = 0, filesTouched = 0, keptEyebrow = 0;
const punch = new Map();   // reason → Set(file)
const note  = (reason, file) => { if (!punch.has(reason)) punch.set(reason, new Set()); punch.get(reason).add(file); };

// Match the property and its value up to the next comma / brace / newline.
// Ternaries (`isMobile ? 22 : 28`) have no commas, so they're captured whole.
const PROP = /fontSize:\s*([^,}\n]+)/g;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let replacedHere = 0;

  const out = original.replace(PROP, (full, rawValue, offset) => {
    // Already a string / unit / token — not ours to touch.
    if (/['"`]|px|rem|em\b|var\(/.test(rawValue)) { note('already string / unit value', file); return full; }
    // No number to map (a variable or expression like `size`, `iconSize`).
    if (!/\d/.test(rawValue)) { note('dynamic value (variable)', file); return full; }
    if (isEyebrow(original, offset)) { keptEyebrow++; return full; }

    // Replace every numeric literal in the value (handles ternaries + decimals).
    const mapped = rawValue.replace(/\d+(?:\.\d+)?/g, (numStr) => {
      const px = Math.round(parseFloat(numStr));
      replacedHere++;
      return `'var(--fs-${tokenFor(px)})'`;
    });
    return `fontSize: ${mapped.trim()}`;
  });

  if (replacedHere > 0) {
    filesTouched++;
    totalReplaced += replacedHere;
    if (!DRY) writeFileSync(file, out, 'utf8');
    console.log(`  ${replacedHere.toString().padStart(4)}  ${file}`);
  }
}

console.log(`\n${DRY ? 'DRY RUN — nothing written' : 'WROTE'}`);
console.log(`${totalReplaced} fontSize literals tokenized across ${filesTouched} files`);
console.log(`${keptEyebrow} eyebrow labels left untouched (deliberate sub-13px kickers)\n`);

if (punch.size) {
  console.log('PUNCH LIST — not tokenized, decide each by hand:');
  [...punch.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([reason, set]) => {
      console.log(`  ${reason}  —  ${set.size} file(s)`);
      [...set].slice(0, 5).forEach(f => console.log(`      ${f}`));
      if (set.size > 5) console.log(`      …and ${set.size - 5} more`);
    });
} else {
  console.log('No unmappable fontSize values remaining.');
}
