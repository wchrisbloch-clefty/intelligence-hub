import { useState, useEffect } from 'react';
import { timeAgo } from '../../utils.js';
import { loadIndex, hydrateIndex, loadSession, hydrateSession, removeSession, renameSession } from '../../lib/sessions.js';
import './session-drawer.css';

const ACCENTS = new Set(['var(--accent)', 'var(--accent-text)']);

// Saved-session list for a module: resume, rename, delete, and start a new one.
// `version` bumps whenever the parent saves, forcing a re-read of the index.
export default function SessionDrawer({ module, activeId, version = 0, onResume, onNew, onClose, color = 'var(--accent)' }) {
  const [items, setItems]       = useState(() => loadIndex(module));
  const [editingId, setEditing] = useState(null);
  const [editValue, setEditVal] = useState('');

  useEffect(() => { setItems(loadIndex(module)); }, [module, version]);
  useEffect(() => { hydrateIndex(module).then(r => { if (Array.isArray(r)) setItems(r); }); }, [module]);

  const resume = async (id) => {
    const local = loadSession(module, id);
    if (local) onResume(local);
    const remote = await hydrateSession(module, id);
    if (remote) onResume(remote);
  };

  const del = (id, e) => {
    e.stopPropagation();
    setItems(removeSession(module, id));
  };

  const startRename = (s, e) => { e.stopPropagation(); setEditing(s.id); setEditVal(s.title); };
  const commitRename = (id) => {
    const t = editValue.trim();
    if (t) setItems(renameSession(module, id, t));
    setEditing(null);
  };

  const isAcc = ACCENTS.has(color);
  const vars = { '--c': isAcc ? 'var(--accent)' : color, '--ct': isAcc ? 'var(--accent-text)' : color };

  return (
    <div className="sd" style={vars}>
      <div className="sd-head">
        <div className="sd-title">Saved Sessions</div>
        <button type="button" className="sd-icon-btn tap" onClick={onClose} aria-label="Close saved sessions">✕</button>
      </div>

      <div className="sd-new-wrap">
        <button type="button" className="sd-new" onClick={() => { onNew(); onClose(); }}>
          ＋ New session
        </button>
      </div>

      <div className="sd-list">
        {items.length === 0 && (
          <div className="sd-empty">
            No saved sessions yet.<br />Your conversations will appear here.
          </div>
        )}
        {items.map(s => {
          const active = s.id === activeId;
          const editing = editingId === s.id;
          return (
            <div key={s.id} className={`sd-item${editing ? '' : ' focus-ring'}`} aria-current={active ? 'true' : undefined}
              role={editing ? undefined : 'button'} tabIndex={editing ? undefined : 0}
              onClick={() => !editing && resume(s.id)}
              onKeyDown={e => { if (!editing && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); resume(s.id); } }}>
              <div className="sd-item-main">
                {editing ? (
                  <input autoFocus className="sd-rename" value={editValue} onClick={e => e.stopPropagation()}
                    aria-label="Session name"
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditing(null); }}
                    onBlur={() => commitRename(s.id)} />
                ) : (
                  <>
                    <div className="sd-item-title">{s.title}</div>
                    <div className="sd-item-meta">{timeAgo(s.updatedAt)}</div>
                  </>
                )}
              </div>
              {!editing && (
                <div className="sd-item-actions">
                  <button type="button" className="sd-icon-btn" onClick={e => startRename(s, e)} title="Rename" aria-label={`Rename ${s.title}`}>✎</button>
                  <button type="button" className="sd-icon-btn" data-danger="" onClick={e => del(s.id, e)} title="Delete" aria-label={`Delete ${s.title}`}>🗑</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
