// api/weekly-recap.js — Friday Weekly Recap (Vercel Cron + serverless).
//
// Reads CB's recent news/research/projects/notes from Upstash, asks Claude to
// generate the Friday recap in the app's established format (NewsHub
// improvements, Spine updates, active project suggestions, skills upgrades), and
// writes the result back to Upstash under `weekly_recap_latest`.
//
// Triggered by Vercel Cron (GET, `Authorization: Bearer <CRON_SECRET>`) —
// schedule "0 13 * * 5" is declared in vercel.json.
import { readState, writeState, callRecapAI, requireCron, KEYS, CB_IDENTITY } from './_recap.js';

// An Anthropic generation exceeds the default function timeout.
export const config = { maxDuration: 300 };

// ── Data → compact prompt context ────────────────────────────────────────────
function summarizeProjects(projects) {
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

function summarizeResearch(research) {
  if (!Array.isArray(research) || research.length === 0) return 'No research threads on record.';
  return research
    .slice(0, 10)
    .map((r) => `• ${r.title}${r.status ? ` [${r.status}]` : ''}${r.query ? ` — ${r.query}` : ''}`)
    .join('\n');
}

// Inbox = the app's "news" surface (saved articles/videos/social/notes).
function summarizeInbox(inbox) {
  if (!Array.isArray(inbox) || inbox.length === 0) return 'No saved news/content this period.';
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = inbox.filter((i) => (i?.createdAt ?? 0) >= weekAgo);
  const list = recent.length ? recent : inbox.slice(0, 8);
  return list.map((i) => `• [${i.type || 'item'}] ${i.title || i.url || 'untitled'}`).join('\n');
}

function summarizeNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return 'No notes on record.';
  return notes.slice(0, 8).map((n) => `• ${n.title}`).join('\n');
}

function buildPrompt(ctx) {
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
his goals (passive income, real estate, BD, longevity). Why each matters now.

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

async function generateRecap() {
  const state = await readState([KEYS.PROJECTS, KEYS.RESEARCH, KEYS.INBOX, KEYS.NOTES]);

  const prompt = buildPrompt({
    projects: summarizeProjects(state[KEYS.PROJECTS]),
    research: summarizeResearch(state[KEYS.RESEARCH]),
    inbox: summarizeInbox(state[KEYS.INBOX]),
    notes: summarizeNotes(state[KEYS.NOTES]),
  });

  const { text, provider, model } = await callRecapAI({ system: CB_IDENTITY, user: prompt, maxTokens: 2200 });

  const record = {
    type: 'weekly_recap',
    generatedAt: Date.now(),
    generatedAtISO: new Date().toISOString(),
    provider,
    model,
    content: text,
  };
  await writeState(KEYS.WEEKLY_RECAP, record);
  return record;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  if (!requireCron(req, res)) return;
  try {
    const record = await generateRecap();
    return res.status(200).json({ ok: true, generatedAtISO: record.generatedAtISO });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
