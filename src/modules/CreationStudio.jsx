import { T } from '../theme';
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, buildCreationPrompt, CREATION_KINDS } from '../utils.js';
import { CB_LEARNING_SPINE } from '../constants.js';
import { loadIndex as loadDives, loadDive } from '../lib/deepdives.js';
import { loadIndex as loadLadders, loadLadder } from '../lib/ladders.js';
import { loadSession } from '../lib/sessions.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT = T.accent;

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
  const { isMobile, studioSource, setStudioSource } = useApp();
  const [source, setSource] = useState(studioSource || null); // { kind, id, title, module? }
  const [kind, setKind]     = useState('doc');
  const [result, setResult] = useState('');
  const [stream, setStream] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);
  const pad = isMobile ? '14px' : '24px';

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
        system: CB_LEARNING_SPINE,
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
      <div onClick={() => { setSource({ kind: k, id: item.id, title: item.topic }); setResult(''); }}
        style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 9, cursor: 'pointer', border: `1px solid ${sel ? ACCENT : 'var(--border)'}`, background: sel ? 'var(--accent-glow)' : 'var(--surface)' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: sel ? ACCENT : 'var(--text-b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.topic}</div>
        <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>{k === 'deepdive' ? 'Deep Dive' : 'Ladder'}</div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: `20px ${pad} 60px` }}>
      <div style={{ fontSize: 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 6 }}>Turn knowledge into deliverables</div>
      <div style={{ fontSize: isMobile ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5, marginBottom: 4 }}>Creation Studio</div>
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', marginBottom: 20 }}>Generate a document, slide outline, or study guide from any saved Deep Dive or ladder.</div>

      {/* Source */}
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>1 · Pick a source</div>
      {dives.length === 0 && ladders.length === 0 ? (
        <div style={{ padding: '18px', border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 'var(--fs-base)', color: 'var(--dim)', marginBottom: 20 }}>
          No Deep Dives or ladders yet. Build one, then come back to turn it into a deliverable.
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {dives.map(d => <SourceRow key={d.id} item={d} kind="deepdive" />)}
          {ladders.map(l => <SourceRow key={l.id} item={l} kind="ladder" />)}
        </div>
      )}

      {/* Kind */}
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>2 · Choose a format</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {CREATION_KINDS.map(k => (
          <div key={k.id} onClick={() => setKind(k.id)}
            style={{ padding: '14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${kind === k.id ? ACCENT : 'var(--border)'}`, background: kind === k.id ? 'var(--accent-glow)' : 'var(--surface)' }}>
            <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: kind === k.id ? ACCENT : 'var(--text)', marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.4 }}>{k.desc}</div>
          </div>
        ))}
      </div>

      <button onClick={generate} disabled={!source || loading}
        style={{ width: '100%', padding: '13px', background: source && !loading ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, color: source && !loading ? T.canvas : 'var(--dim)', fontSize: 'var(--fs-base)', fontWeight: 800, cursor: source && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 20 }}>
        {loading ? 'Generating…' : source ? `Generate ${CREATION_KINDS.find(k => k.id === kind)?.label} →` : 'Pick a source first'}
      </button>

      {(loading || result) && (
        <div ref={bottomRef} style={{ background: 'var(--surface)', border: `1px solid ${ACCENT}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: ACCENT, textTransform: 'uppercase' }}>{CREATION_KINDS.find(k => k.id === kind)?.label} · {source?.title}</div>
            {result && !loading && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div onClick={copy} style={{ fontSize: 'var(--fs-sm)', color: 'var(--subtle)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px' }}>{copied ? '✓ Copied' : 'Copy'}</div>
                <div onClick={download} style={{ fontSize: 'var(--fs-sm)', color: ACCENT, cursor: 'pointer', border: `1px solid ${ACCENT}`, borderRadius: 6, padding: '3px 9px', fontWeight: 700 }}>↓ .md</div>
              </div>
            )}
          </div>
          {loading && !stream ? <ThinkingDots color={ACCENT} /> : <MD text={(loading ? stream + '▍' : result)} color={ACCENT} />}
        </div>
      )}
    </div>
  );
}
