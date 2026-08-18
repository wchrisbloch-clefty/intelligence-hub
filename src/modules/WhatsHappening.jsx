import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../App.jsx';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { logConcept } from '../lib/graph.js';
import { getFeed, relTime } from '../lib/adapters.js';
import Icon from './shared/Icon.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';

// "What's Happening" — the 7th container. One surface for what changed: a
// discovery panel (stories your sources missed), a tiered feed, trending, and
// user-managed sources. No news backend exists, so it ships a curated default
// set and layers live adapter signals on top; tier is the only grading mark
// (never derived from engagement), and kept/dived items feed the graph.
const SOURCES_KEY   = 'aether_sources_v1';
const DISMISS_KEY   = 'aether_feed_dismissed';
const SEEN_KEY      = 'aether_feed_seen';
const DENSITY_KEY   = 'aether_feed_density';

const DEFAULT_SOURCES = [
  { id: 'src_wsj',    name: 'WSJ',            category: 'Finance',    enabled: true },
  { id: 'src_bbg',    name: 'Bloomberg',      category: 'Finance',    enabled: true },
  { id: 'src_stratechery', name: 'Stratechery', category: 'Tech',     enabled: true },
  { id: 'src_ercot',  name: 'ERCOT',          category: 'Energy',     enabled: true },
  { id: 'src_attia',  name: 'Peter Attia',    category: 'Longevity',  enabled: true },
  { id: 'src_bp',     name: 'BiggerPockets',  category: 'Real Estate',enabled: true },
];

// Curated fallback feed — clearly labeled, tiered, tagged by category. Real
// adapter items (YouTube live, etc.) are prepended when available.
const CURATED = [
  { id: 'f1', source: 'Bloomberg', author: 'Odd Lots', title: 'Texas grid operators are quietly repricing ancillary services ahead of summer peak', tier: 'reported', category: 'Energy', url: '', at: Date.now() - 2 * 3600e3 },
  { id: 'f2', source: 'Stratechery', author: 'Ben Thompson', title: 'The BD moat is shifting from relationships to systematic AI pipelines', tier: 'inferred', category: 'Tech', url: '', at: Date.now() - 5 * 3600e3 },
  { id: 'f3', source: 'BiggerPockets', author: '', title: 'Sub-10-unit multifamily is the last inefficient corner institutions ignore', tier: 'reported', category: 'Real Estate', url: '', at: Date.now() - 9 * 3600e3 },
  { id: 'f4', source: 'Peter Attia', author: 'The Drive', title: 'VO₂max is the single strongest predictor of all-cause mortality after 40', tier: 'verified', category: 'Longevity', url: '', at: Date.now() - 26 * 3600e3 },
  { id: 'f5', source: 'WSJ', author: '', title: 'Onshoring capex is concentrating in three supply-chain chokepoints', tier: 'reported', category: 'Finance', url: '', at: Date.now() - 30 * 3600e3 },
];

// Discovery candidates — stories multiple outlets carried that the user's
// followed sources did not. Candidates only, never mixed into the feed.
const DISCOVERY = [
  { id: 'd1', title: 'Frequency-regulation markets are opening to smaller participants', outlets: 6, category: 'Energy', suggest: 'Utility Dive' },
  { id: 'd2', title: 'Covered-call ETFs are quietly outpacing dividend funds on total yield', outlets: 4, category: 'Finance', suggest: 'Morningstar' },
];

const TIER_LABEL = { verified: 'verified', reported: 'reported', inferred: 'inferred', uncited: 'uncited' };
const monogram = (name) => (name || '?').trim().charAt(0).toUpperCase();

export default function WhatsHappening() {
  const { isMobile, isPhone, isDesktop, setChatPrefill, setChatOpen, applyRoute } = useApp();
  const [lens, setLens] = useState('both');
  const [filter, setFilter] = useState('All');
  const [density, setDensity] = useState(() => readLocal(DENSITY_KEY, 'comfortable'));
  const [sources, setSources] = useState(() => readLocal(SOURCES_KEY, DEFAULT_SOURCES));
  const [dismissed, setDismissed] = useState(() => readLocal(DISMISS_KEY, []));
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [newSource, setNewSource] = useState('');
  const [seenAt] = useState(() => readLocal(SEEN_KEY, 0));
  const [err, setErr] = useState('');

  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';

  useEffect(() => { hydrate(SOURCES_KEY).then((r) => Array.isArray(r) && setSources(r)); }, []);
  useEffect(() => {
    (async () => {
      setLoading(true);
      let items = [];
      try {
        const f = await getFeed({ limit: 10 });
        items = (f || []).map((s) => ({ id: s.id, source: s.source, author: s.platform, title: s.title, tier: s.tier || 'reported', category: 'Tech', url: s.url, at: s.publishedAt ? new Date(s.publishedAt).getTime() : Date.now() }));
      } catch { /* offline → curated only */ }
      setLive(items);
      setLoading(false);
      // Stamp the watermark on view (returning users see the diff next time).
      // A background timestamp — nothing to revert — but awaited, not discarded.
      await writeThrough(SEEN_KEY, Date.now());
    })();
  }, []);

  // Optimistic + honest, mirroring BookClub's persist(): apply, await, and on a
  // failed on-device write revert and surface it. Server-only failures keep the
  // local write and show on the global sync chip (storage-honesty contract).
  const persistSources = async (next) => {
    const prev = sources;
    setSources(next);
    const r = await writeThrough(SOURCES_KEY, next);
    if (!r.localOk) { setSources(prev); setErr('Couldn’t save your sources — on-device storage is full or blocked.'); }
    else setErr('');
  };
  const persistDismissed = async (next) => {
    const prev = dismissed;
    setDismissed(next);
    const r = await writeThrough(DISMISS_KEY, next);
    if (!r.localOk) { setDismissed(prev); setErr('Couldn’t save that dismissal.'); }
    else setErr('');
  };
  const persistDensity = async (d) => {
    const prev = density;
    setDensity(d);
    const r = await writeThrough(DENSITY_KEY, d);
    if (!r.localOk) { setDensity(prev); setErr('Couldn’t save the density setting.'); }
    else setErr('');
  };

  const allItems = useMemo(() => [...live, ...CURATED], [live]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(sources.map((s) => s.category)))], [sources]);

  const visibleItems = allItems
    .filter((it) => !dismissed.includes(it.id))
    .filter((it) => filter === 'All' || it.category === filter)
    .sort((a, b) => b.at - a.at);

  const freshCount = visibleItems.filter((it) => it.at > seenAt).length;

  // Trending + topics rollups from the visible feed.
  const trending = useMemo(() => {
    const counts = {};
    for (const it of visibleItems) counts[it.source] = (counts[it.source] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [visibleItems]);
  const topics = useMemo(() => {
    const counts = {};
    for (const it of visibleItems) counts[it.category] = (counts[it.category] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [visibleItems]);

  // Item actions
  const dive = (it) => { logConcept({ topic: it.title.slice(0, 60), source: it.source, module: 'feed' }); applyRoute?.({ route: 'deepdive', topic: it.title }); };
  const explore = (it) => { setChatPrefill(`Explore what connects to: "${it.title}" (${it.category}). Pull the related concepts from my knowledge graph and show me the threads.`); setChatOpen(true); };
  const ask = (it) => { logConcept({ topic: it.title.slice(0, 60), source: it.source, module: 'feed' }); setChatPrefill(`From ${it.source}: "${it.title}". What does this mean for me, and what's the decisive move?`); setChatOpen(true); };
  const dismiss = (it) => persistDismissed([...dismissed, it.id]);

  const addSource = () => { const n = newSource.trim(); if (!n) return; persistSources([...sources, { id: 'src_' + Date.now().toString(36), name: n, category: filter === 'All' ? 'General' : filter, enabled: true }]); setNewSource(''); };
  const toggleSource = (id) => persistSources(sources.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const removeSource = (id) => persistSources(sources.filter((s) => s.id !== id));
  const followDiscovery = (d) => persistSources([...sources, { id: 'src_' + Date.now().toString(36), name: d.suggest, category: d.category, enabled: true }]);

  const compact = density === 'compact';

  const rail = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Trending Now</div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trending.map(([src, n], i) => (
            <li key={src} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-tertiary)', width: 16 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{n}</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Today's Topics</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {topics.map(([cat, n]) => (
            <button key={cat} onClick={() => setFilter(cat)} style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}>{cat} <span style={{ color: 'var(--text-tertiary)' }}>{n}</span></button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: `20px ${pad} 80px` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>What Changed</div>
          <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>What's Happening</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: live.length ? 'var(--positive)' : 'var(--text-tertiary)' }} />
            {visibleItems.length} items · {live.length ? 'live' : 'cached'}
          </span>
        </div>
      </div>

      {/* Lens */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Lens</span>
        {[['work', 'Work'], ['personal', 'Personal'], ['both', 'Both']].map(([id, label]) => {
          const on = lens === id;
          return <button key={id} onClick={() => setLens(id)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`, background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>{label}</button>;
        })}
      </div>

      {err && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--negative) 40%, transparent)', background: 'color-mix(in srgb, var(--negative) 10%, transparent)', color: 'var(--negative)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>⚠ {err}</div>
      )}

      {/* Discovery panel */}
      {DISCOVERY.length > 0 && (
        <div style={{ border: '1px solid var(--rule)', borderRadius: 12, padding: '14px 16px', marginBottom: 18, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="Sparkles" size={16} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' }}>Discovery · You may be missing this</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            {DISCOVERY.map((d) => (
              <div key={d.id} style={{ padding: '12px 14px', border: '1px solid var(--rule)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)' }}>{d.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{d.outlets} outlets covering · you follow {sources.filter((s) => s.category === d.category && s.enabled).length}</span>
                  <button onClick={() => followDiscovery(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}><Icon name="Plus" size={13} /> Add {d.suggest}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter chips + density + manage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map((c) => {
          const on = filter === c;
          return <button key={c} onClick={() => setFilter(c)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`, background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 34 }}>{c}</button>;
        })}
        <div style={{ flex: 1 }} />
        <button onClick={() => persistDensity(compact ? 'comfortable' : 'compact')} title="Density"
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Icon name={compact ? 'Rows3' : 'Rows2'} size={14} /> {compact ? 'Compact' : 'Comfortable'}
        </button>
        <button onClick={() => setManageOpen((o) => !o)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Icon name="Settings2" size={14} /> Sources
        </button>
      </div>

      {/* Sources manager */}
      {manageOpen && (
        <div style={{ border: '1px solid var(--rule)', borderRadius: 12, padding: '14px 16px', marginBottom: 18, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={newSource} onChange={(e) => setNewSource(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSource()} placeholder="Add a source…"
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 'var(--fs-sm)', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={addSource} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sources.map((s) => (
              <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--rule)', background: s.enabled ? 'var(--bg)' : 'transparent', opacity: s.enabled ? 1 : 0.5 }}>
                <button onClick={() => toggleSource(s.id)} title={s.enabled ? 'Disable' : 'Enable'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: s.enabled ? 'var(--accent)' : 'var(--text-tertiary)' }}><Icon name={s.enabled ? 'Check' : 'Circle'} size={13} /></button>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{s.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.category}</span>
                <button onClick={() => removeSource(s.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)' }}><Icon name="X" size={13} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Body: feed + rail */}
      <div style={{ display: isDesktop ? 'grid' : 'block', gridTemplateColumns: isDesktop ? 'minmax(0,1fr) 280px' : undefined, gap: 28, alignItems: 'start' }}>
        <div>
          {freshCount > 0 && (
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>{freshCount} new since your last visit</div>
          )}
          {loading && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: '12px 0' }}>Loading feed…</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
            {visibleItems.map((it) => {
              const fresh = it.at > seenAt;
              return (
                <article key={it.id} style={{ display: 'flex', gap: 12, padding: compact ? '10px 12px' : '14px 16px', border: '1px solid var(--rule)', borderLeft: fresh ? '2px solid var(--accent)' : '1px solid var(--rule)', borderRadius: 10, background: 'var(--surface)' }}>
                  {!compact && (
                    <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>{monogram(it.source)}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: `var(--tier-${it.tier})`, border: `1px solid color-mix(in srgb, var(--tier-${it.tier}) 40%, transparent)`, padding: '1px 6px', borderRadius: 3 }}>{TIER_LABEL[it.tier] || it.tier}</span>
                    </div>
                    <a href={it.url || undefined} target={it.url ? '_blank' : undefined} rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)', marginBottom: 6 }}>{it.title}</div>
                    </a>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: compact ? 0 : 10 }}>
                      {it.source}{it.author ? ` · ${it.author}` : ''} · {relTime(it.at)}
                    </div>
                    {!compact && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <FeedAction icon="Microscope" label="Dive deeper" onClick={() => dive(it)} />
                        <FeedAction icon="Share2" label="Explore" onClick={() => explore(it)} />
                        <FeedAction icon="MessageSquare" label="Ask" onClick={() => ask(it)} />
                        <SaveToNotes title={it.title} content={it.title} source={{ url: it.url, title: it.source, tier: it.tier }} label="Save" style={{ padding: '5px 10px' }} />
                        <FeedAction icon="X" label="Dismiss" onClick={() => dismiss(it)} muted />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {visibleItems.length === 0 && !loading && (
              <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--rule)', borderRadius: 12, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Nothing in this view. Try another filter or add sources.</div>
            )}
          </div>
        </div>

        {/* Right rail (desktop) / below feed (mobile) */}
        {isDesktop ? rail : <div style={{ marginTop: 28 }}>{rail}</div>}
      </div>
    </div>
  );
}

function FeedAction({ icon, label, onClick, muted }) {
  return (
    <button onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: muted ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}
