# Scheduled recap functions

Two Supabase Edge Functions that generate CB's recaps without the app being
open, then write the result back into `app_state` so the web app can read it on
next load.

| Function | Output key in `app_state` | Schedule |
|---|---|---|
| `weekly-recap` | `weekly_recap_latest` | Fridays |
| `monthly-review` | `monthly_review_latest` | 1st of each month |

Both read CB's existing state (projects, research, inbox/news, notes, graph,
decisions, quiz), call the Anthropic API with CB's identity spine, and upsert a
`{ type, generatedAt, generatedAtISO, model, content }` record.

## Status: scaffolded, NOT deployed

Deploying requires an interactive `supabase login` (CB's account) and setting
secrets — neither can be done from CI/an agent sandbox. Everything below is for
**CB to run locally**. Nothing here is destructive to the DB schema or RLS.

### 0. One-time: install + log in + link

```bash
# Install the CLI (macOS): brew install supabase/tap/supabase
supabase login                       # opens browser, interactive
supabase link --project-ref hmblakpkglbkyhaghltz
```

### 1. Set secrets (never commit these)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...          --project-ref hmblakpkglbkyhaghltz
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)   --project-ref hmblakpkglbkyhaghltz
# Optional: pin generation to CB's user. If omitted, every user_id present in
# app_state is processed (fine for this single-user app).
supabase secrets set RECAP_USER_ID=<cb-auth-user-uuid>     --project-ref hmblakpkglbkyhaghltz
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into
deployed functions — do **not** set them yourself.

Keep a copy of the `CRON_SECRET` value — you'll paste it into `schedule.sql`.

### 2. Deploy the functions

```bash
supabase functions deploy weekly-recap   --project-ref hmblakpkglbkyhaghltz
supabase functions deploy monthly-review --project-ref hmblakpkglbkyhaghltz
```

`verify_jwt = false` is set for both in `supabase/config.toml`, so the cron
scheduler can invoke them. They are protected instead by the `x-cron-secret`
header check (fails closed if `CRON_SECRET` is unset).

### 3. Smoke-test manually before scheduling

```bash
curl -i -X POST \
  https://hmblakpkglbkyhaghltz.functions.supabase.co/weekly-recap \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: <the CRON_SECRET you set>" \
  -d '{}'
```

Expect `{"ok":true,"processed":1,...}` and a fresh `weekly_recap_latest` row in
`app_state`. A `401` means the secret header didn't match; `500` with
"CRON_SECRET is not configured" means the secret wasn't set in step 1.

### 4. Schedule with pg_cron

Enable the `pg_cron` and `pg_net` extensions (Dashboard → Database →
Extensions), then open `supabase/functions/schedule.sql`, replace
`<CRON_SECRET>`, and run it once in the SQL Editor. It registers:

- `weekly-recap-friday` — `0 13 * * 5` (Fri 13:00 UTC ≈ 8am CDT)
- `monthly-review-first` — `0 14 1 * *` (1st 14:00 UTC ≈ 9am CDT)

Adjust the UTC hours for the local time you want (pg_cron has no timezone
support). Inspect runs with `select * from cron.job_run_details order by
start_time desc;`.

## Reading the output in the app (future work)

The functions write to `weekly_recap_latest` / `monthly_review_latest`. Surfacing
them in the UI (e.g. a HomeDashboard card) is a follow-up: read the key with the
existing `storageGet` layer — no new plumbing required.

## Files

```
supabase/
  config.toml                     verify_jwt=false for both functions
  functions/
    _shared/
      identity.ts                 CB identity spine (mirror of constants.js)
      appState.ts                 service client + app_state read/write helpers
      anthropic.ts                Anthropic Messages API wrapper
      auth.ts                     x-cron-secret gate
    weekly-recap/index.ts
    monthly-review/index.ts
    schedule.sql                  pg_cron + net.http_post (fill in CRON_SECRET, run once)
    README.md                     this file
```
