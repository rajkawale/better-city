"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Area, City, Ward } from "@/lib/types";

export default function PlacesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [others, setOthers] = useState<{ id: string; area_other_text: string | null; city_id: string }[]>([]);
  const [cityName, setCityName] = useState("");
  const [areaName, setAreaName] = useState("");
  const [bulk, setBulk] = useState("");
  const [cityId, setCityId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const [cityRes, areaRes, wardRes, otherRes] = await Promise.all([
      supabase.from("cities").select("id, name, state, center_lat, center_lng, active").order("name"),
      supabase.from("areas").select("id, city_id, ward_id, name, active").order("name"),
      supabase.from("wards").select("id, city_id, name, active").order("name"),
      supabase.from("reports").select("id, area_other_text, city_id").is("area_id", null).not("area_other_text", "is", null),
    ]);
    const nextCities = (cityRes.data ?? []) as City[];
    setCities(nextCities);
    setAreas((areaRes.data ?? []) as Area[]);
    setWards((wardRes.data ?? []) as Ward[]);
    setOthers(otherRes.data ?? []);
    if (!cityId && nextCities[0]) setCityId(nextCities[0].id);
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function addCity(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.from("cities").insert({ name: cityName, state: "" });
    setMessage(error ? error.message : `${cityName} added.`);
    setCityName("");
    await load();
  }

  async function addAreas(event: React.FormEvent) {
    event.preventDefault();
    const names = [areaName, ...bulk.split("\n")].map((name) => name.trim()).filter(Boolean);
    const supabase = createClient();
    const { error } = await supabase.from("areas").insert(names.map((name) => ({ city_id: cityId, name })));
    setMessage(error ? error.message : "Areas saved.");
    setAreaName("");
    setBulk("");
    await load();
  }

  async function adopt(reportId: string, text: string, reportCityId: string) {
    const supabase = createClient();
    const { data: area, error } = await supabase.from("areas").insert({ city_id: reportCityId, name: text }).select("id").single();
    if (error || !area) {
      setMessage(error?.message ?? "Could not add the area.");
      return;
    }
    await supabase.from("reports").update({ area_id: area.id, area_other_text: null }).eq("id", reportId);
    await load();
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-5xl text-pine">Places</h1>
      {message ? <p>{message}</p> : null}
      <form onSubmit={addCity} className="flex gap-2">
        <input className="field-input" placeholder="New city" value={cityName} onChange={(e) => setCityName(e.target.value)} />
        <button className="rounded-xl bg-pine px-4 text-paper" type="submit">Add city</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {cities.map((city) => <li key={city.id} className="chip">{city.name}{city.active ? "" : " · hidden"}</li>)}
      </ul>
      <form onSubmit={addAreas} className="panel space-y-3 p-5">
        <select className="field-input" value={cityId} onChange={(e) => setCityId(e.target.value)}>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
        <input className="field-input" placeholder="Area name" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
        <textarea className="field-input min-h-28" placeholder="Or paste one area per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <button className="rounded-xl bg-signal px-4 py-3 text-signal-ink" type="submit">Add areas</button>
      </form>
      <ul className="grid gap-2 sm:grid-cols-2">
        {areas.filter((area) => area.city_id === cityId).map((area) => <li key={area.id} className="panel px-4 py-3">{area.name}</li>)}
      </ul>
      <section>
        <h2 className="font-display text-3xl">Other — not in list</h2>
        {others.map((row) => (
          <div key={row.id} className="mt-2 flex items-center justify-between">
            <span>{row.area_other_text}</span>
            <button className="text-sm underline" type="button" onClick={() => adopt(row.id, row.area_other_text ?? "", row.city_id)}>Add to area list</button>
          </div>
        ))}
        {others.length === 0 ? <p className="text-sm text-ink-soft">No unmatched area names.</p> : null}
      </section>
      <p className="text-sm text-ink-soft">{wards.length} wards configured. Add wards from the same city when you have the list.</p>
    </div>
  );
}
