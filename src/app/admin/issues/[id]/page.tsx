"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IssueMap, severityColor } from "@/components/IssueMap";
import { formatWhen, isVideoPath } from "@/lib/labels";
import { SEVERITIES, statusLabel, type Report, type ReportPhoto } from "@/lib/types";

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [photos, setPhotos] = useState<(ReportPhoto & { url?: string })[]>([]);
  const [events, setEvents] = useState<{ id: string; body: string | null; created_at: string; from_status: string | null; to_status: string | null }[]>([]);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const [{ data: reportRow }, { data: photoRows }, { data: eventRows }, { data: noteRow }] = await Promise.all([
      supabase.from("reports").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("report_photos").select("*").eq("report_id", params.id).order("sort_order"),
      supabase.from("report_events").select("id, body, created_at, from_status, to_status").eq("report_id", params.id).order("created_at"),
      supabase.from("report_notes").select("body").eq("report_id", params.id).maybeSingle(),
    ]);
    setReport(reportRow as Report | null);
    setEvents(eventRows ?? []);
    setNote(noteRow?.body ?? "");
    const signed = await Promise.all(((photoRows ?? []) as ReportPhoto[]).map(async (photo) => {
      const { data } = await supabase.storage.from("evidence").createSignedUrl(photo.stamped_path, 3600);
      return { ...photo, url: data?.signedUrl };
    }));
    setPhotos(signed);
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [params.id]);

  if (!report) return <p className="text-ink-soft">Loading issue…</p>;

  async function setStatus(status: string, extra: Record<string, string | null> = {}) {
    const supabase = createClient();
    const { error } = await supabase.from("reports").update({ status, reject_reason: extra.reject_reason ?? null, duplicate_of: extra.duplicate_of ?? report!.duplicate_of }).eq("id", report!.id);
    setMessage(error ? error.message : `Marked ${statusLabel(status)}.`);
    await load();
  }

  async function saveEdits(patch: Partial<Report>) {
    const supabase = createClient();
    const { error } = await supabase.from("reports").update(patch).eq("id", report!.id);
    setMessage(error ? error.message : "Saved.");
    await load();
  }

  async function saveNote() {
    const supabase = createClient();
    const { error } = await supabase.from("report_notes").upsert({ report_id: report!.id, body: note, updated_at: new Date().toISOString() });
    setMessage(error ? error.message : "Internal note saved.");
  }

  async function addAfter(file: File | undefined) {
    if (!file) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const id = crypto.randomUUID();
    const path = `${user.id}/${report!.id}/${id}-after.jpg`;
    const uploaded = await supabase.storage.from("evidence").upload(path, file, { upsert: true, contentType: file.type });
    if (uploaded.error) {
      setMessage(uploaded.error.message);
      return;
    }
    await supabase.from("report_photos").insert({ id, report_id: report!.id, original_path: path, stamped_path: path, source: "gallery", kind: "after", sort_order: 100 });
    await setStatus("resolved");
  }

  return (
    <article className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <p className={`chip sev-${report.severity}`}>{statusLabel(report.status)} · {report.severity}</p>
        <h1 className="font-display text-5xl leading-tight text-pine">{report.title}</h1>
        <p>{report.description}</p>
        <p className="text-sm text-ink-soft">Captured {formatWhen(report.captured_at)} · uploaded {formatWhen(report.uploaded_at)} · {report.location_source.replaceAll("_", " ")} {report.accuracy_m ? `±${Math.round(report.accuracy_m)} m` : ""}</p>
        {report.original_severity !== report.severity ? <p className="text-sm">Executive judged this {report.original_severity}. Current severity is {report.severity}.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="panel overflow-hidden">
              {photo.url && isVideoPath(photo.stamped_path) ? (
                <video src={photo.url} className="aspect-[4/3] w-full bg-ink" controls />
              ) : photo.url ? (
                <img alt="" src={photo.url} className="aspect-[4/3] w-full object-cover" />
              ) : null}
              <figcaption className="px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">{photo.kind} · {photo.source}</figcaption>
            </figure>
          ))}
        </div>
        <IssueMap height={240} center={[report.lng, report.lat]} points={[{ id: report.id, lat: report.lat, lng: report.lng, title: report.title, severity: report.severity, color: severityColor(report.severity) }]} />
      </div>
      <aside className="space-y-4">
        <div className="panel space-y-2 p-4">
          <p className="field-label">Review</p>
          <button className="w-full rounded-xl bg-pine py-3 text-paper" type="button" onClick={() => setStatus("verified")}>Verify</button>
          <textarea className="field-input min-h-20" placeholder="Comment for the executive" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="w-full rounded-xl border border-line py-3" type="button" onClick={() => setStatus("needs_info", { reject_reason: comment })}>Needs info</button>
          <button className="w-full rounded-xl border border-line py-3" type="button" onClick={() => setStatus("rejected", { reject_reason: comment })}>Reject</button>
          <button className="w-full rounded-xl border border-line py-3" type="button" onClick={() => setStatus("under_review")}>Under review</button>
          <button className="w-full rounded-xl border border-line py-3" type="button" onClick={() => setStatus("reported_to_city")}>Reported to city</button>
          <button className="w-full rounded-xl border border-line py-3" type="button" onClick={() => setStatus("acknowledged")}>Acknowledged</button>
          <label className="block rounded-xl border border-line py-3 text-center">
            Resolved with after photo
            <input className="sr-only" type="file" accept="image/*" onChange={(e) => addAfter(e.target.files?.[0])} />
          </label>
          <button className="w-full rounded-xl border border-line py-3" type="button" onClick={() => setStatus("closed")}>Close</button>
        </div>
        <label className="block">
          <span className="field-label">Severity</span>
          <select className="field-input capitalize" value={report.severity} onChange={(e) => saveEdits({ severity: e.target.value as Report["severity"] })}>
            {SEVERITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Title</span>
          <input className="field-input" defaultValue={report.title} onBlur={(e) => { if (e.target.value !== report.title) saveEdits({ title: e.target.value }); }} />
        </label>
        <label className="block">
          <span className="field-label">Internal note</span>
          <textarea className="field-input min-h-24" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="mt-2 text-sm underline" type="button" onClick={saveNote}>Save note</button>
        </label>
        <ol className="space-y-2 text-sm">
          {events.map((event) => (
            <li key={event.id}>
              <span className="text-ink-soft">{formatWhen(event.created_at)}</span> {event.body}
            </li>
          ))}
        </ol>
        {message ? <p className="text-sm">{message}</p> : null}
      </aside>
    </article>
  );
}
