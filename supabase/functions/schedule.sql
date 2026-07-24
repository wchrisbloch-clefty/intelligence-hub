-- ═══════════════════════════════════════════════════════════════════════════
-- Scheduled triggers for the recap Edge Functions.
--
-- DO NOT run this blindly. Review, fill in the two placeholders, then run it
-- ONCE in the Supabase dashboard → SQL Editor (or via `supabase db` with a
-- superuser connection). It uses pg_cron to fire net.http_post at the Edge
-- Function URLs on a schedule.
--
-- Prerequisites (enable once, in Dashboard → Database → Extensions):
--   • pg_cron   — the scheduler
--   • pg_net    — provides net.http_post for outbound HTTP
--
-- Placeholders to replace:
--   <CRON_SECRET>  the same value you set via
--                  `supabase secrets set CRON_SECRET=...`
--   (project ref hmblakpkglbkyhaghltz is already filled in below)
--
-- Times are UTC. pg_cron has no timezone support, so the schedules below are
-- expressed in UTC. Adjust the hour to hit the local (America/Chicago, UTC-5
-- during CDT / UTC-6 during CST) time you want. Example: 13:00 UTC ≈ 8:00am CDT.
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensions (safe to re-run).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Friday weekly recap — every Friday 13:00 UTC (~8am CDT / 7am CST) ─────────
-- cron day-of-week: 5 = Friday.
select cron.schedule(
  'weekly-recap-friday',
  '0 13 * * 5',
  $$
  select net.http_post(
    url     := 'https://hmblakpkglbkyhaghltz.functions.supabase.co/weekly-recap',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ── Monthly review — 1st of each month 14:00 UTC (~9am CDT / 8am CST) ─────────
-- cron day-of-month: 1.
select cron.schedule(
  'monthly-review-first',
  '0 14 1 * *',
  $$
  select net.http_post(
    url     := 'https://hmblakpkglbkyhaghltz.functions.supabase.co/monthly-review',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ── Management / inspection ──────────────────────────────────────────────────
-- List scheduled jobs:            select * from cron.job;
-- Inspect recent runs:            select * from cron.job_run_details order by start_time desc limit 20;
-- Unschedule if needed:
--   select cron.unschedule('weekly-recap-friday');
--   select cron.unschedule('monthly-review-first');
