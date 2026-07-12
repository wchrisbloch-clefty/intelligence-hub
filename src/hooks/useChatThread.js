import { useState, useCallback, useRef } from 'react';
import { callClaude, buildApiMessages, uid } from '../utils.js';
import { saveSession, autoTitle } from '../lib/sessions.js';

// Shared conversation primitive. Owns the message list, the input/attachment
// buffers, the loading + streaming state, and the send loop that every chat
// surface (global ChatPanel, CoachAI, LearningCenter, …) used to re-implement.
//
// The caller supplies buildRequest(history) → { system, searchEnabled?, messages? }.
// It runs at send time so the system prompt can reflect the latest mode/context.
// Return `messages` to override the API payload (e.g. a fixed opener); otherwise
// the hook derives it from history via buildApiMessages (which also encodes
// PDF/image/URL attachments).
//
// Pass `persist: { module }` to make each completed exchange a saved, resumable
// session under session:{module}:{id}, auto-titled from the first user turn.
export default function useChatThread({ maxTokens = 4096, stream = true, buildRequest, persist }) {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [streamText, setStreamText]   = useState('');
  const [sessionId, setSessionId]     = useState(null);

  // Mutable session metadata that must not trigger re-renders mid-send.
  const meta = useRef({ createdAt: null, title: null });

  const persistThread = useCallback((history) => {
    if (!persist?.module) return;
    let id = sessionId;
    if (!id) { id = uid(); setSessionId(id); }
    if (!meta.current.createdAt) meta.current.createdAt = Date.now();
    const firstUser = history.find(m => m.role === 'user' && (m.content || '').trim());
    const title = meta.current.title || autoTitle(firstUser?.content);
    meta.current.title = title;
    saveSession({
      id, module: persist.module, title,
      messages: history,
      createdAt: meta.current.createdAt,
      updatedAt: Date.now(),
    });
    persist.onSaved?.();
  }, [persist, sessionId]);

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
      const finalHistory = [...history, { role: 'assistant', content: reply }];
      setMessages(finalHistory);
      persistThread(finalHistory);
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
  }, [messages, attachments, loading, buildRequest, maxTokens, stream, persistThread]);

  // Load a saved session into the thread.
  const resumeSession = useCallback((sess) => {
    setMessages(sess.messages || []);
    setSessionId(sess.id);
    meta.current = { createdAt: sess.createdAt || Date.now(), title: sess.title || null };
    setInput(''); setAttachments([]); setStreamText(''); setLoading(false);
  }, []);

  // Start a brand-new (unsaved until first exchange) session.
  const startNewSession = useCallback(() => {
    setMessages([]); setInput(''); setAttachments([]); setStreamText(''); setLoading(false);
    setSessionId(null);
    meta.current = { createdAt: null, title: null };
  }, []);

  return {
    messages, setMessages,
    input, setInput,
    attachments, setAttachments,
    loading, streamText,
    send,
    sessionId,
    resumeSession, startNewSession,
    reset: startNewSession,
  };
}
