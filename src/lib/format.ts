function nums(value: string, sep: string): number[] {
  return value.split(sep).map((p) => Number(p) || 0);
}

function at(list: number[], index: number): number {
  return list[index] ?? 0;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatHours(seconds: number): string {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function formatDate(iso: string): string {
  const p = nums(iso, "-");
  return new Date(at(p, 0), at(p, 1) - 1, at(p, 2)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(iso: string): string {
  const p = nums(iso, "-");
  return new Date(at(p, 0), at(p, 1) - 1, at(p, 2)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function minutesBetween(start: string, end: string): number {
  const s = nums(start, ":");
  const e = nums(end, ":");
  return Math.max(0, at(e, 0) * 60 + at(e, 1) - (at(s, 0) * 60 + at(s, 1)));
}

export function addSecondsToTime(start: string, seconds: number): string {
  const s = nums(start, ":");
  const total = at(s, 0) * 60 + at(s, 1) + Math.round(seconds / 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
