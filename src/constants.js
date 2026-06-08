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
  { title: "Extreme Ownership", author: "Jocko Willink", type: "leadership", color: "#ff6644" },
  { title: "Chip War", author: "Chris Miller", type: "systems", color: "#00FFB2" },
  { title: "The New Map", author: "Daniel Yergin", type: "systems", color: "#4488ff" },
  { title: "Winning", author: "Jack Welch", type: "business", color: "#ffcc44" },
  { title: "Never Split the Difference", author: "Chris Voss", type: "negotiation", color: "#ff4488" },
  { title: "The Tipping Point", author: "Malcolm Gladwell", type: "systems", color: "#44ffcc" },
  { title: "Greenlights", author: "Matthew McConaughey", type: "memoir", color: "#88ff44" },
  { title: "Fortitude", author: "Dan Crenshaw", type: "stoic", color: "#ff8844" },
  { title: "Coffee Bean", author: "Jon Gordon", type: "stoic", color: "#cc8844" },
  { title: "Essays of Warren Buffett", author: "Warren Buffett", type: "business", color: "#ffaa00" },
  { title: "7 Habits of Highly Effective People", author: "Stephen Covey", type: "leadership", color: "#4466ff" },
  { title: "Tools of Titans", author: "Tim Ferriss", type: "business", color: "#ff44cc" },
  { title: "Transfluence", author: "Walt Rakowich", type: "leadership", color: "#44ccff" },
  { title: "Influence", author: "Robert Cialdini", type: "negotiation", color: "#ff4466" },
  { title: "The Snowball Effect", author: "Alice Schroeder", type: "business", color: "#ffdd44" },
  { title: "Power of Positive Leadership", author: "Jon Gordon", type: "leadership", color: "#44ff88" },
  { title: "A Life Well Played", author: "Arnold Palmer", type: "memoir", color: "#88ccff" },
  { title: "Laws of Human Nature", author: "Robert Greene", type: "negotiation", color: "#cc44ff" },
  { title: "Man's Search for Meaning", author: "Viktor Frankl", type: "stoic", color: "#ffccaa" },
  { title: "Thinking Fast and Slow", author: "Daniel Kahneman", type: "systems", color: "#44ffff" },
];

export const TYPE_META = {
  leadership: { icon: "🎯", label: "Leadership", color: "#ff6644" },
  systems:    { icon: "⚙️", label: "Systems/Macro", color: "#00FFB2" },
  business:   { icon: "📈", label: "Business", color: "#ffcc44" },
  negotiation:{ icon: "🤝", label: "Negotiation", color: "#ff4488" },
  memoir:     { icon: "📖", label: "Memoir", color: "#88ff44" },
  stoic:      { icon: "🪨", label: "Stoic/Character", color: "#ff8844" },
  fiction:    { icon: "🎭", label: "Fiction", color: "#aa88ff" },
  other:      { icon: "📚", label: "General", color: "#4488ff" },
};

export const ENTRY_MODES = [
  { id: "book",     icon: "📚", label: "Book",          desc: "Full package, read-along, reference, or open discussion.", color: "#00FFB2" },
  { id: "document", icon: "📄", label: "Document",      desc: "PDF, Word, Excel, PowerPoint, image, or web link.",       color: "#4488ff" },
  { id: "topic",    icon: "🎓", label: "Topic / Course", desc: "Name any subject. I build a structured course.",          color: "#ff8844" },
  { id: "youtube",  icon: "▶️", label: "YouTube",       desc: "Paste a URL. I extract the transcript and teach you.",    color: "#ff4444" },
];

export const SESSION_MODES = [
  { id: "package",   icon: "📦", label: "Full Package",   desc: "Complete intelligence brief. Format negotiated first." },
  { id: "readalong", icon: "📍", label: "Read Along",     desc: "Mid-book. I pre-map everything, work section by section." },
  { id: "reference", icon: "🔍", label: "Deep Reference", desc: "Master-expert depth on specific concepts or frameworks." },
  { id: "socratic",  icon: "🧠", label: "Socratic Mode",  desc: "I quiz you. You answer. I correct and build. Active recall." },
  { id: "chat",      icon: "💬", label: "Open Discussion", desc: "Explore ideas, make connections. Most flexible." },
];

export const NAV_ITEMS = [
  { id: "home",      label: "Home",       desc: "Dashboard & daily brief",   accent: "#00C6E6" },
  { id: "learn",     label: "Learn",      desc: "AI-powered study sessions", accent: "#00C6E6" },
  { id: "books",     label: "Books",      desc: "Deep reading mode",         accent: "#a78bfa" },
  { id: "research",  label: "Research",   desc: "Truth-first analysis",      accent: "#6366F1" },
  { id: "translate", label: "Translate",  desc: "25+ languages",             accent: "#38bdf8" },
  { id: "projects",  label: "Projects",   desc: "Track & ship goals",        accent: "#ff8844" },
  { id: "podcast",   label: "Podcasts",   desc: "AI episode summaries",      accent: "#e11d48" },
  { id: "vault",     label: "Vault",      desc: "Knowledge base",            accent: "#ffcc44" },
  { id: "growth",    label: "Growth",     desc: "Goals & synthesis",         accent: "#10b981" },
  { id: "inbox",     label: "Inbox",      desc: "Save & analyze content",    accent: "#10b981" },
  { id: "decisions", label: "Decisions",  desc: "Decision journal",          accent: "#f59e0b" },
  { id: "coach",     label: "Coach",      desc: "AI accountability coach",   accent: "#8b5cf6" },
  { id: "ted",       label: "TED",        desc: "Curated talks, AI briefed", accent: "#e2231a" },
  { id: "quiz",      label: "Quiz",       desc: "Self-assessment & gaps",    accent: "#f59e0b" },
];

export const CHAT_MODES = [
  { id: "synthesis", label: "Synthesis",       icon: "⚡", desc: "Connect ideas across everything you know" },
  { id: "socratic",  label: "Socratic",        icon: "🧠", desc: "Question-driven active recall" },
  { id: "reference", label: "Reference",       icon: "🔍", desc: "Master-expert depth on demand" },
  { id: "advisor",   label: "Project Advisor", icon: "🚀", desc: "Apply your knowledge to active projects" },
  { id: "truth",     label: "Truth Seeker",    icon: "🎯", desc: "Cut through noise, find the signal" },
];

export const PROJECT_CATEGORIES = {
  finance:  { label: "Finance",  color: "#00FFB2", icon: "💰" },
  business: { label: "Business", color: "#6366F1", icon: "📊" },
  health:   { label: "Health",   color: "#ff8844", icon: "⚡" },
  learning: { label: "Learning", color: "#ffcc44", icon: "📚" },
  other:    { label: "Other",    color: "#4488ff", icon: "🎯" },
};

export const PROJECT_STATUSES = [
  { id: "planning",    label: "Planning",    color: "#6366F1" },
  { id: "active",      label: "Active",      color: "#00FFB2" },
  { id: "review",      label: "Review",      color: "#ffcc44" },
  { id: "done",        label: "Done",        color: "#44ff88" },
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
  { id: 'nonfiction',  label: 'Non-Fiction / Business', icon: '📊', color: '#00FFB2', examples: 'Business, finance, science, self-help' },
  { id: 'fiction',     label: 'Literary Fiction',       icon: '📖', color: '#ff8844', examples: 'Novels, short stories, literary works' },
  { id: 'scifi',       label: 'Sci-Fi / Fantasy',       icon: '🚀', color: '#6366F1', examples: 'Science fiction, fantasy, speculative' },
  { id: 'history',     label: 'History / Biography',    icon: '🏛', color: '#ffcc44', examples: 'History, biography, memoir' },
  { id: 'academic',    label: 'Academic / Textbook',    icon: '🎓', color: '#4488ff', examples: 'Textbooks, research papers, higher ed' },
  { id: 'reference',   label: 'Reference / Technical',  icon: '📋', color: '#ff4488', examples: 'Legal, medical, technical manuals' },
  { id: 'training',    label: 'Training / Professional',icon: '💼', color: '#44ffcc', examples: 'Corporate training, certifications' },
  { id: 'philosophy',  label: 'Philosophy / Theory',    icon: '🧠', color: '#aa88ff', examples: 'Philosophy, critical theory, ethics' },
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

// Slate-navy dark — elevated readability, clear surface hierarchy
export const THEME_DARK = {
  '--bg':            '#0d1117',
  '--bg-alt':        '#090d12',
  '--bg-nav':        '#0d1117',
  '--surface':       '#161b27',
  '--surf2':         '#1c2333',
  '--border':        '#2a3448',
  '--bord2':         '#1e2c40',
  '--border-dim':    'rgba(42,52,72,0.5)',
  '--overlay':       'rgba(4,8,18,0.88)',
  '--text':          '#e6edf3',
  '--text-b':        '#cdd9e8',
  '--text-c':        '#8fa9c8',
  '--muted':         '#7090a8',
  '--subtle':        '#556878',
  '--dim':           '#5a7888',
  '--u-bubble':      '#151e2e',
  '--u-bubble-b':    '#1e2c42',
  '--u-bubble-text': '#b8cce0',
  '--scrollbar':     '#1e2c40',
  '--scrollbar-h':   '#2a3c54',
  '--accent':        '#00C6E6',
  '--accent-glow':   'rgba(0,198,230,0.10)',
  '--accent2':       '#F5820D',
  '--green':         '#00CC76',
  '--red':           '#FF3D2E',
};

// TIME/editorial-inspired light — warm white, classic red, high-contrast editorial
export const THEME_LIGHT = {
  '--bg':            '#F5F3F0',
  '--bg-alt':        '#EDEBE6',
  '--bg-nav':        '#FFFFFF',
  '--surface':       '#FFFFFF',
  '--surf2':         '#F0EDE8',
  '--border':        'rgba(0,0,0,0.08)',
  '--bord2':         'rgba(0,0,0,0.05)',
  '--border-dim':    'rgba(0,0,0,0.03)',
  '--overlay':       'rgba(20,10,0,0.45)',
  '--text':          '#0A0A0A',
  '--text-b':        '#1C1C1C',
  '--text-c':        '#3A3A3A',
  '--muted':         '#787878',
  '--subtle':        '#909090',
  '--dim':           '#AAAAAA',
  '--u-bubble':      '#F0EDE8',
  '--u-bubble-b':    '#E2DED8',
  '--u-bubble-text': '#1A1A1A',
  '--scrollbar':     '#D8D5D0',
  '--scrollbar-h':   '#C8C5C0',
  '--accent':        '#CC0000',
  '--accent-glow':   'rgba(204,0,0,0.07)',
  '--accent2':       '#333333',
  '--green':         '#006633',
  '--red':           '#CC0000',
};
