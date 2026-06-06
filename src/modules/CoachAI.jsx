import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT        = '#8b5cf6';
const ACCENT_BG     = 'rgba(139,92,246,0.08)';
const ACCENT_BORDER = 'rgba(139,92,246,0.2)';

const TONES = [
  { id: 'coach',     icon: '🏆', label: 'Coach',          desc: 'High-energy, goal-focused, celebrates wins, drives action' },
  { id: 'mentor',    icon: '🦉', label: 'Mentor',         desc: 'Wise, calm, long-view perspective, shares frameworks' },
  { id: 'stoic',     icon: '🪨', label: 'Stoic',          desc: 'Marcus Aurelius mode — adversity is data, discipline is freedom' },
  { id: 'drill',     icon: '🎯', label: 'Drill Sergeant', desc: 'No excuses, Extreme Ownership, blunt unfiltered truth' },
  { id: 'therapist', icon: '💙', label: 'Therapist',      desc: 'Reflective, curious, explores the "why" behind your choices' },
];

const TOPICS = [
  { id: 'all',      label: 'All Areas', icon: '⚡' },
  { id: 'projects', label: 'Projects',  icon: '🚀' },
  { id: 'learning', label: 'Learning',  icon: '📚' },
  { id: 'finance',  label: 'Finance',   icon: '💰' },
  { id: 'health',   label: 'Health',    icon: '⚕️' },
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
  return `${CB_IDENTITY}\n\nROLE: ${tone}${topicLine}\n\nIMPORTANT: Hold CB accountable to what he says. Push for specifics when answers are vague. Never let him off the hook with empty answers.`;
}

export default function CoachAI() {
  const { isMobile, isPhone, isTablet } = useApp();
  const [tone,         setTone]         = useState('coach');
  const [topic,        setTopic]        = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const bottomRef = useRef(null);
  const sendRef   = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    const hist    = [...messages, userMsg];
    setMessages(hist);
    setInput('');
    setLoading(true);
    try {
      const reply = await callClaude({
        system:    buildSystem(tone, topic),
        messages:  hist.map(m => ({ role: m.role, content: m.content })),
        maxTokens: 700,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Try again.' }]);
    }
    setLoading(false);
  };
  sendRef.current = send;

  const currentTone  = TONES.find(t => t.id === tone)  || TONES[0];
  const currentTopic = TOPICS.find(t => t.id === topic) || TOPICS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bord2)', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 4 }}>Accountability Coach</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", lineHeight: 1.1 }}>
              {currentTone.icon} {currentTone.label} Mode
            </div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>{currentTone.desc}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {messages.length > 0 && (
              <div onClick={() => setMessages([])}
                style={{ fontSize: 10, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--dim)', cursor: 'pointer' }}>
                New Session
              </div>
            )}
            <div onClick={() => setSettingsOpen(o => !o)}
              style={{ fontSize: 10, padding: '5px 12px', border: `1px solid ${settingsOpen ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 7, color: settingsOpen ? ACCENT : 'var(--subtle)', cursor: 'pointer', background: settingsOpen ? ACCENT_BG : 'transparent', fontWeight: 600, transition: 'all 0.12s' }}>
              ⚙ Coach Type
            </div>
          </div>
        </div>

        {/* Topic focus pills */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TOPICS.map(t => (
            <div key={t.id} onClick={() => setTopic(t.id)}
              style={{ flexShrink: 0, padding: '4px 11px', fontSize: 10, fontWeight: 600, borderRadius: 14, border: `1px solid ${topic === t.id ? ACCENT : 'var(--border)'}`, background: topic === t.id ? ACCENT_BG : 'transparent', color: topic === t.id ? ACCENT : 'var(--subtle)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
              {t.icon} {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Settings Panel ─────────────────────────────────────────────────── */}
      {settingsOpen && (
        <div style={{ background: 'var(--surf2)', borderBottom: '1px solid var(--bord2)', padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Choose Your Coach Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr 1fr' : isTablet ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: 8 }}>
            {TONES.map(t => (
              <div key={t.id} onClick={() => { setTone(t.id); setSettingsOpen(false); setMessages([]); }}
                style={{ padding: '12px', background: tone === t.id ? ACCENT_BG : 'var(--surface)', border: `1px solid ${tone === t.id ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 5 }}>{t.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: tone === t.id ? ACCENT : 'var(--text)', marginBottom: 3 }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.4 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 10, textAlign: 'center' }}>Switching coach type starts a new session.</div>
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 0' }}>

        {messages.length === 0 && (
          <div style={{ maxWidth: 500, margin: '0 auto', padding: '24px 0 0', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{currentTone.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{currentTone.label} Mode · {currentTopic.label}</div>
            <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.75, marginBottom: 28 }}>{currentTone.desc}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Start with a check-in</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left' }}>
              {CHECKIN_PROMPTS.slice(0, 5).map(p => (
                <div key={p} onClick={() => send(p)}
                  style={{ fontSize: 11, padding: '10px 14px', background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', lineHeight: 1.5, transition: 'background 0.1s', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: 760, margin: '0 auto 16px', animation: 'fadeUp 0.15s ease' }}>
            {msg.role === 'user' ? (
              <div style={{ background: 'var(--u-bubble)', border: '1px solid var(--u-bubble-b)', borderRadius: '14px 14px 3px 14px', padding: '10px 14px', maxWidth: '85%', fontSize: 13, lineHeight: 1.65, color: 'var(--u-bubble-text)' }}>
                {msg.content}
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: '3px 14px 14px 14px', padding: '13px 16px', maxWidth: '94%', width: '100%' }}>
                <div style={{ fontSize: 9, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>
                  {currentTone.icon} {currentTone.label} · {currentTopic.label}
                </div>
                <MD text={msg.content} color={ACCENT} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: 760, margin: '0 auto 16px' }}>
            <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: '3px 14px 14px 14px', padding: '12px 16px' }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>Thinking…</div>
              <ThinkingDots color={ACCENT} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 16px 16px', borderTop: '1px solid var(--bord2)', flexShrink: 0 }}>
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 8, paddingBottom: 2, scrollbarWidth: 'none' }}>
            {CHECKIN_PROMPTS.slice(5).map(p => (
              <div key={p} onClick={() => send(p)}
                style={{ fontSize: 9, padding: '3px 10px', background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {p.length > 42 ? p.slice(0, 42) + '…' : p}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 760, margin: '0 auto' }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder="Be honest. The AI can handle it."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: isMobile ? '12px 14px' : '10px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 13, outline: 'none', fontFamily: 'inherit', resize: 'none', maxHeight: 100 }} />
          <button onClick={() => send(input)} disabled={!input.trim()}
            style={{ padding: '10px 16px', background: input.trim() ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, color: input.trim() ? '#fff' : 'var(--dim)', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0, minHeight: 42 }}>→</button>
        </div>
      </div>
    </div>
  );
}
