import { useState, useEffect, useCallback } from 'react';
import './auth-gate.css';

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
    <div className="ag-screen" role="status" aria-label="Loading">
      <div className="ag-dots">
        <div className="ag-dot" /><div className="ag-dot" /><div className="ag-dot" />
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
    <div className="ag-screen">
      <form onSubmit={submit} className="ag-form">
        <h1 className="ag-title">
          The Film Room
        </h1>
        <div className="ag-sub">
          Enter your access code to study the tape.
        </div>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          autoFocus
          aria-label="Access code"
          aria-invalid={error ? 'true' : undefined}
          className="ag-input"
        />
        {error && <div className="ag-error" role="alert">{error}</div>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          aria-busy={busy ? 'true' : undefined}
          className="ag-submit"
        >
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  );
}
