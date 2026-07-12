import { useState, useCallback } from 'react';
import { callClaude, buildApiMessages } from '../utils.js';

// Shared conversation primitive. Owns the message list, the input/attachment
// buffers, the loading + streaming state, and the send loop that every chat
// surface (global ChatPanel, CoachAI, LearningCenter, …) used to re-implement.
//
// The caller supplies buildRequest(history) → { system, searchEnabled?, messages? }.
// It runs at send time so the system prompt can reflect the latest mode/context.
// Return `messages` to override the API payload (e.g. a fixed opener); otherwise
// the hook derives it from history via buildApiMessages (which also encodes
// PDF/image/URL attachments).
export default function useChatThread({ maxTokens = 4096, stream = true, buildRequest }) {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [streamText, setStreamText]   = useState('');

  const send = useCallback(async (text = '') => {
    const trimmed = (text || '').trim();
    if ((!trimmed && attachments.length === 0) || loading) return;

    const userMsg = { role: 'user', content: text, attachments };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setStreamText('');

    try {
      const req = (await buildRequest(history)) || {};
      const apiMessages = req.messages || await buildApiMessages(history);
      const onToken = stream ? (t) => setStreamText(s => s + t) : undefined;
      const reply = await callClaude({
        system: req.system,
        messages: apiMessages,
        maxTokens,
        searchEnabled: req.searchEnabled,
        onToken,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: e?.authExpired
          ? 'Auth expired — re-enter your code to continue.'
          : 'AI request failed — retry.',
      }]);
    }
    setStreamText('');
    setLoading(false);
  }, [messages, attachments, loading, buildRequest, maxTokens, stream]);

  const reset = useCallback(() => {
    setMessages([]); setInput(''); setAttachments([]); setStreamText(''); setLoading(false);
  }, []);

  return {
    messages, setMessages,
    input, setInput,
    attachments, setAttachments,
    loading, streamText,
    send, reset,
  };
}
