import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../App.jsx';
import { CHAT_MODES } from '../constants.js';
import { buildSystem, processFiles } from '../utils.js';
import useChatThread from '../hooks/useChatThread.js';
import useVoiceInput from '../hooks/useVoiceInput.js';
import MD from './shared/MD.jsx';
import Icon from './shared/Icon.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';
import DiagramBlock from './shared/DiagramBlock.jsx';
import SessionDrawer from './shared/SessionDrawer.jsx';
import ConnectedKnowledge from './shared/ConnectedKnowledge.jsx';
import { ThinkingDots, Label } from './shared/Common.jsx';
import './chat-panel.css';

const QUICK_PROMPTS = {
  home:     ['What should I focus on today?', 'Connect my top 3 learnings', 'Where is the biggest Blue Ocean right now?', 'Give me a decisive action for this week'],
  learn:    ['Cross-reference my recent learning', 'What mental model applies here?', 'Find the tipping point', 'What am I missing?'],
  research: ["Contrarian view on this topic", "What would the market get wrong?", "Strip the narrative — what's true?", 'Blue Ocean angle'],
  projects: ['What knowledge applies to my active projects?', 'Where should I focus next 30 days?', "What's the compounding play here?", "Biggest risk I'm ignoring?"],
  vault:    ['Synthesize my strongest connections', "What's the thread across my notes?", 'Turn my notes into a decisive action', 'Gap analysis — what am I missing?'],
  growth:   ['Rate my learning stack honestly', 'What skill compounds most in 3 years?', 'Stoic lens on where I am', 'Extreme Ownership moment — what do I own?'],
};

export default function ChatPanel() {
  const { chatOpen, setChatOpen, activeModule, graph, projects, isMobile, chatPrefill, setChatPrefill, newChatNonce, chatAttach, setChatAttach } = useApp();
  const [chatMode, setChatMode] = useState('synthesis');
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [drawerVersion, setDrawerVersion] = useState(0);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const sendRef = useRef(null);
  const { listening, toggle: toggleVoice, supported: voiceOk } = useVoiceInput();

  const buildRequest = useCallback(
    () => ({ system: buildSystem(null, null, { chatMode }, graph) }),
    [chatMode, graph],
  );
  const { messages, input, setInput, attachments, setAttachments, loading, streamText: stream, send, sessionId, resumeSession, startNewSession } =
    useChatThread({ buildRequest, persist: { module: 'chat', onSaved: () => setDrawerVersion(v => v + 1) } });

  // Scroll ONLY the messages pane, and only while the panel is open. scrollIntoView
  // scrolls every ancestor — including the overflow:hidden app shell — so on mount
  // (panel closed, off-screen) it shifted the whole page ~22px (CLS 0.09–0.11 at
  // iPad on What's Happening; caught by the responsive gate, Batch Z-2).
  useEffect(() => {
    if (!chatOpen) return;
    const end = bottomRef.current; const pane = end?.parentElement;
    if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, stream, chatOpen]);

  // Global "New chat" from the top bar → start fresh here (and detach).
  useEffect(() => { if (newChatNonce) { startNewSession(); setSessionsOpen(false); setChatAttach?.(null); } }, [newChatNonce, startNewSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send when opened via AI search
  useEffect(() => {
    if (chatOpen && chatPrefill) {
      const query = chatPrefill;
      setChatPrefill('');
      setTimeout(() => sendRef.current?.(query), 120);
    }
  }, [chatOpen, chatPrefill, setChatPrefill]);
  sendRef.current = send;

  const handleFiles = async (files) => {
    const processed = await processFiles(files);
    setAttachments(prev => [...prev, ...processed]);
  };

  const mode = CHAT_MODES.find(m => m.id === chatMode);
  const prompts = QUICK_PROMPTS[activeModule] || QUICK_PROMPTS.home;

  if (!chatOpen) return null;

  return (
    <div className="cp" data-mobile={isMobile ? '' : undefined} role="complementary" aria-label="Intelligence Chat">
      {sessionsOpen && (
        <SessionDrawer
          module="chat"
          activeId={sessionId}
          version={drawerVersion}
          color="var(--accent-text)"
          onResume={(sess) => { resumeSession(sess); setSessionsOpen(false); setChatAttach?.(null); }}
          onNew={() => { startNewSession(); setChatAttach?.(null); }}
          onClose={() => setSessionsOpen(false)}
        />
      )}
      {/* Header */}
      <div className="cp-head">
        <div className="cp-head-row">
          <div>
            <div className="cp-title">Intelligence Chat</div>
            <div className="cp-kicker"><Icon name={mode?.icon} size={13} /> {mode?.label}</div>
          </div>
          <div className="cp-tools">
            <button type="button" className="cp-icon-btn tap" onClick={() => setSessionsOpen(true)} title="Saved sessions" aria-label="Saved sessions">🗂</button>
            <button type="button" className="cp-icon-btn tap" onClick={() => { startNewSession(); setSessionsOpen(false); setChatAttach?.(null); }} title="New session" aria-label="New session">✎</button>
            <button type="button" className="cp-icon-btn tap" onClick={() => setChatOpen(false)} title="Close" aria-label="Close chat">✕</button>
          </div>
        </div>
        <div className="cp-modes" data-scroll-x="">
          {CHAT_MODES.map(m => (
            <button type="button" key={m.id} className="cp-mode tap" aria-pressed={chatMode === m.id} onClick={() => setChatMode(m.id)} title={m.desc}>
              <Icon name={m.icon} size={13} /> {m.label}
            </button>
          ))}
        </div>
        {/* Attachment — names the artifact this chat opened from, so the user can
            see the context is live. Detach returns to generic chat. */}
        {chatAttach?.label && (
          <div className="cp-attach">
            <Icon name="Paperclip" size={12} />
            <span className="cp-attach-label">{chatAttach.label}</span>
            <button type="button" className="cp-detach tap" onClick={() => setChatAttach?.(null)} title="Detach" aria-label="Detach">✕</button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="cp-msgs">
        {messages.length === 0 && (
          <div className="cp-empty">
            <div className="cp-empty-glyph" aria-hidden="true">⚡</div>
            <div className="cp-empty-title">{mode?.label} Mode</div>
            <div className="cp-empty-desc">{mode?.desc}</div>
            <div className="cp-prompts-wrap">
              <Label>Quick prompts</Label>
              <div className="cp-prompts">
                {prompts.map(p => (
                  <button type="button" key={p} className="cp-prompt" onClick={() => send(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {/* The Ask layer surfaces the knowledge graph — what you've studied,
                connected, tap to ask about any of it. */}
            <div className="cp-ck">
              <ConnectedKnowledge compact />
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="cp-msg" data-role={msg.role === 'user' ? 'user' : 'ai'}>
            {msg.role === 'user' ? (
              <div className="cp-bubble-user">
                {msg.content}
              </div>
            ) : (
              <div className="cp-bubble-ai">
                <div className="cp-bubble-kicker">Film Room · {mode?.label}</div>
                <MD text={msg.content} color="var(--accent-text)" />
                <div className="cp-bubble-tools">
                  <SaveToNotes title={msg.content.split('\n')[0].replace(/[#*>_`-]/g, '').trim().slice(0, 70)} content={msg.content} source={{ title: `Intelligence Chat · ${mode?.label || ''}`.trim(), tier: 'reported' }} label="Save to Notes" />
                </div>
                {msg.content.length > 220 && (
                  <DiagramBlock content={msg.content} hint="Diagram the structure of this answer." label="Visualize" compact />
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="cp-msg" aria-live="polite">
            <div className="cp-bubble-ai">
              <div className="cp-bubble-kicker">Film Room · {mode?.label}</div>
              {stream
                ? <MD text={stream + '▍'} color="var(--accent-text)" />
                : <ThinkingDots color="var(--accent-text)" />}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="cp-files">
          {attachments.map((a, i) => (
            <div key={i} className="cp-file">
              <Icon name={a.icon} size={13} /> {a.name.slice(0, 14)}
              <button type="button" className="cp-file-x tap" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} aria-label={`Remove ${a.name}`}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="cp-input">
        {messages.length > 0 && (
          <div className="cp-chips" data-scroll-x="">
            {prompts.slice(0, 3).map(p => (
              <button type="button" key={p} className="cp-chip tap" onClick={() => send(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="cp-compose">
          {/* File upload */}
          <button type="button" className="cp-tool tap" onClick={() => fileRef.current?.click()}
            title="Attach files — docs, images, audio, video" aria-label="Attach files">📎</button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.mp3,.m4a,.wav,.mp4,.mov" hidden onChange={e => handleFiles(e.target.files)} />
          {/* Voice input */}
          {voiceOk && (
            <button type="button" className="cp-tool tap" aria-pressed={listening} onClick={() => toggleVoice((t, final) => { setInput(t); })}
              title={listening ? 'Stop recording' : 'Voice input'} aria-label={listening ? 'Stop recording' : 'Voice input'}>
              🎙️
            </button>
          )}
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1} placeholder={listening ? 'Listening…' : 'Ask anything — paste docs, images, or use voice…'}
            className="cp-text" data-listening={listening ? '' : undefined} aria-label="Message" />
          <button type="button" className="cp-send tap" onClick={() => send(input)} disabled={!input.trim() && attachments.length === 0} aria-label="Send">→</button>
        </div>
      </div>
    </div>
  );
}
