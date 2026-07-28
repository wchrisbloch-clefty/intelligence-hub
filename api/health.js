// api/health.js — quick diagnostics. Auth-gated like every other route.
// → { ok, storage, ai, providers:{Groq,Gemini,Grok,Perplexity,Claude}, accessCode }
// `providers` makes a missing key visible up front rather than discovered
// through a silent fallback.
import { requireAuth, store, storageConfigured } from './_lib.js';
import { providerKeyStatus } from './_providers.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const storage = storageConfigured() ? await store.ping() : 'not_configured';
  const providers = providerKeyStatus();
  return res.status(200).json({
    ok: true,
    storage,
    ai: providers.Claude, // back-compat: Anthropic key status
    providers,
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'missing',
    time: new Date().toISOString(),
  });
}
