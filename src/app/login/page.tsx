"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    params.get("error") === "deactivated" ? "This account is deactivated. Contact your admin." : "",
  );
  const [pending, setPending] = useState(false);
  const [forgot, setForgot] = useState(false);
  const asked = params.get("next");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (signError) {
      setError("Email or password is wrong.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active, must_change_password")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    if (!profile?.active) {
      await supabase.auth.signOut();
      setError("This account is deactivated. Contact your admin.");
      return;
    }
    if (profile.must_change_password) {
      router.replace("/password");
      return;
    }
    if (profile.role !== "admin" || asked === "/field") router.replace("/field");
    else router.replace("/admin");
  }

  if (!publicEnv().ready) {
    return <p className="text-ink-soft">Supabase credentials are not configured yet.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-5">
      <label className="block">
        <span className="field-label">Email</span>
        <input className="field-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="block">
        <span className="field-label">Password</span>
        <input className="field-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      <button className="w-full rounded-xl bg-signal px-4 py-3 text-signal-ink" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <button className="w-full text-sm text-ink-soft" type="button" onClick={() => setForgot(true)}>
        Forgot password?
      </button>
      {forgot ? <p className="text-sm text-pine">Contact your admin to reset it.</p> : null}
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-12">
      <p className="text-xs uppercase tracking-[0.22em] text-signal">Sign in</p>
      <h1 className="mt-2 font-display text-5xl leading-none text-pine">Better City</h1>
      <p className="mt-3 text-ink-soft">Accounts are created by the admin. There is no public sign-up.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
