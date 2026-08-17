import { T } from './theme';
// Thin identity — used in Research Hub and truth-first contexts.
// No teaching style, no forced connections — lets the analysis breathe.
export const CB_IDENTITY = `You are CB's Intelligence System — research analyst, truth-seeker, and knowledge hub.

WHO CB IS:
Mid-to-late 30s, Houston TX. BD professional. Family-first, long-game operator. Stoic philosophy, systems thinker. Always hunting tipping points, compounding effects, Blue Ocean opportunities.

CB'S GOALS:
- Financial: $10K+/mo passive income (dividends, real estate, business revenue)
- Health: performance + longevity (Attia, Huberman frameworks)
- Building: scalable, sellable, modular businesses
- Priority: W2 protection → passive income → business building

DECISIVENESS RULE: Every output ends with a clear recommendation, action, or bet. No vagueness.`;

// Full learning spine — used in Learn, Chat, and Growth modules.
// Adds teaching style, mental model library, and cross-reference rules.
export const CB_LEARNING_SPINE = CB_IDENTITY + `

HOW CB LEARNS:
- Big picture FIRST — thesis then details. Never build to the point.
- Lead with: #1 insight → supporting evidence → so-what implication
- Sports analogies first, everyday life second. Simple and sticky.
- Blunt on hard truths — no cushioning
- Systems thinker — tipping points, compounding, inflection moments
- Blue Ocean default — uncontested space over competing harder
- Stoic: adversity is data, not crisis

CB'S MENTAL MODEL LIBRARY (connect automatically):
Extreme Ownership (Willink) — radical accountability
Chip War (Miller) — semiconductor geopolitics, chokepoints
The New Map (Yergin) — energy geopolitics
Winning (Welch) — candor, differentiation, people-first
Never Split the Difference (Voss) — tactical empathy, negotiation
The Tipping Point (Gladwell) — contagion, connectors
Greenlights (McConaughey) — memoir, resilience
Fortitude (Crenshaw) — mental toughness
Coffee Bean (Gordon) — mindset, environment vs. response
Essays of Warren Buffett — compounding, moats, long-term value
7 Habits (Covey) — character ethics, interdependence
Tools of Titans (Ferriss) — systems of high performers
Transfluence (Rakowich) — Humility, Honesty, Heart
Influence (Cialdini) — persuasion, reciprocity, social proof
The Snowball Effect — compounding, patience
Power of Positive Leadership (Gordon) — energy, vision, culture
A Life Well Played (Palmer) — integrity, legacy
Laws of Human Nature (Greene) — human behavior, motivations
Man's Search for Meaning (Frankl) — purpose, suffering, resilience
Thinking Fast and Slow (Kahneman) — System 1/2, cognitive bias

MASTER EXPERT RULE: For every topic, book, document, or video — become world-class in all surrounding subject matter automatically. Go deep without being asked.
CROSS-REFERENCE RULE: Always connect to CB's mental model library. Make connections explicit.`;

// Alias for any references not yet migrated
export const CB_SPINE = CB_LEARNING_SPINE;

export const KNOWN_BOOKS = [
  { title: "Extreme Ownership", author: "Jocko Willink", type: "leadership", color: T.textSecondary },
  { title: "Chip War", author: "Chris Miller", type: "systems", color: T.textSecondary },
  { title: "The New Map", author: "Daniel Yergin", type: "systems", color: T.textSecondary },
  { title: "Winning", author: "Jack Welch", type: "business", color: T.textSecondary },
  { title: "Never Split the Difference", author: "Chris Voss", type: "negotiation", color: T.textSecondary },
  { title: "The Tipping Point", author: "Malcolm Gladwell", type: "systems", color: T.textSecondary },
  { title: "Greenlights", author: "Matthew McConaughey", type: "memoir", color: T.textSecondary },
  { title: "Fortitude", author: "Dan Crenshaw", type: "stoic", color: T.textSecondary },
  { title: "Coffee Bean", author: "Jon Gordon", type: "stoic", color: T.textSecondary },
  { title: "Essays of Warren Buffett", author: "Warren Buffett", type: "business", color: T.textSecondary },
  { title: "7 Habits of Highly Effective People", author: "Stephen Covey", type: "leadership", color: T.textSecondary },
  { title: "Tools of Titans", author: "Tim Ferriss", type: "business", color: T.textSecondary },
  { title: "Transfluence", author: "Walt Rakowich", type: "leadership", color: T.textSecondary },
  { title: "Influence", author: "Robert Cialdini", type: "negotiation", color: T.textSecondary },
  { title: "The Snowball Effect", author: "Alice Schroeder", type: "business", color: T.textSecondary },
  { title: "Power of Positive Leadership", author: "Jon Gordon", type: "leadership", color: T.textSecondary },
  { title: "A Life Well Played", author: "Arnold Palmer", type: "memoir", color: T.textSecondary },
  { title: "Laws of Human Nature", author: "Robert Greene", type: "negotiation", color: T.textSecondary },
  { title: "Man's Search for Meaning", author: "Viktor Frankl", type: "stoic", color: T.textSecondary },
  { title: "Thinking Fast and Slow", author: "Daniel Kahneman", type: "systems", color: T.textSecondary },
];

export const TYPE_META = {
  leadership: { icon: "🎯", label: "Leadership", color: T.textSecondary },
  systems:    { icon: "⚙️", label: "Systems/Macro", color: T.textSecondary },
  business:   { icon: "📈", label: "Business", color: T.textSecondary },
  negotiation:{ icon: "🤝", label: "Negotiation", color: T.textSecondary },
  memoir:     { icon: "📖", label: "Memoir", color: T.textSecondary },
  stoic:      { icon: "🪨", label: "Stoic/Character", color: T.textSecondary },
  fiction:    { icon: "🎭", label: "Fiction", color: T.textSecondary },
  other:      { icon: "📚", label: "General", color: T.textSecondary },
};

export const ENTRY_MODES = [
  { id: "book",     icon: "📚", label: "Book",          desc: "Full package, read-along, reference, or open discussion.", color: T.textSecondary },
  { id: "document", icon: "📄", label: "Document",      desc: "PDF, Word, Excel, PowerPoint, image, or web link.",       color: T.textSecondary },
  { id: "topic",    icon: "🎓", label: "Topic / Course", desc: "Name any subject. I build a structured course.",          color: T.textSecondary },
  { id: "youtube",  icon: "▶️", label: "YouTube",       desc: "Paste a URL. I extract the transcript and teach you.",    color: T.textSecondary },
];

export const SESSION_MODES = [
  { id: "package",   icon: "📦", label: "Full Package",   desc: "Complete intelligence brief. Format negotiated first." },
  { id: "readalong", icon: "📍", label: "Read Along",     desc: "Mid-book. I pre-map everything, work section by section." },
  { id: "reference", icon: "🔍", label: "Deep Reference", desc: "Master-expert depth on specific concepts or frameworks." },
  { id: "socratic",  icon: "🧠", label: "Socratic Mode",  desc: "I quiz you. You answer. I correct and build. Active recall." },
  { id: "chat",      icon: "💬", label: "Open Discussion", desc: "Explore ideas, make connections. Most flexible." },
];

export const NAV_ITEMS = [
  { id: "home",      label: "Home",       desc: "Dashboard & daily brief",   accent: T.accent },
  { id: "learn",     label: "Learn",      desc: "AI-powered study sessions", accent: T.accent },
  { id: "academy",   label: "Academy",    desc: "Field manuals & drills",    accent: T.accent },
  { id: "ladder",    label: "Ladder",     desc: "Structured learning path",  accent: T.accent },
  { id: "books",     label: "Books",      desc: "Deep reading mode",         accent: T.accent },
  { id: "research",  label: "Research",   desc: "Truth-first analysis",      accent: T.accent },
  { id: "deepdive",  label: "Deep Dive",  desc: "Sourced research files",    accent: T.accent },
  { id: "translate", label: "Translate",  desc: "25+ languages",             accent: T.accent },
  { id: "projects",  label: "Projects",   desc: "Track & ship goals",        accent: T.accent },
  { id: "podcast",   label: "Podcasts",   desc: "AI episode summaries",      accent: T.accent },
  { id: "vault",     label: "Vault",      desc: "Knowledge base",            accent: T.accent },
  { id: "studio",    label: "Studio",     desc: "Generate deliverables",     accent: T.accent },
  { id: "growth",    label: "Growth",     desc: "Goals & synthesis",         accent: T.accent },
  { id: "inbox",     label: "Inbox",      desc: "Save & analyze content",    accent: T.accent },
  { id: "decisions", label: "Decisions",  desc: "Decision journal",          accent: T.accent },
  { id: "coach",     label: "Coach",      desc: "AI accountability coach",   accent: T.accent },
  { id: "ted",       label: "TED",        desc: "Curated talks, AI briefed", accent: T.accent },
  { id: "quiz",      label: "Quiz",       desc: "Self-assessment & gaps",    accent: T.accent },
];

// ── Containers ────────────────────────────────────────────────────────────
// The 18 modules collapse into 6 verb-grouped containers. Each module keeps
// its id and becomes a *mode* inside its container — nothing is deleted, and
// every legacy `setActiveModule('<moduleId>')` deep-link still resolves,
// because the mode ids ARE the old module ids. The container a mode lives in
// is derived (see containerOfMode). Coach is intentionally absent — it stops
// being a tab and becomes the global Ask layer.
export const CONTAINERS = [
  { id: "home",     label: "Home",     verb: "Orient",      modes: ["home"] },
  { id: "learn",    label: "Learn",    verb: "Absorb",      modes: ["learn", "academy", "ladder", "books", "deepdive", "ted", "podcast", "translate", "quiz"] },
  { id: "research", label: "Research", verb: "Investigate", modes: ["research", "inbox"] },
  { id: "skills",   label: "Skills",   verb: "Practice",    modes: ["vault", "growth"] },
  { id: "projects", label: "Projects", verb: "Execute",     modes: ["projects", "decisions"] },
  { id: "studio",   label: "Studio",   verb: "Produce",     modes: ["studio"] },
];

// Mobile bottom bar shows five; the sixth+ live under "More".
export const BOTTOM_NAV_IDS = ["home", "learn", "skills", "research"];

// Per-mode metadata (label / desc / accent), keyed by mode id.
export const MODE_META = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, n]));

// Which container owns a given mode id. Falls back to Home so an unknown or
// relocated legacy id never lands nowhere.
export const containerOfMode = (modeId) =>
  CONTAINERS.find((c) => c.modes.includes(modeId))?.id || "home";

export const CHAT_MODES = [
  { id: "synthesis", label: "Synthesis",       icon: "⚡", desc: "Connect ideas across everything you know" },
  { id: "socratic",  label: "Socratic",        icon: "🧠", desc: "Question-driven active recall" },
  { id: "reference", label: "Reference",       icon: "🔍", desc: "Master-expert depth on demand" },
  { id: "advisor",   label: "Project Advisor", icon: "🚀", desc: "Apply your knowledge to active projects" },
  { id: "truth",     label: "Truth Seeker",    icon: "🎯", desc: "Cut through noise, find the signal" },
];

export const PROJECT_CATEGORIES = {
  finance:  { label: "Finance",  color: T.textSecondary, icon: "💰" },
  business: { label: "Business", color: T.textSecondary, icon: "📊" },
  health:   { label: "Health",   color: T.textSecondary, icon: "⚡" },
  learning: { label: "Learning", color: T.textSecondary, icon: "📚" },
  other:    { label: "Other",    color: T.textSecondary, icon: "🎯" },
};

export const PROJECT_STATUSES = [
  { id: "planning",    label: "Planning",    color: T.textSecondary },
  { id: "active",      label: "Active",      color: T.textSecondary },
  { id: "review",      label: "Review",      color: T.textSecondary },
  { id: "done",        label: "Done",        color: T.textSecondary },
];

export const ACCEPT_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic,.mp3,.m4a,.wav,.ogg,.mp4,.mov";

export const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect', flag: '🔍', variants: null },
  { code: 'en',   label: 'English',     flag: '🇺🇸', variants: [
    { code: 'en-US', label: 'American English' },
    { code: 'en-GB', label: 'British English' },
    { code: 'en-AU', label: 'Australian English' },
  ]},
  { code: 'es',   label: 'Spanish',     flag: '🇪🇸', variants: [
    { code: 'es-MX', label: 'Mexican Spanish' },
    { code: 'es-ES', label: 'Castilian Spanish (Spain)' },
    { code: 'es-AR', label: 'Argentine Spanish (vos)' },
    { code: 'es-CO', label: 'Colombian Spanish' },
    { code: 'es-VE', label: 'Venezuelan Spanish' },
    { code: 'es-CL', label: 'Chilean Spanish' },
    { code: 'es-PR', label: 'Puerto Rican Spanish' },
    { code: 'es-DO', label: 'Dominican Spanish' },
    { code: 'es-US', label: 'US Latino Spanish' },
  ]},
  { code: 'pt',   label: 'Portuguese',  flag: '🇧🇷', variants: [
    { code: 'pt-BR', label: 'Brazilian Portuguese' },
    { code: 'pt-PT', label: 'European Portuguese (Portugal)' },
  ]},
  { code: 'fr',   label: 'French',      flag: '🇫🇷', variants: [
    { code: 'fr-FR', label: 'French (France)' },
    { code: 'fr-CA', label: 'Quebec French (Canada)' },
    { code: 'fr-BE', label: 'Belgian French' },
  ]},
  { code: 'de',   label: 'German',      flag: '🇩🇪', variants: [
    { code: 'de-DE', label: 'German (Germany)' },
    { code: 'de-AT', label: 'Austrian German' },
    { code: 'de-CH', label: 'Swiss German' },
  ]},
  { code: 'zh',   label: 'Chinese',     flag: '🇨🇳', variants: [
    { code: 'zh-CN', label: 'Simplified Chinese (Mainland)' },
    { code: 'zh-TW', label: 'Traditional Chinese (Taiwan)' },
    { code: 'zh-HK', label: 'Traditional Chinese (Hong Kong)' },
  ]},
  { code: 'ar',   label: 'Arabic',      flag: '🇸🇦', variants: [
    { code: 'ar',    label: 'Modern Standard Arabic (فصحى)' },
    { code: 'ar-EG', label: 'Egyptian Arabic (Masri)' },
    { code: 'ar-SA', label: 'Gulf Arabic (Saudi)' },
    { code: 'ar-LB', label: 'Levantine Arabic (Shami)' },
    { code: 'ar-MA', label: 'Moroccan Darija' },
  ]},
  { code: 'ja',  label: 'Japanese',   flag: '🇯🇵', variants: null },
  { code: 'ko',  label: 'Korean',     flag: '🇰🇷', variants: null },
  { code: 'hi',  label: 'Hindi',      flag: '🇮🇳', variants: null },
  { code: 'it',  label: 'Italian',    flag: '🇮🇹', variants: null },
  { code: 'ru',  label: 'Russian',    flag: '🇷🇺', variants: null },
  { code: 'tr',  label: 'Turkish',    flag: '🇹🇷', variants: null },
  { code: 'nl',  label: 'Dutch',      flag: '🇳🇱', variants: null },
  { code: 'pl',  label: 'Polish',     flag: '🇵🇱', variants: null },
  { code: 'sv',  label: 'Swedish',    flag: '🇸🇪', variants: null },
  { code: 'he',  label: 'Hebrew',     flag: '🇮🇱', variants: null },
  { code: 'id',  label: 'Indonesian', flag: '🇮🇩', variants: null },
  { code: 'vi',  label: 'Vietnamese', flag: '🇻🇳', variants: null },
  { code: 'th',  label: 'Thai',       flag: '🇹🇭', variants: null },
  { code: 'el',  label: 'Greek',      flag: '🇬🇷', variants: null },
  { code: 'uk',  label: 'Ukrainian',  flag: '🇺🇦', variants: null },
];

export const TRANSLATION_MODES = [
  { id: 'standard',  label: 'Standard',   icon: '🌐', desc: 'Natural, fluent translation' },
  { id: 'formal',    label: 'Formal',     icon: '👔', desc: 'Business / professional register' },
  { id: 'casual',    label: 'Casual',     icon: '💬', desc: 'Everyday conversational tone' },
  { id: 'literal',   label: 'Literal',    icon: '📖', desc: 'Word-for-word (for language study)' },
  { id: 'localized', label: 'Localized',  icon: '🏘', desc: 'Local idioms & cultural expressions' },
];
export const STORAGE_KEY  = "aether_hub_v1";
export const GRAPH_KEY    = "aether_graph_v1";
export const PROJECTS_KEY = "aether_projects_v1";
export const NOTES_KEY    = "aether_notes_v1";
export const RESEARCH_KEY = "aether_research_v1";

export const CONTENT_TYPES = [
  { id: 'nonfiction',  label: 'Non-Fiction / Business', icon: '📊', color: T.textSecondary, examples: 'Business, finance, science, self-help' },
  { id: 'fiction',     label: 'Literary Fiction',       icon: '📖', color: T.textSecondary, examples: 'Novels, short stories, literary works' },
  { id: 'scifi',       label: 'Sci-Fi / Fantasy',       icon: '🚀', color: T.textSecondary, examples: 'Science fiction, fantasy, speculative' },
  { id: 'history',     label: 'History / Biography',    icon: '🏛', color: T.textSecondary, examples: 'History, biography, memoir' },
  { id: 'academic',    label: 'Academic / Textbook',    icon: '🎓', color: T.textSecondary, examples: 'Textbooks, research papers, higher ed' },
  { id: 'reference',   label: 'Reference / Technical',  icon: '📋', color: T.textSecondary, examples: 'Legal, medical, technical manuals' },
  { id: 'training',    label: 'Training / Professional',icon: '💼', color: T.textSecondary, examples: 'Corporate training, certifications' },
  { id: 'philosophy',  label: 'Philosophy / Theory',    icon: '🧠', color: T.textSecondary, examples: 'Philosophy, critical theory, ethics' },
];

export const READER_GOALS = [
  { id: 'master',  label: 'Master Deeply',    icon: '🎯', desc: 'Full comprehension and long-term retention' },
  { id: 'exam',    label: 'Exam / Cert Prep', icon: '📝', desc: 'Test readiness, key concepts, likely questions' },
  { id: 'apply',   label: 'Apply to Work',    icon: '⚡', desc: 'Extract frameworks for immediate application' },
  { id: 'discuss', label: 'Discuss & Explore',icon: '💬', desc: 'Think out loud, debate, explore ideas' },
  { id: 'quick',   label: 'Quick Take',       icon: '🔍', desc: 'Core ideas fast, no deep dive needed' },
];

export const DEPTH_LEVELS = [
  { id: 'surface',  label: 'Surface',   desc: 'Key ideas, brief answers' },
  { id: 'standard', label: 'Standard',  desc: 'Full explanation with examples' },
  { id: 'deep',     label: 'Deep Dive', desc: 'Full reasoning, multiple perspectives' },
  { id: 'expert',   label: 'Expert',    desc: 'Peer-level discourse, challenge everything' },
];

export const READING_PROGRESS_OPTIONS = [
  { id: 'start',     label: 'Just Starting',    icon: '📖' },
  { id: 'mid',       label: 'Mid-Way',          icon: '🔖' },
  { id: 'done',      label: 'Finished',         icon: '✓' },
  { id: 'reference', label: 'Reference Lookup', icon: '🔍' },
];

// Theme tokens now live in index.html (:root / [data-theme="dark"]) and are
// driven by src/theme.js via the data-theme attribute. The old THEME_DARK /
// THEME_LIGHT inline-var maps were removed when the app moved to that system.
