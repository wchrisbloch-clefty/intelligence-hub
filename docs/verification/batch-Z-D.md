# Batch Z / Order D: verification

## Headline: what is and isn't verified

**Verified: what the model is TOLD.** For three books from different domains, the exact
prompts the app sends contain no reader goal or identity, carry SUBJECT_FIDELITY, and
contain no `## Where this touches your work` instruction. The detector also catches the
old prompt on `main`, so a pass means something.

**NOT verified: what the model WRITES.** The batch asks for three generated study
guides pasted in full. **I could not generate them.** This sandbox has no AI provider
keys (no `ANTHROPIC_API_KEY`, `GROQ_API_KEY` or others), and the Vercel env vars are
not readable to me. I am not pasting a guide I wrote by hand and calling it the app's
output. **This is the open verification item for D.** See "Owed" below.

## What landed

| Item | Where |
|---|---|
| Prompts as files | `prompts/lens-v1.md` (Layer 1), `prompts/subject-fidelity-v1.md` (Layer 2), `prompts/library-v1.md` (reader's bookshelf, reference-only) |
| Domain packs as data, five peers | `knowledge/domains/{finance,health,negotiation,building,geopolitics}.md` (front matter: id, label, keywords) |
| Build-time compile | `scripts/gen-prompts.mjs` writes `prompts/prompts.generated.js`; `npm run build` runs `--check` and fails if stale. The one generated module is imported by `src/constants.js`, `src/lib/rigor.js`, `api/_recap.js`, and the Supabase Edge Functions (Order E). |
| `CB_IDENTITY` / `CB_LEARNING_SPINE` / `CB_SPINE` **removed** | `grep -rn "CB_IDENTITY" src api` finds only explanatory comments |
| Replacements | `SYSTEM_BASE` = role + LENS + SUBJECT_FIDELITY; `SYSTEM_LEARNING` = SYSTEM_BASE + bookshelf. 55 call sites across 19 files, renamed mechanically. |
| Layer 3 | `src/lib/domainPacks.js`: `DOMAIN_PACKS`, `selectDomains(materialText, {graph, topic, threshold=2, enabled=false})` (uses `relatedConcepts` from graph.js), `personalSectionPrompt()`, `DOMAIN_PACKS_ENABLED = false` |
| `VOICE` composes from `LENS` | `src/lib/rigor.js` |
| `promptVersion` bumped, same commit | studyGuide 7→8, deepDive 1→2, ladder 1→2, signals 2→3 |
| Prompt-level verifier | `scripts/verify-prompts.mjs` (`npm run verify:prompts`) |

## The bias was not only in the one string

Swapping `CB_IDENTITY` alone would **not** have landed D3. The same goals were
hardcoded into individual prompts, and these were rewritten:

- **BookClub study guide**: opened "for CB (Houston BD professional; passive-income +
  longevity goals)". Every framework's worked example was "in the lens", and the lens
  clauses were literally "BD pipeline, deals, revenue" or "money habits". Applied
  Scenarios fell back to "Houston BD, real-estate deals, passive income" and were fed
  the reader's projects and graph via `buildStudyContext()`.
  - Now examples come from the book's own world, and Applied Scenarios are set in the
    book's world.
  - `buildStudyContext()` now reaches a prompt **only** through Layer 3
    (`guidePersonalSection`), which is disabled.
  - The Work/Personal/Both lens only chooses which half of ordinary life a *general*
    example comes from, when the book has none.
- **Chapter dives**: "for CB (Houston BD professional)" removed. Worked example from the
  book's world.
- **Study modes** (overview / concepts / quotes): CB-specific takeaways removed. `apply`
  stays, because it's the one mode whose job is personal relevance and the user asks for
  it. It now treats the five domain labels as peers and skips areas the book doesn't
  touch.
- **ContentInbox analysis**: "specific CB applications (BD, investing, health, Houston)"
  removed.
- **PodcastHub**: deep-dive and takeaway prompts no longer ask for "BD professional,
  investor, Houston" action items.
- **utils.js**: the quiz prompt ("Tailor … to passive income, BD, longevity"), the
  ladder prompt ("applies everything to passive income / BD / longevity"), the reading
  system's nonfiction/training/apply instructions, and every chat-mode "→ CB
  application". Learning history is now "context only, never a source of examples".
- **LearningLadder**: "concept → analogy → CB application" changed to an example from
  the subject itself.

## Deliberately left personal (user's own content or explicitly personal surfaces)

ProjectsOS (obstacles for *his* project), GrowthTools (*his* goals and certifications),
MasteryVault "apply this note", the chat "project advisor" mode, DailyBrief, and the
weekly/monthly recap user prompts (the monthly review is literally a goal review). These
are about the reader's own life by design. The CLAUDE.md epistemic layer already
separates user-owned content from external material. They no longer get the goals from
the *system* prompt, though.

**The mental-model library changed.** The old "CROSS-REFERENCE RULE: Always connect to
CB's mental model library" forced Buffett into a book about craft. It's now
`READER_LIBRARY`: cite only when the material genuinely invites the comparison, never
forced. That's a judgment call beyond the literal brief, flagged here.

## `npm run verify:prompts` output

```
PASS  system prompt = LENS + SUBJECT_FIDELITY
PASS  SYSTEM_BASE names no reader goal/identity
PASS  SYSTEM_LEARNING (minus bookshelf titles) names no reader goal/identity
PASS  DOMAIN_PACKS_ENABLED === false

— non-financial: The Way of Excellence
PASS  Layer 3 personal section: none
PASS  no "## Where this touches your work"
PASS  SUBJECT_FIDELITY in the user prompt
PASS  guide prompt names no reader goal/identity
PASS  chapter prompt names no reader goal/identity

— negotiation: Never Split the Difference
PASS  Layer 3 personal section: none
PASS  no "## Where this touches your work"
PASS  SUBJECT_FIDELITY in the user prompt
PASS  guide prompt names no reader goal/identity
PASS  chapter prompt names no reader goal/identity

— technical: Chip War
PASS  Layer 3 personal section: none
PASS  no "## Where this touches your work"
PASS  SUBJECT_FIDELITY in the user prompt
PASS  guide prompt names no reader goal/identity
PASS  chapter prompt names no reader goal/identity

— Layer 3 gate (selectDomains)
PASS  disabled → [] even on strong overlap
PASS  enabled + negotiation material → [negotiation] (got [negotiation])
PASS  enabled + excellence material → [] (no pack forced)
PASS  enabled + thin graph (<6 concepts) → []
PASS  personal section: labelled, ≤120 words, only matched packs

all checks passed
```

Control check: the same detector run on `main`'s `CB_IDENTITY` flags `CB` after
prohibitions are scrubbed, and `main`'s BookClub contains `for CB (Houston BD
professional; passive-income + longevity goals)`.

## Owed: needs a provider key (CB)

1. Deploy this branch (Preview is fine).
2. Books → generate a study guide for **The Way of Excellence** (non-financial), **Never
   Split the Difference** (negotiation) and **Chip War** (technical). Each will show
   "regenerate", because studyGuide is now v8.
3. For each, confirm two things. First, no finance, investing, real-estate, BD or
   passive-income worked example appears, unless the book is about it (Chip War may
   legitimately discuss markets). Second, no `## Where this touches your work` section
   appears.
4. If a finance analogy survives in the Excellence guide, **D3 did not land**. Report it
   as a failure; do not ship.
