import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!publicEnv().ready) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Better City</p>
        <h1 className="mt-3 font-display text-5xl text-pine">Waiting for the new database</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          Add the Better City Supabase URL, anon key, and service role key to <code>.env.local</code>.
          The migration in <code>supabase/migrations</code> is ready to apply there. KOS is not used.
        </p>
      </main>
    );
  }
  const { profile } = await getSessionProfile();
  if (profile?.must_change_password) redirect("/password");
  if (profile?.role === "executive") redirect("/field");
  const fieldHref = profile ? "/field" : "/login?next=/field";
  const adminHref = profile?.role === "admin" ? "/admin" : "/login?next=/admin";
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-16">
      <p className="text-xs uppercase tracking-[0.22em] text-signal">Better City</p>
      <h1 className="mt-2 font-display text-5xl text-pine">Choose a screen</h1>
      <Link href={fieldHref} className="panel mt-8 block px-5 py-6 text-xl">Main screen</Link>
      <Link href={adminHref} className="panel mt-3 block px-5 py-6 text-xl">Admin panel</Link>
      <p className="mt-4 text-sm text-ink-soft">The admin panel asks for your email and password when you are not already signed in.</p>
    </main>
  );
}
