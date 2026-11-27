import { useApp } from '../../App.jsx';
import { SectionEmpty } from '../shared/SectionState.jsx';

// Active projects with milestone progress. The progress bar is the one place
// accent earns its place (it marks state); the rest is quiet. Styles: home.css.
export default function ActiveProjects() {
  const { projects, setActiveModule } = useApp();
  const active = (projects || []).filter((p) => p.status === 'active').slice(0, 5);
  if (active.length === 0) return (
    <SectionEmpty what="No active projects" how="A project with milestones shows its progress here."
      actionLabel="Start one →" onAction={() => setActiveModule('projects')} />
  );
  return (
    <div className="hm-card">
      {active.map((p) => {
        const done = (p.milestones || []).filter((m) => m.done).length;
        const total = (p.milestones || []).length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <button type="button" key={p.id} className="hm-prog tap" onClick={() => setActiveModule('projects')}>
            <span className="hm-prog-top">
              <span style={{ minWidth: 0 }}>
                <span className="hm-prog-title" style={{ display: 'block' }}>{p.title}</span>
                {total > 0 && <span className="hm-prog-sub" style={{ display: 'block' }}>{done}/{total} milestones</span>}
              </span>
              <span className="hm-prog-val">{pct}%</span>
            </span>
            <span className="hm-bar" style={{ display: 'block', '--pct': `${pct}%` }}><span /></span>
          </button>
        );
      })}
    </div>
  );
}
