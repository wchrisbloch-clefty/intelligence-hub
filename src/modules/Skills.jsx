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
import './skills.css';

// Skills — a tracked topic with a confidence *trajectory*, read live from the
// Phase 2 graph. User skills are add/rename/archivable and map to one or more
// graph concepts; "what moved it" drills into the concept footprint; decay
// surfaces what you're quietly losing. Layout is persisted with the awaited/
// revert pattern (a failed on-device write reverts and shows inline).

const moduleLabel = (m) => MODE_META[m]?.label || m;

// The level colour arrives on the card as --lvl; the SVG strokes in currentColor.
function Sparkline({ series }) {
  if (!series || series.length < 2) return <div className="sk-spark-empty" />;
  const w = 96, h = 24, pad = 2;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / 10) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="sk-spark" width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => {
        const x = pad + (i / (series.length - 1)) * (w - pad * 2);
        const y = h - pad - (v / 10) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="1.6" fill="currentColor" />;
      })}
    </svg>
  );
}

function TrendBadge({ trend }) {
  const map = {
    up:   { name: 'TrendingUp',   label: 'Rising' },
    down: { name: 'TrendingDown', label: 'Slipping' },
    flat: { name: 'Minus',        label: 'Steady' },
  };
  const key = map[trend] ? trend : 'flat';
  const { name, label } = map[key];
  return (
    <span className="sk-trend" data-trend={key}>
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
    <div className="sk-card" style={{ '--lvl': level.token }}
      data-decaying={skill.decaying ? '' : undefined} data-archived={skill.archived ? '' : undefined}>
      <div className="sk-card-head">
        <div className="sk-card-id">
          {editing ? (
            <input className="sk-name-input" autoFocus aria-label="Skill name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} onBlur={saveName} />
          ) : (
            <div className="sk-name">{skill.name}</div>
          )}
          <div className="sk-meta">
            <span className="sk-level">{level.label}</span>
            {skill.confidence != null && <span className="sk-conf">{skill.confidence}/10</span>}
            <TrendBadge trend={skill.trend} />
            {skill.archived && <span className="sk-archived-tag">Archived</span>}
          </div>
        </div>
        <div className="sk-spark-wrap"><Sparkline series={skill.series} /></div>
      </div>

      {(skill.due > 0 || skill.decaying) && (
        <div className="sk-flags">
          {skill.due > 0 && (
            <span className="sk-flag" data-kind="due">{skill.due} due for review</span>
          )}
          {skill.decaying && (
            <span className="sk-flag" data-kind="decay">
              <Icon name="AlertTriangle" size={11} strokeWidth={2.4} /> Decaying — neglected
            </span>
          )}
        </div>
      )}

      {/* What moved it — drillable into the concept footprint */}
      {moved && (
        <button type="button" className="sk-moved tap" aria-expanded={drill} onClick={() => setDrill((d) => !d)}>
          <span className="sk-moved-text">
            Last moved by <b>{moduleLabel(moved.module) || moved.module || 'a session'}</b>{moved.source ? ` · ${moved.source}` : ''}
          </span>
          <Icon name={drill ? 'ChevronUp' : 'ChevronDown'} size={13} />
        </button>
      )}
      {drill && <div className="sk-drill"><ConnectedKnowledge topic={skill.conceptNames?.[0] || skill.name} compact /></div>}

      {skill.modules.length > 0 && (
        <div className="sk-mods">
          {skill.modules.map((m) => (
            <button type="button" key={m} className="sk-mod tap" onClick={() => setActiveModule(m)}>
              <NavIcon id={m} size={12} strokeWidth={2} /> {moduleLabel(m)}
            </button>
          ))}
        </div>
      )}

      {/* Editor — concept mapping + archive/untrack (user skills only) */}
      {editing && skill.userDefined && (
        <div className="sk-editor">
          <div className="sk-editor-eyebrow">Map to concepts</div>
          {concepts.length === 0 ? (
            <div className="sk-editor-empty">No graph concepts yet — study something and they'll appear here.</div>
          ) : (
            <div className="sk-concepts">
              {concepts.map((c) => (
                <button type="button" key={c.key} className="chip sk-concept tap" aria-pressed={mapped.has(c.key)} onClick={() => toggleConcept(c.key)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="sk-editor-actions">
            <button type="button" className="sk-act tap" onClick={() => onArchive(skill.userId, !skill.archived)}>
              <Icon name={skill.archived ? 'ArchiveRestore' : 'Archive'} size={13} /> {skill.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button type="button" className="sk-del tap" onClick={() => onRemove(skill.userId)}>Delete</button>
          </div>
        </div>
      )}

      <div className="sk-foot">
        <AskChip type="skill" object={skill} />
        {skill.userDefined && (
          <button type="button" className="sk-act sk-act-sm tap" aria-pressed={editing} onClick={() => setEditing((e) => !e)} title="Edit skill">
            <Icon name={editing ? 'Check' : 'Pencil'} size={13} /> {editing ? 'Done' : 'Edit'}
          </button>
        )}
        {skill.observations > 0 && (
          <span className="sk-obs">{skill.observations} observation{skill.observations === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
}

export default function Skills() {
  const [userSkills, setUserSkills] = useState(loadUserSkills);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

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
    { label: `${summary.total} tracked`, kind: 'total' },
    { label: `${summary.rising} rising`, kind: 'rising' },
    { label: `${summary.due} due`, kind: 'due' },
    { label: `${summary.decaying} decaying`, kind: 'decaying' },
  ];

  return (
    <div className="sk">
      <div className="sk-eyebrow">Practice</div>
      <div className="sk-title">Skills</div>
      <div className="sk-lede">Confidence trajectories, read from everything you study — with a decay warning for what you're quietly losing.</div>

      {err && <div className="sk-err" role="alert">⚠ {err}</div>}

      <div className="sk-bar">
        {chips.map((c) => (
          <span key={c.label} className="sk-stat" data-kind={c.kind}>{c.label}</span>
        ))}
        {archivedCount > 0 && (
          <button type="button" className="chip sk-toggle tap" aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
        <div className="sk-add">
          <input className="sk-add-input" aria-label="Track a skill" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Track a skill…" />
          <button type="button" className="btn btn-primary sk-add-btn" onClick={add}>
            <Icon name="Plus" size={14} strokeWidth={2.5} /> Track
          </button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="sk-empty">
          <div className="sk-empty-title">No skills tracked yet</div>
          <div className="sk-empty-body">Study a book, run a deep dive, or take a quiz — skills build themselves from what you learn. Or name one above to start tracking it.</div>
        </div>
      ) : (
        <div className="sk-grid">
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
