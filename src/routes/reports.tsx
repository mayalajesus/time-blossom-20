import {
  Button,
  ButtonGroup,
  Chip,
  Checkbox,
  Dropdown,
  Input,
  Label,
  Popover,
  Table,
  TextField,
  Tooltip,
  Typography,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRotateLeft,
  ArrowUp,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleInfo,
  Minus,
} from "@gravity-ui/icons";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label as ChartLabel,
  LabelList,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { BillableIndicator } from "@/components/billable-indicator";
import { ProjectLabel } from "@/components/project-color";
import { DataTable } from "@/components/data-table";
import { ExportModal } from "@/components/export-modal";
import {
  ReportFiltersBar,
  type ReportFilterKey,
  type ReportFilterValues,
} from "@/components/report-filters";
import { PageHeader } from "@/components/page-header";
import { EmptyBlock, CardsSkeleton } from "@/components/states";
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  ReportChart,
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
  isCurrencyCode,
  sumBillableValues,
  type BillingPreference,
  type MoneyTotals,
} from "@/lib/billing";
import {
  calculateReportAnalytics,
  calculateReportMetrics,
  getReportBillableCurrencies,
  type ReportAnalytics,
  type ShiftId,
  type TemporalBucket,
} from "@/lib/report-analytics";
import {
  isLegacyTeamReportView,
  normalizeReportView,
  reportViews,
  type ReportView,
} from "@/lib/report-views";
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
  | "hourlyRate"
  | "currency"
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
  { id: "member", label: "Member" },
  { id: "projectClient", label: "Project / client" },
  { id: "task", label: "Task" },
  { id: "description", label: "Description" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { id: "duration", label: "Duration" },
  { id: "billability", label: "Billing" },
  { id: "hourlyRate", label: "Hourly rate" },
  { id: "currency", label: "Currency" },
  { id: "value", label: "Estimated billable value" },
];

const defaultDetailedColumns: DetailedColumn[] = [
  "date",
  "member",
  "projectClient",
  "task",
  "start",
  "end",
  "duration",
  "billability",
  "hourlyRate",
  "currency",
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
  currency?: ReportFilterValues["currency"];
  visible?: string;
  group?: GroupDimension;
  subgroup?: GroupDimension | "none";
  columns?: string;
  page?: number;
};

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
    view: normalizeReportView(search["view"]),
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
    currency:
      search["currency"] === "all" || isCurrencyCode(search["currency"])
        ? search["currency"]
        : "all",
    visible:
      typeof search["visible"] === "string" ? search["visible"] : defaultVisibleFilters.join(","),
    group: isLegacyTeamReportView(search["view"])
      ? "member"
      : isGroupDimension(search["group"])
        ? search["group"]
        : "project",
    subgroup:
      search["subgroup"] === "none" || isGroupDimension(search["subgroup"])
        ? search["subgroup"]
        : "none",
    columns: asCsv(search["columns"]),
    page:
      Number.isInteger(search["page"]) && Number(search["page"]) > 0 ? Number(search["page"]) : 1,
  }),
  head: () => ({
    meta: [
      { title: "Reports — Time Blossom" },
      {
        name: "description",
        content: "Overview, analysis and detailed time reports.",
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
    currency: rawSearch.currency ?? "all",
    visible: rawSearch.visible ?? defaultVisibleFilters.join(","),
    group: rawSearch.group ?? "project",
    subgroup: rawSearch.subgroup ?? "none",
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
  const effectiveGroup: GroupDimension =
    !showTeam && search.group === "member" ? "project" : search.group;
  const effectiveSubgroup: GroupDimension | "none" =
    !showTeam && search.subgroup === "member" ? "none" : search.subgroup;
  const filterValues = useMemo<ReportFilterValues>(
    () => ({
      memberIds: parseIds(search.members),
      clientIds: parseIds(search.clients),
      projectIds: parseIds(search.projects),
      description: search.description,
      billability: search.billability,
      currency: search.currency,
    }),
    [
      search.billability,
      search.clients,
      search.currency,
      search.description,
      search.members,
      search.projects,
    ],
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
  const fallbackForEntry = useCallback(
    (entry: TimeEntry): BillingPreference =>
      billingPreferencesByUserId[entry.userId] ?? {
        hourlyRate: preferences.hourlyRate,
        currency: preferences.currency,
      },
    [billingPreferencesByUserId, preferences.currency, preferences.hourlyRate],
  );
  const normalizedDescription = normalizeSearch(filterValues.description);

  const reportEntriesBeforeCurrency = useMemo(() => {
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
  const availableCurrencies = useMemo(
    () =>
      getReportBillableCurrencies(reportEntriesBeforeCurrency, {
        range,
        fallbackForEntry,
        timeZone: preferences.timezone,
      }),
    [fallbackForEntry, preferences.timezone, range, reportEntriesBeforeCurrency],
  );
  const reportEntries = useMemo(
    () =>
      filterValues.currency === "all"
        ? reportEntriesBeforeCurrency
        : reportEntriesBeforeCurrency.filter(
            (entry) =>
              entry.billable &&
              billingForEntry(entry, fallbackForEntry(entry)).currency === filterValues.currency,
          ),
    [fallbackForEntry, filterValues.currency, reportEntriesBeforeCurrency],
  );
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
  const reportAnalytics = useMemo(
    () =>
      calculateReportAnalytics({
        entries: reportEntries,
        range,
        projects,
        clients,
        fallbackForEntry,
        emptyCurrency:
          filterValues.currency === "all" ? preferences.currency : filterValues.currency,
        timeZone: preferences.timezone,
        weekStartsOn,
      }),
    [
      clients,
      fallbackForEntry,
      filterValues.currency,
      preferences.currency,
      preferences.timezone,
      projects,
      range,
      reportEntries,
      weekStartsOn,
    ],
  );
  const billableValues = sumBillableValues(
    filteredEntries,
    fallbackForEntry,
    filterValues.currency === "all" ? preferences.currency : filterValues.currency,
  );
  const exportUsesAnalytics = search.view === "overview";
  const exportTotal = exportUsesAnalytics ? reportAnalytics.summary.totalSeconds : total;
  const exportBillable = exportUsesAnalytics ? reportAnalytics.summary.billableSeconds : billable;
  const exportInternal = exportUsesAnalytics ? reportAnalytics.summary.internalSeconds : internal;
  const exportRecords = exportUsesAnalytics
    ? reportAnalytics.summary.entryCount
    : filteredEntries.length;
  const exportBillableValues = exportUsesAnalytics
    ? reportAnalytics.summary.billableValueByCurrency
    : billableValues;
  const reportScope = can("export-all-reports") ? t("Workspace report") : t("Your report");
  const [summaryExpanded, setSummaryExpanded] = useState<Record<string, boolean>>({});
  const groups = useMemo(
    () =>
      buildGroups(
        filteredEntries,
        effectiveGroup,
        effectiveSubgroup,
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
      effectiveGroup,
      effectiveSubgroup,
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
        effectiveGroup,
        effectiveSubgroup,
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
      effectiveGroup,
      effectiveSubgroup,
    ],
  );
  const exportContext = useMemo(() => {
    const viewLabel = t(reportViews.find((report) => report.id === search.view)?.label ?? "Time");
    const temporalGrouping = t(
      { day: "Day", week: "Week", month: "Month" }[reportAnalytics.granularity],
    );
    const grouping =
      search.view === "summary"
        ? [
            t(groupOptions.find((option) => option.id === effectiveGroup)?.label ?? "Group"),
            effectiveSubgroup === "none"
              ? ""
              : t(groupOptions.find((option) => option.id === effectiveSubgroup)?.label ?? "Group"),
          ]
            .filter(Boolean)
            .join(" → ")
        : search.view === "overview"
          ? temporalGrouping
          : t("None");
    return {
      locale,
      ...(currentWorkspace
        ? {
            branding: {
              workspaceName: currentWorkspace.name,
              logoDataUrl: currentWorkspace.logoDataUrl,
            },
          }
        : {}),
      displayTitle: `${viewLabel} ${t("report")}`,
      subtitle: `Time Blossom · ${formatDateRange(range.startDate, range.endDate, locale)}`,
      meta: [
        { label: t("Period"), value: formatDateRange(range.startDate, range.endDate, locale) },
        { label: t("Scope"), value: reportScope },
        { label: t("View"), value: viewLabel },
        { label: t("Grouping"), value: grouping },
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
              search.currency !== "all" ? `${t("Currency")}: ${search.currency}` : "",
            ]
              .filter(Boolean)
              .join(" · ") || t("None"),
        },
      ],
      summary: [
        { label: t("Entries"), value: String(exportRecords) },
        { label: t("Tracked"), value: formatDuration(exportTotal, locale) },
        { label: t("Billable"), value: formatDuration(exportBillable, locale) },
        { label: t("Internal"), value: formatDuration(exportInternal, locale) },
        ...currencyOptions
          .filter((currency) => exportBillableValues[currency] !== undefined)
          .map((currency) => ({
            label: `${t("Estimated billable value")} (${currency})`,
            value: formatMoney(exportBillableValues[currency] ?? 0, currency, locale),
          })),
      ],
    };
  }, [
    currentWorkspace,
    exportBillable,
    exportBillableValues,
    exportInternal,
    exportRecords,
    exportTotal,
    locale,
    range.endDate,
    range.startDate,
    reportScope,
    reportAnalytics.granularity,
    effectiveGroup,
    effectiveSubgroup,
    search.billability,
    search.clients,
    search.currency,
    search.description,
    search.members,
    search.projects,
    search.view,
    t,
  ]);

  const exportPayload = useMemo<ReportExportPayload>(() => {
    if (search.view === "overview") {
      const summary = reportAnalytics.summary;
      const exportedProjects = overviewProjectRows(reportAnalytics, projects, clients);
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
        sections: [
          {
            title: t("Activity evolution"),
            columns: [
              t("Period"),
              t("Billable"),
              t("Internal"),
              t("Tracked"),
              t("Previous period"),
              t("Difference"),
            ],
            rows: reportAnalytics.temporal.map((bucket, index) => {
              const previous = reportAnalytics.previousTemporal[index]?.totalSeconds ?? 0;
              const difference = bucket.totalSeconds - previous;
              const differencePrefix = difference > 0 ? "+" : difference < 0 ? "−" : "";
              return {
                [t("Period")]: formatOverviewBucket(bucket, locale),
                [t("Billable")]: formatDuration(bucket.billableSeconds, locale),
                [t("Internal")]: formatDuration(bucket.internalSeconds, locale),
                [t("Tracked")]: formatDuration(bucket.totalSeconds, locale),
                [t("Previous period")]: formatDuration(previous, locale),
                [t("Difference")]: `${differencePrefix}${formatDuration(
                  Math.abs(difference),
                  locale,
                )}`,
              };
            }),
          },
          {
            title: t("Billing distribution"),
            columns: [t("Billing"), t("Tracked"), t("Share")],
            rows: [
              {
                [t("Billing")]: t("Billable"),
                [t("Tracked")]: formatDuration(summary.billableSeconds, locale),
                [t("Share")]: `${Math.round(summary.billablePercentage)}%`,
              },
              {
                [t("Billing")]: t("Internal"),
                [t("Tracked")]: formatDuration(summary.internalSeconds, locale),
                [t("Share")]: summary.totalSeconds
                  ? `${Math.round((summary.internalSeconds / summary.totalSeconds) * 100)}%`
                  : "0%",
              },
            ],
          },
          {
            title: t("Hours by shift"),
            columns: [t("Shift"), t("Tracked"), t("Share")],
            rows: reportAnalytics.shifts.map((shift) => ({
              [t("Shift")]: t(shiftLabels[shift.shift]),
              [t("Tracked")]: formatDuration(shift.seconds, locale),
              [t("Share")]: summary.totalSeconds
                ? `${Math.round((shift.seconds / summary.totalSeconds) * 100)}%`
                : "0%",
            })),
          },
          {
            title: t("Top projects"),
            columns: [
              t("Project"),
              t("Client"),
              t("Tracked"),
              t("Billable"),
              t("Estimated billable value"),
            ],
            rows: exportedProjects.map((project) => ({
              [t("Project")]: project.id === "none" ? t("No project") : project.project,
              [t("Client")]: project.client ?? t("No client"),
              [t("Tracked")]: formatDuration(project.seconds, locale),
              [t("Billable")]: formatDuration(project.billableSeconds, locale),
              [t("Estimated billable value")]:
                formatMoneyTotals(project.valueByCurrency, locale) || "—",
            })),
          },
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
        t("Estimated billable value"),
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
            [t("Estimated billable value")]: formatMoney(
              billableValue(entry, billing),
              billing.currency,
              locale,
            ),
          };
        }),
      };
    }
    {
      const hasSubgroup = effectiveSubgroup !== "none" && effectiveSubgroup !== effectiveGroup;
      const exportGroups = hasSubgroup
        ? groups.flatMap((group) =>
            (group.children ?? []).map((child) => ({
              primaryLabel: group.label,
              secondaryLabel: child.label,
              group: child,
            })),
          )
        : groups.map((group) => ({ primaryLabel: group.label, secondaryLabel: "", group }));
      return {
        ...exportContext,
        title: `time-blossom-${search.view}`,
        columns: [
          t("Group"),
          ...(hasSubgroup ? [t("Subgroup")] : []),
          t("Tracked"),
          t("Share"),
          t("Billable"),
          t("Internal"),
          t("Billable percentage"),
          t("Estimated billable value"),
          t("Records"),
          t("Average entry duration"),
        ],
        rows: exportGroups.map((item) => ({
          [t("Group")]: item.primaryLabel,
          ...(hasSubgroup ? { [t("Subgroup")]: item.secondaryLabel } : {}),
          [t("Tracked")]: formatDuration(item.group.seconds, locale),
          [t("Share")]: total ? `${Math.round((item.group.seconds / total) * 100)}%` : "0%",
          [t("Billable")]: formatDuration(item.group.billable, locale),
          [t("Internal")]: formatDuration(item.group.seconds - item.group.billable, locale),
          [t("Billable percentage")]: item.group.seconds
            ? `${Math.round((item.group.billable / item.group.seconds) * 100)}%`
            : "0%",
          [t("Estimated billable value")]: formatMoneyTotals(item.group.billableValue, locale),
          [t("Records")]: item.group.records,
          [t("Average entry duration")]: formatDuration(
            item.group.records ? item.group.seconds / item.group.records : 0,
            locale,
          ),
        })),
      };
    }
  }, [
    clients,
    effectiveGroup,
    effectiveSubgroup,
    filteredEntries,
    groups,
    memberMap,
    projects,
    exportContext,
    search.view,
    locale,
    reportAnalytics,
    t,
    total,
    fallbackForEntry,
  ]);

  const description = {
    overview: t("See tracked time, billability, estimated value and activity distribution."),
    detailed: t("Inspect every entry with its project, client, person and billability."),
    summary: t("See where tracked time and estimated billable value are concentrated."),
  }[search.view];

  const clearFilters = () =>
    updateSearch({
      members: "",
      clients: "",
      projects: "",
      description: "",
      billability: "all",
      currency: "all",
    });

  return (
    <div className={search.view === "overview" ? "space-y-5" : "space-y-6"}>
      <PageHeader
        title={t("Reports")}
        description={description}
        actions={
          search.view === "overview" ? (
            <ReportExportButton onPress={() => setExportOpen(true)} />
          ) : undefined
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
        currencies={availableCurrencies}
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
            currency: next.currency,
          });
        }}
        onClear={() =>
          updateSearch({
            members: "",
            clients: "",
            projects: "",
            description: "",
            billability: "all",
            currency: "all",
          })
        }
      />

      {loading ? (
        <CardsSkeleton count={3} />
      ) : (
        <>
          {search.view === "overview" ? (
            <OverviewDashboard analytics={reportAnalytics} projects={projects} clients={clients} />
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
              onExport={() => setExportOpen(true)}
            />
          ) : (
            <SummaryReport
              groups={groups}
              previousGroups={previousGroups}
              projects={projects}
              total={total}
              primary={effectiveGroup}
              secondary={effectiveSubgroup}
              canGroupByMember={showTeam}
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
              onExport={() => setExportOpen(true)}
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
  colorByDirection = false,
) {
  if (comparison.current === 0 && comparison.previous === 0) return null;
  if (comparison.previous === 0) {
    return {
      label: "+100%",
      accessibleLabel: `100% ${t("more than previous period")}`,
      direction: "up" as const,
      tone: colorByDirection ? ("positive" as const) : ("neutral" as const),
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
    tone: colorByDirection
      ? change > 0
        ? ("positive" as const)
        : ("negative" as const)
      : ("neutral" as const),
  };
}

function selectTopProjects(analytics: ReportAnalytics, maximum = 5) {
  const noProject = analytics.summary.projectBreakdown.find((item) => item.id === "none");
  const projects = analytics.summary.projectBreakdown.filter((item) => item.id !== "none");
  const selected = noProject
    ? [...projects.slice(0, Math.max(0, maximum - 1)), noProject]
    : projects.slice(0, maximum);
  return selected.sort(
    (first, second) => second.seconds - first.seconds || first.label.localeCompare(second.label),
  );
}

function overviewProjectRows(analytics: ReportAnalytics, projects: Project[], clients: Client[]) {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const financialMap = new Map(
    analytics.financial.projects.map((project) => [project.id, project]),
  );

  return selectTopProjects(analytics).map((dimension) => {
    const project = dimension.id === "none" ? null : projectMap.get(dimension.id);
    const financial = financialMap.get(dimension.id);
    return {
      id: dimension.id,
      projectColor: project?.color ?? null,
      project: dimension.label,
      client: project ? clientMap.get(project.clientId)?.name : null,
      seconds: dimension.seconds,
      billableSeconds: financial?.billableSeconds ?? 0,
      valueByCurrency: financial?.valueByCurrency ?? {},
    };
  });
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

function ReportExportButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant="secondary" onPress={onPress}>
      <ArrowDownToLine className="size-4" />
      {t("Export")}
    </Button>
  );
}

function OverviewTooltipTitle({ label, help }: { label: string; help: ReactNode }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <OverviewAccessibleTooltip
        label={t("More information about {label}", { label })}
        content={help}
        className="size-5 min-w-5 items-center justify-center"
      >
        <CircleInfo aria-hidden="true" className="size-3.5" />
      </OverviewAccessibleTooltip>
    </span>
  );
}

function OverviewAccessibleTooltip({
  label,
  content,
  children,
  className = "",
}: {
  label: string;
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Tooltip delay={0} closeDelay={0} shouldSkipAnimation isOpen={isOpen} onOpenChange={setIsOpen}>
      <Tooltip.Trigger
        aria-label={label}
        className={`inline-flex shrink-0 ${className}`}
        tabIndex={0}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((current) => !current);
          }
        }}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-xs" showArrow>
        {content}
      </Tooltip.Content>
    </Tooltip>
  );
}

function OverviewDashboard({
  analytics,
  projects,
  clients,
}: {
  analytics: ReportAnalytics;
  projects: Project[];
  clients: Client[];
}) {
  const { locale, t } = useI18n();
  const { summary } = analytics;
  const percentageFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const trackedVariation = comparisonVariation(
    analytics.comparison.metrics.totalSeconds,
    locale,
    t,
    true,
  );
  const billableVariation = comparisonVariation(
    analytics.comparison.metrics.billableSeconds,
    locale,
    t,
    true,
  );
  const monetaryTotals = currencyOptions.filter(
    (currency) =>
      summary.billableValueByCurrency[currency] !== undefined ||
      analytics.comparison.billableValueByCurrency[currency] !== undefined,
  );
  const periodValueData = monetaryTotals.map((currency) => {
    const comparison = analytics.comparison.billableValueByCurrency[currency] ?? {
      current: summary.billableValueByCurrency[currency] ?? 0,
      previous: 0,
      delta: summary.billableValueByCurrency[currency] ?? 0,
      percentageChange: null,
    };
    const deltaPrefix = comparison.delta > 0 ? "+" : comparison.delta < 0 ? "−" : "";
    const percentageChange = comparison.percentageChange ?? (comparison.current > 0 ? 100 : 0);
    const percentagePrefix = percentageChange > 0 ? "+" : percentageChange < 0 ? "−" : "";
    return {
      currency,
      value: formatMoney(comparison.current, currency, locale),
      previous: formatMoney(comparison.previous, currency, locale),
      delta: `${deltaPrefix}${formatMoney(Math.abs(comparison.delta), currency, locale)}`,
      comparison: `${percentagePrefix}${percentageFormatter.format(Math.abs(percentageChange))}%`,
      direction: comparison.delta > 0 ? "up" : comparison.delta < 0 ? "down" : "neutral",
    };
  });
  const predominantShift = [...analytics.shifts].sort(
    (first, second) => second.seconds - first.seconds,
  )[0];
  const hasPredominantShift = Boolean(predominantShift && predominantShift.seconds > 0);
  const predominantShiftLabel = hasPredominantShift
    ? t(shiftLabels[predominantShift!.shift])
    : t("No activity");
  const evolutionData = analytics.temporal.map((bucket, index) => {
    const previous = analytics.previousTemporal[index]?.totalSeconds ?? 0;
    return {
      label: formatOverviewBucket(bucket, locale),
      billable: bucket.billableSeconds,
      internal: bucket.internalSeconds,
      currentTotal: bucket.totalSeconds,
      previous,
      difference: bucket.totalSeconds - previous,
    };
  });
  const hasPreviousActivity = analytics.comparison.previous.totalSeconds > 0;
  const evolutionTicks =
    evolutionData.length <= 8
      ? evolutionData.map((item) => item.label)
      : Array.from({ length: 8 }, (_, index) => {
          const dataIndex = Math.round((index * (evolutionData.length - 1)) / 7);
          return evolutionData[dataIndex]?.label;
        }).filter((label): label is string => Boolean(label));
  const shiftData = analytics.shifts.map((shift) => {
    const percentage = summary.totalSeconds > 0 ? (shift.seconds / summary.totalSeconds) * 100 : 0;
    return {
      shift: t(shiftLabels[shift.shift]),
      seconds: shift.seconds,
      percentage,
      display: `${formatDuration(shift.seconds, locale)} · ${percentageFormatter.format(percentage)}%`,
    };
  });
  const projectData = overviewProjectRows(analytics, projects, clients);
  const billingData = [
    {
      name: t("Billable"),
      value: summary.billableSeconds,
      color: reportChartColors.success,
    },
    {
      name: t("Internal"),
      value: summary.internalSeconds,
      color: reportChartColors.muted,
    },
  ].filter((item) => item.value > 0);
  const billablePercentage = percentageFormatter.format(summary.billablePercentage);
  const internalPercentage =
    summary.totalSeconds > 0
      ? percentageFormatter.format((summary.internalSeconds / summary.totalSeconds) * 100)
      : "0";
  const evolutionSummary = `${t("Current period")}: ${formatDuration(
    summary.totalSeconds,
    locale,
  )}. ${t("Previous period")}: ${formatDuration(
    analytics.comparison.previous.totalSeconds,
    locale,
  )}.`;
  const shiftSummary = shiftData.map((item) => `${item.shift}: ${item.display}`).join(". ");
  const projectSummary = projectData
    .map((item) => `${item.project}: ${formatDuration(item.seconds, locale)}`)
    .join(". ");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
      <div className="grid min-w-0 lg:col-span-4">
        <ReportKpi
          title={
            <OverviewTooltipTitle
              label={t("Tracked time")}
              help={t("Comparisons use the previous equivalent period.")}
            />
          }
          value={formatDuration(summary.totalSeconds, locale)}
          variation={trackedVariation}
          neutralComparisonLabel={t("No comparison")}
          contentDescription={`${t("Tracked")}: ${formatDuration(
            summary.totalSeconds,
            locale,
          )}. ${t("Active days")}: ${summary.activeDays}. ${t("Average/day")}: ${formatDuration(
            summary.averageSecondsPerActiveDay,
            locale,
          )}. ${t("Previous period")}: ${formatDuration(
            analytics.comparison.previous.totalSeconds,
            locale,
          )}.`}
        />
      </div>
      <div className="grid min-w-0 lg:col-span-4">
        <ReportKpi
          title={
            <OverviewTooltipTitle
              label={t("Billable time")}
              help={t("Only entries marked as billable are included in this total.")}
            />
          }
          value={formatDuration(summary.billableSeconds, locale)}
          variation={billableVariation}
          neutralComparisonLabel={t("No comparison")}
          contentDescription={`${t("Billable")}: ${formatDuration(
            summary.billableSeconds,
            locale,
          )}, ${billablePercentage}% ${t("of tracked time")}. ${t(
            "Internal",
          )}: ${formatDuration(summary.internalSeconds, locale)}.`}
        />
      </div>
      <div className="grid min-w-0 md:col-span-2 lg:col-span-4">
        <ReportWidget
          title={
            <OverviewTooltipTitle
              label={t("Estimated billable value")}
              help={`${t(
                "Estimate based on billable time and the hourly-rate snapshot of each entry.",
              )} ${t("No currency conversion applied.")}`}
            />
          }
          contentDescription={periodValueData
            .map(
              (item) =>
                `${item.currency}: ${item.value}. ${t("Previous")}: ${item.previous}. ${t(
                  "Change",
                )}: ${item.delta}.`,
            )
            .join(" ")}
        >
          <div className="min-h-[72px] space-y-3">
            {periodValueData.map((item) => {
              const DirectionIcon =
                item.direction === "up" ? ArrowUp : item.direction === "down" ? ArrowDown : Minus;
              return (
                <div key={item.currency} className="min-w-0 space-y-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <Typography type="h2" weight="semibold">
                      {item.value}
                    </Typography>
                    <Typography type="body-xs" color="muted" weight="semibold">
                      {item.currency}
                    </Typography>
                  </div>
                  <div className="flex justify-end">
                    <OverviewAccessibleTooltip
                      label={`${t("Change")}: ${item.comparison}. ${t("Previous")}: ${item.previous}`}
                      content={`${t("Previous")}: ${item.previous} · ${t("Change")}: ${item.delta}`}
                    >
                      <Chip
                        size="sm"
                        variant="soft"
                        color={
                          item.direction === "up"
                            ? "success"
                            : item.direction === "down"
                              ? "danger"
                              : "default"
                        }
                      >
                        <DirectionIcon aria-hidden="true" className="size-3" />
                        <Chip.Label>{item.comparison}</Chip.Label>
                      </Chip>
                    </OverviewAccessibleTooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </ReportWidget>
      </div>
      <div className="grid min-w-0 md:col-span-2 lg:col-span-8">
        <ReportChartWidget
          title={
            <OverviewTooltipTitle
              label={t("Activity evolution")}
              help={t("The line compares the previous equivalent period with the current one.")}
            />
          }
          action={
            <ReportChartLegend
              accessibleLabel={t("Chart legend")}
              items={[
                { key: "billable", label: t("Billable"), tone: "success" },
                { key: "internal", label: t("Internal"), tone: "default" },
                ...(hasPreviousActivity
                  ? [
                      {
                        key: "previous",
                        label: t("Previous period"),
                        tone: "accent" as const,
                      },
                    ]
                  : []),
              ]}
            />
          }
          contentDescription={evolutionSummary}
          config={{
            billable: { label: t("Billable"), color: reportChartColors.success },
            internal: { label: t("Internal"), color: reportChartColors.muted },
            previous: { label: t("Previous period"), color: reportChartColors.accent },
          }}
          summary={evolutionSummary}
          width="compact"
          isEmpty={summary.totalSeconds === 0}
          emptyState={{ title: t("No chart data") }}
        >
          <ComposedChart accessibilityLayer data={evolutionData} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...reportChartGridProps} />
            <XAxis
              {...reportChartAxisProps}
              dataKey="label"
              ticks={evolutionTicks}
              interval="preserveStartEnd"
              minTickGap={24}
              tickFormatter={(value) => shortenReportChartLabel(value, 12)}
            />
            <YAxis {...reportChartAxisProps} hide />
            <ChartTooltip
              {...reportChartTooltipProps}
              content={
                <ChartTooltipContent
                  valueFormatter={(value) => formatDuration(Number(value ?? 0), locale)}
                  footerFormatter={(payload) => {
                    const datum = payload[0]?.payload as { difference?: number } | undefined;
                    const difference = datum?.difference ?? 0;
                    const prefix = difference > 0 ? "+" : difference < 0 ? "−" : "";
                    return `${t("Difference")}: ${prefix}${formatDuration(
                      Math.abs(difference),
                      locale,
                    )}`;
                  }}
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
            {hasPreviousActivity ? (
              <Line
                dataKey="previous"
                type="monotone"
                stroke={reportChartColors.accent}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ReportChartWidget>
      </div>
      <div className="grid min-w-0 lg:col-span-4">
        <ReportChartWidget
          title={t("Billing distribution")}
          contentDescription={`${t("Billable")}: ${formatDuration(
            summary.billableSeconds,
            locale,
          )}, ${billablePercentage}%. ${t("Internal")}: ${formatDuration(
            summary.internalSeconds,
            locale,
          )}, ${internalPercentage}%.`}
          config={{
            billable: { label: t("Billable"), color: reportChartColors.success },
            internal: { label: t("Internal"), color: reportChartColors.muted },
          }}
          summary={`${t("Billable")}: ${billablePercentage}%. ${t(
            "Internal",
          )}: ${internalPercentage}%.`}
          width="compact"
          height="compact"
          legend={
            <div className="grid grid-cols-2 gap-3" aria-label={t("Chart legend")}>
              <div className="min-w-0 space-y-1">
                <BillableIndicator billable />
                <Typography type="body-sm" weight="semibold">
                  {formatDuration(summary.billableSeconds, locale)} · {billablePercentage}%
                </Typography>
              </div>
              <div className="min-w-0 space-y-1">
                <BillableIndicator billable={false} />
                <Typography type="body-sm" weight="semibold">
                  {formatDuration(summary.internalSeconds, locale)} · {internalPercentage}%
                </Typography>
              </div>
            </div>
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
              data={billingData}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="82%"
              isAnimationActive={false}
            >
              <ChartLabel
                value={formatDuration(summary.totalSeconds, locale)}
                position="center"
                fill={reportChartColors.foreground}
              />
              {billingData.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ReportChartWidget>
      </div>
      <div className="grid min-w-0 lg:col-span-4">
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
            margin={{ left: 0, right: 8 }}
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
                  footerFormatter={(payload) => {
                    const datum = payload[0]?.payload as { percentage?: number } | undefined;
                    return `${t("Share")}: ${percentageFormatter.format(datum?.percentage ?? 0)}%`;
                  }}
                />
              }
            />
            <Bar {...reportHorizontalBarProps} dataKey="seconds" fill={reportChartColors.accent} />
          </BarChart>
        </ReportChartWidget>
      </div>
      <div className="grid min-w-0 md:col-span-2 lg:col-span-8">
        <ReportWidget
          title={t("Top projects")}
          contentDescription={projectSummary || t("No activity")}
          isEmpty={projectData.length === 0}
          emptyState={{ title: t("No projects found") }}
        >
          <DataTable
            label={t("Top projects")}
            minWidth="min-w-[640px]"
            scrollHint={t("Scroll horizontally to see all columns")}
          >
            <Table.Header>
              {["Project / client", "Tracked", "Billable", "Estimated billable value"].map(
                (label, index) => (
                  <Table.Column key={label} isRowHeader={index === 0}>
                    {t(label)}
                  </Table.Column>
                ),
              )}
            </Table.Header>
            <Table.Body>
              {projectData.map((project) => (
                <Table.Row key={project.id}>
                  <Table.Cell>
                    <div className="min-w-0">
                      <ProjectLabel
                        project={project.projectColor ? { color: project.projectColor } : null}
                        label={project.id === "none" ? t("No project") : project.project}
                      />
                      <Typography type="body-xs" color="muted" truncate>
                        {project.client ?? t("No client")}
                      </Typography>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {formatDuration(project.seconds, locale)}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {formatDuration(project.billableSeconds, locale)}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {formatMoneyTotals(project.valueByCurrency, locale) || "—"}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </DataTable>
        </ReportWidget>
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
  onExport,
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
  onExport: () => void;
}) {
  const { locale, t } = useI18n();
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleColumns = detailedColumnOptions.filter((column) => columns.includes(column.id));
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.seconds, 0);
  const billableSeconds = entries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.seconds, 0);
  const billableTotals = sumBillableValues(entries, fallbackForEntry);
  const billableCurrencies = currencyOptions.filter(
    (currency) => billableTotals[currency] !== undefined,
  );
  return (
    <ReportTableWidget
      title={t("Detailed entries")}
      description={t("Choose the columns you need for this view.")}
      action={
        <div className="flex items-center gap-2">
          <ReportColumnPicker columns={columns} onChange={onChangeColumns} />
          <ReportExportButton onPress={onExport} />
        </div>
      }
      contentDescription={t("Detailed report table")}
      isEmpty={entries.length === 0}
      emptyState={{
        title: t("No time entries match"),
        description: t("Try a wider period or clear one of the active filters."),
        action: (
          <Button variant="secondary" onPress={onClear}>
            <ArrowRotateLeft className="size-4" />
            {t("Clear filters")}
          </Button>
        ),
      }}
    >
      <DataTable
        label={t("Detailed report table")}
        minWidth="min-w-[1280px]"
        scrollHint={t("Scroll horizontally to see all columns")}
        footer={
          <div className="flex w-full flex-wrap items-center gap-4">
            <span className="whitespace-nowrap">
              {t("Entries")}: {entries.length}
            </span>
            <span className="whitespace-nowrap">
              {t("Tracked")}: {formatDuration(totalSeconds, locale)}
            </span>
            <span className="whitespace-nowrap">
              {t("Billable")}: {formatDuration(billableSeconds, locale)}
            </span>
            <span className="whitespace-nowrap">
              {t("Internal")}: {formatDuration(totalSeconds - billableSeconds, locale)}
            </span>
            {billableCurrencies.map((currency) => (
              <span key={currency} className="whitespace-nowrap">
                {t("Estimated billable value")} ({currency}):{" "}
                {formatMoney(billableTotals[currency] ?? 0, currency, locale)}
              </span>
            ))}
            {billableCurrencies.length === 0 ? (
              <span className="whitespace-nowrap">
                {t("Estimated billable value")}: {t("No estimated billable value")}
              </span>
            ) : null}
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
              {column.id === "billability" ? (
                <span className="inline-flex items-center gap-2">
                  <BillableIndicator billable={null} mode="icon" />
                  <span>{t(column.label)}</span>
                </span>
              ) : (
                t(column.label)
              )}
            </Table.Column>
          ))}
        </Table.Header>
        <Table.Body>
          {pageEntries.map((entry) => (
            <Table.Row key={entry.id}>
              {visibleColumns.map((column) => (
                <Table.Cell
                  key={column.id}
                  className={
                    column.id === "task" ||
                    column.id === "projectClient" ||
                    column.id === "description"
                      ? ""
                      : "whitespace-nowrap"
                  }
                >
                  {renderDetailedCell(
                    entry,
                    column.id,
                    members,
                    projects,
                    clients,
                    fallbackForEntry,
                    locale,
                    t,
                  )}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </DataTable>
    </ReportTableWidget>
  );
}

function renderDetailedCell(
  entry: TimeEntry,
  column: DetailedColumn,
  members: Member[],
  projects: Project[],
  clients: Client[],
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
  locale: Locale,
  t: Translate,
): ReactNode {
  if (column === "date") return formatDate(entry.date, locale);
  if (column === "member") return nameForMember(members, entry.userId);
  if (column === "projectClient") {
    return (
      <div className="min-w-0">
        <ProjectLabel
          project={projectFor(projects, entry.projectId)}
          label={projectNameFor(projects, entry.projectId)}
        />
        <div className="truncate">{clientNameFor(clients, projects, entry.projectId)}</div>
      </div>
    );
  }
  if (column === "task") return <div className="truncate">{entry.task}</div>;
  if (column === "description") {
    return <div className="truncate">{entry.description ?? "—"}</div>;
  }
  if (column === "start") return entry.start;
  if (column === "end") return endLabel(entry);
  if (column === "duration") return formatDuration(entry.seconds, locale);
  if (column === "billability") return <BillableIndicator billable={entry.billable} />;
  const billing = billingForEntry(entry, fallbackForEntry(entry));
  if (column === "hourlyRate") return formatMoney(billing.hourlyRate, billing.currency, locale);
  if (column === "currency") return billing.currency;
  return formatMoney(billableValue(entry, billing), billing.currency, locale);
}

function BillableTableLabel({ billable, label }: { billable: boolean; label: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BillableIndicator billable={billable} mode="icon" />
      <span>{label}</span>
    </span>
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
  projects,
  total,
  primary,
  secondary,
  expanded,
  onToggle,
  onChangeGroup,
  onChangeSubgroup,
  onClear,
  canGroupByMember,
  onExport,
}: {
  groups: ReportGroup[];
  previousGroups: ReportGroup[];
  projects: Project[];
  total: number;
  primary: GroupDimension;
  secondary: GroupDimension | "none";
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  onChangeGroup: (group: GroupDimension) => void;
  onChangeSubgroup: (group: GroupDimension | "none") => void;
  onClear: () => void;
  canGroupByMember: boolean;
  onExport: () => void;
}) {
  const { locale, t } = useI18n();
  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <ReportExportButton onPress={onExport} />
        </div>
        <EmptyReport onClear={onClear} />
      </div>
    );
  }
  const percentageFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectGrouping = primary === "project" || secondary === "project";
  const topGroups = groups.slice(0, 8);
  const topGroup = groups[0]!;
  const topGroupShare = total > 0 ? (topGroup.seconds / total) * 100 : 0;
  const previousTotal = previousGroups.reduce((sum, group) => sum + group.seconds, 0);
  const previousTopGroup = previousGroups[0];
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
    groups.some((group) => group.billableValue[currency] !== undefined),
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
  const availableGroupOptions = canGroupByMember
    ? groupOptions
    : groupOptions.filter((option) => option.id !== "member");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReportExportButton onPress={onExport} />
      </div>
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
                { key: "billable", label: t("Billable"), tone: "success", billable: true },
                { key: "internal", label: t("Internal"), billable: false },
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
            title={t("Estimated billable value by group")}
            description={t("Values shown in {currency}.", { currency: singleCurrency })}
            contentDescription={valueSummary}
            config={{
              value: { label: t("Estimated billable value"), color: reportChartColors.accent },
            }}
            summary={valueSummary}
            width="compact"
            height="tall"
            isEmpty={valueData.length === 0}
            emptyState={{ title: t("No estimated billable value") }}
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
            title={t("Estimated billable value by group")}
            description={
              currencies.length > 1
                ? t("Multiple currencies cannot be compared on the same axis.")
                : t("No estimated billable value in the selected period.")
            }
            contentDescription={valueSummary || t("No estimated billable value")}
            isEmpty={currencies.length === 0}
            emptyState={{ title: t("No estimated billable value") }}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <GroupSelect
                label="Group by"
                value={primary}
                options={availableGroupOptions}
                onChange={(value) => {
                  if (value !== "none") onChangeGroup(value);
                }}
              />
              <GroupSelect
                label="Then by"
                value={secondary}
                options={[
                  { id: "none", label: t("None") },
                  ...availableGroupOptions.filter((option) => option.id !== primary),
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
                "Estimated billable value",
                "Records",
                "Average entry duration",
              ].map((label, index) => (
                <Table.Column key={label} isRowHeader={index === 0}>
                  {label === "Billable" || label === "Internal" ? (
                    <BillableTableLabel billable={label === "Billable"} label={t(label)} />
                  ) : (
                    t(label)
                  )}
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
                  project={projectGrouping ? (projectById.get(group.key) ?? null) : null}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </Table.Body>
          </DataTable>
        </ReportTableWidget>
      </ReportWidgetGrid>
    </div>
  );
}

function SummaryRow({
  group,
  total,
  level,
  path,
  project,
  expanded,
  onToggle,
}: {
  group: ReportGroup;
  total: number;
  level: number;
  path: string;
  project: Project | null;
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
          <ProjectLabel project={project} label={group.label} />
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
  color: string | null;
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
      color:
        dimension === "project" ? (projectFor(projects, entry.projectId)?.color ?? null) : null,
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
              <Table.Column>
                <BillableTableLabel billable={true} label={t("Billable")} />
              </Table.Column>
              <Table.Column>
                <BillableTableLabel billable={false} label={t("Internal")} />
              </Table.Column>
              <Table.Column>{t("Estimated billable value")}</Table.Column>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.key}>
                  <Table.Cell>
                    <ProjectLabel
                      project={row.color ? { color: row.color } : null}
                      label={row.label}
                    />
                  </Table.Cell>
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
  memberIds: readonly string[],
  range: DateRange,
  timeZone: string,
  fallbackForEntry: (entry: TimeEntry) => BillingPreference,
): TeamRow[] {
  const memberFilter = new Set(memberIds);
  return members
    .filter(
      (member) =>
        member.status === "active" && (memberFilter.size === 0 || memberFilter.has(member.id)),
    )
    .map((member) => {
      const memberEntries = entries.filter((entry) => entry.userId === member.id);
      const metrics = calculateReportMetrics({
        entries: memberEntries,
        range,
        projects,
        clients,
        fallbackForEntry,
        timeZone,
      });
      const projectIds = metrics.projectBreakdown
        .filter((project) => project.id !== "none")
        .map((project) => project.id);
      return {
        member,
        seconds: metrics.totalSeconds,
        billable: metrics.billableSeconds,
        projectCount: projectIds.length,
        clientCount: new Set(
          projectIds.map((projectId) => projectFor(projects, projectId)?.clientId).filter(Boolean),
        ).size,
        activeDays: metrics.activeDays,
        billableValue: metrics.billableValueByCurrency,
      };
    })
    .sort((a, b) => b.seconds - a.seconds || a.member.name.localeCompare(b.member.name));
}

function TeamReport({
  entries,
  members,
  projects,
  clients,
  memberIds,
  range,
  timeZone,
  onClear,
  fallbackForEntry,
}: {
  entries: TimeEntry[];
  members: Member[];
  projects: Project[];
  clients: Client[];
  memberIds: readonly string[];
  range: DateRange;
  timeZone: string;
  onClear: () => void;
  fallbackForEntry: (entry: TimeEntry) => BillingPreference;
}) {
  const { locale, t } = useI18n();
  const rows = buildTeamRows(
    entries,
    members,
    projects,
    clients,
    memberIds,
    range,
    timeZone,
    fallbackForEntry,
  );
  if (rows.length === 0) return <EmptyReport onClear={onClear} />;
  const totalSeconds = rows.reduce((sum, row) => sum + row.seconds, 0);
  const percentageFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const visibleRows = rows.slice(0, 8);
  const trackedData = visibleRows
    .filter((row) => row.seconds > 0)
    .map((row) => ({
      member: row.member.name,
      seconds: row.seconds,
      display: formatDuration(row.seconds, locale),
    }));
  const billablePercentageData = visibleRows
    .filter((row) => row.seconds > 0)
    .map((row) => ({
      member: row.member.name,
      percentage: (row.billable / row.seconds) * 100,
      display: `${percentageFormatter.format((row.billable / row.seconds) * 100)}% · ${formatDuration(
        row.billable,
        locale,
      )}`,
    }));
  const dailyAverageData = rows
    .filter((row) => row.activeDays > 0)
    .map((row) => ({
      member: row.member.name,
      average: row.seconds / row.activeDays,
      activeDays: row.activeDays,
      display: `${row.activeDays} ${t("active days")} · ${formatDuration(
        row.seconds / row.activeDays,
        locale,
      )}`,
    }))
    .sort(
      (first, second) =>
        second.average - first.average || first.member.localeCompare(second.member),
    )
    .slice(0, 8);
  const valueCurrencies = currencyOptions.filter((currency) =>
    rows.some((row) => row.billableValue[currency] !== undefined),
  );
  const valueGroups = valueCurrencies.map((currency) => ({
    currency,
    data: rows
      .filter((row) => row.billableValue[currency] !== undefined)
      .map((row) => ({
        member: row.member.name,
        value: row.billableValue[currency] ?? 0,
        display: formatMoney(row.billableValue[currency] ?? 0, currency, locale),
      }))
      .sort(
        (first, second) => second.value - first.value || first.member.localeCompare(second.member),
      )
      .slice(0, 8),
  }));
  const largestShare = rows.find((row) => row.seconds > 0);
  const trackedSummary = trackedData
    .map((item) => `${item.member}: ${formatDuration(item.seconds, locale)}`)
    .join(". ");
  const billableSummary = billablePercentageData
    .map((item) => `${item.member}: ${item.display}`)
    .join(". ");
  const dailyAverageSummary = dailyAverageData
    .map((item) => `${item.member}: ${item.display}`)
    .join(". ");
  const valueSummary = valueGroups
    .flatMap((group) => group.data.map((item) => `${item.member}: ${item.display}`))
    .join(". ");

  return (
    <ReportWidgetGrid>
      <ReportChartWidget
        title={t("Time by member")}
        description={t("Up to eight members, ordered by registered activity.")}
        contentDescription={trackedSummary || t("No activity")}
        config={{ seconds: { label: t("Tracked"), color: reportChartColors.accent } }}
        summary={trackedSummary || t("No activity")}
        height="tall"
        isEmpty={trackedData.length === 0}
        emptyState={{ title: t("No activity") }}
      >
        <BarChart
          accessibilityLayer
          data={trackedData}
          layout="vertical"
          margin={{ left: 0, right: 72 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="seconds" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="member"
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

      <ReportChartWidget
        title={t("Billable percentage by member")}
        description={t("Billable duration is shown with each percentage.")}
        contentDescription={billableSummary || t("No activity")}
        config={{
          percentage: { label: t("Billable percentage"), color: reportChartColors.success },
        }}
        summary={billableSummary || t("No activity")}
        width="compact"
        height="tall"
        isEmpty={billablePercentageData.length === 0}
        emptyState={{ title: t("No activity") }}
      >
        <BarChart
          accessibilityLayer
          data={billablePercentageData}
          layout="vertical"
          margin={{ left: 0, right: 112 }}
        >
          <XAxis
            {...reportChartAxisProps}
            type="number"
            dataKey="percentage"
            domain={[0, 100]}
            hide
          />
          <YAxis
            {...reportChartAxisProps}
            dataKey="member"
            type="category"
            width={84}
            tickFormatter={(value) => shortenReportChartLabel(value, 11)}
          />
          <ChartTooltip
            {...reportChartTooltipProps}
            content={
              <ChartTooltipContent
                hideLabel
                valueFormatter={(value) => `${percentageFormatter.format(Number(value ?? 0))}%`}
              />
            }
          />
          <Bar {...reportHorizontalBarProps} dataKey="percentage" fill={reportChartColors.success}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>

      <ReportWidget
        title={t("Estimated billable value by member")}
        description={
          valueCurrencies.length > 1
            ? t("Currencies are shown in separate groups and are never combined.")
            : t("Members are compared only within the same currency.")
        }
        width="medium"
        contentDescription={valueSummary || t("No estimated billable value")}
        isEmpty={valueGroups.length === 0}
        emptyState={{ title: t("No estimated billable value") }}
      >
        <div className="space-y-6">
          {valueGroups.map((group) => (
            <div key={group.currency} className="space-y-2">
              <Typography type="body-sm" weight="semibold">
                {group.currency}
              </Typography>
              <ReportChart
                config={{
                  value: { label: t("Estimated billable value"), color: reportChartColors.accent },
                }}
                summary={group.data.map((item) => `${item.member}: ${item.display}`).join(". ")}
                height="tall"
                isEmpty={group.data.length === 0}
                emptyState={
                  <Typography type="body-sm" color="muted">
                    {t("No estimated billable value")}
                  </Typography>
                }
              >
                <BarChart
                  accessibilityLayer
                  data={group.data}
                  layout="vertical"
                  margin={{ left: 0, right: 96 }}
                >
                  <XAxis {...reportChartAxisProps} type="number" dataKey="value" hide />
                  <YAxis
                    {...reportChartAxisProps}
                    dataKey="member"
                    type="category"
                    width={92}
                    tickFormatter={(value) => shortenReportChartLabel(value, 13)}
                  />
                  <ChartTooltip
                    {...reportChartTooltipProps}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        valueFormatter={(value) =>
                          formatMoney(Number(value ?? 0), group.currency, locale)
                        }
                      />
                    }
                  />
                  <Bar
                    {...reportHorizontalBarProps}
                    dataKey="value"
                    fill={reportChartColors.accent}
                  >
                    <LabelList
                      dataKey="display"
                      position="right"
                      fill={reportChartColors.foreground}
                    />
                  </Bar>
                </BarChart>
              </ReportChart>
            </div>
          ))}
        </div>
      </ReportWidget>

      <ReportWidget
        title={t("Team share")}
        description={t("Share represents only the distribution of registered activity.")}
        contentDescription={
          largestShare
            ? `${largestShare.member.name}: ${formatDuration(
                largestShare.seconds,
                locale,
              )}, ${percentageFormatter.format((largestShare.seconds / totalSeconds) * 100)}%.`
            : t("No activity")
        }
        isEmpty={!largestShare}
        emptyState={{ title: t("No activity") }}
      >
        {largestShare ? (
          <div className="space-y-3">
            <Typography type="h2" weight="semibold">
              {largestShare.member.name}
            </Typography>
            <Typography type="body-sm" color="muted">
              {formatDuration(largestShare.seconds, locale)} ·{" "}
              {percentageFormatter.format((largestShare.seconds / totalSeconds) * 100)}%
            </Typography>
            <Typography type="body-sm">
              {t(
                "This member accounts for the largest share of registered activity in the period.",
              )}
            </Typography>
          </div>
        ) : (
          <span />
        )}
      </ReportWidget>

      <ReportChartWidget
        title={t("Active days and daily average")}
        description={t("Comparison of registered activity by active day.")}
        contentDescription={dailyAverageSummary || t("No activity")}
        config={{
          average: { label: t("Average per active day"), color: reportChartColors.accent },
        }}
        summary={dailyAverageSummary || t("No activity")}
        height="tall"
        isEmpty={dailyAverageData.length === 0}
        emptyState={{ title: t("No activity") }}
      >
        <BarChart
          accessibilityLayer
          data={dailyAverageData}
          layout="vertical"
          margin={{ left: 0, right: 148 }}
        >
          <XAxis {...reportChartAxisProps} type="number" dataKey="average" hide />
          <YAxis
            {...reportChartAxisProps}
            dataKey="member"
            type="category"
            width={92}
            tickFormatter={(value) => shortenReportChartLabel(value, 13)}
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
          <Bar {...reportHorizontalBarProps} dataKey="average" fill={reportChartColors.accent}>
            <LabelList dataKey="display" position="right" fill={reportChartColors.foreground} />
          </Bar>
        </BarChart>
      </ReportChartWidget>

      <ReportTableWidget
        title={t("Complete team activity")}
        description={t("All members in the current report scope.")}
        contentDescription={t("Team report table")}
      >
        <DataTable
          label={t("Team report table")}
          minWidth="min-w-[1280px]"
          scrollHint={t("Scroll horizontally to see all columns")}
        >
          <Table.Header>
            {[
              "Member",
              "Tracked",
              "Billable",
              "Internal",
              "Billable percentage",
              "Estimated billable value",
              "Active days",
              "Average per active day",
              "Projects",
              "Clients",
              "Share",
            ].map((label, index) => (
              <Table.Column key={label} isRowHeader={index === 0}>
                {label === "Billable" || label === "Internal" ? (
                  <BillableTableLabel billable={label === "Billable"} label={t(label)} />
                ) : (
                  t(label)
                )}
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
                <Table.Cell>
                  {row.seconds
                    ? `${percentageFormatter.format((row.billable / row.seconds) * 100)}%`
                    : "0%"}
                </Table.Cell>
                <Table.Cell>{formatMoneyTotals(row.billableValue, locale)}</Table.Cell>
                <Table.Cell>{row.activeDays}</Table.Cell>
                <Table.Cell>
                  {formatDuration(
                    row.activeDays ? Math.round(row.seconds / row.activeDays) : 0,
                    locale,
                  )}
                </Table.Cell>
                <Table.Cell>{row.projectCount}</Table.Cell>
                <Table.Cell>{row.clientCount}</Table.Cell>
                <Table.Cell>
                  {totalSeconds
                    ? `${percentageFormatter.format((row.seconds / totalSeconds) * 100)}%`
                    : "0%"}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </DataTable>
      </ReportTableWidget>
    </ReportWidgetGrid>
  );
}
