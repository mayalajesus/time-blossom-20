import {
  billableValue,
  billingForEntry,
  currencyOptions,
  type BillingPreference,
  type CurrencyCode,
  type MoneyTotals,
} from "./billing";
import {
  dateTimeToTimestamp,
  getEndDateForEntry,
  getMonthBounds,
  getWeekBounds,
  isValidDateOnly,
  listDateRange,
  shiftDate,
  type DateRange,
} from "./format";
import type { Client, Project, TimeEntry } from "./domain";

export type TemporalGranularity = "day" | "week" | "month";
export type ShiftId = "overnight" | "morning" | "afternoon" | "night";

export const reportShifts: ReadonlyArray<{
  id: ShiftId;
  startHour: number;
  endHour: number;
}> = [
  { id: "overnight", startHour: 0, endHour: 6 },
  { id: "morning", startHour: 6, endHour: 12 },
  { id: "afternoon", startHour: 12, endHour: 18 },
  { id: "night", startHour: 18, endHour: 24 },
];

export type AnalyticsDimension = {
  id: string;
  label: string;
  seconds: number;
  percentage: number;
};

export type ReportMetrics = {
  totalSeconds: number;
  billableSeconds: number;
  internalSeconds: number;
  billablePercentage: number;
  entryCount: number;
  activeDays: number;
  averageSecondsPerActiveDay: number;
  averageEntryDurationSeconds: number;
  longestEntryDurationSeconds: number;
  projectCount: number;
  taskCount: number;
  topProject: AnalyticsDimension | null;
  topClient: AnalyticsDimension | null;
  topTask: AnalyticsDimension | null;
  busiestDay: AnalyticsDimension | null;
  projectBreakdown: AnalyticsDimension[];
  noProjectSeconds: number;
  billableValueByCurrency: MoneyTotals;
};

export type TemporalBucket = {
  key: string;
  granularity: TemporalGranularity;
  startDate: string;
  endDate: string;
  totalSeconds: number;
  billableSeconds: number;
  internalSeconds: number;
  entryCount: number;
};

export type ShiftTemporalBucket = Pick<
  TemporalBucket,
  "key" | "granularity" | "startDate" | "endDate"
> & {
  shifts: Record<ShiftId, number>;
  totalSeconds: number;
};

export type WeekdayActivity = {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  totalSeconds: number;
  occurrences: number;
  activeDays: number;
  averageSeconds: number;
};

export type ActivityDayGroup = {
  seconds: number;
  percentage: number;
  activeDays: number;
  averageSecondsPerActiveDay: number;
};

export type WorkdayWeekendActivity = {
  workdays: ActivityDayGroup;
  weekends: ActivityDayGroup;
};

export type CharacteristicTimes = {
  entryCount: number;
  averageStartSeconds: number;
  averageEndSeconds: number;
  earliestStartSeconds: number;
  latestEndSeconds: number;
};

export type FinancialDimension = {
  id: string;
  label: string;
  billableSeconds: number;
  valueByCurrency: MoneyTotals;
};

export type FinancialTemporalBucket = Pick<
  TemporalBucket,
  "key" | "granularity" | "startDate" | "endDate"
> & {
  valueByCurrency: MoneyTotals;
};

export type ReportFinancialAnalytics = {
  currencies: CurrencyCode[];
  projects: FinancialDimension[];
  clients: FinancialDimension[];
  temporal: FinancialTemporalBucket[];
};

export type ShiftSegment = {
  shift: ShiftId;
  date: string;
  startTimestamp: number;
  endTimestamp: number;
  seconds: number;
};

export type ShiftTotal = {
  shift: ShiftId;
  seconds: number;
  entryCount: number;
};

export type MetricComparison = {
  current: number;
  previous: number;
  delta: number;
  percentageChange: number | null;
};

export type ReportComparison = {
  previousPeriod: DateRange;
  previous: ReportMetrics;
  metrics: {
    totalSeconds: MetricComparison;
    billableSeconds: MetricComparison;
    internalSeconds: MetricComparison;
    billablePercentage: MetricComparison;
    entryCount: MetricComparison;
    activeDays: MetricComparison;
    averageSecondsPerActiveDay: MetricComparison;
    averageEntryDurationSeconds: MetricComparison;
    noProjectSeconds: MetricComparison;
  };
  billableValueByCurrency: Partial<Record<CurrencyCode, MetricComparison>>;
};

export type ReportAnalytics = {
  period: DateRange;
  granularity: TemporalGranularity;
  summary: ReportMetrics;
  temporal: TemporalBucket[];
  previousTemporal: TemporalBucket[];
  shifts: ShiftTotal[];
  shiftTemporal: ShiftTemporalBucket[];
  previousShifts: ShiftTotal[];
  weekdayActivity: WeekdayActivity[];
  workdayWeekend: WorkdayWeekendActivity;
  characteristicTimes: CharacteristicTimes | null;
  financial: ReportFinancialAnalytics;
  comparison: ReportComparison;
};

export type ReportAnalyticsInput = {
  entries: readonly TimeEntry[];
  range: DateRange;
  projects?: readonly Project[];
  clients?: readonly Client[];
  fallbackForEntry: (entry: TimeEntry) => BillingPreference;
  emptyCurrency?: CurrencyCode;
  timeZone?: string;
  weekStartsOn?: 0 | 1;
};

type EntrySlice = {
  entry: TimeEntry;
  entryIndex: number;
  startTimestamp: number;
  endTimestamp: number;
  seconds: number;
};

type DaySlice = EntrySlice & { date: string };

type DimensionAccumulator = {
  id: string;
  label: string;
  seconds: number;
};

const DEFAULT_TIME_ZONE = "UTC";

function finiteTimestamp(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizedDuration(seconds: number): number | null {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function assertRange(range: DateRange): void {
  if (
    !isValidDateOnly(range.startDate) ||
    !isValidDateOnly(range.endDate) ||
    range.endDate < range.startDate
  ) {
    throw new RangeError("Report period must be a valid inclusive date range.");
  }
}

function timestampForDateStart(date: string, timeZone: string): number {
  const timestamp = dateTimeToTimestamp(date, "00:00", 0, timeZone);
  if (timestamp === null) throw new RangeError(`Unable to resolve date ${date}.`);
  return timestamp;
}

function intervalForRange(range: DateRange, timeZone: string): readonly [number, number] {
  assertRange(range);
  return [
    timestampForDateStart(range.startDate, timeZone),
    timestampForDateStart(shiftDate(range.endDate, 1), timeZone),
  ];
}

export function getAnalyticsEntryInterval(
  entry: TimeEntry,
  timeZone = DEFAULT_TIME_ZONE,
): readonly [number, number] | null {
  const timestampStart = finiteTimestamp(entry.startTimestamp);
  const start = timestampStart ?? dateTimeToTimestamp(entry.date, entry.start, 0, timeZone);
  if (start === null) return null;

  const timestampEnd = finiteTimestamp(entry.endTimestamp);
  const duration = normalizedDuration(entry.seconds);
  const durationEnd = duration === null ? null : start + duration * 1_000;
  const clockEnd =
    timestampEnd === null && (timestampStart === null || durationEnd === null)
      ? dateTimeToTimestamp(getEndDateForEntry(entry), entry.end, 0, timeZone)
      : null;
  const end =
    timestampEnd ??
    (timestampStart === null ? (clockEnd ?? durationEnd) : (durationEnd ?? clockEnd));

  return end !== null && end > start ? [start, end] : null;
}

function clippedEntrySlices(
  entries: readonly TimeEntry[],
  range: DateRange | undefined,
  timeZone: string,
): EntrySlice[] {
  const period = range ? intervalForRange(range, timeZone) : null;
  const slices: EntrySlice[] = [];

  entries.forEach((entry, entryIndex) => {
    const interval = getAnalyticsEntryInterval(entry, timeZone);
    if (!interval) return;
    const startTimestamp = period ? Math.max(interval[0], period[0]) : interval[0];
    const endTimestamp = period ? Math.min(interval[1], period[1]) : interval[1];
    if (endTimestamp <= startTimestamp) return;
    slices.push({
      entry,
      entryIndex,
      startTimestamp,
      endTimestamp,
      seconds: (endTimestamp - startTimestamp) / 1_000,
    });
  });

  return slices;
}

const reportDateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function reportDateTimeParts(timestamp: number, timeZone: string): Map<string, string> {
  let formatter = reportDateTimeFormatters.get(timeZone);
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
    reportDateTimeFormatters.set(timeZone, formatter);
  }
  return new Map(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function dateAtTimestamp(timestamp: number, timeZone: string): string {
  const parts = reportDateTimeParts(timestamp, timeZone);
  const year = parts.get("year");
  const month = parts.get("month");
  const day = parts.get("day");
  if (!year || !month || !day) throw new RangeError(`Unable to resolve timestamp ${timestamp}.`);
  return `${year}-${month}-${day}`;
}

function hourAtTimestamp(timestamp: number, timeZone: string): number {
  const hour = Number(reportDateTimeParts(timestamp, timeZone).get("hour"));
  if (!Number.isFinite(hour)) throw new RangeError(`Unable to resolve timestamp ${timestamp}.`);
  return hour;
}

function clockSecondsAtTimestamp(timestamp: number, timeZone: string): number {
  const parts = reportDateTimeParts(timestamp, timeZone);
  const hour = Number(parts.get("hour"));
  const minute = Number(parts.get("minute"));
  const second = Number(parts.get("second"));
  if (![hour, minute, second].every(Number.isFinite)) {
    throw new RangeError(`Unable to resolve timestamp ${timestamp}.`);
  }
  return hour * 3_600 + minute * 60 + second;
}

function splitSliceByDay(slice: EntrySlice, timeZone: string): DaySlice[] {
  const slices: DaySlice[] = [];
  let cursor = slice.startTimestamp;

  while (cursor < slice.endTimestamp) {
    const date = dateAtTimestamp(cursor, timeZone);
    const nextDay = timestampForDateStart(shiftDate(date, 1), timeZone);
    const endTimestamp = Math.min(slice.endTimestamp, nextDay);
    if (endTimestamp <= cursor) break;
    slices.push({
      ...slice,
      date,
      startTimestamp: cursor,
      endTimestamp,
      seconds: (endTimestamp - cursor) / 1_000,
    });
    cursor = endTimestamp;
  }

  return slices;
}

function shiftForHour(hour: number): (typeof reportShifts)[number] {
  return (
    reportShifts.find((shift) => hour >= shift.startHour && hour < shift.endHour) ??
    reportShifts[0]!
  );
}

function splitSliceByShift(slice: EntrySlice, timeZone: string): ShiftSegment[] {
  const segments: ShiftSegment[] = [];
  let cursor = slice.startTimestamp;

  while (cursor < slice.endTimestamp) {
    const date = dateAtTimestamp(cursor, timeZone);
    const shift = shiftForHour(hourAtTimestamp(cursor, timeZone));
    const boundaryDate = shift.endHour === 24 ? shiftDate(date, 1) : date;
    const boundaryHour = shift.endHour === 24 ? 0 : shift.endHour;
    const boundary = dateTimeToTimestamp(
      boundaryDate,
      `${String(boundaryHour).padStart(2, "0")}:00`,
      0,
      timeZone,
    );
    if (boundary === null || boundary <= cursor) break;
    const endTimestamp = Math.min(slice.endTimestamp, boundary);
    segments.push({
      shift: shift.id,
      date,
      startTimestamp: cursor,
      endTimestamp,
      seconds: (endTimestamp - cursor) / 1_000,
    });
    cursor = endTimestamp;
  }

  return segments;
}

export function splitEntryByShift(
  entry: TimeEntry,
  options: { range?: DateRange; timeZone?: string } = {},
): ShiftSegment[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const slice = clippedEntrySlices([entry], options.range, timeZone)[0];
  return slice ? splitSliceByShift(slice, timeZone) : [];
}

function addDimension(
  totals: Map<string, DimensionAccumulator>,
  id: string,
  label: string,
  seconds: number,
): void {
  const current = totals.get(id);
  if (current) current.seconds += seconds;
  else totals.set(id, { id, label, seconds });
}

function topDimension(
  totals: Map<string, DimensionAccumulator>,
  totalSeconds: number,
): AnalyticsDimension | null {
  const top = [...totals.values()].sort(
    (first, second) =>
      second.seconds - first.seconds ||
      first.label.localeCompare(second.label) ||
      first.id.localeCompare(second.id),
  )[0];
  return top
    ? {
        ...top,
        percentage: totalSeconds > 0 ? (top.seconds / totalSeconds) * 100 : 0,
      }
    : null;
}

function dimensionBreakdown(
  totals: Map<string, DimensionAccumulator>,
  totalSeconds: number,
): AnalyticsDimension[] {
  return [...totals.values()]
    .sort(
      (first, second) =>
        second.seconds - first.seconds ||
        first.label.localeCompare(second.label) ||
        first.id.localeCompare(second.id),
    )
    .map((item) => ({
      ...item,
      percentage: totalSeconds > 0 ? (item.seconds / totalSeconds) * 100 : 0,
    }));
}

function billableTotals(
  slices: readonly EntrySlice[],
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
  emptyCurrency?: CurrencyCode,
): MoneyTotals {
  const totals: MoneyTotals = {};

  for (const slice of slices) {
    if (!slice.entry.billable) continue;
    const billing = billingForEntry(slice.entry, fallbackForEntry(slice.entry));
    const value = billableValue({ ...slice.entry, seconds: slice.seconds }, billing);
    totals[billing.currency] = (totals[billing.currency] ?? 0) + value;
  }

  if (Object.keys(totals).length === 0 && emptyCurrency) totals[emptyCurrency] = 0;
  return totals;
}

export function calculateReportMetrics(input: ReportAnalyticsInput): ReportMetrics {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const slices = clippedEntrySlices(input.entries, input.range, timeZone);
  const daySlices = slices.flatMap((slice) => splitSliceByDay(slice, timeZone));
  const projects = new Map((input.projects ?? []).map((project) => [project.id, project]));
  const clients = new Map((input.clients ?? []).map((client) => [client.id, client]));
  const projectTotals = new Map<string, DimensionAccumulator>();
  const clientTotals = new Map<string, DimensionAccumulator>();
  const taskTotals = new Map<string, DimensionAccumulator>();
  const dayTotals = new Map<string, DimensionAccumulator>();
  let totalSeconds = 0;
  let billableSeconds = 0;
  let noProjectSeconds = 0;

  for (const slice of slices) {
    const { entry, seconds } = slice;
    totalSeconds += seconds;
    if (entry.billable) billableSeconds += seconds;
    if (entry.projectId === null) noProjectSeconds += seconds;

    if (entry.projectId) {
      const project = projects.get(entry.projectId);
      addDimension(projectTotals, entry.projectId, project?.name ?? "Unknown project", seconds);
      if (project) {
        const client = clients.get(project.clientId);
        addDimension(clientTotals, project.clientId, client?.name ?? "Unknown client", seconds);
      }
    }

    const taskLabel = entry.task.trim() || "Untitled task";
    addDimension(taskTotals, taskLabel.toLowerCase(), taskLabel, seconds);
  }

  const entryCount = slices.length;
  const activeDays = new Set(daySlices.map((slice) => slice.date)).size;
  const internalSeconds = totalSeconds - billableSeconds;
  for (const slice of daySlices) addDimension(dayTotals, slice.date, slice.date, slice.seconds);
  const projectBreakdown = dimensionBreakdown(projectTotals, totalSeconds);
  if (noProjectSeconds > 0) {
    projectBreakdown.push({
      id: "none",
      label: "No project",
      seconds: noProjectSeconds,
      percentage: totalSeconds > 0 ? (noProjectSeconds / totalSeconds) * 100 : 0,
    });
    projectBreakdown.sort(
      (first, second) =>
        second.seconds - first.seconds ||
        first.label.localeCompare(second.label) ||
        first.id.localeCompare(second.id),
    );
  }

  return {
    totalSeconds,
    billableSeconds,
    internalSeconds,
    billablePercentage: totalSeconds > 0 ? (billableSeconds / totalSeconds) * 100 : 0,
    entryCount,
    activeDays,
    averageSecondsPerActiveDay: activeDays > 0 ? totalSeconds / activeDays : 0,
    averageEntryDurationSeconds: entryCount > 0 ? totalSeconds / entryCount : 0,
    longestEntryDurationSeconds: slices.reduce(
      (longest, slice) => Math.max(longest, slice.seconds),
      0,
    ),
    projectCount: projectTotals.size,
    taskCount: taskTotals.size,
    topProject: topDimension(projectTotals, totalSeconds),
    topClient: topDimension(clientTotals, totalSeconds),
    topTask: topDimension(taskTotals, totalSeconds),
    busiestDay: topDimension(dayTotals, totalSeconds),
    projectBreakdown,
    noProjectSeconds,
    billableValueByCurrency: billableTotals(slices, input.fallbackForEntry, input.emptyCurrency),
  };
}

function sixMonthsAfter(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const targetMonthIndex = month - 1 + 6;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth + 1).padStart(2, "0")}-${String(
    Math.min(day, lastDay),
  ).padStart(2, "0")}`;
}

export function getTemporalGranularity(range: DateRange): TemporalGranularity {
  assertRange(range);
  const days = listDateRange(range.startDate, range.endDate).length;
  if (days <= 31) return "day";
  return range.endDate < sixMonthsAfter(range.startDate) ? "week" : "month";
}

function createTemporalBuckets(
  range: DateRange,
  granularity: TemporalGranularity,
  weekStartsOn: 0 | 1,
): TemporalBucket[] {
  const buckets: TemporalBucket[] = [];
  let cursor = range.startDate;

  while (cursor <= range.endDate) {
    if (granularity === "day") {
      buckets.push({
        key: cursor,
        granularity,
        startDate: cursor,
        endDate: cursor,
        totalSeconds: 0,
        billableSeconds: 0,
        internalSeconds: 0,
        entryCount: 0,
      });
      cursor = shiftDate(cursor, 1);
      continue;
    }

    const weeklyBounds = granularity === "week" ? getWeekBounds(cursor, weekStartsOn) : undefined;
    const monthlyBounds = granularity === "month" ? getMonthBounds(cursor) : undefined;
    const naturalEnd = weeklyBounds?.end ?? monthlyBounds!.endDate;
    const bucketEnd = naturalEnd < range.endDate ? naturalEnd : range.endDate;
    buckets.push({
      key: weeklyBounds?.start ?? cursor.slice(0, 7),
      granularity,
      startDate: cursor,
      endDate: bucketEnd,
      totalSeconds: 0,
      billableSeconds: 0,
      internalSeconds: 0,
      entryCount: 0,
    });
    cursor = shiftDate(bucketEnd, 1);
  }

  return buckets;
}

function temporalKey(date: string, granularity: TemporalGranularity, weekStartsOn: 0 | 1): string {
  if (granularity === "day") return date;
  if (granularity === "week") return getWeekBounds(date, weekStartsOn).start;
  return date.slice(0, 7);
}

export function groupEntriesByTime(
  entries: readonly TimeEntry[],
  options: { range: DateRange; timeZone?: string; weekStartsOn?: 0 | 1 },
): TemporalBucket[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const weekStartsOn = options.weekStartsOn ?? 1;
  const granularity = getTemporalGranularity(options.range);
  const buckets = createTemporalBuckets(options.range, granularity, weekStartsOn);
  return populateTemporalBuckets(entries, options.range, buckets, timeZone);
}

function populateTemporalBuckets(
  entries: readonly TimeEntry[],
  range: DateRange,
  buckets: TemporalBucket[],
  timeZone: string,
): TemporalBucket[] {
  const bucketsByDate = new Map<string, TemporalBucket>();
  for (const bucket of buckets) {
    for (const date of listDateRange(bucket.startDate, bucket.endDate)) {
      bucketsByDate.set(date, bucket);
    }
  }
  const entriesByBucket = new Map<string, Set<number>>();
  const slices = clippedEntrySlices(entries, range, timeZone).flatMap((slice) =>
    splitSliceByDay(slice, timeZone),
  );

  for (const slice of slices) {
    const bucket = bucketsByDate.get(slice.date);
    if (!bucket) continue;
    bucket.totalSeconds += slice.seconds;
    if (slice.entry.billable) bucket.billableSeconds += slice.seconds;
    else bucket.internalSeconds += slice.seconds;
    const bucketEntries = entriesByBucket.get(bucket.key) ?? new Set<number>();
    bucketEntries.add(slice.entryIndex);
    entriesByBucket.set(bucket.key, bucketEntries);
  }

  for (const bucket of buckets) bucket.entryCount = entriesByBucket.get(bucket.key)?.size ?? 0;
  return buckets;
}

function createEquivalentTemporalBuckets(
  currentBuckets: readonly TemporalBucket[],
  periodDays: number,
): TemporalBucket[] {
  return currentBuckets.map((bucket) => {
    const startDate = shiftDate(bucket.startDate, -periodDays);
    const endDate = shiftDate(bucket.endDate, -periodDays);
    return {
      key: startDate,
      granularity: bucket.granularity,
      startDate,
      endDate,
      totalSeconds: 0,
      billableSeconds: 0,
      internalSeconds: 0,
      entryCount: 0,
    };
  });
}

type FinancialDimensionAccumulator = {
  id: string;
  label: string;
  billableSeconds: number;
  valueByCurrency: MoneyTotals;
};

function addFinancialDimension(
  totals: Map<string, FinancialDimensionAccumulator>,
  id: string,
  label: string,
  seconds: number,
  currency: CurrencyCode,
  value: number,
): void {
  const current = totals.get(id) ?? {
    id,
    label,
    billableSeconds: 0,
    valueByCurrency: {},
  };
  current.billableSeconds += seconds;
  current.valueByCurrency[currency] = (current.valueByCurrency[currency] ?? 0) + value;
  totals.set(id, current);
}

function sortFinancialDimensions(
  dimensions: Map<string, FinancialDimensionAccumulator>,
  currencies: readonly CurrencyCode[],
): FinancialDimension[] {
  const currency = currencies.length === 1 ? currencies[0] : null;
  return [...dimensions.values()].sort((first, second) => {
    const firstValue = currency ? (first.valueByCurrency[currency] ?? 0) : first.billableSeconds;
    const secondValue = currency ? (second.valueByCurrency[currency] ?? 0) : second.billableSeconds;
    return (
      secondValue - firstValue ||
      first.label.localeCompare(second.label) ||
      first.id.localeCompare(second.id)
    );
  });
}

export function getReportBillableCurrencies(
  entries: readonly TimeEntry[],
  options: {
    range: DateRange;
    fallbackForEntry: (entry: TimeEntry) => BillingPreference;
    timeZone?: string;
  },
): CurrencyCode[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const currencies = new Set<CurrencyCode>();
  for (const slice of clippedEntrySlices(entries, options.range, timeZone)) {
    if (!slice.entry.billable) continue;
    currencies.add(billingForEntry(slice.entry, options.fallbackForEntry(slice.entry)).currency);
  }
  return currencyOptions.filter((currency) => currencies.has(currency));
}

export function calculateReportFinancialAnalytics(
  input: ReportAnalyticsInput,
): ReportFinancialAnalytics {
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const weekStartsOn = input.weekStartsOn ?? 1;
  const granularity = getTemporalGranularity(input.range);
  const projects = new Map((input.projects ?? []).map((project) => [project.id, project]));
  const clients = new Map((input.clients ?? []).map((client) => [client.id, client]));
  const projectTotals = new Map<string, FinancialDimensionAccumulator>();
  const clientTotals = new Map<string, FinancialDimensionAccumulator>();
  const temporal: FinancialTemporalBucket[] = createTemporalBuckets(
    input.range,
    granularity,
    weekStartsOn,
  ).map((bucket) => ({
    key: bucket.key,
    granularity: bucket.granularity,
    startDate: bucket.startDate,
    endDate: bucket.endDate,
    valueByCurrency: {},
  }));
  const temporalByKey = new Map(temporal.map((bucket) => [bucket.key, bucket]));
  const currencies = new Set<CurrencyCode>();

  for (const slice of clippedEntrySlices(input.entries, input.range, timeZone)) {
    if (!slice.entry.billable) continue;
    const billing = billingForEntry(slice.entry, input.fallbackForEntry(slice.entry));
    const value = billableValue({ ...slice.entry, seconds: slice.seconds }, billing);
    currencies.add(billing.currency);

    const project = slice.entry.projectId ? projects.get(slice.entry.projectId) : undefined;
    const projectId = slice.entry.projectId ?? "none";
    addFinancialDimension(
      projectTotals,
      projectId,
      project?.name ?? (slice.entry.projectId ? "Unknown project" : "No project"),
      slice.seconds,
      billing.currency,
      value,
    );

    const client = project ? clients.get(project.clientId) : undefined;
    const clientId = project?.clientId ?? "none";
    addFinancialDimension(
      clientTotals,
      clientId,
      client?.name ?? (project ? "Unknown client" : "No client"),
      slice.seconds,
      billing.currency,
      value,
    );

    for (const daySlice of splitSliceByDay(slice, timeZone)) {
      const key = temporalKey(daySlice.date, granularity, weekStartsOn);
      const bucket = temporalByKey.get(key);
      if (!bucket) continue;
      const dayValue = billableValue({ ...daySlice.entry, seconds: daySlice.seconds }, billing);
      bucket.valueByCurrency[billing.currency] =
        (bucket.valueByCurrency[billing.currency] ?? 0) + dayValue;
    }
  }

  const sortedCurrencies = currencyOptions.filter((currency) => currencies.has(currency));
  return {
    currencies: sortedCurrencies,
    projects: sortFinancialDimensions(projectTotals, sortedCurrencies),
    clients: sortFinancialDimensions(clientTotals, sortedCurrencies),
    temporal,
  };
}

export function groupEntriesByShift(
  entries: readonly TimeEntry[],
  options: { range?: DateRange; timeZone?: string } = {},
): ShiftTotal[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const totals = new Map<ShiftId, ShiftTotal>(
    reportShifts.map((shift) => [shift.id, { shift: shift.id, seconds: 0, entryCount: 0 }]),
  );
  const entriesByShift = new Map<ShiftId, Set<number>>();

  for (const slice of clippedEntrySlices(entries, options.range, timeZone)) {
    for (const segment of splitSliceByShift(slice, timeZone)) {
      const total = totals.get(segment.shift)!;
      total.seconds += segment.seconds;
      const shiftEntries = entriesByShift.get(segment.shift) ?? new Set<number>();
      shiftEntries.add(slice.entryIndex);
      entriesByShift.set(segment.shift, shiftEntries);
    }
  }

  return reportShifts.map((shift) => {
    const total = totals.get(shift.id)!;
    return { ...total, entryCount: entriesByShift.get(shift.id)?.size ?? 0 };
  });
}

function emptyShiftTotals(): Record<ShiftId, number> {
  return { overnight: 0, morning: 0, afternoon: 0, night: 0 };
}

export function groupEntriesByShiftAndTime(
  entries: readonly TimeEntry[],
  options: { range: DateRange; timeZone?: string; weekStartsOn?: 0 | 1 },
): ShiftTemporalBucket[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const weekStartsOn = options.weekStartsOn ?? 1;
  const granularity = getTemporalGranularity(options.range);
  const buckets: ShiftTemporalBucket[] = createTemporalBuckets(
    options.range,
    granularity,
    weekStartsOn,
  ).map((bucket) => ({
    key: bucket.key,
    granularity: bucket.granularity,
    startDate: bucket.startDate,
    endDate: bucket.endDate,
    shifts: emptyShiftTotals(),
    totalSeconds: 0,
  }));
  const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const slice of clippedEntrySlices(entries, options.range, timeZone)) {
    for (const segment of splitSliceByShift(slice, timeZone)) {
      const key = temporalKey(segment.date, granularity, weekStartsOn);
      const bucket = bucketsByKey.get(key);
      if (!bucket) continue;
      bucket.shifts[segment.shift] += segment.seconds;
      bucket.totalSeconds += segment.seconds;
    }
  }

  return buckets;
}

function weekdayForDate(date: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function calculateWeekdayActivity(
  entries: readonly TimeEntry[],
  options: { range: DateRange; timeZone?: string },
): WeekdayActivity[] {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const weekdays = Array.from({ length: 7 }, (_, weekday) => ({
    weekday: weekday as WeekdayActivity["weekday"],
    totalSeconds: 0,
    occurrences: 0,
    activeDates: new Set<string>(),
  }));

  for (const date of listDateRange(options.range.startDate, options.range.endDate)) {
    weekdays[weekdayForDate(date)]!.occurrences += 1;
  }
  for (const slice of clippedEntrySlices(entries, options.range, timeZone).flatMap((entrySlice) =>
    splitSliceByDay(entrySlice, timeZone),
  )) {
    const item = weekdays[weekdayForDate(slice.date)]!;
    item.totalSeconds += slice.seconds;
    item.activeDates.add(slice.date);
  }

  return weekdays.map(({ activeDates, ...item }) => ({
    ...item,
    activeDays: activeDates.size,
    averageSeconds: item.occurrences > 0 ? item.totalSeconds / item.occurrences : 0,
  }));
}

function activityDayGroup(
  seconds: number,
  activeDays: number,
  totalSeconds: number,
): ActivityDayGroup {
  return {
    seconds,
    percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
    activeDays,
    averageSecondsPerActiveDay: activeDays > 0 ? seconds / activeDays : 0,
  };
}

export function calculateWorkdayWeekendActivity(
  entries: readonly TimeEntry[],
  options: { range: DateRange; timeZone?: string },
): WorkdayWeekendActivity {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  let workdaySeconds = 0;
  let weekendSeconds = 0;
  const activeWorkdays = new Set<string>();
  const activeWeekendDays = new Set<string>();

  for (const slice of clippedEntrySlices(entries, options.range, timeZone).flatMap((entrySlice) =>
    splitSliceByDay(entrySlice, timeZone),
  )) {
    const weekday = weekdayForDate(slice.date);
    if (weekday === 0 || weekday === 6) {
      weekendSeconds += slice.seconds;
      activeWeekendDays.add(slice.date);
    } else {
      workdaySeconds += slice.seconds;
      activeWorkdays.add(slice.date);
    }
  }

  const totalSeconds = workdaySeconds + weekendSeconds;
  return {
    workdays: activityDayGroup(workdaySeconds, activeWorkdays.size, totalSeconds),
    weekends: activityDayGroup(weekendSeconds, activeWeekendDays.size, totalSeconds),
  };
}

function averageClockSeconds(values: readonly number[]): number {
  const fullDay = 24 * 3_600;
  const angles = values.map((value) => (value / fullDay) * Math.PI * 2);
  const sine = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;
  const cosine = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
  if (Math.abs(sine) < Number.EPSILON && Math.abs(cosine) < Number.EPSILON) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  const angle = Math.atan2(sine, cosine);
  return Math.round(
    (((angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2)) * fullDay) % fullDay,
  );
}

export function calculateCharacteristicTimes(
  entries: readonly TimeEntry[],
  options: { range: DateRange; timeZone?: string },
): CharacteristicTimes | null {
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const slices = clippedEntrySlices(entries, options.range, timeZone);
  if (slices.length === 0) return null;

  const starts = slices.map((slice) => clockSecondsAtTimestamp(slice.startTimestamp, timeZone));
  const ends = slices.map((slice) => clockSecondsAtTimestamp(slice.endTimestamp, timeZone));
  return {
    entryCount: slices.length,
    averageStartSeconds: averageClockSeconds(starts),
    averageEndSeconds: averageClockSeconds(ends),
    earliestStartSeconds: Math.min(...starts),
    latestEndSeconds: Math.max(...ends),
  };
}

export function getPreviousEquivalentPeriod(range: DateRange): DateRange {
  assertRange(range);
  const days = listDateRange(range.startDate, range.endDate).length;
  return {
    startDate: shiftDate(range.startDate, -days),
    endDate: shiftDate(range.startDate, -1),
  };
}

function compareMetric(current: number, previous: number): MetricComparison {
  return {
    current,
    previous,
    delta: current - previous,
    percentageChange:
      previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100,
  };
}

function compareReportMetrics(
  current: ReportMetrics,
  previous: ReportMetrics,
  previousPeriod: DateRange,
): ReportComparison {
  const currencies = new Set<CurrencyCode>([
    ...(Object.keys(current.billableValueByCurrency) as CurrencyCode[]),
    ...(Object.keys(previous.billableValueByCurrency) as CurrencyCode[]),
  ]);
  const billableValueByCurrency: Partial<Record<CurrencyCode, MetricComparison>> = {};
  for (const currency of currencies) {
    billableValueByCurrency[currency] = compareMetric(
      current.billableValueByCurrency[currency] ?? 0,
      previous.billableValueByCurrency[currency] ?? 0,
    );
  }

  return {
    previousPeriod,
    previous,
    metrics: {
      totalSeconds: compareMetric(current.totalSeconds, previous.totalSeconds),
      billableSeconds: compareMetric(current.billableSeconds, previous.billableSeconds),
      internalSeconds: compareMetric(current.internalSeconds, previous.internalSeconds),
      billablePercentage: compareMetric(current.billablePercentage, previous.billablePercentage),
      entryCount: compareMetric(current.entryCount, previous.entryCount),
      activeDays: compareMetric(current.activeDays, previous.activeDays),
      averageSecondsPerActiveDay: compareMetric(
        current.averageSecondsPerActiveDay,
        previous.averageSecondsPerActiveDay,
      ),
      averageEntryDurationSeconds: compareMetric(
        current.averageEntryDurationSeconds,
        previous.averageEntryDurationSeconds,
      ),
      noProjectSeconds: compareMetric(current.noProjectSeconds, previous.noProjectSeconds),
    },
    billableValueByCurrency,
  };
}

export function calculateReportAnalytics(input: ReportAnalyticsInput): ReportAnalytics {
  const previousPeriod = getPreviousEquivalentPeriod(input.range);
  const current = calculateReportMetrics(input);
  const previous = calculateReportMetrics({ ...input, range: previousPeriod });
  const granularity = getTemporalGranularity(input.range);
  const periodDays = listDateRange(input.range.startDate, input.range.endDate).length;
  const temporalOptions = {
    range: input.range,
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
    ...(input.weekStartsOn !== undefined ? { weekStartsOn: input.weekStartsOn } : {}),
  };
  const shiftOptions = {
    range: input.range,
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  };
  const activityOptions = {
    range: input.range,
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  };
  const previousShiftOptions = {
    range: previousPeriod,
    ...(input.timeZone ? { timeZone: input.timeZone } : {}),
  };
  const temporal = groupEntriesByTime(input.entries, temporalOptions);
  const previousTemporal = populateTemporalBuckets(
    input.entries,
    previousPeriod,
    createEquivalentTemporalBuckets(temporal, periodDays),
    input.timeZone ?? DEFAULT_TIME_ZONE,
  );

  return {
    period: input.range,
    granularity,
    summary: current,
    temporal,
    previousTemporal,
    shifts: groupEntriesByShift(input.entries, shiftOptions),
    shiftTemporal: groupEntriesByShiftAndTime(input.entries, temporalOptions),
    previousShifts: groupEntriesByShift(input.entries, previousShiftOptions),
    weekdayActivity: calculateWeekdayActivity(input.entries, activityOptions),
    workdayWeekend: calculateWorkdayWeekendActivity(input.entries, activityOptions),
    characteristicTimes: calculateCharacteristicTimes(input.entries, activityOptions),
    financial: calculateReportFinancialAnalytics(input),
    comparison: compareReportMetrics(current, previous, previousPeriod),
  };
}
