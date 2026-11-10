import { useState, useRef } from 'react';
import Icon from './shared/Icon.jsx';
import { callClaude } from '../utils.js';
import { LANGUAGES, TRANSLATION_MODES } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import useVoiceInput from '../hooks/useVoiceInput.js';
import './translator-hub.css';

// Styling lives in translator-hub.css (tr-) — tokens only, no inline colour.
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
    <div className="tr-sel">
      <button type="button" className="tr-sel-btn tap" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(o => !o)}>
        <div className="tr-sel-text">
          <div className="tr-sel-label">{label}</div>
          <div className="tr-sel-value">{display}</div>
        </div>
        <span className="tr-sel-caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="tr-menu" role="listbox" aria-label={label}>
          {LANGUAGES.map(lang => {
            const grouped = lang.variants && lang.variants.length > 1;
            return (
              <div key={lang.code}>
                {/* Language group header */}
                {grouped ? (
                  <div className="tr-group">
                    {lang.flag} {lang.label}
                  </div>
                ) : null}
                {/* Variants or single option */}
                {(grouped ? lang.variants : [{ code: lang.code, label: `${lang.flag} ${lang.label}` }]).map(v => (
                  <button type="button" key={v.code} role="option" aria-selected={value === v.code} className="tr-opt"
                    data-variant={grouped ? '' : undefined}
                    onClick={() => { onChange(v.code); setOpen(false); }}>
                    {v.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TranslatorHub() {
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

  return (
    <div className="tr">

      {/* Header */}
      <div className="tr-head">
        <div className="tr-eyebrow">Intelligence Hub</div>
        <div className="tr-title">
          <span className="tr-title-icon"><Icon name="Globe" size="nav" /></span> Translator
        </div>
        <div className="tr-lede">
          All languages · Country dialects · Voice input · Document paste
        </div>
      </div>

      <div className="tr-body">

        {/* Quick pair shortcuts */}
        <div className="tr-scroll" data-scroll-x="">
          {QUICK_PAIRS.map(p => (
            <button type="button" key={p.label} className="tr-chip" aria-pressed={fromLang === p.from && toLang === p.to}
              onClick={() => { setFromLang(p.from); setToLang(p.to); setOutput(''); }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Language selector row */}
        <div className="tr-langs">
          <LangSelector label="From" value={fromLang} onChange={setFromLang} />
          <button type="button" className="tr-swap tap" onClick={swap} aria-label="Swap languages">
            ⇄
          </button>
          <LangSelector label="To" value={toLang} onChange={setToLang} />
        </div>

        {/* Translation mode */}
        <div className="tr-scroll" data-gap="sm" data-scroll-x="">
          {TRANSLATION_MODES.map(m => (
            <button type="button" key={m.id} className="tr-chip" data-weight="normal" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} title={m.desc}>
              <Icon name={m.icon} size={14} /> {m.label}
            </button>
          ))}
        </div>

        {/* Input / Output panels */}
        <div className="tr-panels">
          {/* Input */}
          <div className="tr-panel">
            <div className="tr-panel-head">
              <div className="tr-panel-lang">{findVariant(fromLang)}</div>
              <div className="tr-tools">
                {voiceOk && (
                  <button type="button" className="tr-tool tap" data-live={listening ? '' : undefined} aria-pressed={listening}
                    onClick={() => toggleVoice((t) => setInput(t))}>
                    {listening ? '⏹ Stop' : '🎙️ Voice'}
                  </button>
                )}
                <button type="button" className="tr-tool tap" onClick={() => fileRef.current?.click()}>
                  <Icon name="Paperclip" size={14} /> File
                </button>
                <input ref={fileRef} type="file" accept=".txt,.csv,.md" className="tr-hidden" onChange={handleFile} />
              </div>
            </div>
            <textarea className="tr-input"
              value={input} onChange={e => setInput(e.target.value)}
              onPaste={handlePaste} aria-label="Text to translate"
              placeholder="Type, paste, or upload text to translate… (Excel/TSV auto-formats to table)"
            />
            <div className="tr-panel-foot">
              <div className="tr-count">{input.length} chars</div>
              <button type="button" className="tr-tool tap" data-sm="" onClick={() => setInput('')}>Clear</button>
            </div>
          </div>

          {/* Output */}
          <div className="tr-panel">
            <div className="tr-panel-head">
              <div className="tr-panel-lang">{findVariant(toLang)}</div>
              {output && (
                <button type="button" className="tr-tool tap" onClick={() => navigator.clipboard?.writeText(output)}>
                  Copy
                </button>
              )}
            </div>
            <div className="tr-output" aria-live="polite">
              {loading ? (
                <div>
                  <div className="tr-pending">Translating…</div>
                  <ThinkingDots />
                </div>
              ) : output ? (
                <MD text={output} />
              ) : (
                <span className="tr-muted">Translation will appear here</span>
              )}
            </div>
          </div>
        </div>

        {/* Translate button */}
        <button type="button" className="tr-go tap" onClick={translate} disabled={loading || !input.trim()} aria-busy={loading || undefined}>
          {loading ? 'Translating…' : <><Icon name="Globe" size="header" /> Translate</>}
        </button>

        {/* History */}
        {history.length > 0 && (
          <div>
            <div className="tr-label">Recent Translations</div>
            <div className="tr-history">
              {history.map((h, i) => (
                <button type="button" key={i} className="tr-hist tap"
                  onClick={() => { setInput(h.fullInput || ''); setOutput(h.full); setFromLang(h.fromCode || fromLang); setToLang(h.toCode || toLang); }}>
                  <div className="tr-hist-meta">
                    <span className="tr-hist-pair">{h.from} → {h.to}</span>
                    <span>·</span>
                    <span>{h.mode}</span>
                  </div>
                  <div className="tr-hist-text">{h.input}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
