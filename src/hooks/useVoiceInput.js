import { useState, useRef, useCallback } from 'react';

export const voiceSupported = () =>
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function useVoiceInput() {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const start = useCallback((onResult, lang = 'en-US') => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input requires Chrome, Edge, or Safari.');
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      const isFinal    = e.results[e.results.length - 1].isFinal;
      onResult(transcript, isFinal);
    };
    rec.start();
    recRef.current = rec;
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback((onResult, lang) => {
    if (listening) stop();
    else start(onResult, lang);
  }, [listening, start, stop]);

  return { listening, start, stop, toggle, supported: voiceSupported() };
}
