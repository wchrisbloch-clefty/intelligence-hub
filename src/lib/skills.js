// src/lib/skills.js — skills as trajectories, not static percentages.
//
// A skill is a tracked topic whose confidence moves over time. It's derived
// from the Phase 2 knowledge graph (each concept's per-observation confidence
// history) and augmented with user-defined skills. A user skill can map to one
// OR MORE graph concepts, so "Business Development" can aggregate several
// concepts into one trajectory. The Skills module reads these to show where CB
// is trending, what moved a skill, what's due, and what's decaying from neglect.
//
// User skill: { id, name, concepts: [conceptKey], archived, createdAt }
//
// Persistence is done by the caller (Skills.jsx) through the awaited/revert
// pattern; the transforms here are pure (list in → list out) so the component
// owns the write and can revert on failure.
import { readLocal } from './storage.js';
import { allConcepts, conceptKey, getConcept } from './graph.js';
import { loadCards, loadIndex as loadReviewIndex } from './reviews.js';

export const SKILLS_KEY = 'aether_skills_v1';
const DAY = 86_400_000;
const DECAY_DAYS = 21;               // no touch in 3 weeks → decaying
const uid = () => 'sk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const avg = (xs) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0);

export function loadUserSkills() { return readLocal(SKILLS_KEY, []); }

// ── Pure transforms (caller persists the returned list) ─────────────────────
export function skillAdd(list, name) {
  const n = String(name || '').trim();
  if (!n || list.some((s) => s.name.toLowerCase() === n.toLowerCase())) return list;
  return [{ id: uid(), name: n, concepts: [conceptKey(n)], archived: false, createdAt: Date.now() }, ...list];
}
export function skillRename(list, id, name) {
  const n = String(name || '').trim();
  if (!n) return list;
  return list.map((s) => (s.id === id ? { ...s, name: n } : s));
}
export function skillArchive(list, id, archived) {
  return list.map((s) => (s.id === id ? { ...s, archived: !!archived } : s));
}
export function skillRemove(list, id) {
  return list.filter((s) => s.id !== id);
}
export function skillSetConcepts(list, id, keys) {
  const clean = [...new Set((keys || []).map((k) => conceptKey(k)).filter(Boolean))];
  return list.map((s) => (s.id === id ? { ...s, concepts: clean } : s));
}

// ── Level ───────────────────────────────────────────────────────────────────
export function levelFor(confidence) {
  if (confidence == null) return { label: 'No data', tier: 0, token: 'var(--dim)' };
  if (confidence >= 8) return { label: 'Expert', tier: 4, token: 'var(--tier-verified)' };
  if (confidence >= 6) return { label: 'Proficient', tier: 3, token: 'var(--positive)' };
  if (confidence >= 4) return { label: 'Learning', tier: 2, token: 'var(--tier-reported)' };
  return { label: 'Beginner', tier: 1, token: 'var(--caution)' };
}

function dueCountFor(name) {
  const now = Date.now();
  const lower = String(name || '').toLowerCase();
  const cards = loadCards().filter((c) => (c.topic || '').toLowerCase() === lower && (c.dueDate || 0) <= now).length;
  const reviews = loadReviewIndex().filter((r) => (r.topicLabel || '').toLowerCase().includes(lower) && (r.dueAt || 0) <= now).length;
  return cards + reviews;
}

function trendFrom(series) {
  if (series.length < 2) return 'flat';
  const half = Math.ceil(series.length / 2);
  const older = avg(series.slice(0, half));
  const recent = avg(series.slice(half));
  return recent > older + 0.3 ? 'up' : recent < older - 0.3 ? 'down' : 'flat';
}

// Aggregate one skill from a set of concepts (one, for an auto skill; one-or-more
// for a user skill mapping several).
function skillFromConcepts(concepts, base) {
  const withData = concepts.filter(Boolean);
  const points = withData
    .flatMap((c) => (c.sources || []).filter((s) => typeof s.confidence === 'number').map((s) => ({ c: s.confidence, at: s.at })))
    .sort((a, b) => a.at - b.at);
  const confs = withData.map((c) => (typeof c.confidence === 'number' ? c.confidence : null)).filter((x) => x != null);
  const modules = [...new Set(withData.flatMap((c) => c.modules || []))];
  const lastSeen = withData.reduce((m, c) => Math.max(m, c.lastSeen || 0), 0) || null;
  const movedBy = withData.flatMap((c) => c.sources || []).sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;
  const conceptNames = withData.map((c) => c.topic);
  return {
    ...base,
    confidence: confs.length ? Math.round(avg(confs)) : null,
    series: points.map((p) => p.c),
    trend: trendFrom(points.map((p) => p.c)),
    modules,
    observations: withData.reduce((n, c) => n + (c.observations || 0), 0),
    lastSeen,
    decaying: !!lastSeen && Date.now() - lastSeen > DECAY_DAYS * DAY,
    movedBy,
    conceptNames,
    due: conceptNames.reduce((n, name) => n + dueCountFor(name), 0),
  };
}

// The full skill list: user-defined skills (aggregating their mapped concepts)
// plus every graph concept not already claimed by a user skill.
export function buildSkills(userSkills = loadUserSkills(), { includeArchived = false } = {}) {
  const conceptsByKey = Object.fromEntries(allConcepts().map((c) => [c.id, c]));
  const claimed = new Set();
  const out = [];

  for (const us of userSkills) {
    if (us.archived && !includeArchived) { (us.concepts || []).forEach((k) => claimed.add(k)); continue; }
    const keys = (us.concepts && us.concepts.length) ? us.concepts : [conceptKey(us.name)];
    keys.forEach((k) => claimed.add(k));
    const concepts = keys.map((k) => conceptsByKey[k]).filter(Boolean);
    out.push(skillFromConcepts(concepts, {
      key: us.id, name: us.name, userDefined: true, userId: us.id, archived: !!us.archived,
      mappedKeys: keys,
    }));
  }

  for (const c of allConcepts()) {
    if (claimed.has(c.id)) continue;
    out.push(skillFromConcepts([c], { key: c.id, name: c.topic, userDefined: false, mappedKeys: [c.id] }));
  }

  return out.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1) || b.observations - a.observations);
}

// Concepts available to map a skill to (for the mapping UI).
export function availableConcepts() {
  return allConcepts().map((c) => ({ key: c.id, name: c.topic, observations: c.observations || 0 })).sort((a, b) => b.observations - a.observations);
}

export { getConcept };

export function skillsSummary(skills = buildSkills()) {
  return {
    total: skills.length,
    rising: skills.filter((s) => s.trend === 'up').length,
    decaying: skills.filter((s) => s.decaying).length,
    due: skills.reduce((n, s) => n + (s.due || 0), 0),
    expert: skills.filter((s) => (s.confidence ?? 0) >= 8).length,
  };
}
