"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatWhen } from "@/lib/labels";

type Entry = { id: string; action: string; entity_type: string; created_at: string; details: Record<string, unknown> };

export default function AuditPage() {
  const [rows, setRows] = useState<Entry[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("audit_log").select("id, action, entity_type, created_at, details").order("created_at", { ascending: false }).limit(200).then(({ data }) => setRows((data ?? []) as Entry[]));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-5xl text-pine">Audit</h1>
      <p className="text-sm text-ink-soft">This log cannot be edited here.</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="panel px-4 py-3 text-sm">
            <span className="text-ink-soft">{formatWhen(row.created_at)}</span> {row.action} · {row.entity_type}
          </li>
        ))}
      </ul>
    </div>
  );
}
