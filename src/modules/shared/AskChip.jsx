import { useApp } from '../../App.jsx';
import { askPrefill, askLabel } from '../../lib/askContext.js';
import { MessageSquare } from 'lucide-react';
import './ask-chip.css';

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
  return (
    <button type="button" className="ak tap" data-size={size === 'sm' ? 'sm' : 'md'} onClick={open}
      title="Ask the AI about this — it opens with the full context" style={style}>
      <MessageSquare size={12} strokeWidth={2} /> {label}
    </button>
  );
}
