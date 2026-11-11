import { T } from '../theme';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { saveProjects, uid, callClaude, processFiles, getFileIcon, timeAgo } from '../utils.js';
import { PROJECT_CATEGORIES, PROJECT_STATUSES, SYSTEM_BASE, ACCEPT_TYPES } from '../constants.js';
import './projects-os.css';

// Map a free-text inferred category label to a project category key.
// Category is never mandatory — this only pre-selects a sensible default.
function inferCategory(labelRaw = '') {
  const l = labelRaw.toLowerCase().trim();
  if (PROJECT_CATEGORIES[l]) return l;
  if (/financ|invest|money|divid|real ?estate|passive/.test(l)) return 'finance';
  if (/health|longevity|fitness|medical|wellness/.test(l)) return 'health';
  if (/learn|study|educat|course|skill/.test(l)) return 'learning';
  if (/business|\bbd\b|sales|startup|company|market|product|revenue/.test(l)) return 'business';
  return 'other';
}
import { Badge, Label, Modal, ThinkingDots } from './shared/Common.jsx';
import { SectionEmpty } from './shared/SectionState.jsx';
import Icon from './shared/Icon.jsx';
import MD from './shared/MD.jsx';
import AskChip from './shared/AskChip.jsx';

// Per-project colour → a CSS custom property. projects-os.css uses --pc for
// borders and bars only (never text — a stored colour isn't guaranteed 4.5:1).
const pcVar = p => ({ '--pc': p.color || 'var(--accent)' });

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

// Checkbox — a real button with checkbox semantics and a 44px hit area.
function Check({ on, onToggle, label, small }) {
  return (
    <button type="button" role="checkbox" aria-checked={!!on} aria-label={label}
      className={`po-check${small ? ' po-check-sm' : ''} tap`} onClick={onToggle}>
      {on && <Icon name="Check" size={small ? 9 : 11} strokeWidth={3.5} />}
    </button>
  );
}

function DeleteX({ onClick, label }) {
  return (
    <button type="button" className="po-x tap" onClick={onClick} aria-label={label}>
      <Icon name="X" size={14} />
    </button>
  );
}

// ─── Root list (kanban) ───────────────────────────────────────────────────────
export default function ProjectsOS() {
  const { projects, setProjects, captureRoute, clearCapture } = useApp();
  const [activeId, setActiveId]   = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [newProj, setNewProj]     = useState({ title: '', emoji: '🚀', description: '', category: 'other', priority: 'high' });
  const [statusFilter, setStatusFilter] = useState('all');

  const persist = async updated => { setProjects(updated); await saveProjects(updated); };

  // Capture-bar route (D1): open the new-project modal pre-filled, category inferred.
  useEffect(() => {
    if (captureRoute?.route === 'project') {
      setNewProj({ title: captureRoute.topic || '', emoji: '🚀', description: '', category: inferCategory(captureRoute.suggestedCategory), priority: 'high' });
      setShowNew(true);
      clearCapture?.();
    }
  }, [captureRoute, clearCapture]);

  const createProject = async () => {
    if (!newProj.title.trim()) return;
    const p = def({
      id: uid(), title: newProj.title, emoji: newProj.emoji || '🚀',
      status: 'planning', category: newProj.category,
      color: PROJECT_CATEGORIES[newProj.category]?.color || 'var(--accent-text)',
      description: newProj.description, milestones: [], connections: [],
      blueOcean: '', createdAt: Date.now(), updatedAt: Date.now(), priority: newProj.priority,
    });
    await persist([...projects, p]);
    setNewProj({ title: '', emoji: '🚀', description: '', category: 'other', priority: 'high' });
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
    <div className="po">
      <div className="po-head">
        <div>
          <div className="po-eyebrow">Projects & Execution OS</div>
          <div className="po-title">Your Projects</div>
          <div className="po-count">{projects.filter(p => p.status === 'active').length} active · {projects.length} total</div>
        </div>
        <button type="button" className="btn btn-primary po-new tap" onClick={() => setShowNew(true)}>+ New Project</button>
      </div>

      <div className="po-filters">
        {[{ id: 'all', label: 'All' }, ...PROJECT_STATUSES].map(s => (
          <button type="button" key={s.id} className="chip tap" aria-pressed={statusFilter === s.id} onClick={() => setStatusFilter(s.id)}>
            {s.label} ({s.id === 'all' ? projects.length : projects.filter(p => p.status === s.id).length})
          </button>
        ))}
      </div>

      <div className="po-board">
        {PROJECT_STATUSES.map(status => {
          const cols = projects.filter(p => p.status === status.id);
          return (
            <div key={status.id} className="po-col">
              <div className="po-col-head">
                <div className="po-col-label">{status.label}</div>
                <div className="po-col-n">{cols.length}</div>
              </div>
              <div className="po-col-list">
                {cols.map(proj => {
                  const p = def(proj);
                  const done = p.milestones.filter(m => m.done).length;
                  const pct = p.milestones.length > 0 ? Math.round((done / p.milestones.length) * 100) : 0;
                  const cat = PROJECT_CATEGORIES[p.category];
                  return (
                    <button type="button" key={p.id} className="po-card" style={pcVar(p)} onClick={() => setActiveId(p.id)}>
                      <span className="po-card-top">
                        <span className="po-card-emoji">{p.emoji}</span>
                        <Badge color={cat?.color || 'var(--subtle)'}>{cat?.label || 'Other'}</Badge>
                      </span>
                      <span className="po-card-title">{p.title}</span>
                      <span className="po-card-desc">{p.description}</span>
                      {p.milestones.length > 0 && (
                        <>
                          <span className="po-card-prog">
                            <span>{done}/{p.milestones.length} milestones</span>
                            <span className="po-card-pct">{pct}%</span>
                          </span>
                          <span className="po-bar" data-size="xs" style={{ '--pct': `${pct}%` }}><span /></span>
                        </>
                      )}
                      <span className="po-card-meta">
                        {p.artifacts?.length > 0 && <span><Icon name="Paperclip" size={13} /> {p.artifacts.length}</span>}
                        {p.personas?.length > 0 && <span><Icon name="Target" size={13} /> {p.personas.length}</span>}
                        {p.process?.stages?.length > 0 && <span><Icon name="Cog" size={13} /> {p.process.stages.length} stages</span>}
                        {p.priority === 'high' && <span className="po-high">▲ HIGH</span>}
                      </span>
                    </button>
                  );
                })}
                {cols.length === 0 && (
                  <div className="po-col-empty">
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
          val={newProj} setVal={setNewProj} />
      )}
    </div>
  );
}

// ─── Project Workspace ────────────────────────────────────────────────────────
function ProjectWorkspace({ proj, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState('overview');
  const cat = PROJECT_CATEGORIES[proj.category];
  const statusConfig = PROJECT_STATUSES.find(s => s.id === proj.status);
  const done = proj.milestones.filter(m => m.done).length;
  const pct = proj.milestones.length > 0 ? Math.round((done / proj.milestones.length) * 100) : 0;

  return (
    <div className="po-ws" style={pcVar(proj)}>
      {/* Sticky header */}
      <div className="po-ws-head">
        <button type="button" className="po-link po-back tap" onClick={onBack}>← All Projects</button>
        <div className="po-ws-row">
          <div className="po-ws-id">
            <div className="po-ws-emoji">{proj.emoji}</div>
            <div>
              <div className="po-ws-title">{proj.title}</div>
              <div className="po-badges">
                <Badge color={cat?.color || 'var(--subtle)'}>{cat?.label || 'Other'}</Badge>
                <Badge color={statusConfig?.color || 'var(--subtle)'}>{proj.status}</Badge>
                {proj.priority === 'high' && <Badge color="var(--accent-text)">high priority</Badge>}
                {proj.milestones.length > 0 && <Badge color={proj.color}>{pct}%</Badge>}
                <AskChip type="project" object={proj} />
              </div>
            </div>
          </div>
          <div className="po-status">
            {PROJECT_STATUSES.map(s => (
              <button type="button" key={s.id} className="po-seg tap" aria-pressed={proj.status === s.id} onClick={() => onUpdate({ status: s.id })}>
                {s.label}
              </button>
            ))}
            <button type="button" className="po-seg tap" data-tone="negative" onClick={() => { if (confirm('Delete this project?')) onDelete(); }}>
              Delete
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="po-tabs" role="tablist" data-scroll-x="">
          {WORKSPACE_TABS.map(t => (
            <button type="button" role="tab" key={t.id} className="po-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="po-ws-body">
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
const AI_TOOLS = [
  { id: 'brief',     icon: 'ClipboardList', label: 'Strategy Brief' },
  { id: 'obstacles', icon: 'AlertTriangle', label: 'Obstacles' },
  { id: 'blueocean', icon: 'Waves',         label: 'Blue Ocean' },
  { id: 'nextmoves', icon: 'Zap',           label: 'Top Moves This Week' },
];

function OverviewTab({ proj, pct, done, onUpdate }) {
  const [newMilestone, setNewMilestone] = useState('');
  const [aiMode, setAiMode]   = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const { setChatPrefill, setChatOpen } = useApp();

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
      const r = await callClaude({ system: SYSTEM_BASE, messages: [{ role: 'user', content: prompts[mode] }], maxTokens: 800 });
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
      {proj.description && <div className="po-lede po-mb24">{proj.description}</div>}

      {proj.milestones.length > 0 && (
        <div className="po-progress">
          <div className="po-spread po-gap8">
            <Label>Progress</Label>
            <div className="po-pct">{pct}%</div>
          </div>
          <div className="po-bar" style={{ '--pct': `${pct}%` }}><span /></div>
          <div className="po-sub">{done} of {proj.milestones.length} milestones complete</div>
        </div>
      )}

      <div className="po-mb24">
        <Label>Milestones</Label>
        {proj.milestones.map(m => (
          <div key={m.id} className="po-ms" data-done={m.done ? '' : undefined}>
            <Check on={m.done} onToggle={() => toggleMilestone(m.id)} label={m.text} />
            <div className="po-ms-text">{m.text}</div>
            <DeleteX onClick={() => deleteMilestone(m.id)} label={`Delete milestone: ${m.text}`} />
          </div>
        ))}
        <div className="po-row po-ms-add">
          <input className="po-input" value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMilestone()}
            placeholder="Add milestone..." aria-label="Add milestone" />
          <button type="button" className="btn btn-primary po-act tap" onClick={addMilestone}>Add</button>
        </div>
      </div>

      {proj.connections?.length > 0 && (
        <div className="po-mb24">
          <Label>Knowledge Connections</Label>
          <div className="po-conns">
            {proj.connections.map(c => (
              <div key={c} className="po-conn"><Icon name="BookOpen" size={13} /> {c}</div>
            ))}
          </div>
        </div>
      )}

      {proj.blueOcean && (
        <div className="po-ocean">
          <Label color="var(--accent-text)"><span className="po-ico-label"><Icon name="Waves" size={12} /> Blue Ocean Insight</span></Label>
          <div className="po-ocean-text">{proj.blueOcean}</div>
        </div>
      )}

      <div className="po-ai">
        <Label>✦ AI Project Intelligence</Label>
        <div className="po-tools">
          {AI_TOOLS.map(btn => (
            <button type="button" key={btn.id} className="po-tool tap" aria-pressed={aiMode === btn.id} onClick={() => runAI(btn.id)}>
              <Icon name={btn.icon} size={15} /> {btn.label}
            </button>
          ))}
          <button type="button" className="po-tool tap" onClick={() => { setChatPrefill(`Help me with my project: ${proj.title}. ${proj.description}`); setChatOpen(true); }}>
            <Icon name="MessageSquare" size={15} /> Ask AI
          </button>
        </div>
        {aiMode && (aiLoading || aiResult) && (
          <div className="po-out">
            <div className="po-spread po-out-head">
              <div className="po-out-label">AI Output</div>
              {aiResult && !aiLoading && (
                <button type="button" className="po-mini tap" onClick={saveAiToFiles}>+ Save to Files</button>
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
      const r = await callClaude({ system: SYSTEM_BASE, messages: [{ role: 'user', content: prompt }], maxTokens: 1200 });
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
        <div className="po-spread po-mb14">
          <div className="po-h2">Import a Process</div>
          {hasProcess && <button type="button" className="po-link tap" onClick={() => setView('stages')}>← Back</button>}
        </div>
        <div className="po-lede po-mb12">
          Paste any text — a book framework, sales methodology, your own notes, something you copied online. AI parses it into stages + steps you can customize and build out.
        </div>
        <textarea className="po-input po-textarea po-import-text" value={rawText} onChange={e => setRawText(e.target.value)}
          placeholder="Paste your process, playbook, framework, or methodology here..."
          aria-label="Process text" rows={10} />
        {parseError && <div className="po-err" role="alert">{parseError}</div>}
        <div className="po-row">
          {hasProcess && (
            <button type="button" className="btn po-act po-act-grow tap" onClick={() => setView('stages')}>Cancel</button>
          )}
          <button type="button" className="btn btn-primary po-act po-act-grow2 tap" onClick={parseWithAI}
            disabled={parsing || !rawText.trim()} aria-busy={parsing || undefined}>
            {parsing ? 'Parsing with AI...' : <><Icon name="Zap" size={15} /> Parse into Stages</>}
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!hasProcess) {
    return (
      <div>
        <div className="po-h2 po-gap8">Build Your BD Process</div>
        <div className="po-lede po-mb20">
          No process defined yet. Import one from a framework you've read, paste in your own notes, or build stage by stage from scratch.
        </div>
        <div className="po-choices">
          <button type="button" className="po-choice" data-pc="" onClick={() => setView('import')}>
            <span className="po-choice-ico"><Icon name="ClipboardList" size={28} strokeWidth={1.5} /></span>
            <span className="po-choice-title">Import a Process</span>
            <span className="po-choice-desc">Paste any framework, playbook, or methodology — AI structures it into actionable stages.</span>
          </button>
          <button type="button" className="po-choice" onClick={() => saveStages([{ id: uid(), name: 'Stage 1 — Prospect', description: 'Define and find ideal prospects', steps: [] }])}>
            <span className="po-choice-ico"><Icon name="Layers" size={28} strokeWidth={1.5} /></span>
            <span className="po-choice-title">Build from Scratch</span>
            <span className="po-choice-desc">Add stages and steps manually. Define your own phases as you build the process.</span>
          </button>
        </div>
        <div className="po-row">
          <input className="po-input" value={newStageName} onChange={e => setNewStageName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStage()}
            placeholder="Or type a stage name to add directly..." aria-label="New stage name" />
          <button type="button" className="btn btn-primary po-act tap" onClick={addStage}>Add Stage</button>
        </div>
      </div>
    );
  }

  // Builder view
  const totalSteps = stages.reduce((a, s) => a + s.steps.length, 0);
  const doneSteps  = stages.reduce((a, s) => a + s.steps.filter(st => st.done).length, 0);
  const procPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <div>
      <div className="po-spread po-mb16">
        <div>
          <div className="po-h2 po-mb2">BD Process</div>
          <div className="po-sub">{stages.length} stages · {doneSteps}/{totalSteps} steps complete</div>
        </div>
        <button type="button" className="po-mini tap" onClick={() => setView('import')}>Re-import / Edit</button>
      </div>

      {totalSteps > 0 && (
        <div className="po-proc-bar">
          <div className="po-bar" data-size="sm" style={{ '--pct': `${procPct}%` }}><span /></div>
          <div className="po-sub">{procPct}% process complete</div>
        </div>
      )}

      {stages.map((stage, idx) => (
        <div key={stage.id} className="po-stage">
          <div className="po-stage-head">
            <div className="po-stage-n">{idx + 1}</div>
            <div className="po-stage-main">
              {editingId === stage.id ? (
                <div>
                  <input className="po-input po-stage-in" data-name="" value={stage.name} onChange={e => updateStage(stage.id, { name: e.target.value })}
                    onBlur={() => setEditingId(null)} autoFocus aria-label="Stage name" />
                  <input className="po-input po-stage-in" value={stage.description} onChange={e => updateStage(stage.id, { description: e.target.value })}
                    placeholder="Stage description (optional)..." aria-label="Stage description" />
                </div>
              ) : (
                <button type="button" className="po-stage-edit" onClick={() => setEditingId(stage.id)}>
                  <span className="po-stage-name" data-desc={stage.description ? '' : undefined}>{stage.name}</span>
                  <span className="po-stage-desc">{stage.description || 'click to edit description'}</span>
                </button>
              )}
            </div>
            <DeleteX onClick={() => deleteStage(stage.id)} label={`Delete stage: ${stage.name}`} />
          </div>

          <div className="po-steps">
            {stage.steps.map(step => (
              <div key={step.id} className="po-step" data-done={step.done ? '' : undefined}>
                <Check small on={step.done} onToggle={() => toggleStep(stage.id, step.id)} label={step.text} />
                <div className="po-step-text">{step.text}</div>
                <DeleteX onClick={() => deleteStep(stage.id, step.id)} label={`Delete step: ${step.text}`} />
              </div>
            ))}
          </div>

          <div className="po-row po-step-add">
            <input className="po-input" value={newStepText[stage.id] || ''} onChange={e => setNewStepText(p => ({ ...p, [stage.id]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addStep(stage.id)}
              placeholder="Add a step..." aria-label={`Add a step to ${stage.name}`} />
            <button type="button" className="btn tap" onClick={() => addStep(stage.id)} aria-label="Add step">+</button>
          </div>
        </div>
      ))}

      <div className="po-row po-stage-add">
        <input className="po-input" value={newStageName} onChange={e => setNewStageName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addStage()}
          placeholder="Add a new stage..." aria-label="New stage name" />
        <button type="button" className="btn btn-primary po-act tap" onClick={addStage}>+ Stage</button>
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
      <div className="po-spread po-gap10">
        <Label>Project Notes</Label>
        <div className="po-saved" data-saved={saved ? '' : undefined} aria-live="polite">{saved ? '✓ Saved' : 'Saving...'}</div>
      </div>
      <textarea className="po-input po-textarea po-notes" value={text} onChange={e => handleChange(e.target.value)}
        aria-label="Project notes"
        placeholder="Write anything here — meeting notes, ideas, strategy, call summaries, observations, next steps, frameworks you're trying...&#10;&#10;Auto-saves as you type." />
      <div className="po-notes-count">
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

  // lucide icon NAMES (getFileIcon already returns one per extension).
  const typeIcon = a => ({ file: getFileIcon(a.fileName) || 'Paperclip', aiOutput: 'Sparkles', note: 'StickyNote', persona: 'Target' })[a.type] || 'Paperclip';

  return (
    <div>
      {/* Drop zone */}
      <button type="button" className="po-drop" data-drag={dragging ? '' : undefined}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={async e => { e.preventDefault(); setDragging(false); await handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()} aria-busy={uploading || undefined}>
        <span className="po-drop-ico"><Icon name={uploading ? 'Clock' : 'Paperclip'} size={28} strokeWidth={1.5} /></span>
        <span className="po-drop-title">{uploading ? 'Uploading...' : 'Drop files here or click to upload'}</span>
        <span className="po-drop-sub">PDF, Word, Excel, images, text — max 4MB per file</span>
      </button>
      <input ref={fileInputRef} type="file" multiple accept={ACCEPT_TYPES} className="po-hidden" tabIndex={-1} aria-hidden="true"
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />

      <div className="po-files-actions">
        <button type="button" className="po-mini tap" aria-expanded={showNote} onClick={() => setShowNote(!showNote)}>
          + Add Note / Paste Text
        </button>
      </div>

      {showNote && (
        <div className="po-panel">
          <input className="po-input po-gap8" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Title..." aria-label="Note title" />
          <textarea className="po-input po-textarea po-gap10" value={noteContent} onChange={e => setNoteContent(e.target.value)}
            placeholder="Paste text, notes, or content here..." aria-label="Note content" rows={5} />
          <div className="po-row">
            <button type="button" className="btn po-act po-act-grow tap" onClick={() => setShowNote(false)}>Cancel</button>
            <button type="button" className="btn btn-primary po-act po-act-grow2 tap" onClick={addNote}>Save to Project</button>
          </div>
        </div>
      )}

      {artifacts.length === 0 ? (
        <SectionEmpty what="No files or artifacts yet"
          how="Upload files, paste notes, or save AI outputs here — everything stays organized by project." />
      ) : (
        <div>
          <Label>{artifacts.length} item{artifacts.length !== 1 ? 's' : ''}</Label>
          <div className="po-arts">
            {[...artifacts].reverse().map(a => (
              <div key={a.id} className="po-art">
                <div className="po-art-row">
                  <span className="po-art-ico"><Icon name={typeIcon(a)} size={20} /></span>
                  <div className="po-art-main">
                    <div className="po-art-title">{a.title}</div>
                    <div className="po-art-meta">
                      <span className="po-art-type">{a.type}</span>
                      {a.source && <span>· {a.source}</span>}
                      {a.fileSize > 0 && <span>· {fmtSize(a.fileSize)}</span>}
                      <span>· {timeAgo(a.createdAt)}</span>
                    </div>
                  </div>
                  <div className="po-art-tools">
                    {a.content && (
                      <button type="button" className="po-mini tap" aria-expanded={expanded === a.id} onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                        {expanded === a.id ? 'collapse' : 'view'}
                      </button>
                    )}
                    <DeleteX onClick={() => deleteArtifact(a.id)} label={`Delete ${a.title}`} />
                  </div>
                </div>
                {expanded === a.id && a.content && (
                  <div className="po-art-body">
                    <div>{a.content}</div>
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
  { id: 'prospect', label: 'Prospect', color: 'var(--accent-text)' },
  { id: 'active',   label: 'Active',   color: 'var(--accent-text)' },
  { id: 'partner',  label: 'Partner',  color: 'var(--accent-text)' },
  { id: 'closed',   label: 'Closed',   color: T.negative },
];

const blankPersona = () => ({ id: uid(), name: '', role: '', company: '', industry: '', painPoints: '', valueProp: '', outreachAngle: '', status: 'prospect', notes: '', crmRef: '', createdAt: Date.now() });

function PersonasTab({ proj, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(blankPersona());
  const [generating, setGenerating] = useState(false);
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
        system: SYSTEM_BASE,
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
      <div className="po-per-head">
        <div>
          <div className="po-h2 po-mb2">Personas & ICP</div>
          <div className="po-sub">Ideal customer profiles · CRM connector slot built in</div>
        </div>
        <div className="po-row">
          <button type="button" className="po-mini tap" data-tone="accent" onClick={generateICP}
            disabled={generating} aria-busy={generating || undefined}>
            {generating ? '...' : '✦ AI Generate'}
          </button>
          <button type="button" className="po-mini tap" onClick={() => { setForm(blankPersona()); setEditId(null); setShowForm(true); }}>
            + Add Persona
          </button>
        </div>
      </div>

      {showForm && (
        <div className="po-form">
          <div className="po-form-title">{editId ? 'Edit Persona' : 'New Persona'}</div>
          <div className="po-form-grid">
            {[
              { key: 'name',     label: 'Persona Name / Type',   ph: 'e.g. Mid-market CFO, Owner-operator' },
              { key: 'role',     label: 'Job Title',             ph: 'CFO, VP Sales, Founder...' },
              { key: 'company',  label: 'Company Type',          ph: 'SaaS startup, regional CRE firm...' },
              { key: 'industry', label: 'Industry',              ph: 'Real estate, healthcare, finance...' },
            ].map(f => (
              <label key={f.key}>
                <div className="po-kicker">{f.label}</div>
                <input className="po-input" value={form[f.key] || ''} onChange={e => setF({ [f.key]: e.target.value })} placeholder={f.ph} />
              </label>
            ))}
          </div>
          {[
            { key: 'painPoints',    label: 'Pain Points',       ph: "What keeps them up at night? What are they struggling with?" },
            { key: 'valueProp',     label: 'Value Proposition', ph: "How does CB uniquely solve their problem?" },
            { key: 'outreachAngle', label: 'Outreach Angle',    ph: "Best way to open a conversation with this persona..." },
            { key: 'notes',         label: 'Notes',             ph: "Any context, examples, specifics..." },
          ].map(f => (
            <label key={f.key} className="po-block po-gap10">
              <div className="po-kicker">{f.label}</div>
              <textarea className="po-input po-textarea" value={form[f.key] || ''} onChange={e => setF({ [f.key]: e.target.value })} placeholder={f.ph} rows={2} />
            </label>
          ))}
          <label className="po-block po-mb12">
            <div className="po-kicker">CRM Reference <span className="po-kicker-note">(future connector)</span></div>
            <input className="po-input po-crm-in" value={form.crmRef || ''} onChange={e => setF({ crmRef: e.target.value })}
              placeholder="ID, link, or ref for your CRM — Salesforce, HubSpot, etc." />
          </label>
          <div className="po-mb14">
            <div className="po-kicker po-mb6">Status</div>
            <div className="po-pills">
              {PERSONA_STATUSES.map(s => (
                <button type="button" key={s.id} className="chip po-pill tap" aria-pressed={form.status === s.id}
                  data-tone={s.id === 'closed' ? 'negative' : undefined} onClick={() => setF({ status: s.id })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="po-row">
            <button type="button" className="btn po-act po-act-grow tap" onClick={() => { setShowForm(false); setEditId(null); setForm(blankPersona()); }}>Cancel</button>
            <button type="button" className="btn btn-primary po-act po-act-grow2 tap" onClick={savePersona}>Save Persona</button>
          </div>
        </div>
      )}

      {personas.length === 0 && !showForm ? (
        <SectionEmpty what="No personas yet"
          how="Add your ICPs to focus your BD — or let AI generate them based on your project." />
      ) : (
        <div className="po-personas">
          {personas.map(p => {
            const st = PERSONA_STATUSES.find(s => s.id === p.status) || PERSONA_STATUSES[0];
            return (
              <div key={p.id} className="po-persona" style={{ '--st': st.color }}>
                <div className="po-persona-head">
                  <div>
                    <div className="po-persona-name">{p.name || '(unnamed)'}</div>
                    {p.role && <div className="po-sub">{p.role}{p.company ? ` · ${p.company}` : ''}</div>}
                    {p.industry && <div className="po-sub">{p.industry}</div>}
                  </div>
                  <div className="po-persona-tools">
                    <Badge color={st.color}>{st.label}</Badge>
                    <button type="button" className="po-x tap" onClick={() => editPersona(p)} aria-label={`Edit ${p.name || 'persona'}`}><Icon name="Pencil" size={14} /></button>
                    <DeleteX onClick={() => deletePersona(p.id)} label={`Delete ${p.name || 'persona'}`} />
                  </div>
                </div>
                {p.painPoints && (
                  <div className="po-persona-sec">
                    <div className="po-persona-label">Pain Points</div>
                    <div className="po-persona-text">{p.painPoints}</div>
                  </div>
                )}
                {p.valueProp && (
                  <div className="po-persona-sec">
                    <div className="po-persona-label" data-muted="">Value Prop</div>
                    <div className="po-persona-text">{p.valueProp}</div>
                  </div>
                )}
                {p.outreachAngle && (
                  <div className="po-persona-sec">
                    <div className="po-persona-label">Outreach Angle</div>
                    <div className="po-persona-text">{p.outreachAngle}</div>
                  </div>
                )}
                {p.crmRef && (
                  <div className="po-crm">
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
function NewProjectModal({ onClose, onCreate, val, setVal }) {
  const ready = !!val.title.trim();
  return (
    <Modal title="New Project" accent={T.accent} onClose={onClose}>
      <div className="po-modal">
        <div className="po-modal-row">
          <input className="po-input po-emoji-in" value={val.emoji} onChange={e => setVal(p => ({ ...p, emoji: e.target.value }))} aria-label="Project emoji" />
          <input className="po-input" value={val.title} onChange={e => setVal(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && val.title.trim() && onCreate()}
            placeholder="Project title..." aria-label="Project title" />
        </div>
        <textarea className="po-input po-modal-desc" value={val.description} onChange={e => setVal(p => ({ ...p, description: e.target.value }))}
          placeholder="What is this project about? What's the goal?" aria-label="Project description" rows={3} />
        <div className="po-modal-sec">
          <Label>Category <span className="po-quiet">· optional, inferred</span></Label>
          <div className="po-pills">
            {Object.entries(PROJECT_CATEGORIES).map(([k, v]) => (
              <button type="button" key={k} className="chip tap" aria-pressed={val.category === k} onClick={() => setVal(p => ({ ...p, category: k }))}>
                <Icon name={v.icon} size={14} /> {v.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Priority</Label>
          <div className="po-prio">
            {['high', 'medium', 'low'].map(p => (
              <button type="button" key={p} className="po-seg tap" aria-pressed={val.priority === p} onClick={() => setVal(prev => ({ ...prev, priority: p }))}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="po-row">
          <button type="button" className="btn po-act po-act-grow tap" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary po-act po-act-grow2 tap" onClick={ready ? onCreate : undefined} disabled={!ready}>
            Create Project →
          </button>
        </div>
      </div>
    </Modal>
  );
}
