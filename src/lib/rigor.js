// src/lib/rigor.js — the shared epistemic layer.
//
// Provenance applies to claims about the EXTERNAL WORLD the user will act on —
// not to the user's own thinking. So this is opt-in per surface, composed from
// fragments, never applied globally: a library every surface is forced to use
// becomes a tax; one they choose from stays useful. See CLAUDE.md for the scope
// tiers (which surfaces get full rigor, tier chips only, or nothing).
//
// Rigor binds to the EXISTING depth protocol (surface / standard / deep / expert)
// rather than adding a parallel system.

export const DEPTHS = ['surface', 'standard', 'deep', 'expert'];

// One prompt fragment per epistemic move. Each is an instruction appended to a
// generation prompt; the surface picks which by depth.
export const RIGOR_FRAGMENTS = {
  evidence:
    '## Evidence Quality\nFor each substantive claim, name the evidence and its strength (a study, a named practitioner, a dataset — with how strong it is). Replace unsourced authority ("research confirms", "studies show") with the actual source, or mark it plainly as an **assertion**, not a finding.',
  sources:
    '## Sources\nList the primary anchors with location — author, work, and chapter / section / page (or timestamp for a talk). When a primary source is unavailable, say so explicitly; never paraphrase a source invisibly.',
  lineage:
    '## Intellectual Lineage\nWhat tradition this descends from, what in it is genuinely novel, and who said it first. Distinguish the author\'s original contribution from inherited ideas.',
  breakdown:
    '## Where This Breaks Down\nSteelman the single strongest objection — the best version a serious critic would make, not a token caveat — and name who makes it (a school of thought or a named critic). Where they apply, address survivorship bias, unfalsifiability, and circumstance-dependence.',
  disconfirming:
    '## Disconfirming Test\nWhat CB would OBSERVE if this were wrong for him specifically: a concrete signal to watch for and a review horizon (a date or a metric threshold). Make it falsifiable.',
  friction:
    '## Friction\nWhere CB\'s actual context resists this material — the place it does NOT fit his constraints — surfaced honestly rather than resolved cheaply.',
};

// Cumulative section sets per depth — the binding the whole layer runs on.
//   surface  → tier chips only (no rigor sections)
//   standard → + evidence quality, sources
//   deep     → + lineage, where this breaks down
//   expert   → + disconfirming test, friction, primary-source anchors
export const DEPTH_SECTIONS = {
  surface: [],
  standard: ['evidence', 'sources'],
  deep: ['evidence', 'sources', 'lineage', 'breakdown'],
  expert: ['evidence', 'sources', 'lineage', 'breakdown', 'disconfirming', 'friction'],
};

export function normalizeDepth(depth) {
  return DEPTHS.includes(depth) ? depth : 'standard';
}

// The tier discipline every claim-making surface shares. Tier is SOURCE TRUST,
// never engagement — same rule as WhatsHappening.
export const TIER_INSTRUCTION =
  'Tag each substantive claim/section with exactly one tier marker at the end of its line: `[verified]` (traceable to a named source in the material), `[reported: <source>]` (from a credible secondary source — name it), or `[inferred]` (your own synthesis). Every claim carries a tier; never present inference as verified.';

// Compose the rigor block for a depth. `only` overrides the depth mapping when a
// surface wants a specific subset. Returns '' for surface depth (tier chips only).
export function rigorPrompt(depth = 'standard', { only, tiers = true } = {}) {
  const keys = only || DEPTH_SECTIONS[normalizeDepth(depth)] || [];
  const sections = keys.map((k) => RIGOR_FRAGMENTS[k]).filter(Boolean);
  const parts = [];
  if (tiers) parts.push(TIER_INSTRUCTION);
  if (sections.length) parts.push(`Include these epistemic sections, each as its own ## heading, AFTER the main content:\n\n${sections.join('\n\n')}`);
  return parts.join('\n\n');
}

// Human labels for a depth control.
export const DEPTH_LABELS = { surface: 'Surface', standard: 'Standard', deep: 'Deep', expert: 'Expert' };
