import { useState, useEffect } from 'react';
import { useApp } from '../../App.jsx';
import { callClaude } from '../../utils.js';
import { CB_IDENTITY } from '../../constants.js';
import MD from '../shared/MD.jsx';
import Icon from '../shared/Icon.jsx';
import { SectionSkeleton, SectionError } from '../shared/SectionState.jsx';

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

  // Before the first generate kicks in (600ms debounce) the brief is still on its
  // way — show the skeleton from first paint so the card never jumps.
  const status = error ? 'error' : brief ? 'ready' : 'loading';
  return (
    <div className="hm-brief" data-status={status}>
      <div className="hm-brief-head">
        <div className="hm-brief-id">
          <Icon name="Zap" size="header" />
          <div>
            <div className="hm-brief-title">Daily Intelligence Brief</div>
            <div className="hm-brief-kick">CB-Style · Auto-Generated</div>
          </div>
        </div>
        {done && (
          <button type="button" className="btn tap" onClick={() => { setBrief(''); setDone(false); generate(null); }}>
            <Icon name="RefreshCw" size={14} /> Refresh
          </button>
        )}
      </div>
      <div className="hm-brief-body">
        {status === 'loading' && <SectionSkeleton rows={3} label="daily brief" />}
        {status === 'error' && <SectionError label="today’s brief" onRetry={() => generate(null)} />}
        {brief && <MD text={brief} color="var(--accent-text)" />}
      </div>
    </div>
  );
}
