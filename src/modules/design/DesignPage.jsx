// /design — the live token + state reference (Batch Z / A4).
//
// It must not lie, so NOTHING here is a duplicated list of colour values:
//   • Colour token NAMES are discovered by walking the loaded stylesheets for
//     custom properties declared on :root / [data-theme] (i.e. tokens.css).
//   • Colour VALUES are read with getComputedStyle inside a light panel and a
//     dark panel, so a swatch shows what the browser actually resolved.
//   • Contrast ratios are computed live against each panel's --surface.
// Type / space scales are likewise discovered (--fs-*, --s*), not hand-listed.
// Components shown are the real ones (SectionState, TierChip, .btn/.chip/.badge).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TierChip from '../shared/TierChip.jsx';
import { SectionSkeleton, SectionError, SectionEmpty } from '../shared/SectionState.jsx';
import { getTheme, applyTheme } from '../../theme.js';
import './design.css';

function discoverTokens() {
  const names = new Set();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules; try { rules = sheet.cssRules; } catch { continue; } // cross-origin (fonts)
    const walk = (list) => {
      for (const r of Array.from(list || [])) {
        if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
        if (!r.selectorText || !/:root|\[data-theme/.test(r.selectorText)) continue;
        for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (p.startsWith('--')) names.add(p); }
      }
    };
    walk(rules);
  }
  return Array.from(names);
}

function parseRGB(s) { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(x => parseFloat(x)); return p.length >= 3 ? p : null; }
function lum([r, g, b]) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, b) { const A = parseRGB(a), B = parseRGB(b); if (!A || !B) return null; const l1 = lum(A), l2 = lum(B); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

// Resolve every colour-valued token inside `host` (so the panel's data-theme
// applies). A token is a colour if its declared value is a colour or a var()
// chain that the browser resolves to one.
function readColours(host, names) {
  const probe = document.createElement('span'); host.appendChild(probe);
  const read = (tok) => { probe.style.color = ''; probe.style.color = `var(${tok})`; return getComputedStyle(probe).color; };
  const surface = read('--surface');
  const out = [];
  for (const n of names) {
    const raw = getComputedStyle(host).getPropertyValue(n).trim();
    if (!/^(#|rgb|hsl|var\(--)/i.test(raw)) continue;
    // A var() chain to a non-colour (e.g. --rail-width) leaves color unset → skip.
    probe.style.color = ''; probe.style.color = `var(${n})`;
    if (!probe.style.color) continue;
    const v = getComputedStyle(probe).color;
    if (/^var\(--(fs|s\d|space|radius|lh|dur|gutter|tap|rail|container|sidebar|module)/.test(raw)) continue;
    out.push({ name: n, value: v, raw, cr: ratio(v, surface) });
  }
  probe.remove();
  return out;
}

function Panel({ theme, names }) {
  const ref = useRef(null);
  const [rows, setRows] = useState([]);
  useLayoutEffect(() => { if (ref.current) setRows(readColours(ref.current, names)); }, [names, theme]); // before paint
  return (
    <div ref={ref} data-theme={theme} className="dz-panel">
      <div className="dz-panel-head">{theme}</div>
      <div className="dz-swatches">
        {rows.map(r => (
          <div key={r.name} className="dz-swatch">
            <span className="dz-chip" style={{ '--sw': `var(${r.name})` }} />
            <span className="dz-swatch-meta">
              <code className="dz-tok">{r.name}</code>
              <span className="dz-val">{r.value}{r.raw.startsWith('var(') ? ` ← ${r.raw}` : ''}</span>
              {r.cr && <span className={`dz-cr ${r.cr >= 4.5 ? 'ok' : r.cr >= 3 ? 'mid' : 'low'}`}>{r.cr.toFixed(2)}:1 on surface</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlRow({ cls, label }) {
  const states = [['default', {}], ['hover', { 'data-force': 'hover' }], ['focus', { 'data-force': 'focus' }], ['disabled', { disabled: true }], ['loading', { 'aria-busy': 'true' }]];
  return (
    <div className="dz-controls">
      {states.map(([s, attrs]) => (
        <div key={s} className="dz-state">
          <button type="button" className={`${cls} tap`} {...attrs}>{s === 'loading' ? 'Loading…' : label}</button>
          <span className="dz-cap">{s}</span>
        </div>
      ))}
    </div>
  );
}

export default function DesignPage() {
  // Discovered synchronously (CSS is bundled and applied before first render), so
  // the swatches are in the first paint — no layout shift.
  const [names] = useState(() => discoverTokens());
  const [taps, setTaps] = useState(false);
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => { document.title = 'Design — Film Room'; }, []);
  useEffect(() => {
    const el = document.documentElement;
    if (!taps) { el.removeAttribute('data-show-taps'); document.querySelectorAll('[data-under-44]').forEach(n => n.removeAttribute('data-under-44')); return; }
    el.setAttribute('data-show-taps', '');
    document.querySelectorAll('button,a[href],[role=button],input,select,textarea').forEach(n => {
      const r = n.getBoundingClientRect(); const a = getComputedStyle(n, '::after');
      const h = a.content !== 'none' && a.position === 'absolute' ? Math.max(r.height, parseFloat(a.height) || 0) : r.height;
      if (r.height > 0 && h < 44) n.setAttribute('data-under-44', ''); else n.removeAttribute('data-under-44');
    });
  }, [taps]);

  const fs = names.filter(n => /^--fs-/.test(n));
  const space = names.filter(n => /^--s\d$/.test(n));

  return (
    <div className="dz-page">
      <header className="dz-head">
        <div>
          <div className="dz-eyebrow">Film Room · design reference</div>
          <h1 className="dz-title">Tokens and states</h1>
          <p className="dz-sub">Every value below is read live from the resolved CSS (src/styles/tokens.css). Nothing on this page is a copy.</p>
        </div>
        <div className="dz-actions">
          <button type="button" className="btn tap" aria-pressed={taps} onClick={() => setTaps(t => !t)}>{taps ? 'Hide tap targets' : 'Tap targets'}</button>
          <button type="button" className="btn tap" onClick={() => { const n = theme === 'dark' ? 'light' : 'dark'; applyTheme(n); setTheme(n); }}>Theme: {theme}</button>
          <a className="btn btn-primary tap" href="/">Back to app</a>
        </div>
      </header>

      <section className="dz-sec">
        <h2 className="dz-h2">Colour</h2>
        <div className="dz-panels">
          <Panel theme="light" names={names} />
          <Panel theme="dark" names={names} />
        </div>
      </section>

      <section className="dz-sec">
        <h2 className="dz-h2">Type scale</h2>
        {fs.map(t => (
          <div key={t} className="dz-type" style={{ '--fs': `var(${t})` }}>
            <code className="dz-tok">{t}</code>
            <span className="dz-type-sample">The quick read beats the long build-up.</span>
          </div>
        ))}
      </section>

      <section className="dz-sec">
        <h2 className="dz-h2">Space</h2>
        {space.map(t => (
          <div key={t} className="dz-space"><code className="dz-tok">{t}</code><span className="dz-bar" style={{ '--w': `var(${t})` }} /></div>
        ))}
      </section>

      <section className="dz-sec">
        <h2 className="dz-h2">Tier chips</h2>
        <div className="dz-row"><TierChip tier="verified" /><TierChip tier="reported" note="publisher" /><TierChip tier="inferred" /></div>
      </section>

      <section className="dz-sec">
        <h2 className="dz-h2">Controls</h2>
        <ControlRow cls="btn btn-primary" label="Primary" />
        <ControlRow cls="btn" label="Secondary" />
        <ControlRow cls="btn btn-ghost" label="Ghost" />
        <ControlRow cls="chip" label="Chip" />
        <div className="dz-row"><span className="badge">Badge</span><span className="badge">3 new</span><button type="button" className="chip tap" aria-pressed="true">Selected chip</button></div>
      </section>

      <section className="dz-sec">
        <h2 className="dz-h2">Section states</h2>
        <div className="dz-states">
          <div><div className="dz-cap">loading</div><SectionSkeleton rows={2} label="study guide" /></div>
          <div><div className="dz-cap">error</div><SectionError label="study guide" onRetry={() => {}} /></div>
          <div><div className="dz-cap">empty</div><SectionEmpty what="No study guide yet" how="Pick a book, then tap Generate Study Guide." actionLabel="Open Books" onAction={() => {}} /></div>
        </div>
      </section>
    </div>
  );
}
