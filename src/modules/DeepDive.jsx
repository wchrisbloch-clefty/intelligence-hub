import { useState, useEffect, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildDeepDiveSystem, depthNeedsWeb, extractSources, uid, timeAgo, DEPTH_META } from '../utils.js';
import { newDive, saveDive, addSection, loadIndex, hydrateIndex, loadDive, hydrateDive, removeDive, renameDive } from '../lib/deepdives.js';
import { stampVersion, isStale, versionLabel } from '../lib/promptVersion.js';
import { TIER_INSTRUCTION } from '../lib/rigor.js';
import { USER_GROUNDING_TYPES, groundingTypeMeta } from '../lib/sourceGrounding.js';
import SourceGrounding from './shared/SourceGrounding.jsx';
import { gradeTopic } from '../lib/reviews.js';
import { logConcept } from '../lib/graph.js';
import AskChip from './shared/AskChip.jsx';
import FollowButton from './shared/FollowButton.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';
import DiagramBlock from './shared/DiagramBlock.jsx';
import MD from './shared/MD.jsx';
import ProviderTag from './shared/ProviderTag.jsx';
import { GoingDeepBanner } from './shared/DepthControls.jsx';
import { SectionSkeleton, SectionError, SectionEmpty } from './shared/SectionState.jsx';
import MentalModelChip from './shared/MentalModelChip.jsx';
import Icon from './shared/Icon.jsx';
import './deep-dive.css';

const DEPTHS = ['deep', 'expert']; // a dive is always a heavy, sourced tier

export default function DeepDive() {
  const { captureRoute, clearCapture, openStudio } = useApp();
  const [view, setView]   = useState('home'); // home | view
  const [index, setIndex] = useState(() => loadIndex());
  const [dive, setDive]   = useState(null);

  const [topicInput, setTopicInput] = useState('');
  // Source material the user has that the model can't reach (excerpt / notes),
  // injected into every pass of this dive. Shared component, same as BookClub.
  const [userSrc, setUserSrc] = useState(null);
  const SRC_TYPES = USER_GROUNDING_TYPES.filter((t) => ['excerpt', 'notes'].includes(t.id));
  const [catInput, setCatInput]     = useState('');
  const [depth, setDepth]           = useState('expert');

  const [running, setRunning] = useState(false);
  const [stream, setStream]   = useState('');
  const [error, setError]     = useState('');
  const [angle, setAngle]     = useState('');
  const bottomRef = useRef(null);
  // The last pass's arguments, so the error state's Retry re-runs ONLY that pass.
  const lastPassRef = useRef(null);

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
    lastPassRef.current = { userMsg, title, kind, focus };
    setRunning(true); setStream(''); setError('');
    try {
      const system = buildDeepDiveSystem(targetDive.topic, targetDive.category, targetDive.depth, focus || null);
      let provider = '';
      const needsWeb = depthNeedsWeb(targetDive.depth);
      // Inject any source material the user supplied that the model can't reach.
      const gm = userSrc?.text ? groundingTypeMeta(userSrc.type) : null;
      const groundBlock = gm ? `\n\nSOURCE MATERIAL THE USER SUPPLIED FROM THEIR OWN COPY (${gm.label} — first-hand, tier ${gm.tier}; ground your analysis in this and cite it):\n${userSrc.text}\n` : '';
      const text = await callClaude({
        system,
        messages: [{ role: 'user', content: `${userMsg}${groundBlock}\n\n${TIER_INSTRUCTION}` }],
        searchEnabled: needsWeb,
        job: needsWeb ? 'web' : 'reason',
        maxTokens: 4096,
        onToken: (t) => setStream(s => s + t),
        onProvider: (p) => { provider = p; },
      });
      const section = { id: uid(), title, kind, content: text, sources: extractSources(text), provider, createdAt: Date.now() };
      // Stamp the prompt version so a dive built by an older prompt flags stale.
      const updated = addSection({ ...targetDive, ...stampVersion('deepDive') }, section);
      setDive(updated); refresh();
      // Feed into spaced repetition so the dive resurfaces and compounds.
      gradeTopic(`deepdive_${updated.id}`, 4, { topicLabel: updated.topic });
      // Each pass records the dive topic as a concept, with any sources it
      // pulled as refs — so a deep dive connects to everything on the subject.
      logConcept({ topic: updated.topic, source: updated.topic, module: 'deepdive', confidence: 6, refs: (section.sources || []).map(s => s.url || s).filter(Boolean).slice(0, 6) });
      return updated;
    } catch (e) {
      setError(`Research pass failed. ${e?.message || 'The AI providers were unavailable.'}`);
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

  const OVERVIEW_PASS = { userMsg: 'Produce the deep dive now, following the scaffold.', title: 'Overview', kind: 'overview' };
  const retryPass = () => { if (dive && !running) runPass(dive, lastPassRef.current || OVERVIEW_PASS); };

  // ── Home: create + list ─────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div className="dd dd-home">
        <div className="dd-eyebrow">Source-Grounded Research</div>
        <div className="dd-title">Deep Dive</div>
        <div className="dd-lede">A Deep Dive saves as a reopenable research file. Come back anytime and <strong>keep going</strong> — deepen a section, add an angle, or refresh the data. It compounds.</div>

        <div className="dd-builder">
          <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && build()}
            placeholder="What should I research? (e.g. US data-center power demand, GLP-1 market…)"
            aria-label="What should I research?"
            className="dd-input dd-input-topic" />
          <input value={catInput} onChange={e => setCatInput(e.target.value)}
            placeholder="Category (optional — inferred if blank)"
            aria-label="Category (optional)"
            className="dd-input dd-input-cat" />
          <div className="dd-depths">
            {DEPTHS.map(d => (
              <button type="button" key={d} onClick={() => setDepth(d)} className="dd-depth" aria-pressed={depth === d}>
                <span className="dd-depth-label">{DEPTH_META[d].label}</span>
                <span className="dd-depth-blurb">{DEPTH_META[d].blurb}</span>
              </button>
            ))}
          </div>
          <div className="dd-ground">
            <SourceGrounding value={userSrc} onSave={setUserSrc} onClear={() => setUserSrc(null)} types={SRC_TYPES}
              label="I have source material for this — paste it" />
          </div>
          <button type="button" onClick={build} disabled={!topicInput.trim() || running} className="btn btn-primary dd-build tap">
            <Icon name="Zap" aria-hidden="true" /> Build Deep Dive →
          </button>
          <div className="dd-hint">Pulls live sources and cites as it goes — takes longer than a quick answer.</div>
        </div>

        {index.length > 0 && (
          <>
            <div className="dd-eyebrow-quiet">Your Research Files</div>
            {index.map(d => (
              <div key={d.id} className="dd-file">
                <button type="button" className="dd-file-open" onClick={() => open(d.id)}>
                  <span className="dd-file-topic">{d.topic}</span>
                  <span className="dd-file-meta">
                    {DEPTH_META[d.depth]?.label || d.depth}{d.category ? ` · ${d.category}` : ''} · {d.progress} pass{d.progress === 1 ? '' : 'es'} · {timeAgo(d.updatedAt)}
                  </span>
                </button>
                <button type="button" onClick={e => del(d.id, e)} title="Delete" aria-label={`Delete ${d.topic}`} className="dd-file-del tap">🗑</button>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── Dive view ────────────────────────────────────────────────────────────
  if (!dive) { setView('home'); return null; }
  // Explicit section status for the dive's generated passes.
  const diveStatus = running ? 'loading' : error ? 'error' : dive.sections.length ? 'ready' : 'empty';
  return (
    <div className="dd dd-view">
      <div className="dd-top">
        <button type="button" onClick={() => setView('home')} className="dd-back tap">← Deep Dives</button>
        <div className="dd-tools">
          <button type="button" className="dd-tool tap" onClick={() => { const t = prompt('Rename dive', dive.topic); if (t && t.trim()) { renameDive(dive.id, t.trim()); setDive({ ...dive, topic: t.trim() }); refresh(); } }}>
            <Icon name="Pencil" aria-hidden="true" /> Rename</button>
          {openStudio && dive.sections.length > 0 && (
            <button type="button" className="dd-tool tap" data-accent onClick={() => openStudio({ kind: 'deepdive', id: dive.id, title: dive.topic })}>↗ Export</button>
          )}
        </div>
      </div>

      <div className="dd-titlerow">
        <div className="dd-title">{dive.topic}</div>
        <AskChip type="deepdive" object={dive} />
        <FollowButton name={dive.topic} source="deepdive" />
      </div>
      <div className="dd-meta">
        <span>{DEPTH_META[dive.depth]?.label || dive.depth}{dive.category ? ` · ${dive.category}` : ''} · {dive.sections.length} pass{dive.sections.length === 1 ? '' : 'es'} · certified: cited + confidence-flagged</span>
        {dive.promptVersion != null && <span>· {versionLabel(dive)}</span>}
        {isStale(dive, 'deepDive') && <span className="dd-stale">prompt updated → re-run a pass</span>}
      </div>

      {running && <div ref={bottomRef}><GoingDeepBanner depth={dive.depth} /></div>}

      <div data-status={diveStatus}>
      {/* Sections */}
      {dive.sections.map((s, i) => (
        <div key={s.id} className="dd-pass">
          <div className="dd-pass-head">
            <div className="dd-pass-label">Pass {i + 1} · {s.title}</div>
            <ProviderTag provider={s.provider} />
            <div className="dd-pass-notes">
              <SaveToNotes title={`${dive.topic} — ${s.title}`} content={s.content} source={{ title: dive.topic, tier: 'reported' }} label="Notes" />
            </div>
          </div>
          <MD text={s.content} color="var(--accent-text)" />
          <DiagramBlock
            content={s.content}
            hint={`Diagram the structure of this pass on "${dive.topic}".`}
            initialCode={s.diagram || ''}
            onGenerated={(code) => {
              // Persist the diagram onto its section so it saves + reloads with the dive.
              const next = { ...dive, sections: dive.sections.map((x) => (x.id === s.id ? { ...x, diagram: code } : x)) };
              setDive(next); saveDive(next);
            }}
            label="Visualize"
          />
        </div>
      ))}

      {running && stream && (
        <div className="dd-pass" data-live>
          <MD text={stream + '▍'} color="var(--accent-text)" />
        </div>
      )}
      {running && !stream && <SectionSkeleton rows={6} lead label="research pass" />}
      {diveStatus === 'error' && <SectionError label="this research pass" onRetry={retryPass} detail={error} />}
      {diveStatus === 'empty' && (
        <SectionEmpty what="No research passes yet" how="Run the overview pass to build this dive from live sources."
          actionLabel="Run overview pass" onAction={() => runPass(dive, OVERVIEW_PASS)} />
      )}
      </div>

      {/* On-demand mental-model reframe of the whole dive — nothing runs until tapped. */}
      {dive.sections.length > 0 && (
        <MentalModelChip title={dive.topic} disabled={running}
          body={dive.sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n')} />
      )}

      {/* Aggregated sources */}
      {dive.sources.length > 0 && (
        <div className="dd-sources">
          <div className="dd-eyebrow-quiet">Sources ({dive.sources.length})</div>
          {dive.sources.map((src, i) => (
            <div key={i} className="dd-source">[{i + 1}] {src}</div>
          ))}
        </div>
      )}

      {/* Keep going */}
      {!running && dive.sections.length > 0 && (
        <div className="dd-keep">
          <div className="dd-keep-kicker">Keep going</div>
          <div className="dd-keep-sub">Go deeper on a section:</div>
          <div className="dd-deepers">
            {dive.sections.map(s => (
              <button type="button" key={s.id} onClick={() => keepGoingDeeper(s.title)} className="dd-deeper tap">
                ↳ {s.title.length > 28 ? s.title.slice(0, 28) + '…' : s.title}
              </button>
            ))}
          </div>
          <div className="dd-angle">
            <input value={angle} onChange={e => setAngle(e.target.value)} onKeyDown={e => e.key === 'Enter' && keepGoingAngle()}
              placeholder="Add a new angle (e.g. regulatory risk in the EU)…" aria-label="Add a new angle"
              className="dd-input" />
            <button type="button" onClick={keepGoingAngle} disabled={!angle.trim()} className="btn btn-primary dd-add">Add</button>
          </div>
          <button type="button" onClick={keepGoingRefresh} className="dd-refresh tap">
            <Icon name="RefreshCw" aria-hidden="true" /> Refresh the data
          </button>
        </div>
      )}
    </div>
  );
}
