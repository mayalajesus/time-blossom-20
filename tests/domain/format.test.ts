import { describe, expect, it } from "vitest";
import {
  formatDateRange,
  getElapsedSeconds,
  getReportPeriodRange,
  parseDurationInput,
  getWeekBounds,
} from "../../src/lib/format";

describe("time domain formatting", () => {
  it("keeps sub-minute duration as real seconds", () => {
    expect(parseDurationInput("45s")).toBe(45);
    expect(
      getElapsedSeconds({
        date: "2026-08-28",
        start: "09:00",
        end: "09:00",
        startTimestamp: 1_000,
        endTimestamp: 46_000,
        seconds: 45,
      }),
    ).toBe(45);
  });

  it("parses the supported manual duration formats", () => {
    expect(parseDurationInput("2:45")).toBe(9_900);
    expect(parseDurationInput("825")).toBe(30_300);
    expect(parseDurationInput("1,5h")).toBe(5_400);
    expect(parseDurationInput("0s")).toBeNull();
    expect(parseDurationInput("2:75")).toBeNull();
  });

  it("uses the configured first day for week ranges", () => {
    expect(getWeekBounds("2026-08-26", 1)).toEqual({
      start: "2026-08-24",
      end: "2026-08-30",
    });
    expect(getWeekBounds("2026-08-26", 0)).toEqual({
      start: "2026-08-23",
      end: "2026-08-29",
    });
  });

  it("builds deterministic report ranges", () => {
    expect(getReportPeriodRange("yesterday", "2026-08-28")).toEqual({
      startDate: "2026-08-27",
      endDate: "2026-08-27",
    });
    expect(formatDateRange("2026-08-27", "2026-08-27", "pt-BR")).toContain("27");
  });
});
