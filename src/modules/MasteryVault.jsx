import { T } from '../theme';
import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { saveNotes, callClaude, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { SYSTEM_BASE } from '../constants.js';

const FLASHCARDS_KEY = 'aether_flashcards';
import MD from './shared/MD.jsx';
import { Card, Label, Badge, Modal, ThinkingDots } from './shared/Common.jsx';
import AskChip from './shared/AskChip.jsx';
import Icon from './shared/Icon.jsx';
import './mastery-vault.css';

// Mastery Vault (mv-). Every colour lives in mastery-vault.css. A note's stored
// `color` is passed to the shared components as before (they route it through CSS
// custom properties) and drives the dot via --nc; text always reads --accent-text.
const VAULT_ACCENT  = T.accent;
const NOTE_COLORS   = [T.accent, T.accent, T.accent, T.accent, T.accent, T.accent];

const EXPORT_FORMATS = [
  { id: 'linkedin',  icon: 'Briefcase',     label: 'LinkedIn Post',     desc: 'Engaging professional post with hook, body, CTA' },
  { id: 'newsletter',icon: 'Inbox',         label: 'Newsletter Section', desc: 'Reader-friendly article section with narrative flow' },
  { id: 'thread',    icon: 'MessageSquare', label: 'Twitter/X Thread',  desc: '6–8 tweet thread with hooks and punchy insights' },
  { id: 'course',    icon: 'GraduationCap', label: 'Course Outline',    desc: 'Structured course with modules, lessons, exercises' },
  { id: 'blog',      icon: 'PenSquare',     label: 'Blog Post',         desc: 'Full blog article with sections, examples, conclusion' },
  { id: 'brief',     icon: 'Zap',           label: 'Executive Brief',   desc: 'One-pager: situation, insights, recommendations, action' },
];

const DAY_MS = 86_400_000;

function loadCards() { return readLocal(FLASHCARDS_KEY, []); }
function saveCards(cards) { writeThrough(FLASHCARDS_KEY, cards); }

// ─── Flash Card Study ────────────────────────────────────────────────────────
function FlashCards({ onCreateFromNote }) {
  const [cards,     setCards]     = useState(loadCards);
  const [mode,      setMode]      = useState('list'); // list | study | create

  // Cross-device: pull the server copy after mount.
  useEffect(() => { hydrate(FLASHCARDS_KEY).then(r => { if (Array.isArray(r)) setCards(r); }); }, []);
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
    <div className="mv-narrow">
      <div className="mv-study-count">
        Card {(studyIdx % due.length) + 1} of {due.length} · {cards.filter(c => c.dueDate <= Date.now()).length} due today
      </div>
      <div className="mv-study-card" data-revealed={revealed ? '' : undefined}>
        <div className="mv-study-kick">{revealed ? 'Answer' : 'Question'}</div>
        <div className="mv-study-text">
          {revealed ? studyCard?.back : studyCard?.front}
        </div>
        {!revealed && (
          <button type="button" className="btn btn-primary mv-reveal" onClick={() => setRevealed(true)}>
            Reveal Answer
          </button>
        )}
      </div>
      {revealed && (
        <div className="mv-grade">
          <button type="button" className="mv-grade-btn" data-kind="hard" onClick={() => grade(false)}>
            <Icon name="X" size={16} strokeWidth={2.4} /> Hard — review again
          </button>
          <button type="button" className="mv-grade-btn" data-kind="good" onClick={() => grade(true)}>
            <Icon name="Check" size={16} strokeWidth={2.4} /> Got it — {Math.min(Math.round((studyCard?.interval || 1) * (studyCard?.easeFactor || 2.5)), 30)}d
          </button>
        </div>
      )}
      <div className="mv-center">
        <button type="button" className="mv-link tap" onClick={() => { setMode('list'); setRevealed(false); setStudyIdx(0); }}>Exit study session</button>
      </div>
    </div>
  );

  if (mode === 'create') return (
    <div className="mv-narrow">
      <button type="button" className="mv-link mv-back tap" onClick={() => setMode('list')}>← Back to cards</button>
      <div className="mv-panel">
        <div className="mv-panel-title">New Flash Card</div>
        <textarea className="mv-input mv-textarea" aria-label="Card front" value={newCard.front} onChange={e => setNewCard(p => ({ ...p, front: e.target.value }))}
          placeholder="Front — question, term, or concept…" rows={3} />
        <textarea className="mv-input mv-textarea mv-gap-lg" aria-label="Card back" value={newCard.back} onChange={e => setNewCard(p => ({ ...p, back: e.target.value }))}
          placeholder="Back — answer, definition, or explanation…" rows={3} />
        <button type="button" className="btn btn-primary mv-block" onClick={addCard} disabled={!newCard.front.trim() || !newCard.back.trim()}>
          Add Card
        </button>
      </div>
    </div>
  );

  const dueNow = cards.filter(c => c.dueDate <= Date.now()).length;
  return (
    <div>
      <div className="mv-fc-head">
        <div className="mv-min">
          <div className="mv-fc-count">{cards.length} cards · <span className="mv-accent">{dueNow} due today</span></div>
          <div className="mv-fc-sub">Spaced repetition — review at optimal intervals</div>
        </div>
        <div className="mv-fc-actions">
          <button type="button" className="btn mv-btn-accent mv-sm tap" onClick={() => setMode('create')}>+ New Card</button>
          {cards.length > 0 && <button type="button" className="btn btn-primary mv-sm tap" onClick={() => { setStudyIdx(0); setRevealed(false); setMode('study'); }}>Study {dueNow > 0 ? `(${dueNow} due)` : 'All'} →</button>}
        </div>
      </div>

      {cards.length === 0 && (
        <div className="mv-empty" data-size="sm">
          <div className="mv-empty-ico"><Icon name="Layers" size={40} strokeWidth={1.5} /></div>
          <div className="mv-empty-title">No Flash Cards Yet</div>
          <div className="mv-empty-body">Create cards from your notes or manually. They resurface at spaced intervals for maximum retention.</div>
          <button type="button" className="btn btn-primary mv-cta tap" onClick={() => setMode('create')}>Create First Card →</button>
        </div>
      )}

      <div className="mv-fc-grid">
        {cards.map(c => {
          const overdue = c.dueDate <= Date.now();
          return (
            <div key={c.id} className="mv-fc" data-overdue={overdue ? '' : undefined}>
              <div className="mv-fc-top">
                <span className="mv-due">{overdue ? 'Due' : `in ${Math.ceil((c.dueDate - Date.now()) / DAY_MS)}d`}</span>
                <button type="button" className="mv-x tap" aria-label="Delete card" onClick={() => removeCard(c.id)}><Icon name="X" size={16} /></button>
              </div>
              <div className="mv-fc-front">{c.front}</div>
              <div className="mv-fc-back">{c.back}</div>
              {c.reviews > 0 && <div className="mv-fc-meta">Reviewed {c.reviews}× · interval {c.interval}d</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Expertise Export ────────────────────────────────────────────────────────
function ExpertiseExport({ notes }) {
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
        system: SYSTEM_BASE,
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
        <div className="mv-empty" data-size="sm">
          <div className="mv-empty-ico"><Icon name="Share2" size={40} strokeWidth={1.5} /></div>
          <div className="mv-empty-title">No Notes to Export</div>
          <div className="mv-empty-body mv-flush">Add notes to your vault first, then turn your private knowledge into published content.</div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="mv-export">

          {/* Left: select notes + format */}
          <div className="mv-min">
            <div className="mv-step">1. Select Notes</div>
            <div className="mv-pick-list">
              {notes.map(n => {
                const on = selected.includes(n.id);
                return (
                  <button type="button" key={n.id} className="mv-pick" aria-pressed={on} onClick={() => toggle(n.id)}>
                    <span className="mv-check" aria-hidden="true">{on && <Icon name="Check" size={12} strokeWidth={3} />}</span>
                    <span className="mv-pick-body">
                      <span className="mv-pick-title">{n.title}</span>
                      <span className="mv-pick-sub">{n.content?.slice(0, 60)}…</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mv-step">2. Choose Format</div>
            <div className="mv-formats">
              {EXPORT_FORMATS.map(f => (
                <button type="button" key={f.id} className="mv-format" aria-pressed={format === f.id} onClick={() => setFormat(f.id)}>
                  <span className="mv-format-ico"><Icon name={f.icon} size={16} /></span>
                  <span className="mv-format-label">{f.label}</span>
                  <span className="mv-format-desc">{f.desc}</span>
                </button>
              ))}
            </div>

            <button type="button" className="btn btn-primary mv-block mv-gen" onClick={generate} disabled={selected.length === 0 || loading} aria-busy={loading}>
              {loading ? 'Generating…' : `Generate ${EXPORT_FORMATS.find(f => f.id === format)?.label} →`}
            </button>
          </div>

          {/* Right: result */}
          <div className="mv-min">
            <div className="mv-step">3. Your Content</div>
            <div className="mv-result" data-filled={result ? '' : undefined}>
              {loading && <ThinkingDots color="var(--accent-text)" />}
              {!loading && !result && (
                <div className="mv-result-empty">
                  Select notes, pick a format, and hit Generate. AI will turn your private knowledge into publish-ready content.
                </div>
              )}
              {!loading && result && <MD text={result} color="var(--accent-text)" />}
            </div>
            {result && (
              <div className="mv-result-actions">
                <button type="button" className="btn mv-btn-accent mv-sm tap" onClick={copy}>
                  {copied ? <><Icon name="Check" size={14} /> Copied!</> : 'Copy'}
                </button>
                <button type="button" className="btn mv-btn-quiet mv-sm tap" onClick={() => setResult('')}>Clear</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Note Detail ─────────────────────────────────────────────────────────────
function NoteDetail({ note, onBack, onDelete, onCardCreate }) {
  const [aiMode,    setAiMode]    = useState(''); // '' | 'expand' | 'connect' | 'apply'
  const [aiResult,  setAiResult]  = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { setChatPrefill, setChatOpen } = useApp();

  const runAI = async (mode) => {
    if (aiMode === mode) { setAiMode(''); return; }
    setAiMode(mode);
    setAiResult('');
    setAiLoading(true);
    const prompts = {
      expand: `Expand on this note for CB. Deepen the insight — add supporting evidence, a real-world example, and a second-order implication CB might not have considered.\n\nNote title: ${note.title}\nContent: ${note.content}`,
      connect: `Connect this note to CB's broader knowledge base. What other fields, mental models, or domains does this insight intersect with? How does it compound with CB's goals (BD, passive income, health, leadership)?\n\nNote title: ${note.title}\nContent: ${note.content}`,
      apply: `Give CB 3 specific, concrete ways to apply the insight in this note within the next 30 days. Be specific to CB's world (Houston TX, BD professional, investor, family-first operator).\n\nNote title: ${note.title}\nContent: ${note.content}`,
    };
    try {
      const r = await callClaude({ system: SYSTEM_BASE, messages: [{ role: 'user', content: prompts[mode] }], maxTokens: 700 });
      setAiResult(r);
    } catch { setAiResult('Network error — try again.'); }
    setAiLoading(false);
  };

  return (
    <div className="mv-detail">
      <div className="mv-detail-nav">
        <button type="button" className="mv-link tap" onClick={onBack}>← Vault</button>
        <button type="button" className="mv-pill tap" onClick={onCardCreate}><Icon name="Layers" size={14} /> Create Flash Card</button>
        <AskChip type="note" object={note} />
      </div>
      <div className="mv-detail-head">
        <div className="mv-min">
          <div className="mv-detail-title">{note.title}</div>
          <div className="mv-tags">
            {note.tags?.map(t => <Badge key={t} color={note.color}>{t}</Badge>)}
          </div>
        </div>
        <button type="button" className="mv-delete tap" onClick={onDelete}>Delete</button>
      </div>
      <div className="mv-detail-body">{note.content}</div>
      {note.connections?.length > 0 && (
        <div className="mv-section">
          <Label>Knowledge Connections</Label>
          <div className="mv-chips">
            {note.connections.map(c => (
              <button type="button" key={c} className="chip mv-conn tap" onClick={() => { setChatPrefill(`Tell me more about "${c}" and how it connects to: ${note.title}`); setChatOpen(true); }}>
                <Icon name="BookMarked" size={14} /> {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Deepen Panel */}
      <div className="mv-deepen">
        <Label><span className="mv-label-ico"><Icon name="Sparkles" size={11} /> Deepen This Note</span></Label>
        <div className="mv-deepen-row">
          {[
            { id: 'expand',  icon: 'BookOpen', label: 'Expand Insight' },
            { id: 'connect', icon: 'Share2',   label: 'Cross-Connect' },
            { id: 'apply',   icon: 'Target',   label: 'Apply in 30 Days' },
          ].map(btn => (
            <button type="button" key={btn.id} className="mv-deep-btn tap" aria-pressed={aiMode === btn.id} onClick={() => runAI(btn.id)}>
              <Icon name={btn.icon} size={14} /> {btn.label}
            </button>
          ))}
          <button type="button" className="mv-deep-btn tap" onClick={() => { setChatPrefill(`I want to dive deeper into this note: "${note.title}". ${note.content.slice(0, 200)}`); setChatOpen(true); }}>
            <Icon name="MessageSquare" size={14} /> Ask CB AI
          </button>
        </div>
        {aiMode && (aiLoading || aiResult) && (
          <div className="mv-ai">
            <div className="mv-ai-kick">
              {aiMode === 'expand' ? 'Expanded Insight' : aiMode === 'connect' ? 'Cross-Connections' : '30-Day Applications'}
            </div>
            {aiLoading ? <ThinkingDots color={note.color} /> : <MD text={aiResult} color={note.color} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Module ─────────────────────────────────────────────────────────────
export default function MasteryVault() {
  const { notes, setNotes, graph } = useApp();
  const [tab,        setTab]        = useState('notes');
  const [activeNote, setActiveNote] = useState(null);
  const [showNew,    setShowNew]    = useState(false);
  const [filterTag,  setFilterTag]  = useState('all');
  const [newNote,    setNewNote]    = useState({ title: '', content: '', tags: [], connections: [], color: 'var(--accent-text)' });
  const [tagInput,   setTagInput]   = useState('');

  const updateNotes = async (updated) => {
    setNotes(updated);
    await saveNotes(updated);
  };

  const createNote = async () => {
    if (!newNote.title.trim()) return;
    const note = { id: uid(), ...newNote, createdAt: Date.now() };
    await updateNotes([note, ...notes]);
    setNewNote({ title: '', content: '', tags: [], connections: [], color: 'var(--accent-text)' });
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
    return <NoteDetail note={note} onBack={() => setActiveNote(null)} onDelete={() => deleteNote(note.id)} onCardCreate={() => addCardFromNote(note)} />;
  }

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <div className="mv">

      {/* Header */}
      <div className="mv-head">
        <div className="mv-min">
          <div className="mv-eyebrow">Mastery Vault</div>
          <div className="mv-title">Your Knowledge Base</div>
          <div className="mv-sub">{notes.length} notes · flash cards · publish-ready exports</div>
        </div>
        {tab === 'notes' && (
          <button type="button" className="btn btn-primary mv-new tap" onClick={() => setShowNew(true)}>+ New Note</button>
        )}
      </div>

      {/* Tab bar */}
      <div className="mv-tabs" role="tablist" aria-label="Vault sections">
        {[
          { id: 'notes',      icon: 'Landmark', label: `Notes (${notes.length})` },
          { id: 'flashcards', icon: 'Layers',   label: `Flash Cards (${loadCards().length})` },
          { id: 'export',     icon: 'Share2',   label: 'Export' },
        ].map(t => (
          <button type="button" key={t.id} role="tab" className="mv-tab tap" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Notes Tab ─────────────────────────────────────────────────────── */}
      {tab === 'notes' && (
        <>
          {allTags.length > 0 && (
            <div className="mv-chips mv-filters">
              {['all', ...allTags].map(t => (
                <button type="button" key={t} className="mv-filter tap" aria-pressed={filterTag === t} onClick={() => setFilterTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="mv-empty">
              <div className="mv-empty-ico"><Icon name="Landmark" size={40} strokeWidth={1.5} /></div>
              <div className="mv-empty-title">Your Mastery Vault is Empty</div>
              <div className="mv-empty-body">Save synthesized insights and cross-references here. These are the notes that compound over time.</div>
              <button type="button" className="btn btn-primary mv-cta tap" onClick={() => setShowNew(true)}>Add First Note →</button>
            </div>
          )}

          <div className="mv-notes">
            {filtered.map(note => (
              <Card key={note.id} color={note.color} onClick={() => setActiveNote(note.id)} style={{ padding: '16px' }}>
                <div className="mv-note-top">
                  <div className="mv-dot" style={{ '--nc': note.color }} />
                  <div className="mv-note-date">{new Date(note.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="mv-note-title">{note.title}</div>
                <div className="mv-note-body">
                  {note.content}
                </div>
                {note.connections?.length > 0 && (
                  <div className="mv-note-conn"><Icon name="BookMarked" size={13} /> {note.connections.slice(0, 2).join(' · ')}{note.connections.length > 2 ? ` +${note.connections.length - 2}` : ''}</div>
                )}
                {note.tags?.length > 0 && (
                  <div className="mv-note-tags">
                    {note.tags.slice(0, 3).map(t => <span key={t} className="mv-note-tag">{t}</span>)}
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
            <input className="mv-input mv-input-title" aria-label="Note title" value={newNote.title} onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))} placeholder="Note title..." />
            <textarea className="mv-input mv-textarea mv-textarea-note" aria-label="Note content" value={newNote.content} onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))} placeholder="Your insight, synthesis, or breakthrough..." rows={5} />
            <Label>Tags</Label>
            <div className="mv-chips mv-gap-sm">
              {newNote.tags.map(t => (
                <button type="button" key={t} className="mv-tag tap" aria-label={`Remove tag ${t}`} onClick={() => setNewNote(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}>
                  {t} <Icon name="X" size={12} />
                </button>
              ))}
            </div>
            <div className="mv-tag-row">
              <input className="mv-input mv-input-tag" aria-label="Add tag" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tagInput.trim() && (setNewNote(p => ({ ...p, tags: [...new Set([...p.tags, tagInput.trim()])] })), setTagInput(''))}
                placeholder="Add tag, press Enter..." />
            </div>
            <Label>Connect to Topics</Label>
            <div className="mv-chips mv-topics">
              {topics.slice(0, 10).map(t => (
                <button type="button" key={t} className="mv-topic tap" aria-pressed={newNote.connections.includes(t)}
                  onClick={() => setNewNote(p => ({ ...p, connections: p.connections.includes(t) ? p.connections.filter(x => x !== t) : [...p.connections, t] }))}>
                  {t}
                </button>
              ))}
            </div>
            <Label>Color</Label>
            <div className="mv-swatches">
              {NOTE_COLORS.map((c, i) => (
                <button type="button" key={i} className="mv-swatch tap" aria-label={`Colour ${i + 1}`} aria-pressed={newNote.color === c}
                  style={{ '--sw': c }} onClick={() => setNewNote(p => ({ ...p, color: c }))} />
              ))}
            </div>
            <div className="mv-modal-actions">
              <button type="button" className="btn mv-cancel" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="button" className="btn btn-primary mv-save" onClick={createNote}>Save to Vault →</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
