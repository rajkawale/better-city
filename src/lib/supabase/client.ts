"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createClient() {
  const { url, key, ready } = publicEnv();
  if (!ready) {
    throw new Error("Supabase public credentials are not set");
  }
  return createBrowserClient(url, key);
}
