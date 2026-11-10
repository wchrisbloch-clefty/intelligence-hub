// src/modules/home/MobileHome.jsx — the phone Home surface (Batch Z / Order C).
// Rendered ONLY when isMobile && Home (one line in App.jsx). iPad and desktop keep
// HomeDashboard untouched.
//
// Pattern from mynewshub2: one scannable column. The first two sections in the
// user's saved order (aether_home_layout) render eagerly; the rest mount lazily
// via IntersectionObserver at rootMargin 600px, each holding a reserved-height
// SectionSkeleton until then, so nothing shifts when it swaps in.
//
// Layout editing (reorder/hide) stays on the iPad/desktop Customize tray; this
// surface honours the saved order, hidden set and collapsed set.
import { useEffect, useRef, useState } from 'react';
import { writeThrough } from '../../lib/storage.js';
import CaptureBar from '../shared/CaptureBar.jsx';
import Icon from '../shared/Icon.jsx';
import { SectionSkeleton } from '../shared/SectionState.jsx';
import { sectionById } from './sections.js';
import { loadLayout, LAYOUT_KEY } from '../HomeDashboard.jsx';
import './home.css';

const EAGER = 2;
const RESERVE_ROWS = { brief: 3, opportunity: 4, connected: 3, skills: 3, projects: 3, signals: 3 };

function LazySection({ section, eager, collapsed, onCollapse }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(eager);
  useEffect(() => {
    if (mounted) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setMounted(true); return undefined; }
    // The app scrolls inside .fr-main, not the window — observe against it, or
    // the 600px look-ahead is clipped away by the scroll container.
    const root = el.closest('.fr-main') || null;
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { setMounted(true); io.disconnect(); }
    }, { root, rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  const Body = section.component;
  return (
    <section ref={ref} className="hm-sec" data-section={section.id} data-mounted={mounted ? '1' : '0'}>
      <div className="hm-sec-head">
        <Icon name={section.icon} size="header" />
        <button type="button" className="hm-sec-toggle tap" aria-expanded={!collapsed} onClick={onCollapse}>
          <span className="hm-eyebrow">{section.label}</span>
          <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={14} />
        </button>
      </div>
      {!collapsed && (mounted ? <Body /> : <SectionSkeleton rows={RESERVE_ROWS[section.id] || 3} label={section.label} />)}
    </section>
  );
}

export default function MobileHome() {
  const [layout, setLayout] = useState(loadLayout);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const toggleCollapse = async (id) => {
    const prev = layout;
    const next = { ...layout, collapsed: layout.collapsed.includes(id) ? layout.collapsed.filter((x) => x !== id) : [...layout.collapsed, id] };
    setLayout(next);
    const r = await writeThrough(LAYOUT_KEY, next);
    if (!r.localOk) setLayout(prev);
  };

  const visible = layout.order.map(sectionById).filter((s) => s && !layout.hidden.includes(s.id));

  return (
    <div className="hm hm-mobile" data-surface="mobile-home">
      <div className="hm-head">
        <div>
          <div className="hm-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div className="hm-greet">{greeting}, CB.</div>
        </div>
      </div>
      <div className="hm-capture"><CaptureBar /></div>
      {visible.map((s, i) => (
        <LazySection key={s.id} section={s} eager={i < EAGER}
          collapsed={layout.collapsed.includes(s.id)} onCollapse={() => toggleCollapse(s.id)} />
      ))}
    </div>
  );
}
