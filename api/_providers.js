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
const CLAUDE_MODEL  = 'claude-sonnet-4-6';

// Per-provider output-token ceiling. A request may ask for maxTokens: 6000, but
// a provider whose tier/model caps output lower will 400/413 the whole request —
// so we clamp per provider instead. A shorter answer beats no answer. (Groq's
// free tier is the tight one; Claude/Gemini get real headroom.)
const OUTPUT_CAP = { Groq: 4096, Gemini: 8192, Grok: 8192, Perplexity: 4096, Claude: 64000 };
const capFor = (provider, maxTokens) => Math.min(maxTokens || 1024, OUTPUT_CAP[provider] ?? 4096);

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
  if (!key) return { ok: false, provider, status: null, detail: `no API key (${KEY_MAP[provider] || 'env var'} not set)`, skipped: true };
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
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) return { ok: false, provider, status: r.status, detail: await errDetail(r) };
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    return text ? { ok: true, text, provider, model } : { ok: false, provider, status: r.status, detail: 'empty response body' };
  } catch (e) {
    return { ok: false, provider, status: null, detail: `network/timeout (${e?.name || 'error'}: ${e?.message || ''})`.trim() };
  }
}

async function groq70(a)      { return openaiChat({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile', provider: 'Groq', timeout: 15000, ...a }); }
async function groq8(a)       { return openaiChat({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.1-8b-instant', provider: 'Groq', timeout: 12000, ...a }); }
async function grok(a)        { return openaiChat({ url: 'https://api.x.ai/v1/chat/completions', key: process.env.XAI_API_KEY, model: 'grok-3-mini', provider: 'Grok', timeout: 20000, ...a }); }
async function perplexity(a)  { return openaiChat({ url: 'https://api.perplexity.ai/chat/completions', key: process.env.PERPLEXITY_API_KEY, model: 'sonar', provider: 'Perplexity', timeout: 22000, ...a }); }

// ── Google Gemini ────────────────────────────────────────────────────────────
async function gemini({ system, messages, maxTokens }) {
  const key = process.env.GOOGLE_AI_KEY;
  if (!key) return { ok: false, provider: 'Gemini', status: null, detail: 'no API key (GOOGLE_AI_KEY not set)', skipped: true };
  const model = 'gemini-2.5-flash';
  try {
    const body = {
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: textOfContent(m.content) }] })),
      generationConfig: { maxOutputTokens: capFor('Gemini', maxTokens), temperature: 0.3 },
    };
    const sys = sysToString(system);
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) }
    );
    if (!r.ok) return { ok: false, provider: 'Gemini', status: r.status, detail: await errDetail(r) };
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    return text ? { ok: true, text, provider: 'Gemini', model } : { ok: false, provider: 'Gemini', status: r.status, detail: 'empty response body' };
  } catch (e) {
    return { ok: false, provider: 'Gemini', status: null, detail: `network/timeout (${e?.name || 'error'}: ${e?.message || ''})`.trim() };
  }
}

// ── Anthropic Claude (quality tier, prompt caching, multimodal-capable) ──────
async function claude({ system, messages, maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, provider: 'Claude', status: null, detail: 'no API key (ANTHROPIC_API_KEY not set)', skipped: true };
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
      signal: AbortSignal.timeout(55000),
    });
    if (!r.ok) return { ok: false, provider: 'Claude', status: r.status, detail: await errDetail(r) };
    const d = await r.json();
    const text = (d?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text ? { ok: true, text, provider: 'Claude', model: CLAUDE_MODEL } : { ok: false, provider: 'Claude', status: r.status, detail: 'empty response body' };
  } catch (e) {
    return { ok: false, provider: 'Claude', status: null, detail: `network/timeout (${e?.name || 'error'}: ${e?.message || ''})`.trim() };
  }
}

// True streaming Claude call — returns the raw upstream Response for SSE
// passthrough (chat.js), or null on network failure. Preserves prompt caching
// and the web_search tool passthrough (Anthropic-only).
export async function streamClaude({ system, messages, maxTokens, tools }) {
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
    });
  } catch { return null; }
}

export const CLAUDE = { MODEL: CLAUDE_MODEL };

// ── Registry + job routing ───────────────────────────────────────────────────
export const PROVIDERS = { groq70, groq8, gemini, grok, perplexity, claude };

// Preference order per job. Each still ends in a strong fallback so no job has a
// single point of failure. `reason` leads with Claude (best guides when funded)
// but MUST reach a working provider when it isn't — so it now ends in groq70 →
// groq8 (the 8B model has the most generous free-tier limits), giving the chain
// a reachable last resort instead of dying on a single unavailable provider.
export const JOB_ORDER = {
  fast:     ['groq70', 'groq8', 'gemini', 'claude'],           // routing, classification, extraction
  web:      ['perplexity', 'grok', 'gemini', 'claude'],        // needs current facts
  contrast: ['grok', 'perplexity', 'gemini', 'claude'],        // sentiment, contrarian read
  reason:   ['claude', 'gemini', 'groq70', 'groq8'],           // study guides, deep dives, recaps
  default:  ['groq70', 'gemini', 'claude'],
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
  for (const key of jobOrder(job)) {
    const fn = PROVIDERS[key];
    if (!fn) continue;
    const r = await fn({ system, messages, maxTokens });
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
export async function testAllProviders() {
  const names = Object.keys(KEY_MAP);
  const entries = await Promise.all(names.map(async (name) => {
    const envVar = KEY_MAP[name];
    if (!process.env[envVar]) return [name, { key: 'missing', envVar, test: 'skipped' }];
    const fn = HEALTH_FN[name];
    const r = await withTimeout(
      fn({ system: '', messages: [{ role: 'user', content: 'ping' }], maxTokens: 8 }),
      8000,
      { ok: false, status: null, detail: 'health probe timed out (8s)' },
    );
    if (r && r.text) return [name, { key: 'configured', envVar, test: 'ok', model: r.model }];
    return [name, { key: 'configured', envVar, test: 'failed', status: (r && r.status) || null, detail: (r && r.detail) || 'unknown' }];
  }));
  return Object.fromEntries(entries);
}
