// supabase/functions/ground-book — Batch Z / Order E3. Server-side book grounding.
//
// Chain (client-side web batch + "ask the user" stay in the browser):
//   1. Open Library — every edition of the matching works (table_of_contents /
//      contents / description). Also the EXISTENCE check.
//   2. Library of Congress — MARC 505 contents note via loc.gov fo=json. Server-side,
//      so no CORS proxy (this retires allorigins/corsproxy for loc.gov).
//   3. Library catalogs (OPACs) — MARC 505 from public-library records that ingest
//      OCLC copy (VuFind staff view first). loc.gov often has NO 505 for a new
//      title while OCLC-fed OPACs carry the full one. A 505 is a TYPED field: it
//      structurally cannot contain review blurbs or "Publisher: Scribner".
//      1–3 run IN PARALLEL (client budget).
//   4. Firecrawl — the PUBLISHER's own page only (search restricted to the
//      publisher's domain, then scrape), and ONLY if 1–3 found nothing.
//      Retail sites are refused outright.
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
import { typeTOC, type505, toLines, breakdown, score505 } from '../_shared/toc-types.js';

const MIN = 3;
const RETAIL = /(^|\.)(amazon|audible|barnesandnoble|bn|bookshop|booksamillion|walmart|target|ebay|abebooks|thriftbooks|bookdepository|kobo|apple|play\.google)\./i;
const PUBLISHER_DOMAINS: Record<string, string> = {
  'penguin': 'penguinrandomhouse.com', 'portfolio': 'penguinrandomhouse.com', 'crown': 'penguinrandomhouse.com',
  'random house': 'penguinrandomhouse.com', 'simon & schuster': 'simonandschuster.com', 'scribner': 'simonandschuster.com',
  'harpercollins': 'harpercollins.com', 'harper': 'harpercollins.com', 'hachette': 'hachettebookgroup.com',
  'little, brown': 'hachettebookgroup.com', 'macmillan': 'us.macmillan.com', "st. martin": 'us.macmillan.com',
  'wiley': 'wiley.com', 'hay house': 'hayhouse.com', 'harvard business': 'store.hbr.org',
  'harperone': 'harpercollins.com', 'kings road': 'kingsroadpublishing.com', 'allen & unwin': 'allenandunwin.com', 'bonnier': 'bonnierbooks.co.uk', 'w. w. norton': 'wwnorton.com', 'norton': 'wwnorton.com',
};
const clean = (s: unknown) => String(s ?? '').trim();
function parseTOC(text: string): string[] {
  return String(text || '').split('\n').map((l) => l
    .replace(/\s*\.{2,}\s*\d+\s*$/, '').replace(/\s+\d+\s*$/, '').replace(/^[-*•#>\s]+/, '')
    .replace(/^\s*(chapter|ch\.?|part|section)\s+[\divxlc]+\s*[:.)\-–—]?\s*/i, '')
    .replace(/^\s*\d+\s*[.):\-–—]\s*/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim())
    .filter((l) => l && l.length <= 140).slice(0, 40);
}
// A scraped page is NOT a chapter list just because the word "contents" appears on
// it. K2 live run: Chip War's S&S page returned review blurbs + product details
// ("Publisher: Scribner", "Raves and Reviews", an author photo) as 25 "chapters",
// stamped verified+contents. So: (1) require a real CONTENTS heading line, (2) cut
// at the next heading, (3) reject page furniture, (4) refuse the whole block if
// much of it was furniture — a near-miss is a miss, never fake grounding.
const TOC_HEADING = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:table\s+of\s+)?contents\s*(?:\*\*|__)?\s*:?\s*$/im;
const FURNITURE = /!\[|\*\*|https?:|isbn|publisher|pages?:|length:|on sale|price|format:|reviews?|raves?|praise|bestseller|award|winner|shortlisted|best book|photograph|product details|browse|related|share|buy|add to cart|read more|about the author|^—|\s>\s|^_.*_$/i;
export function extractTOC(md: string): { toc: string[]; rejected: number } {
  const m = TOC_HEADING.exec(md || '');
  if (!m) return { toc: [], rejected: 0 };
  const after = md.slice(m.index + m[0].length).split('\n');
  const block: string[] = [];
  for (const line of after) {
    if (/^\s*#{1,6}\s+\S/.test(line) && block.some((l) => l.trim())) break;   // next section
    block.push(line);
    if (block.length >= 80) break;
  }
  const cand = parseTOC(block.join('\n'));
  const keep = cand.filter((l) => !FURNITURE.test(l) && l.split(/\s+/).length <= 12 && !/[.!?]["”]?$/.test(l));
  const rejected = cand.length - keep.length;
  if (cand.length && rejected / cand.length > 0.25) return { toc: [], rejected };
  return { toc: keep, rejected };
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
    return { best, exists: docs.length > 0, publishers: docs.flatMap((d: any) => d.publisher || []) as string[], record: top ? { title: top.title, author: top.author_name?.[0], year: top.first_publish_year, publisher: top.publisher?.[0] } : null };
  } catch (e) { attempts.push({ source: 'Open Library', detail: 'search', error: String((e as Error).message || e) }); return { best: null, exists: false, publishers: [] as string[], record: null }; }
}

async function libraryOfCongress(title: string, author: string, attempts: any[]) {
  try {
    const s = await getJson(`https://www.loc.gov/books/?q=${encodeURIComponent(`${title} ${author}`.trim())}&fo=json&c=5&at=results`, {}, 25000);   // 12s timed out on all 3 in the K2 live run
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

// ── Library catalogs: MARC 505 from OPAC staff views ─────────────────────────
// Discovery: a web search for the record's own furniture ("Staff View" only
// appears on catalog record pages) surfaces /Record/<id> URLs on two OPAC families:
//   • VuFind  — MARC staff view at /Record/<id>/Details (scraped → markdown table)
//   • Aspen Discovery — staff view loads by AJAX; the MARC is JSON at
//     /Record/<id>/AJAX?method=getStaffView (fetched DIRECTLY — no scrape credit)
// Both are normalised to one shape: [{ tag, subs: [{ code, value }] }].
// A search hit is only scraped if its own result TITLE carries the book's title —
// a "similar items" page for another book that merely mentions it is skipped
// before it can spend a slot (Z-3 / L2: Chip War's first run burned 3 of 4 slots
// on Steve Jobs in exile, a Malayalam text, and Microcosm).
// A record must BE this book: its 245 must START with the title (a "Summary of …"
// record does not) and the author's surname must appear. Every matching record is
// SCORED (tocTypes.score505) and the cleanest kept. Tier: reported.
const RECORD_RE = /^(https?:\/\/[^/]+)\/Record\/([^/?#]+)/i;
const norm = (s: string) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Book identity (Z-3 / L3): the app sends the SHORT title until the catalog
// backfill fills in fullTitle, then sends "The Coffee Bean: A Simple Lesson…".
// Both must hit ONE cache entry and match the same records, so identity is the
// MAIN title (before any ":" subtitle) with a leading article dropped — catalogs
// file "The 7 habits…" where the shelf says "7 Habits…" — plus the author's surname.
const searchTitle = (t: string) => clean(t).split(/\s*:\s+/)[0];
export const matchTitle = (t: string) => norm(searchTitle(t)).replace(/^(the|a|an) /, '');
const surnameOf = (a: string) => norm(String(a || '').split(',')[0]).split(' ').filter(Boolean).pop() || '';
type Marc = { tag: string; subs: { code: string; value: string }[] }[];
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
// VuFind staff view, as Firecrawl markdown: "| 505 | 0 |  | **\|a** … <br> **\|t** … |"
export function marcFromMarkdown(md: string): Marc {
  const out: Marc = [];
  for (const line of String(md || '').split('\n')) {
    const m = /^\|\s*(\d{3})\s*\|/.exec(line);
    if (!m) continue;
    const re = /\*\*\\?\|([a-z0-9])\*\*/g; const hits: { code: string; at: number; end: number }[] = [];
    let h: RegExpExecArray | null;
    while ((h = re.exec(line))) hits.push({ code: h[1], at: h.index, end: h.index + h[0].length });
    out.push({ tag: m[1], subs: hits.map((x, i) => ({ code: x.code, value: line.slice(x.end, i + 1 < hits.length ? hits[i + 1].at : line.length)
      .replace(/<br\s*\/?>/gi, ' ').replace(/\s*\|\s*$/, '').replace(/\\/g, '').trim() })) });
  }
  return out;
}
// Aspen staff view HTML: "<th>505</th><th>0</th><th> </th><td><strong>|a</strong> …</td>"
export function marcFromAspenHtml(html: string): Marc {
  const out: Marc = [];
  for (const row of String(html || '').split(/<\/tr>/i)) {
    const m = /(?:^|>)\s*(\d{3})\s*<\/th>/i.exec(row);
    if (!m) continue;
    const td = /<td[^>]*>([\s\S]*?)(?:<\/td>|$)/i.exec(row)?.[1] || '';
    const parts = td.split(/<strong>\s*\|([a-z0-9])\s*<\/strong>/i);
    const subs: { code: string; value: string }[] = [];
    for (let i = 1; i + 1 < parts.length; i += 2) subs.push({ code: parts[i].toLowerCase(), value: decode(parts[i + 1].replace(/<[^>]+>/g, '')).trim() });
    out.push({ tag: m[1], subs });
  }
  return out;
}
const fieldSubs = (m: Marc, tag: string) => m.filter((f) => f.tag === tag).flatMap((f) => f.subs);
// → { raw, entries }. `raw` is the 505 exactly as catalogued (|a, or the |g+|t
// items of an enhanced 505 joined with " -- ") — never modified. `entries` is the
// typed VIEW over it (src/lib/tocTypes.js): front / part / chapter / back.
export function parse505(m: Marc): { raw: string; entries: any[] } {
  const subs = fieldSubs(m, '505');
  if (!subs.length) return { raw: '', entries: [] };
  // Enhanced 505: |g carries a label ("Part I.") for the |t that follows — keep
  // it with its title, in the catalogue's own order and words.
  const items: string[] = []; let g = '';
  for (const x of subs) {
    if (x.code === 'g') g = x.value.replace(/\s*--\s*$/, '').trim();
    else if (x.code === 't') { const t = x.value.replace(/\s*(--|\/)\s*$/, '').trim(); items.push(g ? `${g} ${t}` : t); g = ''; }
  }
  const raw = items.length ? items.join(' -- ') : subs.filter((x) => x.code === 'a').map((x) => x.value).join(' -- ');
  return { raw, entries: type505(raw) };
}
export function recordMatches(m: Marc, title: string, author: string): boolean {
  const t245 = norm(fieldSubs(m, '245').filter((x) => x.code === 'a' || x.code === 'b').map((x) => x.value).join(' ')).replace(/^(the|a|an) /, '');
  if (!t245 || !t245.startsWith(matchTitle(title))) return false;
  const surname = surnameOf(author);
  if (!surname) return true;
  return norm(['100', '245', '700'].flatMap((t) => fieldSubs(m, t)).map((x) => x.value).join(' ')).includes(surname);
}
async function libraryCatalogs(title: string, author: string, attempts: any[]) {
  const SRC = 'Library catalogs (MARC 505)';
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) { attempts.push({ source: SRC, unavailable: true, detail: 'FIRECRAWL_API_KEY not set' }); return null; }
  const fc = (path: string, body: unknown, ms: number) => getJson(`https://api.firecrawl.dev/v2/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ms);
  try {
    const st = searchTitle(title); const sur = surnameOf(author);
    const queries = [`"${st}" ${sur} "Staff View"`, `"${st}" ${sur} "Table of Contents" library catalog`];
    const found = await Promise.allSettled(queries.map((q) => fc('search', { query: q, limit: 10 }, 20000)));
    // Z-3 / L3: a rate-limited or timed-out step makes a miss UNTRUSTWORTHY — the
    // caller must not cache it (the pre-warm cached 429-driven misses for 7 days).
    let transient = found.some((f) => f.status === 'rejected');
    const records = new Map<string, { base: string; aspen: boolean }>(); let offTitle = 0;
    const want = matchTitle(title);
    for (const f of found) if (f.status === 'fulfilled') for (const x of (f.value.data?.web || f.value.data || [])) {
      const mm = RECORD_RE.exec(String(x?.url || ''));
      if (!mm || RETAIL.test(new URL(mm[1]).hostname)) continue;
      // The hit's own title must carry the book's title ("Holdings: Steve Jobs in
      // exile" is a different record that merely lists this book as similar).
      if (!norm(String(x?.title || '')).includes(want)) { offTitle++; continue; }
      const base = `${mm[1]}/Record/${mm[2]}`;
      if (!records.has(base)) records.set(base, { base, aspen: /aspen discovery/i.test(String(x?.description || '')) });
    }
    const recs = [...records.values()].slice(0, 6);   // L2: score up to 6 candidates; cleanest wins
    if (!recs.length) { attempts.push({ source: SRC, detail: `no catalog records for this title found by search${offTitle ? ` (${offTitle} other-book page(s) skipped)` : ''}`, results: 0, transient }); return null; }
    // Aspen: the JSON staff view, direct (free). VuFind: the /Details staff view via
    // Firecrawl. A VuFind-looking page with no MARC table is retried as Aspen.
    const aspenView = async (base: string): Promise<Marc> => {
      const r = await fetch(`${base}/AJAX?method=getStaffView`, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`${new URL(base).host} ${r.status}`);
      return marcFromAspenHtml(String((await r.json())?.staffView || ''));
    };
    const fetchMarc = async ({ base, aspen }: { base: string; aspen: boolean }): Promise<{ base: string; marc: Marc; via: string }> => {
      if (aspen) { try { return { base, marc: await aspenView(base), via: 'aspen' }; } catch { /* fall through to VuFind */ } }
      const sc = await fc('scrape', { url: `${base}/Details`, formats: ['markdown'], onlyMainContent: true }, 30000);
      const marc = marcFromMarkdown(String(sc.data?.markdown || ''));
      if (marc.some((f) => f.tag === '245')) return { base, marc, via: 'vufind' };
      return { base, marc: await aspenView(base), via: 'aspen' };
    };
    // At most 2 record fetches in flight: 6 parallel lookups × 6 scrapes tripped
    // Firecrawl's rate limit (429) across most of the L3 pre-warm.
    const got: PromiseSettledResult<{ base: string; marc: Marc; via: string }>[] = [];
    for (let i = 0; i < recs.length; i += 2) got.push(...await Promise.allSettled(recs.slice(i, i + 2).map(fetchMarc)));
    let best: any = null; const seen: string[] = []; const candidates: any[] = [];
    got.forEach((r, i) => {
      const host = new URL(recs[i].base).hostname;
      if (r.status !== 'fulfilled') {
        const msg = String((r.reason as Error)?.message || r.reason);
        if (/429|timed out|timeout|sending request|network|5\d\d/i.test(msg)) transient = true;
        seen.push(`${host}: unreadable (${msg.slice(0, 60)})`); return;
      }
      const { base, marc, via } = r.value;
      if (!marc.some((f) => f.tag === '505')) { seen.push(`${host}: no 505`); return; }
      if (!recordMatches(marc, title, author)) { seen.push(`${host}: 245/100 is a different book`); return; }
      const { raw, entries } = parse505(marc);
      const sc = score505(raw); const b = breakdown(entries);
      seen.push(`${host} (${via}): score ${sc.score} — ${sc.reasons.join(', ')}`);
      candidates.push({ host, url: base, via, score: sc.score, reasons: sc.reasons, breakdown: b });
      // L2: SCORE the candidates and keep the cleanest, not the first that passes.
      if (b.chapter >= MIN && (!best || sc.score > best.score || (sc.score === best.score && b.chapter > best.breakdown.chapter)))
        best = { toc: toLines(entries), entries, breakdown: b, score: sc.score, raw505: raw, source: 'catalog', sourceLabel: `Library catalog (${host}, MARC 505)`, url: base };
    });
    attempts.push({ source: SRC, detail: `${recs.length} record(s)${offTitle ? ` (+${offTitle} other-book page(s) skipped)` : ''}: ${seen.join('; ')}`, results: best ? 1 : 0, candidates, transient });
    return best;
  } catch (e) { attempts.push({ source: SRC, detail: 'search', error: String((e as Error).message || e), transient: true }); return null; }
}

// Every edition's publisher, not just Open Library's first one — K2 live run
// picked "Allen & Unwin Aotearoa NZ" for The Way of Excellence (US: HarperOne,
// UK: Kings Road). Up to 2 distinct known publisher domains are tried, in order.
function publisherDomains(publishers: string[]): string[] {
  const out: string[] = [];
  for (const pub of publishers) {
    const p = clean(pub).toLowerCase();
    const d = Object.entries(PUBLISHER_DOMAINS).find(([n]) => p.includes(n))?.[1];
    if (d && !out.includes(d)) out.push(d);
  }
  return out.slice(0, 2);
}
async function firecrawlPublisher(title: string, author: string, publishers: string[], attempts: any[]) {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) { attempts.push({ source: 'Firecrawl (publisher page)', unavailable: true, detail: 'FIRECRAWL_API_KEY not set' }); return null; }
  const domains = publisherDomains(publishers);
  if (!domains.length) { attempts.push({ source: 'Firecrawl (publisher page)', detail: `publisher domain unknown (${publishers.slice(0, 3).join(', ') || 'no publisher'}) — skipped; retail is never a fallback`, results: 0 }); return null; }
  for (const domain of domains) { const r = await firecrawlDomain(title, author, domain, key, attempts); if (r) return r; }
  return null;
}
async function firecrawlDomain(title: string, author: string, domain: string, key: string, attempts: any[]) {
  try {
    const s = await getJson('https://api.firecrawl.dev/v2/search', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `"${title}" ${author} contents site:${domain}`, limit: 3 }),
    }, 20000);
    const urls = (s.data?.web || s.data || []).map((x: any) => x.url).filter((u: string) => {
      try { const h = new URL(u).hostname; return h.endsWith(domain) && !RETAIL.test(h); } catch { return false; }
    });
    const notes: string[] = [];
    for (const url of urls.slice(0, 2)) {
      const sc = await getJson('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      }, 30000);
      const md: string = sc.data?.markdown || '';
      const { toc: lines, rejected } = extractTOC(md);
      if (lines.length >= MIN) { attempts.push({ source: 'Firecrawl (publisher page)', detail: url, results: 1 }); return { toc: lines, source: 'publisher', sourceLabel: `Publisher (${domain})`, url }; }
      if (rejected) notes.push(`${url}: contents block rejected (${rejected} non-chapter lines)`);
    }
    attempts.push({ source: 'Firecrawl (publisher page)', detail: `${urls.length} publisher page(s) on ${domain}, no chapter list${notes.length ? ' — ' + notes.join('; ') : ''}`, results: 0 });
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
const MISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  // The cache key carries whether Firecrawl is available: a miss recorded while the
  // key was unset must not shadow a real lookup once CB adds it. Hits are kept
  // forever; misses expire after MISS_TTL_MS so a newly-catalogued book resolves.
  const fc = Deno.env.get('FIRECRAWL_API_KEY') ? 'fc1' : 'fc0';
  // v5 = keyed on BOOK IDENTITY (main title sans article + author surname), so the
  // short shelf title and the backfilled full title share one entry (Z-3 / L3).
  const cacheKey = `aether_ground_${matchTitle(title).replace(/ /g, '_').slice(0, 150)}|${surnameOf(author).replace(/ /g, '_') || 'anon'}|${fc}|v5`;
  const store = kv();
  if (!body.refresh) {
    try {
      const hit = await store.get(cacheKey);
      if (hit) {
        const c = JSON.parse(hit);
        const fresh = c.toc || (Date.now() - Date.parse(c.at || 0) < MISS_TTL_MS);
        if (fresh) return withCors(json(200, { ...c, cached: true }));
      }
    } catch { /* cache unreadable → fall through to the quota gate */ }
  }
  const quota = await consumeQuota();
  if (!quota.ok) return withCors(json(quota.status!, quota.body));

  const attempts: any[] = [];
  // Structured sources first, in parallel: Open Library, LoC 505, OPAC 505.
  const a1: any[] = [], a2: any[] = [], a3: any[] = [];
  const [ol, loc, cat] = await Promise.all([openLibrary(searchTitle(title), author, a1), libraryOfCongress(searchTitle(title), author, a2), libraryCatalogs(title, author, a3)]);
  attempts.push(...a1, ...a2, ...a3);
  const publishers = [rawPublisher, ...(ol.publishers || [])].filter(Boolean);
  const typed = (c: any) => { if (!c || c.entries) return c; const entries = typeTOC(c.toc); return { ...c, entries, breakdown: breakdown(entries), toc: toLines(entries) }; };
  const cands = [ol.best, loc, cat].filter(Boolean).map(typed) as any[];
  if (!cands.some((c) => (c.breakdown?.chapter ?? c.toc.length) >= MIN)) { const fc = await firecrawlPublisher(title, author, publishers, attempts); if (fc) cands.push(typed(fc)); }
  // A typed MARC 505 (catalog / LoC) beats a longer HTML-scraped list.
  const RANK: Record<string, number> = { catalog: 3, loc: 3, openlibrary: 2, publisher: 1 };
  const best = cands.sort((a, b) => (RANK[b.source] || 0) - (RANK[a.source] || 0) || (b.breakdown?.chapter || 0) - (a.breakdown?.chapter || 0))[0] || null;
  const exists = ol.exists || !!loc || !!cat || !!body.catalogVerified;
  const state = exists ? (best ? 'verified+contents' : 'verified-exists-only') : 'unverified';
  const out = { state, toc: best?.toc || null, entries: best?.entries || null, breakdown: best?.breakdown || null, source: best?.source || null, sourceLabel: best?.sourceLabel || null, url: best?.url || null, raw505: best?.raw505 || null,
    tier: best ? 'reported' : 'inferred', record: ol.record, attempts, at: new Date().toISOString() };
  // Cache every HIT forever and every TRUSTWORTHY miss for 7 days, so the same book
  // never spends twice. A miss where any source failed transiently (rate limit,
  // timeout, network) is NOT cached — it's reported `retryable` instead, so a
  // throttled run can't pin "no contents" on a findable book for a week.
  const transient = attempts.some((a) => a.transient || (a.error && /429|timed out|timeout|sending request|network/i.test(String(a.error))));
  if (!best && transient) return withCors(json(200, { ...out, retryable: true }));
  try { await store.set(cacheKey, JSON.stringify(out)); } catch { /* best-effort */ }
  return withCors(json(200, out));
});

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function withCors(r: Response) { for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; }
