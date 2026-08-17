// src/lib/graph.js — the knowledge graph.
//
// logSession() (utils.js) already tracks topics + streaks. This is the layer
// that was declared and never built: the connective tissue that records what
// each module *learned* about a concept and how concepts relate, so a topic
// can be traced across BookClub, DeepDive, Research, Quiz, Academy, the Ladder,
// and the Inbox instead of each module writing one private key nobody reads.
//
// Stored on `aether_graph_v1` under `graph.concepts`, alongside the existing
// topics/sessions — same key, additive namespace. Writes go through
// writeThrough and are awaited, so a failed sync surfaces on the global chip
// instead of being swallowed.
//
//   concept = {
//     id, topic, confidence,            // rolling mean of observed confidences
//     modules: [moduleId],              // which modules have touched it
//     refs:    [ref],                   // external references (urls, citations)
//     sources: [{ module, source, refs, confidence, at }],   // newest first
//     related: { [conceptId]: weight }, // co-occurrence weight
//     observations, firstSeen, lastSeen,
//   }
import { readLocal, writeThrough, hydrate } from './storage.js';
import { GRAPH_KEY } from '../constants.js';

export const conceptKey = (topic) => String(topic || '').trim().toLowerCase().replace(/\s+/g, '_');

// Read the graph synchronously from the warm local cache. App boot and every
// writeThrough keep localStorage current, so this is the fast path; callers
// that need the server copy can await refreshGraph() first.
function baseGraph() {
  const g = readLocal(GRAPH_KEY, {});
  return g && typeof g === 'object' ? g : {};
}

// Pull the server copy into the local cache (used once on mount if a surface
// wants to be sure it's showing cross-device state).
export async function refreshGraph() {
  const g = await hydrate(GRAPH_KEY);
  return g && typeof g === 'object' ? g : baseGraph();
}

const asList = (x) => (Array.isArray(x) ? x : x == null || x === '' ? [] : [x]);

// Record one observation of a concept. Every learning module calls this at the
// point it produces knowledge (a book insight, a research pass, a quiz answer —
// right or wrong, a miss is signal). Returns { ok, graph, ...writeResult } so a
// caller holding app context can setGraph(result.graph) and react to sync.
export async function logConcept({ topic, source = null, module = null, confidence = null, refs = [] } = {}) {
  const label = String(topic || '').trim();
  if (!label) return { ok: false, code: 'no_topic' };

  const graph = baseGraph();
  graph.concepts = graph.concepts || {};
  const key = conceptKey(label);
  const now = Date.now();
  const refList = asList(refs).map(String).filter(Boolean);

  const c = graph.concepts[key] || {
    id: key, topic: label, confidence: null,
    modules: [], refs: [], sources: [], related: {},
    observations: 0, firstSeen: now, lastSeen: now,
  };
  c.topic = label;
  c.observations += 1;
  c.lastSeen = now;
  if (typeof confidence === 'number' && !Number.isNaN(confidence)) {
    c.confidence = c.confidence == null
      ? confidence
      : Math.round((c.confidence * (c.observations - 1) + confidence) / c.observations);
  }
  if (module && !c.modules.includes(module)) c.modules.push(module);
  for (const r of refList) if (!c.refs.includes(r)) c.refs.push(r);
  c.sources.unshift({ module, source: source || null, refs: refList, confidence, at: now });
  c.sources = c.sources.slice(0, 25);
  graph.concepts[key] = c;

  // Relate concepts that share a source string (co-studied) or a reference.
  if (source || refList.length) {
    for (const [k, other] of Object.entries(graph.concepts)) {
      if (k === key) continue;
      const sharesSource = source && other.sources?.some((s) => s.source && s.source === source);
      const sharesRef = refList.length && other.refs?.some((r) => refList.includes(r));
      if (sharesSource || sharesRef) {
        c.related[k] = (c.related[k] || 0) + 1;
        other.related = other.related || {};
        other.related[key] = (other.related[key] || 0) + 1;
      }
    }
  }

  const res = await writeThrough(GRAPH_KEY, graph);
  return { ok: res.ok !== false, graph, ...res };
}

export function getConcept(topic) {
  const g = baseGraph();
  return g.concepts?.[conceptKey(topic)] || null;
}

export function allConcepts() {
  const g = baseGraph();
  return Object.values(g.concepts || {});
}

// Concepts connected to `topic`, strongest first. Direct co-occurrence weight
// leads; concepts that merely share a module still surface with a small weight
// so the graph isn't empty early on.
export function relatedConcepts(topic, limit = 8) {
  const g = baseGraph();
  const concepts = g.concepts || {};
  const c = concepts[conceptKey(topic)];
  if (!c) return [];

  const scores = {};
  for (const [k, w] of Object.entries(c.related || {})) scores[k] = (scores[k] || 0) + w * 3;
  for (const [k, other] of Object.entries(concepts)) {
    if (k === c.id) continue;
    const sharedModules = (other.modules || []).filter((m) => (c.modules || []).includes(m)).length;
    const sharedRefs = (other.refs || []).filter((r) => (c.refs || []).includes(r)).length;
    if (sharedModules || sharedRefs) scores[k] = (scores[k] || 0) + sharedModules + sharedRefs * 2;
  }

  return Object.entries(scores)
    .map(([k, weight]) => ({ concept: concepts[k], weight }))
    .filter((x) => x.concept)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

// Everything a topic touches across the app — the payload the Connected
// Knowledge panel renders. Null when the topic has never been observed.
export function conceptFootprint(topic) {
  const c = getConcept(topic);
  if (!c) return null;
  return {
    topic: c.topic,
    confidence: c.confidence,
    modules: c.modules || [],
    refs: c.refs || [],
    observations: c.observations,
    lastSeen: c.lastSeen,
    sources: c.sources || [],
    related: relatedConcepts(c.topic, 8),
  };
}

// Rollup for dashboards.
export function graphSummary() {
  const concepts = allConcepts();
  const moduleCounts = {};
  for (const c of concepts) for (const m of c.modules || []) moduleCounts[m] = (moduleCounts[m] || 0) + 1;
  return {
    conceptCount: concepts.length,
    observationCount: concepts.reduce((n, c) => n + (c.observations || 0), 0),
    moduleCounts,
    topConcepts: [...concepts].sort((a, b) => (b.observations || 0) - (a.observations || 0)).slice(0, 12),
    mostConnected: [...concepts]
      .map((c) => ({ topic: c.topic, links: Object.keys(c.related || {}).length, modules: (c.modules || []).length }))
      .sort((a, b) => b.links - a.links || b.modules - a.modules)
      .slice(0, 8),
  };
}
