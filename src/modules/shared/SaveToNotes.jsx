import { useState } from 'react';
import { useApp } from '../../App.jsx';
import { writeThrough } from '../../lib/storage.js';
import { NOTES_KEY } from '../../constants.js';
import { uid } from '../../utils.js';
import { logConcept } from '../../lib/graph.js';
import Icon from './Icon.jsx';
import './save-to-notes.css';

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
      color: 'var(--accent-text)',
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
    <button type="button" className="stn tap" data-state={state} aria-pressed={on} onClick={save}
      title="Save to Notes with its source and tier" style={style}>
      <Icon name={on ? 'Check' : 'StickyNote'} size={13} /> {state === 'error' ? 'Try again' : on ? 'Saved' : label}
    </button>
  );
}
