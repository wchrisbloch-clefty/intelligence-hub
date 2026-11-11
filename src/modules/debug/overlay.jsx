// The heavy, ?debug=1-only half: overlay UI + the Copy-report builder. Lazy-loaded.
import { useEffect, useRef, useState } from 'react';
import { dbg } from './index.jsx';
import './debug.css';

const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;

function countUnder44() {
  let under = 0; const samples = [];
  for (const el of document.querySelectorAll('button,a[href],[role=button],input,select,textarea,[onclick]')) {
    if (el.closest('.dbg-overlay')) continue;
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || s.display === 'none' || s.visibility === 'hidden') continue;
    // A .tap element has a 44px ::after hit area — measure that, not the box.
    const a = getComputedStyle(el, '::after');
    const hitH = a.content !== 'none' && a.position === 'absolute' ? Math.max(r.height, parseFloat(a.height) || 0) : r.height;
    const hitW = a.content !== 'none' && a.position === 'absolute' ? Math.max(r.width, parseFloat(a.width) || 0) : r.width;
    if (hitH < 44 || hitW < 44) {
      under++;
      if (samples.length < 8) samples.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
    }
  }
  return { under, samples };
}

export function buildDeviceReport(perSec = {}) {
  const r = { build: BUILD_ID, builtAt: BUILD_TIME, t: new Date().toISOString(), url: location.pathname + location.search };
  try {
    r.viewport = { w: window.innerWidth, h: window.innerHeight, dpr: +(window.devicePixelRatio || 1).toFixed(2) };
    r.pointer = matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine';
    r.theme = document.documentElement.getAttribute('data-theme');
    r.ua = navigator.userAgent;
    r.appRenders = dbg.renders.App || 0;
    r.appRendersPerSec = perSec.App || 0;
    r.renders = { ...dbg.renders };
    r.cls = +(dbg.cls || 0).toFixed(4);
    r.scrollJumps = dbg.scrollJumps;
    r.lastJumpPx = dbg.lastJump || 0;
    r.longFrames = dbg.longFrames;
    const top = document.querySelector('header, [data-topbar]');
    const main = document.querySelector('.fr-main');
    r.headerHeight = main ? Math.round(main.getBoundingClientRect().top) : (top ? Math.round(top.getBoundingClientRect().height) : null);
    r.docOverflowX = document.documentElement.scrollWidth > window.innerWidth;
    const t = countUnder44(); r.controlsUnder44 = t.under; r.controlsUnder44Samples = t.samples;
    const cutoff = Date.now() - 60000;
    r.network60s = dbg.net.filter(n => n.at >= cutoff).map(({ method, path, status, ms }) => ({ method, path, status, ms }));
  } catch (e) { r.error = String(e); }
  return r;
}
if (typeof window !== 'undefined') window.__buildDeviceReport = buildDeviceReport;

export default function DebugOverlay() {
  const [, force] = useState(0);
  const prev = useRef({}); const perSec = useRef({});
  const lastY = useRef(0); const touchingUntil = useRef(0);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let po, lpo;
    try {
      po = new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) dbg.cls += e.value; });
      po.observe({ type: 'layout-shift', buffered: true });
    } catch { /* unsupported */ }
    try {
      lpo = new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.duration > 50) dbg.longFrames++; });
      lpo.observe({ type: 'longtask', buffered: true });
    } catch { /* unsupported */ }
    // The app scrolls inside .fr-main, not the window — watch both.
    const onTouch = () => { touchingUntil.current = Date.now() + 350; };
    const onScroll = (e) => {
      const y = e.target === document ? window.scrollY : e.target.scrollTop;
      const dy = Math.abs(y - lastY.current);
      if (dy > 40 && Date.now() > touchingUntil.current) { dbg.scrollJumps++; dbg.lastJump = Math.round(dy); }
      lastY.current = y;
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('wheel', onTouch, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    const iv = setInterval(() => {
      for (const k of Object.keys(dbg.renders)) { perSec.current[k] = (dbg.renders[k] || 0) - (prev.current[k] || 0); prev.current[k] = dbg.renders[k] || 0; }
      force(n => n + 1);
    }, 1000);
    return () => {
      try { po?.disconnect(); lpo?.disconnect(); } catch { /* noop */ }
      window.removeEventListener('touchstart', onTouch); window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('wheel', onTouch);
      document.removeEventListener('scroll', onScroll, { capture: true });
      clearInterval(iv);
    };
  }, []);

  const copy = () => {
    const text = JSON.stringify(buildDeviceReport(perSec.current), null, 2);
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    const fallback = () => {
      try { const ta = document.createElement('textarea'); ta.value = text; ta.className = 'dbg-offscreen';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      catch { console.log('[debug] report\n' + text); }
      done();
    };
    try { navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).then(done, fallback) : fallback(); } catch { fallback(); }
  };

  const vp = `${window.innerWidth}×${window.innerHeight} @${(window.devicePixelRatio || 1).toFixed(2)}x`;
  const under = open ? countUnder44().under : 0;
  const net = dbg.net.filter(n => n.at >= Date.now() - 60000);
  const main = document.querySelector('.fr-main');
  const row = (k, v) => <div className="dbg-row"><span>{k}</span><strong>{v}</strong></div>;

  return (
    <div className="dbg-overlay" data-open={open ? '1' : '0'}>
      <button type="button" className="dbg-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '?debug ▾' : '?debug ▸'}
      </button>
      {open && (<>
        {row('build', BUILD_ID)}
        {row('viewport', vp)}
        {row('UA', navigator.userAgent.match(/(iPad|iPhone|Android|Macintosh|Windows|Linux)/)?.[1] || '—')}
        {row('App renders', `${dbg.renders.App || 0} (${perSec.current.App || 0}/s)`)}
        {row('CLS', dbg.cls.toFixed(4))}
        {row('scroll jumps', `${dbg.scrollJumps}${dbg.lastJump ? ` (${dbg.lastJump}px)` : ''}`)}
        {row('long frames', dbg.longFrames)}
        {row('header h', main ? `${Math.round(main.getBoundingClientRect().top)}px` : '—')}
        {row('controls <44px', under)}
        {row('net (60s)', `${net.length}${net.some(n => typeof n.status !== 'number' || n.status >= 400) ? ' · errors' : ''}`)}
        <div className="dbg-net">
          {net.slice(-5).map((n, i) => <div key={i}>{n.status ?? '…'} {n.method} {n.path} {n.ms != null ? `${n.ms}ms` : ''}</div>)}
        </div>
        <button type="button" className="dbg-copy" onClick={copy}>{copied ? 'Copied — paste it back' : 'Copy report'}</button>
      </>)}
    </div>
  );
}
