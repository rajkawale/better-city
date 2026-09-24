import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function password() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => alphabet[n % alphabet.length]).join("");
}

export async function GET() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Supabase service credentials are not configured." }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin" || !actor.active) {
    return NextResponse.json({ error: "Only an admin can view the team." }, { status: 403 });
  }

  const [{ data: listed }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from("profiles").select("id, full_name, phone, active, role"),
  ]);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const people = (listed.users ?? []).map((account) => {
    const profile = byId.get(account.id);
    return {
      id: account.id,
      email: account.email ?? "",
      full_name: profile?.full_name || account.email || "Unnamed",
      phone: profile?.phone ?? null,
      active: profile?.active ?? true,
      role: profile?.role ?? "executive",
    };
  });
  return NextResponse.json({ people, me: user.id });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Supabase service credentials are not configured." }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: actor } = await supabase.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (actor?.role !== "admin" || !actor.active) {
    return NextResponse.json({ error: "Only an admin can create executives." }, { status: 403 });
  }

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.fullName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const cityIds = Array.isArray(body.cityIds) ? body.cityIds.map(String) : [];
  const temporaryPassword = String(body.password || password());
  if (!email || !fullName || cityIds.length === 0) {
    return NextResponse.json({ error: "Name, email, and at least one city are required." }, { status: 400 });
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: "executive", full_name: fullName },
  });
  if (created.error || !created.data.user) {
    const message = created.error?.message?.toLowerCase().includes("already")
      ? "That email is already in use."
      : created.error?.message ?? "Could not create the account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const id = created.data.user.id;
  await admin.from("profiles").update({ full_name: fullName, phone, must_change_password: true, role: "executive", active: true }).eq("id", id);
  if (cityIds.length) {
    await admin.from("profile_cities").insert(cityIds.map((cityId: string) => ({ profile_id: id, city_id: cityId })));
  }
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "executive.create",
    entity_type: "profile",
    entity_id: id,
    details: { email },
  });

  return NextResponse.json({
    id,
    email,
    fullName,
    temporaryPassword,
  });
}
