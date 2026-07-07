import { useState, useEffect, useCallback } from 'react';

// Gates the whole app behind ACCESS_CODE. Checks the signed cookie on mount,
// shows the lock screen when absent/expired, and re-locks if any /api/* call
// reports 401 (via the global `ih-auth-expired` event).
export default function AuthGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | locked | unlocked

  const check = useCallback(async () => {
    try {
      const r = await fetch('/api/auth', { credentials: 'same-origin' });
      setStatus(r.ok ? 'unlocked' : 'locked');
    } catch {
      // Network/dev without functions — fail open to locked so the code screen shows.
      setStatus('locked');
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    const onExpired = () => setStatus('locked');
    window.addEventListener('ih-auth-expired', onExpired);
    return () => window.removeEventListener('ih-auth-expired', onExpired);
  }, []);

  if (status === 'checking') return <BootScreen />;
  if (status === 'locked') return <LockScreen onUnlock={() => setStatus('unlocked')} />;
  return children;
}

function BootScreen() {
  return (
    <div style={screenWrap}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #D9A441)', animation: `pulse 1.2s ${i * 0.2}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  );
}

function LockScreen({ onUnlock }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.authed) { onUnlock(); return; }
      setError(data.error || 'Incorrect access code');
    } catch {
      setError('Network error — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={screenWrap}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 30, fontWeight: 600, color: 'var(--chalk, var(--text))', letterSpacing: -0.5, marginBottom: 6 }}>
          The Film Room
        </div>
        <div style={{ fontSize: 12, color: 'var(--chalk-dim, var(--muted))', marginBottom: 28 }}>
          Enter your access code to study the tape.
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', textAlign: 'center', letterSpacing: 3,
            background: 'var(--surface)', border: `1px solid ${error ? 'var(--red, #C4553D)' : 'var(--line, var(--border))'}`,
            borderRadius: 8, padding: '13px 16px', color: 'var(--chalk, var(--text))', fontSize: 15,
            outline: 'none', fontFamily: 'inherit', marginBottom: 14,
          }}
        />
        {error && <div style={{ fontSize: 12, color: 'var(--red, #C4553D)', marginBottom: 14 }}>{error}</div>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          style={{
            width: '100%', padding: '13px', borderRadius: 8, border: 'none', cursor: busy || !code.trim() ? 'default' : 'pointer',
            background: busy || !code.trim() ? 'var(--surf2, var(--surface))' : 'var(--accent, #D9A441)',
            color: busy || !code.trim() ? 'var(--chalk-dim, var(--muted))' : '#1A130A',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit', minHeight: 44,
          }}
        >
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}

const screenWrap = {
  height: '100vh', width: '100vw', background: 'var(--ink, var(--bg))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexDirection: 'column', gap: 16, padding: 24,
};
