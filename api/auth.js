// api/auth.js — access-code gate.
// POST { code }  → validate against ACCESS_CODE, set signed httpOnly cookie.
// GET            → 200 { authed:true } if the current cookie is valid, else 401.
import { readBody, issueAuthToken, authCookieHeader, isAuthed } from './_lib.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (isAuthed(req)) return res.status(200).json({ authed: true });
    return res.status(401).json({ authed: false });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const configured = process.env.ACCESS_CODE;
  if (!configured) {
    return res.status(500).json({ error: 'ACCESS_CODE not configured on the server.' });
  }

  let body;
  try { body = await readBody(req); } catch { return res.status(400).json({ error: 'Bad request' }); }

  const code = String(body?.code ?? '');
  if (!code || code !== configured) {
    return res.status(401).json({ error: 'Incorrect access code', code: 'bad_code' });
  }

  res.setHeader('Set-Cookie', authCookieHeader(issueAuthToken()));
  return res.status(200).json({ authed: true });
}
