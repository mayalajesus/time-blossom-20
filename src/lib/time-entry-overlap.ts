import { dateTimeToTimestamp, getEndDateForEntry } from "./format";
import type { TimeEntry } from "./domain";

export type ScopedTimeIntervalEntry = Pick<
  TimeEntry,
  "date" | "start" | "end" | "endDate" | "seconds" | "startTimestamp" | "endTimestamp" | "userId"
> & {
  id?: string;
  workspaceId: string;
};

function finiteTimestamp(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function timeEntryInterval(
  entry: ScopedTimeIntervalEntry,
  timeZone?: string,
): readonly [number, number] | null {
  const timestampStart = finiteTimestamp(entry.startTimestamp);
  const start = timestampStart ?? dateTimeToTimestamp(entry.date, entry.start, 0, timeZone);
  if (start === null) return null;

  const timestampEnd = finiteTimestamp(entry.endTimestamp);
  const clockEnd = dateTimeToTimestamp(getEndDateForEntry(entry), entry.end, 0, timeZone);
  const durationEnd =
    Number.isFinite(entry.seconds) && entry.seconds > 0 ? start + entry.seconds * 1000 : null;
  const end =
    timestampEnd ??
    (timestampStart === null ? (clockEnd ?? durationEnd) : (durationEnd ?? clockEnd));
  if (end === null || end <= start) return null;

  return [start, end];
}

export function timeEntriesOverlap(
  first: ScopedTimeIntervalEntry,
  second: ScopedTimeIntervalEntry,
  timeZone?: string,
): boolean {
  if (first.workspaceId !== second.workspaceId || first.userId !== second.userId) return false;
  const firstInterval = timeEntryInterval(first, timeZone);
  const secondInterval = timeEntryInterval(second, timeZone);
  if (!firstInterval || !secondInterval) return false;
  return firstInterval[0] < secondInterval[1] && firstInterval[1] > secondInterval[0];
}

export function findTimeEntryConflict<Existing extends ScopedTimeIntervalEntry>(
  candidate: ScopedTimeIntervalEntry,
  entries: readonly Existing[],
  options: { excludeEntryId?: string; timeZone?: string } = {},
): Existing | undefined {
  return entries.find(
    (entry) =>
      entry.id !== options.excludeEntryId && timeEntriesOverlap(candidate, entry, options.timeZone),
  );
}
