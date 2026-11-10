# Batch Z / Order F: verification

## What landed

- **`scripts/audit-responsive.mjs`**, run as `npm run audit:responsive`. It drives a
  real Chromium (Playwright) through **9 views × 390 / 820 / 1280 × light / dark** (54
  page loads) and fails on:
  - document or `.fr-main` horizontal overflow, plus interactive elements clipped
    off-screen;
  - any interactive element whose **hit area** is under 44px on coarse-pointer widths
    (390, 820). The `.tap` `::after` extension counts toward the hit area.
  - **CLS > 0.05** on first load;
  - **contrast below 4.5:1** on text in either theme (3:1 for large text, per WCAG
    1.4.3; disabled controls exempt);
  - **0×0** rendering of nav items, Home sections, or labelled buttons and links;
  - console and page errors from the app (third-party resource failures excluded).
- **Views:** Home, `/design`, and each container's default mode (feed, learn, books,
  research, skills, projects, studio), reached by a new `?mode=<id>` deep link (one line
  in `App.jsx`).
- **Ratchet:** `scripts/audit-responsive.baseline.json`. A count may only go down.
  `--update` refuses to raise a count or add a new cell.
- **CI:** `.github/workflows/ci.yml`. The `build` job runs gen-prompts check →
  edge-sync check → check-tokens → vite, then `verify:prompts`. The `responsive` job
  runs the Playwright audit. **This repo had no CI workflow before this.**

## First full sweep (served by `scripts/serve-local.mjs`)

Totals across 3 widths × 2 themes per view:

| view | overflow | tap <44 | CLS>0.05 | contrast | 0×0 | console |
|---|---|---|---|---|---|---|
| **home** | 0 | 0 | 0 | 0 | 0 | 0 |
| **design** | 0 | 0 | 0 | 0 | 0 | 0 |
| feed | 0 | 92 | 0 | 15 | 0 | 0 |
| learn | 0 | 36 | 0 | 36 | 0 | 0 |
| books | 0 | 94 | 0 | 105 | 0 | 0 |
| research | **2** | 22 | 0 | 81 | 0 | 0 |
| skills | 0 | 24 | 0 | 3 | 0 | 0 |
| projects | 0 | 8 | 0 | 18 | 0 | 0 |
| studio | 0 | 0 | 0 | 9 | 0 | 0 |

**Home and /design are held at zero.** Everything else is the debt of the five
containers Order C has not reached yet. It's baselined, so nothing can get worse while
they're extracted one at a time.

## Bugs the gate caught, fixed in this order

1. **Dark-mode active navigation was 2.19:1.** The navy dark accent `#2B4C85` was used
   as *text*: `T.accent` / `var(--accent)` on the active nav item, the mode chip and the
   More sheet. `--accent` is a fill colour; text uses `--accent-text` (`#9DB7E6`, 9.16:1).
   Fixed in `ContainerNav.jsx`. **This is systemic.** About 111 `var(--accent)` / `T.accent`
   call sites use the accent as a text colour, and in dark mode every one of them fails
   contrast. They account for much of the contrast debt above, and are fixed per container
   in Order C.
2. The top-bar ↵ hint was 4.47:1, now `--text-muted`.
3. `/design`'s loading-state primary button was 3.0:1.
4. `/design` CLS was **0.60–0.66**: the swatches populated after mount. Token discovery
   now runs synchronously, so the first paint is complete.

## Found, not fixed (flagged)

- **Books fires ~20 Google Books requests per mount when nothing is cached** (the
  retroactive backfill). In the sandbox that produced HTTP **429 Too Many Requests**. The
  `backfillTried` flag stops repeats once persisted, but a fresh device or an empty store
  (exactly the state after the Order B cutover, before the migration runs) bursts the
  whole library. Worth staggering or moving into `ground-book` server-side.
- `research` has **2 overflow cells**: an off-screen control at one width. It's caught
  and baselined, not yet diagnosed.

## Not done

- The gate has not run in GitHub Actions yet. The workflow is committed and fires on the
  PR. Locally the full sweep takes ~5 minutes.
