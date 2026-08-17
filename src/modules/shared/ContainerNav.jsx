import { T, withAlpha } from '../../theme';
import { useState } from 'react';
import { useApp } from '../../App.jsx';
import { CONTAINERS, BOTTOM_NAV_IDS, MODE_META, containerOfMode } from '../../constants.js';
import { BottomSheet } from './Common.jsx';
import NavIcon from './NavIcon.jsx';
import { MoreHorizontal } from 'lucide-react';

// The container nav in three surfaces:
//   SideNav    — vertical container rail, iPad + desktop (≥768)
//   ModeChips  — horizontal, scrollable row of a container's modes, under the header
//   BottomNav  — five-slot mobile bar (Home, Learn, Skills, Research, More)
// All three read `activeModule` and drive `openContainer` / `setActiveModule`
// from context. A container is "active" when it owns the current mode.

function modeLabel(id) { return MODE_META[id]?.label || id; }

// ── Desktop / iPad: vertical container rail ─────────────────────────────────
export function SideNav() {
  const { activeModule, openContainer, isDesktop } = useApp();
  const current = containerOfMode(activeModule);
  return (
    <nav style={{ width: isDesktop ? 240 : 210, flexShrink: 0, height: '100%', overflowY: 'auto', background: 'var(--bg-nav)', borderRight: '1px solid var(--border)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {CONTAINERS.map((c) => {
        const on = c.id === current;
        return (
          <button key={c.id} onClick={() => openContainer(c.id)} title={c.verb}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', outline: 'none', minHeight: 44, background: on ? withAlpha(T.accent, 10) : 'transparent', color: on ? T.accent : 'var(--muted)', transition: 'background 0.12s, color 0.12s' }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = 'var(--text-b)'; }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = 'var(--muted)'; }}>
            <NavIcon id={c.id} size={18} strokeWidth={on ? 2.2 : 1.8} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600, letterSpacing: 0.1 }}>{c.label}</span>
              <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, color: on ? withAlpha(T.accent, 65) : 'var(--dim)' }}>{c.verb}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Under-header mode chips (BookClub tab style) ────────────────────────────
export function ModeChips() {
  const { activeModule, setActiveModule, isMobile } = useApp();
  const container = CONTAINERS.find((c) => c.id === containerOfMode(activeModule));
  if (!container || container.modes.length < 2) return null;   // single-mode → no chip row
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid var(--bord2)', padding: isMobile ? '8px 12px' : '10px 20px' }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {container.modes.map((id) => {
          const on = id === activeModule;
          return (
            <button key={id} onClick={() => setActiveModule(id)} title={MODE_META[id]?.desc || ''}
              style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '7px 13px', borderRadius: 8, border: `1px solid ${on ? T.accent : 'var(--border)'}`, background: on ? withAlpha(T.accent, 10) : 'transparent', color: on ? T.accent : 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', minHeight: 36 }}>
              <NavIcon id={id} size={14} strokeWidth={on ? 2.2 : 1.8} /> {modeLabel(id)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mobile bottom bar: 5 slots ──────────────────────────────────────────────
export function BottomNav() {
  const { activeModule, openContainer } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = containerOfMode(activeModule);
  const primary = BOTTOM_NAV_IDS.map((id) => CONTAINERS.find((c) => c.id === id));
  // "More" is active when the current container isn't one of the five primaries.
  const moreActive = !BOTTOM_NAV_IDS.includes(current);

  const Slot = ({ id, label, active, onClick }) => (
    <button onClick={onClick}
      style={{ flex: 1, minWidth: 0, minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'transparent', color: active ? T.accent : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', outline: 'none', WebkitTapHighlightColor: 'transparent' }}>
      {id === '__more__'
        ? <MoreHorizontal size={20} strokeWidth={active ? 2.4 : 1.9} />
        : <NavIcon id={id} size={20} strokeWidth={active ? 2.4 : 1.9} />}
      <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>{label}</span>
    </button>
  );

  return (
    <>
      <nav style={{ flexShrink: 0, display: 'flex', background: 'var(--surface)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 30 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 8 }}>
        {CONTAINERS.map((c) => (
          <div key={c.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <NavIcon id={c.id} size={15} strokeWidth={2} />
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>{c.label}</span>
              <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, color: 'var(--dim)' }}>{c.verb}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {c.modes.map((id) => {
                const on = id === activeModule;
                return (
                  <button key={id} onClick={() => go(id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', minHeight: 44, borderRadius: 10, border: `1px solid ${on ? T.accent : 'var(--border)'}`, background: on ? withAlpha(T.accent, 10) : 'var(--surface)', color: on ? T.accent : 'var(--text-b)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', outline: 'none' }}>
                    <NavIcon id={id} size={16} strokeWidth={on ? 2.2 : 1.8} />
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{modeLabel(id)}</span>
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
