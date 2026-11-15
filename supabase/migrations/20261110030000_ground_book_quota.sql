-- Batch Z-2 / G4 — ground-book spend guard.
-- The anon key in src/lib/groundBook.js is a PUBLIC identifier (the repo is public),
-- not an authorization boundary. ground-book can spend Firecrawl credits, so every
-- UNCACHED lookup consumes one unit of a per-day quota, counted in kv under
-- aether_ground_quota_<YYYY-MM-DD> (UTC). The increment is ATOMIC (one upsert),
-- so concurrent callers can't race past the cap. Only service_role may call it.
create or replace function public.ground_book_consume(cap integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := 'aether_ground_quota_' || to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  used integer;
begin
  insert into public.kv (key, value, updated_at) values (k, '1', now())
  on conflict (key) do update
    set value = ((public.kv.value)::integer + 1)::text, updated_at = now()
  returning value::integer into used;
  return jsonb_build_object('allowed', used <= cap, 'used', used, 'cap', cap, 'key', k);
end;
$$;
revoke all on function public.ground_book_consume(integer) from public, anon, authenticated;
grant execute on function public.ground_book_consume(integer) to service_role;
