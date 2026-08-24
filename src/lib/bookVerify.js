// src/lib/bookVerify.js — verify a book against a real catalog BEFORE generating
// a study guide, so the model can't confidently invent a thesis for a title it
// doesn't actually know (which is what happened with *The Way of Excellence* —
// published after the model's cutoff, it drifted to the author's earlier books
// and asserted their frameworks as this book's content).
//
// Both catalogs are free, keyless, and CORS-friendly, so this runs entirely
// client-side — no serverless function (the project is at the Vercel Hobby
// 12-function cap). Google Books first (richest descriptions), Open Library on a
// miss.

// The generating models' rough knowledge horizon. A book published after this is
// flagged `postCutoff` and needs a live web grounding pass before generation —
// tune here if the reason-tier models change.
export const MODEL_KNOWLEDGE_CUTOFF = '2025-01';

const clean = (s) => String(s || '').trim();

// publishedDate from these APIs is 'YYYY', 'YYYY-MM', or 'YYYY-MM-DD'. Compare on
// the year-month prefix so a bare year still resolves.
export function isPostCutoff(publishedDate, cutoff = MODEL_KNOWLEDGE_CUTOFF) {
  const p = clean(publishedDate);
  if (!p) return false;
  const norm = (d) => {
    const [y, m = '01'] = d.split('-');
    return `${y.padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  };
  return norm(p) > norm(cutoff);
}

async function fetchJson(url, timeoutMs = 9000) {
  const ctrl = AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
  const r = await fetch(url, { signal: ctrl });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ── Google Books ─────────────────────────────────────────────────────────────
async function fromGoogle(title, author) {
  const q = `intitle:${JSON.stringify(title)}${author ? `+inauthor:${encodeURIComponent(author)}` : ''}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:"${title}"`)}${author ? `+inauthor:${encodeURIComponent(author)}` : ''}&maxResults=5`;
  const d = await fetchJson(url);
  const items = Array.isArray(d?.items) ? d.items : [];
  return items.map((it) => {
    const v = it.volumeInfo || {};
    const img = v.imageLinks || {};
    return {
      source: 'google',
      id: it.id,
      title: clean(v.title),
      subtitle: clean(v.subtitle),
      authors: v.authors || [],
      publishedDate: clean(v.publishedDate),
      description: clean(v.description),
      thumbnail: (img.thumbnail || img.smallThumbnail || '').replace(/^http:/, 'https:'),
      infoLink: v.infoLink || '',
      pageCount: v.pageCount || null,
    };
  }).filter((b) => b.title);
}

// ── Open Library (fallback) ──────────────────────────────────────────────────
async function fromOpenLibrary(title, author) {
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ''}&limit=5&fields=title,subtitle,author_name,first_publish_year,cover_i,key`;
  const d = await fetchJson(url);
  const docs = Array.isArray(d?.docs) ? d.docs : [];
  return docs.map((doc) => ({
    source: 'openlibrary',
    id: doc.key,
    title: clean(doc.title),
    subtitle: clean(doc.subtitle),
    authors: doc.author_name || [],
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
    description: '', // search endpoint has no description; title/author/date still anchor
    thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
    infoLink: doc.key ? `https://openlibrary.org${doc.key}` : '',
    pageCount: null,
  })).filter((b) => b.title);
}

// Return up to a handful of candidate matches, best source first. Never throws —
// a total failure returns [] so the caller can fall back to an "unverified" path.
export async function verifyBook({ title, author }) {
  const t = clean(title);
  if (!t) return [];
  try {
    const g = await fromGoogle(t, clean(author));
    if (g.length) return g;
  } catch {}
  try {
    const o = await fromOpenLibrary(t, clean(author));
    if (o.length) return o;
  } catch {}
  return [];
}

// The verified metadata we persist onto a book record (and inject as grounding).
export function toVerifiedRecord(match) {
  if (!match) return null;
  return {
    verified: true,
    source: match.source,
    sourceId: match.id,
    fullTitle: [match.title, match.subtitle].filter(Boolean).join(': '),
    authors: match.authors,
    publishedDate: match.publishedDate,
    description: match.description,
    thumbnail: match.thumbnail,
    infoLink: match.infoLink,
    postCutoff: isPostCutoff(match.publishedDate),
    verifiedAt: Date.now(),
  };
}
