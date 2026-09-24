export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, key, ready: Boolean(url && key) };
}

export function serviceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    "";
  return { url, service, ready: Boolean(url && service) };
}
