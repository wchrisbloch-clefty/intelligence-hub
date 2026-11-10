#!/usr/bin/env node
// scripts/verify-catalog-throttle.mjs — Batch Z-2 / J1 check. Drives the REAL
// bookVerify.js against a mock catalog that answers 429 after N requests, and
// asserts: concurrency never exceeds CATALOG_CONCURRENCY; the first 429 opens the
// breaker so later lookups fail fast WITHOUT a network call; a rate-limited
// lookup reports rateLimited (unverified), is NOT cached, and a good lookup IS.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: () => null, length: 0 };
let inFlight = 0, peak = 0, calls = 0; const RATE_AFTER = 4;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith('/api/')) return new Response(JSON.stringify({ ok: true }), { status: 200 });   // writeThrough → /api/storage
  calls++; inFlight++; peak = Math.max(peak, inFlight);
  await new Promise((r) => setTimeout(r, 20)); inFlight--;
  if (calls > RATE_AFTER) return new Response('{}', { status: 429 });
  return new Response(JSON.stringify({ items: [{ id: 'x' + calls, volumeInfo: { title: 'Winning', authors: ['Tim Grover'], publishedDate: '2021' } }] }), { status: 200 });
};
const bv = await import('../src/lib/bookVerify.js');
let fail = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++; };

const first = await Promise.all([1, 2, 3].map((i) => bv.verifyBookCached({ title: `Winning ${i}`, author: 'Tim Grover' })));
ok(first.every((r) => r.matches.length), '3 lookups resolve before the limit');
ok(peak <= bv.CATALOG_CONCURRENCY, `peak concurrency ${peak} ≤ ${bv.CATALOG_CONCURRENCY}`);
const cache = JSON.parse(mem.get(bv.VERIFY_CACHE_KEY) || '{}');
ok(Object.keys(cache).length === 3, 'definitive results cached (3)');

const callsBefore = calls;
const again = await bv.verifyBookCached({ title: 'Winning 1', author: 'Tim Grover' });
ok(again.cached && calls === callsBefore, 'repeat lookup served from cache — zero network calls');

const storm = await Promise.all(Array.from({ length: 12 }, (_, i) => bv.verifyBookCached({ title: `Storm ${i}`, author: 'A' })));
const limited = storm.filter((r) => r.rateLimited).length;
ok(limited >= 11, `rate-limited lookups report rateLimited (${limited}/12)`);
ok(bv.catalogCircuitOpen(), 'first 429 opened the circuit breaker');
ok(calls - callsBefore <= 3, `breaker stopped the storm: only ${calls - callsBefore} network calls for 12 lookups`);
const cache2 = JSON.parse(mem.get(bv.VERIFY_CACHE_KEY) || '{}');
ok(!Object.keys(cache2).some((k) => k.startsWith('storm')), 'rate-limited lookups NOT cached (they retry later)');
ok(storm.every((r) => r.rateLimited ? r.matches.length === 0 : true), 'rate-limited = unverified (no fabricated record)');
console.log(fail ? `\n${fail} FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);
