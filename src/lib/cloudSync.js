// Cloud sync layer over the Supabase `app_state` table.
//
// Table shape (already provisioned, RLS on):
//   app_state ( user_id uuid, key text, value jsonb, updated_at timestamptz )
//   primary key (user_id, key) — one row per (user, storage key).
//
// This module is the ONLY place that talks to the app_state table. utils.js
// calls cloudGet/cloudSet through it; everything else stays localStorage-shaped.
import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const TABLE = 'app_state';

// ─── SESSION CACHE ──────────────────────────────────────────────────────────
// Cache the authenticated user's id so hot-path reads/writes don't await
// getSession() every call. Invalidated by onAuthStateChange below.
let cachedUserId = null;
let sessionPrimed = false;

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user?.id ?? null;
    sessionPrimed = true;
  });
}

async function currentUserId() {
  if (!supabase) return null;
  if (cachedUserId) return cachedUserId;
  if (sessionPrimed) return cachedUserId; // primed and known-null → signed out
  // First call before onAuthStateChange has fired: fetch once and cache.
  const { data } = await supabase.auth.getSession();
  cachedUserId = data?.session?.user?.id ?? null;
  sessionPrimed = true;
  return cachedUserId;
}

// ─── ENABLEMENT ─────────────────────────────────────────────────────────────
// Cloud sync is "enabled" only when Supabase is configured AND a user session
// exists — otherwise reads/writes have no user_id to scope to and we stay local.
export function isCloudSyncEnabled() {
  return isSupabaseConfigured() && Boolean(cachedUserId);
}

// Async variant used during boot to prime the session before the first read.
export async function ensureCloudSession() {
  await currentUserId();
  return isCloudSyncEnabled();
}

// ─── DATA ACCESS ────────────────────────────────────────────────────────────
// Returns the stored value for `key`, or null if absent / not reachable.
// Throws on a genuine network/DB error so callers can fall back to localStorage.
export async function cloudGet(key) {
  const userId = await currentUserId();
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

// Upserts `value` for `key`. Throws on error so background writes can be logged.
export async function cloudSet(key, value) {
  const userId = await currentUserId();
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    );
  if (error) throw error;
}

// ─── AUTH HELPERS ───────────────────────────────────────────────────────────
export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  cachedUserId = data?.user?.id ?? null;
  sessionPrimed = true;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  cachedUserId = null;
  sessionPrimed = true;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  // Prime the cache so isCloudSyncEnabled() is correct before the first read.
  cachedUserId = data?.session?.user?.id ?? null;
  sessionPrimed = true;
  return data?.session ?? null;
}

// Subscribe to auth changes. Returns an unsubscribe function.
export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data?.subscription?.unsubscribe();
}
