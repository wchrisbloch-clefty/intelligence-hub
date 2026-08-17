// api/export.js — token-gated, read-only, agent-readable snapshot of the hub.
// A plain JSON dump of the knowledge graph, projects, skills, and latest recaps
// so an external agent can read state without speaking MCP. Same MCP_TOKEN gate,
// same fail-closed behavior, and it never returns secrets.
//
//   GET /api/export            (Authorization: Bearer <MCP_TOKEN>)
//   GET /api/export?token=...  (for clients that can't set headers)
import { requireMcpToken, exportState } from './_mcp.js';
import { storageConfigured } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!requireMcpToken(req, res)) return;
  if (!storageConfigured()) return res.status(503).json({ error: 'Storage is not configured.' });
  try {
    const state = await exportState();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(state);
  } catch (e) {
    return res.status(500).json({ error: `Export failed: ${e.message}` });
  }
}
