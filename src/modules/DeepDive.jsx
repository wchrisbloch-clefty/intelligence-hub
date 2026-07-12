import { useState, useEffect, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildDeepDiveSystem, depthNeedsWeb, extractSources, uid, timeAgo, DEPTH_META } from '../utils.js';
import { newDive, saveDive, addSection, loadIndex, hydrateIndex, loadDive, hydrateDive, removeDive, renameDive } from '../lib/deepdives.js';
import { gradeTopic } from '../lib/reviews.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import { GoingDeepBanner } from './shared/DepthControls.jsx';

const ACCENT = '#D9A441';
const DEPTHS = ['deep', 'expert']; // a dive is always a heavy, sourced tier

export default function DeepDive() {
  const { isMobile, captureRoute, clearCapture, openStudio } = useApp();
  const [view, setView]   = useState('home'); // home | view
  const [index, setIndex] = useState(() => loadIndex());
  const [dive, setDive]   = useState(null);

  const [topicInput, setTopicInput] = useState('');
  const [catInput, setCatInput]     = useState('');
  const [depth, setDepth]           = useState('expert');

  const [running, setRunning] = useState(false);
  const [stream, setStream]   = useState('');
  const [error, setError]     = useState('');
  const [angle, setAngle]     = useState('');
  const bottomRef = useRef(null);
  const pad = isMobile ? '14px' : '24px';

  useEffect(() => { hydrateIndex().then(r => { if (Array.isArray(r)) setIndex(r); }); }, []);
  useEffect(() => { if (running) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [stream, running]);

  // Consume a capture-bar route (D1) that targets Deep Dive.
  useEffect(() => {
    if (captureRoute?.route === 'deepdive') {
      setTopicInput(captureRoute.topic || '');
      setCatInput(captureRoute.suggestedCategory || '');
      if (captureRoute.suggestedDepth === 'deep') setDepth('deep');
      clearCapture?.();
    }
  }, [captureRoute, clearCapture]);

  const refresh = () => setIndex(loadIndex());

  const runPass = async (targetDive, { userMsg, title, kind, focus }) => {
    setRunning(true); setStream(''); setError('');
    try {
      const system = buildDeepDiveSystem(targetDive.topic, targetDive.category, targetDive.depth, focus || null);
      const text = await callClaude({
        system,
        messages: [{ role: 'user', content: userMsg }],
        searchEnabled: depthNeedsWeb(targetDive.depth),
        maxTokens: 4096,
        onToken: (t) => setStream(s => s + t),
      });
      const section = { id: uid(), title, kind, content: text, sources: extractSources(text), createdAt: Date.now() };
      const updated = addSection(targetDive, section);
      setDive(updated); refresh();
      // Feed into spaced repetition so the dive resurfaces and compounds.
      gradeTopic(`deepdive_${updated.id}`, 4, { topicLabel: updated.topic });
      return updated;
    } catch {
      setError('Research pass failed — try again.');
      return targetDive;
    } finally {
      setRunning(false); setStream('');
    }
  };

  const build = async () => {
    if (!topicInput.trim() || running) return;
    const d = newDive({ topic: topicInput.trim(), category: catInput.trim(), depth });
    saveDive(d); setDive(d); setView('view'); setTopicInput(''); setCatInput('');
    await runPass(d, { userMsg: 'Produce the deep dive now, following the scaffold.', title: 'Overview', kind: 'overview' });
  };

  const open = async (id) => {
    const local = loadDive(id);
    if (local) { setDive(local); setView('view'); }
    const remote = await hydrateDive(id);
    if (remote) setDive(remote);
  };

  const del = (id, e) => { e.stopPropagation(); setIndex(removeDive(id)); };

  const keepGoingDeeper = (sectionTitle) => runPass(dive, {
    userMsg: `Go deeper on "${sectionTitle}" for the "${dive.topic}" dive. Add new, sharper detail and fresh sources beyond what's already covered.`,
    title: `Deeper — ${sectionTitle}`, kind: 'deeper', focus: sectionTitle,
  });
  const keepGoingAngle = () => {
    if (!angle.trim()) return;
    const a = angle.trim(); setAngle('');
    return runPass(dive, { userMsg: `Add this angle to the "${dive.topic}" dive: ${a}.`, title: `Angle — ${a.slice(0, 40)}`, kind: 'angle', focus: a });
  };
  const keepGoingRefresh = () => runPass(dive, {
    userMsg: `Refresh the "${dive.topic}" dive with the most current data and recent developments. Note explicitly what has changed.`,
    title: 'Data refresh', kind: 'refresh', focus: 'Latest data and recent developments',
  });

  // ── Home: create + list ─────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: `20px ${pad} 60px` }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 6 }}>Source-Grounded Research</div>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5, marginBottom: 4 }}>Deep Dive</div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20 }}>A Deep Dive saves as a reopenable research file. Come back anytime and <strong style={{ color: 'var(--muted)' }}>keep going</strong> — deepen a section, add an angle, or refresh the data. It compounds.</div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && build()}
            placeholder="What should I research? (e.g. US data-center power demand, GLP-1 market…)"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', marginBottom: 10 }} />
          <input value={catInput} onChange={e => setCatInput(e.target.value)}
            placeholder="Category (optional — inferred if blank)"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: 'var(--text-b)', fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {DEPTHS.map(d => (
              <div key={d} onClick={() => setDepth(d)}
                style={{ flex: 1, padding: '8px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', border: `1px solid ${depth === d ? ACCENT : 'var(--border)'}`, background: depth === d ? 'var(--accent-glow)' : 'transparent' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: depth === d ? ACCENT : 'var(--text-b)' }}>{DEPTH_META[d].label}</div>
                <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{DEPTH_META[d].blurb}</div>
              </div>
            ))}
          </div>
          <button onClick={build} disabled={!topicInput.trim() || running}
            style={{ width: '100%', padding: '12px', background: topicInput.trim() && !running ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 9, color: topicInput.trim() && !running ? '#1A130A' : 'var(--dim)', fontSize: 13, fontWeight: 800, cursor: topicInput.trim() && !running ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            ⚡ Build Deep Dive →
          </button>
          <div style={{ fontSize: 9.5, color: 'var(--dim)', marginTop: 8, textAlign: 'center' }}>Pulls live sources and cites as it goes — takes longer than a quick answer.</div>
        </div>

        {index.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Your Research Files</div>
            {index.map(d => (
              <div key={d.id} onClick={() => open(d.id)}
                style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.topic}</div>
                    <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                      {DEPTH_META[d.depth]?.label || d.depth}{d.category ? ` · ${d.category}` : ''} · {d.progress} pass{d.progress === 1 ? '' : 'es'} · {timeAgo(d.updatedAt)}
                    </div>
                  </div>
                  <span onClick={e => del(d.id, e)} title="Delete" style={{ fontSize: 12, color: 'var(--red)', cursor: 'pointer', flexShrink: 0 }}>🗑</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── Dive view ────────────────────────────────────────────────────────────
  if (!dive) { setView('home'); return null; }
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: `20px ${pad} 60px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div onClick={() => setView('home')} style={{ fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 700 }}>← Deep Dives</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={() => { const t = prompt('Rename dive', dive.topic); if (t && t.trim()) { renameDive(dive.id, t.trim()); setDive({ ...dive, topic: t.trim() }); refresh(); } }}
            style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px' }}>✎ Rename</div>
          {openStudio && dive.sections.length > 0 && (
            <div onClick={() => openStudio({ kind: 'deepdive', id: dive.id, title: dive.topic })}
              style={{ fontSize: 11, color: ACCENT, cursor: 'pointer', border: `1px solid ${ACCENT}`, borderRadius: 7, padding: '4px 10px', fontWeight: 700 }}>↗ Export</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: isMobile ? 19 : 23, fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5 }}>{dive.topic}</div>
      <div style={{ fontSize: 11, color: 'var(--dim)', margin: '4px 0 18px' }}>
        {DEPTH_META[dive.depth]?.label || dive.depth}{dive.category ? ` · ${dive.category}` : ''} · {dive.sections.length} pass{dive.sections.length === 1 ? '' : 'es'} · certified: cited + confidence-flagged
      </div>

      {running && <div ref={bottomRef}><GoingDeepBanner depth={dive.depth} /></div>}

      {/* Sections */}
      {dive.sections.map((s, i) => (
        <div key={s.id} style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>Pass {i + 1} · {s.title}</div>
          <MD text={s.content} color={ACCENT} />
        </div>
      ))}

      {running && stream && (
        <div style={{ marginBottom: 16, background: 'var(--surface)', border: `1px solid ${ACCENT}`, borderRadius: 12, padding: '16px 18px' }}>
          <MD text={stream + '▍'} color={ACCENT} />
        </div>
      )}
      {running && !stream && <div style={{ padding: '10px 0' }}><ThinkingDots color={ACCENT} /></div>}
      {error && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}

      {/* Aggregated sources */}
      {dive.sources.length > 0 && (
        <div style={{ marginBottom: 16, background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Sources ({dive.sources.length})</div>
          {dive.sources.map((src, i) => (
            <div key={i} style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 3 }}>[{i + 1}] {src}</div>
          ))}
        </div>
      )}

      {/* Keep going */}
      {!running && dive.sections.length > 0 && (
        <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Keep going</div>
          <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 8 }}>Go deeper on a section:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {dive.sections.map(s => (
              <div key={s.id} onClick={() => keepGoingDeeper(s.title)}
                style={{ padding: '5px 11px', borderRadius: 16, border: '1px solid var(--border)', color: 'var(--text-b)', fontSize: 10.5, cursor: 'pointer' }}>
                ↳ {s.title.length > 28 ? s.title.slice(0, 28) + '…' : s.title}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={angle} onChange={e => setAngle(e.target.value)} onKeyDown={e => e.key === 'Enter' && keepGoingAngle()}
              placeholder="Add a new angle (e.g. regulatory risk in the EU)…"
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: 'var(--text-b)', fontFamily: 'inherit', outline: 'none' }} />
            <button onClick={keepGoingAngle} disabled={!angle.trim()}
              style={{ padding: '9px 14px', background: angle.trim() ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 8, color: angle.trim() ? '#1A130A' : 'var(--dim)', fontSize: 11, fontWeight: 700, cursor: angle.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Add</button>
          </div>
          <div onClick={keepGoingRefresh}
            style={{ padding: '9px 12px', textAlign: 'center', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-b)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            ⟳ Refresh the data
          </div>
        </div>
      )}
    </div>
  );
}
