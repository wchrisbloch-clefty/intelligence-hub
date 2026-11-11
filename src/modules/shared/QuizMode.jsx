import { useState } from 'react';
import { Btn } from './Common.jsx';
import TierChip from './TierChip.jsx';
import './quiz-mode.css';

// Shared quiz-taking surface for both QuizCenter and LearningCenter.
// onComplete(results) receives one object per question:
//   { type, question, answer, correct, model, explanation, score }
//   - score: 1 / 0 for graded questions, null for self-rating ('rate')
//   - correct: bool for 'mc', null otherwise
//   - answer: the letter (mc), the typed text (open/apply), or the rating (rate)
// sourceTier: the tier of the material the questions were generated from. A quiz
//   never asserts its own trust — it inherits its source's, shown on each answer
//   reveal so an ungrounded question can't look more certain than its source.
export default function QuizMode({ questions, onComplete, color = 'var(--accent)', sourceTier }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [rating, setRating] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  const advance = (result) => {
    const next = [...results, result];
    setResults(next);
    if (isLast) { onComplete(next); return; }
    setTimeout(() => {
      setIdx(i => i + 1);
      setSelected(null); setOpenAnswer(''); setRating(null); setRevealed(false);
    }, 300);
  };

  const base = () => ({ type: q.type, question: q.q, model: q.answer || '', explanation: q.explanation || '' });

  // Inherited source trust — a quiz is only as certain as what it was built from.
  const tierBadge = sourceTier ? (
    <div className="qm-tier">
      <TierChip tier={sourceTier} size={8} />
      <span className="qm-tier-note">inherited from source</span>
    </div>
  ) : null;

  return (
    <div className="qm">
      {/* header — yard-line progress */}
      <div className="qm-head">
        <div className="qm-head-row">
          <div className="qm-kicker">Question {idx + 1} of {questions.length}</div>
        </div>
        <div className="qm-track">
          {questions.map((_, i) => {
            const r = results[i];
            const st = i < results.length
              ? (r.score === null || r.score > 0 ? 'done' : 'miss')
              : i === idx ? 'current' : undefined;
            return <div key={i} className="qm-seg" data-state={st} />;
          })}
        </div>
      </div>

      <div className="qm-q">{q.q}</div>

      {/* Multiple choice */}
      {q.type === 'mc' && (
        <div className="qm-opts">
          {q.options.map((opt, i) => {
            const letter = opt[0];
            const isCorrect = letter === q.answer;
            const isSelected = selected === letter;
            let st;
            if (revealed) st = isCorrect ? 'correct' : isSelected ? 'wrong' : undefined;
            else if (isSelected) st = 'selected';
            return (
              <button type="button" key={i} className="qm-opt" data-state={st} aria-pressed={isSelected}
                disabled={revealed} onClick={() => setSelected(letter)}>
                {opt}
              </button>
            );
          })}
          {!revealed
            ? <Btn color={color} disabled={!selected} onClick={() => setRevealed(true)} size="sm">Check answer</Btn>
            : <>
                <div className="qm-verdict" data-ok={selected === q.answer ? '1' : '0'}>
                  {selected === q.answer ? '✓ Correct' : `✗ Correct answer: ${q.answer}`}
                </div>
                {tierBadge}
                <div className="qm-expl">{q.explanation}</div>
                <Btn color={color} size="sm" onClick={() => advance({ ...base(), answer: selected, correct: selected === q.answer, score: selected === q.answer ? 1 : 0 })}>{isLast ? 'See results' : 'Next →'}</Btn>
              </>
          }
        </div>
      )}

      {/* Self-rating 1–5 */}
      {q.type === 'rate' && (
        <div>
          <div className="qm-rates">
            {[1, 2, 3, 4, 5].map(v => (
              <button type="button" key={v} className="qm-rate" aria-pressed={rating === v} onClick={() => setRating(v)}>
                {v}
              </button>
            ))}
          </div>
          <Btn color={color} size="sm" disabled={rating === null} onClick={() => advance({ ...base(), answer: String(rating), correct: null, score: null })}>{isLast ? 'See results' : 'Next →'}</Btn>
        </div>
      )}

      {/* Open / apply */}
      {(q.type === 'open' || q.type === 'apply') && (
        <div>
          <textarea value={openAnswer} onChange={e => setOpenAnswer(e.target.value)} placeholder="Type your answer…"
            rows={3} className="qm-answer" aria-label="Your answer" />
          {!revealed
            ? <Btn color={color} size="sm" disabled={!openAnswer.trim()} onClick={() => setRevealed(true)}>Reveal answer</Btn>
            : <>
                <div className="qm-model-label">Model answer</div>
                {tierBadge}
                <div className="qm-model">{q.answer}</div>
                {q.explanation && <div className="qm-expl">{q.explanation}</div>}
                <div className="qm-self">
                  <button type="button" className="qm-self-btn" data-kind="miss" onClick={() => advance({ ...base(), answer: openAnswer, correct: null, score: 0 })}>Missed it</button>
                  <button type="button" className="qm-self-btn" data-kind="got" onClick={() => advance({ ...base(), answer: openAnswer, correct: null, score: 1 })}>Got it</button>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}
