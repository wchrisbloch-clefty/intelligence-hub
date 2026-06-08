import { useState } from 'react';
import { Btn } from './Common.jsx';

export default function QuizMode({ questions, onComplete, color = '#00FFB2' }) {
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
    <div style={{ background: '#0a0a18', border: `1px solid ${color}30`, borderRadius: 14, padding: 20, marginBottom: 16, animation: 'fadeUp 0.2s ease' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color, textTransform: 'uppercase' }}>Quiz · {idx + 1} of {questions.length}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {questions.map((_, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < scores.length ? (scores[i] > 0 ? color : '#ff4444') : i === idx ? `${color}70` : '#1e2a38' }} />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.7, marginBottom: 18 }}>{q.q}</div>

      {/* Multiple choice */}
      {q.type === 'mc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((opt, i) => {
            const letter = opt[0];
            const isCorrect = letter === q.answer;
            const isSelected = selected === letter;
            let bg = '#0c0c18', border = '#1e2a38', textColor = '#b0c0d0';
            if (revealed) {
              if (isCorrect)       { bg = `${color}18`; border = color; textColor = '#fff'; }
              else if (isSelected) { bg = '#ff444418'; border = '#ff4444'; }
            } else if (isSelected) { bg = `${color}12`; border = `${color}60`; }
            return (
              <div key={i} onClick={() => !revealed && setSelected(letter)}
                style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${border}`, background: bg, cursor: revealed ? 'default' : 'pointer', fontSize: 12, color: textColor, transition: 'all 0.15s' }}>
                {opt}
              </div>
            );
          })}
          {!revealed
            ? <Btn color={color} disabled={!selected} onClick={() => setRevealed(true)} size="sm">Check Answer</Btn>
            : <>
                <div style={{ fontSize: 11, color: selected === q.answer ? color : '#ff6644', padding: '8px 12px', background: selected === q.answer ? `${color}10` : '#ff444410', borderRadius: 6, marginBottom: 8 }}>
                  {selected === q.answer ? '✓ Correct' : `✗ Correct answer: ${q.answer}`}
                </div>
                <div style={{ fontSize: 11, color: '#778', lineHeight: 1.65, marginBottom: 10 }}>{q.explanation}</div>
                <Btn color={color} size="sm" onClick={() => advance(selected === q.answer ? 1 : 0)}>{isLast ? 'See Results' : 'Next →'}</Btn>
              </>
          }
        </div>
      )}

      {/* Open / apply */}
      {(q.type === 'open' || q.type === 'apply') && (
        <div>
          <textarea value={openAnswer} onChange={e => setOpenAnswer(e.target.value)} placeholder="Type your answer..."
            rows={3} style={{ width: '100%', background: '#0c0c18', border: '1px solid #1e2a38', borderRadius: 8, padding: '10px 12px', color: '#c8d4e0', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
          {!revealed
            ? <Btn color={color} size="sm" disabled={!openAnswer.trim()} onClick={() => setRevealed(true)}>Reveal Answer</Btn>
            : <>
                <div style={{ fontSize: 10, color: '#556', marginBottom: 5, fontStyle: 'italic' }}>Model answer:</div>
                <div style={{ fontSize: 11, color: '#b0c0d0', lineHeight: 1.65, marginBottom: 8, padding: '8px 12px', background: `${color}08`, borderRadius: 6 }}>{q.answer}</div>
                {q.explanation && <div style={{ fontSize: 11, color: '#445', lineHeight: 1.6, marginBottom: 10 }}>{q.explanation}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={() => advance(0)} style={{ flex: 1, padding: '8px', background: '#ff444412', border: '1px solid #ff444430', borderRadius: 8, textAlign: 'center', fontSize: 11, color: '#ff6644', cursor: 'pointer' }}>Missed it</div>
                  <div onClick={() => advance(1)} style={{ flex: 1, padding: '8px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, textAlign: 'center', fontSize: 11, color, cursor: 'pointer' }}>Got it</div>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}
