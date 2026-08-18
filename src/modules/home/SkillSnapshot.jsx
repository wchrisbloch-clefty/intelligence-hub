import { useApp } from '../../App.jsx';
import { buildSkills, levelFor } from '../../lib/skills.js';
import Icon from '../shared/Icon.jsx';

// A compact snapshot of the top skills — no radar (that lives in GrowthTools).
// Confidence bar marks state (accent); everything else is quiet.
export default function SkillSnapshot() {
  const { setActiveModule } = useApp();
  const skills = buildSkills().filter((s) => s.confidence != null).slice(0, 5);

  if (skills.length === 0) return (
    <div style={{ padding: '16px 18px', background: 'var(--surface)', border: '1px dashed var(--rule)', borderRadius: 12, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
      No skills tracked yet. <button onClick={() => setActiveModule('skills')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0 }}>Open Skills →</button>
    </div>
  );

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12, padding: '16px 18px' }}>
      {skills.map((s, i) => {
        const level = levelFor(s.confidence);
        const pct = Math.round((s.confidence / 10) * 100);
        return (
          <div key={s.key} onClick={() => setActiveModule('skills')} style={{ cursor: 'pointer', marginBottom: i < skills.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {s.trend === 'up' && <Icon name="TrendingUp" size={14} style={{ color: 'var(--positive)' }} />}
                {s.due > 0 && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{s.due} due</span>}
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: level.token }}>{s.confidence}/10</span>
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--rule)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
