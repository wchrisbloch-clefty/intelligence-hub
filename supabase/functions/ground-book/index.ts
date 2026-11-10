// supabase/functions/ground-book — Batch Z / Order E3. Server-side book grounding.
//
// Chain (client-side web batch + "ask the user" stay in the browser):
//   1. Open Library — every edition of the matching works (table_of_contents /
//      contents / description). Also the EXISTENCE check.
//   2. Library of Congress — MARC 505 contents note via loc.gov fo=json. Server-side,
//      so no CORS proxy (this retires allorigins/corsproxy for loc.gov).
//   3. Firecrawl — the PUBLISHER's own page only (search restricted to the
//      publisher's domain, then scrape). Retail sites are refused outright.
//
// Returns the tri-state bookVerify.js keeps — existence and contents are DIFFERENT
// facts, never collapsed:
//   'verified+contents'     a catalog match AND a usable chapter list
//   'verified-exists-only'  a catalog match, contents could NOT be retrieved
//   'unverified'            no catalog match (NOT evidence the book doesn't exist)
// plus { toc, source, attempts } — every step reports what it tried and got.
//
// Spend guard (Z-2 / G4): input validation, every result cached in kv, and a
// fail-closed per-day cap on uncached lookups — see DAILY_CAP below.
// verify_jwt = true (called with the PUBLIC anon key — not an auth boundary).
import { json, kv } from '../_shared/edge.js';

const MIN = 3;
const RETAIL = /(^|\.)(amazon|audible|barnesandnoble|bn|bookshop|booksamillion|walmart|target|ebay|abebooks|thriftbooks|bookdepository|kobo|apple|play\.google)\./i;
const PUBLISHER_DOMAINS: Record<string, string> = {
  'penguin': 'penguinrandomhouse.com', 'portfolio': 'penguinrandomhouse.com', 'crown': 'penguinrandomhouse.com',
  'random house': 'penguinrandomhouse.com', 'simon & schuster': 'simonandschuster.com', 'scribner': 'simonandschuster.com',
  'harpercollins': 'harpercollins.com', 'harper': 'harpercollins.com', 'hachette': 'hachettebookgroup.com',
  'little, brown': 'hachettebookgroup.com', 'macmillan': 'us.macmillan.com', "st. martin": 'us.macmillan.com',
  'wiley': 'wiley.com', 'hay house': 'hayhouse.com', 'harvard business': 'store.hbr.org',
  'kings road': 'kingsroadpublishing.com', 'allen & unwin': 'allenandunwin.com', 'bonnier': 'bonnierbooks.co.uk', 'w. w. norton': 'wwnorton.com', 'norton': 'wwnorton.com',
};
const clean = (s: unknown) => String(s ?? '').trim();
function parseTOC(text: string): string[] {
  return String(text || '').split('\n').map((l) => l
    .replace(/\s*\.{2,}\s*\d+\s*$/, '').replace(/\s+\d+\s*$/, '').replace(/^[-*•#>\s]+/, '')
    .replace(/^\s*(chapter|ch\.?|part|section)\s+[\divxlc]+\s*[:.)\-–—]?\s*/i, '')
    .replace(/^\s*\d+\s*[.):\-–—]\s*/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim())
    .filter((l) => l && l.length <= 140).slice(0, 40);
}
async function getJson(url: string, init: RequestInit = {}, ms = 12000) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}

async function openLibrary(title: string, author: string, attempts: any[]) {
  try {
    const s = await getJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ''}&limit=3&fields=key,title,author_name,first_publish_year,edition_key,publisher`);
    const docs = s.docs || [];
    let checked = 0; let best: any = null;
    for (const d of docs.slice(0, 2)) for (const ek of (d.edition_key || []).slice(0, 6)) {
      checked++;
      try {
        const ed = await getJson(`https://openlibrary.org/books/${ek}.json`, {}, 8000);
        const raw = Array.isArray(ed.table_of_contents) ? ed.table_of_contents : Array.isArray(ed.contents) ? ed.contents : [];
        let t = raw.map((e: any) => clean(e?.title || e?.label || e)).filter(Boolean);
        if (t.length < MIN && typeof ed.description === 'string') t = parseTOC(ed.description);
        if (t.length >= MIN && (!best || t.length > best.toc.length)) best = { toc: t, source: 'openlibrary', sourceLabel: 'Open Library', editionKey: ek };
      } catch { /* one edition failing doesn't fail the source */ }
    }
    attempts.push({ source: 'Open Library', detail: `${docs.length} work(s), ${checked} edition(s)`, results: best ? 1 : 0 });
    const top = docs[0];
    return { best, exists: docs.length > 0, record: top ? { title: top.title, author: top.author_name?.[0], year: top.first_publish_year, publisher: top.publisher?.[0] } : null };
  } catch (e) { attempts.push({ source: 'Open Library', detail: 'search', error: String((e as Error).message || e) }); return { best: null, exists: false, record: null }; }
}

async function libraryOfCongress(title: string, author: string, attempts: any[]) {
  try {
    const s = await getJson(`https://www.loc.gov/books/?q=${encodeURIComponent(`${title} ${author}`.trim())}&fo=json&c=5&at=results`);
    const results = s.results || [];
    for (const r of results.slice(0, 3)) {
      const c = (Array.isArray(r.contents) ? r.contents : []).map(clean).filter(Boolean);
      const lines = c.length === 1 ? c[0].split(/\s+--\s+/).map(clean) : c;   // 505 is often one "--"-joined string
      if (lines.length >= MIN) { attempts.push({ source: 'Library of Congress', detail: 'contents note (505)', results: 1 }); return { toc: lines, source: 'loc', sourceLabel: 'Library of Congress' }; }
    }
    attempts.push({ source: 'Library of Congress', detail: `${results.length} result(s)`, results: 0 });
  } catch (e) { attempts.push({ source: 'Library of Congress', detail: 'search', error: String((e as Error).message || e) }); }
  return null;
}

async function firecrawlPublisher(title: string, author: string, publisher: string, attempts: any[]) {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) { attempts.push({ source: 'Firecrawl (publisher page)', unavailable: true, detail: 'FIRECRAWL_API_KEY not set' }); return null; }
  const p = clean(publisher).toLowerCase();
  const domain = Object.entries(PUBLISHER_DOMAINS).find(([n]) => p.includes(n))?.[1];
  if (!domain) { attempts.push({ source: 'Firecrawl (publisher page)', detail: `publisher domain unknown (${publisher || 'no publisher'}) — skipped; retail is never a fallback`, results: 0 }); return null; }
  try {
    const s = await getJson('https://api.firecrawl.dev/v2/search', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `"${title}" ${author} contents site:${domain}`, limit: 3 }),
    }, 20000);
    const urls = (s.data?.web || s.data || []).map((x: any) => x.url).filter((u: string) => {
      try { const h = new URL(u).hostname; return h.endsWith(domain) && !RETAIL.test(h); } catch { return false; }
    });
    for (const url of urls.slice(0, 2)) {
      const sc = await getJson('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      }, 30000);
      const md: string = sc.data?.markdown || '';
      const at = md.search(/(table of )?contents/i);
      const lines = at >= 0 ? parseTOC(md.slice(at).split('\n').slice(1, 60).join('\n')).filter((l) => !/^(about|reviews?|praise|buy|share)/i.test(l)) : [];
      if (lines.length >= MIN) { attempts.push({ source: 'Firecrawl (publisher page)', detail: url, results: 1 }); return { toc: lines, source: 'publisher', sourceLabel: `Publisher (${domain})`, url }; }
    }
    attempts.push({ source: 'Firecrawl (publisher page)', detail: `${urls.length} publisher page(s) on ${domain}`, results: 0 });
  } catch (e) { attempts.push({ source: 'Firecrawl (publisher page)', detail: domain, error: String((e as Error).message || e) }); }
  return null;
}

// ── Spend guard (Batch Z-2 / G4) ─────────────────────────────────────────────
// The anon key that reaches this function is PUBLIC (it is in a public repo) —
// an identifier, not authorization. So the function protects the spend itself:
//   1. strict input validation (no title, empty, or oversized → 400, nothing spent)
//   2. EVERY result is cached in kv (hit or miss) and served before any spend —
//      a repeated lookup for the same book costs nothing
//   3. every UNCACHED lookup consumes one unit of a per-day cap, counted in kv
//      (aether_ground_quota_<YYYY-MM-DD>, atomic upsert via ground_book_consume()).
//      Over the cap → 429. Counter unreachable → 503. Fails CLOSED either way.
export const DAILY_CAP = 40;
const MAX_TITLE = 200, MAX_AUTHOR = 120, MAX_PUBLISHER = 120;

async function consumeQuota(): Promise<{ ok: boolean; status?: number; body?: unknown }> {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  try {
    const r = await fetch(`${url}/rest/v1/rpc/ground_book_consume`, {
      method: 'POST',
      headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cap: DAILY_CAP }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, status: 503, body: { error: 'quota check unavailable — refusing to spend', code: 'quota_unavailable' } };
    const q = await r.json();
    if (!q?.allowed) return { ok: false, status: 429, body: { error: `daily lookup cap reached (${DAILY_CAP}/day)`, code: 'quota_exceeded', used: q?.used, cap: DAILY_CAP } };
    return { ok: true };
  } catch {
    return { ok: false, status: 503, body: { error: 'quota check unavailable — refusing to spend', code: 'quota_unavailable' } };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return withCors(json(405, { error: 'POST only' }));
  let body: any = {};
  try { body = await req.json(); } catch { return withCors(json(400, { error: 'JSON body required', code: 'bad_request' })); }
  const rawTitle = typeof body?.title === 'string' ? body.title.trim() : '';
  const rawAuthor = typeof body?.author === 'string' ? body.author.trim() : '';
  const rawPublisher = typeof body?.publisher === 'string' ? body.publisher.trim() : '';
  if (!rawTitle) return withCors(json(400, { error: 'title required', code: 'bad_title' }));
  if (rawTitle.length > MAX_TITLE) return withCors(json(400, { error: `title longer than ${MAX_TITLE} chars`, code: 'bad_title' }));
  if (rawAuthor.length > MAX_AUTHOR || rawPublisher.length > MAX_PUBLISHER) return withCors(json(400, { error: 'author/publisher too long', code: 'bad_request' }));
  const title = rawTitle; const author = rawAuthor;

  const cacheKey = `aether_ground_${(title + '|' + author).toLowerCase().replace(/[^a-z0-9|]+/g, '_').slice(0, 180)}`;
  const store = kv();
  if (!body.refresh) {
    try { const hit = await store.get(cacheKey); if (hit) return withCors(json(200, { ...JSON.parse(hit), cached: true })); } catch { /* cache unreadable → fall through to the quota gate */ }
  }
  const quota = await consumeQuota();
  if (!quota.ok) return withCors(json(quota.status!, quota.body));

  const attempts: any[] = [];
  const ol = await openLibrary(title, author, attempts);
  const loc = await libraryOfCongress(title, author, attempts);
  const publisher = rawPublisher || ol.record?.publisher || '';
  const cands = [ol.best, loc].filter(Boolean) as any[];
  if (!cands.some((c) => c.toc.length >= MIN)) { const fc = await firecrawlPublisher(title, author, publisher, attempts); if (fc) cands.push(fc); }
  const best = cands.sort((a, b) => b.toc.length - a.toc.length)[0] || null;
  const exists = ol.exists || !!loc || !!body.catalogVerified;
  const state = exists ? (best ? 'verified+contents' : 'verified-exists-only') : 'unverified';
  const out = { state, toc: best?.toc || null, source: best?.source || null, sourceLabel: best?.sourceLabel || null, url: best?.url || null,
    tier: best ? 'reported' : 'inferred', record: ol.record, attempts, at: new Date().toISOString() };
  // Cache EVERY result, hit or miss — the same book never spends twice. A miss
  // can be re-tried deliberately with { refresh: true }, which still counts
  // against the daily cap.
  try { await store.set(cacheKey, JSON.stringify(out)); } catch { /* best-effort */ }
  return withCors(json(200, out));
});

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function withCors(r: Response) { for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; }
