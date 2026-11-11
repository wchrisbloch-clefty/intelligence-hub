// supabase/functions/weekly-recap — Batch Z / Order E. Scheduled by pg_cron: 0 13 * * 5 (Fri ≈ 8am CT).
//
// Reads the app's state from the SAME public.kv table the app writes through
// /api/storage (one store — the PR #7 class of bug, reading an empty store or
// writing where nothing reads, is structurally impossible), asks Claude for the
// recap, and writes it to kv under `${KEYS.WEEKLY_RECAP}`, which Home's RecapCard reads.
//
// verify_jwt = false (pg_cron can't present a user JWT); the x-cron-secret header,
// checked against Vault, is the gate. Unauthenticated → 401.
// Degrades, never crashes: no ANTHROPIC_API_KEY → 200 { ok:false, needsKey } and
// the previous recap is NOT overwritten.
import { json, kv, readState, requireCron, callClaude } from '../_shared/edge.js';
import { KEYS, SYSTEM_BASE, buildWeeklyPrompt, weeklyContext } from '../_shared/recap-core.js';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json(405, { ok: false, error: 'POST or GET only' });
  const denied = await requireCron(req);
  if (denied) return denied;

  const store = kv();
  try {
    const state = await readState(store, [KEYS.PROJECTS, KEYS.RESEARCH, KEYS.INBOX, KEYS.NOTES]);
    const prompt = buildWeeklyPrompt(weeklyContext(state));
    const r = await callClaude({ system: SYSTEM_BASE, user: prompt, maxTokens: 2200 });
    if (r.needsKey) {
      console.warn('[weekly-recap] degraded: ' + r.needsKey + ' not set — previous recap left in place');
      return json(200, { ok: false, degraded: true, needsKey: r.needsKey, readKeys: Object.keys(state).filter((k) => state[k] != null) });
    }
    const record = {
      type: 'weekly_recap',
      generatedAt: Date.now(),
      generatedAtISO: new Date().toISOString(),
      provider: r.provider,
      model: r.model,
      source: 'supabase-edge',
      content: r.text,
    };
    await store.set(KEYS.WEEKLY_RECAP, JSON.stringify(record));
    return json(200, { ok: true, key: KEYS.WEEKLY_RECAP, generatedAtISO: record.generatedAtISO });
  } catch (e) {
    console.warn('[weekly-recap] failed: ' + (e?.message || e));
    return json(200, { ok: false, degraded: true, error: e?.message || String(e) });
  }
});
