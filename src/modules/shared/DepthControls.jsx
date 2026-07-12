import { DEPTH_META } from '../../utils.js';

const ACCENT = '#D9A441';

// Shown before a heavy tier runs — never auto-run a research job silently.
// The user picks: quick take now, or the full sourced Deep Dive.
export function DepthConfirm({ topic, onQuick, onDeep, onClose }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16, animation: 'fadeUp 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 16, lineHeight: 1.2 }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>This looks like a Deep Dive</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
            I can pull live sources and build a structured, saveable brief{topic ? ` on "${topic}"` : ''} — it takes longer — or give you a quick take right now. Which?
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div onClick={onDeep}
              style={{ padding: '8px 14px', borderRadius: 8, background: ACCENT, color: '#1A130A', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
              ⚡ Build the Deep Dive
            </div>
            <div onClick={onQuick}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-b)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Quick take now
            </div>
            {onClose && (
              <div onClick={onClose}
                style={{ padding: '8px 10px', color: 'var(--dim)', fontSize: 11, cursor: 'pointer' }}>
                Cancel
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Visible "Going Deep" banner while a heavy tier runs.
export function GoingDeepBanner({ depth = 'expert', note }) {
  const meta = DEPTH_META[depth] || DEPTH_META.expert;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--accent-glow)', border: `1px solid ${ACCENT}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      <span style={{ fontSize: 14, animation: 'pulse 1.2s infinite ease-in-out' }}>🔦</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: 1, textTransform: 'uppercase' }}>Going Deep · {meta.label}</div>
        <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          {note || 'Pulling live sources and building your brief — this takes longer than a quick answer.'}
        </div>
      </div>
    </div>
  );
}
