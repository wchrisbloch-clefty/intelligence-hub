import { T, withAlpha } from '../../theme';
import { useState } from 'react';
import { useApp } from '../../App.jsx';
import { graphSummary, conceptFootprint } from '../../lib/graph.js';
import { MODE_META, containerOfMode } from '../../constants.js';
import NavIcon from './NavIcon.jsx';

// The payoff of Phase 2: one panel that shows what a topic touches across every
// module — which modules have studied it, what it connects to, and where those
// observations came from. Self-contained: pass a `topic` to pin one, or leave it
// null and it opens on the graph rollup, drilling into any concept on tap.

const moduleLabel = (m) => MODE_META[m]?.label || m;

function ModuleChip({ id, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, border: `1px solid ${withAlpha(T.accent, 30)}`, background: withAlpha(T.accent, 8), color: T.accent, fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', outline: 'none' }}>
      <NavIcon id={id} size={13} strokeWidth={2} /> {moduleLabel(id)}
    </button>
  );
}

export default function ConnectedKnowledge({ topic = null, compact = false }) {
  const { setActiveModule, setChatPrefill, setChatOpen } = useApp();
  const [pinned, setPinned] = useState(topic);
  const summary = graphSummary();

  const eyebrow = (
    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--dim)', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ color: T.accent }}>◆</span> Connected Knowledge
    </div>
  );

  const shell = (children) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: compact ? '14px 16px' : '18px 20px' }}>
      {eyebrow}
      {children}
    </div>
  );

  if (summary.conceptCount === 0) {
    return shell(
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', lineHeight: 'var(--lh-read)' }}>
        Your knowledge graph is empty. Study a book, run a deep dive, take a quiz, or capture something — concepts connect here across every module as you go.
      </div>,
    );
  }

  const footprint = pinned ? conceptFootprint(pinned) : null;

  // Open the Ask layer about a concept (optionally in relation to another).
  const ask = (t, relatedTo = null) => {
    setChatPrefill(relatedTo ? `How does "${t}" connect to "${relatedTo}"?` : `What do I know about "${t}", and what should I connect it to next?`);
    setChatOpen(true);
  };

  // ── Pinned concept footprint ──────────────────────────────────────────────
  if (footprint) {
    return shell(
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 'var(--lh-tight)' }}>{footprint.topic}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3 }}>
              {footprint.observations} observation{footprint.observations === 1 ? '' : 's'}
              {typeof footprint.confidence === 'number' ? ` · confidence ${footprint.confidence}/10` : ''}
            </div>
          </div>
          {!topic && (
            <button onClick={() => setPinned(null)} style={{ fontSize: 'var(--fs-sm)', color: 'var(--subtle)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>← Graph</button>
          )}
        </div>

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Touched in</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: footprint.related.length ? 16 : 0 }}>
          {footprint.modules.map((m) => (
            <ModuleChip key={m} id={m} onClick={() => setActiveModule(m)} />
          ))}
        </div>

        {footprint.related.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Connects to</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {footprint.related.map(({ concept }) => (
                <button key={concept.id} onClick={() => ask(concept.topic, footprint.topic)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-b)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
                  {concept.topic}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={() => ask(footprint.topic)}
          style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: T.accent, color: T.onAccent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Ask about {footprint.topic} →
        </button>
      </div>,
    );
  }

  // ── Graph rollup ──────────────────────────────────────────────────────────
  const modules = Object.entries(summary.moduleCounts).sort((a, b) => b[1] - a[1]);
  return shell(
    <div>
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-b)', marginBottom: 14 }}>
        <b style={{ color: 'var(--text)' }}>{summary.conceptCount}</b> concept{summary.conceptCount === 1 ? '' : 's'} · <b style={{ color: 'var(--text)' }}>{summary.observationCount}</b> observations across <b style={{ color: 'var(--text)' }}>{modules.length}</b> module{modules.length === 1 ? '' : 's'}.
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {modules.map(([m, n]) => (
          <button key={m} onClick={() => setActiveModule(m)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
            <NavIcon id={m} size={13} strokeWidth={2} /> {moduleLabel(m)} <span style={{ color: 'var(--dim)' }}>{n}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Most connected</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {summary.mostConnected.map((c) => (
          <button key={c.topic} onClick={() => setPinned(c.topic)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit', outline: 'none', textAlign: 'left' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.topic}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', flexShrink: 0 }}>{c.modules} module{c.modules === 1 ? '' : 's'} · {c.links} link{c.links === 1 ? '' : 's'}</span>
          </button>
        ))}
      </div>
    </div>,
  );
}
