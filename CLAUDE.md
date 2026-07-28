# Intelligence Hub — working notes

"The Film Room" — a Vite + React SPA with Vercel serverless functions in `/api`,
deployed on Vercel. Single user (CB).

## Repo facts / gotchas (each of these has cost real time — read before working)

- **Branch from `main`, always.** The GitHub **default branch is
  `aether-hub-export`, ~76 commits behind `main`** and effectively a different,
  older app. Cloning gives you the stale default — `git checkout main` first.
  (PR #7 was built off the stale default and needed cherry-pick surgery to
  recover.) All PRs target `main`.
- **Canonical checkout is `~/hub`.** Four stale clones exist under
  `/Users/mallorykaufman/` — don't use them. **`~/Desktop/intelligence-hub` has
  unpushed local work — do not touch it.**
- **Persistence is Upstash Redis via `/api/storage`**, keys prefixed `aether_*`.
  **Not Supabase.** `api/_lib.js` reads creds as
  `process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL` (same
  fallback for the token) — mirror that anywhere credentials are read.
- **Auth is an `ACCESS_CODE` cookie gate.** Server routes sit behind
  `requireAuth` (`api/_lib.js`); anything calling `/api/storage` from outside the
  browser (e.g. a cron job) will 401. Scheduled functions read Upstash directly
  instead.
- **Theme is a CSS-variable token system** in `index.html` (`:root` +
  `[data-theme="dark"]`) plus `src/theme.js` (the `T` token bridge / `withAlpha`).
  **No hardcoded hex** — a 405-replacement codemod (`scripts/migrate-colors.mjs`)
  removed it all. Use tokens, never raw hex.

## Scheduled recaps + editable library + storage honesty

Three-part effort. **Sequencing matters: storage layer (Part 3) → book library
(Part 2); Part 2 depends on Part 3's error reporting. Part 1 is independent.**

### PART 1 — Recap schedule on Vercel Cron  ✅ DONE (merged, PR #11)
The recap Edge Functions only used Supabase as a scheduler (PR #9 pointed them at
Upstash); Vercel already has Cron. Ported `supabase/functions/{weekly-recap,
monthly-review}` → `api/weekly-recap.js` / `api/monthly-review.js` (Node,
GET-only, `Authorization: Bearer ${CRON_SECRET}`, `maxDuration: 300`), shared
helpers in `api/_recap.js` (reusing `_lib.js`'s `store`), crons in `vercel.json`
(`0 13 * * 5`, `0 14 1 * *`), and the whole `supabase/` directory deleted.
**Do not rebuild this.**

### PART 2 — Fully editable book library
Stored `aether_bookclub` is the single source of truth; `KNOWN_BOOKS` (20 entries
in `src/constants.js`) is only a seed.
- Seed on first BookClub mount if never initialized (tag each `builtin: true`).
- Migrate custom-only libraries by **merging** the seed in (dedupe on lowercased
  `title+author`); never overwrite. Guard with an `aether_bookclub_seeded` flag
  so it can't double-seed or resurrect a deleted built-in.
- Full CRUD for every book incl. built-ins; edit reuses the add form, prefilled.
- Confirm before delete; "Restore default library" re-adds only missing built-ins.
- Colour by `type` via a token map (`src/theme.js` tier + accent tokens, no hex).
- Uses Part 3's write reporting: **await `writeThrough`, show an inline error on
  failure** (reference implementation).

### PART 3 — Stop the storage layer from lying  (build FIRST)
Root cause behind the reported "vanishing" bugs; fix in the layer, not per module
(it touches 11 files). Previously `storage.set` swallowed everything but 401, and
`writeThrough` was fire-and-forget — a whole session of 503s looked identical to
a healthy one.
- `storage.set` / `delete` return `{ ok:true }` | `{ ok:false, code, status }`,
  keeping the optimistic local write. 401 → auth flow; **503 `no_storage` →
  `local-only`** (expected); **5xx / network → `error`**; success → `synced`.
- Module-level sync state in `src/lib/storage.js` (`getSyncStatus` /
  `subscribeSync`).
- `writeThrough` returns the promise (`{ localOk, ...serverResult }`) so callers
  can await; the other 10 fire-and-forget call sites keep working unchanged.
- One global indicator in `TopBar.jsx` — caution chip for `local-only`, negative
  chip for `error`, hidden when `synced`. Uses `--caution` / `--negative`.
- BookClub is the reference consumer; the other 10 call sites are left alone —
  the global chip already covers them (`ContentInbox`, `MasteryVault`,
  `DecisionLog`, `QuizCenter`, `ResearchHub`, `lib/deepdives.js`, `lib/reviews.js`,
  `lib/ladders.js`, `lib/sessions.js`).
