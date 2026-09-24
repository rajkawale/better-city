import { createClient } from "@supabase/supabase-js";
import { serviceEnv } from "@/lib/env";

export function createAdminClient() {
  const { url, service, ready } = serviceEnv();
  if (!ready) return null;
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
