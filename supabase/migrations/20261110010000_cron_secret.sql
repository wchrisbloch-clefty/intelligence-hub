-- Batch Z / Order E — the recap cron gate.
-- The secret is GENERATED IN THE DATABASE and stored in Vault. Nobody types it,
-- nothing logs it, it never transits a chat or a dashboard. pg_cron reads it from
-- vault.decrypted_secrets to send x-cron-secret; the Edge Functions verify it via
-- verify_cron_secret(), which only service_role may execute.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret',
      'x-cron-secret for the weekly-recap / monthly-review Edge Functions');
  end if;
end $$;

create or replace function public.verify_cron_secret(presented text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (select decrypted_secret = presented from vault.decrypted_secrets where name = 'cron_secret' limit 1),
    false
  );
$$;

revoke all on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;
