import { useState, useRef } from 'react';
import { useApp } from '../App.jsx';
import { NAV_ITEMS } from '../constants.js';
import useVoiceInput from '../hooks/useVoiceInput.js';
import NavIcon from './shared/NavIcon.jsx';
import { Sun, Moon, MessageSquare, X, Search } from 'lucide-react';

export default function TopBar() {
  const {
    activeModule, setActiveModule,
    graph, chatOpen, setChatOpen,
    searchQuery, setSearchQuery,
    setChatPrefill,
    isMobile, isPhone,
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

  const dropdown = searchFocused && (filtered.length > 0 || showAiRow) ? (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', zIndex: 200, boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
      {showAiRow && (
        <div onClick={handleSearchSubmit}
          style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--accent-glow, rgba(0,198,230,0.06))', borderBottom: filtered.length ? '1px solid var(--bord2)' : 'none' }}>
          <span style={{ fontSize: 14, color: 'var(--accent, #00C6E6)', lineHeight: 1 }}>✦</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--accent, #00C6E6)', fontWeight: 700 }}>Ask AI: "{searchQuery}"</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>Open Intelligence Chat · Press ↵</div>
          </div>
        </div>
      )}
      {filtered.map((s, i) => (
        <div key={i} onClick={() => { setActiveModule(s.module); setSearchQuery(''); setSearchFocused(false); }}
          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: i < filtered.length - 1 ? '1px solid var(--bord2)' : 'none' }}>
          <span style={{ fontSize: 9, color: s.type === 'project' ? '#ff8844' : 'var(--accent, #00C6E6)', background: s.type === 'project' ? 'rgba(255,136,68,0.12)' : 'var(--accent-glow, rgba(0,198,230,0.1))', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{s.type}</span>
          <span style={{ fontSize: 13, color: 'var(--text-b)' }}>{s.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 40, position: 'relative' }}>
        <div style={{ height: 54, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #00C6E6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: "'Fraunces', serif", flexShrink: 0 }}>A</div>
          </div>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: `1.5px solid ${searchFocused ? 'var(--accent, #00C6E6)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 12px', transition: 'border-color 0.15s', boxShadow: searchFocused ? '0 0 0 3px var(--accent-glow, rgba(0,198,230,0.1))' : 'none' }}>
              <Search size={13} color="var(--dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Ask anything..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-b)', fontFamily: 'inherit', minWidth: 0 }}
              />
              {voiceOk && (
                <span onClick={() => toggleVoice(t => setSearchQuery(t))} style={{ fontSize: 13, cursor: 'pointer', color: voiceListening ? '#ff4444' : 'var(--dim)', flexShrink: 0 }}>
                  🎙️
                </span>
              )}
            </div>
            {dropdown}
          </div>
          <button onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none' }}>
            {theme === 'dark' ? <Sun size={14} color="var(--muted)" /> : <Moon size={14} color="var(--muted)" />}
          </button>
          <button onClick={() => setChatOpen(o => !o)} style={{ height: 34, padding: '0 12px', borderRadius: 8, background: chatOpen ? 'var(--accent, #00C6E6)' : 'var(--bg)', border: `1px solid ${chatOpen ? 'transparent' : 'var(--border)'}`, color: chatOpen ? '#000' : 'var(--text-b)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {chatOpen ? <X size={14} /> : <MessageSquare size={14} />}
          </button>
        </div>
      </header>
    );
  }

  // ── Desktop / Tablet ──────────────────────────────────────────────────────
  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 40, position: 'relative' }}>

      {/* Row 1 — Logo + Search + Actions */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, borderBottom: '1px solid var(--bord2)' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, marginRight: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #00C6E6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: "'Fraunces', serif", flexShrink: 0, boxShadow: '0 2px 12px rgba(0,198,230,0.2)' }}>A</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5, lineHeight: 1 }}>Aether</div>
            <div style={{ fontSize: 8, letterSpacing: 2.5, color: 'var(--accent, #00C6E6)', textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>Intelligence</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 560, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: `1.5px solid ${searchFocused ? 'var(--accent, #00C6E6)' : 'var(--border)'}`, borderRadius: 12, padding: '9px 16px', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: searchFocused ? '0 0 0 3px rgba(0,198,230,0.1)' : 'none' }}>
            <Search size={14} color="var(--dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
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
              <span onClick={() => toggleVoice(t => setSearchQuery(t))} title={voiceListening ? 'Stop' : 'Voice search'} style={{ fontSize: 13, cursor: 'pointer', color: voiceListening ? '#ff4444' : 'var(--dim)', flexShrink: 0 }}>🎙️</span>
            )}
            {searchQuery
              ? <span onClick={handleSearchSubmit} style={{ fontSize: 11, color: 'var(--accent, #00C6E6)', cursor: 'pointer', fontWeight: 700, flexShrink: 0, letterSpacing: 0.2 }}>Ask AI →</span>
              : <kbd style={{ fontSize: 9, color: 'var(--dim)', background: 'var(--surf2)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 5, flexShrink: 0, fontFamily: 'inherit' }}>↵</kbd>
            }
          </div>
          {dropdown}
        </div>

        <div style={{ flex: 1 }} />

        {/* Stats */}
        {streak > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-c)', padding: '5px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>🔥</span><span style={{ fontWeight: 600 }}>{streak}d</span>
          </div>
        )}
        {totalHours > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-c)', padding: '5px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--dim)', fontSize: 10 }}>◷</span><span style={{ fontWeight: 600 }}>{totalHours}h</span>
          </div>
        )}

        <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none', transition: 'border-color 0.15s' }}>
          {theme === 'dark' ? <Sun size={15} color="var(--muted)" strokeWidth={1.8} /> : <Moon size={15} color="var(--muted)" strokeWidth={1.8} />}
        </button>

        <button onClick={() => setChatOpen(o => !o)} style={{ padding: '0 16px', height: 36, borderRadius: 9, background: chatOpen ? 'var(--accent, #00C6E6)' : 'var(--bg)', border: `1px solid ${chatOpen ? 'transparent' : 'var(--border)'}`, color: chatOpen ? '#000' : 'var(--text-b)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, transition: 'all 0.15s', letterSpacing: 0.2 }}>
          {chatOpen ? <><X size={13} strokeWidth={2.5} /> Close</> : <><MessageSquare size={13} strokeWidth={1.8} /> AI Chat</>}
        </button>
      </div>

      {/* Row 2 — Navigation tabs */}
      <nav style={{ height: 42, display: 'flex', alignItems: 'stretch', overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px', gap: 0 }}>
        {NAV_ITEMS.map(item => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              title={item.desc}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 14px',
                border: 'none',
                borderBottom: `2px solid ${active ? (item.accent || 'var(--accent, #00C6E6)') : 'transparent'}`,
                background: 'transparent',
                color: active ? (item.accent || 'var(--accent, #00C6E6)') : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                whiteSpace: 'nowrap',
                transition: 'color 0.12s, border-color 0.12s',
                flexShrink: 0,
                letterSpacing: 0.1,
                outline: 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-b)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--muted)'; }}
            >
              <NavIcon id={item.id} size={13} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
