import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: actor } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin" || !actor.active) {
    return { error: NextResponse.json({ error: "Only an admin can manage the team." }, { status: 403 }) };
  }
  return { supabase, admin, user };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const { admin, user } = gate as Exclude<typeof gate, { error: NextResponse }>;
  const body = await request.json();

  if (body.action === "deactivate" || body.action === "reactivate") {
    const active = body.action === "reactivate";
    await admin.from("profiles").update({ active }).eq("id", id);
    await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: active ? "executive.reactivate" : "executive.deactivate",
      entity_type: "profile",
      entity_id: id,
      details: {},
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reset-password") {
    const temporaryPassword = String(body.password ?? "");
    if (temporaryPassword.length < 8) {
      return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
    }
    const updated = await admin.auth.admin.updateUserById(id, { password: temporaryPassword });
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
    await admin.from("audit_log").insert({
      actor_id: user.id,
      action: "executive.reset_password",
      entity_type: "profile",
      entity_id: id,
      details: {},
    });
    return NextResponse.json({ temporaryPassword });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
