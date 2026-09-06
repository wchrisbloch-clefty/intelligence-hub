import { useState, useEffect } from 'react';
import { useApp } from '../../App.jsx';
import { readLocal, writeThrough, hydrate } from '../../lib/storage.js';
import { callClaude } from '../../utils.js';
import { CB_IDENTITY } from '../../constants.js';
import { stampVersion, isStale, versionLabel } from '../../lib/promptVersion.js';
import {
  DOMAINS_KEY, SIGNALS_KEY, FEEDBACK_KEY, loadDomains, activeDomains,
  domainAdd, domainRename, domainSetThesis, domainSetWeight, domainArchive,
  buildSignalContext, buildSignalPrompt, parseSignals, signalTypeMeta, actionMeta,
} from '../../lib/signals.js';
import { TOPICS_KEY, loadTopics, unfollowTopic, isStaleTopic, daysSince } from '../../lib/topics.js';
import Icon from '../shared/Icon.jsx';
import { ThinkingDots } from '../shared/Common.jsx';
import SignalCard from './SignalCard.jsx';

// Blue Ocean signals — personal, generated from the user's own context (graph,
// skills, projects, dismissals, domain theses). Cached + versioned so it reads
// like a weekly briefing, not a slot machine. Every signal states why it surfaced,
// is typed, tiered, actionable, and carries a pursue / not-now / not-relevant loop.
export default function OpportunityCards() {
  const { isDesktop, setChatPrefill, setChatOpen, applyRoute, setActiveModule } = useApp();
  const [cache, setCache] = useState(() => readLocal(SIGNALS_KEY, null));
  const [domains, setDomains] = useState(() => loadDomains());
  const [feedback, setFeedback] = useState(() => readLocal(FEEDBACK_KEY, {}));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showDomains, setShowDomains] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [topics, setTopics] = useState(() => loadTopics());

  useEffect(() => {
    (async () => {
      const [rs, rd, rf, rt] = await Promise.all([hydrate(SIGNALS_KEY), hydrate(DOMAINS_KEY), hydrate(FEEDBACK_KEY), hydrate(TOPICS_KEY)]);
      if (rs && typeof rs === 'object') setCache(rs);
      if (Array.isArray(rd) && rd.length) setDomains(rd);
      if (rf && typeof rf === 'object') setFeedback(rf);
      if (Array.isArray(rt)) setTopics(rt);
    })();
  }, []);

  // Followed topics are written by FollowButtons across the app — re-read the
  // store whenever the panel opens so the list is current.
  useEffect(() => { if (showDomains) setTopics(loadTopics()); }, [showDomains]);
  const unfollow = async (name) => {
    const prev = topics; const next = unfollowTopic(prev, name);
    setTopics(next);
    const r = await writeThrough(TOPICS_KEY, next);
    if (!r.localOk) setTopics(prev);
  };

  const persistDomains = async (next) => {
    const prev = domains; setDomains(next);
    const r = await writeThrough(DOMAINS_KEY, next);
    if (!r.localOk) setDomains(prev);
  };
  const persistFeedback = async (next) => {
    const prev = feedback; setFeedback(next);
    const r = await writeThrough(FEEDBACK_KEY, next);
    if (!r.localOk) setFeedback(prev);
  };

  const ctx = buildSignalContext(domains);

  const generate = async () => {
    if (loading) return;
    setLoading(true); setErr('');
    try {
      const raw = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: buildSignalPrompt(ctx.text, domains) }],
        // Market/current-condition claims need live grounding; TIER_INSTRUCTION
        // (in the prompt) then tiers each by what came back.
        job: 'web', searchEnabled: true, maxTokens: 1800,
      });
      const signals = parseSignals(raw);
      if (!signals.length) { setErr('No signals came back — try again.'); setLoading(false); return; }
      const next = { signals, ...stampVersion('signals'), contextConcepts: ctx.conceptCount };
      setCache(next);
      const r = await writeThrough(SIGNALS_KEY, next);
      if (!r.localOk) setErr('Signals generated but couldn’t be saved on-device.');
    } catch (e) {
      setErr(`Couldn’t generate signals. ${e?.message || 'Providers unavailable.'}`);
    }
    setLoading(false);
  };

  const setVerdict = (sig, verdict) => {
    const cur = feedback[sig.title];
    persistFeedback({ ...feedback, [sig.title]: cur === verdict ? undefined : verdict });
  };

  // Route a signal's next action into the platform.
  const act = (sig) => {
    const { kind, target } = sig.action;
    const m = actionMeta(kind);
    if (kind === 'book') { setActiveModule('books'); applyRoute?.({ route: 'book', topic: target, title: target }); return; }
    if (m.route) applyRoute?.({ route: m.route, topic: target, title: target, suggestedDepth: kind === 'deepdive' ? 'deep' : undefined });
    else setActiveModule('home');
  };
  const ask = (sig) => { setChatPrefill(`Signal (${signalTypeMeta(sig.type).label}): "${sig.title}". Why it surfaced: ${sig.reason}\n\nGiven my goals and context, what's the decisive first move?`); setChatOpen(true); };

  const signals = cache?.signals || [];
  const stale = cache && isStale(cache, 'signals');

  // ── Header: title + generate/refresh + customize ────────────────────────────
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 'var(--s3)', flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
        {cache ? <>{versionLabel(cache)}{stale ? ' · prompt updated' : ''}</> : 'Not generated yet'}
      </span>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        <button onClick={() => setShowDomains((s) => !s)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
          <Icon name="Settings2" size={14} /> Domains
        </button>
        <button onClick={generate} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: 'none', background: loading ? 'var(--surf2)' : 'var(--accent)', color: loading ? 'var(--dim)' : 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
          {loading ? <><ThinkingDots color="var(--accent)" /> Scanning…</> : <><Icon name="RefreshCw" size={14} /> {signals.length ? 'Refresh' : 'Generate'} signals</>}
        </button>
      </span>
    </div>
  );

  // ── Domain manager ──────────────────────────────────────────────────────────
  const domainPanel = showDomains && (
    <div style={{ marginBottom: 'var(--s3)', padding: 'var(--s4)', border: '1px solid var(--rule)', borderRadius: 12, background: 'var(--surface)' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>Your domains — weight, thesis, archive</div>
      {activeDomains(domains).map((d) => (
        <div key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input value={d.title} onChange={(e) => persistDomains(domainRename(domains, d.id, e.target.value))}
              style={{ flex: 1, minWidth: 120, background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 7, padding: '5px 9px', color: 'var(--text)', fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((w) => (
                <button key={w} onClick={() => persistDomains(domainSetWeight(domains, d.id, w))} title={`Weight ${w}`}
                  style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${w <= d.weight ? 'var(--accent)' : 'var(--rule)'}`, background: w <= d.weight ? 'var(--accent)' : 'transparent', cursor: 'pointer', padding: 0 }} />
              ))}
            </span>
            <button onClick={() => persistDomains(domainArchive(domains, d.id, true))} title="Archive"
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Archive</button>
          </div>
          <input value={d.thesis} placeholder="Optional: where you think this is going (your thesis)…"
            onChange={(e) => persistDomains(domainSetThesis(domains, d.id, e.target.value))}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 7, padding: '5px 9px', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', outline: 'none' }} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newDomain.trim()) { persistDomains(domainAdd(domains, newDomain)); setNewDomain(''); } }}
          placeholder="Add a domain…"
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 7, padding: '6px 10px', color: 'var(--text)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={() => { if (newDomain.trim()) { persistDomains(domainAdd(domains, newDomain)); setNewDomain(''); } }}
          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
      </div>

      {/* Followed topics — narrower current interests, followed from anywhere.
          Surface last-activity and prompt on stale ones; a stale list is worse
          than none. */}
      {topics.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Followed topics</div>
          {topics.map((t) => {
            const stale = isStaleTopic(t);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 100 }}>{t.name}</span>
                <span style={{ fontSize: 'var(--fs-sm)', color: stale ? 'var(--caution)' : 'var(--text-tertiary)' }}>
                  {stale ? `no activity in ${daysSince(t.lastActivity || t.followedAt)}d — still following?` : `active ${daysSince(t.lastActivity || t.followedAt)}d ago`}
                </span>
                <button onClick={() => unfollow(t.name)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Unfollow</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {header}
      {domainPanel}
      {err && <div style={{ marginBottom: 'var(--s3)', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--negative)', borderRadius: 10, color: 'var(--negative)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>⚠ {err}</div>}

      {/* Honest empty / thin-graph state — never fabricate personalization. */}
      {!signals.length && !loading && (
        <div style={{ padding: 'var(--s5)', border: '1px dashed var(--rule)', borderRadius: 12, background: 'var(--surface)', textAlign: 'center' }}>
          <Icon name="Waves" size={24} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 'var(--lh-read)' }}>
            {ctx.thin
              ? <>Signals get sharper as the graph fills — <b>{ctx.conceptCount} concept{ctx.conceptCount === 1 ? '' : 's'} tracked so far</b>. Generate now for a first pass, or keep learning and the signals grow more personal.</>
              : <>Generate your Blue Ocean signals from what you’ve actually been tracking across {ctx.conceptCount} concepts, your skills, projects, and domains.</>}
          </div>
        </div>
      )}

      {loading && !signals.length && <div style={{ padding: 'var(--s5)', textAlign: 'center' }}><ThinkingDots color="var(--accent)" /></div>}

      {signals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 'var(--s3)' }}>
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} verdict={feedback[s.title]} onAct={act} onAsk={ask} onVerdict={setVerdict} />
          ))}
        </div>
      )}
    </div>
  );
}
