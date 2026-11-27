// src/lib/tocTypes.js — a TYPED view over a table of contents (Batch Z-3 / L1+L2).
//
// A MARC 505 / retrieved TOC is not a list of chapters. The Way of Excellence's 505
// has 26 entries: 1 front (Introduction), 2 part headers, 19 chapters, 4 back
// (Conclusion + 3 appendices). Treating every line as a chapter produced chapter
// dives for "Part 1: Foundations" and "Appendix 3: Sleep" and "4 of 26" progress.
//
// Every entry is classified:
//   front    Introduction, Preface, Foreword, Prologue …
//   part     Part N / Section N / Book N headers — group headings, never divable
//   chapter  numbered, or anything not front/part/back — the ONLY divable type
//   back     Conclusion, Epilogue, Afterword, Appendix …
// Apparatus (Notes, Index, Acknowledgments, Bibliography, References) is not
// content and is dropped from the typed view. The source text itself (raw505)
// is never modified — this module is a VIEW over it.
//
// What this module repairs is OUR splitting, never the source's words:
//   • run-together part headers: "Part I: Cold war chips. From steel to silicon"
//     is a part header + its first chapter (the cataloguer joined them with ". "
//     or "? "), so it becomes a `part` + a `chapter`.
//   • a " -- " inside a quoted span: the record's
//     "All people must make semiconductors: -- Sharing God's love with the Chinese"
//     is ONE quoted entry; a naive split left two halves with dangling quotes.
// Source typos ("Interl's revolutionaires", "Applie silicon") and the source's own
// numbering slips (a second "Part II") are passed through untouched.
//
// Pure, dependency-free JS: the ground-book Edge Function runs a generated copy
// (supabase/functions/_shared/toc-types.js via scripts/sync-edge-shared.mjs).

const NUMWORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';
const PART_RE = new RegExp(`^(part|section|book)\\s+([ivxlcdm]+|\\d+|${NUMWORD})\\b\\s*[:.\\-–—]?\\s*(.*)$`, 'i');
const CHAPTER_RE = new RegExp(`^(chapter|ch\\.?)\\s+([ivxlcdm]+|\\d+|${NUMWORD})\\b\\s*[:.\\-–—]?\\s*(.*)$`, 'i');
const CONTENTS_HEADER = /^(table of )?contents:?$/i;
const NUMBERED_RE = /^(\d{1,3})\s*[.):\-–—]\s+(.+)$/;
const FRONT_RE = /^(introduction|preface|foreword|prologue|prelude|author['’]?s note|a note (?:on|to|about)\b|note to the reader|before (?:we|you) begin)\b/i;
const BACK_RE = /^(conclusion|epilogue|afterword|postscript|coda|appendix|appendices)\b/i;
const APPARATUS_RE = /^(notes|endnotes|index|acknowledg(?:e)?ments?|bibliography|select(?:ed)? bibliography|references|sources|further reading|recommended reading|about the author|credits|glossary|permissions)\s*\.?$/i;

// Quote balance: straight quotes must pair; curly quotes must match open/close.
const unbalancedQuotes = (s) => {
  const str = String(s || '');
  const straight = (str.match(/"/g) || []).length;
  const open = (str.match(/“/g) || []).length; const close = (str.match(/”/g) || []).length;
  return straight % 2 === 1 || open !== close;
};

// Split a 505 |a on " -- ", then re-join adjacent pieces that each carry an
// unbalanced quote (the separator sat INSIDE a quoted span). Pairwise only, so a
// genuinely stray quote in the source can never swallow the rest of the list.
export function splitContents(text) {
  const pieces = String(text || '').split(/\s+--\s+/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < pieces.length; i++) {
    if (unbalancedQuotes(pieces[i]) && i + 1 < pieces.length && unbalancedQuotes(pieces[i + 1])) {
      out.push({ text: `${pieces[i]} ${pieces[i + 1]}`, rejoined: true }); i++;
    } else out.push({ text: pieces[i], rejoined: false });
  }
  return out;
}

// Light per-line cleanup (bullets, dot leaders, trailing page numbers, md links,
// trailing separator punctuation). Prefixes are KEPT — they are the type evidence.
const BARE_LABEL = /^(part|section|book|chapter|ch\.?|appendix)\s+\d+$/i;
const tidy = (l) => {
  let s = String(l || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')       // md links → text
    .replace(/^[-*•#>\s]+/, '')                     // bullets / heading marks
    .replace(/\s*\.{2,}\s*\d+\s*$/, '')             // "Care .... 71"
    .trim();
  if (!BARE_LABEL.test(s)) s = s.replace(/\s+\d+$/, ''); // "Care 71" (but keep "Appendix 3")
  s = s.replace(/\s+(?=[ivx])x{0,3}(?:ix|iv|v?i{0,3})$/, '');           // "Preface ix" — lowercase roman page no. ("Part II" is uppercase, kept)
  return s.replace(/\s*[/;,]+$/, '')                // trailing 505 separators
    .replace(/([^.])\.$/, '$1')                     // one closing period, never an ellipsis
    .trim();
};

// A part header whose first chapter was run into it: "<part title>. <chapter>" or
// "<part title>? <"quoted chapter">". Split at the FIRST sentence end followed by
// a capital or an opening quote. A bare part title (no such boundary) is kept.
function splitRunTogether(rest) {
  const m = /^(.+?[.?!])\s+(["“A-Z].{2,})$/.exec(rest);
  if (!m) return null;
  const partTitle = m[1].replace(/\.$/, '').trim();
  if (partTitle.length < 2) return null;
  return { partTitle, chapter: m[2].trim() };
}

// One raw line → one or two typed entries (two when a part header is run together
// with its first chapter). `split` marks an entry produced by that repair.
export function classifyLine(line) {
  const s = tidy(line);
  if (!s || CONTENTS_HEADER.test(s)) return [];   // a pasted "Contents" heading is not an entry
  if (APPARATUS_RE.test(s)) return [{ type: 'apparatus', title: s, raw: line }];
  const p = PART_RE.exec(s);
  if (p) {
    const label = `${p[1][0].toUpperCase()}${p[1].slice(1).toLowerCase()} ${p[2]}`;
    const rest = p[3].trim();
    const rt = rest ? splitRunTogether(rest) : null;
    if (rt) return [
      { type: 'part', label, title: rt.partTitle, raw: line, split: true },
      { type: 'chapter', title: rt.chapter, raw: line, split: true },
    ];
    return [{ type: 'part', label, title: rest || label, raw: line }];
  }
  const c = CHAPTER_RE.exec(s);
  if (c) return [{ type: 'chapter', label: `Chapter ${c[2]}`, title: c[3].trim() || `Chapter ${c[2]}`, raw: line }];
  if (FRONT_RE.test(s)) return [{ type: 'front', title: s, raw: line }];
  if (BACK_RE.test(s)) return [{ type: 'back', title: s, raw: line }];
  const n = NUMBERED_RE.exec(s);
  if (n) return [{ type: 'chapter', label: `${n[1]}.`, title: n[2].trim(), raw: line }];
  return [{ type: 'chapter', title: s, raw: line }];
}

// Lines (array, or newline-joined text) → typed entries. Each entry carries:
//   type, title, label?, raw, part (index of its enclosing part entry, or null),
//   n (1-based chapter ordinal — chapters only).
export function typeTOC(input) {
  const lines = Array.isArray(input) ? input : String(input || '').split('\n');
  const entries = [];
  let part = null; let n = 0;
  for (const line of lines) {
    for (const e of classifyLine(line)) {
      if (e.type === 'apparatus') continue;
      if (e.type === 'part') { entries.push({ ...e, part: null }); part = entries.length - 1; continue; }
      // Front/back matter sits outside the part structure.
      if (e.type === 'front' || e.type === 'back') { entries.push({ ...e, part: null }); if (e.type === 'back') part = null; continue; }
      n += 1; entries.push({ ...e, part, n });
    }
  }
  return entries;
}

// A 505 |a string → typed entries, via the quote-aware split.
export function type505(text) {
  return typeTOC(splitContents(text).map((p) => p.text));
}

// Serialize entries back to lines that re-type IDENTICALLY (typeTOC is idempotent
// over its own output) — the server sends these as `toc` so every client, old or
// new, receives the repaired split.
export function toLines(entries) {
  return (entries || []).map((e) => (e.type === 'part' ? `${e.label}: ${e.title}`
    : e.type === 'chapter' && e.label && /^chapter/i.test(e.label) ? `${e.label}: ${e.title}` : e.title));
}

export const chaptersOnly = (entries) => (entries || []).filter((e) => e.type === 'chapter');

export function breakdown(entries) {
  const b = { front: 0, part: 0, chapter: 0, back: 0 };
  for (const e of entries || []) if (b[e.type] != null) b[e.type] += 1;
  return b;
}

// Stable per-chapter key for dives/progress (survives TOC re-typing, unlike a flat
// index that shifts when a Part header or Appendix leaves the list).
export const chapterKey = (title) => `c:${String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;

// ── L2: score a candidate record's contents note ─────────────────────────────
// Higher is cleaner. Computed on the RAW split (before our repairs) so a record
// the cataloguer formatted cleanly beats one we had to patch up.
export function score505(text) {
  const raw = String(text || '').split(/\s+--\s+/).map((p) => p.trim()).filter(Boolean);
  const entries = type505(text);
  const b = breakdown(entries);
  const runTogether = entries.filter((e) => e.split && e.type === 'part').length;
  const strayQuotes = raw.filter(unbalancedQuotes).length;
  const badLength = entries.filter((e) => e.type === 'chapter' && (e.title.length < 3 || e.title.length > 120)).length;
  const markers = (b.part > 0 ? 1 : 0) + (entries.some((e) => e.label && /^chapter/i.test(e.label)) ? 1 : 0);
  const score = b.chapter + 3 * markers - 3 * runTogether - 2 * strayQuotes - 2 * badLength;
  return {
    score, breakdown: b,
    reasons: [
      `${b.chapter} chapters`,
      markers ? `${markers} structural marker type(s)` : 'no part/chapter markers',
      runTogether ? `${runTogether} run-together part header(s)` : null,
      strayQuotes ? `${strayQuotes} stray-quote piece(s)` : null,
      badLength ? `${badLength} implausible title length(s)` : null,
    ].filter(Boolean),
  };
}
