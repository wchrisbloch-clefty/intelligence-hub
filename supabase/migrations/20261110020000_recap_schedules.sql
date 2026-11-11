-- Batch Z / Order E — schedule the recap Edge Functions (UTC).
--   weekly-recap   0 13 * * 5   Fri ≈ 8am CT
--   monthly-review 0 14 1 * *   1st ≈ 9am CT
-- Smoke-tested BEFORE scheduling, incl. the 401 negative test (docs/verification/batch-Z-E.md).
-- The x-cron-secret value is read from Vault at fire time — never stored in the job text.
select cron.unschedule(jobname) from cron.job where jobname in ('weekly-recap','monthly-review');
select cron.schedule('weekly-recap', '0 13 * * 5', $$
  select net.http_post(
    url := 'https://ujywrlbuwecitwkvzohb.supabase.co/functions/v1/weekly-recap',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 150000);
$$);
select cron.schedule('monthly-review', '0 14 1 * *', $$
  select net.http_post(
    url := 'https://ujywrlbuwecitwkvzohb.supabase.co/functions/v1/monthly-review',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 150000);
$$);
