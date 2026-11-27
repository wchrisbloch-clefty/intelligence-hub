import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../App.jsx';
import useChatThread from '../hooks/useChatThread.js';
import { SYSTEM_BASE } from '../constants.js';
import MD from './shared/MD.jsx';
import Icon from './shared/Icon.jsx';
import SessionDrawer from './shared/SessionDrawer.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import './coach-ai.css';

// Z-3 / L4: every colour lives in coach-ai.css on system tokens. The old gold
// tints (rgba(217,164,65,…)) predated the token system and were the last
// literal colours in the repo; they are now color-mix() over --accent.

const TONES = [
  { id: 'coach',     icon: 'Trophy', label: 'Coach',          desc: 'High-energy, goal-focused, celebrates wins, drives action' },
  { id: 'mentor',    icon: 'Feather', label: 'Mentor',         desc: 'Wise, calm, long-view perspective, shares frameworks' },
  { id: 'stoic',     icon: 'Mountain', label: 'Stoic',          desc: 'Marcus Aurelius mode — adversity is data, discipline is freedom' },
  { id: 'drill',     icon: 'Target', label: 'Drill Sergeant', desc: 'No excuses, Extreme Ownership, blunt unfiltered truth' },
  { id: 'therapist', icon: 'Heart', label: 'Therapist',      desc: 'Reflective, curious, explores the "why" behind your choices' },
];

const TOPICS = [
  { id: 'all',      label: 'All Areas', icon: 'Zap' },
  { id: 'projects', label: 'Projects',  icon: 'Rocket' },
  { id: 'learning', label: 'Learning',  icon: 'BookMarked' },
  { id: 'finance',  label: 'Finance',   icon: 'DollarSign' },
  { id: 'health',   label: 'Health',    icon: 'Stethoscope' },
];

const CHECKIN_PROMPTS = [
  'What did you accomplish this week?',
  "Where are you avoiding the hard thing?",
  'Rate your discipline this week 1–10. Be honest.',
  'What decision are you sitting on that needs to be made?',
  'What habit is serving you? What habit is costing you?',
  'What would Extreme Ownership look like right now?',
  'If you could only win at one thing this month, what would it be?',
  "What's the gap between who you say you are and how you're acting?",
];

const TONE_SYSTEMS = {
  coach:    "You are CB's high-performance coach. High-energy, direct, celebrates wins and calls out gaps. You remember what CB says he'll do and hold him accountable. End every response with a specific next action or challenge.",
  mentor:   "You are CB's wise mentor. Calm, long-view thinker. Share relevant frameworks, ask Socratic questions, help CB see patterns he's missing. Don't rush to advice — help him discover it.",
  stoic:    "You are CB's Stoic advisor, channeling Marcus Aurelius, Epictetus, and Seneca. Adversity is data. Control what you control. Discipline is freedom. Brief, sharp, no fluff. Quote Stoics when relevant.",
  drill:    "You are CB's drill sergeant. Extreme Ownership — CB owns everything. Zero tolerance for excuses. Blunt, direct, results-only. What did he say he'd do? Did he do it? Push hard.",
  therapist:"You are CB's reflective guide. Curious, non-judgmental, patient. Explore the 'why' behind choices. Ask open questions. Help CB discover his own insights rather than telling him. Validate, then challenge gently.",
};

function buildSystem(toneId, topicId) {
  const tone = TONE_SYSTEMS[toneId] || TONE_SYSTEMS.coach;
  const topicLine = topicId !== 'all'
    ? `\n\nFOCUS: Anchor conversations to CB's ${topicId} goals and challenges unless CB redirects.`
    : '';
  return `${SYSTEM_BASE}\n\nROLE: ${tone}${topicLine}\n\nIMPORTANT: Hold CB accountable to what he says. Push for specifics when answers are vague. Never let him off the hook with empty answers.`;
}

export default function CoachAI() {
  const { setPendingArtifact, newChatNonce } = useApp();   // layout is CSS media queries, not JS
  const [tone,         setTone]         = useState('coach');
  const [topic,        setTopic]        = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [drawerVersion, setDrawerVersion] = useState(0);
  const bottomRef = useRef(null);
  const sendRef   = useRef(null);

  const buildRequest = useCallback(
    () => ({ system: buildSystem(tone, topic) }),
    [tone, topic],
  );
  const { messages, input, setInput, loading, send, sessionId, resumeSession, startNewSession } =
    useChatThread({ maxTokens: 700, stream: false, buildRequest, persist: { module: 'coach', onSaved: () => setDrawerVersion(v => v + 1) } });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (newChatNonce) { startNewSession(); setSessionsOpen(false); } }, [newChatNonce, startNewSession]);
  sendRef.current = send;

  const currentTone  = TONES.find(t => t.id === tone)  || TONES[0];
  const currentTopic = TOPICS.find(t => t.id === topic) || TOPICS[0];

  return (
    <div className="ca-root">

      {sessionsOpen && (
        <SessionDrawer
          module="coach"
          activeId={sessionId}
          version={drawerVersion}
          color="var(--accent-text)"
          onResume={(sess) => { resumeSession(sess); setSessionsOpen(false); }}
          onNew={startNewSession}
          onClose={() => setSessionsOpen(false)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="ca-header">
        <div className="ca-header-row">
          <div>
            <div className="ca-eyebrow">Accountability Coach</div>
            <div className="ca-title">
              <Icon name={currentTone.icon} size={14} /> {currentTone.label} Mode
            </div>
            <div className="ca-sub">{currentTone.desc}</div>
          </div>
          <div className="ca-actions">
            <button type="button" onClick={() => setSessionsOpen(true)} title="Saved sessions" className="ca-btn">🗂 Sessions</button>
            <button type="button" onClick={startNewSession} className="ca-btn" data-quiet>✎ New</button>
            <button type="button" onClick={() => setSettingsOpen(o => !o)} className="ca-btn" data-on={settingsOpen || undefined} aria-pressed={settingsOpen}>⚙ Coach Type</button>
          </div>
        </div>

        {/* Topic focus pills */}
        <div className="ca-pills">
          {TOPICS.map(t => (
            <button type="button" key={t.id} onClick={() => setTopic(t.id)} className="ca-pill" data-on={topic === t.id || undefined} aria-pressed={topic === t.id}>
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Settings Panel ─────────────────────────────────────────────────── */}
      {settingsOpen && (
        <div className="ca-settings">
          <div className="ca-settings-title">Choose Your Coach Type</div>
          <div className="ca-tones">
            {TONES.map(t => (
              <button type="button" key={t.id} onClick={() => { setTone(t.id); setSettingsOpen(false); startNewSession(); }}
                className="ca-tone" data-on={tone === t.id || undefined} aria-pressed={tone === t.id}>
                <Icon name={t.icon} size={24} />
                <div className="ca-tone-label">{t.label}</div>
                <div className="ca-tone-desc">{t.desc}</div>
              </button>
            ))}
          </div>
          <div className="ca-settings-note">Switching coach type starts a new session.</div>
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="ca-thread">

        {messages.length === 0 && (
          <div className="ca-empty">
            <div className="ca-empty-icon"><Icon name={currentTone.icon} size={28} /></div>
            <div className="ca-empty-title">{currentTone.label} Mode · {currentTopic.label}</div>
            <div className="ca-empty-desc">{currentTone.desc}</div>
            <div className="ca-empty-eyebrow">Start with a check-in</div>
            <div className="ca-prompts">
              {CHECKIN_PROMPTS.slice(0, 5).map(p => (
                <button type="button" key={p} onClick={() => send(p)} className="ca-prompt">{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="ca-msg" data-role={msg.role}>
            {msg.role === 'user' ? (
              <div className="ca-bubble-user">{msg.content}</div>
            ) : (
              <div className="ca-bubble-ai">
                <div className="ca-bubble-head">
                  <div className="ca-bubble-tag">
                    <Icon name={currentTone.icon} size={14} /> {currentTone.label} · {currentTopic.label}
                  </div>
                  <button type="button" className="ca-save"
                    onClick={() => setPendingArtifact({ type: 'aiOutput', title: `Coach (${currentTone.label}): ${messages[i - 1]?.content?.slice(0, 40) || 'Session note'}...`, content: msg.content, source: 'coach' })}>
                    + Save to Project
                  </button>
                </div>
                <MD text={msg.content} color="var(--accent-text)" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="ca-msg" data-role="assistant">
            <div className="ca-bubble-ai" data-thinking>
              <div className="ca-bubble-tag ca-thinking-tag">Thinking…</div>
              <ThinkingDots color="var(--accent-text)" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="ca-composer">
        {messages.length > 0 && (
          <div className="ca-quick">
            {CHECKIN_PROMPTS.slice(5).map(p => (
              <button type="button" key={p} onClick={() => send(p)} className="ca-quick-chip">
                {p.length > 42 ? p.slice(0, 42) + '…' : p}
              </button>
            ))}
          </div>
        )}
        <div className="ca-input-row">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder="Be honest. The AI can handle it." className="ca-input" aria-label="Message your coach" />
          <button type="button" onClick={() => send(input)} disabled={!input.trim() || loading} className="ca-send" aria-label="Send">→</button>
        </div>
      </div>
    </div>
  );
}
