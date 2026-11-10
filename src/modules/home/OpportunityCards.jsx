import { useState, useEffect } from 'react';
import { useApp } from '../../App.jsx';
import { readLocal, writeThrough, hydrate } from '../../lib/storage.js';
import { callClaude } from '../../utils.js';
import { SYSTEM_BASE } from '../../constants.js';
import { stampVersion, isStale, versionLabel } from '../../lib/promptVersion.js';
import {
  DOMAINS_KEY, SIGNALS_KEY, FEEDBACK_KEY, loadDomains, activeDomains,
  domainAdd, domainRename, domainSetThesis, domainSetWeight, domainArchive,
  buildSignalContext, buildSignalPrompt, parseSignals, signalTypeMeta, actionMeta,
} from '../../lib/signals.js';
import { TOPICS_KEY, loadTopics, unfollowTopic, isStaleTopic, daysSince } from '../../lib/topics.js';
import Icon from '../shared/Icon.jsx';
import { SectionSkeleton } from '../shared/SectionState.jsx';
import SignalCard from './SignalCard.jsx';

// Blue Ocean signals — personal, generated from the user's own context (graph,
// skills, projects, dismissals, domain theses). Cached + versioned so it reads
// like a weekly briefing, not a slot machine. Every signal states why it surfaced,
// is typed, tiered, actionable, and carries a pursue / not-now / not-relevant loop.
export default function OpportunityCards() {
  const { setChatPrefill, setChatOpen, applyRoute, setActiveModule } = useApp();
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
        system: SYSTEM_BASE,
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

  const status = loading && !signals.length ? 'loading' : err && !signals.length ? 'error' : signals.length ? 'ready' : 'empty';

  // ── Header: title + generate/refresh + customize ────────────────────────────
  const header = (
    <div className="op-head">
      <span className="op-version">
        {cache ? <>{versionLabel(cache)}{stale ? ' · prompt updated' : ''}</> : 'Not generated yet'}
      </span>
      <span className="op-actions">
        <button type="button" className="btn tap" aria-pressed={showDomains} onClick={() => setShowDomains((s) => !s)}>
          <Icon name="Settings2" size={14} /> Domains
        </button>
        <button type="button" className="btn btn-primary tap" onClick={generate} disabled={loading} aria-busy={loading ? 'true' : undefined}>
          {loading ? 'Scanning…' : <><Icon name="RefreshCw" size={14} /> {signals.length ? 'Refresh' : 'Generate'} signals</>}
        </button>
      </span>
    </div>
  );

  // ── Domain manager ──────────────────────────────────────────────────────────
  const domainPanel = showDomains && (
    <div className="op-domains">
      <div className="hm-eyebrow op-dom-eyebrow">Your domains — weight, thesis, archive</div>
      {activeDomains(domains).map((d) => (
        <div key={d.id} className="op-dom">
          <div className="op-dom-row">
            <input className="op-input op-input-title" aria-label="Domain name" value={d.title}
              onChange={(e) => persistDomains(domainRename(domains, d.id, e.target.value))} />
            <span className="op-weights" role="group" aria-label={`Weight for ${d.title}`}>
              {[1, 2, 3, 4, 5].map((w) => (
                <button type="button" key={w} className="op-weight tap" data-on={w <= d.weight ? '1' : '0'}
                  onClick={() => persistDomains(domainSetWeight(domains, d.id, w))} title={`Weight ${w}`} aria-label={`Weight ${w}`} />
              ))}
            </span>
            <button type="button" className="hm-link op-quiet tap" onClick={() => persistDomains(domainArchive(domains, d.id, true))}>Archive</button>
          </div>
          <input className="op-input" aria-label={`Thesis for ${d.title}`} value={d.thesis}
            placeholder="Optional: where you think this is going (your thesis)…"
            onChange={(e) => persistDomains(domainSetThesis(domains, d.id, e.target.value))} />
        </div>
      ))}
      <div className="op-add">
        <input className="op-input" aria-label="Add a domain" value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newDomain.trim()) { persistDomains(domainAdd(domains, newDomain)); setNewDomain(''); } }}
          placeholder="Add a domain…" />
        <button type="button" className="btn tap" onClick={() => { if (newDomain.trim()) { persistDomains(domainAdd(domains, newDomain)); setNewDomain(''); } }}>Add</button>
      </div>

      {/* Followed topics — narrower current interests, followed from anywhere.
          Surface last-activity and prompt on stale ones; a stale list is worse
          than none. */}
      {topics.length > 0 && (
        <div className="op-topics">
          <div className="hm-eyebrow op-dom-eyebrow">Followed topics</div>
          {topics.map((t) => {
            const stale = isStaleTopic(t);
            return (
              <div key={t.id} className="op-topic">
                <span className="op-topic-name">{t.name}</span>
                <span className="op-topic-age" data-stale={stale ? '1' : '0'}>
                  {stale ? `no activity in ${daysSince(t.lastActivity || t.followedAt)}d — still following?` : `active ${daysSince(t.lastActivity || t.followedAt)}d ago`}
                </span>
                <button type="button" className="hm-link op-quiet tap" onClick={() => unfollow(t.name)}>Unfollow</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div data-status={status}>
      {header}
      {domainPanel}
      {err && <div className="hm-err" role="alert">{err}</div>}

      {/* Honest empty / thin-graph state — never fabricate personalization. */}
      {status === 'empty' && (
        <div className="op-empty">
          <Icon name="Waves" size={24} />
          <div className="op-empty-text">
            {ctx.thin
              ? <>Signals get sharper as the graph fills — <b>{ctx.conceptCount} concept{ctx.conceptCount === 1 ? '' : 's'} tracked so far</b>. Generate now for a first pass, or keep learning and the signals grow more personal.</>
              : <>Generate your Blue Ocean signals from what you’ve actually been tracking across {ctx.conceptCount} concepts, your skills, projects, and domains.</>}
          </div>
        </div>
      )}

      {status === 'loading' && <SectionSkeleton rows={4} label="signals" />}

      {signals.length > 0 && (
        <div className="op-grid">
          {signals.map((s) => (
            <SignalCard key={s.id} signal={s} verdict={feedback[s.title]} onAct={act} onAsk={ask} onVerdict={setVerdict} />
          ))}
        </div>
      )}
    </div>
  );
}
