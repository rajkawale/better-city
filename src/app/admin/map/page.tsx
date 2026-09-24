"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IssueMap, severityColor } from "@/components/IssueMap";

export default function AdminMapPage() {
  const router = useRouter();
  const [points, setPoints] = useState<{ id: string; lat: number; lng: number; title: string; severity: string; color: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("reports").select("id, lat, lng, title, severity").limit(2000).then(({ data }) => {
      setPoints((data ?? []).map((row) => ({ ...row, color: severityColor(row.severity) })));
    });
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-5xl text-pine">Map</h1>
      <IssueMap height={640} center={[73.8567, 18.5204]} points={points} onSelect={(id) => router.push(`/admin/issues/${id}`)} />
    </div>
  );
}
