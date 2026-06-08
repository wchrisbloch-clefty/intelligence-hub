import { useApp } from '../App.jsx';
import { NAV_ITEMS } from '../constants.js';

export default function Sidebar({ collapsed, onToggle }) {
  const { activeModule, setActiveModule, graph } = useApp();

  const streak     = graph?.streak || 0;
  const totalHours = Math.round((graph?.totalTime || 0) / 60);
  const topicCount = Object.keys(graph?.topics || {}).length;

  return (
    <nav style={{
      width: collapsed ? 62 : 220,
      flexShrink: 0,
      height: '100%',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.22s ease',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid var(--border)',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent, #00C6E6), #6366F1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 900,
          color: '#fff',
          flexShrink: 0,
          fontFamily: "'Fraunces', serif",
          boxShadow: '0 2px 12px var(--accent-glow, rgba(0,198,230,0.2))',
        }}>A</div>

        {!collapsed && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: "'Fraunces', serif", letterSpacing: -0.5, lineHeight: 1 }}>
              Aether
            </div>
            <div style={{ fontSize: 8, letterSpacing: 2.5, color: 'var(--accent, #00C6E6)', textTransform: 'uppercase', marginTop: 2 }}>
              Intelligence Hub
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0', scrollbarWidth: 'none' }}>
        {NAV_ITEMS.map(item => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '7px 0' : '7px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'var(--accent-glow, rgba(0,198,230,0.09))' : 'transparent',
                border: 'none',
                borderLeft: collapsed ? 'none' : `3px solid ${active ? 'var(--accent, #00C6E6)' : 'transparent'}`,
                color: active ? 'var(--accent, #00C6E6)' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'all 0.12s',
                outline: 'none',
                position: 'relative',
                minHeight: 36,
              }}
            >
              {active && collapsed && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3, height: 26,
                  background: 'var(--accent, #00C6E6)',
                  borderRadius: '0 3px 3px 0',
                }} />
              )}
              <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1, userSelect: 'none' }}>{item.icon}</span>
              {!collapsed && (
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stats strip — expanded only */}
      {!collapsed && (
        <div style={{ padding: '6px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 4 }}>
          {[
            { value: streak + 'd', label: '🔥' },
            { value: totalHours + 'h', label: '⏱' },
            { value: topicCount, label: '📚' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, padding: '5px 3px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'transparent',
          border: 'none',
          borderTop: '1px solid var(--border)',
          cursor: 'pointer',
          color: 'var(--dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          paddingRight: collapsed ? 0 : 16,
          gap: 6,
          outline: 'none',
          flexShrink: 0,
          minHeight: 40,
        }}
      >
        <span style={{
          display: 'inline-block',
          transition: 'transform 0.22s',
          transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          fontSize: 14,
        }}>›</span>
        {!collapsed && <span style={{ fontSize: 10, letterSpacing: 0.5 }}>Collapse</span>}
      </button>
    </nav>
  );
}
