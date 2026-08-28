import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  endOfMonth,
  endOfYear,
  format as formatDateFns,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type TrackerPeriodUnit = "day" | "week" | "custom";

export type TrackerPeriod = {
  unit: TrackerPeriodUnit;
  startDate: string;
  endDate: string;
};

export type ReportPeriodPreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "last-two-weeks"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year"
  | "custom";

export type DateRange = {
  startDate: string;
  endDate: string;
};

export const reportPeriodPresets: Array<{ id: ReportPeriodPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "last-two-weeks", label: "Last 2 weeks" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "this-year", label: "This year" },
  { id: "last-year", label: "Last year" },
  { id: "custom", label: "Custom range" },
];

function nums(value: string, sep: string): number[] {
  return value.split(sep).map((p) => Number(p) || 0);
}

function at(list: number[], index: number): number {
  return list[index] ?? 0;
}

export function formatDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return `${Math.floor(seconds)}s`;
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

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
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

export function getMonthBounds(iso: string): DateRange {
  const date = parseDateOnly(iso);
  return {
    startDate: toIsoDate(startOfMonth(date)),
    endDate: toIsoDate(endOfMonth(date)),
  };
}

export function getYearBounds(iso: string): DateRange {
  const date = parseDateOnly(iso);
  return {
    startDate: toIsoDate(startOfYear(date)),
    endDate: toIsoDate(endOfYear(date)),
  };
}

export function getReportPeriodRange(
  preset: ReportPeriodPreset,
  today: string,
  weekStartsOn: 0 | 1 = 1,
): DateRange {
  if (preset === "today") return { startDate: today, endDate: today };
  if (preset === "yesterday") {
    const date = shiftDate(today, -1);
    return { startDate: date, endDate: date };
  }

  const currentWeek = getWeekBounds(today, weekStartsOn);
  if (preset === "this-week") {
    return { startDate: currentWeek.start, endDate: currentWeek.end };
  }
  if (preset === "last-week") {
    const startDate = shiftDate(currentWeek.start, -7);
    const previousWeek = getWeekBounds(startDate, weekStartsOn);
    return { startDate: previousWeek.start, endDate: previousWeek.end };
  }
  if (preset === "last-two-weeks") {
    return { startDate: shiftDate(currentWeek.start, -7), endDate: currentWeek.end };
  }

  const currentMonth = getMonthBounds(today);
  if (preset === "this-month") return currentMonth;
  if (preset === "last-month") {
    const startDate = shiftDate(currentMonth.startDate, -1);
    return getMonthBounds(startDate);
  }

  const currentYear = getYearBounds(today);
  if (preset === "this-year") return currentYear;
  if (preset === "last-year") {
    const startDate = shiftDate(currentYear.startDate, -1);
    return getYearBounds(startDate);
  }

  return { startDate: currentWeek.start, endDate: currentWeek.end };
}

export function formatReportPeriod(range: DateRange): string {
  return formatDateRange(range.startDate, range.endDate);
}

export function shiftDate(iso: string, days: number): string {
  return toIsoDate(addDays(parseDateOnly(iso), days));
}

export function timeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function parseDurationInput(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) return null;

  const secondsWithUnit = normalized.match(/^(\d+)s$/);
  if (secondsWithUnit) {
    const seconds = Number(secondsWithUnit[1]);
    return seconds > 0 ? seconds : null;
  }

  const hoursWithUnit = normalized.match(/^(\d+(?:[.,]\d+)?)h$/);
  if (hoursWithUnit) {
    const hours = hoursWithUnit[1];
    if (!hours) return null;
    const seconds = Math.round(Number(hours.replace(",", ".")) * 3600);
    return seconds > 0 ? seconds : null;
  }

  const clockValue = normalized.match(/^(\d{1,5}):(\d{2})$/);
  if (clockValue) {
    const hours = Number(clockValue[1]);
    const minutes = Number(clockValue[2]);
    if (minutes > 59) return null;
    const total = (hours * 60 + minutes) * 60;
    return total > 0 ? total : null;
  }

  const decimalHours = normalized.match(/^(\d+)[.,](\d{1,2})$/);
  if (decimalHours) {
    const total = Math.round(Number(normalized.replace(",", ".")) * 3600);
    return total > 0 ? total : null;
  }

  if (!/^\d{1,6}$/.test(normalized)) return null;
  const hours = normalized.length <= 2 ? 0 : Number(normalized.slice(0, -2));
  const minutes = normalized.length <= 2 ? Number(normalized) : Number(normalized.slice(-2));
  if (minutes > 59) return null;
  const total = (hours * 60 + minutes) * 60;
  return total > 0 ? total : null;
}

export function formatDurationInput(seconds: number): string {
  if (seconds > 0 && seconds % 60 !== 0) return `${Math.floor(seconds)}s`;
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

export function getDayOffset(startDate: string, endDate: string): number {
  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) return 0;
  return Math.max(0, differenceInCalendarDays(parseDateOnly(endDate), parseDateOnly(startDate)));
}

type TimeEntryDateShape = {
  date: string;
  start: string;
  end: string;
  endDate?: string | undefined;
  startTimestamp?: number | undefined;
  endTimestamp?: number | undefined;
  seconds?: number | undefined;
};

export function dateTimeToTimestamp(date: string, time: string, seconds = 0): number | null {
  const minutes = timeToMinutes(time);
  if (minutes === null || !isValidDateOnly(date) || !Number.isFinite(seconds)) return null;
  const parsed = parseDateOnly(date);
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    Math.max(0, Math.floor(seconds)),
    0,
  ).getTime();
}

export function getEndDateForEntry(entry: TimeEntryDateShape): string {
  if (entry.endDate && isValidDateOnly(entry.endDate)) return entry.endDate;

  if (typeof entry.seconds === "number" && entry.seconds >= 24 * 60 * 60) {
    const startMinutes = timeToMinutes(entry.start) ?? 0;
    const durationMinutes = Math.max(0, Math.round(entry.seconds / 60));
    return shiftDate(entry.date, Math.floor((startMinutes + durationMinutes) / (24 * 60)));
  }

  const startMinutes = timeToMinutes(entry.start);
  const endMinutes = timeToMinutes(entry.end);
  return startMinutes !== null && endMinutes !== null && endMinutes < startMinutes
    ? shiftDate(entry.date, 1)
    : entry.date;
}

export function getEntryEndDayOffset(entry: TimeEntryDateShape): number {
  return getDayOffset(entry.date, getEndDateForEntry(entry));
}

export function getEndDateForClockRange(
  startDate: string,
  start: string,
  end: string,
  existingEndDate?: string | undefined,
): string {
  if (
    start === end &&
    existingEndDate &&
    isValidDateOnly(existingEndDate) &&
    existingEndDate > startDate
  ) {
    return existingEndDate;
  }

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return startMinutes !== null && endMinutes !== null && endMinutes < startMinutes
    ? shiftDate(startDate, 1)
    : startDate;
}

export function getElapsedMinutes(
  startDate: string,
  start: string,
  endDate: string,
  end: string,
): number {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (
    startMinutes === null ||
    endMinutes === null ||
    !isValidDateOnly(startDate) ||
    !isValidDateOnly(endDate) ||
    endDate < startDate
  ) {
    return 0;
  }

  return Math.max(0, getDayOffset(startDate, endDate) * 24 * 60 + endMinutes - startMinutes);
}

export function getElapsedSeconds(entry: TimeEntryDateShape): number {
  if (
    typeof entry.startTimestamp === "number" &&
    typeof entry.endTimestamp === "number" &&
    Number.isFinite(entry.startTimestamp) &&
    Number.isFinite(entry.endTimestamp) &&
    entry.endTimestamp >= entry.startTimestamp
  ) {
    return Math.max(0, Math.round((entry.endTimestamp - entry.startTimestamp) / 1000));
  }

  const endDate = getEndDateForEntry(entry);
  return getElapsedMinutes(entry.date, entry.start, endDate, entry.end) * 60;
}

export function addMinutesToDateTime(
  startDate: string,
  start: string,
  minutes: number,
): { endDate: string; end: string } {
  const startMinutes = timeToMinutes(start) ?? 0;
  const totalMinutes = Math.max(0, startMinutes + Math.round(minutes));
  const endDate = shiftDate(startDate, Math.floor(totalMinutes / (24 * 60)));
  const endMinutes = totalMinutes % (24 * 60);
  return {
    endDate,
    end: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(
      endMinutes % 60,
    ).padStart(2, "0")}`,
  };
}

export function addSecondsToDateTime(
  startDate: string,
  start: string,
  seconds: number,
): { endDate: string; end: string } {
  return addMinutesToDateTime(startDate, start, Math.floor(seconds / 60));
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
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  if (endMinutes === startMinutes) return 0;
  return endMinutes > startMinutes
    ? endMinutes - startMinutes
    : 24 * 60 - startMinutes + endMinutes;
}

export function addSecondsToTime(start: string, seconds: number): string {
  return addSecondsToDateTime("2000-01-01", start, seconds).end;
}

export function nowTime(): string {
  return formatLocalTime(new Date());
}

export function getLocalToday(reference = new Date()): string {
  return toIsoDate(reference);
}

export function formatLocalDateTime(reference = new Date()): string {
  return `${getLocalToday(reference)} ${formatLocalTime(reference)}`;
}

function formatLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function getManualEntryDefaults(reference = new Date()): {
  date: string;
  start: string;
  end: string;
  endDate: string;
} {
  const startReference = new Date(reference.getTime() - 60 * 60 * 1000);

  return {
    date: toIsoDate(reference),
    start: formatLocalTime(startReference),
    end: formatLocalTime(reference),
    endDate: toIsoDate(reference),
  };
}
