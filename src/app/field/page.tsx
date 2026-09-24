"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { pendingCount } from "@/lib/field/queue";
import { statusLabel } from "@/lib/types";
import { formatWhen } from "@/lib/labels";

type Row = { id: string; title: string; status: string; created_at: string; severity: string };

export default function FieldHome() {
  const [rows, setRows] = useState<Row[]>([]);
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [install, setInstall] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstall(!standalone);
    pendingCount().then(setWaiting);
    const supabase = createClient();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - 6);
    supabase
      .from("reports")
      .select("id, title, status, created_at, severity")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setRows((data ?? []) as Row[]));
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()).then(({ count }) => setToday(count ?? 0));
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("created_at", weekStart.toISOString()).then(({ count }) => setWeek(count ?? 0));
  }, []);

  return (
    <div className="space-y-4">
      {install ? (
        <p className="rounded-2xl bg-pine px-4 py-3 text-sm text-paper">
          Add Better City to your Home Screen so reports stay on this phone and uploads resume when you reopen the app.
        </p>
      ) : null}
      {waiting > 0 ? (
        <p className="rounded-2xl border border-signal px-4 py-3 text-sm">
          {waiting} waiting to upload. Keep the app open on a connection.
        </p>
      ) : null}
      <Link href="/field/report" className="block rounded-3xl bg-signal px-5 py-8 text-center text-2xl text-signal-ink">
        + Report issue
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <div className="panel p-4">
          <p className="field-label">Today</p>
          <p className="font-display text-4xl">{today}</p>
        </div>
        <div className="panel p-4">
          <p className="field-label">This week</p>
          <p className="font-display text-4xl">{week}</p>
        </div>
      </div>
      <section className="space-y-2">
        {rows.map((row) => (
          <Link key={row.id} href={`/field/reports/${row.id}`} className="panel flex items-center justify-between px-4 py-3">
            <span>
              <span className="block font-medium">{row.title}</span>
              <span className="text-sm text-ink-soft">{formatWhen(row.created_at)}</span>
            </span>
            <span className={`chip sev-${row.severity}`}>{statusLabel(row.status)}</span>
          </Link>
        ))}
        {rows.length === 0 ? <p className="text-sm text-ink-soft">No reports yet.</p> : null}
      </section>
    </div>
  );
}
