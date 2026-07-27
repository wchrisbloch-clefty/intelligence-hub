import { T } from '../../theme';
// Shared primitive UI components — uses CSS variables for theming

export function Btn({ children, onClick, color = T.accent, disabled, variant = 'fill', size = 'md', style: extraStyle = {} }) {
  const pad = { sm: '7px 14px', md: '11px 18px', lg: '14px 22px' }[size];
  const fs = { sm: 11, md: 12, lg: 13 }[size];
  const base = { padding: pad, borderRadius: 10, fontSize: fs, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...extraStyle };

  if (variant === 'fill') return (
    <button onClick={!disabled ? onClick : undefined} style={{ ...base, background: disabled ? 'var(--bord2)' : color, border: `1px solid ${disabled ? 'var(--bord2)' : color}`, color: disabled ? 'var(--dim)' : '#000', width: '100%' }}>
      {children}
    </button>
  );
  if (variant === 'outline') return (
    <button onClick={!disabled ? onClick : undefined} style={{ ...base, background: disabled ? 'transparent' : `${color}12`, border: `1px solid ${disabled ? 'var(--bord2)' : color + '60'}`, color: disabled ? 'var(--dim)' : color }}>
      {children}
    </button>
  );
  if (variant === 'ghost') return (
    <button onClick={!disabled ? onClick : undefined} style={{ ...base, background: 'transparent', border: 'none', color: disabled ? 'var(--dim)' : color }}>
      {children}
    </button>
  );
  return null;
}

export function Input({ label, value, onChange, placeholder, type = 'text', style: extraStyle = {} }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', ...extraStyle }}
      />
    </div>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows = 3, style: extraStyle = {} }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>}
      <textarea
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', ...extraStyle }}
      />
    </div>
  );
}

export function Card({ children, color, style: extraStyle = {}, onClick }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', border: `1px solid ${color ? color + '25' : 'var(--border)'}`, borderRadius: 12, padding: '16px', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.18s', ...extraStyle }}>
      {children}
    </div>
  );
}

export function Badge({ children, color = T.accent }) {
  return (
    <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 4, padding: '3px 7px', fontWeight: 700 }}>
      {children}
    </span>
  );
}

export function Label({ children, color = 'var(--subtle)' }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color, marginBottom: 8, fontWeight: 600 }}>
      {children}
    </div>
  );
}

export function Spinner({ color = T.accent, size = 18 }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid ${color}20`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  );
}

export function ThinkingDots({ color = T.accent }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(j => (
        <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: color, animation: `pulse 1.2s ${j * 0.2}s infinite ease-in-out` }} />
      ))}
    </div>
  );
}

export function Divider({ style: extraStyle = {} }) {
  return <div style={{ borderTop: '1px solid var(--border-dim)', margin: '16px 0', ...extraStyle }} />;
}

export function Modal({ children, onClose, title, accent = T.accent, width = 520 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: width, background: 'var(--surface)', border: `1px solid ${accent}25`, borderRadius: 16, overflow: 'hidden', animation: 'fadeUp 0.2s ease' }}>
        {title && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <div onClick={onClose} style={{ fontSize: 16, color: 'var(--subtle)', cursor: 'pointer', padding: '0 4px' }}>✕</div>
          </div>
        )}
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function BottomSheet({ children, onClose, title, accent = T.accent }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: 680, margin: '0 auto', background: 'var(--surface)', border: `1px solid ${accent}25`, borderRadius: '16px 16px 0 0', padding: '20px 20px 40px', animation: 'fadeUp 0.2s ease' }}>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <div onClick={onClose} style={{ fontSize: 14, color: 'var(--subtle)', cursor: 'pointer' }}>✕</div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Signature element — "yard lines". Progress reads as a field marker: a gold
// fill advancing across hairline ticks set at every 10%. Used app-wide for the
// confidence bar, quiz progress, and session cards so the motif stays consistent.
export function ProgressBar({ value, max = 10, color = 'var(--accent)', height = 6, ticks = true }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ position: 'relative', background: 'var(--line)', borderRadius: 2, height, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s cubic-bezier(0.2,0.8,0.2,1)' }} />
      {ticks && [10,20,30,40,50,60,70,80,90].map(t => (
        <div key={t} style={{ position: 'absolute', top: 0, bottom: 0, left: `${t}%`, width: 1, background: 'var(--ink)', opacity: 0.55 }} />
      ))}
    </div>
  );
}

// Yard-line dots — the quiz/step progress form of the same motif.
export function YardDots({ total, current = 0, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i < current ? color : 'var(--line)',
          transition: 'background 0.3s ease',
        }} />
      ))}
    </div>
  );
}

export function ChipRow({ chips, selected, onSelect, colorFn }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {chips.map(c => {
        const active = selected === c.id;
        const color = colorFn ? colorFn(c) : T.accent;
        return (
          <div key={c.id} onClick={() => onSelect(c.id)}
            style={{ padding: '4px 12px', fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', border: `1px solid ${active ? color : 'var(--bord2)'}`, color: active ? color : 'var(--subtle)', borderRadius: 20, cursor: 'pointer', background: active ? `${color}15` : 'transparent' }}>
            {c.label}
          </div>
        );
      })}
    </div>
  );
}
