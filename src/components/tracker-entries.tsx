import { Button, Dropdown, Input, Label, ListBox, Select, toast } from "@heroui/react";
import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  addSecondsToTime,
  formatDate,
  formatDuration,
  isValidDateOnly,
  minutesBetween,
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
};

type EntryDraft = {
  date: string;
  task: string;
  projectId: string | null;
  start: string;
  end: string;
  duration: string;
  description: string;
  billable: boolean;
};

function formatDurationInput(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function parseDurationInput(value: string): number | null {
  const normalized = value.trim();
  let hours: number;
  let minutes: number;

  const clockValue = normalized.match(/^(\d{1,3}):(\d{2})$/);
  if (clockValue) {
    hours = Number(clockValue[1]);
    minutes = Number(clockValue[2]);
  } else if (/^\d{1,4}$/.test(normalized)) {
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

  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

function timeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function toDraft(entry: TimeEntry): EntryDraft {
  return {
    date: entry.date,
    task: entry.task,
    projectId: entry.projectId,
    start: entry.start,
    end: entry.end,
    duration: formatDurationInput(entry.seconds),
    description: entry.description ?? "",
    billable: entry.billable,
  };
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
          existing.end = entry.end > existing.end ? entry.end : existing.end;
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
      aria-label="Weekly time entries"
    >
      <table className="tracker-table w-full min-w-[1040px] table-fixed border-collapse bg-surface text-left">
        <caption className="sr-only">Weekly time entries</caption>
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
  const summaryButtonClass =
    "inline-flex min-w-0 max-w-full items-center !justify-start !rounded-lg !px-1 !py-1 text-left outline-none transition-colors hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-accent";
  const summaryCellClass =
    "border-b border-default bg-surface-secondary/55 px-4 py-3 align-middle overflow-hidden";
  const toggleLabel = `${isExpanded ? "Collapse" : "Expand"} ${group.entries.length} entries for ${group.task}`;

  const startAgain = () => {
    if (timer.status !== "idle") return;
    const result = startTimer(group.task, group.projectId);
    if (!result.success) toast("Could not start timer", { description: result.error });
  };

  return (
    <tr
      data-tracker-group={group.id}
      className="group/summary bg-surface-secondary/55 transition-colors hover:bg-surface-secondary/75"
    >
      <td className={`${summaryCellClass} min-w-0`}>
        <Button
          size="sm"
          variant="ghost"
          fullWidth
          className={`${summaryButtonClass} gap-2`}
          aria-label={toggleLabel}
          aria-expanded={isExpanded}
          {...(isExpanded ? { "aria-controls": `${group.id}-details` } : {})}
          onPress={onToggle}
        >
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-surface text-xs tabular-nums text-muted">
            {group.entries.length}
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{group.task}</span>
          <ChevronDown
            className={`ml-auto size-4 shrink-0 text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </Button>
      </td>
      <td className={summaryCellClass}>
        <Button
          size="sm"
          variant="ghost"
          fullWidth
          className={summaryButtonClass}
          aria-label={`${toggleLabel}; project ${projectName}; client ${clientName}`}
          onPress={onToggle}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="block w-full min-w-0 truncate text-sm text-foreground">
              {projectName}
            </span>
            <span className="block w-full min-w-0 truncate text-xs text-muted">{clientName}</span>
          </span>
        </Button>
      </td>
      <td className={`${summaryCellClass} text-center`}>
        <Button
          size="sm"
          variant="ghost"
          className={`${summaryButtonClass} w-full justify-center tabular-nums text-muted`}
          aria-label={`${toggleLabel}; starts at ${group.start}`}
          onPress={onToggle}
        >
          {group.start}
        </Button>
      </td>
      <td className={`${summaryCellClass} text-center`}>
        <Button
          size="sm"
          variant="ghost"
          className={`${summaryButtonClass} w-full justify-center tabular-nums text-muted`}
          aria-label={`${toggleLabel}; ends at ${group.end}`}
          onPress={onToggle}
        >
          {group.end}
        </Button>
      </td>
      <td className={summaryCellClass}>
        <Button
          size="sm"
          variant="ghost"
          className={`${summaryButtonClass} tabular-nums text-muted`}
          aria-label={`${toggleLabel}; date ${formatDate(group.date)}`}
          onPress={onToggle}
        >
          {formatDate(group.date)}
        </Button>
      </td>
      <td className={summaryCellClass}>
        <Button
          size="sm"
          variant="ghost"
          className={`${summaryButtonClass} font-medium tabular-nums text-foreground`}
          aria-label={`${toggleLabel}; total ${formatDuration(group.totalSeconds)}`}
          onPress={onToggle}
        >
          {formatDuration(group.totalSeconds)}
        </Button>
      </td>
      <td className="tracker-actions-cell border-b border-default bg-surface-secondary/55 px-2 py-2 align-middle whitespace-nowrap">
        <div className="flex shrink-0 items-center justify-end gap-1" data-tracker-action>
          <Button
            isIconOnly
            aria-label={`Start ${group.task} again`}
            isDisabled={timer.status !== "idle"}
            className="size-8 min-w-8 shrink-0 !p-0"
            variant="tertiary"
            onPress={startAgain}
          >
            <Play className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TrackerEntryRow({
  entry,
  rowId,
  activeField,
  onActivate,
  onDeactivate,
}: {
  entry: TimeEntry;
  rowId?: string | undefined;
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
  const availableProjects = projects.filter(
    (item) => item.status !== "archived" || item.id === entry.projectId,
  );

  const validateDraft = (candidate: EntryDraft, allowFullDayDuration = false): string | null => {
    if (!candidate.task.trim()) return "Task is required.";
    if (!isValidDateOnly(candidate.date)) return "Choose a valid date.";
    if (minutesBetween(candidate.start, candidate.end) <= 0 && !allowFullDayDuration) {
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
    const candidate = { ...draft, [draftField]: normalizedValue } as EntryDraft;
    const message = validateDraft(candidate);
    if (message) {
      setValidationMessage(message);
      return false;
    }

    if (savedDraftRef.current[draftField] === candidate[draftField]) return true;

    const patch =
      field === "project" ? { projectId: candidate.projectId } : { [field]: normalizedValue };
    const result = updateEntry(entry.id, patch);
    if (!result.success) {
      setValidationMessage(result.error);
      return false;
    }

    notifySaved(candidate);
    return true;
  };

  const commitTime = (start: string, end: string, close = false): boolean => {
    const candidate = {
      ...draft,
      start,
      end,
      duration: formatDurationInput(minutesBetween(start, end) * 60),
    };
    const message = validateDraft(candidate);
    if (message) {
      setValidationMessage(message);
      return false;
    }

    if (savedDraftRef.current.start === start && savedDraftRef.current.end === end) {
      if (close) onDeactivate();
      return true;
    }

    const result = updateEntry(entry.id, {
      start,
      end,
      seconds: minutesBetween(start, end) * 60,
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
    const startMinutes = timeToMinutes(draft.start);
    if (
      totalMinutes === null ||
      startMinutes === null ||
      totalMinutes > 24 * 60 ||
      (totalMinutes < 24 * 60 && startMinutes + totalMinutes >= 24 * 60)
    ) {
      setValidationMessage("Use H:MM, HHMM or HMM (for example, 1:20, 120 or 825).");
      return false;
    }

    const end = addSecondsToTime(draft.start, totalMinutes * 60);
    const candidate = {
      ...draft,
      end,
      duration: formatDurationInput(totalMinutes * 60),
    };
    const message = validateDraft(candidate, totalMinutes === 24 * 60);
    if (message) {
      setValidationMessage(message);
      return false;
    }

    if (savedDraftRef.current.end === end) {
      if (close) onDeactivate();
      return true;
    }

    const result = updateEntry(entry.id, { end, seconds: totalMinutes * 60 });
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

  const handleDelete = () => {
    if (!window.confirm(`Delete “${entry.task}”?`)) return;
    deleteEntry(entry.id);
    onDeactivate();
    toast("Time entry deleted");
  };

  const startAgain = () => {
    if (timer.status !== "idle") return;
    const result = startTimer(entry.task, entry.projectId);
    if (!result.success) toast("Could not start timer", { description: result.error });
  };

  const actionCell = (
    <td className="tracker-actions-cell border-b border-default px-2 py-2 align-middle whitespace-nowrap">
      <div className="flex shrink-0 items-center justify-end gap-1" data-tracker-action>
        <Button
          isIconOnly
          aria-label={`Start ${entry.task} again`}
          isDisabled={timer.status !== "idle"}
          className="size-8 min-w-8 shrink-0 !p-0"
          variant="tertiary"
          onPress={startAgain}
        >
          <Play className="size-4" />
        </Button>
        <Dropdown>
          <Dropdown.Trigger
            aria-label={`Actions for ${entry.task}`}
            className="size-8 min-w-8 shrink-0 p-0"
          >
            <MoreHorizontal className="size-4" />
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={(key) => key === "delete" && handleDelete()}>
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
      <span className="mt-1 block text-[11px] text-danger" role="alert">
        {validationMessage}
      </span>
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
  const taskButtonClass =
    "inline-flex min-w-0 max-w-full flex-[0_1_auto] items-center !justify-start !rounded-lg !px-0 !py-1 text-left whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const projectButtonClass =
    "inline-flex w-full min-w-0 !h-auto !min-h-8 !items-start !justify-center !rounded-lg !px-1 !py-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const timeSlotClass =
    "inline-flex !h-8 !w-[5.75rem] !min-w-[5.75rem] shrink-0 items-center justify-center !rounded-lg !px-1 text-sm tabular-nums text-muted whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent";
  const compactInputClass = "!h-8 !min-h-8 !rounded-lg !px-2 !py-1 text-sm";
  const timeInputClass = `${compactInputClass} !w-[5.75rem] !min-w-[5.75rem] shrink-0 text-center tabular-nums`;
  const dateInputClass = `${compactInputClass} !w-[7.25rem] !max-w-full`;
  const durationInputClass = `${compactInputClass} !w-[5.25rem] !min-w-[5.25rem] !max-w-full`;
  const cellClass =
    "tracker-table-cell border-b border-default px-4 py-3 align-middle overflow-hidden";

  return (
    <tr
      id={rowId}
      ref={rowRef}
      data-tracker-entry="true"
      className="group bg-surface transition-colors hover:bg-surface-secondary/50"
    >
      <td className={`${cellClass} min-w-0`}>
        <div className="flex min-w-0 items-center gap-2">
          {activeField === "task" ? (
            <div className="min-w-0 flex-1">
              <Input
                ref={focusRef}
                fullWidth
                className={compactInputClass}
                aria-label="Task"
                value={draft.task}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    task: event.target.value,
                  }))
                }
                onBlur={() => {
                  if (commitField("task", draft.task)) onDeactivate();
                }}
                onKeyDown={(event) => handleTextKeyDown(event, "task")}
              />
            </div>
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
          <Input
            ref={focusRef}
            fullWidth
            className={compactInputClass}
            aria-label="Description"
            placeholder="Add a note"
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            onBlur={() => {
              if (commitField("description", draft.description)) onDeactivate();
            }}
            onKeyDown={(event) => handleTextKeyDown(event, "description")}
          />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            aria-label={entry.description ? "Edit description" : "Add description"}
            className={`${cellButtonClass} mt-0.5 !h-6 !min-h-6 !justify-start text-xs text-muted ${entry.description ? "" : "text-transparent"}`}
            data-tracker-field="description"
            onPress={() => onActivate("description")}
          >
            {entry.description || "·"}
          </Button>
        )}
        {errorFor("task")}
        {errorFor("description")}
      </td>

      <td className={cellClass}>
        {activeField === "project" ? (
          <>
            <Select
              aria-label="Project"
              fullWidth
              value={draft.projectId ?? "none"}
              onChange={(key) => {
                const value = String(key ?? "none");
                const next = value === "none" ? null : value;
                setDraft((current) => ({ ...current, projectId: next }));
                if (commitField("project", next)) onDeactivate();
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="none" textValue="No project">
                    <Label>No project</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {availableProjects.map((item) => (
                    <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
                      <Label>{item.name}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <span className="mt-1 block truncate text-[11px] text-muted">{selectedClientName}</span>
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
              <span className="block w-full min-w-0 truncate text-xs text-muted">{clientName}</span>
            </span>
          </Button>
        )}
      </td>

      <td className={`${cellClass} text-center`}>
        {activeField === "start" ? (
          <Input
            ref={focusRef}
            className={timeInputClass}
            variant="secondary"
            aria-label="Start time"
            type="time"
            value={draft.start}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                start: event.target.value,
              }))
            }
            onBlur={() => commitTime(draft.start, draft.end)}
            onKeyDown={handleTimeKeyDown}
          />
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
        {activeField === "start" && errorFor("start")}
      </td>

      <td className={`${cellClass} text-center`}>
        {activeField === "end" ? (
          <Input
            ref={focusRef}
            className={timeInputClass}
            variant="secondary"
            aria-label="End time"
            type="time"
            value={draft.end}
            onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))}
            onBlur={() => commitTime(draft.start, draft.end)}
            onKeyDown={handleTimeKeyDown}
          />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className={timeSlotClass}
            data-tracker-field="end"
            aria-label={`End time: ${entry.end}`}
            onPress={() => onActivate("end")}
          >
            {entry.end}
          </Button>
        )}
        {activeField === "end" && errorFor("end")}
      </td>

      <td className={cellClass}>
        {activeField === "date" ? (
          <>
            <Input
              ref={focusRef}
              className={dateInputClass}
              variant="secondary"
              aria-label="Date"
              type="date"
              value={draft.date}
              onChange={(event) => {
                const next = event.target.value;
                setDraft((current) => ({ ...current, date: next }));
                if (isValidDateOnly(next) && commitField("date", next)) onDeactivate();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  restoreField();
                }
              }}
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

      <td className={cellClass}>
        {activeField === "duration" ? (
          <>
            <Input
              ref={focusRef}
              className={durationInputClass}
              variant="secondary"
              aria-label="Duration"
              inputMode="decimal"
              placeholder="H:MM"
              value={draft.duration}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  duration: event.target.value,
                }))
              }
              onBlur={() => commitDuration(draft.duration)}
              onKeyDown={handleDurationKeyDown}
            />
            {errorFor("duration")}
          </>
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
  );
}
