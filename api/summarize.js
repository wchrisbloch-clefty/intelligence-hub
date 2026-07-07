// /api/summarize.js — v3
// Multi-provider AI summary: Groq (free) → Gemini (free) → Claude (paid).
// Tries each in order; first success wins. All keys are optional — if a key
// is missing, that provider is skipped silently.
//
// Env vars (add in Vercel → Settings → Environment Variables):
//   GROQ_API_KEY      — free, get from console.groq.com (no credit card)
//   GOOGLE_AI_KEY     — free, get from aistudio.google.com (no credit card)
//   ANTHROPIC_API_KEY — paid, get from console.anthropic.com ($5 minimum)

const MAX_INPUT = 3000;
const TOKENS = { summary: 250, takeaways: 600, briefing: 400 };

// ── Body parser (Vercel doesn't auto-parse for plain serverless fns) ────
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !req.body.on) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => { d += c; });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// ── Build the prompt ────────────────────────────────────────────────────
function buildPrompt(type, title, content, mode) {
  const verb = type === 'podcast' ? 'podcast episode' : 'news article';
  if (mode === 'briefing') {
    return `You are a sharp morning news briefing writer. Given headlines from multiple news categories, write ONE punchy sentence per category summarizing the single most important story. Be direct, specific, include names and numbers. No filler.\n\nFormat each line as:\nCategory: One sentence summary\n\n${content}`;
  }
  if (mode === 'takeaways') {
    return `Analyze this ${verb} and extract 3-5 key takeaways. For each takeaway, write a bold short headline followed by a one-sentence explanation. Be specific and factual — include names, numbers, and concrete details. Skip generic observations.\n\nFormat each as:\n**1. [Headline]** — [Explanation]\n**2. [Headline]** — [Explanation]\n(etc.)\n\nTitle: ${title}\n\nContent: ${content}`;
  }
  return `Summarize this ${verb} in 2-3 concise sentences. Be direct and factual. Skip filler like "this article discusses" — start with the actual content.\n\nTitle: ${title}\n\nContent: ${content}`;
}

// ── Provider 1: Groq (Llama 3.3 70B, free, ~700 tok/s) ─────────────────
async function tryGroq(prompt, maxTokens) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch { return null; }
}

// ── Provider 2: Google Gemini (free 500 req/day) ────────────────────────
async function tryGemini(prompt, maxTokens) {
  const key = process.env.GOOGLE_AI_KEY;
  if (!key) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch { return null; }
}

// ── Provider 3: Anthropic Claude (paid, highest quality) ────────────────
async function tryClaude(prompt, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const text = d?.content?.[0]?.text?.trim();
    return text || null;
  } catch { return null; }
}

// ── Handler ─────────────────────────────────────────────────────────────
import { requireAuth } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ error: 'Bad body' }); }

  const { type = 'article', title = '', content = '', mode = 'summary' } = body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title required' });
  }

  const validModes = ['summary', 'takeaways'];
  const m = validModes.includes(mode) ? mode : 'summary';
  const maxTokens = TOKENS[m] || 250;
  const prompt = buildPrompt(type, String(title).slice(0, 500), String(content).slice(0, MAX_INPUT), m);

  // Try providers in order: Groq (free) → Gemini (free) → Claude (paid)
  const providers = [
    { name: 'Groq',    fn: tryGroq },
    { name: 'Gemini',  fn: tryGemini },
    { name: 'Claude',  fn: tryClaude },
  ];

  for (const p of providers) {
    const result = await p.fn(prompt, maxTokens);
    if (result) {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).json({ summary: result, provider: p.name });
    }
  }

  // All three failed
  const configured = [];
  if (process.env.GROQ_API_KEY) configured.push('Groq');
  if (process.env.GOOGLE_AI_KEY) configured.push('Gemini');
  if (process.env.ANTHROPIC_API_KEY) configured.push('Claude');

  if (configured.length === 0) {
    return res.status(500).json({
      error: 'No AI provider configured. Add GROQ_API_KEY (free) in Vercel → Settings → Environment Variables, then redeploy.',
    });
  }

  return res.status(502).json({
    error: `All providers failed (tried: ${configured.join(', ')}). Try again in a moment.`,
  });
}
