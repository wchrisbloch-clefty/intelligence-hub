// api/mcp.js — the Model Context Protocol endpoint (Streamable HTTP transport).
// Same protocol the Vercel and Supabase connectors use, so Claude.ai can connect
// to this URL and read/write the hub. Speaks JSON-RPC 2.0 over POST.
//
// Connect from Claude.ai → Settings → Connectors → Add custom connector:
//   URL:   https://<your-deployment>/api/mcp
//   Token: the MCP_TOKEN you set in Vercel (Bearer auth)
//
// Token-gated and fails closed (see requireMcpToken). Never exposes secrets.
import { readBody, storageConfigured } from './_lib.js';
import { requireMcpToken, TOOLS, callTool, exportState } from './_mcp.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'intelligence-hub', version: '1.0.0' };

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

export default async function handler(req, res) {
  // /api/export rewrites here (Hobby plans cap Serverless Functions at 12, so
  // the read-only snapshot rides on this same function). Token-gated, GET-only,
  // never returns secrets.
  let isExport = false;
  try { isExport = new URL(req.url, 'http://x').searchParams.get('__export') === '1'; } catch {}
  if (isExport) {
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    if (!requireMcpToken(req, res)) return;
    if (!storageConfigured()) return res.status(503).json({ error: 'Storage is not configured.' });
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(await exportState());
    } catch (e) {
      return res.status(500).json({ error: `Export failed: ${e.message}` });
    }
  }

  // A GET is a friendly liveness probe (still token-gated) so a browser check
  // doesn't look broken; real traffic is POST JSON-RPC.
  if (req.method === 'GET') {
    if (!requireMcpToken(req, res)) return;
    return res.status(200).json({ ok: true, server: SERVER_INFO, transport: 'streamable-http', tools: TOOLS.map((t) => t.name) });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!requireMcpToken(req, res)) return;

  const body = await readBody(req);
  const { id = null, method, params = {} } = body || {};

  try {
    switch (method) {
      case 'initialize':
        return res.status(200).json(rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        }));

      case 'notifications/initialized':
      case 'notifications/cancelled':
        return res.status(202).end();

      case 'ping':
        return res.status(200).json(rpcResult(id, {}));

      case 'tools/list':
        return res.status(200).json(rpcResult(id, {
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        }));

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        try {
          const result = await callTool(name, args);
          return res.status(200).json(rpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: result && result.ok === false,
          }));
        } catch (e) {
          // Tool-level failure is reported inside the result, not as a protocol error.
          return res.status(200).json(rpcResult(id, {
            content: [{ type: 'text', text: `Error: ${e.message}` }],
            isError: true,
          }));
        }
      }

      default:
        return res.status(200).json(rpcError(id, -32601, `Method not found: ${method}`));
    }
  } catch (e) {
    return res.status(200).json(rpcError(id, -32603, `Internal error: ${e.message}`));
  }
}
