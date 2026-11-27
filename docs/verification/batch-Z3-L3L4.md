# Batch Z-3 — L3 (pre-warm the library) + L4 (CoachAI to zero)

## L3 — what changed before spending anything

Pre-warming the 20 seed titles as written would have cached entries nothing reads:
1. Auto-retrieval only ran for **post-cutoff** books — none of the built-ins.
2. The cache key was the **raw title**, but the app sends the short shelf title
   until the catalog backfill swaps in the full one ("The Coffee Bean: A Simple
   Lesson…") — a different key.
3. The library is not the seed: *Winning* is Tim Grover's in CB's library.

Fixes (ground-book v8→v9, BookClub): cache key = **book identity** (main title
before ":", leading article dropped, + author surname); record matching uses the
same identity; the app asks the ground-book server for ANY book with no TOC on
open (cache-first — free once warmed; the paid web pass stays post-cutoff only).

**Found while running it:** 6 parallel lookups tripped Firecrawl's rate limit (429)
and ground-book cached those throttled misses for 7 days. v9: a miss caused by a
transient failure is returned `retryable` and NOT cached; record fetches run 2 at a
time. The 3 throttled misses were cleared and re-run one at a time: 2 recovered.

## L3 — the 20 built-ins (CB's library as stored), live, cached

| Book | Result | Source | front · part · chapter · back |
|---|---|---|---|
| Chip War | contents | Evergreen Indiana (Aspen) | 0 · 8 · 54 · 0 |
| Never Split the Difference | contents | Texas A&M (VuFind) | 0 · 0 · 10 · 0 |
| Extreme Ownership | contents | Open Library | 0 · 3 · 13 · 0 |
| The New Map | contents (after retry) | Free Library of Philadelphia | 1 · 0 · 6 · 1 |
| The Tipping Point | contents | Free Library of Philadelphia | 0 · 0 · 7 · 1 |
| Greenlights | contents | Free Library of Philadelphia | 0 · 0 · 8 · 0 |
| Essays of Warren Buffett | contents | Open Library | 0 · 0 · 9 · 0 |
| Influence | contents | Free Library of Philadelphia | 0 · 0 · 9 · 0 |
| A Life Well Played | contents | Schlow | 0 · 0 · 4 · 0 |
| Thinking Fast and Slow | contents (after retry) | Schlow | 0 · 0 · 34 · 0 |
| Winning (Tim Grover) | exists, no contents | — no catalog record found (2 other-book pages skipped) | |
| Fortitude | exists, no contents | records found, none carry a 505 | |
| Coffee Bean | exists, no contents | no catalog record found | |
| 7 Habits of Highly Effective People | exists, no contents | records found (Schlow, RVC), none carry a 505 | |
| Tools of Titans | exists, no contents | Schlow 505 lists only the 3 parts — 0 chapters, correctly not a chapter list | |
| Transfluence | exists, no contents | no catalog record found (small press) | |
| The Snowball Effect | **unverified** | **shelf title is wrong** — the book is *The Snowball: Warren Buffett and the Business of Life*; the matcher correctly refuses it | |
| Power of Positive Leadership | exists, no contents | no catalog record found | |
| Laws of Human Nature | exists, no contents | no catalog record found (3 other-book pages skipped) | |
| Man's Search for Meaning | exists, no contents | 505 has 2 entries (the book's two parts) — below the 3-chapter minimum | |

**10 of 20 resolved.** Also cached: The Way of Excellence (19 chapters).
Spend: 18 lookups on 2026-11-26 + 3 retries on 2026-11-27 — under the 40/day cap
both days; the cap was never bypassed. Every result above is cached; a repeat
lookup costs nothing.

Rejected-record reasons seen across the run: "no 505" (record exists, no
contents note), "245/100 is a different book" (Schlow's *Influence* hit was
another title), other-book "similar items" pages skipped before scraping, and
Aspen hosts that returned HTML instead of the JSON staff view (owwl, Wake County).

## L4 — CoachAI.jsx 28 → 0

All coloured inline styles moved to co-located `coach-ai.css` (`ca-` prefix,
`[data-on]` selected state). The last literal colours in the repo — the gold
`rgba(217,164,65,…)` tints — are now `color-mix()` over `--accent`. The send button
is `--accent-foreground` on `--accent` (was `T.canvas`). The JS-sized tone grid and
textarea are CSS media queries. Clickable `<div>`s became `<button>`s with 44px
targets. `check-tokens.baseline.json` is now `{}`.
CoachAI is unrouted, so `vite build` doesn't include it: it was compiled directly
with esbuild (clean) but has NOT been rendered — no route reaches it.
