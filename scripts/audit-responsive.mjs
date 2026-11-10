#!/usr/bin/env node
// scripts/audit-responsive.mjs — the responsive geometry gate (Batch Z / Order F).
//
//   npm run build && npm run audit:responsive
//
// Ported in approach from social-command-center: a REAL Chromium, REAL geometry,
// every view × 390 / 820 / 1280 × light / dark (docs/RESPONSIVE.md). Reading CSS
// does not catch these — the iPad top bar that clipped 3 controls off-screen was
// invisible in the stylesheet and obvious the moment getBoundingClientRect ran.
//
// FAILS on:
//   overflow   document-level horizontal overflow, or the .fr-main scroller
//              wider than its box
//   tap        an interactive element whose HIT AREA (incl. the .tap ::after) is
//              under 44px — on coarse-pointer widths (390, 820) only
//   cls        Cumulative Layout Shift > 0.05 on first load
//   contrast   text below 4.5:1 against its effective background (3:1 for large
//              text: ≥24px, or ≥18.66px bold — WCAG 1.4.3), in either theme
//   zero       an element that should be visible rendering at 0×0 (a nav item,
//              a Home section, or a button/link with text that isn't hidden)
//   console    any console error / page error
//
// RATCHET: five of the six containers are not CSS-extracted yet (Order C goes one
// container at a time), so scripts/audit-responsive.baseline.json records today's
// per-view counts. A count may only go DOWN; a view not in the baseline must be
// clean. `--update` refuses to raise a count. Home and /design are held at zero.
//
// Serves dist/ with scripts/serve-local.mjs (stubbed /api) unless AUDIT_BASE_URL is set.
//   AUDIT_ONLY=home,design   narrow the views     AUDIT_VERBOSE=1   print samples
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASELINE = path.join(ROOT, 'scripts/audit-responsive.baseline.json');
const BREAKPOINTS = [
  { name: '390',  width: 390,  height: 844,  coarse: true,  mobile: true },
  { name: '820',  width: 820,  height: 1180, coarse: true,  mobile: false },
  { name: '1280', width: 1280, height: 900,  coarse: false, mobile: false },
];
// One view per container (its default mode) + /design. A new container or a
// surface worth guarding gets a row here, or nothing is checking it.
const VIEWS = [
  { id: 'home',     path: '/' },
  { id: 'design',   path: '/design' },
  { id: 'feed',     path: '/?mode=feed' },
  { id: 'learn',    path: '/?mode=learn' },
  { id: 'books',    path: '/?mode=books' },
  { id: 'research', path: '/?mode=research' },
  { id: 'skills',   path: '/?mode=skills' },
  { id: 'projects', path: '/?mode=projects' },
  { id: 'studio',   path: '/?mode=studio' },
];
const ONLY = (process.env.AUDIT_ONLY || '').split(',').filter(Boolean);
const CHECKS = ['overflow', 'tap', 'cls', 'contrast', 'zero', 'console'];

async function serve() {
  if (process.env.AUDIT_BASE_URL) return { base: process.env.AUDIT_BASE_URL, stop: () => {} };
  if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) { console.error('dist/ missing — run npm run build first'); process.exit(2); }
  const port = 4190 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts/serve-local.mjs'), String(port)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  return { base: `http://localhost:${port}`, stop: () => child.kill() };
}

// Runs in the page. Returns { overflow, tap, contrast, zero } as sample arrays.
function measure({ coarse }) {
  const out = { overflow: [], tap: [], contrast: [], zero: [] };
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) out.overflow.push(`document ${document.documentElement.scrollWidth}px > ${vw}px`);
  const main = document.querySelector('.fr-main');
  if (main && main.scrollWidth > main.clientWidth + 1) out.overflow.push(`.fr-main scrollWidth ${main.scrollWidth} > ${main.clientWidth}`);
  // Clipped-off-screen interactive elements (the iPad top-bar class of bug).
  for (const el of document.querySelectorAll('button, a[href], [role=button]')) {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (r.width && r.height && s.visibility !== 'hidden' && r.right > vw + 1 && !el.closest('[data-scroll-x], .fr-chips, [style*="overflow-x"]')) {
      const sc = el.parentElement && getComputedStyle(el.parentElement).overflowX;
      if (sc !== 'auto' && sc !== 'scroll') out.overflow.push(`off-screen ${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" right=${Math.round(r.right)}`);
    }
  }
  const label = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 28)}"`;
  const visible = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && !el.closest('[aria-hidden="true"], .dbg-overlay'); };

  // Tap targets — hit area includes the .tap ::after extension.
  if (coarse) {
    for (const el of document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea, [onclick]')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
      const a = getComputedStyle(el, '::after');
      const ext = a.content !== 'none' && a.position === 'absolute';
      const h = ext ? Math.max(r.height, parseFloat(a.height) || 0) : r.height;
      const w = ext ? Math.max(r.width, parseFloat(a.width) || 0) : r.width;
      if (h < 44 || w < 44) out.tap.push(`${label(el)} ${Math.round(w)}×${Math.round(h)}`);
    }
  }

  // Contrast — text nodes' parents vs the first opaque ancestor background.
  const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a >= 0.95) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement; if (!el || seen.has(el) || !t.textContent.trim()) continue; seen.add(el);
    if (!visible(el) || el.closest('svg, .dbg-overlay, [data-theme] .dz-swatch, .shimmer')) continue;
    const s = getComputedStyle(el); if (parseFloat(s.opacity) < 1) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (el.closest('button[disabled], [aria-disabled="true"], [disabled]')) continue; // WCAG exempts disabled controls
    const fg = rgb(s.color); const bg = bgOf(el); if (!fg || !bg) continue;
    const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
    const px = parseFloat(s.fontSize); const bold = parseInt(s.fontWeight, 10) >= 700;
    const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
    if (ratio < need - 0.01) out.contrast.push(`${label(el)} ${ratio.toFixed(2)}:1 (<${need}) ${s.color} on rgb(${bg.r},${bg.g},${bg.b})`);
  }

  // 0×0 where something should render.
  for (const el of document.querySelectorAll('[data-section], nav button, nav a, button, a[href]')) {
    if (!visible(el)) continue;
    if (el.closest('.fr-sidebar') && getComputedStyle(document.querySelector('.fr-sidebar')).display === 'none') continue;
    if (el.closest('.fr-tabbar') && getComputedStyle(document.querySelector('.fr-tabbar')).display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0 && (el.hasAttribute('data-section') || (el.textContent || '').trim() || el.getAttribute('aria-label'))) out.zero.push(`${label(el)} 0×0`);
  }
  return out;
}

const { base, stop } = await serve();
const browser = await chromium.launch();
const counts = {}; const samples = {};
try {
  for (const view of VIEWS.filter((v) => !ONLY.length || ONLY.includes(v.id))) {
    for (const bp of BREAKPOINTS) {
      for (const theme of ['light', 'dark']) {
        const key = `${view.id}@${bp.name}/${theme}`;
        const ctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height }, hasTouch: bp.coarse, isMobile: bp.mobile, deviceScaleFactor: 1 });
        await ctx.addInitScript((t) => {
          try { localStorage.setItem('fr-theme', t); } catch {}
          window.__cls = 0;
          try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
        }, theme);
        const page = await ctx.newPage();
        const errs = [];
        // Third-party resource failures (Google Books 429, sandbox egress refusals) are
        // the network, not the app — excluded. App console errors and page errors count.
        page.on('console', (m) => {
          if (m.type() !== 'error') return;
          const loc = m.location()?.url || '';
          if (/Failed to load resource/.test(m.text()) && loc && !loc.startsWith(base)) return;
          errs.push(m.text().slice(0, 140));
        });
        page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
        await page.goto(base + view.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        const m = await page.evaluate(measure, { coarse: bp.coarse });
        const cls = await page.evaluate(() => window.__cls || 0);
        m.cls = cls > 0.05 ? [`CLS ${cls.toFixed(4)} > 0.05`] : [];
        m.console = errs;
        for (const c of CHECKS) {
          const k = `${key}:${c}`; counts[k] = m[c].length;
          if (m[c].length) samples[k] = m[c].slice(0, 4);
        }
        await ctx.close();
      }
    }
  }
} finally { await browser.close(); stop(); }

const base0 = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
if (process.argv.includes('--update')) {
  // Views not run this time (AUDIT_ONLY) keep their existing baseline cells.
  const ran = new Set(Object.keys(counts).map((k) => k.split('@')[0]));
  const next = Object.fromEntries(Object.entries(base0).filter(([k]) => !ran.has(k.split('@')[0])));
  for (const [k, n] of Object.entries(counts)) {
    if (!n) continue;
    if (base0[k] !== undefined && n > base0[k]) { console.error(`refusing to RAISE ${k} (${base0[k]} → ${n})`); process.exit(1); }
    if (Object.keys(base0).length && base0[k] === undefined) { console.error(`refusing to ADD ${k} — fix it instead`); process.exit(1); }
    next[k] = n;
  }
  fs.writeFileSync(BASELINE, JSON.stringify(Object.fromEntries(Object.entries(next).sort()), null, 2) + '\n');
  console.log(`audit-responsive: baseline written (${Object.keys(next).length} non-zero cells)`);
  process.exit(0);
}

const fails = Object.entries(counts).filter(([k, n]) => n > (base0[k] || 0));
const byView = {};
for (const [k, n] of Object.entries(counts)) { const v = k.split('@')[0]; const c = k.split(':').pop(); byView[v] ||= {}; byView[v][c] = (byView[v][c] || 0) + n; }
console.log('view       ' + CHECKS.map((c) => c.padStart(9)).join(''));
for (const [v, cs] of Object.entries(byView)) console.log(v.padEnd(11) + CHECKS.map((c) => String(cs[c] || 0).padStart(9)).join(''));
if (process.env.AUDIT_VERBOSE) for (const [k, s] of Object.entries(samples)) console.log(`\n${k}\n  ${s.join('\n  ')}`);
if (fails.length) {
  console.error(`\naudit-responsive FAILED — ${fails.length} cell(s) above baseline:`);
  for (const [k, n] of fails) console.error(`  ${k}: ${n} (baseline ${base0[k] || 0})\n    ${(samples[k] || []).join('\n    ')}`);
  process.exit(1);
}
const ranViews = new Set(Object.keys(counts).map((k) => k.split('@')[0]));
const lowered = Object.entries(base0).filter(([k, n]) => ranViews.has(k.split('@')[0]) && (counts[k] ?? 0) < n);
console.log(`\naudit-responsive: ok${lowered.length ? ` — ${lowered.length} cell(s) improved; run --update to lock in` : ''}`);
