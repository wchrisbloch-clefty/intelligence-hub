import { useState } from 'react';
import { useApp } from '../App.jsx';
import { readLocal, writeThrough } from '../lib/storage.js';
import CaptureBar from './shared/CaptureBar.jsx';
import Icon from './shared/Icon.jsx';
import { SECTIONS, sectionById } from './home/sections.js';

// HomeDashboard is a renderer over the section registry (src/modules/home).
// Nothing is inline, so every section can be reordered, hidden, and collapsed.
// Layout is persisted to aether_home_layout through the storage-honesty
// contract (awaited writeThrough; failures surface on the global sync chip).
const LAYOUT_KEY = 'aether_home_layout';

const defaultLayout = () => ({ order: SECTIONS.map((s) => s.id), hidden: [], collapsed: [] });

function loadLayout() {
  const raw = readLocal(LAYOUT_KEY, null);
  if (!raw || !Array.isArray(raw.order)) return defaultLayout();
  // Merge so sections added in later releases still appear (appended, visible).
  const known = SECTIONS.map((s) => s.id);
  const order = [...raw.order.filter((id) => sectionById(id)), ...known.filter((id) => !raw.order.includes(id))];
  return { order, hidden: (raw.hidden || []).filter(sectionById), collapsed: (raw.collapsed || []).filter(sectionById) };
}

function SectionShell({ section, collapsed, editing, first, last, onCollapse, onUp, onDown, onHide }) {
  const Body = section.component;
  return (
    <section style={{ marginBottom: 'var(--s5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon name={section.icon} size="header" style={{ color: 'var(--text-tertiary)' }} />
        <button onClick={editing ? undefined : onCollapse}
          style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: editing ? 'default' : 'pointer', fontFamily: 'inherit', padding: 0, outline: 'none' }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' }}>{section.label}</span>
          {!editing && <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} style={{ color: 'var(--text-tertiary)' }} />}
        </button>
        {editing && (
          <div style={{ display: 'flex', gap: 4 }}>
            <IconBtn name="ArrowUp"   disabled={first} onClick={onUp} title="Move up" />
            <IconBtn name="ArrowDown" disabled={last}  onClick={onDown} title="Move down" />
            <IconBtn name="EyeOff"    onClick={onHide} title="Hide" />
          </div>
        )}
      </div>
      {!collapsed && <Body />}
    </section>
  );
}

function IconBtn({ name, onClick, disabled, title }) {
  return (
    <button onClick={disabled ? undefined : onClick} title={title} disabled={disabled}
      style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)', color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, outline: 'none' }}>
      <Icon name={name} size={15} />
    </button>
  );
}

export default function HomeDashboard() {
  const { isMobile, isPhone, isTablet } = useApp();
  const [layout, setLayout] = useState(loadLayout);
  const [editing, setEditing] = useState(false);

  const pad = isPhone ? '14px' : isMobile ? '16px' : isTablet ? '22px' : '28px';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const save = (next) => { setLayout(next); writeThrough(LAYOUT_KEY, next); };
  const toggleCollapse = (id) => save({ ...layout, collapsed: layout.collapsed.includes(id) ? layout.collapsed.filter((x) => x !== id) : [...layout.collapsed, id] });
  const hide = (id) => save({ ...layout, hidden: [...layout.hidden, id] });
  const show = (id) => save({ ...layout, hidden: layout.hidden.filter((x) => x !== id) });
  const move = (id, dir) => {
    const order = [...layout.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    save({ ...layout, order });
  };
  const reset = () => save(defaultLayout());

  const visible = layout.order.map(sectionById).filter((s) => s && !layout.hidden.includes(s.id));
  const hidden = layout.order.map(sectionById).filter((s) => s && layout.hidden.includes(s.id));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: `20px ${pad} 80px` }}>
      {/* Greeting (streak/time chips live in the header) */}
      <div style={{ marginBottom: isMobile ? 16 : 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>
            {greeting}, CB.
          </div>
        </div>
        <button onClick={() => setEditing((e) => !e)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '7px 13px', borderRadius: 8, border: `1px solid ${editing ? 'var(--accent)' : 'var(--rule)'}`, background: editing ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: editing ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', minHeight: 36 }}>
          <Icon name={editing ? 'Check' : 'Settings2'} size={15} /> {editing ? 'Done' : 'Customize'}
        </button>
      </div>

      {/* Capture — the fixed front door, never in the reorderable body */}
      <div style={{ marginBottom: 'var(--s5)' }}><CaptureBar /></div>

      {/* Customize tray: hidden sections + reset */}
      {editing && (
        <div style={{ marginBottom: 'var(--s5)', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Customize Home</div>
          {hidden.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {hidden.map((s) => (
                <button key={s.id} onClick={() => show(s.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 20, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Icon name="Plus" size={13} /> {s.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Reorder with the arrows · tap a title to collapse.</span>
            <button onClick={reset} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700, padding: 0 }}>Reset</button>
          </div>
        </div>
      )}

      {visible.map((s, i) => (
        <SectionShell key={s.id} section={s}
          collapsed={layout.collapsed.includes(s.id)} editing={editing}
          first={i === 0} last={i === visible.length - 1}
          onCollapse={() => toggleCollapse(s.id)}
          onUp={() => move(s.id, -1)} onDown={() => move(s.id, 1)} onHide={() => hide(s.id)} />
      ))}
    </div>
  );
}
