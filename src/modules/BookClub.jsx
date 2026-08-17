import { T, withAlpha } from '../theme';
import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { createCard } from '../lib/reviews.js';
import { logConcept } from '../lib/graph.js';
import { CB_LEARNING_SPINE, KNOWN_BOOKS, TYPE_META } from '../constants.js';

const BOOKCLUB_KEY = 'aether_bookclub';
const SEEDED_KEY   = 'aether_bookclub_seeded';
import MD from './shared/MD.jsx';
import ProviderTag from './shared/ProviderTag.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const STUDY_MODES = [
  { id: 'overview',  label: 'Overview',       icon: '📋', desc: 'Executive summary + key thesis' },
  { id: 'concepts',  label: 'Key Concepts',   icon: '🧠', desc: 'Core frameworks and mental models' },
  { id: 'apply',     label: 'Apply to Work',  icon: '⚡', desc: 'Direct applications to your goals' },
  { id: 'quotes',    label: 'Power Quotes',   icon: '💬', desc: 'Most impactful passages' },
  { id: 'quiz',      label: 'Socratic Quiz',  icon: '🎯', desc: 'Test and deepen understanding' },
  { id: 'discuss',   label: 'Discussion',     icon: '🤝', desc: 'Critical conversation about the book' },
];

// Type → theme token. Uses tier + accent tokens from src/theme.js (no new hex),
// so the `type` field finally reads as colour instead of a dead grey.
const TYPE_COLOR = {
  leadership:  T.accent,
  business:    T.positive,
  systems:     T.tierReported,
  negotiation: T.caution,
  memoir:      T.tierInferred,
  stoic:       T.tierUncited,
  fiction:     T.tierVerified,
  other:       T.textSecondary,
};
const typeColor = (t) => TYPE_COLOR[t] || T.textSecondary;
const TYPE_IDS = Object.keys(TYPE_META);

const BLANK_FORM = { title: '', author: '', note: '', type: 'other' };

// Dedupe/identity key — lowercased title + author.
const keyOf = (b) => `${b.title || ''}|${b.author || ''}`.toLowerCase().trim();
// Ensure every entry carries a stable id for CRUD.
const withId = (b) => (b.id ? b : { ...b, id: uid() });
// The 20 built-ins, tagged, used only as a seed.
const seedBooks = () => KNOWN_BOOKS.map((b) => ({
  id: uid(), title: b.title, author: b.author, type: b.type || 'other', builtin: true,
}));

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
  const [resultProvider, setResultProvider] = useState('');
  const [vaulted, setVaulted] = useState(false);
  const [loading,      setLoading]      = useState(false);

  // Stored library is the single source of truth (built-ins + custom). KNOWN_BOOKS
  // is only a seed.
  const [books,     setBooks]     = useState(() => readLocal(BOOKCLUB_KEY, []).map(withId));
  const [saveError, setSaveError] = useState('');
  const [saving,    setSaving]    = useState(false);

  // Edit form doubles as the add form. editingId = null → adding.
  const [form,      setForm]      = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);

  // Seed on first run + migrate custom-only libraries. Guarded by SEEDED_KEY so
  // it can never double-seed (or resurrect a built-in the user deleted).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lib    = readLocal(BOOKCLUB_KEY, null);
      let seeded = readLocal(SEEDED_KEY, false);
      // Server copy is authoritative when present (cross-device).
      const [remoteLib, remoteSeeded] = await Promise.all([hydrate(BOOKCLUB_KEY), hydrate(SEEDED_KEY)]);
      if (Array.isArray(remoteLib)) lib = remoteLib;
      if (remoteSeeded === true) seeded = true;
      lib = (Array.isArray(lib) ? lib : []).map(withId);

      if (!seeded) {
        if (lib.length === 0) {
          lib = seedBooks();                       // fresh install
        } else if (!lib.some((b) => b.builtin)) {
          // Existing custom-only library — merge the seed in, don't overwrite.
          const present = new Set(lib.map(keyOf));
          lib = [...lib, ...seedBooks().filter((s) => !present.has(keyOf(s)))];
        }
        writeThrough(BOOKCLUB_KEY, lib);           // fire-and-forget seed write
        writeThrough(SEEDED_KEY, true);
      }
      if (!cancelled) setBooks(lib);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = search
    ? books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(search.toLowerCase()))
    : books;

  // Persist-first: await the write and only commit to state if the on-device
  // write succeeded, so a failed save surfaces an error instead of showing a
  // book that vanishes on refresh. Server-sync degradation (503/5xx) is handled
  // by the global TopBar indicator, not blocked here. Returns true on success.
  const persist = async (next) => {
    setSaving(true);
    const r = await writeThrough(BOOKCLUB_KEY, next);
    setSaving(false);
    if (!r.localOk) {
      setSaveError('Could not save your library — on-device storage is full or blocked. Your change was not persisted.');
      return false;
    }
    setBooks(next);
    setSaveError('');
    return true;
  };

  const openAdd = () => { setEditingId(null); setForm(BLANK_FORM); setSaveError(''); setTab('add'); };
  const openEdit = (book) => {
    setEditingId(book.id);
    setForm({ title: book.title, author: book.author, note: book.note || '', type: book.type || 'other' });
    setSaveError('');
    setTab('add');
  };

  const saveBook = async () => {
    if (!form.title.trim() || saving) return;
    const fields = {
      title:  form.title.trim(),
      author: form.author.trim() || 'Unknown',
      note:   form.note.trim(),
      type:   form.type || 'other',
    };
    const next = editingId
      ? books.map((b) => (b.id === editingId ? { ...b, ...fields } : b))
      : [...books, { id: uid(), builtin: false, ...fields }];
    if (await persist(next)) {
      setForm(BLANK_FORM);
      setEditingId(null);
      setTab('library');
    }
  };

  const removeBook = async (book) => {
    if (saving) return;
    if (!window.confirm(`Remove "${book.title}" from your library?`)) return;
    if (selectedBook?.id === book.id) { setSelectedBook(null); setResult(''); }
    await persist(books.filter((b) => b.id !== book.id));
  };

  // Re-add any missing built-ins without touching custom entries or edits.
  const restoreDefaults = async () => {
    if (saving) return;
    const present = new Set(books.map(keyOf));
    const additions = seedBooks().filter((s) => !present.has(keyOf(s)));
    if (additions.length === 0) { setSaveError(''); return; }
    await persist([...books, ...additions]);
  };

  const handleDeepDiveFor = async (modeId) => {
    if (!selectedBook) return;
    setLoading(true);
    setResult('');
    setResultProvider('');
    setVaulted(false);
    try {
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: PROMPTS[modeId](selectedBook) }],
        maxTokens: 1400,
        job: 'reason',
        onProvider: setResultProvider,
      });
      setResult(reply);
      // Record the book as a concept so it connects to research, quizzes, and
      // notes on the same subject.
      logConcept({ topic: selectedBook.title, source: selectedBook.title, module: 'books', refs: selectedBook.author ? [selectedBook.author] : [] });
    } catch {
      setResult('Unable to generate — check connection and try again.');
    }
    setLoading(false);
  };
  const handleDeepDive = () => handleDeepDiveFor(mode);

  const pad     = isPhone ? '14px' : isMobile ? '16px' : isTablet ? '22px' : '28px';
  const gridCol = isPhone ? 'repeat(2,1fr)' : isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(4,1fr)';
  const modeCol = isPhone ? 'repeat(2,1fr)' : 'repeat(3,1fr)';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: isMobile ? 80 : 60 }}>

      {/* Header */}
      <div style={{ padding: `${pad} ${pad} 0`, marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 4 }}>Intelligence Hub</div>
        <div style={{ fontSize: isMobile ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5 }}>
          📖 Book Club
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginTop: 5 }}>
          Research, deep dive, and master any book with AI — connected to CB's mental model library
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: `0 ${pad}`, display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[{ id: 'library', label: '📚 Library' }, { id: 'add', label: editingId ? '✎ Edit Book' : '+ Add Book' }, { id: 'dive', label: '🤿 Deep Dive' }].map(t => (
          <button key={t.id} onClick={() => (t.id === 'add' ? (editingId ? setTab('add') : openAdd()) : setTab(t.id))}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${tab === t.id ? T.accent : 'var(--border)'}`, background: tab === t.id ? withAlpha(T.accent, 10) : 'transparent', color: tab === t.id ? T.accent : 'var(--muted)', fontSize: 'var(--fs-base)', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', minHeight: 36 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: `0 ${pad}` }}>

        {/* Save error — visible wherever the user is. */}
        {saveError && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: withAlpha(T.negative, 10), border: `1px solid ${withAlpha(T.negative, 40)}`, borderRadius: 10, color: T.negative, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
            ⚠ {saveError}
          </div>
        )}

        {/* ── LIBRARY TAB ──────────────────────────────────────────── */}
        {tab === 'library' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or author..."
                style={{ flex: 1, minWidth: 180, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={restoreDefaults} disabled={saving}
                title="Re-add the 20 built-in books that aren't in your library. Custom books are untouched."
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                ↻ Restore default library
              </button>
            </div>

            <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              {filtered.length} Books · Click to Deep Dive
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14 }}>
                <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginBottom: 14 }}>
                  {search ? `No books match "${search}"` : 'No books in your library yet.'}
                </div>
                <button onClick={openAdd}
                  style={{ padding: '9px 20px', background: T.accent, color: T.onAccent, borderRadius: 8, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add a Book
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: gridCol, gap: 10 }}>
              {filtered.map((book) => {
                const isSelected = selectedBook?.id === book.id;
                const c = typeColor(book.type);
                return (
                  <div key={book.id}
                    onClick={() => { setSelectedBook(book); setMode('overview'); setResult(''); setTab('dive'); }}
                    style={{ padding: '14px', background: 'var(--surface)', border: `2px solid ${isSelected ? T.accent : withAlpha(c, 13)}`, borderTop: `3px solid ${c}`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}>
                    <div style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                      {TYPE_META[book.type]?.label || book.type || 'General'}
                    </div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{book.title}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>{book.author}</div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', fontWeight: 700, letterSpacing: 0.5 }}>
                        {book.builtin ? 'BUILT-IN' : 'CUSTOM'}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(book); }}
                          title="Edit"
                          style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px', background: 'transparent', border: 'none', fontFamily: 'inherit' }}>✎</button>
                        <button onClick={(e) => { e.stopPropagation(); removeBook(book); }}
                          title="Remove"
                          style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', cursor: 'pointer', padding: '2px 6px', background: 'transparent', border: 'none', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    </div>

                    {book.note && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>{book.note.slice(0, 60)}{book.note.length > 60 ? '…' : ''}</div>}
                    <div style={{ marginTop: 10, fontSize: 'var(--fs-sm)', color: T.accent, fontWeight: 700 }}>🤿 Deep Dive →</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ADD / EDIT BOOK TAB ──────────────────────────────────── */}
        {tab === 'add' && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
              {editingId ? 'Edit Book' : 'Add a Book'}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Book Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. The Lean Startup"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Author</label>
              <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="e.g. Eric Ries"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Category</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
                {TYPE_IDS.map(id => (
                  <option key={id} value={id}>{TYPE_META[id]?.label || id}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Why you're reading it, key questions, context..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveBook} disabled={!form.title.trim() || saving}
                style={{ padding: '11px 24px', background: form.title.trim() && !saving ? T.accent : 'var(--surf2)', color: form.title.trim() && !saving ? T.onAccent : 'var(--dim)', borderRadius: 9, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: form.title.trim() && !saving ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add to Library'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setForm(BLANK_FORM); setSaveError(''); setTab('library'); }}
                  style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 9, fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── DEEP DIVE TAB ────────────────────────────────────────── */}
        {tab === 'dive' && (
          <div>
            {!selectedBook ? (
              <div style={{ padding: '24px', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 12 }}>📖</div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginBottom: 16 }}>Select a book from the Library to deep dive</div>
                <button onClick={() => setTab('library')}
                  style={{ padding: '9px 20px', background: T.accent, color: T.onAccent, borderRadius: 8, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Browse Library
                </button>
              </div>
            ) : (
              <div>
                {/* Selected book header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--surface)', border: `1px solid ${withAlpha(typeColor(selectedBook.type), 30)}`, borderLeft: `3px solid ${typeColor(selectedBook.type)}`, borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)' }}>{selectedBook.title}</div>
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginTop: 2 }}>{selectedBook.author}</div>
                  </div>
                  <button onClick={() => { setSelectedBook(null); setResult(''); }}
                    style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Change
                  </button>
                </div>

                {/* Study mode grid */}
                <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Choose Study Mode — click any to generate instantly</div>
                <div style={{ display: 'grid', gridTemplateColumns: modeCol, gap: 8, marginBottom: 20 }}>
                  {STUDY_MODES.map(m => (
                    <button key={m.id} onClick={() => { setMode(m.id); setResult(''); handleDeepDiveFor(m.id); }}
                      style={{ padding: '12px 14px', textAlign: 'left', background: mode === m.id ? withAlpha(T.accent, 12) : 'var(--surface)', border: `1px solid ${mode === m.id ? T.accent : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', transition: 'all 0.12s', minHeight: 72 }}>
                      <div style={{ fontSize: 'var(--fs-lg)'}}>{m.icon}</div>
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: mode === m.id ? T.accent : 'var(--text)', marginTop: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>

                <button onClick={handleDeepDive} disabled={loading}
                  style={{ padding: '11px 24px', background: loading ? 'var(--surf2)' : T.accent, color: loading ? 'var(--dim)' : T.onAccent, borderRadius: 9, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading
                    ? 'Generating…'
                    : `🤿 ${STUDY_MODES.find(m => m.id === mode)?.label} — ${selectedBook.title.slice(0, 28)}${selectedBook.title.length > 28 ? '…' : ''}`
                  }
                </button>

                {loading && <ThinkingDots color={T.accent} />}

                {result && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 9, color: T.accent, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                          {STUDY_MODES.find(m => m.id === mode)?.icon} {STUDY_MODES.find(m => m.id === mode)?.label}
                        </div>
                        <ProviderTag provider={resultProvider} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { createCard({ front: `${selectedBook.title} — ${STUDY_MODES.find(m => m.id === mode)?.label}`, back: result.slice(0, 400), source: selectedBook.title, module: 'books', topic: selectedBook.title }); setVaulted(true); }}
                          style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', background: vaulted ? withAlpha(T.accent, 12) : 'var(--bg)', border: `1px solid ${vaulted ? T.accent : 'var(--border)'}`, borderRadius: 6, color: vaulted ? T.accent : 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          {vaulted ? '✓ In Vault' : '+ Vault'}
                        </button>
                        <button onClick={() => navigator.clipboard?.writeText(result)}
                          style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Copy
                        </button>
                      </div>
                    </div>
                    <MD text={result} color={T.accent} />
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
