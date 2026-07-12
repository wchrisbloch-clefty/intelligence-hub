import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildLadderPrompt, buildQuizPrompt } from '../utils.js';
import { CB_LEARNING_SPINE } from '../constants.js';
import { loadIndex, hydrateIndex, loadLadder, hydrateLadder, saveLadder, removeLadder, buildLadder, completeModule } from '../lib/ladders.js';
import useChatThread from '../hooks/useChatThread.js';
import MD from './shared/MD.jsx';
import QuizMode from './shared/QuizMode.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT = '#D9A441';
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
    <div style={{ display: 'flex', gap: 3 }}>
      {modules.map(m => (
        <div key={m.id} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: m.status === 'done' ? ACCENT : m.status === 'active' ? 'var(--accent-glow)' : 'var(--line)',
        }} />
      ))}
    </div>
  );
}

export default function LearningLadder() {
  const { isMobile, graph } = useApp();
  const [view,   setView]   = useState('home'); // home | view | session | quiz
  const [index,  setIndex]  = useState(() => loadIndex());
  const [ladder, setLadder] = useState(null);
  const [activeMod, setActiveMod] = useState(null);

  const [topicInput, setTopicInput] = useState('');
  const [goal, setGoal] = useState('master');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const pad = isMobile ? '14px' : '24px';

  useEffect(() => { hydrateIndex().then(r => { if (Array.isArray(r)) setIndex(r); }); }, []);
  useEffect(() => { if (view !== 'home' && !ladder) setView('home'); }, [view, ladder]);

  const refreshIndex = () => setIndex(loadIndex());

  const build = async () => {
    if (!topicInput.trim() || generating) return;
    setGenerating(true); setGenError('');
    try {
      const raw = await callClaude({
        system: CB_LEARNING_SPINE,
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
    if (pct >= PASS_PCT) {
      const updated = completeModule(ladder, mod.id);
      setLadder(updated); refreshIndex();
      return { passed: true, pct };
    }
    return { passed: false, pct };
  };

  // ── Home: create + list ───────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: `20px ${pad} 60px` }}>
        <div style={{ marginBottom: 6, fontSize: 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase' }}>Structured Path</div>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5, marginBottom: 4 }}>Learning Ladder</div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20 }}>Name a subject. Get an ordered, prereq-gated path — study each rung, pass its quiz, unlock the next.</div>

        {/* Create */}
        <div style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && build()}
            placeholder="What do you want to master? (e.g. Multifamily underwriting, Chip War geopolitics…)"
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {GOALS.map(g => (
              <div key={g.id} onClick={() => setGoal(g.id)}
                style={{ padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${goal === g.id ? ACCENT : 'var(--border)'}`, color: goal === g.id ? ACCENT : 'var(--muted)', background: goal === g.id ? 'var(--accent-glow)' : 'transparent' }}>
                {g.label}
              </div>
            ))}
          </div>
          <button onClick={build} disabled={!topicInput.trim() || generating}
            style={{ width: '100%', padding: '12px', background: topicInput.trim() && !generating ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 9, color: topicInput.trim() && !generating ? '#1A130A' : 'var(--dim)', fontSize: 13, fontWeight: 800, cursor: topicInput.trim() && !generating ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {generating ? 'Designing your path…' : 'Build my ladder →'}
          </button>
          {generating && <div style={{ marginTop: 12, textAlign: 'center' }}><ThinkingDots color={ACCENT} /></div>}
          {genError && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--red)', textAlign: 'center' }}>{genError}</div>}
        </div>

        {/* Existing ladders */}
        {index.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Your Ladders</div>
            {index.map(l => (
              <div key={l.id} onClick={() => openLadder(l.id)}
                style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.topic}</div>
                    <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{GOALS.find(g => g.id === l.goal)?.label || l.goal}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{l.progress}%</div>
                    <span onClick={e => deleteLadder(l.id, e)} title="Delete" style={{ fontSize: 12, color: 'var(--red)', cursor: 'pointer' }}>🗑</span>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{ width: `${l.progress}%`, height: '100%', background: ACCENT, transition: 'width 0.3s' }} />
                </div>
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
    <div style={{ maxWidth: 760, margin: '0 auto', padding: `20px ${pad} 60px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div onClick={() => setView('home')} style={{ fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 700 }}>← Ladders</div>
      </div>
      <div style={{ fontSize: isMobile ? 19 : 23, fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5 }}>{ladder.topic}</div>
      <div style={{ fontSize: 11, color: 'var(--dim)', margin: '4px 0 14px' }}>{GOALS.find(g => g.id === ladder.goal)?.label || ladder.goal} · {ladder.progress}% complete</div>
      <div style={{ marginBottom: 22 }}><YardLines modules={ladder.modules} /></div>

      {ladder.modules.map((m, i) => {
        const locked = m.status === 'locked';
        const done   = m.status === 'done';
        return (
          <div key={m.id} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, border: `1.5px solid ${done ? ACCENT : locked ? 'var(--line)' : ACCENT}`, background: done ? ACCENT : 'transparent', color: done ? '#1A130A' : locked ? 'var(--dim)' : ACCENT }}>
              {done ? '✓' : locked ? '🔒' : i + 1}
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', border: `1px solid ${locked ? 'var(--border-dim)' : done ? 'var(--border)' : ACCENT}`, borderRadius: 10, padding: '12px 14px', opacity: locked ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{m.title}</div>
                <div style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: done ? ACCENT : locked ? 'var(--dim)' : ACCENT, fontWeight: 700 }}>{m.status}</div>
              </div>
              {m.objectives?.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                  {m.objectives.map((o, j) => <li key={j} style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{o}</li>)}
                </ul>
              )}
              {!locked && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div onClick={() => { setActiveMod(m); setView('session'); }}
                    style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--accent-glow)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {done ? 'Review' : 'Study'}
                  </div>
                  <div onClick={() => { setActiveMod(m); setView('quiz'); }}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-b)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {done ? 'Re-quiz' : 'Take quiz →'}
                  </div>
                </div>
              )}
              {locked && <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 8 }}>Complete the prerequisite modules to unlock.</div>}
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
      cached: CB_LEARNING_SPINE,
      dynamic: `\n\nLEARNING LADDER — SCOPED SESSION\nSubject: "${topic}"\nGoal: ${goalLabel || 'mastery'}\nModule: "${mod.title}"\nObjectives:\n${(mod.objectives || []).map(o => `- ${o}`).join('\n')}\n\nTeach ONLY toward these objectives: concept → analogy → CB application → check for understanding. Stay on this rung; don't jump ahead. When CB seems ready, tell him to take the module quiz.`,
    },
  }), [topic, goalLabel, mod]);

  const { messages, input, setInput, loading, streamText, send } = useChatThread({ buildRequest });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, streamText]);
  useEffect(() => { send(`Teach me the first objective of "${mod.title}". Big picture first.`); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bord2)', padding: '12px 20px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div onClick={onBack} style={{ fontSize: 11, color: ACCENT, cursor: 'pointer', fontWeight: 700, marginBottom: 2 }}>← {topic}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.title}</div>
        </div>
        <div onClick={onQuiz} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--accent-glow)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Quiz me →</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: 760, margin: '0 auto 14px' }}>
            {msg.role === 'user' ? (
              <div style={{ background: 'var(--u-bubble)', border: '1px solid var(--u-bubble-b)', borderRadius: '14px 14px 3px 14px', padding: '10px 14px', maxWidth: '85%', fontSize: 13, lineHeight: 1.65, color: 'var(--u-bubble-text)' }}>{msg.content}</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-glow)', borderRadius: '3px 14px 14px 14px', padding: '13px 16px', maxWidth: '94%', width: '100%' }}>
                <MD text={msg.content} color={ACCENT} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ maxWidth: 760, margin: '0 auto 14px', display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-glow)', borderRadius: '3px 14px 14px 14px', padding: '12px 16px', maxWidth: '94%' }}>
              {streamText ? <MD text={streamText + '▍'} color={ACCENT} /> : <ThinkingDots color={ACCENT} />}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '10px 16px 16px', borderTop: '1px solid var(--bord2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 760, margin: '0 auto' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder="Ask about this objective…"
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-b)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', maxHeight: 100 }} />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            style={{ padding: '10px 16px', background: input.trim() && !loading ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, color: input.trim() && !loading ? '#1A130A' : 'var(--dim)', fontSize: 13, fontWeight: 800, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', flexShrink: 0, minHeight: 42 }}>→</button>
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

  const pad = 24;

  if (outcome) {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto', padding: `40px ${pad}`, textAlign: 'center' }}>
        <div style={{ fontSize: 46, fontWeight: 800, color: outcome.passed ? ACCENT : 'var(--red)', marginBottom: 6 }}>{outcome.pct}%</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{outcome.passed ? 'Module cleared — next rung unlocked.' : 'Not yet — review and run it again.'}</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 24 }}>{outcome.passed ? `You passed "${mod.title}".` : `You need ${PASS_PCT}% to advance. This is data, not judgment.`}</div>
        <div onClick={onDone} style={{ display: 'inline-block', padding: '11px 24px', background: ACCENT, borderRadius: 9, color: '#1A130A', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Back to ladder →</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: `20px ${pad} 60px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div onClick={onBack} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer' }}>← Exit</div>
        <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>{mod.title}</div>
      </div>
      {loading || questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16 }}>Building your quiz…</div>
          <ThinkingDots color={ACCENT} />
        </div>
      ) : (
        <QuizMode questions={questions} color={ACCENT} onComplete={(results) => setOutcome(onComplete(results))} />
      )}
    </div>
  );
}
