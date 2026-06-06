import { useState } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, uid } from '../utils.js';
import { CB_IDENTITY } from '../constants.js';
import MD from './shared/MD.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const ACCENT        = '#f59e0b';
const ACCENT_BG     = 'rgba(245,158,11,0.07)';
const ACCENT_BORDER = 'rgba(245,158,11,0.22)';

const STATUS_META = {
  thinking: { label: 'Thinking',    color: '#38bdf8' },
  decided:  { label: 'Decided',     color: '#10b981' },
  closed:   { label: 'Archived',    color: 'var(--dim)' },
};

const BLANK_FORM = {
  title: '', context: '', options: ['', '', ''], chosen: 0, reasoning: '', status: 'thinking',
};

function daysAgo(ts) { return Math.floor((Date.now() - ts) / 86_400_000); }

export default function DecisionLog() {
  const { isMobile } = useApp();

  const [decisions, setDecisions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aether_decisions') || '[]'); } catch { return []; }
  });
  const [tab,        setTab]        = useState('log');
  const [expandedId, setExpandedId] = useState(null);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [patterns,   setPatterns]   = useState('');
  const [aiLoading,  setAiLoading]  = useState(false);

  const persist = (updated) => {
    setDecisions(updated);
    localStorage.setItem('aether_decisions', JSON.stringify(updated));
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
        system: CB_IDENTITY,
        messages: [{ role: 'user', content: `Analyze CB's decision log for patterns and quality. Provide:\n1. CB's decision-making strengths\n2. Cognitive biases or blind spots you detect\n3. Patterns in what CB avoids vs favors\n4. Quality of reasoning (evidence, mental models used)\n5. Three specific, actionable recommendations to sharpen CB's decision quality\n\nDecisions log:\n${summary}` }],
        maxTokens: 1100,
      });
      setPatterns(result);
    } catch {
      setPatterns('Analysis failed — try again.');
    }
    setAiLoading(false);
  };

  const reviewDue = decisions.filter(d =>
    d.status === 'decided' && d.decidedAt && daysAgo(d.decidedAt) >= 28
  );

  const setOption = (i, val) => setForm(p => ({ ...p, options: p.options.map((o, j) => j === i ? val : o) }));

  return (
    <div style={{ padding: isMobile ? '16px 16px 80px' : '24px 28px 60px', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 10 : 9, letterSpacing: 4, color: ACCENT, textTransform: 'uppercase', marginBottom: 6 }}>Decision Log</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Decisions That Compound</div>
        <div style={{ fontSize: 11, color: 'var(--subtle)' }}>Track every significant decision. Review outcomes. Let AI surface your patterns.</div>
      </div>

      {/* Review due banner */}
      {reviewDue.length > 0 && (
        <div style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>⏰</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{reviewDue.length} decision{reviewDue.length > 1 ? 's' : ''} ready for 30-day review</div>
            <div style={{ fontSize: 10, color: 'var(--dim)' }}>How did they turn out? Record the outcome to build your pattern library.</div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'log',      label: `📋 Log (${decisions.length})` },
          { id: 'new',      label: '+ Log Decision' },
          { id: 'patterns', label: '✦ AI Patterns' },
        ].map(t => (
          <div key={t.id}
            onClick={() => t.id === 'patterns' ? analyzePatterns() : setTab(t.id)}
            style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 10, cursor: 'pointer', border: `1px solid ${tab === t.id ? ACCENT : 'var(--border)'}`, background: tab === t.id ? ACCENT_BG : 'var(--surface)', color: tab === t.id ? ACCENT : 'var(--muted)', transition: 'all 0.12s' }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── New Decision Form ──────────────────────────────────────────────── */}
      {tab === 'new' && (
        <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 14, padding: '20px 22px' }}>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Decision title (e.g. 'Take on the new contract')"
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '12px 14px' : '10px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, minHeight: isMobile ? 44 : undefined }} />

          <textarea value={form.context} onChange={e => setForm(p => ({ ...p, context: e.target.value }))}
            placeholder="Context — what's the situation? What's at stake? What constraints exist?"
            rows={3}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '12px 14px' : '9px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 14, minHeight: isMobile ? 44 : undefined }} />

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Options — click radio to mark your chosen option</div>
          {form.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div onClick={() => setForm(p => ({ ...p, chosen: i }))}
                style={{ width: isMobile ? 22 : 18, height: isMobile ? 22 : 18, borderRadius: '50%', border: `2px solid ${form.chosen === i ? ACCENT : 'var(--border)'}`, background: form.chosen === i ? ACCENT : 'transparent', flexShrink: 0, cursor: 'pointer', transition: 'all 0.12s' }} />
              <input value={opt} onChange={e => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`}
                style={{ flex: 1, background: 'var(--bg)', border: `1px solid ${form.chosen === i ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 8, padding: isMobile ? '12px 14px' : '8px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 12, outline: 'none', fontFamily: 'inherit', minHeight: isMobile ? 44 : undefined }} />
            </div>
          ))}

          <textarea value={form.reasoning} onChange={e => setForm(p => ({ ...p, reasoning: e.target.value }))}
            placeholder="Your reasoning — why this option? Mental models? Long-game view?"
            rows={3}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? '12px 14px' : '9px 12px', color: 'var(--text-b)', fontSize: isMobile ? 14 : 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginTop: 14, marginBottom: 14, minHeight: isMobile ? 44 : undefined }} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ id: 'thinking', label: '🤔 Still Deciding' }, { id: 'decided', label: '✅ Already Decided' }].map(s => (
              <div key={s.id} onClick={() => setForm(p => ({ ...p, status: s.id }))}
                style={{ padding: isMobile ? '10px 16px' : '7px 14px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: `1px solid ${form.status === s.id ? ACCENT : 'var(--border)'}`, background: form.status === s.id ? ACCENT_BG : 'transparent', color: form.status === s.id ? ACCENT : 'var(--subtle)', transition: 'all 0.12s', minHeight: isMobile ? 44 : 34 }}>
                {s.label}
              </div>
            ))}
          </div>

          <button onClick={addDecision} disabled={!form.title.trim()}
            style={{ width: '100%', padding: isMobile ? '14px 16px' : '12px', background: form.title.trim() ? ACCENT : 'var(--bord2)', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, color: form.title.trim() ? '#000' : 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Log Decision →
          </button>
        </div>
      )}

      {/* ── AI Patterns ────────────────────────────────────────────────────── */}
      {tab === 'patterns' && (
        <div style={{ background: 'var(--surface)', border: `1px solid ${ACCENT_BORDER}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: isMobile ? 10 : 9, letterSpacing: 3, color: ACCENT, textTransform: 'uppercase', marginBottom: 14 }}>AI Pattern Analysis</div>
          {aiLoading
            ? <ThinkingDots color={ACCENT} />
            : patterns
              ? <>
                  <MD text={patterns} color={ACCENT} />
                  <div onClick={() => { setPatterns(''); analyzePatterns(); }}
                    style={{ marginTop: 14, fontSize: 10, color: 'var(--subtle)', cursor: 'pointer', textDecoration: 'underline' }}>
                    Refresh analysis
                  </div>
                </>
              : <div style={{ fontSize: 12, color: 'var(--dim)' }}>Log at least 3 decisions to unlock pattern analysis.</div>
          }
        </div>
      )}

      {/* ── Decision Log ───────────────────────────────────────────────────── */}
      {tab === 'log' && (
        <>
          {decisions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>No Decisions Logged</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 20 }}>Log every significant decision — big and small. The compound insight comes from reviewing them over time.</div>
              <div onClick={() => setTab('new')} style={{ display: 'inline-block', padding: '10px 22px', background: ACCENT, borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Log First Decision →</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {decisions.map(d => {
              const expanded = expandedId === d.id;
              const meta     = STATUS_META[d.status] || STATUS_META.thinking;
              const days     = d.decidedAt ? daysAgo(d.decidedAt) : null;
              const reviewReady = d.status === 'decided' && days !== null && days >= 28;

              return (
                <div key={d.id} style={{ background: 'var(--surface)', border: `1px solid ${expanded ? ACCENT_BORDER : reviewReady ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                  <div style={{ padding: '13px 16px', cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : d.id)}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5, lineHeight: 1.3 }}>{d.title}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: isMobile ? 10 : 9, padding: '2px 8px', background: `${meta.color}15`, color: meta.color, borderRadius: 4, fontWeight: 600 }}>{meta.label}</span>
                          <span style={{ fontSize: 10, color: 'var(--dim)' }}>{new Date(d.createdAt).toLocaleDateString()}</span>
                          {days !== null && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{days}d since decision</span>}
                          {reviewReady && <span style={{ fontSize: isMobile ? 10 : 9, color: ACCENT, fontWeight: 700 }}>⏰ Review ready</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: 'var(--subtle)', display: 'inline-block', transform: `rotate(${expanded ? 180 : 0}deg)`, transition: 'transform 0.2s' }}>▼</span>
                        <div onClick={e => { e.stopPropagation(); remove(d.id); }} style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer', padding: '2px 4px' }}>✕</div>
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ borderTop: '1px solid var(--bord2)', padding: '14px 16px' }}>
                      {d.context && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: isMobile ? 10 : 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Context</div>
                          <div style={{ fontSize: 11, color: 'var(--text-c)', lineHeight: 1.7 }}>{d.context}</div>
                        </div>
                      )}

                      {d.options.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: isMobile ? 10 : 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Options</div>
                          {d.options.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, padding: '7px 12px', background: i === d.chosen ? ACCENT_BG : 'var(--bg)', border: `1px solid ${i === d.chosen ? ACCENT_BORDER : 'var(--border)'}`, borderRadius: 8 }}>
                              <span style={{ fontSize: 12, color: i === d.chosen ? ACCENT : 'var(--dim)' }}>{i === d.chosen ? '✓' : '○'}</span>
                              <span style={{ fontSize: 11, color: i === d.chosen ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{opt}</span>
                              {i === d.chosen && <span style={{ fontSize: isMobile ? 10 : 9, color: ACCENT, fontWeight: 700 }}>CHOSEN</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {d.reasoning && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: isMobile ? 10 : 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Reasoning</div>
                          <div style={{ fontSize: 11, color: 'var(--text-c)', lineHeight: 1.7 }}>{d.reasoning}</div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {d.status === 'thinking' && (
                          <div onClick={() => updateStatus(d.id, 'decided')}
                            style={{ padding: isMobile ? '10px 16px' : '5px 13px', fontSize: 10, fontWeight: 700, borderRadius: 7, cursor: 'pointer', background: '#10b98115', border: '1px solid #10b98130', color: '#10b981', minHeight: isMobile ? 44 : 34 }}>
                            ✓ Mark Decided
                          </div>
                        )}
                        {d.status !== 'closed' && (
                          <div onClick={() => updateStatus(d.id, 'closed')}
                            style={{ padding: isMobile ? '10px 16px' : '5px 13px', fontSize: 10, fontWeight: 600, borderRadius: 7, cursor: 'pointer', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--subtle)', minHeight: isMobile ? 44 : 34 }}>
                            Archive
                          </div>
                        )}
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
