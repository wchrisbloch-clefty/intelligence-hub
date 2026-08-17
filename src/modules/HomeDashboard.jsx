import { T, withAlpha } from '../theme';
import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import NavIcon from './shared/NavIcon.jsx';
import DueReviews from './shared/DueReviews.jsx';
import CaptureBar from './shared/CaptureBar.jsx';
import RecapCard from './shared/RecapCard.jsx';
import { Brain, Rocket, Waves, BookOpen, Zap, Sparkles, Building2, Briefcase, TrendingUp, Activity, Globe, Radio, LayoutGrid, RefreshCw, X, ArrowRight } from 'lucide-react';
import { getFeed, fmtCount, PLATFORM_META, TIER_META } from '../lib/adapters.js';

const ONBOARDING_KEY = 'aether_onboarded_v1';

const CATEGORY_ICONS = {
  'Real Estate':  Building2,
  'Career Edge':  Briefcase,
  'Finance':      TrendingUp,
  'Energy/Macro': Zap,
  'Longevity':    Activity,
  'Macro':        Globe,
};

function SignalTag({ category, color }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {Icon && <Icon size={11} strokeWidth={2.2} color={color} style={{ flexShrink: 0 }} />}
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color, letterSpacing: 0.1 }}>{category}</span>
    </div>
  );
}

function UrgencyPill({ urgency, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, padding: '2px 8px', borderRadius: 20, background: `${color}14`, border: `1px solid ${color}28`, color, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 0 }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {urgency}
    </span>
  );
}

const RECO_CACHE_KEY = () => `aether_recos_${new Date().toDateString()}`;

function OnboardingBanner({ onDismiss }) {
  const { isMobile, isPhone } = useApp();
  const items = [
    { Icon: Radio,      color: T.accent, label: 'Daily Brief',  desc: 'AI-generated signal intel every morning — refresh anytime.' },
    { Icon: Waves,      color: T.accent, label: 'Blue Ocean',   desc: 'CB-curated opportunities in Real Estate, Finance, and Longevity.' },
    { Icon: LayoutGrid, color: T.accent, label: '15 Modules',   desc: 'Learn, Ladder, Research, Coach, TED, Quiz, Projects, Vault and more.' },
  ];
  return (
    <div style={{ margin: '0 0 20px', padding: '14px 18px', background: 'linear-gradient(135deg, rgba(217,164,65,0.05) 0%, rgba(217,164,65,0.05) 100%)', border: '1px solid rgba(217,164,65,0.18)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text)' }}>Welcome to your Intelligence Hub, CB.</div>
        <div onClick={onDismiss} style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>✕</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 8 }}>
        {items.map(({ Icon, color, label, desc }) => (
          <div key={label} style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}14`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={14} strokeWidth={2} color={color} />
            </div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>{label}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsSection({ graph, projects, setActiveModule }) {
  const { isPhone } = useApp();
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

  const typeColors = { book: T.accent, video: T.accent, action: T.accent, concept: T.accent };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={12} strokeWidth={2} color="var(--dim)" />
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--dim)', letterSpacing: 2.5, textTransform: 'uppercase' }}>For You</span>
        </div>
        <div onClick={generate} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', color: 'var(--accent, #D9A441)', cursor: 'pointer', fontWeight: 700 }}>
          <RefreshCw size={10} strokeWidth={2.5} /> Refresh
        </div>
      </div>
      {loading ? (
        <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
          <ThinkingDots color="var(--accent, #D9A441)" />
        </div>
      ) : (recos || []).length === 0 ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(2, 1fr)', gap: 8 }}>
          {(recos || []).map((r, i) => (
            <div key={i} onClick={() => setActiveModule(r.action || 'home')}
              style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = typeColors[r.type] + '55'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 'var(--fs-lg)'}}>{r.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: typeColors[r.type] || 'var(--accent)', background: withAlpha(typeColors[r.type] || T.accent, 9), padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{r.type}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>{r.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SIGNALS = [
  { emoji: '🏘', title: 'Small Multifamily in Transitioning Houston Zips', insight: 'Institutional buyers skip sub-10 unit buildings. AI-driven migration is quietly repricing these before anyone notices.', category: 'Real Estate', color: T.accent, urgency: 'HIGH' },
  { emoji: '🤖', title: 'AI-Augmented BD Professionals', insight: 'First movers who build systematic AI pipelines in BD will have a 10x edge within 18 months. Almost nobody is doing this yet.', category: 'Career Edge', color: T.accent, urgency: 'HIGH' },
  { emoji: '📈', title: 'Covered Calls on Dividend Stacks', insight: 'Systematic covered call writing on dividend portfolios adds 3–5% yield with no extra capital. Almost no retail investors act on it.', category: 'Finance', color: T.accent, urgency: 'MED' },
  { emoji: '⚡', title: 'ERCOT Ancillary Services', insight: 'Texas grid volatility = pricing opportunity in frequency regulation and demand response. Deeply underutilized by non-institutional players.', category: 'Energy/Macro', color: T.accent, urgency: 'MED' },
  { emoji: '🏥', title: 'Longevity Biomarkers Protocol', insight: "Attia's Zone 2 + VO₂Max + muscle mass trifecta: most people optimize none. The compounding return on health at 40+ is asymmetric.", category: 'Longevity', color: T.accent, urgency: 'HIGH' },
  { emoji: '🌐', title: 'Onshoring Infrastructure Play', insight: 'Data centers, chip fabs, and LNG terminals being built at scale. The construction supply chain is the overlooked moat.', category: 'Macro', color: T.accent, urgency: 'MED' },
];

const QUICK_MODULES = [
  { id: 'learn',    icon: '📚', label: 'Learn',    desc: 'Books, topics, courses',  color: T.accent },
  { id: 'research', icon: '🔭', label: 'Research',  desc: 'Truth-first analysis',   color: T.accent },
  { id: 'podcast',  icon: '🎙️', label: 'Podcasts',  desc: 'AI summaries + listen', color: T.accent },
  { id: 'projects', icon: '🚀', label: 'Projects',  desc: 'Track & ship',           color: T.accent },
  { id: 'vault',    icon: '🏛', label: 'Vault',     desc: 'Knowledge base',         color: T.accent },
  { id: 'growth',   icon: '📈', label: 'Growth',    desc: 'Goals & synthesis',      color: T.accent },
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
        fill="var(--accent-glow, rgba(217,164,65,0.12))"
        stroke="var(--accent, #D9A441)" strokeWidth="1.5" strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--accent, #D9A441)" />
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
  const color  = confidence >= 8 ? T.accent : confidence >= 5 ? 'var(--accent, #D9A441)' : T.accent;

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
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-base)', fontWeight: 800, color }}>
          {confidence}
        </div>
      </div>
      {label && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-c)', textAlign: 'center', maxWidth: size + 16, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {label}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, label, action, actionLabel, actionColor = 'var(--accent, #D9A441)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <span style={{ display: 'flex', alignItems: 'center', color: 'var(--dim)' }}>{icon}</span>}
        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--dim)', letterSpacing: 2.5, textTransform: 'uppercase' }}>{label}</span>
      </div>
      {action && actionLabel && (
        <div onClick={action} style={{ fontSize: 'var(--fs-sm)', color: actionColor, cursor: 'pointer', fontWeight: 700, letterSpacing: 0.2 }}>{actionLabel} →</div>
      )}
    </div>
  );
}

function SkillBar({ title, confidence = 5 }) {
  const pct   = Math.round((confidence / 10) * 100);
  const color = confidence >= 8 ? T.accent : confidence >= 5 ? 'var(--accent, #D9A441)' : T.accent;
  const tier  = confidence >= 8 ? 'Expert' : confidence >= 6 ? 'Proficient' : confidence >= 4 ? 'Learning' : 'Beginner';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--fs-sm)', color, fontWeight: 700, background: `${color}18`, padding: '1px 6px', borderRadius: 3, border: `1px solid ${color}30` }}>{tier}</span>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// Live signal feed — YouTube via the live adapter, other platforms manual.
// Every item is normalized (always tiered) before it renders here.
function LiveSignalFeed({ isMobile }) {
  const [feed,    setFeed]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setFeed(await getFeed({ limit: 8 })); }
    catch { setFeed([]); }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div style={{ marginBottom: isMobile ? 20 : 24, marginLeft: isMobile ? -14 : 0, marginRight: isMobile ? -14 : 0 }}>
      <div style={{ padding: isMobile ? '0 14px' : '0' }}>
        <SectionLabel icon={<Radio size={12} strokeWidth={2} />} label="Live Signal Feed" action={load} actionLabel="Refresh" />
      </div>
      {loading ? (
        <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center', margin: isMobile ? '0 14px' : 0 }}>
          <ThinkingDots color="var(--accent, #D9A441)" />
        </div>
      ) : feed.length === 0 ? (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px dashed var(--border)', fontSize: 'var(--fs-base)', color: 'var(--subtle)', lineHeight: 1.6, margin: isMobile ? '0 14px' : 0 }}>
          No live signals right now. YouTube videos appear here once <code style={{ color: 'var(--text-c)' }}>YOUTUBE_API_KEY</code> is set in Vercel — other platforms are curated manually.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10, padding: isMobile ? '0 14px' : 0 }}>
          {feed.map(s => {
            const meta   = PLATFORM_META[s.platform] || {};
            const tier   = TIER_META[s.tier] || TIER_META.unranked;
            const live   = s.status === 'live';
            const accent = meta.color || 'var(--accent, #D9A441)';
            return (
              <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textDecoration: 'none', padding: '13px 15px', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${accent}`, borderRadius: 10, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = `${accent}66`}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: 0.4 }}>{meta.icon} {meta.label || s.platform}</span>
                  <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tier.color, background: `${tier.color}18`, border: `1px solid ${tier.color}33`, padding: '1px 5px', borderRadius: 3 }}>{tier.label}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, letterSpacing: 1, color: live ? 'var(--green, #00CC76)' : 'var(--muted)' }}>
                    {live ? '● LIVE' : '○ MANUAL'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{s.source}</span>
                  <span>· {fmtCount(s.views)} views</span>
                  {s.relTime && <span>· {s.relTime}</span>}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SignalModal({ signal, onClose, setActiveModule, setChatPrefill, setChatOpen }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);
  const { isMobile, isPhone } = useApp();

  useEffect(() => {
    if (!signal) return;
    setContent(''); setError(false);
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prompt = `Tactical briefing for CB on this Blue Ocean signal:

**${signal.title}** (${signal.category})
Core insight: ${signal.insight}

CB context: Houston TX, BD professional, $10K+/mo passive income goal, real estate, dividends, ERCOT energy, longevity, AI-augmented BD.

Respond with exactly these four sections (use ## headers):

## Why This Matters Now
2-3 sentences on timing and why this is a Blue Ocean moment.

## How to Learn
3 specific bullets: books, courses, or frameworks to study.

## How to Develop
3 specific bullets: skills, assets, or relationships to build.

## CB's Play
3 concrete action bullets for 30 / 90 / 180 days.

Be direct and specific to CB's context. No vague advice.`;
      try {
        const reply = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 700 });
        if (!cancelled) { setContent(reply); }
      } catch { if (!cancelled) setError(true); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [signal]);

  if (!signal) return null;
  const Icon = CATEGORY_ICONS[signal.category];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: isPhone ? 'flex-end' : 'center', justifyContent: 'center', padding: isPhone ? 0 : '20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', border: `1px solid ${signal.color}30`, borderTop: `3px solid ${signal.color}`, borderRadius: isPhone ? '16px 16px 0 0' : 16, width: '100%', maxWidth: 680, maxHeight: isPhone ? '90vh' : '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--bord2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${signal.color}14`, border: `1px solid ${signal.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {Icon && <Icon size={15} strokeWidth={2} color={signal.color} />}
              </div>
              <SignalTag category={signal.category} color={signal.color} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UrgencyPill urgency={signal.urgency} color={signal.color} />
              <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)', outline: 'none' }}>
                <X size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: isMobile ? 'var(--fs-lg)' : 'var(--fs-xl)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, letterSpacing: -0.3, marginBottom: 8 }}>{signal.title}</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-c)', lineHeight: 1.6 }}>{signal.insight}</div>
        </div>

        {/* Deep dive content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0' }}>
              <ThinkingDots color={signal.color} />
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)' }}>Generating tactical briefing…</div>
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginBottom: 12 }}>Failed to generate — check API connection.</div>
              <button onClick={() => { setError(false); setContent(''); setLoading(false); }}
                style={{ fontSize: 'var(--fs-sm)', padding: '6px 14px', background: 'var(--accent-glow, rgba(217,164,65,0.08))', border: '1px solid rgba(217,164,65,0.3)', borderRadius: 7, color: 'var(--accent, #D9A441)', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
            </div>
          )}
          {content && <MD text={content} color={signal.color} />}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--bord2)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {[
            { label: 'Study Topic',  id: 'learn',    color: T.accent },
            { label: 'Research',     id: 'research',  color: T.accent },
            { label: 'Add Project',  id: 'projects',  color: T.accent },
          ].map(a => (
            <button key={a.id} onClick={() => { setActiveModule(a.id); onClose(); }}
              style={{ flex: 1, minWidth: 80, padding: '9px 12px', borderRadius: 8, background: `${a.color}12`, border: `1px solid ${a.color}25`, color: a.color, fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.2, outline: 'none' }}>
              {a.label}
            </button>
          ))}
          <button onClick={() => { setChatPrefill(`Deep dive: ${signal.title}. ${signal.insight} How do I take advantage of this given my goals?`); setChatOpen(true); onClose(); }}
            style={{ flex: 1, minWidth: 80, padding: '9px 12px', borderRadius: 8, background: 'var(--accent-glow, rgba(217,164,65,0.08))', border: '1px solid rgba(217,164,65,0.25)', color: 'var(--accent, #D9A441)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.2, outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            Ask AI <ArrowRight size={11} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const { graph, projects, notes, setActiveModule, setChatPrefill, setChatOpen, isMobile, isTablet, isPhone, isDesktop } = useApp();

  const [brief,          setBrief]          = useState('');
  const [briefLoading,   setBriefLoading]   = useState(false);
  const [briefDone,      setBriefDone]      = useState(false);
  const [briefError,     setBriefError]     = useState(false);
  const [onboarded,      setOnboarded]      = useState(() => !!localStorage.getItem(ONBOARDING_KEY));
  const [selectedSignal, setSelectedSignal] = useState(null);

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
          <SectionLabel icon={<Brain size={12} strokeWidth={2} />} label="Skill Mastery" action={() => setActiveModule('learn')} actionLabel="View all" />
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
          <SectionLabel icon={<Rocket size={12} strokeWidth={2} />} label="Active Projects" action={() => setActiveModule('projects')} actionLabel="All" actionColor={T.accent} />
          {activeProjects.slice(0, 4).map((p, idx) => {
            const done  = (p.milestones || []).filter(m => m.done).length;
            const total = (p.milestones || []).length;
            const pct   = total ? Math.round((done / total) * 100) : 0;
            const color = p.color || T.accent;
            return (
              <div key={p.id} onClick={() => setActiveModule('projects')} style={{ cursor: 'pointer', marginBottom: idx < activeProjects.slice(0, 4).length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{p.emoji || '🚀'} {p.title}</div>
                    {total > 0 && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{done}/{total} milestones done</div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 'var(--fs-base)', fontWeight: 800, color, paddingTop: 1 }}>{pct}%</div>
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
          <SectionLabel icon={<BookOpen size={12} strokeWidth={2} />} label="Continue Learning" action={() => setActiveModule('learn')} actionLabel="Open" />
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

      {/* Greeting — streak / time chips live in the header now (status, not
          content), so the dashboard opens straight into decision support. */}
      <div style={{ padding: `${pad} ${pad} 0`, marginBottom: isMobile ? 16 : 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 4 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>
          {greeting}, CB.
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginTop: 6 }}>
          {topics.length > 0 ? `${topics.length} topics tracked · ${activeProjects.length} projects active` : 'Your intelligence hub is ready.'}
        </div>
      </div>

      {/* Universal capture — type-and-go front door */}
      <div style={{ padding: `0 ${pad}` }}>
        <CaptureBar />
      </div>

      {/* Mobile: Continue Learning rings */}
      {isMobile && ringTopics.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ padding: `0 ${pad}` }}>
            <SectionLabel icon={<BookOpen size={12} strokeWidth={2} />} label="Continue Learning" action={() => setActiveModule('learn')} actionLabel="Learn" />
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

          {/* Spaced repetition — due today */}
          <DueReviews onQuiz={(label) => { setChatPrefill(`Quiz me on ${label} — I'm reviewing it today.`); setChatOpen(true); }} />


          {/* Recommendations */}
          <RecommendationsSection graph={graph} projects={projects} setActiveModule={setActiveModule} />

          {/* Daily Intelligence Brief */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: '3px solid var(--accent, #D9A441)',
            borderRadius: isMobile ? 0 : 14,
            overflow: 'hidden',
            marginBottom: isMobile ? 16 : 20,
            marginLeft: isMobile ? -14 : 0,
            marginRight: isMobile ? -14 : 0,
          }}>
            <div style={{ padding: isMobile ? '14px 16px 12px' : '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bord2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, rgba(217,164,65,0.15), rgba(217,164,65,0.15))', border: '1px solid rgba(217,164,65,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={15} strokeWidth={2} color={T.accent} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.2 }}>Daily Intelligence Brief</div>
                  <div style={{ fontSize: 9, color: 'var(--accent, #D9A441)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>CB-Style · Auto-Generated</div>
                </div>
              </div>
              {briefDone && (
                <button onClick={refreshBrief}
                  style={{ fontSize: 'var(--fs-sm)', padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--muted)', cursor: 'pointer', background: 'var(--bg)', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <RefreshCw size={10} strokeWidth={2.2} /> <span>Refresh</span>
                </button>
              )}
            </div>
            <div style={{ padding: isMobile ? '14px 16px 16px' : '16px 20px 18px' }}>
              {briefLoading && !brief && (
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', marginBottom: 12 }}>Generating intelligence brief…</div>
                  <ThinkingDots color="var(--accent, #D9A441)" />
                </div>
              )}
              {briefError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)' }}>Brief unavailable — check connection.</div>
                  <div onClick={() => generateBrief(null)} style={{ fontSize: 'var(--fs-sm)', padding: '5px 12px', background: 'var(--accent-glow)', border: '1px solid rgba(217,164,65,0.3)', borderRadius: 6, color: 'var(--accent, #D9A441)', cursor: 'pointer' }}>Retry</div>
                </div>
              )}
              {brief && <MD text={brief} color="var(--accent, #D9A441)" />}
            </div>
          </div>

          {/* Weekly / Monthly recaps — generated server-side by the recap Edge Functions */}
          <div style={{ marginBottom: isMobile ? 16 : 20, marginLeft: isMobile ? -14 : 0, marginRight: isMobile ? -14 : 0 }}>
            <RecapCard />
          </div>

          {/* Blue Ocean Signals — opportunity cards. Two-across on desktop,
              one on tablet and mobile; three-across is what read cramped. */}
          <div style={{ marginBottom: isMobile ? 20 : 24 }}>
            <SectionLabel icon={<Waves size={12} strokeWidth={2} />} label="Blue Ocean Signals" action={() => setActiveModule('research')} actionLabel="Research" actionColor={T.accent} />
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 'var(--s3)' }}>
              {SIGNALS.map((s, i) => (
                <div key={i} onClick={() => setSelectedSignal(s)} style={{ padding: 'var(--s5)', background: 'var(--surface)', border: `1px solid ${s.color}20`, borderTop: `3px solid ${s.color}`, borderRadius: 12, cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s', WebkitTapHighlightColor: 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${s.color}14`; e.currentTarget.style.borderColor = `${s.color}38`; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = `${s.color}20`; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <SignalTag category={s.category} color={s.color} />
                    <UrgencyPill urgency={s.urgency} color={s.color} />
                  </div>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', marginBottom: 8, lineHeight: 'var(--lh-tight)', letterSpacing: -0.2 }}>{s.title}</div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-c)', lineHeight: 'var(--lh-read)' }}>{s.insight}</div>
                  {/* Obvious tap affordance */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 'var(--fs-sm)', fontWeight: 700, color: s.color }}>
                    Open briefing <ArrowRight size={13} strokeWidth={2.5} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Signal Feed — YouTube live via adapter, others manual */}
          <LiveSignalFeed isMobile={isMobile} />

          {/* Mobile: quick access + projects */}
          {isMobile && (
            <>
              <div style={{ marginBottom: 20 }}>
                <SectionLabel icon={<Zap size={12} strokeWidth={2} />} label="Quick Access" />
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                  {QUICK_MODULES.map(m => (
                    <div key={m.id} onClick={() => setActiveModule(m.id)}
                      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${m.color}20`, borderRadius: 12, cursor: 'pointer', minWidth: 74, WebkitTapHighlightColor: 'transparent' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                        <NavIcon id={m.id} size={18} strokeWidth={1.8} />
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: m.color, whiteSpace: 'nowrap' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {activeProjects.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionLabel icon={<Rocket size={12} strokeWidth={2} />} label="Active Projects" action={() => setActiveModule('projects')} actionLabel="View all" actionColor={T.accent} />
                  {activeProjects.slice(0, 3).map(p => {
                    const done  = (p.milestones || []).filter(m => m.done).length;
                    const total = (p.milestones || []).length || 1;
                    const pct   = Math.round((done / total) * 100);
                    return (
                      <div key={p.id} onClick={() => setActiveModule('projects')}
                        style={{ padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${withAlpha(p.color || T.accent, 13)}`, borderRadius: 10, cursor: 'pointer', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{p.emoji} {p.title}</div>
                          <div style={{ fontSize: 'var(--fs-base)', color: p.color || T.accent, fontWeight: 700, flexShrink: 0 }}>{pct}%</div>
                        </div>
                        <div style={{ background: 'var(--border)', borderRadius: 2, height: 3 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: p.color || T.accent, borderRadius: 2 }} />
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
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)', marginBottom: 16, lineHeight: 1.7 }}>
                Your hub is fresh. Start anywhere — each module builds your intelligence graph.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[{ label: '📚 Start a Book', id: 'learn' }, { label: '🔭 Run Research', id: 'research' }, { label: '🎙️ Browse Podcasts', id: 'podcast' }].map(a => (
                  <div key={a.id} onClick={() => setActiveModule(a.id)}
                    style={{ padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-b)', cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center' }}>
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
          <SectionLabel icon={<Zap size={12} strokeWidth={2} />} label="Quick Access" />
          <div style={{ display: 'grid', gridTemplateColumns: isTablet ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 10 }}>
            {QUICK_MODULES.map(m => (
              <div key={m.id} onClick={() => setActiveModule(m.id)}
                style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${m.color}20`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${m.color}40`; e.currentTarget.style.boxShadow = `0 4px 16px ${m.color}10`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${m.color}20`; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                  <NavIcon id={m.id} size={17} strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal deep-dive modal */}
      {selectedSignal && (
        <SignalModal
          signal={selectedSignal}
          onClose={() => setSelectedSignal(null)}
          setActiveModule={setActiveModule}
          setChatPrefill={setChatPrefill}
          setChatOpen={setChatOpen}
        />
      )}
    </div>
  );
}
