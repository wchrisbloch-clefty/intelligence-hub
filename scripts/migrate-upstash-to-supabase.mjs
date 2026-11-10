#!/usr/bin/env node
// scripts/migrate-upstash-to-supabase.mjs — ONE-SHOT copy of the live data.
//
// Batch Z / Order B moves the store to Supabase `kv`. The Supabase project was
// empty, but the APP's data was not: the library, graph, guides, skills, notes,
// recaps — everything — lived in Upstash. Cutting over without this copy makes
// every device that doesn't already hold a localStorage copy look wiped.
//
// Run it ONCE, from your machine, with BOTH stores' credentials in the env:
//
//   UPSTASH_REDIS_REST_URL=… UPSTASH_REDIS_REST_TOKEN=… \
//   SUPABASE_URL=https://ujywrlbuwecitwkvzohb.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
//   node scripts/migrate-upstash-to-supabase.mjs            # dry run: lists what it would copy
//   node scripts/migrate-upstash-to-supabase.mjs --write    # copies
//
// Idempotent (upsert). Never deletes from Upstash. Reads every key (SCAN *),
// copies values verbatim (they're already JSON strings), then re-reads each key
// from Supabase and compares — it reports any mismatch rather than claiming success.
// Also accepts the Vercel-KV names (KV_REST_API_URL / KV_REST_API_TOKEN).
import { createKv } from '../api/_kv.js';

const WRITE = process.argv.includes('--write');
const up = {
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
};
const sb = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
if (!up.url || !up.token) { console.error('Missing UPSTASH_REDIS_REST_URL / _TOKEN'); process.exit(1); }
if (!sb.url || !sb.key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

async function redis(cmd) {
  const r = await fetch(up.url, { method: 'POST', headers: { Authorization: `Bearer ${up.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error(`Upstash ${r.status}`);
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}

const keys = []; let cursor = '0';
do { const [next, batch] = await redis(['SCAN', cursor, 'MATCH', '*', 'COUNT', '500']); cursor = next; keys.push(...batch); } while (cursor !== '0');
keys.sort();
console.log(`Upstash: ${keys.length} keys`);

const kv = createKv(sb);
let copied = 0, skipped = 0, bytes = 0; const mismatches = [];
for (const k of keys) {
  const type = await redis(['TYPE', k]);
  if (type !== 'string') { console.warn(`  skip ${k} (type ${type} — app only writes strings)`); skipped++; continue; }
  const v = await redis(['GET', k]);
  if (v == null) { skipped++; continue; }
  bytes += v.length;
  if (!WRITE) { console.log(`  would copy ${k} (${v.length} chars)`); continue; }
  await kv.set(k, v);
  const back = await kv.get(k);
  if (back !== v) mismatches.push(k); else copied++;
}
console.log(WRITE
  ? `Copied ${copied}/${keys.length} keys (${bytes} chars), skipped ${skipped}, mismatches ${mismatches.length}${mismatches.length ? ': ' + mismatches.join(', ') : ''}`
  : `Dry run: ${keys.length - skipped} keys / ${bytes} chars would be copied. Re-run with --write.`);
process.exit(mismatches.length ? 2 : 0);
