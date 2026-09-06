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
- **AI provider cascade lives in `api/_providers.js`** (`callAI` + `JOB_ORDER`,
  exposed via `/api/health`). Gotchas that cost real time:
  **(0) A 404 from a provider almost always means a RETIRED MODEL, not a bad key.**
  Three vendors retired a model on us in one week (Groq's Llama tier → Enterprise,
  Gemini `2.5-flash` → `3.6-flash`, …). **Every model ID lives in one place — the
  exported `MODELS` registry in `api/_providers.js`, one line each with the date
  last confirmed working.** On a 404: check `/api/health` first (it does a live
  call per provider and shows the upstream error message, which usually names the
  replacement model), then update the ID + date in `MODELS`. Nothing else
  hardcodes a model string.
  **(1) Groq's free Llama tier moved to Enterprise / Contact Sales** — `llama-3.3-70b-versatile`
  and `llama-3.1-8b-instant` now 404. Use the **open** models `openai/gpt-oss-120b`
  (groq70) and `openai/gpt-oss-20b` (groq8); they allow 65,536 output tokens.
  **(2) Health probes must resemble real workloads or they give false confidence.**
  A tiny `/api/health` ping passed while a real 6000-token study guide timed out,
  because timeouts are per-job: `timeoutFor('reason')` is 290s (just under the
  routes' `maxDuration: 300`), not the 15–55s the short jobs use. Health therefore
  reports each provider's `durationMs`, its `reasonTimeoutMs` budget, and
  `budgetOkForReason` — never trust a green probe alone. `reason` (study
  guides/deep dives/recaps) leads with Claude for quality; the volume jobs
  (default/fast/web/contrast) lead with Groq for cost; Claude is the final
  fallback in every chain. Re-routing is a one-line edit in `JOB_ORDER`.
- **Cached AI artifacts stamp a prompt version** (`src/lib/promptVersion.js`,
  `PROMPT_VERSION` per type). A guide/dive/ladder records the `promptVersion` +
  `generatedAt` it was built with; surfaces compare against the current version
  (`isStale`) and show `versionLabel` ("generated <date> · v<n>") with one-tap
  regenerate rather than silently serving output from an older prompt — a post-#29
  guide had exported byte-identical to the pre-#29 one because nothing
  invalidated. **Bump the type's number whenever its generation prompt changes.**
  Academy packs are static data and carry their own `version`/`lastVerified`.
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
- **Type + space scale** live in `index.html` `:root`: `--fs-xs…--fs-3xl`
  (fluid `clamp()`, body is `--fs-base`), `--lh-tight/ui/read`, and an 8px
  space ramp `--s1…--s8` (s2=8px … s8=48px). **No inline pixel `fontSize`** —
  a codemod (`scripts/migrate-fontsize.mjs`) swept them all to `--fs-*`; use the
  tokens. Eyebrow labels (uppercase + letter-spaced kickers) are the one thing
  allowed below 13px and are left as small literals.

## Home feed rebuild + What's Happening + Notes (later phase)

- **Home is a renderer over a section registry** (`src/modules/home/sections.js`
  → `SECTIONS`). Each section (`DailyBrief`, `OpportunityCards`, `SignalFeed`,
  `ActiveProjects`, `SkillSnapshot`, `ConnectedKnowledge`) is a self-contained
  file in `src/modules/home/`. `HomeDashboard.jsx` renders them with per-section
  **collapse + Customize** (reorder via up/down, show/hide, reset), persisted to
  **`aether_home_layout`** through awaited `writeThrough`. The mastery radar is
  gone from Home (lives in GrowthTools); **RecapCard moved to a `recaps` mode in
  the Skills container** (`Recaps.jsx`, still reads `weekly_recap_latest` /
  `monthly_review_latest`).
- **Blue Ocean signals are personal, not hardcoded** (`src/lib/signals.js`,
  `home/OpportunityCards.jsx`, `home/SignalCard.jsx`). The old `OpportunityCards`
  rendered a fixed six-category list and read no user context. Now: **domains are
  user-owned** (`aether_signal_domains_v1` — add/rename/archive/weight + an
  optional one-line *thesis* in the user's words, seeded from the original six).
  **`buildSignalContext()`** composes the graph (top concepts by observation +
  recent movement), skills (levels/trends/**decaying**), active projects,
  **dismissals** (feed `aether_feed_dismissed_meta` + the signal feedback store —
  negative signal, previously discarded), and the domain weights/theses.
  **`buildSignalPrompt`** asks for 4–6 signals, each **typed** (adjacent / gap /
  **convergence** / decay / **contrarian** — the last two are the personal-only
  moves), each with a **traceable one-line reason** (cite a specific number/skill/
  project/thesis — a reasonless signal is dropped in `parseSignals`), each with a
  routed **next action** (deepdive / book / project / ladder → `applyRoute`; `book`
  pre-fills BookClub's add form), tiered via `TIER_INSTRUCTION` and generated with
  **`job:'web'`** for market claims — `parseSignals` **clamps verified→reported**
  (this surface never retrieves primary text). Signals are **cached + versioned**
  (`aether_signals_v1`, `stampVersion('signals')`) — a weekly-briefing Generate/
  Refresh, not a per-load slot machine — and every card carries a **pursue /
  not-now / not-relevant** loop (`aether_signal_feedback_v1`) fed back into the
  next generation. **Honest empty state:** a thin graph (<6 concepts) says
  "signals get sharper as the graph fills — N tracked so far" rather than
  fabricating personalization. (Live web egress is blocked in the sandbox — the
  domain/context/prompt/parse logic is verified against seeded fixtures/mocks; the
  live `job:'web'` generation was NOT exercised from here.)
- **Tracked topics — a learning layer** (`src/lib/topics.js`,
  `shared/FollowButton.jsx`). A topic is narrower than a domain, more explicit than
  an auto-logged graph concept — something the user is CURRENTLY interested in.
  Followed in one tap from anywhere (`<FollowButton name source />` — a signal
  card, a feed item, a deep dive, a research thread), stored on
  **`aether_topics_v1`** (`{id,name,source,followedAt,lastActivity}`). Topics feed
  `buildSignalContext()` alongside domains — a followed topic weights signals
  toward it. `matchItems(feedItems, topicText, tags)` (token overlap, stop-words
  dropped) is the shared matcher, reused by live research threads. Managed in
  OpportunityCards' Domains panel with **last-activity + unfollow**, and a stale
  prompt ("no activity in N days — still following?", `isStaleTopic`, 30-day
  horizon) — a stale topic list is worse than none.
- **Research threads connect to live** (`ResearchHub.jsx`) — a thread declares a
  topic; matching feed items (`getFeed` from `adapters.js`, filtered by
  `matchItems`) are pulled in automatically on open and on **Refresh**. A
  per-thread watermark (**`aether_research_seen_v1`**, same pattern as
  `aether_feed_seen`) drives an **unread "N new" badge** on the thread card and a
  **"New since last visit" divider** inside. Pulled items show **source + tier**
  and are **Ask** (`AskChip type=feed`), **Dive** (`applyRoute deepdive`), and
  **Keep** (`logConcept` with the outlet as source, the thread as ref) in place.
  The thread topic is followable (`FollowButton`), so following a topic and
  researching it are the same act. (Live `getFeed` here returns adapter/mock
  posts; the curated-news matching was verified against seeded items — the live
  adapter fetch is egress-blocked in the sandbox.)
- **7th container: What's Happening** (`feed`, `WhatsHappening.jsx`) — a "what
  changed" surface: WHAT CHANGED header + live/cached state + Work/Personal/Both
  lens, a `DISCOVERY` panel ("you may be missing this"), filter chips + density
  toggle, a tiered feed (monogram, `--tier-*` chip — never engagement-derived —
  4 actions: Dive deeper / Explore / Ask / Dismiss), a TRENDING NOW + TODAY'S
  TOPICS rail (below the feed on mobile), user-managed sources
  (**`aether_sources_v1`**), and a **`aether_feed_seen`** watermark for
  "N new since last visit". Kept/dived items `logConcept`. Ships curated defaults
  (no news backend); live adapter signals layer on top.
- **Notes** (`notes` mode in Research, `Notes.jsx`) — `aether_notes_v1`, every
  note keeps **provenance** (source url/title/tier), client-side full-text
  search, `logConcept` on save (so notes show in Connected Knowledge), and
  promote-to-flashcard via `createCard`.
- **Book recs** — `src/lib/bookRecs.js` `recommendBooks({library,lens})` scores a
  curated pool (`BOOK_CANDIDATES` in constants) against the graph into four
  signal types (Adjacent / Gap / Companion / Lens), each with a one-line reason;
  never renders a reasonless rec. Surfaced in BookClub's library **and as the
  study guide's "Read next" fallback** when the AI pass returns nothing. The Lens
  signal is the guaranteed non-empty floor and must fire for **every** lens — it
  used to be gated behind `lens !== 'both'`, which silently returned `[]` on the
  default `both` lens and is why the guide's read-next map kept coming back empty.
- **Icons + color restraint** — `src/modules/shared/Icon.jsx` renders a
  lucide-react icon by **name** (explicit registry, never `import *`, or the
  bundle balloons) at one size scale (16/20/24), inheriting `currentColor`. All
  49 emoji `icon:` fields in `constants.js` are lucide names. Blue is reserved
  for actions and current state; section headers, card borders, and eyebrows use
  `--text-tertiary` / `--rule`.

## Navigation IA — 6 containers, modes inside (Phase 1)

The 18 modules collapse into **6 verb-grouped containers** (`CONTAINERS` in
`src/constants.js`): Home (Orient), Learn (Absorb), Research (Investigate),
Skills (Practice), Projects (Execute), Studio (Produce). **Nothing was deleted
— each module became a *mode*.** Mode ids ARE the old module ids, so every
`setActiveModule('<moduleId>')` deep-link still resolves; the owning container
is derived via `containerOfMode()`.
- Nav surfaces live in `src/modules/shared/ContainerNav.jsx`: `SideNav`
  (container rail, ≥768), `ModeChips` (a container's modes as a scrollable row
  under the header), `BottomNav` (mobile: Home/Learn/Skills/Research/More; More
  opens a sheet with every mode). `App.jsx` owns the shell + `openContainer`,
  and remembers the last mode per container in `aether_nav_v1`.
- **Coach is not a tab.** It routes to the global **Ask layer** (`ChatPanel`,
  opened from the header "Ask anything" bar, prompts keyed to the current mode).
  `setActiveModule('coach')` opens the chat. `CoachAI.jsx` is retained but
  unrouted — Phase 3 folds its content into the Ask layer.
- Layouts (`useViewport`): mobile `<768` single column + bottom bar + mode
  chips; iPad `768–1023` sidebar + content, no bottom bar; desktop `≥1024`
  240px sidebar + content, capped at 1280px.

## Knowledge graph + flashcards + lineage (Phase 2)

The connective tissue. Modules used to each write one private key and read
nobody; now they feed a shared graph and a shared card deck.
- **`src/lib/graph.js`** is the knowledge graph, stored under
  `graph.concepts` on `aether_graph_v1` (same key as topics/sessions, additive
  namespace). `logConcept({topic,source,module,confidence,refs})` upserts a
  concept and links concepts that share a source or ref; `getConcept`,
  `relatedConcepts`, `conceptFootprint`, and `graphSummary` read it. Writes go
  through `writeThrough` and are awaited — never swallowed. **Emitters:**
  BookClub, DeepDive (per pass), LearningCenter, Academy (quiz pass),
  QuizCenter (right *and* wrong — a miss is signal), ResearchHub,
  ContentInbox, LearningLadder (rung completion).
  **The graph rejects section-label junk.** `extractFrameworks` once parsed guide
  scaffolding ("What it is", "Worked Example (CB's World)") as framework names and
  `logConcept`'d them; they fed back into study-guide context as fake "tracked
  skills" and turned Applied Scenarios into telemetry. Guard in ONE place —
  `isJunkConcept(topic)` (exported) — used both to reject at the writer
  (`logConcept` returns `{ok:false, code:'junk_concept'}` for a header label) and
  by `extractFrameworks` before it emits. `pruneJunkConcepts()` sweeps existing
  junk from `aether_graph_v1` (runs once on BookClub mount, reports what it
  removed in a dismissible banner, and to the console). Add a new structural label
  to `JUNK_LABELS` / `JUNK_RE` in `graph.js`, nowhere else. **`buildStudyContext`
  also filters `allConcepts()` through `isJunkConcept` on the read side** — the
  prune is async on mount and the graph can re-hydrate from the server after it
  runs, so the read-side filter is the guarantee that a junk label never reaches a
  guide prompt as a scenario domain regardless of prune timing.
- **Flashcards** live on `aether_flashcards` (schema
  `{id,front,back,module,topic,source,interval,easeFactor,dueDate,reviews,createdAt}`).
  `createCard(...)` in `src/lib/reviews.js` is the single writer — dedupes by
  `front`, enters SM-2 immediately (due now). Pushed manually via "Add to
  Vault"/"+ Vault" affordances (BookClub output, Academy `sendToVault`, Vault
  notes) and automatically from **quiz misses** (QuizCenter + Academy).
  MasteryVault reads and studies the deck.
- **Capture lineage:** inbox items carry `derivedInto:[{module,id,at}]`;
  `saveToVault` records the Vault note it became and the item renders a
  "Became →" trail (`ContentInbox`).
- **`src/modules/shared/ConnectedKnowledge.jsx`** is the payoff panel — a
  topic's cross-module footprint (modules touched, related concepts, sources)
  or the graph rollup, drillable. Mounted on **Home** and in the **Ask layer**
  (`ChatPanel` empty state).

## Skills, study guides, and the Claude bridge (Phase 3)

- **Skills** (`src/modules/Skills.jsx`, `src/lib/skills.js`) — a mode in the
  Skills container (`skills`, ahead of vault/growth). A skill is a tracked topic
  with a *confidence trajectory*, derived from each concept's per-observation
  confidence history in the graph: current level, trend (sparkline), what moved
  it, review pressure (cards/reviews due), and a decaying flag when neglected
  >21 days. User skills (`aether_skills_v1`) are **add / rename / archive** and
  **map to one-or-more graph concepts** (`skillSetConcepts`); `lib/skills.js`
  transforms are pure (list in → list out) and `Skills.jsx` persists them with
  the awaited/revert contract. "What moved it" drills into `conceptFootprint`
  (the shared ConnectedKnowledge panel). Module chips link back to where the
  skill is built.
- **Source grounding — automated retrieval + the user's own copy**
  (`src/lib/sourceGrounding.js`, `shared/SourceGrounding.jsx`). The model can't
  retrieve a book published after its cutoff, but the user OWNS the copy — this is
  the input path — and the tool must work HARD to find the TOC before ever asking
  the user to type (manual paste is the last resort, not the normal path). A
  **multi-source retrieval chain** runs client-side (no serverless — Hobby cap),
  merging results and keeping the fullest chapter list: **Open Library** (all
  editions of every matching work — the `table_of_contents` field is sparse and
  sits on one edition while siblings leave it empty, so try them all + read the
  `contents`/`description` variants), **Library of Congress** (MARC field 505,
  "Formatted Contents Note", via loc.gov `fo=json` — library catalogs carry the
  TOC far more reliably than Open Library's field). **loc.gov sends no CORS header,
  so it MUST go through the shared proxy chain** (`fetchRaw` in `utils.js` — direct
  first, then allorigins/corsproxy; the same chain `fetchArticle` uses): a PR #37
  bug fetched it directly and it silently never completed on the deployed build.
  A source that can't execute at all (every route blocked) is logged
  **`unavailable`**, distinct from a genuine 0-result miss. Then a **`job:'web'` batch**
  that is the workhorse, not a fallback: several structured queries in PARALLEL
  (`"full title" table of contents`, `chapter list`, `site:<publisher domain>`,
  the author's own site) each DEMANDING numbered titles in order or exactly `NOT
  FOUND`. It **accepts a reliable non-formal breakdown** — *Winning* is 13 named
  principles, not a contents page; that's the structure, tiered `reported`. Retail
  scraping is never done (ToS, bot-detection, legal exposure); a direct publisher
  fetch is CORS-blocked so the web pass is the only client-viable way to read it.
  `retrieveTOC({title,author,webPass,publisher,deep})` runs the chain and returns
  `{ toc, attempts }`. **Two-phase, cached, reported:** a LIGHT pass auto-runs once
  on selecting a post-cutoff book; a miss offers **"Search harder"** (deep: more
  editions + full web batch + publisher domain) BEFORE the manual path appears;
  only after that misses does the paste box show, **reframed as the exception**
  ("Couldn't find a chapter list… if you have a copy, paste it — that's the
  strongest grounding"). Every retrieval is **cached permanently** on the book
  record (`retrievedTOC` on a hit, a `retrievalState` marker on a miss) so it never
  re-fetches a resolved book, and **failures report the attempts** (source · detail
  · results/error, `unavailable` for blocked), same as the provider chain.
  **Generation is GATED on grounding:** a post-cutoff book with no retrieved TOC and
  no user copy does not silently generate — `generateGuide` blocks and the UI makes
  the user choose (Search harder / paste / **Continue ungrounded →**, which calls
  `generateGuide({ungrounded:true})`); a known/verified/grounded book skips the gate.
  **Tier by source** (`groundingTier`): a TOC /
  excerpt / photo-transcription the user typed from the physical book is a real
  primary source → **`verified`** (the ONE honest `verified` path this app has,
  with real chapter locations to cite); the user's own notes → `reported`; a
  retrieved TOC / publisher description / web thesis → `reported`; nothing →
  `inferred`. `<SourceGrounding>` is the **shared input** (phone-first — that's
  where someone holding the book types); BookClub, DeepDive, TEDHub and PodcastHub
  all mount it and inject the material into their prompts. **The chain's merge /
  attempts / non-formal-structure logic is covered by `sourceGrounding.fixtures.js`
  (Winning / Influence / The Way of Excellence) with a mock web pass; the LIVE
  Open Library + Library of Congress HTTP calls are egress-blocked in the sandbox
  and have NOT been exercised live from here.**
- **Table of Contents is a first-class section** (BookClub). It's shown above the
  study guide as **verification the user can see** (the real chapter list is
  stronger proof of the right book than a description match — tiered by source)
  and as **navigation**: each chapter opens a **chapter dive** (argument, key
  ideas, worked example in the lens, disconfirming test) stored per book on
  **`aether_chapter_dives_v1`** with the same `promptVersion` invalidation as
  guides. Per-chapter **read/dived progress** persists to
  **`aether_chapter_progress_v1`** (awaited/revert) and shows on the book card.
  Chapter dives inherit the book's grounding: **structure** carries the TOC's tier
  (`verified` from the user's copy, `reported` from a retrieved TOC) while the
  **analysis is `[inferred]`** — `buildChapterPrompt` is explicit about which is
  which and `capTierMarkers` caps at the structure tier. Each chapter dive
  `logConcept`s with the chapter as source (`refs:['<book>','Ch. N']`) so Skills
  sees chapter-level progress, not one lump per book. **Chapter-anchored
  generation:** when a TOC is present `buildGuidePrompt` generates the guide
  chapter-by-chapter (`## Chapter Guide`) instead of the framework-based format.
- **Book verification is robust to the titles users actually type**
  (`src/lib/bookVerify.js`). The user types the short spine title ("Winning");
  the catalog stores the full title with subtitle ("Winning: The Unforgiving Race
  to Greatness") and a DIFFERENT book may share the short title (Grover's vs Jack
  Welch's). So verification uses a **query cascade** — exact-phrase → unquoted
  (allows subtitle) → plain keyword, both fields URL-encoded (the old code
  interpolated the author raw and used a dead pre-encoded line) — for Google Books
  then Open Library, stopping at the first non-empty response. Candidates are
  **scored** (`scoreMatch`: subtitle-tolerant title similarity + token-based
  author match that survives a middle initial + edition recency); below
  `CONFIDENCE_THRESHOLD` the UI shows the top 2–3 to pick from rather than silently
  locking result one. The **short title stays the display name, the full title is
  stored for grounding**. Failure **reports the attempts** (source · query ·
  results/error) so a zero-results query and a network failure no longer look
  identical. Fixtures in `bookVerify.fixtures.js` cover the short-title cases
  (Winning / Influence / Mindset). **Retrieval is verified against these fixtures
  and mocks — the live Google Books / Open Library calls are egress-blocked in the
  sandbox, so they have NOT been exercised live from here.**
- **Add-Book surfaces what it matched — never resolves silently**
  (`shared/BookSuggest.jsx`, `searchBooks`/`mainTitle` in `bookVerify.js`). PR #36
  made the query tolerant of short titles but reconciled the full title invisibly.
  Now the title field carries **live catalog suggestions** (debounced ~300ms,
  Google Books via `searchBooks`, capped at 6): a dropdown of cover · full title
  with subtitle · author-as-catalogued (initials kept, so Grover ≠ Welch) · year ·
  publisher. Selecting one fills both fields from the record and stores the match
  so **Save persists a verified record on add** — no separate confirm step. The
  chosen record shows a **"Found: … — author, year, publisher"** strip with a
  "Not this one" reset; free-text entry still works when there's no match. The
  library card/nav show the **short display title** (`title`) with a quiet check
  when catalog-backed; the detail view shows the **full title** (`fullTitle`); TOC
  **retrieval + grounding use the full title** ("Winning" is noise, the full title
  finds the LoC/OpenLibrary record). Multiple editions are the dropdown's rows
  (recency already weighted by `scoreMatch`), so the user picks the edition —
  edition matters for chapter structure and page citations. **Retroactive
  backfill:** on library load, books missing a `fullTitle` (and not `verified` /
  not already `backfillTried`) are quietly re-resolved via `verifyBook`; only a
  CONFIDENT match is applied, it never blocks the UI, and `backfillTried` stops it
  re-fetching a resolved book. **Egress is blocked in the sandbox — the suggestion
  search, scoring, and record-mapping are verified against mocks/unit checks, and
  the dropdown is verified usable at 390/820/1440 (incl. a soft-keyboard-height
  390×420) both themes; the live Google Books call was NOT exercised from here.**
- **Book grounding is REQUIRED before a study guide** (`src/lib/bookVerify.js`).
  A model will confidently invent a thesis for a title it doesn't know — a guide
  for the post-cutoff *The Way of Excellence* returned frameworks from the
  author's EARLIER books, asserted as this one's. So on select, verify against
  **Google Books** (free, keyless, CORS-friendly — do
  NOT add a serverless function, we're at the Hobby 12-function cap), falling back
  to **Open Library**. The user confirms the match; the **verified metadata is
  stored on the book record** and the **publisher description is injected into
  every generation prompt as grounding** (the single change that prevents drift).
  If `publishedDate` is after `MODEL_KNOWLEDGE_CUTOFF`, the book is `postCutoff`
  and generation first runs a **`job:'web'` pass** (Perplexity/Grok) for the real
  thesis + structure. Failed verification still generates but banners **unverified**.
  Every framework is tier-tagged `[verified]` / `[reported: <book>]` / `[inferred]`
  (rendered as `--tier-*` chips by `shared/MD.jsx`) — the guide is the one surface
  that used to present model output as authoritative.
  **The tier ceiling is enforced, not trusted.** The three tiers are strict:
  `verified` = traceable to **retrieved primary source text with a location**;
  `reported` = secondary (publisher description, the author's other work, public
  talks); `inferred` = synthesis (see `rigor.js` `TIER_INSTRUCTION`). This surface
  **never retrieves primary text** — grounding is a publisher description and/or a
  web-thesis pass, both secondary — so **no framework may ever be `[verified]`
  here.** The model over-claimed `[verified]` anyway (four false badges while the
  Sources section admitted the primary text was unavailable), so the guide caps
  the maximum tier *at generation time*: `capTierMarkers(body, groundedTier, …)`
  (from `rigor.js`) rewrites any over-claimed marker down to the ceiling —
  `reported` when a description/web thesis grounded it, `inferred` when nothing
  did. A false verified badge can no longer render regardless of what the model
  emits.
  **Grounding must reach the frameworks, not just the opening.** The retrieved
  thesis leaked into the Core Thesis but frameworks still came from the author's
  better-known book. `buildGuidePrompt` now leads the grounding with the retrieved
  chapters/named-concepts, and the Key Frameworks section is a **hard constraint**
  ("derive frameworks ONLY from the grounding; if a framework isn't supported,
  drop it; fewer well-grounded beats five padded from the author's other work").
  The `job:'web'` pass explicitly asks for the book's **named frameworks + chapter
  structure** and replies `NOT FOUND` rather than answering from a similar title;
  when nothing usable comes back, the guide is generated **all-`inferred` with an
  honest "could not be grounded" note**, never confident frameworks from adjacent
  work.
  **Existence and contents are DIFFERENT facts — never assert non-existence.** A
  catalog match proves the book EXISTS even when Google Books returns no
  description and the web pass says `NOT FOUND` (very common for a recent title);
  Open Library search never returns a description at all. Collapsing "verified
  exists, contents unavailable" into "no grounding" let the model escalate to
  *"no such title exists in publication records"* — for a real Stulberg book. So
  `buildGuidePrompt` keeps **three distinct states**, and forbids claiming
  non-existence in every one: **(1) verified + contents** → grounded, cap
  `reported`; **(2) verified exists (`selectedBook.verified`) + no contents** →
  "this book EXISTS, verified via <catalog>, published <date>; its contents could
  not be RETRIEVED" + all-`inferred`, and it may say it couldn't retrieve the
  contents but **never** that the book is unpublished/nonexistent; **(3) not
  verified + no contents** → "could not VERIFY this title" + all-`inferred`, with
  "absence from your knowledge is not evidence of non-existence." In states 2 & 3
  the Key Frameworks section is written **from general knowledge (marked
  `[inferred]`), never left empty** — an empty frameworks section is what silently
  killed the auto-diagram.
- **Books study-guide engine** (`BookClub.jsx`) — a Work/Personal/Both **lens**
  is appended to every prompt. The lens is **remembered per book** (`lensByBook`
  map on **`aether_bookclub_lens`**, awaited/revert write) so a work-framed read
  of one title doesn't reset the personal framing of another; `lens` is derived
  from `selectedBook` (default `both`). **"Generate Study Guide"** composes ONE
  coherent artifact (it doesn't replace the six study modes — it composes from
  them): `job:'reason'` at **6k tokens** (the old 1.5k ceiling is why this used
  to stub) for **Core Thesis → Key Frameworks (each with a worked example in the
  lens) → Applied Scenarios → Application Prompts → Field Summary**, then a
  trailing `---CARDS---` block of **8–10** self-quiz cards written to the Vault
  via `createCard`. Each framework also carries a **per-framework Disconfirming
  signal** — a concrete thing CB would observe if the framework is failing for him
  plus a review horizon (metric threshold or date) — wired into the Key Frameworks
  section itself, not left to the depth-gated document-level `disconfirming`
  fragment. **Applied Scenarios are grounded in CB's real context** —
  `buildStudyContext()` reads active projects (`aether_projects_v1`), tracked
  skills (`buildSkills`), recent deep dives (`loadIndex`), and the **top concepts
  by observation count straight from the graph** (`allConcepts`) — the last turns
  "you have a real-estate project" into "you've been going deep on demand charges
  and 4CP" — and injects them so scenarios are about his actual work/life, never
  generic. **Graph telemetry is NOT scenario material:** skill *names* are
  injected but the trend/level/observation-count are not (a guide once collapsed
  into five "trend flat" scenarios because the trend leaked); the prompt forbids
  making a scenario about the graph, a trend, or a confidence level — real-life
  domain first, graph signal only as the domain, never the subject.
  **Guides persist to `aether_study_guides_v1`** (keyed by book id,
  awaited/revert via `persistGuide`, hydrated from server) so a guide is
  regenerable but never lost on refresh — a "Saved study guide · <lens> · <date>
  / View guide" affordance reloads it, and the button reads "Regenerate" once
  one exists (`guideLens` tracks the lens the shown guide was made with).
  "Send to Studio" hands the guide to Creation Studio (`guide` source kind) for
  downloadable markdown; the answering provider shows quietly via `ProviderTag`
  (`--text-tertiary`). On generation, `extractFrameworks` pulls each framework
  NAME out of the `## Key Frameworks` section and **`logConcept`s each one**
  (source = book title, so they interlink with the book concept and feed
  Skills/Connected Knowledge) — awaited in sequence so the read-modify-writes
  don't clobber.
- **Learning visuals** (`src/lib/diagram.js`, `src/modules/shared/DiagramBlock.jsx`)
  — an inline diagram generator for any explanation surface. `<DiagramBlock
  content hint initialCode onGenerated label />` asks the model for **Mermaid
  ONLY** (flowchart / sequenceDiagram / mindmap / timeline / quadrantChart),
  **validates with `mermaid.parse` before rendering**, and **falls back to a
  deterministic text outline** (`toOutline`) on a parse error instead of showing
  a broken diagram. **Mermaid is lazy-loaded via dynamic `import()`** so the
  ~500KB engine never sits in the main bundle (it splits into on-demand chunks
  fetched only when a diagram draws). **Theme-aware** — colors are read from the
  live CSS tokens (`--text-primary` / `--accent` / `--rule` / surfaces) and it
  redraws on a `data-theme` toggle (MutationObserver); **no hardcoded hex**. The
  model still emits literal hex (`style N fill:#c0392b`, `classDef … stroke:#…`),
  which doesn't theme, so `cleanMermaid` **strips it — enforcement, not just the
  prompt** (`stripMermaidColors` drops `classDef`/`style`/`linkStyle` lines,
  `:::class` assignments, and any leftover 6-digit hex) so the theme variables
  govern; the generate prompt also forbids color/style directives.
  **Legible at 390px** — the SVG keeps its natural size inside an
  `overflow-x:auto` frame (scrolls rather than shrinking below `--fs-sm`).
  `onGenerated(code)` lets a parent **persist the diagram with its artifact**:
  study guides save it onto the guide (`aether_study_guides_v1`, exported to
  Studio as a ```mermaid block), deep dives save it onto the section
  (`s.diagram`). Mounted in **study guides, deep dives, Ask (`ChatPanel`),
  `LearningCenter`, and Academy levels** (a ladder rung's structure is offered a
  diagram automatically).
  **A `types` prop constrains the diagram kind** — BookClub passes
  `['flowchart','quadrantChart']` (excluding `mindmap`) to force a **causal /
  tension** diagram (A → B, X vs Y) instead of a decorative mindmap that just
  restates the section hierarchy; when `mindmap` is excluded the system prompt
  also forbids restating an outline/list. **The diagram regenerates WITH its
  parent.** The component holds its Mermaid in state and ignores `initialCode`
  after mount, so a regenerated guide used to render the *previous* (now wrong)
  diagram byte-identically. BookClub keys the `DiagramBlock` on the guide's
  `generatedAt` so it **remounts** when the guide is regenerated — a fresh guide
  has no saved diagram, so it auto-draws from the new frameworks — and the same
  `promptVersion` staleness that flags the guide flags the diagram (bump
  `PROMPT_VERSION.studyGuide` → all cached guides show "regenerate", clearing old
  diagrams too).
- **Academy content packs** (`src/modules/academy/FieldManual.jsx`,
  `src/data/ladders/*`) — packs are **DATA ONLY**; adding one is a content task,
  not a code change: write `src/data/ladders/<name>.js` and add it to the
  `LADDERS` array in `src/data/ladders/index.js`. Zero component edits. A pack is
  `{ id, title, subtitle, domain, emoji, version, lastVerified, summary,
  confirms:[{id,claim,why,owner,status}], levels:[...] }`. A **level** is
  `{ id, concept, title, sub, minutes, blocks:[...], cards:[[front,back,tier]],
  quiz:[{q,opts,a,e}] }`. **Block `k`-types** (all tier-chipped): `h` (n,t),
  `p` (html), `ul` (items), `call` (tone key/sport/win/sell/warn, title, html),
  `table` (head, rows), `pair` (pairs), `flow` (stages). Every claim carries a
  **`tier`** (`verified`/`reported`/`inferred`) — nothing renders un-tiered — and
  any block with **`confirm:'<id>'`** is gated out of Field Mode until the
  matching `confirms` entry is resolved (owner+date). Progression is **ungated**
  (every level open from load); quizzes are **optional + infinitely retryable**,
  **misses auto-create Vault cards** (topic = the level's concept), and the
  engine **`logConcept`s each level's `concept`** on open and on quiz (source =
  the pack) so every tool becomes its own trajectory in Skills. Ships one BD pack
  (`sofc-powerdeal`) and one **Negotiation pack** (`nsd-negotiation`, *Never
  Split the Difference* — tactical empathy, calibrated questions, mirroring,
  labeling, accusation audit, "that's right" vs "you're right", loss-aversion
  framing, Ackerman bargaining; each level pairs a BD and a personal example).
  No hardcoded hex — the engine renders on system tokens (`ladder.accent` is
  vestigial). **Productization candidate:** the pack schema is the product.
- **Epistemic layer** (`src/lib/rigor.js`, `shared/TierChip.jsx`) — provenance
  applies to claims about the **external world the user acts on, not the user's
  own thinking**, so rigor is **opt-in per surface, composed from fragments,
  never global** (a library everyone is forced to use is a tax). It **binds to
  the existing depth protocol**, not a parallel system: `rigorPrompt(depth)`
  returns the fragments for that depth —
  **surface** = tier chips only · **standard** = + evidence quality + sources ·
  **deep** = + intellectual lineage + "Where This Breaks Down" (steelmanned, with
  who disagrees) · **expert** = + disconfirming test + friction. Full-rigor
  surfaces without their own depth control default to `standard`; BookClub has one
  and defaults to `deep`. `TIER_INSTRUCTION` is the shared tier discipline —
  **tier is source trust, never engagement** (same rule as WhatsHappening) — and
  the three tiers are **strictly defined**: `verified` = traceable to retrieved
  **primary source text with a location** (chapter/page/timestamp); `reported` =
  secondary (publisher description, the author's other work, public talks —
  named); `inferred` = synthesis. `[verified]`/`[reported: <src>]`/`[inferred]`
  render as `--tier-*` chips (via `MD.jsx` inline, or `<TierChip>` on non-MD
  surfaces). **Enforcement, not just instruction:** `capTierMarkers(text, maxTier,
  {reportedSource})` rewrites any marker that exceeds the ceiling a surface's
  grounding actually earned — a surface that never retrieves primary text (every
  one of ours) can never render a `[verified]` badge no matter what the model
  emits.
  **Scope tiers — do NOT apply everywhere:**
  *Full rigor* — BookClub, DeepDive, LearningCenter, FieldManual, ResearchHub,
  TEDHub, PodcastHub (verifiable claims about external material).
  *Tier chips only* — LearningLadder, QuizCenter, ContentInbox, DailyBrief (rigor
  sections would be noise); **QuizCenter inherits its source's tier and never
  asserts its own** — an unverified guide's question must not look more certain
  than its source. This is *wired*, not just display: `QuizMode` takes a
  `sourceTier` prop and stamps that tier chip ("inherited from source") on every
  answer reveal (MC + open/apply); QuizCenter generates from a bare topic via
  ungrounded model knowledge, so it passes `inferred` — the quiz can never look
  more certain than the model synthesis it came from, and `buildQuizPrompt` is
  deliberately left un-tiered so the quiz never asserts a tier of its own. *Inherit or exclude* — CreationStudio / DiagramBlock /
  MasteryVault preserve + display tier metadata but never generate it (exports and
  flashcards keep the provenance of what they came from); TranslatorHub flags
  confidence on ambiguous terms only. **No provenance layer at all** on
  DecisionLog, ProjectsOS, GrowthTools — that's the **user's own content**, and a
  provenance layer on your own thinking is theater, not rigor.
  **Grounding generalized (the book pattern, applied to every surface that briefs
  external material):** the same drift that makes a model invent a thesis for a
  book it doesn't know applies to any talk / episode / paper summarized with
  nothing anchoring it. So the metadata anchor + tier discipline now travels with
  each: **TEDHub** anchors on title/speaker/year and runs a `job:'web'` pass for
  the real argument when the talk is `isPostCutoff` (year > cutoff), injecting it
  as GROUNDING; **PodcastHub** marks transcript output as reconstruction
  (`[inferred]`, "do not fabricate quotes") and tier-tags briefs; **ResearchHub /
  DeepDive** carry `TIER_INSTRUCTION` into card-analysis, board-synthesis, and
  every deep-dive pass so extracted claims are tiered by source trust;
  **FieldManual** appends `TIER_INSTRUCTION` to its Socratic-drill examiner —
  Academy packs are reference material the user returns to, so an un-tiered
  asserted answer persists longer there than in a one-off guide (its
  `DiagramBlock` stays excluded from tier *generation* per the inherit/exclude
  rule). Every one of these appends `TIER_INSTRUCTION` (shared, from `rigor.js`)
  — no per-surface copy of the tier rule. Post-cutoff detection reuses `isPostCutoff` from
  `bookVerify.js`; the web pass replies `NOT FOUND` rather than inventing, and a
  miss degrades to ungrounded (still tiered), never to a fabricated anchor.
- **Long-artifact layout** (`src/modules/shared/ArtifactSections.jsx`) — a
  responsive renderer for any markdown artifact split on its `## ` headings.
  Short artifacts (0–1 headings) fall through to plain `<MD>` with no chrome.
  **Desktop + iPad** (`!isMobile`): content column + a **sticky right-rail section
  outline** ("On this page" jump buttons). **Mobile**: a **sticky section-jump
  chip row** + **collapsible sections** (each `## ` is a toggle; the heading line
  is stripped from the collapsed body to avoid duplication). Content always
  renders through `<MD>`, so **tier chips + tables (`overflow-x:auto`) behave
  identically everywhere** and nothing overflows at 390. Wired into BookClub's
  study-guide render (`isGuide ? <ArtifactSections …> : <MD …>`); it's the
  reference host for the other full-rigor artifact surfaces. Layouts verified at
  **390 / 820 / 1440, both themes** — no horizontal page scroll, tier chips don't
  wrap badly, tables scroll inside their own frame.
- **Universal Ask** (`src/lib/askContext.js`, `shared/AskChip.jsx`) — one
  `toContext(type, object)` serializer per type (book, project, note, deepdive,
  decision, skill, inbox, **feed**, **research**). `<AskChip type object />` opens
  the Ask layer pre-loaded with the object + its graph neighbors (`askPrefill`)
  AND sets `chatAttach` (`askLabel(type,object)`, e.g. "Book · Winning") so the
  **chat header names what it's attached to** — the user sees the context is live,
  with a detach ✕; starting a new session clears it. Wired on every artifact whose
  serializer exists (BookClub, DeepDive, ResearchHub threads, Notes/Vault,
  ProjectsOS, Skills, DecisionLog, ContentInbox, What's Happening).
- **Shared VOICE fragment** (`rigor.js` `VOICE`) — composed by every generating
  surface (signals, study guides, chapter dives). It fixes fake precision: content
  over-fit to exact user details ("your Real Estate Cash Flow System at 40%, 2/5
  done") reads like a database row, not insight. VOICE says: reference the
  situation at the level that carries MEANING ("an active real-estate project in
  the acquisition gap"), sports-first/elementary/simple, use a sports analogy when
  it clarifies, and NEVER cite graph telemetry (observation counts, trend labels,
  confidence %) as insight — that's instrumentation leaking into content. Bump the
  consuming type's `promptVersion` when VOICE changes (studyGuide, signals).
- **MCP bridge** (`api/mcp.js`, `api/_mcp.js`) — the Claude connector. JSON-RPC
  over POST (`initialize`/`tools/list`/`tools/call`), gated by an **`MCP_TOKEN`**
  bearer (timing-safe compare; the token is used only for the compare and is
  never echoed), **fails closed** when the token is unset, and never returns
  `ACCESS_CODE`, provider keys, or Upstash creds — every tool reads ONLY the
  fixed `KEYS` allowlist (all `aether_*`/recap content), and no key is derived
  from caller input, so an arbitrary secret key can't be requested. Tools:
  `search_knowledge`, `get_concept`, `log_concept`, `add_note`,
  `create_flashcard`, `add_to_inbox`, `get_projects`, **`get_skills`** (skills
  as confidence trajectories — a server-side port of `lib/skills.js`),
  `get_recap`. **Writes feed the graph:** `add_note` / `create_flashcard` /
  `add_to_inbox` each `logConcept` after the write (awaited), same as the
  in-app emitters, so MCP-captured items show in Connected Knowledge.
  **`/api/export`** is a token-gated read-only JSON snapshot
  (graph/skills/projects/**notes**/recaps) — there is NO `api/export.js` file;
  it's served by the same `mcp` function (`exportState`) via a `vercel.json`
  rewrite (`/api/export → /api/mcp?__export=1`) so the repo stays under the
  **Hobby 12-Serverless-Function cap** (a separate `api/export.js` would be the
  13th function and break the deploy). **Connect from claude.ai → Connectors →
  Add custom connector:** URL `https://<deployment>/api/mcp`, Bearer = the
  `MCP_TOKEN` set in Vercel. Set `MCP_TOKEN` in the Vercel env to enable the
  bridge (unset = off).

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
