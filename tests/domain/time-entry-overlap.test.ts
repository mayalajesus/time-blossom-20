import { describe, expect, it } from "vitest";
import {
  findTimeEntryConflict,
  timeEntriesOverlap,
  type ScopedTimeIntervalEntry,
} from "../../src/lib/time-entry-overlap";

const zone = "America/Sao_Paulo";

function entry(
  id: string,
  date: string,
  start: string,
  end: string,
  seconds: number,
  extra: Partial<ScopedTimeIntervalEntry> = {},
): ScopedTimeIntervalEntry {
  return {
    id,
    workspaceId: "w1",
    userId: "u1",
    date,
    start,
    end,
    seconds,
    ...extra,
  };
}

describe("time entry overlap", () => {
  it("detects a partial overlap", () => {
    expect(
      timeEntriesOverlap(
        entry("a", "2026-08-30", "09:00", "10:00", 3_600),
        entry("b", "2026-08-30", "09:30", "10:30", 3_600),
        zone,
      ),
    ).toBe(true);
  });

  it("detects an entry contained inside another", () => {
    expect(
      timeEntriesOverlap(
        entry("a", "2026-08-30", "09:00", "12:00", 10_800),
        entry("b", "2026-08-30", "10:00", "11:00", 3_600),
        zone,
      ),
    ).toBe(true);
  });

  it("detects identical entries", () => {
    expect(
      timeEntriesOverlap(
        entry("a", "2026-08-30", "09:00", "10:00", 3_600),
        entry("b", "2026-08-30", "09:00", "10:00", 3_600),
        zone,
      ),
    ).toBe(true);
  });

  it("does not treat adjacent entries as overlapping", () => {
    expect(
      timeEntriesOverlap(
        entry("a", "2026-08-30", "09:00", "10:00", 3_600),
        entry("b", "2026-08-30", "10:00", "11:00", 3_600),
        zone,
      ),
    ).toBe(false);
  });

  it("does not overlap entries on separate days", () => {
    expect(
      timeEntriesOverlap(
        entry("a", "2026-08-29", "09:00", "10:00", 3_600),
        entry("b", "2026-08-30", "09:00", "10:00", 3_600),
        zone,
      ),
    ).toBe(false);
  });

  it("detects an overlap when an entry crosses midnight", () => {
    expect(
      timeEntriesOverlap(
        entry("a", "2026-08-29", "23:30", "01:30", 7_200, {
          endDate: "2026-08-30",
        }),
        entry("b", "2026-08-30", "00:30", "01:00", 1_800),
        zone,
      ),
    ).toBe(true);
  });

  it("ignores the edited entry itself", () => {
    const existing = entry("a", "2026-08-30", "09:00", "10:00", 3_600);
    expect(
      findTimeEntryConflict(existing, [existing], {
        excludeEntryId: "a",
        timeZone: zone,
      }),
    ).toBeUndefined();
  });

  it("compares only the same user and workspace", () => {
    const candidate = entry("a", "2026-08-30", "09:00", "10:00", 3_600);
    expect(timeEntriesOverlap(candidate, { ...candidate, id: "b", userId: "u2" }, zone)).toBe(
      false,
    );
    expect(timeEntriesOverlap(candidate, { ...candidate, id: "c", workspaceId: "w2" }, zone)).toBe(
      false,
    );
  });

  it("prefers logical timestamps when they are available", () => {
    const first = entry("a", "2026-08-30", "09:00", "10:00", 3_600, {
      startTimestamp: 1_000,
      endTimestamp: 5_000,
    });
    const second = entry("b", "2026-08-31", "15:00", "16:00", 3_600, {
      startTimestamp: 4_000,
      endTimestamp: 6_000,
    });
    expect(timeEntriesOverlap(first, second, zone)).toBe(true);
  });
});
