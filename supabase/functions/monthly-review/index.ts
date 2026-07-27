// ─────────────────────────────────────────────────────────────────────────────
// Monthly Profile Review — Supabase Edge Function
//
// Reads CB's full Intelligence Hub state from app_state and asks Claude to
// generate the monthly review: full profile update, cross-project opportunity
// scan, business ideas, agent upgrades, health optimizations, and book recs.
// Writes the result back to app_state under `monthly_review_latest`.
//
// Runs with verify_jwt=false + an x-cron-secret gate (see _shared/auth.ts).
//
// ── DEPLOY (CB runs these locally after `supabase login`) ────────────────────
//   supabase functions deploy monthly-review --project-ref hmblakpkglbkyhaghltz
//   # Secrets are shared with weekly-recap (ANTHROPIC_API_KEY, CRON_SECRET,
//   # optional RECAP_USER_ID) — no need to set them again if already set.
// After deploy, schedule it via supabase/functions/schedule.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { serviceClient, resolveTargetUserIds, readState, writeState, KEYS } from "../_shared/appState.ts";
import { callAnthropic, RECAP_MODEL } from "../_shared/anthropic.ts";
import { assertCronSecret, json } from "../_shared/auth.ts";
import { CB_IDENTITY } from "../_shared/identity.ts";

function summarizeGraph(graph: unknown): string {
  const g = graph as any;
  if (!g || typeof g !== "object") return "No learning graph on record.";
  const topics = g.topics && typeof g.topics === "object" ? Object.values(g.topics) : [];
  const header = `Streak: ${g.streak ?? 0} · Total time: ${g.totalTime ?? 0}min · Topics: ${topics.length}`;
  const top = (topics as any[])
    .slice(-12)
    .map((t) => `• ${t.title} (${t.type}): ${t.sessions} sessions, confidence ${t.confidence}/10`)
    .join("\n");
  return `${header}\n${top || "No topics yet."}`;
}

function summarizeProjects(projects: unknown): string {
  if (!Array.isArray(projects) || projects.length === 0) return "No projects on record.";
  return projects
    .map((p: any) => {
      const ms = Array.isArray(p.milestones) ? p.milestones : [];
      const done = ms.filter((m: any) => m?.done).length;
      return `• ${p.title} [${p.status || "active"}] — ${done}/${ms.length} milestones${p.category ? ` · ${p.category}` : ""}${p.blueOcean ? `\n  Blue Ocean: ${p.blueOcean}` : ""}`;
    })
    .join("\n");
}

function summarizeResearch(research: unknown): string {
  if (!Array.isArray(research) || research.length === 0) return "No research threads.";
  return research.slice(0, 15).map((r: any) => `• ${r.title}${r.status ? ` [${r.status}]` : ""}`).join("\n");
}

function summarizeDecisions(decisions: unknown): string {
  if (!Array.isArray(decisions) || decisions.length === 0) return "No logged decisions.";
  return decisions.slice(0, 12).map((d: any) => {
    const chosen = Array.isArray(d.options) ? d.options[d.chosen] : undefined;
    return `• ${d.title} [${d.status}]${chosen ? ` → chose: ${chosen}` : ""}`;
  }).join("\n");
}

function summarizeQuiz(quiz: unknown): string {
  if (!Array.isArray(quiz) || quiz.length === 0) return "No self-assessments taken.";
  return quiz.slice(0, 10).map((q: any) => `• ${q.topic}: ${q.score}/${q.total} MC`).join("\n");
}

function summarizeNotes(notes: unknown): string {
  if (!Array.isArray(notes) || notes.length === 0) return "No notes.";
  return notes.slice(0, 12).map((n: any) => `• ${n.title}`).join("\n");
}

function buildPrompt(ctx: {
  graph: string; projects: string; research: string;
  decisions: string; quiz: string; notes: string;
}): string {
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

async function generateForUser(sb: any, userId: string) {
  const state = await readState(sb, userId, [
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

  const content = await callAnthropic({ system: CB_IDENTITY, user: prompt, maxTokens: 3200 });

  const record = {
    type: "monthly_review",
    generatedAt: Date.now(),
    generatedAtISO: new Date().toISOString(),
    model: RECAP_MODEL,
    content,
  };
  await writeState(sb, userId, KEYS.MONTHLY_REVIEW, record);
  return record;
}

Deno.serve(async (req: Request) => {
  const denied = assertCronSecret(req);
  if (denied) return denied;

  try {
    const sb = serviceClient();
    const userIds = await resolveTargetUserIds(sb);
    if (userIds.length === 0) {
      return json({ ok: true, message: "No users found in app_state; nothing to do." });
    }

    const results: Array<{ userId: string; ok: boolean; error?: string; generatedAtISO?: string }> = [];
    for (const userId of userIds) {
      try {
        const rec = await generateForUser(sb, userId);
        results.push({ userId, ok: true, generatedAtISO: rec.generatedAtISO });
      } catch (err) {
        results.push({ userId, ok: false, error: String((err as Error)?.message ?? err) });
      }
    }
    return json({ ok: true, processed: results.length, results });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
