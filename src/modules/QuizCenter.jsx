import { T } from '../theme';
import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildQuizPrompt } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { recordQuizResult } from '../lib/reviews.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import QuizMode from './shared/QuizMode.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT        = T.accent;
const ACCENT_BG     = 'rgba(217,164,65,0.08)';
const ACCENT_BORDER = 'rgba(217,164,65,0.22)';

const PRESET_TOPICS = [
  { id: 'realestate',  label: 'Real Estate',          icon: '🏘', desc: 'Multifamily, cash flow, cap rates, market dynamics' },
  { id: 'leadership',  label: 'Extreme Ownership',     icon: '⚡', desc: 'Jocko\'s framework — accountability, decision-making, discipline' },
  { id: 'negotiation', label: 'Negotiation',           icon: '🤝', desc: 'Voss tactics, tactical empathy, deal dynamics' },
  { id: 'longevity',   label: 'Longevity Protocol',    icon: '🏋', desc: 'Attia frameworks — Zone 2, VO₂Max, strength, sleep' },
  { id: 'bd',          label: 'BD & Sales Systems',    icon: '🚀', desc: 'Pipeline, prospecting, closing, AI-augmented workflows' },
  { id: 'finance',     label: 'Finance & Investing',   icon: '📈', desc: 'Dividends, covered calls, compounding, risk management' },
  { id: 'systems',     label: 'Systems Thinking',      icon: '⚙️', desc: 'Tipping points, compounding effects, leverage points' },
  { id: 'stoic',       label: 'Stoic Philosophy',      icon: '🪨', desc: 'Marcus Aurelius, Seneca, Epictetus — adversity as data' },
];

const STORAGE_KEY = 'aether_quiz_results';

// Quiz history persists cross-device: instant local read, server write-through.
function loadResults() { return readLocal(STORAGE_KEY, []); }
function saveResults(r) { writeThrough(STORAGE_KEY, r); }

function buildGapPrompt(topic, topicLabel, results) {
  const summary = results.map((r, i) => {
    if (r.type === 'mc') return `Q${i + 1} (MC): ${r.correct ? 'Correct' : 'Wrong'} — ${r.question}`;
    if (r.type === 'rate') return `Q${i + 1} (Self-rate): ${r.answer}/5 — ${r.question}`;
    return `Q${i + 1} (Open/Apply): "${r.answer}" — ${r.question}`;
  }).join('\n');

  return `CB just completed a self-assessment quiz on "${topicLabel}".

Results:
${summary}

Score: ${results.filter(r => r.type === 'mc' && r.correct).length}/${results.filter(r => r.type === 'mc').length} MC correct
Self-ratings: ${results.filter(r => r.type === 'rate').map(r => `${r.answer}/5`).join(', ')}

Provide CB's gap analysis. Format:
**✅ Solid Ground** — What CB clearly has down (2-3 specific points)
**⚠️ Gap Zone** — Where CB's knowledge has holes (be specific — name the exact framework or concept)
**🎯 Priority Deepening** — The ONE area CB should focus on next (with reasoning)
**📚 Recommended Next Step** — Specific book, talk, or practice to close the gap

Be direct. No padding. CB-style.`;
}

export default function QuizCenter() {
  const { isMobile, graph, setChatPrefill, setChatOpen } = useApp();
  const [view,       setView]       = useState('pick');  // pick | quiz | result | history
  const [topic,      setTopic]      = useState(null);
  const [questions,  setQuestions]  = useState([]);
  const [generating, setGenerating] = useState(false);
  const [gapReport,  setGapReport]  = useState('');
  const [gapLoading, setGapLoading] = useState(false);
  const [history,    setHistory]    = useState(loadResults);
  const [customTopic, setCustomTopic] = useState('');

  // Pull any history saved on another device once mounted.
  useEffect(() => {
    hydrate(STORAGE_KEY).then((remote) => {
      if (Array.isArray(remote) && remote.length) {
        setHistory((local) => (remote.length >= local.length ? remote : local));
      }
    });
  }, []);

  const pad = isMobile ? '14px' : '24px';

  const startQuiz = async (topicObj) => {
    setTopic(topicObj);
    setView('quiz');
    setGenerating(true);
    setQuestions([]);
    setGapReport('');
    try {
      const raw = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: buildQuizPrompt({ subject: topicObj.label, count: 6, includeRate: true }) }],
        maxTokens: 1200,
      });
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setQuestions(parsed.questions || []);
    } catch {
      setQuestions([{ type: 'mc', q: 'Quiz generation failed. Check your API key and try again.', options: ['A. Retry', 'B. Cancel'], answer: 'A', explanation: '' }]);
    }
    setGenerating(false);
  };

  // QuizMode hands back one result object per question (see shared/QuizMode).
  const onQuizDone = async (results) => {
    const mcCorrect = results.filter(r => r.type === 'mc' && r.correct).length;
    const mcTotal   = results.filter(r => r.type === 'mc').length;
    const entry = { id: Date.now(), topic: topic.label, topicId: topic.id, date: Date.now(), score: mcCorrect, total: mcTotal, results };
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    saveResults(updated);
    // Schedule a spaced-repetition review for this topic.
    const reviewId = topic.id === 'custom' ? topic.label.toLowerCase().replace(/\s+/g, '_') : topic.id;
    recordQuizResult({ topicId: reviewId, topicLabel: topic.label, results });
    setView('result');
    setGapLoading(true);
    try {
      const report = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: buildGapPrompt(topic.id, topic.label, results) }],
        maxTokens: 600,
      });
      setGapReport(report);
    } catch {
      setGapReport('Gap analysis unavailable. Review your answers above.');
    }
    setGapLoading(false);
  };

  if (view === 'history') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: `20px ${pad} 60px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div onClick={() => setView('pick')} style={{ fontSize: 'var(--fs-base)', color: ACCENT, cursor: 'pointer', fontWeight: 700 }}>← Back</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif" }}>Quiz History</div>
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)', fontSize: 'var(--fs-base)'}}>No quizzes completed yet.</div>
        ) : (
          history.map(h => (
            <div key={h.id} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{h.topic}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{new Date(h.date).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: h.score / h.total >= 0.7 ? T.accent : h.score / h.total >= 0.5 ? ACCENT : T.negative }}>
                  {h.score}/{h.total}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (view === 'result') {
    const last    = history[0];
    const score   = last?.score || 0;
    const total   = last?.total || 1;
    const pct     = Math.round((score / total) * 100);
    const scoreColor = pct >= 70 ? T.accent : pct >= 50 ? ACCENT : T.negative;

    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: `20px ${pad} 60px` }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 24px 20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: scoreColor, marginBottom: 4 }}>{pct}%</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{score}/{total} correct · {topic?.label}</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)' }}>{pct >= 70 ? 'Strong foundation.' : pct >= 50 ? 'Gaps identified — see analysis below.' : 'Significant room to deepen — this is the signal.'}</div>
        </div>

        <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Gap Analysis</div>
          {gapLoading ? (
            <div><div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', marginBottom: 8 }}>Analyzing your gaps…</div><ThinkingDots color={ACCENT} /></div>
          ) : (
            <MD text={gapReport} color={ACCENT} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div onClick={() => startQuiz(topic)}
            style={{ flex: 1, padding: '12px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 10, textAlign: 'center', fontSize: 'var(--fs-base)', fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>
            Retry Quiz
          </div>
          <div onClick={() => setView('pick')}
            style={{ flex: 1, padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-b)', cursor: 'pointer' }}>
            New Topic
          </div>
        </div>
        {gapReport && (
          <div onClick={() => { setChatPrefill(`Let's go deeper on ${topic?.label}. Based on my quiz gaps, help me build a study plan and explain the key concepts I'm missing.`); setChatOpen(true); }}
            style={{ marginTop: 10, padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--subtle)', cursor: 'pointer' }}>
            ✦ Deep Dive with AI →
          </div>
        )}
      </div>
    );
  }

  if (view === 'quiz') {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: `20px ${pad} 60px` }}>
        {generating || questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', marginBottom: 16 }}>Building your {topic?.label} quiz…</div>
            <ThinkingDots color={ACCENT} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div onClick={() => setView('pick')} style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)', cursor: 'pointer' }}>← Exit</div>
              <div style={{ fontSize: 'var(--fs-base)', color: ACCENT, fontWeight: 700 }}>{topic?.label}</div>
            </div>
            <QuizMode questions={questions} color={ACCENT} onComplete={onQuizDone} />
          </>
        )}
      </div>
    );
  }

  // Topic picker
  const graphTopics = Object.values(graph?.topics || {}).slice(0, 4);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ padding: `20px ${pad} 16px`, borderBottom: '1px solid var(--bord2)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 4 }}>Self-Assessment</div>
          <div style={{ fontSize: isMobile ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5 }}>
            Knowledge Check
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', marginTop: 4 }}>
            Find gaps. Deepen signal. AI generates 6 questions calibrated to CB.
          </div>
        </div>
        {history.length > 0 && (
          <div onClick={() => setView('history')}
            style={{ fontSize: 'var(--fs-sm)', padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--subtle)', cursor: 'pointer' }}>
            History ({history.length})
          </div>
        )}
      </div>

      <div style={{ padding: `16px ${pad}` }}>
        {graphTopics.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Your Learning Topics</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {graphTopics.map(t => (
                <div key={t.title} onClick={() => startQuiz({ id: t.title.toLowerCase().replace(/\s+/g, '_'), label: t.title, icon: '📚', desc: `Your tracked topic — ${t.sessions} sessions` })}
                  style={{ padding: '8px 14px', background: 'var(--surface)', border: `1px solid var(--accent-glow, rgba(217,164,65,0.2))`, borderRadius: 8, cursor: 'pointer', fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--accent, #D9A441)' }}>
                  📚 {t.title} · {t.confidence}/10
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Quick Start Topics</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {PRESET_TOPICS.map(t => (
            <div key={t.id} onClick={() => startQuiz(t)}
              style={{ padding: '14px', background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
              onMouseLeave={e => e.currentTarget.style.borderColor = ACCENT_BORDER}>
              <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.4 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Custom Topic</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={customTopic} onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && customTopic.trim() && startQuiz({ id: 'custom', label: customTopic.trim(), icon: '🎯', desc: 'Custom quiz' })}
              placeholder="Type any topic (e.g. ERCOT energy markets, Chip War geopolitics…)"
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
            />
            <button onClick={() => customTopic.trim() && startQuiz({ id: 'custom', label: customTopic.trim(), icon: '🎯', desc: 'Custom quiz' })}
              disabled={!customTopic.trim()}
              style={{ padding: '8px 16px', background: customTopic.trim() ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 8, color: customTopic.trim() ? '#fff' : 'var(--dim)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: customTopic.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              Quiz Me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
