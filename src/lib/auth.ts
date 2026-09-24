import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export async function getSessionProfile() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null, profile: null as Profile | null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, active, must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile: (data as Profile | null) ?? null };
}

export async function requireProfile(roles?: Role[]) {
  const session = await getSessionProfile();
  if (!session.user || !session.profile || !session.profile.active) {
    redirect("/login");
  }
  if (roles && !roles.includes(session.profile.role)) {
    redirect(session.profile.role === "executive" ? "/field" : "/admin");
  }
  if (session.profile.must_change_password) {
    redirect("/password");
  }
  return session as {
    supabase: NonNullable<typeof session.supabase>;
    user: NonNullable<typeof session.user>;
    profile: Profile;
  };
}
