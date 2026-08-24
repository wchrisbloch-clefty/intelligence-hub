import { T } from '../../theme';

// Lightweight, dependency-free markdown → styled DOM. Handles headers (with
// inline emphasis), bold/italic/code, blockquotes, bullet/number lists, rules,
// fenced code, GitHub-style tables, and study-guide tier tags
// (`[verified]` / `[reported: Book]` / `[inferred]`) rendered as colored chips.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tierChip = (tier, note) => {
  const tok = tier === 'verified' ? '--tier-verified' : tier === 'reported' ? '--tier-reported' : '--tier-inferred';
  const label = tier === 'reported' && note ? `reported · ${esc(note.trim())}` : tier;
  return `<span style="display:inline-flex;align-items:center;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(${tok});border:1px solid var(${tok});border-radius:5px;padding:0 5px;margin-left:6px;vertical-align:middle;white-space:nowrap">${label}</span>`;
};

// Inline markdown → HTML, run on already-escaped text so tags we emit survive.
function inline(raw) {
  let s = esc(raw);
  // tier tags first (before emphasis touches the brackets)
  s = s.replace(/\[(verified|inferred)\]/gi, (_, t) => tierChip(t.toLowerCase()));
  s = s.replace(/\[reported:?\s*([^\]]*)\]/gi, (_, note) => tierChip('reported', note));
  s = s.replace(/`([^`]+)`/g, '<code style="font-family:var(--font-mono);font-size:0.92em;background:var(--surf2);padding:1px 4px;border-radius:4px">$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>');
  s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em style="color:var(--muted)">$2</em>');
  return s;
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export default function MD({ text, color = T.accent }) {
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
        <pre key={key++} style={{ overflowX: 'auto', background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-c)', margin: '10px 0' }}>{buf.join('\n')}</pre>
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
        <div key={key++} style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, margin: '12px 0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--fs-sm)' }}>
            <thead><tr>{head.map((h, j) => <th key={j} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 700, background: 'var(--surf2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }} dangerouslySetInnerHTML={{ __html: inline(h) }} />)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, ci) => <td key={ci} style={{ padding: '8px 10px', color: 'var(--text-c)', borderBottom: '1px solid var(--bord2)', verticalAlign: 'top' }} dangerouslySetInnerHTML={{ __html: inline(r[ci] || '') }} />)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    i++;
    if (!line.trim()) { out.push(<div key={key++} style={{ height: 7 }} />); continue; }
    if (line.startsWith('# '))   { out.push(<div key={key++} style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color, marginTop: 20, marginBottom: 10, borderBottom: `1px solid ${color}20`, paddingBottom: 8, fontFamily: "'Newsreader', serif" }} dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />); continue; }
    if (line.startsWith('## '))  { out.push(<div key={key++} style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color, marginTop: 16, marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: inline(line.slice(3)) }} />); continue; }
    if (line.startsWith('### ')) { out.push(<div key={key++} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }} dangerouslySetInnerHTML={{ __html: inline(line.slice(4)) }} />); continue; }
    if (/^---+\s*$/.test(line))  { out.push(<div key={key++} style={{ borderTop: '1px solid var(--border-dim)', margin: '12px 0' }} />); continue; }
    if (line.startsWith('> '))   { out.push(<div key={key++} style={{ borderLeft: `3px solid ${color}`, padding: '10px 14px', background: `${color}08`, borderRadius: '0 6px 6px 0', margin: '10px 0', fontSize: 'var(--fs-base)', color: 'var(--text-b)', lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />); continue; }
    if (/^[-•→▸]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const content = line.replace(/^[-•→▸]\s/, '').replace(/^\d+\.\s/, '');
      out.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
          <span style={{ color, fontSize: 'var(--fs-sm)', marginTop: 5, flexShrink: 0 }}>▸</span>
          <span style={{ fontSize: 'var(--fs-base)', lineHeight: 1.75, color: 'var(--text-c)' }} dangerouslySetInnerHTML={{ __html: inline(content) }} />
        </div>
      );
      continue;
    }
    out.push(<p key={key++} style={{ fontSize: 'var(--fs-base)', lineHeight: 1.8, color: 'var(--text-c)', marginBottom: 5 }} dangerouslySetInnerHTML={{ __html: inline(line) }} />);
  }

  return <div>{out}</div>;
}
