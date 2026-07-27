import { T } from '../../theme';
import { useState, useEffect } from 'react';
import { loadIndex, hydrateIndex, dueReviews, gradeTopic, GRADES } from '../../lib/reviews.js';

const ACCENT = T.accent;

// "Due for review today" — SM-2 items whose dueAt has passed. Grading a card
// (Again/Hard/Good/Easy) reschedules it and drops it from today's list.
export default function DueReviews({ onQuiz }) {
  const [index, setIndex] = useState(() => loadIndex());

  useEffect(() => { hydrateIndex().then(r => { if (Array.isArray(r)) setIndex(r); }); }, []);

  const due = dueReviews(index);
  if (due.length === 0) return null;

  const grade = (topicId, quality, e) => {
    e.stopPropagation();
    gradeTopic(topicId, quality);
    setIndex(loadIndex());
  };

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>🔁</span>
        <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 2, textTransform: 'uppercase' }}>Due for review today</div>
        <div style={{ fontSize: 10, color: 'var(--dim)', marginLeft: 'auto' }}>{due.length} {due.length === 1 ? 'topic' : 'topics'}</div>
      </div>

      {due.map(r => (
        <div key={r.topicId} style={{ padding: '10px 0', borderTop: '1px solid var(--bord2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.topicLabel}</div>
              <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>Last: {r.lastResult} · ease {r.ease}</div>
            </div>
            {onQuiz && (
              <div onClick={() => onQuiz(r.topicLabel)} title="Quiz me" style={{ flexShrink: 0, fontSize: 10, color: ACCENT, cursor: 'pointer', fontWeight: 700 }}>Quiz →</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {GRADES.map(g => (
              <div key={g.id} onClick={(e) => grade(r.topicId, g.quality, e)}
                style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}>
                {g.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
