// src/modules/shared/BookSuggest.jsx — the live catalog-suggestion dropdown for
// Add Book. Presentational: the parent debounces the query and owns selection.
// Each row shows cover · full title (with subtitle) · author-as-catalogued · year
// · publisher, so the user picks the exact edition instead of typing a guess.
//
// Phone-first: the list is absolutely positioned under the title field and scrolls
// inside its own capped box, so it stays usable with a soft keyboard open. Theme
// tokens + Icon registry only — no hardcoded hex or font sizes.
import Icon from './Icon.jsx';
import { ThinkingDots } from './Common.jsx';

export default function BookSuggest({ results = [], loading = false, query = '', onPick }) {
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 320, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', WebkitOverflowScrolling: 'touch' }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          <ThinkingDots color="var(--accent)" /> Searching the catalog…
        </div>
      )}
      {!loading && results.length === 0 && (
        <div style={{ padding: '12px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          No catalog match{query ? ` for “${query}”` : ''} — you can still add it as typed.
        </div>
      )}
      {!loading && results.map((m) => {
        const full = [m.title, m.subtitle].filter(Boolean).join(': ');
        const yr = (m.publishedDate || '').slice(0, 4);
        return (
          <button key={m.id || full} onClick={() => onPick?.(m)}
            style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', cursor: 'pointer', fontFamily: 'inherit', alignItems: 'flex-start', minHeight: 56 }}>
            {m.thumbnail
              ? <img src={m.thumbnail} alt="" width={34} style={{ borderRadius: 4, flexShrink: 0, border: '1px solid var(--border)' }} />
              : <div style={{ width: 34, height: 48, borderRadius: 4, flexShrink: 0, background: 'var(--surf2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="BookMarked" size={14} style={{ color: 'var(--dim)' }} /></div>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)' }}>{full}</span>
              <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2, overflowWrap: 'anywhere' }}>
                {(m.authors || []).join(', ') || '—'}{yr ? ` · ${yr}` : ''}{m.publisher ? ` · ${m.publisher}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
