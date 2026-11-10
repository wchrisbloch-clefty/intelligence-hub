// src/lib/groundBook.js — client for the `ground-book` Supabase Edge Function
// (Batch Z / Order E3). Server-side Open Library + Library of Congress (MARC 505)
// + Firecrawl-on-the-publisher's-page, so the browser no longer needs the
// allorigins/corsproxy chain for loc.gov.
//
// The project URL and PUBLISHABLE (anon) key are public by design — they grant
// nothing on `kv` (RLS on, no policies) and the function only reads catalogs.
// The service-role key never reaches the client.
export const SUPABASE_URL = 'https://ujywrlbuwecitwkvzohb.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeXdybGJ1d2VjaXR3a3Z6b2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyNzAwMjUsImV4cCI6MjEwOTg0NjAyNX0.89-ZeBmzPUDc0rbX5GrynsJBSEOBRjB36IfbqZC4E-g';

// → { state:'verified+contents'|'verified-exists-only'|'unverified', toc:[...]|null,
//     source, sourceLabel, tier, record, attempts } — or null if the function is
//     unreachable (the caller logs that as an `unavailable` attempt and carries on).
export async function groundBook({ title, author = '', publisher = '', catalogVerified = false, refresh = false }, timeoutMs = 60000) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/ground-book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ title, author, publisher, catalogVerified, refresh }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { unreachable: true, status: r.status };
    return await r.json();
  } catch (e) {
    return { unreachable: true, error: e?.message || String(e) };
  }
}
