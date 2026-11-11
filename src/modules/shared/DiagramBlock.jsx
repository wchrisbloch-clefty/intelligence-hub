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
import './diagram-block.css';

// `types` lets a caller constrain which Mermaid diagram kinds are allowed — pass
// e.g. ['flowchart','quadrantChart'] to force a causal/tension diagram and keep
// the model out of a decorative mindmap that just restates a hierarchy.
const DEFAULT_TYPES = ['flowchart', 'sequenceDiagram', 'mindmap', 'timeline', 'quadrantChart'];
export default function DiagramBlock({ content, hint = '', initialCode = '', onGenerated, label = 'Visualize', compact = false, auto = false, types = DEFAULT_TYPES }) {
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
      const typeList = (types && types.length ? types : DEFAULT_TYPES).join(', ');
      const analytical = !types?.includes('mindmap');
      const reply = await callClaude({
        system: `You output ONLY valid Mermaid diagram syntax — no prose, no explanation, no code fences. Pick the single clearest diagram type from: ${typeList}. Do NOT include ANY color, hex codes, or styling — no fill:, stroke:, style, classDef, or linkStyle directives; the app themes the diagram itself.${analytical ? ' Show CAUSAL or TENSION relationships — how elements drive, depend on, feed back into, or trade off against one another (A → B, X vs Y). Do NOT restate a section hierarchy, an outline, or a flat list of items.' : ''}`,
        messages: [{ role: 'user', content: `Produce ONE Mermaid diagram that captures the ${analytical ? 'relationships and mechanism' : 'structure'} of the following. Keep labels short. Output ONLY Mermaid.\n\n${hint ? hint + '\n\n' : ''}${String(content || '').slice(0, 2200)}` }],
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

  // Auto-generate once when asked (e.g. a guide with 3+ frameworks), unless a
  // saved diagram is already present.
  const autoFired = useRef(false);
  useEffect(() => {
    if (auto && !autoFired.current && !initialCode && !code && content) {
      autoFired.current = true;
      generate();
    }
  }, [auto, content]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dg" data-compact={compact ? '' : undefined}>
      {!svg && !outline && !loading && (
        <button type="button" className="dg-btn tap" onClick={generate}>
          <Icon name="Share2" size={14} /> {label}
        </button>
      )}
      {loading && <div className="dg-busy" aria-live="polite"><ThinkingDots color="var(--accent-text)" /> Drawing…</div>}

      {svg && (
        <div>
          <div
            // Natural-size SVG in a horizontally scrollable frame — legible at
            // 390px without shrinking text below --fs-sm.
            className="dg-frame" data-scroll-x=""
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="dg-tools">
            <button type="button" className="dg-btn tap" data-bare="" onClick={() => { setCode(''); setSvg(''); }}>
              <Icon name="RefreshCw" size={12} /> Redraw
            </button>
          </div>
        </div>
      )}

      {outline && (
        <div className="dg-frame">
          {note && <div className="dg-note">{note}</div>}
          <pre className="dg-outline">{outline}</pre>
          <button type="button" className="dg-btn tap" data-space="" onClick={generate}><Icon name="RefreshCw" size={12} /> Try diagram again</button>
        </div>
      )}
    </div>
  );
}
