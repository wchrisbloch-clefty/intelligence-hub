-- Batch Z / Order B — the single store. Intel Hub (ujywrlbuwecitwkvzohb) only.
-- Keeps the KV shape the app already speaks; nothing is normalized yet. The
-- knowledge graph gets promoted to real tables later as an ADDITIVE migration.
create table public.kv (
  key        text primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);
alter table public.kv enable row level security;
-- Deliberately NO policies. The service role bypasses RLS; anon and
-- authenticated get nothing. This is the whole access model until auth exists.
create index kv_key_prefix on public.kv (key text_pattern_ops);
-- text_pattern_ops lets `key like 'aether_%'` prefix scans use the index
-- instead of a sequential scan.
