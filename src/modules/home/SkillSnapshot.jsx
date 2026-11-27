import { useApp } from '../../App.jsx';
import { buildSkills, levelFor } from '../../lib/skills.js';
import Icon from '../shared/Icon.jsx';
import { SectionEmpty } from '../shared/SectionState.jsx';

// A compact snapshot of the top skills — no radar (that lives in GrowthTools).
// Confidence bar marks state (accent); everything else is quiet. Styles: home.css.
export default function SkillSnapshot() {
  const { setActiveModule } = useApp();
  const skills = buildSkills().filter((s) => s.confidence != null).slice(0, 5);

  if (skills.length === 0) return (
    <SectionEmpty what="No skills tracked yet" how="Quizzes, guides and drills log confidence here as you use them."
      actionLabel="Open Skills →" onAction={() => setActiveModule('skills')} />
  );

  return (
    <div className="hm-card">
      {skills.map((s) => {
        const level = levelFor(s.confidence);
        const pct = Math.round((s.confidence / 10) * 100);
        return (
          <button type="button" key={s.key} className="hm-prog tap" onClick={() => setActiveModule('skills')}>
            <span className="hm-prog-top">
              <span className="hm-prog-title">{s.name}</span>
              <span className="hm-prog-val">
                {s.trend === 'up' && <Icon name="TrendingUp" size={14} className="hm-prog-up" />}
                {s.due > 0 && <small>{s.due} due</small>}
                <small style={{ '--lv': level.token }} className="hm-lv">{s.confidence}/10</small>
              </span>
            </span>
            <span className="hm-bar" style={{ display: 'block', '--pct': `${pct}%` }}><span /></span>
          </button>
        );
      })}
    </div>
  );
}
