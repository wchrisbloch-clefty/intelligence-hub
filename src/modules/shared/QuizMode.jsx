import { useState } from 'react';
import { Btn } from './Common.jsx';

export default function QuizMode({ questions, onComplete, color = 'var(--accent)' }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState([]);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  const advance = (score) => {
    const next = [...scores, score];
    setScores(next);
    if (isLast) { onComplete(next); return; }
    setTimeout(() => { setIdx(i => i + 1); setSelected(null); setOpenAnswer(''); setRevealed(false); }, 300);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 20, marginBottom: 16, animation: 'fadeUp 0.2s ease' }}>
      {/* header — yard-line progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--accent)', textTransform: 'uppercase' }}>Question {idx + 1} of {questions.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < scores.length ? (scores[i] > 0 ? 'var(--accent)' : 'var(--red)') : i === idx ? 'var(--accent-glow)' : 'var(--line)', transition: 'background 0.3s ease' }} />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--chalk)', lineHeight: 1.6, marginBottom: 18 }}>{q.q}</div>

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
                style={{ padding: '11px 14px', borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: revealed ? 'default' : 'pointer', fontSize: 13, color: textColor, transition: 'all 0.15s', minHeight: 42, display: 'flex', alignItems: 'center' }}>
                {opt}
              </div>
            );
          })}
          {!revealed
            ? <Btn color={color} disabled={!selected} onClick={() => setRevealed(true)} size="sm">Check answer</Btn>
            : <>
                <div style={{ fontSize: 12, color: selected === q.answer ? 'var(--accent)' : 'var(--red)', padding: '8px 12px', background: selected === q.answer ? 'var(--accent-glow)' : 'rgba(196,85,61,0.08)', borderRadius: 6, marginBottom: 8 }}>
                  {selected === q.answer ? '✓ Correct' : `✗ Correct answer: ${q.answer}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--chalk-dim)', lineHeight: 1.65, marginBottom: 10 }}>{q.explanation}</div>
                <Btn color={color} size="sm" onClick={() => advance(selected === q.answer ? 1 : 0)}>{isLast ? 'See results' : 'Next →'}</Btn>
              </>
          }
        </div>
      )}

      {/* Open / apply */}
      {(q.type === 'open' || q.type === 'apply') && (
        <div>
          <textarea value={openAnswer} onChange={e => setOpenAnswer(e.target.value)} placeholder="Type your answer…"
            rows={3} style={{ width: '100%', background: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', color: 'var(--chalk)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
          {!revealed
            ? <Btn color={color} size="sm" disabled={!openAnswer.trim()} onClick={() => setRevealed(true)}>Reveal answer</Btn>
            : <>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 5, fontStyle: 'italic' }}>Model answer</div>
                <div style={{ fontSize: 12, color: 'var(--text-b)', lineHeight: 1.65, marginBottom: 8, padding: '8px 12px', background: 'var(--accent-glow)', borderRadius: 6 }}>{q.answer}</div>
                {q.explanation && <div style={{ fontSize: 12, color: 'var(--chalk-dim)', lineHeight: 1.6, marginBottom: 10 }}>{q.explanation}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => advance(0)} style={{ flex: 1, padding: '10px', background: 'rgba(196,85,61,0.10)', border: '1px solid var(--red)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: 'var(--red)', cursor: 'pointer', minHeight: 40 }}>Missed it</div>
                  <div onClick={() => advance(1)} style={{ flex: 1, padding: '10px', background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', minHeight: 40 }}>Got it</div>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}
