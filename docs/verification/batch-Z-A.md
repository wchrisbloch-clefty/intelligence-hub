# Batch Z / Order A: verification

## What landed

| Item | Where | Check |
|---|---|---|
| A1 token contract | `src/styles/tokens.css`, imported once from `src/main.jsx` (the real entry; `src/index.jsx` is unused dead code) | `grep -n "tokens.css" src/main.jsx` |
| Navy accent `#14284B` / `#2B4C85` | tokens.css | `grep -n "1B5FD9" -r src index.html` returns nothing |
| `--tier-reported: var(--accent-text)` | tokens.css (both themes) | grep |
| Legacy aliases (`--ink --chalk --bg --dim --text-b --gold` …) | tokens.css, rule `:root, [data-theme]` | `/design` lists them resolved |
| Inline theme bootstrap kept, `<style>` removed | `index.html` | `grep -c "<style" index.html` gives 0 |
| CSS-only shell | `.fr-shell/.fr-body/.fr-sidebar/.fr-main/.fr-tabbar` in tokens.css; `App.jsx` renders both navs | `grep -n "fr-sidebar" src/App.jsx` |
| A2 `SectionSkeleton / SectionError / SectionEmpty / SectionState` | `src/modules/shared/SectionState.jsx` + `section-state.css` | |
| `data-status` on the 7 full-rigor surfaces | BookClub, DeepDive, LearningCenter, FieldManual, ResearchHub, TEDHub, PodcastHub | `grep -l "data-status" -r src/modules` |
| A3 `?debug=1` overlay + Copy report | `src/modules/debug/` (lazy chunk; zero cost when off) | |
| Build id = git SHA | `vite.config.js` `__BUILD_ID__` (`VERCEL_GIT_COMMIT_SHA` on Vercel) | |
| A4 `/design` | `src/modules/design/DesignPage.jsx`, routed in `src/main.jsx` outside the AuthGate (renders no user data) | |
| A5 docs | `docs/RESPONSIVE.md`, `docs/ENVIRONMENT.md`, `docs/device-checklist.md` | |

## How it was verified

- `npx vite build` passes.
- `/design` driven in headless Chromium at 390×844, 820×1180 and 1280×800, in light and
  dark. Document `scrollWidth == innerWidth` at all six (no horizontal overflow), and zero
  console errors. Each panel discovers 58 colour tokens from the loaded stylesheet; none
  of them is hand-listed.
- A real bug was caught and fixed here. On the first pass, legacy aliases inside the dark
  panel resolved to LIGHT values, because a `var()` chain declared on `:root` is computed
  once at the root and inherited. Aliases now live in their own `:root, [data-theme]` rule,
  so they re-resolve wherever `data-theme` is set. In the real app `data-theme` sits on
  `<html>`, so production was never affected; the nested `/design` panels were.
- Screens (light and dark at each width):
  `docs/screens/batch-Z-A-design-{390,820,1280}-{light,dark}.png`
- Home under `?debug=1` at 390 (served by `scripts/serve-local.mjs`, a stubbed `/api` for
  headless runs): `docs/screens/batch-Z-A-debug-home-390.png`

## `?debug=1` Copy report: one load of Home, 390×844, coarse pointer

The `/api/*` responses are the local stub, not production.

```json
{
  "build": "82e39e8",
  "builtAt": "2026-11-10T01:25:36Z",
  "t": "2026-11-10T01:26:34.068Z",
  "url": "/?debug=1",
  "viewport": {
    "w": 390,
    "h": 844,
    "dpr": 1
  },
  "pointer": "coarse",
  "theme": "light",
  "ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36",
  "appRenders": 2,
  "appRendersPerSec": 0,
  "renders": {
    "App": 2
  },
  "cls": 0.0256,
  "scrollJumps": 0,
  "lastJumpPx": 0,
  "longFrames": 0,
  "headerHeight": 55,
  "docOverflowX": false,
  "controlsUnder44": 17,
  "controlsUnder44Samples": [
    "input 67×20 \"\"",
    "button 34×34 \"\"",
    "button 34×34 \"\"",
    "button 34×34 \"\"",
    "button 40×34 \"\"",
    "button 120×36 \"Customize\"",
    "button 50×43 \"→\"",
    "button 332×14 \"Daily Brief\""
  ],
  "network60s": [
    {
      "method": "GET",
      "path": "/api/auth",
      "status": 200,
      "ms": 4
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 16
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 16
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 18
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 15
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 12
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 11
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 14
    },
    {
      "method": "GET",
      "path": "/api/storage",
      "status": 200,
      "ms": 19
    },
    {
      "method": "GET",
      "path": "/api/youtube",
      "status": 200,
      "ms": 19
    },
    {
      "method": "POST",
      "path": "/api/chat",
      "status": 200,
      "ms": 4
    }
  ]
}
```

What the report already tells us: **17 controls under 44px** on phone Home, and CLS
0.0256 on first load (under the 0.05 budget). The sub-44 controls are what Order C fixes,
container by container.

## Chosen not to do / deviations

- **No rail content exists.** The 1280 contract has a 340px rail (`--rail-width`), but
  no module renders rail content today, so the shell does not reserve an empty column.
  The token is defined, ready for the first module that needs it.
- **Page cap is now `--container-page` (76rem = 1216px)**, per the contract. It was 1280px.
- **The new light `--background` is `#FFFFFF`**, the same as `--surface`. Cards now read
  by hairline, not by a tinted page. This is a deliberate visual change from `#F7F8FA`.
- **Shadows.** `--shadow-sm` and `--shadow-md` resolve to `none`, and `glow` keyframes no
  longer glow. `.shimmer` is now a flat fill with an opacity breath, not a gradient.
- **Hardcoded hex still exists in module inline styles.** The old gold `#D9A441`, plus
  `#C4553D` and `#000`, remain in ProjectsOS, ContentInbox, GrowthTools, TranslatorHub,
  LearningCenter and MasteryVault, despite CLAUDE.md saying it was all removed. Order C's
  `check-tokens` guardrail baselines these, and they die file by file.
