import { describe, expect, it } from "vitest";
import {
  dateTimeToTimestamp,
  formatDateRange,
  getEndDateForEntry,
  getElapsedSeconds,
  getLocalToday,
  getManualEntryDefaults,
  getReportPeriodRange,
  nowTime,
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
    expect(parseDurationInput("40s")).toBe(40);
    expect(parseDurationInput("00:00:49")).toBe(49);
    expect(parseDurationInput("1h30m20s")).toBe(5_420);
    expect(parseDurationInput("825")).toBe(30_300);
    expect(parseDurationInput("1,5h")).toBe(5_400);
    expect(parseDurationInput("0s")).toBeNull();
    expect(parseDurationInput("2:75")).toBeNull();
    expect(parseDurationInput("0:00:60")).toBeNull();
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

  it("uses the configured IANA timezone for timer dates and clocks", () => {
    const reference = new Date("2026-08-30T02:30:00.000Z");
    expect(getLocalToday(reference, "America/Sao_Paulo")).toBe("2026-08-29");
    expect(nowTime("America/Sao_Paulo", reference)).toBe("23:30");
    expect(dateTimeToTimestamp("2026-08-29", "23:30", 0, "America/Sao_Paulo")).toBe(
      reference.getTime(),
    );
  });

  it("keeps a session that crosses midnight as one entry with an end date", () => {
    expect(
      getEndDateForEntry({
        date: "2026-08-29",
        start: "23:30",
        end: "01:30",
        seconds: 7_200,
      }),
    ).toBe("2026-08-30");

    expect(
      getManualEntryDefaults(new Date("2026-08-30T03:30:00.000Z"), "America/Sao_Paulo"),
    ).toEqual({
      date: "2026-08-29",
      start: "23:30",
      end: "00:30",
      endDate: "2026-08-30",
    });
  });
});
