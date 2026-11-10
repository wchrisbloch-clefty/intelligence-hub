import { useState } from 'react';
import { readLocal, writeThrough } from '../lib/storage.js';
import CaptureBar from './shared/CaptureBar.jsx';
import Icon from './shared/Icon.jsx';
import { SECTIONS, sectionById } from './home/sections.js';
import './home/home.css';

// HomeDashboard is a renderer over the section registry (src/modules/home).
// Nothing is inline, so every section can be reordered, hidden, and collapsed.
// Layout is persisted to aether_home_layout through the storage-honesty
// contract (awaited writeThrough; failures surface on the global sync chip).
export const LAYOUT_KEY = 'aether_home_layout';

const defaultLayout = () => ({ order: SECTIONS.map((s) => s.id), hidden: [], collapsed: [] });

export function loadLayout() {
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
    <section className="hm-sec" data-section={section.id}>
      <div className="hm-sec-head">
        <Icon name={section.icon} size="header" />
        <button type="button" className="hm-sec-toggle tap" aria-expanded={!collapsed}
          aria-disabled={editing ? 'true' : undefined} onClick={editing ? undefined : onCollapse}>
          <span className="hm-eyebrow">{section.label}</span>
          {!editing && <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} />}
        </button>
        {editing && (
          <div className="hm-sec-tools">
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
    <button type="button" className="hm-iconbtn tap" onClick={disabled ? undefined : onClick}
      title={title} aria-label={title} disabled={disabled}>
      <Icon name={name} size={15} />
    </button>
  );
}

export default function HomeDashboard() {
  const [layout, setLayout] = useState(loadLayout);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  // Optimistic, but honest: apply locally, await the write, and if the on-device
  // write didn't land (quota/blocked) revert and show it. Mirrors BookClub's
  // persist(); server-only failures keep the local write and surface on the
  // global sync chip per the storage-honesty contract.
  const save = async (next) => {
    const prev = layout;
    setLayout(next);
    const r = await writeThrough(LAYOUT_KEY, next);
    if (!r.localOk) { setLayout(prev); setErr('Couldn’t save your layout — on-device storage is full or blocked.'); }
    else setErr('');
  };
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
    <div className="hm">
      {/* Greeting (streak/time chips live in the header) */}
      <div className="hm-head">
        <div>
          <div className="hm-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="hm-greet">{greeting}, CB.</div>
        </div>
        <button type="button" className="btn tap" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
          <Icon name={editing ? 'Check' : 'Settings2'} size={15} /> {editing ? 'Done' : 'Customize'}
        </button>
      </div>

      {err && <div className="hm-err" role="alert">{err}</div>}

      {/* Capture — the fixed front door, never in the reorderable body */}
      <div className="hm-capture"><CaptureBar /></div>

      {/* Customize tray: hidden sections + reset */}
      {editing && (
        <div className="hm-tray">
          <div className="hm-eyebrow">Customize Home</div>
          {hidden.length > 0 && (
            <div className="hm-tray-hidden">
              {hidden.map((s) => (
                <button type="button" key={s.id} className="chip tap" onClick={() => show(s.id)}>
                  <Icon name="Plus" size={13} /> {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="hm-tray-foot">
            <span>Reorder with the arrows · tap a title to collapse.</span>
            <button type="button" className="hm-link tap" onClick={reset}>Reset</button>
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
