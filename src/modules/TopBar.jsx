import { T, withAlpha } from '../theme';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { getSyncStatus, subscribeSync } from '../lib/storage.js';
import useVoiceInput from '../hooks/useVoiceInput.js';
import { Sun, Moon, MessageSquare, X, Search, PenSquare, Sparkles } from 'lucide-react';

// Global storage-sync indicator. Hidden entirely when everything's syncing —
// no chrome when all is well. Shows a caution chip for local-only (503) and a
// negative chip for a genuine sync error (5xx / network). `compact` renders a
// bare dot for the tight mobile header.
function SyncChip({ compact = false }) {
  const [status, setStatus] = useState(getSyncStatus());
  useEffect(() => subscribeSync(setStatus), []);
  if (status === 'synced') return null;

  const local = status === 'local-only';
  const color = local ? 'var(--caution)' : 'var(--negative)';
  const label = local ? 'Local only — not syncing' : 'Not syncing — server error';
  const title = local
    ? 'Storage is not syncing to the server (not configured). Changes are saved on this device only.'
    : 'A server write failed. Recent changes may not be synced across devices.';

  if (compact) {
    return (
      <span title={`${label}. ${title}`}
        style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 3px ${withAlpha(color, 18)}` }} />
    );
  }
  return (
    <div title={title}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-base)', fontWeight: 600, color, padding: '5px 11px', background: withAlpha(color, 12), border: `1px solid ${withAlpha(color, 35)}`, borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

export default function TopBar() {
  const {
    setActiveModule,
    graph, chatOpen, setChatOpen,
    searchQuery, setSearchQuery,
    setChatPrefill, triggerNewChat, focusCapture,
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
          style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--accent-glow, rgba(217,164,65,0.06))', borderBottom: filtered.length ? '1px solid var(--bord2)' : 'none' }}>
          <span style={{ fontSize: 'var(--fs-lg)', color: 'var(--accent, #D9A441)', lineHeight: 1 }}>✦</span>
          <div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--accent, #D9A441)', fontWeight: 700 }}>Ask AI: "{searchQuery}"</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>Open Intelligence Chat · Press ↵</div>
          </div>
        </div>
      )}
      {filtered.map((s, i) => (
        <div key={i} onClick={() => { setActiveModule(s.module); setSearchQuery(''); setSearchFocused(false); }}
          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: i < filtered.length - 1 ? '1px solid var(--bord2)' : 'none' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: s.type === 'project' ? T.accent : 'var(--accent, #D9A441)', background: s.type === 'project' ? 'rgba(217,164,65,0.12)' : 'var(--accent-glow, rgba(217,164,65,0.1))', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>{s.type}</span>
          <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-b)' }}>{s.label}</span>
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
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent, #D9A441)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-base)', fontWeight: 700, color: T.canvas, fontFamily: "'Newsreader', serif", flexShrink: 0 }}>FR</div>
          </div>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', border: `1.5px solid ${searchFocused ? 'var(--accent, #D9A441)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 12px', transition: 'border-color 0.15s', boxShadow: searchFocused ? '0 0 0 3px var(--accent-glow, rgba(217,164,65,0.1))' : 'none' }}>
              <Search size={13} color="var(--dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Ask anything..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 'var(--fs-base)', color: 'var(--text-b)', fontFamily: 'inherit', minWidth: 0 }}
              />
              {voiceOk && (
                <span onClick={() => toggleVoice(t => setSearchQuery(t))} style={{ fontSize: 'var(--fs-base)', cursor: 'pointer', color: voiceListening ? T.negative : 'var(--dim)', flexShrink: 0 }}>
                  🎙️
                </span>
              )}
            </div>
            {dropdown}
          </div>
          <SyncChip compact />
          <button onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none' }}>
            {theme === 'dark' ? <Sun size={14} color="var(--muted)" /> : <Moon size={14} color="var(--muted)" />}
          </button>
          <button onClick={focusCapture} title="Capture — type anything" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none', color: 'var(--accent, #D9A441)' }}>
            <Sparkles size={14} />
          </button>
          <button onClick={triggerNewChat} title="New chat" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none', color: 'var(--muted)' }}>
            <PenSquare size={14} />
          </button>
          <button onClick={() => setChatOpen(o => !o)} style={{ height: 34, padding: '0 12px', borderRadius: 8, background: chatOpen ? 'var(--accent, #D9A441)' : 'var(--bg)', border: `1px solid ${chatOpen ? 'transparent' : 'var(--border)'}`, color: chatOpen ? '#000' : 'var(--text-b)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {chatOpen ? <X size={14} /> : <MessageSquare size={14} />}
          </button>
        </div>
      </header>
    );
  }

  // ── Desktop / Tablet ──────────────────────────────────────────────────────
  return (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 40, position: 'relative' }}>

      {/* Logo + Search + Actions. Container navigation now lives in the
          left rail (SideNav); this header is chrome + the global Ask bar. */}
      <div style={{ height: 58, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, marginRight: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent, #D9A441)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-base)', fontWeight: 700, color: T.canvas, fontFamily: "'Newsreader', serif", flexShrink: 0, boxShadow: '0 2px 12px var(--accent-glow, rgba(217,164,65,0.2))' }}>FR</div>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--chalk, var(--text))', fontFamily: "'Newsreader', serif", letterSpacing: -0.3, lineHeight: 1, whiteSpace: 'nowrap' }}>The Film Room</div>
            <div style={{ fontSize: 8, letterSpacing: 2.5, color: 'var(--accent, #D9A441)', textTransform: 'uppercase', marginTop: 2, fontWeight: 700 }}>Intelligence</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 560, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: `1.5px solid ${searchFocused ? 'var(--accent, #D9A441)' : 'var(--border)'}`, borderRadius: 12, padding: '9px 16px', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: searchFocused ? '0 0 0 3px rgba(217,164,65,0.1)' : 'none' }}>
            <Search size={14} color="var(--dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="Ask anything — AI-powered intelligence search..."
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit' }}
            />
            {voiceOk && (
              <span onClick={() => toggleVoice(t => setSearchQuery(t))} title={voiceListening ? 'Stop' : 'Voice search'} style={{ fontSize: 'var(--fs-base)', cursor: 'pointer', color: voiceListening ? T.negative : 'var(--dim)', flexShrink: 0 }}>🎙️</span>
            )}
            {searchQuery
              ? <span onClick={handleSearchSubmit} style={{ fontSize: 'var(--fs-base)', color: 'var(--accent, #D9A441)', cursor: 'pointer', fontWeight: 700, flexShrink: 0, letterSpacing: 0.2 }}>Ask AI →</span>
              : <kbd style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', background: 'var(--surf2)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 5, flexShrink: 0, fontFamily: 'inherit' }}>↵</kbd>
            }
          </div>
          {dropdown}
        </div>

        <div style={{ flex: 1 }} />

        <SyncChip />

        {/* Stats */}
        {streak > 0 && (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-c)', padding: '5px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>🔥</span><span style={{ fontWeight: 600 }}>{streak}d</span>
          </div>
        )}
        {totalHours > 0 && (
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-c)', padding: '5px 11px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--dim)', fontSize: 'var(--fs-sm)'}}>◷</span><span style={{ fontWeight: 600 }}>{totalHours}h</span>
          </div>
        )}

        <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none', transition: 'border-color 0.15s' }}>
          {theme === 'dark' ? <Sun size={15} color="var(--muted)" strokeWidth={1.8} /> : <Moon size={15} color="var(--muted)" strokeWidth={1.8} />}
        </button>

        <button onClick={focusCapture} title="Capture — type anything" style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none', color: 'var(--accent, #D9A441)', transition: 'border-color 0.15s' }}>
          <Sparkles size={15} strokeWidth={1.8} />
        </button>

        <button onClick={triggerNewChat} title="New chat" style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, outline: 'none', color: 'var(--muted)', transition: 'border-color 0.15s' }}>
          <PenSquare size={15} strokeWidth={1.8} />
        </button>

        <button onClick={() => setChatOpen(o => !o)} style={{ padding: '0 16px', height: 36, borderRadius: 9, background: chatOpen ? 'var(--accent, #D9A441)' : 'var(--bg)', border: `1px solid ${chatOpen ? 'transparent' : 'var(--border)'}`, color: chatOpen ? '#000' : 'var(--text-b)', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, transition: 'all 0.15s', letterSpacing: 0.2 }}>
          {chatOpen ? <><X size={13} strokeWidth={2.5} /> Close</> : <><MessageSquare size={13} strokeWidth={1.8} /> AI Chat</>}
        </button>
      </div>
    </header>
  );
}
