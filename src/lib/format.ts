import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format as formatDateFns,
  startOfWeek,
} from "date-fns";

export type TrackerPeriodUnit = "day" | "week" | "custom";

export type TrackerPeriod = {
  unit: TrackerPeriodUnit;
  startDate: string;
  endDate: string;
};

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

export function listDateRange(start: string, end: string): string[] {
  const length = differenceInCalendarDays(parseDateOnly(end), parseDateOnly(start));
  if (length < 0) return [];
  return Array.from({ length: length + 1 }, (_, index) => shiftDate(start, index));
}

export function shiftTrackerPeriod(
  period: TrackerPeriod,
  amount: number,
  weekStartsOn: 0 | 1 = 1,
): TrackerPeriod {
  if (period.unit === "day") {
    const date = shiftDate(period.startDate, amount);
    return { unit: "day", startDate: date, endDate: date };
  }

  if (period.unit === "week") {
    const startDate = shiftDate(period.startDate, amount * 7);
    const week = getWeekBounds(startDate, weekStartsOn);
    return { unit: "week", startDate: week.start, endDate: week.end };
  }

  const span =
    differenceInCalendarDays(parseDateOnly(period.endDate), parseDateOnly(period.startDate)) + 1;
  const startDate = shiftDate(period.startDate, amount * span);
  const endDate = shiftDate(period.endDate, amount * span);
  return { unit: "custom", startDate, endDate };
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

export function formatCompactDateRange(start: string, end: string): string {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    return `${formatDateFns(startDate, "MMM d")}–${formatDateFns(endDate, "d")}`;
  }

  if (sameYear) {
    return `${formatDateFns(startDate, "MMM d")}–${formatDateFns(endDate, "MMM d")}`;
  }

  return `${formatDateFns(startDate, "MMM d, yyyy")}–${formatDateFns(endDate, "MMM d, yyyy")}`;
}

export function formatDateRange(start: string, end: string): string {
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (start === end) return formatDateFns(startDate, "MMM d, yyyy");
  if (sameMonth) return `${formatDateFns(startDate, "MMM d")}–${formatDateFns(endDate, "d, yyyy")}`;
  return `${formatDateFns(startDate, "MMM d, yyyy")}–${formatDateFns(endDate, "MMM d, yyyy")}`;
}

export function formatTrackerPeriodLabel(
  period: TrackerPeriod,
  today: string,
  weekStartsOn: 0 | 1 = 1,
): string {
  if (period.unit === "custom") return formatDateRange(period.startDate, period.endDate);

  if (period.unit === "day") {
    return period.startDate === today
      ? "Today"
      : formatDateFns(parseDateOnly(period.startDate), "MMM d, yyyy");
  }

  if (period.unit === "week") {
    const currentWeek = getWeekBounds(today, weekStartsOn);
    if (period.startDate === currentWeek.start) return "This week";
    return formatWeekRange(period.startDate, period.endDate);
  }

  return "Custom range";
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
