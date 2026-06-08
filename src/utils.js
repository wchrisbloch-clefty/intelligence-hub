import { CB_IDENTITY, CB_LEARNING_SPINE } from './constants.js';
import { GRAPH_KEY, PROJECTS_KEY, NOTES_KEY, RESEARCH_KEY } from './constants.js';
import { SEED_GRAPH, SEED_PROJECTS, SEED_NOTES, SEED_RESEARCH } from './seedData.js';

// ─── STORAGE ──────────────────────────────────────────────────────────────
async function storageGet(key) {
  try {
    if (window.storage) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

async function storageSet(key, val) {
  try {
    if (window.storage) await window.storage.set(key, JSON.stringify(val));
    else localStorage.setItem(key, JSON.stringify(val));
  } catch {}
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

export async function fetchYouTubeTranscript(videoId) {
  const urls = [
    `https://yt-transcript-api.vercel.app/api/transcript?videoId=${videoId}`,
    `https://api.kome.ai/api/tools/youtube-transcripts?video_id=${videoId}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const d = await r.json();
      if (Array.isArray(d) && d.length > 0) return d.map(s => s.text || '').join(' ').replace(/\[.*?\]/g, '').trim();
      if (d.transcript) return d.transcript;
    } catch {}
  }
  return null;
}

export async function fetchYouTubeMeta(videoId) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`);
    if (r.ok) return await r.json();
  } catch {}
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
    const tSection = transcriptAvailable ? 'FULL TRANSCRIPT:\n' + transcript.slice(0, 8000) : 'NOTE: Transcript unavailable. Use your knowledge of this creator, channel, and topic. Be transparent.';
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

  const depthInstructions = {
    surface:  `DEPTH: SURFACE — Concise. Key idea + one implication max.`,
    standard: `DEPTH: STANDARD — Full explanation with at least one concrete example.`,
    deep:     `DEPTH: DEEP DIVE — Full reasoning, multiple perspectives, edge cases. Don't oversimplify.`,
    expert:   `DEPTH: EXPERT — Peer discourse. Challenge assumptions. No hand-holding.`,
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
    `\n\n${depthInstructions[depth] || depthInstructions.standard}` +
    `\n\n${progressInstructions[progress] || progressInstructions.start}`;

  return { cached: CB_LEARNING_SPINE, dynamic };
}

export function buildQuizPrompt(context, entryMode, count = 5) {
  const subject = entryMode === 'reading' ? context.title : entryMode === 'book' ? context.book?.title : entryMode === 'topic' ? context.topic : entryMode === 'youtube' ? context.title : 'the uploaded document';
  return `Generate exactly ${count} quiz questions about "${subject}" tailored to CB's learning style and goals.

Mix: 2 multiple choice (4 options each, label A/B/C/D), 2 open-ended, 1 application question (how would CB apply this to his specific goals: passive income, BD, longevity).

Format EXACTLY as JSON — no preamble, no markdown fences, just raw JSON:
{"questions":[{"type":"mc","q":"Question text","options":["A. option","B. option","C. option","D. option"],"answer":"A","explanation":"Why correct and connection to CB's mental models"},{"type":"open","q":"Question text","answer":"Model answer","explanation":"Key insight"},{"type":"apply","q":"Application question for CB specifically","answer":"Model answer connecting to CB's goals"}]}`;
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────
export async function callClaude({ system, messages, maxTokens = 1500, searchEnabled = false }) {
  // Build system blocks with prompt caching.
  // system can be a string (cached as-is), an object { cached, dynamic },
  // or empty/falsy (no system prompt, e.g. quiz generation).
  let systemBlocks;
  if (!system || (typeof system === 'string' && !system.trim())) {
    systemBlocks = undefined;
  } else if (typeof system === 'string') {
    systemBlocks = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
  } else {
    systemBlocks = [
      { type: 'text', text: system.cached, cache_control: { type: 'ephemeral' } },
      ...(system.dynamic ? [{ type: 'text', text: system.dynamic }] : []),
    ];
  }

  const body = { model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages };
  if (systemBlocks) body.system = systemBlocks;
  if (searchEnabled) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || 'No response.';
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

export async function fetchPodcastRSS(url) {
  const proxies = [
    `/api/rss?url=${encodeURIComponent(url)}`,
    `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=20`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];
  for (const proxy of proxies) {
    try {
      const r = await fetch(proxy, { signal: AbortSignal.timeout(9000) });
      if (!r.ok) continue;
      if (proxy.includes('rss2json')) {
        const d = await r.json();
        if (d.items?.length) return d.items.map(i => ({
          title: (i.title || '').trim(),
          link: i.link || '',
          desc: (i.description || i.content || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim().slice(0, 400),
          pubDate: i.pubDate,
          duration: i.itunes_duration || '',
        }));
      } else if (proxy.includes('allorigins')) {
        const d = await r.json();
        if (d.contents) { const items = parsePodcastXML(d.contents); if (items.length) return items; }
      } else {
        const items = parsePodcastXML(await r.text());
        if (items.length) return items;
      }
    } catch {}
  }
  return [];
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
