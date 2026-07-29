import { T, withAlpha } from '../theme';
import { useState } from 'react';
import { useApp } from '../App.jsx';
import { readLocal, writeThrough } from '../lib/storage.js';
import FieldManual from './academy/FieldManual.jsx';

// Academy is a thin shell: a mode picker + a router. It owns mode selection,
// mode persistence, and the header — no learning logic whatsoever. Each mode is
// a self-contained component. Adding a mode later (Phase 2) is one import + one
// MODES entry; nothing else in this file changes.
const MODE_KEY = 'aether_academy_mode';

const MODES = [
  {
    id: 'manual',
    icon: '📕',
    label: 'Field Manual',
    desc: 'Authored content packs — tiered, confirm-gated, field-ready',
    component: FieldManual,
  },
  // Phase 2 adds entries here. Nothing else changes.
];

export default function Academy() {
  const { isMobile, isPhone } = useApp();
  const [mode, setMode] = useState(() => {
    const saved = readLocal(MODE_KEY, MODES[0].id);
    return MODES.some((m) => m.id === saved) ? saved : MODES[0].id;
  });

  const active = MODES.find((m) => m.id === mode) || MODES[0];
  const Active = active.component;
  const selectMode = (id) => { setMode(id); writeThrough(MODE_KEY, id); };

  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';

  return (
    <div>
      {/* Shell header + mode picker (styled like BookClub's tab bar) */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: `20px ${pad} 0` }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: T.accent, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Learning</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5 }}>Academy</div>

        <div style={{ display: 'flex', gap: 8, margin: '16px 0 4px', borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap' }}>
          {MODES.map((m) => {
            const on = m.id === mode;
            return (
              <button key={m.id} onClick={() => selectMode(m.id)}
                title={m.desc}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${on ? T.accent : 'var(--border)'}`, background: on ? withAlpha(T.accent, 10) : 'transparent', color: on ? T.accent : 'var(--muted)', fontSize: 12, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', minHeight: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{m.icon}</span> {m.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 10 }}>{active.desc}</div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Active />
      </div>
    </div>
  );
}
