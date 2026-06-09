import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, saveResearch, uid, timeAgo } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { Btn, Input, Label, Card, Badge, ThinkingDots, Modal } from './shared/Common.jsx';

const BOARD_COLS = [
  { id: 'collecting',   label: 'Collecting',   icon: '📥', color: '#38bdf8' },
  { id: 'analyzing',    label: 'Analyzing',    icon: '🔍', color: '#6366F1' },
  { id: 'synthesizing', label: 'Synthesizing', icon: '⚗️', color: '#a78bfa' },
  { id: 'insights',     label: 'Insights',     icon: '💡', color: '#ffcc44' },
];

function loadBoard()   { try { return JSON.parse(localStorage.getItem('aether_board') || '[]'); } catch { return []; } }
function saveBoard(b)  { localStorage.setItem('aether_board', JSON.stringify(b)); }

function ResearchBoard() {
  const [cards, setCards]         = useState(loadBoard);
  const [adding, setAdding]       = useState(null); // colId being added to
  const [draft, setDraft]         = useState('');
  const [synthesis, setSynthesis] = useState('');
  const [synLoading, setSynLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [cardAnalysis, setCardAnalysis] = useState({}); // id -> analysis text

  const persist = (updated) => { setCards(updated); saveBoard(updated); };

  const addCard = (colId) => {
    if (!draft.trim()) return;
    const isUrl = /^https?:\/\//i.test(draft.trim());
    const card = { id: uid(), content: draft.trim(), type: isUrl ? 'url' : 'text', column: colId, createdAt: Date.now() };
    persist([card, ...cards]);
    setDraft('');
    setAdding(null);
  };

  const analyzeCard = async (card) => {
    if (analyzingId === card.id) return;
    setAnalyzingId(card.id);
    setCardAnalysis(prev => ({ ...prev, [card.id]: '' }));
    try {
      const prompt = card.type === 'url'
        ? `Analyze this source/URL for CB's research: ${card.content}\n\nWhat is this about? Key signal, relevance, and what CB should take from it.`
        : `Analyze this research note for CB: "${card.content}"\n\nWhat's the signal here? Key insight, what's true/false, and what CB should do with this.`;
      const reply = await callClaude({
        system: CB_IDENTITY + '\n\nMODE: RESEARCH CARD ANALYSIS — Be concise, sharp, and decisive. Truth Score + Decisive Bet.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 600,
      });
      setCardAnalysis(prev => ({ ...prev, [card.id]: reply }));
    } catch {
      setCardAnalysis(prev => ({ ...prev, [card.id]: 'Analysis failed — try again.' }));
    }
    setAnalyzingId(null);
  };

  const moveCard = (id, dir) => {
    const idx = BOARD_COLS.findIndex(c => c.id === cards.find(c2 => c2.id === id)?.column);
    const next = BOARD_COLS[idx + dir];
    if (!next) return;
    persist(cards.map(c => c.id === id ? { ...c, column: next.id } : c));
  };

  const removeCard = (id) => persist(cards.filter(c => c.id !== id));

  const synthesizeAll = async () => {
    if (cards.length === 0) return;
    setSynLoading(true);
    setSynthesis('');
    const grouped = BOARD_COLS.map(col => {
      const colCards = cards.filter(c => c.column === col.id);
      if (!colCards.length) return '';
      return `${col.label}:\n${colCards.map(c => `- ${c.content}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    try {
      const r = await callClaude({
        system: CB_IDENTITY + '\n\nMODE: RESEARCH BOARD SYNTHESIS — Synthesize all research cards into a coherent intelligence brief. End with Truth Score, key insight, and decisive bet for CB.',
        messages: [{ role: 'user', content: `Synthesize my research board into a comprehensive intelligence brief:\n\n${grouped}` }],
        maxTokens: 900,
      });
      setSynthesis(r);
    } catch { setSynthesis('Synthesis failed — try again.'); }
    setSynLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cards.length} research cards</div>
          <div style={{ fontSize: 10, color: 'var(--dim)' }}>Collect signals → analyze → synthesize → extract insights</div>
        </div>
        {cards.length > 0 && (
          <div onClick={synthesizeAll} style={{ padding: '7px 16px', background: '#6366F1', borderRadius: 9, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
            {synLoading ? '⟳ Synthesizing…' : '✦ AI Synthesize All'}
          </div>
        )}
      </div>

      {synthesis && (
        <div style={{ background: 'var(--surface)', border: '1px solid #6366F130', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 8, letterSpacing: 3, color: '#6366F1', textTransform: 'uppercase', marginBottom: 10 }}>Board Synthesis</div>
          <MD text={synthesis} color="#6366F1" />
          <div onClick={() => setSynthesis('')} style={{ marginTop: 10, fontSize: 10, color: 'var(--dim)', cursor: 'pointer' }}>Clear</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, overflowX: 'auto' }}>
        {BOARD_COLS.map((col, colIdx) => {
          const colCards = cards.filter(c => c.column === col.id);
          return (
            <div key={col.id} style={{ background: 'var(--surface)', border: `1px solid ${col.color}25`, borderRadius: 12, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${col.color}25` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{col.icon} {col.label}</div>
                <span style={{ fontSize: 10, color: 'var(--dim)' }}>{colCards.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10, minHeight: 60 }}>
                {colCards.map(card => (
                  <div key={card.id} style={{ background: 'var(--bg)', border: `1px solid ${col.color}20`, borderRadius: 8, padding: '9px 10px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-b)', lineHeight: 1.45, marginBottom: 6, wordBreak: 'break-word' }}>
                      {card.type === 'url'
                        ? <span onClick={() => window.open(card.content, '_blank')} style={{ color: 'var(--accent,#00C6E6)', cursor: 'pointer', textDecoration: 'underline' }}>{card.content.slice(0, 50)}…</span>
                        : card.content.slice(0, 120) + (card.content.length > 120 ? '…' : '')
                      }
                    </div>
                    {cardAnalysis[card.id] && (
                      <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5, marginBottom: 6, padding: '6px 8px', background: `${col.color}10`, borderRadius: 6, borderLeft: `2px solid ${col.color}` }}>
                        <MD text={cardAnalysis[card.id]} color={col.color} />
                      </div>
                    )}
                    {analyzingId === card.id && (
                      <div style={{ fontSize: 10, color: col.color, marginBottom: 6 }}>
                        <ThinkingDots color={col.color} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {colIdx > 0 && <span onClick={() => moveCard(card.id, -1)} style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer', padding: '1px 5px' }}>←</span>}
                      {colIdx < BOARD_COLS.length - 1 && <span onClick={() => moveCard(card.id, 1)} style={{ fontSize: 11, color: col.color, cursor: 'pointer', padding: '1px 5px' }}>→</span>}
                      <span onClick={() => analyzeCard(card)} style={{ fontSize: 9, color: col.color, cursor: 'pointer', padding: '1px 6px', border: `1px solid ${col.color}40`, borderRadius: 4, marginLeft: 2 }}>✦ AI</span>
                      <span onClick={() => removeCard(card.id)} style={{ fontSize: 10, color: 'var(--dim)', cursor: 'pointer', marginLeft: 'auto', padding: '1px 4px' }}>✕</span>
                    </div>
                  </div>
                ))}
              </div>

              {adding === col.id ? (
                <div>
                  <textarea value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(col.id); } }}
                    placeholder="Text or URL… (Enter to save)"
                    rows={2}
                    style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${col.color}40`, borderRadius: 7, padding: '7px 10px', color: 'var(--text-b)', fontSize: 11, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box', marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 5 }}>
                    <div onClick={() => addCard(col.id)} style={{ flex: 1, padding: '5px', textAlign: 'center', background: col.color, borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Add</div>
                    <div onClick={() => { setAdding(null); setDraft(''); }} style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 10, color: 'var(--dim)', cursor: 'pointer' }}>✕</div>
                  </div>
                </div>
              ) : (
                <div onClick={() => { setAdding(col.id); setDraft(''); }}
                  style={{ padding: '6px', border: `1px dashed ${col.color}40`, borderRadius: 7, textAlign: 'center', fontSize: 10, color: 'var(--dim)', cursor: 'pointer', transition: 'all 0.12s' }}>
                  + Add
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SEARCH_SUGGESTIONS = [
  'Houston real estate market 2025 tipping point',
  'AI agent disruption — which industries first',
  'ERCOT energy storage opportunities',
  'Covered calls strategy for dividend portfolios',
  'Blue Ocean in B2B business development',
  'Longevity biomarkers — what to track',
  'Passive income structures under $500K',
  'Semiconductor supply chain after Chip War',
];

const SOURCE_LIBRARY = [
  { name: 'Peter Attia', domain: 'Longevity/Medicine', type: 'Thinker', color: '#ff8844' },
  { name: 'Andrew Huberman', domain: 'Neuroscience/Performance', type: 'Thinker', color: '#44ffcc' },
  { name: 'Naval Ravikant', domain: 'Wealth/Philosophy', type: 'Thinker', color: '#6366F1' },
  { name: 'Chris Miller', domain: 'Geopolitics/Tech', type: 'Author', color: '#00FFB2' },
  { name: 'Warren Buffett', domain: 'Investing', type: 'Author', color: '#ffcc44' },
  { name: 'Jocko Willink', domain: 'Leadership', type: 'Author', color: '#ff6644' },
  { name: 'The Hustle', domain: 'Business News', type: 'Newsletter', color: '#ff44cc' },
  { name: 'Axios', domain: 'News/Policy', type: 'Newsletter', color: '#4488ff' },
];

export default function ResearchHub() {
  const { graph, research, setResearch, isMobile } = useApp();
  const [activeThread, setActiveThread] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  const [boardView, setBoardView] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const startThread = async (query) => {
    const thread = {
      id: uid(),
      title: query.slice(0, 60) + (query.length > 60 ? '...' : ''),
      query,
      status: 'active',
      createdAt: Date.now(),
      tags: [],
      messages: [],
    };
    const updated = [thread, ...research];
    setResearch(updated);
    await saveResearch(updated);
    setActiveThread(thread.id);
    setMessages([]);
    setShowNewThread(false);
    setNewQuery('');
    await sendMessage(thread.id, updated, query, []);
  };

  const sendMessage = async (threadId, threads, text, prevMessages) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    const newMsgs = [...prevMessages, userMsg];
    setMessages(newMsgs);
    setSearchInput('');
    setLoading(true);
    try {
      const system = {
        cached: CB_IDENTITY,
        dynamic: "\n\nMODE: TRUTH & RESEARCH HUB\nYour job: cut through narrative, surface signal, flag bias, give CB the contrarian insight most people miss. Prioritize analytical depth and objectivity over forced connections. End every response with: (1) Truth Score (1-10, how confident you are in this), (2) Bias Flags (sources or narratives to be skeptical of), (3) Decisive Bet (what CB should do with this information). Be rigorous.",
      };
      const reply = await callClaude({ system, messages: newMsgs.map(m => ({ role: m.role, content: m.content })), searchEnabled });
      const assistantMsg = { role: 'assistant', content: reply };
      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      const updatedThreads = threads.map(t => t.id === threadId ? { ...t, messages: finalMsgs } : t);
      setResearch(updatedThreads);
      await saveResearch(updatedThreads);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Try again.' }]);
    }
    setLoading(false);
  };

  const openThread = (thread) => {
    setActiveThread(thread.id);
    setMessages(thread.messages || []);
    if ((thread.messages || []).length === 0) sendMessage(thread.id, research, thread.query, []);
  };

  const deleteThread = async (id) => {
    const updated = research.filter(t => t.id !== id);
    setResearch(updated);
    await saveResearch(updated);
    if (activeThread === id) { setActiveThread(null); setMessages([]); }
  };

  if (!activeThread) return (
    <div style={{ padding: isMobile ? '16px 16px 60px' : '24px 28px 60px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: '#6366F1', textTransform: 'uppercase', marginBottom: 6 }}>Truth & Research Hub</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Deep Intelligence Search</div>
          <div style={{ fontSize: 11, color: 'var(--subtle)' }}>CB-style. Every response: Truth Score · Bias Flags · Decisive Bet.</div>
        </div>
        <div onClick={() => setShowNewThread(true)} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #6366F1, #00FFB2)', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ New Thread</div>
      </div>

      {/* View switcher: Threads | Board */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{ id: false, label: '💬 Threads' }, { id: true, label: '🗂 Research Board' }].map(v => (
          <div key={String(v.id)} onClick={() => setBoardView(v.id)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, borderRadius: 10, cursor: 'pointer', border: `1px solid ${boardView === v.id ? '#6366F1' : 'var(--border)'}`, background: boardView === v.id ? '#6366F115' : 'var(--surface)', color: boardView === v.id ? '#6366F1' : 'var(--muted)', transition: 'all 0.12s' }}>
            {v.label}
          </div>
        ))}
      </div>

      {boardView && <ResearchBoard />}

      {!boardView && <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)', border: '1px solid #6366F130', borderRadius: 14, padding: '14px 18px', marginBottom: 12 }}>
          <span style={{ fontSize: 16, color: '#6366F1' }}>🔭</span>
          <input value={newQuery} onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newQuery.trim() && startThread(newQuery)}
            placeholder="Research a topic, question, or opportunity..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-b)', fontFamily: 'inherit' }} />
          <div onClick={() => setSearchEnabled(s => !s)} style={{ fontSize: 9, padding: '4px 9px', border: `1px solid ${searchEnabled ? '#4488ff' : 'var(--border)'}`, borderRadius: 8, color: searchEnabled ? '#4488ff' : 'var(--dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>🔍 Web {searchEnabled ? 'ON' : 'OFF'}</div>
          {newQuery.trim() && <div onClick={() => startThread(newQuery)} style={{ padding: '7px 14px', background: '#6366F1', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Research →</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SEARCH_SUGGESTIONS.map(s => (
            <div key={s} onClick={() => startThread(s)} style={{ fontSize: 10, padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--subtle)', borderRadius: 20, cursor: 'pointer' }}>{s}</div>
          ))}
        </div>
      </div>}

      {!boardView && <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px', gap: 24 }}>
        <div>
          <Label color="#6366F1">Research Threads</Label>
          {research.length === 0 && <div style={{ fontSize: 12, color: 'var(--dim)', padding: '24px 0' }}>No research threads yet. Start one above.</div>}
          {research.map(t => (
            <Card key={t.id} color="#6366F1" onClick={() => openThread(t)} style={{ marginBottom: 10, cursor: 'pointer', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.4 }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>{timeAgo(t.createdAt)} · {(t.messages || []).filter(m => m.role === 'assistant').length} responses</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 10 }}>
                  <Badge color={t.status === 'active' ? '#00FFB2' : 'var(--subtle)'}>{t.status}</Badge>
                  <div onClick={e => { e.stopPropagation(); deleteThread(t.id); }} style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer', padding: '2px 4px' }}>✕</div>
                </div>
              </div>
              {t.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 5 }}>
                  {t.tags.map(tag => <span key={tag} style={{ fontSize: 8, color: 'var(--subtle)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 3 }}>{tag}</span>)}
                </div>
              )}
            </Card>
          ))}
        </div>

        <div>
          <Label color="#6366F1">Source Library</Label>
          {SOURCE_LIBRARY.map(s => (
            <div key={s.name}
              onClick={() => startThread(`What are the key ideas, frameworks, and actionable insights from ${s.name} (${s.domain})? What should CB know about their work?`)}
              style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 7, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge color={s.color}>{s.type}</Badge>
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>→</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>{s.domain} · click to research</div>
            </div>
          ))}
        </div>
      </div>}

      {showNewThread && (
        <Modal title="New Research Thread" accent="#6366F1" onClose={() => setShowNewThread(false)}>
          <Textarea value={newQuery} onChange={setNewQuery} placeholder="What do you want to research? Be specific — the more context, the better the response." rows={4} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={() => setShowNewThread(false)} style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer' }}>Cancel</div>
            <div onClick={() => newQuery.trim() && startThread(newQuery)} style={{ flex: 2, padding: '11px', background: '#6366F1', borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Research →</div>
          </div>
        </Modal>
      )}
    </div>
  );

  const thread = research.find(t => t.id === activeThread);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bord2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div onClick={() => setActiveThread(null)} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 4 }}>← Research Hub</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', maxWidth: 500 }}>{thread?.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={() => setSearchEnabled(s => !s)} style={{ fontSize: 9, padding: '4px 9px', border: `1px solid ${searchEnabled ? '#4488ff' : 'var(--border)'}`, borderRadius: 8, color: searchEnabled ? '#4488ff' : 'var(--dim)', cursor: 'pointer' }}>🔍 Web {searchEnabled ? 'ON' : 'OFF'}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 160px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 18, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: 760, margin: '0 auto 18px' }}>
            {msg.role === 'user' ? (
              <div style={{ background: 'var(--u-bubble)', border: '1px solid var(--u-bubble-b)', borderRadius: '16px 16px 4px 16px', padding: '11px 15px', maxWidth: '80%', fontSize: 13, lineHeight: 1.7, color: 'var(--u-bubble-text)' }}>{msg.content}</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid #6366F120', borderRadius: '4px 16px 16px 16px', padding: '14px 18px', maxWidth: '94%', width: '100%' }}>
                <div style={{ fontSize: 8, letterSpacing: 3, color: '#6366F1', textTransform: 'uppercase', marginBottom: 10 }}>Research · Truth-First Analysis</div>
                <MD text={msg.content} color="#6366F1" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: 760, margin: '0 auto 18px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid #6366F120', borderRadius: '4px 16px 16px 16px', padding: '12px 16px' }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: '#6366F1', textTransform: 'uppercase', marginBottom: 8 }}>Researching...</div>
              <ThinkingDots color="#6366F1" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', borderTop: '1px solid var(--bord2)', padding: '10px 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 760, margin: '0 auto', alignItems: 'flex-end' }}>
          <textarea value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(activeThread, research, searchInput, messages); } }}
            rows={1} placeholder="Follow-up question, contrarian challenge, or deeper dive..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', color: 'var(--text-b)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', maxHeight: 100 }} />
          <button onClick={() => sendMessage(activeThread, research, searchInput, messages)} disabled={!searchInput.trim() || loading}
            style={{ padding: '10px 16px', background: searchInput.trim() ? '#6366F1' : 'var(--bord2)', border: 'none', borderRadius: 10, color: searchInput.trim() ? '#fff' : 'var(--dim)', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>→</button>
        </div>
      </div>
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 14 }} />
  );
}
