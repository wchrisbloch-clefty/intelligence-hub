import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../App.jsx';
import { routeIntent } from '../../utils.js';
import './capture-bar.css';
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
    <div className="cb">
      <label className="cb-kicker" htmlFor="cb-input">Capture — just start typing</label>
      <div className="cb-row">
        <input id="cb-input" ref={inputRef} className="cb-input" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') classify(); }}
          placeholder="A topic, a question, an idea — no category needed. I'll route it." />
        <button type="button" className="btn btn-primary cb-go tap" onClick={classify} disabled={!text.trim() || busy}
          aria-busy={busy ? 'true' : undefined} aria-label="Route it">→</button>
      </div>

      {busy && <div className="cb-busy" aria-live="polite">Reading your intent…</div>}

      {result && (
        <div className="cb-result">
          <div className="cb-result-row">
            <div className="cb-route">
              → Routing to <strong>{label(result.route)}</strong>
              {result.topic ? <span className="cb-topic"> · {result.topic}</span> : null}
            </div>
            <button type="button" className="btn btn-primary tap" onClick={() => go(result.route)}>Go →</button>
          </div>
          {result.rationale && <div className="cb-why">{result.rationale}</div>}
          <div className="cb-alts">
            <span className="cb-why">change:</span>
            {ROUTES.filter(r => r.id !== result.route).map(r => (
              <button type="button" key={r.id} className="chip tap" onClick={() => go(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
