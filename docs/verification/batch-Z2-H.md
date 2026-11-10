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
