import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, saveNotes, uid } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT        = '#10b981';
const ACCENT_BG     = 'rgba(16,185,129,0.07)';
const ACCENT_BORDER = 'rgba(16,185,129,0.2)';

const FILTERS = [
  { id: 'all',     label: 'All',      icon: '📥' },
  { id: 'article', label: 'Articles', icon: '📰' },
  { id: 'video',   label: 'Videos',   icon: '▶️' },
  { id: 'social',  label: 'Social',   icon: '💬' },
  { id: 'note',    label: 'Notes',    icon: '📝' },
];

const TYPE_ICON  = { article: '📰', video: '▶️', social: '💬', note: '📝' };
const TYPE_COLOR = { article: '#10b981', video: '#e11d48', social: '#38bdf8', note: '#f59e0b' };

function detectType(url) {
  if (!url) return 'note';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'video';
  if (/twitter\.com|x\.com|linkedin\.com|instagram\.com/i.test(url)) return 'social';
  return 'article';
}

function shortHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 30); }
}

export default function ContentInbox() {
  const { notes, setNotes, isMobile } = useApp();

  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aether_inbox') || '[]'); } catch { return []; }
  });
  const [tab,        setTab]        = useState('inbox');
  const [filter,     setFilter]     = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [url,        setUrl]        = useState('');
  const [text,       setText]       = useState('');
  const [title,      setTitle]      = useState('');
  const [analyzing,  setAnalyzing]  = useState(false);

  const persist = (updated) => {
    setItems(updated);
    localStorage.setItem('aether_inbox', JSON.stringify(updated));
  };

  const analyze = async () => {
    const hasContent = url.trim() || text.trim();
    if (!hasContent || analyzing) return;
    setAnalyzing(true);
    const type = detectType(url.trim());
    const typeLabel = type === 'video' ? 'YouTube/video' : type === 'social' ? 'social post' : 'article/document';

    const prompt = text.trim()
      ? `Analyze this ${typeLabel} content for CB. Provide:\n1. Core thesis (1-2 sentences)\n2. 4 key takeaways with specific CB applications (BD, investing, health, Houston)\n3. Connection to CB's mental model library\n4. Decisive action or insight\n\nContent:\n${text.slice(0, 5000)}`
      : `The user saved this ${typeLabel} URL for CB: ${url}\n\nAnalyze based on URL/domain context. Cover:\n1. What this source likely contains and why CB saved it\n2. 3 insights CB should extract if he reads/watches this\n3. How it connects to CB's goals (BD, passive income, longevity, Houston)\n4. Decisive recommendation`;

    try {
      const summary = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 900,
      });
      const item = {
        id:           uid(),
        title:        title.trim() || (url ? shortHost(url) : (text.slice(0, 55) + '…')),
        url:          url.trim(),
        snippet:      text.trim().slice(0, 200),
        type,
        summary,
        savedAt:      Date.now(),
        inVault:      false,
      };
      const updated = [item, ...items];
      persist(updated);
      setUrl(''); setText(''); setTitle('');
      setTab('inbox');
      setExpandedId(item.id);
    } catch {
      alert('Analysis failed — check network and try again.');
    }
    setAnalyzing(false);
  };

  const remove = (id) => persist(items.filter(i => i.id !== id));

  const saveToVault = async (item) => {
    const note = {
      id:          uid(),
      title:       `📥 ${item.title}`,
      content:     item.summary,
      tags:        ['inbox', item.type],
      connections: [],
      color:       ACCENT,
      createdAt:   Date.now(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    await saveNotes(updated);
    persist(items.map(i => i.id === item.id ? { ...i, inVault: true } : i));
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div style={{ padding: isMobile ? '16px 16px 80px' : '24px 28px 60px', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 10 : 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 6 }}>Smart Content Inbox</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Capture & Synthesize</div>
        <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Save articles, videos, links, or paste text — AI extracts what matters for CB.</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{ id: 'inbox', label: `📥 Inbox (${items.length})` }, { id: 'add', label: '+ Add Content' }].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 10, cursor: 'pointer', border: `1px solid ${tab === t.id ? ACCENT : 'var(--border)'}`, background: tab === t.id ? ACCENT_BG : 'var(--surface)', color: tab === t.id ? ACCENT : 'var(--muted)', transition: 'all 0.12s' }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── Add Content ─────────────────────────────────────────────────────── */}
      {tab === 'add' && (
        <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Add to Inbox</div>

          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional — auto-detected)"
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '12px 14px' : '9px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, minHeight: isMobile ? 44 : undefined }} />

          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="URL — article, YouTube, Twitter, LinkedIn, any link…"
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '12px 14px' : '9px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, minHeight: isMobile ? 44 : undefined }} />

          <div style={{ fontSize: 10, color: 'var(--dim)', textAlign: 'center', marginBottom: 10 }}>— or paste content directly —</div>

          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste article, notes, quotes, email, transcript, or any text…"
            rows={5}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '12px 14px' : '9px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 14, minHeight: isMobile ? 44 : undefined }} />

          <button onClick={analyze} disabled={analyzing || (!url.trim() && !text.trim())}
            style={{ width: '100%', padding: isMobile ? '14px 16px' : '12px', background: (url.trim() || text.trim()) && !analyzing ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, color: (url.trim() || text.trim()) && !analyzing ? '#000' : 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {analyzing ? <><ThinkingDots color="#000" /> Analyzing…</> : '✦ Analyze & Save'}
          </button>
        </div>
      )}

      {/* ── Inbox ───────────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (
        <>
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <div key={f.id} onClick={() => setFilter(f.id)}
                  style={{ padding: '4px 12px', fontSize: 10, borderRadius: 20, border: `1px solid ${filter === f.id ? ACCENT : 'var(--border)'}`, background: filter === f.id ? ACCENT_BG : 'transparent', color: filter === f.id ? ACCENT : 'var(--subtle)', cursor: 'pointer', fontWeight: filter === f.id ? 700 : 400 }}>
                  {f.icon} {f.label}
                </div>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📥</div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>Inbox is Empty</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20 }}>Save articles, YouTube videos, tweets, or paste any content. AI extracts the signal so you don't have to dig.</div>
              <div onClick={() => setTab('add')} style={{ display: 'inline-block', padding: '10px 22px', background: ACCENT, borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Add First Item →</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(item => {
              const expanded = expandedId === item.id;
              return (
                <div key={item.id} style={{ background: 'var(--surface)', border: `1px solid ${expanded ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <div style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICON[item.type] || '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{item.title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {item.url && (
                            <span onClick={() => window.open(item.url, '_blank')}
                              style={{ fontSize: 10, color: 'var(--accent, #00C6E6)', cursor: 'pointer' }}>
                              ↗ {shortHost(item.url)}
                            </span>
                          )}
                          <span style={{ fontSize: isMobile ? 10 : 9, color: 'var(--dim)' }}>{new Date(item.savedAt).toLocaleDateString()}</span>
                          <span style={{ fontSize: isMobile ? 10 : 9, padding: '2px 7px', background: `${TYPE_COLOR[item.type]}15`, color: TYPE_COLOR[item.type], borderRadius: 4, fontWeight: 600 }}>{item.type}</span>
                          {item.inVault && <span style={{ fontSize: isMobile ? 10 : 9, color: '#ffcc44', fontWeight: 600 }}>✓ Vaulted</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <div onClick={() => setExpandedId(expanded ? null : item.id)}
                          style={{ fontSize: 10, color: ACCENT, cursor: 'pointer', padding: isMobile ? '9px 14px' : '3px 9px', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 5, fontWeight: 600, minHeight: isMobile ? 40 : undefined }}>
                          {expanded ? 'Hide' : 'View AI'}
                        </div>
                        <div onClick={() => remove(item.id)} style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer', padding: '2px 4px' }}>✕</div>
                      </div>
                    </div>
                  </div>

                  {expanded && item.summary && (
                    <div style={{ borderTop: `1px solid ${ACCENT_BORDER}`, padding: '14px 16px', background: ACCENT_BG }}>
                      <div style={{ fontSize: isMobile ? 10 : 8, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', marginBottom: 10 }}>AI Analysis</div>
                      <MD text={item.summary} color={ACCENT} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                        <div onClick={() => { navigator.clipboard?.writeText(item.summary); }}
                          style={{ padding: isMobile ? '9px 14px' : '5px 12px', fontSize: 10, fontWeight: 600, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 7, color: ACCENT, cursor: 'pointer', background: 'transparent', minHeight: isMobile ? 40 : undefined }}>
                          Copy
                        </div>
                        {!item.inVault && (
                          <div onClick={() => saveToVault(item)}
                            style={{ padding: isMobile ? '9px 14px' : '5px 12px', fontSize: 10, fontWeight: 700, border: '1px solid #ffcc4440', borderRadius: 7, color: '#ffcc44', cursor: 'pointer', background: '#ffcc4410', minHeight: isMobile ? 40 : undefined }}>
                            🏛 Save to Vault
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
