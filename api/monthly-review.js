// api/monthly-review.js — Monthly Profile Review (Vercel Cron + serverless).
//
// Reads CB's full Intelligence Hub state from Upstash and asks Claude to generate
// the monthly review: full profile update, cross-project opportunity scan,
// business ideas, agent upgrades, health optimizations, and book recs. Writes the
// result back to Upstash under `monthly_review_latest`.
//
// Triggered by Vercel Cron (GET, `Authorization: Bearer <CRON_SECRET>`) —
// schedule "0 14 1 * *" is declared in vercel.json.
import { readState, writeState, callRecapAI, requireCron, KEYS, CB_IDENTITY } from './_recap.js';

// An Anthropic generation exceeds the default function timeout.
export const config = { maxDuration: 300 };

function summarizeGraph(graph) {
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

function summarizeProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return 'No projects on record.';
  return projects
    .map((p) => {
      const ms = Array.isArray(p.milestones) ? p.milestones : [];
      const done = ms.filter((m) => m?.done).length;
      return `• ${p.title} [${p.status || 'active'}] — ${done}/${ms.length} milestones${p.category ? ` · ${p.category}` : ''}${p.blueOcean ? `\n  Blue Ocean: ${p.blueOcean}` : ''}`;
    })
    .join('\n');
}

function summarizeResearch(research) {
  if (!Array.isArray(research) || research.length === 0) return 'No research threads.';
  return research.slice(0, 15).map((r) => `• ${r.title}${r.status ? ` [${r.status}]` : ''}`).join('\n');
}

function summarizeDecisions(decisions) {
  if (!Array.isArray(decisions) || decisions.length === 0) return 'No logged decisions.';
  return decisions.slice(0, 12).map((d) => {
    const chosen = Array.isArray(d.options) ? d.options[d.chosen] : undefined;
    return `• ${d.title} [${d.status}]${chosen ? ` → chose: ${chosen}` : ''}`;
  }).join('\n');
}

function summarizeQuiz(quiz) {
  if (!Array.isArray(quiz) || quiz.length === 0) return 'No self-assessments taken.';
  return quiz.slice(0, 10).map((q) => `• ${q.topic}: ${q.score}/${q.total} MC`).join('\n');
}

function summarizeNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return 'No notes.';
  return notes.slice(0, 12).map((n) => `• ${n.title}`).join('\n');
}

function buildPrompt(ctx) {
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

async function generateReview() {
  const state = await readState([
    KEYS.GRAPH, KEYS.PROJECTS, KEYS.RESEARCH, KEYS.DECISIONS, KEYS.QUIZ, KEYS.NOTES,
  ]);

  const prompt = buildPrompt({
    graph: summarizeGraph(state[KEYS.GRAPH]),
    projects: summarizeProjects(state[KEYS.PROJECTS]),
    research: summarizeResearch(state[KEYS.RESEARCH]),
    decisions: summarizeDecisions(state[KEYS.DECISIONS]),
    quiz: summarizeQuiz(state[KEYS.QUIZ]),
    notes: summarizeNotes(state[KEYS.NOTES]),
  });

  const { text, provider, model } = await callRecapAI({ system: CB_IDENTITY, user: prompt, maxTokens: 3200 });

  const record = {
    type: 'monthly_review',
    generatedAt: Date.now(),
    generatedAtISO: new Date().toISOString(),
    provider,
    model,
    content: text,
  };
  await writeState(KEYS.MONTHLY_REVIEW, record);
  return record;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!requireCron(req, res)) return;
  try {
    const record = await generateReview();
    return res.status(200).json({ ok: true, generatedAtISO: record.generatedAtISO });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err), attempts: err?.attempts || [] });
  }
}
