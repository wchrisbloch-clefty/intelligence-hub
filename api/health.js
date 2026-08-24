// api/health.js — quick diagnostics. Auth-gated like every other route.
// → { ok, storage, ai, providers:{ Groq:{key,envVar,test,status,detail}, … },
//     accessCode }
// Each provider reports its exact env var name plus a LIVE minimal test call, so
// three failure modes are all visible in one look:
//   key 'missing'                 → env var absent (or MISSPELLED — the name it
//                                    should have is shown, e.g. GOOGLE_AI_KEY)
//   key 'configured', test 'ok'   → reachable and answering
//   key 'configured', test 'failed', status 401/402/429 → present but broken
//                                    (unfunded / invalid / rate-limited)
// Pass ?deep=0 to skip the live calls and report key presence only (fast).
import { requireAuth, store, storageConfigured } from './_lib.js';
import { providerKeyStatus, testAllProviders } from './_providers.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  let deep = true;
  try { deep = new URL(req.url, 'http://x').searchParams.get('deep') !== '0'; } catch {}

  const storage = storageConfigured() ? await store.ping() : 'not_configured';
  const providers = deep ? await testAllProviders() : providerKeyStatus();
  const claude = providers.Claude;
  return res.status(200).json({
    ok: true,
    storage,
    // back-compat: a string summary of Claude's status
    ai: typeof claude === 'string' ? claude : `${claude?.key || 'unknown'}${claude?.test ? `/${claude.test}` : ''}${claude?.status ? ` (${claude.status})` : ''}`,
    providers,
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'missing',
    time: new Date().toISOString(),
  });
}
