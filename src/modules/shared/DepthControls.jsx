import { DEPTH_META } from '../../utils.js';
import './depth-controls.css';

// Shown before a heavy tier runs — never auto-run a research job silently.
// The user picks: quick take now, or the full sourced Deep Dive.
export function DepthConfirm({ topic, onQuick, onDeep, onClose }) {
  return (
    <div className="dpc-confirm">
      <div className="dpc-row">
        <span className="dpc-glyph" aria-hidden="true">⚡</span>
        <div className="dpc-main">
          <div className="dpc-title">This looks like a Deep Dive</div>
          <div className="dpc-body">
            I can pull live sources and build a structured, saveable brief{topic ? ` on "${topic}"` : ''} — it takes longer — or give you a quick take right now. Which?
          </div>
          <div className="dpc-actions">
            <button type="button" className="btn btn-primary tap" onClick={onDeep}>
              ⚡ Build the Deep Dive
            </button>
            <button type="button" className="btn tap" onClick={onQuick}>
              Quick take now
            </button>
            {onClose && (
              <button type="button" className="btn btn-ghost tap" onClick={onClose}>
                Cancel
              </button>
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
    <div className="dpc-banner" role="status">
      <span className="dpc-banner-glyph" aria-hidden="true">🔦</span>
      <div className="dpc-banner-main">
        <div className="dpc-banner-kicker">Going Deep · {meta.label}</div>
        <div className="dpc-banner-note">
          {note || 'Pulling live sources and building your brief — this takes longer than a quick answer.'}
        </div>
      </div>
    </div>
  );
}
