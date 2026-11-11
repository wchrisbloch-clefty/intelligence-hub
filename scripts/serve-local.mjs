#!/usr/bin/env node
// scripts/serve-local.mjs — serves the built SPA (dist/) with a STUBBED /api so
// the app can be driven headlessly (screenshots, `npm run audit:responsive`)
// without Vercel, an access code, or any credentials.
//
//   /api/auth     → 200 { authed:true }        (stub — never used in production)
//   /api/storage  → in-memory key/value, same contract as api/storage.js
//   /api/*        → 200 { degraded:true }      (AI / feeds are not exercised here)
//
// NOT a production server. It exists so the layout can be verified at real
// widths with the real bundle. Usage: node scripts/serve-local.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2] || process.env.PORT || 4180);
const ROOT = path.resolve('dist');
const kv = new Map();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function json(res, code, body) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
function readBody(req) { return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); }); }

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/auth') return json(res, 200, { authed: true });
  if (u.pathname === '/api/storage') {
    if (req.method === 'GET') {
      if (u.searchParams.has('list') || u.searchParams.has('prefix')) {
        const p = u.searchParams.get('prefix') || '';
        return json(res, 200, { keys: [...kv.keys()].filter(k => k.startsWith(p)) });
      }
      return json(res, 200, { value: kv.get(u.searchParams.get('key')) ?? null });
    }
    if (req.method === 'POST') { const b = await readBody(req); kv.set(b.key, typeof b.value === 'string' ? b.value : JSON.stringify(b.value)); return json(res, 200, { ok: true }); }
    if (req.method === 'DELETE') { kv.delete(u.searchParams.get('key')); return json(res, 200, { ok: true }); }
  }
  if (u.pathname.startsWith('/api/')) return json(res, 200, { degraded: true, note: 'serve-local stub' });
  let f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`serve-local: http://localhost:${PORT}`));
