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
  { title: "Extreme Ownership", author: "Jocko Willink", type: "leadership", color: "#9BA69B" },
  { title: "Chip War", author: "Chris Miller", type: "systems", color: "#9BA69B" },
  { title: "The New Map", author: "Daniel Yergin", type: "systems", color: "#9BA69B" },
  { title: "Winning", author: "Jack Welch", type: "business", color: "#9BA69B" },
  { title: "Never Split the Difference", author: "Chris Voss", type: "negotiation", color: "#9BA69B" },
  { title: "The Tipping Point", author: "Malcolm Gladwell", type: "systems", color: "#9BA69B" },
  { title: "Greenlights", author: "Matthew McConaughey", type: "memoir", color: "#9BA69B" },
  { title: "Fortitude", author: "Dan Crenshaw", type: "stoic", color: "#9BA69B" },
  { title: "Coffee Bean", author: "Jon Gordon", type: "stoic", color: "#9BA69B" },
  { title: "Essays of Warren Buffett", author: "Warren Buffett", type: "business", color: "#9BA69B" },
  { title: "7 Habits of Highly Effective People", author: "Stephen Covey", type: "leadership", color: "#9BA69B" },
  { title: "Tools of Titans", author: "Tim Ferriss", type: "business", color: "#9BA69B" },
  { title: "Transfluence", author: "Walt Rakowich", type: "leadership", color: "#9BA69B" },
  { title: "Influence", author: "Robert Cialdini", type: "negotiation", color: "#9BA69B" },
  { title: "The Snowball Effect", author: "Alice Schroeder", type: "business", color: "#9BA69B" },
  { title: "Power of Positive Leadership", author: "Jon Gordon", type: "leadership", color: "#9BA69B" },
  { title: "A Life Well Played", author: "Arnold Palmer", type: "memoir", color: "#9BA69B" },
  { title: "Laws of Human Nature", author: "Robert Greene", type: "negotiation", color: "#9BA69B" },
  { title: "Man's Search for Meaning", author: "Viktor Frankl", type: "stoic", color: "#9BA69B" },
  { title: "Thinking Fast and Slow", author: "Daniel Kahneman", type: "systems", color: "#9BA69B" },
];

export const TYPE_META = {
  leadership: { icon: "🎯", label: "Leadership", color: "#9BA69B" },
  systems:    { icon: "⚙️", label: "Systems/Macro", color: "#9BA69B" },
  business:   { icon: "📈", label: "Business", color: "#9BA69B" },
  negotiation:{ icon: "🤝", label: "Negotiation", color: "#9BA69B" },
  memoir:     { icon: "📖", label: "Memoir", color: "#9BA69B" },
  stoic:      { icon: "🪨", label: "Stoic/Character", color: "#9BA69B" },
  fiction:    { icon: "🎭", label: "Fiction", color: "#9BA69B" },
  other:      { icon: "📚", label: "General", color: "#9BA69B" },
};

export const ENTRY_MODES = [
  { id: "book",     icon: "📚", label: "Book",          desc: "Full package, read-along, reference, or open discussion.", color: "#9BA69B" },
  { id: "document", icon: "📄", label: "Document",      desc: "PDF, Word, Excel, PowerPoint, image, or web link.",       color: "#9BA69B" },
  { id: "topic",    icon: "🎓", label: "Topic / Course", desc: "Name any subject. I build a structured course.",          color: "#9BA69B" },
  { id: "youtube",  icon: "▶️", label: "YouTube",       desc: "Paste a URL. I extract the transcript and teach you.",    color: "#9BA69B" },
];

export const SESSION_MODES = [
  { id: "package",   icon: "📦", label: "Full Package",   desc: "Complete intelligence brief. Format negotiated first." },
  { id: "readalong", icon: "📍", label: "Read Along",     desc: "Mid-book. I pre-map everything, work section by section." },
  { id: "reference", icon: "🔍", label: "Deep Reference", desc: "Master-expert depth on specific concepts or frameworks." },
  { id: "socratic",  icon: "🧠", label: "Socratic Mode",  desc: "I quiz you. You answer. I correct and build. Active recall." },
  { id: "chat",      icon: "💬", label: "Open Discussion", desc: "Explore ideas, make connections. Most flexible." },
];

export const NAV_ITEMS = [
  { id: "home",      label: "Home",       desc: "Dashboard & daily brief",   accent: '#D9A441' },
  { id: "learn",     label: "Learn",      desc: "AI-powered study sessions", accent: '#D9A441' },
  { id: "ladder",    label: "Ladder",     desc: "Structured learning path",  accent: '#D9A441' },
  { id: "books",     label: "Books",      desc: "Deep reading mode",         accent: '#D9A441' },
  { id: "research",  label: "Research",   desc: "Truth-first analysis",      accent: '#D9A441' },
  { id: "deepdive",  label: "Deep Dive",  desc: "Sourced research files",    accent: '#D9A441' },
  { id: "translate", label: "Translate",  desc: "25+ languages",             accent: '#D9A441' },
  { id: "projects",  label: "Projects",   desc: "Track & ship goals",        accent: '#D9A441' },
  { id: "podcast",   label: "Podcasts",   desc: "AI episode summaries",      accent: '#D9A441' },
  { id: "vault",     label: "Vault",      desc: "Knowledge base",            accent: '#D9A441' },
  { id: "studio",    label: "Studio",     desc: "Generate deliverables",     accent: '#D9A441' },
  { id: "growth",    label: "Growth",     desc: "Goals & synthesis",         accent: '#D9A441' },
  { id: "inbox",     label: "Inbox",      desc: "Save & analyze content",    accent: '#D9A441' },
  { id: "decisions", label: "Decisions",  desc: "Decision journal",          accent: '#D9A441' },
  { id: "coach",     label: "Coach",      desc: "AI accountability coach",   accent: '#D9A441' },
  { id: "ted",       label: "TED",        desc: "Curated talks, AI briefed", accent: '#D9A441' },
  { id: "quiz",      label: "Quiz",       desc: "Self-assessment & gaps",    accent: '#D9A441' },
];

export const CHAT_MODES = [
  { id: "synthesis", label: "Synthesis",       icon: "⚡", desc: "Connect ideas across everything you know" },
  { id: "socratic",  label: "Socratic",        icon: "🧠", desc: "Question-driven active recall" },
  { id: "reference", label: "Reference",       icon: "🔍", desc: "Master-expert depth on demand" },
  { id: "advisor",   label: "Project Advisor", icon: "🚀", desc: "Apply your knowledge to active projects" },
  { id: "truth",     label: "Truth Seeker",    icon: "🎯", desc: "Cut through noise, find the signal" },
];

export const PROJECT_CATEGORIES = {
  finance:  { label: "Finance",  color: "#9BA69B", icon: "💰" },
  business: { label: "Business", color: "#9BA69B", icon: "📊" },
  health:   { label: "Health",   color: "#9BA69B", icon: "⚡" },
  learning: { label: "Learning", color: "#9BA69B", icon: "📚" },
  other:    { label: "Other",    color: "#9BA69B", icon: "🎯" },
};

export const PROJECT_STATUSES = [
  { id: "planning",    label: "Planning",    color: "#9BA69B" },
  { id: "active",      label: "Active",      color: "#9BA69B" },
  { id: "review",      label: "Review",      color: "#9BA69B" },
  { id: "done",        label: "Done",        color: "#9BA69B" },
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
  { id: 'nonfiction',  label: 'Non-Fiction / Business', icon: '📊', color: '#9BA69B', examples: 'Business, finance, science, self-help' },
  { id: 'fiction',     label: 'Literary Fiction',       icon: '📖', color: '#9BA69B', examples: 'Novels, short stories, literary works' },
  { id: 'scifi',       label: 'Sci-Fi / Fantasy',       icon: '🚀', color: '#9BA69B', examples: 'Science fiction, fantasy, speculative' },
  { id: 'history',     label: 'History / Biography',    icon: '🏛', color: '#9BA69B', examples: 'History, biography, memoir' },
  { id: 'academic',    label: 'Academic / Textbook',    icon: '🎓', color: '#9BA69B', examples: 'Textbooks, research papers, higher ed' },
  { id: 'reference',   label: 'Reference / Technical',  icon: '📋', color: '#9BA69B', examples: 'Legal, medical, technical manuals' },
  { id: 'training',    label: 'Training / Professional',icon: '💼', color: '#9BA69B', examples: 'Corporate training, certifications' },
  { id: 'philosophy',  label: 'Philosophy / Theory',    icon: '🧠', color: '#9BA69B', examples: 'Philosophy, critical theory, ethics' },
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

// The Film Room — chalkboard dark: warm pine-charcoal, chalk text, one brass accent
export const THEME_DARK = {
  '--ink':           '#111A16',
  '--surface':       '#18231E',
  '--chalk':         '#F2EFE6',
  '--chalk-dim':     '#9BA69B',
  '--accent':        '#D9A441',
  '--line':          '#2A362F',
  '--bg':            '#111A16',
  '--bg-alt':        '#0D140F',
  '--bg-nav':        '#0F1712',
  '--surf2':         '#1F2C25',
  '--border':        '#2A362F',
  '--bord2':         'rgba(242,239,230,0.06)',
  '--border-dim':    'rgba(242,239,230,0.03)',
  '--overlay':       'rgba(9,14,11,0.86)',
  '--text':          '#F2EFE6',
  '--text-b':        '#DCD9CE',
  '--text-c':        '#C4C2B6',
  '--muted':         '#9BA69B',
  '--subtle':        '#7C877C',
  '--dim':           '#5E685E',
  '--u-bubble':      '#1F2C25',
  '--u-bubble-b':    '#2A362F',
  '--u-bubble-text': '#DCD9CE',
  '--scrollbar':     '#2A362F',
  '--scrollbar-h':   '#3A4740',
  '--accent-glow':   'rgba(217,164,65,0.12)',
  '--accent2':       '#B8862E',
  '--gold':          '#D9A441',
  '--green':         '#86A67A',
  '--red':           '#C4553D',
};

// The Film Room — daylight: warm chalk-paper, pine ink, deeper brass accent
export const THEME_LIGHT = {
  '--ink':           '#EDE9E0',
  '--surface':       '#F6F3EC',
  '--chalk':         '#1E2A22',
  '--chalk-dim':     '#5E685E',
  '--accent':        '#B8862E',
  '--line':          'rgba(30,42,34,0.12)',
  '--bg':            '#EDE9E0',
  '--bg-alt':        '#E4DED2',
  '--bg-nav':        '#F6F3EC',
  '--surf2':         '#E7E1D5',
  '--border':        'rgba(30,42,34,0.12)',
  '--bord2':         'rgba(30,42,34,0.08)',
  '--border-dim':    'rgba(30,42,34,0.04)',
  '--overlay':       'rgba(30,30,20,0.40)',
  '--text':          '#1E2A22',
  '--text-b':        '#2E3A32',
  '--text-c':        '#3E4A42',
  '--muted':         '#5E685E',
  '--subtle':        '#6B746A',
  '--dim':           '#98A098',
  '--u-bubble':      '#E7E1D5',
  '--u-bubble-b':    '#D6CFC0',
  '--u-bubble-text': '#2E3A32',
  '--scrollbar':     '#D6CFC0',
  '--scrollbar-h':   '#C4BCAC',
  '--accent-glow':   'rgba(184,134,46,0.10)',
  '--accent2':       '#8A6420',
  '--gold':          '#B8862E',
  '--green':         '#5A7A4A',
  '--red':           '#B04A32',
};
