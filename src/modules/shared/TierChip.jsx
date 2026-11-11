// One tier chip for the whole app — source-trust provenance, never engagement.
// verified = traceable to a named source · reported = credible secondary (named)
// · inferred = model synthesis. Uses the --tier-* tokens (tier-chip.css, tc-).
import Icon from './Icon.jsx';
import './tier-chip.css';

const TIERS = new Set(['verified', 'reported', 'inferred']);
const ICON = { verified: 'Check', reported: 'BookMarked', inferred: 'Sparkles' };

export default function TierChip({ tier, note, size = 9 }) {
  const t = TIERS.has(tier) ? tier : 'inferred';
  const label = tier === 'reported' && note ? `reported · ${note}` : t;
  return (
    <span className="tc" data-tier={t} style={{ '--tc-size': `${size}px` }}>
      <Icon name={ICON[t]} size={11} /> {label}
    </span>
  );
}
