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

// ── Sync status ─────────────────────────────────────────────────────────────
// The server outcome of writes used to be swallowed, so a session where storage
// returned 503 for every write looked identical to one that was syncing fine.
// Track it explicitly and let the UI subscribe:
//   'synced'     — server writes are landing
//   'local-only' — storage isn't configured server-side (503 no_storage);
//                  writes stay on this device, which is an expected state
//   'error'      — a server write failed (5xx / network); data may not be syncing
let syncStatus = 'synced';
const syncListeners = new Set();

export function getSyncStatus() { return syncStatus; }

export function subscribeSync(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

function setSyncStatus(next) {
  if (next === syncStatus) return;
  syncStatus = next;
  syncListeners.forEach((fn) => { try { fn(next); } catch {} });
}

// Map a fetch Response / thrown error to a write result, updating sync status.
// 401 is left to the auth flow and does not change sync status.
function resultFromResponse(r) {
  if (r.status === 401) { onAuthExpired(); return { ok: false, code: 'auth_expired', status: 401 }; }
  if (r.status === 503) { setSyncStatus('local-only'); return { ok: false, code: 'no_storage', status: 503 }; }
  if (!r.ok) { setSyncStatus('error'); return { ok: false, code: 'server_error', status: r.status }; }
  setSyncStatus('synced');
  return { ok: true };
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

  // Keeps the optimistic local write, but returns the server outcome instead of
  // discarding it: { ok:true } | { ok:false, code, status }.
  async set(key, value) {
    lsSet(key, value); // optimistic local write
    try {
      const r = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ key, value }),
      });
      return resultFromResponse(r);
    } catch {
      setSyncStatus('error');
      return { ok: false, code: 'network', status: 0 };
    }
  },

  async delete(key) {
    lsDel(key);
    try {
      const r = await fetch(`/api/storage?key=${encodeURIComponent(key)}`, {
        method: 'DELETE', credentials: 'same-origin',
      });
      return resultFromResponse(r);
    } catch {
      setSyncStatus('error');
      return { ok: false, code: 'network', status: 0 };
    }
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

// Returns the write promise so callers can await and react to the outcome —
// resolves to { localOk, ok, code?, status? }. `localOk` is whether the
// synchronous on-device write succeeded (false = quota/blocked → data lost);
// the rest is the server outcome. Existing fire-and-forget callers ignore the
// return and keep working unchanged (the promise never rejects).
export function writeThrough(key, value) {
  const s = JSON.stringify(value);
  let localOk = true;
  try { localStorage.setItem(key, s); } catch { localOk = false; }
  return storage.set(key, s).then((r) => ({ localOk, ...r }));
}

export async function hydrate(key) {
  const r = await storage.get(key);
  if (!r) return undefined;
  try { return JSON.parse(r.value); } catch { return undefined; }
}
