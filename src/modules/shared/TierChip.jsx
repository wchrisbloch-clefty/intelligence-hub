// One tier chip for the whole app — source-trust provenance, never engagement.
// verified = traceable to a named source · reported = credible secondary (named)
// · inferred = model synthesis. Uses the --tier-* tokens (no hardcoded hex).
import Icon from './Icon.jsx';

const TOK = { verified: '--tier-verified', reported: '--tier-reported', inferred: '--tier-inferred' };
const ICON = { verified: 'Check', reported: 'BookMarked', inferred: 'Sparkles' };

export default function TierChip({ tier, note, size = 9 }) {
  const t = TOK[tier] ? tier : 'inferred';
  const label = tier === 'reported' && note ? `reported · ${note}` : t;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: size, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: `var(${TOK[t]})`, border: `1px solid var(${TOK[t]})`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
      <Icon name={ICON[t]} size={11} /> {label}
    </span>
  );
}
