// src/lib/mentalModels.js — the ON-DEMAND mental-model reframe (Batch Z-2 / H).
//
// Order D changed "always connect to CB's mental model library" to "only when the
// material genuinely invites it": forcing twenty books onto every topic is the
// same failure as forcing finance onto every topic. This is the explicit control
// that makes the change cost nothing — automatic when it fits, available always,
// forced never. The user taps "Through my mental models" on a guide or deep dive
// and THIS prompt re-reads that artifact against prompts/library-v1.md.
import { LENS, READER_LIBRARY } from '../../prompts/prompts.generated.js';

export const MENTAL_MODELS_HEADING = 'Through my mental models';

export function buildMentalModelPrompt({ title = '', body = '' } = {}) {
  const text = String(body || '').slice(0, 14000);
  return {
    system: `You are an intelligence system: research analyst and teacher.\n\n${LENS}`,
    user: `The reader asked to see "${title || 'this material'}" through the books on their shelf.

${READER_LIBRARY}

THE MATERIAL (already written — do not rewrite it):
${text}

Produce ONE section titled "## ${MENTAL_MODELS_HEADING}". For each idea in the material that GENUINELY connects to a book on the shelf — the same idea, a real tension, or a direct contradiction — give the book, the connection, and what it changes, in 2–3 lines. Name the specific idea on both sides. If only one or two connect, give one or two; if none genuinely connect, say so in one line. Never force a book in to fill a quota, and never move the material into finance, investing or a career framing unless the material itself is about that. Tag each connection [inferred].`,
  };
}
