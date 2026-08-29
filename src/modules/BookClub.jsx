import { T, withAlpha } from '../theme';
import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { createCard } from '../lib/reviews.js';
import { logConcept, allConcepts, isJunkConcept, pruneJunkConcepts } from '../lib/graph.js';
import { recommendBooks } from '../lib/bookRecs.js';
import { buildSkills } from '../lib/skills.js';
import { loadIndex as loadDiveIndex } from '../lib/deepdives.js';
import { verifyBook, toVerifiedRecord, isPostCutoff } from '../lib/bookVerify.js';
import { retrieveTOC, parseTOC, groundingTier, groundingTypeMeta } from '../lib/sourceGrounding.js';
import SourceGrounding from './shared/SourceGrounding.jsx';
import { stampVersion, isStale, versionLabel, PROMPT_VERSION } from '../lib/promptVersion.js';
import { rigorPrompt, DEPTHS, DEPTH_LABELS, normalizeDepth, capTierMarkers } from '../lib/rigor.js';
import AskChip from './shared/AskChip.jsx';
import Icon from './shared/Icon.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';
import DiagramBlock from './shared/DiagramBlock.jsx';
import ArtifactSections from './shared/ArtifactSections.jsx';
import { CB_LEARNING_SPINE, KNOWN_BOOKS, TYPE_META, PROJECTS_KEY } from '../constants.js';

const BOOKCLUB_KEY = 'aether_bookclub';
const SEEDED_KEY   = 'aether_bookclub_seeded';
const LENS_KEY     = 'aether_bookclub_lens';
const STUDY_GUIDES_KEY = 'aether_study_guides_v1';
const CHAPTER_DIVES_KEY = 'aether_chapter_dives_v1';       // { [bookId]: { [idx]: dive } }
const CHAPTER_PROGRESS_KEY = 'aether_chapter_progress_v1'; // { [bookId]: { [idx]: { read } } }
import MD from './shared/MD.jsx';
import ProviderTag from './shared/ProviderTag.jsx';
import { ThinkingDots } from './shared/Common.jsx';

const STUDY_MODES = [
  { id: 'overview',  label: 'Overview',       icon: 'ClipboardList', desc: 'Executive summary + key thesis' },
  { id: 'concepts',  label: 'Key Concepts',   icon: 'Brain', desc: 'Core frameworks and mental models' },
  { id: 'apply',     label: 'Apply to Work',  icon: 'Zap', desc: 'Direct applications to your goals' },
  { id: 'quotes',    label: 'Power Quotes',   icon: 'MessageSquare', desc: 'Most impactful passages' },
  { id: 'quiz',      label: 'Socratic Quiz',  icon: 'Target', desc: 'Test and deepen understanding' },
  { id: 'discuss',   label: 'Discussion',     icon: 'Handshake', desc: 'Critical conversation about the book' },
];

// Type → theme token. Uses tier + accent tokens from src/theme.js (no new hex),
// so the `type` field finally reads as colour instead of a dead grey.
const TYPE_COLOR = {
  leadership:  T.accent,
  business:    T.positive,
  systems:     T.tierReported,
  negotiation: T.caution,
  memoir:      T.tierInferred,
  stoic:       T.tierUncited,
  fiction:     T.tierVerified,
  other:       T.textSecondary,
};
const typeColor = (t) => TYPE_COLOR[t] || T.textSecondary;
const TYPE_IDS = Object.keys(TYPE_META);

const BLANK_FORM = { title: '', author: '', note: '', type: 'other' };

// A book's chapter list + how trustworthy its STRUCTURE is: a user-typed TOC (or
// photo transcription) is `verified`, a retrieved TOC is `reported`, none → null.
const chaptersOf = (book) => {
  if (!book) return { chapters: [], tier: null };
  const ug = book.userGrounding;
  const userToc = ug && ['toc', 'photo-ocr'].includes(ug.type) ? ug.text : '';
  if (userToc) return { chapters: parseTOC(userToc), tier: 'verified' };
  if (book.retrievedTOC?.toc) return { chapters: parseTOC(book.retrievedTOC.toc), tier: 'reported' };
  return { chapters: [], tier: null };
};

// Dedupe/identity key — lowercased title + author.
const keyOf = (b) => `${b.title || ''}|${b.author || ''}`.toLowerCase().trim();
// Ensure every entry carries a stable id for CRUD.
const withId = (b) => (b.id ? b : { ...b, id: uid() });
// The 20 built-ins, tagged, used only as a seed.
const seedBooks = () => KNOWN_BOOKS.map((b) => ({
  id: uid(), title: b.title, author: b.author, type: b.type || 'other', builtin: true,
}));

// Life-application lens — deep dives assumed a work context; now the reader
// chooses. The lens is appended to every prompt so examples land in the right
// part of CB's life.
const LENSES = [
  { id: 'work',     icon: 'Briefcase', label: 'Work',     clause: "Frame everything through CB's professional world — BD pipeline, deals, revenue, career leverage. Use work examples." },
  { id: 'personal', icon: 'Sprout', label: 'Personal', clause: "Frame everything through CB's personal world — health and longevity, family, character, money habits, personal growth. Use life examples." },
  { id: 'both',     icon: 'Scale', label: 'Both',     clause: 'For each point give BOTH a work application (BD, deals, career) and a personal application (health, family, character).' },
];
const lensClauseOf = (id) => LENSES.find((l) => l.id === id)?.clause || LENSES[2].clause;

// The study guide is grounded in CB's ACTUAL context — active projects, tracked
// skills, and recent deep dives, pulled from the graph — so the Applied Scenarios
// are about his real work and life, not generic illustrations. Returns '' when
// nothing is tracked yet (the prompt then falls back to his known world).
// Strip a trailing module/section qualifier a concept or skill sometimes carries
// ("Having a Clear Sense of Values (Skills Building)") — that suffix is a tracking
// artifact, not part of the domain, and must never appear in a scenario.
export const stripModuleTag = (s) => String(s || '').replace(/\s*\((?:skills?(?: building)?|books?|academy|deep ?dive|research|quiz|ladder|field manual|notes|inbox)\)\s*$/i, '').trim();

function buildStudyContext() {
  const parts = [];
  try {
    const projects = (readLocal(PROJECTS_KEY, []) || [])
      .filter((p) => p && ['active', 'planning'].includes(p.status))
      .slice(0, 5)
      .map((p) => `- ${p.title}${p.category ? ` (${p.category})` : ''}${p.description ? `: ${String(p.description).replace(/\s+/g, ' ').slice(0, 90)}` : ''}`);
    if (projects.length) parts.push(`Active projects:\n${projects.join('\n')}`);
  } catch {}
  try {
    // Skill NAMES only — the confidence level and especially the trend are graph
    // telemetry, not scenario material. A previous guide's scenarios collapsed
    // into "trend flat" variants because the trend leaked in; scenarios must be
    // about the domain, never about the graph's readout of it.
    const skills = buildSkills().filter((s) => s.confidence != null)
      .map((s) => stripModuleTag(s.name))
      .filter((n) => n && !isJunkConcept(n))   // same read-side guard as concepts
      .slice(0, 6)
      .map((n) => `- ${n}`);
    if (skills.length) parts.push(`Skills he's building:\n${skills.join('\n')}`);
  } catch {}
  try {
    const dives = (loadDiveIndex() || []).slice(0, 5)
      .map((d) => `- ${d.topic}${d.category ? ` (${d.category})` : ''}`);
    if (dives.length) parts.push(`Recent deep dives:\n${dives.join('\n')}`);
  } catch {}
  try {
    // Straight from the knowledge graph: the concepts he's actually engaged with
    // most, by observation count. This is the signal that turns "you have a real
    // estate project" into "you've been going deep on demand charges and 4CP" —
    // the specific thread makes a far better worked example than the category.
    // Sorted by observation count (priority order) but the raw counts are NOT
    // injected — they're internal graph telemetry that must never surface in the
    // user-facing guide (it leaked as "(2 book touches — direct study area)").
    const concepts = (allConcepts() || [])
      .filter((c) => (c.observations || 0) > 0)
      // Belt-and-suspenders against graph pollution: even if pruneJunkConcepts
      // hasn't run yet (it's async on mount) or missed one, a section label like
      // "Worked Example" must never reach the prompt as a scenario domain.
      .filter((c) => !isJunkConcept(c.topic))
      .sort((a, b) => (b.observations || 0) - (a.observations || 0))
      .slice(0, 6)
      .map((c) => `- ${stripModuleTag(c.topic)}`)
      .filter((l) => l !== '- ');
    if (concepts.length) parts.push(`Topics he's been going deep on (most-engaged first):\n${concepts.join('\n')}`);
  } catch {}
  return parts.join('\n\n');
}

// grounding: { fullTitle, publishedDate, description, webThesis, verified, source,
// tocChapters, tocSourceLabel, userMaterial, userMaterialLabel, tier } — the
// verified catalog record, a web pass, a retrieved or user-supplied table of
// contents, and any excerpt/notes the user pasted from their copy. `tier` is the
// grounding ceiling computed upstream (verified only when the user supplied a
// physical copy). When a TOC is present the guide is generated CHAPTER BY CHAPTER,
// which is the thing the user actually wants and is impossible without structure.
export const buildGuidePrompt = (b, lensClause, context, grounding = {}, depth = 'deep') => {
  const title = grounding.fullTitle || b.title;
  const chapters = Array.isArray(grounding.tocChapters) ? grounding.tocChapters : [];
  const hasTOC = chapters.length >= 3;
  const hasUserMaterial = !!grounding.userMaterial;
  const hasContents = !!(grounding.description || grounding.webThesis);
  const grounded = hasContents || hasTOC || hasUserMaterial;
  const tier = grounding.tier || (grounded ? 'reported' : 'inferred'); // ceiling
  const existsVerified = !!grounding.verified;
  const catalog = grounding.source === 'google' ? 'Google Books' : grounding.source === 'openlibrary' ? 'Open Library' : 'a book catalog';
  const ground = [
    grounding.webThesis ? `RETRIEVED THESIS, CHAPTERS & KEY CONCEPTS (from a live web pass, THIS book specifically):\n${grounding.webThesis}` : '',
    grounding.description ? `PUBLISHER DESCRIPTION (secondary — match this, never the author's other books):\n${grounding.description}` : '',
    hasUserMaterial ? `SOURCE MATERIAL THE READER TYPED FROM THEIR OWN COPY (${grounding.userMaterialLabel || 'excerpt/notes'} — first-hand, authoritative):\n${grounding.userMaterial}` : '',
    hasTOC ? `TABLE OF CONTENTS (${grounding.tocSourceLabel || 'retrieved'}):\n${chapters.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  const rigor = rigorPrompt(depth, { tiers: false });
  // Tier ceiling written into the prompt (and enforced again on the output). The
  // verified tier is honest ONLY when the reader supplied a copy from the book.
  const tierRule = tier === 'verified'
    ? `Tag EACH framework/section with one tier marker. \`[verified]\` ONLY for what is traceable to the reader's supplied copy above — a chapter title/location from THEIR table of contents, or text in THEIR excerpt (cite the chapter as the location). \`[reported: <source>]\` for the publisher description or a retrieved TOC. \`[inferred]\` for your own synthesis beyond the supplied material. Do not mark verified anything you cannot point to in the reader's copy.`
    : tier === 'reported'
    ? `Tag EACH framework at the END of its first line by SOURCE TRUST. \`[verified]\` requires RETRIEVED PRIMARY SOURCE TEXT with a location — you were NOT given the book's text, so \`[verified]\` is FORBIDDEN. Use \`[reported: ${title}]\` when drawn from the grounding above, \`[reported: <other book>]\` when from the author's OTHER work (name it), or \`[inferred]\` for synthesis. Highest tier allowed: \`[reported]\`.`
    : `The book's contents were not retrieved; write from general knowledge and tag EVERY framework \`[inferred]\`. Do NOT emit \`[verified]\` or \`[reported]\`.`;
  // The honest note fires only when NOTHING grounds the book. Three distinct
  // states, none of which may claim the book doesn't exist.
  const existenceNote = grounded
    ? ''
    : existsVerified
      ? `\n════ GROUNDING STATE ════\nThis book EXISTS — verified against ${catalog}${grounding.publishedDate ? ` (published ${grounding.publishedDate})` : ''}. Its CONTENTS could not be retrieved. Write from general knowledge, mark every framework \`[inferred]\`, and open the Core Thesis by stating the book is confirmed to exist but its contents could not be retrieved. You may say you could not RETRIEVE the contents — NEVER say or imply the book does not exist, is unpublished, or is not in publication records. It is confirmed real. (The reader can paste its table of contents to get a chapter-by-chapter guide.)\n═════════════════════════\n`
      : `\n════ GROUNDING STATE ════\nThis title could NOT be confirmed against a book catalog and its contents were not retrieved. Write cautiously from general knowledge, mark every framework \`[inferred]\`, and open by stating you could not verify this specific title. Say only that you could not VERIFY or RETRIEVE it — NEVER assert it does not exist (absence from your knowledge is not evidence of non-existence).\n═════════════════════════\n`;
  // Chapter-anchored body when a TOC is present; framework-based otherwise.
  const bodySections = hasTOC
    ? `## Core Thesis
The book's central argument in one tight paragraph, grounded in the material above.
## Chapter Guide
Work through the book IN ORDER using the table of contents above. For EACH chapter, use its title as a \`### \` heading, then in 2–4 sentences give: its core argument, the key framework(s) it introduces (**bold** each framework name), and one worked example in the lens. ${grounding.tocIsUser ? 'Cite the chapter as the location for what you draw from it.' : ''} ${lensClause}
## Key Frameworks
The 3–5 through-line frameworks that span the chapters. Put EACH on its own line as \`**Name** — \` one-line essence, then a **Disconfirming signal:** — one concrete thing CB would OBSERVE if it's failing for him, plus a review horizon (metric or date).
${tierRule}`
    : `## Core Thesis
The book's central argument in plain language — no jargon, one tight paragraph${grounded ? ', grounded in the material above' : existsVerified ? ', after the note that the book is confirmed to exist but its contents could not be retrieved' : ', after the note that this specific title could not be verified'}.
## Key Frameworks
${grounded ? 'The most important frameworks or mental models FROM THE GROUNDING (up to 5; fewer if the grounding only supports fewer).' : 'The most important frameworks or mental models of this book (up to 5), written from general knowledge and each marked `[inferred]` — do not leave this section empty.'} For EACH: the name, a clear explanation, one fully worked example, and a **Disconfirming signal:** — one concrete thing CB would OBSERVE if this framework is NOT working for him, plus a review horizon (a metric threshold or a date). ${lensClause}
${tierRule}`;
  return `Produce a complete STUDY GUIDE for "${title}"${b.author ? ` by ${b.author}` : ''}${grounding.publishedDate ? ` (published ${grounding.publishedDate})` : ''}, for CB (Houston BD professional; passive-income + longevity goals).
${existenceNote}${ground ? `\n════ GROUNDING — THE GUIDE COMES FROM HERE ════\n${ground}\n\nHARD CONSTRAINT: Derive the guide ONLY from the grounding above — the chapters, thesis, and material given. Do NOT import frameworks from the author's better-known earlier book; if a framework isn't supported by the grounding, drop it. Fewer well-grounded beats five padded from the author's other work.\n═══════════════════════════════════════════════════\n` : ''}${context ? `\nCB'S ACTUAL CONTEXT — use ONLY these for the Applied Scenarios, as the DOMAIN of each scenario. A generic example is a failure. Never quote or mention graph metadata about his learning — no trends, confidence levels, observation counts, "touches", or section labels; a scenario is about the work, not the guide or the graph:\n${context}\n` : ''}
Use these exact ## sections in order:
${bodySections}
## Applied Scenarios
3–5 scenarios, each built on a specific item from ${context ? "CB's actual context above" : "CB's world (Houston BD, real-estate deals, passive income, health/longevity, family)"}. Name the real project / domain / topic and show exactly how a framework from this book changes what he does next. Never make a scenario about the graph, a trend, or a confidence level.
## Application Prompts
5 concrete things CB can act on THIS WEEK.
## Field Summary
A one-page, scannable field summary — the whole book in bullets he can reread before a meeting in two minutes.
${rigor ? `\n${rigor}\n` : ''}
Then output a line containing only ---CARDS--- and, after it, ONLY a JSON array of 8 to 10 self-quiz flashcards: [{"front":"question","back":"answer"}]. Output the ---CARDS--- marker and the array even if the guide ran long. No prose after the marker.`;
};

// A single-chapter deep dive. Structure (the chapter title + its order) is as
// trustworthy as the TOC it came from — `verified` from the reader's own copy,
// `reported` from a retrieved TOC — but the chapter's ARGUMENTS are `inferred`
// (this surface never has the chapter's text). The prompt is explicit about which
// is which; capTierMarkers then caps at the structure tier so the title can hold
// its badge while the analysis stays inferred.
export const buildChapterPrompt = (b, chapter, idx, lensClause, structureTier) => {
  const title = b.fullTitle || b.title;
  const loc = `Ch. ${idx + 1}: ${chapter}`;
  const structureNote = structureTier === 'verified'
    ? `The chapter title and its order come from the READER'S OWN COPY — the STRUCTURE is \`[verified]\` (cite it as "${loc}"). You do NOT have the chapter's text, so its arguments are \`[inferred]\`. Be explicit about which is which.`
    : structureTier === 'reported'
    ? `The chapter title comes from a retrieved table of contents — the STRUCTURE is \`[reported]\` (cite it as "${loc}"). You do NOT have the chapter's text, so its arguments are \`[inferred]\`.`
    : `You do NOT have the chapter's text — everything here is \`[inferred]\`.`;
  return `Chapter deep dive for CB (Houston BD professional) on "${title}"${b.author ? ` by ${b.author}` : ''} — Chapter ${idx + 1}: "${chapter}".
${structureNote}
Keep it tight. Use these exact ## sections:
## Argument
What this chapter argues, in 2–4 sentences.
## Key Ideas
The 2–3 key ideas or frameworks it introduces — **bold** each name.
## Worked Example
One worked example. ${lensClause}
## Disconfirming Test
One concrete signal CB would OBSERVE if this chapter's idea is NOT working for him, plus a review horizon (a metric threshold or a date).
Tag claims by tier per the note above: the chapter title/order carries its structure tier; the analysis is \`[inferred]\`.`;
};

// Pull the framework NAMES out of the guide's "## Key Frameworks" section so each
// one becomes its own concept in the graph, linked to the book by shared source.
// Tolerant of the model's formatting: bullets, numbers, bold labels, or a
// "Name — definition" line all resolve to the leading name.
export function extractFrameworks(body) {
  const m = String(body || '').match(/##\s*Key Frameworks\b([\s\S]*?)(?:\n##\s|$)/i);
  if (!m) return [];
  const out = [];
  for (const raw of m[1].split('\n')) {
    const stripped = raw.trim().replace(/^([-*•]|\d+[.)])\s+/, '');   // drop bullet/number
    let name =
      (stripped.match(/^\*\*(.+?)\*\*/) || [])[1] ||                  // **Bold label**
      (stripped.match(/^#{3,}\s*(.+)$/) || [])[1] ||                  // ### Heading
      (stripped.match(/^(.+?)\s*[:—–-]\s+/) || [])[1] || '';          // Name: / Name — definition
    name = name.replace(/\*\*/g, '').replace(/[:—–-]\s*$/, '').trim();
    const clean = name.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    // Reject markdown scaffolding ("What it is", "Worked Example", "Disconfirming
    // signal") — the same guard the graph writer uses, so junk never gets logged.
    if (clean.length >= 3 && clean.length <= 60 && !isJunkConcept(clean)) out.push(clean);
    if (out.length >= 5) break;
  }
  return [...new Set(out.filter(Boolean))];
}

// Parse the trailing ---CARDS--- JSON into Vault cards. Hardened: strips fences,
// finds the array even if the model wrapped it in stray prose, and accepts
// front/back or q/a or question/answer keys. Returns the count actually created.
function parseAndVaultCards(cardsRaw, book) {
  if (!cardsRaw) return 0;
  let text = cardsRaw.replace(/```json|```/gi, '').trim();
  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);
  let arr;
  try { arr = JSON.parse(text); } catch { return 0; }
  if (!Array.isArray(arr)) return 0;
  let added = 0;
  for (const c of arr) {
    const front = c?.front || c?.q || c?.question;
    const back = c?.back || c?.a || c?.answer;
    if (front && back && createCard({ front: String(front), back: String(back), source: book.title, module: 'books', topic: book.title }).created) added++;
  }
  return added;
}

const PROMPTS = {
  overview:  (b) => `Give me a master-level executive overview of "${b.title}" by ${b.author}. Lead with the central thesis in one sentence. Then: 5 key insights, the strongest evidence, what critics miss, and the single most important takeaway for CB (Houston BD professional building passive income and longevity). Format with clear headers. Be decisive.`,
  concepts:  (b) => `Extract the 7 core mental models and frameworks from "${b.title}" by ${b.author}. For each: (1) Name and 1-sentence definition, (2) How the author uses it, (3) How CB can apply it immediately. Be concrete.`,
  apply:     (b) => `How does "${b.title}" by ${b.author} apply directly to CB's life? Focus on: BD pipeline building, real estate deals, passive income strategy, health/longevity, and mental toughness. Give 6 specific, actionable applications. Be blunt.`,
  quotes:    (b) => `Give me the 8 most powerful, memorable passages or quotes from "${b.title}" by ${b.author}. For each: the exact quote (or close paraphrase), and 1 sentence on why it matters for CB's world.`,
  quiz:      (b) => `Create a 5-question Socratic quiz on "${b.title}" by ${b.author}. Make questions progressively deeper — from recall to synthesis. After each question, give the ideal answer. Aim to expose gaps in understanding, not just test memory.`,
  discuss:   (b) => `Let's discuss "${b.title}" by ${b.author}. Give me: (1) The book's strongest argument, (2) The most valid critique or counterargument, (3) What the author got wrong or oversimplified, (4) How the book connects to today's world. Be intellectually honest.`,
};

export default function BookClub() {
  const { isMobile, isPhone, isTablet, isDesktop, openStudio } = useApp();
  // Lens is remembered PER BOOK — a work-framed read of one title shouldn't
  // reset the personal framing chosen for another. Stored as { [bookId]: lensId }.
  const [lensByBook, setLensByBook] = useState(() => readLocal(LENS_KEY, {}));
  const [isGuide, setIsGuide] = useState(false);
  const [guideCards, setGuideCards] = useState(0);
  const [copied, setCopied] = useState(false);
  // Generated study guides, keyed by book id, so a guide is never lost on refresh
  // (regenerable, but persisted). { [bookId]: { bookId, bookTitle, lens, provider, body, cards, createdAt } }
  const [guides, setGuides] = useState(() => readLocal(STUDY_GUIDES_KEY, {}));
  const [guideErr, setGuideErr] = useState('');
  const [guideLens, setGuideLens] = useState('both'); // lens the displayed guide was generated with
  // Epistemic depth for the guide — binds to the shared rigor layer. Default deep
  // (evidence + sources + lineage + "Where This Breaks Down"); dial to expert for
  // the disconfirming test + friction, or down to standard/surface.
  const [depth, setDepth] = useState('deep');
  const [readNext, setReadNext] = useState([]); // networked "read next" recs for the current guide
  const [pruned, setPruned] = useState([]); // junk concepts swept from the graph on mount (reported once)
  // Per-chapter deep dives + read/dived progress, keyed by book id.
  const [chapterDives, setChapterDives] = useState(() => readLocal(CHAPTER_DIVES_KEY, {}));
  const [chapterProgress, setChapterProgress] = useState(() => readLocal(CHAPTER_PROGRESS_KEY, {}));
  const [openChapter, setOpenChapter] = useState(null);   // idx currently expanded
  const [chapterLoading, setChapterLoading] = useState(null); // idx generating
  const [tocOpen, setTocOpen] = useState(true);
  // Catalog verification for the selected book. status: idle|loading|done|none
  const [verify, setVerify] = useState({ status: 'idle', matches: [], idx: 0, attempts: [] });
  // Automated TOC retrieval in flight for the selected book.
  const [retrieving, setRetrieving] = useState(false);
  // Grounding gate: a post-cutoff book with no chapter list blocks generation
  // until the user chooses (search harder / paste / continue ungrounded).
  const [needsGrounding, setNeedsGrounding] = useState(false);
  const [proceedUngrounded, setProceedUngrounded] = useState(false);

  const [tab,          setTab]          = useState('library'); // library | add | dive
  const [search,       setSearch]       = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [mode,         setMode]         = useState('overview');
  const [result,       setResult]       = useState('');
  const [resultProvider, setResultProvider] = useState('');
  const [vaulted, setVaulted] = useState(false);
  const [loading,      setLoading]      = useState(false);

  // Stored library is the single source of truth (built-ins + custom). KNOWN_BOOKS
  // is only a seed.
  const [books,     setBooks]     = useState(() => readLocal(BOOKCLUB_KEY, []).map(withId));
  const [saveError, setSaveError] = useState('');
  const [saving,    setSaving]    = useState(false);

  // Edit form doubles as the add form. editingId = null → adding.
  const [form,      setForm]      = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);

  // Seed on first run + migrate custom-only libraries. Guarded by SEEDED_KEY so
  // it can never double-seed (or resurrect a built-in the user deleted).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lib    = readLocal(BOOKCLUB_KEY, null);
      let seeded = readLocal(SEEDED_KEY, false);
      // Server copy is authoritative when present (cross-device).
      const [remoteLib, remoteSeeded] = await Promise.all([hydrate(BOOKCLUB_KEY), hydrate(SEEDED_KEY)]);
      if (Array.isArray(remoteLib)) lib = remoteLib;
      if (remoteSeeded === true) seeded = true;
      lib = (Array.isArray(lib) ? lib : []).map(withId);

      if (!seeded) {
        if (lib.length === 0) {
          lib = seedBooks();                       // fresh install
        } else if (!lib.some((b) => b.builtin)) {
          // Existing custom-only library — merge the seed in, don't overwrite.
          const present = new Set(lib.map(keyOf));
          lib = [...lib, ...seedBooks().filter((s) => !present.has(keyOf(s)))];
        }
        writeThrough(BOOKCLUB_KEY, lib);           // fire-and-forget seed write
        writeThrough(SEEDED_KEY, true);
      }
      if (!cancelled) setBooks(lib);
      // Server copies of the per-book lens map + saved study guides are
      // authoritative when present (cross-device).
      const [remoteLens, remoteGuides, remoteDives, remoteProg] = await Promise.all([hydrate(LENS_KEY), hydrate(STUDY_GUIDES_KEY), hydrate(CHAPTER_DIVES_KEY), hydrate(CHAPTER_PROGRESS_KEY)]);
      if (!cancelled && remoteLens && typeof remoteLens === 'object') setLensByBook(remoteLens);
      if (!cancelled && remoteGuides && typeof remoteGuides === 'object') setGuides(remoteGuides);
      if (!cancelled && remoteDives && typeof remoteDives === 'object') setChapterDives(remoteDives);
      if (!cancelled && remoteProg && typeof remoteProg === 'object') setChapterProgress(remoteProg);
      // Sweep the knowledge graph of section-label junk logged by earlier guide
      // generations ("What it is", "Worked Example") so it stops feeding back into
      // study-guide context as fake tracked skills. Report what it removed.
      try {
        const { removed } = await pruneJunkConcepts();
        // Report what the sweep actually removed — both in-app (banner) and to the
        // console, so a residual junk concept can be traced on the next run.
        console.info('[graph] pruneJunkConcepts removed:', removed && removed.length ? removed : '(nothing)');
        if (!cancelled && removed && removed.length) setPruned(removed);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = search
    ? books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(search.toLowerCase()))
    : books;

  // Persist-first: await the write and only commit to state if the on-device
  // write succeeded, so a failed save surfaces an error instead of showing a
  // book that vanishes on refresh. Server-sync degradation (503/5xx) is handled
  // by the global TopBar indicator, not blocked here. Returns true on success.
  const persist = async (next) => {
    setSaving(true);
    const r = await writeThrough(BOOKCLUB_KEY, next);
    setSaving(false);
    if (!r.localOk) {
      setSaveError('Could not save your library — on-device storage is full or blocked. Your change was not persisted.');
      return false;
    }
    setBooks(next);
    setSaveError('');
    return true;
  };

  // ── Catalog verification ──────────────────────────────────────────────────
  // On selecting an unverified book, look it up in a real catalog so the guide is
  // grounded in the actual title, not the model's guess. Skips already-verified
  // books (metadata is stored on the record).
  useEffect(() => {
    if (!selectedBook || selectedBook.verified) { setVerify({ status: 'idle', matches: [], idx: 0, attempts: [] }); return; }
    let cancelled = false;
    setVerify({ status: 'loading', matches: [], idx: 0, attempts: [] });
    (async () => {
      const { matches, attempts, confident } = await verifyBook({ title: selectedBook.title, author: selectedBook.author });
      if (cancelled) return;
      setVerify({ status: matches.length ? 'done' : 'none', matches, idx: 0, attempts, confident });
    })();
    return () => { cancelled = true; };
  }, [selectedBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Automated TOC retrieval for a post-cutoff book that has NOTHING yet — the
  // model can't reach its contents, so the tool works to find the structure
  // itself before ever asking the user to type. Runs ONCE per book: cached
  // permanently (retrievedTOC) on a hit, and a `retrievalState` marker on a miss
  // so it never re-fetches a book already resolved (item 6).
  useEffect(() => {
    // A new book resets the grounding gate.
    setNeedsGrounding(false); setProceedUngrounded(false);
    if (!selectedBook || !selectedBook.postCutoff) return;
    if (selectedBook.userGrounding || selectedBook.retrievedTOC || selectedBook.retrievalState || retrieving) return;
    runRetrievalChain(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBook?.id]);

  const confirmVerification = async () => {
    const m = verify.matches[verify.idx];
    if (!m || !selectedBook) return;
    const rec = toVerifiedRecord(m);
    const next = books.map((b) => (b.id === selectedBook.id ? { ...b, ...rec } : b));
    if (await persist(next)) {
      setSelectedBook({ ...selectedBook, ...rec });
      setVerify({ status: 'idle', matches: [], idx: 0 });
    }
  };
  const nextMatch = () => setVerify((v) => ({ ...v, idx: (v.idx + 1) % Math.max(1, v.matches.length) }));
  const skipVerification = () => setVerify({ status: 'idle', matches: [], idx: 0 });
  const reverify = () => {
    if (!selectedBook) return;
    const next = books.map((b) => (b.id === selectedBook.id ? { ...b, verified: false } : b));
    setBooks(next); writeThrough(BOOKCLUB_KEY, next);
    setSelectedBook({ ...selectedBook, verified: false });
  };

  // ── Source grounding: user-supplied copy + automated TOC retrieval ──────────
  // Both live on the book record (persisted). userGrounding is the reader's own
  // material (authoritative); retrievedTOC is what the automated chain found.
  const patchBook = async (patch) => {
    if (!selectedBook) return;
    const next = books.map((b) => (b.id === selectedBook.id ? { ...b, ...patch } : b));
    if (await persist(next)) setSelectedBook({ ...selectedBook, ...patch });
  };
  const saveUserGrounding = (ug) => patchBook({ userGrounding: ug });
  const clearUserGrounding = () => patchBook({ userGrounding: null });
  // The web pass the retrieval chain uses — a callClaude wrapper. Takes (query,
  // system) so each batched query can carry the structured-output instruction.
  const webPass = (q, system) => callClaude({
    system: system || 'You extract a book’s chapter structure from current web sources. Return only the chapter titles in order, or exactly NOT FOUND.',
    messages: [{ role: 'user', content: q }], job: 'web', maxTokens: 700,
  });
  // Run the multi-source chain. `deep` (Search harder) widens Open Library to more
  // editions and fires the full web batch incl. the publisher domain. A hit caches
  // the TOC permanently; a miss records the state + the attempt log so retrieval
  // never re-runs for a resolved book and the failure can report what it tried.
  const runRetrievalChain = async (deep = false) => {
    if (!selectedBook || retrieving) return;
    setRetrieving(true);
    try {
      const { toc, attempts } = await retrieveTOC({ title: selectedBook.title, author: selectedBook.author, webPass, publisher: selectedBook.publisher || '', deep });
      if (toc) await patchBook({ retrievedTOC: toc, retrievalState: 'found', retrievalAttempts: attempts });
      else await patchBook({ retrievalState: deep ? 'deep-none' : 'none', retrievalAttempts: attempts });
    } catch { await patchBook({ retrievalState: deep ? 'deep-none' : 'none' }); }
    setRetrieving(false);
  };

  // ── Chapter dives + per-chapter progress (awaited/revert) ──────────────────
  const persistChapterDives = async (next) => {
    const prev = chapterDives; setChapterDives(next);
    const r = await writeThrough(CHAPTER_DIVES_KEY, next);
    if (!r.localOk) { setChapterDives(prev); return false; }
    return true;
  };
  const toggleChapterRead = async (idx) => {
    if (!selectedBook) return;
    const bid = selectedBook.id;
    const prev = chapterProgress;
    const wasRead = !!chapterProgress[bid]?.[idx]?.read;
    const next = { ...chapterProgress, [bid]: { ...(chapterProgress[bid] || {}), [idx]: { ...(chapterProgress[bid]?.[idx] || {}), read: !wasRead } } };
    setChapterProgress(next);
    const r = await writeThrough(CHAPTER_PROGRESS_KEY, next);
    if (!r.localOk) setChapterProgress(prev);
  };
  const generateChapterDive = async (idx) => {
    if (!selectedBook || chapterLoading != null) return;
    const { chapters, tier } = chaptersOf(selectedBook);
    const chapter = chapters[idx];
    if (!chapter) return;
    setChapterLoading(idx); setOpenChapter(idx);
    let provider = '';
    try {
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: buildChapterPrompt(selectedBook, chapter, idx, lensClauseOf(lens), tier) }],
        maxTokens: 1600, job: 'reason', onProvider: (p) => { provider = p; },
      });
      // Cap at the STRUCTURE tier — the chapter title can hold [verified]/[reported]
      // while the analysis the model marked [inferred] stays inferred.
      const body = capTierMarkers(reply.trim(), tier || 'inferred', { reportedSource: `${selectedBook.fullTitle || selectedBook.title}, Ch. ${idx + 1}` });
      const bid = selectedBook.id;
      const dive = { body, provider, lens, chapter, structureTier: tier, createdAt: Date.now(), ...stampVersion('studyGuide') };
      await persistChapterDives({ ...chapterDives, [bid]: { ...(chapterDives[bid] || {}), [idx]: dive } });
      // Mark dived in progress.
      const nextProg = { ...chapterProgress, [bid]: { ...(chapterProgress[bid] || {}), [idx]: { ...(chapterProgress[bid]?.[idx] || {}), dived: true } } };
      setChapterProgress(nextProg); writeThrough(CHAPTER_PROGRESS_KEY, nextProg);
      // Chapter-level graph signal: source = book, ref carries the chapter location
      // so Skills sees per-chapter progress, not one lump observation per book.
      logConcept({ topic: `${selectedBook.title} — ${chapter}`, source: selectedBook.title, module: 'books', confidence: 5, refs: [selectedBook.title, `Ch. ${idx + 1}`] });
    } catch (e) {
      const bid = selectedBook.id;
      await persistChapterDives({ ...chapterDives, [bid]: { ...(chapterDives[bid] || {}), [idx]: { body: `Couldn't generate this chapter dive. ${e?.message || 'Providers unavailable.'}`, error: true, createdAt: Date.now() } } });
    }
    setChapterLoading(null);
  };

  // Per-book lens, defaulting to Both. Persist through the awaited/revert path so
  // a failed on-device write doesn't silently drop the choice.
  const lens = selectedBook ? (lensByBook[selectedBook.id] || 'both') : 'both';
  const setBookLens = async (id) => {
    if (!selectedBook) return;
    const prev = lensByBook;
    const next = { ...lensByBook, [selectedBook.id]: id };
    setLensByBook(next);
    const r = await writeThrough(LENS_KEY, next);
    if (!r.localOk) setLensByBook(prev);
  };

  const openAdd = () => { setEditingId(null); setForm(BLANK_FORM); setSaveError(''); setTab('add'); };
  const openEdit = (book) => {
    setEditingId(book.id);
    setForm({ title: book.title, author: book.author, note: book.note || '', type: book.type || 'other' });
    setSaveError('');
    setTab('add');
  };

  const saveBook = async () => {
    if (!form.title.trim() || saving) return;
    const fields = {
      title:  form.title.trim(),
      author: form.author.trim() || 'Unknown',
      note:   form.note.trim(),
      type:   form.type || 'other',
    };
    const next = editingId
      ? books.map((b) => (b.id === editingId ? { ...b, ...fields } : b))
      : [...books, { id: uid(), builtin: false, ...fields }];
    if (await persist(next)) {
      setForm(BLANK_FORM);
      setEditingId(null);
      setTab('library');
    }
  };

  const removeBook = async (book) => {
    if (saving) return;
    if (!window.confirm(`Remove "${book.title}" from your library?`)) return;
    if (selectedBook?.id === book.id) { setSelectedBook(null); setResult(''); }
    await persist(books.filter((b) => b.id !== book.id));
  };

  // Re-add any missing built-ins without touching custom entries or edits.
  const restoreDefaults = async () => {
    if (saving) return;
    const present = new Set(books.map(keyOf));
    const additions = seedBooks().filter((s) => !present.has(keyOf(s)));
    if (additions.length === 0) { setSaveError(''); return; }
    await persist([...books, ...additions]);
  };

  const handleDeepDiveFor = async (modeId) => {
    if (!selectedBook) return;
    setLoading(true);
    setResult('');
    setResultProvider('');
    setVaulted(false);
    setIsGuide(false);
    try {
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: `${PROMPTS[modeId](selectedBook)}\n\nLENS: ${lensClauseOf(lens)}` }],
        maxTokens: 1400,
        job: 'reason',
        onProvider: setResultProvider,
      });
      setResult(reply);
      // Record the book as a concept so it connects to research, quizzes, and
      // notes on the same subject.
      logConcept({ topic: selectedBook.title, source: selectedBook.title, module: 'books', refs: selectedBook.author ? [selectedBook.author] : [] });
    } catch (e) {
      // Surface the real cause (which providers were tried and why) instead of
      // pointing the user at their wifi. callClaude throws with the server's body.
      setResult(`Couldn't generate this. ${e?.message || 'The AI providers were unavailable.'}`);
    }
    setLoading(false);
  };
  const handleDeepDive = () => handleDeepDiveFor(mode);

  // The study-guide engine: a full guide (thesis → frameworks → worked example
  // in the chosen lens → application prompts → field summary), a self-quiz that
  // writes cards straight to the Vault, and a hand-off to Creation Studio so the
  // guide is downloadable.
  // Networked "read next": 4–6 works that deepen / contradict / precede this one,
  // primary sources preferred, cross-referenced against the library so anything
  // already owned is flagged rather than re-recommended.
  const generateReadNext = async (book, grounding) => {
    try {
      const reply = await callClaude({
        system: 'You recommend books as a rigorous librarian. Prefer PRIMARY sources over derivative popular titles. Output ONLY a JSON array, no prose.',
        messages: [{ role: 'user', content: `For a reader who just studied "${grounding.fullTitle || book.title}"${book.author ? ` by ${book.author}` : ''}, recommend 4-6 works that DEEPEN, CONTRADICT, or PRECEDE it (a networked reading map, not a generic list). Prefer primary sources. Return ONLY JSON: [{"title","author","relation":"deepens|contradicts|precedes","reason":"one line"}].` }],
        job: 'reason',
        maxTokens: 900,
      });
      let text = reply.replace(/```json|```/gi, '').trim();
      const s = text.indexOf('['), e = text.lastIndexOf(']');
      if (s !== -1 && e > s) text = text.slice(s, e + 1);
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) return [];
      const owned = new Set(books.map((b) => `${(b.title || '').toLowerCase().trim()}|${(b.author || '').toLowerCase().trim()}`));
      const ownedTitle = new Set(books.map((b) => (b.title || '').toLowerCase().trim()));
      return arr.slice(0, 6).map((r) => ({
        title: String(r.title || '').trim(),
        author: String(r.author || '').trim(),
        relation: ['deepens', 'contradicts', 'precedes'].includes(r.relation) ? r.relation : 'deepens',
        reason: String(r.reason || '').trim(),
        owned: owned.has(`${String(r.title || '').toLowerCase().trim()}|${String(r.author || '').toLowerCase().trim()}`) || ownedTitle.has(String(r.title || '').toLowerCase().trim()),
      })).filter((r) => r.title);
    } catch { return []; }
  };

  const generateGuide = async ({ ungrounded = false } = {}) => {
    if (!selectedBook) return;
    // Grounding gate — a post-cutoff book the model can't reach, with no retrieved
    // TOC and no user copy, must NOT silently generate ungrounded. Block until the
    // user chooses: Search harder, paste their copy, or explicitly continue
    // ungrounded. (A verified/known book, or one already grounded, skips the gate.)
    const needsG = selectedBook.postCutoff && !selectedBook.userGrounding && !selectedBook.retrievedTOC;
    if (needsG && !proceedUngrounded && !ungrounded) {
      setNeedsGrounding(true);
      // Kick off a light retrieval if we haven't tried yet, so the choice is live.
      if (!selectedBook.retrievalState && !retrieving) runRetrievalChain(false);
      return;
    }
    setNeedsGrounding(false);
    setMode('guide'); setIsGuide(true); setLoading(true); setResult(''); setResultProvider(''); setVaulted(false); setGuideCards(0); setGuideErr(''); setGuideLens(lens); setReadNext([]);
    let provider = '';
    try {
      // Grounding is the single change that stops the model inventing a thesis
      // for a book it doesn't know. Verified catalog description always; for a
      // post-cutoff book, a live web pass first to retrieve the real thesis.
      // Source material the user typed from their copy, and any retrieved TOC.
      const ug = selectedBook.userGrounding || null;
      const rtoc = selectedBook.retrievedTOC || null;
      // A chapter list comes from a user TOC/photo transcription, else the
      // retrieved TOC. Excerpt/notes are injected as material but don't drive the
      // chapter-by-chapter structure.
      const userTocText = ug && ['toc', 'photo-ocr'].includes(ug.type) ? ug.text : '';
      const tocChapters = parseTOC(userTocText || rtoc?.toc || '');
      const tocIsUser = !!userTocText;
      const userMaterial = ug && ['excerpt', 'notes'].includes(ug.type) ? ug.text : '';
      const grounding = {
        fullTitle: selectedBook.fullTitle || selectedBook.title,
        publishedDate: selectedBook.publishedDate || '',
        description: selectedBook.description || '',
        webThesis: '',
        // Existence, tracked separately from contents: a confirmed catalog match
        // means the book EXISTS even with no description and a NOT FOUND web pass.
        verified: !!selectedBook.verified,
        source: selectedBook.source || '',
        // User-supplied + retrieved source material.
        tocChapters,
        tocIsUser,
        tocSourceLabel: tocIsUser ? 'your copy' : (rtoc?.sourceLabel || ''),
        userMaterial,
        userMaterialLabel: ug ? groundingTypeMeta(ug.type).label : '',
        // Grounding ceiling — verified only when the reader supplied a physical copy.
        tier: groundingTier({ userGrounding: ug, retrievedTOC: rtoc, hasContents: !!selectedBook.description }),
      };
      if (selectedBook.postCutoff) {
        setResult('Retrieving this book’s actual thesis from the web (published after the model’s cutoff)…');
        try {
          grounding.webThesis = await callClaude({
            system: 'You retrieve factual information about a specific book from current sources. Report only what is actually about THIS title — never substitute the author’s other books, even by the same author. If you cannot find THIS specific book, reply exactly NOT FOUND (do not answer from a similarly-titled or better-known book).',
            messages: [{ role: 'user', content: `For the book "${grounding.fullTitle}" by ${selectedBook.author}${grounding.publishedDate ? ` (published ${grounding.publishedDate})` : ''}, report, using current sources about THIS title specifically:\n1. Its actual core thesis (1–2 sentences).\n2. Its chapter or section structure.\n3. The NAMED frameworks, models, or key concepts it introduces — the actual terms this book uses.\nBe concise and factual. If you cannot confirm these for THIS specific title, reply exactly NOT FOUND.` }],
            job: 'web',
            maxTokens: 1200,
          });
          if (/^\s*NOT FOUND/i.test(grounding.webThesis)) grounding.webThesis = '';
        } catch { /* web pass is best-effort; description still grounds it */ }
        setResult('');
      }
      // Recompute the tier ceiling now that the web pass has (maybe) run — a
      // retrieved web thesis is `reported`-grade grounding even with no description.
      grounding.tier = groundingTier({ userGrounding: ug, retrievedTOC: rtoc, hasContents: !!(grounding.description || grounding.webThesis) });
      // Stream it: a 6000-token guide runs for tens of seconds, so we show it
      // building (and, critically, streaming means it can't hit a single blocking
      // wall-clock abort mid-generation). The trailing ---CARDS--- JSON is hidden
      // from the live view; callClaude still returns the full text to parse.
      let acc = '';
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: buildGuidePrompt(selectedBook, lensClauseOf(lens), buildStudyContext(), grounding, depth) }],
        // High ceiling — a real six-section guide plus 8–10 cards. The old 1500
        // cap is why this produced stubs.
        maxTokens: 6000,
        job: 'reason',
        onProvider: (p) => { provider = p; setResultProvider(p); },
        onToken: (t) => { acc += t; setResult(acc.split('---CARDS---')[0].trim()); },
      });
      const [rawBody, cardsRaw] = reply.split('---CARDS---');
      // Enforce the tier ceiling. `verified` is honest ONLY when the reader
      // supplied a copy from the book (grounding.tier === 'verified'); otherwise
      // cap at 'reported' (grounded) or 'inferred'. A model over-claims however
      // firmly the prompt forbids it — this rewrite is the guarantee.
      const body = capTierMarkers(rawBody.trim(), grounding.tier, { reportedSource: grounding.fullTitle || selectedBook.title });
      setResult(body);
      const added = parseAndVaultCards(cardsRaw, selectedBook);
      setGuideCards(added);
      // Networked read-next; if the model returns nothing parseable, fall back to
      // the curated graph recommender so the guide always ships a reading map.
      let recs = await generateReadNext(selectedBook, grounding);
      if (!recs.length) {
        try {
          recs = recommendBooks({ library: books, lens }).slice(0, 6).map((r) => ({
            title: r.title, author: r.author || '', relation: 'deepens', reason: r.reason || '', owned: false,
          })).filter((r) => r.title);
        } catch {}
      }
      setReadNext(recs);
      // Persist the guide so it survives a refresh (regenerable, never lost).
      // Awaited/revert: a failed on-device write surfaces an error, doesn't vanish.
      await persistGuide({ bookId: selectedBook.id, bookTitle: selectedBook.title, lens, depth, provider, body, cards: added, readNext: recs, verified: !!selectedBook.verified, postCutoff: !!selectedBook.postCutoff, grounded: !!(grounding.description || grounding.webThesis), createdAt: Date.now(), ...stampVersion('studyGuide') });
      logConcept({ topic: selectedBook.title, source: selectedBook.title, module: 'books', confidence: 6, refs: selectedBook.author ? [selectedBook.author] : [] });
      // Each framework the guide names becomes its own concept, sharing the book
      // as source so they interlink and surface in Connected Knowledge. Awaited
      // in sequence so the concurrent read-modify-writes don't clobber each other.
      for (const fw of extractFrameworks(body)) {
        await logConcept({ topic: fw, source: selectedBook.title, module: 'books', confidence: 5, refs: [selectedBook.title] });
      }
    } catch (e) {
      // Real cause, not "check your connection" — the study guide runs job:'reason'
      // and the server error names which providers failed and why.
      setResult(`Couldn't generate the study guide. ${e?.message || 'The AI providers were unavailable.'}`);
    }
    setLoading(false);
  };

  // Awaited/revert persistence for the study-guide map. Keeps the optimistic
  // local write; reverts and reports if the on-device write fails.
  const persistGuide = async (guide) => {
    const prev = guides;
    const next = { ...guides, [guide.bookId]: guide };
    setGuides(next);
    const r = await writeThrough(STUDY_GUIDES_KEY, next);
    if (!r.localOk) { setGuides(prev); setGuideErr('Could not save the study guide on-device — it was not persisted.'); return false; }
    setGuideErr('');
    return true;
  };

  // Load a previously saved guide back into the reader without regenerating.
  const savedGuide = selectedBook ? guides[selectedBook.id] : null;
  const viewSavedGuide = () => {
    if (!savedGuide) return;
    setMode('guide'); setIsGuide(true); setResult(savedGuide.body); setResultProvider(savedGuide.provider || ''); setGuideCards(savedGuide.cards || 0); setVaulted(false); setGuideErr(''); setGuideLens(savedGuide.lens || 'both'); setReadNext(savedGuide.readNext || []);
    if (savedGuide.depth) setDepth(savedGuide.depth);
  };

  // Persist a generated diagram onto its parent guide so it saves + exports with
  // it (awaited/revert via persistGuide).
  const saveGuideDiagram = async (mermaidCode) => {
    if (!selectedBook) return;
    const g = guides[selectedBook.id] || { bookId: selectedBook.id, bookTitle: selectedBook.title, lens: guideLens, provider: resultProvider, body: result, cards: guideCards, createdAt: Date.now() };
    await persistGuide({ ...g, diagram: mermaidCode });
  };

  const guideMarkdown = () => {
    const dgm = savedGuide?.diagram ? `\n\n## Diagram\n\n\`\`\`mermaid\n${savedGuide.diagram}\n\`\`\`\n` : '';
    return `# ${selectedBook.fullTitle || selectedBook.title} — Study Guide\n\n${result}${dgm}`;
  };
  const copyGuide = async () => {
    try { await navigator.clipboard.writeText(guideMarkdown()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };
  const downloadGuide = () => {
    const blob = new Blob([guideMarkdown()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedBook.title || 'study-guide').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-study-guide.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const sendGuideToStudio = () => {
    if (!result) return;
    openStudio({ kind: 'guide', title: `${selectedBook.title} — Study Guide`, text: guideMarkdown() });
  };

  const pad     = isPhone ? '14px' : isMobile ? '16px' : isTablet ? '22px' : '28px';
  const gridCol = isPhone ? 'repeat(2,1fr)' : isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(4,1fr)';
  const modeCol = isPhone ? 'repeat(2,1fr)' : 'repeat(3,1fr)';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: isMobile ? 80 : 60 }}>

      {/* Header */}
      <div style={{ padding: `${pad} ${pad} 0`, marginBottom: 20 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 4 }}>Intelligence Hub</div>
        <div style={{ fontSize: isMobile ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text)', fontFamily: "'Newsreader', serif", letterSpacing: -0.5 }}>
          📖 Book Club
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginTop: 5 }}>
          Research, deep dive, and master any book with AI — connected to CB's mental model library
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: `0 ${pad}`, display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[{ id: 'library', label: '📚 Library' }, { id: 'add', label: editingId ? '✎ Edit Book' : '+ Add Book' }, { id: 'dive', label: '🤿 Deep Dive' }].map(t => (
          <button key={t.id} onClick={() => (t.id === 'add' ? (editingId ? setTab('add') : openAdd()) : setTab(t.id))}
            style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${tab === t.id ? T.accent : 'var(--border)'}`, background: tab === t.id ? withAlpha(T.accent, 10) : 'transparent', color: tab === t.id ? T.accent : 'var(--muted)', fontSize: 'var(--fs-base)', fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', whiteSpace: 'nowrap', minHeight: 36 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: `0 ${pad}` }}>

        {/* Graph cleanup report — what the junk-concept sweep removed on mount. */}
        {pruned.length > 0 && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: withAlpha(T.caution, 10), border: `1px solid ${withAlpha(T.caution, 40)}`, borderRadius: 10, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
            <span>🧹 Cleaned {pruned.length} polluted concept{pruned.length === 1 ? '' : 's'} from the knowledge graph (markdown section labels wrongly tracked as skills): <b>{pruned.slice(0, 8).join(', ')}</b>{pruned.length > 8 ? ` +${pruned.length - 8} more` : ''}.</span>
            <button onClick={() => setPruned([])} style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Dismiss</button>
          </div>
        )}

        {/* Save error — visible wherever the user is. */}
        {saveError && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: withAlpha(T.negative, 10), border: `1px solid ${withAlpha(T.negative, 40)}`, borderRadius: 10, color: T.negative, fontSize: 'var(--fs-base)', fontWeight: 600 }}>
            ⚠ {saveError}
          </div>
        )}

        {/* ── LIBRARY TAB ──────────────────────────────────────────── */}
        {tab === 'library' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or author..."
                style={{ flex: 1, minWidth: 180, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={restoreDefaults} disabled={saving}
                title="Re-add the 20 built-in books that aren't in your library. Custom books are untouched."
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                ↻ Restore default library
              </button>
            </div>

            {/* What to read next — graph-driven, each rec states its reason */}
            {(() => {
              const recs = recommendBooks({ library: books, lens });
              if (recs.length === 0) return null;
              return (
                <div style={{ marginBottom: 20, padding: '14px 16px', border: '1px solid var(--rule)', borderRadius: 12, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Icon name="Sparkles" size={16} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase' }}>What to read next · {LENSES.find(l => l.id === lens)?.label} lens</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                    {recs.map((r) => (
                      <div key={r.title} style={{ padding: '12px 14px', border: '1px solid var(--rule)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-tertiary)', border: '1px solid var(--rule)', borderRadius: 3, padding: '1px 6px' }}>{r.signal}</span>
                          <button onClick={() => persist([...books, { id: uid(), title: r.title, author: r.author, type: r.type }])}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                            <Icon name="Plus" size={13} /> Add
                          </button>
                        </div>
                        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)' }}>{r.title}</div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{r.author}</div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)' }}>{r.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              {filtered.length} Books · Click to Deep Dive
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14 }}>
                <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginBottom: 14 }}>
                  {search ? `No books match "${search}"` : 'No books in your library yet.'}
                </div>
                <button onClick={openAdd}
                  style={{ padding: '9px 20px', background: T.accent, color: T.onAccent, borderRadius: 8, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add a Book
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: gridCol, gap: 10 }}>
              {filtered.map((book) => {
                const isSelected = selectedBook?.id === book.id;
                const c = typeColor(book.type);
                return (
                  <div key={book.id}
                    onClick={() => { setSelectedBook(book); setMode('overview'); setResult(''); setTab('dive'); }}
                    style={{ padding: '14px', background: 'var(--surface)', border: `2px solid ${isSelected ? T.accent : withAlpha(c, 13)}`, borderTop: `3px solid ${c}`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.15s', position: 'relative' }}>
                    <div style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                      {TYPE_META[book.type]?.label || book.type || 'General'}
                    </div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 4 }}>{book.title}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>{book.author}</div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', fontWeight: 700, letterSpacing: 0.5 }}>
                        {book.builtin ? 'BUILT-IN' : 'CUSTOM'}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(book); }}
                          title="Edit"
                          style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px', background: 'transparent', border: 'none', fontFamily: 'inherit' }}>✎</button>
                        <button onClick={(e) => { e.stopPropagation(); removeBook(book); }}
                          title="Remove"
                          style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', cursor: 'pointer', padding: '2px 6px', background: 'transparent', border: 'none', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    </div>

                    {book.note && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 6, lineHeight: 1.4, fontStyle: 'italic' }}>{book.note.slice(0, 60)}{book.note.length > 60 ? '…' : ''}</div>}
                    {(() => {
                      const chs = chaptersOf(book).chapters;
                      if (!chs.length) return null;
                      const dived = Object.values(chapterDives[book.id] || {}).filter((d) => d && !d.error).length;
                      return (
                        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                          <Icon name="ClipboardList" size={12} /> {dived}/{chs.length} chapters dived
                        </div>
                      );
                    })()}
                    <div style={{ marginTop: 10, fontSize: 'var(--fs-sm)', color: T.accent, fontWeight: 700 }}>🤿 Deep Dive →</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ADD / EDIT BOOK TAB ──────────────────────────────────── */}
        {tab === 'add' && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
              {editingId ? 'Edit Book' : 'Add a Book'}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Book Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. The Lean Startup"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Author</label>
              <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="e.g. Eric Ries"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Category</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
                {TYPE_IDS.map(id => (
                  <option key={id} value={id}>{TYPE_META[id]?.label || id}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-c)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Why you're reading it, key questions, context..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 'var(--fs-base)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveBook} disabled={!form.title.trim() || saving}
                style={{ padding: '11px 24px', background: form.title.trim() && !saving ? T.accent : 'var(--surf2)', color: form.title.trim() && !saving ? T.onAccent : 'var(--dim)', borderRadius: 9, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: form.title.trim() && !saving ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add to Library'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setForm(BLANK_FORM); setSaveError(''); setTab('library'); }}
                  style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 9, fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── DEEP DIVE TAB ────────────────────────────────────────── */}
        {tab === 'dive' && (
          <div>
            {!selectedBook ? (
              <div style={{ padding: '24px', background: 'var(--surface)', borderRadius: 14, border: '1px dashed var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 12 }}>📖</div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginBottom: 16 }}>Select a book from the Library to deep dive</div>
                <button onClick={() => setTab('library')}
                  style={{ padding: '9px 20px', background: T.accent, color: T.onAccent, borderRadius: 8, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Browse Library
                </button>
              </div>
            ) : (
              <div>
                {/* Selected book header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--surface)', border: `1px solid ${withAlpha(typeColor(selectedBook.type), 30)}`, borderLeft: `3px solid ${typeColor(selectedBook.type)}`, borderRadius: 12, marginBottom: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {selectedBook.fullTitle || selectedBook.title}
                      {selectedBook.verified && (
                        <span title={`Verified via ${selectedBook.source}${selectedBook.publishedDate ? ` · ${selectedBook.publishedDate}` : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tier-verified)', border: '1px solid var(--tier-verified)', borderRadius: 5, padding: '1px 6px' }}>
                          <Icon name="Check" size={11} /> Verified{selectedBook.postCutoff ? ' · web-grounded' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--muted)', marginTop: 2 }}>
                      {selectedBook.author}{selectedBook.verified && <button onClick={reverify} style={{ marginLeft: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>re-verify</button>}
                    </div>
                  </div>
                  <AskChip type="book" object={selectedBook} />
                  <button onClick={() => { setSelectedBook(null); setResult(''); }}
                    style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', padding: '5px 11px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Change
                  </button>
                </div>

                {/* Catalog verification — grounds the guide in the real book */}
                {!selectedBook.verified && verify.status === 'loading' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                    <ThinkingDots color={T.accent} /> Verifying against Google Books…
                  </div>
                )}
                {!selectedBook.verified && verify.status === 'done' && verify.matches[verify.idx] && (() => {
                  const m = verify.matches[verify.idx];
                  const post = isPostCutoff(m.publishedDate);
                  return (
                    <div style={{ padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${withAlpha(T.accent, 30)}`, borderRadius: 12, marginBottom: 16 }}>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Confirm this book before generating{verify.matches.length > 1 && !verify.confident ? ` · ${verify.matches.length} close matches — check this is the right one` : ''}</div>
                      <div style={{ display: 'flex', gap: 14 }}>
                        {m.thumbnail
                          ? <img src={m.thumbnail} alt="" width={64} style={{ borderRadius: 6, flexShrink: 0, alignSelf: 'flex-start', border: '1px solid var(--border)' }} />
                          : <div style={{ width: 64, height: 92, borderRadius: 6, flexShrink: 0, background: 'var(--surf2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="BookMarked" size={20} style={{ color: 'var(--dim)' }} /></div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)' }}>{[m.title, m.subtitle].filter(Boolean).join(': ')}</div>
                          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginTop: 2 }}>
                            {(m.authors || []).join(', ') || '—'}{m.publishedDate ? ` · ${m.publishedDate}` : ''} · {m.source === 'google' ? 'Google Books' : 'Open Library'}
                          </div>
                          {post && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tier-inferred)', border: '1px solid var(--tier-inferred)', borderRadius: 5, padding: '1px 6px' }}>
                              <Icon name="Globe" size={11} /> Post-cutoff — will web-ground before generating
                            </div>
                          )}
                          {m.description && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 'var(--lh-read)' }}>{m.description.slice(0, 260)}{m.description.length > 260 ? '…' : ''}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <button onClick={confirmVerification} disabled={saving}
                          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: T.accent, color: T.onAccent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
                          ✓ This is the book
                        </button>
                        {verify.matches.length > 1 && (
                          <button onClick={nextMatch}
                            style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
                            Different edition ({verify.idx + 1}/{verify.matches.length})
                          </button>
                        )}
                        <button onClick={skipVerification}
                          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
                          Use without verifying
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {!selectedBook.verified && verify.status === 'none' && (
                  <div style={{ padding: '12px 14px', background: withAlpha(T.negative, 8), border: `1px solid ${withAlpha(T.negative, 35)}`, borderRadius: 10, marginBottom: 16, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                    ⚠ Couldn’t verify this title against a catalog. You can still generate, but the guide will be <b>marked unverified</b> and may drift on a book published after the model’s cutoff. <button onClick={skipVerification} style={{ marginLeft: 6, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Continue anyway</button>
                    {verify.attempts?.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${withAlpha(T.negative, 20)}`, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
                        <span style={{ fontWeight: 700 }}>Tried:</span> {verify.attempts.map((a, i) => (
                          <span key={i}>{i > 0 ? ' · ' : ' '}{a.source} <code style={{ fontFamily: 'inherit' }}>{a.query}</code> → {a.error ? `error ${a.error}` : `${a.results} result${a.results === 1 ? '' : 's'}`}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Grounding gate — generation is blocked on a post-cutoff book
                    with no chapter list until the user chooses. */}
                {needsGrounding && !selectedBook.userGrounding && !selectedBook.retrievedTOC && (
                  <div style={{ marginBottom: 12, padding: '12px 14px', background: withAlpha(T.caution, 10), border: `1px solid ${withAlpha(T.caution, 45)}`, borderRadius: 10, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-read)' }}>
                    <b style={{ color: 'var(--text)' }}>Generation paused — this book has no grounding yet.</b> It published after the model’s training data and no chapter list was found. Search harder or paste your copy’s contents below for a grounded, chapter-by-chapter guide — or continue with an ungrounded (all-<i>inferred</i>) guide.
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => { setProceedUngrounded(true); setNeedsGrounding(false); generateGuide({ ungrounded: true }); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
                        Continue ungrounded →
                      </button>
                    </div>
                  </div>
                )}

                {/* Source material the model can't reach: automated retrieval
                    leads, "Search harder" widens the net, and only after that
                    fails does the manual paste appear (reframed as the exception). */}
                <div style={{ marginBottom: 16 }}>
                  <SourceGrounding
                    value={selectedBook.userGrounding}
                    retrieved={selectedBook.retrievedTOC}
                    onSave={saveUserGrounding}
                    onClear={clearUserGrounding}
                    onRetrieve={() => runRetrievalChain(false)}
                    onSearchHarder={() => runRetrievalChain(true)}
                    retrievable={!selectedBook.postCutoff && !selectedBook.retrievalState}
                    retrieving={retrieving}
                    phase={retrieving ? 'searching' : (selectedBook.retrievedTOC ? 'found' : (selectedBook.retrievalState || 'idle'))}
                    attempts={selectedBook.retrievalAttempts || []}
                    label="I have this book — add the table of contents"
                  />
                </div>

                {/* Table of Contents — first-class: verification the reader can see
                    (the real chapter list, tiered by source) + chapter navigation. */}
                {(() => {
                  const { chapters, tier } = chaptersOf(selectedBook);
                  if (!chapters.length) return null;
                  const bid = selectedBook.id;
                  const dives = chapterDives[bid] || {};
                  const prog = chapterProgress[bid] || {};
                  const divedCount = chapters.filter((_, i) => dives[i] && !dives[i].error).length;
                  const readCount = chapters.filter((_, i) => prog[i]?.read).length;
                  const tone = tier === 'verified' ? 'var(--tier-verified)' : 'var(--tier-reported)';
                  const srcLabel = tier === 'verified' ? 'your copy' : (selectedBook.retrievedTOC?.sourceLabel || 'retrieved');
                  return (
                    <div style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
                      <button onClick={() => setTocOpen((o) => !o)}
                        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                          <Icon name="ClipboardList" size={16} style={{ color: tone }} />
                          <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text)' }}>Table of Contents</span>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tone, border: `1px solid ${tone}`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>structure {tier} · {srcLabel}</span>
                          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{divedCount}/{chapters.length} dived · {readCount} read</span>
                        </span>
                        <Icon name={tocOpen ? 'ChevronUp' : 'ChevronDown'} size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                      </button>
                      {tocOpen && (
                        <div style={{ borderTop: '1px solid var(--rule)' }}>
                          {chapters.map((ch, i) => {
                            const dive = dives[i];
                            const read = !!prog[i]?.read;
                            const isOpen = openChapter === i;
                            const cLoading = chapterLoading === i;
                            return (
                              <div key={i} style={{ borderBottom: '1px solid var(--rule)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                                  <button onClick={() => toggleChapterRead(i)} title={read ? 'Read' : 'Mark read'}
                                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${read ? T.accent : 'var(--border)'}`, background: read ? T.accent : 'transparent', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                    {read && <Icon name="Check" size={13} />}
                                  </button>
                                  <button onClick={() => { const next = isOpen ? null : i; setOpenChapter(next); if (next != null && !dive && !cLoading) generateChapterDive(i); }}
                                    style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
                                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                                    <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text)', fontWeight: dive && !dive.error ? 700 : 500, lineHeight: 'var(--lh-tight)' }}>{ch}</span>
                                    {dive && !dive.error && <Icon name="BookOpen" size={13} style={{ color: T.accent, flexShrink: 0 }} />}
                                  </button>
                                  <button onClick={() => { setOpenChapter(i); generateChapterDive(i); }} disabled={cLoading}
                                    style={{ flexShrink: 0, fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 10px', cursor: cLoading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                                    {cLoading ? '…' : dive && !dive.error ? 'Redive' : 'Dive'}
                                  </button>
                                </div>
                                {isOpen && (
                                  <div style={{ padding: '0 14px 14px', background: 'var(--bg)' }}>
                                    {cLoading ? <ThinkingDots color={T.accent} /> : dive ? (
                                      <div>
                                        {dive.provider && <div style={{ marginBottom: 6 }}><ProviderTag provider={dive.provider} /></div>}
                                        <MD text={dive.body} color={T.accent} />
                                        {!dive.error && isStale(dive, 'studyGuide') && (
                                          <button onClick={() => generateChapterDive(i)}
                                            style={{ marginTop: 8, fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: 'none', border: `1px solid ${T.accent}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            Regenerate (prompt updated)
                                          </button>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Life-application lens + the full study-guide engine */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>Lens</span>
                    {LENSES.map((l) => {
                      const on = lens === l.id;
                      return (
                        <button key={l.id} onClick={() => setBookLens(l.id)} title={l.clause}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1px solid ${on ? T.accent : 'var(--border)'}`, background: on ? withAlpha(T.accent, 10) : 'transparent', color: on ? T.accent : 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
                          <Icon name={l.icon} size={14} /> {l.label}
                        </button>
                      );
                    })}
                    <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginLeft: 8 }} title="Epistemic depth: surface=tier chips · standard=+evidence/sources · deep=+lineage/where-it-breaks-down · expert=+disconfirming test/friction">Rigor</span>
                    {DEPTHS.map((d) => {
                      const on = depth === d;
                      return (
                        <button key={d} onClick={() => setDepth(d)} title={`Rigor: ${DEPTH_LABELS[d]}`}
                          style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${on ? T.accent : 'var(--border)'}`, background: on ? withAlpha(T.accent, 10) : 'transparent', color: on ? T.accent : 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
                          {DEPTH_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => generateGuide()} disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', background: loading ? 'var(--surf2)' : T.accent, color: loading ? 'var(--dim)' : T.onAccent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
                    <Icon name="BookOpen" size={14} /> {savedGuide ? 'Regenerate Study Guide' : 'Generate Study Guide'}
                  </button>
                </div>

                {/* A saved guide is one click away — never lost on refresh. */}
                {savedGuide && !(isGuide && result) && (() => {
                  const stale = isStale(savedGuide, 'studyGuide');
                  const tone = stale ? T.tierInferred : T.accent;
                  return (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: withAlpha(tone, 8), border: `1px solid ${withAlpha(tone, 30)}`, borderRadius: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                        <Icon name={stale ? 'AlertTriangle' : 'BookOpen'} size={14} style={{ color: tone }} />
                        Saved study guide · {LENSES.find((l) => l.id === savedGuide.lens)?.label || 'Both'} lens · {versionLabel(savedGuide)}
                        {stale && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tone, border: `1px solid ${tone}`, borderRadius: 5, padding: '1px 6px' }}>prompt updated → regenerate (v{PROMPT_VERSION.studyGuide})</span>}
                      </span>
                      <span style={{ display: 'inline-flex', gap: 8 }}>
                        <button onClick={viewSavedGuide}
                          style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
                          View guide
                        </button>
                        {stale && (
                          <button onClick={() => generateGuide()} disabled={loading}
                            style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.onAccent, background: T.accent, border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
                            Regenerate
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })()}
                {guideErr && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: withAlpha(T.negative, 10), border: `1px solid ${withAlpha(T.negative, 40)}`, borderRadius: 10, color: T.negative, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                    ⚠ {guideErr}
                  </div>
                )}

                {/* Study mode grid */}
                <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Choose Study Mode — click any to generate instantly</div>
                <div style={{ display: 'grid', gridTemplateColumns: modeCol, gap: 8, marginBottom: 20 }}>
                  {STUDY_MODES.map(m => (
                    <button key={m.id} onClick={() => { setMode(m.id); setResult(''); handleDeepDiveFor(m.id); }}
                      style={{ padding: '12px 14px', textAlign: 'left', background: mode === m.id ? withAlpha(T.accent, 12) : 'var(--surface)', border: `1px solid ${mode === m.id ? T.accent : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', transition: 'all 0.12s', minHeight: 72 }}>
                      <Icon name={m.icon} size="header" style={{ color: mode === m.id ? T.accent : 'var(--text-tertiary)' }} />
                      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: mode === m.id ? T.accent : 'var(--text)', marginTop: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
                    </button>
                  ))}
                </div>

                {!isGuide && (
                  <button onClick={handleDeepDive} disabled={loading}
                    style={{ padding: '11px 24px', background: loading ? 'var(--surf2)' : T.accent, color: loading ? 'var(--dim)' : T.onAccent, borderRadius: 9, border: 'none', fontSize: 'var(--fs-base)', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {loading
                      ? 'Generating…'
                      : `🤿 ${STUDY_MODES.find(m => m.id === mode)?.label || 'Overview'} — ${selectedBook.title.slice(0, 28)}${selectedBook.title.length > 28 ? '…' : ''}`
                    }
                  </button>
                )}

                {loading && <ThinkingDots color={T.accent} />}

                {result && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 9, color: T.accent, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{isGuide ? <><Icon name="BookOpen" size={12} /> Study Guide · {LENSES.find(l => l.id === guideLens)?.label} lens</> : <><Icon name={STUDY_MODES.find(m => m.id === mode)?.icon} size={12} /> {STUDY_MODES.find(m => m.id === mode)?.label}</>}</span>
                        </div>
                        <ProviderTag provider={resultProvider} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { createCard({ front: `${selectedBook.title} — ${STUDY_MODES.find(m => m.id === mode)?.label}`, back: result.slice(0, 400), source: selectedBook.title, module: 'books', topic: selectedBook.title }); setVaulted(true); }}
                          style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', background: vaulted ? withAlpha(T.accent, 12) : 'var(--bg)', border: `1px solid ${vaulted ? T.accent : 'var(--border)'}`, borderRadius: 6, color: vaulted ? T.accent : 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          {vaulted ? '✓ In Vault' : '+ Vault'}
                        </button>
                        <SaveToNotes title={`${selectedBook.title} — ${isGuide ? 'Study Guide' : STUDY_MODES.find(m => m.id === mode)?.label}`} content={result} source={{ title: selectedBook.title, tier: 'reported' }} label="Notes" />
                        <button onClick={copyGuide}
                          style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', background: copied ? withAlpha(T.accent, 12) : 'var(--bg)', border: `1px solid ${copied ? T.accent : 'var(--border)'}`, borderRadius: 6, color: copied ? T.accent : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                          {copied ? '✓ Copied' : 'Copy'}
                        </button>
                        {isGuide && (
                          <button onClick={downloadGuide}
                            style={{ fontSize: 'var(--fs-sm)', padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                            ↓ .md
                          </button>
                        )}
                      </div>
                    </div>
                    {isGuide
                      ? <ArtifactSections text={result} color={T.accent} isMobile={isMobile} isDesktop={isDesktop} />
                      : <MD text={result} color={T.accent} />}
                    {isGuide && !loading && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bord2)' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Visualize the frameworks</div>
                        <DiagramBlock
                          // Keyed to the guide's generation stamp so it REMOUNTS
                          // when the guide is regenerated — otherwise the previous
                          // diagram's state persisted and rendered byte-identical
                          // (and wrong) over a new guide. A fresh guide has no saved
                          // diagram, so it auto-draws from the new frameworks.
                          key={`guide-dgm-${savedGuide?.generatedAt || savedGuide?.createdAt || 'live'}`}
                          content={result}
                          hint={`Draw an ANALYTICAL diagram of "${selectedBook.title}" — a causal or tension diagram showing how the key frameworks INTERACT, where they CONFLICT, and the underlying mechanism. Do NOT just restate the section hierarchy or list the frameworks; show the relationships between them.`}
                          initialCode={savedGuide?.diagram || ''}
                          onGenerated={saveGuideDiagram}
                          label="Visualize frameworks"
                          types={['flowchart', 'quadrantChart']}
                          auto={extractFrameworks(result).length >= 2}
                        />
                      </div>
                    )}
                    {isGuide && !loading && readNext.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bord2)' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Read next · networked</div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                          {readNext.map((r, i) => {
                            const relTone = r.relation === 'contradicts' ? 'var(--tier-inferred)' : r.relation === 'precedes' ? 'var(--tier-reported)' : 'var(--tier-verified)';
                            return (
                              <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--rule)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                  <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: relTone, border: `1px solid ${relTone}`, borderRadius: 4, padding: '1px 6px' }}>{r.relation}</span>
                                  {r.owned && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>✓ in library</span>}
                                </div>
                                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)' }}>{r.title}</div>
                                {r.author && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{r.author}</div>}
                                {r.reason && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)' }}>{r.reason}</div>}
                                {!r.owned && (
                                  <button onClick={() => persist([...books, { id: uid(), title: r.title, author: r.author || 'Unknown', type: 'other' }])}
                                    style={{ alignSelf: 'flex-start', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                    <Icon name="Plus" size={13} /> Add to library
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {isGuide && !loading && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bord2)' }}>
                        {guideCards > 0 && (
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: withAlpha(T.accent, 10), border: `1px solid ${withAlpha(T.accent, 30)}`, borderRadius: 20, padding: '4px 12px' }}>
                            ✓ {guideCards} self-quiz card{guideCards === 1 ? '' : 's'} added to Vault
                          </span>
                        )}
                        <button onClick={sendGuideToStudio}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.accent}`, background: 'transparent', color: T.accent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Send to Studio ↗
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
