// TopBar — the global header (logo · Ask bar · sync · actions).
// Batch Z / Order C: ONE render path, laid out in topbar.css. It used to fork on
// isMobile and the desktop branch ran ~1016px wide, so at iPad 820 the last three
// controls were clipped off-screen (overflow hidden). Now CSS sheds the wordmark,
// stats and button labels as width drops; nothing is sized from JavaScript.
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { getSyncStatus, subscribeSync } from '../lib/storage.js';
import useVoiceInput from '../hooks/useVoiceInput.js';
import { Sun, Moon, MessageSquare, X, Search, PenSquare, Sparkles, Mic, Flame, Clock } from 'lucide-react';
import './topbar.css';

// Global storage-sync indicator. Hidden entirely when syncing. Caution for
// local-only (503), negative for a real sync error (5xx / network). Full chip on
// iPad/desktop, bare dot on the phone — both rendered, CSS picks one.
function SyncChip() {
  const [status, setStatus] = useState(getSyncStatus());
  useEffect(() => subscribeSync(setStatus), []);
  if (status === 'synced') return null;
  const local = status === 'local-only';
  const label = local ? 'Local only — not syncing' : 'Not syncing — server error';
  const title = local
    ? 'Storage is not syncing to the server (not configured). Changes are saved on this device only.'
    : 'A server write failed. Recent changes may not be synced across devices.';
  return (
    <span className="tb-sync" data-state={status} title={`${label}. ${title}`} role="status">
      <span className="tb-sync-dot" aria-hidden="true" />
      <span className="tb-sync-label">{label}</span>
    </span>
  );
}

export default function TopBar() {
  const {
    setActiveModule, graph, chatOpen, setChatOpen,
    searchQuery, setSearchQuery, setChatPrefill, triggerNewChat, focusCapture,
    theme, toggleTheme,
  } = useApp();

  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const { listening: voiceListening, toggle: toggleVoice, supported: voiceOk } = useVoiceInput();

  const allTopics = Object.values(graph?.topics || {}).map(t => ({ label: t.title, type: 'topic', module: 'learn' }));
  const projItems = (graph?.projects || []).map(p => ({ label: p.title, type: 'project', module: 'projects' }));
  const filtered = searchQuery.length > 1
    ? [...allTopics, ...projItems].filter(s => s.label.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5)
    : [];
  const showAiRow = searchQuery.length > 2;

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    setChatPrefill(searchQuery.trim());
    setChatOpen(true);
    setSearchQuery('');
    setSearchFocused(false);
  };

  const streak = graph?.streak || 0;
  const totalHours = Math.round((graph?.totalTime || 0) / 60);

  return (
    <header className="tb" data-topbar>
      <div className="tb-row">
        <div className="tb-brand">
          <div className="tb-mark" aria-hidden="true">FR</div>
          <div className="tb-wordmark">
            <div className="tb-name">The Film Room</div>
            <div className="tb-kicker">Intelligence</div>
          </div>
        </div>

        <div className="tb-search-wrap">
          <div className="tb-search" data-focused={searchFocused ? '1' : '0'}>
            <Search size={14} strokeWidth={2} className="tb-search-icon" aria-hidden="true" />
            <input
              ref={searchRef}
              className="tb-search-input"
              aria-label="Ask anything"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Ask anything…"
            />
            {voiceOk && (
              <button type="button" className="tb-voice tap" data-on={voiceListening ? '1' : '0'}
                onClick={() => toggleVoice(t => setSearchQuery(t))} aria-label={voiceListening ? 'Stop voice input' : 'Voice search'}>
                <Mic size={14} />
              </button>
            )}
            {searchQuery
              ? <button type="button" className="tb-ask tap" onClick={handleSearchSubmit}>Ask AI →</button>
              : <kbd className="tb-kbd">↵</kbd>}
          </div>
          {searchFocused && (filtered.length > 0 || showAiRow) && (
            <div className="tb-drop" role="listbox">
              {showAiRow && (
                <button type="button" className="tb-drop-ai" onClick={handleSearchSubmit}>
                  <Sparkles size={16} aria-hidden="true" />
                  <span>
                    <span className="tb-drop-ai-title">Ask AI: “{searchQuery}”</span>
                    <span className="tb-drop-ai-sub">Open Intelligence Chat · Press ↵</span>
                  </span>
                </button>
              )}
              {filtered.map((s, i) => (
                <button type="button" key={i} className="tb-drop-row"
                  onClick={() => { setActiveModule(s.module); setSearchQuery(''); setSearchFocused(false); }}>
                  <span className="badge">{s.type}</span>
                  <span className="tb-drop-label">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <SyncChip />

        {streak > 0 && <span className="tb-stat" title="Learning streak"><Flame size={14} aria-hidden="true" /> {streak}d</span>}
        {totalHours > 0 && <span className="tb-stat" title="Total hours"><Clock size={14} aria-hidden="true" /> {totalHours}h</span>}

        <button type="button" className="tb-icon tap" onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
        </button>
        <button type="button" className="tb-icon tb-icon-accent tap" onClick={focusCapture} aria-label="Capture — type anything" title="Capture — type anything">
          <Sparkles size={15} strokeWidth={1.8} />
        </button>
        <button type="button" className="tb-icon tap" onClick={triggerNewChat} aria-label="New chat" title="New chat">
          <PenSquare size={15} strokeWidth={1.8} />
        </button>
        <button type="button" className="tb-chat tap" aria-pressed={chatOpen} onClick={() => setChatOpen(o => !o)}
          aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}>
          {chatOpen ? <X size={14} strokeWidth={2.5} /> : <MessageSquare size={14} strokeWidth={1.8} />}
          <span className="tb-chat-label">{chatOpen ? 'Close' : 'AI Chat'}</span>
        </button>
      </div>
    </header>
  );
}
