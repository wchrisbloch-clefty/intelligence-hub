// Learning Ladders — first-class objects, not chat output.
//   ladder:{id} = { id, topic, goal, modules[], createdAt, progress }
//   each module  = { id, title, objectives[], status, prereqIds[], quizId?, sessionId? }
//   ladders      = [ { id, topic, goal, createdAt, progress } ]  (index, recent first)
// The app owns the object; /api/chat only generates the initial structure.
import { readLocal, writeThrough, hydrate, storage } from './storage.js';
import { uid } from '../utils.js';
import { stampVersion } from './promptVersion.js';

const IDX = 'ladders';
const key = (id) => `ladder:${id}`;

// A module unlocks when every prereq is done; done stays done; else locked.
export function recompute(ladder) {
  const doneIds = new Set(ladder.modules.filter(m => m.status === 'done').map(m => m.id));
  const modules = ladder.modules.map(m => {
    if (m.status === 'done') return m;
    const unlocked = (m.prereqIds || []).every(pid => doneIds.has(pid));
    return { ...m, status: unlocked ? 'active' : 'locked' };
  });
  const progress = modules.length ? Math.round((doneIds.size / modules.length) * 100) : 0;
  return { ...ladder, modules, progress };
}

// Turn the model's structured JSON into a persisted ladder object.
export function buildLadder({ topic, goal, modules }) {
  const ids = modules.map(() => uid());
  const built = modules.map((m, i) => ({
    id: ids[i],
    title: m.title || `Module ${i + 1}`,
    objectives: Array.isArray(m.objectives) ? m.objectives : [],
    prereqIds: (Array.isArray(m.prereqIndexes) ? m.prereqIndexes : [])
      .filter(x => Number.isInteger(x) && x >= 0 && x < modules.length && x !== i)
      .map(x => ids[x]),
    status: 'locked',
    quizId: null,
    sessionId: null,
  }));
  return recompute({ id: uid(), topic, goal, modules: built, createdAt: Date.now(), progress: 0, ...stampVersion('ladder') });
}

export function loadIndex() { return readLocal(IDX, []); }
export async function hydrateIndex() { const r = await hydrate(IDX); return Array.isArray(r) ? r : undefined; }

export function loadLadder(id) { const l = readLocal(key(id), null); return l ? recompute(l) : null; }
export async function hydrateLadder(id) { const r = await hydrate(key(id)); return r ? recompute(r) : undefined; }

export function saveLadder(ladder) {
  const l = recompute(ladder);
  writeThrough(key(l.id), l);
  const meta = { id: l.id, topic: l.topic, goal: l.goal, createdAt: l.createdAt, progress: l.progress };
  const next = [meta, ...loadIndex().filter(s => s.id !== l.id)].sort((a, b) => b.createdAt - a.createdAt);
  writeThrough(IDX, next);
  return l;
}

export function removeLadder(id) {
  storage.delete(key(id));
  const next = loadIndex().filter(s => s.id !== id);
  writeThrough(IDX, next);
  return next;
}

// Mark a module done and re-persist (unlocks whatever it gated).
export function completeModule(ladder, moduleId, patch = {}) {
  const modules = ladder.modules.map(m => m.id === moduleId ? { ...m, ...patch, status: 'done' } : m);
  return saveLadder({ ...ladder, modules });
}
