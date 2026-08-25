// Long-artifact layout: renders a markdown body split on its `## ` headings with
// a section-navigation affordance sized to the viewport —
//   desktop / iPad : a sticky section-outline rail beside the content
//   mobile          : a sticky section-jump chip row + collapsible sections
// Short artifacts (0–1 headings) render as plain MD with no chrome. Content is
// rendered by the shared MD component, so tier chips + tables behave as everywhere.
import { useState } from 'react';
import MD from './MD.jsx';
import Icon from './Icon.jsx';

const slug = (s) => String(s).toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const cleanTitle = (s) => String(s).replace(/\[[^\]]*\]/g, '').replace(/[*_`#]/g, '').trim();

function parse(text) {
  const lines = String(text || '').split('\n');
  const secs = [];
  let cur = null;
  const pre = [];
  for (const l of lines) {
    const m = l.match(/^##\s+(.+)$/);
    if (m) { if (cur) secs.push(cur); cur = { title: cleanTitle(m[1]), id: `sec-${secs.length}-${slug(m[1])}`, lines: [l] }; }
    else if (cur) cur.lines.push(l);
    else pre.push(l);
  }
  if (cur) secs.push(cur);
  return { pre: pre.join('\n'), secs: secs.map((s) => ({ ...s, body: s.lines.join('\n') })) };
}

export default function ArtifactSections({ text, color, isMobile = false, isDesktop = false }) {
  const { pre, secs } = parse(text);
  const [collapsed, setCollapsed] = useState({});
  if (secs.length < 2) return <MD text={text} color={color} />;

  const jump = (id) => { try { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} };

  // Right-rail outline (desktop + iPad).
  const rail = (
    <nav style={{ position: 'sticky', top: 12, flexShrink: 0, width: 190, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 8 }}>On this page</div>
      {secs.map((s) => (
        <button key={s.id} onClick={() => jump(s.id)}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderLeft: '2px solid var(--rule)', padding: '5px 10px', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 'var(--lh-tight)' }}>
          {s.title}
        </button>
      ))}
    </nav>
  );

  // Sticky jump chips (mobile).
  const jumpBar = (
    <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 0', marginBottom: 8, background: 'var(--surface)', borderBottom: '1px solid var(--rule)', WebkitOverflowScrolling: 'touch' }}>
      {secs.map((s) => (
        <button key={s.id} onClick={() => jump(s.id)}
          style={{ flexShrink: 0, padding: '5px 11px', borderRadius: 16, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {s.title}
        </button>
      ))}
    </div>
  );

  const body = (
    <div style={{ minWidth: 0, flex: 1 }}>
      {pre.trim() && <MD text={pre} color={color} />}
      {secs.map((s) => {
        const isCol = isMobile && collapsed[s.id];
        return (
          <section key={s.id} id={s.id} style={{ scrollMarginTop: isMobile ? 60 : 12 }}>
            {isMobile ? (
              <>
                <button onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', borderTop: '1px solid var(--rule)', padding: '12px 0 6px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color }}>{s.title}</span>
                  <Icon name={isCol ? 'ChevronDown' : 'ChevronUp'} size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </button>
                {!isCol && <MD text={s.body.replace(/^##\s+.+$/m, '').trim()} color={color} />}
              </>
            ) : (
              <MD text={s.body} color={color} />
            )}
          </section>
        );
      })}
    </div>
  );

  if (!isMobile) {
    // desktop + iPad: content + sticky outline rail
    return <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>{body}{rail}</div>;
  }
  return <div>{jumpBar}{body}</div>;
}
