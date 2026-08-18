import { addDays, endOfWeek, format as formatDateFns, startOfWeek } from "date-fns";

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
  return parseDateOnly(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function parseDateOnly(iso: string): Date {
  const p = nums(iso, "-");
  return new Date(at(p, 0), at(p, 1) - 1, at(p, 2));
}

export function isValidDateOnly(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = parseDateOnly(iso);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === iso;
}

export function toIsoDate(date: Date): string {
  return formatDateFns(date, "yyyy-MM-dd");
}

export function getWeekBounds(
  iso: string,
  weekStartsOn: 0 | 1 = 1,
): {
  start: string;
  end: string;
} {
  const date = parseDateOnly(iso);
  return {
    start: toIsoDate(startOfWeek(date, { weekStartsOn })),
    end: toIsoDate(endOfWeek(date, { weekStartsOn })),
  };
}

export function shiftDate(iso: string, days: number): string {
  return toIsoDate(addDays(parseDateOnly(iso), days));
}

export function formatWeekRange(start: string, end: string): string {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    return `${formatDateFns(startDate, "MMM d")}–${formatDateFns(endDate, "d, yyyy")}`;
  }

  return `${formatDateFns(startDate, "MMM d")}–${formatDateFns(endDate, "MMM d, yyyy")}`;
}

export function formatDayHeading(iso: string): string {
  return formatDateFns(parseDateOnly(iso), "EEE, MMM d");
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
