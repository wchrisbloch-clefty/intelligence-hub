// api/storage.js — persistence backed by Upstash Redis.
// Mirrors the client storage API exactly:
//   GET    /api/storage?key=K            → { value }        (get)
//   GET    /api/storage?prefix=P&list=1  → { keys: [...] }  (list)
//   POST   /api/storage  { key, value }  → { ok:true }      (set)
//   DELETE /api/storage?key=K            → { ok:true }      (delete)
import { readBody, requireAuth, store, storageConfigured } from './_lib.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (!storageConfigured()) {
    return res.status(503).json({ error: 'Storage not configured', code: 'no_storage' });
  }

  try {
    if (req.method === 'GET') {
      if (req.query.list !== undefined || req.query.prefix !== undefined) {
        const keys = await store.list(String(req.query.prefix || ''));
        return res.status(200).json({ keys });
      }
      const key = String(req.query.key || '');
      if (!key) return res.status(400).json({ error: 'key required' });
      const value = await store.get(key);
      return res.status(200).json({ value });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const key = body?.key;
      if (!key) return res.status(400).json({ error: 'key required' });
      // value is stored verbatim (client already JSON-stringifies)
      await store.set(key, typeof body.value === 'string' ? body.value : JSON.stringify(body.value));
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const key = String(req.query.key || '');
      if (!key) return res.status(400).json({ error: 'key required' });
      await store.del(key);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'Storage request failed', detail: e.message });
  }
}
