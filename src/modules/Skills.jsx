import { T, withAlpha } from '../theme';
import { useState } from 'react';
import { useApp } from '../App.jsx';
import { buildSkills, skillsSummary, levelFor, addUserSkill, removeUserSkill } from '../lib/skills.js';
import { MODE_META } from '../constants.js';
import NavIcon from './shared/NavIcon.jsx';
import AskChip from './shared/AskChip.jsx';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Plus } from 'lucide-react';

// Skills replaces the static mastery display. A skill is a tracked topic with a
// confidence *trajectory* — read live from the Phase 2 graph — showing where
// it's trending, what moved it, what's due, and what's decaying from neglect.

const moduleLabel = (m) => MODE_META[m]?.label || m;

function Sparkline({ series, color }) {
  if (!series || series.length < 2) return <div style={{ height: 24 }} />;
  const w = 96, h = 24, pad = 2;
  const max = 10, min = 0;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => {
        const x = pad + (i / (series.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="1.6" fill={color} />;
      })}
    </svg>
  );
}

function TrendBadge({ trend }) {
  const map = {
    up:   { Icon: TrendingUp,   color: 'var(--positive)', label: 'Rising' },
    down: { Icon: TrendingDown, color: 'var(--negative)', label: 'Slipping' },
    flat: { Icon: Minus,        color: 'var(--dim)',      label: 'Steady' },
  };
  const { Icon, color, label } = map[trend] || map.flat;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 700, color }}>
      <Icon size={13} strokeWidth={2.4} /> {label}
    </span>
  );
}

function SkillCard({ skill, onRemove }) {
  const { setActiveModule } = useApp();
  const level = levelFor(skill.confidence);
  const moved = skill.movedBy;
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${skill.decaying ? withAlpha('var(--caution)', 40) : 'var(--border)'}`, borderRadius: 14, padding: 'var(--s5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 'var(--lh-tight)' }}>{skill.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: level.token }}>{level.label}</span>
            {skill.confidence != null && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{skill.confidence}/10</span>}
            <TrendBadge trend={skill.trend} />
          </div>
        </div>
        <div style={{ flexShrink: 0 }}><Sparkline series={skill.series} color={level.token} /></div>
      </div>

      {/* Flags: due for review, decaying */}
      {(skill.due > 0 || skill.decaying) && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          {skill.due > 0 && (
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: withAlpha(T.accent, 10), border: `1px solid ${withAlpha(T.accent, 30)}`, borderRadius: 20, padding: '3px 10px' }}>
              {skill.due} due for review
            </span>
          )}
          {skill.decaying && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--caution)', background: withAlpha('var(--caution)', 10), border: `1px solid ${withAlpha('var(--caution)', 30)}`, borderRadius: 20, padding: '3px 10px' }}>
              <AlertTriangle size={11} strokeWidth={2.4} /> Decaying — neglected
            </span>
          )}
        </div>
      )}

      {/* What moved it */}
      {moved && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: 12 }}>
          Last moved by <b style={{ color: 'var(--text-b)' }}>{moduleLabel(moved.module) || moved.module || 'a session'}</b>
          {moved.source ? ` · ${moved.source}` : ''}
        </div>
      )}

      {/* Feeding modules — each links back to where the skill is built */}
      {skill.modules.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {skill.modules.map((m) => (
            <button key={m} onClick={() => setActiveModule(m)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
              <NavIcon id={m} size={12} strokeWidth={2} /> {moduleLabel(m)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <AskChip type="skill" object={skill} />
        {skill.userDefined && (
          <button onClick={() => onRemove(skill.userId)} style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>Untrack</button>
        )}
        {skill.observations > 0 && (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginLeft: skill.userDefined ? 0 : 'auto' }}>{skill.observations} observation{skill.observations === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
}

export default function Skills() {
  const { isMobile, isPhone } = useApp();
  const [skills, setSkills] = useState(buildSkills);
  const [newName, setNewName] = useState('');
  const summary = skillsSummary(skills);
  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';

  const add = () => {
    if (!newName.trim()) return;
    addUserSkill(newName.trim());
    setSkills(buildSkills());
    setNewName('');
  };
  const remove = (id) => { removeUserSkill(id); setSkills(buildSkills()); };

  const chips = [
    { label: `${summary.total} tracked`, color: 'var(--text-b)' },
    { label: `${summary.rising} rising`, color: 'var(--positive)' },
    { label: `${summary.due} due`, color: T.accent },
    { label: `${summary.decaying} decaying`, color: 'var(--caution)' },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: `20px ${pad} 80px` }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: T.accent, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Practice</div>
      <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>Skills</div>
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginTop: 6 }}>Confidence trajectories, read from everything you study — not a static score.</div>

      {/* Summary + add */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0' }}>
        {chips.map((c) => (
          <span key={c.label} style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: c.color, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px' }}>{c.label}</span>
        ))}
        <div style={{ display: 'flex', gap: 6, marginLeft: isMobile ? 0 : 'auto', flex: isMobile ? '1 1 100%' : 'none' }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Track a skill…"
            style={{ flex: 1, minWidth: 140, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-b)', fontSize: 'var(--fs-sm)', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={add} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: T.accent, color: T.onAccent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
            <Plus size={14} strokeWidth={2.5} /> Track
          </button>
        </div>
      </div>

      {skills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text)', marginBottom: 6, fontWeight: 700 }}>No skills tracked yet</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--dim)', lineHeight: 'var(--lh-read)' }}>
            Study a book, run a deep dive, or take a quiz — skills build themselves from what you learn. Or name one above to start tracking it.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 'var(--s3)' }}>
          {skills.map((s) => <SkillCard key={s.key} skill={s} onRemove={remove} />)}
        </div>
      )}
    </div>
  );
}
