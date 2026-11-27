# Batch Z / Order C: verification

## Headline

**One of six containers is done: Home (Orient).** Learn, Research, Skills, Projects and
Studio are **not started**. The batch says not to start the next container until the
current one is verified, and this session verified Home. The guardrail that keeps the
rest honest is in place and fails the build.

## What landed

| Item | Where |
|---|---|
| `check-tokens` guardrail, run by `npm run build` | `scripts/check-tokens.mjs`, `package.json` `build` |
| Ratchet baseline (counts may only go down) | `scripts/check-tokens.baseline.json` |
| Home container extracted | `HomeDashboard.jsx` and `home/{DailyBrief,OpportunityCards,SignalCard,SignalFeed,ActiveProjects,SkillSnapshot}.jsx`, all at **0** violations → `home/home.css` (`hm-`, `op-`, `sc-`) |
| Shared pieces Home renders | `TopBar.jsx` → `topbar.css` (`tb-`), `CaptureBar.jsx` → `capture-bar.css` (`cb-`), `ConnectedKnowledge.jsx` → `connected-knowledge.css` (`ck-`), `FollowButton.jsx` → `.chip`. All at 0 violations. |
| Phone Home surface | `src/modules/home/MobileHome.jsx`, wired by one line in `App.jsx` (`home: isMobile ? <MobileHome/> : <HomeDashboard/>`) |
| Screenshot harness | `scripts/shoot.mjs` (390 / 820 / 1280 × light / dark, full length) |

### The guardrail

It fails the build on:

- a hex, `rgb(` or `hsl(` in any `src/**/*.css`, except `src/styles/tokens.css`;
- an inline `style={{…}}` carrying colour, background, border, outline, box-shadow, fill
  or stroke in any `.jsx`;
- a hex literal in any `.jsx`.

Today there are **1,605 legacy violations across 53 files**. Instruction can't hold a
line across 26 files, so the baseline records per-file counts. A file may only go down,
and a file not in the baseline must be at 0. `--update` refuses to raise a count or add
a file.

After the Home pass the count is **1,439 across 42 files** (−166). It includes hardcoded
gold `#D9A441` still alive in ProjectsOS, ContentInbox, GrowthTools, TranslatorHub,
LearningCenter and MasteryVault, despite CLAUDE.md claiming it was all removed.

## A real iPad bug found and fixed

At **820px the top bar was ~1016px wide**. The theme toggle, Capture, New chat and AI
Chat buttons rendered off-screen to the right, clipped by `overflow: hidden`: present
in the DOM, invisible on the device. I reproduced it on **`main` before any Batch Z
change** (3 buttons with `right > innerWidth` at 820, 0 at 1280), so it was
pre-existing. It is invisible at 390 and 1280, which is exactly the class of bug the
three-width sweep exists to catch.

The fix: TopBar is now **one render path** sized entirely in CSS. Below 1101px it drops
the wordmark, the stats chips and the "AI Chat" label, and the search field is `flex:1;
min-width:0`. After the fix, zero elements extend past the viewport at 390, 820 or 1280.

## Measurements: Home, first load, served by `scripts/serve-local.mjs`

| | 390 | 820 | 1280 |
|---|---|---|---|
| document horizontal overflow | none | none (was 3 clipped buttons) | none |
| CLS (layout-shift observer, no input) | 0.013 | 0.005 | 0.002 |
| controls under 44px (`?debug=1` report, coarse pointer) | **0** (was 17) | n/a | n/a |
| console errors | 0 | 0 | 0 |

CLS was **0.072 at 820** mid-pass. The Daily Brief went from empty, to a skeleton, to
shorter content, pushing every section below it down 121px and back. It's fixed by
showing the skeleton from first paint and reserving the body's height (`min-height:
226px`, the 3-row skeleton height).

## MobileHome

- `data-surface="mobile-home"` appears only at ≤720 (`isMobile`). iPad and desktop
  still render `HomeDashboard`, unchanged apart from the extraction.
- The first two sections in the user's saved order (`aether_home_layout`) render eagerly.
  The rest wait behind a reserved-height `SectionSkeleton` until an IntersectionObserver
  fires at `rootMargin: 600px`. The observer's root is `.fr-main`. The app scrolls inside
  that element, not the window, and with the default viewport root the 600px look-ahead
  would be clipped away.
- Observed at 390: initial `brief, opportunity, connected, skills, projects` mounted
  (within 600px), `signals` deferred; after scrolling 600px, `signals` mounted.

## Screens

`docs/screens/batch-Z-C-home-{before,after}-{390,820,1280}-{light,dark}.png` (12 images).
Note that `before-820-*` is 1016px wide: that's the clipped top bar, captured.

## Visual changes at desktop: flagged, not hidden

The brief asked for a mechanical move with appearance unchanged at desktop. These
changes are deliberate, because Order A's rules forbid the old look. None was forced by
CSS being unable to reproduce the layout.

- Hover fills are `--surface-muted`. Accent-tinted fills (`withAlpha(accent, 8–10)`) are
  gone, and so is the Capture bar's accent border.
- Signal verdict chips (Pursue / Not now / Not relevant) were solid colour fills when
  selected. They're now a coloured border and text (`aria-pressed`). Same for the Follow
  button and the domain-weight squares (neutral fill).
- Signal/tier type markers are text + a 1px bar, never a filled pill.
- The ✦ / ● / ⚠ glyphs were dropped (no emoji, no decorative glyphs).
- The Connected Knowledge card still repeats its section title as an eyebrow. This was
  pre-existing and is left as-is.

**No module was found whose layout cannot be reproduced in CSS.**

## Not done

- Containers 2–6 (Learn, Research, Skills, Projects, Studio), about 1,400 baseline
  violations. Per-container verification as above is the gate for each one.
- The section `:focus-visible` comes from the global ring in tokens.css and `.btn/.chip`.
  No separate per-module focus CSS was needed.
