import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildLadderPrompt, buildQuizPrompt } from '../utils.js';
import { SYSTEM_LEARNING } from '../constants.js';
import { loadIndex, hydrateIndex, loadLadder, hydrateLadder, saveLadder, removeLadder, buildLadder, completeModule } from '../lib/ladders.js';
import { isStale, versionLabel } from '../lib/promptVersion.js';
import useChatThread from '../hooks/useChatThread.js';
import { recordQuizResult } from '../lib/reviews.js';
import { logConcept } from '../lib/graph.js';
import MD from './shared/MD.jsx';
import QuizMode from './shared/QuizMode.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import './learning-ladder.css';

// Styling lives in learning-ladder.css (ll-) — tokens only, no inline colour.
const PASS_PCT = 70;

const GOALS = [
  { id: 'master', label: 'Deep Mastery' },
  { id: 'apply',  label: 'Apply to Work' },
  { id: 'exam',   label: 'Exam / Cert' },
  { id: 'quick',  label: 'Quick Fluency' },
];

// ── Yard-line progress motif ────────────────────────────────────────────────
function YardLines({ modules }) {
  return (
    <div className="ll-yard">
      {modules.map(m => <span key={m.id} data-s={m.status} />)}
    </div>
  );
}

export default function LearningLadder() {
  const { captureRoute, clearCapture } = useApp();
  const [view,   setView]   = useState('home'); // home | view | session | quiz
  const [index,  setIndex]  = useState(() => loadIndex());
  const [ladder, setLadder] = useState(null);
  const [activeMod, setActiveMod] = useState(null);

  const [topicInput, setTopicInput] = useState('');
  const [goal, setGoal] = useState('master');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  useEffect(() => { hydrateIndex().then(r => { if (Array.isArray(r)) setIndex(r); }); }, []);
  useEffect(() => { if (view !== 'home' && !ladder) setView('home'); }, [view, ladder]);
  // Capture-bar route (D1): prefill the topic.
  useEffect(() => { if (captureRoute?.route === 'ladder') { setTopicInput(captureRoute.topic || ''); setView('home'); clearCapture?.(); } }, [captureRoute, clearCapture]);

  const refreshIndex = () => setIndex(loadIndex());

  const build = async () => {
    if (!topicInput.trim() || generating) return;
    setGenerating(true); setGenError('');
    try {
      const raw = await callClaude({
        system: SYSTEM_LEARNING,
        messages: [{ role: 'user', content: buildLadderPrompt(topicInput.trim(), GOALS.find(g => g.id === goal)?.label) }],
        maxTokens: 1600,
      });
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!parsed.modules?.length) throw new Error('empty');
      const l = saveLadder(buildLadder({ topic: topicInput.trim(), goal, modules: parsed.modules }));
      setLadder(l); refreshIndex(); setTopicInput(''); setView('view');
    } catch {
      setGenError('Could not build a ladder — try rephrasing the topic.');
    }
    setGenerating(false);
  };

  const openLadder = async (id) => {
    const local = loadLadder(id);
    if (local) { setLadder(local); setView('view'); }
    const remote = await hydrateLadder(id);
    if (remote) setLadder(remote);
  };

  const deleteLadder = (id, e) => { e.stopPropagation(); setIndex(removeLadder(id)); };

  const onModulePass = (mod, results) => {
    const graded = results.filter(r => r.score !== null);
    const pct = graded.length ? Math.round((graded.filter(r => r.score > 0).length / graded.length) * 100) : 0;
    recordQuizResult({ topicId: `ladder_${ladder.id}_${mod.id}`, topicLabel: `${ladder.topic} — ${mod.title}`, results });
    if (pct >= PASS_PCT) {
      const updated = completeModule(ladder, mod.id);
      setLadder(updated); refreshIndex();
      // Completing a rung records the ladder's subject as a concept.
      logConcept({ topic: ladder.topic, source: ladder.topic, module: 'ladder', confidence: Math.round(pct / 10) });
      return { passed: true, pct };
    }
    return { passed: false, pct };
  };

  // ── Home: create + list ───────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div className="ll-page">
        <div className="ll-eyebrow">Structured Path</div>
        <div className="ll-title">Learning Ladder</div>
        <div className="ll-lede">Name a subject. Get an ordered, prereq-gated path — study each rung, pass its quiz, unlock the next.</div>

        {/* Create */}
        <div className="ll-card">
          <input className="ll-input" value={topicInput} onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && build()} aria-label="Subject to master"
            placeholder="What do you want to master? (e.g. Multifamily underwriting, Chip War geopolitics…)" />
          <div className="ll-goals">
            {GOALS.map(g => (
              <button type="button" key={g.id} className="ll-goal tap" aria-pressed={goal === g.id} onClick={() => setGoal(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          <button type="button" className="ll-primary tap" data-block="" onClick={build} disabled={!topicInput.trim() || generating} aria-busy={generating || undefined}>
            {generating ? 'Designing your path…' : 'Build my ladder →'}
          </button>
          {generating && <div className="ll-center"><ThinkingDots color="var(--accent-text)" /></div>}
          {genError && <div className="ll-err">{genError}</div>}
        </div>

        {/* Existing ladders */}
        {index.length > 0 && (
          <>
            <div className="ll-label">Your Ladders</div>
            {index.map(l => (
              <div key={l.id} className="ll-item">
                <button type="button" className="ll-open tap" onClick={() => openLadder(l.id)}>
                  <div className="ll-item-top">
                    <div className="ll-item-main">
                      <div className="ll-item-title">{l.topic}</div>
                      <div className="ll-item-sub">{GOALS.find(g => g.id === l.goal)?.label || l.goal}</div>
                    </div>
                    <div className="ll-item-pct">{l.progress}%</div>
                  </div>
                  <div className="ll-bar" style={{ '--pct': `${l.progress}%` }}><span /></div>
                </button>
                <button type="button" className="ll-del tap" title="Delete" aria-label={`Delete ladder: ${l.topic}`} onClick={e => deleteLadder(l.id, e)}>🗑</button>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  // ── Session (scoped study chat) ───────────────────────────────────────────
  if (view === 'session' && ladder && activeMod) {
    return <LadderSession topic={ladder.topic} goalLabel={GOALS.find(g => g.id === ladder.goal)?.label} mod={activeMod}
      onQuiz={() => setView('quiz')} onBack={() => setView('view')} />;
  }

  // ── Quiz ──────────────────────────────────────────────────────────────────
  if (view === 'quiz' && ladder && activeMod) {
    return <LadderQuiz topic={ladder.topic} mod={activeMod}
      onComplete={(results) => onModulePass(activeMod, results)}
      onBack={() => setView('view')} onDone={() => setView('view')} />;
  }

  // ── Ladder view ───────────────────────────────────────────────────────────
  if (!ladder) return null;
  return (
    <div className="ll-page">
      <div><button type="button" className="ll-back tap" onClick={() => setView('home')}>← Ladders</button></div>
      <div className="ll-title" data-flush="">{ladder.topic}</div>
      <div className="ll-meta">
        <span>{GOALS.find(g => g.id === ladder.goal)?.label || ladder.goal} · {ladder.progress}% complete</span>
        {ladder.promptVersion != null && <span>· {versionLabel(ladder)}</span>}
        {isStale(ladder, 'ladder') && <span className="ll-stale">prompt updated → rebuild</span>}
      </div>
      <YardLines modules={ladder.modules} />

      {ladder.modules.map((m, i) => {
        const locked = m.status === 'locked';
        const done   = m.status === 'done';
        const s = done ? 'done' : locked ? 'locked' : 'open';
        return (
          <div key={m.id} className="ll-rung">
            <div className="ll-node" data-s={s}>
              {done ? '✓' : locked ? '🔒' : i + 1}
            </div>
            <div className="ll-mod" data-s={s}>
              <div className="ll-mod-top">
                <div className="ll-mod-title">{m.title}</div>
                <div className="ll-mod-status">{m.status}</div>
              </div>
              {m.objectives?.length > 0 && (
                <ul className="ll-objs">
                  {m.objectives.map((o, j) => <li key={j}>{o}</li>)}
                </ul>
              )}
              {!locked && (
                <div className="ll-mod-actions">
                  <button type="button" className="ll-btn tap" data-accent="" onClick={() => { setActiveMod(m); setView('session'); }}>
                    {done ? 'Review' : 'Study'}
                  </button>
                  <button type="button" className="ll-btn tap" onClick={() => { setActiveMod(m); setView('quiz'); }}>
                    {done ? 'Re-quiz' : 'Take quiz →'}
                  </button>
                </div>
              )}
              {locked && <div className="ll-locked-note">Complete the prerequisite modules to unlock.</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Scoped study chat for one module ────────────────────────────────────────
function LadderSession({ topic, goalLabel, mod, onQuiz, onBack }) {
  const bottomRef = useRef(null);
  const buildRequest = useCallback(() => ({
    system: {
      cached: SYSTEM_LEARNING,
      dynamic: `\n\nLEARNING LADDER — SCOPED SESSION\nSubject: "${topic}"\nGoal: ${goalLabel || 'mastery'}\nModule: "${mod.title}"\nObjectives:\n${(mod.objectives || []).map(o => `- ${o}`).join('\n')}\n\nTeach ONLY toward these objectives: concept → analogy → example from the subject itself → check for understanding. Stay on this rung; don't jump ahead. When CB seems ready, tell him to take the module quiz.`,
    },
  }), [topic, goalLabel, mod]);

  const { messages, input, setInput, loading, streamText, send } = useChatThread({ buildRequest });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, streamText]);
  useEffect(() => { send(`Teach me the first objective of "${mod.title}". Big picture first.`); /* eslint-disable-next-line */ }, []);

  return (
    <div className="ll-session">
      <div className="ll-shead">
        <div className="ll-shead-main">
          <button type="button" className="ll-back tap" onClick={onBack}>← {topic}</button>
          <div className="ll-shead-title">{mod.title}</div>
        </div>
        <button type="button" className="ll-btn tap" data-accent="" onClick={onQuiz}>Quiz me →</button>
      </div>

      <div className="ll-thread">
        {messages.map((msg, i) => (
          <div key={i} className="ll-msg" data-role={msg.role}>
            {msg.role === 'user' ? (
              <div className="ll-ubub">{msg.content}</div>
            ) : (
              <div className="ll-abub">
                <MD text={msg.content} color="var(--accent-text)" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="ll-msg">
            <div className="ll-abub" data-pending="">
              {streamText ? <MD text={streamText + '▍'} color="var(--accent-text)" /> : <ThinkingDots color="var(--accent-text)" />}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="ll-composer">
        <div className="ll-compose-row">
          <textarea className="ll-composer-input" value={input} onChange={e => setInput(e.target.value)} aria-label="Ask about this objective"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder="Ask about this objective…" />
          <button type="button" className="ll-primary ll-send tap" aria-label="Send" onClick={() => send(input)} disabled={!input.trim() || loading}>→</button>
        </div>
      </div>
    </div>
  );
}

// ── Module quiz — pass advances the ladder ──────────────────────────────────
function LadderQuiz({ topic, mod, onComplete, onBack, onDone }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState(null); // { passed, pct }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const subject = `${mod.title} (${topic}) — objectives: ${(mod.objectives || []).join('; ')}`;
        const raw = await callClaude({ system: '', messages: [{ role: 'user', content: buildQuizPrompt({ subject, count: 5, includeRate: false }) }], maxTokens: 1400 });
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
        if (alive) setQuestions(parsed.questions || []);
      } catch {
        if (alive) setQuestions([]);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [topic, mod]);

  if (outcome) {
    return (
      <div className="ll-outcome">
        <div className="ll-outcome-pct" data-fail={outcome.passed ? undefined : ''}>{outcome.pct}%</div>
        <div className="ll-outcome-head">{outcome.passed ? 'Module cleared — next rung unlocked.' : 'Not yet — review and run it again.'}</div>
        <div className="ll-outcome-sub">{outcome.passed ? `You passed "${mod.title}".` : `You need ${PASS_PCT}% to advance. This is data, not judgment.`}</div>
        <button type="button" className="ll-primary tap" data-wide="" onClick={onDone}>Back to ladder →</button>
      </div>
    );
  }

  return (
    <div className="ll-page" data-w="quiz">
      <div className="ll-quiz-head">
        <button type="button" className="ll-back tap" data-quiet="" onClick={onBack}>← Exit</button>
        <div className="ll-quiz-mod">{mod.title}</div>
      </div>
      {loading || questions.length === 0 ? (
        <div className="ll-wait">
          <div className="ll-wait-text">Building your quiz…</div>
          <ThinkingDots color="var(--accent-text)" />
        </div>
      ) : (
        <QuizMode questions={questions} color="var(--accent-text)" onComplete={(results) => setOutcome(onComplete(results))} />
      )}
    </div>
  );
}
