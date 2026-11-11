import { T } from '../../theme';
import './common.css';
// Shared primitive UI components — tokens only (common.css, cm-). Callers still
// pass `color` / `accent` props; they're routed through CSS custom properties
// (--c for strokes/fills, --ct for the same colour used as text).

const ACCENTS = new Set([T.accent, 'var(--accent)', 'var(--accent-text)', 'var(--gold)']);
const isAccent = (c) => ACCENTS.has(c);
// The accent as TEXT must be --accent-text (the fill navy fails contrast in dark).
const asText = (c) => (isAccent(c) ? 'var(--accent-text)' : c);
const asStroke = (c) => (isAccent(c) ? 'var(--accent)' : c);

const onKeyActivate = (fn) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn?.(e); }
};

export function Btn({ children, onClick, color = T.accent, disabled, variant = 'fill', size = 'md', style: extraStyle = {} }) {
  if (!['fill', 'outline', 'ghost'].includes(variant)) return null;
  const acc = isAccent(color);
  const vars = variant === 'fill'
    ? { '--c': asStroke(color), '--fg': acc ? 'var(--accent-foreground)' : 'var(--background)' }
    : { '--c': asStroke(color), '--ct': asText(color) };
  return (
    <button type="button" className={`cm-btn cm-btn-${variant} cm-btn-${size} tap`} data-accent={acc ? '' : undefined}
      disabled={disabled} onClick={!disabled ? onClick : undefined} style={{ ...vars, ...extraStyle }}>
      {children}
    </button>
  );
}

export function Input({ label, value, onChange, placeholder, type = 'text', style: extraStyle = {} }) {
  return (
    <label className="cm-field">
      {label && <span className="cm-field-label">{label}</span>}
      <input className="cm-input"
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={extraStyle}
      />
    </label>
  );
}

export function Textarea({ label, value, onChange, placeholder, rows = 3, style: extraStyle = {} }) {
  return (
    <label className="cm-field">
      {label && <span className="cm-field-label">{label}</span>}
      <textarea className="cm-input cm-textarea"
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={extraStyle}
      />
    </label>
  );
}

export function Card({ children, color, style: extraStyle = {}, onClick }) {
  const clickable = !!onClick;
  return (
    <div className={`cm-card${clickable ? ' focus-ring' : ''}`} data-tint={color ? '' : undefined} data-click={clickable ? '' : undefined}
      onClick={onClick} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? onKeyActivate(onClick) : undefined}
      style={{ ...(color ? { '--c': asStroke(color) } : null), ...extraStyle }}>
      {children}
    </div>
  );
}

export function Badge({ children, color = T.accent }) {
  return (
    <span className="cm-badge" style={{ '--c': asStroke(color), '--ct': asText(color) }}>
      {children}
    </span>
  );
}

export function Label({ children, color = 'var(--subtle)' }) {
  return (
    <div className="cm-label" style={{ '--ct': asText(color) }}>
      {children}
    </div>
  );
}

export function Spinner({ color = T.accent, size = 18 }) {
  return <div className="cm-spinner" style={{ '--c': color, '--size': `${size}px` }} />;
}

export function ThinkingDots({ color = T.accent }) {
  return (
    <div className="cm-dots" style={{ '--c': color }}>
      <div className="cm-dot" /><div className="cm-dot" /><div className="cm-dot" />
    </div>
  );
}

export function Divider({ style: extraStyle = {} }) {
  return <div className="cm-divider" style={extraStyle} />;
}

export function Modal({ children, onClose, title, accent = T.accent, width = 520 }) {
  return (
    <div className="cm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cm-modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ '--c': asStroke(accent), '--w': typeof width === 'number' ? `${width}px` : width }}>
        {title && (
          <div className="cm-modal-head">
            <div className="cm-modal-title">{title}</div>
            <button type="button" className="cm-close tap" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        <div className="cm-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function BottomSheet({ children, onClose, title, accent = T.accent }) {
  return (
    <div className="cm-overlay" data-sheet="">
      <div className="cm-sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
        style={{ '--c': asStroke(accent) }}>
        {title && (
          <div className="cm-sheet-head">
            <div className="cm-modal-title">{title}</div>
            <button type="button" className="cm-close tap" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Signature element — "yard lines". Progress reads as a field marker: a fill
// advancing across hairline ticks set at every 10%. Used app-wide for the
// confidence bar, quiz progress, and session cards so the motif stays consistent.
const TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export function ProgressBar({ value, max = 10, color = 'var(--accent)', height = 6, ticks = true }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="cm-progress" style={{ '--h': `${height}px`, '--pct': `${pct}%`, '--c': color }}>
      <div className="cm-progress-fill" />
      {ticks && TICKS.map(t => <div key={t} className="cm-progress-tick" style={{ left: `${t}%` }} />)}
    </div>
  );
}

// Yard-line dots — the quiz/step progress form of the same motif.
export function YardDots({ total, current = 0, color = 'var(--accent)' }) {
  return (
    <div className="cm-yard" style={{ '--c': color }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="cm-yard-dot" data-on={i < current ? '' : undefined} />
      ))}
    </div>
  );
}

export function ChipRow({ chips, selected, onSelect, colorFn }) {
  return (
    <div className="cm-chiprow">
      {chips.map(c => {
        const active = selected === c.id;
        const color = colorFn ? colorFn(c) : T.accent;
        return (
          <button type="button" key={c.id} className="cm-chip tap" aria-pressed={active}
            onClick={() => onSelect(c.id)} style={{ '--c': asStroke(color), '--ct': asText(color) }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
