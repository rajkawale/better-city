"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(updateError.message);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", user?.id ?? "");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
    router.replace(profile?.role === "executive" ? "/field" : "/admin");
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-12">
      <h1 className="font-display text-4xl text-pine">Set your password</h1>
      <p className="mt-2 text-ink-soft">This replaces the temporary password from your admin.</p>
      <form onSubmit={onSubmit} className="panel mt-6 space-y-4 p-5">
        <label className="block">
          <span className="field-label">New password</span>
          <input className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error ? <p className="text-sm text-critical">{error}</p> : null}
        <button className="w-full rounded-xl bg-pine px-4 py-3 text-paper" disabled={pending} type="submit">
          {pending ? "Saving…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
