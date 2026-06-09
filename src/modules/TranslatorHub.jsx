import { useState, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude } from '../utils.js';
import { LANGUAGES, TRANSLATION_MODES } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import useVoiceInput from '../hooks/useVoiceInput.js';

const QUICK_PAIRS = [
  { from: 'en-US', to: 'es-MX', label: 'EN → ES (Mexico)' },
  { from: 'en-US', to: 'es-ES', label: 'EN → ES (Spain)' },
  { from: 'es-MX', to: 'en-US', label: 'ES → EN' },
  { from: 'en-US', to: 'pt-BR', label: 'EN → PT (Brazil)' },
  { from: 'en-US', to: 'fr-FR', label: 'EN → FR' },
  { from: 'en-US', to: 'zh-CN', label: 'EN → ZH' },
];

function findVariant(code) {
  for (const lang of LANGUAGES) {
    if (lang.code === code || (lang.variants || []).some(v => v.code === code)) {
      const v = (lang.variants || []).find(v => v.code === code);
      return v?.label || lang.label;
    }
  }
  return code;
}

function LangSelector({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const display = findVariant(value);

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 40 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 2 }}>{label}</div>
          <div style={{ color: 'var(--text)' }}>{display}</div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--dim)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 100, maxHeight: 320, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          {LANGUAGES.map(lang => (
            <div key={lang.code}>
              {/* Language group header */}
              {lang.variants && lang.variants.length > 1 ? (
                <div style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', background: 'var(--bg)' }}>
                  {lang.flag} {lang.label}
                </div>
              ) : null}
              {/* Variants or single option */}
              {(lang.variants && lang.variants.length > 1 ? lang.variants : [{ code: lang.code, label: `${lang.flag} ${lang.label}` }]).map(v => (
                <div key={v.code} onClick={() => { onChange(v.code); setOpen(false); }}
                  style={{ padding: lang.variants && lang.variants.length > 1 ? '8px 14px 8px 24px' : '8px 14px', fontSize: 12, color: value === v.code ? 'var(--accent,#38bdf8)' : 'var(--text-b)', cursor: 'pointer', background: value === v.code ? 'var(--accent-glow,rgba(56,189,248,0.08))' : 'transparent', fontWeight: value === v.code ? 600 : 400, borderBottom: '1px solid var(--bord2)' }}>
                  {v.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TranslatorHub() {
  const { isMobile, isPhone, isTablet } = useApp();
  const [fromLang, setFromLang] = useState('en-US');
  const [toLang,   setToLang]   = useState('es-MX');
  const [mode,     setMode]     = useState('standard');
  const [input,    setInput]    = useState('');
  const [output,   setOutput]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [history,  setHistory]  = useState([]);
  const fileRef = useRef(null);

  const { listening, toggle: toggleVoice, supported: voiceOk } = useVoiceInput();

  const swap = () => {
    setFromLang(toLang);
    setToLang(fromLang);
    setInput(output);
    setOutput('');
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (ev) => setInput(prev => prev ? prev + '\n\n' + ev.target.result : ev.target.result);
      reader.readAsText(file);
    } else {
      alert('Paste document text directly, or upload a .txt / .csv / .md file. For PDF/Word content, copy and paste the text.');
    }
    e.target.value = '';
  };

  const handlePaste = (e) => {
    // Auto-detect and process pasted content
    const text = e.clipboardData?.getData('text') || '';
    // If it looks like a TSV (Excel copy), format as markdown table
    if (text.includes('\t') && text.split('\n').length > 1) {
      e.preventDefault();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      const maxCols = Math.max(...rows.map(r => r.length));
      const padded = rows.map(r => [...r, ...Array(maxCols - r.length).fill('')]);
      const header = `| ${padded[0].join(' | ')} |`;
      const sep    = `| ${padded[0].map(() => '---').join(' | ')} |`;
      const body   = padded.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n');
      const table  = [header, sep, body].join('\n');
      setInput(prev => prev ? prev + '\n\n' + table : table);
      return;
    }
  };

  const translate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutput('');
    try {
      const fromLabel = findVariant(fromLang);
      const toLabel   = findVariant(toLang);
      const modeObj   = TRANSLATION_MODES.find(m => m.id === mode);
      const modeInstr = {
        standard:  'Translate naturally and fluently.',
        formal:    'Use formal, professional register. Appropriate for business and official contexts.',
        casual:    'Use casual, conversational tone. Natural everyday language.',
        literal:   'Translate as literally as possible, staying close to the source words. Add brief notes on any significant differences.',
        localized: 'Use local idioms, expressions, and cultural references from the target region. Make it sound like a native speaker.',
      }[mode];

      const prompt = `Translate the following from ${fromLabel} to ${toLabel}.

Style: ${modeInstr}

If you detect idioms, slang, or culturally-specific expressions, add a brief note (in parentheses in the target language) after the translation.

Text to translate:
"""
${input.trim()}
"""

Provide only the translation. No preamble, no explanation unless a cultural note is needed.`;

      const reply = await callClaude({
        system: `You are an expert translator specializing in nuanced, contextually accurate translation. You understand regional dialects and cultural differences.`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
      });
      setOutput(reply);
      setHistory(h => [{ from: fromLabel, to: toLabel, mode, fromCode: fromLang, toCode: toLang, input: input.slice(0, 80) + (input.length > 80 ? '…' : ''), output: reply.slice(0, 80) + (reply.length > 80 ? '…' : ''), fullInput: input, full: reply, date: Date.now() }, ...h.slice(0, 9)]);
    } catch {
      setOutput('Translation failed — check connection and try again.');
    }
    setLoading(false);
  };

  const pad = isPhone ? '14px' : isMobile ? '16px' : isTablet ? '22px' : '28px';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: isMobile ? 80 : 60 }}>

      {/* Header */}
      <div style={{ padding: `${pad} ${pad} 0`, marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 4 }}>Intelligence Hub</div>
        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5 }}>
          🌐 Translator
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>
          All languages · Country dialects · Voice input · Document paste
        </div>
      </div>

      <div style={{ padding: `0 ${pad}` }}>

        {/* Quick pair shortcuts */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', marginBottom: 20, paddingBottom: 2 }}>
          {QUICK_PAIRS.map(p => (
            <button key={p.label} onClick={() => { setFromLang(p.from); setToLang(p.to); setOutput(''); }}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: `1px solid ${fromLang === p.from && toLang === p.to ? 'var(--accent,#38bdf8)' : 'var(--border)'}`, background: fromLang === p.from && toLang === p.to ? 'rgba(56,189,248,0.1)' : 'transparent', color: fromLang === p.from && toLang === p.to ? 'var(--accent,#38bdf8)' : 'var(--muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', minHeight: 32 }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Language selector row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto 1fr' : '1fr 40px 1fr', gap: isMobile ? 8 : 12, alignItems: 'center', marginBottom: 16 }}>
          <LangSelector label="From" value={fromLang} onChange={setFromLang} />
          <button onClick={swap}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 16, cursor: 'pointer', color: 'var(--text-b)', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ⇄
          </button>
          <LangSelector label="To" value={toLang} onChange={setToLang} />
        </div>

        {/* Translation mode */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 16 }}>
          {TRANSLATION_MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} title={m.desc}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: `1px solid ${mode === m.id ? 'var(--accent,#38bdf8)' : 'var(--border)'}`, background: mode === m.id ? 'rgba(56,189,248,0.1)' : 'transparent', color: mode === m.id ? 'var(--accent,#38bdf8)' : 'var(--muted)', fontSize: 11, fontWeight: mode === m.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', minHeight: 32 }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Input / Output panels */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Input */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bord2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-c)' }}>{findVariant(fromLang)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {voiceOk && (
                  <button onClick={() => toggleVoice((t) => setInput(t))}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${listening ? '#ff4444' : 'var(--border)'}`, background: listening ? '#ff444410' : 'transparent', color: listening ? '#ff4444' : 'var(--dim)', fontSize: 12, cursor: 'pointer', outline: 'none', minHeight: 28 }}>
                    {listening ? '⏹ Stop' : '🎙️ Voice'}
                  </button>
                )}
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', outline: 'none', minHeight: 28 }}>
                  📎 File
                </button>
                <input ref={fileRef} type="file" accept=".txt,.csv,.md" style={{ display: 'none' }} onChange={handleFile} />
              </div>
            </div>
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type, paste, or upload text to translate… (Excel/TSV auto-formats to table)"
              style={{ width: '100%', minHeight: 160, padding: '14px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }}
            />
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--bord2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--dim)' }}>{input.length} chars</div>
              <button onClick={() => setInput('')} style={{ fontSize: 10, color: 'var(--dim)', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
            </div>
          </div>

          {/* Output */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bord2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-c)' }}>{findVariant(toLang)}</div>
              {output && (
                <button onClick={() => navigator.clipboard?.writeText(output)}
                  style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', minHeight: 28 }}>
                  Copy
                </button>
              )}
            </div>
            <div style={{ minHeight: 160, padding: '14px', fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
              {loading ? (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 10, fontStyle: 'italic' }}>Translating…</div>
                  <ThinkingDots />
                </div>
              ) : output ? (
                <MD text={output} />
              ) : (
                <span style={{ color: 'var(--dim)' }}>Translation will appear here</span>
              )}
            </div>
          </div>
        </div>

        {/* Translate button */}
        <button onClick={translate} disabled={loading || !input.trim()}
          style={{ padding: '12px 32px', background: loading || !input.trim() ? 'var(--surf2)' : 'var(--accent,#38bdf8)', color: loading || !input.trim() ? 'var(--dim)' : '#000', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 800, cursor: loading || !input.trim() ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%', marginBottom: 24 }}>
          {loading ? 'Translating…' : `🌐 Translate`}
        </button>

        {/* History */}
        {history.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Recent Translations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} onClick={() => { setInput(h.fullInput || ''); setOutput(h.full); setFromLang(h.fromCode || fromLang); setToLang(h.toCode || toLang); }}
                  style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--accent,#38bdf8)', fontWeight: 700 }}>{h.from} → {h.to}</span>
                    <span style={{ fontSize: 9, color: 'var(--dim)' }}>·</span>
                    <span style={{ fontSize: 9, color: 'var(--dim)' }}>{h.mode}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-c)', lineHeight: 1.5 }}>{h.input}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
