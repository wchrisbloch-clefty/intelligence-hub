export default function MD({ text, color = '#00FFB2' }) {
  return (
    <div>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 7 }} />;
        if (line.startsWith('# '))  return <div key={i} style={{ fontSize: 15, fontWeight: 700, color, marginTop: 20, marginBottom: 10, borderBottom: `1px solid ${color}20`, paddingBottom: 8, fontFamily: "'Fraunces', serif" }}>{line.slice(2)}</div>;
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 13, fontWeight: 700, color, marginTop: 16, marginBottom: 8 }}>{line.slice(3)}</div>;
        if (line.startsWith('### ')) return <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 12, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>{line.slice(4)}</div>;
        if (line.startsWith('---')) return <div key={i} style={{ borderTop: '1px solid var(--border-dim)', margin: '12px 0' }} />;
        if (line.startsWith('> ')) return (
          <div key={i} style={{ borderLeft: `3px solid ${color}`, padding: '10px 14px', background: `${color}08`, borderRadius: '0 6px 6px 0', margin: '10px 0', fontSize: 12, color: 'var(--text-b)', lineHeight: 1.75 }}
            dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, `<strong style="color:var(--text)">$1</strong>`) }} />
        );
        if (/^[-•→▸]\s/.test(line) || /^\d+\.\s/.test(line)) {
          const content = line.replace(/^[-•→▸]\s/, '').replace(/^\d+\.\s/, '');
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
              <span style={{ color, fontSize: 9, marginTop: 5, flexShrink: 0 }}>▸</span>
              <span style={{ fontSize: 12, lineHeight: 1.75, color: 'var(--text-c)' }}
                dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, `<strong style="color:var(--text)">$1</strong>`).replace(/\*(.*?)\*/g, `<em style="color:var(--muted)">$1</em>`) }} />
            </div>
          );
        }
        return (
          <p key={i} style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-c)', marginBottom: 5 }}
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, `<strong style="color:var(--text-b)">$1</strong>`).replace(/\*(.*?)\*/g, `<em style="color:var(--muted)">$1</em>`) }} />
        );
      })}
    </div>
  );
}
