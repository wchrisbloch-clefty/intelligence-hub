import { T, withAlpha } from '../theme';
import { useState, useEffect } from 'react';
import { useApp } from '../App.jsx';
import { callClaude, uid } from '../utils.js';
import { readLocal, writeThrough, hydrate } from '../lib/storage.js';
import { createCard } from '../lib/reviews.js';
import { logConcept, allConcepts } from '../lib/graph.js';
import { recommendBooks } from '../lib/bookRecs.js';
import { buildSkills, levelFor } from '../lib/skills.js';
import { loadIndex as loadDiveIndex } from '../lib/deepdives.js';
import { verifyBook, toVerifiedRecord, isPostCutoff } from '../lib/bookVerify.js';
import AskChip from './shared/AskChip.jsx';
import Icon from './shared/Icon.jsx';
import SaveToNotes from './shared/SaveToNotes.jsx';
import DiagramBlock from './shared/DiagramBlock.jsx';
import { CB_LEARNING_SPINE, KNOWN_BOOKS, TYPE_META, PROJECTS_KEY } from '../constants.js';

const BOOKCLUB_KEY = 'aether_bookclub';
const SEEDED_KEY   = 'aether_bookclub_seeded';
const LENS_KEY     = 'aether_bookclub_lens';
const STUDY_GUIDES_KEY = 'aether_study_guides_v1';
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
    const skills = buildSkills().filter((s) => s.confidence != null).slice(0, 6)
      .map((s) => `- ${s.name} (${levelFor(s.confidence).label}, trend ${s.trend})`);
    if (skills.length) parts.push(`Tracked skills:\n${skills.join('\n')}`);
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
      .sort((a, b) => (b.observations || 0) - (a.observations || 0))
      .slice(0, 6)
      .map((c) => `- ${c.topic}`);
    if (concepts.length) parts.push(`Topics he's been going deep on (most-engaged first):\n${concepts.join('\n')}`);
  } catch {}
  return parts.join('\n\n');
}

// grounding: { fullTitle, publishedDate, description, webThesis } from the
// verified catalog record (and a web pass for post-cutoff books). This block is
// what keeps the model from inventing a thesis for a book it doesn't know.
const buildGuidePrompt = (b, lensClause, context, grounding = {}) => {
  const title = grounding.fullTitle || b.title;
  const ground = [
    grounding.description ? `PUBLISHER DESCRIPTION (authoritative — the guide MUST match this, not the author's other books):\n${grounding.description}` : '',
    grounding.webThesis ? `RETRIEVED THESIS & STRUCTURE (from a live web pass, this book specifically):\n${grounding.webThesis}` : '',
  ].filter(Boolean).join('\n\n');
  return `Produce a complete STUDY GUIDE for "${title}"${b.author ? ` by ${b.author}` : ''}${grounding.publishedDate ? ` (published ${grounding.publishedDate})` : ''}, for CB (Houston BD professional; passive-income + longevity goals).
${ground ? `\n════ GROUNDING — READ FIRST ════\n${ground}\nEvery framework must be traceable to THIS book. If a claim comes from the author's EARLIER work rather than this title, say so explicitly and tier it 'reported'. Do NOT present the author's other books' ideas as this book's content.\n════════════════════════════════\n` : ''}${context ? `\nCB'S ACTUAL CONTEXT — use ONLY these for the Applied Scenarios. A generic example is a failure; every scenario must be about his real work or life. Do NOT mention internal metadata, observation counts, or "touches":\n${context}\n` : ''}
Use these exact ## sections in order:
## Core Thesis
The book's central argument in plain language — no jargon, one tight paragraph.
## Key Frameworks
The 5 most important frameworks or mental models. For EACH: the name, a clear explanation, and one fully worked example. ${lensClause}
Tag EACH framework at the END of its first line with exactly one tier marker:
\`[verified]\` if it's traceable to the grounding above, \`[reported: <which book>]\` if it's from the author's broader body of work (name the book), or \`[inferred]\` if it's your own synthesis. Every framework must carry a tier.
## Applied Scenarios
3–5 scenarios, each built on a specific item from ${context ? "CB's actual context above" : "CB's world (Houston BD, real-estate deals, passive income, health/longevity, family)"}. Name the project / skill / topic and show exactly how a framework from this book changes what he does next.
## Application Prompts
5 concrete things CB can act on THIS WEEK.
## Where This Breaks Down
The strongest, most credible criticism of the book's thesis — and WHO makes it (a school of thought or a named critic). A study aid argues both sides; do not soften this into a caveat.
## Field Summary
A one-page, scannable field summary — the whole book in bullets he can reread before a meeting in two minutes.

Then output a line containing only ---CARDS--- and, after it, ONLY a JSON array of 8 to 10 self-quiz flashcards: [{"front":"question","back":"answer"}]. Output the ---CARDS--- marker and the array even if the guide ran long. No prose after the marker.`;
};

// Pull the framework NAMES out of the guide's "## Key Frameworks" section so each
// one becomes its own concept in the graph, linked to the book by shared source.
// Tolerant of the model's formatting: bullets, numbers, bold labels, or a
// "Name — definition" line all resolve to the leading name.
function extractFrameworks(body) {
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
    if (name.length >= 3 && name.length <= 60 && !/^why it matters/i.test(name)) out.push(name.replace(/\s*\[[^\]]*\]\s*$/, '').trim());
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
  // Catalog verification for the selected book. status: idle|loading|done|none
  const [verify, setVerify] = useState({ status: 'idle', matches: [], idx: 0 });

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
      const [remoteLens, remoteGuides] = await Promise.all([hydrate(LENS_KEY), hydrate(STUDY_GUIDES_KEY)]);
      if (!cancelled && remoteLens && typeof remoteLens === 'object') setLensByBook(remoteLens);
      if (!cancelled && remoteGuides && typeof remoteGuides === 'object') setGuides(remoteGuides);
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
    if (!selectedBook || selectedBook.verified) { setVerify({ status: 'idle', matches: [], idx: 0 }); return; }
    let cancelled = false;
    setVerify({ status: 'loading', matches: [], idx: 0 });
    (async () => {
      const matches = await verifyBook({ title: selectedBook.title, author: selectedBook.author });
      if (cancelled) return;
      setVerify({ status: matches.length ? 'done' : 'none', matches, idx: 0 });
    })();
    return () => { cancelled = true; };
  }, [selectedBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const generateGuide = async () => {
    if (!selectedBook) return;
    setMode('guide'); setIsGuide(true); setLoading(true); setResult(''); setResultProvider(''); setVaulted(false); setGuideCards(0); setGuideErr(''); setGuideLens(lens);
    let provider = '';
    try {
      // Grounding is the single change that stops the model inventing a thesis
      // for a book it doesn't know. Verified catalog description always; for a
      // post-cutoff book, a live web pass first to retrieve the real thesis.
      const grounding = {
        fullTitle: selectedBook.fullTitle || selectedBook.title,
        publishedDate: selectedBook.publishedDate || '',
        description: selectedBook.description || '',
        webThesis: '',
      };
      if (selectedBook.postCutoff) {
        setResult('Retrieving this book’s actual thesis from the web (published after the model’s cutoff)…');
        try {
          grounding.webThesis = await callClaude({
            system: 'You retrieve factual information about a specific book from current sources. Report only what is actually about THIS title — never substitute the author’s other books. If you cannot find it, reply exactly NOT FOUND.',
            messages: [{ role: 'user', content: `Give the actual core thesis and the chapter/section structure of the book "${grounding.fullTitle}" by ${selectedBook.author}${grounding.publishedDate ? ` (published ${grounding.publishedDate})` : ''}. Be concise and factual.` }],
            job: 'web',
            maxTokens: 1200,
          });
          if (/^\s*NOT FOUND/i.test(grounding.webThesis)) grounding.webThesis = '';
        } catch { /* web pass is best-effort; description still grounds it */ }
        setResult('');
      }
      // Stream it: a 6000-token guide runs for tens of seconds, so we show it
      // building (and, critically, streaming means it can't hit a single blocking
      // wall-clock abort mid-generation). The trailing ---CARDS--- JSON is hidden
      // from the live view; callClaude still returns the full text to parse.
      let acc = '';
      const reply = await callClaude({
        system: CB_LEARNING_SPINE,
        messages: [{ role: 'user', content: buildGuidePrompt(selectedBook, lensClauseOf(lens), buildStudyContext(), grounding) }],
        // High ceiling — a real six-section guide plus 8–10 cards. The old 1500
        // cap is why this produced stubs.
        maxTokens: 6000,
        job: 'reason',
        onProvider: (p) => { provider = p; setResultProvider(p); },
        onToken: (t) => { acc += t; setResult(acc.split('---CARDS---')[0].trim()); },
      });
      const [rawBody, cardsRaw] = reply.split('---CARDS---');
      const body = rawBody.trim();
      setResult(body);
      const added = parseAndVaultCards(cardsRaw, selectedBook);
      setGuideCards(added);
      // Persist the guide so it survives a refresh (regenerable, never lost).
      // Awaited/revert: a failed on-device write surfaces an error, doesn't vanish.
      await persistGuide({ bookId: selectedBook.id, bookTitle: selectedBook.title, lens, provider, body, cards: added, verified: !!selectedBook.verified, postCutoff: !!selectedBook.postCutoff, grounded: !!(grounding.description || grounding.webThesis), createdAt: Date.now() });
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
    setMode('guide'); setIsGuide(true); setResult(savedGuide.body); setResultProvider(savedGuide.provider || ''); setGuideCards(savedGuide.cards || 0); setVaulted(false); setGuideErr(''); setGuideLens(savedGuide.lens || 'both');
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
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>Confirm this book before generating</div>
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
                  </div>
                )}

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
                  </div>
                  <button onClick={generateGuide} disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', background: loading ? 'var(--surf2)' : T.accent, color: loading ? 'var(--dim)' : T.onAccent, fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', minHeight: 40 }}>
                    <Icon name="BookOpen" size={14} /> {savedGuide ? 'Regenerate Study Guide' : 'Generate Study Guide'}
                  </button>
                </div>

                {/* A saved guide is one click away — never lost on refresh. */}
                {savedGuide && !(isGuide && result) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: withAlpha(T.accent, 8), border: `1px solid ${withAlpha(T.accent, 30)}`, borderRadius: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                      <Icon name="BookOpen" size={14} style={{ color: T.accent }} />
                      Saved study guide · {LENSES.find((l) => l.id === savedGuide.lens)?.label || 'Both'} lens · {new Date(savedGuide.createdAt).toLocaleDateString()}
                    </span>
                    <button onClick={viewSavedGuide}
                      style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
                      View guide
                    </button>
                  </div>
                )}
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
                    <MD text={result} color={T.accent} />
                    {isGuide && !loading && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bord2)' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Visualize the frameworks</div>
                        <DiagramBlock
                          content={result}
                          hint={`Diagram the key frameworks in "${selectedBook.title}" and how they relate.`}
                          initialCode={savedGuide?.diagram || ''}
                          onGenerated={saveGuideDiagram}
                          label="Visualize frameworks"
                          auto={extractFrameworks(result).length >= 3}
                        />
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
