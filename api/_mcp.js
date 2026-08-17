// api/_mcp.js — the Claude bridge internals.
// Claude.ai has no write API, so an MCP server is the mechanism: Claude (or any
// MCP client) connects to /api/mcp and calls these tools to read and write the
// hub's knowledge. Underscore-prefixed → not itself an HTTP route.
//
// Auth is a dedicated MCP_TOKEN bearer, NOT the ACCESS_CODE cookie — this is a
// machine bridge. It fails CLOSED: with no MCP_TOKEN set the bridge is off, and
// it never reads or returns ACCESS_CODE, provider keys, or Upstash credentials.
import crypto from 'node:crypto';
import { store, storageConfigured } from './_lib.js';

export const KEYS = {
  GRAPH: 'aether_graph_v1',
  PROJECTS: 'aether_projects_v1',
  NOTES: 'aether_notes_v1',
  RESEARCH: 'aether_research_v1',
  INBOX: 'aether_inbox',
  DECISIONS: 'aether_decisions',
  QUIZ: 'aether_quiz_results',
  FLASHCARDS: 'aether_flashcards',
  SKILLS: 'aether_skills_v1',
  WEEKLY_RECAP: 'weekly_recap_latest',
  MONTHLY_REVIEW: 'monthly_review_latest',
};

// ── Token gate ──────────────────────────────────────────────────────────────
// Bearer in Authorization, or ?token= for clients that can't set headers.
// Returns true if allowed; otherwise writes the response and returns false.
export function requireMcpToken(req, res) {
  const expected = process.env.MCP_TOKEN;
  if (!expected) {
    res.status(503).json({ error: 'MCP bridge disabled: MCP_TOKEN is not configured.', code: 'mcp_disabled' });
    return false;
  }
  const auth = req.headers?.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  let qtoken = '';
  try { qtoken = new URL(req.url, 'http://x').searchParams.get('token') || ''; } catch {}
  const provided = bearer || qtoken;
  const ok = provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) {
    res.status(401).json({ error: 'Invalid or missing MCP token.', code: 'mcp_unauthorized' });
    return false;
  }
  return true;
}

// ── Storage helpers (values are JSON strings) ───────────────────────────────
async function readJson(key, fallback = null) {
  try { const raw = await store.get(key); return raw == null ? fallback : JSON.parse(raw); }
  catch { return fallback; }
}
async function writeJson(key, value) { await store.set(key, JSON.stringify(value)); }

const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const conceptKey = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, '_');
const norm = (s) => String(s || '').trim();

// ── Tool implementations ────────────────────────────────────────────────────
// Each returns a plain JSON-serializable object. They never surface secrets.

async function searchKnowledge({ query = '', limit = 10 }) {
  const graph = (await readJson(KEYS.GRAPH, {})) || {};
  const concepts = Object.values(graph.concepts || {});
  const q = norm(query).toLowerCase();
  const hits = (q ? concepts.filter((c) => (c.topic || '').toLowerCase().includes(q)) : concepts)
    .sort((a, b) => (b.observations || 0) - (a.observations || 0))
    .slice(0, Math.max(1, Math.min(limit, 50)))
    .map((c) => ({ topic: c.topic, confidence: c.confidence, modules: c.modules || [], observations: c.observations || 0, related: Object.keys(c.related || {}).length }));
  return { query, count: hits.length, concepts: hits };
}

async function getConcept({ topic }) {
  const graph = (await readJson(KEYS.GRAPH, {})) || {};
  const c = (graph.concepts || {})[conceptKey(topic)];
  if (!c) return { found: false, topic };
  const related = Object.entries(c.related || {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, w]) => ({ topic: graph.concepts[k]?.topic || k, weight: w }))
    .slice(0, 8);
  return { found: true, topic: c.topic, confidence: c.confidence, modules: c.modules || [], refs: c.refs || [], observations: c.observations || 0, lastSeen: c.lastSeen, sources: (c.sources || []).slice(0, 10), related };
}

async function logConceptTool({ topic, source = null, module = 'mcp', confidence = null, refs = [] }) {
  const label = norm(topic);
  if (!label) return { ok: false, error: 'topic is required' };
  const graph = (await readJson(KEYS.GRAPH, {})) || {};
  graph.concepts = graph.concepts || {};
  const key = conceptKey(label);
  const now = Date.now();
  const refList = (Array.isArray(refs) ? refs : [refs]).map(String).filter(Boolean);
  const c = graph.concepts[key] || { id: key, topic: label, confidence: null, modules: [], refs: [], sources: [], related: {}, observations: 0, firstSeen: now, lastSeen: now };
  c.topic = label; c.observations += 1; c.lastSeen = now;
  if (typeof confidence === 'number') c.confidence = c.confidence == null ? confidence : Math.round((c.confidence * (c.observations - 1) + confidence) / c.observations);
  if (module && !c.modules.includes(module)) c.modules.push(module);
  for (const r of refList) if (!c.refs.includes(r)) c.refs.push(r);
  c.sources.unshift({ module, source: source || null, refs: refList, confidence, at: now });
  c.sources = c.sources.slice(0, 25);
  graph.concepts[key] = c;
  await writeJson(KEYS.GRAPH, graph);
  return { ok: true, topic: label, observations: c.observations };
}

async function addNote({ title, content, tags = [] }) {
  const t = norm(title), body = norm(content);
  if (!t && !body) return { ok: false, error: 'title or content is required' };
  const notes = (await readJson(KEYS.NOTES, [])) || [];
  const note = { id: uid('note'), title: t || body.slice(0, 55), content: body, tags: Array.isArray(tags) ? tags : [], connections: [], color: 'var(--accent)', createdAt: Date.now(), source: 'mcp' };
  await writeJson(KEYS.NOTES, [note, ...notes]);
  return { ok: true, id: note.id };
}

async function createFlashcard({ front, back, source = 'mcp', topic = null }) {
  const f = norm(front), b = norm(back);
  if (!f || !b) return { ok: false, error: 'front and back are required' };
  const cards = (await readJson(KEYS.FLASHCARDS, [])) || [];
  if (cards.some((c) => norm(c.front).toLowerCase() === f.toLowerCase())) return { ok: true, created: false, reason: 'duplicate' };
  const card = { id: uid('card'), front: f, back: b, source, module: 'mcp', topic, interval: 1, easeFactor: 2.5, dueDate: Date.now(), reviews: 0, createdAt: Date.now() };
  await writeJson(KEYS.FLASHCARDS, [card, ...cards]);
  return { ok: true, created: true, id: card.id };
}

async function addToInbox({ title, url = '', text = '' }) {
  const t = norm(title) || norm(url) || norm(text).slice(0, 55);
  if (!t) return { ok: false, error: 'title, url, or text is required' };
  const items = (await readJson(KEYS.INBOX, [])) || [];
  const item = { id: uid('item'), title: t, url: norm(url), snippet: norm(text).slice(0, 200), type: url ? 'article' : 'note', summary: '', savedAt: Date.now(), inVault: false, derivedInto: [], source: 'mcp' };
  await writeJson(KEYS.INBOX, [item, ...items]);
  return { ok: true, id: item.id };
}

async function getProjects() {
  const projects = (await readJson(KEYS.PROJECTS, [])) || [];
  return { count: projects.length, projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status, category: p.category, milestones: (p.milestones || []).map((m) => ({ label: m.label, done: !!m.done })) })) };
}

async function getRecap({ period = 'weekly' }) {
  const key = period === 'monthly' ? KEYS.MONTHLY_REVIEW : KEYS.WEEKLY_RECAP;
  const rec = await readJson(key, null);
  if (!rec) return { period, available: false };
  return { period, available: true, generatedAt: rec.generatedAt || rec.at || null, content: rec.content || rec.text || rec };
}

// ── Tool registry (name → schema + handler) ─────────────────────────────────
export const TOOLS = [
  { name: 'search_knowledge', description: 'Search the knowledge graph for concepts matching a query. Returns topics with confidence, the modules that touched them, and connection counts.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Substring to match against concept topics. Empty returns the most-observed concepts.' }, limit: { type: 'number' } } }, handler: searchKnowledge },
  { name: 'get_concept', description: "Get everything known about one concept: confidence, which modules touched it, its sources, and related concepts.",
    inputSchema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] }, handler: getConcept },
  { name: 'log_concept', description: 'Record an observation of a concept into the knowledge graph.',
    inputSchema: { type: 'object', properties: { topic: { type: 'string' }, source: { type: 'string' }, module: { type: 'string' }, confidence: { type: 'number' }, refs: { type: 'array', items: { type: 'string' } } }, required: ['topic'] }, handler: logConceptTool },
  { name: 'add_note', description: "Add a note to CB's Mastery Vault.",
    inputSchema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['content'] }, handler: addNote },
  { name: 'create_flashcard', description: 'Create a spaced-repetition flashcard (dedupes by front). Enters SM-2 immediately.',
    inputSchema: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' }, source: { type: 'string' }, topic: { type: 'string' } }, required: ['front', 'back'] }, handler: createFlashcard },
  { name: 'add_to_inbox', description: "Save a link or text into CB's capture inbox.",
    inputSchema: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, text: { type: 'string' } } }, handler: addToInbox },
  { name: 'get_projects', description: "List CB's projects with status and milestone progress.",
    inputSchema: { type: 'object', properties: {} }, handler: getProjects },
  { name: 'get_recap', description: 'Get the latest weekly recap or monthly review.',
    inputSchema: { type: 'object', properties: { period: { type: 'string', enum: ['weekly', 'monthly'] } } }, handler: getRecap },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export async function callTool(name, args) {
  const tool = TOOL_MAP[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (!storageConfigured()) throw new Error('Storage is not configured.');
  return tool.handler(args || {});
}

// Full read-only snapshot for api/export — never includes secrets.
export async function exportState() {
  const [graph, projects, skills, weekly, monthly] = await Promise.all([
    readJson(KEYS.GRAPH, {}), readJson(KEYS.PROJECTS, []), readJson(KEYS.SKILLS, []),
    readJson(KEYS.WEEKLY_RECAP, null), readJson(KEYS.MONTHLY_REVIEW, null),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    graph: { concepts: (graph && graph.concepts) || {}, topics: (graph && graph.topics) || {} },
    projects: projects || [],
    skills: skills || [],
    recaps: { weekly: weekly || null, monthly: monthly || null },
  };
}
