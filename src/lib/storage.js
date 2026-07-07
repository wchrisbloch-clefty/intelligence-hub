// src/lib/storage.js — client persistence.
// Same signatures the app already used on window.storage:
//   get(key) → { value } | null   set(key, value)   delete(key)   list(prefix)
// Primary: /api/storage (Upstash, cross-device). Fallback: localStorage, so the
// app still works offline or before the access code is entered. Writes go to
// both so a later server write isn't lost if the network blips.
const LS_PREFIX = ''; // keys are already namespaced (aether_*)

function lsGet(key) {
  try { const v = localStorage.getItem(LS_PREFIX + key); return v == null ? null : { value: v }; }
  catch { return null; }
}
function lsSet(key, value) { try { localStorage.setItem(LS_PREFIX + key, value); } catch {} }
function lsDel(key) { try { localStorage.removeItem(LS_PREFIX + key); } catch {} }
function lsList(prefix) {
  try {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  } catch { return []; }
}

// A 401 from any storage call means the session cookie expired — tell the app
// to show the lock screen again.
function onAuthExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ih-auth-expired'));
}

export const storage = {
  async get(key) {
    try {
      const r = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, { credentials: 'same-origin' });
      if (r.status === 401) { onAuthExpired(); return lsGet(key); }
      if (r.ok) {
        const { value } = await r.json();
        if (value != null) { lsSet(key, value); return { value }; }
        return lsGet(key); // server empty → fall back to any local copy
      }
    } catch {}
    return lsGet(key);
  },

  async set(key, value) {
    lsSet(key, value); // optimistic local write
    try {
      const r = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ key, value }),
      });
      if (r.status === 401) onAuthExpired();
    } catch {}
  },

  async delete(key) {
    lsDel(key);
    try {
      const r = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
        method: 'DELETE', credentials: 'same-origin',
      });
      if (r.status === 401) onAuthExpired();
    } catch {}
  },

  async list(prefix = '') {
    try {
      const r = await fetch(`/api/storage?list=1&prefix=${encodeURIComponent(prefix)}`, { credentials: 'same-origin' });
      if (r.status === 401) { onAuthExpired(); return lsList(prefix); }
      if (r.ok) { const { keys } = await r.json(); return keys || []; }
    } catch {}
    return lsList(prefix);
  },
};

export default storage;

// ── Sync-first helpers for modules whose state is seeded synchronously ──
// Read localStorage immediately (fast first paint), write through to both,
// and hydrate from the server after mount so data follows the user across
// devices. Values are JSON.
export function readLocal(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}

export function writeThrough(key, value) {
  const s = JSON.stringify(value);
  try { localStorage.setItem(key, s); } catch {}
  storage.set(key, s); // fire-and-forget server sync
}

export async function hydrate(key) {
  const r = await storage.get(key);
  if (!r) return undefined;
  try { return JSON.parse(r.value); } catch { return undefined; }
}
