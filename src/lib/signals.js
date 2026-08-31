// src/lib/signals.js — personal Blue Ocean signals, generated from the user's own
// context instead of a hardcoded category list. The surface whose job is "what
// should I look at" finally reads the graph, skills, projects, dismissals, and the
// user's own domain theses.
//
// Domains are user-owned (aether_signal_domains_v1). Signals are cached + versioned
// (aether_signals_v1) so they feel like a weekly briefing, not a slot machine.
// Feedback (pursue / not-now / not-relevant) persists to aether_signal_feedback_v1
// and feeds back into the next generation.
import { readLocal } from './storage.js';
import { allConcepts } from './graph.js';
import { buildSkills } from './skills.js';
import { PROJECTS_KEY } from '../constants.js';
import { TIER_INSTRUCTION, TIER_RANK } from './rigor.js';

export const DOMAINS_KEY  = 'aether_signal_domains_v1';
export const SIGNALS_KEY  = 'aether_signals_v1';
export const FEEDBACK_KEY = 'aether_signal_feedback_v1';
const FEED_DISMISS_META   = 'aether_feed_dismissed_meta'; // {id,title,category} written by WhatsHappening
const FEED_DISMISS_KEY    = 'aether_feed_dismissed';       // ids (fallback count)

const DAY = 86_400_000;
const uid = () => 'dom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clean = (s) => String(s || '').trim();

// ── Domains (user-owned; seeded from the original six categories) ─────────────
export const SEED_DOMAINS = [
  ['Real Estate', 3], ['Finance', 3], ['Career Edge', 3],
  ['Longevity', 3], ['Macro', 2], ['Energy', 2],
].map(([title, weight], i) => ({ id: uid(), title, thesis: '', weight, archived: false, order: i }));

export function loadDomains() {
  const d = readLocal(DOMAINS_KEY, null);
  return Array.isArray(d) && d.length ? d : SEED_DOMAINS;
}
export const activeDomains = (list) => (list || []).filter((d) => !d.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// Pure transforms — the caller persists (awaited/revert), same contract as skills.
export function domainAdd(list, title) {
  const t = clean(title);
  if (!t || list.some((d) => d.title.toLowerCase() === t.toLowerCase())) return list;
  return [...list, { id: uid(), title: t, thesis: '', weight: 2, archived: false, order: list.length }];
}
export function domainRename(list, id, title) {
  const t = clean(title); if (!t) return list;
  return list.map((d) => (d.id === id ? { ...d, title: t } : d));
}
export function domainSetThesis(list, id, thesis) {
  return list.map((d) => (d.id === id ? { ...d, thesis: clean(thesis) } : d));
}
export function domainSetWeight(list, id, weight) {
  const w = Math.max(1, Math.min(5, Number(weight) || 1));
  return list.map((d) => (d.id === id ? { ...d, weight: w } : d));
}
export function domainArchive(list, id, archived) {
  return list.map((d) => (d.id === id ? { ...d, archived: !!archived } : d));
}

// ── Signal types + next-action routes ─────────────────────────────────────────
export const SIGNAL_TYPES = {
  adjacent:    { label: 'Adjacent',    icon: 'ArrowRight',   token: 'var(--tier-reported)', blurb: 'Near something you already know deeply' },
  gap:         { label: 'Gap',         icon: 'Search',       token: 'var(--caution)',       blurb: 'A domain you weight highly with thin coverage' },
  convergence: { label: 'Convergence', icon: 'Share2',       token: 'var(--accent)',        blurb: 'Two of your domains intersecting — the Blue Ocean move' },
  decay:       { label: 'Decay',       icon: 'TrendingDown', token: 'var(--negative)',      blurb: 'Something that matters is slipping' },
  contrarian:  { label: 'Contrarian',  icon: 'Flame',        token: 'var(--tier-inferred)', blurb: 'Your thesis conflicts with the incoming evidence' },
};
export const signalTypeMeta = (t) => SIGNAL_TYPES[t] || SIGNAL_TYPES.adjacent;

// Each action routes into the platform. `route` maps to App.applyRoute; `book`
// has no capture route (opens the Books container's add flow).
export const ACTION_KINDS = {
  deepdive: { label: 'Start a deep dive', route: 'deepdive', icon: 'Microscope' },
  book:     { label: 'Add a book',        route: null,       icon: 'BookOpen', module: 'books' },
  project:  { label: 'Create a project',  route: 'project',  icon: 'Layers' },
  ladder:   { label: 'Add to a ladder',   route: 'ladder',   icon: 'GraduationCap' },
};
export const actionMeta = (k) => ACTION_KINDS[k] || ACTION_KINDS.deepdive;

// ── Context: where attention actually went, not where it was declared ─────────
export function loadFeedback() { const f = readLocal(FEEDBACK_KEY, {}); return f && typeof f === 'object' ? f : {}; }

// Returns { text, conceptCount, thin } — `thin` gates the honest empty state.
export function buildSignalContext(domains = loadDomains()) {
  const parts = [];
  const concepts = allConcepts() || [];
  const conceptCount = concepts.length;
  const now = Date.now();

  // Domains + the user's own theses (far better prompt context than a bare label).
  const doms = activeDomains(domains);
  if (doms.length) {
    parts.push('DOMAINS the user tracks (weight 1–5; thesis is their own view — treat it as their stance to test, not fact):\n' +
      doms.map((d) => `- ${d.title} (weight ${d.weight})${d.thesis ? ` — thesis: "${d.thesis}"` : ''}`).join('\n'));
  }

  // Graph — top concepts by observation, and recent vs. stale movement.
  const byObs = [...concepts].filter((c) => (c.observations || 0) > 0).sort((a, b) => (b.observations || 0) - (a.observations || 0));
  const top = byObs.slice(0, 8).map((c) => `- ${c.topic}: ${c.observations} obs${c.lastSeen ? `, last ${Math.round((now - c.lastSeen) / DAY)}d ago` : ''}`);
  if (top.length) parts.push(`ATTENTION (graph, most-observed first — this is where attention actually went):\n${top.join('\n')}`);
  const recent = byObs.filter((c) => c.lastSeen && now - c.lastSeen < 14 * DAY).slice(0, 6).map((c) => c.topic);
  if (recent.length) parts.push(`MOVING recently (touched in the last 14 days): ${recent.join(', ')}`);

  // Skills — levels, trends, and especially decaying ones (a decaying skill in an
  // active domain is a signal in itself).
  try {
    const skills = buildSkills().filter((s) => s.confidence != null);
    const decaying = skills.filter((s) => s.decaying).slice(0, 6)
      .map((s) => `- ${s.name} (${s.lastSeen ? Math.round((now - s.lastSeen) / DAY) : '?'}d since last observation)`);
    if (decaying.length) parts.push(`DECAYING skills (slipping from neglect):\n${decaying.join('\n')}`);
    const rising = skills.filter((s) => s.trend === 'up').slice(0, 5).map((s) => s.name);
    if (rising.length) parts.push(`RISING skills: ${rising.join(', ')}`);
  } catch {}

  // Projects — a signal that advances a live project outranks a novel one.
  try {
    const projects = (readLocal(PROJECTS_KEY, []) || []).filter((p) => p && ['active', 'planning'].includes(p.status)).slice(0, 6)
      .map((p) => `- ${p.title}${p.category ? ` (${p.category})` : ''} [${p.status}]`);
    if (projects.length) parts.push(`ACTIVE projects (a signal that advances one of these ranks higher):\n${projects.join('\n')}`);
  } catch {}

  // Dismissals — negative signal, the most honest input, previously discarded.
  try {
    const meta = readLocal(FEED_DISMISS_META, []) || [];
    const dismissedTitles = meta.slice(-8).map((m) => `- ${m.title}${m.category ? ` (${m.category})` : ''}`);
    if (dismissedTitles.length) parts.push(`DISMISSED from the feed (do NOT resurface these or close variants):\n${dismissedTitles.join('\n')}`);
    else { const ids = readLocal(FEED_DISMISS_KEY, []) || []; if (ids.length) parts.push(`The user has dismissed ${ids.length} feed item(s) — avoid generic headlines.`); }
    const fb = loadFeedback();
    const rejected = Object.entries(fb).filter(([, v]) => v === 'not-relevant').map(([k]) => k).slice(0, 8);
    if (rejected.length) parts.push(`Previously marked NOT RELEVANT (avoid these and their kind):\n${rejected.map((r) => `- ${r}`).join('\n')}`);
    const pursued = Object.entries(fb).filter(([, v]) => v === 'pursue').map(([k]) => k).slice(0, 8);
    if (pursued.length) parts.push(`Previously marked PURSUE (more like these):\n${pursued.map((r) => `- ${r}`).join('\n')}`);
  } catch {}

  return { text: parts.join('\n\n'), conceptCount, thin: conceptCount < 6 };
}

// ── Prompt ────────────────────────────────────────────────────────────────────
export function buildSignalPrompt(context, domains = loadDomains()) {
  const doms = activeDomains(domains).map((d) => d.title).join(', ');
  return `You are CB's personal opportunity scout — "Blue Ocean" signals: uncontested space to move into, drawn from HIS OWN context below, not generic trends.

${context || 'No tracked context yet.'}

Produce 4–6 signals. Each MUST be one of these types and the mix MUST include at least one convergence or contrarian when the context supports it:
- adjacent — near something he already knows deeply
- gap — a domain he weights highly with thin coverage
- convergence — TWO of his tracked domains intersecting (the real Blue Ocean move; only a personal system can find this)
- contrarian — where his stated domain thesis conflicts with what the evidence/market is reporting
- decay — something slipping that matters (tie to the decaying skills/stale concepts above)

RULES:
- Every signal states WHY it surfaced, in one line, traceable to a SPECIFIC item above (cite the actual number/skill/project/thesis — "you logged 14 observations on X and have no book covering Y"). A signal without a specific, grounded reason is a horoscope — do not emit it.
- Each signal carries ONE next action from: deepdive | book | project | ladder, with a target string (the topic/title to act on).
- Tag each signal's claim with a tier per the discipline below. Market/current-condition claims must be grounded in what you actually found — never label an inferred market claim verified.
- Do NOT resurface anything in DISMISSED or NOT RELEVANT above.

${TIER_INSTRUCTION}

Return ONLY a JSON array, no prose:
[{"type":"convergence","title":"short signal title","reason":"one line citing a specific item above","action":{"kind":"deepdive","target":"topic to act on"},"tier":"reported","market":true}]`;
}

// Parse the model's JSON into clean signal objects. Tolerant of fences/stray prose.
// verified is clamped to reported — this surface never retrieves primary text.
export function parseSignals(raw) {
  let text = String(raw || '').replace(/```json|```/gi, '').trim();
  const s = text.indexOf('['), e = text.lastIndexOf(']');
  if (s !== -1 && e > s) text = text.slice(s, e + 1);
  let arr;
  try { arr = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map((x, i) => {
    const type = SIGNAL_TYPES[x?.type] ? x.type : 'adjacent';
    const kind = ACTION_KINDS[x?.action?.kind] ? x.action.kind : 'deepdive';
    let tier = ['verified', 'reported', 'inferred'].includes(x?.tier) ? x.tier : 'inferred';
    if ((TIER_RANK[tier] ?? 0) > TIER_RANK.reported) tier = 'reported'; // never verified here
    const title = clean(x?.title), reason = clean(x?.reason);
    if (!title || !reason) return null; // reasonless signal is a horoscope — drop it
    return {
      id: `sig_${i}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      type, title, reason, tier,
      market: !!x?.market,
      action: { kind, target: clean(x?.action?.target) || title },
    };
  }).filter(Boolean).slice(0, 6);
}
