import { useState } from 'react';
import { useApp } from '../../App.jsx';
import { graphSummary, conceptFootprint } from '../../lib/graph.js';
import { MODE_META } from '../../constants.js';
import NavIcon from './NavIcon.jsx';
import './connected-knowledge.css';

// The payoff of Phase 2: one panel that shows what a topic touches across every
// module — which modules have studied it, what it connects to, and where those
// observations came from. Self-contained: pass a `topic` to pin one, or leave it
// null and it opens on the graph rollup, drilling into any concept on tap.
// Styles: connected-knowledge.css (ck-). Tokens only.

const moduleLabel = (m) => MODE_META[m]?.label || m;

export default function ConnectedKnowledge({ topic = null, compact = false }) {
  const { setActiveModule, setChatPrefill, setChatOpen } = useApp();
  const [pinned, setPinned] = useState(topic);
  const summary = graphSummary();

  const shell = (children) => (
    <div className="ck" data-compact={compact ? '1' : '0'}>
      <div className="ck-eyebrow">Connected Knowledge</div>
      {children}
    </div>
  );

  if (summary.conceptCount === 0) {
    return shell(
      <div className="ck-empty" data-status="empty">
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
        <div className="ck-pin-head">
          <div style={{ minWidth: 0 }}>
            <div className="ck-pin-title">{footprint.topic}</div>
            <div className="ck-meta">
              {footprint.observations} observation{footprint.observations === 1 ? '' : 's'}
              {typeof footprint.confidence === 'number' ? ` · confidence ${footprint.confidence}/10` : ''}
            </div>
          </div>
          {!topic && <button type="button" className="btn tap" onClick={() => setPinned(null)}>← Graph</button>}
        </div>

        <div className="ck-label">Touched in</div>
        <div className="ck-chips">
          {footprint.modules.map((m) => (
            <button type="button" key={m} className="chip tap" onClick={() => setActiveModule(m)}>
              <NavIcon id={m} size={13} strokeWidth={2} /> {moduleLabel(m)}
            </button>
          ))}
        </div>

        {footprint.related.length > 0 && (
          <>
            <div className="ck-label">Connects to</div>
            <div className="ck-chips">
              {footprint.related.map(({ concept }) => (
                <button type="button" key={concept.id} className="chip tap" onClick={() => ask(concept.topic, footprint.topic)}>
                  {concept.topic}
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" className="btn btn-primary ck-ask tap" onClick={() => ask(footprint.topic)}>
          Ask about {footprint.topic} →
        </button>
      </div>,
    );
  }

  // ── Graph rollup ──────────────────────────────────────────────────────────
  const modules = Object.entries(summary.moduleCounts).sort((a, b) => b[1] - a[1]);
  return shell(
    <div>
      <div className="ck-summary">
        <b>{summary.conceptCount}</b> concept{summary.conceptCount === 1 ? '' : 's'} · <b>{summary.observationCount}</b> observations across <b>{modules.length}</b> module{modules.length === 1 ? '' : 's'}.
      </div>

      <div className="ck-chips">
        {modules.map(([m, n]) => (
          <button type="button" key={m} className="chip tap" onClick={() => setActiveModule(m)}>
            <NavIcon id={m} size={13} strokeWidth={2} /> {moduleLabel(m)} <span className="ck-count">{n}</span>
          </button>
        ))}
      </div>

      <div className="ck-label">Most connected</div>
      <div className="ck-list">
        {summary.mostConnected.map((c) => (
          <button type="button" key={c.topic} className="ck-row tap" onClick={() => setPinned(c.topic)}>
            <span className="ck-row-name">{c.topic}</span>
            <span className="ck-row-meta">{c.modules} module{c.modules === 1 ? '' : 's'} · {c.links} link{c.links === 1 ? '' : 's'}</span>
          </button>
        ))}
      </div>
    </div>,
  );
}
