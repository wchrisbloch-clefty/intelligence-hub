import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { CHAT_MODES } from '../constants.js';
import { callClaude, buildApiMessages, buildSystem, processFiles } from '../utils.js';
import useVoiceInput from '../hooks/useVoiceInput.js';
import MD from './shared/MD.jsx';
import { ThinkingDots, Label } from './shared/Common.jsx';

const QUICK_PROMPTS = {
  home:     ['What should I focus on today?', 'Connect my top 3 learnings', 'Where is the biggest Blue Ocean right now?', 'Give me a decisive action for this week'],
  learn:    ['Cross-reference my recent learning', 'What mental model applies here?', 'Find the tipping point', 'What am I missing?'],
  research: ["Contrarian view on this topic", "What would the market get wrong?", "Strip the narrative — what's true?", 'Blue Ocean angle'],
  projects: ['What knowledge applies to my active projects?', 'Where should I focus next 30 days?', "What's the compounding play here?", "Biggest risk I'm ignoring?"],
  vault:    ['Synthesize my strongest connections', "What's the thread across my notes?", 'Turn my notes into a decisive action', 'Gap analysis — what am I missing?'],
  growth:   ['Rate my learning stack honestly', 'What skill compounds most in 3 years?', 'Stoic lens on where I am', 'Extreme Ownership moment — what do I own?'],
};

export default function ChatPanel() {
  const { chatOpen, setChatOpen, activeModule, graph, projects, isMobile, chatPrefill, setChatPrefill } = useApp();
  const [chatMode, setChatMode] = useState('synthesis');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState('');
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const sendRef = useRef(null);
  const { listening, toggle: toggleVoice, supported: voiceOk } = useVoiceInput();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, stream]);

  // Auto-send when opened via AI search
  useEffect(() => {
    if (chatOpen && chatPrefill) {
      const query = chatPrefill;
      setChatPrefill('');
      setTimeout(() => sendRef.current?.(query), 120);
    }
  }, [chatOpen, chatPrefill, setChatPrefill]);

  const send = async (text) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    const userMsg = { role: 'user', content: text, attachments };
    const newHist = [...messages, userMsg];
    setMessages(newHist);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setStream('');
    try {
      const system = buildSystem(null, null, { chatMode }, graph);
      const apiMsgs = await buildApiMessages(newHist);
      const reply = await callClaude({ system, messages: apiMsgs, onToken: (t) => setStream(s => s + t) });
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e?.authExpired ? 'Auth expired — re-enter your code to continue.' : 'AI request failed — retry.' }]);
    }
    setStream('');
    setLoading(false);
  };
  sendRef.current = send;

  const handleFiles = async (files) => {
    const processed = await processFiles(files);
    setAttachments(prev => [...prev, ...processed]);
  };

  const mode = CHAT_MODES.find(m => m.id === chatMode);
  const prompts = QUICK_PROMPTS[activeModule] || QUICK_PROMPTS.home;

  if (!chatOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: isMobile ? '100%' : 360,
      height: isMobile ? 'calc(100vh - 60px)' : '100vh',
      background: 'var(--bg-nav)',
      borderLeft: isMobile ? 'none' : '1px solid var(--bord2)',
      display: 'flex', flexDirection: 'column',
      zIndex: isMobile ? 200 : 50,
      animation: 'slideInRight 0.22s ease',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bord2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif" }}>Intelligence Chat</div>
            <div style={{ fontSize: 9, color: '#D9A441', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>{mode?.icon} {mode?.label}</div>
          </div>
          <div onClick={() => setChatOpen(false)} style={{ fontSize: 13, color: 'var(--subtle)', cursor: 'pointer', padding: '2px 5px' }}>✕</div>
        </div>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {CHAT_MODES.map(m => (
            <div key={m.id} onClick={() => setChatMode(m.id)} title={m.desc}
              style={{ fontSize: 9, padding: '4px 8px', borderRadius: 6, border: `1px solid ${chatMode === m.id ? '#D9A441' : 'var(--border)'}`, color: chatMode === m.id ? '#D9A441' : 'var(--subtle)', cursor: 'pointer', background: chatMode === m.id ? '#D9A44110' : 'transparent', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {m.icon} {m.label}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
            <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 700, marginBottom: 6 }}>{mode?.label} Mode</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.7 }}>{mode?.desc}</div>
            <div style={{ marginTop: 16 }}>
              <Label>Quick prompts</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {prompts.map(p => (
                  <div key={p} onClick={() => send(p)}
                    style={{ fontSize: 11, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer', textAlign: 'left', lineHeight: 1.5 }}>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeUp 0.15s ease' }}>
            {msg.role === 'user' ? (
              <div style={{ background: 'var(--u-bubble)', border: '1px solid var(--u-bubble-b)', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', maxWidth: '88%', fontSize: 12, lineHeight: 1.65, color: 'var(--u-bubble-text)' }}>
                {msg.content}
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid #D9A44120', borderRadius: '3px 14px 14px 14px', padding: '12px 14px', maxWidth: '96%' }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: '#D9A441', textTransform: 'uppercase', marginBottom: 8 }}>Film Room · {mode?.label}</div>
                <MD text={msg.content} color="#D9A441" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid #D9A44120', borderRadius: '3px 14px 14px 14px', padding: '12px 14px', maxWidth: '96%' }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: '#D9A441', textTransform: 'uppercase', marginBottom: 8 }}>Film Room · {mode?.label}</div>
              {stream
                ? <MD text={stream + '▍'} color="#D9A441" />
                : <ThinkingDots color="#D9A441" />}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div style={{ padding: '6px 14px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {attachments.map((a, i) => (
            <div key={i} style={{ fontSize: 9, color: '#D9A441', background: '#D9A44112', border: '1px solid #D9A44125', borderRadius: 5, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
              {a.icon} {a.name.slice(0, 14)}
              <span onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} style={{ color: '#C4553D', cursor: 'pointer' }}>✕</span>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--bord2)', flexShrink: 0 }}>
        {messages.length > 0 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', marginBottom: 8, paddingBottom: 2 }}>
            {prompts.slice(0, 3).map(p => (
              <div key={p} onClick={() => send(p)}
                style={{ fontSize: 9, padding: '3px 9px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--subtle)', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {p}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          {/* File upload */}
          <div onClick={() => fileRef.current?.click()}
            title="Attach files — docs, images, audio, video"
            style={{ padding: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--subtle)', fontSize: 13, flexShrink: 0, minHeight: 36, display: 'flex', alignItems: 'center' }}>📎</div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.mp3,.m4a,.wav,.mp4,.mov" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          {/* Voice input */}
          {voiceOk && (
            <div onClick={() => toggleVoice((t, final) => { setInput(t); })}
              title={listening ? 'Stop recording' : 'Voice input'}
              style={{ padding: '8px', background: listening ? '#C4553D12' : 'var(--surface)', border: `1px solid ${listening ? '#C4553D' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', color: listening ? '#C4553D' : 'var(--subtle)', fontSize: 13, flexShrink: 0, minHeight: 36, display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
              🎙️
            </div>
          )}
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder={listening ? 'Listening…' : 'Ask anything — paste docs, images, or use voice…'}
            style={{ flex: 1, background: 'var(--surface)', border: `1px solid ${listening ? '#C4553D40' : 'var(--border)'}`, borderRadius: 10, padding: '8px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', maxHeight: 80, transition: 'border-color 0.15s' }} />
          <button onClick={() => send(input)} disabled={!input.trim() && attachments.length === 0}
            style={{ padding: '8px 13px', background: input.trim() || attachments.length > 0 ? 'var(--accent,#D9A441)' : 'var(--bord2)', border: 'none', borderRadius: 9, color: input.trim() || attachments.length > 0 ? '#000' : 'var(--dim)', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, minHeight: 36 }}>→</button>
        </div>
      </div>
    </div>
  );
}
