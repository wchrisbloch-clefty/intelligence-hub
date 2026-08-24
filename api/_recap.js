// api/_recap.js — shared helpers for the scheduled recap functions.
// Underscore-prefixed → Vercel does NOT expose this as an HTTP route.
//
// The recap endpoints (api/weekly-recap.js, api/monthly-review.js) read CB's
// state from Upstash, call Anthropic, and write a recap record back to Upstash.
// This module centralizes the parts they share so neither route duplicates them.
import { store } from './_lib.js';
import { callAI, formatAttempts } from './_providers.js';

// Recaps prefer Claude (the 'reason' job leads with it) but no longer die when
// Claude is unavailable — that's the failure that broke the weekly recap.
export const RECAP_MODEL = 'claude-sonnet-4-6';

// Storage keys — must match src/constants.js.
export const KEYS = {
  GRAPH: 'aether_graph_v1',
  PROJECTS: 'aether_projects_v1',
  NOTES: 'aether_notes_v1',
  RESEARCH: 'aether_research_v1',
  INBOX: 'aether_inbox',
  DECISIONS: 'aether_decisions',
  QUIZ: 'aether_quiz_results',
  WEEKLY_RECAP: 'weekly_recap_latest',
  MONTHLY_REVIEW: 'monthly_review_latest',
};

// CB's identity spine — mirrored from src/constants.js (CB_IDENTITY). Keep in
// sync with constants.js if the spine changes.
export const CB_IDENTITY = `You are CB's Intelligence System — research analyst, truth-seeker, and knowledge hub.

WHO CB IS:
Mid-to-late 30s, Houston TX. BD professional. Family-first, long-game operator. Stoic philosophy, systems thinker. Always hunting tipping points, compounding effects, Blue Ocean opportunities.

CB'S GOALS:
- Financial: $10K+/mo passive income (dividends, real estate, business revenue)
- Health: performance + longevity (Attia, Huberman frameworks)
- Building: scalable, sellable, modular businesses
- Priority: W2 protection → passive income → business building

DECISIVENESS RULE: Every output ends with a clear recommendation, action, or bet. No vagueness.`;

// ─── STATE (Upstash, via _lib.js store) ─────────────────────────────────────
// Values are stored verbatim as JSON strings (the app JSON.stringifies before
// SET), so reads JSON.parse the result and writes JSON.stringify the value.
// A missing key → null (never throws on absence).
export async function readState(keys) {
  const out = {};
  await Promise.all(
    keys.map(async (k) => {
      try {
        const raw = await store.get(k);
        out[k] = raw == null ? null : JSON.parse(raw);
      } catch {
        out[k] = null; // absent or unparseable → treat as absent
      }
    }),
  );
  return out;
}

export async function writeState(key, value) {
  await store.set(key, JSON.stringify(value));
}

// ─── AI (cascade, Claude-first) ──────────────────────────────────────────────
// Returns { text, provider, model }. Prefers Claude via the 'reason' job, then
// falls through the chain. Throws only if every provider is down/unconfigured.
export async function callRecapAI({ system, user, maxTokens = 2000 }) {
  const r = await callAI({
    job: 'reason',
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens,
  });
  if (!r || !r.text) {
    // Carry the per-provider reasons through so the route's 500 body and the
    // server logs say WHICH provider failed and why — not just "failed".
    const attempts = r?.attempts || [];
    console.error(`[recap] all providers failed: ${formatAttempts(attempts)}`);
    const err = new Error(r?.error || 'All AI providers failed or none configured.');
    err.attempts = attempts;
    throw err;
  }
  return r;
}

// ─── CRON AUTH ──────────────────────────────────────────────────────────────
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// set on the project. Fail closed if the secret isn't configured so the
// endpoint is never publicly triggerable. Returns true if the request may
// proceed; otherwise writes the response and returns false.
export function requireCron(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(500).json({ ok: false, error: 'CRON_SECRET is not configured.' });
    return false;
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}
