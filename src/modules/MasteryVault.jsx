import { useState } from 'react';
import { useApp } from '../App.jsx';
import { saveNotes, callClaude, uid } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { Card, Label, Badge, Modal, ThinkingDots } from './shared/Common.jsx';

const VAULT_ACCENT  = '#ffcc44';
const NOTE_COLORS   = ['#00FFB2', '#6366F1', '#ff8844', '#ffcc44', '#ff4488', '#4488ff'];

const EXPORT_FORMATS = [
  { id: 'linkedin',  icon: '💼', label: 'LinkedIn Post',     desc: 'Engaging professional post with hook, body, CTA' },
  { id: 'newsletter',icon: '📬', label: 'Newsletter Section', desc: 'Reader-friendly article section with narrative flow' },
  { id: 'thread',    icon: '🐦', label: 'Twitter/X Thread',  desc: '6–8 tweet thread with hooks and punchy insights' },
  { id: 'course',    icon: '🎓', label: 'Course Outline',    desc: 'Structured course with modules, lessons, exercises' },
  { id: 'blog',      icon: '📝', label: 'Blog Post',         desc: 'Full blog article with sections, examples, conclusion' },
  { id: 'brief',     icon: '⚡', label: 'Executive Brief',   desc: 'One-pager: situation, insights, recommendations, action' },
];

const DAY_MS = 86_400_000;

function loadCards() {
  try { return JSON.parse(localStorage.getItem('aether_flashcards') || '[]'); } catch { return []; }
}
function saveCards(cards) { localStorage.setItem('aether_flashcards', JSON.stringify(cards)); }

// ─── Flash Card Study ────────────────────────────────────────────────────────
function FlashCards({ onCreateFromNote }) {
  const { isMobile } = useApp();
  const [cards,     setCards]     = useState(loadCards);
  const [mode,      setMode]      = useState('list'); // list | study | create
  const [revealed,  setRevealed]  = useState(false);
  const [studyIdx,  setStudyIdx]  = useState(0);
  const [newCard,   setNewCard]   = useState({ front: '', back: '' });

  const persist = (updated) => { setCards(updated); saveCards(updated); };

  const addCard = () => {
    if (!newCard.front.trim() || !newCard.back.trim()) return;
    const card = {
      id:           uid(),
      front:        newCard.front,
      back:         newCard.back,
      interval:     1,
      easeFactor:   2.5,
      dueDate:      Date.now(),
      reviews:      0,
      createdAt:    Date.now(),
    };
    persist([card, ...cards]);
    setNewCard({ front: '', back: '' });
  };

  const removeCard = (id) => persist(cards.filter(c => c.id !== id));

  const due = [...cards].sort((a, b) => a.dueDate - b.dueDate);
  const studyCard = due[studyIdx % Math.max(due.length, 1)];

  const grade = (correct) => {
    const updated = cards.map(c => {
      if (c.id !== studyCard?.id) return c;
      const interval    = correct ? Math.min(Math.round(c.interval * c.easeFactor), 30) : 1;
      const easeFactor  = correct ? Math.max(c.easeFactor + 0.1, 1.3) : Math.max(c.easeFactor - 0.2, 1.3);
      const dueDate     = Date.now() + interval * DAY_MS;
      return { ...c, interval, easeFactor, dueDate, reviews: c.reviews + 1 };
    });
    persist(updated);
    setRevealed(false);
    setStudyIdx(i => (i + 1) % Math.max(due.length, 1));
    if (studyIdx + 1 >= due.length) setMode('list');
  };

  if (mode === 'study' && due.length > 0) return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 0' }}>
      <div style={{ fontSize: 10, color: 'var(--dim)', textAlign: 'center', marginBottom: 20 }}>
        Card {(studyIdx % due.length) + 1} of {due.length} · {cards.filter(c => c.dueDate <= Date.now()).length} due today
      </div>
      <div style={{ background: 'var(--surface)', border: `2px solid ${revealed ? '#00FFB240' : 'var(--border)'}`, borderRadius: 16, padding: '36px 28px', textAlign: 'center', minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'border-color 0.2s', marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: VAULT_ACCENT, textTransform: 'uppercase', marginBottom: 12 }}>{revealed ? 'Answer' : 'Question'}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.5 }}>
          {revealed ? studyCard?.back : studyCard?.front}
        </div>
        {!revealed && (
          <div onClick={() => setRevealed(true)} style={{ marginTop: 24, padding: isMobile ? '13px 28px' : '10px 24px', background: VAULT_ACCENT, borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer', display: 'inline-block', alignSelf: 'center', minHeight: 44 }}>
            Reveal Answer
          </div>
        )}
      </div>
      {revealed && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div onClick={() => grade(false)} style={{ flex: 1, padding: '12px', textAlign: 'center', background: '#ff444415', border: '1px solid #ff444440', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#ff4444', cursor: 'pointer' }}>
            ✕ Hard — review again
          </div>
          <div onClick={() => grade(true)} style={{ flex: 1, padding: '12px', textAlign: 'center', background: '#00FFB215', border: '1px solid #00FFB240', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#00FFB2', cursor: 'pointer' }}>
            ✓ Got it — {Math.min(Math.round((studyCard?.interval || 1) * (studyCard?.easeFactor || 2.5)), 30)}d
          </div>
        </div>
      )}
      <div onClick={() => { setMode('list'); setRevealed(false); setStudyIdx(0); }} style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--dim)', cursor: 'pointer' }}>Exit study session</div>
    </div>
  );

  if (mode === 'create') return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 0' }}>
      <div onClick={() => setMode('list')} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 18 }}>← Back to cards</div>
      <div style={{ background: 'var(--surface)', border: `1px solid ${VAULT_ACCENT}40`, borderRadius: 14, padding: '20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>New Flash Card</div>
        <textarea value={newCard.front} onChange={e => setNewCard(p => ({ ...p, front: e.target.value }))}
          placeholder="Front — question, term, or concept…" rows={3}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 10 }} />
        <textarea value={newCard.back} onChange={e => setNewCard(p => ({ ...p, back: e.target.value }))}
          placeholder="Back — answer, definition, or explanation…" rows={3}
          style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 14 }} />
        <button onClick={addCard} disabled={!newCard.front.trim() || !newCard.back.trim()}
          style={{ width: '100%', padding: '11px', background: newCard.front.trim() && newCard.back.trim() ? VAULT_ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, color: newCard.front.trim() && newCard.back.trim() ? '#000' : 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Add Card
        </button>
      </div>
    </div>
  );

  const dueNow = cards.filter(c => c.dueDate <= Date.now()).length;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cards.length} cards · <span style={{ color: VAULT_ACCENT }}>{dueNow} due today</span></div>
          <div style={{ fontSize: 10, color: 'var(--dim)' }}>Spaced repetition — review at optimal intervals</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={() => setMode('create')} style={{ padding: isMobile ? '10px 16px' : '7px 14px', fontSize: 11, fontWeight: 700, border: `1px solid ${VAULT_ACCENT}40`, borderRadius: 8, color: VAULT_ACCENT, cursor: 'pointer', background: `${VAULT_ACCENT}10`, minHeight: isMobile ? 40 : undefined }}>+ New Card</div>
          {cards.length > 0 && <div onClick={() => { setStudyIdx(0); setRevealed(false); setMode('study'); }} style={{ padding: isMobile ? '10px 16px' : '7px 14px', fontSize: 11, fontWeight: 700, background: VAULT_ACCENT, borderRadius: 8, color: '#000', cursor: 'pointer', minHeight: isMobile ? 40 : undefined }}>Study {dueNow > 0 ? `(${dueNow} due)` : 'All'} →</div>}
        </div>
      </div>

      {cards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🃏</div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>No Flash Cards Yet</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20 }}>Create cards from your notes or manually. They resurface at spaced intervals for maximum retention.</div>
          <div onClick={() => setMode('create')} style={{ display: 'inline-block', padding: '10px 22px', background: VAULT_ACCENT, borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Create First Card →</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {cards.map(c => {
          const overdue = c.dueDate <= Date.now();
          return (
            <div key={c.id} style={{ background: 'var(--surface)', border: `1px solid ${overdue ? VAULT_ACCENT + '50' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: overdue ? `${VAULT_ACCENT}15` : 'var(--bg)', color: overdue ? VAULT_ACCENT : 'var(--dim)', fontWeight: overdue ? 700 : 400 }}>{overdue ? 'Due' : `in ${Math.ceil((c.dueDate - Date.now()) / DAY_MS)}d`}</span>
                <span onClick={() => removeCard(c.id)} style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer' }}>✕</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>{c.front}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.back}</div>
              {c.reviews > 0 && <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 8 }}>Reviewed {c.reviews}× · interval {c.interval}d</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Expertise Export ────────────────────────────────────────────────────────
function ExpertiseExport({ notes }) {
  const { isMobile } = useApp();
  const [selected,  setSelected]  = useState([]);
  const [format,    setFormat]    = useState('linkedin');
  const [result,    setResult]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState(false);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const generate = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setResult('');
    const fmt = EXPORT_FORMATS.find(f => f.id === format);
    const content = notes.filter(n => selected.includes(n.id)).map(n => `${n.title}:\n${n.content}`).join('\n\n---\n\n');
    const instructions = {
      linkedin:  'Write a compelling LinkedIn post (max 300 words). Hook in first line, 3-5 insight bullets, strong CTA. Professional but personal voice. CB is the author.',
      newsletter:'Write a newsletter section (400-600 words). Engaging headline, narrative intro, 3-4 key takeaways with stories, actionable close. Warm, intelligent voice.',
      thread:    'Write a Twitter/X thread of 7-8 tweets. Tweet 1 is the hook. Tweets 2-7 each = one sharp insight. Tweet 8 = summary + CTA. Each tweet max 280 chars.',
      course:    'Create a structured course outline. Title, 3-5 modules, 3-4 lessons per module with descriptions, one practical exercise per module, learning objectives.',
      blog:      'Write a full blog post (600-900 words). SEO-friendly H1 title, intro with hook, 3-4 H2 sections with supporting text and examples, strong conclusion with action step.',
      brief:     'Write a one-page executive brief. Sections: Situation (2 sentences), Key Insights (4 bullets), Strategic Implications, Recommended Actions (3 numbered steps), Bottom Line.',
    };
    try {
      const r = await callClaude({
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: `${instructions[format]}\n\nBased on these notes from CB's knowledge vault:\n\n${content.slice(0, 5000)}` }],
        maxTokens: 1200,
      });
      setResult(r);
    } catch {
      setResult('Generation failed — try again.');
    }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard?.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📤</div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>No Notes to Export</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>Add notes to your vault first, then turn your private knowledge into published content.</div>
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>

          {/* Left: select notes + format */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>1. Select Notes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 280, overflowY: 'auto', marginBottom: 20 }}>
              {notes.map(n => (
                <div key={n.id} onClick={() => toggle(n.id)}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', background: selected.includes(n.id) ? `${VAULT_ACCENT}10` : 'var(--surface)', border: `1px solid ${selected.includes(n.id) ? VAULT_ACCENT + '50' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', transition: 'all 0.1s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected.includes(n.id) ? VAULT_ACCENT : 'var(--border)'}`, background: selected.includes(n.id) ? VAULT_ACCENT : 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000' }}>
                    {selected.includes(n.id) ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{n.content?.slice(0, 60)}…</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>2. Choose Format</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 16 }}>
              {EXPORT_FORMATS.map(f => (
                <div key={f.id} onClick={() => setFormat(f.id)}
                  style={{ padding: '9px 12px', background: format === f.id ? `${VAULT_ACCENT}10` : 'var(--surface)', border: `1px solid ${format === f.id ? VAULT_ACCENT + '50' : 'var(--border)'}`, borderRadius: 9, cursor: 'pointer', transition: 'all 0.1s' }}>
                  <div style={{ fontSize: 13, marginBottom: 3 }}>{f.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: format === f.id ? VAULT_ACCENT : 'var(--text)' }}>{f.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--dim)', lineHeight: 1.4, marginTop: 2 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <button onClick={generate} disabled={selected.length === 0 || loading}
              style={{ width: '100%', padding: '12px', background: selected.length > 0 && !loading ? VAULT_ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, color: selected.length > 0 && !loading ? '#000' : 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {loading ? 'Generating…' : `Generate ${EXPORT_FORMATS.find(f => f.id === format)?.label} →`}
            </button>
          </div>

          {/* Right: result */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>3. Your Content</div>
            <div style={{ background: 'var(--surface)', border: `1px solid ${result ? VAULT_ACCENT + '40' : 'var(--border)'}`, borderRadius: 12, padding: '16px', minHeight: isMobile ? 200 : 320, transition: 'border-color 0.15s' }}>
              {loading && <ThinkingDots color={VAULT_ACCENT} />}
              {!loading && !result && (
                <div style={{ color: 'var(--dim)', fontSize: 11, lineHeight: 1.8 }}>
                  Select notes, pick a format, and hit Generate. AI will turn your private knowledge into publish-ready content.
                </div>
              )}
              {!loading && result && <MD text={result} color={VAULT_ACCENT} />}
            </div>
            {result && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div onClick={copy} style={{ padding: isMobile ? '10px 18px' : '7px 16px', fontSize: 11, fontWeight: 700, border: `1px solid ${VAULT_ACCENT}40`, borderRadius: 8, color: VAULT_ACCENT, cursor: 'pointer', background: `${VAULT_ACCENT}10`, minHeight: isMobile ? 40 : undefined }}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </div>
                <div onClick={() => setResult('')} style={{ padding: isMobile ? '10px 14px' : '7px 12px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 8, color: 'var(--subtle)', cursor: 'pointer', minHeight: isMobile ? 40 : undefined }}>Clear</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Module ─────────────────────────────────────────────────────────────
export default function MasteryVault() {
  const { notes, setNotes, graph, isMobile } = useApp();
  const [tab,        setTab]        = useState('notes');
  const [activeNote, setActiveNote] = useState(null);
  const [showNew,    setShowNew]    = useState(false);
  const [filterTag,  setFilterTag]  = useState('all');
  const [newNote,    setNewNote]    = useState({ title: '', content: '', tags: [], connections: [], color: '#00FFB2' });
  const [tagInput,   setTagInput]   = useState('');

  const updateNotes = async (updated) => {
    setNotes(updated);
    await saveNotes(updated);
  };

  const createNote = async () => {
    if (!newNote.title.trim()) return;
    const note = { id: uid(), ...newNote, createdAt: Date.now() };
    await updateNotes([note, ...notes]);
    setNewNote({ title: '', content: '', tags: [], connections: [], color: '#00FFB2' });
    setTagInput('');
    setShowNew(false);
  };

  const deleteNote = async (id) => {
    await updateNotes(notes.filter(n => n.id !== id));
    setActiveNote(null);
  };

  const addCardFromNote = (note) => {
    const cards = loadCards();
    const card = {
      id:        uid(),
      front:     note.title,
      back:      note.content.slice(0, 300),
      interval:  1,
      easeFactor:2.5,
      dueDate:   Date.now(),
      reviews:   0,
      createdAt: Date.now(),
    };
    saveCards([card, ...cards]);
    setTab('flashcards');
    setActiveNote(null);
  };

  const allTags  = [...new Set(notes.flatMap(n => n.tags || []))];
  const filtered = filterTag === 'all' ? notes : notes.filter(n => n.tags?.includes(filterTag));
  const topics   = Object.values(graph?.topics || {}).map(t => t.title);

  // ── Note detail ──────────────────────────────────────────────────────────
  if (activeNote) {
    const note = notes.find(n => n.id === activeNote);
    if (!note) { setActiveNote(null); return null; }
    return (
      <div style={{ padding: '24px 28px 80px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <div onClick={() => setActiveNote(null)} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer' }}>← Vault</div>
          <div onClick={() => addCardFromNote(note)} style={{ fontSize: 10, padding: '4px 12px', border: `1px solid ${VAULT_ACCENT}40`, borderRadius: 7, color: VAULT_ACCENT, cursor: 'pointer', background: `${VAULT_ACCENT}10`, fontWeight: 600 }}>🃏 Create Flash Card</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 8 }}>{note.title}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {note.tags?.map(t => <Badge key={t} color={note.color}>{t}</Badge>)}
            </div>
          </div>
          <div onClick={() => deleteNote(note.id)} style={{ fontSize: 10, color: '#ff4444', padding: '5px 10px', border: '1px solid #ff444440', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>Delete</div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.85, color: 'var(--text-c)', whiteSpace: 'pre-wrap', marginBottom: 24 }}>{note.content}</div>
        {note.connections?.length > 0 && (
          <div>
            <Label>Knowledge Connections</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {note.connections.map(c => (
                <div key={c} style={{ fontSize: 10, padding: '5px 12px', background: 'var(--surface)', border: `1px solid ${note.color}25`, color: note.color, borderRadius: 20 }}>📚 {c}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? '16px 16px 60px' : '24px 28px 60px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: VAULT_ACCENT, textTransform: 'uppercase', marginBottom: 6 }}>Mastery Vault</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Your Knowledge Base</div>
          <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{notes.length} notes · flash cards · publish-ready exports</div>
        </div>
        {tab === 'notes' && (
          <div onClick={() => setShowNew(true)} style={{ padding: '8px 16px', background: VAULT_ACCENT, borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#000', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>+ New Note</div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, borderBottom: '1px solid var(--bord2)', paddingBottom: 14 }}>
        {[
          { id: 'notes',      label: `🏛 Notes (${notes.length})` },
          { id: 'flashcards', label: `🃏 Flash Cards (${loadCards().length})` },
          { id: 'export',     label: '📤 Export' },
        ].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, borderRadius: 10, cursor: 'pointer', border: `1px solid ${tab === t.id ? VAULT_ACCENT : 'var(--border)'}`, background: tab === t.id ? `${VAULT_ACCENT}10` : 'var(--surface)', color: tab === t.id ? VAULT_ACCENT : 'var(--muted)', transition: 'all 0.12s' }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── Notes Tab ─────────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <>
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {['all', ...allTags].map(t => (
                <div key={t} onClick={() => setFilterTag(t)}
                  style={{ padding: '4px 12px', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', border: `1px solid ${filterTag === t ? VAULT_ACCENT : 'var(--bord2)'}`, color: filterTag === t ? VAULT_ACCENT : 'var(--subtle)', borderRadius: 20, cursor: 'pointer', background: filterTag === t ? `${VAULT_ACCENT}18` : 'transparent' }}>
                  {t}
                </div>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏛</div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>Your Mastery Vault is Empty</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20 }}>Save synthesized insights and cross-references here. These are the notes that compound over time.</div>
              <div onClick={() => setShowNew(true)} style={{ display: 'inline-block', padding: '10px 20px', background: VAULT_ACCENT, borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Add First Note →</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(note => (
              <Card key={note.id} color={note.color} onClick={() => setActiveNote(note.id)} style={{ cursor: 'pointer', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: note.color, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ fontSize: 9, color: 'var(--dim)' }}>{new Date(note.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, lineHeight: 1.35 }}>{note.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.65, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', marginBottom: 12 }}>
                  {note.content}
                </div>
                {note.connections?.length > 0 && (
                  <div style={{ fontSize: 9, color: note.color, opacity: 0.7 }}>📚 {note.connections.slice(0, 2).join(' · ')}{note.connections.length > 2 ? ` +${note.connections.length - 2}` : ''}</div>
                )}
                {note.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    {note.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: isMobile ? 10 : 8, color: 'var(--subtle)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 3 }}>{t}</span>)}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Flash Cards Tab ──────────────────────────────────────────────── */}
      {tab === 'flashcards' && <FlashCards />}

      {/* ── Export Tab ───────────────────────────────────────────────────── */}
      {tab === 'export' && <ExpertiseExport notes={notes} />}

      {/* ── New Note Modal ───────────────────────────────────────────────── */}
      {showNew && (
        <Modal title="New Note" accent={VAULT_ACCENT} onClose={() => setShowNew(false)} width={560}>
          <div>
            <input value={newNote.title} onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))} placeholder="Note title..."
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 14, outline: 'none', fontFamily: 'inherit', fontWeight: 700, boxSizing: 'border-box', marginBottom: 12 }} />
            <textarea value={newNote.content} onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))} placeholder="Your insight, synthesis, or breakthrough..." rows={5}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box', marginBottom: 12 }} />
            <Label>Tags</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {newNote.tags.map(t => (
                <div key={t} onClick={() => setNewNote(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}
                  style={{ fontSize: 10, padding: '3px 9px', background: `${VAULT_ACCENT}15`, border: `1px solid ${VAULT_ACCENT}40`, color: VAULT_ACCENT, borderRadius: 14, cursor: 'pointer' }}>
                  {t} ✕
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tagInput.trim() && (setNewNote(p => ({ ...p, tags: [...new Set([...p.tags, tagInput.trim()])] })), setTagInput(''))}
                placeholder="Add tag, press Enter..."
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <Label>Connect to Topics</Label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
              {topics.slice(0, 10).map(t => (
                <div key={t} onClick={() => setNewNote(p => ({ ...p, connections: p.connections.includes(t) ? p.connections.filter(x => x !== t) : [...p.connections, t] }))}
                  style={{ fontSize: 9, padding: '3px 9px', border: `1px solid ${newNote.connections.includes(t) ? '#00FFB2' : 'var(--bord2)'}`, color: newNote.connections.includes(t) ? '#00FFB2' : 'var(--subtle)', borderRadius: 14, cursor: 'pointer', background: newNote.connections.includes(t) ? '#00FFB215' : 'transparent' }}>
                  {t}
                </div>
              ))}
            </div>
            <Label>Color</Label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {NOTE_COLORS.map(c => (
                <div key={c} onClick={() => setNewNote(p => ({ ...p, color: c }))}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${newNote.color === c ? 'var(--text)' : 'transparent'}` }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div onClick={() => setShowNew(false)} style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer' }}>Cancel</div>
              <div onClick={createNote} style={{ flex: 2, padding: '11px', background: VAULT_ACCENT, borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Save to Vault →</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
