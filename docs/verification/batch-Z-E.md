# Batch Z / Order E: verification

## Headline

**The plumbing is live and verified. The content is not, yet.** Both recap functions
are deployed, scheduled, and pass their 401 negative tests. `ground-book` is deployed
and ran live against Open Library and the Library of Congress. Three things are owed,
and each needs a key only CB can enter:

- a real recap rendered on Home (needs `ANTHROPIC_API_KEY`);
- a book guide regenerated from a retrieved TOC (needs a TOC to be found);
- Firecrawl actually firing (needs `FIRECRAWL_API_KEY`).

## The brief's premise, corrected

The brief says the recap functions "have existed since PR #7 and have never run". In
this repo they **had been ported to Vercel Cron in PR #11** (`api/weekly-recap.js`,
`api/monthly-review.js`). And `RecapCard` was **already read by the `recaps` mode** in
Skills (`Recaps.jsx`), so "nothing reads them" was also off. What was still true: they
read Upstash, which Order B retires, and nothing on Home showed them.

E therefore **moved** them to Supabase and **deleted** the Vercel versions plus the
`crons` block, so there is one scheduler and no double writes. That moves the Vercel
function count from **12 to 10**.

## E1: recap functions on Supabase (`ujywrlbuwecitwkvzohb`)

| Item | Where |
|---|---|
| Functions | `supabase/functions/weekly-recap/index.ts`, `supabase/functions/monthly-review/index.ts` (`verify_jwt = false`, `supabase/config.toml`) |
| Same store as the app | `_shared/kv.js`, generated from `api/_kv.js` by `scripts/sync-edge-shared.mjs`; `npm run build` fails if it drifts |
| Prompt builders | `_shared/recap-core.js`, ported verbatim. System prompt is LENS + SUBJECT_FIDELITY (Order D). The weekly "tied to his goals (passive income, real estate, BD…)" now lists the five domain areas as peers. |
| Gate | `x-cron-secret`, checked by `public.verify_cron_secret()` against Vault `cron_secret` |
| Schedules | `supabase/migrations/20261110020000_recap_schedules.sql`: `weekly-recap 0 13 * * 5`, `monthly-review 0 14 1 * *` (UTC) |

**About the secret.** It was **generated inside Postgres**
(`vault.create_secret(gen_random_bytes(32))`) and has never been displayed, typed or
logged. pg_cron reads it at fire time. Only `service_role` can execute the verify RPC:
`has_function_privilege` returns anon = false, authenticated = false, service_role = true.

### Smoke tests, run BEFORE scheduling (via `pg_net` from inside the database)

| Call | weekly-recap | monthly-review |
|---|---|---|
| no `x-cron-secret` | **401** `{"ok":false,"error":"Unauthorized"}` | **401** |
| wrong secret | **401** | n/a |
| Vault secret | **200** `{"ok":false,"degraded":true,"needsKey":"ANTHROPIC_API_KEY","readKeys":[]}` | **200**, same |

An unauthenticated call returns 401, so the endpoints are not publicly triggerable. The
authorised call degrades honestly: no `ANTHROPIC_API_KEY` is set as an Edge secret, so
it returns `needsKey` and **does not overwrite** the previous recap. `readKeys: []`
because `kv` is still empty until the Order B migration runs. **No kv rows were written
by the recaps.**

**Deployed bundles vs repo.** `weekly-recap` was deployed with the repo's shared files
verbatim. `monthly-review` and `ground-book` were deployed with trimmed copies of
`_shared/*` (comments and unused exports removed; logic identical), because of
payload size through the deploy tool. Redeploy from the repo with
`supabase functions deploy` to make them byte-identical.

## E2: RecapCard on Home

- New Home section `recap` (`src/modules/home/sections.js`) renders the shared
  `RecapCard`. That card was rewritten on `SectionState`: `loading` →
  `SectionSkeleton`, `error` → `SectionError` (Retry re-fetches only the recaps),
  `empty` → `SectionEmpty` ("No friday recap yet · Weekly · Fridays. The scheduled agent
  writes it…"). It's tokens-only (`recap-card.css`), with `check-tokens` 7 → 0.
- Still mounted in Skills → Recaps.
- Screens:
  - `docs/screens/batch-Z-E-recapcard-empty-{390,1280}.png` is the **real** state today
    (`data-status="empty"`).
  - `docs/screens/batch-Z-E-recapcard-fixture-{390,1280}.png` uses a **FIXTURE** recap
    injected into localStorage, labelled "FIXTURE — not model output" in the render.
    It proves the ready path renders; it is **not** a real recap.

## E3: `ground-book`

`supabase/functions/ground-book/index.ts` runs **Open Library**, then the **Library of
Congress** MARC 505, then **Firecrawl**, which is restricted to the publisher's own
domain, with a retail blocklist (Amazon, B&N, Bookshop, Kobo, Apple and others are
refused). It returns the **tri-state** (`verified+contents` / `verified-exists-only` /
`unverified`) plus every attempt. Resolved books are cached permanently in `kv`
(`aether_ground_*`).

Client: `src/lib/groundBook.js`. `retrieveTOC` calls it first. **loc.gov is no longer
fetched through the browser proxy chain**: if the server is unreachable, only
CORS-friendly Open Library runs client-side. `fetchRaw` remains in utils for
`fetchArticle`.

### Live run, real catalogs (Supabase egress; the sandbox can't reach them)

| Book | state | Attempts |
|---|---|---|
| The Way of Excellence / Stulberg | **verified-exists-only** | Open Library: 1 work, 1 edition, no TOC · LoC: **timed out at 12s** · Firecrawl: unavailable (no key) |
| Chip War / Miller | **verified-exists-only** | Open Library: 1 work, 6 editions, no TOC · LoC: 5 results, no 505 note · Firecrawl: unavailable |
| a nonexistent title | **unverified** | 0 works · 0 results |
| no Authorization header | **401** `UNAUTHORIZED_NO_AUTH_HEADER` | n/a |

The tri-state does what it must. A real book with no retrievable contents is
**`verified-exists-only`**, never "doesn't exist", and only the fake title is
`unverified`.

**No TOC was retrieved live for either book**, so "one book guide regenerated through
ground-book with its retrieved TOC shown" is **NOT done**. The publisher route is the
missing piece, because it needs `FIRECRAWL_API_KEY`. Open Library lists The Way of
Excellence under "Allen & Unwin" (an ANZ co-publisher), not Kings Road. That mapping is
added in the repo (`allen & unwin` → `allenandunwin.com`) but **not in the deployed
bundle**.

## Owed (CB)

1. Supabase → Edge Functions → Secrets: add `ANTHROPIC_API_KEY` and `FIRECRAWL_API_KEY`.
2. Redeploy from the repo: `supabase functions deploy weekly-recap monthly-review
   ground-book`.
3. Run the B migration so `kv` holds real data, then trigger a recap once:
   `select net.http_post(... weekly-recap ..., x-cron-secret from vault)`, as in the
   schedule migration. Confirm `weekly_recap_latest` appears in `kv` and on Home.
4. Books → The Way of Excellence → "Search harder" and confirm the retrieved chapter
   list shows, then regenerate the guide.
5. Delete the retired `kv-probe` function from the dashboard.
