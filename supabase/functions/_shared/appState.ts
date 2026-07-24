// Shared helpers for reading/writing the `app_state` table from Edge Functions.
//
// Edge Functions run with the service-role key (auto-injected by Supabase as
// SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS — that's required because a
// cron-triggered run has no end-user JWT to scope rows with. We therefore scope
// every query explicitly by user_id.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected in deployed functions).",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Resolve which user(s) to generate for.
// - If RECAP_USER_ID secret is set, use exactly that user.
// - Otherwise fall back to every distinct user_id present in app_state
//   (correct for the single-user deployment this app targets).
export async function resolveTargetUserIds(sb: SupabaseClient): Promise<string[]> {
  const explicit = Deno.env.get("RECAP_USER_ID");
  if (explicit) return [explicit];

  const { data, error } = await sb.from("app_state").select("user_id");
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data ?? []) if (row.user_id) ids.add(row.user_id);
  return [...ids];
}

// Read a set of keys for one user. Returns a map key → parsed value (or null).
export async function readState(
  sb: SupabaseClient,
  userId: string,
  keys: string[],
): Promise<Record<string, unknown>> {
  const { data, error } = await sb
    .from("app_state")
    .select("key,value")
    .eq("user_id", userId)
    .in("key", keys);
  if (error) throw error;
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = null;
  for (const row of data ?? []) out[row.key] = row.value;
  return out;
}

// Upsert one key for one user. Mirrors the client's cloudSet contract.
export async function writeState(
  sb: SupabaseClient,
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await sb.from("app_state").upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" },
  );
  if (error) throw error;
}
