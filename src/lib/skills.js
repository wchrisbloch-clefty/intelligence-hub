// src/lib/skills.js — skills as trajectories, not static percentages.
//
// A skill is a tracked topic whose confidence moves over time. It's derived
// from the Phase 2 knowledge graph (each concept's per-observation confidence
// history) and augmented with user-defined skills the graph hasn't seen yet.
// The Skills module reads these to show where CB is trending, what moved a
// skill, what's due for review, and which skills are decaying from neglect.
import { readLocal, writeThrough } from './storage.js';
import { allConcepts, conceptKey } from './graph.js';
import { loadCards, loadIndex as loadReviewIndex } from './reviews.js';

const SKILLS_KEY = 'aether_skills_v1';
const DAY = 86_400_000;
const DECAY_DAYS = 21;               // no touch in 3 weeks → decaying
const uid = () => 'sk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const avg = (xs) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0);

// ── User-defined skills (name only; data comes from the graph) ──────────────
export function loadUserSkills() { return readLocal(SKILLS_KEY, []); }

export function addUserSkill(name) {
  const n = String(name || '').trim();
  if (!n) return loadUserSkills();
  const list = loadUserSkills();
  if (list.some((s) => s.name.toLowerCase() === n.toLowerCase())) return list;
  const next = [{ id: uid(), name: n, createdAt: Date.now() }, ...list];
  writeThrough(SKILLS_KEY, next);
  return next;
}

export function removeUserSkill(id) {
  const next = loadUserSkills().filter((s) => s.id !== id);
  writeThrough(SKILLS_KEY, next);
  return next;
}

// ── Level ───────────────────────────────────────────────────────────────────
export function levelFor(confidence) {
  if (confidence == null) return { label: 'No data', tier: 0, token: 'var(--dim)' };
  if (confidence >= 8) return { label: 'Expert', tier: 4, token: 'var(--tier-verified)' };
  if (confidence >= 6) return { label: 'Proficient', tier: 3, token: 'var(--positive)' };
  if (confidence >= 4) return { label: 'Learning', tier: 2, token: 'var(--tier-reported)' };
  return { label: 'Beginner', tier: 1, token: 'var(--caution)' };
}

// ── Review pressure (how many cards for this topic are due now) ──────────────
function dueCountFor(name) {
  const now = Date.now();
  const lower = name.toLowerCase();
  const cards = loadCards().filter((c) => (c.topic || '').toLowerCase() === lower && (c.dueDate || 0) <= now).length;
  const reviews = loadReviewIndex().filter((r) => (r.topicLabel || '').toLowerCase().includes(lower) && (r.dueAt || 0) <= now).length;
  return cards + reviews;
}

// ── One skill from one concept ──────────────────────────────────────────────
function skillFromConcept(concept) {
  const series = (concept.sources || [])
    .filter((s) => typeof s.confidence === 'number')
    .map((s) => ({ c: s.confidence, at: s.at }))
    .sort((a, b) => a.at - b.at);

  let trend = 'flat';
  if (series.length >= 2) {
    const half = Math.ceil(series.length / 2);
    const older = avg(series.slice(0, half).map((p) => p.c));
    const recent = avg(series.slice(half).map((p) => p.c));
    trend = recent > older + 0.3 ? 'up' : recent < older - 0.3 ? 'down' : 'flat';
  }

  const lastSeen = concept.lastSeen || null;
  const decaying = !!lastSeen && Date.now() - lastSeen > DECAY_DAYS * DAY;

  return {
    key: concept.id,
    name: concept.topic,
    confidence: typeof concept.confidence === 'number' ? concept.confidence : null,
    series: series.map((p) => p.c),
    trend,
    modules: concept.modules || [],
    observations: concept.observations || 0,
    lastSeen,
    decaying,
    movedBy: (concept.sources || [])[0] || null,   // newest observation
    due: dueCountFor(concept.topic),
  };
}

// ── The full skill list: graph concepts ∪ user-defined skills ───────────────
export function buildSkills() {
  const byKey = {};
  for (const c of allConcepts()) byKey[c.id] = skillFromConcept(c);

  for (const us of loadUserSkills()) {
    const k = conceptKey(us.name);
    if (byKey[k]) { byKey[k].userDefined = true; byKey[k].userId = us.id; }
    else byKey[k] = { key: k, name: us.name, confidence: null, series: [], trend: 'flat', modules: [], observations: 0, lastSeen: null, decaying: false, movedBy: null, due: 0, userDefined: true, userId: us.id };
  }

  return Object.values(byKey).sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1) || b.observations - a.observations);
}

// Rollup for headers / Home.
export function skillsSummary(skills = buildSkills()) {
  return {
    total: skills.length,
    rising: skills.filter((s) => s.trend === 'up').length,
    decaying: skills.filter((s) => s.decaying).length,
    due: skills.reduce((n, s) => n + (s.due || 0), 0),
    expert: skills.filter((s) => (s.confidence ?? 0) >= 8).length,
  };
}
