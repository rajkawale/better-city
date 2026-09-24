import { openDB, type DBSchema } from "idb";
import type { LocationSource, PhotoSource, Severity } from "@/lib/types";

export type QueuedPhoto = {
  id: string;
  source: PhotoSource;
  media?: "photo" | "video";
  original: Blob;
  stamped: Blob;
  capturedAt: string;
};

export type QueuedReport = {
  id: string;
  createdAt: string;
  cityId: string;
  areaId: string | null;
  areaOther: string;
  wardId: string | null;
  categoryId: string;
  severity: Severity;
  title: string;
  description: string;
  details: Record<string, string>;
  remarks: string;
  landmark: string;
  address: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  locationSource: LocationSource;
  capturedAt: string;
  photos: QueuedPhoto[];
};

interface FieldDB extends DBSchema {
  queue: { key: string; value: QueuedReport };
  cache: { key: string; value: unknown };
}

const DB_NAME = "better-city";

function db() {
  return openDB<FieldDB>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore("queue");
      database.createObjectStore("cache");
    },
  });
}

export async function enqueue(report: QueuedReport) {
  const database = await db();
  await database.put("queue", report, report.id);
}

export async function listQueue() {
  const database = await db();
  return database.getAll("queue");
}

export async function removeQueued(id: string) {
  const database = await db();
  await database.delete("queue", id);
}

export async function cachePut(key: string, value: unknown) {
  const database = await db();
  await database.put("cache", value, key);
}

export async function cacheGet<T>(key: string) {
  const database = await db();
  return (await database.get("cache", key)) as T | undefined;
}

export async function pendingCount() {
  const database = await db();
  return database.count("queue");
}
