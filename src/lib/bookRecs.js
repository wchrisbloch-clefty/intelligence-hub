// src/lib/bookRecs.js — "What to read next", built on the Phase 2 graph.
// No collaborative filtering (single user, no corpus): a curated candidate pool
// (BOOK_CANDIDATES) is scored against the knowledge graph and skills. Four
// signal types, each stating its reason in one line. A recommendation without a
// stated reason is noise — this only ever returns recs that carry a `reason`.
import { BOOK_CANDIDATES } from '../constants.js';
import { allConcepts, conceptKey } from './graph.js';
import { buildSkills } from './skills.js';

const norm = (s) => String(s || '').trim().toLowerCase();

// library: the books the user already has (from aether_bookclub). lens: work|personal|both.
export function recommendBooks({ library = [], lens = 'both', limit = 4 } = {}) {
  const have = new Set(library.map((b) => norm(b.title)));
  const readTitles = library.map((b) => b.title);
  const concepts = allConcepts();
  const conceptByKey = Object.fromEntries(concepts.map((c) => [c.id, c]));
  const skills = buildSkills();

  // High-observation concepts (Adjacent) and low-confidence skills (Gap).
  const hot = new Set(concepts.filter((c) => (c.observations || 0) >= 2).map((c) => c.id));
  const weak = new Set(skills.filter((s) => s.confidence != null && s.confidence < 5).map((s) => s.key));
  const coveredKeys = new Set(); // concept keys already fed by a book in the library
  for (const b of library) coveredKeys.add(conceptKey(b.title));

  const out = [];
  const seen = new Set();
  const push = (cand, type, reason) => {
    if (!reason || have.has(norm(cand.title)) || seen.has(norm(cand.title))) return;
    seen.add(norm(cand.title));
    out.push({ title: cand.title, author: cand.author, type: cand.type, signal: type, reason });
  };

  const pool = BOOK_CANDIDATES.filter((c) => lens === 'both' || c.lens === lens || c.lens === 'both');

  // 1 — Companion: natural follow-ons to a book already read.
  for (const c of pool) {
    const from = (c.companionOf || []).find((t) => readTitles.some((r) => norm(r) === norm(t)));
    if (from) push(c, 'Companion', `Natural follow-on to ${from}, which you've read.`);
  }
  // 2 — Gap: a low-confidence skill with no book feeding it.
  for (const c of pool) {
    const gap = (c.concepts || []).find((k) => weak.has(conceptKey(k)) && !coveredKeys.has(conceptKey(k)));
    if (gap) push(c, 'Gap', `Feeds "${gap}", a skill you're still building with no book behind it.`);
  }
  // 3 — Adjacent: covers concepts you're already active on.
  for (const c of pool) {
    const adj = (c.concepts || []).find((k) => hot.has(conceptKey(k)));
    if (adj) push(c, 'Adjacent', `Covers "${adj}", one of your most-active concepts.`);
  }
  // 4 — Lens / Broadening: a strong pick to keep the shelf non-empty for ANY lens.
  // This is the guaranteed fallback — it previously required lens !== 'both', which
  // silently left the shelf empty on the default 'both' lens (and is why the study
  // guide's read-next map came back empty when the AI pass returned nothing).
  for (const c of pool) {
    push(c, 'Lens', lens === 'both' ? 'A strong pick to broaden your library.' : `A strong ${lens} pick to widen your ${lens} library.`);
  }

  return out.slice(0, limit);
}
