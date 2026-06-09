import { useState, useRef, useCallback } from 'react';
import { useApp } from '../App.jsx';
import { saveProjects, uid, callClaude, processFiles, getFileIcon, timeAgo } from '../utils.js';
import { PROJECT_CATEGORIES, PROJECT_STATUSES, CB_IDENTITY, ACCEPT_TYPES } from '../constants.js';
import { Badge, Label, Modal, ThinkingDots } from './shared/Common.jsx';
import MD from './shared/MD.jsx';

// Adds default workspace fields to old or new projects
const def = p => ({
  notes: '',
  process: { rawText: '', stages: [], generatedAt: null },
  artifacts: [],
  personas: [],
  ...p,
});

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'process',  label: 'Process' },
  { id: 'notes',    label: 'Notes' },
  { id: 'files',    label: 'Files & Artifacts' },
  { id: 'personas', label: 'Personas / ICP' },
];

// ─── Root list (kanban) ───────────────────────────────────────────────────────
export default function ProjectsOS() {
  const { projects, setProjects, isMobile, isPhone } = useApp();
  const [activeId, setActiveId]   = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [newProj, setNewProj]     = useState({ title: '', emoji: '🚀', description: '', category: 'business', priority: 'high' });
  const [statusFilter, setStatusFilter] = useState('all');

  const persist = async updated => { setProjects(updated); await saveProjects(updated); };

  const createProject = async () => {
    if (!newProj.title.trim()) return;
    const p = def({
      id: uid(), title: newProj.title, emoji: newProj.emoji || '🚀',
      status: 'planning', category: newProj.category,
      color: PROJECT_CATEGORIES[newProj.category]?.color || '#00FFB2',
      description: newProj.description, milestones: [], connections: [],
      blueOcean: '', createdAt: Date.now(), updatedAt: Date.now(), priority: newProj.priority,
    });
    await persist([...projects, p]);
    setNewProj({ title: '', emoji: '🚀', description: '', category: 'business', priority: 'high' });
    setShowNew(false);
    setActiveId(p.id);
  };

  const updateProject = async (id, patch) => {
    const updated = projects.map(p => p.id === id ? { ...def(p), ...patch, updatedAt: Date.now() } : p);
    await persist(updated);
  };

  const deleteProject = async id => {
    await persist(projects.filter(p => p.id !== id));
    setActiveId(null);
  };

  if (activeId) {
    const proj = projects.find(p => p.id === activeId);
    if (!proj) { setActiveId(null); return null; }
    return (
      <ProjectWorkspace
        proj={def(proj)}
        onBack={() => setActiveId(null)}
        onUpdate={patch => updateProject(proj.id, patch)}
        onDelete={() => deleteProject(proj.id)}
      />
    );
  }

  return (
    <div style={{ padding: isMobile ? '16px 16px 60px' : '24px 28px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 4, color: '#ff8844', textTransform: 'uppercase', marginBottom: 6 }}>Projects & Execution OS</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>Your Projects</div>
          <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{projects.filter(p => p.status === 'active').length} active · {projects.length} total</div>
        </div>
        <div onClick={() => setShowNew(true)} style={{ padding: '8px 16px', background: '#ff8844', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ New Project</div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {[{ id: 'all', label: 'All', color: 'var(--subtle)' }, ...PROJECT_STATUSES].map(s => (
          <div key={s.id} onClick={() => setStatusFilter(s.id)}
            style={{ padding: isMobile ? '9px 14px' : '5px 14px', fontSize: 10, border: `1px solid ${statusFilter === s.id ? s.color : 'var(--bord2)'}`, color: statusFilter === s.id ? s.color : 'var(--subtle)', borderRadius: 20, cursor: 'pointer', background: statusFilter === s.id ? `${s.color}15` : 'transparent', minHeight: isMobile ? 40 : undefined }}>
            {s.label} ({s.id === 'all' ? projects.length : projects.filter(p => p.status === s.id).length})
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16 }}>
        {PROJECT_STATUSES.map(status => {
          const cols = projects.filter(p => p.status === status.id);
          return (
            <div key={status.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: status.color, textTransform: 'uppercase' }}>{status.label}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', background: 'var(--surface)', borderRadius: 10, padding: '1px 7px' }}>{cols.length}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cols.map(proj => {
                  const p = def(proj);
                  const done = p.milestones.filter(m => m.done).length;
                  const pct = p.milestones.length > 0 ? Math.round((done / p.milestones.length) * 100) : 0;
                  const cat = PROJECT_CATEGORIES[p.category];
                  return (
                    <div key={p.id} onClick={() => setActiveId(p.id)}
                      style={{ padding: '14px', background: 'var(--surface)', border: `1px solid ${p.color}20`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 18 }}>{p.emoji}</div>
                        <Badge color={cat?.color || 'var(--subtle)'}>{cat?.label || 'Other'}</Badge>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.35 }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</div>
                      {p.milestones.length > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 9, color: 'var(--dim)' }}>{done}/{p.milestones.length} milestones</div>
                            <div style={{ fontSize: 9, color: p.color }}>{pct}%</div>
                          </div>
                          <div style={{ background: 'var(--border)', borderRadius: 2, height: 2 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: 2 }} />
                          </div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {p.artifacts?.length > 0 && <div style={{ fontSize: 8, color: 'var(--dim)' }}>📎 {p.artifacts.length}</div>}
                        {p.personas?.length > 0 && <div style={{ fontSize: 8, color: 'var(--dim)' }}>👤 {p.personas.length}</div>}
                        {p.process?.stages?.length > 0 && <div style={{ fontSize: 8, color: 'var(--dim)' }}>⚙ {p.process.stages.length} stages</div>}
                        {p.priority === 'high' && <div style={{ marginLeft: 'auto', fontSize: 8, color: '#ff6644' }}>▲ HIGH</div>}
                      </div>
                    </div>
                  );
                })}
                {cols.length === 0 && (
                  <div style={{ padding: '20px 12px', border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 10, color: 'var(--dim)' }}>
                    {status.id === 'planning' ? 'Add a project' : 'Empty'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewProjectModal onClose={() => setShowNew(false)} onCreate={createProject}
          val={newProj} setVal={setNewProj} isMobile={isMobile} />
      )}
    </div>
  );
}

// ─── Project Workspace ────────────────────────────────────────────────────────
function ProjectWorkspace({ proj, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState('overview');
  const { isMobile, isPhone } = useApp();
  const statusConfig = PROJECT_STATUSES.find(s => s.id === proj.status);
  const cat = PROJECT_CATEGORIES[proj.category];
  const done = proj.milestones.filter(m => m.done).length;
  const pct = proj.milestones.length > 0 ? Math.round((done / proj.milestones.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Sticky header */}
      <div style={{ padding: isMobile ? '12px 16px 0' : '16px 28px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div onClick={onBack} style={{ fontSize: 10, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 10 }}>← All Projects</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <div style={{ fontSize: 26, flexShrink: 0 }}>{proj.emoji}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isPhone ? 15 : 18, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", lineHeight: 1.2, marginBottom: 5 }}>{proj.title}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <Badge color={cat?.color || 'var(--subtle)'}>{cat?.label || 'Other'}</Badge>
                <Badge color={statusConfig?.color || 'var(--subtle)'}>{proj.status}</Badge>
                {proj.priority === 'high' && <Badge color="#ff6644">high priority</Badge>}
                {proj.milestones.length > 0 && <Badge color={proj.color}>{pct}%</Badge>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
            {PROJECT_STATUSES.map(s => (
              <div key={s.id} onClick={() => onUpdate({ status: s.id })}
                style={{ padding: '4px 9px', fontSize: 9, border: `1px solid ${proj.status === s.id ? s.color : 'var(--border)'}`, color: proj.status === s.id ? s.color : 'var(--subtle)', borderRadius: 6, cursor: 'pointer', background: proj.status === s.id ? `${s.color}12` : 'transparent', whiteSpace: 'nowrap' }}>
                {s.label}
              </div>
            ))}
            <div onClick={() => { if (confirm('Delete this project?')) onDelete(); }}
              style={{ padding: '4px 9px', fontSize: 9, border: '1px solid #ff444440', color: '#ff4444', borderRadius: 6, cursor: 'pointer' }}>
              Delete
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {WORKSPACE_TABS.map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '8px 14px', fontSize: 11, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? proj.color : 'var(--subtle)', borderBottom: `2px solid ${tab === t.id ? proj.color : 'transparent'}`, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: isMobile ? '16px 16px 80px' : '24px 28px 80px', maxWidth: 820, margin: '0 auto' }}>
        {tab === 'overview' && <OverviewTab proj={proj} pct={pct} done={done} onUpdate={onUpdate} />}
        {tab === 'process'  && <ProcessTab proj={proj} onUpdate={onUpdate} />}
        {tab === 'notes'    && <NotesTab proj={proj} onUpdate={onUpdate} />}
        {tab === 'files'    && <FilesTab proj={proj} onUpdate={onUpdate} />}
        {tab === 'personas' && <PersonasTab proj={proj} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ proj, pct, done, onUpdate }) {
  const [newMilestone, setNewMilestone] = useState('');
  const [aiMode, setAiMode]   = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { isMobile, setChatPrefill, setChatOpen } = useApp();

  const runAI = async mode => {
    if (aiMode === mode) { setAiMode(''); return; }
    setAiMode(mode); setAiResult(''); setAiLoading(true);
    const prompts = {
      brief:      `Strategic brief for this project. Current status, what's working, biggest risk, single most important next action.\n\nProject: ${proj.title}\nDescription: ${proj.description}\nStatus: ${proj.status}\nMilestones (${done}/${proj.milestones.length} done): ${proj.milestones.map(m => `${m.done ? '✓' : '○'} ${m.text}`).join(', ') || 'none'}\nProcess stages: ${proj.process?.stages?.map(s => s.name).join(', ') || 'not yet built'}\nPersonas defined: ${proj.personas?.length || 0}`,
      obstacles:  `Top 3 obstacles CB will face on this project + one concrete mitigation each. Specific to BD professional in Houston TX.\n\nProject: ${proj.title}\nDescription: ${proj.description}`,
      blueocean:  `Blue Ocean angle — uncontested space, contrarian insight, asymmetric edge most people miss.\n\nProject: ${proj.title}\nDescription: ${proj.description}`,
      nextmoves:  `Top 3 highest-leverage moves to make THIS WEEK on this project. Specific, tactical, no fluff.\n\nProject: ${proj.title}\nStatus: ${proj.status}\nMilestones done: ${done}/${proj.milestones.length}\nProcess stages: ${proj.process?.stages?.length || 0}`,
    };
    try {
      const r = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompts[mode] }], maxTokens: 800 });
      setAiResult(r);
    } catch { setAiResult('Network error — try again.'); }
    setAiLoading(false);
  };

  const saveAiToFiles = () => {
    if (!aiResult) return;
    const labels = { brief: 'Strategy Brief', obstacles: 'Obstacles & Mitigations', blueocean: 'Blue Ocean Angle', nextmoves: 'Top Moves This Week' };
    const artifact = { id: uid(), type: 'aiOutput', title: labels[aiMode] || 'AI Output', content: aiResult, source: 'project-ai', createdAt: Date.now() };
    onUpdate({ artifacts: [...(proj.artifacts || []), artifact] });
  };

  const toggleMilestone = mid => onUpdate({ milestones: proj.milestones.map(m => m.id === mid ? { ...m, done: !m.done } : m) });
  const deleteMilestone = mid => onUpdate({ milestones: proj.milestones.filter(m => m.id !== mid) });
  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    onUpdate({ milestones: [...proj.milestones, { id: uid(), text: newMilestone.trim(), done: false }] });
    setNewMilestone('');
  };

  return (
    <div>
      {proj.description && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>{proj.description}</div>}

      {proj.milestones.length > 0 && (
        <div style={{ padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${proj.color}20`, borderRadius: 10, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Label>Progress</Label>
            <div style={{ fontSize: 15, fontWeight: 800, color: proj.color, fontFamily: "'Fraunces', serif" }}>{pct}%</div>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 3, height: 5, marginBottom: 8 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${proj.color}, ${proj.color}80)`, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{done} of {proj.milestones.length} milestones complete</div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <Label>Milestones</Label>
        {proj.milestones.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', background: 'var(--surface)', border: `1px solid ${m.done ? proj.color + '30' : 'var(--border)'}`, borderRadius: 8, marginBottom: 6 }}>
            <div onClick={() => toggleMilestone(m.id)}
              style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${m.done ? proj.color : 'var(--dim)'}`, background: m.done ? proj.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer' }}>
              {m.done && <span style={{ fontSize: 7, color: '#000', fontWeight: 900 }}>✓</span>}
            </div>
            <div style={{ flex: 1, fontSize: 12, color: m.done ? 'var(--subtle)' : 'var(--text-b)', textDecoration: m.done ? 'line-through' : 'none', lineHeight: 1.5 }}>{m.text}</div>
            <div onClick={() => deleteMilestone(m.id)} style={{ fontSize: 10, color: 'var(--dim)', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>✕</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMilestone()}
            placeholder="Add milestone..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={addMilestone}
            style={{ padding: '9px 14px', background: proj.color, border: 'none', borderRadius: 8, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </div>
      </div>

      {proj.connections?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Label>Knowledge Connections</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {proj.connections.map(c => (
              <div key={c} style={{ fontSize: 10, padding: '5px 12px', background: 'var(--surface)', border: '1px solid #00FFB225', color: '#00FFB2', borderRadius: 20 }}>📚 {c}</div>
            ))}
          </div>
        </div>
      )}

      {proj.blueOcean && (
        <div style={{ padding: '12px 14px', background: '#6366F108', border: '1px solid #6366F130', borderRadius: 10, marginBottom: 24 }}>
          <Label color="#6366F1">🌊 Blue Ocean Insight</Label>
          <div style={{ fontSize: 12, color: 'var(--text-c)', lineHeight: 1.7 }}>{proj.blueOcean}</div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <Label>✦ AI Project Intelligence</Label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { id: 'brief',     label: '📋 Strategy Brief' },
            { id: 'obstacles', label: '⚠ Obstacles' },
            { id: 'blueocean', label: '🌊 Blue Ocean' },
            { id: 'nextmoves', label: '⚡ Top Moves This Week' },
          ].map(btn => (
            <div key={btn.id} onClick={() => runAI(btn.id)}
              style={{ padding: '6px 13px', fontSize: 11, fontWeight: 600, border: `1px solid ${aiMode === btn.id ? proj.color : 'var(--border)'}`, borderRadius: 8, color: aiMode === btn.id ? proj.color : 'var(--subtle)', background: aiMode === btn.id ? `${proj.color}12` : 'var(--surface)', cursor: 'pointer' }}>
              {btn.label}
            </div>
          ))}
          <div onClick={() => { setChatPrefill(`Help me with my project: ${proj.title}. ${proj.description}`); setChatOpen(true); }}
            style={{ padding: '6px 13px', fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, color: 'var(--subtle)', background: 'var(--surface)', cursor: 'pointer' }}>
            💬 Ask AI
          </div>
        </div>
        {aiMode && (aiLoading || aiResult) && (
          <div style={{ padding: '14px 16px', background: `${proj.color}08`, border: `1px solid ${proj.color}25`, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 8, letterSpacing: 3, color: proj.color, textTransform: 'uppercase' }}>AI Output</div>
              {aiResult && !aiLoading && (
                <div onClick={saveAiToFiles}
                  style={{ fontSize: 9, color: proj.color, cursor: 'pointer', border: `1px solid ${proj.color}40`, borderRadius: 6, padding: '3px 9px' }}>
                  + Save to Files
                </div>
              )}
            </div>
            {aiLoading ? <ThinkingDots color={proj.color} /> : <MD text={aiResult} color={proj.color} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Process Tab ──────────────────────────────────────────────────────────────
function ProcessTab({ proj, onUpdate }) {
  const [view, setView]           = useState('stages');
  const [rawText, setRawText]     = useState(proj.process?.rawText || '');
  const [parsing, setParsing]     = useState(false);
  const [parseError, setParseError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newStepText, setNewStepText] = useState({});
  const [newStageName, setNewStageName] = useState('');
  const { isMobile } = useApp();

  const stages = proj.process?.stages || [];
  const hasProcess = stages.length > 0;

  const saveStages = (updatedStages, raw) => {
    onUpdate({
      process: {
        rawText: raw !== undefined ? raw : (proj.process?.rawText || ''),
        stages: updatedStages,
        generatedAt: proj.process?.generatedAt || Date.now(),
        updatedAt: Date.now(),
      },
    });
  };

  const parseWithAI = async () => {
    if (!rawText.trim()) return;
    setParsing(true); setParseError('');
    try {
      const prompt = `Parse this into a structured process with stages and action steps for a BD pipeline project.

Return ONLY valid JSON (no markdown, no fences, no explanation):
{"stages":[{"name":"Stage Name","description":"One-sentence goal of this stage","steps":["Specific action step 1","Specific action step 2"]}]}

Rules: 3-6 stages ideal. 3-8 steps per stage. Steps start with a verb. Infer logical BD/sales phases if not explicit.

Text:
${rawText.slice(0, 3000)}`;
      const r = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 1200 });
      const clean = r.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const { stages: parsed } = JSON.parse(clean);
      const newStages = parsed.map(s => ({
        id: uid(), name: s.name, description: s.description || '',
        steps: (s.steps || []).map(text => ({ id: uid(), text, done: false })),
      }));
      saveStages(newStages, rawText);
      setView('stages');
    } catch { setParseError('Could not parse — try simplifying the text or rephrasing.'); }
    setParsing(false);
  };

  const addStage = () => {
    if (!newStageName.trim()) return;
    saveStages([...stages, { id: uid(), name: newStageName.trim(), description: '', steps: [] }]);
    setNewStageName('');
  };

  const updateStage = (id, patch) => saveStages(stages.map(s => s.id === id ? { ...s, ...patch } : s));
  const deleteStage = id => saveStages(stages.filter(s => s.id !== id));

  const addStep = stageId => {
    const text = (newStepText[stageId] || '').trim();
    if (!text) return;
    saveStages(stages.map(s => s.id === stageId ? { ...s, steps: [...s.steps, { id: uid(), text, done: false }] } : s));
    setNewStepText(p => ({ ...p, [stageId]: '' }));
  };

  const toggleStep = (stageId, stepId) => saveStages(stages.map(s => s.id === stageId ? { ...s, steps: s.steps.map(st => st.id === stepId ? { ...st, done: !st.done } : st) } : s));
  const deleteStep = (stageId, stepId) => saveStages(stages.map(s => s.id === stageId ? { ...s, steps: s.steps.filter(st => st.id !== stepId) } : s));

  // Import view
  if (view === 'import') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Import a Process</div>
          {hasProcess && <div onClick={() => setView('stages')} style={{ fontSize: 10, color: 'var(--subtle)', cursor: 'pointer' }}>← Back</div>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
          Paste any text — a book framework, sales methodology, your own notes, something you copied online. AI parses it into stages + steps you can customize and build out.
        </div>
        <textarea value={rawText} onChange={e => setRawText(e.target.value)}
          placeholder="Paste your process, playbook, framework, or methodology here..."
          rows={10}
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 10 }} />
        {parseError && <div style={{ fontSize: 11, color: '#ff4444', marginBottom: 10 }}>{parseError}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          {hasProcess && (
            <button onClick={() => setView('stages')} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--subtle)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          )}
          <button onClick={parseWithAI} disabled={parsing || !rawText.trim()}
            style={{ flex: 2, padding: '11px', background: rawText.trim() && !parsing ? proj.color : 'var(--bord2)', border: 'none', borderRadius: 10, color: rawText.trim() && !parsing ? '#000' : 'var(--dim)', fontSize: 12, fontWeight: 700, cursor: rawText.trim() && !parsing ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {parsing ? 'Parsing with AI...' : '⚡ Parse into Stages'}
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!hasProcess) {
    return (
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Build Your BD Process</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
          No process defined yet. Import one from a framework you've read, paste in your own notes, or build stage by stage from scratch.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div onClick={() => setView('import')}
            style={{ padding: '20px', background: 'var(--surface)', border: `1px solid ${proj.color}30`, borderRadius: 12, cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Import a Process</div>
            <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5 }}>Paste any framework, playbook, or methodology — AI structures it into actionable stages.</div>
          </div>
          <div onClick={() => saveStages([{ id: uid(), name: 'Stage 1 — Prospect', description: 'Define and find ideal prospects', steps: [] }])}
            style={{ padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🧱</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Build from Scratch</div>
            <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5 }}>Add stages and steps manually. Define your own phases as you build the process.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newStageName} onChange={e => setNewStageName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStage()}
            placeholder="Or type a stage name to add directly..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={addStage} style={{ padding: '9px 14px', background: proj.color, border: 'none', borderRadius: 8, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Add Stage</button>
        </div>
      </div>
    );
  }

  // Builder view
  const totalSteps = stages.reduce((a, s) => a + s.steps.length, 0);
  const doneSteps  = stages.reduce((a, s) => a + s.steps.filter(st => st.done).length, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>BD Process</div>
          <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{stages.length} stages · {doneSteps}/{totalSteps} steps complete</div>
        </div>
        <div onClick={() => setView('import')} style={{ fontSize: 10, color: 'var(--subtle)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px' }}>
          Re-import / Edit
        </div>
      </div>

      {totalSteps > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ background: 'var(--border)', borderRadius: 3, height: 4, marginBottom: 4 }}>
            <div style={{ width: `${Math.round((doneSteps / totalSteps) * 100)}%`, height: '100%', background: proj.color, borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--subtle)' }}>{Math.round((doneSteps / totalSteps) * 100)}% process complete</div>
        </div>
      )}

      {stages.map((stage, idx) => (
        <div key={stage.id} style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--surface)', borderLeft: `3px solid ${proj.color}`, border: `1px solid var(--border)`, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: proj.color, minWidth: 18, marginTop: 1 }}>{idx + 1}</div>
            <div style={{ flex: 1 }}>
              {editingId === stage.id ? (
                <div>
                  <input value={stage.name} onChange={e => updateStage(stage.id, { name: e.target.value })}
                    onBlur={() => setEditingId(null)} autoFocus
                    style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${proj.color}`, borderRadius: 6, padding: '6px 9px', color: 'var(--text)', fontSize: 12, fontWeight: 700, outline: 'none', fontFamily: 'inherit', marginBottom: 6, boxSizing: 'border-box' }} />
                  <input value={stage.description} onChange={e => updateStage(stage.id, { description: e.target.value })}
                    placeholder="Stage description (optional)..."
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', color: 'var(--text-b)', fontSize: 11, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              ) : (
                <div onClick={() => setEditingId(stage.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: stage.description ? 2 : 0 }}>{stage.name}</div>
                  {stage.description && <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5 }}>{stage.description}</div>}
                  {!stage.description && <div style={{ fontSize: 9, color: 'var(--dim)' }}>click to edit description</div>}
                </div>
              )}
            </div>
            <div onClick={() => deleteStage(stage.id)} style={{ fontSize: 10, color: 'var(--dim)', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>✕</div>
          </div>

          <div style={{ marginBottom: 8 }}>
            {stage.steps.map(step => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-dim)' }}>
                <div onClick={() => toggleStep(stage.id, step.id)}
                  style={{ width: 13, height: 13, borderRadius: 3, border: `2px solid ${step.done ? proj.color : 'var(--dim)'}`, background: step.done ? proj.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer' }}>
                  {step.done && <span style={{ fontSize: 7, color: '#000', fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ flex: 1, fontSize: 11, color: step.done ? 'var(--dim)' : 'var(--text-b)', textDecoration: step.done ? 'line-through' : 'none', lineHeight: 1.5 }}>{step.text}</div>
                <div onClick={() => deleteStep(stage.id, step.id)} style={{ fontSize: 9, color: 'var(--dim)', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>✕</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input value={newStepText[stage.id] || ''} onChange={e => setNewStepText(p => ({ ...p, [stage.id]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addStep(stage.id)}
              placeholder="Add a step..."
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-b)', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => addStep(stage.id)}
              style={{ padding: '6px 11px', background: `${proj.color}20`, border: `1px solid ${proj.color}40`, borderRadius: 6, color: proj.color, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+</button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <input value={newStageName} onChange={e => setNewStageName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addStage()}
          placeholder="Add a new stage..."
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={addStage}
          style={{ padding: '9px 14px', background: proj.color, border: 'none', borderRadius: 8, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Stage</button>
      </div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────
function NotesTab({ proj, onUpdate }) {
  const [text, setText]   = useState(proj.notes || '');
  const [saved, setSaved] = useState(true);
  const timerRef = useRef(null);

  const handleChange = val => {
    setText(val); setSaved(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onUpdate({ notes: val }); setSaved(true); }, 900);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Label>Project Notes</Label>
        <div style={{ fontSize: 9, color: saved ? '#00CC76' : 'var(--dim)' }}>{saved ? '✓ Saved' : 'Saving...'}</div>
      </div>
      <textarea value={text} onChange={e => handleChange(e.target.value)}
        placeholder="Write anything here — meeting notes, ideas, strategy, call summaries, observations, next steps, frameworks you're trying...&#10;&#10;Auto-saves as you type."
        style={{ width: '100%', minHeight: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', color: 'var(--text-b)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.75, boxSizing: 'border-box' }} />
      <div style={{ marginTop: 8, fontSize: 9, color: 'var(--dim)' }}>
        {text.length.toLocaleString()} chars · {text.split(/\s+/).filter(Boolean).length} words
      </div>
    </div>
  );
}

// ─── Files & Artifacts Tab ────────────────────────────────────────────────────
function FilesTab({ proj, onUpdate }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [expanded, setExpanded] = useState(null);
  const fileInputRef = useRef(null);
  const artifacts = proj.artifacts || [];

  const addArtifacts = newArts => onUpdate({ artifacts: [...artifacts, ...newArts] });

  const handleFiles = async fileList => {
    setUploading(true);
    const files = Array.from(fileList);
    const oversized = files.filter(f => f.size > 4 * 1024 * 1024);
    if (oversized.length) {
      alert(`${oversized.map(f => f.name).join(', ')} exceed 4MB. Paste the text content instead.`);
      setUploading(false);
      return;
    }
    try {
      const processed = await processFiles(files);
      addArtifacts(processed.map((f, i) => ({
        id: uid(), type: 'file', title: f.name,
        fileName: f.name, fileType: f.mimeType, fileData: f.data,
        fileSize: files[i]?.size || 0, source: 'upload', createdAt: Date.now(),
      })));
    } catch { alert('Upload failed — try a smaller file.'); }
    setUploading(false);
  };

  const addNote = () => {
    if (!noteTitle.trim() && !noteContent.trim()) return;
    addArtifacts([{ id: uid(), type: 'note', title: noteTitle || 'Untitled', content: noteContent, source: 'manual', createdAt: Date.now() }]);
    setNoteTitle(''); setNoteContent(''); setShowNote(false);
  };

  const deleteArtifact = id => onUpdate({ artifacts: artifacts.filter(a => a.id !== id) });

  const fmtSize = b => {
    if (!b) return '';
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${Math.round(b / 1024)}KB`;
    return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  };

  const typeIcon = a => ({ file: getFileIcon(a.fileName) || '📎', aiOutput: '✦', note: '📝', persona: '👤' })[a.type] || '📎';

  return (
    <div>
      {/* Drop zone */}
      <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={async e => { e.preventDefault(); setDragging(false); await handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        style={{ border: `2px dashed ${dragging ? proj.color : 'var(--border)'}`, borderRadius: 12, padding: '28px', textAlign: 'center', marginBottom: 16, cursor: 'pointer', background: dragging ? `${proj.color}08` : 'var(--surface)', transition: 'all 0.15s' }}>
        <div style={{ fontSize: 26, marginBottom: 6 }}>{uploading ? '⏳' : '📁'}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-b)', marginBottom: 3 }}>{uploading ? 'Uploading...' : 'Drop files here or click to upload'}</div>
        <div style={{ fontSize: 10, color: 'var(--subtle)' }}>PDF, Word, Excel, images, text — max 4MB per file</div>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPT_TYPES} style={{ display: 'none' }}
          onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div onClick={() => setShowNote(!showNote)}
          style={{ fontSize: 11, color: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', cursor: 'pointer' }}>
          + Add Note / Paste Text
        </div>
      </div>

      {showNote && (
        <div style={{ padding: '14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 18 }}>
          <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Title..."
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }} />
          <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
            placeholder="Paste text, notes, or content here..." rows={5}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.65, boxSizing: 'border-box', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowNote(false)} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--subtle)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={addNote} style={{ flex: 2, padding: '9px', background: proj.color, border: 'none', borderRadius: 8, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save to Project</button>
          </div>
        </div>
      )}

      {artifacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dim)', fontSize: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
          No files or artifacts yet. Upload files, paste notes, or save AI outputs here — everything stays organized by project.
        </div>
      ) : (
        <div>
          <Label>{artifacts.length} item{artifacts.length !== 1 ? 's' : ''}</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...artifacts].reverse().map(a => (
              <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 18, flexShrink: 0 }}>{typeIcon(a)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{a.title}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 8, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{a.type}</div>
                      {a.source && <div style={{ fontSize: 8, color: 'var(--dim)' }}>· {a.source}</div>}
                      {a.fileSize > 0 && <div style={{ fontSize: 8, color: 'var(--dim)' }}>· {fmtSize(a.fileSize)}</div>}
                      <div style={{ fontSize: 8, color: 'var(--dim)' }}>· {timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {a.content && (
                      <div onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        style={{ fontSize: 9, color: 'var(--subtle)', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 7px' }}>
                        {expanded === a.id ? 'collapse' : 'view'}
                      </div>
                    )}
                    <div onClick={() => deleteArtifact(a.id)} style={{ fontSize: 10, color: 'var(--dim)', cursor: 'pointer', padding: '3px 5px' }}>✕</div>
                  </div>
                </div>
                {expanded === a.id && a.content && (
                  <div style={{ padding: '0 14px 14px 14px', borderTop: '1px solid var(--border-dim)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-c)', lineHeight: 1.65, marginTop: 10, whiteSpace: 'pre-wrap' }}>{a.content}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Personas / ICP Tab ───────────────────────────────────────────────────────
const PERSONA_STATUSES = [
  { id: 'prospect', label: 'Prospect', color: '#6366F1' },
  { id: 'active',   label: 'Active',   color: '#00FFB2' },
  { id: 'partner',  label: 'Partner',  color: '#ffcc44' },
  { id: 'closed',   label: 'Closed',   color: '#ff4444' },
];

const blankPersona = () => ({ id: uid(), name: '', role: '', company: '', industry: '', painPoints: '', valueProp: '', outreachAngle: '', status: 'prospect', notes: '', crmRef: '', createdAt: Date.now() });

function PersonasTab({ proj, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(blankPersona());
  const [generating, setGenerating] = useState(false);
  const { isMobile } = useApp();
  const personas = proj.personas || [];

  const savePersona = () => {
    if (!form.name.trim()) return;
    const updated = editId
      ? personas.map(p => p.id === editId ? { ...form } : p)
      : [...personas, { ...form, id: uid(), createdAt: Date.now() }];
    onUpdate({ personas: updated });
    setShowForm(false); setEditId(null); setForm(blankPersona());
  };

  const editPersona = p => { setForm({ ...p }); setEditId(p.id); setShowForm(true); };
  const deletePersona = id => onUpdate({ personas: personas.filter(p => p.id !== id) });

  const generateICP = async () => {
    setGenerating(true);
    try {
      const r = await callClaude({
        system: CB_IDENTITY,
        messages: [{
          role: 'user',
          content: `For CB's project "${proj.title}" (${proj.description || ''}), generate 2 ideal customer profile (ICP) personas. Return ONLY valid JSON:\n{"personas":[{"name":"Persona type/name","role":"Job title","company":"Company type","industry":"Industry vertical","painPoints":"Key pain points and frustrations","valueProp":"How CB uniquely solves their problem","outreachAngle":"Best conversation opener for this persona"}]}`,
        }],
        maxTokens: 900,
      });
      const clean = r.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const { personas: gen } = JSON.parse(clean);
      onUpdate({ personas: [...personas, ...gen.map(p => ({ ...blankPersona(), ...p, id: uid(), createdAt: Date.now() }))] });
    } catch { alert('Could not generate — try again.'); }
    setGenerating(false);
  };

  const setF = patch => setForm(f => ({ ...f, ...patch }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Personas & ICP</div>
          <div style={{ fontSize: 10, color: 'var(--subtle)' }}>Ideal customer profiles · CRM connector slot built in</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={generating ? undefined : generateICP}
            style={{ fontSize: 10, color: generating ? 'var(--dim)' : proj.color, border: `1px solid ${generating ? 'var(--border)' : proj.color + '50'}`, borderRadius: 8, padding: '6px 11px', cursor: generating ? 'default' : 'pointer' }}>
            {generating ? '...' : '✦ AI Generate'}
          </div>
          <div onClick={() => { setForm(blankPersona()); setEditId(null); setShowForm(true); }}
            style={{ fontSize: 10, color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer' }}>
            + Add Persona
          </div>
        </div>
      </div>

      {showForm && (
        <div style={{ padding: '16px', background: 'var(--surface)', border: `1px solid ${proj.color}30`, borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{editId ? 'Edit Persona' : 'New Persona'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { key: 'name',     label: 'Persona Name / Type',   ph: 'e.g. Mid-market CFO, Owner-operator' },
              { key: 'role',     label: 'Job Title',             ph: 'CFO, VP Sales, Founder...' },
              { key: 'company',  label: 'Company Type',          ph: 'SaaS startup, regional CRE firm...' },
              { key: 'industry', label: 'Industry',              ph: 'Real estate, healthcare, finance...' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</div>
                <input value={form[f.key] || ''} onChange={e => setF({ [f.key]: e.target.value })} placeholder={f.ph}
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text-b)', fontSize: 11, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {[
            { key: 'painPoints',    label: 'Pain Points',       ph: "What keeps them up at night? What are they struggling with?" },
            { key: 'valueProp',     label: 'Value Proposition', ph: "How does CB uniquely solve their problem?" },
            { key: 'outreachAngle', label: 'Outreach Angle',    ph: "Best way to open a conversation with this persona..." },
            { key: 'notes',         label: 'Notes',             ph: "Any context, examples, specifics..." },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</div>
              <textarea value={form[f.key] || ''} onChange={e => setF({ [f.key]: e.target.value })} placeholder={f.ph} rows={2}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text-b)', fontSize: 11, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 5 }}>CRM Reference <span style={{ color: 'var(--dim)', textTransform: 'none', letterSpacing: 0 }}>(future connector)</span></div>
            <input value={form.crmRef || ''} onChange={e => setF({ crmRef: e.target.value })}
              placeholder="ID, link, or ref for your CRM — Salesforce, HubSpot, etc."
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--bord2)', borderRadius: 7, padding: '8px 10px', color: 'var(--text-b)', fontSize: 11, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PERSONA_STATUSES.map(s => (
                <div key={s.id} onClick={() => setF({ status: s.id })}
                  style={{ padding: '5px 11px', fontSize: 9, border: `1px solid ${form.status === s.id ? s.color : 'var(--border)'}`, color: form.status === s.id ? s.color : 'var(--subtle)', borderRadius: 20, cursor: 'pointer', background: form.status === s.id ? `${s.color}15` : 'transparent' }}>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(blankPersona()); }} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--subtle)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={savePersona} style={{ flex: 2, padding: '10px', background: proj.color, border: 'none', borderRadius: 8, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save Persona</button>
          </div>
        </div>
      )}

      {personas.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dim)', fontSize: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👤</div>
          No personas yet. Add your ICPs to focus your BD — or let AI generate them based on your project.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
          {personas.map(p => {
            const st = PERSONA_STATUSES.find(s => s.id === p.status) || PERSONA_STATUSES[0];
            return (
              <div key={p.id} style={{ padding: '14px', background: 'var(--surface)', border: `1px solid ${st.color}25`, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.name || '(unnamed)'}</div>
                    {p.role && <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{p.role}{p.company ? ` · ${p.company}` : ''}</div>}
                    {p.industry && <div style={{ fontSize: 9, color: 'var(--dim)' }}>{p.industry}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge color={st.color}>{st.label}</Badge>
                    <div onClick={() => editPersona(p)} style={{ fontSize: 10, color: 'var(--dim)', cursor: 'pointer', padding: '2px' }}>✏</div>
                    <div onClick={() => deletePersona(p.id)} style={{ fontSize: 10, color: 'var(--dim)', cursor: 'pointer', padding: '2px' }}>✕</div>
                  </div>
                </div>
                {p.painPoints && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 8, letterSpacing: 1.5, color: '#ff8844', textTransform: 'uppercase', marginBottom: 3 }}>Pain Points</div>
                    <div style={{ fontSize: 10, color: 'var(--text-c)', lineHeight: 1.5 }}>{p.painPoints}</div>
                  </div>
                )}
                {p.valueProp && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 8, letterSpacing: 1.5, color: proj.color, textTransform: 'uppercase', marginBottom: 3 }}>Value Prop</div>
                    <div style={{ fontSize: 10, color: 'var(--text-c)', lineHeight: 1.5 }}>{p.valueProp}</div>
                  </div>
                )}
                {p.outreachAngle && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 8, letterSpacing: 1.5, color: '#00CC76', textTransform: 'uppercase', marginBottom: 3 }}>Outreach Angle</div>
                    <div style={{ fontSize: 10, color: 'var(--text-c)', lineHeight: 1.5 }}>{p.outreachAngle}</div>
                  </div>
                )}
                {p.crmRef && (
                  <div style={{ padding: '4px 8px', background: 'var(--bg)', border: '1px dashed var(--bord2)', borderRadius: 5, fontSize: 9, color: 'var(--dim)', marginTop: 6 }}>
                    🔌 CRM: {p.crmRef}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreate, val, setVal, isMobile }) {
  return (
    <Modal title="New Project" accent="#ff8844" onClose={onClose}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input value={val.emoji} onChange={e => setVal(p => ({ ...p, emoji: e.target.value }))}
          style={{ width: 50, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', color: 'var(--text-b)', fontSize: 18, outline: 'none', textAlign: 'center' }} />
        <input value={val.title} onChange={e => setVal(p => ({ ...p, title: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && val.title.trim() && onCreate()}
          placeholder="Project title..."
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <textarea value={val.description} onChange={e => setVal(p => ({ ...p, description: e.target.value }))}
        placeholder="What is this project about? What's the goal?" rows={3}
        style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
      <div style={{ marginBottom: 14 }}>
        <Label>Category</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(PROJECT_CATEGORIES).map(([k, v]) => (
            <div key={k} onClick={() => setVal(p => ({ ...p, category: k }))}
              style={{ padding: isMobile ? '9px 14px' : '5px 12px', fontSize: 10, border: `1px solid ${val.category === k ? v.color : 'var(--bord2)'}`, color: val.category === k ? v.color : 'var(--subtle)', borderRadius: 6, cursor: 'pointer', background: val.category === k ? `${v.color}15` : 'transparent', minHeight: isMobile ? 40 : undefined }}>
              {v.icon} {v.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Label>Priority</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['high', 'medium', 'low'].map(p => (
            <div key={p} onClick={() => setVal(prev => ({ ...prev, priority: p }))}
              style={{ flex: 1, padding: '8px', border: `1px solid ${val.priority === p ? '#ff8844' : 'var(--bord2)'}`, borderRadius: 8, textAlign: 'center', fontSize: 10, color: val.priority === p ? '#ff8844' : 'var(--subtle)', cursor: 'pointer', textTransform: 'capitalize' }}>
              {p}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div onClick={onClose} style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer' }}>Cancel</div>
        <div onClick={val.title.trim() ? onCreate : undefined}
          style={{ flex: 2, padding: '11px', background: val.title.trim() ? '#ff8844' : 'var(--bord2)', borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: val.title.trim() ? '#000' : 'var(--dim)', cursor: val.title.trim() ? 'pointer' : 'default' }}>
          Create Project →
        </div>
      </div>
    </Modal>
  );
}
