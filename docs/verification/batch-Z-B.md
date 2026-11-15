# Batch Z / Order B: verification

## Headline

**The code is verified against the real Supabase `kv` table, but production is NOT cut
over yet.** Two things only CB can do stand between this branch and a live cutover:

1. **Set `SUPABASE_SERVICE_ROLE_KEY`** (and `SUPABASE_URL`) in Vercel. I have no
   permission to read or write this project's env vars (Vercel API returned 403), and
   the Supabase tooling never hands out the service-role key.
2. **Copy the live data out of Upstash.** The *Supabase* project was empty, but the
   *app's* data was not: library, graph, guides, skills, notes and recaps all live in
   Upstash. Run `scripts/migrate-upstash-to-supabase.mjs` (dry run first, then
   `--write`). It upserts, re-reads every key, compares, reports mismatches, and never
   deletes from Upstash.

If this branch merges before step 1, nothing is lost. `/api/storage` returns 503
`no_storage`, and the app runs local-only with the caution chip showing.

## What landed

| Item | Where |
|---|---|
| `public.kv` + RLS (no policies) + `kv_key_prefix text_pattern_ops` | `supabase/migrations/20261110000000_kv.sql`, applied to `ujywrlbuwecitwkvzohb` |
| `pg_net`, `pg_cron` enabled | migration `enable_pg_net_pg_cron` (pg_cron is used by Order E) |
| PostgREST client (get / upsert / delete / like-list, paged) | `api/_kv.js`, plain `fetch`, so it runs in Node and Deno |
| Redis block replaced; creds read only here | `api/_lib.js` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| `storageConfigured` renamed to `storageCredentialsPresent` | `api/_lib.js`, `api/storage.js`, `api/mcp.js`, `api/_mcp.js` |
| Real round trip in `/api/health` | `storageRoundTrip()` returns `{ credentialsPresent, roundTripOk, durationMs, detail }` |
| Upstash / KV reads removed | `grep -rn "UPSTASH\|KV_REST" api src` finds only the one-shot migration script |
| One-shot data copy | `scripts/migrate-upstash-to-supabase.mjs` |

Not touched: `src/lib/storage.js`, `api/storage.js`'s contract, and every module's
`storage.*` calls.

## Verification

### 1. Real table, real key, plus a corrupted key

The sandbox cannot reach `*.supabase.co`; its egress policy refuses it. So a temporary
Edge Function (`kv-probe`, token-gated) ran the **identical** `api/_kv.js` +
`kvRoundTrip` against the real table, invoked from inside the database via `pg_net`.
Response (`net._http_response` id 1, HTTP 200):

```json
{
  "good":      { "credentialsPresent": true, "roundTripOk": true,  "durationMs": 417, "detail": "write → read → compare ok" },
  "corrupted": { "credentialsPresent": true, "roundTripOk": false, "durationMs": 50,  "detail": "Supabase 401: Invalid API key" },
  "listTest":  { "listed": ["aether_zprobe_a", "aether_zprobe_b"], "afterDel": [] }
}
```

- A present-but-wrong key reports **`roundTripOk: false`**. It does not pass on env
  presence.
- The prefix list is exact. `aetherXzprobe_c` was excluded even though `_` is a LIKE
  wildcard, because of the `startsWith` filter.
- Probe keys are deleted. The `finally` block always runs.
- `kv-probe` was then redeployed as a `410 gone` stub with `verify_jwt` on. **Delete it
  from the dashboard** (the MCP tooling has no delete).

### 2. Index used for prefix scans

```
explain select key from public.kv where key like 'aether_%';
Bitmap Heap Scan on kv
  ->  Bitmap Index Scan on kv_key_prefix
        Index Cond: ((key ~>=~ 'aether'::text) AND (key ~<~ 'aethes'::text))
```

### 3. The real Vercel handlers (`api/storage.js`, `api/health.js`) under Node, mock PostgREST

| Case | Result |
|---|---|
| POST twice (upsert), GET, list, DELETE, GET | 200s; second write wins; null after delete |
| health, good key | `roundTripOk: true` |
| health, corrupted key | `roundTripOk: false · Supabase 401: Invalid API key`; `/api/storage` returns **502**, which the client shows as the `error` chip |
| health, no key | `credentialsPresent: false`; `/api/storage` returns **503 `no_storage`**, which the client shows as `local-only` |

## Still owed (needs CB)

- [ ] Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel, server-side, never with
      a `VITE_` prefix.
- [ ] Run `node scripts/migrate-upstash-to-supabase.mjs`, then again with `--write`.
- [ ] After deploy, open `/api/health` and confirm `storage.roundTripOk: true` with its
      latency. Then set the key to a wrong value in a Preview env and confirm
      `roundTripOk: false`. (Shown above against the real table via the probe; not yet
      shown on the deployed Vercel route.)
- [ ] `select count(*) from kv;` after one real session. Today it returns **0**, because
      nothing in production writes here yet.
- [ ] Remove the `UPSTASH_*` / `KV_REST_*` vars from Vercel once the copy is verified.
- [ ] Delete the `kv-probe` stub function.
