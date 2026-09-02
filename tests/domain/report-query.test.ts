import { describe, expect, it } from "vitest";
import type { TimeEntry } from "../../src/lib/domain";
import {
  entriesForReportWindow,
  reportEntryOverlaps,
  reportEntriesQueryKey,
} from "../../src/lib/report-query";

function entry(id: string, date: string, endDate?: string, overnight = false): TimeEntry {
  return {
    id,
    date,
    start: overnight ? "23:30" : "09:00",
    end: overnight ? "00:30" : "10:00",
    endDate,
    seconds: 3_600,
    userId: "user-1",
    projectId: null,
    task: "Night shift",
    billable: true,
  };
}

describe("report query windows", () => {
  it("includes entries that cross midnight", () => {
    const overnight = entry("overnight", "2026-08-30", "2026-08-31", true);
    expect(reportEntryOverlaps(overnight, "2026-08-31", "2026-08-31")).toBe(true);
    expect(entriesForReportWindow([overnight], "2026-08-31", "2026-08-31")).toEqual([overnight]);
  });

  it("excludes entries outside the requested window", () => {
    expect(
      entriesForReportWindow(
        [entry("before", "2026-08-29"), entry("inside", "2026-08-30")],
        "2026-08-30",
        "2026-08-30",
      ).map((item) => item.id),
    ).toEqual(["inside"]);
  });

  it("keeps the cache key scoped to workspace, user and interval", () => {
    expect(reportEntriesQueryKey("workspace-1", "user-1", "2026-08-24", "2026-08-30")).toEqual([
      "report-entries",
      {
        workspaceId: "workspace-1",
        viewerId: "user-1",
        startDate: "2026-08-24",
        endDate: "2026-08-30",
      },
    ]);
  });
});
