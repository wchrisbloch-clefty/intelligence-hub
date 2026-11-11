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
import './book-suggest.css';

export default function BookSuggest({ results = [], loading = false, query = '', onPick }) {
  return (
    <div className="bks">
      {loading && (
        <div className="bks-status" aria-live="polite">
          <ThinkingDots color="var(--accent-text)" /> Searching the catalog…
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="bks-status">
          No catalog match{query ? ` for “${query}”` : ''} — you can still add it as typed.
        </div>
      )}
      {!loading && results.map((m) => {
        const full = [m.title, m.subtitle].filter(Boolean).join(': ');
        const yr = (m.publishedDate || '').slice(0, 4);
        return (
          <button type="button" key={m.id || full} className="bks-row" onClick={() => onPick?.(m)}>
            {m.thumbnail
              ? <img src={m.thumbnail} alt="" width={34} className="bks-cover" />
              : <div className="bks-cover-ph"><Icon name="BookMarked" size={14} /></div>}
            <span className="bks-text">
              <span className="bks-title">{full}</span>
              <span className="bks-meta">
                {(m.authors || []).join(', ') || '—'}{yr ? ` · ${yr}` : ''}{m.publisher ? ` · ${m.publisher}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
