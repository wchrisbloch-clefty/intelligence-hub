// Shared-secret gate for cron-invoked functions.
//
// These functions run with verify_jwt=false (see supabase/config.toml) so that
// pg_cron / net.http_post can invoke them without an end-user JWT. To keep the
// endpoint from being publicly triggerable, every request must present the
// CRON_SECRET as the `x-cron-secret` header (set via `supabase secrets set`).
export function assertCronSecret(req: Request): Response | null {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    // Fail closed: if no secret is configured, refuse rather than run open.
    return json({ error: "CRON_SECRET is not configured on the function." }, 500);
  }
  const provided = req.headers.get("x-cron-secret");
  if (provided !== expected) {
    return json({ error: "Unauthorized." }, 401);
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
