import { useState, useEffect, useRef } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { createCard } from '../lib/reviews.js';
import { logConcept, allConcepts, isJunkConcept, pruneJunkConcepts } from '../lib/graph.js';
import { recommendBooks } from '../lib/bookRecs.js';
import { buildSkills } from '../lib/skills.js';
import { loadIndex as loadDiveIndex } from '../lib/deepdives.js';
import { toVerifiedRecord, isPostCutoff, searchBooks, mainTitle, verifyBookCached, hydrateVerifyCache } from '../lib/bookVerify.js';
import { retrieveTOC, parseTOC, groundingTier, groundingTypeMeta } from '../lib/sourceGrounding.js';
import SourceGrounding from './shared/SourceGrounding.jsx';
import BookSuggest from './shared/BookSuggest.jsx';
import { stampVersion, isStale, versionLabel, PROMPT_VERSION } from '../lib/promptVersion.js';
import { rigorPrompt, DEPTHS, DEPTH_LABELS, normalizeDepth, capTierMarkers, VOICE } from '../lib/rigor.js';
import AskChip from './shared/AskChip.jsx';
import Icon from './shared/Icon.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';
import DiagramBlock from './shared/DiagramBlock.jsx';
import ArtifactSections from './shared/ArtifactSections.jsx';
import { SYSTEM_LEARNING, SUBJECT_FIDELITY, KNOWN_BOOKS, TYPE_META, PROJECTS_KEY } from '../constants.js';
import { selectDomains, personalSectionPrompt, DOMAIN_PACKS } from '../lib/domainPacks.js';

const BOOKCLUB_KEY = 'aether_bookclub';
const SEEDED_KEY   = 'aether_bookclub_seeded';
const LENS_KEY     = 'aether_bookclub_lens';
const STUDY_GUIDES_KEY = 'aether_study_guides_v1';
const CHAPTER_DIVES_KEY = 'aether_chapter_dives_v1';       // { [bookId]: { [idx]: dive } }
const CHAPTER_PROGRESS_KEY = 'aether_chapter_progress_v1'; // { [bookId]: { [idx]: { read } } }
import MD from './shared/MD.jsx';
import ProviderTag from './shared/ProviderTag.jsx';
import { ThinkingDots } from './shared/Common.jsx';
import { SectionSkeleton, SectionError } from './shared/SectionState.jsx';
import MentalModelChip from './shared/MentalModelChip.jsx';
import './book-club.css';

const STUDY_MODES = [
  { id: 'overview',  label: 'Overview',       icon: 'ClipboardList', desc: 'Executive summary + key thesis' },
  { id: 'concepts',  label: 'Key Concepts',   icon: 'Brain', desc: 'Core frameworks and mental models' },
  { id: 'apply',     label: 'Apply to Work',  icon: 'Zap', desc: 'Direct applications to your goals' },
  { id: 'quotes',    label: 'Power Quotes',   icon: 'MessageSquare', desc: 'Most impactful passages' },
  { id: 'quiz',      label: 'Socratic Quiz',  icon: 'Target', desc: 'Test and deepen understanding' },
  { id: 'discuss',   label: 'Discussion',     icon: 'Handshake', desc: 'Critical conversation about the book' },
];

// Type → colour lives in book-club.css (`.bc [data-type="…"]`, tier + accent
// tokens, no hex), so the `type` field reads as colour instead of a dead grey.
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

// Life-application lens. Batch Z / Order D: the lens no longer translates the
// book into the reader's career or portfolio (that is what produced dividend
// examples in a book about excellence). SUBJECT FIDELITY rules the body — worked
// examples come from the book's own world. The lens only decides which half of
// ordinary life a GENERAL example is drawn from, when the book's own world has none.
const LENSES = [
  { id: 'work',     icon: 'Briefcase', label: 'Work',     clause: "Worked examples come from the book's own world. Where it has none, use a general workplace situation (a team, a meeting, a hard conversation) — never finance, investing, real estate, business development or passive income unless the book is about them." },
  { id: 'personal', icon: 'Sprout', label: 'Personal', clause: "Worked examples come from the book's own world. Where it has none, use everyday life (health, family, habits, sport) — never money, investing or a career unless the book is about them." },
  { id: 'both',     icon: 'Scale', label: 'Both',     clause: "Worked examples come from the book's own world. Where it has none, use a general or sporting example from work or everyday life — never finance, investing, real estate, business development or passive income unless the book is about them." },
];
const lensClauseOf = (id) => LENSES.find((l) => l.id === id)?.clause || LENSES[2].clause;

// The reader's ACTUAL context — active projects, tracked skills, recent deep
// dives, top graph concepts. Batch Z / Order D: this NO LONGER feeds the body or
// any scenario. It only reaches a prompt through Layer 3 (selectDomains →
// personalSectionPrompt), as one labelled closing section, and Layer 3 ships
// disabled — so today it reaches no prompt at all.
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

// Layer 3 gate for the study guide: what the BOOK is about (title, author,
// description, retrieved thesis, chapters) decides whether any personal section
// is added — never the reader's wishes. Disabled in Batch Z → always ''.
export function guidePersonalSection(book, grounding = {}) {
  const material = [grounding.fullTitle || book?.title, book?.author, grounding.description, grounding.webThesis,
    ...(Array.isArray(grounding.tocChapters) ? grounding.tocChapters : [])].filter(Boolean).join(' ');
  const packs = selectDomains(material, { topic: book?.title });
  return packs.length ? personalSectionPrompt(packs, buildStudyContext()) : '';
}

// grounding: { fullTitle, publishedDate, description, webThesis, verified, source,
// tocChapters, tocSourceLabel, userMaterial, userMaterialLabel, tier } — the
// verified catalog record, a web pass, a retrieved or user-supplied table of
// contents, and any excerpt/notes the user pasted from their copy. `tier` is the
// grounding ceiling computed upstream (verified only when the user supplied a
// physical copy). When a TOC is present the guide is generated CHAPTER BY CHAPTER,
// which is the thing the user actually wants and is impossible without structure.
// `personal` is the Layer-3 closing-section instruction from personalSectionPrompt
// — '' unless selectDomains() matched (and Layer 3 is disabled in Batch Z).
export const buildGuidePrompt = (b, lensClause, personal = '', grounding = {}, depth = 'deep') => {
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
Work through the book IN ORDER using the table of contents above. For EACH chapter, use its title as a \`### \` heading, then in 2–4 sentences give: its core argument, the key framework(s) it introduces (**bold** each framework name), and one worked example from the book's own world. ${grounding.tocIsUser ? 'Cite the chapter as the location for what you draw from it.' : ''} ${lensClause}
## Key Frameworks
The 3–5 through-line frameworks that span the chapters. Put EACH on its own line as \`**Name** — \` one-line essence, then a **Disconfirming signal:** — one concrete thing a practitioner would OBSERVE if it's failing, plus a review horizon (metric or date).
${tierRule}`
    : `## Core Thesis
The book's central argument in plain language — no jargon, one tight paragraph${grounded ? ', grounded in the material above' : existsVerified ? ', after the note that the book is confirmed to exist but its contents could not be retrieved' : ', after the note that this specific title could not be verified'}.
## Key Frameworks
${grounded ? 'The most important frameworks or mental models FROM THE GROUNDING (up to 5; fewer if the grounding only supports fewer).' : 'The most important frameworks or mental models of this book (up to 5), written from general knowledge and each marked `[inferred]` — do not leave this section empty.'} For EACH: the name, a clear explanation, one fully worked example drawn from the book's own world, and a **Disconfirming signal:** — one concrete thing a practitioner would OBSERVE if this framework is NOT working, plus a review horizon (a metric threshold or a date). ${lensClause}
${tierRule}`;
  return `Produce a complete STUDY GUIDE for "${title}"${b.author ? ` by ${b.author}` : ''}${grounding.publishedDate ? ` (published ${grounding.publishedDate})` : ''}.
${SUBJECT_FIDELITY}
${existenceNote}${ground ? `\n════ GROUNDING — THE GUIDE COMES FROM HERE ════\n${ground}\n\nHARD CONSTRAINT: Derive the guide ONLY from the grounding above — the chapters, thesis, and material given. Do NOT import frameworks from the author's better-known earlier book; if a framework isn't supported by the grounding, drop it. Fewer well-grounded beats five padded from the author's other work.\n═══════════════════════════════════════════════════\n` : ''}
Use these exact ## sections in order:
${bodySections}
## Applied Scenarios
3–5 scenarios set IN THE BOOK'S OWN WORLD (or, where it has none, a general or sporting situation). Show exactly how a framework from this book changes what someone does next. Do not set a scenario in finance, investing, real estate, business development or passive income unless the book is about that subject. Never make a scenario about a learning graph, a trend, or a confidence level.
## Application Prompts
5 concrete things a reader could act on THIS WEEK to practise the book's ideas, in the book's own terms.
## Field Summary
A one-page, scannable field summary — the whole book in bullets to reread in two minutes.
${rigor ? `\n${rigor}\n` : ''}${personal ? `\n${personal}\n` : ''}
${VOICE}
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
  return `Chapter deep dive on "${title}"${b.author ? ` by ${b.author}` : ''} — Chapter ${idx + 1}: "${chapter}".
${structureNote}
${SUBJECT_FIDELITY}
Keep it tight. Use these exact ## sections:
## Argument
What this chapter argues, in 2–4 sentences.
## Key Ideas
The 2–3 key ideas or frameworks it introduces — **bold** each name.
## Worked Example
One worked example from the book's own world. ${lensClause}
## Disconfirming Test
One concrete signal a practitioner would OBSERVE if this chapter's idea is NOT working, plus a review horizon (a metric threshold or a date).
Tag claims by tier per the note above: the chapter title/order carries its structure tier; the analysis is \`[inferred]\`.

${VOICE}`;
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
  overview:  (b) => `Give me a master-level executive overview of "${b.title}" by ${b.author}. Lead with the central thesis in one sentence. Then: 5 key insights, the strongest evidence, what critics miss, and the single most important takeaway. Format with clear headers. Be decisive.`,
  concepts:  (b) => `Extract the 7 core mental models and frameworks from "${b.title}" by ${b.author}. For each: (1) Name and 1-sentence definition, (2) How the author uses it, (3) How a practitioner applies it, with an example from the book's own world. Be concrete.`,
  // The ONE study mode whose whole job is personal relevance — the user asked for
  // it by tapping "Apply". The five areas are PEERS (finance is not privileged) and
  // only the ones the book genuinely touches get applications.
  apply:     (b) => `How does "${b.title}" by ${b.author} apply to the reader's life? First, one line on what the book is actually about. Then give up to 6 specific, actionable applications, drawn ONLY from the areas the book genuinely touches among: ${Object.values(DOMAIN_PACKS).map((p) => p.label).join(' · ')}. Skip any area the book doesn't speak to — do not stretch it into money, investing or real estate if it isn't about them. Be blunt.`,
  quotes:    (b) => `Give me the 8 most powerful, memorable passages or quotes from "${b.title}" by ${b.author}. For each: the exact quote (or close paraphrase), and 1 sentence on why it matters.`,
  quiz:      (b) => `Create a 5-question Socratic quiz on "${b.title}" by ${b.author}. Make questions progressively deeper — from recall to synthesis. After each question, give the ideal answer. Aim to expose gaps in understanding, not just test memory.`,
  discuss:   (b) => `Let's discuss "${b.title}" by ${b.author}. Give me: (1) The book's strongest argument, (2) The most valid critique or counterargument, (3) What the author got wrong or oversimplified, (4) How the book connects to today's world. Be intellectually honest.`,
};

export default function BookClub() {
  const { isMobile, isDesktop, openStudio, captureRoute, clearCapture } = useApp();
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
  // Generation failure as a STATE, not content: previously the error string was
  // written into `result` and rendered as if it were the guide.
  const [genErr, setGenErr] = useState('');
  // What the last generation was, so Retry re-runs ONLY that section.
  const lastGenRef = useRef(null);

  // Stored library is the single source of truth (built-ins + custom). KNOWN_BOOKS
  // is only a seed.
  const [books,     setBooks]     = useState(() => readLocal(BOOKCLUB_KEY, []).map(withId));
  const [saveError, setSaveError] = useState('');
  const [saving,    setSaving]    = useState(false);

  // Edit form doubles as the add form. editingId = null → adding.
  const [form,      setForm]      = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);
  // Live catalog suggestions for the Add-Book title field.
  const [sugg, setSugg] = useState({ open: false, loading: false, results: [] });
  const [formMatch, setFormMatch] = useState(null); // catalog record chosen from a suggestion

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

  // Retroactive backfill: books added before catalog verification have a short
  // title and no metadata. Once the library is loaded, quietly re-resolve any book
  // missing a catalog title (skip built-ins — they seed as bare title/author but
  // aren't user-entered guesses; skip anything already verified or already tried),
  // apply only CONFIDENT matches, and persist. Runs once per session, never
  // re-fetches a resolved/tried book, and never blocks the UI.
  // Batch Z-2 / J1: lookups go through bookVerify's throttled queue (≤2 in flight,
  // spaced) and kv-backed cache (a device — or any other device — pays once). A 429
  // opens the catalog circuit breaker: the backfill STOPS, the affected books are
  // NOT marked tried (they retry later), and the shelf shows SectionError + Retry —
  // never a silent empty shelf, never a fabricated record. Rate-limited = unverified.
  const backfillRan = useRef(false);
  const [backfillErr, setBackfillErr] = useState('');
  const [backfillNonce, setBackfillNonce] = useState(0);
  useEffect(() => {
    if (backfillRan.current || !books.length) return;
    const targets = books.filter((b) => !b.fullTitle && !b.verified && !b.backfillTried).slice(0, 12);
    if (!targets.length) return;
    backfillRan.current = true;
    let cancelled = false;
    (async () => {
      await hydrateVerifyCache();
      const patches = {};
      let limited = false;
      for (const b of targets) {
        if (cancelled) return;
        try {
          const { matches, confident, rateLimited } = await verifyBookCached({ title: b.title, author: b.author });
          if (rateLimited) { limited = true; break; }        // stop — don't mark tried
          patches[b.id] = confident && matches[0] ? { ...toVerifiedRecord(matches[0]), backfillTried: true } : { backfillTried: true };
        } catch { /* network blip: leave untried so it retries next session */ }
      }
      if (cancelled) return;
      setBackfillErr(limited ? 'The book catalog is rate-limiting lookups right now. Your books are fine — their catalog details will fill in when you retry.' : '');
      if (!Object.keys(patches).length) return;
      setBooks((prev) => {
        const nb = prev.map((x) => (patches[x.id] ? { ...x, ...patches[x.id] } : x));
        writeThrough(BOOKCLUB_KEY, nb);
        return nb;
      });
    })();
    return () => { cancelled = true; };
  }, [books, backfillNonce]);
  const retryBackfill = () => { backfillRan.current = false; setBackfillErr(''); setBackfillNonce((n) => n + 1); };

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
      const { matches, attempts, confident } = await verifyBookCached({ title: selectedBook.title, author: selectedBook.author });
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
      // Use the FULL catalog title for retrieval — "Winning" returns noise, the
      // full "Winning: The Unforgiving Race to Greatness" finds the record.
      const { toc, attempts } = await retrieveTOC({ title: selectedBook.fullTitle || selectedBook.title, author: (selectedBook.authors || []).join(', ') || selectedBook.author, webPass, publisher: selectedBook.publisher || '', deep, catalogVerified: !!selectedBook.verified });
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
        system: SYSTEM_LEARNING,
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

  const openAdd = () => { setEditingId(null); setForm(BLANK_FORM); setFormMatch(null); setSugg({ open: false, loading: false, results: [] }); setSaveError(''); setTab('add'); };
  const openEdit = (book) => {
    setEditingId(book.id);
    setForm({ title: book.title, author: book.author, note: book.note || '', type: book.type || 'other' });
    setFormMatch(null); setSugg({ open: false, loading: false, results: [] });
    setSaveError('');
    setTab('add');
  };

  // A "book" capture (e.g. from a Blue Ocean signal's "Add a book" action) opens
  // the add form pre-filled with the target title — which also fires the live
  // suggestion dropdown so the user picks the exact edition.
  useEffect(() => {
    if (captureRoute?.route !== 'book') return;
    setEditingId(null);
    setForm({ ...BLANK_FORM, title: captureRoute.topic || captureRoute.title || '' });
    setFormMatch(null); setSaveError(''); setTab('add');
    clearCapture?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureRoute?.ts]);

  // Live suggestions: debounce the title field and query the catalog, so the user
  // picks the real record (full title, subtitle, author, year, publisher) instead
  // of typing a guess. Only in Add mode with a title of 2+ chars.
  useEffect(() => {
    if (tab !== 'add') return;
    const t = form.title.trim();
    if (t.length < 2) { setSugg({ open: false, loading: false, results: [] }); return; }
    // A field just filled from a chosen suggestion shouldn't immediately re-search.
    if (formMatch && mainTitle(formMatch.fullTitle || formMatch.title) === t) return;
    let cancelled = false;
    setSugg((s) => ({ ...s, open: true, loading: true }));
    const id = setTimeout(async () => {
      const results = await searchBooks({ title: t, author: form.author.trim(), limit: 6 });
      if (!cancelled) setSugg({ open: true, loading: false, results });
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.author, tab]);

  // Selecting a suggestion fills both fields from the catalog record and stores the
  // match so Save persists a verified record (short display title + full catalog
  // title + author-as-catalogued + year/publisher). No typing a guess and hoping.
  const applySuggestion = (m) => {
    const full = [m.title, m.subtitle].filter(Boolean).join(': ');
    setFormMatch({ ...m, fullTitle: full });
    setForm((f) => ({ ...f, title: mainTitle(full), author: (m.authors || []).join(', ') || f.author }));
    setSugg({ open: false, loading: false, results: [] });
  };

  const saveBook = async () => {
    if (!form.title.trim() || saving) return;
    const base = {
      title:  form.title.trim(),
      author: form.author.trim() || 'Unknown',
      note:   form.note.trim(),
      type:   form.type || 'other',
    };
    // If a catalog suggestion was chosen, persist its verified metadata now — the
    // book is grounded on add, no separate confirm step needed.
    const fields = formMatch ? { ...base, ...toVerifiedRecord(formMatch) } : base;
    const next = editingId
      ? books.map((b) => (b.id === editingId ? { ...b, ...fields } : b))
      : [...books, { id: uid(), builtin: false, ...fields }];
    if (await persist(next)) {
      setForm(BLANK_FORM); setFormMatch(null); setSugg({ open: false, loading: false, results: [] });
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
    lastGenRef.current = { kind: 'mode', modeId };
    setLoading(true); setGenErr('');
    setResult('');
    setResultProvider('');
    setVaulted(false);
    setIsGuide(false);
    try {
      const reply = await callClaude({
        system: SYSTEM_LEARNING,
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
      setResult(''); setGenErr(e?.message || 'The AI providers were unavailable.');
    }
    setLoading(false);
  };
  const handleDeepDive = () => handleDeepDiveFor(mode);
  // Retry re-runs ONLY the section that failed (guide or study mode), never the page.
  const retryGeneration = () => {
    const last = lastGenRef.current;
    if (loading || !last) return;
    if (last.kind === 'guide') generateGuide({ ungrounded: !!last.ungrounded });
    else handleDeepDiveFor(last.modeId);
  };
  // A failure from a previous book never bleeds into the next one.
  useEffect(() => { setGenErr(''); }, [selectedBook?.id]);

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
    lastGenRef.current = { kind: 'guide', ungrounded };
    setGenErr('');
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
        system: SYSTEM_LEARNING,
        messages: [{ role: 'user', content: buildGuidePrompt(selectedBook, lensClauseOf(lens), guidePersonalSection(selectedBook, grounding), grounding, depth) }],
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
      setResult(''); setGenErr(e?.message || 'The AI providers were unavailable.');
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
  // Explicit status for the primary artifact (study guide or study-mode output).
  // 'empty' has no placeholder: the Generate Study Guide button + study-mode grid
  // directly above already say what produces it.
  const resultStatus = loading ? 'loading' : genErr ? 'error' : result ? 'ready' : 'empty';
  const viewSavedGuide = () => {
    if (!savedGuide) return;
    setGenErr('');
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

  // Layout (padding, grid columns, header size) lives in book-club.css media
  // queries — never sized from JS. The viewport flags below are behaviour only.
  const onCardKey = (e, fn) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fn(); } };

  return (
    <div className="bc">

      {/* Header */}
      <div className="bc-head">
        <div className="bc-kicker">Intelligence Hub</div>
        <div className="bc-title">
          <Icon name="BookOpen" size="nav" aria-hidden="true" /> Book Club
        </div>
        <div className="bc-sub">
          Research, deep dive, and master any book with AI
        </div>
      </div>

      {/* Tab bar */}
      <div className="bc-tabs">
        {[{ id: 'library', label: 'Library', icon: 'Library' }, { id: 'add', label: editingId ? 'Edit Book' : 'Add Book', icon: editingId ? 'Pencil' : 'Plus' }, { id: 'dive', label: 'Deep Dive', icon: 'Waves' }].map(t => (
          <button type="button" key={t.id} onClick={() => (t.id === 'add' ? (editingId ? setTab('add') : openAdd()) : setTab(t.id))}
            className="bc-tab tap" aria-pressed={tab === t.id}>
            <Icon name={t.icon} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <div className="bc-body">

        {/* Graph cleanup report — what the junk-concept sweep removed on mount. */}
        {pruned.length > 0 && (
          <div className="bc-note bc-note-row" data-kind="caution">
            <span>🧹 Cleaned {pruned.length} polluted concept{pruned.length === 1 ? '' : 's'} from the knowledge graph (markdown section labels wrongly tracked as skills): <b>{pruned.slice(0, 8).join(', ')}</b>{pruned.length > 8 ? ` +${pruned.length - 8} more` : ''}.</span>
            <button type="button" onClick={() => setPruned([])} className="bc-note-dismiss tap">Dismiss</button>
          </div>
        )}

        {/* Save error — visible wherever the user is. */}
        {saveError && (
          <div className="bc-note" data-kind="error" data-size="base">
            ⚠ {saveError}
          </div>
        )}

        {/* Catalog rate-limited (J1): honest, retryable — never a silent empty shelf. */}
        {tab === 'library' && backfillErr && (
          <div className="bc-sec-error"><SectionError label="catalog details" onRetry={retryBackfill} detail={backfillErr} /></div>
        )}

        {/* ── LIBRARY TAB ──────────────────────────────────────────── */}
        {tab === 'library' && (
          <div>
            <div className="bc-search">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or author..." aria-label="Search by title or author"
                className="bc-input" />
              <button type="button" onClick={restoreDefaults} disabled={saving}
                title="Re-add the 20 built-in books that aren't in your library. Custom books are untouched."
                className="bc-btn bc-restore tap">
                ↻ Restore default library
              </button>
            </div>

            {/* What to read next — graph-driven, each rec states its reason */}
            {(() => {
              const recs = recommendBooks({ library: books, lens });
              if (recs.length === 0) return null;
              return (
                <div className="bc-recs">
                  <div className="bc-recs-head">
                    <Icon name="Sparkles" size={16} aria-hidden="true" />
                    <span className="bc-recs-kicker">What to read next · {LENSES.find(l => l.id === lens)?.label} lens</span>
                  </div>
                  <div className="bc-recs-grid">
                    {recs.map((r) => (
                      <div key={r.title} className="bc-rec">
                        <div className="bc-rec-top">
                          <span className="bc-rec-signal">{r.signal}</span>
                          <button type="button" onClick={() => persist([...books, { id: uid(), title: r.title, author: r.author, type: r.type }])}
                            className="bc-addlink tap">
                            <Icon name="Plus" size={13} aria-hidden="true" /> Add
                          </button>
                        </div>
                        <div className="bc-rec-title">{r.title}</div>
                        <div className="bc-rec-author">{r.author}</div>
                        <div className="bc-rec-reason">{r.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="bc-eyebrow">
              {filtered.length} Books · Click to Deep Dive
            </div>

            {filtered.length === 0 && (
              <div className="bc-empty">
                <div className="bc-empty-glyph"><Icon name="Library" size={32} aria-hidden="true" /></div>
                <div className="bc-empty-msg">
                  {search ? `No books match "${search}"` : 'No books in your library yet.'}
                </div>
                <button type="button" onClick={openAdd} className="btn btn-primary bc-primary tap">
                  + Add a Book
                </button>
              </div>
            )}

            <div className="bc-grid">
              {filtered.map((book) => {
                const isSelected = selectedBook?.id === book.id;
                const openBook = () => { setSelectedBook(book); setMode('overview'); setResult(''); setTab('dive'); };
                return (
                  // A div (not a <button>) because it contains the edit/remove buttons;
                  // role + tabIndex + Enter/Space keep it keyboard-operable.
                  <div key={book.id} role="button" tabIndex={0}
                    onClick={openBook} onKeyDown={(e) => onCardKey(e, openBook)}
                    className="bc-book" data-type={book.type || 'other'} data-selected={isSelected || undefined}
                    aria-label={`${book.title} — open deep dive`}>
                    <div className="bc-book-type">
                      {TYPE_META[book.type]?.label || book.type || 'General'}
                    </div>
                    <div className="bc-book-title">
                      <span>{book.title}</span>
                      {(book.verified || book.fullTitle) && <Icon name="Check" size={13} title={`Verified: ${book.fullTitle || book.title}`} className="bc-check" />}
                    </div>
                    <div className="bc-book-author">{book.author}</div>

                    <div className="bc-book-foot">
                      <div className="bc-book-kind">
                        {book.builtin ? 'BUILT-IN' : 'CUSTOM'}
                      </div>
                      <div className="bc-book-tools">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(book); }}
                          title="Edit" aria-label={`Edit ${book.title}`}
                          className="bc-iconbtn tap">✎</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeBook(book); }}
                          title="Remove" aria-label={`Remove ${book.title}`}
                          className="bc-iconbtn tap" data-quiet>✕</button>
                      </div>
                    </div>

                    {book.note && <div className="bc-book-note">{book.note.slice(0, 60)}{book.note.length > 60 ? '…' : ''}</div>}
                    {(() => {
                      const chs = chaptersOf(book).chapters;
                      if (!chs.length) return null;
                      const dived = Object.values(chapterDives[book.id] || {}).filter((d) => d && !d.error).length;
                      return (
                        <div className="bc-book-chs">
                          <Icon name="ClipboardList" size={12} aria-hidden="true" /> {dived}/{chs.length} chapters dived
                        </div>
                      );
                    })()}
                    <div className="bc-book-cta"><Icon name="Waves" size={14} aria-hidden="true" /> Deep Dive →</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ADD / EDIT BOOK TAB ──────────────────────────────────── */}
        {tab === 'add' && (
          <div className="bc-form">
            <div className="bc-form-title">
              {editingId ? 'Edit Book' : 'Add a Book'}
            </div>
            <div className="bc-field" data-anchor>
              <label className="bc-label" htmlFor="bc-f-title">Book Title *</label>
              <input id="bc-f-title" value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setFormMatch(null); }}
                onFocus={() => { if (sugg.results.length) setSugg(s => ({ ...s, open: true })); }}
                placeholder="Start typing — we’ll find the exact edition"
                autoComplete="off"
                className="bc-input" />

              {/* Live catalog suggestions — cover, full title, author-as-catalogued,
                  year, publisher. Selecting fills both fields from the record. */}
              {sugg.open && !formMatch && (form.title.trim().length >= 2) && (
                <BookSuggest results={sugg.results} loading={sugg.loading} query={form.title.trim()} onPick={applySuggestion} />
              )}

              {/* What was matched — shown always, never resolved silently. */}
              {formMatch && (
                <div className="bc-match">
                  <Icon name="Check" size={16} className="bc-check" aria-hidden="true" />
                  <span className="bc-match-text">
                    Found: <b>{formMatch.fullTitle}</b> — {(formMatch.authors || []).join(', ')}{(formMatch.publishedDate || '') ? `, ${(formMatch.publishedDate || '').slice(0, 4)}` : ''}{formMatch.publisher ? `, ${formMatch.publisher}` : ''}. Saved as “{form.title.trim()}”.
                    <button type="button" onClick={() => { setFormMatch(null); setSugg(s => ({ ...s, open: true })); }} className="bc-link tap">Not this one</button>
                  </span>
                </div>
              )}
            </div>
            <div className="bc-field">
              <label className="bc-label" htmlFor="bc-f-author">Author</label>
              <input id="bc-f-author" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="e.g. Eric Ries"
                className="bc-input" />
            </div>
            <div className="bc-field">
              <label className="bc-label" htmlFor="bc-f-type">Category</label>
              <select id="bc-f-type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="bc-input">
                {TYPE_IDS.map(id => (
                  <option key={id} value={id}>{TYPE_META[id]?.label || id}</option>
                ))}
              </select>
            </div>
            <div className="bc-field" data-last>
              <label className="bc-label" htmlFor="bc-f-note">Notes (optional)</label>
              <textarea id="bc-f-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Why you're reading it, key questions, context..."
                rows={3}
                className="bc-input" />
            </div>
            <div className="bc-form-actions">
              <button type="button" onClick={saveBook} disabled={!form.title.trim() || saving} className="btn btn-primary bc-primary tap">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add to Library'}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setForm(BLANK_FORM); setSaveError(''); setTab('library'); }}
                  className="bc-btn tap">
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
              <div className="bc-empty" data-pad="sm">
                <div className="bc-empty-glyph"><Icon name="BookOpen" size={32} aria-hidden="true" /></div>
                <div className="bc-empty-msg">Select a book from the Library to deep dive</div>
                <button type="button" onClick={() => setTab('library')} className="btn btn-primary bc-primary tap">
                  Browse Library
                </button>
              </div>
            ) : (
              <div>
                {/* Selected book header */}
                <div className="bc-sel" data-type={selectedBook.type || 'other'}>
                  <div className="bc-sel-main">
                    <div className="bc-sel-title">
                      {selectedBook.fullTitle || selectedBook.title}
                      {selectedBook.verified && (
                        <span title={`Verified via ${selectedBook.source}${selectedBook.publishedDate ? ` · ${selectedBook.publishedDate}` : ''}`} className="bc-chip-tier" data-tone="verified">
                          <Icon name="Check" size={11} aria-hidden="true" /> Verified{selectedBook.postCutoff ? ' · web-grounded' : ''}
                        </span>
                      )}
                    </div>
                    <div className="bc-sel-author">
                      {selectedBook.author}{selectedBook.verified && <button type="button" onClick={reverify} className="bc-quietlink tap">re-verify</button>}
                    </div>
                  </div>
                  <AskChip type="book" object={selectedBook} />
                  <button type="button" onClick={() => { setSelectedBook(null); setResult(''); }} className="bc-btn bc-change tap">
                    Change
                  </button>
                </div>

                {/* Catalog verification — grounds the guide in the real book */}
                {!selectedBook.verified && verify.status === 'loading' && (
                  <div className="bc-verifying">
                    <ThinkingDots color="var(--accent-text)" /> Verifying against Google Books…
                  </div>
                )}
                {!selectedBook.verified && verify.status === 'done' && verify.matches[verify.idx] && (() => {
                  const m = verify.matches[verify.idx];
                  const post = isPostCutoff(m.publishedDate);
                  return (
                    <div className="bc-found">
                      <div className="bc-eyebrow" data-strong>Found — confirm this is the book{verify.matches.length > 1 ? ` · ${verify.matches.length} editions/matches` : ''}</div>
                      <div className="bc-found-row">
                        {m.thumbnail
                          ? <img src={m.thumbnail} alt="" width={64} className="bc-cover" />
                          : <div className="bc-cover-blank"><Icon name="BookMarked" size={20} aria-hidden="true" /></div>}
                        <div className="bc-found-main">
                          <div className="bc-found-title">{[m.title, m.subtitle].filter(Boolean).join(': ')}</div>
                          <div className="bc-found-meta">
                            {(m.authors || []).join(', ') || '—'}{m.publishedDate ? ` · ${m.publishedDate}` : ''}{m.publisher ? ` · ${m.publisher}` : ''} · {m.source === 'google' ? 'Google Books' : 'Open Library'}
                          </div>
                          {post && (
                            <div className="bc-chip-tier" data-tone="inferred">
                              <Icon name="Globe" size={11} aria-hidden="true" /> Post-cutoff — will web-ground before generating
                            </div>
                          )}
                          {m.description && <div className="bc-found-desc">{m.description.slice(0, 260)}{m.description.length > 260 ? '…' : ''}</div>}
                        </div>
                      </div>
                      <div className="bc-found-actions">
                        <button type="button" onClick={confirmVerification} disabled={saving} className="btn btn-primary tap">
                          ✓ This is the book
                        </button>
                        {verify.matches.length > 1 && (
                          <button type="button" onClick={nextMatch} className="bc-btn tap">
                            Different edition ({verify.idx + 1}/{verify.matches.length})
                          </button>
                        )}
                        <button type="button" onClick={skipVerification} className="bc-btn tap" data-quiet>
                          Use without verifying
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {!selectedBook.verified && verify.status === 'none' && (
                  <div className="bc-note bc-unverified" data-kind="negative">
                    ⚠ Couldn’t verify this title against a catalog. You can still generate, but the guide will be <b>marked unverified</b> and may drift on a book published after the model’s cutoff. <button type="button" onClick={skipVerification} className="bc-link tap">Continue anyway</button>
                    {verify.attempts?.length > 0 && (
                      <div className="bc-note-tried">
                        <b>Tried:</b> {verify.attempts.map((a, i) => (
                          <span key={i}>{i > 0 ? ' · ' : ' '}{a.source} <code>{a.query}</code> → {a.error ? `error ${a.error}` : `${a.results} result${a.results === 1 ? '' : 's'}`}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Grounding gate — generation is blocked on a post-cutoff book
                    with no chapter list until the user chooses. */}
                {needsGrounding && !selectedBook.userGrounding && !selectedBook.retrievedTOC && (
                  <div className="bc-note bc-gate" data-kind="caution">
                    <b>Generation paused — this book has no grounding yet.</b> It published after the model’s training data and no chapter list was found. Search harder or paste your copy’s contents below for a grounded, chapter-by-chapter guide — or continue with an ungrounded (all-<i>inferred</i>) guide.
                    <div className="bc-note-actions">
                      <button type="button" onClick={() => { setProceedUngrounded(true); setNeedsGrounding(false); generateGuide({ ungrounded: true }); }}
                        className="bc-btn tap">
                        Continue ungrounded →
                      </button>
                    </div>
                  </div>
                )}

                {/* Source material the model can't reach: automated retrieval
                    leads, "Search harder" widens the net, and only after that
                    fails does the manual paste appear (reframed as the exception). */}
                <div className="bc-ground">
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
                  const srcLabel = tier === 'verified' ? 'your copy' : (selectedBook.retrievedTOC?.sourceLabel || 'retrieved');
                  return (
                    <div className="bc-toc" data-tier={tier === 'verified' ? 'verified' : 'reported'}>
                      <button type="button" onClick={() => setTocOpen((o) => !o)} className="bc-toc-toggle" aria-expanded={tocOpen}>
                        <span className="bc-toc-head">
                          <Icon name="ClipboardList" size={16} className="bc-toc-icon" aria-hidden="true" />
                          <span className="bc-toc-title">Table of Contents</span>
                          <span className="bc-chip-tier" data-tone={tier === 'verified' ? 'verified' : 'reported'}>structure {tier} · {srcLabel}</span>
                          <span className="bc-toc-count">{divedCount}/{chapters.length} dived · {readCount} read</span>
                        </span>
                        <Icon name={tocOpen ? 'ChevronUp' : 'ChevronDown'} size={16} className="bc-toc-chev" aria-hidden="true" />
                      </button>
                      {tocOpen && (
                        <div className="bc-toc-list">
                          {chapters.map((ch, i) => {
                            const dive = dives[i];
                            const read = !!prog[i]?.read;
                            const isOpen = openChapter === i;
                            const cLoading = chapterLoading === i;
                            return (
                              <div key={i} className="bc-ch">
                                <div className="bc-ch-row">
                                  <button type="button" onClick={() => toggleChapterRead(i)} title={read ? 'Read' : 'Mark read'}
                                    aria-label={read ? `Chapter ${i + 1} read` : `Mark chapter ${i + 1} read`} aria-pressed={read}
                                    className="bc-ch-check tap">
                                    {read && <Icon name="Check" size={13} aria-hidden="true" />}
                                  </button>
                                  <button type="button" onClick={() => { const next = isOpen ? null : i; setOpenChapter(next); if (next != null && !dive && !cLoading) generateChapterDive(i); }}
                                    className="bc-ch-open tap" aria-expanded={isOpen}>
                                    <span className="bc-ch-n">{i + 1}.</span>
                                    <span className="bc-ch-name" data-dived={(dive && !dive.error) || undefined}>{ch}</span>
                                    {dive && !dive.error && <Icon name="BookOpen" size={13} className="bc-ch-dived" aria-hidden="true" />}
                                  </button>
                                  <button type="button" onClick={() => { setOpenChapter(i); generateChapterDive(i); }} disabled={cLoading}
                                    className="bc-btn bc-ch-dive tap">
                                    {cLoading ? '…' : dive && !dive.error ? 'Redive' : 'Dive'}
                                  </button>
                                </div>
                                {isOpen && (
                                  <div data-status={cLoading ? 'loading' : dive?.error ? 'error' : dive ? 'ready' : 'empty'} className="bc-ch-body">
                                    {cLoading ? <SectionSkeleton rows={4} label="chapter dive" /> : dive?.error ? (
                                      <SectionError label="this chapter dive" onRetry={() => generateChapterDive(i)} detail={dive.body} />
                                    ) : dive ? (
                                      <div>
                                        {dive.provider && <div className="bc-ch-provider"><ProviderTag provider={dive.provider} /></div>}
                                        <MD text={dive.body} color="var(--accent-text)" />
                                        {!dive.error && isStale(dive, 'studyGuide') && (
                                          <button type="button" onClick={() => generateChapterDive(i)} className="bc-btn bc-ch-regen tap" data-accent>
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
                <div className="bc-engine">
                  <div className="bc-engine-opts">
                    <span className="bc-engine-label">Lens</span>
                    {LENSES.map((l) => {
                      const on = lens === l.id;
                      return (
                        <button type="button" key={l.id} onClick={() => setBookLens(l.id)} title={l.clause}
                          className="bc-seg tap" aria-pressed={on}>
                          <Icon name={l.icon} size={14} aria-hidden="true" /> {l.label}
                        </button>
                      );
                    })}
                    <span className="bc-engine-label" data-gap title="Epistemic depth: surface=tier chips · standard=+evidence/sources · deep=+lineage/where-it-breaks-down · expert=+disconfirming test/friction">Rigor</span>
                    {DEPTHS.map((d) => {
                      const on = depth === d;
                      return (
                        <button type="button" key={d} onClick={() => setDepth(d)} title={`Rigor: ${DEPTH_LABELS[d]}`}
                          className="bc-seg tap" data-narrow aria-pressed={on}>
                          {DEPTH_LABELS[d]}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => generateGuide()} disabled={loading} className="btn btn-primary bc-primary bc-generate tap"
                    aria-busy={loading ? 'true' : undefined}>
                    <Icon name="BookOpen" size={14} aria-hidden="true" /> {savedGuide ? 'Regenerate Study Guide' : 'Generate Study Guide'}
                  </button>
                </div>

                {/* A saved guide is one click away — never lost on refresh. */}
                {savedGuide && !(isGuide && result) && (() => {
                  const stale = isStale(savedGuide, 'studyGuide');
                  return (
                    <div className="bc-saved" data-stale={stale || undefined}>
                      <span className="bc-saved-text">
                        <Icon name={stale ? 'AlertTriangle' : 'BookOpen'} size={14} className="bc-saved-icon" aria-hidden="true" />
                        Saved study guide · {LENSES.find((l) => l.id === savedGuide.lens)?.label || 'Both'} lens · {versionLabel(savedGuide)}
                        {stale && <span className="bc-chip-tier" data-tone="inferred">prompt updated → regenerate (v{PROMPT_VERSION.studyGuide})</span>}
                      </span>
                      <span className="bc-saved-actions">
                        <button type="button" onClick={viewSavedGuide} className="bc-btn tap" data-accent>
                          View guide
                        </button>
                        {stale && (
                          <button type="button" onClick={() => generateGuide()} disabled={loading} className="btn btn-primary tap">
                            Regenerate
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })()}
                {guideErr && (
                  <div className="bc-note" data-kind="error">
                    ⚠ {guideErr}
                  </div>
                )}

                {/* Study mode grid */}
                <div className="bc-eyebrow">Choose Study Mode — click any to generate instantly</div>
                <div className="bc-modes">
                  {STUDY_MODES.map(m => (
                    <button type="button" key={m.id} onClick={() => { setMode(m.id); setResult(''); handleDeepDiveFor(m.id); }}
                      className="bc-mode" aria-pressed={mode === m.id}>
                      <Icon name={m.icon} size="header" className="bc-mode-icon" aria-hidden="true" />
                      <span className="bc-mode-label">{m.label}</span>
                      <span className="bc-mode-desc">{m.desc}</span>
                    </button>
                  ))}
                </div>

                {!isGuide && (
                  <button type="button" onClick={handleDeepDive} disabled={loading} className="btn btn-primary bc-primary bc-run tap"
                    aria-busy={loading ? 'true' : undefined}>
                    {loading
                      ? 'Generating…'
                      : <><Icon name="Waves" aria-hidden="true" /><span>{`${STUDY_MODES.find(m => m.id === mode)?.label || 'Overview'} — ${selectedBook.title.slice(0, 28)}${selectedBook.title.length > 28 ? '…' : ''}`}</span></>
                    }
                  </button>
                )}

                {/* Primary artifact status: the study guide / study-mode output. */}
                <div data-status={resultStatus}>
                {resultStatus === 'loading' && !result && (
                  <SectionSkeleton rows={isGuide ? 8 : 5} lead label={isGuide ? 'study guide' : 'study mode'} />
                )}
                {resultStatus === 'error' && (
                  <SectionError label={isGuide ? 'the study guide' : 'this study mode'} onRetry={retryGeneration} detail={genErr} />
                )}

                {result && (
                  <div className="bc-result">
                    <div className="bc-result-head">
                      <div className="bc-result-label">
                        <div className="bc-result-kicker">
                          {isGuide ? <><Icon name="BookOpen" size={12} aria-hidden="true" /> Study Guide · {LENSES.find(l => l.id === guideLens)?.label} lens</> : <><Icon name={STUDY_MODES.find(m => m.id === mode)?.icon} size={12} aria-hidden="true" /> {STUDY_MODES.find(m => m.id === mode)?.label}</>}
                        </div>
                        <ProviderTag provider={resultProvider} />
                      </div>
                      <div className="bc-result-tools">
                        <button type="button" onClick={() => { createCard({ front: `${selectedBook.title} — ${STUDY_MODES.find(m => m.id === mode)?.label}`, back: result.slice(0, 400), source: selectedBook.title, module: 'books', topic: selectedBook.title }); setVaulted(true); }}
                          className="bc-btn bc-mini tap" data-quiet={!vaulted || undefined} aria-pressed={vaulted}>
                          {vaulted ? '✓ In Vault' : '+ Vault'}
                        </button>
                        <SaveToNotes title={`${selectedBook.title} — ${isGuide ? 'Study Guide' : STUDY_MODES.find(m => m.id === mode)?.label}`} content={result} source={{ title: selectedBook.title, tier: 'reported' }} label="Notes" />
                        <button type="button" onClick={copyGuide} className="bc-btn bc-mini tap" aria-pressed={copied}>
                          {copied ? '✓ Copied' : 'Copy'}
                        </button>
                        {isGuide && (
                          <button type="button" onClick={downloadGuide} className="bc-btn bc-mini tap">
                            ↓ .md
                          </button>
                        )}
                      </div>
                    </div>
                    {isGuide
                      ? <ArtifactSections text={result} color="var(--accent-text)" isMobile={isMobile} isDesktop={isDesktop} />
                      : <MD text={result} color="var(--accent-text)" />}
                    {/* On-demand mental-model reframe of the guide shown — nothing runs until tapped. */}
                    {isGuide && !loading && (
                      <MentalModelChip title={selectedBook.title} body={result} />
                    )}
                    {isGuide && !loading && (
                      <div className="bc-extra">
                        <div className="bc-eyebrow">Visualize the frameworks</div>
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
                      <div className="bc-extra">
                        <div className="bc-eyebrow" data-gap>Read next · networked</div>
                        <div className="bc-recs-grid">
                          {readNext.map((r, i) => (
                            <div key={i} className="bc-rec" data-tight>
                              <div className="bc-rec-top">
                                <span className="bc-rec-rel" data-rel={r.relation}>{r.relation}</span>
                                {r.owned && <span className="bc-rec-owned">✓ in library</span>}
                              </div>
                              <div className="bc-rec-title">{r.title}</div>
                              {r.author && <div className="bc-rec-author">{r.author}</div>}
                              {r.reason && <div className="bc-rec-reason">{r.reason}</div>}
                              {!r.owned && (
                                <button type="button" onClick={() => persist([...books, { id: uid(), title: r.title, author: r.author || 'Unknown', type: 'other' }])}
                                  className="bc-addlink tap" data-bottom>
                                  <Icon name="Plus" size={13} aria-hidden="true" /> Add to library
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {isGuide && !loading && (
                      <div className="bc-extra" data-row>
                        {guideCards > 0 && (
                          <span className="bc-cards-pill">
                            ✓ {guideCards} self-quiz card{guideCards === 1 ? '' : 's'} added to Vault
                          </span>
                        )}
                        <button type="button" onClick={sendGuideToStudio} className="bc-btn bc-studio tap" data-accent>
                          Send to Studio ↗
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
