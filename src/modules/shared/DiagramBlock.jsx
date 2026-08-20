// src/modules/shared/DiagramBlock.jsx — an inline learning diagram for any
// explanation surface (study guides, deep dives, Academy, Learning Center, Ask).
//
// Given source `content`, it asks the model for Mermaid ONLY, validates it, and
// renders client-side (no image service). On a parse failure it shows a text
// outline instead of a broken diagram. A saved diagram (`initialCode`) renders
// immediately; `onGenerated(code)` lets the parent persist the diagram with its
// artifact so it saves and exports alongside it. Theme-aware (redraws on a theme
// toggle) and legible at 390px — the SVG keeps its natural size and the frame
// scrolls rather than shrinking text below --fs-sm.
import { useState, useEffect, useRef, useId } from 'react';
import { callClaude } from '../../utils.js';
import { renderMermaid, cleanMermaid, toOutline } from '../../lib/diagram.js';
import Icon from './Icon.jsx';
import { ThinkingDots } from './Common.jsx';

export default function DiagramBlock({ content, hint = '', initialCode = '', onGenerated, label = 'Visualize', compact = false }) {
  const [code, setCode] = useState(initialCode || '');
  const [svg, setSvg] = useState('');
  const [outline, setOutline] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [themeNonce, setThemeNonce] = useState(0);
  const rid = 'dgm_' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Redraw on a theme toggle so colors track light/dark.
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeNonce((n) => n + 1));
    try { obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch {}
    return () => obs.disconnect();
  }, []);

  // (Re)render whenever the code or theme changes.
  useEffect(() => {
    let cancelled = false;
    if (!code) { setSvg(''); return; }
    (async () => {
      const r = await renderMermaid(rid + '_' + themeNonce, code);
      if (cancelled || !mounted.current) return;
      if (r.ok) { setSvg(r.svg); setOutline(''); }
      else { setSvg(''); setOutline(toOutline(content)); setNote('Could not render this diagram — showing an outline instead.'); }
    })();
    return () => { cancelled = true; };
  }, [code, themeNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setLoading(true); setNote(''); setOutline('');
    try {
      const reply = await callClaude({
        system: 'You output ONLY valid Mermaid diagram syntax — no prose, no explanation, no code fences. Pick the single clearest diagram type: flowchart, sequenceDiagram, mindmap, timeline, or quadrantChart.',
        messages: [{ role: 'user', content: `Produce ONE Mermaid diagram that captures the structure of the following. Keep labels short. Output ONLY Mermaid.\n\n${hint ? hint + '\n\n' : ''}${String(content || '').slice(0, 2200)}` }],
        maxTokens: 700,
        job: 'reason',
      });
      const clean = cleanMermaid(reply);
      const r = await renderMermaid(rid + '_gen', clean);
      if (!mounted.current) return;
      if (r.ok) { setCode(clean); setSvg(r.svg); setOutline(''); onGenerated?.(clean); }
      else { setOutline(toOutline(content)); setNote('Could not render a diagram — showing an outline instead.'); }
    } catch {
      if (mounted.current) { setOutline(toOutline(content)); setNote('Could not generate a diagram — showing an outline instead.'); }
    }
    if (mounted.current) setLoading(false);
  };

  const btn = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: compact ? '5px 11px' : '7px 13px',
    borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--text-secondary)',
    fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', minHeight: 34,
  };

  return (
    <div style={{ marginTop: 12 }}>
      {!svg && !outline && !loading && (
        <button onClick={generate} style={btn}>
          <Icon name="Share2" size={14} /> {label}
        </button>
      )}
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}><ThinkingDots color="var(--accent)" /> Drawing…</div>}

      {svg && (
        <div>
          <div
            // Natural-size SVG in a horizontally scrollable frame — legible at
            // 390px without shrinking text below --fs-sm.
            style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--surface)', padding: 14 }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={() => { setCode(''); setSvg(''); }} style={{ ...btn, border: 'none', padding: '3px 6px' }}>
              <Icon name="RefreshCw" size={12} /> Redraw
            </button>
          </div>
        </div>
      )}

      {outline && (
        <div style={{ border: '1px solid var(--rule)', borderRadius: 10, background: 'var(--surface)', padding: 14 }}>
          {note && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>{note}</div>}
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 'var(--lh-read)' }}>{outline}</pre>
          <button onClick={generate} style={{ ...btn, marginTop: 8 }}><Icon name="RefreshCw" size={12} /> Try diagram again</button>
        </div>
      )}
    </div>
  );
}
