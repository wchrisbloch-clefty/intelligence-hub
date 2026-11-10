import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, saveNotes, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { logConcept } from '../lib/graph.js';
import AskChip from './shared/AskChip.jsx';
import Icon from './shared/Icon.jsx';
import './content-inbox.css';
import { SYSTEM_BASE } from '../constants.js';

const INBOX_KEY = 'aether_inbox';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const FILTERS = [
  { id: 'all',     label: 'All',      icon: 'Inbox' },
  { id: 'article', label: 'Articles', icon: 'Newspaper' },
  { id: 'video',   label: 'Videos',   icon: 'Play' },
  { id: 'social',  label: 'Social',   icon: 'MessageSquare' },
  { id: 'note',    label: 'Notes',    icon: 'StickyNote' },
];

const TYPE_ICON  = { article: 'Newspaper', video: 'Play', social: 'MessageSquare', note: 'StickyNote' };

// Capture lineage — what a saved item became, for the traceable trail.
const DERIVED_LABEL = {
  vault:    { icon: 'Landmark',   label: 'Vault note' },
  deepdive: { icon: 'Microscope', label: 'Deep Dive' },
  research: { icon: 'Compass',    label: 'Research' },
  project:  { icon: 'Rocket',     label: 'Project' },
  books:    { icon: 'BookOpen',   label: 'Book' },
  note:     { icon: 'StickyNote', label: 'Note' },
};

function detectType(url) {
  if (!url) return 'note';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'video';
  if (/twitter\.com|x\.com|linkedin\.com|instagram\.com/i.test(url)) return 'social';
  return 'article';
}

function shortHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 30); }
}

export default function ContentInbox() {
  const { notes, setNotes, setPendingArtifact, captureRoute, clearCapture } = useApp();

  const [items, setItems] = useState(() => readLocal(INBOX_KEY, []));

  // Cross-device: pull the server copy after mount.
  useEffect(() => { hydrate(INBOX_KEY).then(r => { if (Array.isArray(r)) setItems(r); }); }, []);
  // Capture-bar route (D1): prefill the add form (URL vs note text).
  useEffect(() => {
    if (captureRoute?.route === 'note') {
      const t = captureRoute.topic || '';
      if (/^https?:\/\//i.test(t)) setUrl(t); else setText(t);
      setTab('add');
      clearCapture?.();
    }
  }, [captureRoute, clearCapture]);
  const [tab,        setTab]        = useState('inbox');
  const [filter,     setFilter]     = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [url,        setUrl]        = useState('');
  const [text,       setText]       = useState('');
  const [title,      setTitle]      = useState('');
  const [analyzing,  setAnalyzing]  = useState(false);
  const [copiedId,   setCopiedId]   = useState(null);
  const [reanalyzing,setReanalyzing]= useState(null);

  const persist = (updated) => {
    setItems(updated);
    writeThrough(INBOX_KEY, updated);
  };

  const analyze = async () => {
    const hasContent = url.trim() || text.trim();
    if (!hasContent || analyzing) return;
    setAnalyzing(true);
    const type = detectType(url.trim());
    const typeLabel = type === 'video' ? 'YouTube/video' : type === 'social' ? 'social post' : 'article/document';

    const prompt = text.trim()
      ? `Analyze this ${typeLabel} content for CB. Provide:\n1. Core thesis (1-2 sentences)\n2. 4 key takeaways, each with an example from the content's own world\n3. Connection to a book on the reader's shelf ONLY if one genuinely applies (otherwise skip)\n4. Decisive action or insight\n\nContent:\n${text.slice(0, 5000)}`
      : `The user saved this ${typeLabel} URL for CB: ${url}\n\nAnalyze based on URL/domain context. Cover:\n1. What this source likely contains and why CB saved it\n2. 3 insights CB should extract if he reads/watches this\n3. How it connects to CB's goals (BD, passive income, longevity, Houston)\n4. Decisive recommendation`;

    try {
      const summary = await callClaude({
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 900,
      });
      const item = {
        id:           uid(),
        title:        title.trim() || (url ? shortHost(url) : (text.slice(0, 55) + '…')),
        url:          url.trim(),
        snippet:      text.trim().slice(0, 200),
        type,
        summary,
        savedAt:      Date.now(),
        inVault:      false,
        derivedInto:  [],   // capture lineage — what this item became
      };
      const updated = [item, ...items];
      persist(updated);
      // Captured content is a concept observation too — connects the inbox into
      // the same graph as research and study.
      logConcept({ topic: item.title, source: item.title, module: 'inbox', refs: item.url ? [item.url] : [] });
      setUrl(''); setText(''); setTitle('');
      setTab('inbox');
      setExpandedId(item.id);
    } catch {
      alert('Analysis failed — check network and try again.');
    }
    setAnalyzing(false);
  };

  const remove = (id) => persist(items.filter(i => i.id !== id));

  const saveToVault = async (item) => {
    const note = {
      id:          uid(),
      title:       `📥 ${item.title}`,
      content:     item.summary,
      tags:        ['inbox', item.type],
      connections: [],
      color:       'var(--accent-text)',
      createdAt:   Date.now(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    await saveNotes(updated);
    // Record the lineage: this captured item became a Vault note.
    persist(items.map(i => i.id === item.id
      ? { ...i, inVault: true, derivedInto: [...(i.derivedInto || []), { module: 'vault', id: note.id, at: Date.now() }] }
      : i));
  };

  const copyToClipboard = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const reanalyze = async (item) => {
    if (reanalyzing) return;
    setReanalyzing(item.id);
    const type = item.type;
    const typeLabel = type === 'video' ? 'YouTube/video' : type === 'social' ? 'social post' : 'article/document';
    const prompt = item.snippet
      ? `Analyze this ${typeLabel} content for CB. Provide:\n1. Core thesis (1-2 sentences)\n2. 4 key takeaways, each with an example from the content's own world\n3. Connection to a book on the reader's shelf ONLY if one genuinely applies (otherwise skip)\n4. Decisive action or insight\n\nContent:\n${item.snippet}`
      : `The user saved this ${typeLabel} URL for CB: ${item.url}\n\nAnalyze based on URL/domain context. Cover:\n1. What this source likely contains and why CB saved it\n2. 3 insights CB should extract if he reads/watches this\n3. How it connects to CB's goals (BD, passive income, longevity, Houston)\n4. Decisive recommendation`;
    try {
      const summary = await callClaude({
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 900,
      });
      persist(items.map(i => i.id === item.id ? { ...i, summary, inVault: false } : i));
    } catch {
      alert('Re-analysis failed — check network and try again.');
    }
    setReanalyzing(null);
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div className="ci">

      {/* Header */}
      <div className="ci-head">
        <div className="ci-eyebrow">Smart Content Inbox</div>
        <div className="ci-title">Capture & Synthesize</div>
        <div className="ci-sub">Save articles, videos, links, or paste text — AI extracts what matters for CB.</div>
      </div>

      {/* Tab bar */}
      <div className="ci-tabs">
        {[{ id: 'inbox', label: `Inbox (${items.length})`, icon: 'Inbox' }, { id: 'add', label: 'Add Content', icon: 'Plus' }].map(t => (
          <button type="button" key={t.id} className="ci-tab tap" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={15} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Add Content ─────────────────────────────────────────────────────── */}
      {tab === 'add' && (
        <div className="ci-add">
          <div className="ci-add-title">Add to Inbox</div>

          <input className="ci-field" value={title} onChange={e => setTitle(e.target.value)}
            aria-label="Title" placeholder="Title (optional — auto-detected)" />

          <input className="ci-field" value={url} onChange={e => setUrl(e.target.value)}
            aria-label="URL" placeholder="URL — article, YouTube, Twitter, LinkedIn, any link…" />

          <div className="ci-or">— or paste content directly —</div>

          <textarea className="ci-field" value={text} onChange={e => setText(e.target.value)}
            aria-label="Content"
            placeholder="Paste article, notes, quotes, email, transcript, or any text…"
            rows={5} />

          <button type="button" className="btn btn-primary tap ci-analyze" onClick={analyze} disabled={analyzing || (!url.trim() && !text.trim())} aria-busy={analyzing || undefined}>
            {analyzing ? <><ThinkingDots color="var(--accent-foreground)" /> Analyzing…</> : <><Icon name="Sparkles" size={15} /> Analyze &amp; Save</>}
          </button>
        </div>
      )}

      {/* ── Inbox ───────────────────────────────────────────────────────────── */}
      {tab === 'inbox' && (
        <>
          {items.length > 0 && (
            <div className="ci-filters">
              {FILTERS.map(f => (
                <button type="button" key={f.id} className="chip tap" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  <Icon name={f.icon} size={14} /> {f.label}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="ci-empty">
              <div className="ci-empty-icon" aria-hidden="true"><Icon name="Inbox" size={36} strokeWidth={1.5} /></div>
              <div className="ci-empty-title">Inbox is Empty</div>
              <div className="ci-empty-sub">Save articles, YouTube videos, tweets, or paste any content. AI extracts the signal so you don't have to dig.</div>
              <button type="button" className="btn btn-primary tap ci-empty-cta" onClick={() => setTab('add')}>Add First Item →</button>
            </div>
          )}

          <div className="ci-list">
            {filtered.map(item => {
              const expanded = expandedId === item.id;
              const toggle = () => setExpandedId(expanded ? null : item.id);
              return (
                <div key={item.id} className="ci-item" data-expanded={expanded ? '' : undefined}>
                  {/* A div, not a button: the header holds its own buttons (host, remove). */}
                  <div className="ci-item-head focus-ring" role="button" tabIndex={0} aria-expanded={expanded} onClick={toggle}
                    onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } }}>
                    <div className="ci-item-row">
                      <span className="ci-type-icon" aria-hidden="true"><Icon name={TYPE_ICON[item.type] || 'FileText'} size="header" /></span>
                      <div className="ci-item-main">
                        <div className="ci-item-title">{item.title}</div>
                        <div className="ci-meta">
                          {item.url && (
                            <button type="button" className="ci-host tap" onClick={e => { e.stopPropagation(); window.open(item.url, '_blank'); }}>
                              ↗ {shortHost(item.url)}
                            </button>
                          )}
                          <span className="ci-date">{new Date(item.savedAt).toLocaleDateString()}</span>
                          <span className="ci-type">{item.type}</span>
                          {item.inVault && <span className="ci-vaulted"><Icon name="Check" size={13} /> Vaulted</span>}
                        </div>
                        {/* Capture lineage — the trail of what this became */}
                        {item.derivedInto?.length > 0 && (
                          <div className="ci-became">
                            <span className="ci-became-label">Became</span>
                            {item.derivedInto.map((d, di) => {
                              const lab = DERIVED_LABEL[d.module];
                              return (
                                <span key={di} className="ci-became-chip">
                                  {lab ? <><Icon name={lab.icon} size={13} /> {lab.label}</> : d.module}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="ci-item-tools">
                        <span className="ci-toggle" aria-hidden="true">
                          <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={13} /> {expanded ? 'Hide' : 'View AI'}
                        </span>
                        <button type="button" className="ci-x tap" onClick={e => { e.stopPropagation(); remove(item.id); }} aria-label={`Remove ${item.title}`}><Icon name="X" size={15} /></button>
                      </div>
                    </div>
                  </div>

                  {expanded && item.summary && (
                    <div className="ci-analysis">
                      <div className="ci-kicker">AI Analysis</div>
                      <MD text={item.summary} color="var(--accent-text)" />
                      <div className="ci-acts">
                        <button type="button" className="ci-act tap" data-done={copiedId === item.id ? '' : undefined} onClick={() => copyToClipboard(item.id, item.summary)}>
                          {copiedId === item.id ? <><Icon name="Check" size={13} /> Copied!</> : 'Copy'}
                        </button>
                        <button type="button" className="ci-act tap" aria-busy={reanalyzing === item.id || undefined} onClick={() => reanalyze(item)}>
                          <Icon name="RefreshCw" size={13} /> {reanalyzing === item.id ? 'Re-analyzing…' : 'Re-analyze'}
                        </button>
                        {!item.inVault && (
                          <button type="button" className="ci-act tap" data-strong="" onClick={() => saveToVault(item)}>
                            <Icon name="Landmark" size={13} /> Save to Vault
                          </button>
                        )}
                        <button type="button" className="ci-act tap" data-strong="" onClick={() => setPendingArtifact({ type: 'aiOutput', title: item.title || item.url || 'Inbox Analysis', content: item.summary, source: 'inbox' })}>
                          <Icon name="Rocket" size={13} /> Save to Project
                        </button>
                        <AskChip type="inbox" object={item} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
