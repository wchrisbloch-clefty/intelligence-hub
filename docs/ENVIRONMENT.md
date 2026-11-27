# Environment variables

Names and purposes only. **No values, no secrets — ever — in this file.**

## Vercel (project `intelligence-hub`) — read by `api/*`

| Variable | Read by | Purpose |
|---|---|---|
| `ACCESS_CODE` | `api/_lib.js`, `api/auth.js` | The single-user access code. Also the HMAC key for the auth cookie (rotating it signs everyone out). |
| `SUPABASE_URL` | `api/_lib.js` only | `https://ujywrlbuwecitwkvzohb.supabase.co`, the Intel Hub project. PostgREST base for the `kv` table. |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib.js` only | Service-role key. **Server-side only.** It bypasses RLS, and `kv` has no policies, so nothing else can read it. Never give it a `VITE_` prefix. |
| `ANTHROPIC_API_KEY` | `api/_providers.js` | Claude. Leads the `reason` chain; final fallback everywhere. |
| `GROQ_API_KEY` | `api/_providers.js` | Groq (`openai/gpt-oss-*`). Leads volume jobs. |
| `GOOGLE_AI_KEY` | `api/_providers.js` | Gemini. |
| `PERPLEXITY_API_KEY` | `api/_providers.js` | Perplexity: `job:'web'` grounding. |
| `XAI_API_KEY` | `api/_providers.js` | Grok: `job:'web'` / contrast. |
| `YOUTUBE_API_KEY` | `api/youtube.js` | YouTube Data API. |
| `MCP_TOKEN` | `api/mcp.js` | Bearer for the Claude connector + `/api/export`. Unset = bridge off (fails closed). |
| `CRON_SECRET` | `api/_recap.js` | Bearer Vercel Cron presents to `/api/weekly-recap` + `/api/monthly-review`. Retired with those routes once the Supabase recaps (Order E) are live. |
| `VERCEL_GIT_COMMIT_SHA` | `vite.config.js` | Set by Vercel automatically. Becomes the build id shown in `?debug=1`. |

## Supabase (project `Intel Hub`, ref `ujywrlbuwecitwkvzohb`): Edge Function secrets

| Variable | Read by | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all functions | Injected by Supabase automatically. Used for PostgREST on `kv`. |
| `CRON_SECRET` | `weekly-recap`, `monthly-review` | Compared to the `x-cron-secret` header. pg_cron reads the same value from Vault (`vault.decrypted_secrets`, name `cron_secret`). |
| `ANTHROPIC_API_KEY` | `weekly-recap`, `monthly-review` | The recap synthesis call. Without it the functions still run and write a `degraded` recap. |
| `FIRECRAWL_API_KEY` | `ground-book` | Firecrawl scrape of a **publisher** page. Without it that step reports `unavailable` and the chain continues. |
| `GROUND_BOOK_TOKEN` | `ground-book` | Optional bearer. Unset = only the anon/publishable key gate applies. |

## Retired — do not re-add

| Variable | Why |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash removed in Batch Z / Order B. Supabase `kv` is the only store. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Vercel-KV aliases of the above. Same reason. |

These stay set in Vercel **only** until `scripts/migrate-upstash-to-supabase.mjs` has
copied the data across. Then delete them.

## Client

The browser reads **no** environment variables. There is no `VITE_*` variable anywhere
in the repo. Check with `grep -rn "VITE_" src api`.
