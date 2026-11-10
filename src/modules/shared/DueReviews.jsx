import { useState, useEffect } from 'react';
import { loadIndex, hydrateIndex, dueReviews, gradeTopic, GRADES } from '../../lib/reviews.js';
import './due-reviews.css';

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
    <div className="dr">
      <div className="dr-head">
        <span className="dr-glyph" aria-hidden="true">🔁</span>
        <div className="dr-kicker">Due for review today</div>
        <div className="dr-count">{due.length} {due.length === 1 ? 'topic' : 'topics'}</div>
      </div>

      {due.map(r => (
        <div key={r.topicId} className="dr-item">
          <div className="dr-item-row">
            <div className="dr-item-main">
              <div className="dr-topic">{r.topicLabel}</div>
              <div className="dr-meta">Last: {r.lastResult} · ease {r.ease}</div>
            </div>
            {onQuiz && (
              <button type="button" className="dr-quiz tap" onClick={() => onQuiz(r.topicLabel)} title="Quiz me">Quiz →</button>
            )}
          </div>
          <div className="dr-grades">
            {GRADES.map(g => (
              <button type="button" key={g.id} className="dr-grade tap" onClick={(e) => grade(r.topicId, g.quality, e)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
