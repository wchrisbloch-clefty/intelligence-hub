// /api/quote.js
// Vercel serverless proxy for Yahoo Finance quote data.
// Browser → /api/quote?sym=BE → Yahoo → returns simplified {price, chg, pct}
// Yahoo blocks browser CORS so we proxy server-side. No API key required.
//
// Why a custom endpoint instead of using /api/rss as a generic proxy:
// (1) we want clean parsed JSON, (2) we cap per-symbol cache, (3) if Yahoo
// changes shape we change one place.

import { requireAuth } from './_lib.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sym = (req.query.sym || '').trim();
  if (!sym) return res.status(400).json({ error: 'Missing sym query param' });

  // Whitelist symbol characters to prevent passthrough abuse
  if (!/^[A-Za-z0-9.\-=^]+$/.test(sym)) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;

  try {
    const upstream = await fetch(url, {
      headers: {
        // Yahoo blocks unknown user agents
        'User-Agent': 'Mozilla/5.0 (compatible; NewsHubBot/1.0)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Yahoo ${upstream.status}` });
    }

    const data = await upstream.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      return res.status(502).json({ error: 'Yahoo returned no price data for ' + sym });
    }

    const price = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose || price;
    const chg = price - prev;
    const pct = prev ? (chg / prev) * 100 : 0;

    // Cache for 5 min (prices don't move that fast for our display)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ sym, price, chg, pct, prev });

  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Yahoo timed out' : `Fetch error: ${err.message || err.name}`,
    });
  }
}
