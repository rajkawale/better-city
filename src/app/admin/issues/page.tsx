"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatWhen } from "@/lib/labels";
import { SEVERITIES, STATUSES, statusLabel, type Area, type Category, type City } from "@/lib/types";

type Row = {
  id: string;
  title: string;
  status: string;
  severity: string;
  created_at: string;
  city_id: string;
  area_id: string | null;
  area_other_text: string | null;
  category_id: string;
  submitted_by: string;
};

export default function IssuesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("cities").select("id, name, state, center_lat, center_lng, active").then(({ data }) => setCities((data ?? []) as City[]));
    supabase.from("areas").select("id, city_id, ward_id, name, active").then(({ data }) => setAreas((data ?? []) as Area[]));
    supabase.from("categories").select("id, name, icon, detail_fields, sort_order, active").then(({ data }) => setCategories((data ?? []) as Category[]));
    supabase.from("profiles").select("id, full_name").then(({ data }) => {
      const map: Record<string, string> = {};
      for (const profile of data ?? []) map[profile.id] = profile.full_name;
      setNames(map);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      let request = supabase.from("reports").select("id, title, status, severity, created_at, city_id, area_id, area_other_text, category_id, submitted_by").order("created_at", { ascending: false }).range(page * 50, page * 50 + 49);
      if (status) request = request.eq("status", status);
      if (severity) request = request.eq("severity", severity);
      if (cityId) request = request.eq("city_id", cityId);
      if (areaId) request = request.eq("area_id", areaId);
      if (categoryId) request = request.eq("category_id", categoryId);
      if (query) request = request.ilike("title", `%${query}%`);
      const { data } = await request;
      setRows((data ?? []) as Row[]);
    });
  }, [status, severity, cityId, areaId, categoryId, query, page]);

  const areaName = (row: Row) => areas.find((area) => area.id === row.area_id)?.name ?? row.area_other_text ?? "—";
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "—";
  const cityName = (id: string) => cities.find((city) => city.id === id)?.name ?? "—";

  function exportCsv() {
    const header = ["id", "title", "status", "severity", "city", "area", "category", "executive", "created"];
    const lines = rows.map((row) => [row.id, row.title, row.status, row.severity, cityName(row.city_id), areaName(row), categoryName(row.category_id), names[row.submitted_by] ?? "", row.created_at].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "better-city-issues.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-5xl text-pine">Issues</h1>
        <button className="rounded-xl border border-line px-4 py-2" type="button" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <select className="field-input" value={cityId} onChange={(e) => { setCityId(e.target.value); setAreaId(""); setPage(0); }}>
          <option value="">All cities</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
        <select className="field-input" value={areaId} onChange={(e) => { setAreaId(e.target.value); setPage(0); }}>
          <option value="">All areas</option>
          {areas.filter((area) => !cityId || area.city_id === cityId).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <select className="field-input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(0); }}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="field-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">All statuses</option>
          {STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
        </select>
        <select className="field-input" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(0); }}>
          <option value="">All severities</option>
          {SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="field-input" placeholder="Search title" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-2">Title</th>
              <th>Category</th>
              <th>Severity</th>
              <th>City</th>
              <th>Area</th>
              <th>Executive</th>
              <th>When</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-3 pr-3"><Link href={`/admin/issues/${row.id}`} className="font-medium">{row.title}</Link></td>
                <td>{categoryName(row.category_id)}</td>
                <td className="capitalize">{row.severity}</td>
                <td>{cityName(row.city_id)}</td>
                <td>{areaName(row)}</td>
                <td>{names[row.submitted_by] ?? "—"}</td>
                <td>{formatWhen(row.created_at)}</td>
                <td className="capitalize">{statusLabel(row.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button className="text-sm" type="button" disabled={page === 0} onClick={() => setPage((n) => Math.max(0, n - 1))}>Previous</button>
        <button className="text-sm" type="button" disabled={rows.length < 50} onClick={() => setPage((n) => n + 1)}>Next</button>
      </div>
    </div>
  );
}
