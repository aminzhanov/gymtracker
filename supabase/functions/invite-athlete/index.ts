import { createClient } from "npm:@supabase/supabase-js@2";
// SITE_URL is configured once by the administrator, not taken from user input.
const site = Deno.env.get("SITE_URL")!;
const cors = {
  "Access-Control-Allow-Origin": new URL(site).origin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const response = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method !== "POST")
    return response(405, { error: "Method not allowed" });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return response(401, { error: "Sign in first" });
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);
  if (authError || !user) return response(401, { error: "Invalid session" });
  const { data: coach, error: profileError } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (profileError || coach?.role !== "coach" || !coach?.active)
    return response(403, { error: "Coach access required" });
  try {
    const { name, email } = await req.json();
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return response(400, { error: "Enter a valid name and email" });
    const nonce = crypto.randomUUID();
    const { error: reserveError } = await admin.rpc("reserve_athlete_invite", {
      invite_email: email,
      invite_coach: user.id,
      invite_nonce: nonce,
    });
    if (reserveError)
      return response(400, {
        error:
          reserveError.code === "23505"
            ? "An invitation is already in progress for this email."
            : reserveError.message,
      });
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: { name: name.trim(), invite_nonce: nonce },
        redirectTo: site + "?welcome=1",
      },
    );
    if (error || !data.user) {
      // Never delete an auth user on a partial failure. The administrator can resend an invite.
      await admin.from("athlete_invitations").delete().eq("nonce", nonce);
      return response(400, { error: error?.message || "Invitation failed" });
    }
    // The auth trigger creates the profile and coach relationship in one transaction.
    const { data: link, error: linkError } = await admin
      .from("coach_athletes")
      .select("coach_id")
      .eq("athlete_id", data.user.id)
      .single();
    if (linkError || link?.coach_id !== user.id)
      return response(500, {
        error:
          "Could not verify the athlete assignment. Contact the administrator.",
      });
    return response(200, { ok: true });
  } catch {
    return response(400, { error: "Invalid request" });
  }
});
