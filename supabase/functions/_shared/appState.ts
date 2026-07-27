// Shared helpers for reading/writing app state from Edge Functions.
//
// Storage is Upstash Redis (REST), the same store the app uses via
// /api/storage. We hit the Upstash REST API directly rather than /api/storage,
// which sits behind the ACCESS_CODE cookie gate and would 401 from a function.
//
// The keyspace is flat and single-tenant: one value per key, no user scoping.
// Values are stored verbatim as JSON strings (the app does JSON.stringify before
// SET), so reads JSON.parse the result and writes JSON.stringify the value.
//
// Secrets (set via `supabase secrets set`): KV_REST_API_URL, KV_REST_API_TOKEN
// — the names match api/_lib.js. UPSTASH_REDIS_REST_* is intentionally not used;
// those env vars don't exist in this project.

// Storage keys — must match src/constants.js.
export const KEYS = {
  GRAPH: "aether_graph_v1",
  PROJECTS: "aether_projects_v1",
  NOTES: "aether_notes_v1",
  RESEARCH: "aether_research_v1",
  INBOX: "aether_inbox",
  DECISIONS: "aether_decisions",
  QUIZ: "aether_quiz_results",
  WEEKLY_RECAP: "weekly_recap_latest",
  MONTHLY_REVIEW: "monthly_review_latest",
} as const;

function kvConfig(): { url: string; token: string } {
  const url = Deno.env.get("KV_REST_API_URL");
  const token = Deno.env.get("KV_REST_API_TOKEN");
  if (!url || !token) {
    throw new Error("Missing KV_REST_API_URL / KV_REST_API_TOKEN secrets.");
  }
  return { url, token };
}

// Run one Upstash REST command, e.g. ["GET", key] or ["SET", key, value].
// Returns the raw `result` field (string | null | ...).
async function kvCommand(command: unknown[]): Promise<unknown> {
  const { url, token } = kvConfig();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Upstash REST error (${r.status})`);
  const data = await r.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

// Read + parse one key. Missing key → null (never throws on absence).
async function readKey(key: string): Promise<unknown> {
  const raw = await kvCommand(["GET", key]);
  if (raw == null) return null;
  if (typeof raw !== "string") return raw; // defensive; app stores strings
  try {
    return JSON.parse(raw);
  } catch {
    return null; // unparseable value is treated as absent, not fatal
  }
}

// Read a set of keys. Returns a map key → parsed value (null if missing).
export async function readState(keys: string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  await Promise.all(
    keys.map(async (k) => {
      out[k] = await readKey(k);
    }),
  );
  return out;
}

// Upsert one key. Value is JSON.stringified to match the app's convention.
export async function writeState(key: string, value: unknown): Promise<void> {
  await kvCommand(["SET", key, JSON.stringify(value)]);
}
