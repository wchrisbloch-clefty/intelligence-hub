import { T } from '../../theme';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../App.jsx';
import { routeIntent } from '../../utils.js';
import { ThinkingDots } from './Common.jsx';

const ACCENT = T.accent;
const ROUTES = [
  { id: 'learn',    label: 'Learn' },
  { id: 'ladder',   label: 'Ladder' },
  { id: 'deepdive', label: 'Deep Dive' },
  { id: 'research', label: 'Research' },
  { id: 'project',  label: 'Projects' },
  { id: 'note',     label: 'Inbox' },
];
const label = (id) => ROUTES.find(r => r.id === id)?.label || id;

// Type-and-go front door: raw intent → intent router → routed to the right
// module pre-filled. Never forces a category. Shows a "Routing to X — change?"
// affordance so the user can override before going.
export default function CaptureBar() {
  const { applyRoute, focusCaptureNonce } = useApp();
  const [text, setText]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(null); // { route, topic, suggestedCategory, suggestedDepth, rationale }
  const inputRef = useRef(null);

  useEffect(() => {
    if (focusCaptureNonce) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusCaptureNonce]);

  const classify = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setResult(null);
    const r = await routeIntent(text.trim());
    setResult(r);
    setBusy(false);
  };

  const go = (route) => {
    if (!result) return;
    applyRoute({ ...result, route });
    setText(''); setResult(null);
  };

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT}`, borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>✦ Capture — just start typing</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') classify(); }}
          placeholder="A topic, a question, an idea — no category needed. I'll route it."
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, padding: '11px 13px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={classify} disabled={!text.trim() || busy}
          style={{ padding: '11px 16px', background: text.trim() && !busy ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 9, color: text.trim() && !busy ? T.canvas : 'var(--dim)', fontSize: 14, fontWeight: 800, cursor: text.trim() && !busy ? 'pointer' : 'not-allowed', flexShrink: 0, minHeight: 42 }}>→</button>
      </div>

      {busy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <ThinkingDots color={ACCENT} /><span style={{ fontSize: 11, color: 'var(--dim)' }}>Reading your intent…</span>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bord2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text-b)' }}>
              → Routing to <strong style={{ color: ACCENT }}>{label(result.route)}</strong>
              {result.topic ? <span style={{ color: 'var(--muted)' }}> · {result.topic}</span> : null}
            </div>
            <div onClick={() => go(result.route)}
              style={{ padding: '6px 14px', background: ACCENT, borderRadius: 8, color: T.canvas, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Go →</div>
          </div>
          {result.rationale && <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>{result.rationale}</div>}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--dim)' }}>change:</span>
            {ROUTES.filter(r => r.id !== result.route).map(r => (
              <div key={r.id} onClick={() => go(r.id)}
                style={{ padding: '3px 10px', borderRadius: 14, border: '1px solid var(--border)', color: 'var(--subtle)', fontSize: 10, cursor: 'pointer' }}>
                {r.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
