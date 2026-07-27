# Scheduled recap functions

Two Supabase Edge Functions that generate CB's recaps without the app being
open, then write the result back into the app's store so the web app can read it
on next load.

| Function | Output key | Schedule |
|---|---|---|
| `weekly-recap` | `weekly_recap_latest` | Fridays |
| `monthly-review` | `monthly_review_latest` | 1st of each month |

Both read CB's existing state (projects, research, inbox/news, notes, graph,
decisions, quiz), call the Anthropic API with CB's identity spine, and write back
a `{ type, generatedAt, generatedAtISO, model, content }` record.

## Storage: Upstash Redis (not Supabase tables)

The app persists everything to **Upstash Redis** via `/api/storage` (keys like
`aether_projects_v1`). These functions talk to the **Upstash REST API directly**
— not `/api/storage`, which sits behind the ACCESS_CODE cookie gate and would
401 from a function. They use the same `KV_REST_API_URL` / `KV_REST_API_TOKEN`
credentials as `api/_lib.js`. The keyspace is flat and single-tenant; values are
verbatim JSON strings (read = GET + `JSON.parse`, write = `JSON.stringify` + SET).

## Status: scaffolded, NOT deployed

Deploying requires an interactive `supabase login` (CB's account) and setting
secrets — neither can be done from CI/an agent sandbox. Everything below is for
**CB to run locally**. Nothing here touches DB schema or RLS.

### 0. Preflight

- Grab the Upstash creds from the Vercel project: Vercel → Project → Settings →
  Environment Variables → copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`
  (Upstash Marketplace integration added them). These are what the functions
  read/write with.
- No `app_state` table, no auth user UUID, no `RECAP_USER_ID` needed — the store
  is Upstash and the keyspace is single-tenant.

### 1. One-time: install + log in + link

```bash
# Install the CLI (macOS): brew install supabase/tap/supabase
supabase login                       # opens browser, interactive
supabase link --project-ref hmblakpkglbkyhaghltz
```

### 2. Set secrets (never commit these)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...          --project-ref hmblakpkglbkyhaghltz
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)   --project-ref hmblakpkglbkyhaghltz
supabase secrets set KV_REST_API_URL=https://...upstash.io --project-ref hmblakpkglbkyhaghltz
supabase secrets set KV_REST_API_TOKEN=...                 --project-ref hmblakpkglbkyhaghltz
supabase secrets list                                      # verify all four
```

Keep a copy of the `CRON_SECRET` value — you'll paste it into `schedule.sql`.

### 3. Deploy the functions

```bash
supabase functions deploy weekly-recap   --project-ref hmblakpkglbkyhaghltz
supabase functions deploy monthly-review --project-ref hmblakpkglbkyhaghltz
```

`verify_jwt = false` is set for both in `supabase/config.toml`, so the cron
scheduler can invoke them. They're protected instead by the `x-cron-secret`
header check (fails closed if `CRON_SECRET` is unset).

### 4. Smoke-test before scheduling

```bash
curl -i -X POST \
  https://hmblakpkglbkyhaghltz.functions.supabase.co/weekly-recap \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <the CRON_SECRET you set>" \
  -d '{}'
```

Expect `{"ok":true,"generatedAtISO":"..."}`. Then confirm the write landed in
Upstash — from the Upstash console (or REST):

```bash
curl -s "$KV_REST_API_URL" \
  -H "Authorization: Bearer $KV_REST_API_TOKEN" \
  -d '["GET","weekly_recap_latest"]'
```

Negative test — confirm the gate works (no header → expect `401`):

```bash
curl -i -X POST \
  https://hmblakpkglbkyhaghltz.functions.supabase.co/weekly-recap \
  -H "Content-Type: application/json" -d '{}'
```

`401` means "CRON_SECRET is not configured" (secret unset) or a mismatched
header. If this ever returns `200`, the endpoint is publicly triggerable — stop
and fix before scheduling.

### 5. Enable extensions, then schedule

Enable `pg_cron` and `pg_net` (Dashboard → Database → Extensions), then open
`supabase/functions/schedule.sql`, replace `<CRON_SECRET>`, and run it once in
the SQL Editor. It registers:

- `weekly-recap-friday` — `0 13 * * 5` (Fri 13:00 UTC ≈ 8am CDT)
- `monthly-review-first` — `0 14 1 * *` (1st 14:00 UTC ≈ 9am CDT)

Adjust the UTC hours for the local time you want (pg_cron has no timezone
support). Inspect runs with `select * from cron.job_run_details order by
start_time desc;`.

## Reading the output in the app (future work)

The functions write `weekly_recap_latest` / `monthly_review_latest` to Upstash.
Surfacing them in the UI (e.g. a HomeDashboard card) is a follow-up: read the key
with the existing `storage`/`storageGet` layer — no new plumbing required.

## Files

```
supabase/
  config.toml                     verify_jwt=false for both functions
  functions/
    _shared/
      identity.ts                 CB identity spine (mirror of constants.js)
      appState.ts                 Upstash REST read/write helpers (flat, single-tenant)
      anthropic.ts                Anthropic Messages API wrapper
      auth.ts                     x-cron-secret gate
    weekly-recap/index.ts
    monthly-review/index.ts
    schedule.sql                  pg_cron + net.http_post (fill in CRON_SECRET, run once)
    README.md                     this file
```
