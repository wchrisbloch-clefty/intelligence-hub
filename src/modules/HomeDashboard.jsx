import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ONBOARDING_KEY = 'aether_onboarded_v1';

const RECO_CACHE_KEY = () => `aether_recos_${new Date().toDateString()}`;

function OnboardingBanner({ onDismiss }) {
  return (
    <div style={{ margin: '0 0 20px', padding: '14px 18px', background: 'linear-gradient(135deg, rgba(0,198,230,0.06) 0%, rgba(99,102,241,0.06) 100%)', border: '1px solid rgba(0,198,230,0.2)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)' }}>Welcome to your Intelligence Hub, CB.</div>
        <div onClick={onDismiss} style={{ fontSize: 12, color: 'var(--dim)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>✕</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { icon: '📡', label: 'Daily Brief', desc: 'AI-generated signal intel every morning — refresh anytime.' },
          { icon: '🌊', label: 'Blue Ocean', desc: 'CB-curated opportunities in Real Estate, Finance, and Longevity.' },
          { icon: '📚', label: '14 Modules', desc: 'Learn, Research, Coach, TED, Quiz, Projects, Vault and more.' },
        ].map(item => (
          <div key={item.label} style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--bord2)' }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 9, color: 'var(--dim)', lineHeight: 1.4 }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsSection({ graph, projects, setActiveModule }) {
  const [recos,   setRecos]   = useState(() => { try { return JSON.parse(localStorage.getItem(RECO_CACHE_KEY()) || 'null'); } catch { return null; } });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recos) generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setLoading(true);
    const topics   = Object.values(graph?.topics || {}).slice(0, 4).map(t => t.title).join(', ') || 'none';
    const projs    = (projects || []).filter(p => p.status === 'active').slice(0, 2).map(p => p.title).join(', ') || 'none';
    const prompt = `Generate 4 personalized recommendations for CB right now.

CB context: Learning topics: ${topics}. Active projects: ${projs}. Houston TX, BD professional. Interests: real estate, finance/dividends, longevity (Attia), AI-augmented BD, stoic philosophy.

Return ONLY valid JSON (no markdown):
{"recommendations":[
  {"type":"book","title":"Book title","reason":"One direct sentence connecting to CB's specific goals or active topics","action":"learn","icon":"📚"},
  {"type":"video","title":"Talk or podcast title","reason":"One direct sentence","action":"ted","icon":"🎙"},
  {"type":"action","title":"Specific action CB should take today","reason":"One direct sentence","action":"projects","icon":"⚡"},
  {"type":"concept","title":"Concept or framework name","reason":"One direct sentence","action":"research","icon":"🔭"}
]}`;
    try {
      const raw = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 500 });
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setRecos(parsed.recommendations || []);
      localStorage.setItem(RECO_CACHE_KEY(), JSON.stringify(parsed.recommendations || []));
    } catch {
      setRecos([]);
    }
    setLoading(false);
  };

  const typeColors = { book: '#a78bfa', video: '#e2231a', action: '#00C6E6', concept: '#6366F1' };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12 }}>✦</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--dim)', letterSpacing: 2.5, textTransform: 'uppercase' }}>For You</span>
        </div>
        <div onClick={generate} style={{ fontSize: 10, color: 'var(--accent, #00C6E6)', cursor: 'pointer', fontWeight: 700 }}>↻ Refresh</div>
      </div>
      {loading ? (
        <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
          <ThinkingDots color="var(--accent, #00C6E6)" />
        </div>
      ) : (recos || []).length === 0 ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {(recos || []).map((r, i) => (
            <div key={i} onClick={() => setActiveModule(r.action || 'home')}
              style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = typeColors[r.type] + '55'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 14 }}>{r.icon}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: typeColors[r.type] || 'var(--accent)', background: (typeColors[r.type] || '#00C6E6') + '18', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{r.type}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.5 }}>{r.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SIGNALS = [
  { emoji: '🏘', title: 'Small Multifamily in Transitioning Houston Zips', insight: 'Institutional buyers skip sub-10 unit buildings. AI-driven migration is quietly repricing these before anyone notices.', category: 'Real Estate', color: '#00C6E6', urgency: 'HIGH' },
  { emoji: '🤖', title: 'AI-Augmented BD Professionals', insight: 'First movers who build systematic AI pipelines in BD will have a 10x edge within 18 months. Almost nobody is doing this yet.', category: 'Career Edge', color: '#6366F1', urgency: 'HIGH' },
  { emoji: '📈', title: 'Covered Calls on Dividend Stacks', insight: 'Systematic covered call writing on dividend portfolios adds 3–5% yield with no extra capital. Almost no retail investors act on it.', category: 'Finance', color: '#ffcc44', urgency: 'MED' },
  { emoji: '⚡', title: 'ERCOT Ancillary Services', insight: 'Texas grid volatility = pricing opportunity in frequency regulation and demand response. Deeply underutilized by non-institutional players.', category: 'Energy/Macro', color: '#ff8844', urgency: 'MED' },
  { emoji: '🏥', title: 'Longevity Biomarkers Protocol', insight: "Attia's Zone 2 + VO₂Max + muscle mass trifecta: most people optimize none. The compounding return on health at 40+ is asymmetric.", category: 'Longevity', color: '#ff4488', urgency: 'HIGH' },
  { emoji: '🌐', title: 'Onshoring Infrastructure Play', insight: 'Data centers, chip fabs, and LNG terminals being built at scale. The construction supply chain is the overlooked moat.', category: 'Macro', color: '#4488ff', urgency: 'MED' },
];

const QUICK_MODULES = [
  { id: 'learn',    icon: '📚', label: 'Learn',    desc: 'Books, topics, courses',  color: '#00C6E6' },
  { id: 'research', icon: '🔭', label: 'Research',  desc: 'Truth-first analysis',   color: '#6366F1' },
  { id: 'podcast',  icon: '🎙️', label: 'Podcasts',  desc: 'AI summaries + listen', color: '#e11d48' },
  { id: 'projects', icon: '🚀', label: 'Projects',  desc: 'Track & ship',           color: '#ff8844' },
  { id: 'vault',    icon: '🏛', label: 'Vault',     desc: 'Knowledge base',         color: '#ffcc44' },
  { id: 'growth',   icon: '📈', label: 'Growth',    desc: 'Goals & synthesis',      color: '#44ffcc' },
];

function RadarChart({ data, size = 160 }) {
  if (!data || data.length < 3) return null;
  const items = data.slice(0, 6);
  const n = items.length;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;

  const pt = (i, ratio) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * ratio * Math.cos(a), y: cy + r * ratio * Math.sin(a) };
  };
  const poly = pts => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const outerRing  = items.map((_, i) => pt(i, 1));
  const dataPoints = items.map((t, i) => pt(i, Math.min((t.confidence || 5) / 10, 1)));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {[0.33, 0.66, 1].map(lv => (
        <polygon key={lv} points={poly(items.map((_, i) => pt(i, lv)))}
          fill="none" stroke="var(--border)" strokeWidth="0.8" />
      ))}
      {outerRing.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="0.8" />
      ))}
      <polygon points={poly(dataPoints)}
        fill="var(--accent-glow, rgba(0,198,230,0.12))"
        stroke="var(--accent, #00C6E6)" strokeWidth="1.5" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--accent, #00C6E6)" />
      ))}
      {outerRing.map((p, i) => {
        const name  = items[i].title || '';
        const label = name.length > 10 ? name.slice(0, 10) + '…' : name;
        const right = p.x > cx + 3, left = p.x < cx - 3;
        return (
          <text key={i}
            x={p.x + (right ? 7 : left ? -7 : 0)}
            y={p.y + (p.y < cy - 3 ? -7 : p.y > cy + 3 ? 13 : 4)}
            textAnchor={right ? 'start' : left ? 'end' : 'middle'}
            fontSize="7.5" fontFamily="inherit" fill="var(--dim)">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function ProgressRing({ confidence = 5, size = 60, label }) {
  const r      = (size - 8) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = circ * Math.min(confidence / 10, 1);
  const color  = confidence >= 8 ? '#00CC76' : confidence >= 5 ? 'var(--accent, #00C6E6)' : '#ffcc44';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color }}>
          {confidence}
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 9, color: 'var(--text-c)', textAlign: 'center', maxWidth: size + 16, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {label}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, label, action, actionLabel, actionColor = 'var(--accent, #00C6E6)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <span style={{ fontSize: 12 }}>{icon}</span>}
        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--dim)', letterSpacing: 2.5, textTransform: 'uppercase' }}>{label}</span>
      </div>
      {action && actionLabel && (
        <div onClick={action} style={{ fontSize: 10, color: actionColor, cursor: 'pointer', fontWeight: 700, letterSpacing: 0.2 }}>{actionLabel} →</div>
      )}
    </div>
  );
}

function SkillBar({ title, confidence = 5 }) {
  const pct   = Math.round((confidence / 10) * 100);
  const color = confidence >= 8 ? '#00CC76' : confidence >= 5 ? 'var(--accent, #00C6E6)' : '#ffcc44';
  const tier  = confidence >= 8 ? 'Expert' : confidence >= 6 ? 'Proficient' : confidence >= 4 ? 'Learning' : 'Beginner';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, color, fontWeight: 700, background: `${color}18`, padding: '1px 6px', borderRadius: 3, border: `1px solid ${color}30` }}>{tier}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const { graph, projects, notes, setActiveModule, isMobile, isTablet, isPhone, isDesktop } = useApp();

  const [brief,        setBrief]        = useState('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefDone,    setBriefDone]    = useState(false);
  const [briefError,   setBriefError]   = useState(false);
  const [onboarded,    setOnboarded]    = useState(() => !!localStorage.getItem(ONBOARDING_KEY));

  const topics         = Object.values(graph?.topics || {});
  const totalMin       = graph?.totalTime || 0;
  const activeProjects = projects.filter(p => p.status === 'active');
  const recentSessions = (graph?.sessions || []).slice(-4).reverse();
  const recentNotes    = (notes || []).slice(0, 3);

  const ringTopics  = [...topics].sort((a, b) => (b.lastSession || 0) - (a.lastSession || 0)).slice(0, 4);
  const radarTopics = [...topics].sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 6);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  const twoCol   = isDesktop;
  const pad      = isPhone ? '14px' : isMobile ? '16px' : isTablet ? '22px' : '28px';

  useEffect(() => {
    const key   = `aether_brief_${new Date().toDateString()}`;
    const saved = localStorage.getItem(key);
    if (saved) { setBrief(saved); setBriefDone(true); return; }
    const t = setTimeout(() => generateBrief(key), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateBrief = async (cacheKey) => {
    if (briefLoading) return;
    setBriefLoading(true);
    setBriefError(false);
    try {
      const projList  = activeProjects.slice(0, 3).map(p => p.title).join(', ') || 'none yet';
      const topicList = topics.slice(-3).map(t => t.title).join(', ')            || 'none yet';
      const prompt = `CB's Daily Intelligence Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

Give CB 4 tight, decisive bullets. Format exactly:
**📡 Signal** — [single most important strategic insight for CB today — connect to BD, real estate, energy, or longevity]
**🌊 Blue Ocean** — [one underpriced opportunity CB should be tracking right now]
**⚡ Today's Move** — [one concrete action CB should take today — specific, not vague]
**🧠 Mental Model** — [one framework from CB's library that applies to what's happening right now]

CB's context: projects: ${projList} · recent learning: ${topicList} · streak: ${graph?.streak || 0} days · Houston, TX. BD professional.

Be blunt. No hedging. One decisive line per bullet.`;

      const reply = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 500 });
      setBrief(reply);
      setBriefDone(true);
      if (cacheKey) localStorage.setItem(cacheKey, reply);
    } catch {
      setBriefError(true);
    }
    setBriefLoading(false);
  };

  const refreshBrief = () => { setBrief(''); setBriefDone(false); generateBrief(null); };

  // ── Right panel (desktop only) ────────────────────────────────────────
  const rightPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Skill Mastery — horizontal progress bars */}
      {radarTopics.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <SectionLabel icon="🧠" label="Skill Mastery" action={() => setActiveModule('learn')} actionLabel="View all" />
          {radarTopics.map((t, i) => (
            <SkillBar key={i} title={t.title} confidence={t.confidence || 5} />
          ))}
          {radarTopics.length >= 3 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bord2)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Mastery Overview</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <RadarChart data={radarTopics} size={148} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Projects */}
      {activeProjects.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <SectionLabel icon="🚀" label="Active Projects" action={() => setActiveModule('projects')} actionLabel="All" actionColor="#ff8844" />
          {activeProjects.slice(0, 4).map((p, idx) => {
            const done  = (p.milestones || []).filter(m => m.done).length;
            const total = (p.milestones || []).length;
            const pct   = total ? Math.round((done / total) * 100) : 0;
            const color = p.color || '#ff8844';
            return (
              <div key={p.id} onClick={() => setActiveModule('projects')} style={{ cursor: 'pointer', marginBottom: idx < activeProjects.slice(0, 4).length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{p.emoji || '🚀'} {p.title}</div>
                    {total > 0 && (
                      <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{done}/{total} milestones done</div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color, paddingTop: 1 }}>{pct}%</div>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Continue Learning rings — only if no skill bars (no topics yet) */}
      {ringTopics.length > 0 && radarTopics.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <SectionLabel icon="📖" label="Continue Learning" action={() => setActiveModule('learn')} actionLabel="Open" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {ringTopics.map((t, i) => (
              <div key={i} onClick={() => setActiveModule('learn')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <ProgressRing confidence={t.confidence || 5} size={64} label={t.title} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: twoCol ? 1200 : '100%', margin: '0 auto', paddingBottom: isMobile ? 80 : 60 }}>

      {/* Greeting */}
      <div style={{ padding: `${pad} ${pad} 0`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 16 : 20 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5, lineHeight: 1.1 }}>
            {greeting}, CB.
          </div>
          <div style={{ fontSize: isMobile ? 11 : 13, color: 'var(--muted)', marginTop: 5 }}>
            {topics.length > 0 ? `${topics.length} topics tracked · ${activeProjects.length} projects active` : 'Your intelligence hub is ready.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: 4 }}>
          {(graph?.streak || 0) > 0 && <div style={{ fontSize: 10, color: 'var(--text-c)', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20 }}>🔥 {graph.streak}d</div>}
          {totalMin > 0 && <div style={{ fontSize: 10, color: 'var(--text-c)', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20 }}>⏱ {Math.round(totalMin / 60)}h</div>}
        </div>
      </div>

      {/* Mobile: Continue Learning rings */}
      {isMobile && ringTopics.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ padding: `0 ${pad}` }}>
            <SectionLabel icon="📖" label="Continue Learning" action={() => setActiveModule('learn')} actionLabel="Learn" />
          </div>
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', padding: `0 ${pad} 4px` }}>
            {ringTopics.map((t, i) => (
              <div key={i} onClick={() => setActiveModule('learn')} style={{ flexShrink: 0, cursor: 'pointer' }}>
                <ProgressRing confidence={t.confidence || 5} size={62} label={t.title} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main two-column grid */}
      <div style={{ display: twoCol ? 'grid' : 'block', gridTemplateColumns: twoCol ? '1fr 320px' : undefined, gap: '20px', padding: `0 ${pad}`, alignItems: 'flex-start' }}>

        {/* LEFT COLUMN */}
        <div>

          {/* Onboarding banner — first visit only */}
          {!onboarded && (
            <OnboardingBanner onDismiss={() => { setOnboarded(true); localStorage.setItem(ONBOARDING_KEY, '1'); }} />
          )}

          {/* Recommendations */}
          <RecommendationsSection graph={graph} projects={projects} setActiveModule={setActiveModule} />

          {/* Daily Intelligence Brief */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: '3px solid var(--accent, #00C6E6)',
            borderRadius: isMobile ? 0 : 14,
            overflow: 'hidden',
            marginBottom: isMobile ? 16 : 20,
            marginLeft: isMobile ? -14 : 0,
            marginRight: isMobile ? -14 : 0,
          }}>
            <div style={{ padding: isMobile ? '14px 16px 12px' : '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bord2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, rgba(0,198,230,0.15), rgba(99,102,241,0.15))', border: '1px solid rgba(0,198,230,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>⚡</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.2 }}>Daily Intelligence Brief</div>
                  <div style={{ fontSize: 9, color: 'var(--accent, #00C6E6)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>CB-Style · Auto-Generated</div>
                </div>
              </div>
              {briefDone && (
                <button onClick={refreshBrief}
                  style={{ fontSize: 10, padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--dim)', cursor: 'pointer', background: 'var(--bg)', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ↻ <span>Refresh</span>
                </button>
              )}
            </div>
            <div style={{ padding: isMobile ? '14px 16px 16px' : '16px 20px 18px' }}>
              {briefLoading && !brief && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12 }}>Generating intelligence brief…</div>
                  <ThinkingDots color="var(--accent, #00C6E6)" />
                </div>
              )}
              {briefError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Brief unavailable — check connection.</div>
                  <div onClick={() => generateBrief(null)} style={{ fontSize: 10, padding: '5px 12px', background: 'var(--accent-glow)', border: '1px solid rgba(0,198,230,0.3)', borderRadius: 6, color: 'var(--accent, #00C6E6)', cursor: 'pointer' }}>Retry</div>
                </div>
              )}
              {brief && <MD text={brief} color="var(--accent, #00C6E6)" />}
            </div>
          </div>

          {/* Blue Ocean Signals */}
          <div style={{ marginBottom: isMobile ? 20 : 24, marginLeft: isMobile ? -14 : 0, marginRight: isMobile ? -14 : 0 }}>
            <div style={{ padding: isMobile ? '0 14px' : '0' }}>
              <SectionLabel icon="🌊" label="Blue Ocean Signals" action={() => setActiveModule('research')} actionLabel="Research" actionColor="#6366F1" />
            </div>
            {isMobile ? (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', padding: `0 14px 4px` }}>
                {SIGNALS.map((s, i) => (
                  <div key={i} style={{ flexShrink: 0, width: isPhone ? 240 : 270, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${s.color}22`, borderTop: `3px solid ${s.color}`, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: s.color, letterSpacing: 0.5 }}>{s.emoji} {s.category}</div>
                      <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: s.urgency === 'HIGH' ? `${s.color}20` : 'var(--bg)', border: `1px solid ${s.color}30`, color: s.color, fontWeight: 800, letterSpacing: 1 }}>{s.urgency}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 7, lineHeight: 1.3, letterSpacing: -0.2 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{s.insight}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 1fr' : '1fr 1fr 1fr', gap: 10 }}>
                {SIGNALS.map((s, i) => (
                  <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${s.color}22`, borderTop: `3px solid ${s.color}`, borderRadius: 12, transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}55`; e.currentTarget.style.borderTopColor = s.color; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${s.color}22`; e.currentTarget.style.borderTopColor = s.color; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: s.color, letterSpacing: 0.5 }}>{s.emoji} {s.category}</div>
                      <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: s.urgency === 'HIGH' ? `${s.color}20` : 'var(--bg)', border: `1px solid ${s.color}30`, color: s.color, fontWeight: 800, letterSpacing: 1 }}>{s.urgency}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 7, lineHeight: 1.3, letterSpacing: -0.2 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{s.insight}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile: quick access + projects */}
          {isMobile && (
            <>
              <div style={{ marginBottom: 20 }}>
                <SectionLabel icon="⚡" label="Quick Access" />
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                  {QUICK_MODULES.map(m => (
                    <div key={m.id} onClick={() => setActiveModule(m.id)}
                      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${m.color}22`, borderRadius: 12, cursor: 'pointer', minWidth: 72, WebkitTapHighlightColor: 'transparent' }}>
                      <div style={{ fontSize: 22 }}>{m.icon}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {activeProjects.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionLabel icon="🚀" label="Active Projects" action={() => setActiveModule('projects')} actionLabel="View all" actionColor="#ff8844" />
                  {activeProjects.slice(0, 3).map(p => {
                    const done  = (p.milestones || []).filter(m => m.done).length;
                    const total = (p.milestones || []).length || 1;
                    const pct   = Math.round((done / total) * 100);
                    return (
                      <div key={p.id} onClick={() => setActiveModule('projects')}
                        style={{ padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${p.color || '#ff8844'}22`, borderRadius: 10, cursor: 'pointer', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{p.emoji} {p.title}</div>
                          <div style={{ fontSize: 11, color: p.color || '#ff8844', fontWeight: 700, flexShrink: 0 }}>{pct}%</div>
                        </div>
                        <div style={{ background: 'var(--border)', borderRadius: 2, height: 3 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: p.color || '#ff8844', borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {recentSessions.length === 0 && recentNotes.length === 0 && activeProjects.length === 0 && (
            <div style={{ padding: '20px', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 16, lineHeight: 1.7 }}>
                Your hub is fresh. Start anywhere — each module builds your intelligence graph.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[{ label: '📚 Start a Book', id: 'learn' }, { label: '🔭 Run Research', id: 'research' }, { label: '🎙️ Browse Podcasts', id: 'podcast' }].map(a => (
                  <div key={a.id} onClick={() => setActiveModule(a.id)}
                    style={{ padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-b)', cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center' }}>
                    {a.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — desktop only */}
        {twoCol && rightPanel}
      </div>

      {/* Quick Module Launch — desktop only, full-width below */}
      {!isMobile && (
        <div style={{ padding: `16px ${pad} 0` }}>
          <SectionLabel icon="⚡" label="Quick Access" />
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 10 }}>
            {QUICK_MODULES.map(m => (
              <div key={m.id} onClick={() => setActiveModule(m.id)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${m.color}20`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${m.color}55`}
                onMouseLeave={e => e.currentTarget.style.borderColor = `${m.color}20`}>
                <div style={{ fontSize: 22 }}>{m.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
