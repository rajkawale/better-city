"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatWhen } from "@/lib/labels";
import { statusLabel, type ReportStatus } from "@/lib/types";

type Row = { id: string; title: string; status: ReportStatus; created_at: string; severity: string };

export default function MyReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let query = supabase.from("reports").select("id, title, status, created_at, severity").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    query.then(({ data }) => setRows((data ?? []) as Row[]));
  }, [status]);

  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl text-pine">My reports</h1>
      <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {["submitted", "needs_info", "under_review", "verified", "rejected", "resolved"].map((item) => (
          <option key={item} value={item}>{statusLabel(item)}</option>
        ))}
      </select>
      {rows.map((row) => (
        <Link key={row.id} href={`/field/reports/${row.id}`} className="panel block px-4 py-3">
          <span className="flex items-center justify-between gap-3">
            <span className="font-medium">{row.title}</span>
            <span className={`chip sev-${row.severity}`}>{statusLabel(row.status)}</span>
          </span>
          <span className="text-sm text-ink-soft">{formatWhen(row.created_at)}</span>
        </Link>
      ))}
    </div>
  );
}
