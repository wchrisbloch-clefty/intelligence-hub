// api/chat.js — AI proxy with multi-provider cascade + streaming.
// API keys live only here, server-side. The client never sees them.
//
// Accepts: { system, messages, tools?, max_tokens?, stream?, job? }
//   - system: string | { cached, dynamic } | falsy
//   - messages: Anthropic message array (multimodal supported on Claude)
//   - tools: passed through (web_search_20250305). Anthropic-only — when tools
//     are requested we use Claude directly and skip the cascade.
//   - max_tokens: default 4096
//   - stream: default true → SSE passthrough; false → single JSON { text, provider, model }
//   - job: routing hint (fast|web|contrast|reason|default) → provider preference order
//
// The winning provider is always reported: `provider` in the JSON response, and
// a final `{ type:'provider', provider, model }` SSE event when streaming.
import { readBody, requireAuth } from './_lib.js';
import { jobOrder, PROVIDERS, streamClaude, configuredProviders, formatAttempts, timeoutFor, CLAUDE } from './_providers.js';

// reason-tier generations (study guides at 6000 tokens) run for tens of seconds
// to minutes, so this route needs the same headroom as the recap routes (300s),
// not the old 60s that aborted long guides mid-generation.
export const config = { maxDuration: 300 };

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function writeEvent(res, obj) { res.write(`data: ${JSON.stringify(obj)}\n\n`); }

// Emit a non-streaming provider's text over the SSE contract the client already
// parses (content_block_delta + a final provider event), so a provider that
// can't stream still works instead of failing.
function fakeStream(res, { text, provider, model }) {
  sseHeaders(res);
  writeEvent(res, { type: 'content_block_delta', delta: { type: 'text_delta', text } });
  writeEvent(res, { type: 'provider', provider, model });
  res.write('data: [DONE]\n\n');
  res.end();
}

async function passthroughClaude(res, upstream) {
  sseHeaders(res);
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch { /* client disconnected / upstream aborted */ }
  writeEvent(res, { type: 'provider', provider: 'Claude', model: CLAUDE.MODEL });
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireAuth(req, res)) return;

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ error: 'Bad request' }); }

  const { system, messages, tools, max_tokens = 4096, stream = true, job = 'default' } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const hasTools = Array.isArray(tools) && tools.length > 0;
  const timeout = timeoutFor(job); // reason-tier gets the long budget, not 15–55s

  // ── Tools (web_search) → Anthropic-only, no cascade ───────────────────────
  if (hasTools) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Web search needs Claude — set ANTHROPIC_API_KEY.', code: 'no_key' });
    }
    const upstream = await streamClaude({ system, messages, maxTokens: max_tokens, tools, timeout });
    if (!upstream || !upstream.ok) {
      let detail = '';
      try { detail = (await upstream?.json())?.error?.message || ''; } catch {}
      return res.status(502).json({ error: 'AI request failed — retry', code: 'upstream', detail });
    }
    return passthroughClaude(res, upstream);
  }

  // ── Streaming cascade ─────────────────────────────────────────────────────
  // Every attempt (success or failure) is recorded so a total failure reports
  // which providers were tried and exactly why each one failed.
  if (stream) {
    const attempts = [];
    for (const key of jobOrder(job)) {
      if (key === 'claude') {
        const upstream = await streamClaude({ system, messages, maxTokens: max_tokens, timeout });
        if (upstream && upstream.ok) return passthroughClaude(res, upstream);
        if (!process.env.ANTHROPIC_API_KEY) {
          attempts.push({ provider: 'Claude', status: null, detail: 'no API key (ANTHROPIC_API_KEY not set)', skipped: true });
        } else if (upstream) {
          let detail = ''; try { detail = (await upstream.json())?.error?.message || ''; } catch {}
          attempts.push({ provider: 'Claude', status: upstream.status, detail: detail || 'request failed' });
        } else {
          attempts.push({ provider: 'Claude', status: null, detail: 'network/timeout' });
        }
        continue; // Claude down → fall through to the next provider
      }
      const fn = PROVIDERS[key];
      if (!fn) continue;
      const r = await fn({ system, messages, maxTokens: max_tokens, timeout }); // non-streaming
      if (r && r.text) return fakeStream(res, r);                                // fake-stream it
      attempts.push(r || { provider: key, status: null, detail: 'unknown failure' });
    }
    // Nothing answered — headers not sent yet, safe to return JSON.
    logCascadeFailure(job, attempts);
    return res.status(providerErrorStatus(attempts)).json(providerErrorBody(attempts));
  }

  // ── Non-streaming cascade ─────────────────────────────────────────────────
  const attempts = [];
  for (const key of jobOrder(job)) {
    const fn = PROVIDERS[key];
    if (!fn) continue;
    const r = await fn({ system, messages, maxTokens: max_tokens, timeout });
    if (r && r.text) return res.status(200).json({ text: r.text, provider: r.provider, model: r.model });
    attempts.push(r || { provider: key, status: null, detail: 'unknown failure' });
  }
  logCascadeFailure(job, attempts);
  return res.status(providerErrorStatus(attempts)).json(providerErrorBody(attempts));
}

function logCascadeFailure(job, attempts) {
  // Server-side, structured, so production logs show the real cause — not a bare 502.
  console.error(`[chat] all providers failed (job=${job}): ${formatAttempts(attempts)}`);
}

function providerErrorStatus(attempts) {
  // 500 only when nothing was actually reachable (every attempt skipped for a
  // missing key). If real providers were tried and rejected, it's a 502.
  const allSkipped = attempts.length > 0 && attempts.every((a) => a.skipped);
  return (configuredProviders().length === 0 || allSkipped) ? 500 : 502;
}
function providerErrorBody(attempts) {
  if (configuredProviders().length === 0) {
    return { error: 'No AI provider configured. Add GROQ_API_KEY (free) in Vercel → Settings → Environment Variables, then redeploy.', code: 'no_key', attempts };
  }
  return { error: `AI request failed. ${formatAttempts(attempts)}`, code: 'upstream', attempts };
}
