# Batch Z-2 / Order H: the remaining containers

The scoreboard after each container is measured with the full gate, at 390 / 820 / 1280
in light and dark:

- **responsive** is the `scripts/audit-responsive.baseline.json` total;
- **tokens** is the `scripts/check-tokens.baseline.json` total;
- **CI** is the GitHub Actions run on the pushed head.

Starting point for Z-2: responsive **545**, tokens **1,432**.

## Shared shell + components (before the containers)

These were done first, so no container agent had to edit a shared file.

| Step | responsive | tokens |
|---|---|---|
| G1: ResearchHub overflow fix, ContainerNav → CSS | 545 → 433 | 1,432 → 1,422 |
| I-1: accent-as-text sweep (306 uses) + delete dead Sidebar.jsx | 433 → 226 | 1,422 → 1,397 |
| Shared components (16 files) + What's Happening CLS fix (`scrollbar-gutter: stable`) | 226 → 190 | 1,397 → 1,211 |
| App LoadingScreen | n/a | 1,211 → 1,206 |

## What's Happening (feed)

Branch `worktree-agent-a2b37d500a5bfe030`, cherry-picked as one commit.

| | before | after |
|---|---|---|
| WhatsHappening.jsx token violations | 41 | **0** |
| feed tap <44 (6 cells) | 82 | **0** |
| feed overflow / cls / contrast / 0×0 / console | 0 | 0 |

Scoreboard after: responsive **190 → 108**, tokens **1,206 → 1,165**.

What changed:

- The rail is the shared `PageWithRail` (340px, sticky, ≥1101). Below that it stacks
  under the feed. **This is J2 for this surface.**
- JS layout switches became media queries.
- Selected lens and filter chips use an accent border and `--accent-text`, not a tinted
  fill.
- Filter and density chips inside the horizontal scroller get a real 44px on touch,
  because the scroller clips `::after` hit areas.

Screens: `docs/screens/batch-Z2-H-feed-feed-{before,after}-{390,820,1280}-{light,dark}.png`

## Research (Investigate): ResearchHub, Notes, ContentInbox

Branch `worktree-agent-a7bf6d92405c148dc`, cherry-picked as one commit.

| | before | after |
|---|---|---|
| ResearchHub.jsx / Notes.jsx / ContentInbox.jsx tokens | 78 / 24 / 35 | **0 / 0 / 0** |
| research contrast (dark "+ New Thread": black on gold, 1.07:1) | 3 | **0** |
| research tap / overflow / cls / 0×0 / console | 0 | 0 |

Scoreboard after: responsive **108 → 105**, tokens **1,165 → 1,028**.

- **J2 for research:** the thread list renders through `PageWithRail`. The 340px rail
  holds the Source Library plus `ProvenancePanel`, and stacks below under 1101. The page
  max-width is now `--container-page`, so the main column has room.
- **Primary actions:** every gold gradient, black-text button is now `.btn-primary`.
- **Selected states:** accent border plus `--accent-text`, with `aria-pressed`.
- **Icons:** emoji UI icons are now lucide icons. Content emoji in saved data is left
  alone.
- **Board layout:** the Research Board is 1 column on phone, 2 at ≥721 and 4 at ≥1101.
  It used to be 4 squeezed columns in a phone scroller.
- **Notes and inbox:** neither is in the audit's `VIEWS` yet. The agent audited them
  with a scratch copy of the script, including seeded and interactive states (open
  thread, board add form, Notes composer, expanded inbox item), and they came back
  clean. They will be added to `VIEWS` at the end of H.
- **Known, unchanged:** the thread-view compose placeholder clips at 390. This was
  pre-existing.

Screens: `docs/screens/batch-Z2-H-research-{research,notes,inbox}-{before,after}-{390,820,1280}-{light,dark}.png`

## Projects (Execute) + Studio (Produce): ProjectsOS, DecisionLog, CreationStudio

Branch `worktree-agent-a5d84520ef8a68aa1`, two commits, cherry-picked.

| | before | after |
|---|---|---|
| ProjectsOS / DecisionLog / CreationStudio tokens | 159 / 49 / 17 | **0 / 0 / 0** |
| projects contrast (black text on navy "+ New Project", 1.43:1) | 6 | **0** |
| studio contrast (subtle text on the selected card, 4.47:1) | 3 | **0** |
| tap | 0 | 0 |

Projects tap was 0 before only because clickable divs weren't detected as controls. Now
they're real buttons, all measured, all passing.

Scoreboard after: responsive **105 → 96**, tokens **1,028 → 803**.

**Bugs found and fixed while extracting:**

- `ProjectsOS` used `<Icon>` in the New Project modal **without importing it**. Opening
  the modal would have thrown.
- File artifacts rendered the literal text "FileText" / "Paperclip", because
  `getFileIcon` returns lucide names.
- Card borders built as `${p.color}20` were invalid CSS, so the cards had no hairline.

**Visible changes:**

- Project colour is now `--pc`, used for bars and hairlines only. Text that used it is
  now `--text-muted`, for contrast.
- Black-text colour fills are now `.btn-primary`.
- Gold tints are now hairlines. Selected states use an accent border and
  `--accent-text`.
- Emoji UI icons are now lucide icons. 👤 and 🔌 remain, because the Icon registry has
  no match and is shared.
- The kanban is 1 column on phone, 2 on iPad and 4 on desktop.
- Workspace tabs get a real 44px on touch.

**Audit coverage:** `decisions` isn't in `VIEWS`. The agent audited 16 seeded states with
a scratch copy of the audit (every workspace tab, modals, forms, empties, the decisions
list and form, studio with and without sources). All were 0 after one fix: subtle date
text on the decision-card hover fill.

Screens: `docs/screens/batch-Z2-H-projects-{projects,decisions}-*`, `batch-Z2-H-studio-studio-*`

## Skills (Practice): Skills, Recaps, MasteryVault, GrowthTools

Branch `worktree-agent-a2d1a3929bb3bce24`, cherry-picked as one commit.

| | before | after |
|---|---|---|
| Skills / Recaps / MasteryVault / GrowthTools tokens | 32 / 3 / 89 / 53 | **0 / 0 / 0 / 0** |
| skills tap (the 40px "Track a skill" input and button) | 8 | **0** |
| vault contrast ("+ New Note": black on accent, 1.43:1) | 6 | **0** (via a scratch audit) |

Scoreboard after: responsive **96 → 88**, tokens **803 → 626**.

- **Seeded and interacted states** were audited with the gate's own `measure()`: 12
  states × 6 cells, including sparklines, the drill, study mode, export, note detail,
  and Growth's expanded cards and tabs. The first pass found 16 contrast failures
  (`--text-subtle` on the hover fill), all fixed. The final pass was 0.
- **Things that were broken and now render:** Growth progress bars, which used an
  invalid `linear-gradient(…80)` and so never drew. Several hairlines built as
  `${'var(--x)'}40` were invalid CSS and also never drew.
- **Found, not changed** (outside a style refactor):
  - "+ Add certification" in Growth has no handler and never did.
  - `NOTE_COLORS` is six identical `T.accent` values, so the note colour picker shows six
    identical swatches.

Screens: `docs/screens/batch-Z2-H-skills-*`

## Learn, part A: BookClub, DeepDive, TEDHub, PodcastHub, plus the mental-model chip

Branch `worktree-agent-a1b4378617896a2c0`, cherry-picked as one commit.

| | before | after |
|---|---|---|
| BookClub / DeepDive / PodcastHub / TEDHub tokens | 133 / 36 / 56 / 25 | **0 / 0 / 0 / 0** |
| books tap / contrast | 46 / 30 | **0 / 0** |
| deepdive tap / contrast (scratch audit) | 8 / 3 | 0 / 0 |
| ted tap / contrast (scratch audit) | 28 / 30 | 0 / 0 |
| podcast contrast: white text on a gradient that went white (scratch audit) | 9 | 0 |

Scoreboard after: responsive **88 → 12**, tokens **626 → 376**. The only cells left are `learn` dark-mode contrast (4 per width), which belong to Learn part B, still in progress. `npm run verify:prompts`
still passes. Every prompt line in BookClub is byte-identical, and the J1 backfill and
SectionState wiring are preserved.

**"Through my mental models" chip:**

- **BookClub:** mounted under the study-guide body (`title` = the book, `body` = the
  guide on screen).
- **DeepDive:** mounted after the passes (`body` = all sections). It is disabled while a
  pass runs.
- **Nothing calls the model until the chip is tapped.** The agent checked this in the
  browser for the deep dive. In BookClub the one `/api/chat` on opening a saved guide is
  the existing DiagramBlock auto-draw.

**Visible changes:**

- Selected states use an accent border and `--accent-text`, replacing tinted fills.
- The podcast header gradient is now a flat surface card.
- Notices are a hairline box with a coloured left edge.
- Emoji UI icons are now lucide icons where the registry has a match. 🗑 🔊 ⏹ 🧹 🎙️
  remain, because the shared Icon registry wasn't in scope.
- BookClub's 480px breakpoint is gone; it uses 721 and 1101 only.

Screens: `docs/screens/batch-Z2-H-learnA-{books,deepdive,ted,podcast}-*`

## Learn, part B: LearningCenter, FieldManual, Academy, LearningLadder, TranslatorHub, QuizCenter

Branch `worktree-agent-aa5a6d2e797a13911`, cherry-picked as one commit.

| | before | after |
|---|---|---|
| tokens (112 / 109 / 5 / 46 / 40 / 36) | 348 | **0** |
| learn contrast (accent fill used as text, 2.19:1 dark) | 12 | **0** |
| academy / ladder / translate / quiz tap (scratch audit, now in VIEWS) | 22 / 4 / 56 / 4 | **0** |

Scoreboard after: responsive **12 → 0**, tokens **376 → 28**. `verify:prompts` passes.

- **Bug fixed:** `FieldManual.jsx` rendered `<FieldSection>`, which was **never
  defined**. Picking a Field Mode scenario threw a ReferenceError.
- **Visible change (flagged):** Field Manual tier chips now use the real `--tier-*`
  tokens as text plus a border. They used to be *filled* positive/caution/dim, so
  **Reported** turns from amber to the accent blue and **Inferred** from grey to amber.
  The old colours didn't match the tier system used everywhere else.
- Call-block tones map to a left border and title colour only.
- "Field Ready" and the Reset-confirm button no longer fill (both failed contrast in
  dark).
- **Left as before:** the Ladder and Quiz loading screens still use ThinkingDots, and a
  failed translation still writes its message into the output panel.

Screens: `docs/screens/batch-Z2-H-learnB-{learn,academy,ladder,translate,quiz}-*`

---

## Order H: close

**All six containers plus What's Happening are extracted.** The remaining 28 token
violations are all in `CoachAI.jsx`, which is unrouted but **retained** per CLAUDE.md
("Phase 3 folds its content into the Ask layer"). It's baselined, not extracted.

**Every mode is now guarded.** The 13 secondary modes (notes, inbox, deepdive, ted,
podcast, academy, ladder, translate, quiz, recaps, vault, growth, decisions) were added
to the audit's `VIEWS`. That makes **22 views × 3 widths × 2 themes = 132 page loads**.
**All 22 are zero on all six checks.**

**The ratchet is tightened.** With the baseline empty, the old "refuse to add" check
would have been skipped. It now refuses any new cell unless a brand-new view is named in
`AUDIT_NEW_VIEWS`.

**About the order of work:** containers were *built* in parallel in isolated worktrees,
but each was *integrated and verified* one at a time:

1. cherry-pick;
2. `npm run build` (check-tokens);
3. `audit-responsive` for that container's views, which had to print `ok`;
4. `--update` (both baselines strictly lower);
5. commit and push.

The order was feed → research → projects/studio → skills → learn A → learn B.

| after | responsive | tokens |
|---|---|---|
| start of Z-2 | 545 | 1,432 |
| shared + I-1 sweep | 190 | 1,206 |
| feed | 108 | 1,165 |
| research | 105 | 1,028 |
| projects + studio | 96 | 803 |
| skills | 88 | 626 |
| learn A | 12 | 376 |
| learn B | **0** | **28** (CoachAI only) |
