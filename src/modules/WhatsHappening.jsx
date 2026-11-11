import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../App.jsx';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { logConcept } from '../lib/graph.js';
import { askPrefill } from '../lib/askContext.js';
import { getFeed, relTime } from '../lib/adapters.js';
import Icon from './shared/Icon.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';
import FollowButton from './shared/FollowButton.jsx';
import PageWithRail from './shared/PageWithRail.jsx';
import { SectionEmpty } from './shared/SectionState.jsx';
import './whats-happening.css';

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
  const { setChatPrefill, setChatOpen, applyRoute } = useApp();
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

  // Curated items render on first paint and stay put; live items APPEND when the
  // fetch resolves. Prepending them (and a "Loading feed…" row above the list)
  // shoved every visible card down on arrival — CLS 0.09–0.12 at iPad, caught by
  // the responsive gate (Batch Z-2).
  const allItems = useMemo(() => [...CURATED, ...live], [live]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(sources.map((s) => s.category)))], [sources]);

  // Newest-first WITHIN each group; the live group follows the curated group so a
  // late-arriving fetch never reorders what's already on screen.
  const liveIds = useMemo(() => new Set(live.map((x) => x.id)), [live]);
  const visibleItems = allItems
    .filter((it) => !dismissed.includes(it.id))
    .filter((it) => filter === 'All' || it.category === filter)
    .sort((a, b) => (liveIds.has(a.id) - liveIds.has(b.id)) || (b.at - a.at));

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
  const ask = (it) => { logConcept({ topic: it.title.slice(0, 60), source: it.source, module: 'feed' }); setChatPrefill(askPrefill('feed', it)); setChatOpen(true); };
  const dismiss = (it) => {
    persistDismissed([...dismissed, it.id]);
    // Record lightweight meta so Blue Ocean signal generation can treat dismissals
    // as negative signal (title/category), not just an opaque id count. Additive —
    // the id array above still drives feed filtering.
    try {
      const meta = readLocal('aether_feed_dismissed_meta', []) || [];
      writeThrough('aether_feed_dismissed_meta', [...meta, { id: it.id, title: it.title, category: it.category, at: Date.now() }].slice(-40));
    } catch {}
  };

  const addSource = () => { const n = newSource.trim(); if (!n) return; persistSources([...sources, { id: 'src_' + Date.now().toString(36), name: n, category: filter === 'All' ? 'General' : filter, enabled: true }]); setNewSource(''); };
  const toggleSource = (id) => persistSources(sources.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const removeSource = (id) => persistSources(sources.filter((s) => s.id !== id));
  const followDiscovery = (d) => persistSources([...sources, { id: 'src_' + Date.now().toString(36), name: d.suggest, category: d.category, enabled: true }]);

  const compact = density === 'compact';

  const rail = (
    <>
      <section className="wh-rail-sec">
        <h2 className="wh-eyebrow">Trending Now</h2>
        <ol className="wh-trend">
          {trending.map(([src, n], i) => (
            <li key={src}>
              <span className="wh-trend-rank">{i + 1}</span>
              <span className="wh-trend-src">{src}</span>
              <span className="wh-trend-n">{n}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="wh-rail-sec">
        <h2 className="wh-eyebrow">Today's Topics</h2>
        <div className="wh-topics">
          {topics.map(([cat, n]) => (
            <button key={cat} type="button" className="chip wh-topic tap" aria-pressed={filter === cat} onClick={() => setFilter(cat)}>
              {cat} <span className="wh-topic-n">{n}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <div className="wh">
      {/* Header */}
      <header className="wh-head">
        <div className="wh-head-text">
          <div className="wh-kicker">What Changed</div>
          <h1 className="wh-title">What's Happening</h1>
        </div>
        <span className="wh-status">
          <span className="wh-dot" data-live={live.length ? '1' : '0'} aria-hidden="true" />
          {visibleItems.length} items · {live.length ? 'live' : 'cached'}
        </span>
      </header>

      {/* Lens */}
      <div className="wh-lens" role="group" aria-label="Lens">
        <span className="wh-eyebrow">Lens</span>
        {[['work', 'Work'], ['personal', 'Personal'], ['both', 'Both']].map(([id, label]) => (
          <button key={id} type="button" className="wh-seg tap" aria-pressed={lens === id} onClick={() => setLens(id)}>{label}</button>
        ))}
      </div>

      {err && (
        <div className="wh-err" role="alert"><Icon name="AlertTriangle" size={14} /> {err}</div>
      )}

      {/* Discovery panel */}
      {DISCOVERY.length > 0 && (
        <section className="wh-panel" aria-label="Discovery">
          <div className="wh-panel-head">
            <Icon name="Sparkles" size={16} />
            <h2 className="wh-eyebrow">Discovery · You may be missing this</h2>
          </div>
          <div className="wh-disc-grid">
            {DISCOVERY.map((d) => (
              <div key={d.id} className="wh-disc">
                <div className="wh-disc-title">{d.title}</div>
                <div className="wh-disc-foot">
                  <span className="wh-disc-meta">{d.outlets} outlets covering · you follow {sources.filter((s) => s.category === d.category && s.enabled).length}</span>
                  <button type="button" className="wh-link tap" onClick={() => followDiscovery(d)}><Icon name="Plus" size={13} /> Add {d.suggest}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter chips + density + manage */}
      <div className="wh-bar" data-scroll-x>
        {categories.map((c) => (
          <button key={c} type="button" className="chip wh-chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>
        ))}
        <div className="wh-bar-spacer" />
        <button type="button" className="wh-tool" onClick={() => persistDensity(compact ? 'comfortable' : 'compact')} title="Density">
          <Icon name={compact ? 'Rows3' : 'Rows2'} size={14} /> {compact ? 'Compact' : 'Comfortable'}
        </button>
        <button type="button" className="wh-tool" aria-expanded={manageOpen} onClick={() => setManageOpen((o) => !o)}>
          <Icon name="Settings2" size={14} /> Sources
        </button>
      </div>

      {/* Sources manager */}
      {manageOpen && (
        <section className="wh-panel" aria-label="Sources">
          <div className="wh-add">
            <input className="wh-input" value={newSource} onChange={(e) => setNewSource(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSource()} placeholder="Add a source…" aria-label="Add a source" />
            <button type="button" className="btn btn-primary" onClick={addSource}>Add</button>
          </div>
          <div className="wh-srcs">
            {sources.map((s) => (
              <span key={s.id} className="wh-src" data-on={s.enabled ? '1' : '0'}>
                <button type="button" className="wh-icon-btn tap" aria-pressed={s.enabled} onClick={() => toggleSource(s.id)} title={s.enabled ? 'Disable' : 'Enable'} aria-label={`${s.enabled ? 'Disable' : 'Enable'} ${s.name}`}><Icon name={s.enabled ? 'Check' : 'Circle'} size={13} /></button>
                <span className="wh-src-name">{s.name}</span>
                <span className="wh-src-cat">{s.category}</span>
                <button type="button" className="wh-icon-btn tap" onClick={() => removeSource(s.id)} title="Remove" aria-label={`Remove ${s.name}`}><Icon name="X" size={13} /></button>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Body: feed + rail. PageWithRail: 340px sticky rail ≥1101, stacked below under it. */}
      <PageWithRail rail={rail} label="Trending and topics">
        {freshCount > 0 && (
          <div className="wh-fresh">{freshCount} new since your last visit</div>
        )}
        <div className="wh-list" data-density={density}>
          {visibleItems.map((it) => (
            <article key={it.id} className="wh-item" data-fresh={it.at > seenAt ? '1' : '0'}>
              {!compact && <div className="wh-mono" aria-hidden="true">{monogram(it.source)}</div>}
              <div className="wh-body">
                <div className="wh-tags">
                  <span className="wh-tier" style={{ '--tier': `var(--tier-${it.tier})` }}>{TIER_LABEL[it.tier] || it.tier}</span>
                </div>
                <a className="wh-headline" href={it.url || undefined} target={it.url ? '_blank' : undefined} rel="noopener noreferrer">
                  <div className="wh-headline-text">{it.title}</div>
                </a>
                <div className="wh-meta">
                  {it.source}{it.author ? ` · ${it.author}` : ''} · {relTime(it.at)}
                </div>
                {!compact && (
                  <div className="wh-actions">
                    <FeedAction icon="Microscope" label="Dive deeper" onClick={() => dive(it)} />
                    <FeedAction icon="Share2" label="Explore" onClick={() => explore(it)} />
                    <FeedAction icon="MessageSquare" label="Ask" onClick={() => ask(it)} />
                    <FollowButton name={it.title} source="feed" />
                    <SaveToNotes title={it.title} content={it.title} source={{ url: it.url, title: it.source, tier: it.tier }} label="Save" />
                    <FeedAction icon="X" label="Dismiss" onClick={() => dismiss(it)} muted />
                  </div>
                )}
              </div>
            </article>
          ))}
          {loading && <div aria-live="polite" data-status="loading" className="wh-loading">Loading live signals…</div>}
          {visibleItems.length === 0 && !loading && (
            <SectionEmpty what="Nothing in this view." how="Try another filter or add sources." />
          )}
        </div>
      </PageWithRail>
    </div>
  );
}

function FeedAction({ icon, label, onClick, muted }) {
  return (
    <button type="button" className="wh-act tap" data-muted={muted ? '1' : undefined} onClick={onClick}>
      <Icon name={icon} size={14} /> {label}
    </button>
  );
}
