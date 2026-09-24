"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { preparePhoto, type PreparedPhoto } from "@/lib/field/photos";
import { cacheGet, cachePut, enqueue } from "@/lib/field/queue";
import { flushQueue } from "@/lib/field/upload";
import { titleFrom } from "@/lib/labels";
import type { Area, Category, City, LocationSource, Severity, Ward } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import { IssueMap } from "@/components/IssueMap";

type Fix = { lat: number; lng: number; accuracy: number | null; source: LocationSource };

export default function ReportPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [cityId, setCityId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [otherArea, setOtherArea] = useState("");
  const [wardId, setWardId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remarks, setRemarks] = useState("");
  const [landmark, setLandmark] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsNote, setGpsNote] = useState("");
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("cities").select("id, name, state, center_lat, center_lng, active").eq("active", true),
      supabase.from("areas").select("id, city_id, ward_id, name, active").eq("active", true).order("name"),
      supabase.from("wards").select("id, city_id, name, active").eq("active", true).order("name"),
      supabase.from("categories").select("id, name, icon, detail_fields, sort_order, active").eq("active", true).order("sort_order"),
    ]).then(async ([cityRes, areaRes, wardRes, categoryRes]) => {
      if (cityRes.error) setError(cityRes.error.message);
      const nextCities = (cityRes.data ?? []) as City[];
      const nextAreas = (areaRes.data ?? []) as Area[];
      const nextWards = (wardRes.data ?? []) as Ward[];
      const nextCategories = (categoryRes.data ?? []) as Category[];
      if (nextCities.length) {
        setCities(nextCities);
        setAreas(nextAreas);
        setWards(nextWards);
        setCategories(nextCategories);
        await cachePut("cities", nextCities);
        await cachePut("areas", nextAreas);
        await cachePut("wards", nextWards);
        await cachePut("categories", nextCategories);
      } else {
        setCities((await cacheGet<City[]>("cities")) ?? []);
        setAreas((await cacheGet<Area[]>("areas")) ?? []);
        setWards((await cacheGet<Ward[]>("wards")) ?? []);
        setCategories((await cacheGet<Category[]>("categories")) ?? []);
      }
      const last = await cacheGet<string>("last-area");
      if (last) setAreaId(last);
    });
  }, []);

  useEffect(() => {
    if (cities.length === 1) setCityId(cities[0].id);
  }, [cities]);

  const cityAreas = useMemo(
    () => areas.filter((area) => area.city_id === cityId && area.name.toLowerCase().includes(areaQuery.toLowerCase())),
    [areas, cityId, areaQuery],
  );
  const category = categories.find((item) => item.id === categoryId);
  const areaName = areas.find((area) => area.id === areaId)?.name ?? otherArea;

  useEffect(() => {
    if (category && areaName && !title) setTitle(titleFrom(category.name, areaName));
  }, [category, areaName, title]);

  useEffect(() => {
    const area = areas.find((item) => item.id === areaId);
    if (area?.ward_id) setWardId(area.ward_id);
  }, [areaId, areas]);

  function readGps() {
    if (!navigator.geolocation) {
      setGpsNote("This phone has no GPS. Drop a pin on the map.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        setDenied(false);
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy,
          source: "live_gps",
        });
        setGpsNote(accuracy > 50 ? `Waiting for better GPS… ±${Math.round(accuracy)} m` : `±${Math.round(accuracy)} m`);
      },
      () => {
        setDenied(true);
        setGpsNote("Location is off.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const photoCount = photos.filter((item) => item.media !== "video").length;

  async function addFiles(list: FileList | null, source: "camera" | "gallery") {
    if (!list?.length) return;
    const room = 10 - photos.filter((item) => item.media !== "video").length;
    if (room <= 0) {
      setError("You can attach up to 10 photos.");
      return;
    }
    const next: PreparedPhoto[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      next.push(await preparePhoto(file, source));
    }
    setPhotos((current) => [...current, ...next]);
    const withGps = next.find((photo) => photo.lat != null && photo.lng != null);
    if (source === "gallery" && withGps?.lat != null && withGps.lng != null) {
      setFix({ lat: withGps.lat, lng: withGps.lng, accuracy: null, source: "photo_metadata" });
      setGpsNote("Location taken from the photo. Move the pin if this is not where it was taken.");
    } else if (source === "gallery") {
      readGps();
      setGpsNote("No location in the photo. Is this where it was taken? Move the pin if not.");
    } else if (!fix) {
      readGps();
    }
  }

  function addVideo(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Video must be 5 MB or smaller.");
      return;
    }
    if (photos.some((item) => item.media === "video")) {
      setError("One short video per report. Remove the current one to replace it.");
      return;
    }
    setError("");
    setPhotos((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        source: "gallery",
        media: "video",
        original: file,
        stamped: file,
        capturedAt: new Date().toISOString(),
        lat: null,
        lng: null,
        locationSource: null,
      },
    ]);
  }

  const usingOther = areaId === "__other__";
  const ready =
    photos.some((item) => item.media !== "video") &&
    cityId &&
    categoryId &&
    description.trim() &&
    title.trim() &&
    fix &&
    ((areaId && !usingOther) || otherArea.trim());

  async function submit() {
    if (!ready || !fix) return;
    setPending(true);
    setError("");
    const item = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      cityId,
      areaId: usingOther ? null : areaId || null,
      areaOther: otherArea,
      wardId: wardId || null,
      categoryId,
      severity,
      title: title.trim(),
      description: description.trim(),
      details,
      remarks,
      landmark,
      address: landmark,
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: fix.accuracy,
      locationSource: fix.source,
      capturedAt: photos[0]?.capturedAt ?? new Date().toISOString(),
      photos: photos.map((photo) => ({
        id: photo.id,
        source: photo.source,
        media: photo.media,
        original: photo.original,
        stamped: photo.stamped,
        capturedAt: photo.capturedAt,
      })),
    };
    await enqueue(item);
    if (areaId && !usingOther) await cachePut("last-area", areaId);
    const result = await flushQueue();
    setPending(false);
    if (result.failed > 0 && result.uploaded === 0) {
      router.push("/field");
      return;
    }
    router.push("/field");
  }

  return (
    <div className="space-y-4 pb-6">
      <h1 className="font-display text-4xl text-pine">New report</h1>
      <p className="text-sm text-ink-soft">{photoCount} of 10 photos. You can add at least 5, and one short video up to 5 MB.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="panel flex min-h-24 items-center justify-center text-center">
          Take photo
          <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { addFiles(e.target.files, "camera"); e.target.value = ""; }} />
        </label>
        <label className="panel flex min-h-24 items-center justify-center text-center">
          Choose from gallery
          <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files, "gallery"); e.target.value = ""; }} />
        </label>
      </div>
      <label className="panel flex min-h-16 items-center justify-center text-center">
        Add short video
        <input className="sr-only" type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => { addVideo(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <div className="flex gap-2 overflow-x-auto">
        {photos.map((photo) => (
          <div key={photo.id} className="relative">
            {photo.media === "video" ? (
              <video src={URL.createObjectURL(photo.original)} className="h-24 w-24 rounded-xl object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={URL.createObjectURL(photo.stamped)} className="h-24 w-24 rounded-xl object-cover" />
            )}
            <button className="absolute right-1 top-1 rounded-full bg-ink px-2 text-xs text-paper" type="button" onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
      {denied ? (
        <div className="panel p-4 text-sm leading-relaxed">
          <p className="font-medium">Turn location on</p>
          <p className="mt-1 text-ink-soft">Android Chrome: lock icon → Permissions → Location. iPhone Safari: Settings → Safari → Location, or Settings → Privacy → Location Services.</p>
          <button className="mt-3 underline" type="button" onClick={readGps}>Try again</button>
        </div>
      ) : null}
      <IssueMap
        height={180}
        center={fix ? [fix.lng, fix.lat] : [73.8567, 18.5204]}
        points={[]}
        pin={fix ? [fix.lng, fix.lat] : null}
        onPin={(lng, lat) => setFix({ lat, lng, accuracy: fix?.accuracy ?? null, source: "manual_pin" })}
      />
      <p className="text-sm text-ink-soft">{gpsNote || "Pin shows where this issue is."}</p>
      {fix && fix.accuracy != null && fix.accuracy > 50 ? (
        <button className="text-sm text-signal" type="button" onClick={() => setGpsNote(`Using ±${Math.round(fix.accuracy ?? 0)} m anyway`)}>
          Proceed anyway
        </button>
      ) : null}

      <label className="block">
        <span className="field-label">City</span>
        <select className="field-input" value={cityId} onChange={(e) => { setCityId(e.target.value); setAreaId(""); }}>
          <option value="">Select</option>
          {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Area</span>
        <input className="field-input" placeholder="Search, try kot" value={areaQuery} onChange={(e) => setAreaQuery(e.target.value)} />
        <select className="field-input mt-2" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Select</option>
          {cityAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          <option value="__other__">Other – not in list</option>
        </select>
      </label>
      {usingOther ? (
        <label className="block">
          <span className="field-label">Area name</span>
          <input className="field-input" value={otherArea} onChange={(e) => setOtherArea(e.target.value)} />
        </label>
      ) : null}
      <label className="block">
        <span className="field-label">Ward</span>
        <select className="field-input" value={wardId} onChange={(e) => setWardId(e.target.value)}>
          <option value="">None</option>
          {wards.filter((ward) => ward.city_id === cityId).map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
        </select>
      </label>
      <div>
        <p className="field-label">Category</p>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((item) => (
            <button key={item.id} type="button" className={`rounded-xl border px-3 py-3 text-left text-sm ${categoryId === item.id ? "border-signal bg-signal" : "border-line bg-paper-2"}`} style={{ color: categoryId === item.id ? "#fffaf3" : "#1c1915" }} onClick={() => setCategoryId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="field-label">Severity — your judgement</p>
        <div className="grid grid-cols-4 gap-2">
          {SEVERITIES.map((item) => (
            <button key={item} type="button" className={`rounded-xl py-3 text-sm capitalize ${severity === item ? "bg-pine" : "border border-line bg-paper-2"}`} style={{ color: severity === item ? "#fffaf3" : "#1c1915" }} onClick={() => setSeverity(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="field-label">Title</span>
        <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block">
        <span className="field-label">Description</span>
        <textarea className="field-input min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {category?.detail_fields?.map((field) => (
        <label key={field.key} className="block">
          <span className="field-label">{field.label}</span>
          {field.type === "select" ? (
            <select className="field-input" value={details[field.key] ?? ""} onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}>
              <option value="">Optional</option>
              {field.options?.map((option) => <option key={option}>{option}</option>)}
            </select>
          ) : (
            <input className="field-input" value={details[field.key] ?? ""} onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })} />
          )}
        </label>
      ))}
      <label className="block">
        <span className="field-label">Landmark</span>
        <input className="field-input" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
      </label>
      <label className="block">
        <span className="field-label">Remarks</span>
        <input className="field-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </label>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      <button className="w-full rounded-2xl bg-signal py-4 text-lg text-signal-ink disabled:opacity-40" type="button" disabled={!ready || pending} onClick={submit}>
        {pending ? "Saving…" : "Submit"}
      </button>
    </div>
  );
}
