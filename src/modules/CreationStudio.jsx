import { useState, useEffect, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildCreationPrompt, CREATION_KINDS } from '../utils.js';
import { SYSTEM_LEARNING } from '../constants.js';
import { loadIndex as loadDives, loadDive } from '../lib/deepdives.js';
import { loadIndex as loadLadders, loadLadder } from '../lib/ladders.js';
import { loadSession } from '../lib/sessions.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import { SectionEmpty } from './shared/SectionState.jsx';
import Icon from './shared/Icon.jsx';
import './creation-studio.css';

// CREATION_KINDS carries emoji glyphs (utils.js); the UI renders lucide icons by name.
const KIND_ICON = { doc: 'FileText', deck: 'Presentation', guide: 'BookOpen' };

// Serialize a saved object into source text for the generator.
function serializeSource(src) {
  if (!src) return null;
  // A pre-generated document handed straight in (e.g. a BookClub study guide),
  // carrying its own text so it's immediately formattable + downloadable here.
  if (src.kind === 'guide') return { title: src.title || 'Study Guide', text: src.text || '' };
  if (src.kind === 'deepdive') {
    const d = loadDive(src.id); if (!d) return null;
    const body = d.sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');
    const srcs = d.sources.length ? `\n\nSOURCES\n${d.sources.map((s, i) => `[${i + 1}] ${s}`).join('\n')}` : '';
    return { title: d.topic, text: body + srcs };
  }
  if (src.kind === 'ladder') {
    const l = loadLadder(src.id); if (!l) return null;
    const body = l.modules.map((m, i) => `## ${i + 1}. ${m.title} (${m.status})\n${(m.objectives || []).map(o => `- ${o}`).join('\n')}`).join('\n\n');
    return { title: l.topic, text: `Goal: ${l.goal}\n\n${body}` };
  }
  if (src.kind === 'session') {
    const s = loadSession(src.module, src.id); if (!s) return null;
    return { title: s.title, text: s.messages.map(m => `**${m.role}:** ${m.content}`).join('\n\n') };
  }
  return null;
}

export default function CreationStudio() {
  const { studioSource, setStudioSource } = useApp();
  const [source, setSource] = useState(studioSource || null); // { kind, id, title, module? }
  const [kind, setKind]     = useState('doc');
  const [result, setResult] = useState('');
  const [stream, setStream] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);

  const dives   = loadDives();
  const ladders = loadLadders();

  // Consume an Export hand-off from a Deep Dive / ladder / session.
  useEffect(() => { if (studioSource) { setSource(studioSource); setResult(''); setStudioSource?.(null); } }, [studioSource, setStudioSource]);
  useEffect(() => { if (loading || result) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [stream, loading, result]);

  const generate = async () => {
    if (!source || loading) return;
    const s = serializeSource(source);
    if (!s) { setResult('Could not load that source — it may have been deleted.'); return; }
    setLoading(true); setStream(''); setResult('');
    try {
      const text = await callClaude({
        system: SYSTEM_LEARNING,
        messages: [{ role: 'user', content: buildCreationPrompt(kind, s.title, s.text) }],
        maxTokens: 3000,
        onToken: (t) => setStream(s2 => s2 + t),
      });
      setResult(text);
    } catch {
      setResult('Generation failed — try again.');
    }
    setStream(''); setLoading(false);
  };

  const copy = () => { navigator.clipboard?.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const download = () => {
    const name = `${(source?.title || 'creation')}-${kind}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  const SourceRow = ({ item, kind: k }) => {
    const sel = source?.kind === k && source?.id === item.id;
    return (
      <button type="button" className="cs-src tap" aria-pressed={sel}
        onClick={() => { setSource({ kind: k, id: item.id, title: item.topic }); setResult(''); }}>
        <span className="cs-src-title">{item.topic}</span>
        <span className="cs-src-kind">{k === 'deepdive' ? 'Deep Dive' : 'Ladder'}</span>
      </button>
    );
  };

  return (
    <div className="cs">
      <div className="cs-eyebrow">Turn knowledge into deliverables</div>
      <div className="cs-title">Creation Studio</div>
      <div className="cs-lede">Generate a document, slide outline, or study guide from any saved Deep Dive or ladder.</div>

      {/* Source */}
      <div className="cs-step">1 · Pick a source</div>
      {dives.length === 0 && ladders.length === 0 ? (
        <div className="cs-block">
          <SectionEmpty what="No Deep Dives or ladders yet"
            how="Build one, then come back to turn it into a deliverable." />
        </div>
      ) : (
        <div className="cs-block">
          {dives.map(d => <SourceRow key={d.id} item={d} kind="deepdive" />)}
          {ladders.map(l => <SourceRow key={l.id} item={l} kind="ladder" />)}
        </div>
      )}

      {/* Kind */}
      <div className="cs-step">2 · Choose a format</div>
      <div className="cs-kinds">
        {CREATION_KINDS.map(k => (
          <button type="button" key={k.id} className="cs-kind tap" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
            <span className="cs-kind-ico"><Icon name={KIND_ICON[k.id] || 'FileText'} size={24} strokeWidth={1.6} /></span>
            <span className="cs-kind-label">{k.label}</span>
            <span className="cs-kind-desc">{k.desc}</span>
          </button>
        ))}
      </div>

      <button type="button" className="btn btn-primary cs-go tap" onClick={generate} disabled={!source || loading} aria-busy={loading || undefined}>
        {loading ? 'Generating…' : source ? `Generate ${CREATION_KINDS.find(k => k.id === kind)?.label} →` : 'Pick a source first'}
      </button>

      {(loading || result) && (
        <div ref={bottomRef} className="cs-result">
          <div className="cs-result-head">
            <div className="cs-result-label">{CREATION_KINDS.find(k => k.id === kind)?.label} · {source?.title}</div>
            {result && !loading && (
              <div className="cs-result-tools">
                <button type="button" className="cs-mini tap" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
                <button type="button" className="cs-mini tap" data-tone="accent" onClick={download}>↓ .md</button>
              </div>
            )}
          </div>
          {loading && !stream ? <ThinkingDots color="var(--accent-text)" /> : <MD text={(loading ? stream + '▍' : result)} color="var(--accent-text)" />}
        </div>
      )}
    </div>
  );
}
