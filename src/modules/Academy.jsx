import { useState } from 'react';
import { readLocal, writeThrough } from '../lib/storage.js';
import FieldManual from './academy/FieldManual.jsx';
import Icon from './shared/Icon.jsx';
import './academy.css';

// Academy is a thin shell: a mode picker + a router. It owns mode selection,
// mode persistence, and the header — no learning logic whatsoever. Each mode is
// a self-contained component. Adding a mode later (Phase 2) is one import + one
// MODES entry; nothing else in this file changes.
const MODE_KEY = 'aether_academy_mode';

const MODES = [
  {
    id: 'manual',
    icon: 'BookMarked',
    label: 'Field Manual',
    desc: 'Authored content packs — tiered, confirm-gated, field-ready',
    component: FieldManual,
  },
  // Phase 2 adds entries here. Nothing else changes.
];

export default function Academy() {
  const [mode, setMode] = useState(() => {
    const saved = readLocal(MODE_KEY, MODES[0].id);
    return MODES.some((m) => m.id === saved) ? saved : MODES[0].id;
  });

  const active = MODES.find((m) => m.id === mode) || MODES[0];
  const Active = active.component;
  const selectMode = (id) => { setMode(id); writeThrough(MODE_KEY, id); };

  return (
    <div>
      {/* Shell header + mode picker (styled like BookClub's tab bar) */}
      <div className="ac-head">
        <div className="ac-eyebrow">Learning</div>
        <div className="ac-title">Academy</div>

        <div className="ac-modes">
          {MODES.map((m) => (
            <button type="button" key={m.id} className="ac-mode tap" aria-pressed={m.id === mode}
              onClick={() => selectMode(m.id)} title={m.desc}>
              <Icon name={m.icon} size={16} /> {m.label}
            </button>
          ))}
        </div>
        <div className="ac-desc">{active.desc}</div>
      </div>

      <div className="ac-body">
        <Active />
      </div>
    </div>
  );
}
