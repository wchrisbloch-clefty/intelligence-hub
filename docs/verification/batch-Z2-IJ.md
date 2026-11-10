# Batch Z-2 / Orders I and J

## I: pay down the baselined debt

**Target:** zero `contrast` and zero `tap` cells. **Result: zero cells of any kind**
(overflow, tap, CLS, contrast, 0×0, console) across all **22 views × 390/820/1280 ×
light/dark**. `scripts/audit-responsive.baseline.json` is `{}`.

| Step | responsive | tokens |
|---|---|---|
| Z-2 start | 545 | 1,432 |
| I-1: global accent-as-text codemod (`scripts/codemod-accent-text.mjs`, 306 uses in 32 files) | 433 → 226 | 1,422 → 1,397 |
| H containers + shared (see batch-Z2-H.md) | 226 → **0** | 1,397 → **28** |

**The systemic root cause.** `--accent` is a fill colour: navy `#14284B` in light and
`#2B4C85` in dark. It was used as *text* about 300 times, which measured 2.19:1 in dark.
A codemod rewrote every `color:` use and every `color={…}` prop to `--accent-text`;
fills were left alone. That one sweep halved the debt before any container was touched.

**The tap-target root cause.** Shared mode chips were 36px and sat inside a horizontal
scroller, which clips the `.tap ::after` hit area. They're now a real 44px on touch.
Each container did the same for its own scrollers.

**Two regressions the gate caught during the work, both fixed at the source:**

- **What's Happening CLS 0.11 at iPad.** The feed grew past the viewport, `.fr-main`
  gained a scrollbar, the column narrowed, and every card reflowed. Fixed with
  `scrollbar-gutter: stable` on the app's main scroller.
- **ChatPanel** called `scrollIntoView` on mount, which scrolls every ancestor including
  the `overflow:hidden` shell. It now scrolls only its own pane, and only when open.

**Token debt left:** 28 violations, all in `CoachAI.jsx`. It is unrouted and retained
per CLAUDE.md.

## J1: the Google Books request storm

- `src/lib/bookVerify.js`:
  - every catalog call goes through one queue (≤2 in flight, 350ms spacing);
  - the first 429 opens a 60s circuit breaker;
  - `verifyBookCached` stores definitive results in kv (`aether_bookverify_v1`), so a
    device, and every other device, pays once;
  - rate-limited and network misses are **not** cached.
- **BookClub backfill:** on a 429 it stops, leaves those books untried (they retry
  later), and shows `SectionError` ("Couldn't load catalog details · Retry"). It never
  shows a silent empty shelf or a fabricated record. A rate-limited book is
  `unverified`, never "does not exist".
- **Measured** in a real browser, with Google Books and Open Library forced to 429: a
  fresh mount made **2 catalog requests**, down from about 36, and the error row shows
  (`docs/screens/batch-Z2-J1-ratelimited-390.png`).
- `scripts/verify-catalog-throttle.mjs` runs 9 checks against the real module:
  - peak concurrency stays at 2;
  - a repeat lookup is served from cache with zero network calls;
  - the breaker stops a 12-lookup storm after 2 calls;
  - rate-limited lookups are not cached and return no fabricated record.

## J2: the 340px rail, actually rendered

- `shared/PageWithRail` puts `main | var(--rail-width)` side by side at ≥1101, with the
  rail sticky. Under 1101 the rail stacks below main, as `docs/RESPONSIVE.md` describes.
- `shared/ProvenancePanel` is the tier legend, and a rail occupant.
- **Home:** the rail holds Connected Knowledge and the ProvenancePanel
  (`docs/screens/batch-Z2-J2-home-rail-*`).
- **Research:** the rail holds the Source Library and the ProvenancePanel.
- **What's Happening:** the rail holds Trending Now and Today's Topics. The old JS-sized
  280px column is gone.
