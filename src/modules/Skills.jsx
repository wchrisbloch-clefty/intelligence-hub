import { T, withAlpha } from '../theme';
import { useState } from 'react';
import { useApp } from '../App.jsx';
import { writeThrough } from '../lib/storage.js';
import {
  SKILLS_KEY, loadUserSkills, buildSkills, skillsSummary, levelFor, availableConcepts,
  skillAdd, skillRename, skillArchive, skillRemove, skillSetConcepts,
} from '../lib/skills.js';
import { MODE_META } from '../constants.js';
import NavIcon from './shared/NavIcon.jsx';
import AskChip from './shared/AskChip.jsx';
import Icon from './shared/Icon.jsx';
import ConnectedKnowledge from './shared/ConnectedKnowledge.jsx';

// Skills — a tracked topic with a confidence *trajectory*, read live from the
// Phase 2 graph. User skills are add/rename/archivable and map to one or more
// graph concepts; "what moved it" drills into the concept footprint; decay
// surfaces what you're quietly losing. Layout is persisted with the awaited/
// revert pattern (a failed on-device write reverts and shows inline).

const moduleLabel = (m) => MODE_META[m]?.label || m;

function Sparkline({ series, color }) {
  if (!series || series.length < 2) return <div style={{ height: 24 }} />;
  const w = 96, h = 24, pad = 2;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / 10) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => {
        const x = pad + (i / (series.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / 10) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="1.6" fill={color} />;
      })}
    </svg>
  );
}

function TrendBadge({ trend }) {
  const map = {
    up:   { name: 'TrendingUp',   color: 'var(--positive)', label: 'Rising' },
    down: { name: 'TrendingDown', color: 'var(--negative)', label: 'Slipping' },
    flat: { name: 'Minus',        color: 'var(--dim)',      label: 'Steady' },
  };
  const { name, color, label } = map[trend] || map.flat;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 700, color }}>
      <Icon name={name} size={13} strokeWidth={2.4} /> {label}
    </span>
  );
}

function SkillCard({ skill, concepts, onRename, onArchive, onRemove, onSetConcepts }) {
  const { setActiveModule } = useApp();
  const [editing, setEditing] = useState(false);
  const [drill, setDrill] = useState(false);
  const [name, setName] = useState(skill.name);
  const level = levelFor(skill.confidence);
  const moved = skill.movedBy;
  const mapped = new Set(skill.mappedKeys || []);

  const saveName = () => { if (name.trim() && name.trim() !== skill.name) onRename(skill.userId, name.trim()); setEditing(false); };
  const toggleConcept = (key) => {
    const next = mapped.has(key) ? (skill.mappedKeys || []).filter((k) => k !== key) : [...(skill.mappedKeys || []), key];
    onSetConcepts(skill.userId, next);
  };

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${skill.decaying ? withAlpha('var(--caution)', 40) : 'var(--rule)'}`, borderRadius: 14, padding: 'var(--s5)', opacity: skill.archived ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editing ? (
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} onBlur={saveName}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: '5px 9px', color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 800, fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' }} />
          ) : (
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 'var(--lh-tight)' }}>{skill.name}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: level.token }}>{level.label}</span>
            {skill.confidence != null && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{skill.confidence}/10</span>}
            <TrendBadge trend={skill.trend} />
            {skill.archived && <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-tertiary)' }}>Archived</span>}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}><Sparkline series={skill.series} color={level.token} /></div>
      </div>

      {(skill.due > 0 || skill.decaying) && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          {skill.due > 0 && (
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: withAlpha(T.accent, 10), border: `1px solid ${withAlpha(T.accent, 30)}`, borderRadius: 20, padding: '3px 10px' }}>{skill.due} due for review</span>
          )}
          {skill.decaying && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--caution)', background: withAlpha('var(--caution)', 10), border: `1px solid ${withAlpha('var(--caution)', 30)}`, borderRadius: 20, padding: '3px 10px' }}>
              <Icon name="AlertTriangle" size={11} strokeWidth={2.4} /> Decaying — neglected
            </span>
          )}
        </div>
      )}

      {/* What moved it — drillable into the concept footprint */}
      {moved && (
        <button onClick={() => setDrill((d) => !d)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            Last moved by <b style={{ color: 'var(--text)' }}>{moduleLabel(moved.module) || moved.module || 'a session'}</b>{moved.source ? ` · ${moved.source}` : ''}
          </span>
          <Icon name={drill ? 'ChevronUp' : 'ChevronDown'} size={13} style={{ color: 'var(--text-tertiary)' }} />
        </button>
      )}
      {drill && <div style={{ marginBottom: 12 }}><ConnectedKnowledge topic={skill.conceptNames?.[0] || skill.name} compact /></div>}

      {skill.modules.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {skill.modules.map((m) => (
            <button key={m} onClick={() => setActiveModule(m)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
              <NavIcon id={m} size={12} strokeWidth={2} /> {moduleLabel(m)}
            </button>
          ))}
        </div>
      )}

      {/* Editor — concept mapping + archive/untrack (user skills only) */}
      {editing && skill.userDefined && (
        <div style={{ marginBottom: 12, padding: '12px', borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--bg)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Map to concepts</div>
          {concepts.length === 0 ? (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>No graph concepts yet — study something and they'll appear here.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {concepts.map((c) => {
                const on = mapped.has(c.key);
                return (
                  <button key={c.key} onClick={() => toggleConcept(c.key)}
                    style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', borderRadius: 20, border: `1px solid ${on ? T.accent : 'var(--rule)'}`, background: on ? withAlpha(T.accent, 10) : 'transparent', color: on ? T.accent : 'var(--text-secondary)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => onArchive(skill.userId, !skill.archived)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon name={skill.archived ? 'ArchiveRestore' : 'Archive'} size={13} /> {skill.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button onClick={() => onRemove(skill.userId)} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--negative)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Delete</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <AskChip type="skill" object={skill} />
        {skill.userDefined && (
          <button onClick={() => setEditing((e) => !e)} title="Edit skill"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: editing ? T.accent : 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name={editing ? 'Check' : 'Pencil'} size={13} /> {editing ? 'Done' : 'Edit'}
          </button>
        )}
        {skill.observations > 0 && (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{skill.observations} observation{skill.observations === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
}

export default function Skills() {
  const { isMobile, isPhone } = useApp();
  const [userSkills, setUserSkills] = useState(loadUserSkills);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');
  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';

  const skills = buildSkills(userSkills, { includeArchived: showArchived });
  const summary = skillsSummary(skills);
  const concepts = availableConcepts();
  const archivedCount = userSkills.filter((s) => s.archived).length;

  // Awaited/revert persistence (PR #18 pattern): apply, await, revert on a
  // failed on-device write and surface it inline.
  const persist = async (next) => {
    const prev = userSkills;
    setUserSkills(next);
    const r = await writeThrough(SKILLS_KEY, next);
    if (!r.localOk) { setUserSkills(prev); setErr('Couldn’t save your skills — on-device storage is full or blocked.'); }
    else setErr('');
  };
  const add = () => { if (newName.trim()) { persist(skillAdd(userSkills, newName.trim())); setNewName(''); } };

  const chips = [
    { label: `${summary.total} tracked`, color: 'var(--text)' },
    { label: `${summary.rising} rising`, color: 'var(--positive)' },
    { label: `${summary.due} due`, color: T.accent },
    { label: `${summary.decaying} decaying`, color: 'var(--caution)' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: `20px ${pad} 80px` }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Practice</div>
      <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>Skills</div>
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginTop: 6 }}>Confidence trajectories, read from everything you study — with a decay warning for what you're quietly losing.</div>

      {err && <div style={{ margin: '14px 0 0', padding: '10px 14px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--negative) 40%, transparent)', background: 'color-mix(in srgb, var(--negative) 10%, transparent)', color: 'var(--negative)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>⚠ {err}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0' }}>
        {chips.map((c) => (
          <span key={c.label} style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: c.color, background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 20, padding: '5px 12px' }}>{c.label}</span>
        ))}
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((v) => !v)} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: showArchived ? T.accent : 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
        <div style={{ display: 'flex', gap: 6, marginLeft: isMobile ? 0 : 'auto', flex: isMobile ? '1 1 100%' : 'none' }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Track a skill…"
            style={{ flex: 1, minWidth: 140, background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 'var(--fs-sm)', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={add} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: T.accent, color: T.onAccent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
            <Icon name="Plus" size={14} strokeWidth={2.5} /> Track
          </button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: 'var(--surface)', border: '1px dashed var(--rule)', borderRadius: 14 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text)', marginBottom: 6, fontWeight: 700 }}>No skills tracked yet</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-tertiary)', lineHeight: 'var(--lh-read)' }}>Study a book, run a deep dive, or take a quiz — skills build themselves from what you learn. Or name one above to start tracking it.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--s3)' }}>
          {skills.map((s) => (
            <SkillCard key={s.key} skill={s} concepts={concepts}
              onRename={(id, n) => persist(skillRename(userSkills, id, n))}
              onArchive={(id, a) => persist(skillArchive(userSkills, id, a))}
              onRemove={(id) => persist(skillRemove(userSkills, id))}
              onSetConcepts={(id, keys) => persist(skillSetConcepts(userSkills, id, keys))} />
          ))}
        </div>
      )}
    </div>
  );
}
