"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { City } from "@/lib/types";

type Member = { id: string; email: string; full_name: string; phone: string | null; active: boolean; role: string };

function generatedPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => alphabet[n % alphabet.length]).join("");
}

export default function TeamPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cityIds, setCityIds] = useState<string[]>([]);
  const [password, setPassword] = useState(generatedPassword());
  const [credentials, setCredentials] = useState("");
  const [error, setError] = useState("");
  const [me, setMe] = useState("");

  async function load() {
    const supabase = createClient();
    const [{ data: cityRows }, response] = await Promise.all([
      supabase.from("cities").select("id, name, state, center_lat, center_lng, active").eq("active", true),
      fetch("/api/admin/executives"),
    ]);
    const body = await response.json();
    setCities((cityRows ?? []) as City[]);
    setMembers((body.people ?? []) as Member[]);
    setMe(body.me ?? "");
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function createExecutive(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/executives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone, cityIds, password }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Could not create the executive.");
      return;
    }
    setCredentials(`Better City login\nEmail: ${body.email}\nTemporary password: ${body.temporaryPassword}\nThey must set a new password on first login.`);
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword(generatedPassword());
    await load();
  }

  async function act(id: string, action: string) {
    const nextPassword = action === "reset-password" ? generatedPassword() : undefined;
    const response = await fetch(`/api/admin/executives/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, password: nextPassword }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Could not update the executive.");
      return;
    }
    if (body.temporaryPassword) setCredentials(`Temporary password: ${body.temporaryPassword}`);
    await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={createExecutive} className="panel space-y-3 p-5">
        <h1 className="font-display text-4xl text-pine">Add executive</h1>
        <input className="field-input" placeholder="Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="field-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field-input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div className="space-y-1">
          <p className="field-label">Cities</p>
          {cities.map((city) => (
            <label key={city.id} className="flex items-center gap-2">
              <input type="checkbox" checked={cityIds.includes(city.id)} onChange={(e) => setCityIds((current) => e.target.checked ? [...current, city.id] : current.filter((id) => id !== city.id))} />
              {city.name}
            </label>
          ))}
        </div>
        <label className="block">
          <span className="field-label">Temporary password</span>
          <input className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="rounded-xl bg-signal px-4 py-3 text-signal-ink" type="submit">Create account</button>
        {error ? <p className="text-sm text-critical">{error}</p> : null}
        {credentials ? (
          <div className="rounded-xl bg-pine p-4 text-sm text-paper">
            <pre className="whitespace-pre-wrap">{credentials}</pre>
            <button className="mt-3 underline" type="button" onClick={() => navigator.clipboard.writeText(credentials)}>Copy</button>
          </div>
        ) : null}
      </form>
      <section className="space-y-3">
        <h2 className="font-display text-3xl text-pine">Everyone</h2>
        {members.map((member) => (
          <div key={member.id} className="panel flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{member.full_name}{member.id === me ? " (you)" : ""}</p>
              <p className="text-sm text-ink-soft">{member.email} · {member.role} · {member.active ? "Active" : "Deactivated"}</p>
            </div>
            {member.id === me ? null : (
              <div className="flex gap-3 text-sm">
                <button type="button" onClick={() => act(member.id, "reset-password")}>Reset password</button>
                <button type="button" onClick={() => act(member.id, member.active ? "deactivate" : "reactivate")}>{member.active ? "Deactivate" : "Reactivate"}</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
