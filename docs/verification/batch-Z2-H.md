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
