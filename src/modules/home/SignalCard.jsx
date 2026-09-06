// src/modules/home/SignalCard.jsx — one Blue Ocean signal. Presentational; the
// parent owns generation, routing, and the feedback store. Every card shows its
// TYPE (adjacent / gap / convergence / decay / contrarian), a TIER chip, the
// traceable WHY, a routed next action, an Ask shortcut, and the pursue / not-now /
// not-relevant loop. Theme tokens + Icon registry only — no hardcoded hex.
import Icon from '../shared/Icon.jsx';
import TierChip from '../shared/TierChip.jsx';
import FollowButton from '../shared/FollowButton.jsx';
import { signalTypeMeta, actionMeta } from '../../lib/signals.js';

const VERDICTS = [
  ['pursue', 'Pursue', 'var(--positive)'],
  ['not-now', 'Not now', 'var(--caution)'],
  ['not-relevant', 'Not relevant', 'var(--text-tertiary)'],
];

export default function SignalCard({ signal, verdict, onAct, onAsk, onVerdict }) {
  const tm = signalTypeMeta(signal.type);
  const am = actionMeta(signal.action.kind);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 'var(--s5)', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tm.token, border: `1px solid ${tm.token}`, borderRadius: 5, padding: '2px 7px' }} title={tm.blurb}>
          <Icon name={tm.icon} size={12} /> {tm.label}
        </span>
        <TierChip tier={signal.tier} note={signal.market ? 'web' : undefined} />
      </div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', marginBottom: 6, lineHeight: 'var(--lh-tight)' }}>{signal.title}</div>
      {/* Why it surfaced — traceable, never a horoscope. */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Icon name="Compass" size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)', minWidth: 0, overflowWrap: 'anywhere' }}>{signal.reason}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <button onClick={() => onAct?.(signal)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
          <Icon name={am.icon} size={14} /> {am.label}
        </button>
        <button onClick={() => onAsk?.(signal)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
          Ask <Icon name="ArrowRight" size={13} />
        </button>
        <FollowButton name={signal.action?.target || signal.title} source="signal" style={{ minHeight: 34 }} />
      </div>
      {/* Feedback loop — persisted, fed back into the next generation. */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--rule)', flexWrap: 'wrap' }}>
        {VERDICTS.map(([v, label, color]) => (
          <button key={v} onClick={() => onVerdict?.(signal, v)}
            style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${verdict === v ? color : 'var(--rule)'}`, background: verdict === v ? color : 'transparent', color: verdict === v ? 'var(--on-accent)' : 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
