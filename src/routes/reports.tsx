import { Button, Label, ListBox, Select } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Download, FileBarChart, RotateCcw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ExportModal } from "@/components/export-modal";
import {
  ReportFiltersBar,
  type ReportFilterKey,
  type ReportFilterValues,
} from "@/components/report-filters";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyBlock, CardsSkeleton } from "@/components/states";
import type { Client, Member, Project, TimeEntry } from "@/lib/mock-data";
import {
  formatDate,
  formatDateRange,
  formatDuration,
  getEndDateForEntry,
  getEntryEndDayOffset,
  getReportPeriodRange,
  getWeekBounds,
  isValidDateOnly,
  normalizeSearch,
  shiftDate,
  type DateRange,
  type ReportPeriodPreset,
} from "@/lib/format";
import { useSimulatedLoad, useStore } from "@/lib/store";
import type { ReportExportPayload } from "@/lib/report-export";

const reportViews = [
  { id: "summary", label: "Summary" },
  { id: "detailed", label: "Detailed" },
  { id: "weekly", label: "Weekly" },
  { id: "team", label: "Team" },
] as const;

type ReportView = (typeof reportViews)[number]["id"];
type GroupDimension = "project" | "client" | "member" | "task" | "date";
type WeeklyDimension = "project" | "member";

const groupOptions: Array<{ id: GroupDimension; label: string }> = [
  { id: "project", label: "Project" },
  { id: "client", label: "Client" },
  { id: "member", label: "Member" },
  { id: "task", label: "Task" },
  { id: "date", label: "Date" },
];

const weeklyOptions: Array<{ id: WeeklyDimension; label: string }> = [
  { id: "project", label: "Project" },
  { id: "member", label: "Member" },
];

const defaultVisibleFilters: ReportFilterKey[] = [
  "member",
  "client",
  "project",
  "task",
  "billability",
];

type ReportSearch = {
  view?: ReportView;
  preset?: ReportPeriodPreset;
  start?: string;
  end?: string;
  members?: string;
  clients?: string;
  projects?: string;
  task?: string;
  description?: string;
  billability?: ReportFilterValues["billability"];
  visible?: string;
  group?: GroupDimension;
  subgroup?: GroupDimension | "none";
  weeklyGroup?: WeeklyDimension;
  page?: number;
};

function isReportView(value: unknown): value is ReportView {
  return reportViews.some((view) => view.id === value);
}

function isPeriodPreset(value: unknown): value is ReportPeriodPreset {
  return [
    "today",
    "yesterday",
    "this-week",
    "last-week",
    "last-two-weeks",
    "this-month",
    "last-month",
    "this-year",
    "last-year",
    "custom",
  ].includes(value as ReportPeriodPreset);
}

function isGroupDimension(value: unknown): value is GroupDimension {
  return groupOptions.some((option) => option.id === value);
}

function isWeeklyDimension(value: unknown): value is WeeklyDimension {
  return weeklyOptions.some((option) => option.id === value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asCsv(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseIds(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function encodeIds(values: string[]): string {
  return values.join(",");
}

function makeRange(
  preset: ReportPeriodPreset,
  start: string,
  end: string,
  today: string,
  weekStartsOn: 0 | 1,
): DateRange {
  if (preset === "custom" && isValidDateOnly(start) && isValidDateOnly(end)) {
    return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start };
  }
  return getReportPeriodRange(preset, today, weekStartsOn);
}

function nameForMember(members: Member[], id: string): string {
  return members.find((member) => member.id === id)?.name ?? "Unknown member";
}

function projectFor(projects: Project[], id: string | null): Project | null {
  return id ? (projects.find((project) => project.id === id) ?? null) : null;
}

function clientNameFor(clients: Client[], projects: Project[], projectId: string | null): string {
  const project = projectFor(projects, projectId);
  return project
    ? (clients.find((client) => client.id === project.clientId)?.name ?? "Unknown client")
    : "No client";
}

function projectNameFor(projects: Project[], projectId: string | null): string {
  return projectFor(projects, projectId)?.name ?? "No project";
}

function endLabel(entry: TimeEntry): string {
  const offset = getEntryEndDayOffset(entry);
  return `${entry.end}${offset > 0 ? ` +${offset}` : ""}`;
}

function compareEntries(a: TimeEntry, b: TimeEntry): number {
  return (
    b.date.localeCompare(a.date) ||
    b.start.localeCompare(a.start) ||
    getEndDateForEntry(b).localeCompare(getEndDateForEntry(a)) ||
    b.end.localeCompare(a.end) ||
    b.id.localeCompare(a.id)
  );
}

function getDimensionLabel(
  entry: TimeEntry,
  dimension: GroupDimension,
  members: Member[],
  projects: Project[],
  clients: Client[],
): string {
  if (dimension === "project") return projectNameFor(projects, entry.projectId);
  if (dimension === "client") return clientNameFor(clients, projects, entry.projectId);
  if (dimension === "member") return nameForMember(members, entry.userId);
  if (dimension === "task") return entry.task || "Untitled task";
  return formatDate(entry.date);
}

function getDimensionKey(entry: TimeEntry, dimension: GroupDimension, projects: Project[]): string {
  if (dimension === "project") return entry.projectId ?? "none";
  if (dimension === "client") return projectFor(projects, entry.projectId)?.clientId ?? "none";
  if (dimension === "member") return entry.userId;
  if (dimension === "task") return normalizeSearch(entry.task);
  return entry.date;
}

type ReportGroup = {
  key: string;
  label: string;
  seconds: number;
  billable: number;
  records: number;
  entries: TimeEntry[];
  children?: ReportGroup[];
};

function buildGroups(
  entries: TimeEntry[],
  primary: GroupDimension,
  secondary: GroupDimension | "none",
  members: Member[],
  projects: Project[],
  clients: Client[],
): ReportGroup[] {
  const primaryMap = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = getDimensionKey(entry, primary, projects);
    const current = primaryMap.get(key) ?? [];
    current.push(entry);
    primaryMap.set(key, current);
  }

  return [...primaryMap.entries()]
    .map(([key, groupEntries]) => {
      const children =
        secondary === "none" || secondary === primary
          ? undefined
          : buildGroups(groupEntries, secondary, "none", members, projects, clients);
      const seconds = groupEntries.reduce((sum, entry) => sum + entry.seconds, 0);
      return {
        key,
        label: getDimensionLabel(
          groupEntries[0] ?? entries[0]!,
          primary,
          members,
          projects,
          clients,
        ),
        seconds,
        billable: groupEntries
          .filter((entry) => entry.billable)
          .reduce((sum, entry) => sum + entry.seconds, 0),
        records: groupEntries.length,
        entries: groupEntries,
        ...(children ? { children } : {}),
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));
}

export const Route = createFileRoute("/reports")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    view: isReportView(search["view"]) ? search["view"] : "detailed",
    preset: isPeriodPreset(search["preset"]) ? search["preset"] : "this-month",
    start: asText(search["start"]),
    end: asText(search["end"]),
    members: asCsv(search["members"]),
    clients: asCsv(search["clients"]),
    projects: asCsv(search["projects"]),
    task: asText(search["task"]),
    description: asText(search["description"]),
    billability:
      search["billability"] === "billable" || search["billability"] === "internal"
        ? search["billability"]
        : "all",
    visible:
      typeof search["visible"] === "string" ? search["visible"] : defaultVisibleFilters.join(","),
    group: isGroupDimension(search["group"]) ? search["group"] : "project",
    subgroup:
      search["subgroup"] === "none" || isGroupDimension(search["subgroup"])
        ? search["subgroup"]
        : "none",
    weeklyGroup: isWeeklyDimension(search["weeklyGroup"]) ? search["weeklyGroup"] : "project",
    page:
      Number.isInteger(search["page"]) && Number(search["page"]) > 0 ? Number(search["page"]) : 1,
  }),
  head: () => ({
    meta: [
      { title: "Reports — Time Blossom" },
      { name: "description", content: "Detailed, summary, weekly and team time reports." },
      { property: "og:title", content: "Reports — Time Blossom" },
      { property: "og:description", content: "Filter and understand tracked time." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const rawSearch = Route.useSearch();
  const search: Required<ReportSearch> = {
    view: rawSearch.view ?? "detailed",
    preset: rawSearch.preset ?? "this-month",
    start: rawSearch.start ?? "",
    end: rawSearch.end ?? "",
    members: rawSearch.members ?? "",
    clients: rawSearch.clients ?? "",
    projects: rawSearch.projects ?? "",
    task: rawSearch.task ?? "",
    description: rawSearch.description ?? "",
    billability: rawSearch.billability ?? "all",
    visible: rawSearch.visible ?? defaultVisibleFilters.join(","),
    group: rawSearch.group ?? "project",
    subgroup: rawSearch.subgroup ?? "none",
    weeklyGroup: rawSearch.weeklyGroup ?? "project",
    page: rawSearch.page ?? 1,
  };
  const navigate = Route.useNavigate();
  const { entries, projects, clients, members, currentUserId, can, settings, today } = useStore();
  const loading = useSimulatedLoad(600);
  const [exportOpen, setExportOpen] = useState(false);

  const weekStartsOn = settings.weekStart === "sunday" ? 0 : 1;
  const requestedRange = makeRange(search.preset, search.start, search.end, today, weekStartsOn);
  const range =
    search.view === "weekly"
      ? (() => {
          const week = getWeekBounds(requestedRange.startDate, weekStartsOn);
          return { startDate: week.start, endDate: week.end };
        })()
      : requestedRange;
  const showTeam = can("view-all-reports");
  const filterValues = useMemo<ReportFilterValues>(
    () => ({
      memberIds: parseIds(search.members),
      clientIds: parseIds(search.clients),
      projectIds: parseIds(search.projects),
      task: search.task,
      description: search.description,
      billability: search.billability,
    }),
    [
      search.billability,
      search.clients,
      search.description,
      search.members,
      search.projects,
      search.task,
    ],
  );
  const visibleFilters = parseIds(search.visible).filter((key): key is ReportFilterKey =>
    ["member", "client", "project", "task", "description", "billability"].includes(key),
  );

  const updateSearch = (patch: Partial<ReportSearch>) => {
    navigate({
      search: (previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }),
    });
  };

  const updatePeriod = (preset: ReportPeriodPreset, nextRange: DateRange) => {
    const normalized =
      search.view === "weekly" ? getWeekBounds(nextRange.startDate, weekStartsOn) : null;
    updateSearch({
      preset,
      start: normalized?.start ?? nextRange.startDate,
      end: normalized?.end ?? nextRange.endDate,
    });
  };

  const shiftWeeklyPeriod = (direction: -1 | 1) => {
    updateSearch({
      preset: "custom",
      start: shiftDate(range.startDate, direction * 7),
      end: shiftDate(range.endDate, direction * 7),
    });
  };

  const scopedEntries = can("view-all-reports")
    ? entries
    : entries.filter((entry) => entry.userId === currentUserId);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const normalizedTask = normalizeSearch(filterValues.task);
  const normalizedDescription = normalizeSearch(filterValues.description);

  const filteredEntries = useMemo(() => {
    const selectedMemberIds = new Set(filterValues.memberIds);
    const selectedClientIds = new Set(filterValues.clientIds);
    const selectedProjectIds = new Set(filterValues.projectIds);
    return scopedEntries
      .filter((entry) => entry.date >= range.startDate && entry.date <= range.endDate)
      .filter((entry) => selectedMemberIds.size === 0 || selectedMemberIds.has(entry.userId))
      .filter((entry) => {
        if (selectedClientIds.size === 0) return true;
        const project = entry.projectId ? projectMap.get(entry.projectId) : undefined;
        return Boolean(project && selectedClientIds.has(project.clientId));
      })
      .filter(
        (entry) =>
          selectedProjectIds.size === 0 || selectedProjectIds.has(entry.projectId ?? "none"),
      )
      .filter((entry) => !normalizedTask || normalizeSearch(entry.task).includes(normalizedTask))
      .filter(
        (entry) =>
          !normalizedDescription ||
          normalizeSearch(entry.description ?? "").includes(normalizedDescription),
      )
      .filter(
        (entry) =>
          filterValues.billability === "all" ||
          (filterValues.billability === "billable" ? entry.billable : !entry.billable),
      )
      .sort(compareEntries);
  }, [
    filterValues,
    normalizedDescription,
    normalizedTask,
    projectMap,
    range.endDate,
    range.startDate,
    scopedEntries,
  ]);

  const total = filteredEntries.reduce((sum, entry) => sum + entry.seconds, 0);
  const billable = filteredEntries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.seconds, 0);
  const internal = total - billable;
  const reportScope = can("export-all-reports") ? "Workspace report" : "Your report";
  const [summaryExpanded, setSummaryExpanded] = useState<Record<string, boolean>>({});
  const groups = useMemo(
    () => buildGroups(filteredEntries, search.group, search.subgroup, members, projects, clients),
    [clients, filteredEntries, members, projects, search.group, search.subgroup],
  );

  const exportPayload = useMemo<ReportExportPayload>(() => {
    if (search.view === "detailed") {
      const columns = [
        "Project",
        "Client",
        "Task",
        "User",
        "Email",
        "Description",
        "Billability",
        "Start date",
        "Start time",
        "End date",
        "End time",
        "Duration",
      ];
      return {
        title: `time-blossom-${search.view}`,
        columns,
        rows: filteredEntries.map((entry) => {
          const member = memberMap.get(entry.userId);
          const endDate = getEndDateForEntry(entry);
          return {
            Project: projectNameFor(projects, entry.projectId),
            Client: clientNameFor(clients, projects, entry.projectId),
            Task: entry.task,
            User: member?.name ?? "Unknown member",
            Email: member?.email ?? "",
            Description: entry.description ?? "",
            Billability: entry.billable ? "Billable" : "Internal",
            "Start date": entry.date,
            "Start time": entry.start,
            "End date": endDate,
            "End time": entry.end,
            Duration: formatDuration(entry.seconds),
          };
        }),
      };
    }
    if (search.view === "summary") {
      return {
        title: `time-blossom-${search.view}`,
        columns: ["Group", "Tracked", "Billable", "Internal", "Records"],
        rows: groups.map((group) => ({
          Group: group.label,
          Tracked: formatDuration(group.seconds),
          Billable: formatDuration(group.billable),
          Internal: formatDuration(group.seconds - group.billable),
          Records: group.records,
        })),
      };
    }
    if (search.view === "weekly") {
      const weekDates = Array.from({ length: 7 }, (_, index) => shiftDate(range.startDate, index));
      const rows = buildWeeklyRows(
        filteredEntries,
        search.weeklyGroup,
        members,
        projects,
        weekDates,
      );
      return {
        title: `time-blossom-${search.view}`,
        columns: ["Group", ...weekDates, "Tracked", "Billable", "Internal"],
        rows: rows.map((row) => ({
          Group: row.label,
          ...Object.fromEntries(
            weekDates.map((date) => [date, formatDuration(row.byDate[date] ?? 0)]),
          ),
          Tracked: formatDuration(row.seconds),
          Billable: formatDuration(row.billable),
          Internal: formatDuration(row.seconds - row.billable),
        })),
      };
    }
    const teamRows = buildTeamRows(
      filteredEntries,
      members,
      projects,
      clients,
      showTeam ? null : currentUserId,
    );
    return {
      title: `time-blossom-${search.view}`,
      columns: [
        "Member",
        "Tracked",
        "Billable",
        "Internal",
        "Records",
        "Projects",
        "Clients",
        "Average/day",
        "Share",
      ],
      rows: teamRows.map((row) => ({
        Member: row.member.name,
        Tracked: formatDuration(row.seconds),
        Billable: formatDuration(row.billable),
        Internal: formatDuration(row.seconds - row.billable),
        Records: row.records,
        Projects: row.projectCount,
        Clients: row.clientCount,
        "Average/day": formatDuration(
          row.activeDays ? Math.round(row.seconds / row.activeDays) : 0,
        ),
        Share: total ? `${Math.round((row.seconds / total) * 100)}%` : "0%",
      })),
    };
  }, [
    clients,
    currentUserId,
    filteredEntries,
    groups,
    members,
    memberMap,
    projects,
    range.startDate,
    search.view,
    search.weeklyGroup,
    showTeam,
    total,
  ]);

  const description = {
    detailed: "Inspect every entry with its project, client, person and billability.",
    summary: "Compare totals with flexible project, client, member, task or date groups.",
    weekly: "Review one complete week across projects or team members.",
    team: "Compare time, billing mix and activity across the available team.",
  }[search.view];

  const clearFilters = () =>
    updateSearch({
      members: "",
      clients: "",
      projects: "",
      task: "",
      description: "",
      billability: "all",
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Report view"
              className="w-36"
              value={search.view}
              onChange={(key) => {
                if (key) updateSearch({ view: String(key) as ReportView });
              }}
            >
              <Label className="sr-only">Report view</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label="Report views">
                  {reportViews.map((report) => (
                    <ListBox.Item key={report.id} id={report.id} textValue={report.label}>
                      <Label>{report.label}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button variant="secondary" onPress={() => setExportOpen(true)}>
              <Download className="size-4" />
              Export
            </Button>
          </div>
        }
      />

      <ReportFiltersBar
        preset={search.preset}
        range={range}
        today={today}
        weekStartsOn={weekStartsOn}
        values={filterValues}
        visibleFilters={visibleFilters}
        members={members}
        clients={clients}
        projects={projects}
        showTeam={showTeam}
        weeklyNavigation={search.view === "weekly"}
        onPeriodChange={updatePeriod}
        onPeriodShift={shiftWeeklyPeriod}
        onChange={(patch) => {
          const next = { ...filterValues, ...patch };
          updateSearch({
            members: encodeIds(next.memberIds),
            clients: encodeIds(next.clientIds),
            projects: encodeIds(next.projectIds),
            task: next.task,
            description: next.description,
            billability: next.billability,
          });
        }}
        onVisibleFiltersChange={(filters) => updateSearch({ visible: encodeIds(filters) })}
        onClear={() =>
          updateSearch({
            members: "",
            clients: "",
            projects: "",
            task: "",
            description: "",
            billability: "all",
          })
        }
      />

      {loading ? (
        <CardsSkeleton count={3} />
      ) : (
        <>
          <ReportOverview
            total={total}
            billable={billable}
            internal={internal}
            records={filteredEntries.length}
          />
          {search.view === "detailed" ? (
            <DetailedReport
              entries={filteredEntries}
              page={search.page}
              onPageChange={(page) => updateSearch({ page })}
              onClear={clearFilters}
              members={members}
              projects={projects}
              clients={clients}
            />
          ) : search.view === "summary" ? (
            <SummaryReport
              groups={groups}
              total={total}
              primary={search.group}
              secondary={search.subgroup}
              expanded={summaryExpanded}
              onToggle={(key) =>
                setSummaryExpanded((current) => ({ ...current, [key]: !current[key] }))
              }
              onChangeGroup={(group) =>
                updateSearch({
                  group,
                  subgroup: group === search.subgroup ? "none" : search.subgroup,
                })
              }
              onChangeSubgroup={(subgroup) => updateSearch({ subgroup })}
              onClear={clearFilters}
            />
          ) : search.view === "weekly" ? (
            <WeeklyReport
              entries={filteredEntries}
              range={range}
              dimension={search.weeklyGroup}
              members={members}
              projects={projects}
              onChange={(weeklyGroup) => updateSearch({ weeklyGroup })}
              onClear={clearFilters}
            />
          ) : (
            <TeamReport
              entries={filteredEntries}
              members={members}
              projects={projects}
              clients={clients}
              total={total}
              scopeToMember={showTeam ? null : currentUserId}
              onClear={clearFilters}
            />
          )}
        </>
      )}

      <ExportModal
        isOpen={exportOpen}
        onOpenChange={setExportOpen}
        scope={reportScope}
        payload={exportPayload}
      />
    </div>
  );
}

function ReportOverview({
  total,
  billable,
  internal,
  records,
}: {
  total: number;
  billable: number;
  internal: number;
  records: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Tracked" value={formatDuration(total)} />
      <StatCard label="Billable" value={formatDuration(billable)} />
      <StatCard label="Internal" value={formatDuration(internal)} />
      <StatCard label="Entries" value={String(records)} />
    </div>
  );
}

function ReportTable({
  children,
  minWidth = "min-w-[920px]",
}: {
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-default bg-surface">
      <table className={`w-full ${minWidth} border-collapse text-sm`}>{children}</table>
    </div>
  );
}

function ReportTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-default bg-surface-secondary text-left">{children}</thead>
  );
}

function EmptyReport({ onClear }: { onClear: () => void }) {
  return (
    <EmptyBlock
      icon={<FileBarChart className="size-5" />}
      title="No time entries match"
      description="Try a wider period or clear one of the active filters."
      action={
        <Button variant="secondary" onPress={onClear}>
          <RotateCcw className="size-4" />
          Clear filters
        </Button>
      }
    />
  );
}

function DetailedReport({
  entries,
  page,
  onPageChange,
  onClear,
  members,
  projects,
  clients,
}: {
  entries: TimeEntry[];
  page: number;
  onPageChange: (page: number) => void;
  onClear: () => void;
  members: Member[];
  projects: Project[];
  clients: Client[];
}) {
  if (entries.length === 0) return <EmptyReport onClear={onClear} />;
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <div className="space-y-3">
      <ReportTable minWidth="min-w-[1180px]">
        <ReportTableHead>
          <tr>
            {[
              "Date",
              "Member",
              "Project",
              "Client",
              "Task",
              "Description",
              "Start",
              "End",
              "Duration",
              "Billability",
            ].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase"
              >
                {label}
              </th>
            ))}
          </tr>
        </ReportTableHead>
        <tbody>
          {pageEntries.map((entry) => (
            <tr key={entry.id} className="border-b border-default last:border-b-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(entry.date)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {nameForMember(members, entry.userId)}
              </td>
              <td className="px-4 py-3 font-medium">{projectNameFor(projects, entry.projectId)}</td>
              <td className="px-4 py-3 text-muted">
                {clientNameFor(clients, projects, entry.projectId)}
              </td>
              <td className="max-w-48 px-4 py-3 font-medium">
                <div className="truncate">{entry.task}</div>
              </td>
              <td className="max-w-56 px-4 py-3 text-muted">
                <div className="truncate">{entry.description ?? "—"}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{entry.start}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                {endLabel(entry)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">
                {formatDuration(entry.seconds)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {entry.billable ? "Billable" : "Internal"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-default bg-surface-secondary">
          <tr>
            <td colSpan={8} className="px-4 py-3 text-right font-medium text-muted">
              Total · {entries.length} entries
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
              {formatDuration(entries.reduce((sum, entry) => sum + entry.seconds, 0))}
            </td>
            <td className="px-4 py-3 text-muted">
              {formatDuration(
                entries
                  .filter((entry) => entry.billable)
                  .reduce((sum, entry) => sum + entry.seconds, 0),
              )}{" "}
              billable
            </td>
          </tr>
        </tfoot>
      </ReportTable>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          {entries.length} entries · page {currentPage} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            isDisabled={currentPage === 1}
            onPress={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={currentPage === pageCount}
            onPress={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryReport({
  groups,
  total,
  primary,
  secondary,
  expanded,
  onToggle,
  onChangeGroup,
  onChangeSubgroup,
  onClear,
}: {
  groups: ReportGroup[];
  total: number;
  primary: GroupDimension;
  secondary: GroupDimension | "none";
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onChangeGroup: (group: GroupDimension) => void;
  onChangeSubgroup: (group: GroupDimension | "none") => void;
  onClear: () => void;
}) {
  if (groups.length === 0) return <EmptyReport onClear={onClear} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <GroupSelect
          label="Group by"
          value={primary}
          options={groupOptions}
          onChange={(value) => {
            if (value !== "none") onChangeGroup(value);
          }}
        />
        <GroupSelect
          label="Then by"
          value={secondary}
          options={[
            { id: "none", label: "None" },
            ...groupOptions.filter((option) => option.id !== primary),
          ]}
          onChange={onChangeSubgroup}
        />
      </div>
      <ReportTable>
        <ReportTableHead>
          <tr>
            {["Group", "Tracked", "Billable", "Internal", "Records", "Share"].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase"
              >
                {label}
              </th>
            ))}
          </tr>
        </ReportTableHead>
        <tbody>
          {groups.map((group) => (
            <SummaryRow
              key={group.key}
              group={group}
              total={total}
              level={0}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </ReportTable>
    </div>
  );
}

function SummaryRow({
  group,
  total,
  level,
  expanded,
  onToggle,
}: {
  group: ReportGroup;
  total: number;
  level: number;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const expandable = Boolean(group.children?.length);
  const isOpen = Boolean(expanded[group.key]);
  return (
    <>
      <tr className="border-b border-default last:border-b-0">
        <td className="px-4 py-3" style={{ paddingLeft: `${16 + level * 24}px` }}>
          <div className="flex min-w-0 items-center gap-2">
            {expandable ? (
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.label}`}
                aria-expanded={isOpen}
                onPress={() => onToggle(group.key)}
              >
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </Button>
            ) : (
              <span className="size-8" />
            )}
            <span className="truncate font-medium">{group.label}</span>
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">
          {formatDuration(group.seconds)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
          {formatDuration(group.billable)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
          {formatDuration(group.seconds - group.billable)}
        </td>
        <td className="px-4 py-3 tabular-nums text-muted">{group.records}</td>
        <td className="px-4 py-3 tabular-nums text-muted">
          {total ? `${Math.round((group.seconds / total) * 100)}%` : "0%"}
        </td>
      </tr>
      {isOpen
        ? group.children?.map((child) => (
            <SummaryRow
              key={`${group.key}-${child.key}`}
              group={child}
              total={total}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))
        : null}
    </>
  );
}

function GroupSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: GroupDimension | "none") => void;
}) {
  return (
    <Select
      aria-label={label}
      className="w-44"
      value={value}
      onChange={(key) => {
        if (key) onChange(String(key) as GroupDimension | "none");
      }}
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={label}>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              <Label>{option.label}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

type WeeklyRow = {
  key: string;
  label: string;
  seconds: number;
  billable: number;
  byDate: Record<string, number>;
};

function buildWeeklyRows(
  entries: TimeEntry[],
  dimension: WeeklyDimension,
  members: Member[],
  projects: Project[],
  dates: string[],
): WeeklyRow[] {
  const map = new Map<string, WeeklyRow>();
  for (const entry of entries) {
    const key = dimension === "project" ? (entry.projectId ?? "none") : entry.userId;
    const label =
      dimension === "project"
        ? projectNameFor(projects, entry.projectId)
        : nameForMember(members, entry.userId);
    const current = map.get(key) ?? { key, label, seconds: 0, billable: 0, byDate: {} };
    current.seconds += entry.seconds;
    current.billable += entry.billable ? entry.seconds : 0;
    current.byDate[entry.date] = (current.byDate[entry.date] ?? 0) + entry.seconds;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));
}

function WeeklyReport({
  entries,
  range,
  dimension,
  members,
  projects,
  onChange,
  onClear,
}: {
  entries: TimeEntry[];
  range: DateRange;
  dimension: WeeklyDimension;
  members: Member[];
  projects: Project[];
  onChange: (dimension: WeeklyDimension) => void;
  onClear: () => void;
}) {
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(range.startDate, index));
  const rows = buildWeeklyRows(entries, dimension, members, projects, dates);
  if (rows.length === 0) return <EmptyReport onClear={onClear} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <GroupSelect
          label="Weekly group"
          value={dimension}
          options={weeklyOptions}
          onChange={(value) => {
            if (value === "project" || value === "member") onChange(value);
          }}
        />
      </div>
      <ReportTable minWidth="min-w-[940px]">
        <ReportTableHead>
          <tr>
            <th className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase">
              Group
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase"
              >
                {formatDate(date)}
              </th>
            ))}
            <th className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase">
              Tracked
            </th>
            <th className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase">
              Billable
            </th>
            <th className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase">
              Internal
            </th>
          </tr>
        </ReportTableHead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-default last:border-b-0">
              <td className="px-4 py-3 font-medium">{row.label}</td>
              {dates.map((date) => (
                <td key={date} className="px-4 py-3 tabular-nums text-muted">
                  {formatDuration(row.byDate[date] ?? 0)}
                </td>
              ))}
              <td className="px-4 py-3 font-medium tabular-nums">{formatDuration(row.seconds)}</td>
              <td className="px-4 py-3 tabular-nums text-muted">{formatDuration(row.billable)}</td>
              <td className="px-4 py-3 tabular-nums text-muted">
                {formatDuration(row.seconds - row.billable)}
              </td>
            </tr>
          ))}
        </tbody>
      </ReportTable>
    </div>
  );
}

type TeamRow = {
  member: Member;
  seconds: number;
  billable: number;
  records: number;
  projectCount: number;
  clientCount: number;
  activeDays: number;
};

function buildTeamRows(
  entries: TimeEntry[],
  members: Member[],
  projects: Project[],
  clients: Client[],
  onlyMemberId: string | null,
): TeamRow[] {
  return members
    .filter((member) => member.status === "active" && (!onlyMemberId || member.id === onlyMemberId))
    .map((member) => {
      const memberEntries = entries.filter((entry) => entry.userId === member.id);
      return {
        member,
        seconds: memberEntries.reduce((sum, entry) => sum + entry.seconds, 0),
        billable: memberEntries
          .filter((entry) => entry.billable)
          .reduce((sum, entry) => sum + entry.seconds, 0),
        records: memberEntries.length,
        projectCount: new Set(memberEntries.map((entry) => entry.projectId)).size,
        clientCount: new Set(
          memberEntries
            .map((entry) => projectFor(projects, entry.projectId)?.clientId)
            .filter(Boolean),
        ).size,
        activeDays: new Set(memberEntries.map((entry) => entry.date)).size,
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.member.name.localeCompare(b.member.name));
}

function TeamReport({
  entries,
  members,
  projects,
  clients,
  total,
  scopeToMember,
  onClear,
}: {
  entries: TimeEntry[];
  members: Member[];
  projects: Project[];
  clients: Client[];
  total: number;
  scopeToMember: string | null;
  onClear: () => void;
}) {
  const rows = buildTeamRows(entries, members, projects, clients, scopeToMember);
  if (rows.length === 0) return <EmptyReport onClear={onClear} />;
  return (
    <ReportTable minWidth="min-w-[1040px]">
      <ReportTableHead>
        <tr>
          {[
            "Member",
            "Tracked",
            "Billable",
            "Internal",
            "Records",
            "Projects",
            "Clients",
            "Average/day",
            "Share",
          ].map((label) => (
            <th
              key={label}
              className="px-4 py-3 text-xs font-medium tracking-wide text-muted uppercase"
            >
              {label}
            </th>
          ))}
        </tr>
      </ReportTableHead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.member.id} className="border-b border-default last:border-b-0">
            <td className="px-4 py-3">
              <div className="font-medium">{row.member.name}</div>
              <div className="text-xs text-muted">{row.member.email}</div>
            </td>
            <td className="px-4 py-3 font-medium tabular-nums">{formatDuration(row.seconds)}</td>
            <td className="px-4 py-3 tabular-nums text-muted">{formatDuration(row.billable)}</td>
            <td className="px-4 py-3 tabular-nums text-muted">
              {formatDuration(row.seconds - row.billable)}
            </td>
            <td className="px-4 py-3 tabular-nums text-muted">{row.records}</td>
            <td className="px-4 py-3 tabular-nums text-muted">{row.projectCount}</td>
            <td className="px-4 py-3 tabular-nums text-muted">{row.clientCount}</td>
            <td className="px-4 py-3 tabular-nums text-muted">
              {formatDuration(row.activeDays ? Math.round(row.seconds / row.activeDays) : 0)}
            </td>
            <td className="px-4 py-3 tabular-nums text-muted">
              {total ? `${Math.round((row.seconds / total) * 100)}%` : "0%"}
            </td>
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );
}
