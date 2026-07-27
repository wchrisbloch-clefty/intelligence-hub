// src/theme.js — the bridge between theme.css and 21 inline-styled modules.
//
// Modules keep using inline style objects. They just stop hardcoding hex:
//   before:  style={{ color: T.accent }}
//   after:   style={{ color: T.accent }}
//
// Because these resolve to var(--x), a theme flip re-paints everything with
// zero re-render. No context, no prop drilling, no provider.

export const T = {
  canvas:        'var(--canvas)',
  surface:       'var(--surface)',
  surfaceRaised: 'var(--surface-raised)',
  surfaceSunken: 'var(--surface-sunken)',
  rule:          'var(--rule)',
  ruleStrong:    'var(--rule-strong)',

  textPrimary:   'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary:  'var(--text-tertiary)',
  textInverse:   'var(--text-inverse)',

  accent:        'var(--accent)',
  accentHover:   'var(--accent-hover)',
  accentWash:    'var(--accent-wash)',
  accentBorder:  'var(--accent-border)',
  onAccent:      'var(--on-accent)',

  tierVerified:  'var(--tier-verified)',
  tierReported:  'var(--tier-reported)',
  tierInferred:  'var(--tier-inferred)',
  tierUncited:   'var(--tier-uncited)',

  positive:      'var(--positive)',
  caution:       'var(--caution)',
  negative:      'var(--negative)',

  shadowSm:      'var(--shadow-sm)',
  shadowMd:      'var(--shadow-md)',
  shadowLg:      'var(--shadow-lg)',

  fontDisplay:   'var(--font-display)',
  fontSans:      'var(--font-sans)',
  fontMono:      'var(--font-mono)',

  radiusSm:      'var(--radius-sm)',
  radius:        'var(--radius)',
  radiusLg:      'var(--radius-lg)',
};

// Depth tiers from the certified depth engine → provenance colors.
// A model-knowledge answer and an 8-source cited one should not look alike.
export const DEPTH_TIER = {
  surface:  { color: T.tierInferred, label: 'Model knowledge' },
  standard: { color: T.tierInferred, label: 'Concept + example' },
  deep:     { color: T.tierReported, label: 'Web sourced' },
  expert:   { color: T.tierVerified, label: 'Certified · cited' },
};

// ─── THEME CONTROL ─────────────────────────────────────────────────────────
const KEY = 'fr-theme';

export function getTheme() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D1117' : '#F7F8FA');
  try { localStorage.setItem(KEY, theme); } catch {}
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

// Paste into index.html <head>, BEFORE any stylesheet or bundle.
// Without this the page paints light, then snaps to dark on hydrate.
export const NO_FLASH_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('fr-theme');
  var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();
`;

// ─── BREAKPOINTS ───────────────────────────────────────────────────────────
// Single source of truth. Same numbers as theme.css — if you change one,
// change both, or layout and logic will disagree about what "tablet" means.
export const BP = { tablet: 768, desktop: 1024 };

import { useState, useEffect } from 'react';

export function useViewport() {
  const read = () => {
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
    return { isMobile: w < BP.tablet, isTablet: w >= BP.tablet && w < BP.desktop, isDesktop: w >= BP.desktop };
  };
  const [vp, setVp] = useState(read);
  useEffect(() => {
    let raf;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setVp(read())); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);
  return vp;
}

export function useTheme() {
  const [theme, setTheme] = useState(() =>
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light'
  );
  useEffect(() => { applyTheme(theme); }, [theme]);
  return { theme, setTheme, toggle: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')) };
}

// ─── ALPHA ─────────────────────────────────────────────────────────────────
// The old code wrote T.accent + '22' for translucent fills. That trick dies
// with hex. color-mix does the same job against a CSS variable.
//   withAlpha(T.accent, 12)  →  color-mix(in srgb, var(--accent) 12%, transparent)
export function withAlpha(token, pct) {
  return `color-mix(in srgb, ${token} ${pct}%, transparent)`;
}
