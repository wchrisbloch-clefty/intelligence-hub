// src/modules/home/SignalCard.jsx — one Blue Ocean signal. Presentational; the
// parent owns generation, routing, and the feedback store. Every card shows its
// TYPE (adjacent / gap / convergence / decay / contrarian), a TIER chip, the
// traceable WHY, a routed next action, an Ask shortcut, and the pursue / not-now /
// not-relevant loop. Styles: home.css (op-/sc-). Tokens only.
import Icon from '../shared/Icon.jsx';
import TierChip from '../shared/TierChip.jsx';
import FollowButton from '../shared/FollowButton.jsx';
import { signalTypeMeta, actionMeta } from '../../lib/signals.js';

const VERDICTS = [
  ['pursue', 'Pursue', 'var(--positive)'],
  ['not-now', 'Not now', 'var(--caution)'],
  ['not-relevant', 'Not relevant', 'var(--text-subtle)'],
];

export default function SignalCard({ signal, verdict, onAct, onAsk, onVerdict }) {
  const tm = signalTypeMeta(signal.type);
  const am = actionMeta(signal.action.kind);
  return (
    <article className="sc">
      <div className="sc-top">
        <span className="sc-type" style={{ '--t': tm.token }} title={tm.blurb}>
          <Icon name={tm.icon} size={12} /> {tm.label}
        </span>
        <TierChip tier={signal.tier} note={signal.market ? 'web' : undefined} />
      </div>
      <h3 className="sc-title">{signal.title}</h3>
      {/* Why it surfaced — traceable, never a horoscope. */}
      <div className="sc-why">
        <Icon name="Compass" size={14} />
        <span>{signal.reason}</span>
      </div>
      <div className="sc-actions">
        <button type="button" className="btn btn-primary tap" onClick={() => onAct?.(signal)}>
          <Icon name={am.icon} size={14} /> {am.label}
        </button>
        <button type="button" className="btn tap" onClick={() => onAsk?.(signal)}>
          Ask <Icon name="ArrowRight" size={13} />
        </button>
        <FollowButton name={signal.action?.target || signal.title} source="signal" />
      </div>
      {/* Feedback loop — persisted, fed back into the next generation. */}
      <div className="sc-verdicts" role="group" aria-label="Your verdict">
        {VERDICTS.map(([v, label, color]) => (
          <button type="button" key={v} className="chip sc-verdict tap" style={{ '--v': color }}
            aria-pressed={verdict === v} onClick={() => onVerdict?.(signal, v)}>
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}
