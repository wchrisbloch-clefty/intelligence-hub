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
//   ({ system, messages, maxTokens }) → { text, provider, model } | null
// Returning null (not throwing) lets the cascade fall through to the next one.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL  = 'claude-sonnet-4-6';

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
  if (!key) return null;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: toOpenAIMessages(system, messages),
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    return text ? { text, provider, model } : null;
  } catch { return null; }
}

async function groq70(a)      { return openaiChat({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile', provider: 'Groq', timeout: 15000, ...a }); }
async function groq8(a)       { return openaiChat({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.1-8b-instant', provider: 'Groq', timeout: 12000, ...a }); }
async function grok(a)        { return openaiChat({ url: 'https://api.x.ai/v1/chat/completions', key: process.env.XAI_API_KEY, model: 'grok-3-mini', provider: 'Grok', timeout: 20000, ...a }); }
async function perplexity(a)  { return openaiChat({ url: 'https://api.perplexity.ai/chat/completions', key: process.env.PERPLEXITY_API_KEY, model: 'sonar', provider: 'Perplexity', timeout: 22000, ...a }); }

// ── Google Gemini ────────────────────────────────────────────────────────────
async function gemini({ system, messages, maxTokens }) {
  const key = process.env.GOOGLE_AI_KEY;
  if (!key) return null;
  const model = 'gemini-2.5-flash';
  try {
    const body = {
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: textOfContent(m.content) }] })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
    };
    const sys = sysToString(system);
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    return text ? { text, provider: 'Gemini', model } : null;
  } catch { return null; }
}

// ── Anthropic Claude (quality tier, prompt caching, multimodal-capable) ──────
async function claude({ system, messages, maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const payload = { model: CLAUDE_MODEL, max_tokens: maxTokens, messages };
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
    if (!r.ok) return null;
    const d = await r.json();
    const text = (d?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text ? { text, provider: 'Claude', model: CLAUDE_MODEL } : null;
  } catch { return null; }
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
// single point of failure.
export const JOB_ORDER = {
  fast:     ['groq70', 'groq8', 'gemini', 'claude'],     // routing, classification, extraction
  web:      ['perplexity', 'grok', 'gemini', 'claude'],  // needs current facts
  contrast: ['grok', 'perplexity', 'gemini', 'claude'],  // sentiment, contrarian read
  reason:   ['claude', 'gemini', 'groq70'],              // study guides, deep dives, recaps
  default:  ['groq70', 'gemini', 'claude'],
};

export function jobOrder(job) {
  return JOB_ORDER[job] || JOB_ORDER.default;
}

// Non-streaming brain: try providers in job order, return the first that
// answers ({ text, provider, model }), or null if the whole chain fails.
export async function callAI({ job = 'default', system, messages, maxTokens = 1024 }) {
  for (const key of jobOrder(job)) {
    const fn = PROVIDERS[key];
    if (!fn) continue;
    const r = await fn({ system, messages, maxTokens });
    if (r && r.text) return r;
  }
  return null;
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
