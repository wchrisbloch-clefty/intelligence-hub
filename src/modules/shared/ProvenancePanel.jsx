// src/modules/shared/ProvenancePanel.jsx — the tier legend, as a rail occupant.
// Explains the three source-trust tiers every artifact carries. Tier is source
// trust, never engagement (rigor.js TIER_INSTRUCTION).
import TierChip from './TierChip.jsx';
import './provenance-panel.css';

const ROWS = [
  ['verified', 'Traceable to primary source text with a location — in this app, only material you typed from your own copy.'],
  ['reported', 'Secondary: a publisher description, a retrieved table of contents, the author’s other work, a named article.'],
  ['inferred', 'Model synthesis. Useful, but nothing retrieved backs it.'],
];

export default function ProvenancePanel() {
  return (
    <section className="pv" aria-labelledby="pv-h">
      <div id="pv-h" className="pv-eyebrow">How to read the tiers</div>
      <ul className="pv-list">
        {ROWS.map(([t, d]) => (
          <li key={t} className="pv-row"><TierChip tier={t} /><span className="pv-desc">{d}</span></li>
        ))}
      </ul>
      <p className="pv-foot">A tier is how much to trust the source, never how popular it is.</p>
    </section>
  );
}
