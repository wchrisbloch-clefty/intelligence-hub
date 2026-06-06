import { useState } from 'react';
import { useApp } from '../App.jsx';
import { saveProjects, uid } from '../utils.js';
import { PROJECT_CATEGORIES, PROJECT_STATUSES } from '../constants.js';
import { Card, Badge, Label, Btn, Input, Modal } from './shared/Common.jsx';

export default function ProjectsOS() {
  const { projects, setProjects, isMobile, isPhone } = useApp();
  const [activeProject, setActiveProject] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', emoji: '🚀', description: '', category: 'business', priority: 'high' });
  const [statusFilter, setStatusFilter] = useState('all');

  const updateProjects = async (updated) => {
    setProjects(updated);
    await saveProjects(updated);
  };

  const createProject = async () => {
    if (!newProject.title.trim()) return;
    const proj = {
      id: uid(),
      title: newProject.title,
      emoji: newProject.emoji || '🚀',
      status: 'planning',
      category: newProject.category,
      color: PROJECT_CATEGORIES[newProject.category]?.color || '#00FFB2',
      description: newProject.description,
      milestones: [],
      connections: [],
      blueOcean: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      priority: newProject.priority,
    };
    await updateProjects([...projects, proj]);
    setNewProject({ title: '', emoji: '🚀', description: '', category: 'business', priority: 'high' });
    setShowNew(false);
    setActiveProject(proj.id);
  };

  const updateMilestone = async (projId, milestoneId, done) => {
    const updated = projects.map(p =>
      p.id === projId ? { ...p, milestones: p.milestones.map(m => m.id === milestoneId ? { ...m, done } : m), updatedAt: Date.now() } : p
    );
    await updateProjects(updated);
  };

  const addMilestone = async (projId, text) => {
    if (!text.trim()) return;
    const updated = projects.map(p =>
      p.id === projId ? { ...p, milestones: [...p.milestones, { id: uid(), text, done: false }], updatedAt: Date.now() } : p
    );
    await updateProjects(updated);
  };

  const changeStatus = async (projId, status) => {
    const updated = projects.map(p => p.id === projId ? { ...p, status, updatedAt: Date.now() } : p);
    await updateProjects(updated);
  };

  const deleteProject = async (projId) => {
    await updateProjects(projects.filter(p => p.id !== projId));
    setActiveProject(null);
  };

  const filtered = statusFilter === 'all' ? projects : projects.filter(p => p.status === statusFilter);

  if (activeProject) {
    const proj = projects.find(p => p.id === activeProject);
    if (!proj) { setActiveProject(null); return null; }
    const done = proj.milestones.filter(m => m.done).length;
    const pct = proj.milestones.length > 0 ? Math.round((done / proj.milestones.length) * 100) : 0;
    const cat = PROJECT_CATEGORIES[proj.category];
    return <ProjectDetail proj={proj} cat={cat} pct={pct} done={done}
      onBack={() => setActiveProject(null)}
      onUpdateMilestone={(mid, v) => updateMilestone(proj.id, mid, v)}
      onAddMilestone={text => addMilestone(proj.id, text)}
      onChangeStatus={status => changeStatus(proj.id, status)}
      onDelete={() => deleteProject(proj.id)}
    />;
  }

  const statuses = PROJECT_STATUSES;

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
        {[{ id: 'all', label: 'All', color: 'var(--subtle)' }, ...statuses].map(s => (
          <div key={s.id} onClick={() => setStatusFilter(s.id)}
            style={{ padding: isMobile ? '9px 14px' : '5px 14px', fontSize: 10, border: `1px solid ${statusFilter === s.id ? s.color : 'var(--bord2)'}`, color: statusFilter === s.id ? s.color : 'var(--subtle)', borderRadius: 20, cursor: 'pointer', background: statusFilter === s.id ? `${s.color}15` : 'transparent', minHeight: isMobile ? 40 : undefined }}>
            {s.label} {s.id !== 'all' ? `(${projects.filter(p => p.status === s.id).length})` : `(${projects.length})`}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 16, overflowX: isMobile ? 'auto' : 'visible' }}>
        {statuses.map(status => {
          const cols = projects.filter(p => p.status === status.id);
          return (
            <div key={status.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: status.color, textTransform: 'uppercase' }}>{status.label}</div>
                <div style={{ fontSize: 10, color: 'var(--dim)', background: 'var(--surface)', borderRadius: 10, padding: '1px 7px' }}>{cols.length}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cols.map(proj => {
                  const done = proj.milestones.filter(m => m.done).length;
                  const pct = proj.milestones.length > 0 ? Math.round((done / proj.milestones.length) * 100) : 0;
                  const cat = PROJECT_CATEGORIES[proj.category];
                  return (
                    <div key={proj.id} onClick={() => setActiveProject(proj.id)}
                      style={{ padding: '14px', background: 'var(--surface)', border: `1px solid ${proj.color}20`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 18 }}>{proj.emoji}</div>
                        <Badge color={cat?.color || 'var(--subtle)'}>{cat?.label || 'Other'}</Badge>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.35 }}>{proj.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--subtle)', lineHeight: 1.5, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{proj.description}</div>
                      {proj.milestones.length > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 9, color: 'var(--dim)' }}>{done}/{proj.milestones.length} milestones</div>
                            <div style={{ fontSize: 9, color: proj.color }}>{pct}%</div>
                          </div>
                          <div style={{ background: 'var(--border)', borderRadius: 2, height: 2 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: proj.color, borderRadius: 2, transition: 'width 0.4s' }} />
                          </div>
                        </>
                      )}
                      {proj.priority === 'high' && (
                        <div style={{ marginTop: 8, fontSize: 8, color: '#ff6644', letterSpacing: 1 }}>▲ HIGH PRIORITY</div>
                      )}
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
        <Modal title="New Project" accent="#ff8844" onClose={() => setShowNew(false)}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <input value={newProject.emoji} onChange={e => setNewProject(p => ({ ...p, emoji: e.target.value }))}
              style={{ width: 50, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', color: 'var(--text-b)', fontSize: 18, outline: 'none', textAlign: 'center' }} />
            <input value={newProject.title} onChange={e => setNewProject(p => ({ ...p, title: e.target.value }))}
              placeholder="Project title..."
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <textarea value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
            placeholder="What is this project about? What's the goal?" rows={3}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
          <div style={{ marginBottom: 14 }}>
            <Label>Category</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(PROJECT_CATEGORIES).map(([k, v]) => (
                <div key={k} onClick={() => setNewProject(p => ({ ...p, category: k }))}
                  style={{ padding: isMobile ? '9px 14px' : '5px 12px', fontSize: 10, border: `1px solid ${newProject.category === k ? v.color : 'var(--bord2)'}`, color: newProject.category === k ? v.color : 'var(--subtle)', borderRadius: 6, cursor: 'pointer', background: newProject.category === k ? `${v.color}15` : 'transparent', minHeight: isMobile ? 40 : undefined }}>
                  {v.icon} {v.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Label>Priority</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['high', 'medium', 'low'].map(p => (
                <div key={p} onClick={() => setNewProject(prev => ({ ...prev, priority: p }))}
                  style={{ flex: 1, padding: '8px', border: `1px solid ${newProject.priority === p ? '#ff8844' : 'var(--bord2)'}`, borderRadius: 8, textAlign: 'center', fontSize: 10, color: newProject.priority === p ? '#ff8844' : 'var(--subtle)', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div onClick={() => setShowNew(false)} style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer' }}>Cancel</div>
            <div onClick={createProject} style={{ flex: 2, padding: '11px', background: '#ff8844', borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#000', cursor: 'pointer' }}>Create Project →</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProjectDetail({ proj, cat, pct, done, onBack, onUpdateMilestone, onAddMilestone, onChangeStatus, onDelete }) {
  const [newMilestone, setNewMilestone] = useState('');
  const { isMobile } = useApp();
  const statusConfig = PROJECT_STATUSES.find(s => s.id === proj.status);

  return (
    <div style={{ padding: isMobile ? '16px 16px 72px' : '24px 28px 80px', maxWidth: 760, margin: '0 auto' }}>
      <div onClick={onBack} style={{ fontSize: 11, color: 'var(--subtle)', cursor: 'pointer', marginBottom: 20 }}>← Projects</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{proj.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", marginBottom: 4 }}>{proj.title}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge color={cat?.color || 'var(--subtle)'}>{cat?.label || 'Other'}</Badge>
            <Badge color={statusConfig?.color || 'var(--subtle)'}>{proj.status}</Badge>
            {proj.priority === 'high' && <Badge color="#ff6644">high priority</Badge>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROJECT_STATUSES.map(s => (
            <div key={s.id} onClick={() => onChangeStatus(s.id)}
              style={{ padding: isMobile ? '9px 14px' : '5px 10px', fontSize: 9, border: `1px solid ${proj.status === s.id ? s.color : 'var(--border)'}`, color: proj.status === s.id ? s.color : 'var(--subtle)', borderRadius: 6, cursor: 'pointer', background: proj.status === s.id ? `${s.color}12` : 'transparent', minHeight: isMobile ? 40 : undefined }}>
              {s.label}
            </div>
          ))}
          <div onClick={onDelete} style={{ padding: isMobile ? '9px 14px' : '5px 10px', fontSize: 9, border: '1px solid #ff444440', color: '#ff4444', borderRadius: 6, cursor: 'pointer', minHeight: isMobile ? 40 : undefined }}>Delete</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>{proj.description}</div>

      {proj.milestones.length > 0 && (
        <div style={{ padding: '16px', background: 'var(--surface)', border: `1px solid ${proj.color}20`, borderRadius: 10, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <Label>Progress</Label>
            <div style={{ fontSize: 14, fontWeight: 800, color: proj.color, fontFamily: "'Fraunces', serif" }}>{pct}%</div>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 3, height: 5, marginBottom: 14 }}>
            <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${proj.color}, ${proj.color}80)`, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--subtle)' }}>{done} of {proj.milestones.length} milestones complete</div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <Label>Milestones</Label>
        {proj.milestones.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: `1px solid ${m.done ? proj.color + '30' : 'var(--border)'}`, borderRadius: 8, marginBottom: 7, cursor: 'pointer' }}
            onClick={() => onUpdateMilestone(m.id, !m.done)}>
            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${m.done ? proj.color : 'var(--dim)'}`, background: m.done ? proj.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              {m.done && <span style={{ fontSize: 8, color: '#000', fontWeight: 900 }}>✓</span>}
            </div>
            <div style={{ fontSize: 12, color: m.done ? 'var(--subtle)' : 'var(--text-b)', textDecoration: m.done ? 'line-through' : 'none', lineHeight: 1.5 }}>{m.text}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && newMilestone.trim() && (onAddMilestone(newMilestone), setNewMilestone(''))}
            placeholder="Add milestone..."
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-b)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={() => { if (newMilestone.trim()) { onAddMilestone(newMilestone); setNewMilestone(''); } }}
            style={{ padding: isMobile ? '11px 16px' : '9px 14px', background: proj.color, border: 'none', borderRadius: 8, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer', minHeight: 40 }}>Add</button>
        </div>
      </div>

      {proj.connections?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Label>Knowledge Connections</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {proj.connections.map(c => (
              <div key={c} style={{ fontSize: 10, padding: isMobile ? '9px 14px' : '5px 12px', background: 'var(--surface)', border: '1px solid #00FFB225', color: '#00FFB2', borderRadius: 20, minHeight: isMobile ? 40 : undefined }}>📚 {c}</div>
            ))}
          </div>
        </div>
      )}

      {proj.blueOcean && (
        <div style={{ padding: '14px 16px', background: '#6366F108', border: '1px solid #6366F130', borderRadius: 10 }}>
          <Label color="#6366F1">🌊 Blue Ocean Insight</Label>
          <div style={{ fontSize: 12, color: 'var(--text-c)', lineHeight: 1.7 }}>{proj.blueOcean}</div>
        </div>
      )}
    </div>
  );
}
