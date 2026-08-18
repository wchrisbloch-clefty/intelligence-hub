import { useState } from 'react';
import { useApp } from '../App.jsx';
import { saveNotes, uid } from '../utils.js';
import { logConcept } from '../lib/graph.js';
import { createCard } from '../lib/reviews.js';
import Icon from './shared/Icon.jsx';
import AskChip from './shared/AskChip.jsx';

// Notes — a first-class mode in Research. Stored on aether_notes_v1. Every note
// keeps its provenance (source url / title / tier) so a saved thought keeps its
// grading. Notes emit logConcept (so they show in Connected Knowledge) and can
// be promoted to a flashcard. Full-text search is client-side.
const TIERS = ['verified', 'reported', 'inferred', 'uncited'];

export default function Notes() {
  const { notes, setNotes, isMobile, isPhone } = useApp();
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', sourceUrl: '', sourceTitle: '', tier: 'reported' });
  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';

  const save = async (next) => { setNotes(next); await saveNotes(next); };

  const create = async () => {
    if (!form.title.trim() && !form.content.trim()) return;
    const note = {
      id: uid(),
      title: form.title.trim() || form.content.trim().slice(0, 55),
      content: form.content.trim(),
      tags: [],
      color: 'var(--accent)',
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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: `20px ${pad} 80px` }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Investigate</div>
          <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>Notes</div>
        </div>
        <button onClick={() => setComposing((c) => !c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
          <Icon name="Plus" size={15} /> New note
        </button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 10, padding: '9px 13px', marginBottom: 16 }}>
        <Icon name="Search" size={16} style={{ color: 'var(--text-tertiary)' }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 'var(--fs-base)', fontFamily: 'inherit' }} />
      </div>

      {/* Composer */}
      {composing && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title"
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }} />
          <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Your thought…" rows={4}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--fs-base)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 'var(--lh-read)', boxSizing: 'border-box', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={form.sourceTitle} onChange={(e) => setForm((f) => ({ ...f, sourceTitle: e.target.value }))} placeholder="Source (optional)"
              style={{ flex: 1, minWidth: 140, background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 11px', color: 'var(--text)', fontSize: 'var(--fs-sm)', outline: 'none', fontFamily: 'inherit' }} />
            <input value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} placeholder="Source URL"
              style={{ flex: 1, minWidth: 140, background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 11px', color: 'var(--text)', fontSize: 'var(--fs-sm)', outline: 'none', fontFamily: 'inherit' }} />
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
              style={{ background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 11px', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setComposing(false)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--rule)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={create} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save note</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--rule)', borderRadius: 12, fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)' }}>
          {query ? 'No notes match that search.' : 'No notes yet. Capture a thought — it keeps its source and grading, and connects into your graph.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--s3)' }}>
          {filtered.map((n) => (
            <div key={n.id} style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12, padding: 'var(--s5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', lineHeight: 'var(--lh-tight)' }}>{n.title}</div>
                <button onClick={() => remove(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}><Icon name="X" size={15} /></button>
              </div>
              {n.content && <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)', marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.content}</div>}
              {n.source && (n.source.title || n.source.url) && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: `var(--tier-${n.source.tier || 'uncited'})`, border: `1px solid color-mix(in srgb, var(--tier-${n.source.tier || 'uncited'}) 40%, transparent)`, padding: '1px 6px', borderRadius: 3 }}>{n.source.tier || 'uncited'}</span>
                  {n.source.url
                    ? <a href={n.source.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', textDecoration: 'none' }}>{n.source.title || n.source.url}</a>
                    : <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{n.source.title}</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AskChip type="note" object={n} />
                <button onClick={() => toFlashcard(n)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
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
