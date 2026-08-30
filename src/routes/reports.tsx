import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Dropdown,
  Input,
  Label,
  Popover,
  Table,
  TextField,
  Typography,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRotateLeft,
  ChartColumn,
  ChevronDown,
  ChevronRight,
} from "@gravity-ui/icons";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "@/components/data-table";
import { ExportModal } from "@/components/export-modal";
import {
  ReportFiltersBar,
  type ReportFilterKey,
  type ReportFilterValues,
} from "@/components/report-filters";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, CardsSkeleton } from "@/components/states";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  ReportChartLegend,
  ReportChartWidget,
  ReportKpi,
  ReportTableWidget,
  ReportWidget,
  ReportWidgetGrid,
  reportChartAxisProps,
  reportChartColors,
  reportChartGridProps,
  reportChartTooltipProps,
  reportHorizontalBarProps,
  reportVerticalBarProps,
  shortenReportChartLabel,
} from "@/components/report-widget";
import type { Client, Member, Project, TimeEntry } from "@/lib/mock-data";
import {
  formatDate,
  formatDateRange,
  formatDuration,
  getDayOffset,
  getEndDateForEntry,
  getEntryEndDayOffset,
  getMonthBounds,
  getReportPeriodRange,
  getYearBounds,
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
import {
  billableValue,
  billingForEntry,
  currencyOptions,
  formatMoney,
  formatMoneyTotals,
  sumBillableValues,
  type BillingPreference,
  type MoneyTotals,
} from "@/lib/billing";
import {
  calculateReportAnalytics,
  type ReportAnalytics,
  type ShiftId,
  type TemporalBucket,
} from "@/lib/report-analytics";

const reportViews = [
  { id: "overview", label: "Overview" },
  { id: "summary", label: "Analysis" },
  { id: "detailed", label: "Detailed" },
  { id: "weekly", label: "Activity" },
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
  | "billability"
  | "value";

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

const defaultVisibleFilters: ReportFilterKey[] = ["member", "client", "project", "billability"];

const detailedColumnOptions: Array<{ id: DetailedColumn; label: string }> = [
  { id: "date", label: "Date" },
  { id: "task", label: "Task" },
  { id: "projectClient", label: "Project / client" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { id: "duration", label: "Duration" },
  { id: "billability", label: "Billability" },
  { id: "value", label: "Billable value" },
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
  "value",
];

type ReportSearch = {
  view?: ReportView;
  preset?: ReportPeriodPreset;
  start?: string;
  end?: string;
  members?: string;
  clients?: string;
  projects?: string;
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
  billableValue: MoneyTotals;
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
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
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
          : buildGroups(
              groupEntries,
              secondary,
              "none",
              members,
              projects,
              clients,
              locale,
              fallbackForEntry,
            );
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
        billableValue: sumBillableValues(groupEntries, fallbackForEntry),
        ...(children ? { children } : {}),
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));
}

export const Route = createFileRoute("/reports")({
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    view: isReportView(search["view"]) ? search["view"] : "overview",
    preset: isPeriodPreset(search["preset"]) ? search["preset"] : "this-month",
    start: asText(search["start"]),
    end: asText(search["end"]),
    members: asCsv(search["members"]),
    clients: asCsv(search["clients"]),
    projects: asCsv(search["projects"]),
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
      {
        name: "description",
        content: "Overview, detailed, summary, weekly and team time reports.",
      },
      { property: "og:title", content: "Reports — Time Blossom" },
      { property: "og:description", content: "Filter and understand tracked time." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const rawSearch = Route.useSearch();
  const search: Required<ReportSearch> = {
    view: rawSearch.view ?? "overview",
    preset: rawSearch.preset ?? "this-month",
    start: rawSearch.start ?? "",
    end: rawSearch.end ?? "",
    members: rawSearch.members ?? "",
    clients: rawSearch.clients ?? "",
    projects: rawSearch.projects ?? "",
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
    preferences,
    billingPreferencesByUserId,
    today,
  } = useStore();
  const { locale, t } = useI18n();
  const loading = useSimulatedLoad(600);
  const [exportOpen, setExportOpen] = useState(false);

  const weekStartsOn = settings.weekStart === "sunday" ? 0 : 1;
  const range = makeRange(search.preset, search.start, search.end, today, weekStartsOn);
  const showTeam = can("view-all-reports");
  const filterValues = useMemo<ReportFilterValues>(
    () => ({
      memberIds: parseIds(search.members),
      clientIds: parseIds(search.clients),
      projectIds: parseIds(search.projects),
      description: search.description,
      billability: search.billability,
    }),
    [search.billability, search.clients, search.description, search.members, search.projects],
  );
  const visibleFilters = parseIds(search.visible).filter((key): key is ReportFilterKey =>
    ["member", "client", "project", "description", "billability"].includes(key),
  );

  const updateSearch = (patch: Partial<ReportSearch>) => {
    navigate({
      search: { ...search, ...patch, page: patch.page ?? 1 },
    });
  };

  const updatePeriod = (preset: ReportPeriodPreset, nextRange: DateRange) => {
    updateSearch({
      preset,
      start: nextRange.startDate,
      end: nextRange.endDate,
    });
  };

  const shiftReportPeriod = (direction: -1 | 1) => {
    const preset = search.preset;
    let nextRange: DateRange;

    if (preset === "this-month" || preset === "last-month") {
      const anchor = shiftDate(range.startDate, direction === 1 ? 31 : -1);
      nextRange = getMonthBounds(anchor);
    } else if (preset === "this-year" || preset === "last-year") {
      const anchor = shiftDate(range.startDate, direction === 1 ? 366 : -1);
      nextRange = getYearBounds(anchor);
    } else {
      const periodLength =
        preset === "today" || preset === "yesterday"
          ? 1
          : preset === "last-two-weeks"
            ? 14
            : preset === "this-week" || preset === "last-week"
              ? 7
              : getDayOffset(range.startDate, range.endDate) + 1;

      nextRange = {
        startDate: shiftDate(range.startDate, direction * periodLength),
        endDate: shiftDate(range.endDate, direction * periodLength),
      };
    }

    updateSearch({
      preset: "custom",
      start: nextRange.startDate,
      end: nextRange.endDate,
    });
  };

  const scopedEntries = useMemo(
    () => (showTeam ? entries : entries.filter((entry) => entry.userId === currentUserId)),
    [currentUserId, entries, showTeam],
  );
  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const normalizedDescription = normalizeSearch(filterValues.description);

  const reportEntries = useMemo(() => {
    const selectedMemberIds = new Set(filterValues.memberIds);
    const selectedClientIds = new Set(filterValues.clientIds);
    const selectedProjectIds = new Set(filterValues.projectIds);
    return scopedEntries
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
      .filter(
        (entry) =>
          !normalizedDescription ||
          normalizeSearch(entry.description ?? "").includes(normalizedDescription),
      )
      .filter(
        (entry) =>
          filterValues.billability === "all" ||
          (filterValues.billability === "billable" ? entry.billable : !entry.billable),
      );
  }, [filterValues, normalizedDescription, projectMap, scopedEntries]);
  const filteredEntries = useMemo(
    () =>
      reportEntries
        .filter((entry) => entry.date >= range.startDate && entry.date <= range.endDate)
        .sort(compareEntries),
    [range.endDate, range.startDate, reportEntries],
  );

  const total = filteredEntries.reduce((sum, entry) => sum + entry.seconds, 0);
  const billable = filteredEntries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.seconds, 0);
  const internal = total - billable;
  const fallbackForEntry = useCallback(
    (entry: TimeEntry): BillingPreference =>
      billingPreferencesByUserId[entry.userId] ?? {
        hourlyRate: preferences.hourlyRate,
        currency: preferences.currency,
      },
    [billingPreferencesByUserId, preferences.currency, preferences.hourlyRate],
  );
  const reportAnalytics = useMemo(
    () =>
      calculateReportAnalytics({
        entries: reportEntries,
        range,
        projects,
        clients,
        fallbackForEntry,
        emptyCurrency: preferences.currency,
        timeZone: preferences.timezone,
        weekStartsOn,
      }),
    [
      clients,
      fallbackForEntry,
      preferences.currency,
      preferences.timezone,
      projects,
      range,
      reportEntries,
      weekStartsOn,
    ],
  );
  const billableValues = sumBillableValues(filteredEntries, fallbackForEntry, preferences.currency);
  const formattedBillableValue = formatMoneyTotals(billableValues, locale);
  const overviewBillableValue = formatMoneyTotals(
    reportAnalytics.summary.billableValueByCurrency,
    locale,
  );
  const exportTotal = search.view === "overview" ? reportAnalytics.summary.totalSeconds : total;
  const exportBillable =
    search.view === "overview" ? reportAnalytics.summary.billableSeconds : billable;
  const exportInternal =
    search.view === "overview" ? reportAnalytics.summary.internalSeconds : internal;
  const exportRecords =
    search.view === "overview" ? reportAnalytics.summary.entryCount : filteredEntries.length;
  const exportBillableValue =
    search.view === "overview" ? overviewBillableValue : formattedBillableValue;
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
        fallbackForEntry,
      ),
    [
      clients,
      fallbackForEntry,
      filteredEntries,
      members,
      projects,
      locale,
      search.group,
      search.subgroup,
    ],
  );
  const previousFilteredEntries = useMemo(() => {
    const previousRange = reportAnalytics.comparison.previousPeriod;
    return reportEntries.filter(
      (entry) => entry.date >= previousRange.startDate && entry.date <= previousRange.endDate,
    );
  }, [reportAnalytics.comparison.previousPeriod, reportEntries]);
  const previousGroups = useMemo(
    () =>
      buildGroups(
        previousFilteredEntries,
        search.group,
        search.subgroup,
        members,
        projects,
        clients,
        locale,
        fallbackForEntry,
      ),
    [
      clients,
      fallbackForEntry,
      locale,
      members,
      previousFilteredEntries,
      projects,
      search.group,
      search.subgroup,
    ],
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
              search.description ? `${t("Description")}: ${search.description}` : "",
              search.billability !== "all" ? t(search.billability) : "",
            ]
              .filter(Boolean)
              .join(" · ") || t("None"),
        },
      ],
      summary: [
        { label: t("Tracked"), value: formatDuration(exportTotal, locale) },
        { label: t("Billable"), value: formatDuration(exportBillable, locale) },
        { label: t("Internal"), value: formatDuration(exportInternal, locale) },
        { label: t("Records"), value: String(exportRecords) },
        { label: t("Billable value"), value: exportBillableValue },
      ],
    }),
    [
      currentWorkspace,
      exportBillable,
      exportBillableValue,
      exportInternal,
      exportRecords,
      exportTotal,
      locale,
      range.endDate,
      range.startDate,
      reportScope,
      search.billability,
      search.clients,
      search.description,
      search.members,
      search.projects,
      search.view,
      t,
    ],
  );

  const exportPayload = useMemo<ReportExportPayload>(() => {
    if (search.view === "overview") {
      const summary = reportAnalytics.summary;
      return {
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns: [t("Metric"), t("Value")],
        rows: [
          {
            [t("Metric")]: t("Tracked"),
            [t("Value")]: formatDuration(summary.totalSeconds, locale),
          },
          {
            [t("Metric")]: t("Billable"),
            [t("Value")]: formatDuration(summary.billableSeconds, locale),
          },
          {
            [t("Metric")]: t("Internal"),
            [t("Value")]: formatDuration(summary.internalSeconds, locale),
          },
          { [t("Metric")]: t("Active days"), [t("Value")]: summary.activeDays },
          {
            [t("Metric")]: t("Average/day"),
            [t("Value")]: formatDuration(summary.averageSecondsPerActiveDay, locale),
          },
          ...currencyOptions
            .filter((currency) => summary.billableValueByCurrency[currency] !== undefined)
            .map((currency) => ({
              [t("Metric")]: `${t("Estimated billable value")} (${currency})`,
              [t("Value")]: formatMoney(
                summary.billableValueByCurrency[currency] ?? 0,
                currency,
                locale,
              ),
            })),
        ],
      };
    }
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
        t("Hourly rate"),
        t("Currency"),
        t("Billable value"),
      ];
      return {
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns,
        rows: filteredEntries.map((entry) => {
          const member = memberMap.get(entry.userId);
          const endDate = getEndDateForEntry(entry);
          const billing = billingForEntry(entry, fallbackForEntry(entry));
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
            [t("Hourly rate")]: formatMoney(billing.hourlyRate, billing.currency, locale),
            [t("Currency")]: billing.currency,
            [t("Billable value")]: formatMoney(
              billableValue(entry, billing),
              billing.currency,
              locale,
            ),
          };
        }),
      };
    }
    if (search.view === "summary") {
      return {
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns: [
          t("Group"),
          t("Tracked"),
          t("Share"),
          t("Billable"),
          t("Internal"),
          t("Billable percentage"),
          t("Billable value"),
          t("Records"),
          t("Average entry duration"),
        ],
        rows: groups.map((group) => ({
          [t("Group")]: group.label,
          [t("Tracked")]: formatDuration(group.seconds, locale),
          [t("Share")]: total ? `${Math.round((group.seconds / total) * 100)}%` : "0%",
          [t("Billable")]: formatDuration(group.billable, locale),
          [t("Internal")]: formatDuration(group.seconds - group.billable, locale),
          [t("Billable percentage")]: group.seconds
            ? `${Math.round((group.billable / group.seconds) * 100)}%`
            : "0%",
          [t("Billable value")]: formatMoneyTotals(group.billableValue, locale),
          [t("Records")]: group.records,
          [t("Average entry duration")]: formatDuration(
            group.records ? group.seconds / group.records : 0,
            locale,
          ),
        })),
      };
    }
    if (search.view === "weekly") {
      const isExactWeek = getDayOffset(range.startDate, range.endDate) + 1 === 7;
      if (!isExactWeek) {
        return {
          ...exportContext,
          title: `time-blossom-${search.view}`,
          columns: [t("Shift"), t("Registered activity"), t("Share")],
          rows: reportAnalytics.shifts.map((shift) => ({
            [t("Shift")]: t(shiftLabels[shift.shift]),
            [t("Registered activity")]: formatDuration(shift.seconds, locale),
            [t("Share")]: reportAnalytics.summary.totalSeconds
              ? `${Math.round((shift.seconds / reportAnalytics.summary.totalSeconds) * 100)}%`
              : "0%",
          })),
        };
      }
      const weekDates = Array.from({ length: 7 }, (_, index) => shiftDate(range.startDate, index));
      const rows = buildWeeklyRows(
        filteredEntries,
        search.weeklyGroup,
        members,
        projects,
        weekDates,
        fallbackForEntry,
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
          t("Billable value"),
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
          [t("Billable value")]: formatMoneyTotals(row.billableValue, locale),
        })),
      };
    }
    const teamRows = buildTeamRows(
      filteredEntries,
      members,
      projects,
      clients,
      showTeam ? null : currentUserId,
      fallbackForEntry,
    );
    return {
      ...exportContext,
      title: `time-blossom-${search.view}`,
      columns: [
        t("Member"),
        t("Tracked"),
        t("Billable"),
        t("Internal"),
        t("Billable value"),
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
        [t("Billable value")]: formatMoneyTotals(row.billableValue, locale),
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
    range.endDate,
    range.startDate,
    exportContext,
    search.view,
    search.weeklyGroup,
    locale,
    reportAnalytics,
    showTeam,
    t,
    total,
    fallbackForEntry,
  ]);

  const description = {
    overview: t("See tracked time, billability, estimated value and activity distribution."),
    detailed: t("Inspect every entry with its project, client, person and billability."),
    summary: t("See where tracked time and billable value are concentrated."),
    weekly: t("Understand when registered activity happens and how routines change over time."),
    team: t("Compare time, billing mix and activity across the available team."),
  }[search.view];

  const clearFilters = () =>
    updateSearch({
      members: "",
      clients: "",
      projects: "",
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
            <Button variant="secondary" onPress={() => setExportOpen(true)}>
              <ArrowDownToLine className="size-4" />
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
        weeklyNavigation
        onPeriodChange={updatePeriod}
        onPeriodShift={shiftReportPeriod}
        onChange={(patch) => {
          const next = { ...filterValues, ...patch };
          updateSearch({
            members: encodeIds(next.memberIds),
            clients: encodeIds(next.clientIds),
            projects: encodeIds(next.projectIds),
            description: next.description,
            billability: next.billability,
          });
        }}
        onClear={() =>
          updateSearch({
            members: "",
            clients: "",
            projects: "",
            description: "",
            billability: "all",
          })
        }
      />

      {loading ? (
        <CardsSkeleton count={3} />
      ) : (
        <>
          {search.view !== "overview" && search.view !== "weekly" && search.view !== "summary" ? (
            <ReportOverview
              total={total}
              billable={billable}
              internal={internal}
              records={filteredEntries.length}
              billableValue={formattedBillableValue}
            />
          ) : null}
          {search.view === "overview" ? (
            <OverviewDashboard analytics={reportAnalytics} />
          ) : search.view === "detailed" ? (
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
              fallbackForEntry={fallbackForEntry}
            />
          ) : search.view === "summary" ? (
            <SummaryReport
              groups={groups}
              previousGroups={previousGroups}
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
            <ActivityDashboard
              analytics={reportAnalytics}
              entries={filteredEntries}
              range={range}
              dimension={search.weeklyGroup}
              members={members}
              projects={projects}
              onChange={(weeklyGroup) => updateSearch({ weeklyGroup })}
              onClear={clearFilters}
              fallbackForEntry={fallbackForEntry}
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
              fallbackForEntry={fallbackForEntry}
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

type Translate = ReturnType<typeof useI18n>["t"];

const shiftLabels: Record<ShiftId, string> = {
  overnight: "Overnight",
  morning: "Morning",
  afternoon: "Afternoon",
  night: "Night",
};

function formatOverviewBucket(
  bucket: Pick<TemporalBucket, "startDate" | "endDate" | "granularity">,
  locale: Locale,
): string {
  const start = new Date(`${bucket.startDate}T12:00:00`);
  const end = new Date(`${bucket.endDate}T12:00:00`);
  const dayFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  if (bucket.granularity === "day") return dayFormatter.format(start);
  if (bucket.granularity === "week") {
    return `${dayFormatter.format(start)}–${dayFormatter.format(end)}`;
  }
  return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(start);
}

function comparisonVariation(
  comparison: ReportAnalytics["comparison"]["metrics"]["totalSeconds"],
  locale: Locale,
  t: Translate,
) {
  if (comparison.current === 0 && comparison.previous === 0) return null;
  if (comparison.previous === 0) {
    const value = formatDuration(Math.abs(comparison.delta), locale);
    return {
      label: `+${value}`,
      accessibleLabel: `${value} ${t("more than previous period")}`,
      direction: "up" as const,
      tone: "neutral" as const,
    };
  }

  const change = comparison.percentageChange ?? 0;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.abs(change),
  );
  if (change === 0) {
    return {
      label: t("No change"),
      accessibleLabel: t("No change from previous period"),
      direction: "neutral" as const,
      tone: "neutral" as const,
    };
  }
  return {
    label: `${change > 0 ? "+" : "−"}${formatted}%`,
    accessibleLabel: `${formatted}% ${t(
      change > 0 ? "more than previous period" : "less than previous period",
    )}`,
    direction: change > 0 ? ("up" as const) : ("down" as const),
    tone: "neutral" as const,
  };
}

function selectTopProjects(analytics: ReportAnalytics) {
  const noProject = analytics.summary.projectBreakdown.find((item) => item.id === "none");
  const projects = analytics.summary.projectBreakdown.filter((item) => item.id !== "none");
  const selected = noProject ? [...projects.slice(0, 5), noProject] : projects.slice(0, 6);
  return selected.sort(
    (first, second) => second.seconds - first.seconds || first.label.localeCompare(second.label),
  );
}

function ActivitySummaryItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Typography type="body-xs" color="muted" weight="semibold">
        {label}
      </Typography>
      <Typography type="body-sm" weight="semibold">
        {value}
      </Typography>
    </div>
  );
}

function OverviewDashboard({ analytics }: { analytics: ReportAnalytics }) {
  const { locale, t } = useI18n();
  const { summary } = analytics;
  const percentageFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const trackedVariation = comparisonVariation(
    analytics.comparison.metrics.totalSeconds,
    locale,
    t,
  );
  const monetaryTotals = currencyOptions.filter(
    (currency) => summary.billableValueByCurrency[currency] !== undefined,
  );
  const predominantShift = [...analytics.shifts].sort(
    (first, second) => second.seconds - first.seconds,
  )[0];
  const hasPredominantShift = Boolean(predominantShift && predominantShift.seconds > 0);
  const predominantShiftLabel = hasPredominantShift
    ? t(shiftLabels[predominantShift!.shift])
    : t("No activity");
  const evolutionData = analytics.temporal.map((bucket) => ({
    label: formatOverviewBucket(bucket, locale),
    billable: bucket.billableSeconds,
    internal: bucket.internalSeconds,
  }));
  const evolutionTickInterval = Math.max(0, Math.ceil(evolutionData.length / 8) - 1);
  const shiftData = analytics.shifts.map((shift) => {
    const percentage = summary.totalSeconds > 0 ? (shift.seconds / summary.totalSeconds) * 100 : 0;
    return {
      shift: t(shiftLabels[shift.shift]),
      seconds: shift.seconds,
      display: `${formatDuration(shift.seconds, locale)} · ${percentageFormatter.format(percentage)}%`,
    };
  });
  const projectData = selectTopProjects(analytics).map((project) => ({
    project: project.id === "none" ? t("No project") : project.label,
    seconds: project.seconds,
    display: formatDuration(project.seconds, locale),
  }));
  const billabilityData = [
    {
      name: t("Billable"),
      value: summary.billableSeconds,
      color: reportChartColors.success,
      tone: "success" as const,
    },
    {
      name: t("Internal"),
      value: summary.internalSeconds,
      color: reportChartColors.muted,
      tone: "default" as const,
    },
  ].filter((item) => item.value > 0);
  const billablePercentage = percentageFormatter.format(summary.billablePercentage);
  const internalPercentage = percentageFormatter.format(
    summary.totalSeconds > 0 ? (summary.internalSeconds / summary.totalSeconds) * 100 : 0,
  );
  const evolutionSummary = `${t("Billable")}: ${formatDuration(summary.billableSeconds, locale)}. ${t(
    "Internal",
  )}: ${formatDuration(summary.internalSeconds, locale)}.`;
  const shiftSummary = shiftData.map((item) => `${item.shift}: ${item.display}`).join(". ");
  const projectSummary = projectData
    .map((item) => `${item.project}: ${formatDuration(item.seconds, locale)}`)
    .join(". ");

  return (
    <ReportWidgetGrid>
      <ReportKpi
        title={t("Tracked time")}
        value={formatDuration(summary.totalSeconds, locale)}
        secondaryInformation={t("{count} entries", { count: summary.entryCount })}
        variation={trackedVariation}
        neutralComparisonLabel={t("No comparison")}
        contentDescription={`${t("Tracked")}: ${formatDuration(summary.totalSeconds, locale)}. ${t(
          "Previous",
        )}: ${formatDuration(analytics.comparison.previous.totalSeconds, locale)}.`}
      />
      <ReportKpi
        title={t("Billable time")}
        value={formatDuration(summary.billableSeconds, locale)}
        secondaryInformation={`${billablePercentage}% ${t("of tracked time")}`}
        neutralComparisonLabel={t("No comparison")}
        contentDescription={`${t("Billable")}: ${formatDuration(
          summary.billableSeconds,
          locale,
        )}, ${billablePercentage}% ${t("of tracked time")}.`}
      />
      <ReportKpi
        title={t("Estimated billable value")}
        value={
          <>
            {monetaryTotals.map((currency) => (
              <span key={currency} className="block">
                {formatMoney(summary.billableValueByCurrency[currency] ?? 0, currency, locale)}
              </span>
            ))}
          </>
        }
        secondaryInformation={t("No currency conversion applied.")}
        neutralComparisonLabel={t("No comparison")}
        contentDescription={monetaryTotals
          .map((currency) =>
            formatMoney(summary.billableValueByCurrency[currency] ?? 0, currency, locale),
          )
          .join(". ")}
      />
      <ReportKpi
        title={t("Active days")}
        value={String(summary.activeDays)}
        secondaryInformation={t("Average {value} per active day", {
          value: formatDuration(summary.averageSecondsPerActiveDay, locale),
        })}
        neutralComparisonLabel={t("No comparison")}
        contentDescription={`${t("Active days")}: ${summary.activeDays}. ${t("Average/day")}: ${formatDuration(
          summary.averageSecondsPerActiveDay,
          locale,
        )}.`}
      />
      <ReportChartWidget
        title={t("Activity evolution")}
        description={t("Billable and internal time over the selected period.")}
        contentDescription={evolutionSummary}
        config={{
          billable: { label: t("Billable"), color: reportChartColors.success },
          internal: { label: t("Internal"), color: reportChartColors.muted },
        }}
        summary={evolutionSummary}
        legend={
          <ReportChartLegend
            accessibleLabel={t("Chart legend")}
            items={[
              { key: "billable", label: t("Billable"), tone: "success" },
              { key: "internal", label: t("Internal"), tone: "default" },
            ]}
          />
        }
        isEmpty={summary.totalSeconds === 0}
        emptyState={{ title: t("No chart data") }}
      >
        <BarChart accessibilityLayer data={evolutionData} margin={{ left: 0, right: 8 }}>
          <CartesianGrid {...reportChartGridProps} />
          <XAxis
            {...reportChartAxisProps}
            dataKey="label"
            interval={evolutionTickInterval}
            tickFormatter={(value) => shortenReportChartLabel(value, 12)}
          />
          <YAxis {...reportChartAxisProps} hide />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar
            {...reportVerticalBarProps}
            dataKey="internal"
            stackId="tracked"
            fill={reportChartColors.muted}
            radius={[0, 0, 4, 4]}
          />
          <Bar
            {...reportVerticalBarProps}
            dataKey="billable"
            stackId="tracked"
            fill={reportChartColors.success}
          />
        </BarChart>
      </ReportChartWidget>
      <ReportChartWidget
        title={t("Hours by shift")}
        description={t("Predominant shift: {shift}", { shift: predominantShiftLabel })}
        contentDescription={shiftSummary || t("No activity")}
        config={{ seconds: { label: t("Tracked"), color: reportChartColors.accent } }}
        summary={shiftSummary || t("No activity")}
        width="compact"
        isEmpty={summary.totalSeconds === 0}
        emptyState={{ title: t("No chart data") }}
      >
        <BarChart
          accessibilityLayer
          data={shiftData}
          layout="vertical"
          margin={{ left: 0, right: 96 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="seconds" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="shift"
            type="category"
            width={72}
            tickFormatter={(value) => shortenReportChartLabel(value, 10)}
          />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar {...reportHorizontalBarProps} dataKey="seconds" fill={reportChartColors.accent}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>
      <ReportChartWidget
        title={t("Top projects")}
        description={t("Projects with the most tracked time.")}
        contentDescription={projectSummary || t("No activity")}
        config={{ seconds: { label: t("Tracked"), color: reportChartColors.accent } }}
        summary={projectSummary || t("No activity")}
        width="compact"
        height="tall"
        isEmpty={projectData.length === 0}
        emptyState={{ title: t("No chart data") }}
      >
        <BarChart
          accessibilityLayer
          data={projectData}
          layout="vertical"
          margin={{ left: 0, right: 72 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="seconds" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="project"
            type="category"
            width={88}
            tickFormatter={(value) => shortenReportChartLabel(value, 12)}
          />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar {...reportHorizontalBarProps} dataKey="seconds" fill={reportChartColors.accent}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>
      <ReportChartWidget
        title={t("Billing distribution")}
        description={t("Billable versus internal time.")}
        contentDescription={`${t("Billable")}: ${billablePercentage}%. ${t(
          "Internal",
        )}: ${internalPercentage}%.`}
        config={Object.fromEntries(
          billabilityData.map((item) => [item.name, { label: item.name, color: item.color }]),
        )}
        summary={`${t("Billable")}: ${billablePercentage}%. ${t(
          "Internal",
        )}: ${internalPercentage}%.`}
        width="compact"
        height="compact"
        legend={
          <ReportChartLegend
            accessibleLabel={t("Chart legend")}
            items={billabilityData.map((item) => ({
              key: item.name,
              label: `${item.name} · ${percentageFormatter.format(
                summary.totalSeconds > 0 ? (item.value / summary.totalSeconds) * 100 : 0,
              )}%`,
              tone: item.tone,
            }))}
          />
        }
        isEmpty={summary.totalSeconds === 0}
        emptyState={{ title: t("No chart data") }}
      >
        <PieChart accessibilityLayer>
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Pie
            data={billabilityData}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="82%"
            isAnimationActive={false}
          >
            {billabilityData.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ReportChartWidget>
      <ReportWidget
        title={t("Activity summary")}
        description={t("Highlights from the selected period.")}
        contentDescription={`${t("Predominant shift")}: ${predominantShiftLabel}. ${t(
          "Busiest day",
        )}: ${
          summary.busiestDay ? formatDate(summary.busiestDay.id, locale) : t("No activity")
        }. ${t("Top project")}: ${summary.topProject?.label ?? t("No activity")}. ${t(
          "Time without project",
        )}: ${formatDuration(summary.noProjectSeconds, locale)}.`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivitySummaryItem label={t("Predominant shift")} value={predominantShiftLabel} />
          <ActivitySummaryItem
            label={t("Busiest day")}
            value={
              summary.busiestDay ? formatDate(summary.busiestDay.id, locale) : t("No activity")
            }
          />
          <ActivitySummaryItem
            label={t("Top project")}
            value={summary.topProject?.label ?? t("No activity")}
          />
          <ActivitySummaryItem
            label={t("Time without project")}
            value={formatDuration(summary.noProjectSeconds, locale)}
          />
        </div>
      </ReportWidget>
    </ReportWidgetGrid>
  );
}

function ReportOverview({
  total,
  billable,
  internal,
  records,
  billableValue,
}: {
  total: number;
  billable: number;
  internal: number;
  records: number;
  billableValue: string;
}) {
  const { locale, t } = useI18n();
  const metrics = [
    { label: t("Tracked"), value: formatDuration(total, locale) },
    { label: t("Billable"), value: formatDuration(billable, locale) },
    { label: t("Internal"), value: formatDuration(internal, locale) },
    { label: t("Entries"), value: String(records) },
    { label: t("Billable value"), value: billableValue },
  ];
  return (
    <Card className="overflow-hidden">
      <Card.Content className="grid grid-cols-2 gap-px p-0 sm:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 px-4 py-3">
            <Typography type="body-xs" color="muted" weight="semibold" truncate>
              {metric.label}
            </Typography>
            <Typography type="body-sm" weight="semibold" className="mt-1" truncate>
              {metric.value}
            </Typography>
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
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content className="min-w-0 px-3 pb-3 pt-2">{children}</Card.Content>
    </Card>
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
  const chartColor = `var(--${color})`;
  const config = { value: { label, color: chartColor } };
  return (
    <div
      className="flex min-w-0 items-center gap-4"
      aria-label={t("{label}: {value}", {
        label,
        value: `${percentage}%`,
      })}
    >
      <div className="relative size-28 shrink-0">
        <ChartContainer className="size-28" config={config}>
          <RadialBarChart
            accessibilityLayer
            data={[{ name: label, value: percentage }]}
            innerRadius="65%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background dataKey="value" fill={chartColor} isAnimationActive={false} />
          </RadialBarChart>
        </ChartContainer>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {percentage}%
        </span>
      </div>
      <div className="min-w-0">
        <Typography type="body-sm" weight="semibold" truncate>
          {label}
        </Typography>
        <Typography type="body-xs" color="muted" truncate>
          {formatDuration(seconds, locale)} {t("of tracked time")}
        </Typography>
      </div>
    </div>
  );
}

function EmptyReport({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyBlock
      icon={<ChartColumn className="size-5" />}
      title={t("No time entries match")}
      description={t("Try a wider period or clear one of the active filters.")}
      action={
        <Button variant="secondary" onPress={onClear}>
          <ArrowRotateLeft className="size-4" />
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
  fallbackForEntry,
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
  fallbackForEntry: (entry: TimeEntry) => BillingPreference;
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
  const billableTotal = formatMoneyTotals(sumBillableValues(entries, fallbackForEntry), locale);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography type="body-sm" color="muted">
          {t("Choose the columns you need for this view.")}
        </Typography>
        <ReportColumnPicker columns={columns} onChange={onChangeColumns} />
      </div>
      <DataTable
        label={t("Detailed report table")}
        minWidth="min-w-[900px]"
        scrollHint={t("Scroll horizontally to see all columns")}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span>{t("Total · {count} entries", { count: entries.length })}</span>
            <span className="whitespace-nowrap">{formatDuration(totalSeconds, locale)}</span>
            <span className="whitespace-nowrap">
              {formatDuration(billableSeconds, locale)} {t("billable")}
            </span>
            <span className="whitespace-nowrap">
              {formatDuration(totalSeconds - billableSeconds, locale)} {t("internal")}
            </span>
            <span className="whitespace-nowrap">{billableTotal}</span>
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
                <Table.Cell className="whitespace-nowrap">
                  {formatDate(entry.date, locale)}
                </Table.Cell>
              ) : null}
              {columns.includes("task") ? (
                <Table.Cell>
                  <div className="truncate">{entry.task}</div>
                </Table.Cell>
              ) : null}
              {columns.includes("projectClient") ? (
                <Table.Cell>
                  <div className="truncate">{projectNameFor(projects, entry.projectId)}</div>
                  <div className="truncate">
                    {clientNameFor(clients, projects, entry.projectId)}
                  </div>
                </Table.Cell>
              ) : null}
              {columns.includes("start") ? (
                <Table.Cell className="whitespace-nowrap">{entry.start}</Table.Cell>
              ) : null}
              {columns.includes("end") ? (
                <Table.Cell className="whitespace-nowrap">{endLabel(entry)}</Table.Cell>
              ) : null}
              {columns.includes("duration") ? (
                <Table.Cell className="whitespace-nowrap">
                  {formatDuration(entry.seconds, locale)}
                </Table.Cell>
              ) : null}
              {columns.includes("billability") ? (
                <Table.Cell className="whitespace-nowrap">
                  {entry.billable ? t("Billable") : t("Internal")}
                </Table.Cell>
              ) : null}
              {columns.includes("value") ? (
                <Table.Cell className="whitespace-nowrap">
                  {(() => {
                    const billing = billingForEntry(entry, fallbackForEntry(entry));
                    return formatMoney(billableValue(entry, billing), billing.currency, locale);
                  })()}
                </Table.Cell>
              ) : null}
              {columns.includes("member") ? (
                <Table.Cell className="whitespace-nowrap">
                  {nameForMember(members, entry.userId)}
                </Table.Cell>
              ) : null}
              {columns.includes("description") ? (
                <Table.Cell>
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
            <Button {...buttonProps} variant="tertiary" size="sm" aria-label={t("Choose columns")}>
              {t("Columns")}
            </Button>
          );
        }}
      />
      <Popover.Content placement="bottom end" className="w-64 max-w-[calc(100vw-1rem)] p-2">
        <Popover.Dialog>
          <Typography type="body-xs" color="muted" weight="semibold" className="px-2 py-2">
            {t("Visible columns")}
          </Typography>
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
  previousGroups,
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
  previousGroups: ReportGroup[];
  total: number;
  primary: GroupDimension;
  secondary: GroupDimension | "none";
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onChangeGroup: (group: GroupDimension) => void;
  onChangeSubgroup: (group: GroupDimension | "none") => void;
  onClear: () => void;
}) {
  const { locale, t } = useI18n();
  if (groups.length === 0) return <EmptyReport onClear={onClear} />;
  const percentageFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const topGroups = groups.slice(0, 8);
  const topGroup = groups[0]!;
  const topGroupShare = total > 0 ? (topGroup.seconds / total) * 100 : 0;
  const previousTotal = previousGroups.reduce((sum, group) => sum + group.seconds, 0);
  const previousTopGroup = previousGroups.find((group) => group.key === topGroup.key);
  const previousTopGroupShare =
    previousTotal > 0 ? ((previousTopGroup?.seconds ?? 0) / previousTotal) * 100 : 0;
  const shareDelta = topGroupShare - previousTopGroupShare;
  const shareVariation =
    previousTotal === 0
      ? null
      : {
          label: `${shareDelta > 0 ? "+" : shareDelta < 0 ? "−" : ""}${percentageFormatter.format(
            Math.abs(shareDelta),
          )} pp`,
          accessibleLabel: t("{value} percentage points versus the previous period", {
            value: `${shareDelta > 0 ? "+" : shareDelta < 0 ? "−" : ""}${percentageFormatter.format(
              Math.abs(shareDelta),
            )}`,
          }),
          direction:
            shareDelta > 0
              ? ("up" as const)
              : shareDelta < 0
                ? ("down" as const)
                : ("neutral" as const),
          tone: "neutral" as const,
        };
  const topGroupData = topGroups.map((group) => ({
    label: group.label,
    seconds: group.seconds,
    display: formatDuration(group.seconds, locale),
  }));
  const topGroupsSummary = topGroupData
    .map((group) => `${group.label}: ${group.display}`)
    .join(". ");
  const billingData = topGroups.map((group) => ({
    label: group.label,
    billable: group.billable,
    internal: group.seconds - group.billable,
  }));
  const billingSummary = billingData
    .map(
      (group) =>
        `${group.label}: ${t("Billable")} ${formatDuration(group.billable, locale)}, ${t(
          "Internal",
        )} ${formatDuration(group.internal, locale)}`,
    )
    .join(". ");
  const currencies = currencyOptions.filter((currency) =>
    groups.some((group) => (group.billableValue[currency] ?? 0) > 0),
  );
  const singleCurrency = currencies.length === 1 ? currencies[0] : null;
  const valueData = singleCurrency
    ? [...groups]
        .map((group) => ({
          label: group.label,
          value: group.billableValue[singleCurrency] ?? 0,
        }))
        .filter((group) => group.value > 0)
        .sort(
          (first, second) => second.value - first.value || first.label.localeCompare(second.label),
        )
        .slice(0, 8)
        .map((group) => ({
          ...group,
          display: formatMoney(group.value, singleCurrency, locale),
        }))
    : [];
  const valueSummary = singleCurrency
    ? valueData.map((group) => `${group.label}: ${group.display}`).join(". ")
    : currencies
        .map((currency) => {
          const value = groups.reduce(
            (sum, group) => sum + (group.billableValue[currency] ?? 0),
            0,
          );
          return formatMoney(value, currency, locale);
        })
        .join(". ");

  return (
    <ReportWidgetGrid>
      <ReportChartWidget
        title={t("Top groups by time")}
        description={t("Groups with the highest concentration of tracked time.")}
        contentDescription={topGroupsSummary}
        config={{ seconds: { label: t("Tracked"), color: reportChartColors.accent } }}
        summary={topGroupsSummary}
        height="tall"
      >
        <BarChart
          accessibilityLayer
          data={topGroupData}
          layout="vertical"
          margin={{ left: 0, right: 72 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="seconds" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="label"
            type="category"
            width={96}
            tickFormatter={(value) => shortenReportChartLabel(value, 14)}
          />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar {...reportHorizontalBarProps} dataKey="seconds" fill={reportChartColors.accent}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>
      <ReportKpi
        title={t("Top group share")}
        value={`${percentageFormatter.format(topGroupShare)}%`}
        secondaryInformation={`${topGroup.label} · ${formatDuration(topGroup.seconds, locale)}`}
        variation={shareVariation}
        neutralComparisonLabel={t("No comparison")}
        contentDescription={`${topGroup.label}: ${formatDuration(
          topGroup.seconds,
          locale,
        )}, ${percentageFormatter.format(topGroupShare)}%. ${t("Previous")}: ${percentageFormatter.format(
          previousTopGroupShare,
        )}%.`}
      />
      <ReportChartWidget
        title={t("Billing by group")}
        description={t("Billable and internal time within each leading group.")}
        contentDescription={billingSummary}
        config={{
          billable: { label: t("Billable"), color: reportChartColors.success },
          internal: { label: t("Internal"), color: reportChartColors.muted },
        }}
        summary={billingSummary}
        height="tall"
        legend={
          <ReportChartLegend
            accessibleLabel={t("Chart legend")}
            items={[
              { key: "billable", label: t("Billable"), tone: "success" },
              { key: "internal", label: t("Internal") },
            ]}
          />
        }
      >
        <BarChart
          accessibilityLayer
          data={billingData}
          layout="vertical"
          margin={{ left: 0, right: 8 }}
        >
          <XAxis {...reportChartAxisProps} type="number" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="label"
            type="category"
            width={96}
            tickFormatter={(value) => shortenReportChartLabel(value, 14)}
          />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar
            {...reportHorizontalBarProps}
            dataKey="billable"
            stackId="billing"
            fill={reportChartColors.success}
            radius={[4, 0, 0, 4]}
          />
          <Bar
            {...reportHorizontalBarProps}
            dataKey="internal"
            stackId="billing"
            fill={reportChartColors.muted}
          />
        </BarChart>
      </ReportChartWidget>
      {singleCurrency ? (
        <ReportChartWidget
          title={t("Billable value by group")}
          description={t("Values shown in {currency}.", { currency: singleCurrency })}
          contentDescription={valueSummary}
          config={{ value: { label: t("Billable value"), color: reportChartColors.accent } }}
          summary={valueSummary}
          width="compact"
          height="tall"
          isEmpty={valueData.length === 0}
          emptyState={{ title: t("No billable value") }}
        >
          <BarChart
            accessibilityLayer
            data={valueData}
            layout="vertical"
            margin={{ left: 0, right: 88 }}
          >
            <XAxis {...reportChartAxisProps} type="number" dataKey="value" hide />
            <YAxis
              {...reportChartAxisProps}
              dataKey="label"
              type="category"
              width={88}
              tickFormatter={(value) => shortenReportChartLabel(value, 12)}
            />
            <ChartTooltip
              {...reportChartTooltipProps}
              content={
                <ChartTooltipContent
                  hideLabel
                  valueFormatter={(value) =>
                    formatMoney(Number(value ?? 0), singleCurrency, locale)
                  }
                />
              }
            />
            <Bar {...reportHorizontalBarProps} dataKey="value" fill={reportChartColors.accent}>
              <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
            </Bar>
          </BarChart>
        </ReportChartWidget>
      ) : (
        <ReportWidget
          title={t("Billable value by group")}
          description={
            currencies.length > 1
              ? t("Multiple currencies cannot be compared on the same axis.")
              : t("No billable value in the selected period.")
          }
          contentDescription={valueSummary || t("No billable value")}
          isEmpty={currencies.length === 0}
          emptyState={{ title: t("No billable value") }}
        >
          <div className="space-y-4">
            {currencies.map((currency) => {
              const value = groups.reduce(
                (sum, group) => sum + (group.billableValue[currency] ?? 0),
                0,
              );
              return (
                <ActivitySummaryItem
                  key={currency}
                  label={currency}
                  value={formatMoney(value, currency, locale)}
                />
              );
            })}
            <Typography type="body-sm" color="muted">
              {t("Totals remain separated by currency; no conversion is applied.")}
            </Typography>
          </div>
        </ReportWidget>
      )}
      <ReportTableWidget
        title={t("Complete analysis")}
        description={t("All groups in the selected hierarchy.")}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
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
        }
        contentDescription={t("Summary report table")}
      >
        <DataTable
          label={t("Summary report table")}
          minWidth="min-w-[1180px]"
          scrollHint={t("Scroll horizontally to see all columns")}
        >
          <Table.Header>
            {[
              "Group",
              "Tracked",
              "Share",
              "Billable",
              "Internal",
              "Billable percentage",
              "Billable value",
              "Records",
              "Average entry duration",
            ].map((label, index) => (
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
      </ReportTableWidget>
    </ReportWidgetGrid>
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
      <Table.Cell aria-level={level + 1}>
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
          <span className="truncate">{group.label}</span>
          {expandable ? (
            <span id={childrenId} className="sr-only">
              {t("{count} nested report groups", { count: group.children?.length ?? 0 })}
            </span>
          ) : null}
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">{formatDuration(group.seconds, locale)}</Table.Cell>
      <Table.Cell>{total ? `${Math.round((group.seconds / total) * 100)}%` : "0%"}</Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {formatDuration(group.billable, locale)}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {formatDuration(group.seconds - group.billable, locale)}
      </Table.Cell>
      <Table.Cell>
        {group.seconds ? `${Math.round((group.billable / group.seconds) * 100)}%` : "0%"}
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {formatMoneyTotals(group.billableValue, locale)}
      </Table.Cell>
      <Table.Cell>{group.records}</Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        {formatDuration(group.records ? group.seconds / group.records : 0, locale)}
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
    <ButtonGroup variant="tertiary" size="sm" className="w-44">
      <Button type="button" aria-label={t(label)} className="h-9 min-w-0 flex-1 justify-start">
        {t(options.find((option) => option.id === value)?.label ?? label)}
      </Button>
      <Dropdown>
        <Button
          isIconOnly
          variant="tertiary"
          aria-label={t("Open {label}", { label: t(label) })}
          className="h-9 w-9 min-w-9 shrink-0 px-0"
        >
          <ButtonGroup.Separator />
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label={t(label)}
            selectionMode="single"
            selectedKeys={new Set([value])}
            onAction={(key) => onChange(String(key) as GroupDimension | "none")}
          >
            {options.map((option) => (
              <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
                <Label>{t(option.label)}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </ButtonGroup>
  );
}

type WeeklyRow = {
  key: string;
  label: string;
  seconds: number;
  billable: number;
  byDate: Record<string, number>;
  billableValue: MoneyTotals;
};

function buildWeeklyRows(
  entries: TimeEntry[],
  dimension: WeeklyDimension,
  members: Member[],
  projects: Project[],
  dates: string[],
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
): WeeklyRow[] {
  const map = new Map<string, WeeklyRow>();
  for (const entry of entries) {
    const key = dimension === "project" ? (entry.projectId ?? "none") : entry.userId;
    const label =
      dimension === "project"
        ? projectNameFor(projects, entry.projectId)
        : nameForMember(members, entry.userId);
    const current = map.get(key) ?? {
      key,
      label,
      seconds: 0,
      billable: 0,
      byDate: {},
      billableValue: {},
    };
    const seconds = entry.seconds;
    current.seconds += seconds;
    current.billable += entry.billable ? seconds : 0;
    current.byDate[entry.date] = (current.byDate[entry.date] ?? 0) + seconds;
    const billing = billingForEntry(entry, fallbackForEntry(entry));
    current.billableValue[billing.currency] =
      (current.billableValue[billing.currency] ?? 0) + billableValue(entry, billing);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label));
}

function formatClockSeconds(seconds: number): string {
  const normalized = Math.max(0, Math.min(86_399, Math.round(seconds)));
  const hours = Math.floor(normalized / 3_600);
  const minutes = Math.floor((normalized % 3_600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function ActivityDashboard({
  analytics,
  entries,
  range,
  dimension,
  members,
  projects,
  onChange,
  onClear,
  fallbackForEntry,
}: {
  analytics: ReportAnalytics;
  entries: TimeEntry[];
  range: DateRange;
  dimension: WeeklyDimension;
  members: Member[];
  projects: Project[];
  onChange: (dimension: WeeklyDimension) => void;
  onClear: () => void;
  fallbackForEntry: (entry: TimeEntry) => BillingPreference;
}) {
  const { locale, t } = useI18n();
  const percentageFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const periodDays = getDayOffset(range.startDate, range.endDate) + 1;
  const isExactWeek = periodDays === 7;
  const dates = isExactWeek
    ? Array.from({ length: 7 }, (_, index) => shiftDate(range.startDate, index))
    : [];
  const rows = isExactWeek
    ? buildWeeklyRows(entries, dimension, members, projects, dates, fallbackForEntry)
    : [];
  const predominantShift = [...analytics.shifts].sort(
    (first, second) => second.seconds - first.seconds,
  )[0];
  const hasActivity = analytics.summary.totalSeconds > 0;
  const predominantPercentage =
    predominantShift && hasActivity
      ? (predominantShift.seconds / analytics.summary.totalSeconds) * 100
      : 0;
  const previousPredominantSeconds = predominantShift
    ? (analytics.previousShifts.find((item) => item.shift === predominantShift.shift)?.seconds ?? 0)
    : 0;
  const predominantComparison = predominantShift
    ? {
        current: predominantShift.seconds,
        previous: previousPredominantSeconds,
        delta: predominantShift.seconds - previousPredominantSeconds,
        percentageChange:
          previousPredominantSeconds === 0
            ? predominantShift.seconds === 0
              ? 0
              : null
            : ((predominantShift.seconds - previousPredominantSeconds) /
                previousPredominantSeconds) *
              100,
      }
    : null;
  const shiftData = analytics.shifts.map((shift) => {
    const percentage = hasActivity ? (shift.seconds / analytics.summary.totalSeconds) * 100 : 0;
    return {
      shift: t(shiftLabels[shift.shift]),
      seconds: shift.seconds,
      display: `${formatDuration(shift.seconds, locale)} · ${percentageFormatter.format(percentage)}%`,
    };
  });
  const shiftSummary = shiftData.map((item) => `${item.shift}: ${item.display}`).join(". ");
  const evolutionData = analytics.shiftTemporal.map((bucket) => ({
    label: formatOverviewBucket(bucket, locale),
    ...bucket.shifts,
  }));
  const evolutionTickInterval = Math.max(0, Math.ceil(evolutionData.length / 8) - 1);
  const evolutionSummary = analytics.shifts
    .map((shift) => `${t(shiftLabels[shift.shift])}: ${formatDuration(shift.seconds, locale)}`)
    .join(". ");
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0] as const;
  const weekdayLabel = (weekday: number, format: "short" | "long") =>
    new Intl.DateTimeFormat(locale, { weekday: format, timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 7, 3 + ((weekday + 6) % 7))),
    );
  const weekdayData = weekdayOrder.map((weekday) => {
    const activity = analytics.weekdayActivity.find((item) => item.weekday === weekday)!;
    return {
      weekday: weekdayLabel(weekday, "short"),
      fullLabel: weekdayLabel(weekday, "long"),
      seconds: activity.averageSeconds,
      display: formatDuration(activity.averageSeconds, locale),
    };
  });
  const weekdaySummary = weekdayData.map((item) => `${item.fullLabel}: ${item.display}`).join(". ");
  const workdayWeekend = [
    { label: t("Weekdays"), value: analytics.workdayWeekend.workdays },
    { label: t("Weekends"), value: analytics.workdayWeekend.weekends },
  ];
  const characteristicTimes = analytics.characteristicTimes;

  return (
    <ReportWidgetGrid>
      <ReportChartWidget
        title={t("Hours by shift")}
        description={t("Registered activity by time of day.")}
        contentDescription={shiftSummary || t("No activity")}
        config={{ seconds: { label: t("Registered activity"), color: reportChartColors.accent } }}
        summary={shiftSummary || t("No activity")}
        width="compact"
        isEmpty={!hasActivity}
        emptyState={{ title: t("No chart data") }}
      >
        <BarChart
          accessibilityLayer
          data={shiftData}
          layout="vertical"
          margin={{ left: 0, right: 96 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="seconds" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="shift"
            type="category"
            width={72}
            tickFormatter={(value) => shortenReportChartLabel(value, 10)}
          />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar {...reportHorizontalBarProps} dataKey="seconds" fill={reportChartColors.accent}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>
      <ReportChartWidget
        title={t("Shift evolution")}
        description={t("Registered activity across shifts over the selected period.")}
        contentDescription={evolutionSummary || t("No activity")}
        config={{
          overnight: { label: t("Overnight"), color: reportChartColors.muted },
          morning: { label: t("Morning"), color: reportChartColors.accent },
          afternoon: { label: t("Afternoon"), color: reportChartColors.success },
          night: { label: t("Night"), color: reportChartColors.warning },
        }}
        summary={evolutionSummary || t("No activity")}
        legend={
          <ReportChartLegend
            accessibleLabel={t("Chart legend")}
            items={[
              { key: "overnight", label: t("Overnight") },
              { key: "morning", label: t("Morning"), tone: "accent" },
              { key: "afternoon", label: t("Afternoon"), tone: "success" },
              { key: "night", label: t("Night"), tone: "warning" },
            ]}
          />
        }
        isEmpty={!hasActivity}
        emptyState={{ title: t("No chart data") }}
      >
        <BarChart accessibilityLayer data={evolutionData} margin={{ left: 0, right: 8 }}>
          <CartesianGrid {...reportChartGridProps} />
          <XAxis
            {...reportChartAxisProps}
            dataKey="label"
            interval={evolutionTickInterval}
            tickFormatter={(value) => shortenReportChartLabel(value, 12)}
          />
          <YAxis {...reportChartAxisProps} hide />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar
            {...reportVerticalBarProps}
            dataKey="overnight"
            stackId="activity"
            fill={reportChartColors.muted}
            radius={[0, 0, 4, 4]}
          />
          <Bar
            {...reportVerticalBarProps}
            dataKey="morning"
            stackId="activity"
            fill={reportChartColors.accent}
            radius={0}
          />
          <Bar
            {...reportVerticalBarProps}
            dataKey="afternoon"
            stackId="activity"
            fill={reportChartColors.success}
            radius={0}
          />
          <Bar
            {...reportVerticalBarProps}
            dataKey="night"
            stackId="activity"
            fill={reportChartColors.warning}
          />
        </BarChart>
      </ReportChartWidget>
      <ReportKpi
        title={t("Predominant shift")}
        value={predominantShift ? t(shiftLabels[predominantShift.shift]) : t("No activity")}
        secondaryInformation={
          predominantShift
            ? `${formatDuration(predominantShift.seconds, locale)} · ${percentageFormatter.format(
                predominantPercentage,
              )}%`
            : undefined
        }
        variation={
          predominantComparison ? comparisonVariation(predominantComparison, locale, t) : null
        }
        neutralComparisonLabel={t("No comparison")}
        contentDescription={
          predominantShift
            ? `${t("Predominant shift")}: ${t(shiftLabels[predominantShift.shift])}. ${formatDuration(
                predominantShift.seconds,
                locale,
              )}, ${percentageFormatter.format(predominantPercentage)}%.`
            : t("No activity")
        }
        isEmpty={!hasActivity}
        emptyState={{ title: t("No activity") }}
      />
      <ReportChartWidget
        title={t("Activity by weekday")}
        description={t("Average registered activity for each weekday.")}
        contentDescription={weekdaySummary}
        config={{
          seconds: { label: t("Average registered activity"), color: reportChartColors.accent },
        }}
        summary={weekdaySummary}
        width="compact"
        height="tall"
        isEmpty={periodDays < 14 || !hasActivity}
        emptyState={
          periodDays < 14
            ? {
                title: t("At least two weeks are needed"),
                description: t("Select a period of at least 14 days to see weekday averages."),
              }
            : { title: t("No chart data") }
        }
      >
        <BarChart
          accessibilityLayer
          data={weekdayData}
          layout="vertical"
          margin={{ left: 0, right: 72 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="seconds" hide />
          <YAxis {...reportChartAxisProps} dataKey="weekday" type="category" width={56} />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
              />
            }
          />
          <Bar {...reportHorizontalBarProps} dataKey="seconds" fill={reportChartColors.accent}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>
      <ReportWidget
        title={t("Weekdays versus weekends")}
        description={t("Registered activity and average per active day.")}
        contentDescription={workdayWeekend
          .map(
            (item) =>
              `${item.label}: ${formatDuration(item.value.seconds, locale)}, ${percentageFormatter.format(
                item.value.percentage,
              )}%, ${formatDuration(item.value.averageSecondsPerActiveDay, locale)} ${t(
                "per active day",
              )}`,
          )
          .join(". ")}
        isEmpty={!hasActivity}
        emptyState={{ title: t("No activity") }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {workdayWeekend.map((item) => (
            <div key={item.label} className="min-w-0 space-y-2">
              <Typography type="body-sm" weight="semibold">
                {item.label}
              </Typography>
              <Typography type="h3" weight="semibold">
                {formatDuration(item.value.seconds, locale)}
              </Typography>
              <Typography type="body-sm" color="muted">
                {percentageFormatter.format(item.value.percentage)}% ·{" "}
                {t("Average {value} per active day", {
                  value: formatDuration(item.value.averageSecondsPerActiveDay, locale),
                })}
              </Typography>
            </div>
          ))}
        </div>
      </ReportWidget>
      <ReportWidget
        title={t("Characteristic times")}
        description={t("Registered activity times; these are not a productivity measure.")}
        contentDescription={
          characteristicTimes
            ? `${t("Average start")}: ${formatClockSeconds(
                characteristicTimes.averageStartSeconds,
              )}. ${t("Average end")}: ${formatClockSeconds(
                characteristicTimes.averageEndSeconds,
              )}. ${t("Earliest start")}: ${formatClockSeconds(
                characteristicTimes.earliestStartSeconds,
              )}. ${t("Latest end")}: ${formatClockSeconds(characteristicTimes.latestEndSeconds)}.`
            : t("No activity")
        }
        isEmpty={!characteristicTimes}
        emptyState={{ title: t("No activity") }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ActivitySummaryItem
            label={t("Average start")}
            value={formatClockSeconds(characteristicTimes?.averageStartSeconds ?? 0)}
          />
          <ActivitySummaryItem
            label={t("Average end")}
            value={formatClockSeconds(characteristicTimes?.averageEndSeconds ?? 0)}
          />
          <ActivitySummaryItem
            label={t("Earliest start")}
            value={formatClockSeconds(characteristicTimes?.earliestStartSeconds ?? 0)}
          />
          <ActivitySummaryItem
            label={t("Latest end")}
            value={formatClockSeconds(characteristicTimes?.latestEndSeconds ?? 0)}
          />
        </div>
      </ReportWidget>
      {isExactWeek ? (
        <ReportTableWidget
          title={t("Weekly matrix")}
          description={t("Seven-day registered activity grouped by project or member.")}
          action={
            <GroupSelect
              label="Weekly group"
              value={dimension}
              options={weeklyOptions}
              onChange={(value) => {
                if (value === "project" || value === "member") onChange(value);
              }}
            />
          }
          contentDescription={t("Weekly report table")}
          isEmpty={rows.length === 0}
          emptyState={{
            title: t("No time entries match"),
            description: t("Try a wider period or clear one of the active filters."),
            action: (
              <Button variant="secondary" size="sm" onPress={onClear}>
                <ArrowRotateLeft className="size-4" />
                {t("Clear filters")}
              </Button>
            ),
          }}
        >
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
              <Table.Column>{t("Billable value")}</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.key}>
                  <Table.Cell>{row.label}</Table.Cell>
                  {dates.map((date) => (
                    <Table.Cell key={date}>
                      {formatDuration(row.byDate[date] ?? 0, locale)}
                    </Table.Cell>
                  ))}
                  <Table.Cell>{formatDuration(row.seconds, locale)}</Table.Cell>
                  <Table.Cell>{formatDuration(row.billable, locale)}</Table.Cell>
                  <Table.Cell>{formatDuration(row.seconds - row.billable, locale)}</Table.Cell>
                  <Table.Cell>{formatMoneyTotals(row.billableValue, locale)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </DataTable>
        </ReportTableWidget>
      ) : null}
    </ReportWidgetGrid>
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
  billableValue: MoneyTotals;
};

function buildTeamRows(
  entries: TimeEntry[],
  members: Member[],
  projects: Project[],
  clients: Client[],
  onlyMemberId: string | null,
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
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
        billableValue: sumBillableValues(memberEntries, fallbackForEntry),
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
  fallbackForEntry,
}: {
  entries: TimeEntry[];
  members: Member[];
  projects: Project[];
  clients: Client[];
  total: number;
  scopeToMember: string | null;
  onClear: () => void;
  fallbackForEntry: (entry: TimeEntry) => BillingPreference;
}) {
  const { locale, t } = useI18n();
  const rows = buildTeamRows(entries, members, projects, clients, scopeToMember, fallbackForEntry);
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
            "Billable value",
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
                <div>{row.member.name}</div>
                <div>{row.member.email}</div>
              </Table.Cell>
              <Table.Cell>{formatDuration(row.seconds, locale)}</Table.Cell>
              <Table.Cell>{formatDuration(row.billable, locale)}</Table.Cell>
              <Table.Cell>{formatDuration(row.seconds - row.billable, locale)}</Table.Cell>
              <Table.Cell>{formatMoneyTotals(row.billableValue, locale)}</Table.Cell>
              <Table.Cell>{row.records}</Table.Cell>
              <Table.Cell>{row.projectCount}</Table.Cell>
              <Table.Cell>{row.clientCount}</Table.Cell>
              <Table.Cell>
                {formatDuration(
                  row.activeDays ? Math.round(row.seconds / row.activeDays) : 0,
                  locale,
                )}
              </Table.Cell>
              <Table.Cell>
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
        <ChartContainer
          className="h-64 w-full"
          config={{ seconds: { label: t("Tracked"), color: "var(--accent)" } }}
        >
          <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" dataKey="seconds" hide />
            <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={96} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="seconds" fill="var(--accent)" isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        {data[0] ? (
          <div className="flex items-center gap-4 lg:block">
            <ReportMetricRing
              label={t("Top member")}
              seconds={data[0].seconds}
              total={totalSeconds}
              color="accent"
            />
            <Typography type="body-sm" color="muted" className="mt-2">
              {data[0].share}% · {formatDuration(data[0].seconds, locale)}
            </Typography>
          </div>
        ) : null}
      </div>
    </ReportChartCard>
  );
}
