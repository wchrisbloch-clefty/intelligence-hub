import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildQuizPrompt } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { recordQuizResult, createCard } from '../lib/reviews.js';
import { logConcept } from '../lib/graph.js';
import { SYSTEM_BASE } from '../constants.js';
import MD from './shared/MD.jsx';
import Icon from './shared/Icon.jsx';
import QuizMode from './shared/QuizMode.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import './quiz-center.css';

// Styling lives in quiz-center.css (qc-) — tokens only, no inline colour.
// `icon` is a lucide name rendered through shared/Icon (no emoji in UI chrome).
const PRESET_TOPICS = [
  { id: 'realestate',  label: 'Real Estate',          icon: 'Building2', desc: 'Multifamily, cash flow, cap rates, market dynamics' },
  { id: 'leadership',  label: 'Extreme Ownership',     icon: 'Zap', desc: 'Jocko\'s framework — accountability, decision-making, discipline' },
  { id: 'negotiation', label: 'Negotiation',           icon: 'Handshake', desc: 'Voss tactics, tactical empathy, deal dynamics' },
  { id: 'longevity',   label: 'Longevity Protocol',    icon: 'Dumbbell', desc: 'Attia frameworks — Zone 2, VO₂Max, strength, sleep' },
  { id: 'bd',          label: 'BD & Sales Systems',    icon: 'Rocket', desc: 'Pipeline, prospecting, closing, AI-augmented workflows' },
  { id: 'finance',     label: 'Finance & Investing',   icon: 'TrendingUp', desc: 'Dividends, covered calls, compounding, risk management' },
  { id: 'systems',     label: 'Systems Thinking',      icon: 'Cog', desc: 'Tipping points, compounding effects, leverage points' },
  { id: 'stoic',       label: 'Stoic Philosophy',      icon: 'Mountain', desc: 'Marcus Aurelius, Seneca, Epictetus — adversity as data' },
];

const STORAGE_KEY = 'aether_quiz_results';

// Quizzes here are generated from a bare topic label using model knowledge —
// no grounding document, no verification. Per the epistemic scope, a quiz never
// asserts its own trust; it inherits its source's. That source is ungrounded
// model synthesis, so the inherited tier is `inferred` — a question can't look
// more certain than the (unverified) knowledge it was generated from.
const QUIZ_SOURCE_TIER = 'inferred';

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
  const { graph, setGraph, setChatPrefill, setChatOpen } = useApp();
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

  const startQuiz = async (topicObj) => {
    setTopic(topicObj);
    setView('quiz');
    setGenerating(true);
    setQuestions([]);
    setGapReport('');
    try {
      const raw = await callClaude({
        system: SYSTEM_BASE,
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
    // Connect the quizzed topic into the graph — right and wrong both count,
    // a miss is signal — and turn each missed MC question into a review card.
    const { graph: g } = await logConcept({ topic: topic.label, source: topic.label, module: 'quiz', confidence: mcTotal ? Math.round((mcCorrect / mcTotal) * 10) : null });
    if (g) setGraph(g);
    results.filter(r => r.type === 'mc' && !r.correct).forEach(r =>
      createCard({ front: r.question, back: `Correct: ${r.model}${r.explanation ? ' — ' + r.explanation : ''}`, source: topic.label, module: 'quiz', topic: topic.label }));
    setView('result');
    setGapLoading(true);
    try {
      const report = await callClaude({
        system: SYSTEM_BASE,
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
      <div className="qc" data-pad="">
        <div className="qc-hhead">
          <button type="button" className="qc-back tap" data-accent="" onClick={() => setView('pick')}>← Back</button>
          <div className="qc-htitle">Quiz History</div>
        </div>
        {history.length === 0 ? (
          <div className="qc-empty">No quizzes completed yet.</div>
        ) : (
          history.map(h => (
            <div key={h.id} className="qc-hrow">
              <div className="qc-hrow-main">
                <div className="qc-hrow-topic">{h.topic}</div>
                <div className="qc-hrow-date">{new Date(h.date).toLocaleDateString()}</div>
              </div>
              <div className="qc-hrow-score" data-low={h.score / h.total >= 0.5 ? undefined : ''}>
                {h.score}/{h.total}
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

    return (
      <div className="qc" data-pad="">
        <div className="qc-score">
          <div className="qc-score-pct" data-low={pct >= 50 ? undefined : ''}>{pct}%</div>
          <div className="qc-score-line">{score}/{total} correct · {topic?.label}</div>
          <div className="qc-score-note">{pct >= 70 ? 'Strong foundation.' : pct >= 50 ? 'Gaps identified — see analysis below.' : 'Significant room to deepen — this is the signal.'}</div>
        </div>

        <div className="qc-gap">
          <div className="qc-gap-label">Gap Analysis</div>
          {gapLoading ? (
            <div><div className="qc-pending">Analyzing your gaps…</div><ThinkingDots color="var(--accent-text)" /></div>
          ) : (
            <MD text={gapReport} color="var(--accent-text)" />
          )}
        </div>

        <div className="qc-btns">
          <button type="button" className="qc-btn tap" data-accent="" onClick={() => startQuiz(topic)}>
            Retry Quiz
          </button>
          <button type="button" className="qc-btn tap" onClick={() => setView('pick')}>
            New Topic
          </button>
        </div>
        {gapReport && (
          <button type="button" className="qc-btn tap" data-block=""
            onClick={() => { setChatPrefill(`Let's go deeper on ${topic?.label}. Based on my quiz gaps, help me build a study plan and explain the key concepts I'm missing.`); setChatOpen(true); }}>
            ✦ Deep Dive with AI →
          </button>
        )}
      </div>
    );
  }

  if (view === 'quiz') {
    return (
      <div className="qc" data-pad="" data-w="quiz">
        {generating || questions.length === 0 ? (
          <div className="qc-wait">
            <div className="qc-wait-text">Building your {topic?.label} quiz…</div>
            <ThinkingDots color="var(--accent-text)" />
          </div>
        ) : (
          <>
            <div className="qc-bar">
              <button type="button" className="qc-back tap" onClick={() => setView('pick')}>← Exit</button>
              <div className="qc-bar-topic">{topic?.label}</div>
            </div>
            <QuizMode questions={questions} color="var(--accent-text)" sourceTier={QUIZ_SOURCE_TIER} onComplete={onQuizDone} />
          </>
        )}
      </div>
    );
  }

  // Topic picker
  const graphTopics = Object.values(graph?.topics || {}).slice(0, 4);

  return (
    <div className="qc" data-w="pick">
      <div className="qc-head">
        <div className="qc-head-main">
          <div className="qc-eyebrow">Self-Assessment</div>
          <div className="qc-title">
            Knowledge Check
          </div>
          <div className="qc-lede">
            Find gaps. Deepen signal. AI generates 6 questions calibrated to CB.
          </div>
        </div>
        {history.length > 0 && (
          <button type="button" className="qc-ghost tap" onClick={() => setView('history')}>
            History ({history.length})
          </button>
        )}
      </div>

      <div className="qc-body">
        {graphTopics.length > 0 && (
          <div className="qc-section">
            <div className="qc-label">Your Learning Topics</div>
            <div className="qc-chips">
              {graphTopics.map(t => (
                <button type="button" key={t.title} className="qc-chip tap"
                  onClick={() => startQuiz({ id: t.title.toLowerCase().replace(/\s+/g, '_'), label: t.title, icon: '📚', desc: `Your tracked topic — ${t.sessions} sessions` })}>
                  <Icon name="BookOpen" size={16} /> {t.title} · {t.confidence}/10
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="qc-label">Quick Start Topics</div>
        <div className="qc-grid">
          {PRESET_TOPICS.map(t => (
            <button type="button" key={t.id} className="qc-topic tap" onClick={() => startQuiz(t)}>
              <span className="qc-topic-icon"><Icon name={t.icon} size="nav" /></span>
              <div className="qc-topic-label">{t.label}</div>
              <div className="qc-topic-desc">{t.desc}</div>
            </button>
          ))}
        </div>

        <div className="qc-card">
          <div className="qc-card-title">Custom Topic</div>
          <div className="qc-inline">
            <input className="qc-input"
              value={customTopic} onChange={e => setCustomTopic(e.target.value)} aria-label="Custom quiz topic"
              onKeyDown={e => e.key === 'Enter' && customTopic.trim() && startQuiz({ id: 'custom', label: customTopic.trim(), icon: '🎯', desc: 'Custom quiz' })}
              placeholder="Type any topic (e.g. ERCOT energy markets, Chip War geopolitics…)"
            />
            <button type="button" className="qc-primary tap" onClick={() => customTopic.trim() && startQuiz({ id: 'custom', label: customTopic.trim(), icon: '🎯', desc: 'Custom quiz' })}
              disabled={!customTopic.trim()}>
              Quiz Me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
