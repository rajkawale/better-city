"use client";

import { IssueMap, severityColor } from "@/components/IssueMap";

export function ShowMap({ points }: { points: { id: string; lat: number; lng: number; title: string; severity: string }[] }) {
  return (
    <IssueMap
      height={420}
      center={points[0] ? [points[0].lng, points[0].lat] : [73.8567, 18.5204]}
      points={points.map((point) => ({ ...point, color: severityColor(point.severity) }))}
      onSelect={(id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
    />
  );
}
