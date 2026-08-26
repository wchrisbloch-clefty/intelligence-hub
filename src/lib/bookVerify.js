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

// ── Match scoring ─────────────────────────────────────────────────────────────
// The user types the SHORT title from the cover spine ("Winning"); the catalog
// stores the full title with subtitle ("Winning: The Unforgiving Race to
// Greatness"). Exact-phrase matching can't bridge that, and two different books
// can share a short title (Grover's "Winning" vs Jack Welch's), so we score
// candidates on title similarity (subtitle-tolerant), author match, and edition
// recency rather than taking whatever the catalog returns first.
const normTitle = (s) => String(s || '').toLowerCase().split(/[:–—-]/)[0].replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const normAuthor = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const tokenOverlap = (a, b) => {
  const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0; for (const t of A) if (B.has(t)) hit++;
  return hit / A.size;
};
export function scoreMatch(cand, { title, author } = {}) {
  const qt = normTitle(title), ct = normTitle(cand.title);
  let titleScore;
  if (ct && ct === qt) titleScore = 1;               // same base title
  else if (qt && ct && (ct.startsWith(qt) || qt.startsWith(ct))) titleScore = 0.9; // subtitle on one side
  else if (qt && ct && (ct.includes(qt) || qt.includes(ct))) titleScore = 0.6;
  else titleScore = tokenOverlap(qt, ct);
  let authorScore = 0.5; // neutral when the user gave no author
  if (author) {
    // Token-based so a middle initial doesn't break the match: "Carol Dweck"
    // must match "Carol S. Dweck". Full name subset → 1; surname-only → 0.7.
    const qaT = normAuthor(author).split(' ').filter(Boolean);
    const surname = qaT[qaT.length - 1];
    const cas = (cand.authors || []).map(normAuthor);
    authorScore = cas.length ? 0 : 0.3;
    for (const a of cas) {
      const at = new Set(a.split(' ').filter(Boolean));
      if (qaT.length && qaT.every((t) => at.has(t))) { authorScore = 1; break; }
      if (surname && at.has(surname)) authorScore = Math.max(authorScore, 0.7);
    }
  }
  const year = parseInt(String(cand.publishedDate || '').slice(0, 4), 10);
  const recency = year && year > 1900 ? Math.min(1, (year - 1900) / 130) : 0;
  return +(0.6 * titleScore + 0.35 * authorScore + 0.05 * recency).toFixed(4);
}
// Above this the top match is confident enough to preselect; below it the UI
// shows the top 2–3 candidates and lets the user pick.
export const CONFIDENCE_THRESHOLD = 0.75;

const mapGoogle = (it) => {
  const v = it.volumeInfo || {}; const img = v.imageLinks || {};
  return {
    source: 'google', id: it.id, title: clean(v.title), subtitle: clean(v.subtitle),
    authors: v.authors || [], publishedDate: clean(v.publishedDate), description: clean(v.description),
    publisher: clean(v.publisher),
    thumbnail: (img.thumbnail || img.smallThumbnail || '').replace(/^http:/, 'https:'),
    infoLink: v.infoLink || '', pageCount: v.pageCount || null,
  };
};
const mapOpenLibrary = (doc) => ({
  source: 'openlibrary', id: doc.key, title: clean(doc.title), subtitle: clean(doc.subtitle),
  authors: doc.author_name || [], publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
  description: '', thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
  infoLink: doc.key ? `https://openlibrary.org${doc.key}` : '', pageCount: null,
});

// ── Query cascades (both fields encoded; stop at first non-empty response) ─────
// Google Books: exact-phrase → unquoted (allows subtitle) → plain keyword.
const googleQueries = (title, author) => {
  const t = `"${title}"`;
  return author
    ? [`intitle:${t} inauthor:"${author}"`, `intitle:${title} inauthor:${author}`, `${title} ${author}`]
    : [`intitle:${t}`, `intitle:${title}`, `${title}`];
};
const openLibraryUrls = (title, author) => (author
  ? [`title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`, `q=${encodeURIComponent(`${title} ${author}`)}`]
  : [`title=${encodeURIComponent(title)}`, `q=${encodeURIComponent(title)}`]);

async function runGoogle(title, author, attempts) {
  for (const q of googleQueries(title, author)) {
    try {
      const d = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
      const rows = (Array.isArray(d?.items) ? d.items : []).map(mapGoogle).filter((b) => b.title);
      attempts.push({ source: 'Google Books', query: q, results: rows.length });
      if (rows.length) return rows;
    } catch (e) { attempts.push({ source: 'Google Books', query: q, error: String(e?.message || e) }); }
  }
  return [];
}
async function runOpenLibrary(title, author, attempts) {
  for (const qs of openLibraryUrls(title, author)) {
    try {
      const d = await fetchJson(`https://openlibrary.org/search.json?${qs}&limit=5&fields=title,subtitle,author_name,first_publish_year,cover_i,key`);
      const rows = (Array.isArray(d?.docs) ? d.docs : []).map(mapOpenLibrary).filter((b) => b.title);
      attempts.push({ source: 'Open Library', query: qs.replace(/&/g, ' '), results: rows.length });
      if (rows.length) return rows;
    } catch (e) { attempts.push({ source: 'Open Library', query: qs.replace(/&/g, ' '), error: String(e?.message || e) }); }
  }
  return [];
}

// Verify a title against real catalogs. Returns candidates SCORED and sorted best
// first, the per-source `attempts` (so a zero-results query and a network failure
// no longer look identical), and a `confident` flag (top score ≥ threshold).
// Never throws — a total failure returns empty matches with the attempt log.
export async function verifyBook({ title, author }) {
  const t = clean(title), a = clean(author);
  const attempts = [];
  if (!t) return { matches: [], attempts, confident: false };
  let rows = await runGoogle(t, a, attempts);
  if (!rows.length) rows = await runOpenLibrary(t, a, attempts);
  const matches = rows
    .map((m) => ({ ...m, score: scoreMatch(m, { title: t, author: a }) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);
  return { matches, attempts, confident: !!matches.length && matches[0].score >= CONFIDENCE_THRESHOLD };
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
    publisher: match.publisher || '',
    thumbnail: match.thumbnail,
    infoLink: match.infoLink,
    postCutoff: isPostCutoff(match.publishedDate),
    verifiedAt: Date.now(),
  };
}
