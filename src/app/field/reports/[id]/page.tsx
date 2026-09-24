"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { preparePhoto } from "@/lib/field/photos";
import { formatWhen } from "@/lib/labels";
import { EDITABLE_STATUSES, statusLabel, type Report, type ReportPhoto } from "@/lib/types";

export default function FieldReportDetail() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [events, setEvents] = useState<{ id: string; body: string | null; created_at: string; to_status: string | null }[]>([]);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const [{ data: reportRow }, { data: photoRows }, { data: eventRows }] = await Promise.all([
      supabase.from("reports").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("report_photos").select("*").eq("report_id", params.id).order("sort_order"),
      supabase.from("report_events").select("id, body, created_at, to_status").eq("report_id", params.id).order("created_at"),
    ]);
    const next = reportRow as Report | null;
    setReport(next);
    setDescription(next?.description ?? "");
    setPhotos((photoRows ?? []) as ReportPhoto[]);
    setEvents(eventRows ?? []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [params.id]);

  if (!report) return <p className="text-ink-soft">Loading report…</p>;
  const editable = EDITABLE_STATUSES.includes(report.status);

  async function save() {
    const supabase = createClient();
    const { error } = await supabase.from("reports").update({ description }).eq("id", report!.id);
    setMessage(error ? error.message : report!.status === "needs_info" ? "Resubmitted." : "Saved.");
    await load();
  }

  async function addPhoto(file: File | undefined) {
    if (!file || !report) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const photo = await preparePhoto(file, "gallery");
    const originalPath = `${user.id}/${report.id}/${photo.id}-original.jpg`;
    const stampedPath = `${user.id}/${report.id}/${photo.id}-stamped.jpg`;
    await supabase.storage.from("evidence").upload(originalPath, photo.original, { upsert: true, contentType: "image/jpeg" });
    await supabase.storage.from("evidence").upload(stampedPath, photo.stamped, { upsert: true, contentType: "image/jpeg" });
    await supabase.from("report_photos").insert({
      id: photo.id,
      report_id: report.id,
      original_path: originalPath,
      stamped_path: stampedPath,
      source: photo.source,
      kind: "evidence",
      captured_at: photo.capturedAt,
      sort_order: photos.length,
    });
    if (report.status === "needs_info") {
      await supabase.from("reports").update({ description }).eq("id", report.id);
    }
    setMessage("Photo added.");
    await load();
  }

  return (
    <article className="space-y-4">
      <p className={`chip sev-${report.severity}`}>{statusLabel(report.status)}</p>
      <h1 className="font-display text-4xl leading-tight text-pine">{report.title}</h1>
      <p className="text-sm text-ink-soft">Captured {formatWhen(report.captured_at)} · uploaded {formatWhen(report.uploaded_at)}</p>
      <p>{report.landmark || report.address}</p>
      {editable ? (
        <label className="block">
          <span className="field-label">Description</span>
          <textarea className="field-input min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      ) : (
        <p>{report.description}</p>
      )}
      {report.reject_reason ? <p className="panel p-4 text-sm">Admin: {report.reject_reason}</p> : null}
      <ul className="space-y-2 text-sm text-ink-soft">
        {events.map((event) => (
          <li key={event.id}>{formatWhen(event.created_at)} — {event.body}</li>
        ))}
      </ul>
      {editable ? (
        <div className="space-y-3">
          <label className="panel block px-4 py-3 text-center">
            Add photo
            <input className="sr-only" type="file" accept="image/*" onChange={(e) => addPhoto(e.target.files?.[0])} />
          </label>
          <button className="w-full rounded-2xl bg-pine py-3 text-paper" type="button" onClick={save}>
            {report.status === "needs_info" ? "Resubmit" : "Save"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">This report is read-only while it is {statusLabel(report.status)}.</p>
      )}
      {message ? <p className="text-sm">{message}</p> : null}
      <p className="text-xs text-ink-soft">{photos.length} photo{photos.length === 1 ? "" : "s"} on file. Location and capture time stay locked.</p>
    </article>
  );
}
