// src/modules/shared/SectionState.jsx — the per-section state contract (Batch Z / A2).
// Ported from mynewshub2 (src/modules/section-state). Every generating surface
// reports one of four states and renders exactly one of these for the non-ready ones:
//
//   status: 'ready' | 'loading' | 'empty' | 'error'
//
//   loading → <SectionSkeleton>  reserved height that mirrors the final layout,
//                                so content swapping in causes no layout shift.
//   error   → <SectionError>     a compact inline row (≤64px). Retry re-runs ONLY
//                                this section's fetch, never the page.
//   empty   → <SectionEmpty>     states what is missing and what produces it.
//                                Direction, not an apology.
//
// No colours in here — tokens only, in the co-located section-state.css.
import './section-state.css';

export const STATUS = Object.freeze({ READY: 'ready', LOADING: 'loading', EMPTY: 'empty', ERROR: 'error' });

export function SectionSkeleton({ rows = 3, lead = false, label = '' }) {
  return (
    <div className="ss-skel" aria-busy="true" aria-label={label ? `Loading ${label}` : 'Loading'}>
      {lead && <div className="ss-skel-lead shimmer" />}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ss-skel-row">
          <div className="ss-skel-lines">
            <span className="shimmer" /><span className="shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionError({ label = 'this section', onRetry, detail }) {
  return (
    <div className="ss-error" role="alert">
      <span className="ss-error-text" title={detail || undefined}>Couldn’t load {label}</span>
      {onRetry && (
        <button className="ss-error-retry tap focus-ring" type="button" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

// what = what's missing ("No study guide yet"); how = what produces it
// ("Pick a book and tap Generate"). Optional action button.
export function SectionEmpty({ what, how, actionLabel, onAction }) {
  return (
    <div className="ss-empty">
      <div className="ss-empty-what">{what}</div>
      {how && <div className="ss-empty-how">{how}</div>}
      {actionLabel && onAction && (
        <button className="ss-empty-action tap focus-ring" type="button" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

// Convenience: render the right state for a status, or children when ready.
export function SectionState({ status, label, rows, lead, onRetry, error, empty, children }) {
  if (status === 'loading') return <SectionSkeleton rows={rows} lead={lead} label={label} />;
  if (status === 'error') return <SectionError label={label} onRetry={onRetry} detail={error} />;
  if (status === 'empty') return <SectionEmpty {...(empty || {})} />;
  return children ?? null;
}

export default SectionState;
