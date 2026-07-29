import { T, withAlpha } from '../../theme';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../App.jsx';
import { callClaude, logSession, uid } from '../../utils.js';
import { CB_LEARNING_SPINE } from '../../constants.js';
import { LADDERS, getLadder } from '../../data/ladders/index.js';
import { readLocal, writeThrough } from '../../lib/storage.js';
import MD from '../shared/MD.jsx';
import { ThinkingDots } from '../shared/Common.jsx';

// Content packs live entirely in data files (src/data/ladders/*). This component
// is the engine — it must never special-case a specific ladder. Adding a ladder
// = adding one file + one import in data/ladders/index.js. Zero edits here.
const ACCENT     = T.accent;            // module chrome stays quiet/on-system (no hex)
const LADDER_KEY = 'aether_academy_v1';
const FLASH_KEY  = 'aether_flashcards';
const STALE_DAYS = 90;

// ── Tiering — the Hub invariant: nothing renders un-tiered ───────────────────
const TIER = {
  verified: { label: 'Verified', color: 'var(--positive)' },
  reported: { label: 'Reported', color: 'var(--caution)' },
  inferred: { label: 'Inferred', color: 'var(--dim)' },
};
const tierOf = (t) => TIER[t] || TIER.inferred; // no tier → inferred, never blank

function TierChip({ tier }) {
  const t = tierOf(tier);
  return (
    <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: t.color, border: `1px solid ${withAlpha(t.color, 40)}`, background: withAlpha(t.color, 12), borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  );
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
  const { graph, setGraph, isMobile, isPhone } = useApp();
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

  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';

  if (view === 'field' && ladder)  return <FieldMode ladder={ladder} state={state} onExit={() => go('shelf')} isPhone={isPhone} />;
  if (view === 'ledger')           return <ConfirmLedger state={state} onResolve={resolveConfirm} onReopen={reopenConfirm} onExit={() => go(ladder ? 'ladder' : 'shelf')} pad={pad} />;
  if (view === 'level' && level)   return <LevelView ladder={ladder} level={level} state={state} pad={pad} isMobile={isMobile} graph={graph} setGraph={setGraph} onResult={setLevelResult} onBack={() => go('ladder')} onLedger={() => go('ledger')} />;
  if (view === 'ladder' && ladder) return <LadderView ladder={ladder} state={state} pad={pad} isMobile={isMobile} onOpen={(lid) => go('level', { levelId: lid })} onField={() => go('field')} onLedger={() => go('ledger')} onReset={resetLadder} onBack={() => go('shelf')} />;

  return <Shelf state={state} pad={pad} isMobile={isMobile} onOpen={(id) => go('ladder', { ladderId: id })} onField={(id) => go('field', { ladderId: id })} onLedger={(id) => { setLadderId(id); go('ledger'); }} />;
}

// ── Screen 1 · Shelf ─────────────────────────────────────────────────────────
function Shelf({ state, pad, isMobile, onOpen, onField, onLedger }) {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: `4px ${pad} 60px` }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 22px' }}>
        Field-ready manuals. Every claim is tiered; unverified claims are gated out of customer-facing use until you resolve them.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 14 }}>
        {LADDERS.map((ladder) => {
          const total = ladder.levels.length;
          const ready = ladder.levels.filter((l) => levelStatus(ladder, l, state) === 'field-ready').length;
          const openC = openConfirmCount(ladder, state);
          const stale = daysSince(ladder.lastVerified);
          return (
            <div key={ladder.id} style={card()}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 26, lineHeight: 1 }}>{ladder.emoji || '🪜'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{ladder.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{ladder.domain}</div>
                </div>
                <ProgressRing done={ready} total={total} />
              </div>
              {ladder.subtitle && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{ladder.subtitle}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <MetaPill>{total} levels</MetaPill>
                <MetaPill>{ready}/{total} field-ready</MetaPill>
                {openC > 0 && <span style={pill('var(--negative)')}>⚠ {openC} unverified</span>}
                {stale != null && stale > STALE_DAYS && <span style={pill('var(--caution)')}>stale {stale}d</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
function LadderView({ ladder, state, pad, isMobile, onOpen, onField, onLedger, onReset, onBack }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const stale = daysSince(ladder.lastVerified);
  const openC = openConfirmCount(ladder, state);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: `20px ${pad} 60px` }}>
      <BackRow onBack={onBack} label="Shelf" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <H1>{ladder.emoji} {ladder.title}</H1>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 6px' }}>{ladder.summary}</div>
      <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 16 }}>
        Last verified {ladder.lastVerified}
        {stale != null && stale > STALE_DAYS && <span style={{ color: 'var(--caution)', fontWeight: 700 }}> · ⚠ {stale} days old — re-verify market figures</span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Action onClick={onField}>⚡ Field Mode</Action>
        <Action onClick={onLedger}>Confirm Ledger{openC ? ` · ${openC} open` : ''}</Action>
        <Action onClick={() => setConfirmReset(true)}>Reset progress</Action>
      </div>

      {ladder.levels.map((l, i) => {
        const status = levelStatus(ladder, l, state);
        const p = levelProgress(state, ladder.id, l.id);
        const openConf = levelOpenConfirms(ladder, l, state).length;
        return (
          <div key={l.id} onClick={() => onOpen(l.id)} style={{ ...card(), marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, width: 28, flexShrink: 0 }}>L{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{l.title}</div>
                {l.tag && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, color: 'var(--dim)', textTransform: 'uppercase' }}>{l.tag}</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>{l.sub}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <StatusBadge status={status} score={p.bestScore} />
              {openConf > 0 && <div style={{ fontSize: 9, color: 'var(--negative)', marginTop: 4, fontWeight: 700 }}>{openConf} unverified</div>}
            </div>
          </div>
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
function LevelView({ ladder, level, state, pad, isMobile, graph, setGraph, onResult, onBack, onLedger }) {
  const openConfirms = levelOpenConfirms(ladder, level, state);
  const [drill, setDrill] = useState(false);
  const [sent, setSent] = useState(false);

  const sendToVault = () => {
    const existing = readLocal(FLASH_KEY, []);
    const have = new Set(existing.map((c) => (c.front || '').toLowerCase().trim()));
    const additions = (level.cards || [])
      .filter(([front]) => !have.has((front || '').toLowerCase().trim()))
      .map(([front, back, tier]) => ({
        id: uid(), front, back, tier: tier || 'inferred',
        interval: 1, easeFactor: 2.5, dueDate: Date.now(), reviews: 0,
        createdAt: Date.now(), source: ladder.title,
      }));
    if (additions.length) writeThrough(FLASH_KEY, [...existing, ...additions]);
    setSent(true);
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: `18px ${pad} 80px` }}>
      <BackRow onBack={onBack} label={ladder.title} />
      <H1>{level.title}</H1>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 8px' }}>{level.sub}</div>
      <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 18 }}>~{level.minutes} min</div>

      {openConfirms.length > 0 && (
        <div style={band('var(--negative)')}>
          <b>This level has {openConfirms.length} unverified claim{openConfirms.length > 1 ? 's' : ''}.</b> The gated blocks below cannot be quoted to a customer, and this level cannot become <b>Field Ready</b> until they are resolved.
          <span onClick={onLedger} style={{ color: 'var(--negative)', textDecoration: 'underline', cursor: 'pointer', marginLeft: 6, fontWeight: 700 }}>Open the Confirm Ledger →</span>
        </div>
      )}

      {/* Blocks */}
      {(level.blocks || []).map((b, i) => (
        <BlockView key={i} block={b} ladder={ladder} state={state} />
      ))}

      {/* Recall cards */}
      {level.cards?.length > 0 && (
        <>
          <SectionLabel>Recall — tap to flip</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {level.cards.map((c, i) => <RecallCard key={i} card={c} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <Action onClick={sendToVault} disabled={sent} primary>{sent ? '✓ Sent to Vault' : `Send ${level.cards.length} cards to Vault`}</Action>
            <Action onClick={() => setDrill(true)}>🎯 Drill me (Socratic)</Action>
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
    <div style={{ marginBottom: 14, border: gatedOpen ? `1px solid ${withAlpha('var(--negative)', 45)}` : '1px solid transparent', borderRadius: gatedOpen ? 10 : 0, padding: gatedOpen ? '10px 12px' : 0, background: gatedOpen ? withAlpha('var(--negative)', 6) : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <TierChip tier={block.tier} />
        {gatedOpen && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, color: 'var(--negative)', textTransform: 'uppercase', border: `1px solid ${withAlpha('var(--negative)', 50)}`, borderRadius: 5, padding: '1px 6px' }}>⚠ Unverified — do not quote</span>}
      </div>
      {renderBlockBody(block)}
      {gatedOpen && confirm && (
        <div style={{ fontSize: 10, color: 'var(--negative)', marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${withAlpha('var(--negative)', 30)}`, paddingTop: 6 }}>
          <b>Why gated:</b> {confirm.why}
        </div>
      )}
    </div>
  );
}

const HTML = ({ html, style }) => <div style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;

function renderBlockBody(b) {
  switch (b.k) {
    case 'h':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {b.n && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: ACCENT, background: withAlpha(ACCENT, 12), border: `1px solid ${withAlpha(ACCENT, 30)}`, borderRadius: 5, padding: '1px 6px' }}>{b.n}</span>}
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{b.t}</span>
        </div>
      );
    case 'p':
      return <HTML html={b.html} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-c)' }} />;
    case 'ul':
      return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {(b.items || []).map((it, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-c)' }}>
              <span style={{ color: ACCENT, flexShrink: 0 }}>▸</span>
              <HTML html={it} />
            </li>
          ))}
        </ul>
      );
    case 'call': {
      const tone = {
        key:  ACCENT, sport: 'var(--tier-reported)', win: 'var(--positive)',
        sell: 'var(--positive)', warn: 'var(--negative)',
      }[b.tone] || ACCENT;
      return (
        <div style={{ background: withAlpha(tone, 8), border: `1px solid ${withAlpha(tone, 32)}`, borderLeft: `3px solid ${tone}`, borderRadius: 8, padding: '11px 14px' }}>
          {b.title && <div style={{ fontSize: 11, fontWeight: 800, color: tone, marginBottom: 5, letterSpacing: 0.2 }}>{b.title}</div>}
          <HTML html={b.html} style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-c)' }} />
        </div>
      );
    }
    case 'table':
      return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11.5 }}>
            <thead>
              <tr>{(b.head || []).map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 700, background: 'var(--surf2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}><HTML html={h} /></th>)}</tr>
            </thead>
            <tbody>
              {(b.rows || []).map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} style={{ padding: '8px 10px', color: 'var(--text-c)', borderBottom: '1px solid var(--bord2)', verticalAlign: 'top' }}><HTML html={cell} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'pair':
      return (
        <div style={{ display: 'grid', gap: 6 }}>
          {(b.pairs || []).map(([term, meaning], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 160px) 1fr', gap: 10, alignItems: 'start', padding: '8px 10px', background: 'var(--surf2)', borderRadius: 7 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: term }} />
              <div style={{ fontSize: 12, color: 'var(--text-c)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: meaning }} />
            </div>
          ))}
        </div>
      );
    case 'flow':
      return (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {(b.stages || []).map((s, i) => (
            <div key={i} style={{ minWidth: 150, flexShrink: 0, background: s.us ? withAlpha(ACCENT, 14) : 'var(--surface)', border: `1px solid ${s.us ? withAlpha(ACCENT, 45) : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--dim)' }}>{s.n}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: s.us ? ACCENT : 'var(--text)', marginTop: 2 }}>{s.nm}</div>
              {s.v && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{s.v}</div>}
              {s.d && <div style={{ fontSize: 10, color: 'var(--text-c)', marginTop: 5, lineHeight: 1.45 }}>{s.d}</div>}
            </div>
          ))}
        </div>
      );
    case 'bc':
      return (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--surf2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{b.title}</div>
            {b.sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{b.sub}</div>}
          </div>
          <div style={{ padding: '12px 14px', display: 'grid', gap: 10 }}>
            {b.win && <BCRow color="var(--caution)" label="Where they win" html={b.win} />}
            {b.ours?.length > 0 && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--positive)', marginBottom: 4 }}>Where we win</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {b.ours.map((o, i) => <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12, lineHeight: 1.55, color: 'var(--text-c)' }}><span style={{ color: 'var(--positive)', flexShrink: 0 }}>▸</span><HTML html={o} /></li>)}
                </ul>
              </div>
            )}
            {b.kill && <BCRow color={ACCENT} label="Kill shot" html={b.kill} />}
            {b.watch && <BCRow color="var(--negative)" label="Watch for" html={b.watch} />}
          </div>
        </div>
      );
    case 'math':
      return (
        <div style={{ background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
          {b.title && <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', marginBottom: 8, fontFamily: 'var(--font-sans)' }}>{b.title}</div>}
          {(b.lines || []).map((ln, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--text-c)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{ln || ' '}</div>)}
          {b.result && <div style={{ fontSize: 12, color: ACCENT, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>{b.result}</div>}
        </div>
      );
    default:
      return b.html ? <HTML html={b.html} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-c)' }} /> : null;
  }
}

function BCRow({ color, label, html }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color, marginBottom: 4 }}>{label}</div>
      <HTML html={html} style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-c)' }} />
    </div>
  );
}

function RecallCard({ card }) {
  const [front, back, tier] = card;
  const [flip, setFlip] = useState(false);
  return (
    <div onClick={() => setFlip((f) => !f)} style={{ minHeight: 84, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {!flip ? (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{front}</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-c)', lineHeight: 1.5, marginBottom: 6 }}>{back}</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><TierChip tier={tier} /></div>
        </>
      )}
    </div>
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
    try {
      const updated = await logSession(
        `${ladder.title} — ${level.title}`, 'academy', level.minutes,
        Math.round((correct / total) * 10),
        `${correct}/${total}${missed.length ? ' · missed: ' + missed.join(', ') : ''}`,
      );
      if (updated) setGraph(updated);
    } catch { /* graph write is best-effort */ }
    onResult(pct);
  };

  const retry = () => { setAnswers({}); setSubmitted(false); };

  return (
    <div style={{ ...card(), marginTop: 8 }}>
      <SectionLabel style={{ marginTop: 0 }}>Quiz · {total} questions · optional</SectionLabel>
      {level.quiz.map((q, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: `${i + 1}. ${q.q}` }} />
          <div style={{ display: 'grid', gap: 6 }}>
            {q.opts.map((opt, oi) => {
              const chosen = answers[i] === oi;
              const isRight = oi === q.a;
              const showRes = submitted;
              const bg = showRes && isRight ? withAlpha('var(--positive)', 14)
                : showRes && chosen && !isRight ? withAlpha('var(--negative)', 14)
                : chosen ? withAlpha(ACCENT, 12) : 'var(--bg)';
              const bd = showRes && isRight ? 'var(--positive)'
                : showRes && chosen && !isRight ? 'var(--negative)'
                : chosen ? ACCENT : 'var(--border)';
              return (
                <div key={oi} onClick={() => !submitted && setAnswers((a) => ({ ...a, [i]: oi }))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${bd}`, background: bg, cursor: submitted ? 'default' : 'pointer', fontSize: 12, color: 'var(--text-c)' }}
                  dangerouslySetInnerHTML={{ __html: opt }} />
              );
            })}
          </div>
          {submitted && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5, borderLeft: `2px solid ${answers[i] === q.a ? 'var(--positive)' : 'var(--negative)'}`, paddingLeft: 8 }}>{q.e}</div>}
        </div>
      ))}
      {!submitted ? (
        <Action onClick={submit} disabled={Object.keys(answers).length < total} primary>Submit ({Object.keys(answers).length}/{total})</Action>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: pct >= 80 ? 'var(--positive)' : 'var(--caution)' }}>{correct}/{total} · {pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{pct >= 80 ? 'Passing. Resolve any open confirms to reach Field Ready.' : 'Below 80%. Read back and try again — no limit.'}</div>
          <Action onClick={retry}>Try again</Action>
        </div>
      )}
    </div>
  );
}

// ── Screen 4 · Field Mode ────────────────────────────────────────────────────
function FieldMode({ ladder, state, onExit, isPhone }) {
  const scenarios = ladder.field || [];
  const [pick, setPick] = useState(null);
  const openC = openConfirmCount(ladder, state);
  const scenario = pick ? scenarios.find((s) => s.id === pick) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 300, overflowY: 'auto', padding: `18px ${isPhone ? '16px' : '24px'} 40px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, maxWidth: 640, margin: '0 auto 14px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>⚡ Field Mode — {ladder.title}</div>
        <div onClick={scenario ? () => setPick(null) : onExit} style={{ fontSize: 22, color: 'var(--dim)', cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</div>
      </div>

      {openC > 0 && (
        <div style={{ ...band('var(--negative)'), maxWidth: 640, margin: '0 auto 14px' }}>
          <b>{openC} unverified claim{openC > 1 ? 's' : ''} still open.</b> Do not quote gated numbers (heat rate, capex, tax %) in front of a customer until they are resolved.
        </div>
      )}

      {!scenario ? (
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>Pick the situation</div>
          {scenarios.map((s) => (
            <div key={s.id} onClick={() => setPick(s.id)} style={{ ...card(), cursor: 'pointer', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.label}</div>
                {s.sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.sub}</div>}
              </div>
              <span style={{ color: ACCENT, fontSize: 18 }}>→</span>
            </div>
          ))}
        </div>
      ) : (
        <FieldCard scenario={scenario} />
      )}
    </div>
  );
}

function FieldCard({ scenario }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: 16 }}>{scenario.label}</div>

      <FieldSection label="Open with" color={ACCENT}>
        <div style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--text)' }}>{scenario.open}</div>
      </FieldSection>

      <div style={{ background: withAlpha('var(--positive)', 12), border: `1px solid ${withAlpha('var(--positive)', 40)}`, borderLeft: '4px solid var(--positive)', borderRadius: 10, padding: '14px 16px', margin: '14px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--positive)', marginBottom: 6 }}>Kill shot</div>
        <div style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--text)', fontWeight: 600 }}>{scenario.kill}</div>
      </div>

      <FieldSection label="Objections — tap to reveal">
        <div style={{ display: 'grid', gap: 8 }}>
          {(scenario.objections || []).map((o, i) => <Objection key={i} obj={o} />)}
        </div>
      </FieldSection>

      {scenario.ask && (
        <div style={{ background: withAlpha(ACCENT, 12), border: `1px solid ${withAlpha(ACCENT, 40)}`, borderRadius: 10, padding: '14px 16px', marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: ACCENT, marginBottom: 6 }}>The ask</div>
          <div style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text)' }}>{scenario.ask}</div>
        </div>
      )}
    </div>
  );
}

function Objection({ obj }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen((o) => !o)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', minHeight: 44 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{obj.q}</div>
      {open && <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-c)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bord2)' }}>{obj.a}</div>}
      {!open && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>tap for the response</div>}
    </div>
  );
}

// ── Screen 5 · Confirm Ledger (all ladders) ──────────────────────────────────
function ConfirmLedger({ state, onResolve, onReopen, onExit, pad }) {
  const rows = [];
  for (const ladder of LADDERS) {
    for (const c of ladder.confirms) {
      rows.push({ ladder, c, status: confirmStatus(ladder, state, c.id), owner: state?.[ladder.id]?.confirms?.[c.id]?.owner || '' });
    }
  }
  rows.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: `20px ${pad} 60px` }}>
      <BackRow onBack={onExit} label="Back" />
      <H1>Confirm Ledger</H1>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 20px' }}>
        Every unverified claim across all packs. A claim is not customer-safe until an owner is assigned and it is resolved. This is a safety label — it never blocks reading or quizzing.
      </div>
      {rows.map(({ ladder, c, status, owner }) => <LedgerRow key={`${ladder.id}-${c.id}`} ladder={ladder} c={c} status={status} owner={owner} onResolve={onResolve} onReopen={onReopen} />)}
    </div>
  );
}

function LedgerRow({ ladder, c, status, owner, onResolve, onReopen }) {
  const [val, setVal] = useState(owner);
  const open = status === 'open';
  return (
    <div style={{ ...card(), marginBottom: 10, borderLeft: `3px solid ${open ? 'var(--negative)' : 'var(--positive)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={pill(open ? 'var(--negative)' : 'var(--positive)')}>{open ? 'OPEN' : 'RESOLVED'}</span>
        <span style={{ fontSize: 9, color: 'var(--dim)', fontWeight: 700 }}>{ladder.title}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{c.claim}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>{c.why}</div>
      {open ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Owner (who verifies this)"
            style={{ flex: 1, minWidth: 160, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
          <Action onClick={() => val.trim() && onResolve(ladder.id, c.id, val)} disabled={!val.trim()} primary>Resolve</Action>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Owner: <b style={{ color: 'var(--text-c)' }}>{owner || '—'}</b></div>
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

  const digest = useMemo(() => {
    const blocks = (level.blocks || []).map((b) => b.title || b.t || b.html || (b.items || []).join('; ') || (b.pairs || []).map((p) => p.join(': ')).join('; ')).filter(Boolean).join('\n').replace(/<[^>]+>/g, '').slice(0, 3500);
    const cards = (level.cards || []).map(([f, b]) => `${f}: ${b}`).join('\n');
    return `LEVEL: ${ladder.title} — ${level.title}\n\nKEY CONTENT:\n${blocks}\n\nRECALL CARDS:\n${cards}`;
  }, [ladder, level]);

  const system = CB_LEARNING_SPINE + `\n\nSOCRATIC MODE: You are the examiner, CB is the student, on "${level.title}". Ask ONE focused question at a time drawn from the content below. Never lecture. Wait for the answer. Respond with: what he got right, what he missed, the correct answer, then the NEXT question. After 5 questions give a scorecard: what he knows cold, what needs work.\n\nCONTENT TO EXAMINE ON:\n${digest}`;

  const send = async (first = false) => {
    if ((!input.trim() && !first) || loading) return;
    const newMsgs = first ? [] : [...messages, { role: 'user', content: input.trim() }];
    if (!first) { setMessages(newMsgs); setInput(''); }
    setLoading(true); setStream('');
    try {
      const reply = await callClaude({
        system,
        messages: first ? [{ role: 'user', content: 'Begin. Ask your first question.' }] : newMsgs,
        maxTokens: 700, job: 'reason',
        onToken: (t) => setStream((s) => s + t),
      });
      setMessages((m) => [...(first ? [] : m), { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Drill unavailable — check connection and try again.' }]);
    }
    setStream(''); setLoading(false);
  };

  useEffect(() => { send(true); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', background: 'var(--surface)', borderRadius: '16px 16px 0 0', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>🎯 Socratic Drill — {level.title}</div>
          <div onClick={onClose} style={{ fontSize: 18, color: 'var(--dim)', cursor: 'pointer' }}>✕</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.role === 'user' ? 'var(--u-bubble)' : 'var(--bg)', border: `1px solid ${m.role === 'user' ? 'var(--u-bubble-b)' : 'var(--border)'}`, borderRadius: 12, padding: '10px 14px' }}>
              {m.role === 'user' ? <div style={{ fontSize: 13, color: 'var(--u-bubble-text)' }}>{m.content}</div> : <MD text={m.content} color={ACCENT} />}
            </div>
          ))}
          {loading && <div style={{ alignSelf: 'flex-start', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', maxWidth: '90%' }}>{stream ? <MD text={stream + '▍'} color={ACCENT} /> : <ThinkingDots color={ACCENT} />}</div>}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Your answer…"
            style={{ flex: 1, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
          <Action onClick={() => send()} disabled={!input.trim() || loading} primary>Send</Action>
        </div>
      </div>
    </div>
  );
}

// ── Small shared bits ────────────────────────────────────────────────────────
const card = () => ({ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 });
const pill = (color) => ({ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color, border: `1px solid ${withAlpha(color, 40)}`, background: withAlpha(color, 12), borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' });
const band = (color) => ({ background: withAlpha(color, 10), border: `1px solid ${withAlpha(color, 40)}`, borderRadius: 10, padding: '10px 14px', fontSize: 11.5, lineHeight: 1.55, color: 'var(--text-c)', marginBottom: 16 });

const Eyebrow = ({ children }) => <div style={{ fontSize: 9, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{children}</div>;
const H1 = ({ children }) => <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5 }}>{children}</div>;
const SectionLabel = ({ children, style }) => <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--dim)', textTransform: 'uppercase', fontWeight: 700, margin: '22px 0 10px', ...style }}>{children}</div>;
const MetaPill = ({ children }) => <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>{children}</span>;

function Action({ children, onClick, primary, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '8px 14px', borderRadius: 8, border: primary ? 'none' : '1px solid var(--border)', background: disabled ? 'var(--surf2)' : primary ? ACCENT : 'transparent', color: disabled ? 'var(--dim)' : primary ? 'var(--on-accent)' : 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', minHeight: 36 }}>
      {children}
    </button>
  );
}

function BackRow({ onBack, label }) {
  return <div onClick={onBack} style={{ fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 700, marginBottom: 14, display: 'inline-block' }}>← {label}</div>;
}

function StatusBadge({ status, score }) {
  const map = {
    'not-started': { label: 'Not started', color: 'var(--dim)' },
    'in-progress': { label: `In progress · ${score}%`, color: 'var(--caution)' },
    'passed':      { label: `Passed · ${score}%`, color: 'var(--positive)' },
    'field-ready': { label: 'Field Ready', color: 'var(--positive)' },
  };
  const m = map[status] || map['not-started'];
  const ready = status === 'field-ready';
  return <span style={{ fontSize: 10, fontWeight: 800, color: ready ? 'var(--on-accent)' : m.color, background: ready ? 'var(--positive)' : withAlpha(m.color, 12), border: `1px solid ${withAlpha(m.color, 35)}`, borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>{ready ? '✓ Field Ready' : m.label}</span>;
}

function ProgressRing({ done, total }) {
  const pct = total ? done / total : 0;
  const r = 15, c = 2 * Math.PI * r;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" style={{ flexShrink: 0 }}>
      <circle cx="19" cy="19" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle cx="19" cy="19" r={r} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 19 19)" />
      <text x="19" y="22" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--text)">{done}</text>
    </svg>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Action onClick={onCancel}>Cancel</Action>
          <button onClick={onConfirm} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--negative)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
