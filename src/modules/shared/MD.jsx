import { T } from '../../theme';
import './md.css';

// Lightweight, dependency-free markdown → styled DOM. Handles headers (with
// inline emphasis), bold/italic/code, blockquotes, bullet/number lists, rules,
// fenced code, GitHub-style tables, and study-guide tier tags
// (`[verified]` / `[reported: Book]` / `[inferred]`) rendered as colored chips.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tierChip = (tier, note) => {
  const label = tier === 'reported' && note ? `reported · ${esc(note.trim())}` : tier;
  return `<span class="md-tier" data-tier="${tier}">${label}</span>`;
};

// Inline markdown → HTML, run on already-escaped text so tags we emit survive.
function inline(raw) {
  let s = esc(raw);
  // tier tags first (before emphasis touches the brackets)
  s = s.replace(/\[(verified|inferred)\]/gi, (_, t) => tierChip(t.toLowerCase()));
  s = s.replace(/\[reported:?\s*([^\]]*)\]/gi, (_, note) => tierChip('reported', note));
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="md-strong">$1</strong>');
  s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em class="md-em">$2</em>');
  return s;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function MD({ text, color = 'var(--accent-text)' }) {
  // The accent as text must read as --accent-text (the fill navy fails in dark).
  const c = color === T.accent || color === 'var(--accent)' ? 'var(--accent-text)' : color;
  const lines = String(text || '').split('\n');
  const out = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line.trim())) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++; // closing fence
      out.push(
        <pre key={key++} className="md-pre">{buf.join('\n')}</pre>
      );
      continue;
    }

    // Table: a pipe row followed by a separator row
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(
        <div key={key++} className="md-table-wrap">
          <table className="md-table">
            <thead><tr>{head.map((h, j) => <th key={j} className="md-th" dangerouslySetInnerHTML={{ __html: inline(h) }} />)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, ci) => <td key={ci} className="md-td" dangerouslySetInnerHTML={{ __html: inline(r[ci] || '') }} />)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    i++;
    if (!line.trim()) { out.push(<div key={key++} className="md-gap" />); continue; }
    if (line.startsWith('# '))   { out.push(<div key={key++} className="md-h1" dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />); continue; }
    if (line.startsWith('## '))  { out.push(<div key={key++} className="md-h2" dangerouslySetInnerHTML={{ __html: inline(line.slice(3)) }} />); continue; }
    if (line.startsWith('### ')) { out.push(<div key={key++} className="md-h3" dangerouslySetInnerHTML={{ __html: inline(line.slice(4)) }} />); continue; }
    if (/^---+\s*$/.test(line))  { out.push(<div key={key++} className="md-hr" />); continue; }
    if (line.startsWith('> '))   { out.push(<div key={key++} className="md-quote" dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />); continue; }
    if (/^[-•→▸]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const content = line.replace(/^[-•→▸]\s/, '').replace(/^\d+\.\s/, '');
      out.push(
        <div key={key++} className="md-li">
          <span className="md-li-mark">▸</span>
          <span className="md-li-text" dangerouslySetInnerHTML={{ __html: inline(content) }} />
        </div>
      );
      continue;
    }
    out.push(<p key={key++} className="md-p" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
  }

  return <div className="md" style={{ '--c': c }}>{out}</div>;
}
