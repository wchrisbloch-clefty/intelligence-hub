// src/lib/sourceGrounding.js — source material for surfaces the model can't
// reach on its own (a post-cutoff book, a niche talk, a private transcript).
//
// The model cannot retrieve a book published after its cutoff, but the USER owns
// the physical copy. This is the missing input path: automated table-of-contents
// retrieval FIRST, the user's own copy as the authoritative fallback. A TOC or
// excerpt transcribed from the physical book is a real PRIMARY source with real
// chapter locations — the one honest `verified` grounding this app has.
//
// Kept entirely client-side (no serverless function — the project is at the
// Vercel Hobby 12/12 cap). Retail sites are never scraped (ToS + bot-detection +
// legal exposure); the publisher's listing is reached via the web pass, which is
// the only client-viable way to read a page the browser's CORS policy blocks.

// Source types a user can supply, with the tier each earns. A physical-copy TOC /
// excerpt / photo transcription is a primary source → `verified`; the user's own
// notes are a credible secondary account → `reported`.
export const USER_GROUNDING_TYPES = [
  { id: 'toc',       label: 'Table of contents', icon: 'ClipboardList', tier: 'verified', placeholder: 'Chapter titles from your copy — one per line.' },
  { id: 'excerpt',   label: 'Excerpt / passage',  icon: 'FileText',      tier: 'verified', placeholder: 'A passage typed from the book, with the chapter or page if you have it.' },
  { id: 'photo-ocr', label: 'From a photo',        icon: 'Image',         tier: 'verified', placeholder: 'Text you read off a photo of the contents/page.' },
  { id: 'notes',     label: 'Your notes',          icon: 'StickyNote',    tier: 'reported', placeholder: 'Your own notes on this material.' },
];
export const groundingTypeMeta = (id) => USER_GROUNDING_TYPES.find((t) => t.id === id) || USER_GROUNDING_TYPES[0];

import { fetchRaw } from '../utils.js';

const clean = (s) => String(s || '').trim();

// Fetch cross-origin JSON through the shared CORS-proxy chain (direct first, then
// allorigins/corsproxy). Open Library sends CORS headers so it resolves direct;
// loc.gov does NOT, so it only works through the proxy — this is the fix for the
// deployed failure. Returns { data } on success, or { blocked, tried } when every
// route failed (so the attempt log can say CORS-blocked, not just "no results").
async function fetchJson(url, timeoutMs = 10000) {
  const { text, blocked, tried } = await fetchRaw(url, { timeoutMs });
  if (blocked) return { data: null, blocked: true, tried };
  try { return { data: JSON.parse(text) }; } catch { return { data: null, parseError: true }; }
}

// A chapter list is USABLE when it has at least this many entries — enough to be
// a real structure, not a stray heading or two.
const MIN_CHAPTERS = 3;
const isUsable = (toc) => parseTOC(toc).length >= MIN_CHAPTERS;
// Rank retrieved candidates: a fuller chapter list wins (a reported list of 13 is
// far more useful than a formal 3), tie broken by source trust.
const SOURCE_RANK = { loc: 3, openlibrary: 2, web: 1 };
const pickBest = (cands) => cands
  .filter((c) => c && c.toc && isUsable(c.toc))
  .map((c) => ({ ...c, n: parseTOC(c.toc).length }))
  .sort((a, b) => b.n - a.n || (SOURCE_RANK[b.source] || 0) - (SOURCE_RANK[a.source] || 0))[0] || null;

// Publisher name → its own domain, so the web pass can target the publisher's
// listing (they publish chapter structure; it sells books). Unmapped publishers
// still go into the query text.
const PUBLISHER_DOMAINS = {
  penguin: 'penguinrandomhouse.com', 'penguin random house': 'penguinrandomhouse.com',
  portfolio: 'penguinrandomhouse.com', crown: 'penguinrandomhouse.com',
  'simon & schuster': 'simonandschuster.com', 'simon and schuster': 'simonandschuster.com', scribner: 'simonandschuster.com',
  harpercollins: 'harpercollins.com', 'harper collins': 'harpercollins.com', harper: 'harpercollins.com',
  hachette: 'hachettebookgroup.com', 'little, brown': 'hachettebookgroup.com',
  macmillan: 'us.macmillan.com', 'st. martin': 'us.macmillan.com',
  wiley: 'wiley.com', 'hay house': 'hayhouse.com', 'harvard business': 'store.hbr.org',
};
const publisherDomain = (pub) => {
  const p = clean(pub).toLowerCase();
  if (!p) return '';
  for (const [name, dom] of Object.entries(PUBLISHER_DOMAINS)) if (p.includes(name)) return dom;
  return '';
};

// ── Open Library — every edition of every matching work ───────────────────────
// search.json is WORK-level and carries no TOC; the TOC is a field on the EDITION
// record — but it's sparse and sits on one edition while its siblings leave it
// empty, so we try ALL editions and also read the `contents`/`description`
// variants, not just `table_of_contents`. Keyless, CORS-friendly.
export async function openLibraryTOC(title, author, attempts = [], { editions = 4, works = 2 } = {}) {
  const t = clean(title);
  if (!t) return null;
  const search = await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(t)}${author ? `&author=${encodeURIComponent(clean(author))}` : ''}&limit=${works}&fields=key,title,edition_key`);
  if (search.blocked) { attempts.push({ source: 'Open Library', detail: 'work search', unavailable: true, note: (search.tried || []).join(', ') }); return null; }
  const docs = search.data?.docs || [];
  let editionsChecked = 0;
  const found = [];
  for (const doc of docs.slice(0, works)) {
    for (const ek of (doc.edition_key || []).slice(0, editions)) {
      editionsChecked++;
      const edRes = await fetchJson(`https://openlibrary.org/books/${ek}.json`);
      const ed = edRes.data;
      if (!ed) continue;
      const raw = Array.isArray(ed?.table_of_contents) ? ed.table_of_contents
        : Array.isArray(ed?.contents) ? ed.contents : [];
      let titles = raw.map((e) => clean(e?.title || e?.label || e)).filter(Boolean);
      // Some editions stash the contents in the description as a newline list.
      if (titles.length < MIN_CHAPTERS && typeof ed?.description === 'string' && /contents|chapter/i.test(ed.description)) {
        const fromDesc = parseTOC(ed.description);
        if (fromDesc.length >= MIN_CHAPTERS) titles = fromDesc;
      }
      if (titles.length >= MIN_CHAPTERS) found.push({ toc: titles.join('\n'), source: 'openlibrary', sourceLabel: 'Open Library', editionKey: ek });
    }
  }
  attempts.push({ source: 'Open Library', detail: `${docs.length} work(s), ${editionsChecked} edition(s)`, results: found.length });
  return pickBest(found);
}

// ── Library of Congress — MARC field 505 (Formatted Contents Note) ────────────
// Library catalogs carry the TOC (505) far more reliably than Open Library's
// field. loc.gov exposes it as JSON (`fo=json`) but does NOT send CORS headers, so
// it MUST go through the proxy chain (this was the deployed failure — PR #37
// fetched it directly and it never completed). Best-effort: read a `contents`
// array or a contents-style note off the top result's item record.
export async function locTOC(title, author, attempts = []) {
  const t = clean(title);
  if (!t) return null;
  const q = encodeURIComponent(`${t}${author ? ` ${clean(author)}` : ''}`);
  const search = await fetchJson(`https://www.loc.gov/books/?q=${q}&fo=json&c=5&at=results`);
  if (search.blocked) { attempts.push({ source: 'Library of Congress', detail: 'search', unavailable: true, note: (search.tried || []).join(', ') }); return null; }
  const results = search.data?.results || [];
  for (const r of results.slice(0, 3)) {
    // 505 shows up on the item record as `item.contents` (array) or a note.
    const contents = Array.isArray(r?.contents) ? r.contents : [];
    const joined = contents.map(clean).filter(Boolean).join('\n');
    if (isUsable(joined)) { attempts.push({ source: 'Library of Congress', detail: 'contents note (505)', results: 1 }); return { toc: joined, source: 'loc', sourceLabel: 'Library of Congress' }; }
    const url = clean(r?.id || r?.url);
    if (url && /loc\.gov/.test(url)) {
      const itemRes = await fetchJson(`${url.replace(/\/$/, '')}/?fo=json&at=item`);
      const item = itemRes.data?.item || {};
      const c2 = Array.isArray(item?.contents) ? item.contents : [];
      const notes = Array.isArray(item?.notes) ? item.notes : [];
      const noteContents = notes.find((n) => /contents/i.test(String(n))) || '';
      const j2 = c2.map(clean).filter(Boolean).join('\n') || parseTOC(noteContents).join('\n');
      if (isUsable(j2)) { attempts.push({ source: 'Library of Congress', detail: 'item record 505', results: 1 }); return { toc: j2, source: 'loc', sourceLabel: 'Library of Congress' }; }
    }
  }
  attempts.push({ source: 'Library of Congress', detail: `${results.length} result(s)`, results: 0 });
  return null;
}

// ── Web pass — the workhorse, run as a batch of structured queries ────────────
// A direct client-side fetch of a publisher page is CORS-blocked and we can't add
// a proxy, so the web pass (Perplexity/Grok) is the only client-viable way to read
// it. Each query DEMANDS structure (numbered titles in order, or exactly NOT
// FOUND) and — per the ask — accepts a reliable chapter/section/PRINCIPLE
// breakdown from the publisher, the author's site, reviews, or summaries even when
// no page labels it a formal "table of contents" (a `reported` list beats
// nothing). Queries run in parallel; the fullest usable list wins.
const WEB_SYS = 'You extract a book’s chapter structure from current web sources. Return ONLY the chapter/section/principle titles, numbered, one per line, in the book’s order — a reliable breakdown from the publisher, the author’s own site, reviews, or summaries all count, even if no page calls it a formal "table of contents". Do NOT invent or pad; if you cannot find a reliable structure for THIS specific book, reply with exactly NOT FOUND and nothing else.';
export async function webTOCBatch(webPass, title, author, { publisher = '', deep = false } = {}, attempts = []) {
  if (typeof webPass !== 'function') return null;
  const dom = publisherDomain(publisher);
  const queries = [
    `"${title}"${author ? ` by ${author}` : ''} table of contents — chapter titles in order`,
    `"${title}"${author ? ` ${author}` : ''} chapter list / section titles in order`,
  ];
  if (deep) {
    if (dom) queries.push(`site:${dom} "${title}" chapter titles / contents`);
    else if (publisher) queries.push(`"${title}" chapter titles on the publisher (${publisher}) page`);
    queries.push(`"${title}"${author ? ` by ${author}` : ''} — the named chapters, parts, or principles the book is organized around, in order`);
    if (author) queries.push(`${author}'s own site or interviews: the chapter/section breakdown of "${title}"`);
  }
  const settled = await Promise.all(queries.map(async (q) => {
    try {
      const reply = await webPass(q, WEB_SYS);
      const text = clean(reply);
      if (!text || /^\s*NOT FOUND/i.test(text)) { attempts.push({ source: 'Web', detail: q.slice(0, 48), results: 0 }); return null; }
      const n = parseTOC(text).length;
      attempts.push({ source: 'Web', detail: q.slice(0, 48), results: n });
      return isUsable(text) ? { toc: text, source: 'web', sourceLabel: dom ? `web (${dom})` : 'web (publisher / search)' } : null;
    } catch (e) { attempts.push({ source: 'Web', detail: q.slice(0, 48), error: String(e?.message || e) }); return null; }
  }));
  return pickBest(settled);
}

// The automated chain. A LIGHT pass (auto, on select) tries the catalogs and one
// web query; a DEEP pass ("Search harder") widens Open Library to more editions
// and fires the full web batch incl. the publisher domain. Returns
// { toc, attempts } — toc is the best candidate or null — and always the attempt
// log so the UI can report exactly what was tried and what each returned.
export async function retrieveTOC({ title, author, webPass, publisher = '', deep = false } = {}) {
  const attempts = [];
  const cands = [];
  cands.push(await openLibraryTOC(title, author, attempts, deep ? { editions: 8, works: 3 } : { editions: 3, works: 2 }));
  cands.push(await locTOC(title, author, attempts));
  // Web batch: one structured query on the light pass, the full batch on deep.
  cands.push(await webTOCBatch(webPass, title, author, { publisher, deep }, attempts));
  const best = pickBest(cands.filter(Boolean));
  return { toc: best || null, attempts };
}

// Parse a pasted or retrieved TOC into clean chapter lines — tolerant of leading
// bullets/numbers, dot leaders, and trailing page numbers.
export function parseTOC(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l
      .replace(/\s*\.{2,}\s*\d+\s*$/, '')                                  // "Chapter One .... 12"
      .replace(/\s+\d+\s*$/, '')                                            // trailing page number
      .replace(/^[-*•]\s+/, '')                                             // bullet
      .replace(/^\s*(chapter|ch\.?|part|section)\s+[\divxlc]+\s*[:.)\-–—]?\s*/i, '') // "Chapter 4: "
      .replace(/^\s*\d+\s*[.)::\-–—]\s*/, '')                               // "1. " / "1) " / "1: "
      .trim())
    .filter((l) => l && l.length <= 140)
    .slice(0, 40);
}

// The grounding tier a surface has earned given what it actually holds. A physical
// user copy is the only path to `verified`; retrieved structure and publisher
// descriptions are `reported`; nothing is `inferred`.
export function groundingTier({ userGrounding, retrievedTOC, hasContents } = {}) {
  if (userGrounding && clean(userGrounding.text)) return groundingTypeMeta(userGrounding.type).tier;
  if (retrievedTOC || hasContents) return 'reported';
  return 'inferred';
}
