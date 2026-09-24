"use client";

import { createClient } from "@/lib/supabase/client";
import { listQueue, removeQueued, type QueuedReport } from "@/lib/field/queue";

async function uploadOne(item: QueuedReport) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload");

  const { error } = await supabase.from("reports").upsert(
    {
      id: item.id,
      city_id: item.cityId,
      area_id: item.areaId,
      area_other_text: item.areaId ? null : item.areaOther,
      ward_id: item.wardId,
      category_id: item.categoryId,
      severity: item.severity,
      original_severity: item.severity,
      title: item.title,
      description: item.description,
      details: item.details,
      remarks: item.remarks || null,
      landmark: item.landmark || null,
      address: item.address || null,
      lat: item.lat,
      lng: item.lng,
      accuracy_m: item.accuracyM,
      location_source: item.locationSource,
      captured_at: item.capturedAt,
      submitted_by: user.id,
      status: "submitted",
    },
    { onConflict: "id" },
  );
  if (error) throw error;

  for (const [index, photo] of item.photos.entries()) {
    const video = photo.media === "video";
    const ext = video ? "mp4" : "jpg";
    const contentType = video ? photo.original.type || "video/mp4" : "image/jpeg";
    const originalPath = `${user.id}/${item.id}/${photo.id}-original.${ext}`;
    const stampedPath = video ? originalPath : `${user.id}/${item.id}/${photo.id}-stamped.jpg`;
    const originalUp = await supabase.storage.from("evidence").upload(originalPath, photo.original, {
      upsert: true,
      contentType,
    });
    if (originalUp.error) throw originalUp.error;
    const stampedUp = video
      ? { error: null }
      : await supabase.storage.from("evidence").upload(stampedPath, photo.stamped, {
          upsert: true,
          contentType: "image/jpeg",
        });
    if (stampedUp.error) throw stampedUp.error;
    const { error: photoError } = await supabase.from("report_photos").upsert(
      {
        id: photo.id,
        report_id: item.id,
        original_path: originalPath,
        stamped_path: stampedPath,
        source: photo.source,
        kind: "evidence",
        captured_at: photo.capturedAt,
        sort_order: index,
      },
      { onConflict: "id" },
    );
    if (photoError) throw photoError;
  }
  await removeQueued(item.id);
}

export async function flushQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { uploaded: 0, failed: 0 };
  const items = await listQueue();
  let uploaded = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await uploadOne(item);
      uploaded += 1;
    } catch {
      failed += 1;
    }
  }
  return { uploaded, failed };
}
