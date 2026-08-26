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

const clean = (s) => String(s || '').trim();

async function fetchJson(url, timeoutMs = 9000) {
  const signal = AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

// ── Step 1: Open Library edition `table_of_contents` (two-hop) ────────────────
// search.json is WORK-level and carries no TOC; the TOC is a first-class field on
// the EDITION record. So: find the work + its edition keys, then fetch editions
// until one carries a real TOC. Open Library is keyless and CORS-friendly.
export async function openLibraryTOC(title, author) {
  const t = clean(title);
  if (!t) return null;
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(t)}${author ? `&author=${encodeURIComponent(clean(author))}` : ''}&limit=3&fields=key,title,edition_key`;
  let docs = [];
  try { docs = (await fetchJson(url))?.docs || []; } catch { return null; }
  for (const doc of docs) {
    for (const ek of (doc.edition_key || []).slice(0, 6)) {
      try {
        const ed = await fetchJson(`https://openlibrary.org/books/${ek}.json`);
        const raw = Array.isArray(ed?.table_of_contents) ? ed.table_of_contents : [];
        const titles = raw.map((e) => clean(e?.title || e?.label)).filter(Boolean);
        if (titles.length >= 3) return { toc: titles.join('\n'), source: 'openlibrary', sourceLabel: 'Open Library', editionKey: ek };
      } catch { /* try the next edition */ }
    }
  }
  return null;
}

// ── Steps 2 + 3: publisher listing + web search, via one `job:'web'` pass ─────
// A direct client-side fetch of a publisher page is CORS-blocked in the browser,
// and a serverless proxy isn't available (Hobby function cap), so the publisher's
// own listing is reached the only way the client can: the web pass, instructed to
// PREFER the publisher's page over any retailer. `webPass` is an async
// `(prompt) => text` the caller supplies (a callClaude wrapper), so this module
// carries no dependency on the AI layer.
export async function webTOC(webPass, title, author) {
  if (typeof webPass !== 'function') return null;
  try {
    const reply = await webPass(`Find the table of contents — the chapter titles, in order — of the book "${title}"${author ? ` by ${author}` : ''}. Prefer the PUBLISHER'S own page (e.g. Penguin, Portfolio) over any retailer; never use Amazon. List ONLY the chapter titles, one per line. If you cannot find the actual table of contents for THIS specific book, reply exactly NOT FOUND.`);
    const text = clean(reply);
    if (!text || /^NOT FOUND/i.test(text)) return null;
    return { toc: text, source: 'web', sourceLabel: 'web (publisher / search)' };
  } catch { return null; }
}

// The automated chain: Open Library → web pass. Stops at the first usable result;
// returns null when nothing was found (the UI then asks the user for their copy).
export async function retrieveTOC({ title, author, webPass } = {}) {
  const ol = await openLibraryTOC(title, author);
  if (ol) return ol;
  const web = await webTOC(webPass, title, author);
  if (web) return web;
  return null;
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
