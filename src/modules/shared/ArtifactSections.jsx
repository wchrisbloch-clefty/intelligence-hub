// Long-artifact layout: renders a markdown body split on its `## ` headings with
// a section-navigation affordance sized to the viewport —
//   desktop / iPad : a sticky section-outline rail beside the content
//   mobile          : a sticky section-jump chip row + collapsible sections
// Short artifacts (0–1 headings) render as plain MD with no chrome. Content is
// rendered by the shared MD component, so tier chips + tables behave as everywhere.
import { useState } from 'react';
import MD from './MD.jsx';
import Icon from './Icon.jsx';
import './artifact-sections.css';

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

  // Section-title colour from the caller; the accent as text reads as --accent-text.
  const titleVars = color ? { '--c': color === 'var(--accent)' ? 'var(--accent-text)' : color } : undefined;
  const jump = (id) => { try { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} };

  // Right-rail outline (desktop + iPad).
  const rail = (
    <nav className="as-rail" aria-label="On this page">
      <div className="as-rail-kicker">On this page</div>
      {secs.map((s) => (
        <button type="button" key={s.id} className="as-rail-link tap" onClick={() => jump(s.id)}>
          {s.title}
        </button>
      ))}
    </nav>
  );

  // Sticky jump chips (mobile).
  const jumpBar = (
    <div className="as-jump" data-scroll-x="">
      {secs.map((s) => (
        <button type="button" key={s.id} className="as-chip" onClick={() => jump(s.id)}>
          {s.title}
        </button>
      ))}
    </div>
  );

  const body = (
    <div className="as-body">
      {pre.trim() && <MD text={pre} color={color} />}
      {secs.map((s) => {
        const isCol = isMobile && collapsed[s.id];
        return (
          <section key={s.id} id={s.id} className="as-sec" data-mobile={isMobile ? '' : undefined}>
            {isMobile ? (
              <>
                <button type="button" className="as-toggle" aria-expanded={!isCol} onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}
                  style={titleVars}>
                  <span className="as-toggle-title">{s.title}</span>
                  <Icon name={isCol ? 'ChevronDown' : 'ChevronUp'} size={16} className="as-toggle-icon" />
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
    return <div className="as-split">{body}{rail}</div>;
  }
  return <div>{jumpBar}{body}</div>;
}
