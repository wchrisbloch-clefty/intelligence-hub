import { T, withAlpha } from '../../theme';
import { useApp } from '../../App.jsx';
import { askPrefill, askLabel } from '../../lib/askContext.js';
import { MessageSquare } from 'lucide-react';

// The Universal Ask affordance. Drop it on any object; it opens the global Ask
// layer pre-loaded with that object plus its graph neighbors, and names the
// attachment in the chat header so the user can see the context is live.
export default function AskChip({ type, object, label = 'Ask', size = 'sm', style = {} }) {
  const { setChatPrefill, setChatOpen, setChatAttach } = useApp();
  const open = (e) => {
    e?.stopPropagation?.();
    setChatPrefill(askPrefill(type, object));
    setChatAttach?.({ label: askLabel(type, object) });
    setChatOpen(true);
  };
  const pad = size === 'sm' ? '4px 10px' : '7px 13px';
  return (
    <button onClick={open} title="Ask the AI about this — it opens with the full context"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: pad, borderRadius: 8, border: `1px solid ${withAlpha(T.accent, 35)}`, background: withAlpha(T.accent, 8), color: T.accent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', ...style }}>
      <MessageSquare size={12} strokeWidth={2} /> {label}
    </button>
  );
}
