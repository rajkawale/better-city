import exifr from "exifr";
import type { LocationSource, PhotoSource } from "@/lib/types";

export type PreparedPhoto = {
  id: string;
  source: PhotoSource;
  media: "photo" | "video";
  original: Blob;
  stamped: Blob;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  locationSource: LocationSource | null;
};

function stampCanvas(
  bitmap: ImageBitmap,
  lines: string[],
) {
  const maxEdge = 2000;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const bar = 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + bar;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  ctx.fillStyle = "rgba(28, 25, 21, 0.88)";
  ctx.fillRect(0, height, width, bar);
  ctx.fillStyle = "#f6f1e7";
  ctx.font = "600 18px Outfit, sans-serif";
  lines.forEach((line, index) => {
    ctx.fillText(line, 16, height + 28 + index * 24);
  });
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not stamp photo"))),
      "image/jpeg",
      0.82,
    );
  });
}

export async function preparePhoto(file: File, source: PhotoSource): Promise<PreparedPhoto> {
  const exif = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate"] }).catch(() => null);
  const capturedAt = exif?.DateTimeOriginal
    ? new Date(exif.DateTimeOriginal).toISOString()
    : exif?.CreateDate
      ? new Date(exif.CreateDate).toISOString()
      : source === "camera"
        ? new Date().toISOString()
        : new Date().toISOString();
  const lat = typeof exif?.latitude === "number" ? exif.latitude : null;
  const lng = typeof exif?.longitude === "number" ? exif.longitude : null;
  const bitmap = await createImageBitmap(file);
  const when = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(capturedAt));
  const where = lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Location pending";
  const stamped = await stampCanvas(bitmap, [when, where]);
  bitmap.close();
  const original = file.size > 2_500_000 ? stamped : file;
  return {
    id: crypto.randomUUID(),
    source,
    media: "photo",
    original,
    stamped,
    capturedAt,
    lat,
    lng,
    locationSource: lat != null && lng != null ? "photo_metadata" : null,
  };
}

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
