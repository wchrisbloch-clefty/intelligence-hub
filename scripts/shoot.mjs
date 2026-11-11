#!/usr/bin/env node
// scripts/shoot.mjs — screenshot one app route at the three contract widths × two
// themes (docs/RESPONSIVE.md). Full-length: the app scrolls inside .fr-main, so the
// shell is unpinned for the capture.
//   node scripts/shoot.mjs <url-path> <name-prefix> [outDir]
//   e.g. node scripts/shoot.mjs / batch-Z-C-home-before
// Expects scripts/serve-local.mjs running on :4180 (or BASE_URL).
import { chromium } from 'playwright';

const [, , route = '/', prefix = 'shot', outDir = 'docs/screens'] = process.argv;
const BASE = process.env.BASE_URL || 'http://localhost:4180';
export const WIDTHS = [['390', 390, 844], ['820', 820, 1180], ['1280', 1280, 800]];

const b = await chromium.launch();
const errors = [];
for (const [name, w, h] of WIDTHS) {
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1101, isMobile: w < 721 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('fr-theme', t); } catch {} }, theme);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}/${theme}: ${m.text()}`); });
    p.on('pageerror', (e) => errors.push(`${name}/${theme}: ${e.message}`));
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    await p.addStyleTag({ content: 'html,body,#root,.fr-shell{height:auto!important;overflow:visible!important} .fr-main{overflow:visible!important}' });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${outDir}/${prefix}-${name}-${theme}.png`, fullPage: true });
    await ctx.close();
  }
}
await b.close();
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'console errors: none');
