// src/modules/debug — ?debug=1 diagnostics (Batch Z / A3), ported from mynewshub2.
// Everything here is a no-op when the flag is off: counters guard on DEBUG, the
// fetch tap only installs under DEBUG, and the overlay renders null before its
// chunk is ever requested — zero cost in normal use.
import { lazy, Suspense } from 'react';

export const DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';

export const dbg = { renders: {}, cls: 0, scrollJumps: 0, lastJump: 0, longFrames: 0, net: [] };

if (DEBUG && typeof window !== 'undefined') {
  window.__dbg = dbg;
  // Network tap: record method/path/status/duration for every fetch. Kept to a
  // 60s window when the report is built. Never records bodies or headers.
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const t0 = performance.now();
    const url = typeof input === 'string' ? input : input?.url || String(input);
    let path; try { const u = new URL(url, location.href); path = u.origin === location.origin ? u.pathname : `${u.host}${u.pathname}`; } catch { path = url; }
    const rec = { at: Date.now(), method: (init?.method || 'GET').toUpperCase(), path, status: null, ms: null };
    dbg.net.push(rec); if (dbg.net.length > 200) dbg.net.shift();
    try { const r = await orig(input, init); rec.status = r.status; return r; }
    catch (e) { rec.status = 'network-error'; throw e; }
    finally { rec.ms = Math.round(performance.now() - t0); }
  };
}

export function dbgRender(name) { if (!DEBUG) return; dbg.renders[name] = (dbg.renders[name] || 0) + 1; }

const Inner = lazy(() => import('./overlay.jsx'));
export function DebugOverlay() {
  if (!DEBUG) return null;
  return <Suspense fallback={null}><Inner /></Suspense>;
}
