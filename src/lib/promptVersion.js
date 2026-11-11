// src/lib/promptVersion.js — cache invalidation for AI-generated artifacts.
//
// A cached artifact built by an OLD generation prompt must never be served as if
// it were current. After PR #29 a study guide exported byte-identical to its
// pre-#29 version — telemetry leak intact, no tier chips, no counter-argument —
// because nothing recorded which prompt produced it. Every generated artifact now
// stamps the prompt version it was built with; a surface compares that to the
// current version and flags stale (with one-tap regenerate) instead of silently
// serving old output.
//
// BUMP the number for an artifact type whenever its generation prompt changes.
export const PROMPT_VERSION = {
  studyGuide: 8, // Batch Z / Order D: LENS + SUBJECT_FIDELITY replace CB_IDENTITY; examples from the book's own world; reader context only via Layer 3 (disabled)
  // (v7 was: shared VOICE fragment — meaning-level framing + sports analogies, no fake-precision telemetry)
  // (v6 was: source grounding / user copy + TOC retrieval / chapter-anchored generation + chapter dives / verified tier from a physical copy)
  // (v5 was: three-state grounding / never assert non-existence + frameworks produced even when contents unavailable)
  // (v4 was: tier ceiling / no false [verified] + grounding-constrained frameworks + per-framework disconfirming + diagram regenerates)
  // (v3 was PR B: depth-bound rigor + networked read-next + analytical diagram)
  // (v2 was #29: grounding + tier chips + "Where This Breaks Down" + no telemetry leak)
  deepDive: 2, // Batch Z / Order D: system prompt is LENS + SUBJECT_FIDELITY (no reader goals)
  ladder: 2, // Batch Z / Order D: ladder prompt no longer bends modules toward passive income / BD
  signals: 3, // Batch Z / Order D: VOICE composes from LENS; system prompt has no reader goals
  // (v2 was: + shared VOICE fragment)
};

// Stamp onto an artifact at generation time: { ...artifact, ...stampVersion('studyGuide') }.
export function stampVersion(type) {
  return { promptVersion: PROMPT_VERSION[type] || 0, generatedAt: Date.now() };
}

// True when the artifact was built by an older prompt than the current one.
export function isStale(artifact, type) {
  if (!artifact) return false;
  return (artifact.promptVersion || 0) < (PROMPT_VERSION[type] || 0);
}

// "generated 8/24/2026 · v2" — surfaced in the UI next to a regenerate control.
export function versionLabel(artifact) {
  const ts = artifact?.generatedAt || artifact?.createdAt;
  const date = ts ? new Date(ts).toLocaleDateString() : 'unknown date';
  return `generated ${date} · v${artifact?.promptVersion || 0}`;
}
