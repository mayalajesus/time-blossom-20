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
import type { Locale } from "./i18n";

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

export function formatDuration(seconds: number, locale: Locale = "en-US"): string {
  const units =
    locale === "pt-BR"
      ? { second: "s", minute: "min", hour: "h" }
      : { second: "s", minute: "m", hour: "h" };
  if (seconds > 0 && seconds < 60) return `${Math.floor(seconds)}${units.second}`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}${units.minute}`;
  return `${h}${units.hour} ${String(m).padStart(2, "0")}${units.minute}`;
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

export function formatDate(iso: string, locale: Locale = "en-US"): string {
  return parseDateOnly(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(iso: string, locale: Locale = "en-US"): string {
  return parseDateOnly(iso).toLocaleDateString(locale, {
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

export function formatReportPeriod(range: DateRange, locale: Locale = "en-US"): string {
  return formatDateRange(range.startDate, range.endDate, locale);
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

  const unitValue = normalized.match(/^(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (unitValue && (unitValue[1] || unitValue[2] || unitValue[3])) {
    const hours = Number((unitValue[1] ?? "0").replace(",", "."));
    const minutes = Number(unitValue[2] ?? "0");
    const seconds = Number(unitValue[3] ?? "0");
    const total = Math.round(hours * 3600 + minutes * 60 + seconds);
    return Number.isSafeInteger(total) && total > 0 ? total : null;
  }

  const clockValue = normalized.match(/^(\d{1,5}):(\d{2})(?::(\d{2}))?$/);
  if (clockValue) {
    const hours = Number(clockValue[1]);
    const minutes = Number(clockValue[2]);
    const seconds = Number(clockValue[3] ?? "0");
    if (minutes > 59 || seconds > 59) return null;
    const total = hours * 3600 + minutes * 60 + seconds;
    return Number.isSafeInteger(total) && total > 0 ? total : null;
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

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedDateTimeParts(reference: Date, timeZone: string): ZonedDateTimeParts | null {
  try {
    let formatter = zonedDateTimeFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
      zonedDateTimeFormatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(reference);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
    const result = {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
      second: value("second"),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

export function dateTimeToTimestamp(
  date: string,
  time: string,
  seconds = 0,
  timeZone?: string,
): number | null {
  const minutes = timeToMinutes(time);
  if (minutes === null || !isValidDateOnly(date) || !Number.isFinite(seconds)) return null;
  const parsed = parseDateOnly(date);
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  if (timeZone) {
    const desired = {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      second: wholeSeconds,
    };
    const desiredAsUtc = Date.UTC(
      desired.year,
      desired.month - 1,
      desired.day,
      desired.hour,
      desired.minute,
      desired.second,
    );
    let timestamp = desiredAsUtc;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const observed = zonedDateTimeParts(new Date(timestamp), timeZone);
      if (!observed) return null;
      const observedAsUtc = Date.UTC(
        observed.year,
        observed.month - 1,
        observed.day,
        observed.hour,
        observed.minute,
        observed.second,
      );
      const adjustment = desiredAsUtc - observedAsUtc;
      timestamp += adjustment;
      if (adjustment === 0) break;
    }
    return timestamp;
  }
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    wholeSeconds,
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

export function formatWeekRange(start: string, end: string, locale: Locale = "en-US"): string {
  return `${formatDate(start, locale)}–${formatDate(end, locale)}`;
}

export function formatCompactDateRange(
  start: string,
  end: string,
  locale: Locale = "en-US",
): string {
  return `${formatDate(start, locale)}–${formatDate(end, locale)}`;
}

export function formatDateRange(start: string, end: string, locale: Locale = "en-US"): string {
  return start === end
    ? parseDateOnly(start).toLocaleDateString(locale, { dateStyle: "medium" })
    : `${parseDateOnly(start).toLocaleDateString(locale, { dateStyle: "medium" })}–${parseDateOnly(end).toLocaleDateString(locale, { dateStyle: "medium" })}`;
}

export function formatTrackerPeriodLabel(
  period: TrackerPeriod,
  today: string,
  weekStartsOn: 0 | 1 = 1,
  locale: Locale = "en-US",
): string {
  if (period.unit === "custom") return formatDateRange(period.startDate, period.endDate, locale);

  if (period.unit === "day") {
    return period.startDate === today ? "Today" : formatDate(period.startDate, locale);
  }

  if (period.unit === "week") {
    const currentWeek = getWeekBounds(today, weekStartsOn);
    if (period.startDate === currentWeek.start) return "This week";
    return formatWeekRange(period.startDate, period.endDate, locale);
  }

  return "Custom range";
}

export function formatDayHeading(iso: string, locale: Locale = "en-US"): string {
  return parseDateOnly(iso).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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

export function nowTime(timeZone?: string, reference = new Date()): string {
  if (timeZone) {
    const parts = zonedDateTimeParts(reference, timeZone);
    if (parts) {
      return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
    }
  }
  return formatLocalTime(reference);
}

export function getLocalToday(reference = new Date(), timeZone?: string): string {
  if (timeZone) {
    const parts = zonedDateTimeParts(reference, timeZone);
    if (parts) {
      return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    }
  }
  return toIsoDate(reference);
}

export function formatLocalDateTime(reference = new Date(), locale: Locale = "en-US"): string {
  return reference.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

function formatLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function getManualEntryDefaults(
  reference = new Date(),
  timeZone?: string,
): {
  date: string;
  start: string;
  end: string;
  endDate: string;
} {
  const startReference = new Date(reference.getTime() - 60 * 60 * 1000);

  return {
    date: getLocalToday(startReference, timeZone),
    start: nowTime(timeZone, startReference),
    end: nowTime(timeZone, reference),
    endDate: getLocalToday(reference, timeZone),
  };
}
