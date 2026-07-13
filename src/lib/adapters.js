// src/lib/adapters.js
// ─────────────────────────────────────────────────────────────────────────
// Swappable source-adapter layer for the Intelligence Hub signal feed.
//
// Each platform is a swappable interface behind one shape: the "signal
// object" (see normalizeSignal below). YouTube is the first LIVE source —
// it pulls real videos via the YouTube Data API v3. Every other platform is
// 'manual' for now (seeded from MOCK_POSTS) and can be upgraded to 'live'
// later by writing a fetch<Platform>Signals() adapter with the same output
// shape and flipping its PLATFORM_STATUS entry to 'live'.
//
// ASSUMPTION: This repo is a Vite client bundle, so process.env secrets are
// NOT available here and exposing an API key client-side would leak it. The
// YouTube key is therefore read SERVER-SIDE in /api/youtube.js
// (process.env.YOUTUBE_API_KEY) — matching how api/summarize.js and
// api/quote.js already handle keys — and this adapter just calls that proxy
// endpoint. Nothing secret is ever hardcoded or shipped to the browser.
// ─────────────────────────────────────────────────────────────────────────

// Live vs. manual per platform. Flip to 'live' as adapters come online.
export const PLATFORM_STATUS = {
  youtube:   'live',
  x:         'manual',
  linkedin:  'manual',
  instagram: 'manual',
  tiktok:    'manual',
};

// Presentation metadata + the tier each platform maps into.
// The hub requires every rendered signal to carry a tier, so each platform
// has a default. YouTube = 'mainstream' (per spec); the rest are sensible
// defaults that can be tuned per source.
// ASSUMPTION: tier taxonomy = mainstream | professional | social | fringe.
export const PLATFORM_META = {
  youtube:   { label: 'YouTube',   icon: '▶️', color: '#ff4444', tier: 'mainstream'   },
  x:         { label: 'X',         icon: '𝕏',  color: '#e7e9ea', tier: 'social'       },
  linkedin:  { label: 'LinkedIn',  icon: '💼', color: '#0a66c2', tier: 'professional' },
  instagram: { label: 'Instagram', icon: '📸', color: '#e1306c', tier: 'social'       },
  tiktok:    { label: 'TikTok',    icon: '🎵', color: '#25f4ee', tier: 'social'       },
};

// Human labels for tiers (for badges).
export const TIER_META = {
  mainstream:   { label: 'Mainstream',   color: '#00C6E6' },
  professional: { label: 'Professional', color: '#0a66c2' },
  social:       { label: 'Social',       color: '#a78bfa' },
  fringe:       { label: 'Fringe',       color: '#ff8844' },
  unranked:     { label: 'Unranked',     color: '#5A7088' },
};

// Topics/queries CB tracks. Used to search YouTube. Edit freely.
// ASSUMPTION: derived from CB's profile in src/constants.js (real estate,
// finance/dividends, longevity, AI-augmented BD, energy/macro, stoicism).
export const TRACKED_QUERIES = [
  'multifamily real estate investing',
  'dividend investing covered calls',
  'Peter Attia longevity',
  'AI for business development sales',
  'ERCOT Texas energy grid',
  'stoicism modern life',
];

// ── Time helpers ──────────────────────────────────────────────────────────

// Hours elapsed since a date (Date | ISO string | ms). Never negative.
export function hoursSince(dateish) {
  const t = toMs(dateish);
  if (t == null) return 0;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

// Compact relative time: "just now", "3h ago", "2d ago", "5w ago".
export function relTime(dateish) {
  const t = toMs(dateish);
  if (t == null) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1)      return 'just now';
  if (mins < 60)     return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)      return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7)      return `${days}d ago`;
  const wks = Math.round(days / 7);
  if (wks < 5)       return `${wks}w ago`;
  const mos = Math.round(days / 30);
  if (mos < 12)      return `${mos}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

// Compact count formatting: 1234 → "1.2K", 3_400_000 → "3.4M".
export function fmtCount(n) {
  const v = Number(n) || 0;
  if (v < 1000)        return String(v);
  if (v < 1_000_000)   return trim(v / 1000) + 'K';
  if (v < 1_000_000_000) return trim(v / 1_000_000) + 'M';
  return trim(v / 1_000_000_000) + 'B';
}

// Velocity / signal score. Higher = stronger signal right now.
// Reach decays with age (Hacker-News-style gravity) and gets a velocity
// kick (views/hour) so a fast-rising fresh video beats an old viral one.
export function scoreSignal(views = 0, ageHours = 0) {
  const v   = Math.max(0, Number(views) || 0);
  const age = Math.max(0, Number(ageHours) || 0);
  const velocity = v / (age + 2);                  // views per hour (smoothed)
  const decayed  = v / Math.pow(age + 2, 1.5);     // gravity decay on raw reach
  const score = decayed + velocity * 0.25;
  return Math.round(score * 100) / 100;
}

// ── Normalizer ──────────────────────────────────────────────────────────
// Guarantees every signal that reaches the UI has the full standard shape —
// crucially a `tier`, so nothing ever renders un-tiered.
export function normalizeSignal(raw = {}) {
  const platform = (raw.platform || 'unknown').toLowerCase();
  const meta = PLATFORM_META[platform] || {};
  const views = Math.max(0, Number(raw.views) || 0);
  const publishedAt = raw.publishedAt || raw.published || null;
  const ageHours = hoursSince(publishedAt);
  const tier = raw.tier || meta.tier || 'unranked';

  return {
    id:          raw.id || `${platform}:${raw.url || raw.title || Math.random().toString(36).slice(2)}`,
    platform,
    status:      PLATFORM_STATUS[platform] || 'manual',
    title:       raw.title || '(untitled)',
    url:         raw.url || '#',
    source:      raw.source || raw.channel || meta.label || platform,
    thumbnail:   raw.thumbnail || null,
    views,
    publishedAt,
    ageHours:    Math.round(ageHours * 10) / 10,
    relTime:     relTime(publishedAt),
    tier,                                   // never undefined — see fallback above
    score:       raw.score != null ? raw.score : scoreSignal(views, ageHours),
  };
}

export const normalizeFeed = (list = []) => list.map(normalizeSignal);

// ── YouTube live adapter ──────────────────────────────────────────────────
// Calls the server-side proxy (/api/youtube), which holds the API key and
// hits YouTube Data API v3 (search + videos/statistics). Maps each video
// into a raw signal object. Fails gracefully: on any error/missing key it
// logs a clear warning and returns [] so the feed still renders.
export async function fetchYouTubeSignals({ queries = TRACKED_QUERIES, limit = 12 } = {}) {
  try {
    const qs = new URLSearchParams({ q: queries.join(','), limit: String(limit) });
    const res = await fetch(`/api/youtube?${qs}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      console.warn(`[adapters] YouTube proxy returned ${res.status}; falling back to no live videos.`);
      return [];
    }
    const data = await res.json();
    if (data?.warning) console.warn(`[adapters] YouTube adapter: ${data.warning}`);
    const items = Array.isArray(data?.items) ? data.items : [];
    // Map API response → standard signal object.
    return items.map(v => ({
      platform:    'youtube',
      id:          v.id ? `youtube:${v.id}` : undefined,
      title:       v.title,
      url:         v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : '#'),
      views:       v.views,
      publishedAt: v.publishedAt,
      source:      v.channel,
      channel:     v.channel,
      thumbnail:   v.thumbnail,
      tier:        'mainstream',   // YouTube = mainstream (per spec)
    }));
  } catch (err) {
    console.warn('[adapters] YouTube adapter failed — feed will render without live videos.', err?.message || err);
    return [];
  }
}

// ── Manual seed for non-live platforms ──────────────────────────────────
// These stay mock/manual until each platform gets its own live adapter.
// Kept CB-relevant so the feed reads real. `views` and time are illustrative.
// ASSUMPTION: sample content standing in for a future manual-curation source.
const now = Date.now();
const hoursAgo = h => new Date(now - h * 3_600_000).toISOString();

export const MOCK_POSTS = [
  { platform: 'x', title: 'Thread: why sub-10-unit multifamily is the last inefficient real-estate niche institutions ignore.', url: 'https://x.com', views: 48200, publishedAt: hoursAgo(5),  source: '@REInsider' },
  { platform: 'x', title: 'Covered-call overlays on dividend stacks quietly adding 4% yield — nobody talks about it.', url: 'https://x.com', views: 12800, publishedAt: hoursAgo(19), source: '@DividendDesk' },
  { platform: 'linkedin', title: 'How BD teams that built AI pipelines in 2025 are closing 3x faster than peers.', url: 'https://linkedin.com', views: 9400, publishedAt: hoursAgo(9),  source: 'Sales Ops Weekly' },
  { platform: 'linkedin', title: 'Onshoring capex is booming — the overlooked moat is the construction supply chain.', url: 'https://linkedin.com', views: 6100, publishedAt: hoursAgo(30), source: 'Macro Notes' },
  { platform: 'instagram', title: 'Attia’s Zone 2 + VO₂max + muscle-mass trifecta, in one 60-second explainer.', url: 'https://instagram.com', views: 88000, publishedAt: hoursAgo(14), source: '@longevity.daily' },
  { platform: 'tiktok', title: 'ERCOT price spikes explained: how demand response actually pays out.', url: 'https://tiktok.com', views: 154000, publishedAt: hoursAgo(7), source: '@energytok' },
];

// ── Feed assembly ─────────────────────────────────────────────────────────
// Live YouTube + manual others, all normalized and sorted by signal score.
// This is the "replace the YouTube slice with live output; others stay
// manual" wiring: MOCK_POSTS holds only manual platforms (no static
// YouTube), and YouTube rows come exclusively from the live adapter.
export async function getFeed({ youtube = true, limit = 24 } = {}) {
  const parts = [...MOCK_POSTS];
  if (youtube && PLATFORM_STATUS.youtube === 'live') {
    const live = await fetchYouTubeSignals();
    parts.push(...live);
  }
  return normalizeFeed(parts)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── internals ─────────────────────────────────────────────────────────────
function toMs(dateish) {
  if (dateish == null) return null;
  if (dateish instanceof Date) return dateish.getTime();
  if (typeof dateish === 'number') return dateish;
  const t = Date.parse(dateish);
  return Number.isNaN(t) ? null : t;
}

function trim(x) {
  // one decimal, but drop trailing ".0"
  return (Math.round(x * 10) / 10).toString();
}
