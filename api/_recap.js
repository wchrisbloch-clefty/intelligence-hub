// api/_recap.js — shared helpers for the scheduled recap functions.
// Underscore-prefixed → Vercel does NOT expose this as an HTTP route.
//
// The recap endpoints (api/weekly-recap.js, api/monthly-review.js) read CB's
// state from Upstash, call Anthropic, and write a recap record back to Upstash.
// This module centralizes the parts they share so neither route duplicates them.
import { store } from './_lib.js';
import { callAI, formatAttempts, MODELS } from './_providers.js';

// Recaps prefer Claude (the 'reason' job leads with it) but no longer die when
// Claude is unavailable — that's the failure that broke the weekly recap. Model
// ID comes from the single registry in _providers.js, never a second literal.
export const RECAP_MODEL = MODELS.claude;

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

// System prompt — Batch Z / Order D. Layers 1 + 2 only (LENS + SUBJECT_FIDELITY),
// compiled from prompts/*.md by scripts/gen-prompts.mjs — the SAME text the app
// uses, no hand-kept mirror. The reader's goals are not in it.
import { LENS, SUBJECT_FIDELITY } from '../prompts/prompts.generated.js';
export const SYSTEM_BASE = `You are an intelligence system: research analyst, truth-seeker, and teacher.\n\n${LENS}\n\n${SUBJECT_FIDELITY}`;

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
