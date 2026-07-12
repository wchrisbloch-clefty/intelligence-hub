// Deep Dives — persistent, resumable research files. Modeled on the Phase 2
// ladder spine (index + per-object records via lib/storage.js, cross-device).
//   deepdive:{id} = { id, topic, category, depth, sections[], sources[], createdAt, updatedAt, progress }
//   each section  = { id, title, kind, content, sources[], createdAt }
//   deepdives     = [ { id, topic, category, depth, progress, createdAt, updatedAt } ]  (index)
import { readLocal, writeThrough, hydrate, storage } from './storage.js';
import { uid } from '../utils.js';

const IDX = 'deepdives';
const key = (id) => `deepdive:${id}`;

export function newDive({ topic, category = '', depth = 'expert' }) {
  return { id: uid(), topic, category, depth, sections: [], sources: [], createdAt: Date.now(), updatedAt: Date.now(), progress: 0 };
}

function mergeSources(a = [], b = []) {
  const seen = new Set(a.map(s => s.toLowerCase()));
  const out = [...a];
  for (const s of b) { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(s); } }
  return out.slice(0, 40);
}

export function loadIndex() { return readLocal(IDX, []); }
export async function hydrateIndex() { const r = await hydrate(IDX); return Array.isArray(r) ? r : undefined; }
export function loadDive(id) { return readLocal(key(id), null); }
export async function hydrateDive(id) { const r = await hydrate(key(id)); return r || undefined; }

export function saveDive(dive) {
  const d = { ...dive, progress: dive.sections.length, updatedAt: Date.now() };
  writeThrough(key(d.id), d);
  const meta = { id: d.id, topic: d.topic, category: d.category, depth: d.depth, progress: d.progress, createdAt: d.createdAt, updatedAt: d.updatedAt };
  const next = [meta, ...loadIndex().filter(s => s.id !== d.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  writeThrough(IDX, next);
  return d;
}

export function addSection(dive, section) {
  return saveDive({ ...dive, sections: [...dive.sections, section], sources: mergeSources(dive.sources, section.sources || []) });
}

export function removeDive(id) {
  storage.delete(key(id));
  const next = loadIndex().filter(s => s.id !== id);
  writeThrough(IDX, next);
  return next;
}

export function renameDive(id, topic) {
  const d = loadDive(id);
  if (d) saveDive({ ...d, topic });
  return loadIndex();
}
