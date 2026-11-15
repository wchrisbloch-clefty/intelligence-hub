import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../App.jsx';
import { callClaude, logSession, uid } from '../../utils.js';
import { SYSTEM_LEARNING } from '../../constants.js';
import { LADDERS, getLadder } from '../../data/ladders/index.js';
import { readLocal, writeThrough } from '../../lib/storage.js';
import { createCard } from '../../lib/reviews.js';
import { logConcept } from '../../lib/graph.js';
import { TIER_INSTRUCTION } from '../../lib/rigor.js';
import MD from '../shared/MD.jsx';
import Icon from '../shared/Icon.jsx';
import DiagramBlock from '../shared/DiagramBlock.jsx';
import { SectionSkeleton, SectionError } from '../shared/SectionState.jsx';
import './field-manual.css';

// Content packs live entirely in data files (src/data/ladders/*). This component
// is the engine — it must never special-case a specific ladder. Adding a ladder
// = adding one file + one import in data/ladders/index.js. Zero edits here.
// Styling lives in field-manual.css (fm-) — tokens only, no inline colour.
const LADDER_KEY = 'aether_academy_v1';
const FLASH_KEY  = 'aether_flashcards';
const STALE_DAYS = 90;

// ── Tiering — the Hub invariant: nothing renders un-tiered ───────────────────
// Each tier reads its --tier-* token (text + 1px border, never a filled chip).
const TIER = {
  verified: { label: 'Verified' },
  reported: { label: 'Reported' },
  inferred: { label: 'Inferred' },
};
const tierKey = (t) => (TIER[t] ? t : 'inferred'); // no tier → inferred, never blank

function TierChip({ tier }) {
  const k = tierKey(tier);
  return <span className="fm-tier" data-tier={k}>{TIER[k].label}</span>;
}

// ── Storage ──────────────────────────────────────────────────────────────────
// { [ladderId]: { levels: { [lid]: { bestScore, passed, quizTaken } },
//                 confirms: { [cid]: { status:'resolved', owner, resolvedAt } } } }
const loadState = () => readLocal(LADDER_KEY, {});

function confirmStatus(ladder, state, cid) {
  const override = state?.[ladder.id]?.confirms?.[cid]?.status;
  if (override) return override;
  return ladder.confirms.find((c) => c.id === cid)?.status || 'open';
}
function levelOpenConfirms(ladder, level, state) {
  const ids = [...new Set((level.blocks || []).filter((b) => b.confirm).map((b) => b.confirm))];
  return ids.filter((cid) => confirmStatus(ladder, state, cid) === 'open');
}
function levelProgress(state, ladderId, levelId) {
  return state?.[ladderId]?.levels?.[levelId] || { bestScore: 0, passed: false, quizTaken: false };
}
function levelStatus(ladder, level, state) {
  const p = levelProgress(state, ladder.id, level.id);
  if (!p.quizTaken) return 'not-started';
  if (p.bestScore < 80) return 'in-progress';
  return levelOpenConfirms(ladder, level, state).length === 0 ? 'field-ready' : 'passed';
}
function openConfirmCount(ladder, state) {
  return ladder.confirms.filter((c) => confirmStatus(ladder, state, c.id) === 'open').length;
}
function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ═════════════════════════════════════════════════════════════════════════════
export default function FieldManual() {
  const { graph, setGraph } = useApp();
  const [state, setState] = useState(loadState);
  const [view, setView]   = useState('shelf');          // shelf | ladder | level | field | ledger
  const [ladderId, setLadderId] = useState(null);
  const [levelId, setLevelId]   = useState(null);

  const ladder = ladderId ? getLadder(ladderId) : null;
  const level  = ladder && levelId ? ladder.levels.find((l) => l.id === levelId) : null;

  // Persist state (local optimistic + server write-through).
  const persist = (next) => { setState(next); writeThrough(LADDER_KEY, next); };
  const mutate  = (fn) => persist(fn(structuredClone(state)));

  const setLevelResult = (bestScore) => mutate((s) => {
    const L = (s[ladder.id] ||= { levels: {}, confirms: {} });
    const prev = L.levels[level.id] || { bestScore: 0 };
    L.levels[level.id] = { quizTaken: true, bestScore: Math.max(prev.bestScore || 0, bestScore), passed: Math.max(prev.bestScore || 0, bestScore) >= 80 };
    return s;
  });

  const resolveConfirm = (lid, cid, owner) => mutate((s) => {
    const L = (s[lid] ||= { levels: {}, confirms: {} });
    (L.confirms ||= {})[cid] = { status: 'resolved', owner: owner.trim(), resolvedAt: Date.now() };
    return s;
  });
  const reopenConfirm = (lid, cid) => mutate((s) => {
    const L = (s[lid] ||= { levels: {}, confirms: {} });
    (L.confirms ||= {})[cid] = { status: 'open', owner: '' };
    return s;
  });
  const resetLadder = (lid) => mutate((s) => { delete s[lid]; return s; });

  const go = (v, opts = {}) => {
    if (opts.ladderId !== undefined) setLadderId(opts.ladderId);
    if (opts.levelId !== undefined) setLevelId(opts.levelId);
    setView(v);
    window.scrollTo?.(0, 0);
  };

  if (view === 'field' && ladder)  return <FieldMode ladder={ladder} state={state} onExit={() => go('shelf')} />;
  if (view === 'ledger')           return <ConfirmLedger state={state} onResolve={resolveConfirm} onReopen={reopenConfirm} onExit={() => go(ladder ? 'ladder' : 'shelf')} />;
  if (view === 'level' && level)   return <LevelView ladder={ladder} level={level} state={state} graph={graph} setGraph={setGraph} onResult={setLevelResult} onBack={() => go('ladder')} onLedger={() => go('ledger')} />;
  if (view === 'ladder' && ladder) return <LadderView ladder={ladder} state={state} onOpen={(lid) => go('level', { levelId: lid })} onField={() => go('field')} onLedger={() => go('ledger')} onReset={resetLadder} onBack={() => go('shelf')} />;

  return <Shelf state={state} onOpen={(id) => go('ladder', { ladderId: id })} onField={(id) => go('field', { ladderId: id })} onLedger={(id) => { setLadderId(id); go('ledger'); }} />;
}

// ── Screen 1 · Shelf ─────────────────────────────────────────────────────────
function Shelf({ state, onOpen, onField, onLedger }) {
  return (
    <div className="fm-page" data-w="shelf">
      <div className="fm-lede">
        Field-ready manuals. Every claim is tiered; unverified claims are gated out of customer-facing use until you resolve them.
      </div>

      <div className="fm-shelf">
        {LADDERS.map((ladder) => {
          const total = ladder.levels.length;
          const ready = ladder.levels.filter((l) => levelStatus(ladder, l, state) === 'field-ready').length;
          const openC = openConfirmCount(ladder, state);
          const stale = daysSince(ladder.lastVerified);
          return (
            <div key={ladder.id} className="fm-card">
              <div className="fm-pack-head">
                <div className="fm-pack-emoji">{ladder.emoji || '🪜'}</div>
                <div className="fm-pack-text">
                  <div className="fm-pack-title">{ladder.title}</div>
                  <div className="fm-pack-domain">{ladder.domain}</div>
                </div>
                <ProgressRing done={ready} total={total} />
              </div>
              {ladder.subtitle && <div className="fm-pack-sub">{ladder.subtitle}</div>}
              <div className="fm-pack-meta">
                <MetaPill>{total} levels</MetaPill>
                <MetaPill>{ready}/{total} field-ready</MetaPill>
                {ladder.version && <MetaPill>v{ladder.version}{ladder.lastVerified ? ` · ${ladder.lastVerified}` : ''}</MetaPill>}
                {openC > 0 && <span className="fm-pill" data-fm-tone="negative"><Icon name="AlertTriangle" size={10} aria-hidden="true" /> {openC} unverified</span>}
                {stale != null && stale > STALE_DAYS && <span className="fm-pill" data-fm-tone="caution">stale {stale}d</span>}
              </div>
              <div className="fm-row">
                <Action onClick={() => onOpen(ladder.id)} primary>Open</Action>
                <Action onClick={() => onField(ladder.id)}>Field Mode</Action>
                <Action onClick={() => onLedger(ladder.id)}>Confirm Ledger{openC ? ` (${openC})` : ''}</Action>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Screen 2 · Ladder ────────────────────────────────────────────────────────
function LadderView({ ladder, state, onOpen, onField, onLedger, onReset, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const stale = daysSince(ladder.lastVerified);
  const openC = openConfirmCount(ladder, state);
  return (
    <div className="fm-page" data-w="ladder">
      <BackRow onBack={onBack} label="Shelf" />
      <div className="fm-title-row">
        <H1>{ladder.emoji} {ladder.title}</H1>
      </div>
      <div className="fm-sub">{ladder.summary}</div>
      <div className="fm-meta">
        Last verified {ladder.lastVerified}
        {stale != null && stale > STALE_DAYS && <span className="fm-meta-warn"> · ⚠ {stale} days old — re-verify market figures</span>}
      </div>

      <div className="fm-actions">
        <Action onClick={onField}><Icon name="Zap" size={16} /> Field Mode</Action>
        <Action onClick={onLedger}>Confirm Ledger{openC ? ` · ${openC} open` : ''}</Action>
        <Action onClick={() => setConfirmReset(true)}>Reset progress</Action>
      </div>

      {ladder.levels.map((l, i) => {
        const status = levelStatus(ladder, l, state);
        const p = levelProgress(state, ladder.id, l.id);
        const openConf = levelOpenConfirms(ladder, l, state).length;
        return (
          <button type="button" key={l.id} className="fm-card fm-level tap" onClick={() => onOpen(l.id)}>
            <div className="fm-level-n">L{i + 1}</div>
            <div className="fm-level-body">
              <div className="fm-level-top">
                <div className="fm-level-title">{l.title}</div>
                {l.tag && <span className="fm-level-tag">{l.tag}</span>}
              </div>
              <div className="fm-level-sub">{l.sub}</div>
            </div>
            <div className="fm-level-side">
              <StatusBadge status={status} score={p.bestScore} />
              {openConf > 0 && <div className="fm-level-open">{openConf} unverified</div>}
            </div>
          </button>
        );
      })}

      {confirmReset && (
        <ConfirmDialog
          title={`Reset ${ladder.title}?`}
          body="This clears your quiz scores and re-opens every resolved confirm for this pack. Other packs are untouched."
          confirmLabel="Reset"
          onConfirm={() => { onReset(ladder.id); setConfirmReset(false); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

// ── Screen 3 · Level ─────────────────────────────────────────────────────────
function LevelView({ ladder, level, state, graph, setGraph, onResult, onBack, onLedger }) {
  const openConfirms = levelOpenConfirms(ladder, level, state);
  const [drill, setDrill] = useState(false);
  const [sent, setSent] = useState(false);

  // Feed the graph per CONCEPT (source = this pack) so each tool becomes its own
  // trajectory in Skills — even on a read without a quiz. Guarded on level.concept
  // so packs that don't name one (e.g. sofc-powerdeal) are unaffected. Fires once
  // per level open.
  useEffect(() => {
    if (!level.concept) return;
    (async () => {
      const { graph: g } = await logConcept({ topic: level.concept, source: ladder.title, module: 'academy' });
      if (g) setGraph?.(g);
    })();
  }, [level.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendToVault = () => {
    // Route through the shared card pipeline so cards dedupe by front and carry
    // provenance (module + topic) back to this pack.
    (level.cards || []).forEach(([front, back]) =>
      createCard({ front, back, source: ladder.title, module: 'academy', topic: ladder.title }));
    setSent(true);
  };

  return (
    <div className="fm-page" data-w="level">
      <BackRow onBack={onBack} label={ladder.title} />
      <H1>{level.title}</H1>
      <div className="fm-sub" data-gap="level">{level.sub}</div>
      <div className="fm-meta" data-gap="level">~{level.minutes} min</div>

      {openConfirms.length > 0 && (
        <div className="fm-band">
          <b>This level has {openConfirms.length} unverified claim{openConfirms.length > 1 ? 's' : ''}.</b> The gated blocks below cannot be quoted to a customer, and this level cannot become <b>Field Ready</b> until they are resolved.
          <button type="button" className="fm-band-link tap" onClick={onLedger}>Open the Confirm Ledger →</button>
        </div>
      )}

      {/* Blocks */}
      {(level.blocks || []).map((b, i) => (
        <BlockView key={i} block={b} ladder={ladder} state={state} />
      ))}

      {/* A ladder rung has a natural structure — offer a diagram of it. */}
      {(level.blocks || []).length > 0 && (
        <DiagramBlock
          content={`${level.title}. ${level.sub || ''}\n` + (level.blocks || []).map((b) => b.title || b.t || b.html || (b.items || []).join('; ') || (b.pairs || []).map((p) => p.join(': ')).join('; ')).filter(Boolean).join('\n').replace(/<[^>]+>/g, '').slice(0, 2000)}
          hint={`Diagram the structure of "${level.title}".`}
          label="Visualize this level"
        />
      )}

      {/* Recall cards */}
      {level.cards?.length > 0 && (
        <>
          <SectionLabel>Recall — tap to flip</SectionLabel>
          <div className="fm-recall">
            {level.cards.map((c, i) => <RecallCard key={i} card={c} />)}
          </div>
          <div className="fm-actions" data-gap="lg">
            <Action onClick={sendToVault} disabled={sent} primary>{sent ? '✓ Sent to Vault' : `Send ${level.cards.length} cards to Vault`}</Action>
            <Action onClick={() => setDrill(true)}><Icon name="Target" size={16} /> Drill me (Socratic)</Action>
          </div>
        </>
      )}

      {/* Quiz */}
      {level.quiz?.length > 0 && (
        <Quiz ladder={ladder} level={level} graph={graph} setGraph={setGraph} onResult={onResult} />
      )}

      {drill && <SocraticDrill ladder={ladder} level={level} onClose={() => setDrill(false)} />}
    </div>
  );
}

// ── Block renderer — all 9 k-types, every block tier-chipped ─────────────────
function BlockView({ block, ladder, state }) {
  const gatedOpen = block.confirm && confirmStatus(ladder, state, block.confirm) === 'open';
  const confirm = gatedOpen ? ladder.confirms.find((c) => c.id === block.confirm) : null;
  return (
    <div className="fm-block" data-gated={gatedOpen ? '' : undefined}>
      <div className="fm-block-chips">
        <TierChip tier={block.tier} />
        {gatedOpen && <span className="fm-gate-chip"><Icon name="AlertTriangle" size={10} aria-hidden="true" /> Unverified — do not quote</span>}
      </div>
      {renderBlockBody(block)}
      {gatedOpen && confirm && (
        <div className="fm-block-why">
          <b>Why gated:</b> {confirm.why}
        </div>
      )}
    </div>
  );
}

const HTML = ({ html, className }) => <div className={className} dangerouslySetInnerHTML={{ __html: html || '' }} />;

function renderBlockBody(b) {
  switch (b.k) {
    case 'h':
      return (
        <div className="fm-h">
          {b.n && <span className="fm-h-n">{b.n}</span>}
          <span className="fm-h-t">{b.t}</span>
        </div>
      );
    case 'p':
      return <HTML html={b.html} className="fm-p" />;
    case 'ul':
      return (
        <ul className="fm-ul">
          {(b.items || []).map((it, i) => (
            <li key={i}>
              <span className="fm-bullet">▸</span>
              <HTML html={it} />
            </li>
          ))}
        </ul>
      );
    case 'call': {
      // Tone → token (border + title text only, never a tinted fill).
      const tone = ['key', 'sport', 'win', 'sell', 'warn'].includes(b.tone) ? b.tone : 'key';
      return (
        <div className="fm-call" data-tone={tone}>
          {b.title && <div className="fm-call-title">{b.title}</div>}
          <HTML html={b.html} className="fm-p" />
        </div>
      );
    }
    case 'table':
      return (
        <div className="fm-table-wrap" data-scroll-x="">
          <table className="fm-table">
            <thead>
              <tr>{(b.head || []).map((h, i) => <th key={i}><HTML html={h} /></th>)}</tr>
            </thead>
            <tbody>
              {(b.rows || []).map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}><HTML html={cell} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'pair':
      return (
        <div className="fm-pairs">
          {(b.pairs || []).map(([term, meaning], i) => (
            <div key={i} className="fm-pair">
              <div className="fm-pair-term" dangerouslySetInnerHTML={{ __html: term }} />
              <div className="fm-pair-def" dangerouslySetInnerHTML={{ __html: meaning }} />
            </div>
          ))}
        </div>
      );
    case 'flow':
      return (
        <div className="fm-flow" data-scroll-x="">
          {(b.stages || []).map((s, i) => (
            <div key={i} className="fm-stage" data-us={s.us ? '' : undefined}>
              <div className="fm-stage-n">{s.n}</div>
              <div className="fm-stage-nm">{s.nm}</div>
              {s.v && <div className="fm-stage-v">{s.v}</div>}
              {s.d && <div className="fm-stage-d">{s.d}</div>}
            </div>
          ))}
        </div>
      );
    case 'bc':
      return (
        <div className="fm-bc">
          <div className="fm-bc-head">
            <div className="fm-bc-title">{b.title}</div>
            {b.sub && <div className="fm-bc-sub">{b.sub}</div>}
          </div>
          <div className="fm-bc-body">
            {b.win && <BCRow tone="caution" label="Where they win" html={b.win} />}
            {b.ours?.length > 0 && (
              <div data-fm-tone="positive">
                <div className="fm-bc-label">Where we win</div>
                <ul className="fm-ul">
                  {b.ours.map((o, i) => <li key={i}><span className="fm-bullet">▸</span><HTML html={o} /></li>)}
                </ul>
              </div>
            )}
            {b.kill && <BCRow tone="accent" label="Kill shot" html={b.kill} />}
            {b.watch && <BCRow tone="negative" label="Watch for" html={b.watch} />}
          </div>
        </div>
      );
    case 'math':
      return (
        <div className="fm-math">
          {b.title && <div className="fm-math-title">{b.title}</div>}
          {(b.lines || []).map((ln, i) => <div key={i} className="fm-math-line">{ln || ' '}</div>)}
          {b.result && <div className="fm-math-result">{b.result}</div>}
        </div>
      );
    default:
      return b.html ? <div className="fm-p" data-sm="" dangerouslySetInnerHTML={{ __html: b.html }} /> : null;
  }
}

function BCRow({ tone, label, html }) {
  return (
    <div data-fm-tone={tone}>
      <div className="fm-bc-label">{label}</div>
      <HTML html={html} className="fm-p" />
    </div>
  );
}

function RecallCard({ card }) {
  const [front, back, tier] = card;
  const [flip, setFlip] = useState(false);
  return (
    <button type="button" className="fm-rc tap" aria-pressed={flip} onClick={() => setFlip((f) => !f)}>
      {!flip ? (
        <div className="fm-rc-front">{front}</div>
      ) : (
        <>
          <div className="fm-rc-back">{back}</div>
          <div className="fm-rc-tier"><TierChip tier={tier} /></div>
        </>
      )}
    </button>
  );
}

// ── Quiz — optional, infinitely retryable, never gates navigation ────────────
function Quiz({ ladder, level, graph, setGraph, onResult }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const total = level.quiz.length;
  const correct = level.quiz.reduce((n, q, i) => n + (answers[i] === q.a ? 1 : 0), 0);
  const pct = Math.round((correct / total) * 100);

  const submit = async () => {
    setSubmitted(true);
    const missed = level.quiz.filter((q, i) => answers[i] !== q.a).map((q) => q.q.replace(/<[^>]+>/g, '').slice(0, 40));
    const score10 = Math.round((correct / total) * 10);
    // Session logging is telemetry — isolate it so a logging failure never drops
    // the graph writes or the miss-cards below (they are the actual learning loop).
    try {
      await logSession(
        `${ladder.title} — ${level.title}`, 'academy', level.minutes, score10,
        `${correct}/${total}${missed.length ? ' · missed: ' + missed.join(', ') : ''}`,
      );
    } catch { /* telemetry is best-effort */ }
    try {
      // Connect this pack into the graph, and turn every miss into a review
      // card — a miss is signal, so it should resurface.
      const { graph: g } = await logConcept({ topic: ladder.title, source: ladder.title, module: 'academy', confidence: score10 });
      if (g) setGraph(g);
      // Per-concept confidence trajectory (source = pack, so it interlinks) —
      // awaited after the ladder write so the read-modify-writes don't clobber.
      if (level.concept) {
        const { graph: g2 } = await logConcept({ topic: level.concept, source: ladder.title, module: 'academy', confidence: score10 });
        if (g2) setGraph(g2);
      }
      level.quiz.forEach((q, i) => {
        if (answers[i] !== q.a) {
          createCard({
            front: q.q.replace(/<[^>]+>/g, ''),
            back: `${q.opts[q.a]}${q.e ? ' — ' + q.e : ''}`.replace(/<[^>]+>/g, ''),
            source: ladder.title, module: 'academy', topic: level.concept || ladder.title,
          });
        }
      });
    } catch { /* graph write is best-effort */ }
    onResult(pct);
  };

  const retry = () => { setAnswers({}); setSubmitted(false); };

  return (
    <div className="fm-card fm-quiz">
      <SectionLabel flush>Quiz · {total} questions · optional</SectionLabel>
      {level.quiz.map((q, i) => (
        <div key={i} className="fm-q">
          <div className="fm-q-text" dangerouslySetInnerHTML={{ __html: `${i + 1}. ${q.q}` }} />
          <div className="fm-opts">
            {q.opts.map((opt, oi) => {
              const chosen = answers[i] === oi;
              const isRight = oi === q.a;
              const res = submitted && isRight ? 'right' : submitted && chosen && !isRight ? 'wrong' : undefined;
              return (
                <button type="button" key={oi} className="fm-opt tap"
                  aria-pressed={chosen} aria-disabled={submitted || undefined} data-res={res}
                  onClick={() => !submitted && setAnswers((a) => ({ ...a, [i]: oi }))}
                  dangerouslySetInnerHTML={{ __html: opt }} />
              );
            })}
          </div>
          {submitted && <div className="fm-explain" data-fm-tone={answers[i] === q.a ? 'positive' : 'negative'}>{q.e}</div>}
        </div>
      ))}
      {!submitted ? (
        <Action onClick={submit} disabled={Object.keys(answers).length < total} primary>Submit ({Object.keys(answers).length}/{total})</Action>
      ) : (
        <div className="fm-score-row">
          <div className="fm-score" data-fm-tone={pct >= 80 ? 'positive' : 'caution'}>{correct}/{total} · {pct}%</div>
          <div className="fm-score-note">{pct >= 80 ? 'Passing. Resolve any open confirms to reach Field Ready.' : 'Below 80%. Read back and try again — no limit.'}</div>
          <Action onClick={retry}>Try again</Action>
        </div>
      )}
    </div>
  );
}

// ── Screen 4 · Field Mode ────────────────────────────────────────────────────
function FieldMode({ ladder, state, onExit }) {
  const scenarios = ladder.field || [];
  const [pick, setPick] = useState(null);
  const openC = openConfirmCount(ladder, state);
  const scenario = pick ? scenarios.find((s) => s.id === pick) : null;

  return (
    <div className="fm-field">
      <div className="fm-field-head">
        <div className="fm-field-title"><Icon name="Zap" size="header" /> Field Mode — {ladder.title}</div>
        <button type="button" className="fm-close tap" onClick={scenario ? () => setPick(null) : onExit}
          aria-label={scenario ? 'Back to situations' : 'Exit Field Mode'}>✕</button>
      </div>

      {openC > 0 && (
        <div className="fm-band">
          <b>{openC} unverified claim{openC > 1 ? 's' : ''} still open.</b> Do not quote gated numbers (heat rate, capex, tax %) in front of a customer until they are resolved.
        </div>
      )}

      {!scenario ? (
        <div className="fm-col fm-scenarios">
          <div className="fm-pick-label">Pick the situation</div>
          {scenarios.map((s) => (
            <button type="button" key={s.id} className="fm-card fm-scenario tap" onClick={() => setPick(s.id)}>
              <div className="fm-scenario-body">
                <div className="fm-scenario-label">{s.label}</div>
                {s.sub && <div className="fm-scenario-sub">{s.sub}</div>}
              </div>
              <span className="fm-scenario-go" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      ) : (
        <FieldCard scenario={scenario} />
      )}
    </div>
  );
}

// A labelled Field Card section. (Referenced by FieldCard but never defined —
// picking a scenario threw a ReferenceError and blanked Field Mode.)
function FieldSection({ label, tone, children }) {
  return (
    <div className="fm-fs" data-fm-tone={tone}>
      <div className="fm-fs-label">{label}</div>
      {children}
    </div>
  );
}

function FieldCard({ scenario }) {
  return (
    <div className="fm-col">
      <div className="fm-fc-title">{scenario.label}</div>

      <FieldSection label="Open with" tone="accent">
        <div className="fm-fs-text">{scenario.open}</div>
      </FieldSection>

      <div className="fm-kill" data-fm-tone="positive">
        <div className="fm-fs-label">Kill shot</div>
        <div className="fm-fs-text">{scenario.kill}</div>
      </div>

      <FieldSection label="Objections — tap to reveal">
        <div className="fm-objs">
          {(scenario.objections || []).map((o, i) => <Objection key={i} obj={o} />)}
        </div>
      </FieldSection>

      {scenario.ask && (
        <div className="fm-ask" data-fm-tone="accent">
          <div className="fm-fs-label">The ask</div>
          <div className="fm-fs-text">{scenario.ask}</div>
        </div>
      )}
    </div>
  );
}

function Objection({ obj }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className="fm-obj tap" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      <div className="fm-obj-q">{obj.q}</div>
      {open && <div className="fm-obj-a">{obj.a}</div>}
      {!open && <div className="fm-obj-hint">tap for the response</div>}
    </button>
  );
}

// ── Screen 5 · Confirm Ledger (all ladders) ──────────────────────────────────
function ConfirmLedger({ state, onResolve, onReopen, onExit }) {
  const rows = [];
  for (const ladder of LADDERS) {
    for (const c of ladder.confirms) {
      rows.push({ ladder, c, status: confirmStatus(ladder, state, c.id), owner: state?.[ladder.id]?.confirms?.[c.id]?.owner || '' });
    }
  }
  rows.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));

  return (
    <div className="fm-page" data-w="ledger">
      <BackRow onBack={onExit} label="Back" />
      <H1>Confirm Ledger</H1>
      <div className="fm-sub" data-gap="ledger">
        Every unverified claim across all packs. A claim is not customer-safe until an owner is assigned and it is resolved. This is a safety label — it never blocks reading or quizzing.
      </div>
      {rows.map(({ ladder, c, status, owner }) => <LedgerRow key={`${ladder.id}-${c.id}`} ladder={ladder} c={c} status={status} owner={owner} onResolve={onResolve} onReopen={onReopen} />)}
    </div>
  );
}

function LedgerRow({ ladder, c, status, owner, onResolve, onReopen }) {
  const [val, setVal] = useState(owner);
  const open = status === 'open';
  const tone = open ? 'negative' : 'positive';
  return (
    <div className="fm-card fm-lrow" data-fm-tone={tone}>
      <div className="fm-lrow-top">
        <span className="fm-pill" data-fm-tone={tone}>{open ? 'OPEN' : 'RESOLVED'}</span>
        <span className="fm-lrow-pack">{ladder.title}</span>
      </div>
      <div className="fm-lrow-claim">{c.claim}</div>
      <div className="fm-lrow-why">{c.why}</div>
      {open ? (
        <div className="fm-row">
          <input className="fm-input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Owner (who verifies this)"
            aria-label={`Owner for: ${c.claim}`} />
          <Action onClick={() => val.trim() && onResolve(ladder.id, c.id, val)} disabled={!val.trim()} primary>Resolve</Action>
        </div>
      ) : (
        <div className="fm-lrow-owner">
          <div>Owner: <b>{owner || '—'}</b></div>
          <Action onClick={() => onReopen(ladder.id, c.id)}>Reopen</Action>
        </div>
      )}
    </div>
  );
}

// ── Screen 6 · Socratic drill overlay ────────────────────────────────────────
function SocraticDrill({ ladder, level, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState('');
  // Failure as STATE, not content: a failed examiner turn used to be appended to
  // the transcript as a fake assistant message.
  const [err, setErr] = useState('');
  const [lastAsk, setLastAsk] = useState(null); // { history, first } for Retry

  const digest = useMemo(() => {
    const blocks = (level.blocks || []).map((b) => b.title || b.t || b.html || (b.items || []).join('; ') || (b.pairs || []).map((p) => p.join(': ')).join('; ')).filter(Boolean).join('\n').replace(/<[^>]+>/g, '').slice(0, 3500);
    const cards = (level.cards || []).map(([f, b]) => `${f}: ${b}`).join('\n');
    return `LEVEL: ${ladder.title} — ${level.title}\n\nKEY CONTENT:\n${blocks}\n\nRECALL CARDS:\n${cards}`;
  }, [ladder, level]);

  const system = SYSTEM_LEARNING + `\n\nSOCRATIC MODE: You are the examiner, CB is the student, on "${level.title}". Ask ONE focused question at a time drawn from the content below. Never lecture. Wait for the answer. Respond with: what he got right, what he missed, the correct answer, then the NEXT question. After 5 questions give a scorecard: what he knows cold, what needs work.\n\nCONTENT TO EXAMINE ON:\n${digest}\n\n${TIER_INSTRUCTION}`;

  const send = async (first = false) => {
    if ((!input.trim() && !first) || loading) return;
    const newMsgs = first ? [] : [...messages, { role: 'user', content: input.trim() }];
    if (!first) { setMessages(newMsgs); setInput(''); }
    await ask(newMsgs, first);
  };

  // The examiner call, split out so Retry re-runs ONLY the failed turn.
  const ask = async (newMsgs, first) => {
    setLastAsk({ history: newMsgs, first });
    setLoading(true); setStream(''); setErr('');
    try {
      const reply = await callClaude({
        system,
        messages: first ? [{ role: 'user', content: 'Begin. Ask your first question.' }] : newMsgs,
        maxTokens: 700, job: 'reason',
        onToken: (t) => setStream((s) => s + t),
      });
      setMessages((m) => [...(first ? [] : m), { role: 'assistant', content: reply }]);
    } catch (e) {
      setErr(e?.message || 'The AI providers were unavailable.');
    }
    setStream(''); setLoading(false);
  };
  const retry = () => { if (lastAsk && !loading) ask(lastAsk.history, lastAsk.first); };
  const drillStatus = loading ? 'loading' : err ? 'error' : messages.some((m) => m.role === 'assistant') ? 'ready' : 'empty';

  useEffect(() => { send(true); /* eslint-disable-next-line */ }, []);

  return (
    <div className="fm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fm-sheet" role="dialog" aria-modal="true" aria-label={`Socratic Drill — ${level.title}`}>
        <div className="fm-sheet-head">
          <div className="fm-sheet-title"><Icon name="Target" size={16} /> Socratic Drill — {level.title}</div>
          <button type="button" className="fm-close tap" onClick={onClose} aria-label="Close drill">✕</button>
        </div>
        <div className="fm-thread" data-status={drillStatus}>
          {/* 'empty' has no placeholder: the drill auto-asks its first question on open,
              so empty only exists for the first frame before the call starts. */}
          {messages.map((m, i) => (
            <div key={i} className="fm-msg" data-role={m.role}>
              {m.role === 'user' ? <div>{m.content}</div> : <MD text={m.content} color="var(--accent-text)" />}
            </div>
          ))}
          {loading && stream && <div className="fm-msg"><MD text={stream + '▍'} color="var(--accent-text)" /></div>}
          {loading && !stream && <SectionSkeleton rows={2} label="examiner question" />}
          {drillStatus === 'error' && <SectionError label={lastAsk?.first ? 'the first drill question' : 'the examiner’s reply'} onRetry={retry} detail={err} />}
        </div>
        <div className="fm-composer">
          <input className="fm-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Your answer…" aria-label="Your answer" />
          <Action onClick={() => send()} disabled={!input.trim() || loading} primary>Send</Action>
        </div>
      </div>
    </div>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────
const H1 = ({ children }) => <div className="fm-h1">{children}</div>;
const SectionLabel = ({ children, flush }) => <div className="fm-section-label" data-flush={flush ? '' : undefined}>{children}</div>;
const MetaPill = ({ children }) => <span className="fm-metapill">{children}</span>;

function Action({ children, onClick, primary, danger, disabled }) {
  return (
    <button type="button" className="fm-action tap" onClick={onClick} disabled={disabled}
      data-primary={primary ? '' : undefined} data-danger={danger ? '' : undefined}>
      {children}
    </button>
  );
}

function BackRow({ onBack, label }) {
  return <div><button type="button" className="fm-back tap" onClick={onBack}>← {label}</button></div>;
}

function StatusBadge({ status, score }) {
  const map = {
    'not-started': { label: 'Not started', tone: 'subtle' },
    'in-progress': { label: `In progress · ${score}%`, tone: 'caution' },
    'passed':      { label: `Passed · ${score}%`, tone: 'positive' },
    'field-ready': { label: 'Field Ready', tone: 'positive' },
  };
  const m = map[status] || map['not-started'];
  const ready = status === 'field-ready';
  return <span className="fm-status" data-fm-tone={m.tone} data-ready={ready ? '' : undefined}>{ready ? '✓ Field Ready' : m.label}</span>;
}

function ProgressRing({ done, total }) {
  const pct = total ? done / total : 0;
  const r = 15, c = 2 * Math.PI * r;
  return (
    <svg className="fm-ring" width="38" height="38" viewBox="0 0 38 38" aria-label={`${done} of ${total} field-ready`}>
      <circle className="fm-ring-track" cx="19" cy="19" r={r} fill="none" strokeWidth="3" />
      <circle className="fm-ring-fill" cx="19" cy="19" r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 19 19)" />
      <text className="fm-ring-text" x="19" y="22" textAnchor="middle">{done}</text>
    </svg>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="fm-overlay" data-center="" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="fm-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="fm-dialog-title">{title}</div>
        <div className="fm-dialog-body">{body}</div>
        <div className="fm-dialog-actions">
          <Action onClick={onCancel}>Cancel</Action>
          <Action onClick={onConfirm} danger>{confirmLabel}</Action>
        </div>
      </div>
    </div>
  );
}
