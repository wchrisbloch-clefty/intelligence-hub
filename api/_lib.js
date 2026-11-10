// api/_lib.js — shared serverless helpers (auth, body parsing, storage, errors).
// Underscore-prefixed → Vercel does NOT expose this as an HTTP route.
import crypto from 'node:crypto';

export const AUTH_COOKIE = 'ih_auth';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ─── BODY PARSING ───────────────────────────────────────────────────────────
// Vercel doesn't auto-parse bodies for plain Node serverless functions.
export async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !req.body.on) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// ─── AUTH COOKIE (signed, httpOnly, 30-day) ─────────────────────────────────
// Token = base64url(payloadJSON).hmac  — HMAC keyed on ACCESS_CODE so rotating
// the code invalidates every outstanding session. No extra secret to manage.
function hmac(data) {
  const secret = process.env.ACCESS_CODE || '';
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function issueAuthToken() {
  const payload = { exp: Date.now() + THIRTY_DAYS_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body)}`;
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = hmac(body);
  // Constant-time compare
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch { return false; }
}

export function authCookieHeader(token) {
  const maxAge = Math.floor(THIRTY_DAYS_MS / 1000);
  return `${AUTH_COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearAuthCookieHeader() {
  return `${AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function isAuthed(req) {
  const cookies = parseCookies(req);
  return verifyAuthToken(cookies[AUTH_COOKIE]);
}

// Guard helper. Returns true if the request may proceed; otherwise writes a
// 401 with a machine-readable code the UI maps to "Auth expired — re-enter code".
export function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  res.status(401).json({ error: 'Auth expired — re-enter code', code: 'auth_expired' });
  return false;
}

// ─── SUPABASE KV ────────────────────────────────────────────────────────────
// Batch Z / Order B: Supabase is the single store. The PostgREST client lives in
// ./_kv.js (runtime-neutral: plain fetch, no Node APIs) so the Supabase Edge
// Functions run the IDENTICAL code against the same table.
//
// The service-role key is read HERE and nowhere else in api/. It never reaches
// the client; there is no VITE_ variant (grep -rn "VITE_" src api → nothing).
import { createKv, kvRoundTrip } from './_kv.js';

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

// Env presence ONLY. Present credentials are not a working store — that is
// what storageRoundTrip() (used by /api/health) exists to prove.
export function storageCredentialsPresent() { return !!supabaseConfig(); }

const lazyKv = () => {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Storage credentials not present');
  return createKv(cfg);
};

// Same shape the Redis-backed store had: get/set/del/list.
export const store = {
  get:  (key) => lazyKv().get(key),
  set:  (key, value) => lazyKv().set(key, value),
  del:  (key) => lazyKv().del(key),
  list: (prefix) => lazyKv().list(prefix),
};

// → { credentialsPresent, roundTripOk, durationMs, detail }
export async function storageRoundTrip() {
  const cfg = supabaseConfig();
  if (!cfg) return { credentialsPresent: false, roundTripOk: false, durationMs: 0, detail: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set' };
  return { credentialsPresent: true, ...(await kvRoundTrip(createKv(cfg))) };
}
