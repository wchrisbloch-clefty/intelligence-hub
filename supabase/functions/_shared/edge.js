// supabase/functions/_shared/edge.js — Edge-Function plumbing shared by the recap
// and ground-book functions. Deno runtime; plain fetch only.
import { createKv } from './kv.js';
import { MODELS } from './models.generated.js';

export const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

// The ONE store — the same public.kv table the app writes through /api/storage.
export function kv() {
  return createKv({ url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') });
}

export async function readState(store, keys) {
  const out = {};
  await Promise.all(keys.map(async (k) => {
    try { const raw = await store.get(k); out[k] = raw == null ? null : JSON.parse(raw); }
    catch { out[k] = null; }
  }));
  return out;
}

// Cron gate. The secret lives in Supabase Vault (generated in-database, never
// typed or logged anywhere). pg_cron reads it from vault.decrypted_secrets and
// sends it as x-cron-secret; this checks it via public.verify_cron_secret(), a
// SECURITY DEFINER function only service_role may execute. Fails closed.
export async function requireCron(req) {
  const presented = req.headers.get('x-cron-secret') || '';
  if (!presented) return json(401, { ok: false, error: 'Unauthorized' });
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  try {
    const r = await fetch(`${url}/rest/v1/rpc/verify_cron_secret`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ presented }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.warn(`[cron-auth] verify rpc ${r.status}`); return json(500, { ok: false, error: 'Cron secret check unavailable' }); }
    if ((await r.json()) !== true) return json(401, { ok: false, error: 'Unauthorized' });
    return null; // authorised
  } catch (e) {
    console.warn(`[cron-auth] ${e?.message || e}`);
    return json(500, { ok: false, error: 'Cron secret check unavailable' });
  }
}

// Claude (the reason-job lead; model id from the ONE registry, api/_providers.js).
// Returns { text, provider, model } or { needsKey } / throws on upstream failure.
export async function callClaude({ system, user, maxTokens = 2000 }) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return { needsKey: 'ANTHROPIC_API_KEY' };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELS.claude, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(140000),
  });
  if (!r.ok) {
    let detail = ''; try { detail = (await r.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`Claude ${r.status}${detail ? `: ${detail}` : ''}${r.status === 404 ? ' (likely a retired model — update MODELS in api/_providers.js)' : ''}`);
  }
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, provider: 'Claude', model: MODELS.claude };
}
