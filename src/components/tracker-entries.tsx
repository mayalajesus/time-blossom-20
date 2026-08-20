import { Button, Dropdown, FieldError, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { HeroUIDatePicker } from "@/components/hero-ui-date-picker";
import { ProjectSelect } from "@/components/project-select";
import { useStore } from "@/lib/store";
import {
  addMinutesToDateTime,
  formatDate,
  formatDuration,
  getDayOffset,
  getElapsedMinutes,
  getEndDateForClockRange,
  getEndDateForEntry,
  getEntryEndDayOffset,
  isValidDateOnly,
  shiftDate,
} from "@/lib/format";
import type { TimeEntry } from "@/lib/mock-data";

export interface TrackerDay {
  date: string;
  totalSeconds: number;
  entries: TimeEntry[];
}

type TrackerEditableField =
  "task" | "description" | "project" | "start" | "end" | "date" | "duration" | "billable";

type ActiveCell = {
  entryId: string;
  field: TrackerEditableField;
} | null;

type TrackerGroup = {
  id: string;
  date: string;
  task: string;
  projectId: string | null;
  billable: boolean;
  entries: TimeEntry[];
  totalSeconds: number;
  start: string;
  end: string;
  endDate: string;
};

type EntryDraft = {
  date: string;
  task: string;
  projectId: string | null;
  start: string;
  end: string;
  endDate: string;
  duration: string;
  description: string;
  billable: boolean;
};

const trackerCellClass =
  "tracker-table-cell border-b border-default px-4 py-3 align-middle overflow-hidden";
const trackerActionCellClass =
  "tracker-actions-cell border-b border-default px-2 py-2 align-middle whitespace-nowrap";
const trackerActionLayoutClass = "grid grid-cols-[2rem_2rem] items-center justify-end gap-1";
const trackerActionButtonClass = "size-8 min-w-8 shrink-0 !p-0";

function formatDurationInput(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function parseDurationInput(value: string): number | null {
  const normalized = value.trim();
  let hours: number;
  let minutes: number;

  const clockValue = normalized.match(/^(\d{1,4}):(\d{2})$/);
  if (clockValue) {
    hours = Number(clockValue[1]);
    minutes = Number(clockValue[2]);
  } else if (/^\d{1,6}$/.test(normalized)) {
    if (normalized.length <= 2) {
      hours = 0;
      minutes = Number(normalized);
    } else {
      hours = Number(normalized.slice(0, -2));
      minutes = Number(normalized.slice(-2));
    }
  } else {
    return null;
  }

  if (hours > 999 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function toDraft(entry: TimeEntry): EntryDraft {
  return {
    date: entry.date,
    task: entry.task,
    projectId: entry.projectId,
    start: entry.start,
    end: entry.end,
    endDate: getEndDateForEntry(entry),
    duration: formatDurationInput(entry.seconds),
    description: entry.description ?? "",
    billable: entry.billable,
  };
}

function EndTimeValue({
  startDate,
  end,
  endDate,
}: {
  startDate: string;
  end: string;
  endDate: string;
}) {
  const dayOffset = getDayOffset(startDate, endDate);

  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span>{end}</span>
      {dayOffset > 0 ? (
        <sup className="text-[10px] font-medium leading-none text-muted">+{dayOffset}</sup>
      ) : null}
    </span>
  );
}

function groupKeyFor(entry: TimeEntry): string {
  return [
    entry.date,
    entry.task.trim().toLocaleLowerCase(),
    entry.projectId ?? "none",
    entry.billable ? "billable" : "internal",
  ].join("::");
}

function groupEntries(days: TrackerDay[]): TrackerGroup[] {
  const groups = new Map<string, TrackerGroup>();

  days.forEach((day) => {
    [...day.entries]
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((entry) => {
        const key = groupKeyFor(entry);
        const existing = groups.get(key);
        if (existing) {
          existing.entries.push(entry);
          existing.totalSeconds += entry.seconds;
          existing.start = entry.start < existing.start ? entry.start : existing.start;
          const entryEndDate = getEndDateForEntry(entry);
          const existingEndKey = `${existing.endDate}T${existing.end}`;
          const entryEndKey = `${entryEndDate}T${entry.end}`;
          if (entryEndKey > existingEndKey) {
            existing.end = entry.end;
            existing.endDate = entryEndDate;
          }
          return;
        }

        groups.set(key, {
          id: `tracker-group-${encodeURIComponent(key)}`,
          date: entry.date,
          task: entry.task,
          projectId: entry.projectId,
          billable: entry.billable,
          entries: [entry],
          totalSeconds: entry.seconds,
          start: entry.start,
          end: entry.end,
          endDate: getEndDateForEntry(entry),
        });
      });
  });

  return [...groups.values()];
}

export function TrackerEntries({ days }: { days: TrackerDay[] }) {
  const [activeCell, setActiveCell] = useState<ActiveCell>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const entries = useMemo(
    () =>
      days
        .flatMap((day) => day.entries)
        .sort((a, b) => {
          const activityA = `${a.task.trim().toLocaleLowerCase()}::${a.projectId ?? "none"}`;
          const activityB = `${b.task.trim().toLocaleLowerCase()}::${b.projectId ?? "none"}`;
          return (
            activityA.localeCompare(activityB) ||
            a.date.localeCompare(b.date) ||
            a.start.localeCompare(b.start)
          );
        }),
    [days],
  );
  const groups = useMemo(() => groupEntries(days), [days]);

  useEffect(() => {
    if (activeCell && !entries.some((entry) => entry.id === activeCell.entryId)) {
      setActiveCell(null);
    }
  }, [activeCell, entries]);

  useEffect(() => {
    const groupIds = new Set(groups.map((group) => group.id));
    setExpandedGroups((current) => {
      const next = new Set([...current].filter((id) => groupIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [groups]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div
      className="overflow-x-auto rounded-xl border border-default"
      aria-label="Time entries for selected period"
    >
      <table className="tracker-table w-full min-w-[1040px] table-fixed border-collapse bg-surface text-left">
        <caption className="sr-only">Time entries for selected period</caption>
        <colgroup>
          <col className="w-[21%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="border-b border-default bg-surface-secondary/40">
          <tr>
            <th
              scope="col"
              className="whitespace-nowrap px-4 py-2 text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              Task
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-4 py-2 text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              Project / client
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-4 py-2 text-center text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              Start
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-4 py-2 text-center text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              End
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-4 py-2 text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              Date
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-4 py-2 text-[10px] font-medium tracking-[0.12em] text-muted uppercase"
            >
              Duration
            </th>
            <th scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const isGrouped = group.entries.length > 1;
            const isExpanded = expandedGroups.has(group.id);

            if (!isGrouped) {
              const entry = group.entries[0];
              if (!entry) return null;
              return (
                <TrackerEntryRow
                  key={entry.id}
                  entry={entry}
                  activeField={activeCell?.entryId === entry.id ? activeCell.field : null}
                  onActivate={(field) => setActiveCell({ entryId: entry.id, field })}
                  onDeactivate={() => setActiveCell(null)}
                />
              );
            }

            return (
              <Fragment key={group.id}>
                <TrackerGroupSummaryRow
                  group={group}
                  isExpanded={isExpanded}
                  onToggle={() => toggleGroup(group.id)}
                />
                {isExpanded
                  ? group.entries.map((entry, index) => (
                      <TrackerEntryRow
                        key={entry.id}
                        entry={entry}
                        rowId={index === 0 ? `${group.id}-details` : undefined}
                        isGroupedDetail
                        activeField={activeCell?.entryId === entry.id ? activeCell.field : null}
                        onActivate={(field) => setActiveCell({ entryId: entry.id, field })}
                        onDeactivate={() => setActiveCell(null)}
                      />
                    ))
                  : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TrackerGroupSummaryRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: TrackerGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { projects, clients, timer, startTimer } = useStore();
  const project = projects.find((item) => item.id === group.projectId);
  const projectName = project?.name ?? "No project";
  const clientName = project
    ? (clients.find((client) => client.id === project.clientId)?.name ?? "Unknown client")
    : "No client";
  const summaryCellClass =
    "cursor-pointer border-b border-default bg-surface px-4 py-3 align-middle overflow-hidden";
  const summaryTextClass = "block min-w-0 truncate whitespace-nowrap";
  const toggleLabel = `${isExpanded ? "Collapse" : "Expand"} ${group.entries.length} entries for ${group.task}; ${group.billable ? "billable" : "internal"}`;

  const startAgain = () => {
    if (timer.status !== "idle") return;
    const result = startTimer(group.task, group.projectId);
    if (!result.success) toast("Could not start timer", { description: result.error });
  };

  const handleSummaryClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-tracker-action], [data-tracker-group-toggle]")) return;
    onToggle();
  };

  return (
    <tr
      data-tracker-group={group.id}
      onClick={handleSummaryClick}
      className="tracker-data-row tracker-group-summary-row group/summary bg-surface transition-colors hover:bg-surface-secondary/45"
    >
      <td className={`${summaryCellClass} min-w-0`}>
        <div className="flex min-h-[3.5rem] min-w-0 flex-col justify-center">
          <Button
            size="sm"
            variant="ghost"
            className="inline-flex min-w-0 max-w-full !h-8 !min-h-8 !justify-start !rounded-md !px-1 !py-1 text-left outline-none transition-colors hover:bg-transparent focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={toggleLabel}
            aria-expanded={isExpanded}
            data-tracker-group-toggle
            {...(isExpanded ? { "aria-controls": `${group.id}-details` } : {})}
            onPress={onToggle}
          >
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {group.task}
            </span>
            <span
              className={`ml-1 size-2 shrink-0 rounded-full ${group.billable ? "bg-success" : "bg-muted"}`}
              aria-hidden="true"
            />
            <ChevronDown
              className={`ml-1 size-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </Button>
          <span className="truncate pl-1 text-xs text-muted">
            {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </td>
      <td className={summaryCellClass}>
        <span className="flex min-w-0 flex-col">
          <span className={`${summaryTextClass} text-sm text-foreground`}>{projectName}</span>
          <span className={`${summaryTextClass} text-xs text-muted`}>{clientName}</span>
        </span>
      </td>
      <td className={`${summaryCellClass} text-center`}>
        <span className={`${summaryTextClass} text-center tabular-nums text-muted`}>
          {group.start}
        </span>
      </td>
      <td className={`${summaryCellClass} text-center`}>
        <span className={`${summaryTextClass} text-center tabular-nums text-muted`}>
          <EndTimeValue startDate={group.date} end={group.end} endDate={group.endDate} />
        </span>
      </td>
      <td className={summaryCellClass}>
        <span className={`${summaryTextClass} tabular-nums text-muted`}>
          {formatDate(group.date)}
        </span>
      </td>
      <td className={summaryCellClass}>
        <span className={`${summaryTextClass} font-medium tabular-nums text-foreground`}>
          {formatDuration(group.totalSeconds)}
        </span>
      </td>
      <td className={`${trackerActionCellClass} bg-surface`}>
        <div className={trackerActionLayoutClass} data-tracker-action>
          <Button
            isIconOnly
            aria-label={`Start ${group.task} again`}
            isDisabled={timer.status !== "idle"}
            className={trackerActionButtonClass}
            variant="tertiary"
            onPress={startAgain}
          >
            <Play className="size-4" />
          </Button>
          <Dropdown>
            <Dropdown.Trigger
              aria-label={`Actions for ${group.task} group`}
              className={trackerActionButtonClass}
            >
              <MoreHorizontal className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={(key) => key === "toggle" && onToggle()}>
                <Dropdown.Item id="toggle">
                  <ChevronDown className={`size-4 ${isExpanded ? "rotate-180" : ""}`} />
                  <Label>{isExpanded ? "Collapse group" : "Expand group"}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </td>
    </tr>
  );
}

function TrackerEntryRow({
  entry,
  rowId,
  isGroupedDetail = false,
  activeField,
  onActivate,
  onDeactivate,
}: {
  entry: TimeEntry;
  rowId?: string | undefined;
  isGroupedDetail?: boolean;
  activeField: TrackerEditableField | null;
  onActivate: (field: TrackerEditableField) => void;
  onDeactivate: () => void;
}) {
  const { projects, clients, timer, startTimer, updateEntry, deleteEntry } = useStore();
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const focusRef = useRef<HTMLInputElement | null>(null);
  const savedDraftRef = useRef<EntryDraft>(toDraft(entry));
  const [draft, setDraft] = useState<EntryDraft>(() => toDraft(entry));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (activeField) return;
    const next = toDraft(entry);
    savedDraftRef.current = next;
    setDraft(next);
    setValidationMessage(null);
  }, [activeField, entry]);

  useEffect(() => {
    if (!activeField || !focusRef.current) return;
    focusRef.current.focus();
    if (activeField === "task" || activeField === "description" || activeField === "duration") {
      focusRef.current.select();
    }
  }, [activeField]);

  const project = projects.find((item) => item.id === entry.projectId);
  const projectName = project?.name ?? "No project";
  const clientName = project
    ? (clients.find((client) => client.id === project.clientId)?.name ?? "Unknown client")
    : "No client";
  const selectedProject = projects.find((item) => item.id === draft.projectId);
  const selectedClientName = selectedProject
    ? (clients.find((client) => client.id === selectedProject.clientId)?.name ?? "Unknown client")
    : "No client";
  const entryEndDate = getEndDateForEntry(entry);
  const entryEndDayOffset = getEntryEndDayOffset(entry);
  const endTimeLabel = `End time: ${entry.end}${
    entryEndDayOffset > 0
      ? `, ${entryEndDayOffset === 1 ? "next day" : `${entryEndDayOffset} days later`}`
      : ""
  }`;
  const validateDraft = (candidate: EntryDraft, allowFullDayDuration = false): string | null => {
    if (!candidate.task.trim()) return "Task is required.";
    if (!isValidDateOnly(candidate.date)) return "Choose a valid date.";
    const elapsedMinutes = getElapsedMinutes(
      candidate.date,
      candidate.start,
      candidate.endDate,
      candidate.end,
    );
    if (elapsedMinutes <= 0 && !allowFullDayDuration) {
      return "End time must be after start time.";
    }
    if (candidate.projectId !== null && !projects.some((item) => item.id === candidate.projectId)) {
      return "Choose an existing project or No project.";
    }
    return null;
  };

  const notifySaved = (candidate: EntryDraft) => {
    savedDraftRef.current = candidate;
    setDraft(candidate);
    setValidationMessage(null);
    const durationMinutes = parseDurationInput(candidate.duration);
    toast("Entry updated", {
      description: `${candidate.task} · ${durationMinutes === null ? candidate.duration : formatDuration(durationMinutes * 60)}`,
    });
  };

  const commitField = (
    field: "task" | "description" | "project" | "date" | "billable",
    value: string | boolean | null,
  ): boolean => {
    const draftField = field === "project" ? "projectId" : field;
    const normalizedValue =
      field === "task" || field === "description" ? String(value).trim() : value;
    const nextEndDate =
      field === "date" && typeof normalizedValue === "string" && isValidDateOnly(normalizedValue)
        ? shiftDate(normalizedValue, getDayOffset(draft.date, draft.endDate))
        : draft.endDate;
    const candidate = {
      ...draft,
      [draftField]: normalizedValue,
      ...(field === "date" ? { endDate: nextEndDate } : {}),
    } as EntryDraft;
    const message = validateDraft(candidate);
    if (message) {
      setValidationMessage(message);
      return false;
    }

    if (savedDraftRef.current[draftField] === candidate[draftField]) return true;

    const patch =
      field === "project"
        ? { projectId: candidate.projectId }
        : field === "date"
          ? {
              date: candidate.date,
              endDate: candidate.endDate !== candidate.date ? candidate.endDate : undefined,
            }
          : { [field]: normalizedValue };
    const result = updateEntry(entry.id, patch);
    if (!result.success) {
      setValidationMessage(result.error);
      return false;
    }

    notifySaved(candidate);
    return true;
  };

  const commitTime = (start: string, end: string, close = false): boolean => {
    const endDate = getEndDateForClockRange(draft.date, start, end, draft.endDate);
    const elapsedMinutes = getElapsedMinutes(draft.date, start, endDate, end);
    const candidate = {
      ...draft,
      start,
      end,
      endDate,
      duration: formatDurationInput(elapsedMinutes * 60),
    };
    const message = validateDraft(candidate);
    if (message) {
      setValidationMessage(message);
      return false;
    }

    if (
      savedDraftRef.current.start === start &&
      savedDraftRef.current.end === end &&
      savedDraftRef.current.endDate === endDate
    ) {
      if (close) onDeactivate();
      return true;
    }

    const result = updateEntry(entry.id, {
      start,
      end,
      endDate: endDate !== draft.date ? endDate : undefined,
      seconds: elapsedMinutes * 60,
    });
    if (!result.success) {
      setValidationMessage(result.error);
      return false;
    }

    notifySaved(candidate);
    if (close) onDeactivate();
    return true;
  };

  const commitDuration = (value: string, close = false): boolean => {
    const totalMinutes = parseDurationInput(value);
    if (totalMinutes === null) {
      setValidationMessage("Use H:MM, HHMM or HMM (for example, 1:20, 120 or 825).");
      return false;
    }

    const finish = addMinutesToDateTime(draft.date, draft.start, totalMinutes);
    const candidate = {
      ...draft,
      end: finish.end,
      endDate: finish.endDate,
      duration: formatDurationInput(totalMinutes * 60),
    };
    const message = validateDraft(candidate, totalMinutes === 24 * 60);
    if (message) {
      setValidationMessage(message);
      return false;
    }

    if (
      savedDraftRef.current.end === finish.end &&
      savedDraftRef.current.endDate === finish.endDate
    ) {
      if (close) onDeactivate();
      return true;
    }

    const result = updateEntry(entry.id, {
      end: finish.end,
      endDate: finish.endDate !== draft.date ? finish.endDate : undefined,
      seconds: totalMinutes * 60,
    });
    if (!result.success) {
      setValidationMessage(result.error);
      return false;
    }

    notifySaved(candidate);
    if (close) onDeactivate();
    return true;
  };

  const restoreField = () => {
    if (activeField === "start" || activeField === "end") {
      setDraft((current) => ({
        ...current,
        [activeField]: savedDraftRef.current[activeField],
      }));
    } else if (activeField === "duration") {
      setDraft((current) => ({
        ...current,
        end: savedDraftRef.current.end,
        endDate: savedDraftRef.current.endDate,
        duration: savedDraftRef.current.duration,
      }));
    } else {
      const draftField = activeField === "project" ? "projectId" : (activeField ?? "task");
      setDraft((current) => ({
        ...current,
        [draftField]: savedDraftRef.current[draftField],
      }));
    }
    setValidationMessage(null);
    onDeactivate();
  };

  const finishEditing = (): boolean => {
    if (!activeField) return true;
    if (activeField === "task" || activeField === "description") {
      const saved = commitField(activeField, draft[activeField]);
      if (saved) onDeactivate();
      return saved;
    }
    if (activeField === "start" || activeField === "end") {
      return commitTime(draft.start, draft.end, true);
    }
    if (activeField === "duration") return commitDuration(draft.duration, true);
    if (activeField === "project") {
      const saved = commitField("project", draft.projectId);
      if (saved) onDeactivate();
      return saved;
    }
    if (activeField === "date") {
      const saved = commitField("date", draft.date);
      if (saved) onDeactivate();
      return saved;
    }
    return true;
  };

  useEffect(() => {
    if (!activeField) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const clickedField = target
        ?.closest("[data-tracker-field]")
        ?.getAttribute("data-tracker-field");
      const clickedAction = target?.closest("[data-tracker-action]");
      const clickedDatePicker = target?.closest(
        "[data-tracker-date-picker], [data-tracker-date-picker-popover]",
      );
      const clickedProjectSelect = target?.closest(
        "[data-project-select], [data-project-select-popover]",
      );

      if (clickedDatePicker || clickedProjectSelect) return;

      if (rowRef.current?.contains(target)) {
        if (clickedField && clickedField !== activeField) {
          if (!finishEditing()) {
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (clickedAction && !finishEditing()) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (!finishEditing()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  });

  const confirmDelete = () => {
    deleteEntry(entry.id);
    setDeleteDialogOpen(false);
    onDeactivate();
    toast("Time entry deleted");
  };

  const startAgain = () => {
    if (timer.status !== "idle") return;
    const result = startTimer(entry.task, entry.projectId);
    if (!result.success) toast("Could not start timer", { description: result.error });
  };

  const actionCell = (
    <td className={trackerActionCellClass}>
      <div className={trackerActionLayoutClass} data-tracker-action>
        <Button
          isIconOnly
          aria-label={`Start ${entry.task} again`}
          isDisabled={timer.status !== "idle"}
          className={trackerActionButtonClass}
          variant="tertiary"
          onPress={startAgain}
        >
          <Play className="size-4" />
        </Button>
        <Dropdown>
          <Dropdown.Trigger
            aria-label={`Actions for ${entry.task}`}
            className={trackerActionButtonClass}
          >
            <MoreHorizontal className="size-4" />
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={(key) => key === "delete" && setDeleteDialogOpen(true)}>
              <Dropdown.Item id="delete" className="text-danger">
                <Trash2 className="size-4" />
                <Label>Delete entry</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </td>
  );

  const errorFor = (field: TrackerEditableField) =>
    activeField === field && validationMessage ? (
      <FieldError className="mt-1 block text-[11px]">{validationMessage}</FieldError>
    ) : null;

  const handleTextKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    field: "task" | "description",
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      restoreField();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitField(field, draft[field])) onDeactivate();
    }
  };

  const handleTimeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      restoreField();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitTime(draft.start, draft.end, true);
    }
  };

  const handleDurationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      restoreField();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitDuration(draft.duration, true);
    }
  };

  const cellButtonClass =
    "inline-flex min-w-0 max-w-full truncate whitespace-nowrap !rounded-lg !px-1 !py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const descriptionButtonClass =
    "inline-flex min-w-0 max-w-full truncate whitespace-nowrap !rounded-lg !px-0 !py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const taskButtonClass =
    "inline-flex min-w-0 max-w-full flex-[0_1_auto] items-center !justify-start !rounded-lg !px-0 !py-1 text-left whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const projectButtonClass =
    "inline-flex w-full min-w-0 !h-auto !min-h-8 !items-start !justify-center !rounded-lg !px-1 !py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const timeSlotClass =
    "inline-flex !h-8 !w-[5.75rem] !min-w-[5.75rem] shrink-0 items-center justify-center !rounded-lg !px-1 text-sm tabular-nums text-muted whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const compactInputClass = "!h-8 !min-h-8 !rounded-lg !px-2 !py-1 text-sm";
  const timeInputClass = `${compactInputClass} !w-[5.75rem] !min-w-[5.75rem] shrink-0 text-center tabular-nums`;
  const durationInputClass = `${compactInputClass} !w-[5.25rem] !min-w-[5.25rem] !max-w-full`;
  return (
    <Fragment>
      <tr
        id={rowId}
        ref={rowRef}
        data-tracker-entry="true"
        className={`tracker-data-row tracker-entry-row group ${isGroupedDetail ? "bg-surface-secondary/45" : "bg-surface"} transition-colors hover:bg-surface-secondary/70`}
      >
        <td className={`${trackerCellClass} min-w-0`}>
          <div className="flex min-w-0 items-center gap-2">
            {activeField === "task" ? (
              <TextField
                className="min-w-0 flex-1"
                fullWidth
                name={`task-${entry.id}`}
                value={draft.task}
                isInvalid={Boolean(validationMessage)}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    task: value,
                  }))
                }
              >
                <Label className="sr-only">Task</Label>
                <Input
                  ref={focusRef}
                  className={compactInputClass}
                  onBlur={() => {
                    if (commitField("task", draft.task)) onDeactivate();
                  }}
                  onKeyDown={(event) => handleTextKeyDown(event, "task")}
                />
                <FieldError>{validationMessage}</FieldError>
              </TextField>
            ) : (
              <div className="min-w-0 flex-[0_1_auto]">
                <Button
                  size="sm"
                  variant="ghost"
                  fullWidth
                  className={taskButtonClass}
                  data-tracker-field="task"
                  onPress={() => onActivate("task")}
                >
                  <span className="truncate text-sm font-medium text-foreground">{entry.task}</span>
                </Button>
              </div>
            )}
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={`Billable: ${entry.billable ? "yes" : "no"}`}
              aria-pressed={entry.billable}
              data-tracker-field="billable"
              className="size-4 min-w-4 !rounded-full !p-0"
              onPress={() => {
                const next = !entry.billable;
                if (commitField("billable", next)) onDeactivate();
              }}
            >
              <span
                className={`size-2 rounded-full ${entry.billable ? "bg-success" : "bg-muted"}`}
                aria-hidden="true"
              />
            </Button>
          </div>
          {activeField === "description" ? (
            <TextField
              className="min-w-0"
              fullWidth
              name={`description-${entry.id}`}
              value={draft.description}
              isInvalid={Boolean(validationMessage)}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  description: value,
                }))
              }
            >
              <Label className="sr-only">Description</Label>
              <Input
                ref={focusRef}
                className={compactInputClass}
                placeholder="Add a note"
                onBlur={() => {
                  if (commitField("description", draft.description)) onDeactivate();
                }}
                onKeyDown={(event) => handleTextKeyDown(event, "description")}
              />
              <FieldError>{validationMessage}</FieldError>
            </TextField>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              fullWidth
              aria-label={entry.description ? "Edit description" : "Add description"}
              className={`${descriptionButtonClass} mt-0.5 !h-6 !min-h-6 !justify-start text-xs text-muted ${entry.description ? "" : "text-transparent"}`}
              data-tracker-field="description"
              onPress={() => onActivate("description")}
            >
              {entry.description || "·"}
            </Button>
          )}
        </td>

        <td className={trackerCellClass}>
          {activeField === "project" ? (
            <>
              <ProjectSelect
                ariaLabel="Project"
                value={draft.projectId ?? "none"}
                allowArchivedId={entry.projectId}
                onChange={(value) => {
                  const next = value === "none" || value === "all" ? null : value;
                  setDraft((current) => ({ ...current, projectId: next }));
                  if (commitField("project", next)) onDeactivate();
                }}
              />
              <span className="mt-1 block truncate text-[11px] text-muted">
                {selectedClientName}
              </span>
              {errorFor("project")}
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              fullWidth
              className={projectButtonClass}
              data-tracker-field="project"
              onPress={() => onActivate("project")}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="block w-full min-w-0 truncate text-sm text-foreground">
                  {projectName}
                </span>
                <span className="block w-full min-w-0 truncate text-xs text-muted">
                  {clientName}
                </span>
              </span>
            </Button>
          )}
        </td>

        <td className={`${trackerCellClass} text-center`}>
          {activeField === "start" ? (
            <TextField
              className="inline-flex min-w-0"
              name={`start-${entry.id}`}
              value={draft.start}
              isInvalid={Boolean(validationMessage)}
              onChange={(value) => setDraft((current) => ({ ...current, start: value }))}
            >
              <Label className="sr-only">Start time</Label>
              <Input
                ref={focusRef}
                className={timeInputClass}
                variant="secondary"
                type="time"
                onBlur={() => commitTime(draft.start, draft.end)}
                onKeyDown={handleTimeKeyDown}
              />
              <FieldError>{validationMessage}</FieldError>
            </TextField>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className={timeSlotClass}
              data-tracker-field="start"
              aria-label={`Start time: ${entry.start}`}
              onPress={() => onActivate("start")}
            >
              {entry.start}
            </Button>
          )}
        </td>

        <td className={`${trackerCellClass} text-center`}>
          {activeField === "end" ? (
            <TextField
              className="inline-flex min-w-0"
              name={`end-${entry.id}`}
              value={draft.end}
              isInvalid={Boolean(validationMessage)}
              onChange={(value) => setDraft((current) => ({ ...current, end: value }))}
            >
              <Label className="sr-only">
                End time
                {getDayOffset(draft.date, draft.endDate) > 0 ? ", next day" : ""}
              </Label>
              <Input
                ref={focusRef}
                className={timeInputClass}
                variant="secondary"
                type="time"
                onBlur={() => commitTime(draft.start, draft.end)}
                onKeyDown={handleTimeKeyDown}
              />
              <FieldError>{validationMessage}</FieldError>
            </TextField>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className={timeSlotClass}
              data-tracker-field="end"
              aria-label={endTimeLabel}
              onPress={() => onActivate("end")}
            >
              <EndTimeValue startDate={entry.date} end={entry.end} endDate={entryEndDate} />
            </Button>
          )}
        </td>

        <td className={trackerCellClass}>
          {activeField === "date" ? (
            <>
              <HeroUIDatePicker
                value={draft.date}
                label="Date"
                className="!w-[8rem] !min-w-[8rem]"
                compact
                autoFocus
                isInvalid={Boolean(validationMessage)}
                onChange={(next) => {
                  setDraft((current) => ({ ...current, date: next }));
                  if (isValidDateOnly(next) && commitField("date", next)) onDeactivate();
                }}
                onEscape={restoreField}
              />
              {errorFor("date")}
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className={`${cellButtonClass} tabular-nums text-muted`}
              data-tracker-field="date"
              onPress={() => onActivate("date")}
            >
              {formatDate(entry.date)}
            </Button>
          )}
        </td>

        <td className={trackerCellClass}>
          {activeField === "duration" ? (
            <TextField
              className="inline-flex min-w-0"
              name={`duration-${entry.id}`}
              value={draft.duration}
              isInvalid={Boolean(validationMessage)}
              onChange={(value) => setDraft((current) => ({ ...current, duration: value }))}
            >
              <Label className="sr-only">Duration</Label>
              <Input
                ref={focusRef}
                className={durationInputClass}
                variant="secondary"
                inputMode="decimal"
                placeholder="H:MM"
                onBlur={() => commitDuration(draft.duration)}
                onKeyDown={handleDurationKeyDown}
              />
              <FieldError>{validationMessage}</FieldError>
            </TextField>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className={`${cellButtonClass} font-medium tabular-nums text-foreground`}
              data-tracker-field="duration"
              onPress={() => onActivate("duration")}
            >
              {formatDuration(entry.seconds)}
            </Button>
          )}
        </td>

        {actionCell}
      </tr>
      <Modal isOpen={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete time entry?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  Delete “{entry.task}”? This action cannot be undone.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Keep entry
                </Button>
                <Button variant="secondary" className="text-danger" onPress={confirmDelete}>
                  Delete entry
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Fragment>
  );
}
