import './research-hub.css';
import { T } from '../theme';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, saveResearch, uid, timeAgo } from '../utils.js';
import { logConcept } from '../lib/graph.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { getFeed, relTime } from '../lib/adapters.js';
import { matchItems } from '../lib/topics.js';
import { TIER_INSTRUCTION } from '../lib/rigor.js';
import { SectionSkeleton, SectionError } from './shared/SectionState.jsx';
import { SYSTEM_BASE } from '../constants.js';

const BOARD_KEY = 'aether_board';
const RESEARCH_SEEN_KEY = 'aether_research_seen_v1'; // { [threadId]: lastVisitedAt } — "new since last visit" watermark
import MD from './shared/MD.jsx';
import { Label, Card, Badge, Modal } from './shared/Common.jsx';
import PageWithRail from './shared/PageWithRail.jsx';
import ProvenancePanel from './shared/ProvenancePanel.jsx';
import AskChip from './shared/AskChip.jsx';
import FollowButton from './shared/FollowButton.jsx';
import Icon from './shared/Icon.jsx';

const BOARD_COLS = [
  { id: 'collecting',   label: 'Collecting',   icon: 'Inbox' },
  { id: 'analyzing',    label: 'Analyzing',    icon: 'Search' },
  { id: 'synthesizing', label: 'Synthesizing', icon: 'Layers' },
  { id: 'insights',     label: 'Insights',     icon: 'Zap' },
];

function loadBoard()   { return readLocal(BOARD_KEY, []); }
function saveBoard(b)  { writeThrough(BOARD_KEY, b); }

function ResearchBoard() {
  const [cards, setCards]         = useState(loadBoard);
  const [adding, setAdding]       = useState(null); // colId being added to
  const [draft, setDraft]         = useState('');
  const [synthesis, setSynthesis] = useState('');
  const [synLoading, setSynLoading] = useState(false);
  // Failure as STATE, not content (used to be written into `synthesis`).
  const [synErr, setSynErr] = useState('');
  const [cardErr, setCardErr] = useState({}); // id -> error message
  const [analyzingId, setAnalyzingId] = useState(null);
  const [cardAnalysis, setCardAnalysis] = useState({}); // id -> analysis text

  const persist = (updated) => { setCards(updated); saveBoard(updated); };

  // Cross-device: pull the server copy after mount.
  useEffect(() => { hydrate(BOARD_KEY).then(r => { if (Array.isArray(r)) setCards(r); }); }, []);

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
    setCardErr(prev => { const n = { ...prev }; delete n[card.id]; return n; });
    try {
      const prompt = card.type === 'url'
        ? `Analyze this source/URL for CB's research: ${card.content}\n\nWhat is this about? Key signal, relevance, and what CB should take from it.`
        : `Analyze this research note for CB: "${card.content}"\n\nWhat's the signal here? Key insight, what's true/false, and what CB should do with this.`;
      const reply = await callClaude({
        system: SYSTEM_BASE + '\n\nMODE: RESEARCH CARD ANALYSIS — Be concise, sharp, and decisive. Truth Score + Decisive Bet.\n\n' + TIER_INSTRUCTION,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 700,
      });
      setCardAnalysis(prev => ({ ...prev, [card.id]: reply }));
    } catch (e) {
      setCardErr(prev => ({ ...prev, [card.id]: e?.message || 'Analysis failed.' }));
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
    setSynErr('');
    const grouped = BOARD_COLS.map(col => {
      const colCards = cards.filter(c => c.column === col.id);
      if (!colCards.length) return '';
      return `${col.label}:\n${colCards.map(c => `- ${c.content}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    try {
      const r = await callClaude({
        system: SYSTEM_BASE + '\n\nMODE: RESEARCH BOARD SYNTHESIS — Synthesize all research cards into a coherent intelligence brief. End with Truth Score, key insight, and decisive bet for CB.\n\n' + TIER_INSTRUCTION,
        messages: [{ role: 'user', content: `Synthesize my research board into a comprehensive intelligence brief:\n\n${grouped}` }],
        maxTokens: 1000,
      });
      setSynthesis(r);
    } catch (e) { setSynErr(e?.message || 'The AI providers were unavailable.'); }
    setSynLoading(false);
  };

  // Explicit status for the board synthesis. 'empty' has no placeholder — the
  // "AI Synthesize All" button above is the CTA that produces it.
  const synStatus = synLoading ? 'loading' : synErr ? 'error' : synthesis ? 'ready' : 'empty';

  return (
    <div>
      <div className="rh-board-head">
        <div>
          <div className="rh-board-count">{cards.length} research cards</div>
          <div className="rh-board-sub">Collect signals → analyze → synthesize → extract insights</div>
        </div>
        {cards.length > 0 && (
          <button type="button" className="btn btn-primary tap rh-synth-btn" onClick={synthesizeAll} aria-busy={synLoading || undefined}>
            <Icon name={synLoading ? 'RefreshCw' : 'Sparkles'} size={14} /> {synLoading ? 'Synthesizing…' : 'AI Synthesize All'}
          </button>
        )}
      </div>

      <div data-status={synStatus}>
      {synStatus === 'loading' && <div className="rh-gap"><SectionSkeleton rows={5} lead label="board synthesis" /></div>}
      {synStatus === 'error' && <div className="rh-gap"><SectionError label="the board synthesis" onRetry={synthesizeAll} detail={synErr} /></div>}
      {synthesis && (
        <div className="rh-synth">
          <div className="rh-kicker">Board Synthesis</div>
          <MD text={synthesis} color="var(--accent-text)" />
          <button type="button" className="rh-link tap" onClick={() => setSynthesis('')}>Clear</button>
        </div>
      )}
      </div>

      <div className="rh-board">
        {BOARD_COLS.map((col, colIdx) => {
          const colCards = cards.filter(c => c.column === col.id);
          return (
            <div key={col.id} className="rh-col">
              <div className="rh-col-head">
                <div className="rh-col-title"><Icon name={col.icon} size={16} aria-hidden="true" /> {col.label}</div>
                <span className="rh-col-count">{colCards.length}</span>
              </div>

              <div className="rh-col-cards">
                {colCards.map(card => (
                  <div key={card.id} className="rh-bcard">
                    <div className="rh-bcard-text">
                      {card.type === 'url'
                        ? <a className="rh-bcard-url tap" href={card.content} target="_blank" rel="noopener noreferrer">{card.content.slice(0, 50)}…</a>
                        : card.content.slice(0, 120) + (card.content.length > 120 ? '…' : '')
                      }
                    </div>
                    {cardAnalysis[card.id] && (
                      <div className="rh-bcard-ai">
                        <MD text={cardAnalysis[card.id]} color="var(--accent-text)" />
                      </div>
                    )}
                    {analyzingId === card.id && (
                      <div data-status="loading" className="rh-mb6">
                        <SectionSkeleton rows={2} label="card analysis" />
                      </div>
                    )}
                    {analyzingId !== card.id && cardErr[card.id] && (
                      <div data-status="error" className="rh-mb6">
                        <SectionError label="the analysis" onRetry={() => analyzeCard(card)} detail={cardErr[card.id]} />
                      </div>
                    )}
                    <div className="rh-bcard-tools">
                      {colIdx > 0 && <button type="button" className="rh-move tap" data-dir="prev" onClick={() => moveCard(card.id, -1)} aria-label={`Move to ${BOARD_COLS[colIdx - 1].label}`}>←</button>}
                      {colIdx < BOARD_COLS.length - 1 && <button type="button" className="rh-move tap" data-dir="next" onClick={() => moveCard(card.id, 1)} aria-label={`Move to ${BOARD_COLS[colIdx + 1].label}`}>→</button>}
                      <button type="button" className="rh-ai tap" onClick={() => analyzeCard(card)}><Icon name="Sparkles" size={12} /> AI</button>
                      <button type="button" className="rh-x tap" onClick={() => removeCard(card.id)} aria-label="Remove card"><Icon name="X" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {adding === col.id ? (
                <div>
                  <textarea className="rh-draft" value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(col.id); } }}
                    placeholder="Text or URL… (Enter to save)" aria-label={`New ${col.label} card`}
                    rows={2} />
                  <div className="rh-draft-actions">
                    <button type="button" className="btn btn-primary tap rh-draft-add" onClick={() => addCard(col.id)}>Add</button>
                    <button type="button" className="btn tap" onClick={() => { setAdding(null); setDraft(''); }} aria-label="Cancel"><Icon name="X" size={14} /></button>
                  </div>
                </div>
              ) : (
                <button type="button" className="rh-add tap" onClick={() => { setAdding(col.id); setDraft(''); }}>
                  + Add
                </button>
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
  { name: 'Peter Attia', domain: 'Longevity/Medicine', type: 'Thinker' },
  { name: 'Andrew Huberman', domain: 'Neuroscience/Performance', type: 'Thinker' },
  { name: 'Naval Ravikant', domain: 'Wealth/Philosophy', type: 'Thinker' },
  { name: 'Chris Miller', domain: 'Geopolitics/Tech', type: 'Author' },
  { name: 'Warren Buffett', domain: 'Investing', type: 'Author' },
  { name: 'Jocko Willink', domain: 'Leadership', type: 'Author' },
  { name: 'The Hustle', domain: 'Business News', type: 'Newsletter' },
  { name: 'Axios', domain: 'News/Policy', type: 'Newsletter' },
];

export default function ResearchHub() {
  const { research, setResearch, captureRoute, clearCapture, applyRoute } = useApp();
  const [activeThread, setActiveThread] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  // Capture-bar route (D1): prefill the research query for review before firing.
  useEffect(() => { if (captureRoute?.route === 'research') { setNewQuery(captureRoute.topic || ''); clearCapture?.(); } }, [captureRoute, clearCapture]);
  const [boardView, setBoardView] = useState(false);
  const bottomRef = useRef(null);
  // Live signals — a thread declares a topic; matching feed items are pulled in
  // automatically. One getFeed() on mount serves both the list (unread badges)
  // and the open thread; "new since last visit" uses a per-thread watermark.
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedErr, setFeedErr] = useState(''); // was a swallowed catch {}
  const [threadErr, setThreadErr] = useState('');
  const lastSendRef = useRef(null); // { threadId, newMsgs } for Retry
  const [seen, setSeen] = useState(() => readLocal(RESEARCH_SEEN_KEY, {}));
  const [threadSeenAt, setThreadSeenAt] = useState(0); // the seen watermark captured when the open thread was entered
  const itemTime = (it) => it.at || Date.parse(it.publishedAt || '') || 0;

  const loadLiveFeed = async () => {
    setFeedLoading(true); setFeedErr('');
    try { const f = await getFeed({ limit: 40 }); setFeedItems(Array.isArray(f) ? f : []); } catch (e) { setFeedErr(e?.message || 'The live feed could not be fetched.'); }
    setFeedLoading(false);
  };
  useEffect(() => { loadLiveFeed(); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, stream]);

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
    // Record the research subject as a concept so it links to books, quizzes,
    // and captured items on the same thread.
    logConcept({ topic: thread.title, source: thread.title, module: 'research' });
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
    await replyThread(threadId, threads, newMsgs);
  };

  // The reply half of sendMessage, split out so Retry re-runs ONLY the failed
  // reply against the same history (the question is already in the thread).
  const replyThread = async (threadId, threads, newMsgs) => {
    lastSendRef.current = { threadId, newMsgs };
    setLoading(true);
    setStream('');
    setThreadErr('');
    try {
      const system = {
        cached: SYSTEM_BASE,
        dynamic: "\n\nMODE: TRUTH & RESEARCH HUB\nYour job: cut through narrative, surface signal, flag bias, give CB the contrarian insight most people miss. Prioritize analytical depth and objectivity over forced connections. End every response with: (1) Truth Score (1-10, how confident you are in this), (2) Bias Flags (sources or narratives to be skeptical of), (3) Decisive Bet (what CB should do with this information). Be rigorous.",
      };
      const reply = await callClaude({ system, messages: newMsgs.map(m => ({ role: m.role, content: m.content })), searchEnabled, onToken: (t) => setStream(s => s + t) });
      const assistantMsg = { role: 'assistant', content: reply };
      const finalMsgs = [...newMsgs, assistantMsg];
      setMessages(finalMsgs);
      const updatedThreads = threads.map(t => t.id === threadId ? { ...t, messages: finalMsgs } : t);
      setResearch(updatedThreads);
      await saveResearch(updatedThreads);
    } catch (e) {
      setThreadErr(e?.authExpired ? 'Auth expired — re-enter your code to continue.' : (e?.message || 'AI request failed.'));
    }
    setStream('');
    setLoading(false);
  };

  const retryThread = () => {
    const f = lastSendRef.current;
    if (!f || loading) return;
    replyThread(f.threadId, research, f.newMsgs);
  };

  const openThread = (thread) => {
    setThreadErr('');
    setActiveThread(thread.id);
    setMessages(thread.messages || []);
    // Capture the prior watermark for the "new since last visit" divider, then
    // advance it and refresh the live pull.
    setThreadSeenAt(seen[thread.id] || 0);
    const nextSeen = { ...seen, [thread.id]: Date.now() };
    setSeen(nextSeen); writeThrough(RESEARCH_SEEN_KEY, nextSeen);
    loadLiveFeed();
    if ((thread.messages || []).length === 0) sendMessage(thread.id, research, thread.query, []);
  };

  // A pulled live item, kept into the thread's knowledge → logConcept (source =
  // the item's outlet, ref = the thread) so provenance is preserved.
  const keepLiveItem = (thread, it) => {
    logConcept({ topic: it.title.slice(0, 60), source: it.source || 'feed', module: 'research', refs: [thread.title] });
  };
  const diveLiveItem = (it) => { logConcept({ topic: it.title.slice(0, 60), source: it.source || 'feed', module: 'research' }); applyRoute?.({ route: 'deepdive', topic: it.title }); };

  const deleteThread = async (id) => {
    const updated = research.filter(t => t.id !== id);
    setResearch(updated);
    await saveResearch(updated);
    if (activeThread === id) { setActiveThread(null); setMessages([]); }
  };

  const sourceLibrary = (
    <div className="rh-lib">
      <Label color="var(--accent-text)">Source Library</Label>
      {SOURCE_LIBRARY.map(s => (
        <button type="button" key={s.name} className="rh-src tap"
          onClick={() => startThread(`What are the key ideas, frameworks, and actionable insights from ${s.name} (${s.domain})? What should CB know about their work?`)}>
          <div className="rh-src-top">
            <div className="rh-src-name">{s.name}</div>
            <div className="rh-src-tools">
              <Badge color="var(--accent-text)">{s.type}</Badge>
              <span className="rh-src-arrow" aria-hidden="true">→</span>
            </div>
          </div>
          <div className="rh-src-domain">{s.domain} · click to research</div>
        </button>
      ))}
    </div>
  );

  if (!activeThread) return (
    <div className="rh">
      <div className="rh-head">
        <div>
          <div className="rh-eyebrow">Truth & Research Hub</div>
          <div className="rh-title">Deep Intelligence Search</div>
          <div className="rh-sub">CB-style. Every response: Truth Score · Bias Flags · Decisive Bet.</div>
        </div>
        <button type="button" className="btn btn-primary tap rh-new" onClick={() => setShowNewThread(true)}>+ New Thread</button>
      </div>

      {/* View switcher: Threads | Board */}
      <div className="rh-views">
        {[{ id: false, label: 'Threads', icon: 'MessageSquare' }, { id: true, label: 'Research Board', icon: 'ClipboardList' }].map(v => (
          <button type="button" key={String(v.id)} className="rh-view tap" aria-pressed={boardView === v.id} onClick={() => setBoardView(v.id)}>
            <Icon name={v.icon} size={15} aria-hidden="true" /> {v.label}
          </button>
        ))}
      </div>

      {boardView && <ResearchBoard />}

      {/* J2: the Source Library + tier legend are the 340px rail (≥1101); below
          the threads on iPad and phone. */}
      {!boardView && (
        <PageWithRail label="Source library and provenance" rail={(
          <>
            {sourceLibrary}
            <ProvenancePanel />
          </>
        )}>
          <div className="rh-search-wrap">
            <div className="rh-search">
              <span className="rh-search-icon" aria-hidden="true"><Icon name="Compass" size={20} /></span>
              <input className="rh-query" value={newQuery} onChange={e => setNewQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newQuery.trim() && startThread(newQuery)}
                aria-label="Research topic"
                placeholder="Research a topic, question, or opportunity..." />
              <button type="button" className="rh-web tap" aria-pressed={searchEnabled} onClick={() => setSearchEnabled(s => !s)}>
                <Icon name="Globe" size={13} aria-hidden="true" /> Web {searchEnabled ? 'ON' : 'OFF'}
              </button>
              {newQuery.trim() && <button type="button" className="btn btn-primary tap rh-go" onClick={() => startThread(newQuery)}>Research →</button>}
            </div>
            <div className="rh-suggest">
              {SEARCH_SUGGESTIONS.map(s => (
                <button type="button" key={s} className="chip tap" onClick={() => startThread(s)}>{s}</button>
              ))}
            </div>
          </div>

          <Label color="var(--accent-text)">Research Threads</Label>
          {research.length === 0 && <div className="rh-empty">No research threads yet. Start one above.</div>}
          {research.map(t => {
            const newCount = matchItems(feedItems, t.title, t.tags).filter((it) => itemTime(it) > (seen[t.id] || 0)).length;
            return (
            <div key={t.id} className="rh-thread">
            <Card color="var(--accent-text)" onClick={() => openThread(t)}>
              <div className="rh-thread-top">
                <div className="rh-thread-main">
                  <div className="rh-thread-title">
                    <span>{t.title}</span>
                    {newCount > 0 && <span className="rh-new-count" title={`${newCount} new signal${newCount === 1 ? '' : 's'} since last visit`}>{newCount} new</span>}
                  </div>
                  <div className="rh-meta">{timeAgo(t.createdAt)} · {(t.messages || []).filter(m => m.role === 'assistant').length} responses</div>
                </div>
                <div className="rh-thread-tools">
                  <AskChip type="research" object={t} />
                  <Badge color={t.status === 'active' ? T.accent : 'var(--subtle)'}>{t.status}</Badge>
                  <button type="button" className="rh-x tap" onClick={e => { e.stopPropagation(); deleteThread(t.id); }} aria-label={`Delete thread ${t.title}`}><Icon name="X" size={15} /></button>
                </div>
              </div>
              {t.tags?.length > 0 && (
                <div className="rh-tags">
                  {t.tags.map(tag => <span key={tag} className="rh-tag">{tag}</span>)}
                </div>
              )}
            </Card>
            </div>
            );
          })}
        </PageWithRail>
      )}

      {showNewThread && (
        <Modal title="New Research Thread" accent={T.accent} onClose={() => setShowNewThread(false)}>
          <Textarea value={newQuery} onChange={setNewQuery} placeholder="What do you want to research? Be specific — the more context, the better the response." rows={4} />
          <div className="rh-modal-actions">
            <button type="button" className="btn tap rh-modal-cancel" onClick={() => setShowNewThread(false)}>Cancel</button>
            <button type="button" className="btn btn-primary tap rh-modal-go" onClick={() => newQuery.trim() && startThread(newQuery)}>Research →</button>
          </div>
        </Modal>
      )}
    </div>
  );

  const thread = research.find(t => t.id === activeThread);
  // Explicit status of the thread's generated analysis (the primary artifact).
  const threadStatus = loading ? 'loading' : threadErr ? 'error' : messages.some(m => m.role === 'assistant') ? 'ready' : 'empty';
  return (
    <div className="rh-thread-view">
      <div className="rh-tv-head">
        <div className="rh-tv-bar">
          <div>
            <button type="button" className="rh-back tap" onClick={() => setActiveThread(null)}>← Research Hub</button>
            <div className="rh-tv-title">{thread?.title}</div>
          </div>
          <div className="rh-tv-tools">
            {thread && <FollowButton name={thread.title} source="research" />}
            <button type="button" className="rh-web tap" aria-pressed={searchEnabled} onClick={() => setSearchEnabled(s => !s)}>
              <Icon name="Globe" size={13} aria-hidden="true" /> Web {searchEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      <div data-status={threadStatus} className="rh-tv-body">
        {/* Live signals — feed items matching this thread's topic, pulled in
            automatically, marked new since last visit, source + tier shown. */}
        {thread && (() => {
          const matched = matchItems(feedItems, thread.title, thread.tags);
          // Empty (no matching items) stays hidden — no placeholder noise on a thread.
          if (!matched.length && !feedLoading && !feedErr) return null;
          const feedStatus = feedLoading ? 'loading' : feedErr ? 'error' : 'ready';
          const fresh = matched.filter((it) => itemTime(it) > threadSeenAt);
          const older = matched.filter((it) => itemTime(it) <= threadSeenAt);
          const Row = ({ it }) => (
            <div className="rh-row">
              <div className="rh-row-title">{it.title}</div>
              <div className="rh-row-meta">
                <span className="rh-row-src">{it.source}{it.relTime ? ` · ${it.relTime}` : ''}</span>
                <span className="rh-row-tier">{it.tier}</span>
              </div>
              <div className="rh-row-acts">
                <AskChip type="feed" object={it} />
                <button type="button" className="rh-act tap" onClick={() => diveLiveItem(it)}><Icon name="Microscope" size={13} /> Dive</button>
                <button type="button" className="rh-act tap" onClick={() => keepLiveItem(thread, it)}><Icon name="Bookmark" size={13} /> Keep</button>
                {it.url && it.url !== '#' && <a className="rh-open tap" href={it.url} target="_blank" rel="noopener noreferrer">Open ↗</a>}
              </div>
            </div>
          );
          return (
            <div data-status={feedStatus} className="rh-col760">
              <div className="rh-live-head">
                <span className="rh-live-eyebrow"><Icon name="Radio" size={13} /> Live signals on this thread</span>
                <button type="button" className="rh-act tap" onClick={loadLiveFeed} disabled={feedLoading}><Icon name="RefreshCw" size={12} /> {feedLoading ? '…' : 'Refresh'}</button>
              </div>
              {feedLoading && !matched.length && <SectionSkeleton rows={2} label="live signals" />}
              {feedStatus === 'error' && <SectionError label="live signals" onRetry={loadLiveFeed} detail={feedErr} />}
              {fresh.length > 0 && <div className="rh-fresh">New since last visit</div>}
              {fresh.map((it) => <Row key={it.id} it={it} />)}
              {older.length > 0 && fresh.length > 0 && <div className="rh-earlier">Earlier</div>}
              {older.map((it) => <Row key={it.id} it={it} />)}
            </div>
          );
        })()}

        {messages.map((msg, i) => (
          <div key={i} className="rh-msg rh-col760" data-role={msg.role === 'user' ? 'user' : 'assistant'}>
            {msg.role === 'user' ? (
              <div className="rh-bubble-user">{msg.content}</div>
            ) : (
              <div className="rh-bubble-ai">
                <div className="rh-kicker">Research · Truth-First Analysis</div>
                <MD text={msg.content} color="var(--accent-text)" />
              </div>
            )}
          </div>
        ))}
        {loading && stream && (
          <div className="rh-msg rh-col760">
            <div className="rh-bubble-ai" data-stream="">
              <div className="rh-kicker">Researching...</div>
              <MD text={stream + '▍'} color="var(--accent-text)" />
            </div>
          </div>
        )}
        {/* Skeleton only until the first streamed token arrives. */}
        {loading && !stream && (
          <div className="rh-col760">
            <SectionSkeleton rows={messages.some(m => m.role === 'assistant') ? 3 : 6} lead label="research analysis" />
          </div>
        )}
        {threadStatus === 'error' && (
          <div className="rh-col760">
            <SectionError label="this research reply" onRetry={retryThread} detail={threadErr} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="rh-compose">
        <div className="rh-compose-row">
          <textarea className="rh-compose-input" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(activeThread, research, searchInput, messages); } }}
            rows={1} aria-label="Follow-up question" placeholder="Follow-up question, contrarian challenge, or deeper dive..." />
          <button type="button" className="btn btn-primary tap rh-send" aria-label="Send" onClick={() => sendMessage(activeThread, research, searchInput, messages)} disabled={!searchInput.trim() || loading}>→</button>
        </div>
      </div>
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea className="rh-textarea" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} aria-label="Research question" />
  );
}
