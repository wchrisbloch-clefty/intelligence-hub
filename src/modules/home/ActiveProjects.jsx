import { useApp } from '../../App.jsx';
import Icon from '../shared/Icon.jsx';

// Active projects with milestone progress. The progress bar is the one place
// accent earns its place (it marks state); the rest is quiet.
export default function ActiveProjects() {
  const { projects, setActiveModule } = useApp();
  const active = (projects || []).filter((p) => p.status === 'active');
  if (active.length === 0) return (
    <div style={{ padding: '16px 18px', background: 'var(--surface)', border: '1px dashed var(--rule)', borderRadius: 12, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
      No active projects. <button onClick={() => setActiveModule('projects')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0 }}>Start one →</button>
    </div>
  );
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12, padding: '16px 18px' }}>
      {active.slice(0, 5).map((p, i) => {
        const done = (p.milestones || []).filter((m) => m.done).length;
        const total = (p.milestones || []).length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <div key={p.id} onClick={() => setActiveModule('projects')}
            style={{ cursor: 'pointer', marginBottom: i < active.slice(0, 5).length - 1 ? 14 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                {total > 0 && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>{done}/{total} milestones</div>}
              </div>
              <div style={{ flexShrink: 0, fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--accent)' }}>{pct}%</div>
            </div>
            <div style={{ height: 5, background: 'var(--rule)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
