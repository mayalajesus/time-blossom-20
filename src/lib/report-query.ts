import { getEndDateForEntry } from "./format";
import type { TimeEntry } from "./mock-data";

export const reportEntriesQueryName = "report-entries";

export type ReportEntriesQueryKey = readonly [
  typeof reportEntriesQueryName,
  {
    workspaceId: string;
    viewerId: string;
    startDate: string;
    endDate: string;
  },
];

export function reportEntriesQueryKey(
  workspaceId: string,
  viewerId: string,
  startDate: string,
  endDate: string,
): ReportEntriesQueryKey {
  return [reportEntriesQueryName, { workspaceId, viewerId, startDate, endDate }];
}

export function reportEntryOverlaps(entry: TimeEntry, startDate: string, endDate: string): boolean {
  return entry.date <= endDate && getEndDateForEntry(entry) >= startDate;
}

export function entriesForReportWindow(
  entries: readonly TimeEntry[],
  startDate: string,
  endDate: string,
): TimeEntry[] {
  return entries.filter((entry) => reportEntryOverlaps(entry, startDate, endDate));
}
