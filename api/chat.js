// api/chat.js — Anthropic Messages proxy (streaming SSE passthrough).
// The ANTHROPIC_API_KEY lives only here, server-side. Client never sees it.
//
// Accepts: { system, messages, tools?, max_tokens?, stream? }
//   - system: string | { cached, dynamic } | falsy
//   - messages: Anthropic message array
//   - tools: passed through (web_search_20250305 supported)
//   - max_tokens: default 4096
//   - stream: default true → SSE passthrough; false → single JSON { text }
import { readBody, requireAuth } from './_lib.js';

const MODEL = 'claude-sonnet-4-6';

// Allow long streamed completions without the default 10s cutoff.
export const config = { maxDuration: 60 };

function buildSystemBlocks(system) {
  if (!system || (typeof system === 'string' && !system.trim())) return undefined;
  if (typeof system === 'string') {
    return [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  }
  // { cached, dynamic }
  return [
    { type: 'text', text: system.cached, cache_control: { type: 'ephemeral' } },
    ...(system.dynamic ? [{ type: 'text', text: system.dynamic }] : []),
  ];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!requireAuth(req, res)) return;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'AI not configured — set ANTHROPIC_API_KEY.', code: 'no_key' });
  }

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ error: 'Bad request' }); }

  const { system, messages, tools, max_tokens = 4096, stream = true } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const payload = { model: MODEL, max_tokens, messages, stream: !!stream };
  const systemBlocks = buildSystemBlocks(system);
  if (systemBlocks) payload.system = systemBlocks;
  if (Array.isArray(tools) && tools.length) payload.tools = tools;

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return res.status(502).json({ error: 'AI request failed — retry', code: 'upstream', detail: e.message });
  }

  // Error from Anthropic — surface a clean, retryable message.
  if (!upstream.ok) {
    let detail = '';
    try { detail = (await upstream.json())?.error?.message || ''; } catch {}
    return res.status(upstream.status === 429 ? 429 : 502).json({
      error: upstream.status === 429 ? 'AI is rate-limited — retry shortly' : 'AI request failed — retry',
      code: 'upstream',
      detail,
    });
  }

  // ── Non-streaming: collect and return plain text ──
  if (!stream) {
    try {
      const data = await upstream.json();
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return res.status(200).json({ text: text || 'No response.' });
    } catch (e) {
      return res.status(502).json({ error: 'AI request failed — retry', code: 'parse', detail: e.message });
    }
  }

  // ── Streaming: pass the SSE stream straight through ──
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value); // value is a Uint8Array chunk of raw SSE
    }
  } catch {
    // client disconnected or upstream aborted — nothing to recover
  } finally {
    res.end();
  }
}
