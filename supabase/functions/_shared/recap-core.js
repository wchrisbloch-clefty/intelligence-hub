// supabase/functions/_shared/recap-core.js — the weekly recap + monthly review
// prompt builders. Ported verbatim from api/weekly-recap.js + api/monthly-review.js
// (Batch Z / Order E moved the schedule to Supabase; the Vercel routes are gone).
// Pure functions — no runtime APIs — so they're unit-testable under Node too.
import { DOMAIN_PACK_DATA, LENS, SUBJECT_FIDELITY } from './prompts.generated.js';

export const KEYS = {
  GRAPH: 'aether_graph_v1',
  PROJECTS: 'aether_projects_v1',
  NOTES: 'aether_notes_v1',
  RESEARCH: 'aether_research_v1',
  INBOX: 'aether_inbox',
  DECISIONS: 'aether_decisions',
  QUIZ: 'aether_quiz_results',
  WEEKLY_RECAP: 'weekly_recap_latest',
  MONTHLY_REVIEW: 'monthly_review_latest',
};

// Layers 1 + 2 (Order D). The recap is ABOUT the reader's own week, so the user
// prompt carries his data; his goals are not baked into the system prompt.
export const SYSTEM_BASE = `You are an intelligence system: research analyst, truth-seeker, and teacher.\n\n${LENS}\n\n${SUBJECT_FIDELITY}`;
// The five domain packs are peers — finance is not privileged.
const AREAS = Object.values(DOMAIN_PACK_DATA).map((p) => p.label).join(', ');

// ── Weekly ──────────────────────────────────────────────────────────────────
function wkProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return 'No active projects on record.';
  return projects
    .filter((p) => p && p.status !== 'archived')
    .map((p) => {
      const ms = Array.isArray(p.milestones) ? p.milestones : [];
      const done = ms.filter((m) => m?.done).length;
      const next = ms.find((m) => !m?.done);
      return [
        `• ${p.title} [${p.status || 'active'}${p.priority ? `, ${p.priority} priority` : ''}]`,
        p.description ? `  ${p.description}` : '',
        `  Progress: ${done}/${ms.length} milestones${next ? ` — next: ${next.text}` : ''}`,
        p.blueOcean ? `  Blue Ocean: ${p.blueOcean}` : '',
      ].filter(Boolean).join('\n');
    })
    .join('\n');
}

function wkResearch(research) {
  if (!Array.isArray(research) || research.length === 0) return 'No research threads on record.';
  return research
    .slice(0, 10)
    .map((r) => `• ${r.title}${r.status ? ` [${r.status}]` : ''}${r.query ? ` — ${r.query}` : ''}`)
    .join('\n');
}

// Inbox = the app's "news" surface (saved articles/videos/social/notes).
function wkInbox(inbox) {
  if (!Array.isArray(inbox) || inbox.length === 0) return 'No saved news/content this period.';
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = inbox.filter((i) => (i?.createdAt ?? 0) >= weekAgo);
  const list = recent.length ? recent : inbox.slice(0, 8);
  return list.map((i) => `• [${i.type || 'item'}] ${i.title || i.url || 'untitled'}`).join('\n');
}

function wkNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return 'No notes on record.';
  return notes.slice(0, 8).map((n) => `• ${n.title}`).join('\n');
}

export function buildWeeklyPrompt(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  return `It's Friday (${today}). Generate CB's WEEKLY RECAP.

Here is CB's current state pulled from his Intelligence Hub:

═══ ACTIVE PROJECTS ═══
${ctx.projects}

═══ RESEARCH THREADS ═══
${ctx.research}

═══ SAVED NEWS / CONTENT (NewsHub inbox) ═══
${ctx.inbox}

═══ NOTES ═══
${ctx.notes}

Produce the Friday recap in exactly these four sections. Be specific to CB's
actual projects and data above — no generic filler. End with a single decisive bet.

## 📰 NewsHub Improvements
The 2-3 highest-signal developments or angles CB should track next week, tied to
his active areas (${AREAS}). Why each matters now.

## 🧠 Spine Updates
New mental-model connections or belief updates surfaced by this week's activity.
Link explicitly to CB's model library where relevant.

## 🚀 Active Project Suggestions
For each active project, the single highest-leverage next move this coming week.
Reference the actual next milestone.

## 🛠 Skills Upgrades
2-3 concrete skills or systems to sharpen next week, with a specific practice or
resource for each.

**The Bet:** One decisive recommendation for the week ahead.`;
}


export function weeklyContext(state) {
  return {
    projects: wkProjects(state[KEYS.PROJECTS]),
    research: wkResearch(state[KEYS.RESEARCH]),
    inbox: wkInbox(state[KEYS.INBOX]),
    notes: wkNotes(state[KEYS.NOTES]),
  };
}

// ── Monthly ─────────────────────────────────────────────────────────────────
function moGraph(graph) {
  const g = graph;
  if (!g || typeof g !== 'object') return 'No learning graph on record.';
  const topics = g.topics && typeof g.topics === 'object' ? Object.values(g.topics) : [];
  const header = `Streak: ${g.streak ?? 0} · Total time: ${g.totalTime ?? 0}min · Topics: ${topics.length}`;
  const top = topics
    .slice(-12)
    .map((t) => `• ${t.title} (${t.type}): ${t.sessions} sessions, confidence ${t.confidence}/10`)
    .join('\n');
  return `${header}\n${top || 'No topics yet.'}`;
}

function moProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return 'No projects on record.';
  return projects
    .map((p) => {
      const ms = Array.isArray(p.milestones) ? p.milestones : [];
      const done = ms.filter((m) => m?.done).length;
      return `• ${p.title} [${p.status || 'active'}] — ${done}/${ms.length} milestones${p.category ? ` · ${p.category}` : ''}${p.blueOcean ? `\n  Blue Ocean: ${p.blueOcean}` : ''}`;
    })
    .join('\n');
}

function moResearch(research) {
  if (!Array.isArray(research) || research.length === 0) return 'No research threads.';
  return research.slice(0, 15).map((r) => `• ${r.title}${r.status ? ` [${r.status}]` : ''}`).join('\n');
}

function moDecisions(decisions) {
  if (!Array.isArray(decisions) || decisions.length === 0) return 'No logged decisions.';
  return decisions.slice(0, 12).map((d) => {
    const chosen = Array.isArray(d.options) ? d.options[d.chosen] : undefined;
    return `• ${d.title} [${d.status}]${chosen ? ` → chose: ${chosen}` : ''}`;
  }).join('\n');
}

function moQuiz(quiz) {
  if (!Array.isArray(quiz) || quiz.length === 0) return 'No self-assessments taken.';
  return quiz.slice(0, 10).map((q) => `• ${q.topic}: ${q.score}/${q.total} MC`).join('\n');
}

function moNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return 'No notes.';
  return notes.slice(0, 12).map((n) => `• ${n.title}`).join('\n');
}

export function buildMonthlyPrompt(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  return `It's the 1st of the month (${today}). Generate CB's MONTHLY REVIEW —
a deep, decisive profile update. Ground everything in CB's actual data below.

═══ LEARNING GRAPH ═══
${ctx.graph}

═══ PROJECTS ═══
${ctx.projects}

═══ RESEARCH THREADS ═══
${ctx.research}

═══ DECISION LOG ═══
${ctx.decisions}

═══ SELF-ASSESSMENTS (Quiz) ═══
${ctx.quiz}

═══ NOTES ═══
${ctx.notes}

Produce the monthly review in exactly these six sections. Be specific and
decisive — reference CB's real projects, decisions, and knowledge gaps.

## 👤 Full Profile Update
Where CB stands this month vs. his goals (W2 protection → passive income →
business building; health/longevity). What's compounding, what's stalled.

## 🔀 Cross-Project Opportunity Scan
Non-obvious intersections between his projects, research, and knowledge graph.
Where do two threads combine into something bigger than either alone?

## 💡 Business Ideas
2-3 concrete, Blue-Ocean business ideas fitting CB's edge (BD, real estate,
AI-augmented systems). For each: the wedge, why now, first validation step.

## 🤖 Agent Upgrades
How CB's Intelligence Hub / agent workflows should evolve next month to serve
these goals better — specific capabilities or automations.

## 🏋 Health Optimizations
Concrete longevity/performance moves for the month (Attia/Huberman frameworks) —
training, sleep, metabolic, or recovery levers, tied to measurable targets.

## 📚 Book Recommendations
2-3 books that close a gap visible in his data, each connected to his existing
mental-model library and the specific decision or project it would sharpen.

**The Bet:** The single highest-leverage focus for the month ahead.`;
}


export function monthlyContext(state) {
  return {
    graph: moGraph(state[KEYS.GRAPH]),
    projects: moProjects(state[KEYS.PROJECTS]),
    research: moResearch(state[KEYS.RESEARCH]),
    decisions: moDecisions(state[KEYS.DECISIONS]),
    quiz: moQuiz(state[KEYS.QUIZ]),
    notes: moNotes(state[KEYS.NOTES]),
  };
}
