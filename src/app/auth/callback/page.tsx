"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") ?? "magiclink";
    if (!tokenHash) {
      setError("This sign-in link is missing its token.");
      return;
    }
    supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" }).then(({ error: verifyError }) => {
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      window.location.replace("/admin");
    });
  }, []);

  return <main className="p-8">{error || "Opening the admin panel…"}</main>;
}
