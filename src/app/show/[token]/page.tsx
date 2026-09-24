import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHOWCASE_STATUSES, statusLabel } from "@/lib/types";
import { daysOpen, formatWhen, isVideoPath } from "@/lib/labels";
import { ShowMap } from "@/components/ShowMap";

export const dynamic = "force-dynamic";

export default async function ShowcasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) return <main className="p-8">Showcase is not configured.</main>;

  const { data: link } = await admin.from("share_links").select("id, label, city_id, area_id, ward_id, expires_at, revoked_at, view_count").eq("token", token).maybeSingle();
  if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24">
        <h1 className="font-display text-5xl text-pine">This link is no longer active</h1>
      </main>
    );
  }

  let query = admin
    .from("reports")
    .select("id, title, description, severity, status, landmark, address, lat, lng, captured_at, created_at, category_id, area_id, ward_id")
    .eq("city_id", link.city_id)
    .in("status", SHOWCASE_STATUSES)
    .order("created_at", { ascending: false });
  if (link.area_id) query = query.eq("area_id", link.area_id);
  if (link.ward_id) query = query.eq("ward_id", link.ward_id);
  const { data: reports } = await query;
  const list = reports ?? [];
  if (!link.id) notFound();

  await admin.from("share_links").update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() }).eq("id", link.id);

  const [{ data: city }, { data: areas }, { data: categories }] = await Promise.all([
    admin.from("cities").select("name").eq("id", link.city_id).single(),
    admin.from("areas").select("id, name").eq("city_id", link.city_id),
    admin.from("categories").select("id, name"),
  ]);
  const areaName = new Map((areas ?? []).map((area) => [area.id, area.name]));
  const categoryName = new Map((categories ?? []).map((category) => [category.id, category.name]));
  const critical = list.filter((row) => row.severity === "critical").length;

  const cards = await Promise.all(list.map(async (report) => {
    const { data: photo } = await admin.from("report_photos").select("stamped_path").eq("report_id", report.id).eq("kind", "evidence").order("sort_order").limit(1).maybeSingle();
    const signed = photo ? await admin.storage.from("evidence").createSignedUrl(photo.stamped_path, 3600) : null;
    return { ...report, photo: signed?.data?.signedUrl ?? null, photoPath: photo?.stamped_path ?? "", category: categoryName.get(report.category_id) ?? "Issue", area: areaName.get(report.area_id) ?? "" };
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs uppercase tracking-[0.22em] text-signal">Better City</p>
      <h1 className="mt-2 font-display text-6xl text-pine">{city?.name}</h1>
      <p className="mt-2 text-lg text-ink-soft">{link.label}</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="panel p-4"><p className="field-label">Issues</p><p className="font-display text-4xl">{list.length}</p></div>
        <div className="panel p-4"><p className="field-label">Critical</p><p className="font-display text-4xl">{critical}</p></div>
      </div>
      <div className="mt-6">
        <ShowMap points={cards.map((card) => ({ id: card.id, lat: card.lat, lng: card.lng, title: card.title, severity: card.severity }))} />
      </div>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.id} id={card.id} className="panel overflow-hidden">
            {card.photo && isVideoPath(card.photoPath) ? (
              <video src={card.photo} className="aspect-[16/10] w-full bg-ink" controls />
            ) : card.photo ? (
              <img alt="" src={card.photo} className="aspect-[16/10] w-full object-cover" />
            ) : null}
            <div className="space-y-2 p-4">
              <p className={`chip sev-${card.severity}`}>{card.severity} · {statusLabel(card.status)}</p>
              <h2 className="font-display text-3xl">{card.title}</h2>
              <p className="text-sm text-ink-soft">{card.category} · {card.area} · {card.landmark || card.address}</p>
              <p>{card.description}</p>
              <p className="text-sm text-ink-soft">First reported {formatWhen(card.captured_at)} · {daysOpen(card.created_at, card.status) ?? 0} days open</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
