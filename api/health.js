// api/health.js — quick diagnostics. Auth-gated like every other route.
// → { ok:true, storage:<ping>, ai:<configured?>, accessCode:<configured?> }
import { requireAuth, store, storageConfigured } from './_lib.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const storage = storageConfigured() ? await store.ping() : 'not_configured';
  return res.status(200).json({
    ok: true,
    storage,
    ai: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
    accessCode: process.env.ACCESS_CODE ? 'configured' : 'missing',
    time: new Date().toISOString(),
  });
}
