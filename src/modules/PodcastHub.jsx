import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, fetchPodcastRSS, fmtDuration, fmtPodDate, saveNotes, uid } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT       = '#e11d48';
const ACCENT_BG    = 'rgba(225,29,72,0.07)';
const ACCENT_BORDER= 'rgba(225,29,72,0.18)';

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
  const [reading, setReading] = useState(false);
  const [vaulted, setVaulted] = useState(false);
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

  const handleAI = async (mode) => {
    if (aiPanel === mode) { setAiPanel(''); return; }
    setAiPanel(mode);
    if (aiCache[mode]) return;
    setAiLoading(true);
    const prompts = {
      summary: `Summarize this podcast episode in 3-4 tight sentences for CB. Episode: "${ep.title}" from ${ep.show} (hosted by ${ep.host}). Description: ${ep.desc || 'Not available'}. Give the core message, key argument, and why it matters to CB's world (BD, investing, health, leadership).`,
      takeaways: `Extract 5 key takeaways from this podcast episode for CB. Format exactly as:\n1. **Point title** — one-sentence explanation with CB application\n2. **Point title** — one-sentence explanation with CB application\n(continue for all 5)\n\nEpisode: "${ep.title}" from ${ep.show}. Description: ${ep.desc || 'Not available'}`,
      transcript: `Based on the episode title and description, reconstruct what was likely discussed in detail. Cover: main thesis, key arguments, notable quotes or frameworks, actionable insights for CB (BD professional, investor, Houston TX). Episode: "${ep.title}" from ${ep.show}. Description: ${ep.desc || 'Not available'}. Be specific and thorough — 4-6 paragraphs.`,
    };
    try {
      const result = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: prompts[mode] }],
        maxTokens: mode === 'transcript' ? 1200 : 700,
      });
      setAiCache(c => ({ ...c, [mode]: result }));
    } catch {
      setAiCache(c => ({ ...c, [mode]: 'Network error — try again.' }));
    }
    setAiLoading(false);
  };

  const aiTabs = [
    { id: 'summary',    label: '✦ Summary',    shortLabel: '✦' },
    { id: 'takeaways',  label: '📋 Takeaways', shortLabel: '📋' },
    { id: 'transcript', label: '📄 Deep Dive', shortLabel: '📄' },
  ];

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${aiPanel ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color 0.15s' }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--border)', minWidth: 28, lineHeight: 1, flexShrink: 0, fontFamily: "'Fraunces', serif" }}>{idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 3, letterSpacing: 0.3 }}>
            {ep.emoji} {ep.show}
          </div>
          <div
            onClick={() => ep.link && window.open(ep.link, '_blank')}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 5, cursor: ep.link ? 'pointer' : 'default', transition: 'color 0.1s' }}
            onMouseEnter={e => { if (ep.link) e.target.style.color = ACCENT; }}
            onMouseLeave={e => e.target.style.color = 'var(--text)'}
          >
            {ep.title}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ep.pubDate && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{fmtPodDate(ep.pubDate)}</span>}
            {ep.duration && <span style={{ fontSize: 10, color: 'var(--dim)' }}>⏱ {fmtDuration(ep.duration)}</span>}
          </div>
          {ep.desc && (
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, marginTop: 7, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
              {ep.desc}
            </div>
          )}
        </div>
      </div>

      {/* AI panel */}
      {aiPanel && (
        <div style={{ borderTop: `1px solid ${ACCENT_BORDER}`, paddingTop: 12, marginTop: 2, marginBottom: 10 }}>
          {/* AI tab selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {aiTabs.map(t => (
              <div key={t.id} onClick={() => handleAI(t.id)}
                style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: `1px solid ${aiPanel === t.id ? ACCENT : 'var(--border)'}`, color: aiPanel === t.id ? ACCENT : 'var(--subtle)', background: aiPanel === t.id ? ACCENT_BG : 'transparent', transition: 'all 0.12s' }}>
                {t.label}
              </div>
            ))}
          </div>
          {/* AI content */}
          <div style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>
              {aiPanel === 'summary' ? 'AI Summary' : aiPanel === 'takeaways' ? 'Key Takeaways' : 'Deep Dive Analysis'}
            </div>
            {aiLoading && !aiCache[aiPanel]
              ? <ThinkingDots color={ACCENT} />
              : aiCache[aiPanel]
                ? <>
                    <MD text={aiCache[aiPanel]} color={ACCENT} />
                    {!vaulted && (
                      <div onClick={() => { onSaveToVault(`[Podcast] ${ep.title}`, aiCache[aiPanel]); setVaulted(true); }}
                        style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#ffcc4410', border: '1px solid #ffcc4440', borderRadius: 7, fontSize: 10, fontWeight: 700, color: '#ffcc44', cursor: 'pointer' }}>
                        🏛 Save to Vault
                      </div>
                    )}
                    {vaulted && <div style={{ marginTop: 10, fontSize: 10, color: '#ffcc44' }}>✓ Saved to Vault</div>}
                  </>
                : null
            }
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: aiPanel ? 0 : 2 }}>
        {ep.link && (
          <button onClick={() => window.open(ep.link, '_blank')}
            style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, border: `1px solid ${ACCENT}`, borderRadius: 6, background: ACCENT, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.1s' }}
            onMouseEnter={e => e.target.style.opacity = '0.85'}
            onMouseLeave={e => e.target.style.opacity = '1'}>
            ▶ Listen
          </button>
        )}
        {aiTabs.map(t => (
          <button key={t.id} onClick={() => handleAI(t.id)} disabled={aiLoading && aiPanel === t.id && !aiCache[t.id]}
            style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, border: `1px solid ${aiPanel === t.id ? ACCENT : 'var(--border)'}`, borderRadius: 6, background: aiPanel === t.id ? ACCENT_BG : 'transparent', color: aiPanel === t.id ? ACCENT : 'var(--subtle)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
            {t.shortLabel} {aiLoading && aiPanel === t.id && !aiCache[t.id] ? '…' : aiPanel === t.id ? 'Hide' : t.id === 'summary' ? 'Summary' : t.id === 'takeaways' ? 'Takeaways' : 'Deep Dive'}
          </button>
        ))}
        {ttsSupported && (
          <button onClick={handleReadAloud}
            style={{ padding: '5px 12px', fontSize: 10, fontWeight: 600, border: `1px solid ${reading ? ACCENT : 'var(--border)'}`, borderRadius: 6, background: reading ? ACCENT_BG : 'transparent', color: reading ? ACCENT : 'var(--subtle)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.12s' }}>
            {reading
              ? <><span style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 10 }}>
                  {[0,1,2,3,4].map(i => <span key={i} style={{ width: 2, background: ACCENT, borderRadius: 1, animation: `bar${i % 3} 0.8s ${i * 0.12}s ease-in-out infinite`, height: [6,10,8,12,7][i] }} />)}
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
  const { isMobile, isTablet, notes, setNotes } = useApp();

  const saveToVault = async (title, content) => {
    const note = { id: uid(), title, content, tags: ['podcast'], connections: [], color: ACCENT, createdAt: Date.now() };
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
  const [pasteReading, setPasteReading] = useState(false);
  const [pasteVaulted, setPasteVaulted] = useState(false);
  const [ttsGlobal] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);

  const pasteHasContent = pasteUrl.trim() || pasteText.trim();

  const handlePasteAI = async (mode) => {
    if (!pasteHasContent) return;
    if (pasteMode === mode) { setPasteMode(''); return; }
    setPasteMode(mode);
    setPasteResult('');
    setPasteLoading(true);
    const urlContext = pasteUrl.trim() ? `\nEpisode/Show URL: ${pasteUrl.trim()}` : '';
    const textContext = pasteText.trim() ? `\n\nContent:\n${pasteText.slice(0, 6000)}` : '';
    const prompts = {
      summary: `Summarize this podcast content in 3-4 tight, insight-packed sentences for CB. Give the core message, key argument, and why it matters to CB's world (BD, investing, health, leadership).${urlContext}${textContext}`,
      takeaways: `Extract 5 key takeaways from this podcast content for CB. Format as:\n1. **Point title** — one-sentence explanation with CB application\n2. **Point title** — one-sentence explanation\n(continue for 5 total)${urlContext}${textContext}`,
      deepdive: `Provide a comprehensive analysis of this podcast content for CB. Cover: main thesis, key arguments and evidence, frameworks mentioned, counterarguments, and CB-specific action items (BD professional, investor, Houston TX). Be specific, thorough, and decisive.${urlContext}${textContext}`,
    };
    try {
      const result = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: prompts[mode] }],
        maxTokens: mode === 'deepdive' ? 1400 : 700,
      });
      setPasteResult(result);
    } catch {
      setPasteResult('Network error — try again.');
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
      <div onClick={() => setActivePod(isAll ? null : (isActive ? null : pod))}
        style={{ padding: '10px 12px', background: isActive ? ACCENT_BG : 'var(--surface)', border: `1px solid ${isActive ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s', marginBottom: 6 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{isAll ? '🎙️' : pod.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? ACCENT : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAll ? 'All Shows' : pod.name}
          </div>
          <div style={{ fontSize: 9, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isAll ? `${PODCAST_FEEDS.length} podcasts · latest first` : loading ? 'Loading…' : latest ? latest.title.slice(0, 38) + '…' : 'No episodes yet'}
          </div>
        </div>
        {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT, flexShrink: 0 }} />}
      </div>
    );
  };

  // ─── Mobile show pills ──────────────────────────────────────────────────
  const mobilePills = (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 16 }}>
      {[null, ...PODCAST_FEEDS].map((pod, i) => {
        const isActive = pod === null ? !activePod : activePod?.name === pod.name;
        return (
          <div key={i} onClick={() => setActivePod(pod === null ? null : (isActive ? null : pod))}
            style={{ flexShrink: 0, padding: '6px 12px', fontSize: 10, fontWeight: 600, borderRadius: 20, border: `1px solid ${isActive ? ACCENT : 'var(--border)'}`, background: isActive ? ACCENT_BG : 'var(--surface)', color: isActive ? ACCENT : 'var(--subtle)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
            {pod === null ? '🎙️ All' : `${pod.emoji} ${pod.name}`}
          </div>
        );
      })}
    </div>
  );

  // ─── Header ────────────────────────────────────────────────────────────
  const header = (
    <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #f43f5e)`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>{activePod ? activePod.emoji : '🎙️'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, letterSpacing: 4, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: 4 }}>Intelligence Hub · Podcast Feed</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
          {activePod ? activePod.name : 'All Podcasts'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
          {activePod ? `Hosted by ${activePod.host}` : `${PODCAST_FEEDS.length} shows · AI summaries · read-aloud`}
        </div>
      </div>
      {anyLoading && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.2s infinite ease-in-out' }} />
          Loading
        </div>
      )}
    </div>
  );

  // ─── Sidebar content ────────────────────────────────────────────────────
  const sidebar = (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>Shows</div>
      <ShowItem isAll />
      {PODCAST_FEEDS.map((p, i) => <ShowItem key={i} pod={p} />)}
      {hasAny && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            🔥 Trending Now
          </div>
          {allEps.slice(0, 6).map((ep, i) => (
            <div key={i} onClick={() => ep.link && window.open(ep.link, '_blank')}
              style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--bord2)', cursor: ep.link ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--border)', minWidth: 16, flexShrink: 0, fontFamily: "'Fraunces', serif" }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ep.title}</div>
                <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{ep.show} · {fmtPodDate(ep.pubDate)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Episodes list ──────────────────────────────────────────────────────
  const episodesList = (
    <div>
      {displayEps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          {anyLoading
            ? <><div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 16 }}>Loading episodes from {PODCAST_FEEDS.length} shows…</div><ThinkingDots color={ACCENT} /></>
            : <><div style={{ fontSize: 36, marginBottom: 12 }}>🎙️</div><div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>No episodes loaded yet</div><div style={{ fontSize: 11, color: 'var(--dim)' }}>Episodes load in the background. Check back in a moment.</div></>
          }
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayEps.slice(0, 25).map((ep, i) => (
          <PodCard key={`${ep.show}-${i}`} ep={ep} idx={i} onSaveToVault={saveToVault} />
        ))}
      </div>
    </div>
  );

  // ─── Layout ─────────────────────────────────────────────────────────────
  const padX = isMobile ? '16px' : '28px';

  return (
    <div style={{ padding: isMobile ? `16px 16px 80px` : `24px ${padX} 60px`, maxWidth: 1100, margin: '0 auto' }}>
      {/* TTS wave animation styles */}
      <style>{`
        @keyframes bar0{0%,100%{height:4px}50%{height:12px}}
        @keyframes bar1{0%,100%{height:8px}50%{height:4px}}
        @keyframes bar2{0%,100%{height:12px}50%{height:6px}}
      `}</style>

      {header}

      {/* ─── Paste & Analyze ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div
          onClick={() => setPasteOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'var(--surface)', border: `1px solid ${pasteOpen ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: pasteOpen ? '10px 10px 0 0' : 10, cursor: 'pointer', transition: 'all 0.15s' }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Paste & Analyze</div>
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>Enter a podcast URL or paste transcript/show notes — get instant AI analysis</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--subtle)', transition: 'transform 0.2s', transform: pasteOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
        </div>

        {pasteOpen && (
          <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px' }}>
            <input
              value={pasteUrl}
              onChange={e => { setPasteUrl(e.target.value); setPasteResult(''); setPasteMode(''); }}
              placeholder="Podcast episode URL (optional) — e.g. https://podcasts.apple.com/… or Spotify link"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }}
            />
            <div style={{ fontSize: 10, color: 'var(--dim)', textAlign: 'center', marginBottom: 10 }}>— or paste content directly —</div>
            <textarea
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setPasteResult(''); setPasteMode(''); }}
              placeholder="Paste podcast transcript, episode description, show notes, or any text here..."
              rows={5}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'summary',   label: '✦ Summary',    short: '✦' },
                { id: 'takeaways', label: '📋 Takeaways', short: '📋' },
                { id: 'deepdive',  label: '📄 Deep Dive', short: '📄' },
              ].map(btn => (
                <button key={btn.id} onClick={() => handlePasteAI(btn.id)} disabled={!pasteHasContent || (pasteLoading && pasteMode !== btn.id)}
                  style={{ padding: '6px 13px', fontSize: 11, fontWeight: 600, border: `1px solid ${pasteMode === btn.id ? ACCENT : 'var(--border)'}`, borderRadius: 7, background: pasteMode === btn.id ? ACCENT_BG : 'transparent', color: !pasteHasContent ? 'var(--dim)' : pasteMode === btn.id ? ACCENT : 'var(--subtle)', cursor: !pasteHasContent ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                  {pasteLoading && pasteMode === btn.id ? `${btn.short} Analyzing…` : btn.label}
                </button>
              ))}
              {ttsGlobal && (
                <button onClick={handlePasteReadAloud} disabled={!pasteHasContent && !pasteResult}
                  style={{ padding: '6px 13px', fontSize: 11, fontWeight: 600, border: `1px solid ${pasteReading ? ACCENT : 'var(--border)'}`, borderRadius: 7, background: pasteReading ? ACCENT_BG : 'transparent', color: (!pasteHasContent && !pasteResult) ? 'var(--dim)' : pasteReading ? ACCENT : 'var(--subtle)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                  {pasteReading ? '⏹ Stop' : '🔊 Read Aloud'}
                </button>
              )}
              {pasteHasContent && (
                <button onClick={() => { setPasteUrl(''); setPasteText(''); setPasteResult(''); setPasteMode(''); }}
                  style={{ padding: '6px 10px', fontSize: 10, border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
                  Clear
                </button>
              )}
            </div>
            {(pasteLoading || pasteResult) && (
              <div style={{ marginTop: 14, background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>
                  {pasteMode === 'summary' ? 'AI Summary' : pasteMode === 'takeaways' ? 'Key Takeaways' : 'Deep Dive Analysis'}
                </div>
                {pasteLoading ? <ThinkingDots color={ACCENT} /> : (
                  <>
                    <MD text={pasteResult} color={ACCENT} />
                    {!pasteVaulted
                      ? <div onClick={() => { saveToVault(pasteUrl.trim() ? `[Podcast] ${pasteUrl.trim().slice(0, 60)}` : '[Podcast Notes] Paste Analysis', pasteResult); setPasteVaulted(true); }}
                          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#ffcc4410', border: '1px solid #ffcc4440', borderRadius: 7, fontSize: 10, fontWeight: 700, color: '#ffcc44', cursor: 'pointer' }}>
                          🏛 Save to Vault
                        </div>
                      : <div style={{ marginTop: 10, fontSize: 10, color: '#ffcc44' }}>✓ Saved to Vault</div>
                    }
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: show pills */}
      {isMobile && mobilePills}

      {/* Desktop/Tablet: 2-col grid */}
      {!isMobile ? (
        <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 220px' : '1fr 268px', gap: 28 }}>
          <div>{episodesList}</div>
          <div style={{ position: 'sticky', top: 0, alignSelf: 'start', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {sidebar}
          </div>
        </div>
      ) : (
        episodesList
      )}
    </div>
  );
}
