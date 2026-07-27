// =============================================================================
// manage-staff  —  Supabase Edge Function (one per clinic project)
// Lets an admin list / create / delete staff logins from the admin console.
//
// Deploy this into EACH new clinic's Supabase project (see ONBOARDING.md).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the
// Supabase Edge runtime — you do NOT set any secrets by hand.
//
// CORS note: the allowed origin is dynamic (it echoes the calling clinic's own
// domain), so this identical file works for every customer with no edits. The
// function is still fully protected — it requires a valid staff JWT and, for
// create/delete, the 'admin' role.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const uid = userData?.user?.id;
  if (!uid) return json({ error: "Not signed in" }, 401);

  const { data: me } = await admin.from("staff")
    .select("clinic_id, role").eq("auth_user_id", uid).maybeSingle();
  if (!me) return json({ error: "Not a staff member" }, 403);
  const clinicId = me.clinic_id;

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "list") {
    const { data: staff } = await admin.from("staff")
      .select("id, name, role, auth_user_id").eq("clinic_id", clinicId).order("name");
    const list = [];
    for (const s of staff || []) {
      const { data: u } = await admin.auth.admin.getUserById(s.auth_user_id);
      list.push({ id: s.id, name: s.name, role: s.role, email: u?.user?.email || "", self: s.auth_user_id === uid });
    }
    return json({ staff: list });
  }

  if (action === "create" || action === "delete") {
    if (me.role !== "admin") return json({ error: "Only an admin can manage staff" }, 403);
  }

  if (action === "create") {
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const name = (body.name || "").trim() || email;
    const role = body.role === "admin" ? "admin" : "doctor";
    if (!email || password.length < 6) return json({ error: "Email and a 6+ char password are required" }, 400);

    const { data: created, error: cErr } =
      await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (cErr) return json({ error: cErr.message }, 400);

    const { error: sErr } = await admin.from("staff")
      .insert({ auth_user_id: created.user.id, clinic_id: clinicId, name, role });
    if (sErr) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: sErr.message }, 400); }
    return json({ ok: true });
  }

  if (action === "delete") {
    const staffId = body.staff_id;
    const { data: target } = await admin.from("staff")
      .select("auth_user_id, clinic_id").eq("id", staffId).maybeSingle();
    if (!target || target.clinic_id !== clinicId) return json({ error: "Not found" }, 404);
    if (target.auth_user_id === uid) return json({ error: "You cannot remove your own login" }, 400);
    await admin.from("staff").delete().eq("id", staffId);
    await admin.auth.admin.deleteUser(target.auth_user_id);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
