# Batch Z-3 — L1 (typed TOC) + L2 (scored catalog records)

Live: ground-book **v7** (Supabase `ujywrlbuwecitwkvzohb`), invoked via `pg_net`
with the public anon key, cache key `…|fc1|v4`, 2026-11-15.

## L1 — typed breakdown (live)

| Book | Source record | front | part | chapter | back |
|---|---|---|---|---|---|
| The Way of Excellence | Schlow (VuFind), OCLC 1518267059 | 1 | 2 | **19** | 4 |
| Never Split the Difference | Texas A&M (VuFind) | 0 | 0 | 10 | 0 |
| Chip War | Evergreen Indiana (Aspen), OCLC on1296942188 | 0 | 8 | 54 | 0 |

Excellence back = Conclusion + Appendix 1–3. Apparatus (Acknowledgments, Notes) is
dropped from the typed view; `raw505` keeps the record verbatim.

App (Playwright, seeded Excellence TOC, 390 light / 1280 dark): 19 Dive buttons,
2 Part group headings, 5 non-divable front/back rows, count "0/19 chapters dived",
a legacy flat-index progress key (6 = "Care") resolves to the right chapter, no
overflow, no console errors. `AUDIT_ONLY=books npm run audit:responsive` → 0.
Screenshots: `z3-toc-390-light.png`, `z3-toc-1280-dark.png`.

## L2 — candidate scoring (live)

`score505 = chapters + 3·marker-types − 3·run-together headers − 2·stray-quote pieces − 2·implausible lengths`

**Chip War** (2 records scored, 5 other-book "similar items" pages skipped before scraping):

| Record | via | score | chapters | notes |
|---|---|---|---|---|
| **camden.evergreenindiana.org** | Aspen JSON staff view | **34** | 54 | LC copy; "Intel's revolutionaries", "Apple silicon" as published; 1 stray quote |
| search.schlowlibrary.org | VuFind /Details | 31 | 53 | local typos; 2 stray-quote pieces (`: --` inside quotes) |

Both carry the master record's duplicate "Part II" — passed through. The scorer
picks Evergreen on STRUCTURE (more chapters, fewer stray quotes); it does not and
cannot detect spelling — that the cleaner record is also the correctly spelled one
is a consequence of it being LC copy, not something the score measured.

**Never Split the Difference**: TAMU, OCLS (Aspen), Villanova all score 10 (10
chapters, identical); Nashville and Spark PA have no 505.
**The Way of Excellence**: Schlow 25; Nashville and Blanchester (Aspen) have no 505.

## Our-split repairs (and what was left alone)

- Run-together `Part I: Cold war chips. From steel to silicon` → part + chapter
  (7 of Chip War's 8 part headers; also `? "<quoted chapter>"`).
- ` -- ` inside a quoted span re-joined (Schlow's `"All people must make
  semiconductors: -- Sharing God's love with the Chinese"`).
- NOT touched: source typos, the duplicate "Part II", Evergreen's trailing stray
  quote on `Sharing God's love with the Chinese"`.
