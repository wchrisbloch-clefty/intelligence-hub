#!/usr/bin/env node
// scripts/verify-prompts.mjs — Batch Z / Order D prompt-level check.
// Loads the REAL BookClub prompt builders through Vite's SSR loader and asserts,
// for three books from different domains, that the exact prompt the app sends:
//   • carries LENS + SUBJECT_FIDELITY (system) and SUBJECT_FIDELITY (user)
//   • names none of the reader's goals/identity (job, city, money, passive income)
//     outside the explicit "do NOT translate into …" prohibitions
//   • contains NO "## Where this touches your work" instruction (Layer 3 is off)
// and that selectDomains() returns [] while disabled, and only fires on genuine
// overlap when force-enabled against a fixture graph.
// This verifies what the model is TOLD. It does not call a model.
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const bc = await vite.ssrLoadModule('/src/modules/BookClub.jsx');
const c = await vite.ssrLoadModule('/src/constants.js');
const dp = await vite.ssrLoadModule('/src/lib/domainPacks.js');

const BOOKS = [
  { kind: 'non-financial', b: { title: 'The Way of Excellence', author: 'Brad Stulberg' },
    g: { fullTitle: 'The Way of Excellence', verified: true, source: 'google', description: 'A guide to pursuing excellence for its own sake — mastery, craft, and the long arc of meaningful work.' } },
  { kind: 'negotiation', b: { title: 'Never Split the Difference', author: 'Chris Voss' },
    g: { fullTitle: 'Never Split the Difference: Negotiating As If Your Life Depended On It', verified: true, source: 'google', description: 'A former FBI hostage negotiator on tactical empathy, calibrated questions and mirroring.' } },
  { kind: 'technical', b: { title: 'Chip War', author: 'Chris Miller' },
    g: { fullTitle: "Chip War: The Fight for the World's Most Critical Technology", verified: true, source: 'google', description: 'The history of the semiconductor industry and the geopolitics of chip supply chains.' } },
];

// Identity/goal leakage. Prohibition lines ("Do NOT translate … into finance …")
// legitimately NAME these subjects, so they're stripped before scanning.
const LEAK = /houston|bd professional|\bw2\b|\$10k|passive[- ]income|dividend|real[- ]estate|portfolio|\bCB\b/i;
const PROHIBITION = /(do not|don't|never|not )[^.]*(finance|investing|real estate|business development|passive income|money|portfolio|career|goals)[^.]*/gi;
const scrub = (t) => t.replace(PROHIBITION, '');

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

check(c.SYSTEM_LEARNING.includes(c.LENS) && c.SYSTEM_LEARNING.includes(c.SUBJECT_FIDELITY), 'system prompt = LENS + SUBJECT_FIDELITY');
check(!LEAK.test(scrub(c.SYSTEM_BASE)), 'SYSTEM_BASE names no reader goal/identity');
check(!LEAK.test(scrub(c.SYSTEM_LEARNING.replace(/READER'S BOOKSHELF[\s\S]*/, ''))), 'SYSTEM_LEARNING (minus bookshelf titles) names no reader goal/identity');
check(dp.DOMAIN_PACKS_ENABLED === false, 'DOMAIN_PACKS_ENABLED === false');

for (const { kind, b, g } of BOOKS) {
  const personal = bc.guidePersonalSection(b, g);
  const prompt = bc.buildGuidePrompt(b, 'Worked examples come from the book\'s own world.', personal, g, 'deep');
  const chapter = bc.buildChapterPrompt({ ...b, fullTitle: g.fullTitle }, 'Chapter One', 0, 'x', 'reported');
  const leak = scrub(prompt).match(LEAK);
  console.log(`\n— ${kind}: ${b.title}`);
  check(personal === '', 'Layer 3 personal section: none');
  check(!/where this touches your work/i.test(prompt), 'no "## Where this touches your work"');
  check(prompt.includes(c.SUBJECT_FIDELITY), 'SUBJECT_FIDELITY in the user prompt');
  check(!leak, `guide prompt names no reader goal/identity${leak ? ` (found "${leak[0]}")` : ''}`);
  const cl = scrub(chapter).match(LEAK);
  check(!cl, `chapter prompt names no reader goal/identity${cl ? ` (found "${cl[0]}")` : ''}`);
}

console.log('\n— Layer 3 gate (selectDomains)');
const fat = { allConcepts: () => Array.from({ length: 12 }, (_, i) => ({ topic: `c${i}` })),
  relatedConcepts: () => [{ concept: { topic: 'dividend portfolio yield' } }, { concept: { topic: 'cap rate rental' } }] };
const thin = { allConcepts: () => [{ topic: 'a' }], relatedConcepts: () => [] };
check(dp.selectDomains('negotiation deal anchoring empathy', { graph: fat }).length === 0, 'disabled → [] even on strong overlap');
const neg = dp.selectDomains('Never Split the Difference negotiation deal anchoring empathy', { graph: { ...fat, relatedConcepts: () => [] }, enabled: true });
check(neg.map((x) => x.id).join() === 'negotiation', `enabled + negotiation material → [negotiation] (got [${neg.map((x) => x.id)}])`);
check(dp.selectDomains('The Way of Excellence craft mastery', { graph: { ...fat, relatedConcepts: () => [] }, enabled: true }).length === 0, 'enabled + excellence material → [] (no pack forced)');
check(dp.selectDomains('negotiation deal anchoring empathy', { graph: thin, enabled: true }).length === 0, 'enabled + thin graph (<6 concepts) → []');
const sec = dp.personalSectionPrompt(neg);
check(/Where this touches your work/.test(sec) && /120 words/.test(sec) && !/Investing/.test(sec), 'personal section: labelled, ≤120 words, only matched packs');

await vite.close();
console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);
