export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "needs_info",
  "duplicate",
  "rejected",
  "verified",
  "reported_to_city",
  "acknowledged",
  "resolved",
  "closed",
] as const;
export type ReportStatus = (typeof STATUSES)[number];

export const SHOWCASE_STATUSES: ReportStatus[] = [
  "verified",
  "reported_to_city",
  "acknowledged",
  "resolved",
  "closed",
];

export const EDITABLE_STATUSES: ReportStatus[] = ["draft", "submitted", "needs_info"];

export type Role = "admin" | "reviewer" | "executive";
export type PhotoSource = "camera" | "gallery";
export type LocationSource = "live_gps" | "photo_metadata" | "manual_pin";
export type PhotoKind = "evidence" | "after";

export type DetailField = {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
};

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  active: boolean;
  must_change_password: boolean;
};

export type City = {
  id: string;
  name: string;
  state: string;
  center_lat: number;
  center_lng: number;
  active: boolean;
};

export type Area = {
  id: string;
  city_id: string;
  ward_id: string | null;
  name: string;
  active: boolean;
};

export type Ward = {
  id: string;
  city_id: string;
  name: string;
  active: boolean;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  detail_fields: DetailField[];
  sort_order: number;
  active: boolean;
};

export type ReportPhoto = {
  id: string;
  report_id: string;
  original_path: string;
  stamped_path: string;
  source: PhotoSource;
  kind: PhotoKind;
  captured_at: string | null;
  lat: number | null;
  lng: number | null;
  sort_order: number;
};

export type Report = {
  id: string;
  city_id: string;
  area_id: string | null;
  area_other_text: string | null;
  ward_id: string | null;
  category_id: string;
  severity: Severity;
  original_severity: Severity;
  title: string;
  description: string;
  details: Record<string, string>;
  remarks: string | null;
  landmark: string | null;
  address: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  location_source: LocationSource;
  captured_at: string;
  uploaded_at: string;
  submitted_by: string;
  status: ReportStatus;
  duplicate_of: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
};

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function severityLabel(severity: string) {
  return severity.slice(0, 1).toUpperCase() + severity.slice(1);
}
