"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const supabase = createClient();
    const { data } = await supabase.from("categories").select("id, name, icon, detail_fields, sort_order, active").order("sort_order");
    setCategories((data ?? []) as Category[]);
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    await supabase.from("categories").insert({ name, sort_order: (categories.at(-1)?.sort_order ?? 0) + 10 });
    setName("");
    await load();
  }

  async function toggle(category: Category) {
    const supabase = createClient();
    await supabase.from("categories").update({ active: !category.active }).eq("id", category.id);
    await load();
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-5xl text-pine">Categories</h1>
      <form onSubmit={add} className="flex gap-2">
        <input className="field-input" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="rounded-xl bg-pine px-4 text-paper" type="submit">Add</button>
      </form>
      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category.id} className="panel flex items-center justify-between px-4 py-3">
            <span>{category.name}</span>
            <button className="text-sm" type="button" onClick={() => toggle(category)}>{category.active ? "Disable" : "Enable"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
