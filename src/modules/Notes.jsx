import { useState } from 'react';
import { useApp } from '../App.jsx';
import { uid } from '../utils.js';
import { NOTES_KEY } from '../constants.js';
import { writeThrough } from '../lib/storage.js';
import { logConcept } from '../lib/graph.js';
import { createCard } from '../lib/reviews.js';
import Icon from './shared/Icon.jsx';
import AskChip from './shared/AskChip.jsx';
import './notes.css';

// Notes — a first-class mode in Research. Stored on aether_notes_v1. Every note
// keeps its provenance (source url / title / tier) so a saved thought keeps its
// grading. Notes emit logConcept (so they show in Connected Knowledge) and can
// be promoted to a flashcard. Full-text search is client-side.
const TIERS = ['verified', 'reported', 'inferred', 'uncited'];

export default function Notes() {
  const { notes, setNotes } = useApp();
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', content: '', sourceUrl: '', sourceTitle: '', tier: 'reported' });

  // Optimistic + honest (mirrors BookClub's persist): apply, await, revert on a
  // failed on-device write. Server-only failures surface on the global chip.
  const save = async (next) => {
    const prev = notes;
    setNotes(next);
    const r = await writeThrough(NOTES_KEY, next);
    if (!r.localOk) { setNotes(prev); setErr('Couldn’t save your note — on-device storage is full or blocked.'); return false; }
    setErr('');
    return true;
  };

  const create = async () => {
    if (!form.title.trim() && !form.content.trim()) return;
    const note = {
      id: uid(),
      title: form.title.trim() || form.content.trim().slice(0, 55),
      content: form.content.trim(),
      tags: [],
      color: 'var(--accent-text)',
      createdAt: Date.now(),
      source: (form.sourceUrl || form.sourceTitle) ? { url: form.sourceUrl.trim(), title: form.sourceTitle.trim(), tier: form.tier } : null,
    };
    await save([note, ...(notes || [])]);
    logConcept({ topic: note.title, source: note.source?.title || note.title, module: 'notes', refs: note.source?.url ? [note.source.url] : [] });
    setForm({ title: '', content: '', sourceUrl: '', sourceTitle: '', tier: 'reported' });
    setComposing(false);
  };

  const remove = (id) => save((notes || []).filter((n) => n.id !== id));
  const toFlashcard = (n) => createCard({ front: n.title, back: (n.content || n.title).slice(0, 400), source: n.source?.title || 'note', module: 'notes', topic: n.title });

  const query = q.trim().toLowerCase();
  const filtered = (notes || []).filter((n) => !query || `${n.title} ${n.content} ${(n.tags || []).join(' ')}`.toLowerCase().includes(query));

  return (
    <div className="nt">
      <div className="nt-head">
        <div>
          <div className="nt-eyebrow">Investigate</div>
          <div className="nt-title">Notes</div>
        </div>
        <button type="button" className="btn btn-primary tap nt-new" aria-expanded={composing} onClick={() => setComposing((c) => !c)}>
          <Icon name="Plus" size={15} /> New note
        </button>
      </div>

      {err && (
        <div className="nt-err" role="alert"><Icon name="AlertTriangle" size={14} /> {err}</div>
      )}

      {/* Search */}
      <label className="nt-search">
        <Icon name="Search" size={16} aria-hidden="true" />
        <input className="nt-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" aria-label="Search notes" />
      </label>

      {/* Composer */}
      {composing && (
        <div className="nt-compose">
          <input className="nt-field" data-kind="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" aria-label="Title" />
          <textarea className="nt-field" data-kind="body" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Your thought…" rows={4} aria-label="Note" />
          <div className="nt-src-row">
            <input className="nt-field" value={form.sourceTitle} onChange={(e) => setForm((f) => ({ ...f, sourceTitle: e.target.value }))} placeholder="Source (optional)" aria-label="Source" />
            <input className="nt-field" value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} placeholder="Source URL" aria-label="Source URL" />
            <select className="nt-field" value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} aria-label="Source tier">
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="nt-compose-actions">
            <button type="button" className="btn tap nt-cancel" onClick={() => setComposing(false)}>Cancel</button>
            <button type="button" className="btn btn-primary tap" onClick={create}>Save note</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="nt-empty">
          {query ? 'No notes match that search.' : 'No notes yet. Capture a thought — it keeps its source and grading, and connects into your graph.'}
        </div>
      ) : (
        <div className="nt-grid">
          {filtered.map((n) => (
            <div key={n.id} className="nt-card">
              <div className="nt-card-top">
                <div className="nt-card-title">{n.title}</div>
                <button type="button" className="nt-x tap" onClick={() => remove(n.id)} aria-label={`Delete note ${n.title}`}><Icon name="X" size={15} /></button>
              </div>
              {n.content && <div className="nt-body">{n.content}</div>}
              {n.source && (n.source.title || n.source.url) && (
                <div className="nt-src">
                  <span className="nt-tier" data-tier={TIERS.includes(n.source.tier) ? n.source.tier : 'uncited'}>{n.source.tier || 'uncited'}</span>
                  {n.source.url
                    ? <a className="nt-src-link tap" href={n.source.url} target="_blank" rel="noopener noreferrer">{n.source.title || n.source.url}</a>
                    : <span className="nt-src-text">{n.source.title}</span>}
                </div>
              )}
              <div className="nt-acts">
                <AskChip type="note" object={n} />
                <button type="button" className="nt-act tap" onClick={() => toFlashcard(n)}>
                  <Icon name="Layers" size={13} /> Flashcard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
