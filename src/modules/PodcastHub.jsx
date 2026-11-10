import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, fetchPodcastRSS, fmtDuration, fmtPodDate, saveNotes, uid } from '../utils.js';
import { SYSTEM_BASE } from '../constants.js';
import { TIER_INSTRUCTION } from '../lib/rigor.js';
import { USER_GROUNDING_TYPES, groundingTypeMeta } from '../lib/sourceGrounding.js';
import SourceGrounding from './shared/SourceGrounding.jsx';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import { SectionSkeleton, SectionError } from './shared/SectionState.jsx';
import Icon from './shared/Icon.jsx';
import './podcast-hub.css';

const SRC_TYPES = USER_GROUNDING_TYPES.filter((t) => ['excerpt', 'notes'].includes(t.id));

const PODCAST_FEEDS = [
  { name: 'Joe Rogan Experience', host: 'Joe Rogan',         url: 'https://feeds.megaphone.fm/GLT1412515089',   emoji: '🟢' },
  { name: 'Ben Shapiro Show',     host: 'Ben Shapiro',       url: 'https://feeds.megaphone.fm/BVDWV5370667266', emoji: '🔵' },
  { name: 'Tucker Carlson Show',  host: 'Tucker Carlson',    url: 'https://feeds.megaphone.fm/RSV1597324942',   emoji: '🦅' },
  { name: 'Candace',              host: 'Candace Owens',     url: 'https://feeds.megaphone.fm/candace',         emoji: '🎤' },
  { name: 'Morning Wire',         host: 'Daily Wire',        url: 'https://feeds.megaphone.fm/BVDWV8747925072', emoji: '☀️' },
  { name: 'All-In Podcast',       host: 'Chamath & Besties', url: 'https://allinchamathjason.libsyn.com/rss',   emoji: '💰' },
  { name: 'Flagrant',             host: 'Andrew Schulz',     url: 'https://feeds.megaphone.fm/APPI6857213837',  emoji: '🔥' },
  { name: 'NPR Politics',         host: 'NPR',               url: 'https://feeds.npr.org/510310/podcast.xml',   emoji: '📻' },
  { name: 'Marketplace',          host: 'APM',               url: 'https://feeds.publicradio.org/public_feeds/marketplace-pm/rss/rss', emoji: '📈' },
  { name: 'Freakonomics Radio',   host: 'Stephen Dubner',    url: 'https://feeds.simplecast.com/Y8lFbOT4',      emoji: '🎓' },
  { name: 'Masters of Scale',     host: 'Reid Hoffman',      url: 'https://feeds.simplecast.com/3NwB90JG',      emoji: '🚀' },
  { name: 'Acquired',             host: 'Ben & David',       url: 'https://feeds.simplecast.com/jeNJI0r9',      emoji: '💡' },
];

// ─── EPISODE CARD ────────────────────────────────────────────────────────────
function PodCard({ ep, idx, onSaveToVault }) {
  const [aiPanel, setAiPanel] = useState(''); // '' | 'summary' | 'takeaways' | 'transcript'
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCache, setAiCache] = useState({});
  // Failure as STATE, not content: 'Network error — try again.' used to be
  // cached as the mode's result (and so could be saved to the Vault).
  const [aiErr, setAiErr] = useState({}); // mode -> error message
  const [reading, setReading] = useState(false);
  const [vaulted, setVaulted] = useState(false);
  const [userSrc, setUserSrc] = useState(null); // real transcript / notes the user pasted
  const [ttsSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

  const getBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural'))
      || voices.find(v => v.lang.startsWith('en') && !v.localService)
      || voices.find(v => v.lang.startsWith('en'))
      || null;
  };

  const handleReadAloud = () => {
    if (!ttsSupported) return;
    if (reading || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setReading(false);
      return;
    }
    const text = `${ep.title}, from ${ep.show}. ${ep.desc || ''}`;
    const utt = new SpeechSynthesisUtterance(text);
    const voice = getBestVoice();
    if (voice) utt.voice = voice;
    utt.rate = 0.95;
    utt.onend = () => setReading(false);
    utt.onerror = () => setReading(false);
    window.speechSynthesis.speak(utt);
    setReading(true);
  };

  const handleAI = (mode) => {
    if (aiPanel === mode) { setAiPanel(''); return; }
    setAiPanel(mode);
    if (aiCache[mode]) return;
    genMode(mode);
  };
  const genMode = async (mode) => {
    setAiLoading(true);
    setAiErr(m => { const n = { ...m }; delete n[mode]; return n; });
    const prompts = {
      summary: `Summarize this podcast episode in 3-4 tight sentences for CB. Episode: "${ep.title}" from ${ep.show} (hosted by ${ep.host}). Description: ${ep.desc || 'Not available'}. Give the core message, key argument, and why it matters to CB's world (BD, investing, health, leadership).`,
      takeaways: `Extract 5 key takeaways from this podcast episode for CB. Format exactly as:\n1. **Point title** — one-sentence explanation with an example from the episode's own world\n2. **Point title** — one-sentence explanation with an example from the episode's own world\n(continue for all 5)\n\nEpisode: "${ep.title}" from ${ep.show}. Description: ${ep.desc || 'Not available'}`,
      transcript: `Based ONLY on the episode title and description, reconstruct what was LIKELY discussed. This is a reconstruction, not the transcript — say so, and tier the whole section [inferred]. Cover: main thesis, key arguments, notable frameworks, actionable insights for CB (BD professional, investor, Houston TX). Episode: "${ep.title}" from ${ep.show}. Description: ${ep.desc || 'Not available'}. 4-6 paragraphs; do not fabricate quotes.`,
    };
    try {
      // The RSS description is the metadata anchor; tier every claim so a
      // reconstruction never reads as verified fact. If the user pasted the real
      // transcript/notes, that becomes the authoritative ground (not a guess).
      const gm = userSrc?.text ? groundingTypeMeta(userSrc.type) : null;
      const userBlock = gm ? `\n\nACTUAL EPISODE MATERIAL THE USER SUPPLIED (${gm.label} — first-hand, tier ${gm.tier}; base your answer on THIS, not a reconstruction, and cite it):\n${userSrc.text}` : '';
      const result = await callClaude({
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: `${prompts[mode]}${userBlock}\n\n${TIER_INSTRUCTION}` }],
        maxTokens: mode === 'transcript' ? 1200 : 700,
      });
      setAiCache(c => ({ ...c, [mode]: result }));
    } catch (e) {
      setAiErr(m => ({ ...m, [mode]: e?.message || 'The AI providers were unavailable.' }));
    }
    setAiLoading(false);
  };

  // Explicit status of the open AI panel's generated brief. 'empty' has no
  // placeholder — opening a panel always starts its generation.
  const aiStatus = aiLoading && !aiCache[aiPanel] ? 'loading' : aiErr[aiPanel] ? 'error' : aiCache[aiPanel] ? 'ready' : 'empty';

  const aiTabs = [
    { id: 'summary',    label: 'Summary',    icon: 'Sparkles' },
    { id: 'takeaways',  label: 'Takeaways',  icon: 'ClipboardList' },
    { id: 'transcript', label: 'Deep Dive',  icon: 'FileText' },
  ];

  return (
    <div className="pod-card" data-open={aiPanel ? true : undefined}>
      {/* Header row */}
      <div className="pod-card-head">
        <div className="pod-card-n" aria-hidden="true">{idx + 1}</div>
        <div className="pod-card-main">
          <div className="pod-card-show">
            {ep.emoji} {ep.show}
          </div>
          {ep.link
            ? <a href={ep.link} target="_blank" rel="noopener noreferrer" className="pod-ep-title">{ep.title}</a>
            : <div className="pod-ep-title">{ep.title}</div>}
          <div className="pod-card-meta">
            {ep.pubDate && <span>{fmtPodDate(ep.pubDate)}</span>}
            {ep.duration && <span><Icon name="Clock" aria-hidden="true" /> {fmtDuration(ep.duration)}</span>}
          </div>
          {ep.desc && (
            <div className="pod-card-desc">
              {ep.desc}
            </div>
          )}
        </div>
      </div>

      {/* AI panel */}
      {aiPanel && (
        <div className="pod-panel">
          {/* AI tab selector */}
          <div className="pod-panel-tabs">
            {aiTabs.map(t => (
              <button type="button" key={t.id} onClick={() => handleAI(t.id)} className="pod-tog tap" data-size="xs" aria-pressed={aiPanel === t.id}>
                <Icon name={t.icon} aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>
          {/* Real source material the model can't reach — makes the "Deep Dive"
              a grounded read instead of a reconstruction. */}
          <div className="pod-panel-ground">
            <SourceGrounding value={userSrc} types={SRC_TYPES} label="I have the transcript / notes — paste to ground this"
              onSave={(v) => { setUserSrc(v); setAiCache({}); if (aiPanel) genMode(aiPanel); }}
              onClear={() => { setUserSrc(null); setAiCache({}); if (aiPanel) genMode(aiPanel); }} />
          </div>
          {/* AI content */}
          <div data-status={aiStatus} className="pod-out">
            <div className="pod-out-kicker">
              {aiPanel === 'summary' ? 'AI Summary' : aiPanel === 'takeaways' ? 'Key Takeaways' : 'Deep Dive Analysis'}
            </div>
            {aiStatus === 'loading'
              ? <SectionSkeleton rows={aiPanel === 'transcript' ? 6 : 3} label={aiPanel === 'summary' ? 'summary' : aiPanel === 'takeaways' ? 'takeaways' : 'deep dive'} />
              : aiStatus === 'error'
              ? <SectionError label={aiPanel === 'summary' ? 'the summary' : aiPanel === 'takeaways' ? 'the takeaways' : 'the deep dive'} onRetry={() => genMode(aiPanel)} detail={aiErr[aiPanel]} />
              : aiCache[aiPanel]
                ? <>
                    <MD text={aiCache[aiPanel]} color="var(--accent-text)" />
                    {!vaulted && (
                      <button type="button" onClick={() => { onSaveToVault(`[Podcast] ${ep.title}`, aiCache[aiPanel]); setVaulted(true); }} className="pod-vault tap">
                        <Icon name="Landmark" aria-hidden="true" /> Save to Vault
                      </button>
                    )}
                    {vaulted && <div className="pod-vaulted"><Icon name="Check" aria-hidden="true" /> Saved to Vault</div>}
                  </>
                : null
            }
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="pod-actions">
        {ep.link && (
          <button type="button" onClick={() => window.open(ep.link, '_blank')} className="btn btn-primary pod-listen tap">
            <Icon name="Play" aria-hidden="true" /> Listen
          </button>
        )}
        {aiTabs.map(t => (
          <button type="button" key={t.id} onClick={() => handleAI(t.id)} disabled={aiLoading && aiPanel === t.id && !aiCache[t.id]}
            className="pod-tog tap" aria-pressed={aiPanel === t.id}>
            <Icon name={t.icon} aria-hidden="true" /> {aiLoading && aiPanel === t.id && !aiCache[t.id] ? '…' : aiPanel === t.id ? 'Hide' : t.id === 'summary' ? 'Summary' : t.id === 'takeaways' ? 'Takeaways' : 'Deep Dive'}
          </button>
        ))}
        {ttsSupported && (
          <button type="button" onClick={handleReadAloud} className="pod-tog tap" aria-pressed={reading}>
            {reading
              ? <><span className="pod-wave" aria-hidden="true">
                  {[0,1,2,3,4].map(i => <span key={i} />)}
                </span> Stop</>
              : '🔊 Read Aloud'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN MODULE ─────────────────────────────────────────────────────────────
export default function PodcastHub() {
  const { notes, setNotes } = useApp();

  const saveToVault = async (title, content) => {
    const note = { id: uid(), title, content, tags: ['podcast'], connections: [], color: 'var(--accent-text)', createdAt: Date.now() };
    const updated = [note, ...notes];
    setNotes(updated);
    await saveNotes(updated);
  };
  const [podEps, setPodEps]         = useState({});
  const [podLoading, setPodLoading] = useState({});
  const [activePod, setActivePod]   = useState(null);
  const [initialized, setInitialized] = useState(false);

  // ─── Paste & Analyze state ─────────────────────────────────────────────
  const [pasteOpen, setPasteOpen]   = useState(false);
  const [pasteUrl, setPasteUrl]     = useState('');
  const [pasteText, setPasteText]   = useState('');
  const [pasteMode, setPasteMode]   = useState('');
  const [pasteResult, setPasteResult] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteErr, setPasteErr] = useState(''); // was written into pasteResult as content
  const [pasteReading, setPasteReading] = useState(false);
  const [pasteVaulted, setPasteVaulted] = useState(false);
  const [ttsGlobal] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

  const pasteHasContent = pasteUrl.trim() || pasteText.trim();
  // Explicit status of the paste-analysis artifact. 'empty' has no placeholder —
  // the Summary / Takeaways / Deep Dive buttons are the CTA.
  const pasteStatus = pasteLoading ? 'loading' : pasteErr ? 'error' : pasteResult ? 'ready' : 'empty';

  const handlePasteAI = async (mode) => {
    if (!pasteHasContent) return;
    if (pasteMode === mode) { setPasteMode(''); setPasteErr(''); return; }
    await runPaste(mode);
  };

  // The generation half of handlePasteAI (no toggle), so Retry re-runs ONLY it.
  const runPaste = async (mode) => {
    if (!pasteHasContent) return;
    setPasteMode(mode);
    setPasteResult('');
    setPasteErr('');
    setPasteLoading(true);
    const urlContext = pasteUrl.trim() ? `\nEpisode/Show URL: ${pasteUrl.trim()}` : '';
    const textContext = pasteText.trim() ? `\n\nContent:\n${pasteText.slice(0, 6000)}` : '';
    const prompts = {
      summary: `Summarize this podcast content in 3-4 tight, insight-packed sentences for CB. Give the core message, key argument, and why it matters to CB's world (BD, investing, health, leadership).${urlContext}${textContext}`,
      takeaways: `Extract 5 key takeaways from this podcast content for CB. Format as:\n1. **Point title** — one-sentence explanation with an example from the episode's own world\n2. **Point title** — one-sentence explanation\n(continue for 5 total)${urlContext}${textContext}`,
      deepdive: `Provide a comprehensive analysis of this podcast content for CB. Cover: main thesis, key arguments and evidence, frameworks mentioned, counterarguments, and concrete action items in the episode's own domain. Be specific, thorough, and decisive.${urlContext}${textContext}`,
    };
    try {
      const result = await callClaude({
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: `${prompts[mode]}\n\n${TIER_INSTRUCTION}` }],
        maxTokens: mode === 'deepdive' ? 1400 : 700,
      });
      setPasteResult(result);
    } catch (e) {
      setPasteErr(e?.message || 'The AI providers were unavailable.');
    }
    setPasteLoading(false);
  };

  const handlePasteReadAloud = () => {
    if (!ttsGlobal) return;
    if (pasteReading || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel(); setPasteReading(false); return;
    }
    const textToRead = pasteResult || pasteText;
    if (!textToRead.trim()) return;
    const utt = new SpeechSynthesisUtterance(textToRead.slice(0, 3000));
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith('en') && !v.localService) || voices.find(v => v.lang.startsWith('en')) || null;
    if (voice) utt.voice = voice;
    utt.rate = 0.95;
    utt.onend = () => setPasteReading(false);
    utt.onerror = () => setPasteReading(false);
    window.speechSynthesis.speak(utt);
    setPasteReading(true);
  };

  const loadPod = useCallback(async (pod) => {
    setPodLoading(l => ({ ...l, [pod.name]: true }));
    const items = await fetchPodcastRSS(pod.url);
    setPodEps(p => ({ ...p, [pod.name]: items }));
    setPodLoading(l => ({ ...l, [pod.name]: false }));
  }, []);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    PODCAST_FEEDS.forEach(p => loadPod(p));
  }, [initialized, loadPod]);

  const allEps = PODCAST_FEEDS
    .flatMap(p => (podEps[p.name] || []).slice(0, 4).map(e => ({ ...e, show: p.name, host: p.host, emoji: p.emoji })))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const displayEps = activePod
    ? (podEps[activePod.name] || []).map(e => ({ ...e, show: activePod.name, host: activePod.host, emoji: activePod.emoji }))
    : allEps;

  const anyLoading = Object.values(podLoading).some(Boolean);
  const hasAny     = allEps.length > 0;

  // ─── Sidebar / shows list ───────────────────────────────────────────────
  const ShowItem = ({ pod, isAll }) => {
    const isActive = isAll ? !activePod : activePod?.name === pod?.name;
    const eps = isAll ? [] : (podEps[pod.name] || []);
    const latest = eps[0];
    const loading = pod ? podLoading[pod.name] : false;
    return (
      <button type="button" onClick={() => setActivePod(isAll ? null : (isActive ? null : pod))} className="pod-show" aria-pressed={isActive}>
        <span className="pod-show-glyph" aria-hidden="true">{isAll ? '🎙️' : pod.emoji}</span>
        <span className="pod-show-main">
          <span className="pod-show-name">
            {isAll ? 'All Shows' : pod.name}
          </span>
          <span className="pod-show-sub">
            {isAll ? `${PODCAST_FEEDS.length} podcasts · latest first` : loading ? 'Loading…' : latest ? latest.title.slice(0, 38) + '…' : 'No episodes yet'}
          </span>
        </span>
        {isActive && <span className="pod-show-dot" />}
      </button>
    );
  };

  // ─── Mobile show pills ──────────────────────────────────────────────────
  const mobilePills = (
    <div className="pod-pills" data-scroll-x>
      {[null, ...PODCAST_FEEDS].map((pod, i) => {
        const isActive = pod === null ? !activePod : activePod?.name === pod.name;
        return (
          <button type="button" key={i} onClick={() => setActivePod(pod === null ? null : (isActive ? null : pod))}
            className="pod-pill tap" aria-pressed={isActive}>
            {pod === null ? '🎙️ All' : `${pod.emoji} ${pod.name}`}
          </button>
        );
      })}
    </div>
  );

  // ─── Header ────────────────────────────────────────────────────────────
  const header = (
    <div className="pod-head">
      <div className="pod-head-glyph" aria-hidden="true">{activePod ? activePod.emoji : '🎙️'}</div>
      <div className="pod-head-main">
        <div className="pod-head-eyebrow">Intelligence Hub · Podcast Feed</div>
        <div className="pod-head-title">
          {activePod ? activePod.name : 'All Podcasts'}
        </div>
        <div className="pod-head-sub">
          {activePod ? `Hosted by ${activePod.host}` : `${PODCAST_FEEDS.length} shows · AI summaries · read-aloud`}
        </div>
      </div>
      {anyLoading && (
        <div className="pod-head-loading">
          <div className="pod-head-dot" />
          Loading
        </div>
      )}
    </div>
  );

  // ─── Sidebar content ────────────────────────────────────────────────────
  const sidebar = (
    <div>
      <div className="pod-eyebrow">Shows</div>
      <ShowItem isAll />
      {PODCAST_FEEDS.map((p, i) => <ShowItem key={i} pod={p} />)}
      {hasAny && (
        <div className="pod-trending">
          <div className="pod-eyebrow">
            <Icon name="Flame" aria-hidden="true" /> Trending Now
          </div>
          {allEps.slice(0, 6).map((ep, i) => {
            const body = (
              <>
                <div className="pod-trend-n" aria-hidden="true">{i + 1}</div>
                <div className="pod-trend-main">
                  <div className="pod-trend-title">{ep.title}</div>
                  <div className="pod-trend-sub">{ep.show} · {fmtPodDate(ep.pubDate)}</div>
                </div>
              </>
            );
            return ep.link
              ? <a key={i} href={ep.link} target="_blank" rel="noopener noreferrer" className="pod-trend">{body}</a>
              : <div key={i} className="pod-trend">{body}</div>;
          })}
        </div>
      )}
    </div>
  );

  // ─── Episodes list ──────────────────────────────────────────────────────
  const episodesList = (
    <div>
      {displayEps.length === 0 && (
        <div className="pod-empty">
          {anyLoading
            ? <><div className="pod-empty-loading">Loading episodes from {PODCAST_FEEDS.length} shows…</div><ThinkingDots color="var(--accent-text)" /></>
            : <><div className="pod-empty-glyph" aria-hidden="true">🎙️</div><div className="pod-empty-what">No episodes loaded yet</div><div className="pod-empty-how">Episodes load in the background. Check back in a moment.</div></>
          }
        </div>
      )}
      <div className="pod-eps">
        {displayEps.slice(0, 25).map((ep, i) => (
          <PodCard key={`${ep.show}-${i}`} ep={ep} idx={i} onSaveToVault={saveToVault} />
        ))}
      </div>
    </div>
  );

  // ─── Layout ─────────────────────────────────────────────────────────────
  return (
    <div className="pod">
      {header}

      {/* ─── Paste & Analyze ──────────────────────────────────────────────── */}
      <div className="pod-paste">
        <button type="button" onClick={() => setPasteOpen(o => !o)} className="pod-paste-toggle" aria-expanded={pasteOpen}>
          <span className="pod-paste-glyph"><Icon name="ClipboardList" size="header" aria-hidden="true" /></span>
          <span className="pod-paste-main">
            <span className="pod-paste-title">Paste & Analyze</span>
            <span className="pod-paste-sub">Enter a podcast URL or paste transcript/show notes — get instant AI analysis</span>
          </span>
          <span className="pod-paste-chev"><Icon name="ChevronDown" aria-hidden="true" /></span>
        </button>

        {pasteOpen && (
          <div className="pod-paste-body">
            <input
              value={pasteUrl}
              onChange={e => { setPasteUrl(e.target.value); setPasteResult(''); setPasteMode(''); setPasteErr(''); }}
              placeholder="Podcast episode URL (optional) — e.g. https://podcasts.apple.com/… or Spotify link"
              aria-label="Podcast episode URL" className="pod-field"
            />
            <div className="pod-or">— or paste content directly —</div>
            <textarea
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setPasteResult(''); setPasteMode(''); setPasteErr(''); }}
              placeholder="Paste podcast transcript, episode description, show notes, or any text here..."
              rows={5}
              aria-label="Podcast transcript or notes" className="pod-field"
            />
            <div className="pod-paste-actions">
              {[
                { id: 'summary',   label: 'Summary',   icon: 'Sparkles' },
                { id: 'takeaways', label: 'Takeaways', icon: 'ClipboardList' },
                { id: 'deepdive',  label: 'Deep Dive', icon: 'FileText' },
              ].map(btn => (
                <button type="button" key={btn.id} onClick={() => handlePasteAI(btn.id)} disabled={!pasteHasContent || (pasteLoading && pasteMode !== btn.id)}
                  className="pod-tog tap" data-size="lg" aria-pressed={pasteMode === btn.id}>
                  <Icon name={btn.icon} aria-hidden="true" /> {pasteLoading && pasteMode === btn.id ? 'Analyzing…' : btn.label}
                </button>
              ))}
              {ttsGlobal && (
                <button type="button" onClick={handlePasteReadAloud} disabled={!pasteHasContent && !pasteResult}
                  className="pod-tog tap" data-size="lg" aria-pressed={pasteReading}>
                  {pasteReading ? '⏹ Stop' : '🔊 Read Aloud'}
                </button>
              )}
              {pasteHasContent && (
                <button type="button" onClick={() => { setPasteUrl(''); setPasteText(''); setPasteResult(''); setPasteMode(''); setPasteErr(''); }}
                  className="pod-tog pod-clear tap" data-size="clear">
                  Clear
                </button>
              )}
            </div>
            {(pasteLoading || pasteResult || pasteErr) && (
              <div data-status={pasteStatus} className="pod-out">
                <div className="pod-out-kicker">
                  {pasteMode === 'summary' ? 'AI Summary' : pasteMode === 'takeaways' ? 'Key Takeaways' : 'Deep Dive Analysis'}
                </div>
                {pasteStatus === 'loading' ? <SectionSkeleton rows={pasteMode === 'deepdive' ? 6 : 3} label="podcast analysis" />
                  : pasteStatus === 'error' ? <SectionError label="this analysis" onRetry={() => runPaste(pasteMode)} detail={pasteErr} /> : (
                  <>
                    <MD text={pasteResult} color="var(--accent-text)" />
                    {!pasteVaulted
                      ? <button type="button" onClick={() => { saveToVault(pasteUrl.trim() ? `[Podcast] ${pasteUrl.trim().slice(0, 60)}` : '[Podcast Notes] Paste Analysis', pasteResult); setPasteVaulted(true); }} className="pod-vault tap">
                          <Icon name="Landmark" aria-hidden="true" /> Save to Vault
                        </button>
                      : <div className="pod-vaulted"><Icon name="Check" aria-hidden="true" /> Saved to Vault</div>
                    }
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phone: show pills (hidden ≥721 in CSS) */}
      {mobilePills}

      {/* iPad/desktop: episodes + shows rail (rail hidden <721 in CSS) */}
      <div className="pod-layout">
        <div className="pod-main">{episodesList}</div>
        <div className="pod-side">
          {sidebar}
        </div>
      </div>
    </div>
  );
}
