// api/_providers.js — the shared multi-provider AI cascade.
// Underscore-prefixed → Vercel does NOT expose this as an HTTP route.
//
// Promoted out of api/summarize.js so every AI route (chat, recaps, summarize)
// gets the same fallback chain instead of being single-provider. Claude stays
// the quality tier; it just stops being the single point of failure.
//
// Env var names are unchanged: GROQ_API_KEY, GOOGLE_AI_KEY, XAI_API_KEY,
// PERPLEXITY_API_KEY, ANTHROPIC_API_KEY.
//
// Each provider is normalized behind one signature:
//   ({ system, messages, maxTokens }) → attempt result
// Result is ALWAYS a structured object (never a bare null), so the cascade can
// record why each attempt failed instead of throwing the reason away:
//   success → { ok:true, text, provider, model }
//   failure → { ok:false, provider, status, detail, skipped? }
// Callers still detect success with `r && r.text` (unchanged), but now have the
// per-attempt status + detail for logging and for the user-facing error.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── Model registry ───────────────────────────────────────────────────────────
// EVERY model ID lives here, one per line with the date it was last confirmed
// working. Vendors retire models with little notice (three did in one week), and
// a retired model is a 404 that masquerades as a bad key — so when a provider
// starts 404ing, check /api/health, then update the ID + date here. This is the
// ONE place to change; nothing else hardcodes a model string.
export const MODELS = {
  claude:     'claude-sonnet-4-6',    // Anthropic  · confirmed 2026-08-24
  gemini:     'gemini-3.6-flash',     // Google     · confirmed 2026-08-24 (2.5-flash retired: "no longer available to new users")
  groq70:     'openai/gpt-oss-120b',  // Groq       · confirmed 2026-08-24 (free Llama tier moved to Enterprise)
  groq8:      'openai/gpt-oss-20b',   // Groq       · confirmed 2026-08-24
  grok:       'grok-3-mini',          // xAI        · confirmed 2026-08-24
  perplexity: 'sonar',                // Perplexity · confirmed 2026-08-24
};

const CLAUDE_MODEL = MODELS.claude;

// Per-provider output-token ceiling. A request may ask for maxTokens: 6000, but
// a provider whose tier/model caps output lower will 400/413 the whole request —
// so we clamp per provider instead. A shorter answer beats no answer. (Groq's
// free tier is the tight one; Claude/Gemini get real headroom.)
// Groq's open gpt-oss models allow 65,536 completion tokens, so the old 4096
// clamp is gone — a 6000-token guide fits comfortably. Gemini 2.5-flash caps at
// 8192; Claude has real headroom.
const OUTPUT_CAP = { Groq: 32768, Gemini: 8192, Grok: 8192, Perplexity: 4096, Claude: 64000 };
const capFor = (provider, maxTokens) => Math.min(maxTokens || 1024, OUTPUT_CAP[provider] ?? 4096);

// Wall-clock budget for ONE provider call, by job. reason-tier generations
// (study guides at 6000 tokens) run for tens of seconds to minutes, so they get
// a budget just under the route maxDuration (300s). A tiny health probe finishes
// in well under any of these — which is exactly why a fast probe hid a real
// 6000-token timeout: the budget, not the probe, is what a real call needs.
const TIMEOUT_BUDGET = { reason: 290000, web: 90000, default: 45000 };
export const timeoutFor = (job) => TIMEOUT_BUDGET[job] || TIMEOUT_BUDGET.default;
// The floor a reason-tier request needs; health flags any provider whose budget
// falls below this so a too-short timeout can never silently kill long work again.
export const REASON_MIN_BUDGET_MS = 120000;

// Pull the most useful error string out of an upstream error response.
async function errDetail(r) {
  try {
    const e = await r.clone().json();
    return e?.error?.message || e?.error?.type || e?.message || JSON.stringify(e).slice(0, 300);
  } catch {
    try { return (await r.text()).slice(0, 300); } catch { return ''; }
  }
}

// ── message/system normalization ─────────────────────────────────────────────
// chat.js `system` may be a string or { cached, dynamic }; `messages` are
// Anthropic-shaped (content is a string or an array of blocks). Non-Anthropic
// providers are text-only, so flatten blocks to text and note any dropped
// image/document parts rather than crashing.
function sysToString(system) {
  if (!system) return '';
  if (typeof system === 'string') return system;
  return [system.cached, system.dynamic].filter(Boolean).join('\n\n');
}

function textOfContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) =>
      b?.type === 'text' ? b.text
      : b?.type === 'image' ? '[image omitted — non-vision provider]'
      : b?.type === 'document' ? '[document omitted — non-vision provider]'
      : ''
    ).filter(Boolean).join('\n');
  }
  return '';
}

function toOpenAIMessages(system, messages) {
  const out = [];
  const sys = sysToString(system);
  if (sys) out.push({ role: 'system', content: sys });
  for (const m of messages) {
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: textOfContent(m.content) });
  }
  return out;
}

// Anthropic system blocks with prompt caching preserved.
export function buildSystemBlocks(system) {
  if (!system || (typeof system === 'string' && !system.trim())) return undefined;
  if (typeof system === 'string') {
    return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  }
  return [
    { type: 'text', text: system.cached, cache_control: { type: 'ephemeral' } },
    ...(system.dynamic ? [{ type: 'text', text: system.dynamic }] : []),
  ];
}

// ── OpenAI-compatible providers (Groq, Grok, Perplexity) ─────────────────────
async function openaiChat({ url, key, model, provider, system, messages, maxTokens, timeout }) {
  const budget = timeout || 45000;
  if (!key) return { ok: false, provider, status: null, detail: `no API key (${KEY_MAP[provider] || 'env var'} not set)`, skipped: true, timeoutBudgetMs: budget, durationMs: 0 };
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: toOpenAIMessages(system, messages),
        max_tokens: capFor(provider, maxTokens),
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(budget),
    });
    if (!r.ok) return { ok: false, provider, status: r.status, detail: await errDetail(r), timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    return text
      ? { ok: true, text, provider, model, timeoutBudgetMs: budget, durationMs: Date.now() - t0 }
      : { ok: false, provider, status: r.status, detail: 'empty response body', timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, provider, status: null, detail: `network/timeout (${e?.name || 'error'}: ${e?.message || ''})`.trim(), timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
  }
}

// Groq open models (the free-tier Llama models moved to Enterprise / Contact
// Sales, which was the 404). gpt-oss-120b/20b are open and allow 65,536 output.
async function groq70(a)      { return openaiChat({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: MODELS.groq70, provider: 'Groq', timeout: 45000, ...a }); }
async function groq8(a)       { return openaiChat({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: MODELS.groq8, provider: 'Groq', timeout: 45000, ...a }); }
async function grok(a)        { return openaiChat({ url: 'https://api.x.ai/v1/chat/completions', key: process.env.XAI_API_KEY, model: MODELS.grok, provider: 'Grok', timeout: 45000, ...a }); }
async function perplexity(a)  { return openaiChat({ url: 'https://api.perplexity.ai/chat/completions', key: process.env.PERPLEXITY_API_KEY, model: MODELS.perplexity, provider: 'Perplexity', timeout: 45000, ...a }); }

// ── Google Gemini ────────────────────────────────────────────────────────────
async function gemini({ system, messages, maxTokens, timeout }) {
  const budget = timeout || 45000;
  const key = process.env.GOOGLE_AI_KEY;
  if (!key) return { ok: false, provider: 'Gemini', status: null, detail: 'no API key (GOOGLE_AI_KEY not set)', skipped: true, timeoutBudgetMs: budget, durationMs: 0 };
  const model = MODELS.gemini;
  const t0 = Date.now();
  try {
    const body = {
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: textOfContent(m.content) }] })),
      generationConfig: { maxOutputTokens: capFor('Gemini', maxTokens), temperature: 0.3 },
    };
    const sys = sysToString(system);
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(budget) }
    );
    if (!r.ok) return { ok: false, provider: 'Gemini', status: r.status, detail: await errDetail(r), timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    return text
      ? { ok: true, text, provider: 'Gemini', model, timeoutBudgetMs: budget, durationMs: Date.now() - t0 }
      : { ok: false, provider: 'Gemini', status: r.status, detail: 'empty response body', timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, provider: 'Gemini', status: null, detail: `network/timeout (${e?.name || 'error'}: ${e?.message || ''})`.trim(), timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
  }
}

// ── Anthropic Claude (quality tier, prompt caching, multimodal-capable) ──────
async function claude({ system, messages, maxTokens, timeout }) {
  const budget = timeout || 55000;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, provider: 'Claude', status: null, detail: 'no API key (ANTHROPIC_API_KEY not set)', skipped: true, timeoutBudgetMs: budget, durationMs: 0 };
  const t0 = Date.now();
  try {
    const payload = { model: CLAUDE_MODEL, max_tokens: capFor('Claude', maxTokens), messages };
    const sb = buildSystemBlocks(system);
    if (sb) payload.system = sb;
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(budget),
    });
    if (!r.ok) return { ok: false, provider: 'Claude', status: r.status, detail: await errDetail(r), timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
    const d = await r.json();
    const text = (d?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text
      ? { ok: true, text, provider: 'Claude', model: CLAUDE_MODEL, timeoutBudgetMs: budget, durationMs: Date.now() - t0 }
      : { ok: false, provider: 'Claude', status: r.status, detail: 'empty response body', timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, provider: 'Claude', status: null, detail: `network/timeout (${e?.name || 'error'}: ${e?.message || ''})`.trim(), timeoutBudgetMs: budget, durationMs: Date.now() - t0 };
  }
}

// True streaming Claude call — returns the raw upstream Response for SSE
// passthrough (chat.js), or null on network failure. Preserves prompt caching
// and the web_search tool passthrough (Anthropic-only).
export async function streamClaude({ system, messages, maxTokens, tools, timeout }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const payload = { model: CLAUDE_MODEL, max_tokens: maxTokens, messages, stream: true };
  const sb = buildSystemBlocks(system);
  if (sb) payload.system = sb;
  if (Array.isArray(tools) && tools.length) payload.tools = tools;
  try {
    return await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(payload),
      // Streaming means bytes flow as they generate, so a long guide never sits
      // behind a single blocking response — but a generous abort still guards a
      // truly hung connection. Budget sits under the route's maxDuration.
      signal: AbortSignal.timeout(timeout || 290000),
    });
  } catch { return null; }
}

export const CLAUDE = { MODEL: CLAUDE_MODEL };

// ── Registry + job routing ───────────────────────────────────────────────────
export const PROVIDERS = { groq70, groq8, gemini, grok, perplexity, claude };

// Preference order per job — the routing, kept here as data so a re-route is a
// one-line change (and exposed via /api/health so it isn't buried).
//
// The VOLUME jobs (default, fast, web, contrast) lead Groq → Gemini → Claude:
// cost lives in volume, and Groq is ~$0.004/call vs ~$0.10 for Claude.
//
// `reason` (study guides, deep dives, recaps) deliberately leads with Claude,
// then falls to Gemini → groq70 → groq8. It's a few calls a week whose output is
// read more than once; the Claude premium there is a few dollars a year, so
// quality wins. Want it on Groq later? Reorder this one line.
//
// Claude is the FINAL fallback in every chain, never removed. Missing-key
// providers return `skipped` without a network call, so they cost nothing to
// have in the list.
export const JOB_ORDER = {
  fast:     ['groq70', 'groq8', 'gemini', 'claude'],  // routing, classification, extraction
  web:      ['groq70', 'gemini', 'claude'],           // Groq-first per routing policy
  contrast: ['groq70', 'gemini', 'claude'],           // Groq-first per routing policy
  reason:   ['claude', 'gemini', 'groq70', 'groq8'],  // study guides, deep dives, recaps
  default:  ['groq70', 'gemini', 'claude'],           // regular chat
};

export function jobOrder(job) {
  return JOB_ORDER[job] || JOB_ORDER.default;
}

// A one-line, human-readable summary of a failed cascade — provider: status detail.
export function formatAttempts(attempts) {
  if (!attempts || !attempts.length) return 'no providers were attempted';
  return attempts.map((a) => {
    if (a.skipped) return `${a.provider}: skipped (${a.detail})`;
    const code = a.status ? `HTTP ${a.status}` : 'no response';
    return `${a.provider}: ${code}${a.detail ? ` — ${a.detail}` : ''}`;
  }).join('  ·  ');
}

// Non-streaming brain: try providers in job order. On success returns
// { text, provider, model }. On total failure returns { ok:false, attempts, error }
// carrying WHY each provider failed (status + detail) — never a bare null, so the
// reason is logged and shown instead of thrown away. Callers detect success with
// `r && r.text` exactly as before.
export async function callAI({ job = 'default', system, messages, maxTokens = 1024 }) {
  const attempts = [];
  const timeout = timeoutFor(job); // reason-tier gets the long budget, not 15–55s
  for (const key of jobOrder(job)) {
    const fn = PROVIDERS[key];
    if (!fn) continue;
    const r = await fn({ system, messages, maxTokens, timeout });
    if (r && r.text) return r;
    attempts.push(r || { provider: key, status: null, detail: 'unknown failure' });
  }
  return { ok: false, attempts, error: `All AI providers failed — ${formatAttempts(attempts)}` };
}

// ── Key diagnostics (for /api/health and error messages) ─────────────────────
const KEY_MAP = {
  Groq: 'GROQ_API_KEY',
  Gemini: 'GOOGLE_AI_KEY',
  Grok: 'XAI_API_KEY',
  Perplexity: 'PERPLEXITY_API_KEY',
  Claude: 'ANTHROPIC_API_KEY',
};

export function providerKeyStatus() {
  const out = {};
  for (const [name, env] of Object.entries(KEY_MAP)) out[name] = process.env[env] ? 'configured' : 'missing';
  return out;
}

export function configuredProviders() {
  return Object.entries(KEY_MAP).filter(([, env]) => process.env[env]).map(([name]) => name);
}

// One representative provider fn per key name, for live health probes.
const HEALTH_FN = { Groq: groq70, Gemini: gemini, Grok: grok, Perplexity: perplexity, Claude: claude };

function withTimeout(promise, ms, onTimeout) {
  return Promise.race([promise, new Promise((res) => { const t = setTimeout(() => res(onTimeout), ms); t.unref?.(); })]);
}

// Live diagnostics for /api/health: for EACH provider report whether the key is
// present or missing (with the exact env var name, so a misspelled
// GOOGLE_AI_KEY → GEMENI_API_KEY shows up as "missing" against the name it should
// have), and — when present — a minimal real call so a present-but-unfunded or
// invalid key ("configured" but broken) is caught with its HTTP status instead
// of looking healthy.
//
// The probe is deliberately tiny, so it also reports `durationMs` (how long the
// probe took) alongside `reasonTimeoutMs` (the budget a REAL reason-tier call
// gets) and `budgetOkForReason`. A tiny probe passing while real 6000-token work
// times out is the exact bug that hid the last outage — so health now flags any
// provider whose reason-tier budget is below what long generations need.
export async function testAllProviders() {
  const names = Object.keys(KEY_MAP);
  const reasonBudget = timeoutFor('reason');
  const budgetOkForReason = reasonBudget >= REASON_MIN_BUDGET_MS;
  const entries = await Promise.all(names.map(async (name) => {
    const envVar = KEY_MAP[name];
    const base = { envVar, reasonTimeoutMs: reasonBudget, budgetOkForReason };
    if (!process.env[envVar]) return [name, { key: 'missing', test: 'skipped', ...base }];
    const fn = HEALTH_FN[name];
    const r = await withTimeout(
      fn({ system: '', messages: [{ role: 'user', content: 'ping' }], maxTokens: 8, timeout: 10000 }),
      10000,
      { ok: false, status: null, detail: 'health probe timed out (10s)', durationMs: 10000 },
    );
    if (r && r.text) return [name, { key: 'configured', test: 'ok', model: r.model, durationMs: r.durationMs ?? null, ...base }];
    return [name, { key: 'configured', test: 'failed', status: (r && r.status) || null, detail: (r && r.detail) || 'unknown', durationMs: (r && r.durationMs) ?? null, ...base }];
  }));
  return Object.fromEntries(entries);
}
