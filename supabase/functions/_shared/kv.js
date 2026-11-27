// GENERATED from api/_kv.js by scripts/sync-edge-shared.mjs — DO NOT EDIT.
// api/_kv.js — the Supabase `kv` client. PostgREST over HTTPS, plain fetch only,
// so the SAME file runs in Vercel (Node) and Supabase Edge Functions (Deno).
// Underscore-prefixed → not a Vercel route (we're at the Hobby 12-function cap).
//
// Table (supabase/migrations/20261110000000_kv.sql):
//   public.kv (key text primary key, value text not null, updated_at timestamptz)
//   RLS enabled, NO policies → only the service role (bypasses RLS) can touch it.
//
// Never a direct Postgres connection. PostgREST only.
//   GET  → GET    /rest/v1/kv?key=eq.<key>&select=value
//   SET  → POST   /rest/v1/kv   Prefer: resolution=merge-duplicates   (upsert)
//   DEL  → DELETE /rest/v1/kv?key=eq.<key>
//   LIST → GET    /rest/v1/kv?key=like.<prefix>*&select=key

const TIMEOUT_MS = 8000;

export function createKv({ url, key, timeoutMs = TIMEOUT_MS }) {
  const base = `${String(url).replace(/\/+$/, '')}/rest/v1/`;

  async function call(path, init = {}) {
    const r = await fetch(base + path, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) {
      let detail = '';
      try { const j = await r.json(); detail = j?.message || j?.error || j?.hint || ''; } catch {}
      throw new Error(`Supabase ${r.status}${detail ? `: ${detail}` : ''}`);
    }
    return r;
  }

  // `like` uses * as the wildcard; `_` and `%` remain SQL LIKE wildcards, so the
  // server match is a superset and list() filters with startsWith() for an exact
  // prefix — the same semantics the old Redis SCAN MATCH gave.
  const likePrefix = (p) => `${String(p || '').replace(/[*%]/g, '')}*`;

  return {
    async get(k) {
      const r = await call(`kv?key=eq.${encodeURIComponent(k)}&select=value`);
      const rows = await r.json();
      return Array.isArray(rows) && rows.length ? rows[0].value : null;
    },
    async set(k, value) {
      await call('kv', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key: k, value: String(value), updated_at: new Date().toISOString() }),
      });
      return 'OK';
    },
    async del(k) {
      await call(`kv?key=eq.${encodeURIComponent(k)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return 1;
    },
    async list(prefix = '') {
      const keys = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const r = await call(`kv?key=like.${encodeURIComponent(likePrefix(prefix))}&select=key&order=key`, {
          headers: { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
        });
        const rows = await r.json();
        if (!Array.isArray(rows) || !rows.length) break;
        keys.push(...rows.map((x) => x.key).filter((k) => k.startsWith(prefix || '')));
        if (rows.length < PAGE) break;
      }
      return keys;
    },
  };
}

// A REAL round trip, not a ping: write a probe key, read it back, compare, then
// delete it — ALWAYS, even on failure. A present-but-wrong credential comes back
// roundTripOk:false. Reporting health from env presence is the exact lie this
// exists to catch (same class as the 8-token probe that passed while the real
// 55s study guide timed out).
// → { roundTripOk, durationMs, detail }
export async function kvRoundTrip(kv) {
  const probeKey = `aether_health_probe_${Date.now()}`;
  const expected = `probe:${Math.random().toString(36).slice(2)}`;
  const t0 = Date.now();
  let roundTripOk = false;
  let detail = '';
  try {
    await kv.set(probeKey, expected);
    const got = await kv.get(probeKey);
    roundTripOk = got === expected;
    detail = roundTripOk ? 'write → read → compare ok' : `read back ${got === null ? 'nothing' : 'a different value'}`;
  } catch (e) {
    detail = e?.message || String(e);
  } finally {
    try { await kv.del(probeKey); }
    catch (e) { if (roundTripOk) { roundTripOk = false; detail = `probe delete failed: ${e?.message || e}`; } }
  }
  return { roundTripOk, durationMs: Date.now() - t0, detail };
}
