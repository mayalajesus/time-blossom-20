import { describe, expect, it } from "vitest";
import type { BillingPreference, CurrencyCode } from "../../src/lib/billing";
import type { Client, Project, TimeEntry } from "../../src/lib/mock-data";
import {
  calculateCharacteristicTimes,
  calculateReportFinancialAnalytics,
  calculateReportAnalytics,
  calculateReportMetrics,
  calculateWeekdayActivity,
  calculateWorkdayWeekendActivity,
  getPreviousEquivalentPeriod,
  getTemporalGranularity,
  groupEntriesByShift,
  groupEntriesByShiftAndTime,
  groupEntriesByTime,
  getReportBillableCurrencies,
  splitEntryByShift,
} from "../../src/lib/report-analytics";

const timeZone = "UTC";
const fallback: BillingPreference = { hourlyRate: 80, currency: "BRL" };

function entry(
  id: string,
  date: string,
  start: string,
  end: string,
  seconds: number,
  extra: Partial<TimeEntry> = {},
): TimeEntry {
  return {
    id,
    date,
    start,
    end,
    seconds,
    userId: "u1",
    projectId: "p1",
    task: "Implementation",
    billable: true,
    ...extra,
  };
}

function options(
  entries: readonly TimeEntry[],
  startDate: string,
  endDate: string,
  extra: {
    projects?: readonly Project[];
    clients?: readonly Client[];
    emptyCurrency?: CurrencyCode;
  } = {},
) {
  return {
    entries,
    range: { startDate, endDate },
    fallbackForEntry: () => fallback,
    timeZone,
    ...extra,
  };
}

describe("report analytics shifts", () => {
  it("keeps an entry inside a single shift", () => {
    const segments = splitEntryByShift(entry("one", "2026-08-10", "07:00", "08:00", 3_600), {
      timeZone,
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ shift: "morning", seconds: 3_600 });
  });

  it("splits an entry that crosses two shifts", () => {
    const totals = groupEntriesByShift([entry("two", "2026-08-10", "17:30", "19:30", 7_200)], {
      timeZone,
    });

    expect(totals.find((total) => total.shift === "afternoon")?.seconds).toBe(1_800);
    expect(totals.find((total) => total.shift === "night")?.seconds).toBe(5_400);
  });

  it("splits an entry that crosses midnight", () => {
    const crossing = entry("midnight", "2026-08-10", "23:00", "01:00", 7_200, {
      endDate: "2026-08-11",
    });
    const segments = splitEntryByShift(crossing, { timeZone });
    const daily = groupEntriesByTime([crossing], {
      range: { startDate: "2026-08-10", endDate: "2026-08-11" },
      timeZone,
    });

    expect(segments.map(({ shift, date, seconds }) => ({ shift, date, seconds }))).toEqual([
      { shift: "night", date: "2026-08-10", seconds: 3_600 },
      { shift: "overnight", date: "2026-08-11", seconds: 3_600 },
    ]);
    expect(daily.map((bucket) => bucket.totalSeconds)).toEqual([3_600, 3_600]);
  });
});

describe("report analytics temporal aggregation", () => {
  it("groups by day through 31 days and preserves empty buckets", () => {
    const buckets = groupEntriesByTime(
      [
        entry("d1", "2026-01-01", "09:00", "10:00", 3_600),
        entry("d3", "2026-01-03", "09:00", "11:00", 7_200, { billable: false }),
      ],
      { range: { startDate: "2026-01-01", endDate: "2026-01-03" }, timeZone },
    );

    expect(getTemporalGranularity({ startDate: "2026-01-01", endDate: "2026-01-31" })).toBe("day");
    expect(buckets.map((bucket) => bucket.totalSeconds)).toEqual([3_600, 0, 7_200]);
    expect(buckets[2]?.internalSeconds).toBe(7_200);
  });

  it("groups periods over 31 days and up to six months by week", () => {
    const buckets = groupEntriesByTime(
      [
        entry("w1", "2026-02-02", "09:00", "10:00", 3_600),
        entry("w2", "2026-02-09", "09:00", "11:00", 7_200),
      ],
      { range: { startDate: "2026-02-01", endDate: "2026-03-10" }, timeZone },
    );

    expect(buckets[0]?.granularity).toBe("week");
    expect(buckets.find((bucket) => bucket.key === "2026-02-02")?.totalSeconds).toBe(3_600);
    expect(buckets.find((bucket) => bucket.key === "2026-02-09")?.totalSeconds).toBe(7_200);
  });

  it("groups periods over six months by month", () => {
    const buckets = groupEntriesByTime(
      [
        entry("m1", "2026-01-15", "09:00", "10:00", 3_600),
        entry("m2", "2026-07-15", "09:00", "11:00", 7_200),
      ],
      { range: { startDate: "2026-01-01", endDate: "2026-08-01" }, timeZone },
    );

    expect(buckets[0]?.granularity).toBe("month");
    expect(buckets).toHaveLength(8);
    expect(buckets.find((bucket) => bucket.key === "2026-01")?.totalSeconds).toBe(3_600);
    expect(buckets.find((bucket) => bucket.key === "2026-07")?.totalSeconds).toBe(7_200);
  });

  it("groups split shifts over time, including after midnight", () => {
    const buckets = groupEntriesByShiftAndTime(
      [
        entry("split", "2026-08-10", "17:30", "19:30", 7_200),
        entry("midnight", "2026-08-10", "23:00", "01:00", 7_200, {
          endDate: "2026-08-11",
        }),
      ],
      { range: { startDate: "2026-08-10", endDate: "2026-08-11" }, timeZone },
    );

    expect(buckets[0]?.shifts).toEqual({
      overnight: 0,
      morning: 0,
      afternoon: 1_800,
      night: 9_000,
    });
    expect(buckets[1]?.shifts.overnight).toBe(3_600);
  });
});

describe("report activity patterns", () => {
  it("calculates weekday averages across all weekday occurrences", () => {
    const weekdays = calculateWeekdayActivity(
      [
        entry("monday-one", "2026-08-03", "09:00", "11:00", 7_200),
        entry("monday-two", "2026-08-10", "09:00", "10:00", 3_600),
      ],
      { range: { startDate: "2026-08-03", endDate: "2026-08-16" }, timeZone },
    );

    expect(weekdays[1]).toMatchObject({
      weekday: 1,
      occurrences: 2,
      activeDays: 2,
      totalSeconds: 10_800,
      averageSeconds: 5_400,
    });
    expect(weekdays[2]).toMatchObject({ occurrences: 2, averageSeconds: 0 });
  });

  it("separates workdays and weekends and averages by active day", () => {
    const groups = calculateWorkdayWeekendActivity(
      [
        entry("monday", "2026-08-03", "09:00", "11:00", 7_200),
        entry("saturday", "2026-08-08", "09:00", "10:00", 3_600),
      ],
      { range: { startDate: "2026-08-03", endDate: "2026-08-09" }, timeZone },
    );

    expect(groups.workdays).toMatchObject({
      seconds: 7_200,
      percentage: 66.66666666666666,
      activeDays: 1,
      averageSecondsPerActiveDay: 7_200,
    });
    expect(groups.weekends).toMatchObject({
      seconds: 3_600,
      percentage: 33.33333333333333,
      activeDays: 1,
      averageSecondsPerActiveDay: 3_600,
    });
  });

  it("calculates characteristic start and end times", () => {
    const times = calculateCharacteristicTimes(
      [
        entry("first", "2026-08-10", "08:00", "10:00", 7_200),
        entry("second", "2026-08-11", "10:00", "13:00", 10_800),
      ],
      { range: { startDate: "2026-08-10", endDate: "2026-08-11" }, timeZone },
    );

    expect(times).toEqual({
      entryCount: 2,
      averageStartSeconds: 9 * 3_600,
      averageEndSeconds: 11.5 * 3_600,
      earliestStartSeconds: 8 * 3_600,
      latestEndSeconds: 13 * 3_600,
    });
  });

  it("averages characteristic times across midnight without drifting to midday", () => {
    const times = calculateCharacteristicTimes(
      [
        entry("late", "2026-08-10", "21:00", "23:00", 7_200),
        entry("crossing", "2026-08-11", "23:00", "01:00", 7_200, {
          endDate: "2026-08-12",
        }),
      ],
      { range: { startDate: "2026-08-10", endDate: "2026-08-12" }, timeZone },
    );

    expect(times?.averageEndSeconds).toBe(0);
  });
});

describe("report analytics metrics", () => {
  it("calculates totals, averages and leading project, client and task", () => {
    const projects: Project[] = [
      {
        id: "p1",
        name: "Website",
        clientId: "c1",
        billable: true,
        status: "active",
        color: "blue",
        lastActivity: "2026-08-10",
        memberIds: ["u1"],
      },
    ];
    const clients: Client[] = [{ id: "c1", name: "Acme", contact: "acme@example.com" }];
    const metrics = calculateReportMetrics(
      options(
        [
          entry("a", "2026-08-10", "09:00", "11:00", 7_200),
          entry("b", "2026-08-11", "09:00", "10:00", 3_600, {
            projectId: null,
            task: "Planning",
            billable: false,
          }),
        ],
        "2026-08-10",
        "2026-08-11",
        { projects, clients },
      ),
    );

    expect(metrics).toMatchObject({
      totalSeconds: 10_800,
      billableSeconds: 7_200,
      internalSeconds: 3_600,
      entryCount: 2,
      activeDays: 2,
      averageSecondsPerActiveDay: 5_400,
      averageEntryDurationSeconds: 5_400,
      longestEntryDurationSeconds: 7_200,
      projectCount: 1,
      taskCount: 2,
      noProjectSeconds: 3_600,
    });
    expect(metrics.billablePercentage).toBeCloseTo(66.6667, 3);
    expect(metrics.topProject).toMatchObject({ id: "p1", label: "Website", seconds: 7_200 });
    expect(metrics.topClient).toMatchObject({ id: "c1", label: "Acme", seconds: 7_200 });
    expect(metrics.topTask).toMatchObject({ label: "Implementation", seconds: 7_200 });
    expect(metrics.busiestDay).toMatchObject({ id: "2026-08-10", seconds: 7_200 });
    expect(metrics.projectBreakdown).toMatchObject([
      { id: "p1", label: "Website", seconds: 7_200 },
      { id: "none", label: "No project", seconds: 3_600 },
    ]);
  });

  it("compares with the immediately preceding equivalent period", () => {
    const analytics = calculateReportAnalytics(
      options(
        [
          entry("previous", "2026-08-08", "09:00", "10:00", 3_600),
          entry("current", "2026-08-10", "09:00", "11:00", 7_200),
        ],
        "2026-08-10",
        "2026-08-11",
      ),
    );

    expect(getPreviousEquivalentPeriod(analytics.period)).toEqual({
      startDate: "2026-08-08",
      endDate: "2026-08-09",
    });
    expect(analytics.comparison.previous.totalSeconds).toBe(3_600);
    expect(analytics.comparison.metrics.totalSeconds).toEqual({
      current: 7_200,
      previous: 3_600,
      delta: 3_600,
      percentageChange: 100,
    });
    expect(analytics.previousTemporal.map((bucket) => bucket.totalSeconds)).toEqual([3_600, 0]);
    expect(analytics.previousShifts.find((shift) => shift.shift === "morning")?.seconds).toBe(
      3_600,
    );
  });

  it("keeps comparison unavailable without a previous baseline and stable when periods match", () => {
    const withoutBaseline = calculateReportAnalytics(
      options(
        [entry("current", "2026-08-10", "09:00", "10:00", 3_600)],
        "2026-08-10",
        "2026-08-10",
      ),
    );
    expect(withoutBaseline.comparison.metrics.totalSeconds).toEqual({
      current: 3_600,
      previous: 0,
      delta: 3_600,
      percentageChange: null,
    });

    const matchingPeriods = calculateReportAnalytics(
      options(
        [
          entry("previous", "2026-08-09", "09:00", "10:00", 3_600),
          entry("current", "2026-08-10", "09:00", "10:00", 3_600),
        ],
        "2026-08-10",
        "2026-08-10",
      ),
    );
    expect(matchingPeriods.comparison.metrics.totalSeconds).toEqual({
      current: 3_600,
      previous: 3_600,
      delta: 0,
      percentageChange: 0,
    });
  });

  it("aligns previous temporal buckets with the current monthly intervals", () => {
    const range = { startDate: "2026-02-01", endDate: "2026-08-02" };
    const previousPeriod = getPreviousEquivalentPeriod(range);
    const analytics = calculateReportAnalytics({
      ...options(
        [entry("previous", previousPeriod.startDate, "09:00", "10:00", 3_600)],
        range.startDate,
        range.endDate,
      ),
      range,
    });

    expect(analytics.granularity).toBe("month");
    expect(analytics.previousTemporal).toHaveLength(analytics.temporal.length);
    expect(analytics.previousTemporal[0]).toMatchObject({
      startDate: previousPeriod.startDate,
      totalSeconds: 3_600,
      granularity: "month",
    });
    expect(analytics.previousTemporal.at(-1)?.endDate).toBe(previousPeriod.endDate);
    analytics.temporal.forEach((bucket, index) => {
      const previousBucket = analytics.previousTemporal[index]!;
      const bucketDays =
        (Date.parse(`${bucket.endDate}T00:00:00Z`) - Date.parse(`${bucket.startDate}T00:00:00Z`)) /
          86_400_000 +
        1;
      const previousBucketDays =
        (Date.parse(`${previousBucket.endDate}T00:00:00Z`) -
          Date.parse(`${previousBucket.startDate}T00:00:00Z`)) /
          86_400_000 +
        1;
      expect(previousBucketDays).toBe(bucketDays);
    });
  });

  it("returns stable zero values for a period without activity", () => {
    const analytics = calculateReportAnalytics(
      options([], "2026-08-10", "2026-08-12", { emptyCurrency: "BRL" }),
    );

    expect(analytics.summary).toMatchObject({
      totalSeconds: 0,
      billableSeconds: 0,
      internalSeconds: 0,
      billablePercentage: 0,
      entryCount: 0,
      activeDays: 0,
      averageSecondsPerActiveDay: 0,
      averageEntryDurationSeconds: 0,
      longestEntryDurationSeconds: 0,
      projectCount: 0,
      taskCount: 0,
      topProject: null,
      topClient: null,
      topTask: null,
      noProjectSeconds: 0,
      billableValueByCurrency: { BRL: 0 },
    });
    expect(analytics.temporal).toHaveLength(3);
    expect(analytics.temporal.every((bucket) => bucket.totalSeconds === 0)).toBe(true);
    expect(analytics.previousTemporal).toHaveLength(3);
    expect(analytics.previousTemporal.every((bucket) => bucket.totalSeconds === 0)).toBe(true);
    expect(analytics.shifts.every((shift) => shift.seconds === 0)).toBe(true);
  });

  it("keeps billable values separated by snapshot currency and uses fallback only for old entries", () => {
    const metrics = calculateReportMetrics(
      options(
        [
          entry("brl", "2026-08-10", "09:00", "10:00", 3_600, {
            hourlyRate: 100,
            currency: "BRL",
          }),
          entry("usd", "2026-08-10", "10:00", "12:00", 7_200, {
            hourlyRate: 50,
            currency: "USD",
          }),
          entry("legacy", "2026-08-10", "12:00", "13:00", 3_600),
        ],
        "2026-08-10",
        "2026-08-10",
      ),
    );

    expect(metrics.billableValueByCurrency).toEqual({ BRL: 180, USD: 100 });
  });

  it("compares estimated billable values only within the same currency", () => {
    const analytics = calculateReportAnalytics(
      options(
        [
          entry("previous-brl", "2026-08-09", "09:00", "10:00", 3_600, {
            hourlyRate: 50,
            currency: "BRL",
          }),
          entry("previous-usd", "2026-08-09", "10:00", "11:00", 3_600, {
            hourlyRate: 20,
            currency: "USD",
          }),
          entry("current-brl", "2026-08-10", "09:00", "10:00", 3_600, {
            hourlyRate: 100,
            currency: "BRL",
          }),
          entry("current-usd", "2026-08-10", "10:00", "12:00", 7_200, {
            hourlyRate: 40,
            currency: "USD",
          }),
        ],
        "2026-08-10",
        "2026-08-10",
      ),
    );

    expect(analytics.comparison.billableValueByCurrency.BRL).toMatchObject({
      current: 100,
      previous: 50,
      delta: 50,
      percentageChange: 100,
    });
    expect(analytics.comparison.billableValueByCurrency.USD).toMatchObject({
      current: 80,
      previous: 20,
      delta: 60,
      percentageChange: 300,
    });
  });

  it("assigns zero billable value to internal entries", () => {
    const metrics = calculateReportMetrics(
      options(
        [
          entry("internal", "2026-08-10", "09:00", "11:00", 7_200, {
            billable: false,
            hourlyRate: 500,
            currency: "USD",
          }),
        ],
        "2026-08-10",
        "2026-08-10",
        { emptyCurrency: "BRL" },
      ),
    );

    expect(metrics.billableSeconds).toBe(0);
    expect(metrics.internalSeconds).toBe(7_200);
    expect(metrics.billableValueByCurrency).toEqual({ BRL: 0 });
  });

  it("clips entries at period boundaries, honors timestamps and does not deduplicate overlaps", () => {
    const timestamped = entry("precise", "2026-08-10", "09:00", "10:00", 3_600, {
      startTimestamp: Date.UTC(2026, 7, 10, 9, 0, 0, 0),
      endTimestamp: Date.UTC(2026, 7, 10, 9, 1, 30, 500),
    });
    const crossing = entry("crossing", "2026-08-09", "23:00", "01:00", 7_200, {
      endDate: "2026-08-10",
    });
    const overlap = entry("overlap", "2026-08-10", "00:00", "01:00", 3_600);
    const metrics = calculateReportMetrics(
      options([timestamped, crossing, overlap], "2026-08-10", "2026-08-10"),
    );

    expect(metrics.totalSeconds).toBe(7_290.5);
    expect(metrics.entryCount).toBe(3);
  });
});

describe("report financial analytics", () => {
  const projects: Project[] = [
    {
      id: "p1",
      name: "Website",
      clientId: "c1",
      billable: true,
      status: "active",
      color: "blue",
      lastActivity: "2026-08-10",
      memberIds: ["u1"],
    },
    {
      id: "p2",
      name: "Campaign",
      clientId: "c2",
      billable: true,
      status: "active",
      color: "green",
      lastActivity: "2026-08-11",
      memberIds: ["u1"],
    },
  ];
  const clients: Client[] = [
    { id: "c1", name: "Acme", contact: "acme@example.com" },
    { id: "c2", name: "Globex", contact: "globex@example.com" },
  ];

  it("keeps project, client and temporal values separated by snapshot currency", () => {
    const entries = [
      entry("brl", "2026-08-10", "09:00", "10:00", 3_600, {
        projectId: "p1",
        hourlyRate: 100,
        currency: "BRL",
      }),
      entry("usd", "2026-08-11", "09:00", "11:00", 7_200, {
        projectId: "p2",
        hourlyRate: 50,
        currency: "USD",
      }),
      entry("internal", "2026-08-11", "11:00", "12:00", 3_600, {
        projectId: "p2",
        billable: false,
        hourlyRate: 500,
        currency: "USD",
      }),
    ];
    const input = options(entries, "2026-08-10", "2026-08-11", { projects, clients });
    const financial = calculateReportFinancialAnalytics(input);

    expect(getReportBillableCurrencies(entries, input)).toEqual(["BRL", "USD"]);
    expect(financial.currencies).toEqual(["BRL", "USD"]);
    expect(financial.projects).toMatchObject([
      { id: "p2", billableSeconds: 7_200, valueByCurrency: { USD: 100 } },
      { id: "p1", billableSeconds: 3_600, valueByCurrency: { BRL: 100 } },
    ]);
    expect(financial.clients).toMatchObject([
      { id: "c2", label: "Globex", billableSeconds: 7_200, valueByCurrency: { USD: 100 } },
      { id: "c1", label: "Acme", billableSeconds: 3_600, valueByCurrency: { BRL: 100 } },
    ]);
    expect(financial.temporal.map((bucket) => bucket.valueByCurrency)).toEqual([
      { BRL: 100 },
      { USD: 100 },
    ]);
  });

  it("keeps snapshots stable when the fallback rate changes", () => {
    const entries = [
      entry("snapshot", "2026-08-10", "09:00", "10:00", 3_600, {
        hourlyRate: 100,
        currency: "BRL",
      }),
      entry("legacy", "2026-08-10", "10:00", "11:00", 3_600, { projectId: "p2" }),
    ];
    const base = options(entries, "2026-08-10", "2026-08-10", { projects, clients });
    const first = calculateReportFinancialAnalytics({
      ...base,
      fallbackForEntry: () => ({ hourlyRate: 80, currency: "BRL" }),
    });
    const changed = calculateReportFinancialAnalytics({
      ...base,
      fallbackForEntry: () => ({ hourlyRate: 200, currency: "BRL" }),
    });

    expect(first.projects.find((project) => project.id === "p1")?.valueByCurrency.BRL).toBe(100);
    expect(changed.projects.find((project) => project.id === "p1")?.valueByCurrency.BRL).toBe(100);
    expect(first.projects.find((project) => project.id === "p2")?.valueByCurrency.BRL).toBe(80);
    expect(changed.projects.find((project) => project.id === "p2")?.valueByCurrency.BRL).toBe(200);
  });

  it("groups estimated billable value weekly and monthly according to the report period", () => {
    const weekly = calculateReportFinancialAnalytics(
      options(
        [
          entry("week-one", "2026-02-02", "09:00", "10:00", 3_600, { hourlyRate: 100 }),
          entry("week-two", "2026-02-09", "09:00", "10:00", 3_600, { hourlyRate: 100 }),
        ],
        "2026-02-01",
        "2026-03-10",
        { projects, clients },
      ),
    );
    const monthly = calculateReportFinancialAnalytics(
      options(
        [entry("month", "2026-07-15", "09:00", "10:00", 3_600, { hourlyRate: 100 })],
        "2026-01-01",
        "2026-08-01",
        { projects, clients },
      ),
    );

    expect(weekly.temporal[0]?.granularity).toBe("week");
    expect(weekly.temporal.find((bucket) => bucket.key === "2026-02-02")?.valueByCurrency.BRL).toBe(
      100,
    );
    expect(monthly.temporal[0]?.granularity).toBe("month");
    expect(monthly.temporal.find((bucket) => bucket.key === "2026-07")?.valueByCurrency.BRL).toBe(
      100,
    );
  });
});
