# Batch Z-2 / Order G: unblock the merge

| Item | Result |
|---|---|
| **G1** 2px overflow | ✅ Fixed at the source, not baselined. CI run #2 and #3: **success**. |
| **G2** delete `kv-probe` | ❌ **Not possible from here.** The Supabase MCP has no delete-function tool, and the Management API needs a personal access token I don't hold. The function is a `410 gone` stub behind `verify_jwt`. **CB:** Supabase → Edge Functions → `kv-probe` → Delete. |
| **G3** redeploy from repo | ✅ `ground-book` **v3**, `monthly-review` **v2**, both deployed with the repo's `_shared/*` verbatim. `weekly-recap` stays **v1**: it was already deployed from a script dump of the repo files, and none of its bundle files have changed since. I fetched it with `get_edge_function` and checked it against the repo; it matches. |
| **G4** ground-book exposure | ✅ Cap, cache and validation, proven live (below). |
| **G5** ready for review | ✅ Marked ready, unmerged. The PR states merge is blocked on `SUPABASE_SERVICE_ROLE_KEY`. |

## G1: root cause

The same bug appeared at 820 locally and at 390 in CI. CI loads the real Google Fonts,
which are blocked in the sandbox, so text widths differ.

1. **The ResearchHub search `<input style={{flex:1}}>` had no `min-width: 0`.** Its
   intrinsic width pushed the "🔍 Web OFF" toggle out of the row. With CI's fonts that
   came to 392px at a 390px viewport. Fixed with `min-width: 0`.
2. **`gridTemplateColumns: '1fr 280px'`** kept a fixed 280px Source Library column inside
   iPad's ~610px content area. It now uses `.rh-split` (`minmax(0,1fr)`), stacked below
   1101 and a 280px column only on desktop.
3. While here, the shared **ModeChips** became 44px on touch. The chip row scrolls
   horizontally, which clips any `::after` hit area, so the chip itself must be the
   target. All of `ContainerNav` moved to `container-nav.css`, with active state shown as
   an accent bar plus `--accent-text`.

Measured at 360 / 375 / 390 / 820 afterwards: zero elements past `.fr-main`.

The audit's `--update` had its own bug: with `AUDIT_ONLY` it wiped the baseline for views
it didn't run. It now merges, and "improved" only counts views that ran.

## G4: the cap and where it lives

- **Cap: 40 uncached lookups per UTC day** (`DAILY_CAP` in
  `supabase/functions/ground-book/index.ts`).
- **Counter:** kv row `aether_ground_quota_<YYYY-MM-DD>`, incremented **atomically** by
  `public.ground_book_consume(cap)`, a single `insert … on conflict do update … returning`.
  It is `security definer` and only `service_role` may execute it
  (`supabase/migrations/20261110030000_ground_book_quota.sql`).
- **Cache:** every result, hit or miss, goes to kv under
  `aether_ground_<title|author>|fc0|fc1`, and is served **before** the quota is touched.
  Hits are kept forever; misses expire after 7 days. The `fc` suffix records whether
  Firecrawl was available, so a miss recorded before CB adds the key can't shadow the
  real lookup afterwards.
- **Validation:** a missing, blank or >200-character title, or an author/publisher over
  120 characters, returns 400 before any spend.

### Live proof (pg_net → deployed function)

| Request | Result |
|---|---|
| `{}` | **400** `title required` |
| `{"title":"   "}` | **400** `title required` |
| 201-char title | **400** `title longer than 200 chars` |
| Chip War, first time | **200**; quota counter 0 → **1** |
| Chip War, again | **200** `cached:true`; counter stays at **1** (cost nothing) |
| counter forced to 40, new title | **429** `daily lookup cap reached (40/day)`, `used:41` |
| counter corrupted (non-integer) | **503** `quota check unavailable — refusing to spend` |

Both failure paths **fail closed**. The counter was restored to its real value (1)
afterwards.

**The anon key is still in the public repo, deliberately.** It's a public identifier, not
an authorization boundary. The protection is now in the function, as the brief asked.
