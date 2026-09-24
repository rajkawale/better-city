"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { City } from "@/lib/types";

type LinkRow = { id: string; token: string; label: string; revoked_at: string | null; view_count: number; expires_at: string | null };

export default function LinksPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [label, setLabel] = useState("Pune — verified issues");
  const [cityId, setCityId] = useState("");

  async function load() {
    const supabase = createClient();
    const [{ data: cityRows }, { data: linkRows }] = await Promise.all([
      supabase.from("cities").select("id, name, state, center_lat, center_lng, active"),
      supabase.from("share_links").select("id, token, label, revoked_at, view_count, expires_at").order("created_at", { ascending: false }),
    ]);
    const next = (cityRows ?? []) as City[];
    setCities(next);
    if (!cityId && next[0]) setCityId(next[0].id);
    setLinks((linkRows ?? []) as LinkRow[]);
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("share_links").insert({ label, city_id: cityId, created_by: user?.id });
    await supabase.from("audit_log").insert({ actor_id: user?.id, action: "share.create", entity_type: "share_link", details: { label } });
    await load();
  }

  async function revoke(id: string) {
    const supabase = createClient();
    await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-5xl text-pine">Showcase links</h1>
      <form onSubmit={create} className="panel grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]">
        <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="field-input" value={cityId} onChange={(e) => setCityId(e.target.value)}>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
        <button className="rounded-xl bg-signal px-4 text-signal-ink" type="submit">Create link</button>
      </form>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{link.label}</p>
              <p className="text-sm text-ink-soft">{link.view_count} views · {link.revoked_at ? "Revoked" : "Active"}</p>
            </div>
            <div className="flex gap-3 text-sm">
              <a href={`/show/${link.token}`}>Open</a>
              <button type="button" onClick={() => navigator.clipboard.writeText(`${location.origin}/show/${link.token}`)}>Copy</button>
              {!link.revoked_at ? <button type="button" onClick={() => revoke(link.id)}>Revoke</button> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
