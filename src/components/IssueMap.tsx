"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity: string;
  color: string;
};

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function IssueMap({
  points,
  center,
  height = 280,
  onSelect,
  pin,
  onPin,
}: {
  points: MapPoint[];
  center: [number, number];
  height?: number;
  onSelect?: (id: string) => void;
  pin?: [number, number] | null;
  onPin?: (lng: number, lat: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center,
      zoom: points.length ? 12 : 13,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("issues", {
        type: "geojson",
        cluster: true,
        clusterRadius: 48,
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "issues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1d3a32",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "issues",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": "#f3eee4" },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "issues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fffaf3",
        },
      });
      map.on("click", "points", (event: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id;
        if (typeof id === "string") onSelect?.(id);
      });
      if (onPin) {
        map.on("click", (event: maplibregl.MapMouseEvent) => {
          const features = map.queryRenderedFeatures(event.point, { layers: ["points", "clusters"] });
          if (features.length) return;
          onPin(event.lngLat.lng, event.lngLat.lat);
        });
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Map instance is created once; data updates flow through the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource("issues") as maplibregl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        properties: { id: point.id, title: point.title, color: point.color },
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      })),
    });
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pin) return;
    const existing = map.getSource("draft-pin") as maplibregl.GeoJSONSource | undefined;
    const data: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: pin },
    };
    if (existing) existing.setData(data);
    else if (map.isStyleLoaded()) {
      map.addSource("draft-pin", { type: "geojson", data });
      map.addLayer({
        id: "draft-pin",
        type: "circle",
        source: "draft-pin",
        paint: { "circle-color": "#c4531a", "circle-radius": 9, "circle-stroke-width": 3, "circle-stroke-color": "#fffaf3" },
      });
    }
  }, [pin]);

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-2xl border border-line" />;
}

export function severityColor(severity: string) {
  if (severity === "critical") return "#9d2c2c";
  if (severity === "high") return "#b8611a";
  if (severity === "medium") return "#8a6a1d";
  return "#3d6248";
}
