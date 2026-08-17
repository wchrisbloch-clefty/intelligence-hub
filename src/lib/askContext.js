// src/lib/askContext.js — the Universal Ask serializer contract.
//
// Any object in the hub — a book, project, deep dive, note, decision, skill, or
// captured item — can open the Ask layer pre-loaded with itself and its graph
// neighbors. toContext(type, object) is the one contract, implemented per type;
// askPrefill wraps it with the object's connected concepts so the chat starts
// already knowing what this thing touches.
import { conceptFootprint, relatedConcepts } from './graph.js';

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// One serializer per type → a compact, human-readable context line.
export function toContext(type, o = {}) {
  switch (type) {
    case 'book':
      return `Book: "${o.title}"${o.author ? ` by ${o.author}` : ''}${o.type ? ` (${o.type})` : ''}.`;
    case 'project':
      return `Project: "${o.title}" — status ${o.status || 'unknown'}. Milestones: ${(o.milestones || []).map((m) => `${m.done ? '✓' : '○'} ${m.label || m.text}`).join('; ') || 'none yet'}.`;
    case 'note':
      return `Vault note: "${o.title}". ${clip(o.content, 400)}`;
    case 'deepdive':
      return `Deep dive: "${o.topic}"${o.category ? ` (${o.category})` : ''} — ${(o.sections || []).length} research pass(es).`;
    case 'decision':
      return `Decision: "${o.title || o.decision}". ${clip(o.context || o.rationale || o.notes, 300)}`;
    case 'skill':
      return `Skill: "${o.name}" — confidence ${o.confidence == null ? 'untracked' : `${o.confidence}/10`}, trend ${o.trend || 'flat'}. Studied in: ${(o.modules || []).join(', ') || '—'}.`;
    case 'inbox':
      return `Captured item: "${o.title}"${o.url ? ` (${o.url})` : ''}. ${clip(o.summary || o.snippet, 300)}`;
    default:
      return typeof o === 'string' ? o : clip(JSON.stringify(o), 400);
  }
}

// The topic string used to pull graph neighbors for an object.
function topicOf(type, o) {
  return o.title || o.topic || o.name || o.decision || '';
}

// The full Ask prefill: the object's own context + its connected concepts, so
// the chat opens already aware of what this thing links to across modules.
export function askPrefill(type, object = {}) {
  const context = toContext(type, object);
  const topic = topicOf(type, object);
  let neighbors = '';
  if (topic) {
    const fp = conceptFootprint(topic);
    const related = fp?.related?.length ? fp.related.map((r) => r.concept.topic) : relatedConcepts(topic, 6).map((r) => r.concept.topic);
    if (related.length) neighbors = `\nConnected in my knowledge graph to: ${related.join(', ')}.`;
  }
  return `${context}${neighbors}\n\nHelp me think about this — connect it to my goals and what I already know, and give me a decisive next move.`;
}
