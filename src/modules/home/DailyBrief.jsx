import { useState, useEffect } from 'react';
import { useApp } from '../../App.jsx';
import { callClaude } from '../../utils.js';
import { CB_IDENTITY } from '../../constants.js';
import MD from '../shared/MD.jsx';
import Icon from '../shared/Icon.jsx';
import { ThinkingDots } from '../shared/Common.jsx';

// Daily Intelligence Brief — one AI-generated card, cached per day. Chrome is
// quiet (header in --text-tertiary, hairline rule); the only accent is Refresh,
// which is an action.
export default function DailyBrief() {
  const { graph, projects } = useApp();
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const activeProjects = (projects || []).filter((p) => p.status === 'active');
  const topics = Object.values(graph?.topics || {});

  useEffect(() => {
    const key = `aether_brief_${new Date().toDateString()}`;
    const saved = localStorage.getItem(key);
    if (saved) { setBrief(saved); setDone(true); return; }
    const t = setTimeout(() => generate(key), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async (cacheKey) => {
    setLoading(true); setError(false);
    try {
      const projList = activeProjects.slice(0, 3).map((p) => p.title).join(', ') || 'none yet';
      const topicList = topics.slice(-3).map((t) => t.title).join(', ') || 'none yet';
      const prompt = `CB's Daily Intelligence Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

Give CB 4 tight, decisive bullets. Format exactly:
**Signal** — [single most important strategic insight for CB today — BD, real estate, energy, or longevity]
**Blue Ocean** — [one underpriced opportunity CB should be tracking right now]
**Today's Move** — [one concrete action CB should take today — specific]
**Mental Model** — [one framework from CB's library that applies right now]

CB's context: projects: ${projList} · recent learning: ${topicList} · streak: ${graph?.streak || 0} days · Houston, TX. BD professional.

Be blunt. No hedging. One decisive line per bullet.`;
      const reply = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 500 });
      setBrief(reply); setDone(true);
      if (cacheKey) localStorage.setItem(cacheKey, reply);
    } catch { setError(true); }
    setLoading(false);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="Zap" size="header" style={{ color: 'var(--text-tertiary)' }} />
          <div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>Daily Intelligence Brief</div>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>CB-Style · Auto-Generated</div>
          </div>
        </div>
        {done && (
          <button onClick={() => { setBrief(''); setDone(false); generate(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', padding: '5px 11px', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--accent)', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', fontWeight: 600 }}>
            <Icon name="RefreshCw" size={14} /> Refresh
          </button>
        )}
      </div>
      <div style={{ padding: '16px 20px 18px' }}>
        {loading && !brief && <div><div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>Generating intelligence brief…</div><ThinkingDots /></div>}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Brief unavailable — check connection.</div>
            <button onClick={() => generate(null)} style={{ fontSize: 'var(--fs-sm)', padding: '5px 12px', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 8, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
          </div>
        )}
        {brief && <MD text={brief} color="var(--accent)" />}
      </div>
    </div>
  );
}
