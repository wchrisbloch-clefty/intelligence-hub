import { useState, useRef } from 'react';
import { useApp } from '../App.jsx';
import useVoiceInput from '../hooks/useVoiceInput.js';

export default function TopBar() {
  const {
    activeModule, setActiveModule,
    graph, chatOpen, setChatOpen,
    searchQuery, setSearchQuery,
    setChatPrefill,
    isMobile,
    theme, toggleTheme,
  } = useApp();

  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const { listening: voiceListening, toggle: toggleVoice, supported: voiceOk } = useVoiceInput();

  const allTopics = Object.values(graph?.topics || {}).map(t => ({ label: t.title, type: 'topic',   module: 'learn'    }));
  const projItems = (graph?.projects  || []).map(p => ({ label: p.title, type: 'project', module: 'projects' }));
  const filtered  = searchQuery.length > 1
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

  const streak     = graph?.streak || 0;
  const totalHours = Math.round((graph?.totalTime || 0) / 60);

  // Search dropdown
  const dropdown = searchFocused && (filtered.length > 0 || showAiRow) ? (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
      {showAiRow && (
        <div onClick={handleSearchSubmit}
          style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--accent-glow, rgba(0,198,230,0.06))', borderBottom: filtered.length ? '1px solid var(--bord2)' : 'none' }}>
          <span style={{ fontSize: 13, color: 'var(--accent, #D9A441)' }}>✦</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--accent, #D9A441)', fontWeight: 700 }}>Ask AI: "{searchQuery}"</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1 }}>Opens Intelligence Chat · Press ↵</div>
          </div>
        </div>
      )}
      {filtered.map((s, i) => (
        <div key={i} onClick={() => { setActiveModule(s.module); setSearchQuery(''); setSearchFocused(false); }}
          style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: i < filtered.length - 1 ? '1px solid var(--bord2)' : 'none' }}>
          <span style={{ fontSize: 9, color: s.type === 'project' ? '#D9A441' : 'var(--accent, #D9A441)', background: s.type === 'project' ? '#D9A44118' : 'var(--accent-glow, rgba(0,198,230,0.1))', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{s.type}</span>
          <span style={{ fontSize: 12, color: 'var(--text-b)' }}>{s.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  const themeBtn = (
    <button onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surf2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, flexShrink: 0, outline: 'none' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );

  const chatBtn = (
    <button onClick={() => setChatOpen(o => !o)}
      style={{ padding: '0 14px', height: 36, borderRadius: 9, background: chatOpen ? 'var(--accent, #D9A441)' : 'var(--surf2)', border: `1px solid ${chatOpen ? 'transparent' : 'var(--border)'}`, color: chatOpen ? (theme === 'dark' ? '#000' : '#fff') : 'var(--text-b)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
      {chatOpen ? '✕ Close' : '💬 AI Chat'}
    </button>
  );

  // ── Mobile ────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 20, position: 'relative' }}>
        <div style={{ height: 54, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--chalk, var(--text))', fontFamily: "'Newsreader', serif", letterSpacing: -0.3, whiteSpace: 'nowrap' }}>Film Room</div>
          </div>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: `1px solid ${searchFocused ? 'var(--accent, #D9A441)' : 'var(--border)'}`, borderRadius: 8, padding: '7px 12px', transition: 'border-color 0.15s' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>⌕</span>
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Ask anything..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-b)', fontFamily: 'inherit', minWidth: 0 }}
              />
              {voiceOk && (
                <span onClick={() => toggleVoice(t => setSearchQuery(t))}
                  title={voiceListening ? 'Stop' : 'Voice search'}
                  style={{ fontSize: 14, cursor: 'pointer', color: voiceListening ? '#C4553D' : 'var(--dim)', flexShrink: 0, transition: 'color 0.15s' }}>
                  🎙️
                </span>
              )}
              {searchQuery && <span onClick={handleSearchSubmit} style={{ fontSize: 11, color: 'var(--accent, #D9A441)', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>↵</span>}
            </div>
            {dropdown}
          </div>
          {themeBtn}
          {chatBtn}
        </div>
      </header>
    );
  }

  // ── Desktop / tablet ─────────────────────────────────────────────────
  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 20, position: 'relative' }}>
      <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>

        {/* Hero search bar */}
        <div style={{ flex: 1, maxWidth: 580, position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg)',
            border: `1.5px solid ${searchFocused ? 'var(--accent, #D9A441)' : 'var(--border)'}`,
            borderRadius: 12, padding: '9px 16px',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: searchFocused ? '0 0 0 3px var(--accent-glow, rgba(0,198,230,0.12))' : 'none',
          }}>
            <span style={{ fontSize: 15, color: 'var(--dim)' }}>⌕</span>
            <input
              ref={searchRef}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Ask anything — AI-powered intelligence search..."
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
            />
            {voiceOk && (
              <span onClick={() => toggleVoice(t => setSearchQuery(t))}
                title={voiceListening ? 'Stop recording' : 'Voice search'}
                style={{ fontSize: 14, cursor: 'pointer', color: voiceListening ? '#C4553D' : 'var(--dim)', flexShrink: 0, transition: 'color 0.15s' }}>
                🎙️
              </span>
            )}
            {searchQuery
              ? <span onClick={handleSearchSubmit} style={{ fontSize: 11, color: 'var(--accent, #D9A441)', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>Ask AI →</span>
              : <span style={{ fontSize: 9, color: 'var(--dim)', background: 'var(--surf2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>↵</span>
            }
          </div>
          {dropdown}
        </div>

        <div style={{ flex: 1 }} />

        {streak > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-c)', padding: '5px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
            🔥 {streak}d streak
          </div>
        )}
        {totalHours > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-c)', padding: '5px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
            ⏱ {totalHours}h
          </div>
        )}

        {themeBtn}
        {chatBtn}
      </div>
    </header>
  );
}
