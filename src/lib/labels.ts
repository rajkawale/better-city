export function isVideoPath(path: string) {
  return /\.(mp4|mov|webm|m4v)$/i.test(path);
}

export function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function daysOpen(from: string, status: string) {
  if (status === "resolved" || status === "closed") return null;
  const ms = Date.now() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function titleFrom(category: string, area: string) {
  return `${category} – ${area}`.slice(0, 120);
}
