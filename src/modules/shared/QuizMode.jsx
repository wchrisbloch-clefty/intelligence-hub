import { useState } from 'react';
import { Btn } from './Common.jsx';
import TierChip from './TierChip.jsx';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <TierChip tier={sourceTier} size={8} />
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>inherited from source</span>
    </div>
  ) : null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 20, marginBottom: 16, animation: 'fadeUp 0.2s ease' }}>
      {/* header — yard-line progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--accent)', textTransform: 'uppercase' }}>Question {idx + 1} of {questions.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {questions.map((_, i) => {
            const r = results[i];
            const bg = i < results.length
              ? (r.score === null ? 'var(--accent)' : r.score > 0 ? 'var(--accent)' : 'var(--red)')
              : i === idx ? 'var(--accent-glow)' : 'var(--line)';
            return <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: bg, transition: 'background 0.3s ease' }} />;
          })}
        </div>
      </div>

      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--chalk)', lineHeight: 1.6, marginBottom: 18 }}>{q.q}</div>

      {/* Multiple choice */}
      {q.type === 'mc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            const letter = opt[0];
            const isCorrect = letter === q.answer;
            const isSelected = selected === letter;
            let bg = 'var(--ink)', border = 'var(--line)', textColor = 'var(--text-b)';
            if (revealed) {
              if (isCorrect)       { bg = 'var(--accent-glow)'; border = 'var(--accent)'; textColor = 'var(--chalk)'; }
              else if (isSelected) { bg = 'rgba(196,85,61,0.10)'; border = 'var(--red)'; }
            } else if (isSelected) { bg = 'var(--accent-glow)'; border = 'var(--accent)'; }
            return (
              <div key={i} onClick={() => !revealed && setSelected(letter)}
                style={{ padding: '11px 14px', borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: revealed ? 'default' : 'pointer', fontSize: 'var(--fs-base)', color: textColor, transition: 'all 0.15s', minHeight: 42, display: 'flex', alignItems: 'center' }}>
                {opt}
              </div>
            );
          })}
          {!revealed
            ? <Btn color={color} disabled={!selected} onClick={() => setRevealed(true)} size="sm">Check answer</Btn>
            : <>
                <div style={{ fontSize: 'var(--fs-base)', color: selected === q.answer ? 'var(--accent)' : 'var(--red)', padding: '8px 12px', background: selected === q.answer ? 'var(--accent-glow)' : 'rgba(196,85,61,0.08)', borderRadius: 6, marginBottom: 8 }}>
                  {selected === q.answer ? '✓ Correct' : `✗ Correct answer: ${q.answer}`}
                </div>
                {tierBadge}
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--chalk-dim)', lineHeight: 1.65, marginBottom: 10 }}>{q.explanation}</div>
                <Btn color={color} size="sm" onClick={() => advance({ ...base(), answer: selected, correct: selected === q.answer, score: selected === q.answer ? 1 : 0 })}>{isLast ? 'See results' : 'Next →'}</Btn>
              </>
          }
        </div>
      )}

      {/* Self-rating 1–5 */}
      {q.type === 'rate' && (
        <div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map(v => (
              <div key={v} onClick={() => setRating(v)}
                style={{ width: 48, height: 48, borderRadius: 10, border: `2px solid ${rating === v ? 'var(--accent)' : 'var(--line)'}`, background: rating === v ? 'var(--accent-glow)' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-lg)', fontWeight: 800, color: rating === v ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', transition: 'all 0.1s' }}>
                {v}
              </div>
            ))}
          </div>
          <Btn color={color} size="sm" disabled={rating === null} onClick={() => advance({ ...base(), answer: String(rating), correct: null, score: null })}>{isLast ? 'See results' : 'Next →'}</Btn>
        </div>
      )}

      {/* Open / apply */}
      {(q.type === 'open' || q.type === 'apply') && (
        <div>
          <textarea value={openAnswer} onChange={e => setOpenAnswer(e.target.value)} placeholder="Type your answer…"
            rows={3} style={{ width: '100%', background: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', color: 'var(--chalk)', fontSize: 'var(--fs-base)', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
          {!revealed
            ? <Btn color={color} size="sm" disabled={!openAnswer.trim()} onClick={() => setRevealed(true)}>Reveal answer</Btn>
            : <>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)', marginBottom: 5, fontStyle: 'italic' }}>Model answer</div>
                {tierBadge}
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-b)', lineHeight: 1.65, marginBottom: 8, padding: '8px 12px', background: 'var(--accent-glow)', borderRadius: 6 }}>{q.answer}</div>
                {q.explanation && <div style={{ fontSize: 'var(--fs-base)', color: 'var(--chalk-dim)', lineHeight: 1.6, marginBottom: 10 }}>{q.explanation}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => advance({ ...base(), answer: openAnswer, correct: null, score: 0 })} style={{ flex: 1, padding: '10px', background: 'rgba(196,85,61,0.10)', border: '1px solid var(--red)', borderRadius: 8, textAlign: 'center', fontSize: 'var(--fs-base)', color: 'var(--red)', cursor: 'pointer', minHeight: 40 }}>Missed it</div>
                  <div onClick={() => advance({ ...base(), answer: openAnswer, correct: null, score: 1 })} style={{ flex: 1, padding: '10px', background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 8, textAlign: 'center', fontSize: 'var(--fs-base)', color: 'var(--accent)', cursor: 'pointer', minHeight: 40 }}>Got it</div>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}
