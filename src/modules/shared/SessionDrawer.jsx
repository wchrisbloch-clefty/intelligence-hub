import { useState, useEffect } from 'react';
import { timeAgo } from '../../utils.js';
import { loadIndex, hydrateIndex, loadSession, hydrateSession, removeSession, renameSession } from '../../lib/sessions.js';

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

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'var(--bg-nav)', zIndex: 60,
      display: 'flex', flexDirection: 'column', animation: 'fadeUp 0.15s ease',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bord2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif" }}>Saved Sessions</div>
        <div onClick={onClose} style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)', cursor: 'pointer', padding: '2px 6px' }}>✕</div>
      </div>

      <div style={{ padding: '10px 12px', flexShrink: 0 }}>
        <div onClick={() => { onNew(); onClose(); }}
          style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${color}`, color, background: 'var(--accent-glow)', cursor: 'pointer', fontSize: 'var(--fs-base)', fontWeight: 700, textAlign: 'center' }}>
          ＋ New session
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 14px' }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 12px', color: 'var(--dim)', fontSize: 'var(--fs-base)', lineHeight: 1.7 }}>
            No saved sessions yet.<br />Your conversations will appear here.
          </div>
        )}
        {items.map(s => {
          const active = s.id === activeId;
          return (
            <div key={s.id} onClick={() => editingId !== s.id && resume(s.id)}
              style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 9, cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? 'var(--accent-glow)' : 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === s.id ? (
                  <input autoFocus value={editValue} onClick={e => e.stopPropagation()}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditing(null); }}
                    onBlur={() => commitRename(s.id)}
                    style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${color}`, borderRadius: 6, padding: '4px 7px', fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                ) : (
                  <>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: active ? color : 'var(--text-b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>{timeAgo(s.updatedAt)}</div>
                  </>
                )}
              </div>
              {editingId !== s.id && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <span onClick={e => startRename(s, e)} title="Rename" style={{ fontSize: 'var(--fs-base)', color: 'var(--subtle)', cursor: 'pointer', padding: '2px 4px' }}>✎</span>
                  <span onClick={e => del(s.id, e)} title="Delete" style={{ fontSize: 'var(--fs-base)', color: 'var(--red)', cursor: 'pointer', padding: '2px 4px' }}>🗑</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
