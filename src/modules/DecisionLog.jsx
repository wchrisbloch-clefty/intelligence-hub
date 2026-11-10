import { useState, useEffect } from 'react';
import { callClaude, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { SYSTEM_BASE } from '../constants.js';

const DECISIONS_KEY = 'aether_decisions';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import { SectionEmpty } from './shared/SectionState.jsx';
import Icon from './shared/Icon.jsx';
import AskChip from './shared/AskChip.jsx';
import './decision-log.css';

const STATUS_META = {
  thinking: { label: 'Thinking',    color: 'var(--accent-text)' },
  decided:  { label: 'Decided',     color: 'var(--accent-text)' },
  closed:   { label: 'Archived',    color: 'var(--dim)' },
};

const BLANK_FORM = {
  title: '', context: '', options: ['', '', ''], chosen: 0, reasoning: '', status: 'thinking',
};

function daysAgo(ts) { return Math.floor((Date.now() - ts) / 86_400_000); }

export default function DecisionLog() {
  const [decisions, setDecisions] = useState(() => readLocal(DECISIONS_KEY, []));

  // Cross-device: pull the server copy after mount.
  useEffect(() => { hydrate(DECISIONS_KEY).then(r => { if (Array.isArray(r)) setDecisions(r); }); }, []);
  const [tab,          setTab]          = useState('log');
  const [expandedId,   setExpandedId]   = useState(null);
  const [form,         setForm]         = useState(BLANK_FORM);
  const [patterns,     setPatterns]     = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);
  const [decisionAI,   setDecisionAI]   = useState({}); // { [id]: string }
  const [decisionAILoading, setDecisionAILoading] = useState(null);

  const persist = (updated) => {
    setDecisions(updated);
    writeThrough(DECISIONS_KEY, updated);
  };

  const addDecision = () => {
    if (!form.title.trim()) return;
    const d = {
      id:         uid(),
      title:      form.title,
      context:    form.context,
      options:    form.options.filter(o => o.trim()),
      chosen:     form.chosen,
      reasoning:  form.reasoning,
      status:     form.status,
      createdAt:  Date.now(),
      decidedAt:  form.status === 'decided' ? Date.now() : null,
    };
    persist([d, ...decisions]);
    setForm(BLANK_FORM);
    setTab('log');
    setExpandedId(d.id);
  };

  const updateStatus = (id, status) => {
    persist(decisions.map(d => d.id === id
      ? { ...d, status, decidedAt: status === 'decided' && !d.decidedAt ? Date.now() : d.decidedAt }
      : d
    ));
  };

  const remove = (id) => {
    persist(decisions.filter(d => d.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const analyzePatterns = async () => {
    if (decisions.length === 0) return;
    setTab('patterns');
    if (patterns) return; // cache
    setAiLoading(true);
    const summary = decisions.map(d =>
      `Title: ${d.title}\nContext: ${d.context}\nOptions: ${d.options.join(' | ')}\nChosen: ${d.options[d.chosen] || '—'}\nReasoning: ${d.reasoning}\nStatus: ${d.status}`
    ).join('\n\n---\n\n');
    try {
      const result = await callClaude({
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: `Analyze CB's decision log for patterns and quality. Provide:\n1. CB's decision-making strengths\n2. Cognitive biases or blind spots you detect\n3. Patterns in what CB avoids vs favors\n4. Quality of reasoning (evidence, mental models used)\n5. Three specific, actionable recommendations to sharpen CB's decision quality\n\nDecisions log:\n${summary}` }],
        maxTokens: 1100,
      });
      setPatterns(result);
    } catch {
      setPatterns('Analysis failed — try again.');
    }
    setAiLoading(false);
  };

  const analyzeDecision = async (d) => {
    if (decisionAI[d.id] || decisionAILoading === d.id) return;
    setDecisionAILoading(d.id);
    const prompt = `Analyze this specific decision for CB and give actionable feedback:\n\nTitle: ${d.title}\nContext: ${d.context || 'Not provided'}\nOptions considered: ${d.options.join(' | ') || 'Not listed'}\nChosen option: ${d.options[d.chosen] || '—'}\nReasoning: ${d.reasoning || 'Not provided'}\nStatus: ${d.status}\n\nProvide:\n1. Quality of reasoning (strengths and blind spots)\n2. What mental models apply here\n3. Risks or second-order effects CB may not have considered\n4. A decisive recommendation or validation`;
    try {
      const result = await callClaude({
        system: SYSTEM_BASE,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 800,
      });
      setDecisionAI(prev => ({ ...prev, [d.id]: result }));
    } catch {
      setDecisionAI(prev => ({ ...prev, [d.id]: 'Analysis failed — try again.' }));
    }
    setDecisionAILoading(null);
  };

  const reviewDue = decisions.filter(d =>
    d.status === 'decided' && d.decidedAt && daysAgo(d.decidedAt) >= 28
  );

  const setOption = (i, val) => setForm(p => ({ ...p, options: p.options.map((o, j) => j === i ? val : o) }));

  const toggleCard = (id, expanded) => setExpandedId(expanded ? null : id);

  return (
    <div className="dl">

      {/* Header */}
      <div className="dl-head">
        <div className="dl-eyebrow">Decision Log</div>
        <div className="dl-title">Decisions That Compound</div>
        <div className="dl-lede">Track every significant decision. Review outcomes. Let AI surface your patterns.</div>
      </div>

      {/* Review due banner */}
      {reviewDue.length > 0 && (
        <div className="dl-banner" role="status">
          <Icon name="Clock" size={20} />
          <div>
            <div className="dl-banner-title">{reviewDue.length} decision{reviewDue.length > 1 ? 's' : ''} ready for 30-day review</div>
            <div className="dl-banner-sub">How did they turn out? Record the outcome to build your pattern library.</div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="dl-tabs" role="tablist">
        {[
          { id: 'log',      icon: 'ClipboardList', label: `Log (${decisions.length})` },
          { id: 'new',      label: '+ Log Decision' },
          { id: 'patterns', label: '✦ AI Patterns' },
        ].map(t => (
          <button type="button" role="tab" key={t.id} className="dl-tab tap" aria-selected={tab === t.id}
            onClick={() => t.id === 'patterns' ? analyzePatterns() : setTab(t.id)}>
            {t.icon && <Icon name={t.icon} size={15} />}{t.label}
          </button>
        ))}
      </div>

      {/* ── New Decision Form ──────────────────────────────────────────────── */}
      {tab === 'new' && (
        <div className="dl-panel">
          <input className="dl-input" data-title="" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && form.title.trim()) addDecision(); }}
            placeholder="Decision title (e.g. 'Take on the new contract')" aria-label="Decision title" />

          <textarea className="dl-input dl-textarea" data-ctx="" value={form.context} onChange={e => setForm(p => ({ ...p, context: e.target.value }))}
            placeholder="Context — what's the situation? What's at stake? What constraints exist?"
            aria-label="Context" rows={3} />

          <div className="dl-opts-label" id="dl-opts-label">Options — click radio to mark your chosen option</div>
          <div role="radiogroup" aria-labelledby="dl-opts-label">
            {form.options.map((opt, i) => (
              <div key={i} className="dl-opt">
                <button type="button" role="radio" className="dl-radio tap" aria-checked={form.chosen === i}
                  aria-label={`Choose option ${i + 1}`} onClick={() => setForm(p => ({ ...p, chosen: i }))} />
                <input className="dl-input" data-opt="" data-chosen={form.chosen === i ? '' : undefined} value={opt} onChange={e => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`} aria-label={`Option ${i + 1}`} />
              </div>
            ))}
          </div>

          <textarea className="dl-input dl-textarea" data-why="" value={form.reasoning} onChange={e => setForm(p => ({ ...p, reasoning: e.target.value }))}
            placeholder="Your reasoning — why this option? Mental models? Long-game view?"
            aria-label="Reasoning" rows={3} />

          <div className="dl-seg">
            {[{ id: 'thinking', icon: 'Brain', label: 'Still Deciding' }, { id: 'decided', icon: 'Check', label: 'Already Decided' }].map(s => (
              <button type="button" key={s.id} className="dl-choice tap" aria-pressed={form.status === s.id}
                onClick={() => setForm(p => ({ ...p, status: s.id }))}>
                <Icon name={s.icon} size={15} /> {s.label}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-primary dl-submit tap" onClick={addDecision} disabled={!form.title.trim()}>
            Log Decision →
          </button>
        </div>
      )}

      {/* ── AI Patterns ────────────────────────────────────────────────────── */}
      {tab === 'patterns' && (
        <div className="dl-panel">
          <div className="dl-eyebrow dl-eyebrow-gap" data-tight="">AI Pattern Analysis</div>
          {aiLoading
            ? <ThinkingDots color="var(--accent-text)" />
            : patterns
              ? <>
                  <MD text={patterns} color="var(--accent-text)" />
                  <button type="button" className="dl-link tap" onClick={() => { setPatterns(''); analyzePatterns(); }}>
                    Refresh analysis
                  </button>
                </>
              : <div className="dl-quiet">Log at least 3 decisions to unlock pattern analysis.</div>
          }
        </div>
      )}

      {/* ── Decision Log ───────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <>
          {decisions.length === 0 && (
            <SectionEmpty what="No decisions logged"
              how="Log every significant decision — big and small. The compound insight comes from reviewing them over time."
              actionLabel="Log First Decision →" onAction={() => setTab('new')} />
          )}

          <div className="dl-list">
            {decisions.map(d => {
              const expanded = expandedId === d.id;
              const meta     = STATUS_META[d.status] || STATUS_META.thinking;
              const days     = d.decidedAt ? daysAgo(d.decidedAt) : null;
              const reviewReady = d.status === 'decided' && days !== null && days >= 28;

              return (
                <div key={d.id} className="dl-card" data-open={expanded ? '' : undefined} data-review={reviewReady ? '' : undefined}>
                  {/* A div, not a button: it holds the Ask + delete buttons. */}
                  <div className="dl-card-head focus-ring" role="button" tabIndex={0} aria-expanded={expanded}
                    onClick={() => toggleCard(d.id, expanded)}
                    onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleCard(d.id, expanded); } }}>
                    <div className="dl-card-row">
                      <div className="dl-card-main">
                        <div className="dl-card-title">{d.title}</div>
                        <div className="dl-meta">
                          <span className="dl-status" data-status={d.status}>{meta.label}</span>
                          <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                          {days !== null && <span>{days}d since decision</span>}
                          {reviewReady && <span className="dl-review"><Icon name="Clock" size={13} /> Review ready</span>}
                        </div>
                      </div>
                      <div className="dl-card-tools">
                        <AskChip type="decision" object={d} />
                        <span className="dl-chev" aria-hidden="true"><Icon name="ChevronDown" size={16} /></span>
                        <button type="button" className="dl-x tap" aria-label={`Delete decision: ${d.title}`}
                          onClick={e => { e.stopPropagation(); remove(d.id); }} onKeyDown={e => e.stopPropagation()}>
                          <Icon name="X" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="dl-body">
                      {d.context && (
                        <div className="dl-sec">
                          <div className="dl-sec-label">Context</div>
                          <div className="dl-sec-text">{d.context}</div>
                        </div>
                      )}

                      {d.options.length > 0 && (
                        <div className="dl-sec">
                          <div className="dl-sec-label" data-gap="">Options</div>
                          {d.options.map((opt, i) => (
                            <div key={i} className="dl-optrow" data-chosen={i === d.chosen ? '' : undefined}>
                              <span className="dl-optrow-mark">{i === d.chosen ? '✓' : '○'}</span>
                              <span className="dl-optrow-text">{opt}</span>
                              {i === d.chosen && <span className="dl-chosen">CHOSEN</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {d.reasoning && (
                        <div className="dl-sec" data-last="">
                          <div className="dl-sec-label">Reasoning</div>
                          <div className="dl-sec-text">{d.reasoning}</div>
                        </div>
                      )}

                      <div className="dl-actions">
                        {d.status === 'thinking' && (
                          <button type="button" className="dl-act tap" data-tone="accent" onClick={() => updateStatus(d.id, 'decided')}>
                            ✓ Mark Decided
                          </button>
                        )}
                        {d.status !== 'closed' && (
                          <button type="button" className="dl-act tap" onClick={() => updateStatus(d.id, 'closed')}>
                            Archive
                          </button>
                        )}
                        {!decisionAI[d.id] && (
                          <button type="button" className="dl-act tap" data-tone="accent" onClick={() => analyzeDecision(d)}
                            aria-busy={decisionAILoading === d.id || undefined}>
                            {decisionAILoading === d.id ? <><ThinkingDots color="var(--accent-text)" /> Analyzing…</> : '✦ Get AI Feedback'}
                          </button>
                        )}
                      </div>

                      {decisionAI[d.id] && (
                        <div className="dl-analysis">
                          <div className="dl-eyebrow">AI Decision Analysis</div>
                          <MD text={decisionAI[d.id]} color="var(--accent-text)" />
                          <button type="button" className="dl-link tap" onClick={() => setDecisionAI(prev => { const n = { ...prev }; delete n[d.id]; return n; })}>
                            Clear analysis
                          </button>
                        </div>
                      )}
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
