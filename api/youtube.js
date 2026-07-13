// /api/youtube.js
// Server-side proxy for the YouTube Data API v3. The API key lives ONLY on
// the server (process.env.YOUTUBE_API_KEY) so it is never shipped to the
// browser — same pattern as api/summarize.js and api/quote.js.
//
// Flow: client → /api/youtube?q=topic1,topic2&limit=12
//   1) search.list  (find recent videos per query, ordered by relevance)
//   2) videos.list   (batch statistics: view counts + exact publish time)
//   → returns { items: [{ id, title, url, views, publishedAt, channel, thumbnail }] }
//
// Env var (add in Vercel → Settings → Environment Variables):
//   YOUTUBE_API_KEY — get from console.cloud.google.com (see steps in PR/notes)
//
// Fail-loud + graceful: if the key is missing or the API errors, we log a
// clear warning and return HTTP 200 with items:[] and a `warning` field, so
// the hub still renders (the adapter just shows no live videos).

const API = 'https://www.googleapis.com/youtube/v3';

// ASSUMPTION: sensible defaults for a personal hub — keep quota modest.
// search.list costs 100 units/query, so cap queries and results.
const DEFAULT_QUERIES = ['multifamily real estate investing', 'dividend investing', 'Peter Attia longevity'];
const MAX_QUERIES = 6;
const PER_QUERY   = 4;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    const warning = 'YOUTUBE_API_KEY is not set. Add it in Vercel → Settings → Environment Variables (and .env.local for local dev), then redeploy. Serving 0 live videos.';
    console.warn(`[api/youtube] ${warning}`);
    return res.status(200).json({ items: [], warning });
  }

  const queries = parseQueries(req.query?.q).slice(0, MAX_QUERIES);
  const limit   = clamp(parseInt(req.query?.limit, 10) || 12, 1, 50);

  try {
    // 1) Search each tracked query for recent videos.
    const searches = await Promise.all(queries.map(q => searchVideos(q, key)));
    const idOrder = [];
    const seen = new Set();
    for (const ids of searches) {
      for (const id of ids) {
        if (!seen.has(id)) { seen.add(id); idOrder.push(id); }
      }
    }

    if (idOrder.length === 0) {
      return res.status(200).json({ items: [] });
    }

    // 2) Batch-fetch statistics + snippet for every unique video id.
    const stats = await fetchVideoStats(idOrder, key);

    const items = idOrder
      .map(id => stats[id])
      .filter(Boolean)
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ items });
  } catch (err) {
    const warning = `YouTube Data API request failed: ${err?.message || err}. Serving 0 live videos.`;
    console.warn(`[api/youtube] ${warning}`);
    return res.status(200).json({ items: [], warning });
  }
}

// ── search.list → array of videoIds ───────────────────────────────────────
async function searchVideos(query, key) {
  const url = `${API}/search?` + new URLSearchParams({
    key,
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'relevance',
    maxResults: String(PER_QUERY),
    relevanceLanguage: 'en',
  });
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`search.list ${r.status} for "${query}"`);
  const d = await r.json();
  return (d.items || []).map(it => it?.id?.videoId).filter(Boolean);
}

// ── videos.list → { [id]: signalRaw } ─────────────────────────────────────
async function fetchVideoStats(ids, key) {
  const out = {};
  // videos.list accepts up to 50 ids per call.
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `${API}/videos?` + new URLSearchParams({
      key,
      part: 'snippet,statistics',
      id: batch.join(','),
    });
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`videos.list ${r.status}`);
    const d = await r.json();
    for (const v of (d.items || [])) {
      const sn = v.snippet || {};
      const th = sn.thumbnails || {};
      out[v.id] = {
        id:          v.id,
        title:       sn.title || '(untitled)',
        url:         `https://www.youtube.com/watch?v=${v.id}`,
        views:       Number(v.statistics?.viewCount) || 0,
        publishedAt: sn.publishedAt || null,
        channel:     sn.channelTitle || 'YouTube',
        thumbnail:   (th.medium || th.high || th.default || {}).url || null,
      };
    }
  }
  return out;
}

// ── helpers ────────────────────────────────────────────────────────────────
function parseQueries(q) {
  if (!q) return DEFAULT_QUERIES;
  const list = String(q).split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_QUERIES;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
