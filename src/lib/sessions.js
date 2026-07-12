// Saved / resumable chat sessions.
//   session:{module}:{id}  → { id, module, title, messages[], createdAt, updatedAt }
//   sessions:{module}      → [ { id, title, createdAt, updatedAt } ]  (index, recent first)
// Backed by lib/storage.js so sessions follow CB across devices.
import { storage, readLocal, writeThrough, hydrate } from './storage.js';

const idxKey = (module) => `sessions:${module}`;
const sesKey = (module, id) => `session:${module}:${id}`;

// Derive a short session title from the first user message.
export function autoTitle(text = '') {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return 'New session';
  return clean.length > 48 ? clean.slice(0, 48).trimEnd() + '…' : clean;
}

// ── Index (list of session metas) ──────────────────────────────────────────
export function loadIndex(module) { return readLocal(idxKey(module), []); }
export async function hydrateIndex(module) {
  const r = await hydrate(idxKey(module));
  return Array.isArray(r) ? r : undefined;
}

// ── Full sessions ──────────────────────────────────────────────────────────
export function loadSession(module, id) { return readLocal(sesKey(module, id), null); }
export async function hydrateSession(module, id) {
  const r = await hydrate(sesKey(module, id));
  return r || undefined;
}

// Attachments carry large base64 payloads; keep only display metadata in the
// stored transcript so a saved session stays small.
function lightenMessages(messages = []) {
  return messages.map(m => {
    if (!m.attachments?.length) return { role: m.role, content: m.content };
    return {
      role: m.role,
      content: m.content,
      attachments: m.attachments.map(a => ({ name: a.name, label: a.label, icon: a.icon, isImage: a.isImage, type: a.type })),
    };
  });
}

export function saveSession(session) {
  const { module, id } = session;
  const record = { ...session, messages: lightenMessages(session.messages) };
  writeThrough(sesKey(module, id), record);
  const meta = { id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt };
  const next = [meta, ...loadIndex(module).filter(s => s.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt);
  writeThrough(idxKey(module), next);
  return next;
}

export function removeSession(module, id) {
  storage.delete(sesKey(module, id)); // clears local + server
  const next = loadIndex(module).filter(s => s.id !== id);
  writeThrough(idxKey(module), next);
  return next;
}

export function renameSession(module, id, title) {
  const now = Date.now();
  const full = loadSession(module, id);
  if (full) writeThrough(sesKey(module, id), { ...full, title, updatedAt: now });
  const next = loadIndex(module).map(s => s.id === id ? { ...s, title, updatedAt: now } : s);
  writeThrough(idxKey(module), next);
  return next;
}
