import { isCurrencyCode, type CurrencyCode } from "./billing";
import { isValidDateOnly, type ReportPeriodPreset } from "./format";

const reportFilterStorageVersion = 1;
const reportFilterStoragePrefix = "time-blossom:report-filters";

const reportPeriodPresets: ReportPeriodPreset[] = [
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
];

export type StoredReportFilters = {
  version: typeof reportFilterStorageVersion;
  preset: ReportPeriodPreset;
  start: string;
  end: string;
  memberIds: string[];
  clientIds: string[];
  projectIds: string[];
  description: string;
  billability: "all" | "billable" | "internal";
  currency: "all" | CurrencyCode;
  visibleFilters: string[];
};

export type ReportFilterScope = {
  currentUserId: string;
  canViewTeam: boolean;
  memberIds: readonly string[];
  clientIds: readonly string[];
  projectIds: readonly string[];
  visibleFilters: readonly string[];
};

type ReportFilterStorage = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item): item is string => typeof item === "string").map((item) => item.trim()),
    ),
  ].filter(Boolean);
}

function isReportPeriodPreset(value: unknown): value is ReportPeriodPreset {
  return reportPeriodPresets.includes(value as ReportPeriodPreset);
}

export function createReportFilterStorageKey(workspaceId: string, userId: string): string {
  return `${reportFilterStoragePrefix}:v${reportFilterStorageVersion}:${encodeURIComponent(
    workspaceId,
  )}:${encodeURIComponent(userId)}`;
}

export function hasExplicitReportFilterParams(searchString: string): boolean {
  const params = new URLSearchParams(searchString);
  const preset = params.get("preset");

  return (
    (preset !== null && preset !== "this-month") ||
    (params.get("start")?.trim().length ?? 0) > 0 ||
    (params.get("end")?.trim().length ?? 0) > 0 ||
    (params.get("members")?.trim().length ?? 0) > 0 ||
    (params.get("clients")?.trim().length ?? 0) > 0 ||
    (params.get("projects")?.trim().length ?? 0) > 0 ||
    (params.get("description")?.trim().length ?? 0) > 0 ||
    (params.get("billability") !== null && params.get("billability") !== "all") ||
    (params.get("currency") !== null && params.get("currency") !== "all")
  );
}

export function parseStoredReportFilters(value: string | null): StoredReportFilters | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed["version"] !== reportFilterStorageVersion) return null;

    const rawPreset = parsed["preset"];
    const rawStart = typeof parsed["start"] === "string" ? parsed["start"] : "";
    const rawEnd = typeof parsed["end"] === "string" ? parsed["end"] : "";
    const hasValidCustomRange = isValidDateOnly(rawStart) && isValidDateOnly(rawEnd);
    const preset =
      isReportPeriodPreset(rawPreset) && (rawPreset !== "custom" || hasValidCustomRange)
        ? rawPreset
        : "this-month";
    const billability =
      parsed["billability"] === "billable" || parsed["billability"] === "internal"
        ? parsed["billability"]
        : "all";
    const currency = isCurrencyCode(parsed["currency"]) ? parsed["currency"] : "all";

    return {
      version: reportFilterStorageVersion,
      preset,
      start: preset === "custom" ? rawStart : "",
      end: preset === "custom" ? rawEnd : "",
      memberIds: uniqueStrings(parsed["memberIds"]),
      clientIds: uniqueStrings(parsed["clientIds"]),
      projectIds: uniqueStrings(parsed["projectIds"]),
      description: typeof parsed["description"] === "string" ? parsed["description"] : "",
      billability,
      currency,
      visibleFilters: uniqueStrings(parsed["visibleFilters"]),
    };
  } catch {
    return null;
  }
}

export function readStoredReportFilters(
  storage: ReportFilterStorage,
  key: string,
): StoredReportFilters | null {
  try {
    return parseStoredReportFilters(storage.getItem(key));
  } catch {
    return null;
  }
}

export function writeStoredReportFilters(
  storage: ReportFilterStorage,
  key: string,
  filters: StoredReportFilters,
): boolean {
  try {
    storage.setItem(key, JSON.stringify(filters));
    return true;
  } catch {
    return false;
  }
}

export function resolveInitialReportFilters({
  currentFilters,
  savedFilters,
  currentUserId,
  hasExplicitFilters,
}: {
  currentFilters: StoredReportFilters;
  savedFilters: StoredReportFilters | null;
  currentUserId: string;
  hasExplicitFilters: boolean;
}): StoredReportFilters {
  if (hasExplicitFilters) return currentFilters;
  if (savedFilters) return savedFilters;
  return { ...currentFilters, memberIds: [currentUserId] };
}

export function constrainReportFiltersToScope(
  filters: StoredReportFilters,
  scope: ReportFilterScope,
): StoredReportFilters {
  const validMemberIds = new Set([scope.currentUserId, ...scope.memberIds]);
  const validClientIds = new Set(scope.clientIds);
  const validProjectIds = new Set(["none", ...scope.projectIds]);
  const validVisibleFilters = new Set(scope.visibleFilters);

  return createStoredReportFilters({
    preset: filters.preset,
    start: filters.start,
    end: filters.end,
    memberIds: scope.canViewTeam
      ? filters.memberIds.filter((id) => validMemberIds.has(id))
      : [scope.currentUserId],
    clientIds: filters.clientIds.filter((id) => validClientIds.has(id)),
    projectIds: filters.projectIds.filter((id) => validProjectIds.has(id)),
    description: filters.description,
    billability: filters.billability,
    currency: filters.currency,
    visibleFilters: filters.visibleFilters.filter((key) => validVisibleFilters.has(key)),
  });
}

export function createStoredReportFilters(
  filters: Omit<StoredReportFilters, "version">,
): StoredReportFilters {
  return { version: reportFilterStorageVersion, ...filters };
}
