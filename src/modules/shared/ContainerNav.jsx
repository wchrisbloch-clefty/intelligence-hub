import { useState } from 'react';
import { useApp } from '../../App.jsx';
import { CONTAINERS, BOTTOM_NAV_IDS, MODE_META, containerOfMode } from '../../constants.js';
import { BottomSheet } from './Common.jsx';
import NavIcon from './NavIcon.jsx';
import { MoreHorizontal } from 'lucide-react';
import './container-nav.css';

// The container nav in three surfaces:
//   SideNav    — vertical container rail, iPad + desktop (≥721)
//   ModeChips  — horizontal, scrollable row of a container's modes, under the header
//   BottomNav  — five-slot mobile bar (Home, Learn, Skills, Research, More)
// All three read `activeModule` and drive `openContainer` / `setActiveModule`
// from context. A container is "active" when it owns the current mode.
// Styles: container-nav.css (cn-). Active state = accent bar + --accent-text
// (navy --accent is a FILL colour; as text it fails contrast in dark).

function modeLabel(id) { return MODE_META[id]?.label || id; }

// ── Desktop / iPad: vertical container rail ─────────────────────────────────
export function SideNav() {
  const { activeModule, openContainer } = useApp();
  const current = containerOfMode(activeModule);
  return (
    <nav className="cn-side" aria-label="Containers">
      {CONTAINERS.map((c) => {
        const on = c.id === current;
        return (
          <button type="button" key={c.id} className="cn-side-item" aria-current={on ? 'page' : undefined}
            onClick={() => openContainer(c.id)} title={c.verb}>
            <NavIcon id={c.id} size={18} strokeWidth={on ? 2.2 : 1.8} />
            <span className="cn-side-text">
              <span className="cn-side-label">{c.label}</span>
              <span className="cn-side-verb">{c.verb}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Under-header mode chips ─────────────────────────────────────────────────
export function ModeChips() {
  const { activeModule, setActiveModule } = useApp();
  const container = CONTAINERS.find((c) => c.id === containerOfMode(activeModule));
  if (!container || container.modes.length < 2) return null;   // single-mode → no chip row
  return (
    <div className="cn-chips-bar">
      <div className="cn-chips" role="tablist" aria-label={`${container.label} modes`}>
        {container.modes.map((id) => {
          const on = id === activeModule;
          return (
            <button type="button" key={id} role="tab" aria-selected={on} className="cn-chip"
              onClick={() => setActiveModule(id)} title={MODE_META[id]?.desc || ''}>
              <NavIcon id={id} size={14} strokeWidth={on ? 2.2 : 1.8} /> {modeLabel(id)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mobile bottom bar: 5 slots ──────────────────────────────────────────────
function Slot({ id, label, active, onClick }) {
  return (
    <button type="button" className="cn-slot" aria-current={active ? 'page' : undefined} onClick={onClick}>
      {id === '__more__'
        ? <MoreHorizontal size={20} strokeWidth={active ? 2.4 : 1.9} />
        : <NavIcon id={id} size={20} strokeWidth={active ? 2.4 : 1.9} />}
      <span className="cn-slot-label">{label}</span>
    </button>
  );
}

export function BottomNav() {
  const { activeModule, openContainer } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = containerOfMode(activeModule);
  const primary = BOTTOM_NAV_IDS.map((id) => CONTAINERS.find((c) => c.id === id));
  // "More" is active when the current container isn't one of the five primaries.
  const moreActive = !BOTTOM_NAV_IDS.includes(current);
  return (
    <>
      <nav className="cn-bottom" aria-label="Primary">
        {primary.map((c) => (
          <Slot key={c.id} id={c.id} label={c.label} active={c.id === current && !moreActive} onClick={() => openContainer(c.id)} />
        ))}
        <Slot id="__more__" label="More" active={moreActive} onClick={() => setMoreOpen(true)} />
      </nav>
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}

// ── "More" sheet — every container + every mode, so nothing is unreachable ──
function MoreSheet({ onClose }) {
  const { activeModule, setActiveModule } = useApp();
  const go = (id) => { setActiveModule(id); onClose(); };
  return (
    <BottomSheet title="All modules" onClose={onClose}>
      <div className="cn-more">
        {CONTAINERS.map((c) => (
          <div key={c.id}>
            <div className="cn-more-head">
              <NavIcon id={c.id} size={15} strokeWidth={2} />
              <span className="cn-more-label">{c.label}</span>
              <span className="cn-side-verb">{c.verb}</span>
            </div>
            <div className="cn-more-grid">
              {c.modes.map((id) => {
                const on = id === activeModule;
                return (
                  <button type="button" key={id} className="cn-more-item" aria-current={on ? 'page' : undefined} onClick={() => go(id)}>
                    <NavIcon id={id} size={16} strokeWidth={on ? 2.2 : 1.8} />
                    <span className="cn-more-name">{modeLabel(id)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
