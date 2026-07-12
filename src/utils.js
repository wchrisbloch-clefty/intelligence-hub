import { CB_IDENTITY, CB_LEARNING_SPINE } from './constants.js';
import { GRAPH_KEY, PROJECTS_KEY, NOTES_KEY, RESEARCH_KEY } from './constants.js';
import { SEED_GRAPH, SEED_PROJECTS, SEED_NOTES, SEED_RESEARCH } from './seedData.js';
import { storage } from './lib/storage.js';

// ─── STORAGE ──────────────────────────────────────────────────────────────
// Backed by /api/storage (Upstash, cross-device) with a localStorage fallback.
async function storageGet(key) {
  try {
    const r = await storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

async function storageSet(key, val) {
  try { await storage.set(key, JSON.stringify(val)); } catch {}
}

export async function loadGraph() {
  const saved = await storageGet(GRAPH_KEY);
  return saved || SEED_GRAPH;
}

export async function saveGraph(graph) {
  await storageSet(GRAPH_KEY, graph);
}

export async function loadProjects() {
  const saved = await storageGet(PROJECTS_KEY);
  return saved || SEED_PROJECTS;
}

export async function saveProjects(projects) {
  await storageSet(PROJECTS_KEY, projects);
}

export async function loadNotes() {
  const saved = await storageGet(NOTES_KEY);
  return saved || SEED_NOTES;
}

export async function saveNotes(notes) {
  await storageSet(NOTES_KEY, notes);
}

export async function loadResearch() {
  const saved = await storageGet(RESEARCH_KEY);
  return saved || SEED_RESEARCH;
}

export async function saveResearch(threads) {
  await storageSet(RESEARCH_KEY, threads);
}

export async function logSession(title, type, durationMin, confidence, notes) {
  const graph = await loadGraph();
  const key = title.toLowerCase().replace(/\s+/g, '_');
  if (!graph.topics[key]) {
    graph.topics[key] = { title, type, sessions: 0, totalMin: 0, confidence: 0, notes: [], firstSeen: Date.now(), lastSeen: null, connections: [] };
  }
  const t = graph.topics[key];
  t.sessions += 1;
  t.totalMin += durationMin;
  t.confidence = Math.round((t.confidence * (t.sessions - 1) + confidence) / t.sessions);
  t.lastSeen = Date.now();
  if (notes) t.notes.push({ note: notes, date: Date.now() });
  graph.sessions = graph.sessions || [];
  graph.sessions.push({ title, type, date: Date.now(), durationMin, confidence });
  graph.totalTime = (graph.totalTime || 0) + durationMin;
  graph.lastSeen = Date.now();
  // update streak
  const lastDate = new Date(graph.lastSeen || Date.now());
  const today = new Date();
  const diff = Math.floor((today - lastDate) / 86400000);
  if (diff <= 1) graph.streak = (graph.streak || 0) + 1;
  else graph.streak = 1;
  await saveGraph(graph);
  return graph;
}

// ─── YOUTUBE ──────────────────────────────────────────────────────────────
export function extractYouTubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Run providers in order, each with its own timeout; return the first non-null
// result, or null if they all fail. Keeps fallback chains declarative.
async function firstOk(providers) {
  for (const p of providers) {
    try {
      const r = await p();
      if (r != null) return r;
    } catch { /* try the next provider */ }
  }
  return null;
}

// Transcript + metadata come from our own /api/transcript endpoint (server-side
// youtube-transcript + oEmbed) — no third-party proxies, no CORS. Extraction
// can be slow/flaky, so we try a fast attempt then a patient retry, each with
// its own AbortSignal timeout.
async function fetchTranscriptData(videoId) {
  const attempt = (ms) => async () => {
    const r = await fetch(`/api/transcript?videoId=${encodeURIComponent(videoId)}`, { credentials: 'same-origin', signal: AbortSignal.timeout(ms) });
    if (r.status === 401) { notifyAuthExpired(); return null; }
    return r.ok ? await r.json() : null;
  };
  return await firstOk([attempt(8000), attempt(15000)]);
}

export async function fetchYouTubeTranscript(videoId) {
  const d = await fetchTranscriptData(videoId);
  return d?.transcriptAvailable ? d.transcript : null;
}

export async function fetchYouTubeMeta(videoId) {
  const d = await fetchTranscriptData(videoId);
  if (d) return { title: d.title, author_name: d.channel };
  return { title: 'YouTube Video', author_name: 'Unknown Channel' };
}

// ─── FILE HELPERS ─────────────────────────────────────────────────────────
export function getFileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  return { pdf:'📕', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📋', pptx:'📋', csv:'📊', txt:'📄', jpg:'🖼', jpeg:'🖼', png:'🖼', gif:'🖼', webp:'🖼', heic:'🖼' }[ext] || '📎';
}
export function getFileLabel(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  return { pdf:'PDF', doc:'Word', docx:'Word', xls:'Excel', xlsx:'Excel', ppt:'PowerPoint', pptx:'PowerPoint', csv:'Spreadsheet', txt:'Text', jpg:'Image', jpeg:'Image', png:'Image', gif:'Image', webp:'Image', heic:'Image' }[ext] || 'File';
}
export function isImageFile(name = '') { return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name); }
export async function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
}
export function getMimeType(file) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt:'application/vnd.ms-powerpoint', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt:'text/plain', csv:'text/csv', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp' }[ext] || 'application/octet-stream';
}

export async function processFiles(files) {
  const out = [];
  for (const file of Array.from(files)) {
    const isImg = isImageFile(file.name);
    const mime = getMimeType(file);
    const data = await fileToBase64(file);
    out.push({ name: file.name, label: getFileLabel(file.name), icon: getFileIcon(file.name), isImage: isImg, mimeType: mime, data, type: 'file' });
  }
  return out;
}

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────
// Returns { cached, dynamic } — callClaude caches the spine and sends
// the dynamic part (graph history + mode instructions) uncached.
export function buildSystem(entryMode, sessionMode, context, graph) {
  const graphSummary = graph && Object.keys(graph.topics || {}).length > 0
    ? '\n\nCB\'S LEARNING HISTORY (use this to personalize):\n' +
      Object.values(graph.topics).slice(-10).map(t => `- ${t.title} (${t.type}): ${t.sessions} sessions, ${t.totalMin}min, confidence ${t.confidence}/10`).join('\n')
    : '';

  // Truth seeker uses identity-only — objective analysis, no forced connections
  const spine = (entryMode === null && context.chatMode === 'truth') ? CB_IDENTITY : CB_LEARNING_SPINE;

  if (entryMode === 'book') {
    const instructions = {
      package: 'SESSION: FULL PACKAGE. Ask CB: (1) format recommendation — propose yours, ask if he agrees. (2) depth level. Then generate: thesis, frameworks, CB applications, cross-book connections, master expert domain knowledge, decisive recommendation.',
      readalong: 'SESSION: READ-ALONG. Pre-load full book structure silently. Ask where CB is. Work that section deeply. End every exchange with "watch for next" — no spoilers unless asked.',
      reference: 'SESSION: DEEP REFERENCE. Master-expert depth on whatever CB asks. Always: definition → why it matters → CB application → cross-book link → action. Flag proactively what he might be missing.',
      socratic: `SESSION: SOCRATIC MODE. You are the examiner, CB is the student. Ask one focused question at a time about "${context.book?.title}". Never lecture. Wait for CB's answer. Respond with: what he got right, what he missed, the correct answer, then the NEXT question. After 5 questions, scorecard: what he knows cold, what needs work. Start with: "Let's test your knowledge of ${context.book?.title}. First question:" then ask it.`,
      chat: 'SESSION: OPEN DISCUSSION. Follow CB\'s lead but stay ahead. Surface what he hasn\'t asked. Always end with recommendation or next question CB should be asking.',
    };
    return {
      cached: spine,
      dynamic: graphSummary + `\n\nBOOK: "${context.book?.title}" by ${context.book?.author}\nTYPE: ${context.book?.type}\n\n` + (instructions[sessionMode] || instructions.chat),
    };
  }

  if (entryMode === 'document') {
    return {
      cached: spine,
      dynamic: graphSummary + '\n\nSESSION: DOCUMENT ANALYSIS\n1. Identify document type and core purpose\n2. Extract key insights, data, frameworks\n3. Teach using CB\'s learning style\n4. Connect to CB\'s mental models and goals\n5. Flag what to act on, challenge, or investigate deeper\n\nIf CB asks to quiz — switch to Socratic mode: ask questions one at a time, wait for answers, correct and build.\n\nEnd by asking: "Want a course outline, quiz, reference guide, or visual summary from this?"',
    };
  }

  if (entryMode === 'topic') {
    const socraticNote = sessionMode === 'socratic'
      ? '\n\nSOCRATIC MODE ACTIVE: Do NOT lecture. Ask CB one question at a time about this topic. Wait for his answer. Correct, affirm, and deepen. Track weak spots. After 5 questions give a scorecard.'
      : '\n\nBuild: thesis → prerequisite check → 4-7 module course outline → teach each module (concept → analogy → CB application → action) → resources → decisive bet.\nAsk first: full course outline or dive into a specific module?';
    return {
      cached: spine,
      dynamic: graphSummary + `\n\nSESSION: TOPIC / COURSE BUILDER\nTopic: "${context.topic}"\nYou are world-class master expert in this topic and all surrounding domains.` + socraticNote,
    };
  }

  if (entryMode === 'youtube') {
    const { title, channel, transcript, url, transcriptAvailable } = context;
    const tSection = transcriptAvailable ? 'FULL TRANSCRIPT:\n' + transcript.slice(0, 30000) : 'NOTE: Transcript unavailable. Use your knowledge of this creator, channel, and topic. Be transparent.';
    const socraticNote = sessionMode === 'socratic' ? '\n\nSOCRATIC MODE: Ask CB questions about this video\'s content one at a time. Wait for answers. Correct and build.' : '\n\nTeach: orient → thesis → 5-7 key moments → CB translation → cross-reference → action → deeper dive.';
    return {
      cached: spine,
      dynamic: graphSummary + `\n\nSESSION: YOUTUBE VIDEO INTELLIGENCE\nVideo: "${title}"\nChannel: ${channel}\nURL: ${url}\n\n` + tSection + socraticNote,
    };
  }

  // Global chat
  const modeInstructions = {
    synthesis: 'MODE: SYNTHESIS. Connect the user\'s question to their knowledge graph, mental models, goals, and active projects. Find non-obvious intersections. End with a decisive insight or action.',
    socratic: 'MODE: SOCRATIC. Ask CB one powerful question at a time. No lectures. Wait for answers. Correct and build.',
    reference: 'MODE: DEEP REFERENCE. Master-expert depth. Always: definition → why it matters → CB application → cross-book link → action.',
    advisor: 'MODE: PROJECT ADVISOR. CB is asking about his active projects. Apply his knowledge and mental models directly to project decisions. Be decisive.',
    truth: 'MODE: TRUTH SEEKER. Strip away narrative, consensus, and noise. Give CB the signal. What\'s actually true? What do most people get wrong? End with the contrarian insight.',
  };
  return {
    cached: spine,
    dynamic: graphSummary + '\n\n' + (modeInstructions[context.chatMode] || modeInstructions.synthesis),
  };
}

export function buildReadingSystem({ contentType, goal, depth, progress, content, graph }) {
  const graphSummary = graph && Object.keys(graph.topics || {}).length > 0
    ? '\n\nCB\'S LEARNING HISTORY:\n' +
      Object.values(graph.topics).slice(-8).map(t => `- ${t.title}: confidence ${t.confidence}/10`).join('\n')
    : '';

  const typeInstructions = {
    nonfiction:  `CONTENT TYPE: Non-Fiction / Business\nApproach: Thesis-first. Extract frameworks, CB applications, cross-references to mental models.\nEvery response: Core concept → Why it matters → CB application → Action.`,
    fiction:     `CONTENT TYPE: Literary Fiction\nApproach: Literary analysis — character psychology, themes, symbolism, narrative craft, author technique.\nCRITICAL: Never reveal plot points beyond where the reader currently is.`,
    scifi:       `CONTENT TYPE: Sci-Fi / Fantasy\nApproach: World-building logic, scientific plausibility vs. speculation, allegorical meaning.\nCRITICAL: No spoilers beyond the reader's current position. Explore internal consistency, real-world parallels, social allegory.`,
    history:     `CONTENT TYPE: History / Biography\nApproach: Evidence-first. For every claim surface: (1) What supports it? (2) Who disagrees and why? (3) Present-day parallel.\nBiography: narrator reliability, era context, gap between self-presentation and reality.`,
    academic:    `CONTENT TYPE: Academic / Textbook\nApproach: Concept ladder — check prerequisites first, never assume prior knowledge.\nTeach: definition → intuition → formal statement → example → common misconception → exam angle.\nAfter teaching: ask the reader to explain the core idea back in their own words.`,
    reference:   `CONTENT TYPE: Reference / Technical Document\nApproach: Precision. No paraphrase that loses meaning. Flag scope of applicability.\nAlways: exact terminology → context of use → what this does NOT cover → when to escalate to a professional.`,
    training:    `CONTENT TYPE: Training / Professional Development\nApproach: Performance coach. Map every concept to the reader's actual role and goals.\nFor each concept: translate to CB's context → concrete scenario → competency benchmark.\nEnd every section: "How would you apply this in the next 7 days?"`,
    philosophy:  `CONTENT TYPE: Philosophy / Theory\nApproach: Dialectical. Present the argument → steelman it → challenge it.\nAlways: What is it claiming? What does it assume? What's the strongest counterargument? Share your genuine assessment.`,
  };

  const goalInstructions = {
    master:  `GOAL: DEEP MASTERY\nAfter explaining each concept, ask the reader to explain it back. Track gaps. Confirm what's solid, surface what's fuzzy.`,
    exam:    `GOAL: EXAM / CERT PREP\nFocus on high-yield concepts, likely question formats, common traps. After each concept generate a practice question. Track everything the reader struggles with.`,
    apply:   `GOAL: APPLY TO WORK\nFilter through CB's context: BD, real estate, business building. Extract the framework → translate to CB's situation → give a concrete next action.`,
    discuss: `GOAL: DISCUSS & EXPLORE\nOpen dialogue. Follow intellectual curiosity. Offer counterarguments, thought experiments. End every response with a question that advances the conversation.`,
    quick:   `GOAL: QUICK UNDERSTANDING\nEfficiency mode. Core idea only. Format: essential insight → one practical implication → done.`,
  };

  const progressInstructions = {
    start:     `READING POSITION: Just starting. Orient the reader to the full structure first, then work through the opening.`,
    mid:       `READING POSITION: Mid-way through. Reference what they've encountered — never assume what they haven't reached yet.`,
    done:      `READING POSITION: Finished. Full synthesis mode — themes, takeaways, connections, what to do with this material.`,
    reference: `READING POSITION: Reference lookup. Reader needs a specific answer — don't re-teach the whole work.`,
  };

  const dynamic = graphSummary +
    `\n\nCONTENT: "${content.title}"${content.author ? ` by ${content.author}` : ''}` +
    `\n\n${typeInstructions[contentType] || typeInstructions.nonfiction}` +
    `\n\n${goalInstructions[goal] || goalInstructions.master}` +
    `\n\n${depthProtocol(depth)}` +
    `\n\n${progressInstructions[progress] || progressInstructions.start}`;

  return { cached: CB_LEARNING_SPINE, dynamic };
}

// Canonical quiz-prompt builder — shared by QuizCenter and LearningCenter.
// `subject` is the topic/title string. `includeRate` adds a 1–5 self-rating
// question (QuizCenter's self-assessment flavor). Both surfaces render the
// result through the same shared/QuizMode component.
export function buildQuizPrompt({ subject, count = 5, includeRate = false }) {
  const rateLine = includeRate
    ? `\n  {"type":"rate","q":"Rate your current mastery of a specific skill in this topic — 1 (beginner) to 5 (expert)","scale":5},`
    : '';
  return `Generate a ${count}-question self-assessment quiz for CB about: "${subject}".

CB's context: BD professional, Houston TX. Interests: real estate, leadership, longevity, AI-augmented work, stoic philosophy. Tailor questions to his learning style and goals (passive income, BD, longevity).

Mix: multiple choice (4 options each, labelled A/B/C/D), one application question (a specific scenario in CB's world), and one open insight question.${includeRate ? ' Include one self-rating question.' : ''}

Return ONLY valid JSON — no markdown fences, no preamble:
{"questions":[
  {"type":"mc","q":"Question?","options":["A. ..","B. ..","C. ..","D. .."],"answer":"A","explanation":"Why correct + connection to CB's mental models"},${rateLine}
  {"type":"apply","q":"Application question — a specific scenario in CB's world","answer":"Model answer with framework"},
  {"type":"open","q":"Open insight question","answer":"Key insight CB should know","explanation":"Why it matters"}
]}`;
}

// ─── CERTIFIED DEPTH ENGINE ────────────────────────────────────────────────
// Depth controls real-world grounding, not verbosity. deep/expert turn on
// web_search (pass searchEnabled to callClaude when depthNeedsWeb is true).
export const DEPTH_META = {
  surface:  { label: 'Surface',  web: false, heavy: false, blurb: 'Model knowledge, no web' },
  standard: { label: 'Standard', web: false, heavy: false, blurb: 'Concept + example' },
  deep:     { label: 'Deep',     web: true,  heavy: true,  blurb: 'Live web, multiple sources, cited' },
  expert:   { label: 'Expert',   web: true,  heavy: true,  blurb: '8–15 sources, sources list + confidence' },
};
export function depthNeedsWeb(depth) { return !!DEPTH_META[depth]?.web; }
export function depthIsHeavy(depth) { return !!DEPTH_META[depth]?.heavy; }

export function depthProtocol(depth) {
  switch (depth) {
    case 'surface':
      return `DEPTH — SURFACE: Answer from your own knowledge. One core concept + one implication. No web search. Fast and cheap.`;
    case 'deep':
      return `DEPTH — DEEP (web search ON): Use web_search to pull MULTIPLE independent sources. Prefer primary sources. Surface conflicting viewpoints where they exist. Cite inline as [n] and keep a running numbered source list. Explicitly distinguish what is established from what is contested.`;
    case 'expert':
      return `DEPTH — EXPERT / CERTIFIED (web search ON): Conduct multi-source research (aim for 8–15 independent sources). Prefer primary sources; name authorities, industry frameworks, and current data. Cite inline as [n] as you go.\n\nCERTIFIED = AUDITABLE, never credentialed — issue NO certificates. You MUST: (1) cite as you go, (2) end with a "SOURCES" list (each: title — who — why credible), and (3) end with a "CONFIDENCE / CONSENSUS SPLIT" separating established facts from contested or open debates, and state your overall confidence.`;
    case 'standard':
    default:
      return `DEPTH — STANDARD: Concept + one concrete example. Model knowledge is fine; sanity-check at most one fact. Keep it tight.`;
  }
}

// Heuristic: does a raw request look like it wants a heavy, source-grounded
// dive? Used to FLAG (never silently run) before a heavy tier.
export function looksDeep(text = '') {
  const t = text.toLowerCase();
  const triggers = /\b(deep dive|deep-dive|go deep|research|analy[sz]e|market (size|structure|map)|industry|landscape|competitive|value chain|players|thoroughly|comprehensive|in[- ]depth|state of|full breakdown|everything about|regulat|outlook|forecast|economics|margins|disruption)\b/;
  return triggers.test(t) || t.trim().split(/\s+/).length > 18;
}

// System for a Deep Dive research file (Expert tier, industry scaffold).
export function buildDeepDiveSystem(topic, category, depth = 'expert', focusSection = null) {
  const scaffold = focusSection
    ? `Focus this pass on the section: "${focusSection}". Go deeper than before — new sources, sharper specifics.`
    : `Structure the dive using this industry/topic scaffold (adapt sensibly):
1. Market size & structure
2. Value chain
3. Key players
4. Economics / margins
5. Disruption vectors
6. Regulatory landscape
7. Outlook
Cross-reference CB's mental model library where it genuinely applies (Chip War chokepoints, Blue Ocean, Buffett economics/moats, Tipping Point).`;
  return {
    cached: CB_LEARNING_SPINE,
    dynamic: `\n\nDEEP DIVE RESEARCH FILE\nTopic: "${topic}"${category ? `\nCategory: ${category}` : ''}\n\n${depthProtocol(depth)}\n\n${scaffold}\n\nWrite as a structured brief with clear section headers, not a chat reply. Be decisive.`,
  };
}

// Pull a rough source list out of a cited brief's trailing "SOURCES" section.
export function extractSources(md = '') {
  const m = md.search(/(^|\n)\s*#{0,3}\s*(sources|references)\b/i);
  if (m === -1) return [];
  return md.slice(m).split('\n').slice(1)
    .map(l => l.replace(/^\s*[-*•\d.)\]\[]+\s*/, '').trim())
    .filter(l => l.length > 3 && !/^#{1,3}\s/.test(l) && !/^(confidence|consensus)/i.test(l))
    .slice(0, 20);
}

// ─── CREATION STUDIO ───────────────────────────────────────────────────────
// Turn a saved Deep Dive / ladder / session into a deliverable. Pure prompt
// builder; callers supply the serialized source text.
export const CREATION_KINDS = [
  { id: 'doc',   label: 'Document',      icon: '📄', desc: 'A polished written brief' },
  { id: 'deck',  label: 'Slide Outline', icon: '🖥', desc: 'A deck outline, slide by slide' },
  { id: 'guide', label: 'Study Guide',   icon: '📚', desc: 'Key points, Q&A, self-quiz' },
];

export function buildCreationPrompt(kind, title, sourceText) {
  const base = `Source material — "${title}":\n\n${(sourceText || '').slice(0, 12000)}\n\n---\n\n`;
  const kinds = {
    doc:   `Turn the source into a polished DOCUMENT / executive brief in Markdown. Clear headers, tight decisive prose, keep the strongest evidence and any sources. End with a one-paragraph bottom line.`,
    deck:  `Turn the source into a SLIDE OUTLINE for a deck, in Markdown. Format each slide as "## Slide N — Title" followed by 3–5 concise bullets. 8–12 slides. Open with a title slide + one-line thesis; close with a recommendations slide.`,
    guide: `Turn the source into a STUDY GUIDE in Markdown: (1) Key concepts (term → one-line definition), (2) the 5 most important takeaways, (3) 5 self-quiz questions each followed by its answer, (4) how CB should apply this. Optimize for retention.`,
  };
  return base + (kinds[kind] || kinds.doc);
}

// ─── INTENT ROUTER (Universal Capture Bar) ─────────────────────────────────
// Classifies a raw intent into a destination. Returns a safe fallback shape
// even if the model or network misbehaves.
export const CAPTURE_ROUTES = ['learn', 'ladder', 'deepdive', 'research', 'project', 'note'];

export async function routeIntent(text) {
  const prompt = `Classify CB's raw intent into exactly one destination and extract fields. Destinations:
- "learn": a quick one-off learning question or concept.
- "ladder": wants to master a subject over multiple steps (a structured journey).
- "deepdive": wants a researched, source-grounded brief on an industry/market/topic (a saveable research project).
- "research": open-ended truth-seeking / analysis on a claim or question.
- "project": something to build, ship, or track (a project with tasks).
- "note": something to capture/save for later, not act on now.

Return ONLY valid JSON, no markdown:
{"route":"one of the six","topic":"cleaned topic/title","suggestedCategory":"short category label or ''","suggestedDepth":"surface|standard|deep|expert","rationale":"one short sentence"}

Intent: "${text.replace(/"/g, "'").slice(0, 500)}"`;
  const fallback = { route: 'learn', topic: text.trim().slice(0, 120), suggestedCategory: '', suggestedDepth: looksDeep(text) ? 'deep' : 'standard', rationale: 'Defaulted (router unavailable).' };
  try {
    const raw = await callClaude({ system: CB_IDENTITY, messages: [{ role: 'user', content: prompt }], maxTokens: 300 });
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!CAPTURE_ROUTES.includes(parsed.route)) parsed.route = fallback.route;
    if (!DEPTH_META[parsed.suggestedDepth]) parsed.suggestedDepth = fallback.suggestedDepth;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

// Learning Ladder generation — returns structured JSON the app persists as a
// first-class ladder object (see lib/ladders.js). prereqIndexes reference
// earlier modules by 0-based position so the app can wire prereq unlocking.
export function buildLadderPrompt(topic, goal) {
  return `Design a structured learning ladder for CB to master: "${topic}".
Goal: ${goal || 'deep, applied mastery'}.

CB's context: BD professional, Houston TX. Systems thinker, learns big-picture first, sports analogies, applies everything to passive income / BD / longevity.

Produce 5–7 sequential modules from fundamentals to mastery. Each builds on prior ones. For each module give 2–4 concrete learning objectives and list the indexes of the modules that are prerequisites (earlier modules only).

Return ONLY valid JSON — no markdown fences, no preamble:
{"topic":"${topic}","goal":"${goal || 'mastery'}","modules":[
  {"title":"Module title","objectives":["objective 1","objective 2"],"prereqIndexes":[]},
  {"title":"Module title","objectives":["objective 1","objective 2","objective 3"],"prereqIndexes":[0]}
]}`;
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────
// Routes through our own /api/chat proxy — the API key lives only on the
// server. `system` may be a string, { cached, dynamic }, or falsy.
//
// Pass `onToken(chunk)` to stream: it fires for each text delta as it arrives
// and the full text is still returned when the stream completes. Without
// `onToken` we request a single non-streamed JSON response.
export class AuthError extends Error {
  constructor(msg = 'Auth expired — re-enter code') { super(msg); this.name = 'AuthError'; this.authExpired = true; }
}

function notifyAuthExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ih-auth-expired'));
}

export async function callClaude({ system, messages, maxTokens = 4096, searchEnabled = false, onToken }) {
  const body = { system, messages, max_tokens: maxTokens, stream: !!onToken };
  if (searchEnabled) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });

  if (res.status === 401) { notifyAuthExpired(); throw new AuthError(); }

  // Non-streaming path — plain JSON { text } or { error }
  if (!onToken) {
    const data = await res.json().catch(() => ({ error: 'AI request failed — retry' }));
    if (!res.ok || data.error) throw new Error(data.error || 'AI request failed — retry');
    return data.text || 'No response.';
  }

  // Streaming path — parse the SSE passthrough and surface text deltas.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'AI request failed — retry');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  const handleEvent = (raw) => {
    // Each SSE block may have multiple lines; we only care about `data:` JSON.
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const json = trimmed.slice(5).trim();
      if (!json || json === '[DONE]') continue;
      try {
        const evt = JSON.parse(json);
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          full += evt.delta.text;
          onToken(evt.delta.text);
        } else if (evt.type === 'error') {
          throw new Error(evt.error?.message || 'AI request failed — retry');
        }
      } catch (e) {
        if (e.message && e.message !== 'Unexpected end of JSON input') { /* swallow parse noise */ }
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE events are separated by a blank line
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleEvent(chunk);
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  return full || 'No response.';
}

export async function buildApiMessages(messages) {
  return Promise.all(messages.map(async (m) => {
    if (m.role === 'user' && m.attachments?.length > 0) {
      const parts = [];
      for (const att of m.attachments) {
        if (att.type === 'url') parts.push({ type: 'text', text: `[Web URL: ${att.url}] — fetch and analyze.` });
        else if (att.isImage) parts.push({ type: 'image', source: { type: 'base64', media_type: att.mimeType, data: att.data } });
        else if (att.mimeType === 'application/pdf') parts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.data } });
        else parts.push({ type: 'text', text: `[Document: ${att.name} (${att.label})] — analyze this document.` });
      }
      if (m.content) parts.push({ type: 'text', text: m.content });
      return { role: 'user', content: parts };
    }
    return { role: m.role, content: m.content };
  }));
}

// ─── PODCAST RSS ─────────────────────────────────────────────────────────
export function parsePodcastXML(txt) {
  try {
    const p = new DOMParser(), x = p.parseFromString(txt, 'text/xml');
    const items = Array.from(x.querySelectorAll('item')).slice(0, 20);
    return items.map(i => {
      const descRaw = i.querySelector('description')?.textContent
        || i.getElementsByTagNameNS('*', 'summary')?.[0]?.textContent || '';
      const desc = descRaw.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 400);
      const duration = i.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'duration')?.[0]?.textContent
        || i.querySelector('duration')?.textContent || '';
      return {
        title: (i.querySelector('title')?.textContent || '').trim(),
        link: i.querySelector('link')?.textContent || i.querySelector('enclosure')?.getAttribute('url') || '',
        desc, pubDate: i.querySelector('pubDate')?.textContent || '', duration,
      };
    });
  } catch { return []; }
}

// Feeds are fetched through our own /api/rss serverless proxy (User-Agent,
// timeout, s-maxage caching, auth) — no public CORS proxies. A fast attempt
// then a patient retry, each with its own timeout.
export async function fetchPodcastRSS(url) {
  const attempt = (ms) => async () => {
    const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`, { credentials: 'same-origin', signal: AbortSignal.timeout(ms) });
    if (r.status === 401) { notifyAuthExpired(); return null; }
    if (!r.ok) return null;
    const items = parsePodcastXML(await r.text());
    return items.length ? items : null;
  };
  return (await firstOk([attempt(9000), attempt(15000)])) || [];
}

export function fmtDuration(s) {
  if (!s) return '';
  const parts = String(s).split(':').map(Number);
  if (parts.length === 3) return parts[0] > 0 ? `${parts[0]}h ${parts[1]}m` : `${parts[1]}m`;
  if (parts.length === 2) return `${parts[0]}m`;
  const secs = Number(s);
  if (!isNaN(secs) && secs > 0) {
    const mins = Math.floor(secs / 60);
    return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }
  return s;
}

export function fmtPodDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── MISC ─────────────────────────────────────────────────────────────────
export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
