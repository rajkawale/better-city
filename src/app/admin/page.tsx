"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatWhen } from "@/lib/labels";
import { SEVERITIES, statusLabel, type Area, type Category, type City } from "@/lib/types";
import { Bars } from "@/components/Bars";

type Row = {
  id: string;
  title: string;
  status: string;
  severity: string;
  created_at: string;
  area_id: string | null;
  category_id: string;
  city_id: string;
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#9d2c2c",
  high: "#b8611a",
  medium: "#8a6a1d",
  low: "#3d6248",
};

export default function DashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState("30");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const [reportRes, cityRes, areaRes, categoryRes] = await Promise.all([
        supabase.from("reports").select("id, title, status, severity, created_at, area_id, category_id, city_id").order("created_at", { ascending: false }).limit(2000),
        supabase.from("cities").select("id, name, state, center_lat, center_lng, active"),
        supabase.from("areas").select("id, city_id, ward_id, name, active"),
        supabase.from("categories").select("id, name, icon, detail_fields, sort_order, active"),
      ]);
      setRows((reportRes.data ?? []) as Row[]);
      setCities((cityRes.data ?? []) as City[]);
      setAreas((areaRes.data ?? []) as Area[]);
      setCategories((categoryRes.data ?? []) as Category[]);
    });
  }, []);

  const filtered = useMemo(() => {
    const since = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
    return rows.filter((row) => {
      if (cityId && row.city_id !== cityId) return false;
      if (areaId && row.area_id !== areaId) return false;
      if (categoryId && row.category_id !== categoryId) return false;
      if (severity && row.severity !== severity) return false;
      if (status && row.status !== status) return false;
      if (since && new Date(row.created_at).getTime() < since) return false;
      return true;
    });
  }, [rows, cityId, areaId, categoryId, severity, status, range]);

  function tally(key: (row: Row) => string) {
    const counts = new Map<string, number>();
    for (const row of filtered) {
      const label = key(row);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  const areaName = (id: string | null) => areas.find((area) => area.id === id)?.name ?? "Unlisted";
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "Other";
  const pending = filtered.filter((row) => ["submitted", "under_review", "needs_info"].includes(row.status)).length;
  const verified = filtered.filter((row) => ["verified", "reported_to_city", "acknowledged", "resolved", "closed"].includes(row.status)).length;

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const label = day.toLocaleDateString("en-IN", { weekday: "short" });
    const value = filtered.filter((row) => {
      const created = new Date(row.created_at);
      return created >= day && created < new Date(day.getTime() + 86_400_000);
    }).length;
    return { label, value, color: "#1d3a32" };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-5xl text-pine">Evaluate</h1>
      <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
        <select className="field-input" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select className="field-input" value={cityId} onChange={(e) => { setCityId(e.target.value); setAreaId(""); }}>
          <option value="">All cities</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
        <select className="field-input" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">All areas</option>
          {areas.filter((area) => !cityId || area.city_id === cityId).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <select className="field-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="field-input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          {SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["submitted", "under_review", "needs_info", "verified", "rejected", "resolved"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["In this view", filtered.length],
          ["Pending review", pending],
          ["Verified or later", verified],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel p-5">
            <p className="field-label">{label}</p>
            <p className="font-display text-5xl">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-3xl text-pine">Last 7 days</h2>
          <Bars rows={days} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-3xl text-pine">By severity</h2>
          <Bars rows={tally((row) => row.severity).map(([label, value]) => ({ label, value, color: SEVERITY_COLOR[label] ?? "#1d3a32" }))} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-3xl text-pine">By category</h2>
          <Bars rows={tally((row) => categoryName(row.category_id)).map(([label, value]) => ({ label, value, color: "#c4531a" }))} />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-3xl text-pine">By area</h2>
          <Bars rows={tally((row) => areaName(row.area_id)).map(([label, value]) => ({ label, value, color: "#1d3a32" }))} />
        </section>
      </div>
      <section className="space-y-2">
        <h2 className="font-display text-3xl text-pine">Open a report to review photos and video</h2>
        {filtered.slice(0, 8).map((row) => (
          <Link key={row.id} href={`/admin/issues/${row.id}`} className="panel flex items-center justify-between px-4 py-3">
            <span>
              <span className="block font-medium">{row.title}</span>
              <span className="text-sm text-ink-soft">{areaName(row.area_id)} · {formatWhen(row.created_at)}</span>
            </span>
            <span className={`chip sev-${row.severity}`}>{statusLabel(row.status)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
