// src/lib/domainPacks.js — LAYER 3 of the prompt stack (Batch Z / Order D).
//
//   Layer 1  LENS              how to write for this reader     — always injected
//   Layer 2  SUBJECT_FIDELITY  explain the material on its terms — always injected
//   Layer 3  DOMAIN_PACKS      what the reader works on          — RETRIEVED, gated
//
// The reader's goals used to ride along on every prompt inside SYSTEM_BASE, so a
// book about excellence got a dividend-portfolio worked example: the model was
// obeying. Now the goals are DATA (knowledge/domains/*.md, five peers — finance is
// no longer privileged) and only reach a prompt when the material genuinely
// overlaps a pack above threshold.
//
// THREE HARD RULES
//  1. DOMAIN_PACKS_ENABLED is false and stays false for Batch Z. Shipping the gate
//     alongside the prompt split would make a quality regression unattributable.
//  2. Default to injecting NOTHING. Thin graph or weak overlap → [] → no personal
//     section at all. Absence of signal is not a reason to personalize.
//  3. When it fires, it is ONE labelled closing section — "## Where this touches
//     your work", ≤ ~120 words, listing only the packs that matched. Never woven
//     through the body.
import { DOMAIN_PACK_DATA } from '../../prompts/prompts.generated.js';
import { relatedConcepts as graphRelated, allConcepts as graphAll } from './graph.js';

export const DOMAIN_PACKS_ENABLED = false;
export const PERSONAL_SECTION_HEADING = '## Where this touches your work';
const MIN_GRAPH_CONCEPTS = 6;

export const DOMAIN_PACKS = Object.fromEntries(
  Object.entries(DOMAIN_PACK_DATA).map(([id, p]) => [id, { label: p.label, keywords: p.keywords }]),
);

const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
const hits = (text, keywords) => keywords.filter((k) => text.includes(` ${k} `));

// Returns [] unless the material genuinely overlaps a pack above threshold.
// Thin graph or weak overlap => [] => no personal section is injected at all.
//   materialText — what the artifact is ABOUT (title, author, description, TOC…)
//   graph        — injectable for tests: { relatedConcepts(topic), allConcepts() }
//   topic        — the graph concept for the material (book title, dive topic…)
// Overlap = distinct pack keywords found in the material itself, plus keywords
// found in the graph concepts relatedConcepts() connects to the material — so a
// pack fires on what the reader has actually engaged with near this material, not
// on what the reader wishes the material were about.
export function selectDomains(materialText, { graph, topic = '', threshold = 2, enabled = DOMAIN_PACKS_ENABLED } = {}) {
  if (!enabled) return [];
  const g = graph || { relatedConcepts: graphRelated, allConcepts: graphAll };
  let concepts = [];
  try { concepts = g.allConcepts() || []; } catch { concepts = []; }
  if (concepts.length < MIN_GRAPH_CONCEPTS) return [];   // thin graph → nothing

  const material = norm(materialText);
  let neighbours = '';
  try { neighbours = norm((g.relatedConcepts(topic || materialText, 8) || []).map((r) => r.concept?.topic).join(' ')); } catch { /* none */ }

  return Object.entries(DOMAIN_PACK_DATA)
    .map(([id, p]) => {
      const direct = hits(material, p.keywords);
      const viaGraph = hits(neighbours, p.keywords).filter((k) => !direct.includes(k));
      return { id, label: p.label, score: direct.length + viaGraph.length, matched: [...direct, ...viaGraph] };
    })
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

// The ONE place personal relevance may enter a generation. '' when nothing matched.
export function personalSectionPrompt(selected, readerContext = '') {
  if (!selected?.length) return '';
  const packs = selected.map((s) => `- ${s.label}: ${DOMAIN_PACK_DATA[s.id]?.text || ''}`).join('\n');
  return `After everything else, add ONE closing section titled exactly "${PERSONAL_SECTION_HEADING.replace(/^## /, '')}" (as a ## heading), at most ~120 words. Cover ONLY these areas, because the material genuinely overlaps them:
${packs}${readerContext ? `\nReader context (use at the level that carries meaning, never as names, numbers or percentages):\n${readerContext}` : ''}
Do not mention these areas anywhere else in the output. The body stays about the material.`;
}
