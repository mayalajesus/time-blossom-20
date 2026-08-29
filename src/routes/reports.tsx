import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  ListBox,
  Popover,
  ProgressBar,
  ProgressCircle,
  Select,
  Table,
  TextField,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Download, FileBarChart, RotateCcw } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { ExportModal } from "@/components/export-modal";
import {
  ReportFiltersBar,
  type ReportFilterKey,
  type ReportFilterValues,
} from "@/components/report-filters";
import { PageHeader } from "@/components/page-header";
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
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const reportViews = [
  { id: "summary", label: "Summary" },
  { id: "detailed", label: "Detailed" },
  { id: "weekly", label: "Weekly" },
  { id: "team", label: "Team" },
] as const;

type ReportView = (typeof reportViews)[number]["id"];
type GroupDimension = "project" | "client" | "member" | "task" | "date";
type WeeklyDimension = "project" | "member";
type DetailedColumn =
  | "date"
  | "member"
  | "projectClient"
  | "task"
  | "description"
  | "start"
  | "end"
  | "duration"
  | "billability";

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

const detailedColumnOptions: Array<{ id: DetailedColumn; label: string }> = [
  { id: "date", label: "Date" },
  { id: "task", label: "Task" },
  { id: "projectClient", label: "Project / client" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { id: "duration", label: "Duration" },
  { id: "billability", label: "Billability" },
  { id: "member", label: "Member" },
  { id: "description", label: "Description" },
];

const defaultDetailedColumns: DetailedColumn[] = [
  "date",
  "task",
  "projectClient",
  "start",
  "end",
  "duration",
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
  columns?: string;
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

function isDetailedColumn(value: string): value is DetailedColumn {
  return detailedColumnOptions.some((column) => column.id === value);
}

function parseDetailedColumns(value: string): DetailedColumn[] {
  const columns = value.split(",").filter(isDetailedColumn);
  return columns.length > 0 ? [...new Set(columns)] : defaultDetailedColumns;
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
  locale: Locale,
): string {
  if (dimension === "project") return projectNameFor(projects, entry.projectId);
  if (dimension === "client") return clientNameFor(clients, projects, entry.projectId);
  if (dimension === "member") return nameForMember(members, entry.userId);
  if (dimension === "task") return entry.task || "Untitled task";
  return formatDate(entry.date, locale);
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
  locale: Locale,
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
          : buildGroups(groupEntries, secondary, "none", members, projects, clients, locale);
      const seconds = groupEntries.reduce((sum, entry) => sum + entry.seconds, 0);
      return {
        key,
        label: getDimensionLabel(
          groupEntries[0] ?? entries[0]!,
          primary,
          members,
          projects,
          clients,
          locale,
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
    view: isReportView(search["view"]) ? search["view"] : "summary",
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
    columns: asCsv(search["columns"]),
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
    view: rawSearch.view ?? "summary",
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
    columns: rawSearch.columns ?? defaultDetailedColumns.join(","),
    page: rawSearch.page ?? 1,
  };
  const navigate = Route.useNavigate();
  const {
    entries,
    projects,
    clients,
    members,
    currentUserId,
    currentWorkspace,
    can,
    settings,
    today,
  } = useStore();
  const { locale, t } = useI18n();
  const loading = useSimulatedLoad(600);
  const [exportOpen, setExportOpen] = useState(false);

  const weekStartsOn = settings.weekStart === "sunday" ? 0 : 1;
  const requestedRange =
    search.view === "weekly" && !search.start && !search.end && search.preset === "this-month"
      ? (() => {
          const week = getWeekBounds(today, weekStartsOn);
          return { startDate: week.start, endDate: week.end };
        })()
      : makeRange(search.preset, search.start, search.end, today, weekStartsOn);
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
      search: { ...search, ...patch, page: patch.page ?? 1 },
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

  const changeView = (nextView: ReportView) => {
    if (nextView === "weekly") {
      const week = getWeekBounds(today, weekStartsOn);
      updateSearch({ view: nextView, preset: "this-week", start: week.start, end: week.end });
      return;
    }
    updateSearch({ view: nextView });
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
  const reportScope = can("export-all-reports") ? t("Workspace report") : t("Your report");
  const [summaryExpanded, setSummaryExpanded] = useState<Record<string, boolean>>({});
  const groups = useMemo(
    () =>
      buildGroups(
        filteredEntries,
        search.group,
        search.subgroup,
        members,
        projects,
        clients,
        locale,
      ),
    [clients, filteredEntries, members, projects, locale, search.group, search.subgroup],
  );
  const exportContext = useMemo(
    () => ({
      locale,
      ...(currentWorkspace
        ? {
            branding: {
              workspaceName: currentWorkspace.name,
              logoDataUrl: currentWorkspace.logoDataUrl,
            },
          }
        : {}),
      displayTitle: `${t(reportViews.find((report) => report.id === search.view)?.label ?? "Time")} ${t("report")}`,
      subtitle: `Time Blossom · ${formatDateRange(range.startDate, range.endDate, locale)}`,
      meta: [
        { label: t("Period"), value: formatDateRange(range.startDate, range.endDate, locale) },
        { label: t("Scope"), value: reportScope },
        {
          label: t("Filters"),
          value:
            [
              search.members
                ? t("{count} team members", { count: parseIds(search.members).length })
                : "",
              search.clients
                ? t("{count} clients", { count: parseIds(search.clients).length })
                : "",
              search.projects
                ? t("{count} projects", { count: parseIds(search.projects).length })
                : "",
              search.task ? `${t("Task")}: ${search.task}` : "",
              search.description ? `${t("Description")}: ${search.description}` : "",
              search.billability !== "all" ? t(search.billability) : "",
            ]
              .filter(Boolean)
              .join(" · ") || t("None"),
        },
      ],
      summary: [
        { label: t("Tracked"), value: formatDuration(total, locale) },
        { label: t("Billable"), value: formatDuration(billable, locale) },
        { label: t("Internal"), value: formatDuration(internal, locale) },
        { label: t("Records"), value: String(filteredEntries.length) },
      ],
    }),
    [
      billable,
      currentWorkspace,
      filteredEntries.length,
      internal,
      locale,
      range.endDate,
      range.startDate,
      reportScope,
      search.billability,
      search.clients,
      search.description,
      search.members,
      search.projects,
      search.task,
      search.view,
      t,
      total,
    ],
  );

  const exportPayload = useMemo<ReportExportPayload>(() => {
    if (search.view === "detailed") {
      const columns = [
        t("Project"),
        t("Client"),
        t("Task"),
        t("User"),
        t("Email"),
        t("Description"),
        t("Billability"),
        t("Start date"),
        t("Start time"),
        t("End date"),
        t("End time"),
        t("Duration"),
      ];
      return {
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns,
        rows: filteredEntries.map((entry) => {
          const member = memberMap.get(entry.userId);
          const endDate = getEndDateForEntry(entry);
          return {
            [t("Project")]: projectNameFor(projects, entry.projectId),
            [t("Client")]: clientNameFor(clients, projects, entry.projectId),
            [t("Task")]: entry.task,
            [t("User")]: member?.name ?? t("Unknown member"),
            [t("Email")]: member?.email ?? "",
            [t("Description")]: entry.description ?? "",
            [t("Billability")]: entry.billable ? t("Billable") : t("Internal"),
            [t("Start date")]: formatDate(entry.date, locale),
            [t("Start time")]: entry.start,
            [t("End date")]: formatDate(endDate, locale),
            [t("End time")]: endLabel(entry),
            [t("Duration")]: formatDuration(entry.seconds, locale),
          };
        }),
      };
    }
    if (search.view === "summary") {
      return {
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns: [t("Group"), t("Tracked"), t("Billable"), t("Internal"), t("Records")],
        rows: groups.map((group) => ({
          [t("Group")]: group.label,
          [t("Tracked")]: formatDuration(group.seconds, locale),
          [t("Billable")]: formatDuration(group.billable, locale),
          [t("Internal")]: formatDuration(group.seconds - group.billable, locale),
          [t("Records")]: group.records,
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
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns: [
          t("Group"),
          ...weekDates.map((date) => formatDate(date, locale)),
          t("Tracked"),
          t("Billable"),
          t("Internal"),
        ],
        rows: rows.map((row) => ({
          [t("Group")]: row.label,
          ...Object.fromEntries(
            weekDates.map((date) => [
              formatDate(date, locale),
              formatDuration(row.byDate[date] ?? 0, locale),
            ]),
          ),
          [t("Tracked")]: formatDuration(row.seconds, locale),
          [t("Billable")]: formatDuration(row.billable, locale),
          [t("Internal")]: formatDuration(row.seconds - row.billable, locale),
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
      ...exportContext,
      title: `time-blossom-${search.view}`,
      columns: [
        t("Member"),
        t("Tracked"),
        t("Billable"),
        t("Internal"),
        t("Records"),
        t("Projects"),
        t("Clients"),
        t("Average/day"),
        t("Share"),
      ],
      rows: teamRows.map((row) => ({
        [t("Member")]: row.member.name,
        [t("Tracked")]: formatDuration(row.seconds, locale),
        [t("Billable")]: formatDuration(row.billable, locale),
        [t("Internal")]: formatDuration(row.seconds - row.billable, locale),
        [t("Records")]: row.records,
        [t("Projects")]: row.projectCount,
        [t("Clients")]: row.clientCount,
        [t("Average/day")]: formatDuration(
          row.activeDays ? Math.round(row.seconds / row.activeDays) : 0,
          locale,
        ),
        [t("Share")]: total ? `${Math.round((row.seconds / total) * 100)}%` : "0%",
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
    exportContext,
    search.view,
    search.weeklyGroup,
    locale,
    showTeam,
    t,
    total,
  ]);

  const description = {
    detailed: t("Inspect every entry with its project, client, person and billability."),
    summary: t("Compare totals with flexible project, client, member, task or date groups."),
    weekly: t("Review one complete week across projects or team members."),
    team: t("Compare time, billing mix and activity across the available team."),
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
        title={t("Reports")}
        description={description}
        actions={
          <div className="flex items-center gap-2">
            <Select
              aria-label={t("Report view")}
              className="w-36"
              value={search.view}
              onChange={(key) => {
                if (key) changeView(String(key) as ReportView);
              }}
            >
              <Label className="sr-only">{t("Report view")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label={t("Report views")}>
                  {reportViews.map((report) => (
                    <ListBox.Item key={report.id} id={report.id} textValue={report.label}>
                      <Label>{t(report.label)}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button variant="secondary" onPress={() => setExportOpen(true)}>
              <Download className="size-4" />
              {t("Export")}
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
              columns={parseDetailedColumns(search.columns)}
              onChangeColumns={(columns) => updateSearch({ columns: encodeIds(columns) })}
            />
          ) : search.view === "summary" ? (
            <SummaryReport
              groups={groups}
              total={total}
              billable={billable}
              internal={internal}
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
  const { locale, t } = useI18n();
  const metrics = [
    { label: t("Tracked"), value: formatDuration(total, locale) },
    { label: t("Billable"), value: formatDuration(billable, locale) },
    { label: t("Internal"), value: formatDuration(internal, locale) },
    { label: t("Entries"), value: String(records) },
  ];
  return (
    <Card className="overflow-hidden">
      <Card.Content className="grid grid-cols-2 gap-px p-0 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 bg-surface px-4 py-3">
            <p className="truncate text-[0.68rem] font-medium tracking-[0.12em] text-muted uppercase">
              {metric.label}
            </p>
            <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
              {metric.value}
            </p>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

function ReportChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <Card.Header className="px-4 pb-0 pt-4">
        <Card.Title className="text-sm font-medium">{title}</Card.Title>
      </Card.Header>
      <Card.Content className="min-w-0 px-3 pb-3 pt-2">{children}</Card.Content>
    </Card>
  );
}

function ChartEmpty() {
  const { t } = useI18n();
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted">
      {t("No chart data")}
    </div>
  );
}

function ReportMetricBar({
  label,
  seconds,
  maxSeconds,
  color = "accent",
}: {
  label: string;
  seconds: number;
  maxSeconds: number;
  color?: "accent" | "default" | "success";
}) {
  const { locale, t } = useI18n();
  const percentage = maxSeconds > 0 ? Math.round((seconds / maxSeconds) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-muted">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {formatDuration(seconds, locale)}
        </span>
      </div>
      <ProgressBar
        aria-label={t("{label}: {value}", {
          label,
          value: formatDuration(seconds, locale),
        })}
        value={percentage}
        color={color}
        size="sm"
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}

function ReportMetricRing({
  label,
  seconds,
  total,
  color = "success",
}: {
  label: string;
  seconds: number;
  total: number;
  color?: "accent" | "default" | "success" | "warning";
}) {
  const { locale, t } = useI18n();
  const percentage = total > 0 ? Math.round((seconds / total) * 100) : 0;
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="relative shrink-0">
        <ProgressCircle
          aria-label={t("{label}: {value}", {
            label,
            value: `${percentage}%`,
          })}
          value={percentage}
          maxValue={100}
          color={color}
          size="lg"
        >
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-foreground">
          {percentage}%
        </span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs tabular-nums text-muted">
          {formatDuration(seconds, locale)} {t("of tracked time")}
        </p>
      </div>
    </div>
  );
}

function SummaryInsights({
  groups,
  total,
  billable,
  internal,
}: {
  groups: ReportGroup[];
  total: number;
  billable: number;
  internal: number;
}) {
  const { locale, t } = useI18n();
  const billabilityData = [
    { name: t("Billable"), value: billable, color: "success" as const },
    { name: t("Internal"), value: internal, color: "default" as const },
  ].filter((item) => item.value > 0);
  const groupData = groups.slice(0, 6).map((group) => ({
    label: group.label.length > 18 ? `${group.label.slice(0, 17)}…` : group.label,
    seconds: group.seconds,
  }));

  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <ReportChartCard title={t("Billability mix")}>
        {billabilityData.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="flex min-h-48 flex-wrap items-center gap-6 py-3">
            <ReportMetricRing label={t("Billable")} seconds={billable} total={total} />
            <div className="min-w-40 flex-1 space-y-3">
              {billabilityData.map((item) => (
                <ReportMetricBar
                  key={item.name}
                  label={item.name}
                  seconds={item.value}
                  maxSeconds={Math.max(total, 1)}
                  color={item.color}
                />
              ))}
              <p className="text-xs text-muted">
                {t("{value} total tracked", { value: formatDuration(total, locale) })}
              </p>
            </div>
          </div>
        )}
      </ReportChartCard>
      <ReportChartCard title={t("Top groups")}>
        {groupData.length === 0 ? (
          <ChartEmpty />
        ) : (
          <div className="space-y-4 py-3">
            {groupData.map((item) => (
              <ReportMetricBar
                key={item.label}
                label={item.label}
                seconds={item.seconds}
                maxSeconds={Math.max(groupData[0]?.seconds ?? 0, 1)}
              />
            ))}
          </div>
        )}
      </ReportChartCard>
      <span className="sr-only">
        {t("Total tracked: {value}", { value: formatDuration(total, locale) })}
      </span>
    </div>
  );
}

function EmptyReport({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyBlock
      icon={<FileBarChart className="size-5" />}
      title={t("No time entries match")}
      description={t("Try a wider period or clear one of the active filters.")}
      action={
        <Button variant="secondary" onPress={onClear}>
          <RotateCcw className="size-4" />
          {t("Clear filters")}
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
  columns,
  onChangeColumns,
}: {
  entries: TimeEntry[];
  page: number;
  onPageChange: (page: number) => void;
  onClear: () => void;
  members: Member[];
  projects: Project[];
  clients: Client[];
  columns: DetailedColumn[];
  onChangeColumns: (columns: DetailedColumn[]) => void;
}) {
  const { locale, t } = useI18n();
  if (entries.length === 0) return <EmptyReport onClear={onClear} />;
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleColumns = detailedColumnOptions.filter((column) => columns.includes(column.id));
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.seconds, 0);
  const billableSeconds = entries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.seconds, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("Choose the columns you need for this view.")}</p>
        <ReportColumnPicker columns={columns} onChange={onChangeColumns} />
      </div>
      <DataTable
        label={t("Detailed report table")}
        minWidth="min-w-[900px]"
        scrollHint={t("Scroll horizontally to see all columns")}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3 text-sm">
            <span className="font-medium text-muted">
              {t("Total · {count} entries", { count: entries.length })}
            </span>
            <span className="whitespace-nowrap font-semibold tabular-nums">
              {formatDuration(totalSeconds, locale)}
            </span>
            <span className="whitespace-nowrap tabular-nums text-muted">
              {formatDuration(billableSeconds, locale)} {t("billable")}
            </span>
            <span className="whitespace-nowrap tabular-nums text-muted">
              {formatDuration(totalSeconds - billableSeconds, locale)} {t("internal")}
            </span>
          </div>
        }
        pagination={{
          page: currentPage,
          totalPages: pageCount,
          onPageChange,
          summary: (
            <span>
              {t("{count} entries · page {page} of {pages}", {
                count: entries.length,
                page: currentPage,
                pages: pageCount,
              })}
            </span>
          ),
          previousLabel: t("Previous"),
          nextLabel: t("Next"),
          ariaLabel: t("Report pages"),
        }}
      >
        <Table.Header>
          {visibleColumns.map((column, index) => (
            <Table.Column key={column.id} isRowHeader={index === 0}>
              {t(column.label)}
            </Table.Column>
          ))}
        </Table.Header>
        <Table.Body>
          {pageEntries.map((entry) => (
            <Table.Row key={entry.id}>
              {columns.includes("date") ? (
                <Table.Cell className="whitespace-nowrap text-muted">
                  {formatDate(entry.date, locale)}
                </Table.Cell>
              ) : null}
              {columns.includes("task") ? (
                <Table.Cell className="font-medium">
                  <div className="truncate">{entry.task}</div>
                </Table.Cell>
              ) : null}
              {columns.includes("projectClient") ? (
                <Table.Cell>
                  <div className="truncate font-medium">
                    {projectNameFor(projects, entry.projectId)}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {clientNameFor(clients, projects, entry.projectId)}
                  </div>
                </Table.Cell>
              ) : null}
              {columns.includes("start") ? (
                <Table.Cell className="whitespace-nowrap tabular-nums text-muted">
                  {entry.start}
                </Table.Cell>
              ) : null}
              {columns.includes("end") ? (
                <Table.Cell className="whitespace-nowrap tabular-nums text-muted">
                  {endLabel(entry)}
                </Table.Cell>
              ) : null}
              {columns.includes("duration") ? (
                <Table.Cell className="whitespace-nowrap font-medium tabular-nums">
                  {formatDuration(entry.seconds, locale)}
                </Table.Cell>
              ) : null}
              {columns.includes("billability") ? (
                <Table.Cell className="whitespace-nowrap text-muted">
                  {entry.billable ? t("Billable") : t("Internal")}
                </Table.Cell>
              ) : null}
              {columns.includes("member") ? (
                <Table.Cell className="whitespace-nowrap text-muted">
                  {nameForMember(members, entry.userId)}
                </Table.Cell>
              ) : null}
              {columns.includes("description") ? (
                <Table.Cell className="text-muted">
                  <div className="truncate">{entry.description ?? "—"}</div>
                </Table.Cell>
              ) : null}
            </Table.Row>
          ))}
        </Table.Body>
      </DataTable>
    </div>
  );
}

function ReportColumnPicker({
  columns,
  onChange,
}: {
  columns: DetailedColumn[];
  onChange: (columns: DetailedColumn[]) => void;
}) {
  const { t } = useI18n();
  return (
    <Popover>
      <Popover.Trigger
        render={(triggerProps) => {
          const buttonProps = Object.fromEntries(
            Object.entries(triggerProps).filter(([, value]) => value !== undefined),
          );
          return (
            <Button {...buttonProps} variant="secondary" size="sm" aria-label={t("Choose columns")}>
              {t("Columns")}
            </Button>
          );
        }}
      />
      <Popover.Content placement="bottom end" className="w-64 max-w-[calc(100vw-1rem)] p-2">
        <Popover.Dialog>
          <p className="px-2 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
            {t("Visible columns")}
          </p>
          <div className="space-y-1">
            {detailedColumnOptions.map((column) => {
              const checked = columns.includes(column.id);
              return (
                <Checkbox
                  key={column.id}
                  isSelected={checked}
                  isDisabled={checked && columns.length === 1}
                  onChange={(selected) => {
                    const next = selected
                      ? [...columns, column.id]
                      : columns.filter((current) => current !== column.id);
                    onChange([...new Set(next)]);
                  }}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>{t(column.label)}</Label>
                  </Checkbox.Content>
                </Checkbox>
              );
            })}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function SummaryReport({
  groups,
  total,
  billable,
  internal,
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
  billable: number;
  internal: number;
  primary: GroupDimension;
  secondary: GroupDimension | "none";
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onChangeGroup: (group: GroupDimension) => void;
  onChangeSubgroup: (group: GroupDimension | "none") => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  if (groups.length === 0) return <EmptyReport onClear={onClear} />;
  return (
    <div className="space-y-4">
      <SummaryInsights groups={groups} total={total} billable={billable} internal={internal} />
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
            { id: "none", label: t("None") },
            ...groupOptions.filter((option) => option.id !== primary),
          ]}
          onChange={onChangeSubgroup}
        />
      </div>
      <DataTable
        label={t("Summary report table")}
        scrollHint={t("Scroll horizontally to see all columns")}
      >
        <Table.Header>
          {["Group", "Tracked", "Billable", "Internal", "Records", "Share"].map((label, index) => (
            <Table.Column key={label} isRowHeader={index === 0}>
              {t(label)}
            </Table.Column>
          ))}
        </Table.Header>
        <Table.Body>
          {flattenSummaryRows(groups, expanded).map(({ group, level, path }) => (
            <SummaryRow
              key={path}
              group={group}
              total={total}
              level={level}
              path={path}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </Table.Body>
      </DataTable>
    </div>
  );
}

function SummaryRow({
  group,
  total,
  level,
  path,
  expanded,
  onToggle,
}: {
  group: ReportGroup;
  total: number;
  level: number;
  path: string;
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const { locale, t } = useI18n();
  const expandable = Boolean(group.children?.length);
  const isOpen = Boolean(expanded[path]);
  const childrenId = `summary-children-${path.replace(/[^a-z0-9_-]/gi, "-")}`;
  return (
    <Table.Row>
      <Table.Cell style={{ paddingInlineStart: `${16 + level * 24}px` }}>
        <div className="flex min-w-0 items-center gap-2">
          {expandable ? (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label={t("{action} {label}", {
                action: t(isOpen ? "Collapse" : "Expand"),
                label: group.label,
              })}
              aria-expanded={isOpen}
              aria-controls={childrenId}
              onPress={() => onToggle(path)}
            >
              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          ) : (
            <span className="size-8" />
          )}
          <span className="truncate font-medium">{group.label}</span>
          {expandable ? (
            <span id={childrenId} className="sr-only">
              {t("{count} nested report groups", { count: group.children?.length ?? 0 })}
            </span>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap font-medium tabular-nums">
        {formatDuration(group.seconds, locale)}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap tabular-nums text-muted">
        {formatDuration(group.billable, locale)}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap tabular-nums text-muted">
        {formatDuration(group.seconds - group.billable, locale)}
      </Table.Cell>
      <Table.Cell className="tabular-nums text-muted">{group.records}</Table.Cell>
      <Table.Cell className="tabular-nums text-muted">
        {total ? `${Math.round((group.seconds / total) * 100)}%` : "0%"}
      </Table.Cell>
    </Table.Row>
  );
}

function flattenSummaryRows(
  groups: ReportGroup[],
  expanded: Record<string, boolean>,
  level = 0,
  parentPath = "",
): Array<{ group: ReportGroup; level: number; path: string }> {
  return groups.flatMap((group) => [
    {
      group,
      level,
      path: parentPath ? `${parentPath}/${group.key}` : group.key,
    },
    ...(expanded[parentPath ? `${parentPath}/${group.key}` : group.key] && group.children
      ? flattenSummaryRows(
          group.children,
          expanded,
          level + 1,
          parentPath ? `${parentPath}/${group.key}` : group.key,
        )
      : []),
  ]);
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
  const { t } = useI18n();
  return (
    <Select
      aria-label={t(label)}
      className="w-44"
      value={value}
      onChange={(key) => {
        if (key) onChange(String(key) as GroupDimension | "none");
      }}
    >
      <Label className="sr-only">{t(label)}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={t(label)}>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              <Label>{t(option.label)}</Label>
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
    const seconds = entry.seconds;
    current.seconds += seconds;
    current.billable += entry.billable ? seconds : 0;
    current.byDate[entry.date] = (current.byDate[entry.date] ?? 0) + seconds;
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
  const { locale, t } = useI18n();
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
      <WeeklyTrendChart entries={entries} dates={dates} />
      <DataTable
        label={t("Weekly report table")}
        minWidth="min-w-[940px]"
        scrollHint={t("Scroll horizontally to see all columns")}
      >
        <Table.Header>
          <Table.Column isRowHeader>{t("Group")}</Table.Column>
          {dates.map((date) => (
            <Table.Column key={date}>{formatDate(date, locale)}</Table.Column>
          ))}
          <Table.Column>{t("Tracked")}</Table.Column>
          <Table.Column>{t("Billable")}</Table.Column>
          <Table.Column>{t("Internal")}</Table.Column>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.key}>
              <Table.Cell className="font-medium">{row.label}</Table.Cell>
              {dates.map((date) => (
                <Table.Cell key={date} className="tabular-nums text-muted">
                  {formatDuration(row.byDate[date] ?? 0, locale)}
                </Table.Cell>
              ))}
              <Table.Cell className="font-medium tabular-nums">
                {formatDuration(row.seconds, locale)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted">
                {formatDuration(row.billable, locale)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted">
                {formatDuration(row.seconds - row.billable, locale)}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </DataTable>
    </div>
  );
}

function WeeklyTrendChart({ entries, dates }: { entries: TimeEntry[]; dates: string[] }) {
  const { locale, t } = useI18n();
  const data = dates.map((date) => ({
    label: formatDate(date, locale),
    seconds: entries
      .filter((entry) => entry.date === date)
      .reduce((sum, entry) => sum + entry.seconds, 0),
  }));
  return (
    <ReportChartCard title={t("Tracked by day")}>
      <div className="grid gap-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((item) => (
          <ReportMetricBar
            key={item.label}
            label={item.label}
            seconds={item.seconds}
            maxSeconds={Math.max(...data.map((day) => day.seconds), 1)}
          />
        ))}
      </div>
    </ReportChartCard>
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
  const { locale, t } = useI18n();
  const rows = buildTeamRows(entries, members, projects, clients, scopeToMember);
  if (rows.length === 0) return <EmptyReport onClear={onClear} />;
  return (
    <div className="space-y-4">
      <TeamComparisonChart rows={rows} />
      <DataTable
        label={t("Team report table")}
        minWidth="min-w-[1040px]"
        scrollHint={t("Scroll horizontally to see all columns")}
      >
        <Table.Header>
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
          ].map((label, index) => (
            <Table.Column key={label} isRowHeader={index === 0}>
              {t(label)}
            </Table.Column>
          ))}
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.member.id}>
              <Table.Cell>
                <div className="font-medium">{row.member.name}</div>
                <div className="text-xs text-muted">{row.member.email}</div>
              </Table.Cell>
              <Table.Cell className="font-medium tabular-nums">
                {formatDuration(row.seconds, locale)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted">
                {formatDuration(row.billable, locale)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted">
                {formatDuration(row.seconds - row.billable, locale)}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted">{row.records}</Table.Cell>
              <Table.Cell className="tabular-nums text-muted">{row.projectCount}</Table.Cell>
              <Table.Cell className="tabular-nums text-muted">{row.clientCount}</Table.Cell>
              <Table.Cell className="tabular-nums text-muted">
                {formatDuration(
                  row.activeDays ? Math.round(row.seconds / row.activeDays) : 0,
                  locale,
                )}
              </Table.Cell>
              <Table.Cell className="tabular-nums text-muted">
                {total ? `${Math.round((row.seconds / total) * 100)}%` : "0%"}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </DataTable>
    </div>
  );
}

function TeamComparisonChart({ rows }: { rows: TeamRow[] }) {
  const { locale, t } = useI18n();
  const totalSeconds = rows.reduce((sum, row) => sum + row.seconds, 0);
  const data = rows.slice(0, 8).map((row) => ({
    label: row.member.name.length > 16 ? `${row.member.name.slice(0, 15)}…` : row.member.name,
    seconds: row.seconds,
    share: totalSeconds ? Math.round((row.seconds / totalSeconds) * 100) : 0,
  }));
  return (
    <ReportChartCard title={t("Tracked by member")}>
      <div className="grid gap-5 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="space-y-4">
          {data.map((item) => (
            <ReportMetricBar
              key={item.label}
              label={item.label}
              seconds={item.seconds}
              maxSeconds={Math.max(data[0]?.seconds ?? 0, 1)}
            />
          ))}
        </div>
        {data[0] ? (
          <div className="flex items-center gap-4 border-t border-divider pt-4 lg:block lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <ReportMetricRing
              label={t("Top member")}
              seconds={data[0].seconds}
              total={totalSeconds}
              color="accent"
            />
            <p className="mt-2 text-xs tabular-nums text-muted">
              {data[0].share}% · {formatDuration(data[0].seconds, locale)}
            </p>
          </div>
        ) : null}
      </div>
    </ReportChartCard>
  );
}
