import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { CB_LEARNING_SPINE, KNOWN_BOOKS } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const STUDY_MODES = [
  { id: 'overview',  label: 'Overview',       icon: '📋', desc: 'Executive summary + key thesis' },
  { id: 'concepts',  label: 'Key Concepts',   icon: '🧠', desc: 'Core frameworks and mental models' },
  { id: 'apply',     label: 'Apply to Work',  icon: '⚡', desc: 'Direct applications to your goals' },
  { id: 'quotes',    label: 'Power Quotes',   icon: '💬', desc: 'Most impactful passages' },
  { id: 'quiz',      label: 'Socratic Quiz',  icon: '🎯', desc: 'Test and deepen understanding' },
  { id: 'discuss',   label: 'Discussion',     icon: '🤝', desc: 'Critical conversation about the book' },
];

const PROMPTS = {
  overview:  (b) => `Give me a master-level executive overview of "${b.title}" by ${b.author}. Lead with the central thesis in one sentence. Then: 5 key insights, the strongest evidence, what critics miss, and the single most important takeaway for CB (Houston BD professional building passive income and longevity). Format with clear headers. Be decisive.`,
  concepts:  (b) => `Extract the 7 core mental models and frameworks from "${b.title}" by ${b.author}. For each: (1) Name and 1-sentence definition, (2) How the author uses it, (3) How CB can apply it immediately. Be concrete.`,
  apply:     (b) => `How does "${b.title}" by ${b.author} apply directly to CB's life? Focus on: BD pipeline building, real estate deals, passive income strategy, health/longevity, and mental toughness. Give 6 specific, actionable applications. Be blunt.`,
  quotes:    (b) => `Give me the 8 most powerful, memorable passages or quotes from "${b.title}" by ${b.author}. For each: the exact quote (or close paraphrase), and 1 sentence on why it matters for CB's world.`,
  quiz:      (b) => `Create a 5-question Socratic quiz on "${b.title}" by ${b.author}. Make questions progressively deeper — from recall to synthesis. After each question, give the ideal answer. Aim to expose gaps in understanding, not just test memory.`,
  discuss:   (b) => `Let's discuss "${b.title}" by ${b.author}. Give me: (1) The book's strongest argument, (2) The most valid critique or counterargument, (3) What the author got wrong or oversimplified, (4) How the book connects to today's world. Be intellectually honest.`,
};

export default function BookClub() {
  const { isMobile, isPhone, isTablet, isDesktop } = useApp();

  const [tab,          setTab]          = useState('library'); // library | add | dive
  const [search,       setSearch]       = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [mode,         setMode]         = useState('overview');
  const [result,       setResult]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [addTitle,     setAddTitle]     = useState('');
  const [addAuthor,    setAddAuthor]    = useState('');
  const [addNote,      setAddNote]      = useState('');
  const [customBooks,  setCustomBooks]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('aether_bookclub') || '[]'); } catch { return []; }
  });

  const allBooks = [...KNOWN_BOOKS, ...customBooks];
  const filtered = search
    ? allBooks.filter(b => `${b.title} ${b.author}`.toLowerCase().includes(search.toLowerCase()))
    : allBooks;

  const saveCustom = (updated) => {
    setCustomBooks(updated);
    localStorage.setItem('aether_bookclub', JSON.stringify(updated));
  };

  const addBook = () => {
    if (!addTitle.trim()) return;
    const book = { title: addTitle.trim(), author: addAuthor.trim() || 'Unknown', type: 'other', color: '#a78bfa', custom: true, note: addNote.trim() };
    saveCustom([...customBooks, book]);
    setAddTitle(''); setAddAuthor(''); setAddNote('');
    setTab('library');
  };

  const removeCustom = (i) => saveCustom(customBooks.filter((_, j) => j !== i));

  const handleDeepDive = async () => {
    if (!selectedBook) return;
    setLoading(true);
    setResult('');
    try {
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: PROMPTS[mode](selectedBook) }],
        maxTokens: 1400,
      });
      setResult(reply);
    } catch {
      setResult('Unable to generate — check connection and try again.');
    }
    setLoading(false);
  };

  const handleDeepDiveFor = async (modeId) => {
    if (!selectedBook) return;
    setLoading(true);
    setResult('');
    try {
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: PROMPTS[modeId](selectedBook) }],
        maxTokens: 1400,
      });
      setResult(reply);
    } catch {
      setResult('Unable to generate — check connection and try again.');
    }
    setLoading(false);
  };

  const pad     = isPhone ? '14px' : isMobile ? '16px' : isTablet ? '22px' : '28px';
  const gridCol = isPhone ? 'repeat(2,1fr)' : isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(4,1fr)';
  const modeCol = isPhone ? 'repeat(2,1fr)' : 'repeat(3,1fr)';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: isMobile ? 80 : 60 }}>

      {/* Header */}
      <div style={{ padding: `${pad} ${pad} 0`, marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 4 }}>Intelligence Hub</div>
        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5 }}>
          📖 Book Club
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>
          Research, deep dive, and master any book with AI — connected to CB's mental model library
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: `0 ${pad}`, display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[{ id: 'library', label: '📚 Library' }, { id: 'add', label: '+ Add Book' }, { id: 'dive', label: '🤿 Deep Dive' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${tab === t.id ? 'var(--accent,#a78bfa)' : 'var(--border)'}`, background: tab === t.id ? 'rgba(167,139,250,0.1)' : 'transparent', color: tab === t.id ? '#a78bfa' : 'var(--muted)', fontSize: 12, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', minHeight: 36 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: `0 ${pad}` }}>

        {/* ── LIBRARY TAB ──────────────────────────────────────────── */}
        {tab === 'library' && (
          <div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or author..."
              style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

            <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              {filtered.length} Books · Click to Deep Dive
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                  {search ? `No books match "${search}"` : 'No books in your library yet.'}
                </div>
                <button onClick={() => { setSearch(''); setTab('add'); }}
                  style={{ padding: '9px 20px', background: '#a78bfa', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add a Book
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: gridCol, gap: 10 }}>
              {filtered.map((book, i) => {
                const isSelected = selectedBook?.title === book.title;
                return (
                  <div key={i}
                    onClick={() => { setSelectedBook(book); setMode('overview'); setResult(''); setTab('dive'); }}
                    style={{ padding: '14px', background: 'var(--surface)', border: `2px solid ${isSelected ? '#a78bfa' : (book.color || '#6366F1') + '22'}`, borderTop: `3px solid ${book.color || '#6366F1'}`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}>
                    <div style={{ fontSize: 9, color: book.color || '#6366F1', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                      {book.type || 'General'}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{book.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{book.author}</div>
                    {book.custom && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <div style={{ fontSize: 8, color: '#a78bfa', fontWeight: 700 }}>CUSTOM</div>
                        <div onClick={(e) => { e.stopPropagation(); const idx = customBooks.findIndex(b => b.title === book.title); if (idx !== -1) removeCustom(idx); }}
                          style={{ fontSize: 9, color: 'var(--dim)', cursor: 'pointer', padding: '2px 6px' }}>✕</div>
                      </div>
                    )}
                    {book.note && <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>{book.note.slice(0, 60)}{book.note.length > 60 ? '…' : ''}</div>}
                    <div style={{ marginTop: 10, fontSize: 9, color: '#a78bfa', fontWeight: 700 }}>🤿 Deep Dive →</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ADD BOOK TAB ─────────────────────────────────────────── */}
        {tab === 'add' && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Book Title *</label>
              <input value={addTitle} onChange={e => setAddTitle(e.target.value)}
                placeholder="e.g. The Lean Startup"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Author</label>
              <input value={addAuthor} onChange={e => setAddAuthor(e.target.value)}
                placeholder="e.g. Eric Ries"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <textarea value={addNote} onChange={e => setAddNote(e.target.value)}
                placeholder="Why you're reading it, key questions, context..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <button onClick={addBook} disabled={!addTitle.trim()}
              style={{ padding: '11px 24px', background: addTitle.trim() ? '#a78bfa' : 'var(--surf2)', color: addTitle.trim() ? '#fff' : 'var(--dim)', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: addTitle.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              Add to Library
            </button>
          </div>
        )}

        {/* ── DEEP DIVE TAB ────────────────────────────────────────── */}
        {tab === 'dive' && (
          <div>
            {!selectedBook ? (
              <div style={{ padding: '24px', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Select a book from the Library to deep dive</div>
                <button onClick={() => setTab('library')}
                  style={{ padding: '9px 20px', background: '#a78bfa', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Browse Library
                </button>
              </div>
            ) : (
              <div>
                {/* Selected book header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--surface)', border: `1px solid #a78bfa30`, borderLeft: `3px solid ${selectedBook.color || '#a78bfa'}`, borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{selectedBook.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{selectedBook.author}</div>
                  </div>
                  <button onClick={() => { setSelectedBook(null); setResult(''); }}
                    style={{ fontSize: 10, color: 'var(--dim)', padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Change
                  </button>
                </div>

                {/* Study mode grid */}
                <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Choose Study Mode — click any to generate instantly</div>
                <div style={{ display: 'grid', gridTemplateColumns: modeCol, gap: 8, marginBottom: 20 }}>
                  {STUDY_MODES.map(m => (
                    <button key={m.id} onClick={() => { setMode(m.id); setResult(''); handleDeepDiveFor(m.id); }}
                      style={{ padding: '12px 14px', textAlign: 'left', background: mode === m.id ? 'rgba(167,139,250,0.12)' : 'var(--surface)', border: `1px solid ${mode === m.id ? '#a78bfa' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', transition: 'all 0.12s', minHeight: 72 }}>
                      <div style={{ fontSize: 16 }}>{m.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: mode === m.id ? '#a78bfa' : 'var(--text)', marginTop: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>

                <button onClick={handleDeepDive} disabled={loading}
                  style={{ padding: '11px 24px', background: loading ? 'var(--surf2)' : '#a78bfa', color: loading ? 'var(--dim)' : '#fff', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading
                    ? 'Generating…'
                    : `🤿 ${STUDY_MODES.find(m => m.id === mode)?.label} — ${selectedBook.title.slice(0, 28)}${selectedBook.title.length > 28 ? '…' : ''}`
                  }
                </button>

                {loading && <ThinkingDots color="#a78bfa" />}

                {result && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 9, color: '#a78bfa', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                        {STUDY_MODES.find(m => m.id === mode)?.icon} {STUDY_MODES.find(m => m.id === mode)?.label}
                      </div>
                      <button onClick={() => navigator.clipboard?.writeText(result)}
                        style={{ fontSize: 9, padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Copy
                      </button>
                    </div>
                    <MD text={result} color="#a78bfa" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
