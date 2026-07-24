import { useState, useEffect } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { getSession, signInWithPassword, onAuthChange } from '../lib/cloudSync.js';

// Wraps the app in an email/password gate when Supabase is configured.
// When it isn't (local dev with no env vars), renders children directly so
// the app keeps working against plain localStorage.
export default function AuthGate({ children }) {
  // If Supabase isn't configured, there's nothing to gate.
  if (!isSupabaseConfigured()) return children;

  const [status, setStatus] = useState('checking'); // checking | out | in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession().then((session) => {
      if (alive) setStatus(session ? 'in' : 'out');
    });
    const unsub = onAuthChange((session) => {
      if (alive) setStatus(session ? 'in' : 'out');
    });
    return () => { alive = false; unsub(); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      // onAuthChange flips status to 'in'.
    } catch (err) {
      setError(err?.message || 'Sign-in failed. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'in') return children;
  if (status === 'checking') return <Splash label="Connecting…" />;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #0a0a0f)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <form onSubmit={submit} style={{
        width: '100%',
        maxWidth: 360,
        background: 'var(--surface, #14141c)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 16,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 28, fontFamily: "'Fraunces', serif", fontWeight: 800, color: 'var(--text, #f5f5f7)', letterSpacing: -1 }}>Aether</div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--dim, #6b6b7b)', textTransform: 'uppercase', marginTop: 4 }}>Intelligence Hub</div>
        </div>

        <label style={labelStyle}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={inputStyle}
          />
        </label>

        {error && (
          <div style={{ fontSize: 12, color: '#f87171', lineHeight: 1.4 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 4,
            padding: '11px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent, #00C6E6)',
            color: '#04040a',
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--dim, #6b6b7b)',
};

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border, rgba(255,255,255,0.12))',
  background: 'var(--bg, #0a0a0f)',
  color: 'var(--text, #f5f5f7)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

function Splash({ label }) {
  return (
    <div style={{ height: '100vh', background: 'var(--bg, #0a0a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 28, fontFamily: "'Fraunces', serif", fontWeight: 800, color: 'var(--text, #f5f5f7)', letterSpacing: -1 }}>Aether</div>
      <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim, #6b6b7b)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
