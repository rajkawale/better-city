"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushQueue } from "@/lib/field/upload";
import { pendingCount } from "@/lib/field/queue";
import { createClient } from "@/lib/supabase/client";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      setOwner(profile?.role === "admin");
    });
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const run = () => flushQueue().then(() => router.refresh());
    run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [router]);

  async function logout() {
    const waiting = await pendingCount();
    if (waiting > 0) {
      window.alert(`${waiting} report${waiting === 1 ? "" : "s"} still waiting to upload. Stay online until they finish.`);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto min-h-full max-w-lg pb-24">
      <header className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-signal">Executive</p>
          <p className="font-display text-2xl text-pine">Better City</p>
        </div>
        <div className="flex items-center gap-4">
          {owner ? (
            <Link href="/admin" className="text-sm" style={{ color: "#1c1915" }}>
              Admin
            </Link>
          ) : null}
          <button className="text-sm text-ink-soft" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="px-4">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-lg border-t border-line bg-paper-2/95 px-4 py-2 backdrop-blur">
        {[
          ["/field", "Home"],
          ["/field/report", "Report"],
          ["/field/reports", "Mine"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-3 text-center text-sm ${path === href ? "text-signal" : "text-ink-soft"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
