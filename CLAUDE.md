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
  never renders a reasonless rec. Surfaced in BookClub's library.
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
- **Book grounding is REQUIRED before a study guide** (`src/lib/bookVerify.js`).
  A model will confidently invent a thesis for a title it doesn't know — a guide
  for the post-cutoff *The Way of Excellence* returned frameworks from the
  author's EARLIER books, asserted as this one's. So on select, verify against
  **Google Books** (`intitle:"…"+inauthor:…`, free, keyless, CORS-friendly — do
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
  via `createCard`. **Applied Scenarios are grounded in CB's real context** —
  `buildStudyContext()` reads active projects (`aether_projects_v1`), tracked
  skills (`buildSkills`), recent deep dives (`loadIndex`), and the **top concepts
  by observation count straight from the graph** (`allConcepts`) — the last turns
  "you have a real-estate project" into "you've been going deep on demand charges
  and 4CP" — and injects them so scenarios are about his actual work/life, never
  generic.
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
  redraws on a `data-theme` toggle (MutationObserver); **no hardcoded hex**.
  **Legible at 390px** — the SVG keeps its natural size inside an
  `overflow-x:auto` frame (scrolls rather than shrinking below `--fs-sm`).
  `onGenerated(code)` lets a parent **persist the diagram with its artifact**:
  study guides save it onto the guide (`aether_study_guides_v1`, exported to
  Studio as a ```mermaid block), deep dives save it onto the section
  (`s.diagram`). Mounted in **study guides, deep dives, Ask (`ChatPanel`),
  `LearningCenter`, and Academy levels** (a ladder rung's structure is offered a
  diagram automatically).
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
- **Universal Ask** (`src/lib/askContext.js`, `shared/AskChip.jsx`) — one
  `toContext(type, object)` serializer per type (book, project, note, deepdive,
  decision, skill, inbox, **feed**). `<AskChip type object />` opens the Ask layer
  pre-loaded with the object + its graph neighbors (`askPrefill`). Wired on all
  the object types; **What's Happening feed items** route their "Ask" action
  through `askPrefill('feed', item)` so a headline opens the chat with its own
  context line plus any graph neighbors.
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
