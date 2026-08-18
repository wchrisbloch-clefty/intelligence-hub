import { useState } from 'react';
import { useApp } from '../../App.jsx';
import { writeThrough } from '../../lib/storage.js';
import { NOTES_KEY } from '../../constants.js';
import { uid } from '../../utils.js';
import { logConcept } from '../../lib/graph.js';
import Icon from './Icon.jsx';

// One-tap Save to Notes. Drop it wherever content is generated or surfaced —
// grounded answers, deep-dive passes, book insights, feed items. Every note
// carries provenance (source title/url/tier) and emits logConcept, so a saved
// thought keeps its grading and connects into the graph. Persists through the
// storage-honesty contract (awaited; reverts on a failed on-device write).
export default function SaveToNotes({ title, content, source = null, label = 'Save to Notes', style = {} }) {
  const { notes, setNotes } = useApp();
  const [state, setState] = useState('idle'); // idle | saved | error

  const save = async (e) => {
    e?.stopPropagation?.();
    if (state === 'saved') return;
    const t = String(title || content || '').trim().slice(0, 80);
    const note = {
      id: uid(),
      title: t || 'Note',
      content: String(content || '').trim(),
      tags: [],
      color: 'var(--accent)',
      createdAt: Date.now(),
      source: source && (source.url || source.title) ? { url: source.url || '', title: source.title || '', tier: source.tier || 'reported' } : null,
    };
    const prev = notes || [];
    const next = [note, ...prev];
    setNotes(next);
    const r = await writeThrough(NOTES_KEY, next);
    if (!r.localOk) { setNotes(prev); setState('error'); return; }
    logConcept({ topic: note.title, source: note.source?.title || note.title, module: 'notes', refs: note.source?.url ? [note.source.url] : [] });
    setState('saved');
  };

  const on = state === 'saved';
  return (
    <button onClick={save} title="Save to Notes with its source and tier"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`, background: on ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: state === 'error' ? 'var(--negative)' : on ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', ...style }}>
      <Icon name={on ? 'Check' : 'StickyNote'} size={13} /> {state === 'error' ? 'Try again' : on ? 'Saved' : label}
    </button>
  );
}
